-- ============================================================================
-- Migration 0004: Eliminate RLS Mutual Recursion between students and parent_students
-- Uses SECURITY DEFINER helper functions to bypass RLS during internal lookups
-- ============================================================================

-- 1. Helper function: check parent-student link with RLS bypass
create or replace function public.is_student_linked_to_parent(target_student_id uuid, target_parent_id uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.parent_students ps
    where ps.student_id = target_student_id
      and ps.parent_profile_id = target_parent_id
      and ps.is_verified = true
  );
$$;

-- 2. Helper function: check student ownership with RLS bypass
create or replace function public.is_student_owner_of_record(target_student_id uuid, target_user_id uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.id = target_student_id
      and s.profile_id = target_user_id
  );
$$;

-- 3. Replace mutually recursive policies
drop policy if exists "students_parent_read" on public.students;
create policy "students_parent_read" on public.students
  for select using (
    public.current_user_role() = 'parent' and
    public.is_student_linked_to_parent(id, auth.uid())
  );

drop policy if exists "parent_students_student_read" on public.parent_students;
create policy "parent_students_student_read" on public.parent_students
  for select using (
    public.current_user_role() = 'student' and
    public.is_student_owner_of_record(student_id, auth.uid())
  );

drop policy if exists "attendance_records_parent_read" on public.attendance_records;
create policy "attendance_records_parent_read" on public.attendance_records
  for select using (
    public.current_user_role() = 'parent' and
    public.is_student_linked_to_parent(student_id, auth.uid())
  );

drop policy if exists "fee_records_parent_read" on public.fee_records;
create policy "fee_records_parent_read" on public.fee_records
  for select using (
    public.current_user_role() = 'parent' and
    public.is_student_linked_to_parent(student_id, auth.uid())
  );
