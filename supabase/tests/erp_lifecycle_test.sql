-- ============================================================================
-- Pradeep Classes Management: ERP Lifecycle & Clean Handover Test Suite
-- Migration: 0018_erp_lifecycle_and_clean_handover.sql
-- Pure SQL test running inside a transaction concluding with ROLLBACK.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- FIXTURES SETUP
-- ----------------------------------------------------------------------------

CREATE TEMP TABLE test_fixtures AS SELECT
  'a1111111-1111-4111-8111-111111111111'::uuid AS owner_uid,
  'b2222222-2222-4222-8222-222222222222'::uuid AS admin_uid,
  'c3333333-3333-4333-8333-333333333333'::uuid AS student_user_uid,
  'd4444444-4444-4444-8444-444444444444'::uuid AS teacher_user_uid,
  'e5555555-5555-4555-8555-555555555555'::uuid AS other_inst_owner_uid,
  '11111111-2222-3333-4444-555555555555'::uuid AS default_inst_id,
  '99999999-9999-4999-8999-999999999999'::uuid AS other_inst_id,
  gen_random_uuid() AS test_student_id,
  gen_random_uuid() AS test_teacher_id,
  gen_random_uuid() AS test_batch_id,
  gen_random_uuid() AS test_payroll_id,
  gen_random_uuid() AS test_expense_id;

-- Ensure secondary institute exists for tenant isolation test
INSERT INTO public.institutes (id, name, slug)
SELECT other_inst_id, 'Other Institute', 'other-institute'
FROM test_fixtures
ON CONFLICT (id) DO NOTHING;

-- Seed auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
SELECT owner_uid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'owner_test@pradeepclasses.in', '$2a$06$fakehashfakehashfakehashfakeh', now(), '{"full_name": "Owner Tester"}'::jsonb FROM test_fixtures UNION ALL
SELECT admin_uid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'admin_test@pradeepclasses.in', '$2a$06$fakehashfakehashfakehashfakeh', now(), '{"full_name": "Admin Tester"}'::jsonb FROM test_fixtures UNION ALL
SELECT student_user_uid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'student_user@pradeepclasses.in', '$2a$06$fakehashfakehashfakehashfakeh', now(), '{"full_name": "Student User"}'::jsonb FROM test_fixtures UNION ALL
SELECT teacher_user_uid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'teacher_user@pradeepclasses.in', '$2a$06$fakehashfakehashfakehashfakeh', now(), '{"full_name": "Teacher User"}'::jsonb FROM test_fixtures UNION ALL
SELECT other_inst_owner_uid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'other_owner@other.in', '$2a$06$fakehashfakehashfakehashfakeh', now(), '{"full_name": "Other Owner"}'::jsonb FROM test_fixtures
ON CONFLICT (id) DO NOTHING;

-- Set bootstrap flag to insert fixtures into profiles
SELECT set_config('institute.internal_bootstrap_in_progress', 'true', true);

INSERT INTO public.profiles (id, full_name, role, institute_id, is_active)
SELECT owner_uid, 'Owner Tester', 'owner'::public.app_role, default_inst_id, true FROM test_fixtures UNION ALL
SELECT admin_uid, 'Admin Tester', 'admin'::public.app_role, default_inst_id, true FROM test_fixtures UNION ALL
SELECT student_user_uid, 'Student User', 'student'::public.app_role, default_inst_id, true FROM test_fixtures UNION ALL
SELECT teacher_user_uid, 'Teacher User', 'teacher'::public.app_role, default_inst_id, true FROM test_fixtures UNION ALL
SELECT other_inst_owner_uid, 'Other Owner', 'owner'::public.app_role, other_inst_id, true FROM test_fixtures
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, institute_id = EXCLUDED.institute_id;

SELECT set_config('institute.internal_bootstrap_in_progress', 'false', true);

-- ----------------------------------------------------------------------------
-- TEST 1: Student Status Check Constraint
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_inst_id uuid;
  v_test_std_id uuid := gen_random_uuid();
  v_caught boolean := false;
BEGIN
  SELECT default_inst_id INTO v_inst_id FROM test_fixtures;

  -- 1. All 6 canonical values should be accepted
  INSERT INTO public.students (id, admission_no, full_name, class_name, status, institute_id)
  VALUES (gen_random_uuid(), 'PC-2026-9001', 'Active Student', 'Class 12', 'active', v_inst_id);

  INSERT INTO public.students (id, admission_no, full_name, class_name, status, institute_id)
  VALUES (gen_random_uuid(), 'PC-2026-9002', 'On Hold Student', 'Class 12', 'on_hold', v_inst_id);

  INSERT INTO public.students (id, admission_no, full_name, class_name, status, institute_id)
  VALUES (gen_random_uuid(), 'PC-2026-9003', 'Alumni Student', 'Class 12', 'alumni', v_inst_id);

  INSERT INTO public.students (id, admission_no, full_name, class_name, status, institute_id)
  VALUES (gen_random_uuid(), 'PC-2026-9004', 'Rusticated Student', 'Class 12', 'rusticated', v_inst_id);

  INSERT INTO public.students (id, admission_no, full_name, class_name, status, institute_id)
  VALUES (gen_random_uuid(), 'PC-2026-9005', 'Dropped Out Student', 'Class 12', 'dropped_out', v_inst_id);

  INSERT INTO public.students (id, admission_no, full_name, class_name, status, institute_id)
  VALUES (gen_random_uuid(), 'PC-2026-9006', 'Archived Student', 'Class 12', 'archived', v_inst_id);

  -- 2. Invalid status should be rejected
  BEGIN
    INSERT INTO public.students (id, admission_no, full_name, class_name, status, institute_id)
    VALUES (v_test_std_id, 'PC-2026-9007', 'Invalid Student', 'Class 12', 'invalid_status', v_inst_id);
  EXCEPTION WHEN check_violation THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Invalid student status was not rejected by check constraint';
  END IF;

  RAISE NOTICE 'TEST 1 PASSED: Student status check constraint verified';
END $$;

-- ----------------------------------------------------------------------------
-- TEST 2: Teacher Status Check Constraint
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_inst_id uuid;
  v_caught boolean := false;
BEGIN
  SELECT default_inst_id INTO v_inst_id FROM test_fixtures;

  -- Canonical values accepted
  INSERT INTO public.teachers (id, full_name, subject, status, institute_id)
  VALUES (gen_random_uuid(), 'Active Faculty', 'Maths', 'active', v_inst_id);

  INSERT INTO public.teachers (id, full_name, subject, status, institute_id)
  VALUES (gen_random_uuid(), 'On Leave Faculty', 'Physics', 'on_leave', v_inst_id);

  INSERT INTO public.teachers (id, full_name, subject, status, institute_id)
  VALUES (gen_random_uuid(), 'Relieved Faculty', 'Chemistry', 'relieved', v_inst_id);

  -- Invalid status rejected
  BEGIN
    INSERT INTO public.teachers (id, full_name, subject, status, institute_id)
    VALUES (gen_random_uuid(), 'Invalid Faculty', 'Biology', 'retired', v_inst_id);
  EXCEPTION WHEN check_violation THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Invalid teacher status was not rejected by check constraint';
  END IF;

  RAISE NOTICE 'TEST 2 PASSED: Teacher status check constraint verified';
END $$;

-- ----------------------------------------------------------------------------
-- TEST 3: Student Deletion Guards & Cascade Purge
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_uid uuid;
  v_student_user_uid uuid;
  v_inst_id uuid;
  v_std_id uuid := gen_random_uuid();
  v_res jsonb;
  v_caught boolean := false;
BEGIN
  SELECT admin_uid, student_user_uid, default_inst_id INTO v_admin_uid, v_student_user_uid, v_inst_id FROM test_fixtures;

  -- 1. Non-admin caller raises Unauthorized
  PERFORM set_config('request.jwt.claim.sub', v_student_user_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  BEGIN
    PERFORM public.admin_delete_student(v_std_id, false);
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 3.1 FAILED: Student was able to call admin_delete_student';
  END IF;

  -- Switch to Admin caller
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  -- Seed student with linked profile and fee record
  INSERT INTO public.students (id, admission_no, full_name, class_name, profile_id, institute_id)
  VALUES (v_std_id, 'PC-2026-9010', 'Cascade Student', 'Class 11', v_student_user_uid, v_inst_id);

  INSERT INTO public.fee_records (id, student_id, institute_id, amount, status, due_date)
  VALUES (gen_random_uuid(), v_std_id, v_inst_id, 50000, 'pending', current_date);

  -- 2. Force cascade = false -> blocked with counts
  v_res := public.admin_delete_student(v_std_id, false);
  IF (v_res->>'blocked')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 3.2 FAILED: Deletion was not blocked when historical fee records existed';
  END IF;

  -- 3. Force cascade = true -> student and linked records deleted
  v_res := public.admin_delete_student(v_std_id, true);
  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 3.3 FAILED: Force cascade deletion failed: %', v_res;
  END IF;

  -- Verify student removed
  IF EXISTS (SELECT 1 FROM public.students WHERE id = v_std_id) THEN
    RAISE EXCEPTION 'TEST 3.4 FAILED: Student still exists in database after cascade delete';
  END IF;

  -- Verify fee records removed
  IF EXISTS (SELECT 1 FROM public.fee_records WHERE student_id = v_std_id) THEN
    RAISE EXCEPTION 'TEST 3.5 FAILED: Linked fee records still exist';
  END IF;

  RAISE NOTICE 'TEST 3 PASSED: Student deletion guards and cascade purge verified';
END $$;

-- ----------------------------------------------------------------------------
-- TEST 4: Teacher Deletion Guards & Cascade Purge
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_uid uuid;
  v_teacher_user_uid uuid;
  v_inst_id uuid;
  v_tch_id uuid := gen_random_uuid();
  v_res jsonb;
BEGIN
  SELECT admin_uid, teacher_user_uid, default_inst_id INTO v_admin_uid, v_teacher_user_uid, v_inst_id FROM test_fixtures;
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  INSERT INTO public.teachers (id, full_name, subject, profile_id, institute_id)
  VALUES (v_tch_id, 'Cascade Teacher', 'Physics', v_teacher_user_uid, v_inst_id);

  INSERT INTO public.teacher_payrolls (id, teacher_id, institute_id, payroll_month, base_salary, net_amount, status)
  VALUES (gen_random_uuid(), v_tch_id, v_inst_id, '2026-01', 45000, 45000, 'pending');

  -- 1. Force cascade = false -> blocked
  v_res := public.admin_delete_teacher(v_tch_id, false);
  IF (v_res->>'blocked')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 4.1 FAILED: Faculty deletion was not blocked when payroll exists';
  END IF;

  -- 2. Force cascade = true -> teacher and payroll deleted
  v_res := public.admin_delete_teacher(v_tch_id, true);
  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 4.2 FAILED: Force cascade faculty delete failed: %', v_res;
  END IF;

  IF EXISTS (SELECT 1 FROM public.teachers WHERE id = v_tch_id) THEN
    RAISE EXCEPTION 'TEST 4.3 FAILED: Teacher still exists after cascade delete';
  END IF;

  IF EXISTS (SELECT 1 FROM public.teacher_payrolls WHERE teacher_id = v_tch_id) THEN
    RAISE EXCEPTION 'TEST 4.4 FAILED: Historical payroll still exists after cascade delete';
  END IF;

  RAISE NOTICE 'TEST 4 PASSED: Teacher deletion guards and cascade purge verified';
END $$;

-- ----------------------------------------------------------------------------
-- TEST 5: Batch Deletion Guards & Cascade
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_uid uuid;
  v_inst_id uuid;
  v_batch_id uuid := gen_random_uuid();
  v_std_id uuid := gen_random_uuid();
  v_res jsonb;
BEGIN
  SELECT admin_uid, default_inst_id INTO v_admin_uid, v_inst_id FROM test_fixtures;
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  INSERT INTO public.batches (id, name, course_name, institute_id)
  VALUES (v_batch_id, 'Cascade Batch', 'JEE Test', v_inst_id);

  INSERT INTO public.students (id, admission_no, full_name, class_name, batch_id, institute_id)
  VALUES (v_std_id, 'PC-2026-9020', 'Batch Enrolled Student', 'Class 12', v_batch_id, v_inst_id);

  -- 1. Force cascade = false -> blocked
  v_res := public.admin_delete_batch(v_batch_id, false);
  IF (v_res->>'blocked')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 5.1 FAILED: Batch deletion was not blocked when students are enrolled';
  END IF;

  -- 2. Force cascade = true -> student unassigned, batch deleted
  v_res := public.admin_delete_batch(v_batch_id, true);
  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 5.2 FAILED: Batch force delete failed: %', v_res;
  END IF;

  -- Check student is unassigned (seat freed)
  IF (SELECT batch_id FROM public.students WHERE id = v_std_id) IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 5.3 FAILED: Enrolled student was not unassigned from deleted batch';
  END IF;

  -- Check batch is deleted
  IF EXISTS (SELECT 1 FROM public.batches WHERE id = v_batch_id) THEN
    RAISE EXCEPTION 'TEST 5.4 FAILED: Batch row still exists';
  END IF;

  RAISE NOTICE 'TEST 5 PASSED: Batch deletion guards and student unassignment verified';
END $$;

-- ----------------------------------------------------------------------------
-- TEST 6: Payroll Deletion RPC
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_uid uuid;
  v_inst_id uuid;
  v_tch_id uuid := gen_random_uuid();
  v_pay_id uuid := gen_random_uuid();
  v_res jsonb;
BEGIN
  SELECT admin_uid, default_inst_id INTO v_admin_uid, v_inst_id FROM test_fixtures;
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  INSERT INTO public.teachers (id, full_name, subject, institute_id)
  VALUES (v_tch_id, 'Payroll Test Teacher', 'Maths', v_inst_id);

  INSERT INTO public.teacher_payrolls (id, teacher_id, institute_id, payroll_month, base_salary, net_amount, status)
  VALUES (v_pay_id, v_tch_id, v_inst_id, '2026-02', 50000, 50000, 'pending');

  v_res := public.admin_delete_payroll_record(v_pay_id);
  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 6.1 FAILED: admin_delete_payroll_record failed: %', v_res;
  END IF;

  IF EXISTS (SELECT 1 FROM public.teacher_payrolls WHERE id = v_pay_id) THEN
    RAISE EXCEPTION 'TEST 6.2 FAILED: Payroll record still exists after deletion';
  END IF;

  RAISE NOTICE 'TEST 6 PASSED: admin_delete_payroll_record verified';
END $$;

-- ----------------------------------------------------------------------------
-- TEST 7: Backup Export & Restore Cycle
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_owner_uid uuid;
  v_inst_id uuid;
  v_backup jsonb;
  v_res jsonb;
  v_batch_id uuid := gen_random_uuid();
BEGIN
  SELECT owner_uid, default_inst_id INTO v_owner_uid, v_inst_id FROM test_fixtures;
  PERFORM set_config('request.jwt.claim.sub', v_owner_uid::text, true);

  -- Seed a test batch
  INSERT INTO public.batches (id, name, course_name, institute_id)
  VALUES (v_batch_id, 'Backup Test Batch', 'Course 1', v_inst_id);

  -- 1. Export Backup
  v_backup := public.admin_export_institute_backup();
  IF (v_backup->>'version') IS DISTINCT FROM '1.0' OR (v_backup->'tables') IS NULL THEN
    RAISE EXCEPTION 'TEST 7.1 FAILED: Exported backup has invalid structure: %', v_backup;
  END IF;

  IF (v_backup->>'backup_id') IS NULL THEN
    RAISE EXCEPTION 'TEST 7.2 FAILED: Backup record id was not generated';
  END IF;

  -- Verify record stored in institute_backups
  IF NOT EXISTS (SELECT 1 FROM public.institute_backups WHERE id = (v_backup->>'backup_id')::uuid) THEN
    RAISE EXCEPTION 'TEST 7.3 FAILED: Backup not found in institute_backups table';
  END IF;

  -- 2. Restore Backup
  v_res := public.admin_restore_institute_backup(v_backup);
  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 7.4 FAILED: Backup restore failed: %', v_res;
  END IF;

  -- Verify pre_restore_snapshot created
  IF NOT EXISTS (SELECT 1 FROM public.institute_backups WHERE backup_type = 'pre_restore_snapshot') THEN
    RAISE EXCEPTION 'TEST 7.5 FAILED: Pre-restore safety snapshot was not created';
  END IF;

  -- Verify restored data exists
  IF NOT EXISTS (SELECT 1 FROM public.batches WHERE id = v_batch_id) THEN
    RAISE EXCEPTION 'TEST 7.6 FAILED: Batch was not restored from backup payload';
  END IF;

  RAISE NOTICE 'TEST 7 PASSED: Backup export and restore cycle verified';
END $$;

-- ----------------------------------------------------------------------------
-- TEST 8: Actionable Undo
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_uid uuid;
  v_inst_id uuid;
  v_std_id uuid := gen_random_uuid();
  v_audit_id uuid := gen_random_uuid();
  v_res jsonb;
BEGIN
  SELECT admin_uid, default_inst_id INTO v_admin_uid, v_inst_id FROM test_fixtures;
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  -- Insert student as rusticated
  INSERT INTO public.students (id, admission_no, full_name, class_name, status, status_reason, institute_id)
  VALUES (v_std_id, 'PC-2026-9030', 'Undo Student', 'Class 10', 'rusticated', 'Disciplinary issue', v_inst_id);

  -- Simulate an audit log entry for status change
  INSERT INTO public.audit_logs (
    id, actor_id, action, table_name, record_id, institute_id,
    previous_state, new_state, created_at
  ) VALUES (
    v_audit_id,
    v_admin_uid,
    'CHANGE_STUDENT_STATUS',
    'students',
    v_std_id,
    v_inst_id,
    jsonb_build_object('id', v_std_id, 'status', 'active', 'status_reason', 'Active good standing'),
    jsonb_build_object('id', v_std_id, 'status', 'rusticated', 'status_reason', 'Disciplinary issue'),
    now()
  );

  -- Call undo
  v_res := public.admin_undo_audit_action(v_audit_id);
  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 8.1 FAILED: admin_undo_audit_action failed: %', v_res;
  END IF;

  -- Verify student status restored to active
  IF (SELECT status FROM public.students WHERE id = v_std_id) IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'TEST 8.2 FAILED: Student status was not reverted to active';
  END IF;

  -- Verify audit log marked as reverted
  IF (SELECT is_reverted FROM public.audit_logs WHERE id = v_audit_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 8.3 FAILED: Audit log entry is_reverted flag not set to true';
  END IF;

  -- Verify re-undo is blocked
  v_res := public.admin_undo_audit_action(v_audit_id);
  IF (v_res->>'success')::boolean IS TRUE THEN
    RAISE EXCEPTION 'TEST 8.4 FAILED: Secondary undo on already reverted action should have failed';
  END IF;

  RAISE NOTICE 'TEST 8 PASSED: Actionable undo verified';
END $$;

-- ----------------------------------------------------------------------------
-- TEST 9: Pristine Demo Data Purge Safety
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_owner_uid uuid;
  v_admin_uid uuid;
  v_inst_id uuid;
  v_res jsonb;
BEGIN
  SELECT owner_uid, admin_uid, default_inst_id INTO v_owner_uid, v_admin_uid, v_inst_id FROM test_fixtures;
  PERFORM set_config('request.jwt.claim.sub', v_owner_uid::text, true);

  -- Call demo purge
  v_res := public.admin_purge_demo_data();
  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 9.1 FAILED: admin_purge_demo_data failed: %', v_res;
  END IF;

  -- Verify pre_purge_snapshot created
  IF NOT EXISTS (SELECT 1 FROM public.institute_backups WHERE backup_type = 'pre_purge_snapshot') THEN
    RAISE EXCEPTION 'TEST 9.2 FAILED: Pre-purge safety snapshot was not captured';
  END IF;

  -- Verify operational tables are empty for institute
  IF EXISTS (SELECT 1 FROM public.students WHERE institute_id = v_inst_id) THEN
    RAISE EXCEPTION 'TEST 9.3 FAILED: Students still exist after demo purge';
  END IF;

  IF EXISTS (SELECT 1 FROM public.teachers WHERE institute_id = v_inst_id) THEN
    RAISE EXCEPTION 'TEST 9.4 FAILED: Teachers still exist after demo purge';
  END IF;

  IF EXISTS (SELECT 1 FROM public.batches WHERE institute_id = v_inst_id) THEN
    RAISE EXCEPTION 'TEST 9.5 FAILED: Batches still exist after demo purge';
  END IF;

  -- Verify OWNER and ADMIN user accounts are strictly preserved!
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_owner_uid) THEN
    RAISE EXCEPTION 'TEST 9.6 FAILED: Owner profile was deleted in demo purge!';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_uid) THEN
    RAISE EXCEPTION 'TEST 9.7 FAILED: Admin profile was deleted in demo purge!';
  END IF;

  RAISE NOTICE 'TEST 9 PASSED: Demo data purge and management preservation verified';
END $$;

-- ----------------------------------------------------------------------------
-- CONCLUSION: Roll back all fixture modifications
-- ----------------------------------------------------------------------------
ROLLBACK;
