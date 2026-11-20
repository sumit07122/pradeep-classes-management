-- ====================================================================
-- Test: verify_milestone3_attendance.sql
-- Description: Verification of Milestone 3 Attendance RPCs, RLS and integrity
-- ====================================================================

do $$
declare
  v_owner_id uuid := '28fe332f-4814-442d-a797-6833e2472ce3'::uuid;
  v_teacher_id uuid := gen_random_uuid();
  v_unassigned_teacher_id uuid := gen_random_uuid();
  v_inst_id uuid := '11111111-2222-3333-4444-555555555555'::uuid;
  v_batch_id uuid;
  v_student_1 uuid;
  v_student_2 uuid;
  v_student_3 uuid;
  v_res jsonb;
  v_summary jsonb;
  v_defaulters_count integer;
begin
  -- 1. Verify function registrations
  assert (select count(*) from pg_proc where proname = 'submit_batch_attendance') = 1,
    'FAIL: submit_batch_attendance not found';
  assert (select count(*) from pg_proc where proname = 'get_student_attendance_summary') = 1,
    'FAIL: get_student_attendance_summary not found';
  assert (select count(*) from pg_proc where proname = 'get_batch_attendance_defaulters') = 1,
    'FAIL: get_batch_attendance_defaulters not found';

  raise notice 'PASS: All 3 Attendance RPCs exist in PostgreSQL schema.';

  -- Setup trusted teacher users
  perform set_config('institute.internal_bootstrap_in_progress', 'true', true);
  perform set_config('institute.target_institute_id', v_inst_id::text, true);
  perform set_config('institute.target_role', 'teacher', true);

  insert into auth.users (id, email, raw_user_meta_data)
  values (v_teacher_id, 'att_t1@test.internal', jsonb_build_object('full_name', 'Assigned Teacher'));

  insert into public.teachers (profile_id, full_name, subject, phone, institute_id, is_active)
  values (v_teacher_id, 'Assigned Teacher', 'Physics', '9999900001', v_inst_id, true);

  insert into auth.users (id, email, raw_user_meta_data)
  values (v_unassigned_teacher_id, 'att_t2@test.internal', jsonb_build_object('full_name', 'Unassigned Teacher'));

  insert into public.teachers (profile_id, full_name, subject, phone, institute_id, is_active)
  values (v_unassigned_teacher_id, 'Unassigned Teacher', 'Chemistry', '9999900002', v_inst_id, true);

  perform set_config('institute.internal_bootstrap_in_progress', 'false', true);

  -- Set auth context to Owner
  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- Create test batch
  v_batch_id := gen_random_uuid();
  insert into public.batches (id, name, course_name, academic_year, max_capacity, institute_id, status)
  values (v_batch_id, 'M3 Test Batch Alpha', 'Science 10', '2026-2027', 30, v_inst_id, 'active');

  -- Assign teacher 1 to batch
  insert into public.teacher_batches (teacher_id, batch_id, institute_id)
  select t.id, v_batch_id, v_inst_id
  from public.teachers t where t.profile_id = v_teacher_id;

  -- Create test students
  v_student_1 := gen_random_uuid();
  insert into public.students (id, admission_no, full_name, class_name, batch_id, institute_id, status)
  values (v_student_1, 'PC-2026-9001', 'Student Alpha', 'Class 10', v_batch_id, v_inst_id, 'active');

  v_student_2 := gen_random_uuid();
  insert into public.students (id, admission_no, full_name, class_name, batch_id, institute_id, status)
  values (v_student_2, 'PC-2026-9002', 'Student Beta', 'Class 10', v_batch_id, v_inst_id, 'active');

  v_student_3 := gen_random_uuid();
  insert into public.students (id, admission_no, full_name, class_name, batch_id, institute_id, status)
  values (v_student_3, 'PC-2026-9003', 'Student Gamma', 'Class 10', v_batch_id, v_inst_id, 'active');

  -- 3. Test Owner submitting batch attendance
  v_res := public.submit_batch_attendance(
    v_batch_id,
    current_date,
    jsonb_build_array(
      jsonb_build_object('student_id', v_student_1, 'status', 'present', 'note', 'On time'),
      jsonb_build_object('student_id', v_student_2, 'status', 'absent', 'note', 'Medical emergency'),
      jsonb_build_object('student_id', v_student_3, 'status', 'late', 'note', '10 mins late')
    )
  );

  assert (v_res->>'success')::boolean = true, 'FAIL: submit_batch_attendance failed';
  assert (v_res->>'total_marked')::integer = 3, 'FAIL: expected 3 marked';
  assert (v_res->>'present_count')::integer = 1, 'FAIL: expected 1 present';
  assert (v_res->>'absent_count')::integer = 1, 'FAIL: expected 1 absent';
  assert (v_res->>'late_count')::integer = 1, 'FAIL: expected 1 late';
  raise notice 'PASS: Owner attendance submission executed and counts match: %', v_res;

  -- 4. Test Idempotent update on same session date
  v_res := public.submit_batch_attendance(
    v_batch_id,
    current_date,
    jsonb_build_array(
      jsonb_build_object('student_id', v_student_2, 'status', 'present', 'note', 'Corrected from absent')
    )
  );
  assert (v_res->>'present_count')::integer = 1, 'FAIL: update not reflected';
  raise notice 'PASS: Idempotent session update succeeded.';

  -- 5. Test Assigned Teacher can submit attendance
  perform set_config('request.jwt.claim.sub', v_teacher_id::text, true);
  v_res := public.submit_batch_attendance(
    v_batch_id,
    current_date - 1,
    jsonb_build_array(
      jsonb_build_object('student_id', v_student_1, 'status', 'present'),
      jsonb_build_object('student_id', v_student_2, 'status', 'absent'),
      jsonb_build_object('student_id', v_student_3, 'status', 'absent')
    )
  );
  assert (v_res->>'success')::boolean = true, 'FAIL: Assigned teacher could not submit attendance';
  raise notice 'PASS: Assigned teacher attendance submission succeeded.';

  -- 6. Test Unassigned Teacher is REJECTED
  perform set_config('request.jwt.claim.sub', v_unassigned_teacher_id::text, true);
  begin
    perform public.submit_batch_attendance(
      v_batch_id,
      current_date - 2,
      jsonb_build_array(
        jsonb_build_object('student_id', v_student_1, 'status', 'present')
      )
    );
    raise exception 'FAIL: Unassigned teacher was able to submit attendance!';
  exception when others then
    if sqlerrm like '%FAIL%' then raise; end if;
    raise notice 'PASS: Unassigned teacher correctly rejected with message: %', sqlerrm;
  end;

  -- 7. Test Student Attendance Analytics helper
  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);
  v_summary := public.get_student_attendance_summary(v_student_1);
  assert (v_summary->>'total_sessions')::integer = 2, 'FAIL: student 1 total sessions mismatch';
  assert (v_summary->>'attended_sessions')::integer = 2, 'FAIL: student 1 attended mismatch';
  assert (v_summary->>'percentage')::numeric = 100.0, 'FAIL: student 1 rate mismatch';
  raise notice 'PASS: Student attendance summary computed correctly: %', v_summary;

  -- 8. Test Defaulters helper
  -- Student 3 attended 1 out of 2 sessions (50% < 75%)
  select count(*) into v_defaulters_count
  from public.get_batch_attendance_defaulters(v_batch_id, 75.0);
  assert v_defaulters_count >= 1, 'FAIL: expected at least 1 defaulter';
  raise notice 'PASS: Defaulters function detected % students below 75 threshold.', v_defaulters_count;

  -- Rollback cleanly
  raise exception 'ROLLBACK_TEST_TRANSACTION_SUCCESS';
exception when others then
  if sqlerrm = 'ROLLBACK_TEST_TRANSACTION_SUCCESS' then
    raise notice 'SUCCESS: All Milestone 3 Attendance assertions passed cleanly and test transaction rolled back.';
  else
    raise;
  end if;
end;
$$;
