-- ============================================================================
-- Migration 0003: Corrective Security Review Fixes
-- Safe to apply sequentially after 0001_initial_schema.sql & 0002_enhanced_rls...
-- Pure SQL syntax: Fully compatible with Supabase SQL Editor and psql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DROP ALL BROAD PERMISSIVE POLICIES FROM MIGRATIONS 0001 & 0002
-- PostgreSQL combines permissive policies with OR. Every broad policy that
-- checked `is_staff()` or phone numbers must be eliminated to prevent data leaks.
-- ----------------------------------------------------------------------------

-- Batches
drop policy if exists "batches_staff_read" on public.batches;
drop policy if exists "batches_teacher_read" on public.batches;
drop policy if exists "batches_student_read" on public.batches;
drop policy if exists "batches_parent_read" on public.batches;

-- Students
drop policy if exists "students_staff_read" on public.students;
drop policy if exists "students_self_read" on public.students;
drop policy if exists "students_teacher_read" on public.students;
drop policy if exists "students_parent_read" on public.students;

-- Teachers & Assignments
drop policy if exists "teachers_staff_read" on public.teachers;
drop policy if exists "teachers_student_parent_read" on public.teachers;
drop policy if exists "teacher_batches_staff_read" on public.teacher_batches;
drop policy if exists "teacher_batches_teacher_read" on public.teacher_batches;

-- Attendance Sessions
drop policy if exists "attendance_staff_read" on public.attendance_sessions;
drop policy if exists "attendance_teacher_insert" on public.attendance_sessions;
drop policy if exists "attendance_admin_update" on public.attendance_sessions;
drop policy if exists "attendance_sessions_admin_all" on public.attendance_sessions;
drop policy if exists "attendance_sessions_teacher_read" on public.attendance_sessions;
drop policy if exists "attendance_sessions_teacher_insert" on public.attendance_sessions;
drop policy if exists "attendance_sessions_student_read" on public.attendance_sessions;
drop policy if exists "attendance_sessions_parent_read" on public.attendance_sessions;

-- Attendance Records
drop policy if exists "attendance_records_staff_read" on public.attendance_records;
drop policy if exists "attendance_records_student_read" on public.attendance_records;
drop policy if exists "attendance_teacher_insert_records" on public.attendance_records;
drop policy if exists "attendance_records_admin_update" on public.attendance_records;
drop policy if exists "attendance_records_admin_all" on public.attendance_records;
drop policy if exists "attendance_records_teacher_read" on public.attendance_records;
drop policy if exists "attendance_records_teacher_insert" on public.attendance_records;
drop policy if exists "attendance_records_parent_read" on public.attendance_records;

-- Fee Records & Structures
drop policy if exists "fee_structures_staff_read" on public.fee_structures;
drop policy if exists "fee_structures_read" on public.fee_structures;
drop policy if exists "fee_records_student_self_read" on public.fee_records;
drop policy if exists "fee_records_student_read" on public.fee_records;
drop policy if exists "fee_records_parent_read" on public.fee_records;


-- ----------------------------------------------------------------------------
-- 2. SCHEMA ENHANCEMENTS: Explicit Relationships (No phone-only auth)
-- ----------------------------------------------------------------------------

-- A. Link student records to authenticated user profile directly
alter table public.students
  add column if not exists profile_id uuid unique references public.profiles(id) on delete set null;

create index if not exists idx_students_profile_id on public.students(profile_id);
create index if not exists idx_students_batch_id on public.students(batch_id);

-- B. Explicit parent-to-student relationship table
create table if not exists public.parent_students (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship_type text not null default 'parent' check (relationship_type in ('father', 'mother', 'guardian', 'parent')),
  is_verified boolean not null default false,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique(parent_profile_id, student_id)
);

create index if not exists idx_parent_students_parent on public.parent_students(parent_profile_id);
create index if not exists idx_parent_students_student on public.parent_students(student_id);

alter table public.parent_students enable row level security;


-- ----------------------------------------------------------------------------
-- 3. SCOPED POLICIES: Batches
-- ----------------------------------------------------------------------------

-- Owner & Admin have full access via existing `batches_admin_all`
-- Teacher: Read ONLY assigned batches
create policy "batches_teacher_read" on public.batches
  for select using (
    public.current_user_role() = 'teacher' and
    public.is_teacher_assigned_to_batch(id)
  );

-- Student: Read ONLY their enrolled batch
create policy "batches_student_read" on public.batches
  for select using (
    public.current_user_role() = 'student' and
    exists (
      select 1 from public.students s
      where s.profile_id = auth.uid()
        and s.batch_id = batches.id
    )
  );

-- Parent: Read ONLY batches of their verified linked children
create policy "batches_parent_read" on public.batches
  for select using (
    public.current_user_role() = 'parent' and
    exists (
      select 1 from public.parent_students ps
      join public.students s on s.id = ps.student_id
      where ps.parent_profile_id = auth.uid()
        and ps.is_verified = true
        and s.batch_id = batches.id
    )
  );


-- ----------------------------------------------------------------------------
-- 4. SCOPED POLICIES: Students
-- ----------------------------------------------------------------------------

-- Owner & Admin have full access via existing `students_admin_all`
-- Teacher: Read ONLY students in their assigned batches
create policy "students_teacher_read" on public.students
  for select using (
    public.current_user_role() = 'teacher' and
    batch_id is not null and
    public.is_teacher_assigned_to_batch(batch_id)
  );

-- Student: Read ONLY their own student record
create policy "students_self_read" on public.students
  for select using (
    public.current_user_role() = 'student' and
    profile_id = auth.uid()
  );

-- Parent: Read ONLY their verified linked children
create policy "students_parent_read" on public.students
  for select using (
    public.current_user_role() = 'parent' and
    exists (
      select 1 from public.parent_students ps
      where ps.parent_profile_id = auth.uid()
        and ps.student_id = students.id
        and ps.is_verified = true
    )
  );


-- ----------------------------------------------------------------------------
-- 5. SCOPED POLICIES: Teachers & Assignments
-- ----------------------------------------------------------------------------

-- Staff (Owner, Admin, Teacher) can view faculty directory
create policy "teachers_staff_read" on public.teachers
  for select using (public.current_user_role() in ('owner', 'admin', 'teacher'));

-- Students & Parents can view only teachers assigned to their batches
create policy "teachers_student_parent_read" on public.teachers
  for select using (
    public.current_user_role() in ('student', 'parent') and
    exists (
      select 1 from public.teacher_batches tb
      where tb.teacher_id = teachers.id
        and (
          -- Student match
          exists (
            select 1 from public.students s
            where s.profile_id = auth.uid()
              and s.batch_id = tb.batch_id
          )
          or
          -- Parent match
          exists (
            select 1 from public.parent_students ps
            join public.students s on s.id = ps.student_id
            where ps.parent_profile_id = auth.uid()
              and ps.is_verified = true
              and s.batch_id = tb.batch_id
          )
        )
    )
  );

-- Teacher Batches: Teachers can see only their own assignments
create policy "teacher_batches_teacher_read" on public.teacher_batches
  for select using (
    public.current_user_role() = 'teacher' and
    exists (
      select 1 from public.teachers t
      where t.id = teacher_batches.teacher_id
        and t.profile_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 6. ATTENDANCE INTEGRITY: Scoped Policies & Trigger
-- ----------------------------------------------------------------------------

-- Attendance Sessions:
-- Admin & Owner full CRUD
create policy "attendance_sessions_admin_all" on public.attendance_sessions
  for all using (public.current_user_role() in ('owner', 'admin'))
  with check (public.current_user_role() in ('owner', 'admin'));

-- Teacher: Read only assigned batch sessions
create policy "attendance_sessions_teacher_read" on public.attendance_sessions
  for select using (
    public.current_user_role() = 'teacher' and
    public.is_teacher_assigned_to_batch(batch_id)
  );

-- Teacher: Insert session ONLY for assigned batch with taken_by = auth.uid()
create policy "attendance_sessions_teacher_insert" on public.attendance_sessions
  for insert with check (
    public.current_user_role() = 'teacher' and
    taken_by = auth.uid() and
    public.is_teacher_assigned_to_batch(batch_id)
  );

-- Student: Read sessions for their enrolled batch
create policy "attendance_sessions_student_read" on public.attendance_sessions
  for select using (
    public.current_user_role() = 'student' and
    exists (
      select 1 from public.students s
      where s.profile_id = auth.uid()
        and s.batch_id = attendance_sessions.batch_id
    )
  );

-- Parent: Read sessions for their child's batch
create policy "attendance_sessions_parent_read" on public.attendance_sessions
  for select using (
    public.current_user_role() = 'parent' and
    exists (
      select 1 from public.parent_students ps
      join public.students s on s.id = ps.student_id
      where ps.parent_profile_id = auth.uid()
        and ps.is_verified = true
        and s.batch_id = attendance_sessions.batch_id
    )
  );

-- NOTE: No UPDATE or DELETE policy is granted to teachers on attendance_sessions.


-- Attendance Records:
-- Admin & Owner full CRUD
create policy "attendance_records_admin_all" on public.attendance_records
  for all using (public.current_user_role() in ('owner', 'admin'))
  with check (public.current_user_role() in ('owner', 'admin'));

-- Teacher: Read only records for assigned batch sessions
create policy "attendance_records_teacher_read" on public.attendance_records
  for select using (
    public.current_user_role() = 'teacher' and
    exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_records.session_id
        and public.is_teacher_assigned_to_batch(s.batch_id)
    )
  );

-- Teacher: Insert records ONLY for students enrolled in that session's batch
create policy "attendance_records_teacher_insert" on public.attendance_records
  for insert with check (
    public.current_user_role() = 'teacher' and
    exists (
      select 1 from public.attendance_sessions s
      join public.students st on st.id = attendance_records.student_id
      where s.id = attendance_records.session_id
        and s.taken_by = auth.uid()
        and public.is_teacher_assigned_to_batch(s.batch_id)
        and st.batch_id = s.batch_id
    )
  );

-- Student: Read ONLY own attendance records
create policy "attendance_records_student_read" on public.attendance_records
  for select using (
    public.current_user_role() = 'student' and
    exists (
      select 1 from public.students s
      where s.id = attendance_records.student_id
        and s.profile_id = auth.uid()
    )
  );

-- Parent: Read ONLY records for verified linked children
create policy "attendance_records_parent_read" on public.attendance_records
  for select using (
    public.current_user_role() = 'parent' and
    exists (
      select 1 from public.parent_students ps
      where ps.parent_profile_id = auth.uid()
        and ps.student_id = attendance_records.student_id
        and ps.is_verified = true
    )
  );

-- Database Trigger for Attendance Integrity
-- Rejects insert/update if student batch does not match session batch
create or replace function public.validate_attendance_record_integrity()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  session_batch_id uuid;
  student_batch_id uuid;
begin
  select batch_id into session_batch_id
  from public.attendance_sessions
  where id = new.session_id;

  if session_batch_id is null then
    raise exception 'Integrity error: Attendance session does not exist.';
  end if;

  select batch_id into student_batch_id
  from public.students
  where id = new.student_id;

  if student_batch_id is null or student_batch_id != session_batch_id then
    raise exception 'Integrity violation: Student (%) is not assigned to session batch (%).',
      new.student_id, session_batch_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_attendance_record on public.attendance_records;
create trigger trg_validate_attendance_record
  before insert or update on public.attendance_records
  for each row execute function public.validate_attendance_record_integrity();


-- ----------------------------------------------------------------------------
-- 7. SCOPED POLICIES: Parent-Student Relationships
-- ----------------------------------------------------------------------------

drop policy if exists "parent_students_admin_all" on public.parent_students;
drop policy if exists "parent_students_parent_read" on public.parent_students;
drop policy if exists "parent_students_student_read" on public.parent_students;

-- Owner & Admin: full management
create policy "parent_students_admin_all" on public.parent_students
  for all using (public.current_user_role() in ('owner', 'admin'))
  with check (public.current_user_role() in ('owner', 'admin'));

-- Parent: Can view only their verified linked relationships
create policy "parent_students_parent_read" on public.parent_students
  for select using (
    parent_profile_id = auth.uid() and
    is_verified = true
  );

-- Student: Can view verified parent links to themselves
create policy "parent_students_student_read" on public.parent_students
  for select using (
    exists (
      select 1 from public.students s
      where s.id = parent_students.student_id
        and s.profile_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 8. SCOPED POLICIES: Fee Records & Structures
-- ----------------------------------------------------------------------------

-- Fee Structures: Visible to staff, students, and parents
create policy "fee_structures_read" on public.fee_structures
  for select using (
    public.is_staff() or
    public.current_user_role() in ('student', 'parent')
  );

-- Fee Records: Student self-access
create policy "fee_records_student_read" on public.fee_records
  for select using (
    public.current_user_role() = 'student' and
    exists (
      select 1 from public.students s
      where s.id = fee_records.student_id
        and s.profile_id = auth.uid()
    )
  );

-- Fee Records: Parent access to verified linked children
create policy "fee_records_parent_read" on public.fee_records
  for select using (
    public.current_user_role() = 'parent' and
    exists (
      select 1 from public.parent_students ps
      where ps.parent_profile_id = auth.uid()
        and ps.student_id = fee_records.student_id
        and ps.is_verified = true
    )
  );


-- ----------------------------------------------------------------------------
-- 9. HARDEN OWNER BOOTSTRAP TRUST BOUNDARY & ANTI-ESCALATION
-- ----------------------------------------------------------------------------

-- Single-use, concurrency-locked owner bootstrap
create or replace function public.bootstrap_initial_owner(owner_email text)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  user_full_name text;
  existing_owner_count int;
begin
  -- 1. Acquire transaction advisory lock to serialize concurrent executions
  perform pg_advisory_xact_lock(hashtext('initial_owner_bootstrap_lock'));

  -- 2. Verify that NO owner exists anywhere in profiles
  select count(*) into existing_owner_count from public.profiles where role = 'owner';
  if existing_owner_count > 0 then
    raise exception 'Bootstrap aborted: An institute owner already exists. Contact existing owner to assign administrative privileges.';
  end if;

  -- 3. Lookup user in auth.users and preserve actual name
  select id, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
  into target_user_id, user_full_name
  from auth.users where email = owner_email;

  if target_user_id is null then
    raise exception 'Bootstrap aborted: No authenticated user found with email %.', owner_email;
  end if;

  -- 4. Mark transaction-local context for bootstrap authorization
  perform set_config('institute.internal_bootstrap_in_progress', 'true', true);

  -- 5. Upsert profile with owner role preserving actual name
  insert into public.profiles (id, full_name, role)
  values (target_user_id, user_full_name, 'owner')
  on conflict (id) do update set
    role = 'owner',
    full_name = coalesce(public.profiles.full_name, user_full_name);

  -- 6. Audit log entry
  insert into public.audit_logs (actor_id, action, table_name, record_id, after_data)
  values (
    target_user_id,
    'OWNER_BOOTSTRAP_INITIAL',
    'profiles',
    target_user_id,
    jsonb_build_object('email', owner_email, 'role', 'owner', 'full_name', user_full_name)
  );

  return jsonb_build_object(
    'status', 'success',
    'message', 'Initial owner bootstrapped successfully.',
    'user_id', target_user_id,
    'email', owner_email,
    'full_name', user_full_name
  );
end;
$$;

-- Revoke all execution permissions on bootstrap from normal roles
revoke all on function public.bootstrap_initial_owner(text) from public, anon, authenticated;

-- Hardened role escalation prevention trigger
-- Strictly ensures that:
-- 1. Initial Owner can ONLY be created via bootstrap_initial_owner().
-- 2. Direct inserts of Owner or Admin by untrusted users (even before any owner exists) are REJECTED.
-- 3. Normal signup with default role 'student' continues working as expected.
-- 4. Subsequent role updates or promotions to Owner or Admin require an existing Owner.
create or replace function public.prevent_self_role_escalation()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  calling_user_role public.app_role;
  is_bootstrap_active boolean;
begin
  -- Check if bootstrap function is executing
  is_bootstrap_active := coalesce(current_setting('institute.internal_bootstrap_in_progress', true), 'false') = 'true';

  -- On insert of an owner or admin profile:
  if (TG_OP = 'INSERT') then
    if (new.role in ('owner', 'admin')) then
      -- If inside authorized bootstrap, allow initial owner creation
      if is_bootstrap_active then
        return new;
      end if;

      -- Otherwise, privileged role insertion MUST be performed by an existing Owner
      calling_user_role := public.current_user_role();
      if (calling_user_role is null or calling_user_role != 'owner') then
        raise exception 'Unauthorized role assignment: Privileged roles (owner, admin) cannot be directly inserted. The initial owner must be provisioned exclusively via bootstrap_initial_owner().';
      end if;
    end if;
    return new;
  end if;

  -- On update: prevent changing role unless caller is an existing Owner
  if (TG_OP = 'UPDATE') then
    if (old.role != new.role) then
      -- If inside authorized bootstrap, allow
      if is_bootstrap_active then
        return new;
      end if;

      calling_user_role := public.current_user_role();
      if (calling_user_role is null or calling_user_role != 'owner') then
        raise exception 'Unauthorized role change: Only an institute Owner can modify user roles.';
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
  before insert or update on public.profiles
  for each row execute function public.prevent_self_role_escalation();
