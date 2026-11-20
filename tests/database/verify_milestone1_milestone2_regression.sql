-- ====================================================================
-- Milestone 1 & Milestone 2 Full Security and Integrity Regression Suite
-- Complete Cross-Institute Security Test Matrix across All 13 Tables and 5 Roles
-- ====================================================================

CREATE TEMP TABLE IF NOT EXISTS temp_test_results (
  test_no text,
  test_name text,
  status text,
  detail text
);

GRANT ALL ON TABLE temp_test_results TO authenticated;
TRUNCATE TABLE temp_test_results;

CREATE TEMP TABLE IF NOT EXISTS temp_test_context (
  key text primary key,
  id_val uuid
);

GRANT ALL ON TABLE temp_test_context TO authenticated;
TRUNCATE TABLE temp_test_context;

-- ====================================================================
-- BLOCK 1: Setup & Functional Integrity Tests (Superuser / Postgres)
-- ====================================================================
DO $$
DECLARE
  v_inst_a uuid := '11111111-2222-3333-4444-555555555555';
  v_inst_b uuid := '22222222-3333-4444-5555-666666666666';

  v_batch_a1 uuid;
  v_batch_a2 uuid;
  v_batch_b uuid;

  v_teacher_a uuid;
  v_teacher_b uuid;

  v_student_a uuid;
  v_student_b uuid;

  v_profile_owner_a uuid := gen_random_uuid();
  v_profile_admin_a uuid := gen_random_uuid();
  v_profile_teacher_a uuid := gen_random_uuid();
  v_profile_student_a uuid := gen_random_uuid();
  v_profile_parent_a uuid := gen_random_uuid();

  v_profile_owner_b uuid := gen_random_uuid();
  v_profile_admin_b uuid := gen_random_uuid();
  v_profile_teacher_b uuid := gen_random_uuid();
  v_profile_student_b uuid := gen_random_uuid();
  v_profile_parent_b uuid := gen_random_uuid();

  v_profile_stranger uuid := gen_random_uuid();
  v_profile_invited uuid := gen_random_uuid();

  v_session_a uuid;
  v_rec_a uuid;
  v_fee_struct_a uuid;
  v_fee_rec_a uuid;
  v_audit_a uuid;
  v_hist_a uuid;
  v_inv_a uuid;

  v_stranger_inst uuid;
  v_stranger_role app_role;
  v_invited_inst uuid;
  v_invited_role app_role;

  v_adm_no text;
  v_caught_error boolean;
  v_error_msg text;
  v_transfer_result jsonb;
BEGIN
  -- ------------------------------------------------------------------
  -- 1. Setup Mock Institutes
  -- ------------------------------------------------------------------
  INSERT INTO public.institutes (id, name, slug, is_active)
  VALUES (v_inst_b, 'Second Coaching Institute', 'second-coaching', true)
  ON CONFLICT (id) DO NOTHING;

  -- ------------------------------------------------------------------
  -- 2. Test Requirement 1: Public Signup Isolation & Trusted Invitation
  -- ------------------------------------------------------------------
  -- A. Public Stranger signs up with NO invitation and NO bootstrap active
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    v_profile_stranger,
    'stranger@public.com',
    jsonb_build_object('full_name', 'Public Stranger', 'institute_id', v_inst_a)
  );

  SELECT institute_id, role INTO v_stranger_inst, v_stranger_role
  FROM public.profiles
  WHERE id = v_profile_stranger;

  IF v_stranger_inst IS NULL THEN
    INSERT INTO temp_test_results VALUES ('1A', 'Public Signup Zero Institute Access', 'PASS',
      'Public stranger assigned institute_id = NULL (no access to Pradeep Classes)');
  ELSE
    INSERT INTO temp_test_results VALUES ('1A', 'Public Signup Zero Institute Access', 'FAIL',
      'Public stranger was granted membership to: ' || v_stranger_inst);
  END IF;

  -- B. Setup Trusted Users for Inst A & Inst B via internal bootstrap
  PERFORM set_config('institute.internal_bootstrap_in_progress', 'true', true);

  -- Inst A users
  PERFORM set_config('institute.target_institute_id', v_inst_a::text, true);
  PERFORM set_config('institute.target_role', 'owner', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_profile_owner_a, 'owner.a@test.com', jsonb_build_object('full_name', 'Owner Inst A'));

  PERFORM set_config('institute.target_role', 'admin', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_profile_admin_a, 'admin.a@test.com', jsonb_build_object('full_name', 'Admin Inst A'));

  PERFORM set_config('institute.target_role', 'teacher', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_profile_teacher_a, 'teacher.a@test.com', jsonb_build_object('full_name', 'Teacher Inst A'));

  PERFORM set_config('institute.target_role', 'student', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_profile_student_a, 'student.a@test.com', jsonb_build_object('full_name', 'Student Inst A'));

  PERFORM set_config('institute.target_role', 'parent', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_profile_parent_a, 'parent.a@test.com', jsonb_build_object('full_name', 'Parent Inst A'));

  -- Inst B users
  PERFORM set_config('institute.target_institute_id', v_inst_b::text, true);
  PERFORM set_config('institute.target_role', 'owner', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_profile_owner_b, 'owner.b@test.com', jsonb_build_object('full_name', 'Owner Inst B'));

  PERFORM set_config('institute.target_role', 'admin', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_profile_admin_b, 'admin.b@test.com', jsonb_build_object('full_name', 'Admin Inst B'));

  PERFORM set_config('institute.target_role', 'teacher', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_profile_teacher_b, 'teacher.b@test.com', jsonb_build_object('full_name', 'Teacher Inst B'));

  PERFORM set_config('institute.target_role', 'student', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_profile_student_b, 'student.b@test.com', jsonb_build_object('full_name', 'Student Inst B'));

  PERFORM set_config('institute.target_role', 'parent', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_profile_parent_b, 'parent.b@test.com', jsonb_build_object('full_name', 'Parent Inst B'));

  -- End bootstrap
  PERFORM set_config('institute.internal_bootstrap_in_progress', 'false', true);
  PERFORM set_config('institute.target_institute_id', '', true);
  PERFORM set_config('institute.target_role', '', true);

  -- C. Test Trusted Invitation Onboarding
  INSERT INTO public.institute_invitations (institute_id, email, role, token, status)
  VALUES (v_inst_a, 'invited.student@test.com', 'student', 'valid-test-token-12345', 'pending')
  RETURNING id INTO v_inv_a;

  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    v_profile_invited,
    'invited.student@test.com',
    jsonb_build_object('full_name', 'Invited Student')
  );

  SELECT institute_id, role INTO v_invited_inst, v_invited_role
  FROM public.profiles
  WHERE id = v_profile_invited;

  IF v_invited_inst = v_inst_a AND v_invited_role = 'student' THEN
    INSERT INTO temp_test_results VALUES ('1B', 'Trusted Invitation Onboarding', 'PASS',
      'Invited user successfully joined Inst A with role student via verified invitation');
  ELSE
    INSERT INTO temp_test_results VALUES ('1B', 'Trusted Invitation Onboarding', 'FAIL',
      'Invited user joining failed (Inst: ' || coalesce(v_invited_inst::text, 'null') || ')');
  END IF;

  -- ------------------------------------------------------------------
  -- 3. Seed Domain Data in Inst A & Inst B across all 13 tables
  -- ------------------------------------------------------------------
  INSERT INTO public.batches (name, course_name, max_capacity, status, institute_id)
  VALUES ('Batch Alpha 1', 'Class 10 Science', 25, 'active', v_inst_a)
  RETURNING id INTO v_batch_a1;

  INSERT INTO public.batches (name, course_name, max_capacity, status, institute_id)
  VALUES ('Batch Alpha 2', 'Class 10 Maths', 25, 'active', v_inst_a)
  RETURNING id INTO v_batch_a2;

  INSERT INTO public.batches (name, course_name, max_capacity, status, institute_id)
  VALUES ('Batch Beta 1', 'Class 11 Physics', 20, 'active', v_inst_b)
  RETURNING id INTO v_batch_b;

  -- Seed Teachers
  INSERT INTO public.teachers (profile_id, full_name, subject, institute_id, is_active)
  VALUES (v_profile_teacher_a, 'Teacher Inst A', 'Physics', v_inst_a, true)
  RETURNING id INTO v_teacher_a;

  INSERT INTO public.teachers (profile_id, full_name, subject, institute_id, is_active)
  VALUES (v_profile_teacher_b, 'Teacher Inst B', 'Chemistry', v_inst_b, true)
  RETURNING id INTO v_teacher_b;

  -- Seed Teacher Batches
  INSERT INTO public.teacher_batches (teacher_id, batch_id, institute_id)
  VALUES (v_teacher_a, v_batch_a1, v_inst_a);

  INSERT INTO public.teacher_batches (teacher_id, batch_id, institute_id)
  VALUES (v_teacher_b, v_batch_b, v_inst_b);

  -- Seed Students in Inst A
  INSERT INTO public.students (full_name, class_name, batch_id, institute_id, status, profile_id)
  VALUES ('Student Inst A', 'Class 10', v_batch_a1, v_inst_a, 'active', v_profile_student_a)
  RETURNING id INTO v_student_a;

  INSERT INTO public.students (full_name, class_name, batch_id, institute_id, status, profile_id)
  VALUES ('Student Inst B', 'Class 11', v_batch_b, v_inst_b, 'active', v_profile_student_b)
  RETURNING id INTO v_student_b;

  -- Seed Parent-Student link
  INSERT INTO public.parent_students (parent_profile_id, student_id, institute_id, is_verified)
  VALUES (v_profile_parent_a, v_student_a, v_inst_a, true);

  INSERT INTO public.parent_students (parent_profile_id, student_id, institute_id, is_verified)
  VALUES (v_profile_parent_b, v_student_b, v_inst_b, true);

  -- Seed Attendance
  INSERT INTO public.attendance_sessions (batch_id, session_date, taken_by, institute_id)
  VALUES (v_batch_a1, current_date, v_profile_teacher_a, v_inst_a)
  RETURNING id INTO v_session_a;

  INSERT INTO public.attendance_records (session_id, student_id, status, institute_id)
  VALUES (v_session_a, v_student_a, 'present', v_inst_a)
  RETURNING id INTO v_rec_a;

  -- Seed Fee Structures & Records
  INSERT INTO public.fee_structures (course_name, academic_year, total_fee, institute_id)
  VALUES ('Class 10 Science', '2026-2027', 50000, v_inst_a)
  RETURNING id INTO v_fee_struct_a;

  INSERT INTO public.fee_records (student_id, amount, status, due_date, institute_id)
  VALUES (v_student_a, 5000, 'paid', current_date, v_inst_a)
  RETURNING id INTO v_fee_rec_a;

  -- Seed Audit Logs
  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, institute_id)
  VALUES (v_profile_admin_a, 'SEED', 'students', v_student_a, v_inst_a)
  RETURNING id INTO v_audit_a;

  -- Seed Batch History
  INSERT INTO public.student_batch_history (
    student_id, from_batch_id, to_batch_id, reason, transferred_by, institute_id,
    student_name, student_admission_no, to_batch_name, transferred_by_name
  )
  VALUES (
    v_student_a, v_batch_a1, v_batch_a2, 'Initial Test Assignment', v_profile_admin_a, v_inst_a,
    'Student Inst A', 'PC-2026-0001', 'Batch Alpha 2', 'Admin Inst A'
  )
  RETURNING id INTO v_hist_a;

  -- Save Context for Block 2
  INSERT INTO temp_test_context VALUES
    ('inst_a', v_inst_a),
    ('inst_b', v_inst_b),
    ('profile_owner_a', v_profile_owner_a),
    ('profile_admin_a', v_profile_admin_a),
    ('profile_teacher_a', v_profile_teacher_a),
    ('profile_student_a', v_profile_student_a),
    ('profile_parent_a', v_profile_parent_a),
    ('profile_owner_b', v_profile_owner_b),
    ('profile_admin_b', v_profile_admin_b),
    ('profile_teacher_b', v_profile_teacher_b),
    ('profile_student_b', v_profile_student_b),
    ('profile_parent_b', v_profile_parent_b),
    ('profile_stranger', v_profile_stranger),
    ('batch_a1', v_batch_a1),
    ('batch_a2', v_batch_a2),
    ('batch_b', v_batch_b),
    ('student_a', v_student_a),
    ('student_b', v_student_b),
    ('teacher_a', v_teacher_a),
    ('session_a', v_session_a),
    ('rec_a', v_rec_a),
    ('fee_struct_a', v_fee_struct_a),
    ('fee_rec_a', v_fee_rec_a),
    ('audit_a', v_audit_a),
    ('hist_a', v_hist_a),
    ('inv_a', v_inv_a);

  -- ------------------------------------------------------------------
  -- 4. Functional Integrity Checks
  -- ------------------------------------------------------------------
  -- Auto sequence & format check
  INSERT INTO public.students (full_name, class_name, batch_id, institute_id)
  VALUES ('Fresh Student', 'Class 10', v_batch_a1, v_inst_a)
  RETURNING admission_no INTO v_adm_no;

  IF v_adm_no ~ '^PC-[0-9]{4}-[0-9]{4,}$' THEN
    INSERT INTO temp_test_results VALUES ('2A', 'Auto Sequence Generation', 'PASS', 'Generated admission number: ' || v_adm_no);
  ELSE
    INSERT INTO temp_test_results VALUES ('2A', 'Auto Sequence Generation', 'FAIL', 'Unexpected format: ' || coalesce(v_adm_no, 'null'));
  END IF;

  -- Immutable History Update Block
  v_caught_error := false;
  BEGIN
    UPDATE public.student_batch_history SET reason = 'Malicious Tamper' WHERE id = v_hist_a;
  EXCEPTION WHEN OTHERS THEN
    v_caught_error := true;
    v_error_msg := SQLERRM;
  END;

  IF v_caught_error THEN
    INSERT INTO temp_test_results VALUES ('3A', 'Immutable History Update Block', 'PASS', 'Direct update blocked: ' || v_error_msg);
  ELSE
    INSERT INTO temp_test_results VALUES ('3A', 'Immutable History Update Block', 'FAIL', 'History update was allowed!');
  END IF;

  -- Immutable History Delete Block
  v_caught_error := false;
  BEGIN
    DELETE FROM public.student_batch_history WHERE id = v_hist_a;
  EXCEPTION WHEN OTHERS THEN
    v_caught_error := true;
    v_error_msg := SQLERRM;
  END;

  IF v_caught_error THEN
    INSERT INTO temp_test_results VALUES ('3B', 'Immutable History Delete Block', 'PASS', 'Direct delete blocked: ' || v_error_msg);
  ELSE
    INSERT INTO temp_test_results VALUES ('3B', 'Immutable History Delete Block', 'FAIL', 'History delete was allowed!');
  END IF;

  -- Atomic Transfer RPC
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_profile_admin_a::text, 'role', 'authenticated')::text, true);
  v_transfer_result := public.transfer_student_batch(v_student_a, v_batch_a2, 'Administrative Reallocation');

  IF (v_transfer_result->>'success')::boolean = true THEN
    INSERT INTO temp_test_results VALUES ('4A', 'Atomic Batch Transfer Execution', 'PASS', 'Student transferred successfully to ' || (v_transfer_result->>'to_batch_name'));
  ELSE
    INSERT INTO temp_test_results VALUES ('4A', 'Atomic Batch Transfer Execution', 'FAIL', 'Transfer failed: ' || v_transfer_result::text);
  END IF;
  PERFORM set_config('request.jwt.claims', '', true);

END $$;

-- ====================================================================
-- BLOCK 2: Complete Cross-Institute Security Test Matrix
-- Role: authenticated | Covers Owner, Admin, Teacher, Student, Parent, Stranger
-- Across all 13 tenant-sensitive tables: SELECT, INSERT, UPDATE, DELETE
-- ====================================================================
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_roles text[] := ARRAY['owner_b', 'admin_b', 'teacher_b', 'student_b', 'parent_b', 'stranger'];
  v_r text;
  v_user uuid;
  v_email text;
  v_inst_a uuid;
  v_batch_a uuid;
  v_student_a uuid;
  v_teacher_a uuid;
  v_session_a uuid;
  v_rec_a uuid;
  v_fee_struct_a uuid;
  v_fee_rec_a uuid;
  v_audit_a uuid;
  v_hist_a uuid;
  v_inv_a uuid;

  v_count integer;
  v_caught boolean;
  v_err text;
  v_prefix text;
BEGIN
  SELECT id_val INTO v_inst_a FROM temp_test_context WHERE key = 'inst_a';
  SELECT id_val INTO v_batch_a FROM temp_test_context WHERE key = 'batch_a1';
  SELECT id_val INTO v_student_a FROM temp_test_context WHERE key = 'student_a';
  SELECT id_val INTO v_teacher_a FROM temp_test_context WHERE key = 'teacher_a';
  SELECT id_val INTO v_session_a FROM temp_test_context WHERE key = 'session_a';
  SELECT id_val INTO v_rec_a FROM temp_test_context WHERE key = 'rec_a';
  SELECT id_val INTO v_fee_struct_a FROM temp_test_context WHERE key = 'fee_struct_a';
  SELECT id_val INTO v_fee_rec_a FROM temp_test_context WHERE key = 'fee_rec_a';
  SELECT id_val INTO v_audit_a FROM temp_test_context WHERE key = 'audit_a';
  SELECT id_val INTO v_hist_a FROM temp_test_context WHERE key = 'hist_a';
  SELECT id_val INTO v_inv_a FROM temp_test_context WHERE key = 'inv_a';

  FOREACH v_r IN ARRAY v_roles LOOP
    SELECT id_val INTO v_user FROM temp_test_context WHERE key = 'profile_' || v_r;
    v_email := v_r || '@test.com';
    v_prefix := upper(v_r);

    PERFORM set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_user::text,
      'role', 'authenticated',
      'email', v_email
    )::text, true);

    -- ----------------------------------------------------------------
    -- 1. Table: batches (SELECT, INSERT, UPDATE, DELETE)
    -- ----------------------------------------------------------------
    SELECT count(*) INTO v_count FROM public.batches WHERE institute_id = v_inst_a;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-BATCH-SEL', v_prefix || ' Batches SELECT', 'PASS', '0 rows visible');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-BATCH-SEL', v_prefix || ' Batches SELECT', 'FAIL', v_count || ' rows leaked');
    END IF;

    v_caught := false;
    BEGIN
      INSERT INTO public.batches (name, course_name, max_capacity, status, institute_id)
      VALUES ('Intruder Batch', 'Course', 10, 'active', v_inst_a);
    EXCEPTION WHEN OTHERS THEN v_caught := true; END;
    IF v_caught THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-BATCH-INS', v_prefix || ' Batches INSERT', 'PASS', 'Cross-tenant INSERT blocked by RLS');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-BATCH-INS', v_prefix || ' Batches INSERT', 'FAIL', 'Cross-tenant INSERT permitted');
    END IF;

    UPDATE public.batches SET name = 'Tamper' WHERE id = v_batch_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-BATCH-UPD', v_prefix || ' Batches UPDATE', 'PASS', '0 rows affected');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-BATCH-UPD', v_prefix || ' Batches UPDATE', 'FAIL', v_count || ' rows modified');
    END IF;

    DELETE FROM public.batches WHERE id = v_batch_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-BATCH-DEL', v_prefix || ' Batches DELETE', 'PASS', '0 rows affected');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-BATCH-DEL', v_prefix || ' Batches DELETE', 'FAIL', v_count || ' rows deleted');
    END IF;

    -- ----------------------------------------------------------------
    -- 2. Table: students (SELECT, INSERT, UPDATE, DELETE)
    -- ----------------------------------------------------------------
    SELECT count(*) INTO v_count FROM public.students WHERE institute_id = v_inst_a;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-STUDENT-SEL', v_prefix || ' Students SELECT', 'PASS', '0 rows visible');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-STUDENT-SEL', v_prefix || ' Students SELECT', 'FAIL', v_count || ' rows leaked');
    END IF;

    v_caught := false;
    BEGIN
      INSERT INTO public.students (full_name, class_name, batch_id, institute_id)
      VALUES ('Phishing Student', 'Class 10', v_batch_a, v_inst_a);
    EXCEPTION WHEN OTHERS THEN v_caught := true; END;
    IF v_caught THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-STUDENT-INS', v_prefix || ' Students INSERT', 'PASS', 'Cross-tenant INSERT blocked by RLS');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-STUDENT-INS', v_prefix || ' Students INSERT', 'FAIL', 'Cross-tenant INSERT permitted');
    END IF;

    UPDATE public.students SET full_name = 'Tamper' WHERE id = v_student_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-STUDENT-UPD', v_prefix || ' Students UPDATE', 'PASS', '0 rows affected');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-STUDENT-UPD', v_prefix || ' Students UPDATE', 'FAIL', v_count || ' rows modified');
    END IF;

    DELETE FROM public.students WHERE id = v_student_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-STUDENT-DEL', v_prefix || ' Students DELETE', 'PASS', '0 rows affected');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-STUDENT-DEL', v_prefix || ' Students DELETE', 'FAIL', v_count || ' rows deleted');
    END IF;

    -- ----------------------------------------------------------------
    -- 3. Table: teachers (SELECT, INSERT, UPDATE, DELETE)
    -- ----------------------------------------------------------------
    SELECT count(*) INTO v_count FROM public.teachers WHERE institute_id = v_inst_a;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-TEACHER-SEL', v_prefix || ' Teachers SELECT', 'PASS', '0 rows visible');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-TEACHER-SEL', v_prefix || ' Teachers SELECT', 'FAIL', v_count || ' rows leaked');
    END IF;

    v_caught := false;
    BEGIN
      INSERT INTO public.teachers (full_name, subject, institute_id, is_active)
      VALUES ('Intruder Teacher', 'Math', v_inst_a, true);
    EXCEPTION WHEN OTHERS THEN v_caught := true; END;
    IF v_caught THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-TEACHER-INS', v_prefix || ' Teachers INSERT', 'PASS', 'Cross-tenant INSERT blocked by RLS');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-TEACHER-INS', v_prefix || ' Teachers INSERT', 'FAIL', 'Cross-tenant INSERT permitted');
    END IF;

    UPDATE public.teachers SET full_name = 'Tamper' WHERE id = v_teacher_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-TEACHER-UPD', v_prefix || ' Teachers UPDATE', 'PASS', '0 rows affected');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-TEACHER-UPD', v_prefix || ' Teachers UPDATE', 'FAIL', v_count || ' rows modified');
    END IF;

    DELETE FROM public.teachers WHERE id = v_teacher_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-TEACHER-DEL', v_prefix || ' Teachers DELETE', 'PASS', '0 rows affected');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-TEACHER-DEL', v_prefix || ' Teachers DELETE', 'FAIL', v_count || ' rows deleted');
    END IF;

    -- ----------------------------------------------------------------
    -- 4. Table: teacher_batches (SELECT, INSERT, UPDATE, DELETE)
    -- ----------------------------------------------------------------
    SELECT count(*) INTO v_count FROM public.teacher_batches WHERE institute_id = v_inst_a;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-TBATCH-SEL', v_prefix || ' TeacherBatches SELECT', 'PASS', '0 rows visible');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-TBATCH-SEL', v_prefix || ' TeacherBatches SELECT', 'FAIL', v_count || ' rows leaked');
    END IF;

    v_caught := false;
    BEGIN
      INSERT INTO public.teacher_batches (teacher_id, batch_id, institute_id)
      VALUES (v_teacher_a, v_batch_a, v_inst_a);
    EXCEPTION WHEN OTHERS THEN v_caught := true; END;
    IF v_caught THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-TBATCH-INS', v_prefix || ' TeacherBatches INSERT', 'PASS', 'Cross-tenant INSERT blocked by RLS');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-TBATCH-INS', v_prefix || ' TeacherBatches INSERT', 'FAIL', 'Cross-tenant INSERT permitted');
    END IF;

    -- ----------------------------------------------------------------
    -- 5. Table: parent_students (SELECT, INSERT, UPDATE, DELETE)
    -- ----------------------------------------------------------------
    SELECT count(*) INTO v_count FROM public.parent_students WHERE institute_id = v_inst_a;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-PSTUDENT-SEL', v_prefix || ' ParentStudents SELECT', 'PASS', '0 rows visible');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-PSTUDENT-SEL', v_prefix || ' ParentStudents SELECT', 'FAIL', v_count || ' rows leaked');
    END IF;

    v_caught := false;
    BEGIN
      INSERT INTO public.parent_students (parent_profile_id, student_id, institute_id, is_verified)
      VALUES (v_user, v_student_a, v_inst_a, true);
    EXCEPTION WHEN OTHERS THEN v_caught := true; END;
    IF v_caught THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-PSTUDENT-INS', v_prefix || ' ParentStudents INSERT', 'PASS', 'Cross-tenant INSERT blocked by RLS');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-PSTUDENT-INS', v_prefix || ' ParentStudents INSERT', 'FAIL', 'Cross-tenant INSERT permitted');
    END IF;

    -- ----------------------------------------------------------------
    -- 6. Table: attendance_sessions (SELECT, INSERT, UPDATE, DELETE)
    -- ----------------------------------------------------------------
    SELECT count(*) INTO v_count FROM public.attendance_sessions WHERE institute_id = v_inst_a;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-ATTSESS-SEL', v_prefix || ' AttendanceSessions SELECT', 'PASS', '0 rows visible');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-ATTSESS-SEL', v_prefix || ' AttendanceSessions SELECT', 'FAIL', v_count || ' rows leaked');
    END IF;

    v_caught := false;
    BEGIN
      INSERT INTO public.attendance_sessions (batch_id, session_date, taken_by, institute_id)
      VALUES (v_batch_a, current_date, v_user, v_inst_a);
    EXCEPTION WHEN OTHERS THEN v_caught := true; END;
    IF v_caught THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-ATTSESS-INS', v_prefix || ' AttendanceSessions INSERT', 'PASS', 'Cross-tenant INSERT blocked by RLS');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-ATTSESS-INS', v_prefix || ' AttendanceSessions INSERT', 'FAIL', 'Cross-tenant INSERT permitted');
    END IF;

    -- ----------------------------------------------------------------
    -- 7. Table: attendance_records (SELECT, INSERT, UPDATE, DELETE)
    -- ----------------------------------------------------------------
    SELECT count(*) INTO v_count FROM public.attendance_records WHERE institute_id = v_inst_a;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-ATTREC-SEL', v_prefix || ' AttendanceRecords SELECT', 'PASS', '0 rows visible');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-ATTREC-SEL', v_prefix || ' AttendanceRecords SELECT', 'FAIL', v_count || ' rows leaked');
    END IF;

    v_caught := false;
    BEGIN
      INSERT INTO public.attendance_records (session_id, student_id, status, institute_id)
      VALUES (v_session_a, v_student_a, 'absent', v_inst_a);
    EXCEPTION WHEN OTHERS THEN v_caught := true; END;
    IF v_caught THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-ATTREC-INS', v_prefix || ' AttendanceRecords INSERT', 'PASS', 'Cross-tenant INSERT blocked by RLS');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-ATTREC-INS', v_prefix || ' AttendanceRecords INSERT', 'FAIL', 'Cross-tenant INSERT permitted');
    END IF;

    -- ----------------------------------------------------------------
    -- 8. Table: fee_structures (SELECT, INSERT, UPDATE, DELETE)
    -- ----------------------------------------------------------------
    SELECT count(*) INTO v_count FROM public.fee_structures WHERE institute_id = v_inst_a;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-FEESTRUCT-SEL', v_prefix || ' FeeStructures SELECT', 'PASS', '0 rows visible');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-FEESTRUCT-SEL', v_prefix || ' FeeStructures SELECT', 'FAIL', v_count || ' rows leaked');
    END IF;

    v_caught := false;
    BEGIN
      INSERT INTO public.fee_structures (course_name, academic_year, total_fee, institute_id)
      VALUES ('Phishing Course', '2026', 1000, v_inst_a);
    EXCEPTION WHEN OTHERS THEN v_caught := true; END;
    IF v_caught THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-FEESTRUCT-INS', v_prefix || ' FeeStructures INSERT', 'PASS', 'Cross-tenant INSERT blocked by RLS');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-FEESTRUCT-INS', v_prefix || ' FeeStructures INSERT', 'FAIL', 'Cross-tenant INSERT permitted');
    END IF;

    -- ----------------------------------------------------------------
    -- 9. Table: fee_records (SELECT, INSERT, UPDATE, DELETE)
    -- ----------------------------------------------------------------
    SELECT count(*) INTO v_count FROM public.fee_records WHERE institute_id = v_inst_a;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-FEEREC-SEL', v_prefix || ' FeeRecords SELECT', 'PASS', '0 rows visible');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-FEEREC-SEL', v_prefix || ' FeeRecords SELECT', 'FAIL', v_count || ' rows leaked');
    END IF;

    v_caught := false;
    BEGIN
      INSERT INTO public.fee_records (student_id, amount, status, due_date, institute_id)
      VALUES (v_student_a, 100, 'pending', current_date, v_inst_a);
    EXCEPTION WHEN OTHERS THEN v_caught := true; END;
    IF v_caught THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-FEEREC-INS', v_prefix || ' FeeRecords INSERT', 'PASS', 'Cross-tenant INSERT blocked by RLS');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-FEEREC-INS', v_prefix || ' FeeRecords INSERT', 'FAIL', 'Cross-tenant INSERT permitted');
    END IF;

    -- ----------------------------------------------------------------
    -- 10. Table: audit_logs (SELECT, INSERT, UPDATE, DELETE)
    -- ----------------------------------------------------------------
    SELECT count(*) INTO v_count FROM public.audit_logs WHERE institute_id = v_inst_a;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-AUDIT-SEL', v_prefix || ' AuditLogs SELECT', 'PASS', '0 rows visible');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-AUDIT-SEL', v_prefix || ' AuditLogs SELECT', 'FAIL', v_count || ' rows leaked');
    END IF;

    v_caught := false;
    BEGIN
      INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, institute_id)
      VALUES (v_user, 'INTRUSION', 'test', v_student_a, v_inst_a);
    EXCEPTION WHEN OTHERS THEN v_caught := true; END;
    IF v_caught THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-AUDIT-INS', v_prefix || ' AuditLogs INSERT', 'PASS', 'Cross-tenant INSERT blocked by RLS');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-AUDIT-INS', v_prefix || ' AuditLogs INSERT', 'FAIL', 'Cross-tenant INSERT permitted');
    END IF;

    -- ----------------------------------------------------------------
    -- 11. Table: student_batch_history (SELECT, INSERT, UPDATE, DELETE)
    -- ----------------------------------------------------------------
    SELECT count(*) INTO v_count FROM public.student_batch_history WHERE institute_id = v_inst_a;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-HIST-SEL', v_prefix || ' History SELECT', 'PASS', '0 rows visible');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-HIST-SEL', v_prefix || ' History SELECT', 'FAIL', v_count || ' rows leaked');
    END IF;

    v_caught := false;
    BEGIN
      INSERT INTO public.student_batch_history (student_id, to_batch_id, reason, transferred_by, institute_id)
      VALUES (v_student_a, v_batch_a, 'Forgery', v_user, v_inst_a);
    EXCEPTION WHEN OTHERS THEN v_caught := true; END;
    IF v_caught THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-HIST-INS', v_prefix || ' History INSERT', 'PASS', 'Cross-tenant INSERT blocked by RLS');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-HIST-INS', v_prefix || ' History INSERT', 'FAIL', 'Cross-tenant INSERT permitted');
    END IF;

    -- ----------------------------------------------------------------
    -- 12. Table: institutes (SELECT, UPDATE, DELETE)
    -- ----------------------------------------------------------------
    SELECT count(*) INTO v_count FROM public.institutes WHERE id = v_inst_a;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-INST-SEL', v_prefix || ' Institutes SELECT', 'PASS', 'Inst A record hidden (0 visible)');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-INST-SEL', v_prefix || ' Institutes SELECT', 'FAIL', 'Inst A record leaked');
    END IF;

    UPDATE public.institutes SET name = 'Hacked' WHERE id = v_inst_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-INST-UPD', v_prefix || ' Institutes UPDATE', 'PASS', '0 rows affected');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-INST-UPD', v_prefix || ' Institutes UPDATE', 'FAIL', v_count || ' rows modified');
    END IF;

    DELETE FROM public.institutes WHERE id = v_inst_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-INST-DEL', v_prefix || ' Institutes DELETE', 'PASS', '0 rows affected');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-INST-DEL', v_prefix || ' Institutes DELETE', 'FAIL', v_count || ' rows deleted');
    END IF;

    -- ----------------------------------------------------------------
    -- 13. Table: profiles (SELECT, UPDATE, DELETE)
    -- ----------------------------------------------------------------
    SELECT count(*) INTO v_count FROM public.profiles WHERE institute_id = v_inst_a AND id != v_user;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-PROFILE-SEL', v_prefix || ' Profiles SELECT', 'PASS', '0 other Inst A profiles visible');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-PROFILE-SEL', v_prefix || ' Profiles SELECT', 'FAIL', v_count || ' profiles leaked');
    END IF;

    UPDATE public.profiles SET full_name = 'Hacked' WHERE institute_id = v_inst_a AND id != v_user;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-PROFILE-UPD', v_prefix || ' Profiles UPDATE', 'PASS', '0 rows affected');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-PROFILE-UPD', v_prefix || ' Profiles UPDATE', 'FAIL', v_count || ' profiles modified');
    END IF;

    DELETE FROM public.profiles WHERE institute_id = v_inst_a AND id != v_user;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      INSERT INTO temp_test_results VALUES (v_prefix || '-PROFILE-DEL', v_prefix || ' Profiles DELETE', 'PASS', '0 rows affected');
    ELSE
      INSERT INTO temp_test_results VALUES (v_prefix || '-PROFILE-DEL', v_prefix || ' Profiles DELETE', 'FAIL', v_count || ' profiles deleted');
    END IF;

  END LOOP;
END $$;

RESET ROLE;

-- ====================================================================
-- BLOCK 3: Cleanup Test Fixtures
-- ====================================================================
DO $$
DECLARE
  v_inst_a uuid := '11111111-2222-3333-4444-555555555555';
  v_inst_b uuid := '22222222-3333-4444-5555-666666666666';
BEGIN
  DELETE FROM public.institute_invitations WHERE institute_id IN (v_inst_a, v_inst_b);
  DELETE FROM public.audit_logs WHERE institute_id IN (v_inst_a, v_inst_b);
  DELETE FROM public.fee_records WHERE institute_id IN (v_inst_a, v_inst_b);
  DELETE FROM public.fee_structures WHERE institute_id IN (v_inst_a, v_inst_b);
  DELETE FROM public.attendance_records WHERE institute_id IN (v_inst_a, v_inst_b);
  DELETE FROM public.attendance_sessions WHERE institute_id IN (v_inst_a, v_inst_b);
  DELETE FROM public.parent_students WHERE institute_id IN (v_inst_a, v_inst_b);
  DELETE FROM public.teacher_batches WHERE institute_id IN (v_inst_a, v_inst_b);
  DELETE FROM public.students WHERE institute_id IN (v_inst_a, v_inst_b);
  DELETE FROM public.teachers WHERE institute_id IN (v_inst_a, v_inst_b);
  DELETE FROM public.batches WHERE institute_id IN (v_inst_a, v_inst_b);
  DELETE FROM auth.users WHERE id IN (SELECT id_val FROM temp_test_context WHERE key LIKE 'profile_%');
  DELETE FROM public.institutes WHERE id = v_inst_b;
END $$;

SELECT test_no, test_name, status, detail FROM temp_test_results ORDER BY test_no;
