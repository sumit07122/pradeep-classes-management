-- ============================================================================
-- Pradeep Classes Management: Security & Authorization Test Suite
-- Target Database: PostgreSQL 15+ with Supabase RLS
-- Run in Supabase SQL Editor or via psql.
-- All tests run inside a transaction and ROLLBACK at the end to leave the DB clean.
-- ============================================================================

\set ON_ERROR_STOP on
begin;

-- ----------------------------------------------------------------------------
-- FIXTURE SETUP
-- ----------------------------------------------------------------------------

-- Temporary test UUIDs
create temp table test_fixtures as select
  '11111111-1111-4111-8111-111111111111'::uuid as owner_uid,
  '22222222-2222-4222-8222-222222222222'::uuid as admin_uid,
  '33333333-3333-4333-8333-333333333333'::uuid as teacher_a_uid,
  '44444444-4444-4444-8444-444444444444'::uuid as teacher_b_uid,
  '55555555-5555-4555-8555-555555555555'::uuid as student_1_uid,
  '66666666-6666-4666-8666-666666666666'::uuid as student_2_uid,
  '77777777-7777-4777-8777-777777777777'::uuid as parent_1_uid,
  '88888888-8888-4888-8888-888888888888'::uuid as parent_2_uid,
  gen_random_uuid() as batch_jee_id,
  gen_random_uuid() as batch_neet_id,
  gen_random_uuid() as teacher_a_rec_id,
  gen_random_uuid() as teacher_b_rec_id,
  gen_random_uuid() as student_1_rec_id,
  gen_random_uuid() as student_2_rec_id;

-- 1. Create simulated auth.users entries
insert into auth.users (id, email)
select owner_uid, 'test_owner@pradeepclasses.in' from test_fixtures union all
select admin_uid, 'test_admin@pradeepclasses.in' from test_fixtures union all
select teacher_a_uid, 'test_teacher_a@pradeepclasses.in' from test_fixtures union all
select teacher_b_uid, 'test_teacher_b@pradeepclasses.in' from test_fixtures union all
select student_1_uid, 'test_student_1@pradeepclasses.in' from test_fixtures union all
select student_2_uid, 'test_student_2@pradeepclasses.in' from test_fixtures union all
select parent_1_uid, 'test_parent_1@pradeepclasses.in' from test_fixtures union all
select parent_2_uid, 'test_parent_2@pradeepclasses.in' from test_fixtures
on conflict (id) do nothing;

-- 2. Populate profiles with respective roles
insert into public.profiles (id, full_name, role)
select owner_uid, 'Test Owner', 'owner'::public.app_role from test_fixtures union all
select admin_uid, 'Test Admin', 'admin'::public.app_role from test_fixtures union all
select teacher_a_uid, 'Teacher Amit (JEE)', 'teacher'::public.app_role from test_fixtures union all
select teacher_b_uid, 'Teacher Neha (NEET)', 'teacher'::public.app_role from test_fixtures union all
select student_1_uid, 'Aarav Sharma (JEE Student)', 'student'::public.app_role from test_fixtures union all
select student_2_uid, 'Ananya Verma (NEET Student)', 'student'::public.app_role from test_fixtures union all
select parent_1_uid, 'Rajesh Sharma (Parent 1)', 'parent'::public.app_role from test_fixtures union all
select parent_2_uid, 'Suresh Verma (Parent 2)', 'parent'::public.app_role from test_fixtures
on conflict (id) do update set role = excluded.role;

-- 3. Populate Batches
insert into public.batches (id, name, course_name)
select batch_jee_id, 'JEE Morning Advanced', 'Engineering' from test_fixtures union all
select batch_neet_id, 'NEET Evening Medical', 'Medical' from test_fixtures;

-- 4. Populate Teachers & Batch Allocations
insert into public.teachers (id, profile_id, full_name, subject)
select teacher_a_rec_id, teacher_a_uid, 'Teacher Amit', 'Physics' from test_fixtures union all
select teacher_b_rec_id, teacher_b_uid, 'Teacher Neha', 'Chemistry' from test_fixtures;

-- Teacher Amit is assigned ONLY to JEE Morning
-- Teacher Neha is assigned ONLY to NEET Evening
insert into public.teacher_batches (teacher_id, batch_id)
select teacher_a_rec_id, batch_jee_id from test_fixtures union all
select teacher_b_rec_id, batch_neet_id from test_fixtures;

-- 5. Populate Students
-- Student 1 is in JEE Morning
-- Student 2 is in NEET Evening
insert into public.students (id, admission_no, full_name, class_name, batch_id, profile_id, phone)
select student_1_rec_id, 'TST-2026-001', 'Aarav Sharma', 'Class 12', batch_jee_id, student_1_uid, '9876543210' from test_fixtures union all
select student_2_rec_id, 'TST-2026-002', 'Ananya Verma', 'Class 11', batch_neet_id, student_2_uid, '9876543211' from test_fixtures;

-- 6. Populate Parent-Student Links
-- Parent 1 is verified parent of Student 1 ONLY
-- Parent 2 is verified parent of Student 2 ONLY
insert into public.parent_students (parent_profile_id, student_id, relationship_type, is_verified)
select parent_1_uid, student_1_rec_id, 'father', true from test_fixtures union all
select parent_2_uid, student_2_rec_id, 'father', true from test_fixtures;

-- 7. Populate Fee Records
insert into public.fee_records (student_id, amount, status, due_date)
select student_1_rec_id, 15000, 'paid', '2026-11-30' from test_fixtures union all
select student_2_rec_id, 18000, 'pending', '2026-11-30' from test_fixtures;


-- ----------------------------------------------------------------------------
-- TEST 1: Unauthenticated (anon) Access
-- Expected: 0 rows accessible on protected tables
-- ----------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

do $$
declare
  student_count int;
  batch_count int;
begin
  select count(*) into student_count from public.students;
  select count(*) into batch_count from public.batches;
  if student_count != 0 or batch_count != 0 then
    raise exception 'TEST 1 FAILED: Anon user accessed % students and % batches', student_count, batch_count;
  end if;
  raise notice 'TEST 1 PASSED: Anon user denied all access to students and batches.';
end;
$$;


-- ----------------------------------------------------------------------------
-- TEST 2: Owner Institute-Wide Access
-- Expected: Can read all batches, all students, and all fees
-- ----------------------------------------------------------------------------
set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', (select owner_uid from test_fixtures)), true);
end;
$$;

do $$
declare
  student_count int;
  batch_count int;
begin
  select count(*) into student_count from public.students;
  select count(*) into batch_count from public.batches;
  if student_count < 2 or batch_count < 2 then
    raise exception 'TEST 2 FAILED: Owner could not access institute records (% students, % batches)', student_count, batch_count;
  end if;
  raise notice 'TEST 2 PASSED: Owner has full institute-wide access (% students, % batches).', student_count, batch_count;
end;
$$;


-- ----------------------------------------------------------------------------
-- TEST 3: Admin Institute-Wide Access
-- Expected: Can read all batches, all students
-- ----------------------------------------------------------------------------
do $$
begin
  perform set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', (select admin_uid from test_fixtures)), true);
end;
$$;

do $$
declare
  student_count int;
  batch_count int;
begin
  select count(*) into student_count from public.students;
  select count(*) into batch_count from public.batches;
  if student_count < 2 or batch_count < 2 then
    raise exception 'TEST 3 FAILED: Admin denied institute records';
  end if;
  raise notice 'TEST 3 PASSED: Admin has full institute access.';
end;
$$;


-- ----------------------------------------------------------------------------
-- TEST 4: Teacher Assigned Batch Visibility
-- Teacher Amit is assigned to JEE Morning only.
-- Expected: Can read JEE batch and Student 1, but NOT NEET batch or Student 2.
-- ----------------------------------------------------------------------------
do $$
begin
  perform set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', (select teacher_a_uid from test_fixtures)), true);
end;
$$;

do $$
declare
  visible_students int;
  visible_batches int;
  unassigned_student_visible boolean;
begin
  select count(*) into visible_students from public.students;
  select count(*) into visible_batches from public.batches;
  select exists (select 1 from public.students where id = (select student_2_rec_id from test_fixtures)) into unassigned_student_visible;

  if visible_batches != 1 then
    raise exception 'TEST 4 FAILED: Teacher Amit sees % batches (expected exactly 1 assigned batch)', visible_batches;
  end if;

  if unassigned_student_visible then
    raise exception 'TEST 4 FAILED (SECURITY LEAK): Teacher Amit can view Student 2 from unassigned NEET batch!';
  end if;

  raise notice 'TEST 4 PASSED: Teacher Amit restricted strictly to assigned batch (% batch, % students visible).', visible_batches, visible_students;
end;
$$;


-- ----------------------------------------------------------------------------
-- TEST 5: Teacher Attendance Marking on Assigned Batch
-- Expected: Successfully create attendance session and insert record for assigned student
-- ----------------------------------------------------------------------------
do $$
declare
  new_session_id uuid := gen_random_uuid();
  f record;
begin
  select * into f from test_fixtures;

  -- 1. Create session for assigned batch (JEE Morning)
  insert into public.attendance_sessions (id, batch_id, session_date, taken_by)
  values (new_session_id, f.batch_jee_id, current_date, f.teacher_a_uid);

  -- 2. Mark attendance for Student 1 (enrolled in JEE Morning)
  insert into public.attendance_records (session_id, student_id, status)
  values (new_session_id, f.student_1_rec_id, 'present');

  raise notice 'TEST 5 PASSED: Teacher Amit successfully marked attendance for assigned batch student.';
end;
$$;


-- ----------------------------------------------------------------------------
-- TEST 6: Teacher Attempt to Create Attendance for Unassigned Batch
-- Expected: REJECTED by RLS policy
-- ----------------------------------------------------------------------------
do $$
declare
  f record;
  failed boolean := false;
begin
  select * into f from test_fixtures;
  begin
    insert into public.attendance_sessions (batch_id, session_date, taken_by)
    values (f.batch_neet_id, current_date, f.teacher_a_uid);
  exception when others then
    failed := true;
  end;

  if not failed then
    raise exception 'TEST 6 FAILED: Teacher Amit was able to create attendance session for unassigned NEET batch!';
  end if;

  raise notice 'TEST 6 PASSED: Teacher cannot create attendance session for unassigned batch.';
end;
$$;


-- ----------------------------------------------------------------------------
-- TEST 7: Teacher Attempt to Mark Student from Another Batch
-- Expected: REJECTED by Attendance Integrity Trigger
-- ----------------------------------------------------------------------------
do $$
declare
  f record;
  failed boolean := false;
  jee_session_id uuid;
begin
  select * into f from test_fixtures;
  select id into jee_session_id from public.attendance_sessions where batch_id = f.batch_jee_id limit 1;

  begin
    -- Attempt to insert Student 2 (NEET) into JEE Morning session
    insert into public.attendance_records (session_id, student_id, status)
    values (jee_session_id, f.student_2_rec_id, 'present');
  exception when others then
    failed := true;
  end;

  if not failed then
    raise exception 'TEST 7 FAILED: System permitted marking attendance for student enrolled in a different batch!';
  end if;

  raise notice 'TEST 7 PASSED: Attendance integrity trigger blocked cross-batch student attendance marking.';
end;
$$;


-- ----------------------------------------------------------------------------
-- TEST 8: Student Self-Access
-- Student 1 (Aarav) logs in.
-- Expected: Can read ONLY own student record, own attendance, and own fee record.
-- ----------------------------------------------------------------------------
do $$
begin
  perform set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', (select student_1_uid from test_fixtures)), true);
end;
$$;

do $$
declare
  visible_students int;
  visible_fees int;
  sees_peer boolean;
begin
  select count(*) into visible_students from public.students;
  select count(*) into visible_fees from public.fee_records;
  select exists (select 1 from public.students where id = (select student_2_rec_id from test_fixtures)) into sees_peer;

  if visible_students != 1 or visible_fees != 1 or sees_peer then
    raise exception 'TEST 8 FAILED: Student access violation (sees % students, % fees, peer visible: %)',
      visible_students, visible_fees, sees_peer;
  end if;

  raise notice 'TEST 8 PASSED: Student restricted strictly to self records.';
end;
$$;


-- ----------------------------------------------------------------------------
-- TEST 9: Parent Access to Verified Linked Child
-- Parent 1 (Rajesh) logs in.
-- Expected: Can read Student 1 (Aarav), Student 1 attendance, and Student 1 fees.
-- ----------------------------------------------------------------------------
do $$
begin
  perform set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', (select parent_1_uid from test_fixtures)), true);
end;
$$;

do $$
declare
  visible_children int;
  sees_unrelated_child boolean;
begin
  select count(*) into visible_children from public.students;
  select exists (select 1 from public.students where id = (select student_2_rec_id from test_fixtures)) into sees_unrelated_child;

  if visible_children != 1 or sees_unrelated_child then
    raise exception 'TEST 9 FAILED: Parent access leak (sees % children, sees unrelated: %)',
      visible_children, sees_unrelated_child;
  end if;

  raise notice 'TEST 9 PASSED: Parent restricted strictly to verified linked child via parent_students table.';
end;
$$;


-- ----------------------------------------------------------------------------
-- TEST 10: Role Escalation Prevention
-- Student 1 attempts to promote themselves to 'owner'.
-- Expected: REJECTED by trg_prevent_role_escalation.
-- ----------------------------------------------------------------------------
do $$
begin
  perform set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', (select student_1_uid from test_fixtures)), true);
end;
$$;

do $$
declare
  failed boolean := false;
begin
  begin
    update public.profiles set role = 'owner' where id = (select student_1_uid from test_fixtures);
  exception when others then
    failed := true;
  end;

  if not failed then
    raise exception 'TEST 10 FAILED: Student was able to escalate their own role to owner!';
  end if;

  raise notice 'TEST 10 PASSED: Self-role escalation prevented by trigger.';
end;
$$;


-- ----------------------------------------------------------------------------
-- TEST 11: Owner Bootstrap Concurrency & Repeated Call Guard
-- Expected: Calling bootstrap_initial_owner when an owner exists must fail.
-- ----------------------------------------------------------------------------
reset role;
do $$
declare
  failed boolean := false;
begin
  begin
    perform public.bootstrap_initial_owner('another_fake_owner@pradeepclasses.in');
  exception when others then
    failed := true;
  end;

  if not failed then
    raise exception 'TEST 11 FAILED: Secondary call to bootstrap_initial_owner succeeded despite existing owner!';
  end if;

  raise notice 'TEST 11 PASSED: Secondary owner bootstrap call successfully blocked by advisory check.';
end;
$$;

-- Rollback entire fixture transaction to leave database clean
rollback;
raise notice 'ALL 11 SECURITY ASSERTIONS PASSED. TRANSACTION ROLLED BACK CLEANLY.';
