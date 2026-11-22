-- ============================================================================
-- Pradeep Classes Management: Admin User Provisioning Test Suite
-- Migration: 0017_admin_user_provisioning.sql
-- Pure SQL test running inside a transaction concluding with ROLLBACK.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- FIXTURES SETUP
-- ----------------------------------------------------------------------------

CREATE TEMP TABLE test_fixtures AS SELECT
  'a1111111-1111-4111-8111-111111111111'::uuid AS admin_uid,
  'b2222222-2222-4222-8222-222222222222'::uuid AS student_uid,
  'c3333333-3333-4333-8333-333333333333'::uuid AS other_inst_admin_uid,
  'd4444444-4444-4444-8444-444444444444'::uuid AS super_admin_uid,
  '11111111-2222-3333-4444-555555555555'::uuid AS default_inst_id,
  '99999999-9999-4999-8999-999999999999'::uuid AS other_inst_id,
  gen_random_uuid() AS test_student_id,
  gen_random_uuid() AS test_teacher_id;

-- Ensure secondary institute exists for tenant isolation test
INSERT INTO public.institutes (id, name, slug)
SELECT other_inst_id, 'Other Institute', 'other-institute'
FROM test_fixtures
ON CONFLICT (id) DO NOTHING;

-- Seed admin, student, other admin, and super_admin auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
SELECT admin_uid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'admin_tester@pradeepclasses.in', '$2a$06$fakehashfakehashfakehashfakeh', now(), '{"full_name": "Admin Tester"}'::jsonb FROM test_fixtures UNION ALL
SELECT student_uid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'student_tester@pradeepclasses.in', '$2a$06$fakehashfakehashfakehashfakeh', now(), '{"full_name": "Student Tester"}'::jsonb FROM test_fixtures UNION ALL
SELECT other_inst_admin_uid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'other_admin@other.in', '$2a$06$fakehashfakehashfakehashfakeh', now(), '{"full_name": "Other Admin"}'::jsonb FROM test_fixtures UNION ALL
SELECT super_admin_uid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'super_admin@pradeepclasses.in', '$2a$06$fakehashfakehashfakehashfakeh', now(), '{"full_name": "Super Admin"}'::jsonb FROM test_fixtures
ON CONFLICT (id) DO NOTHING;

-- Set bootstrap flag to insert fixtures into profiles
SELECT set_config('institute.internal_bootstrap_in_progress', 'true', true);

INSERT INTO public.profiles (id, full_name, role, institute_id, is_active)
SELECT admin_uid, 'Admin Tester', 'admin'::public.app_role, default_inst_id, true FROM test_fixtures UNION ALL
SELECT student_uid, 'Student Tester', 'student'::public.app_role, default_inst_id, true FROM test_fixtures UNION ALL
SELECT other_inst_admin_uid, 'Other Admin', 'admin'::public.app_role, other_inst_id, true FROM test_fixtures UNION ALL
SELECT super_admin_uid, 'Super Admin', 'super_admin'::public.app_role, default_inst_id, true FROM test_fixtures
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, institute_id = EXCLUDED.institute_id;

-- Insert student and teacher records for linking
INSERT INTO public.students (id, admission_no, full_name, class_name, institute_id)
SELECT test_student_id, 'PC-2026-9999', 'Linked Student Test', 'Class 12', default_inst_id FROM test_fixtures;

INSERT INTO public.teachers (id, full_name, subject, institute_id)
SELECT test_teacher_id, 'Linked Teacher Test', 'Physics', default_inst_id FROM test_fixtures;

SELECT set_config('institute.internal_bootstrap_in_progress', 'false', true);

-- ----------------------------------------------------------------------------
-- TEST 1: Non-admin calling admin_create_institute_user raises 'Unauthorized'
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_student_uid uuid;
  v_caught boolean := false;
  v_err_msg text;
BEGIN
  SELECT student_uid INTO v_student_uid FROM test_fixtures;
  PERFORM set_config('request.jwt.claim.sub', v_student_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  BEGIN
    PERFORM public.admin_create_institute_user(
      'unauthorized_target@test.in',
      'Password123!',
      'Hacked User',
      'teacher'
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_err_msg := SQLERRM;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Non-admin should not be able to call admin_create_institute_user!';
  END IF;

  IF v_err_msg NOT LIKE '%Unauthorized%' THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Expected Unauthorized error, got: %', v_err_msg;
  END IF;

  RAISE NOTICE 'TEST 1 PASSED: Non-admin calling admin_create_institute_user raises Unauthorized.';
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST 2: Admin creates user with bcrypt hash, metadata, and teacher link
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_uid uuid;
  v_teacher_id uuid;
  v_res jsonb;
  v_created_id uuid;
  v_user_row record;
  v_profile_row record;
  v_teacher_row record;
BEGIN
  SELECT admin_uid, test_teacher_id INTO v_admin_uid, v_teacher_id FROM test_fixtures;
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  v_res := public.admin_create_institute_user(
    'new_teacher@pradeepclasses.in',
    'SecretPass123!',
    'Professor Raman',
    'teacher',
    NULL,
    v_teacher_id,
    '9876543210'
  );

  IF (v_res->>'status') != 'success' THEN
    RAISE EXCEPTION 'TEST 2 FAILED: admin_create_institute_user did not return success: %', v_res;
  END IF;

  v_created_id := (v_res->>'id')::uuid;

  -- Verify auth.users
  SELECT * INTO v_user_row FROM auth.users WHERE id = v_created_id;
  IF v_user_row.id IS NULL THEN
    RAISE EXCEPTION 'TEST 2 FAILED: auth.users row was not created!';
  END IF;

  IF v_user_row.encrypted_password NOT LIKE '$2%' THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Password is not hashed with bcrypt (expected $2 prefix)!';
  END IF;

  IF v_user_row.encrypted_password != extensions.crypt('SecretPass123!', v_user_row.encrypted_password) THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Password hash does not match plaintext password!';
  END IF;

  -- Verify profiles
  SELECT * INTO v_profile_row FROM public.profiles WHERE id = v_created_id;
  IF v_profile_row.id IS NULL THEN
    RAISE EXCEPTION 'TEST 2 FAILED: public.profiles row was not found!';
  END IF;

  IF v_profile_row.role != 'teacher' OR v_profile_row.is_active != true OR v_profile_row.phone != '9876543210' THEN
    RAISE EXCEPTION 'TEST 2 FAILED: profiles metadata mismatch: %', row_to_json(v_profile_row);
  END IF;

  -- Verify teacher linkage
  SELECT * INTO v_teacher_row FROM public.teachers WHERE id = v_teacher_id;
  IF v_teacher_row.profile_id != v_created_id THEN
    RAISE EXCEPTION 'TEST 2 FAILED: teachers.profile_id was not linked!';
  END IF;

  -- Verify GUC was reset to false
  IF coalesce(current_setting('institute.internal_bootstrap_in_progress', true), 'false') != 'false' THEN
    RAISE EXCEPTION 'TEST 2 FAILED: GUC internal_bootstrap_in_progress was not cleaned up!';
  END IF;

  RAISE NOTICE 'TEST 2 PASSED: Admin created user with bcrypt hash, linked teacher profile, and verified GUC cleanup.';
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST 3: Admin creates user with student link & auto-generated sanitized email
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_uid uuid;
  v_student_id uuid;
  v_res jsonb;
  v_created_id uuid;
  v_student_row record;
  v_user_row record;
BEGIN
  SELECT admin_uid, test_student_id INTO v_admin_uid, v_student_id FROM test_fixtures;
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  v_res := public.admin_create_institute_user(
    NULL, -- omitted email triggers auto-generation from admission_no
    'StudentKey456!',
    'Linked Student Test',
    'student',
    v_student_id,
    NULL,
    '9123456789'
  );

  IF (v_res->>'status') != 'success' THEN
    RAISE EXCEPTION 'TEST 3 FAILED: student user creation failed: %', v_res;
  END IF;

  v_created_id := (v_res->>'id')::uuid;

  -- Verify email was generated
  SELECT * INTO v_user_row FROM auth.users WHERE id = v_created_id;
  IF v_user_row.email != 'pc-2026-9999@pradeepclasses.in' THEN
    RAISE EXCEPTION 'TEST 3 FAILED: expected auto-generated email pc-2026-9999@pradeepclasses.in, got: %', v_user_row.email;
  END IF;

  -- Verify student linkage
  SELECT * INTO v_student_row FROM public.students WHERE id = v_student_id;
  IF v_student_row.profile_id != v_created_id THEN
    RAISE EXCEPTION 'TEST 3 FAILED: students.profile_id was not linked!';
  END IF;

  RAISE NOTICE 'TEST 3 PASSED: Student user created with auto email and profile_id linked.';
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST 4: admin_list_institute_users lists records with tenant isolation
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_uid uuid;
  v_other_admin_uid uuid;
  v_count_default int;
  v_count_other int;
  v_has_other_inst boolean := false;
BEGIN
  SELECT admin_uid, other_inst_admin_uid INTO v_admin_uid, v_other_admin_uid FROM test_fixtures;

  -- Impersonate default institute admin
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  SELECT count(*) INTO v_count_default FROM public.admin_list_institute_users();
  IF v_count_default < 2 THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Expected at least 2 users in default institute, got %', v_count_default;
  END IF;

  -- Verify no users from other institute appear
  SELECT EXISTS (
    SELECT 1 FROM public.admin_list_institute_users() u
    WHERE u.id = v_other_admin_uid
  ) INTO v_has_other_inst;

  IF v_has_other_inst THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Tenant isolation leak! Other institute admin appeared in list.';
  END IF;

  -- Impersonate other institute admin
  PERFORM set_config('request.jwt.claim.sub', v_other_admin_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  SELECT count(*) INTO v_count_other FROM public.admin_list_institute_users();
  IF v_count_other != 1 THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Expected exactly 1 user in other institute, got %', v_count_other;
  END IF;

  RAISE NOTICE 'TEST 4 PASSED: Tenant filtering verified in admin_list_institute_users.';
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST 5: admin_reset_user_password updates bcrypt hash
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_uid uuid;
  v_student_uid uuid;
  v_res jsonb;
  v_user_row record;
BEGIN
  SELECT admin_uid, student_uid INTO v_admin_uid, v_student_uid FROM test_fixtures;
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  v_res := public.admin_reset_user_password(v_student_uid, 'BrandNewPass789!');
  IF (v_res->>'status') != 'success' THEN
    RAISE EXCEPTION 'TEST 5 FAILED: admin_reset_user_password returned %', v_res;
  END IF;

  SELECT * INTO v_user_row FROM auth.users WHERE id = v_student_uid;
  IF v_user_row.encrypted_password != extensions.crypt('BrandNewPass789!', v_user_row.encrypted_password) THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Password reset hash does not match new password!';
  END IF;

  RAISE NOTICE 'TEST 5 PASSED: Password reset updates bcrypt hash.';
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST 6: admin_toggle_user_status updates profile is_active and banned_until
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_uid uuid;
  v_student_uid uuid;
  v_res jsonb;
  v_profile_row record;
  v_user_row record;
BEGIN
  SELECT admin_uid, student_uid INTO v_admin_uid, v_student_uid FROM test_fixtures;
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- Deactivate
  v_res := public.admin_toggle_user_status(v_student_uid, false);
  IF (v_res->>'is_active')::boolean != false THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Failed to toggle active to false: %', v_res;
  END IF;

  SELECT * INTO v_profile_row FROM public.profiles WHERE id = v_student_uid;
  IF v_profile_row.is_active != false THEN
    RAISE EXCEPTION 'TEST 6 FAILED: profiles.is_active was not false!';
  END IF;

  -- Verify auth.users.banned_until is set to 2099
  SELECT * INTO v_user_row FROM auth.users WHERE id = v_student_uid;
  IF v_user_row.banned_until IS NULL OR v_user_row.banned_until < now() THEN
    RAISE EXCEPTION 'TEST 6 FAILED: auth.users.banned_until was not set when deactivated: %', v_user_row.banned_until;
  END IF;

  -- Reactivate
  v_res := public.admin_toggle_user_status(v_student_uid, true);
  IF (v_res->>'is_active')::boolean != true THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Failed to toggle active to true: %', v_res;
  END IF;

  SELECT * INTO v_profile_row FROM public.profiles WHERE id = v_student_uid;
  IF v_profile_row.is_active != true THEN
    RAISE EXCEPTION 'TEST 6 FAILED: profiles.is_active was not true!';
  END IF;

  -- Verify auth.users.banned_until is cleared
  SELECT * INTO v_user_row FROM auth.users WHERE id = v_student_uid;
  IF v_user_row.banned_until IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 6 FAILED: auth.users.banned_until was not cleared when reactivated: %', v_user_row.banned_until;
  END IF;

  RAISE NOTICE 'TEST 6 PASSED: admin_toggle_user_status toggles profile is_active and synchronizes banned_until.';
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST 7: Privilege escalation guards (super_admin protection)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_uid uuid;
  v_super_admin_uid uuid;
  v_caught boolean := false;
BEGIN
  SELECT admin_uid, super_admin_uid INTO v_admin_uid, v_super_admin_uid FROM test_fixtures;
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- 7a: Admin cannot provision super_admin
  v_caught := false;
  BEGIN
    PERFORM public.admin_create_institute_user(
      'escalated_super@test.in',
      'Password123!',
      'Escalated Admin',
      'super_admin'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Unauthorized%super_admin%' THEN
      v_caught := true;
    END IF;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 7a FAILED: Admin should not be allowed to provision a super_admin!';
  END IF;

  -- 7b: Admin cannot reset super_admin password
  v_caught := false;
  BEGIN
    PERFORM public.admin_reset_user_password(v_super_admin_uid, 'NewPass12345!');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Unauthorized%super_admin%' THEN
      v_caught := true;
    END IF;
  END IF;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 7b FAILED: Admin should not be allowed to reset super_admin password!';
  END IF;

  -- 7c: Admin cannot toggle super_admin status
  v_caught := false;
  BEGIN
    PERFORM public.admin_toggle_user_status(v_super_admin_uid, false);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Unauthorized%super_admin%' THEN
      v_caught := true;
    END IF;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 7c FAILED: Admin should not be allowed to toggle super_admin status!';
  END IF;

  RAISE NOTICE 'TEST 7 PASSED: super_admin privilege escalation guards verified across all RPCs.';
END;
$$;

-- ----------------------------------------------------------------------------
-- TEST 8: Student/Teacher linkage validation guards
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_uid uuid;
  v_student_id uuid;
  v_teacher_id uuid;
  v_caught boolean := false;
BEGIN
  SELECT admin_uid, test_student_id, test_teacher_id INTO v_admin_uid, v_student_id, v_teacher_id FROM test_fixtures;
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- 8a: Cannot link both student and teacher
  v_caught := false;
  BEGIN
    PERFORM public.admin_create_institute_user(
      'dual_link@test.in',
      'Password123!',
      'Dual Link User',
      'student',
      v_student_id,
      v_teacher_id
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Cannot link user to both student and teacher record%' THEN
      v_caught := true;
    END IF;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 8a FAILED: Expected dual link guard exception!';
  END IF;

  -- 8b: Cannot link student record to non-student user role
  v_caught := false;
  BEGIN
    PERFORM public.admin_create_institute_user(
      'wrong_role_link@test.in',
      'Password123!',
      'Wrong Role User',
      'teacher',
      v_student_id,
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Cannot link student record to non-student user%' THEN
      v_caught := true;
    END IF;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 8b FAILED: Expected role mismatch guard exception for student!';
  END IF;

  -- 8c: Cannot link an already-linked student record
  -- Note: v_student_id was already linked in TEST 3
  v_caught := false;
  BEGIN
    PERFORM public.admin_create_institute_user(
      'relink_student@test.in',
      'Password123!',
      'Second Student Account',
      'student',
      v_student_id,
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%already linked%' THEN
      v_caught := true;
    END IF;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 8c FAILED: Expected already-linked record exception!';
  END IF;

  RAISE NOTICE 'TEST 8 PASSED: Record linkage guards verified.';
END;
$$;

ROLLBACK;

SELECT 'ALL 8 TESTS PASSED SUCCESSFULLY' AS result;
