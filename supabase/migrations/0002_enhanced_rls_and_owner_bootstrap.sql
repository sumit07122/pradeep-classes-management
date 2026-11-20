-- ============================================================================
-- Migration 0002: Enhanced Security, Hardened RLS, Fee Management & Owner Bootstrap
-- ============================================================================

-- 1. Ensure Profiles cannot be self-elevated to privileged roles
create or replace function public.prevent_self_role_escalation()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  calling_user_role public.app_role;
begin
  -- If this is an insert from the auth trigger, enforce 'student' unless bootstrapped
  if (TG_OP = 'INSERT') then
    if (new.role in ('owner', 'admin')) then
      -- Verify if any owner exists
      if exists (select 1 from public.profiles where role = 'owner') then
        -- Only an existing owner can create another owner/admin
        calling_user_role := public.current_user_role();
        if (calling_user_role is null or calling_user_role != 'owner') then
          raise exception 'Unauthorized: Only an institute owner can assign privileged roles.';
        end if;
      end if;
    end if;
    return new;
  end if;

  -- If this is an update, prevent changing the role unless caller is owner
  if (TG_OP = 'UPDATE') then
    if (old.role != new.role) then
      calling_user_role := public.current_user_role();
      if (calling_user_role is null or calling_user_role != 'owner') then
        raise exception 'Security violation: Users cannot modify account roles. Contact institute owner.';
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

-- 2. Automatically create profile on user registration in auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'student' -- Default safe unprivileged role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger on auth.users (Standard Supabase Auth Hook)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Secure Initial Owner Bootstrap Function
-- Strictly single-use: Fails if an owner already exists in the system
create or replace function public.bootstrap_initial_owner(owner_email text)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  existing_owner_count int;
begin
  -- Check if an owner already exists
  select count(*) into existing_owner_count from public.profiles where role = 'owner';
  if existing_owner_count > 0 then
    raise exception 'Bootstrap failed: An institute owner already exists. Contact existing owner to assign permissions.';
  end if;

  -- Look up user ID from auth.users
  select id into target_user_id from auth.users where email = owner_email;
  if target_user_id is null then
    raise exception 'Bootstrap failed: No auth user found with email %.', owner_email;
  end if;

  -- Upsert profile with owner role
  insert into public.profiles (id, full_name, role)
  values (target_user_id, 'Institute Owner', 'owner')
  on conflict (id) do update set role = 'owner';

  -- Log security event in audit logs
  insert into public.audit_logs (actor_id, action, table_name, record_id, after_data)
  values (
    target_user_id,
    'OWNER_BOOTSTRAP',
    'profiles',
    target_user_id,
    jsonb_build_object('email', owner_email, 'role', 'owner')
  );

  return jsonb_build_object(
    'status', 'success',
    'message', 'Initial owner bootstrapped successfully.',
    'user_id', target_user_id,
    'email', owner_email
  );
end;
$$;

-- Revoke public execution on bootstrap function; only postgres / service_role can call it
revoke all on function public.bootstrap_initial_owner(text) from public, anon, authenticated;

-- 4. Scope Teacher Attendance Marking to Assigned Batches Only
create or replace function public.is_teacher_assigned_to_batch(target_batch_id uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teacher_batches tb
    join public.teachers t on t.id = tb.teacher_id
    where t.profile_id = auth.uid()
      and tb.batch_id = target_batch_id
  );
$$;

-- Drop and recreate attendance session insert policy with strict batch check
drop policy if exists "attendance_teacher_insert" on public.attendance_sessions;
create policy "attendance_teacher_insert" on public.attendance_sessions
  for insert with check (
    public.current_user_role() in ('owner', 'admin') or
    (
      public.current_user_role() = 'teacher'
      and taken_by = auth.uid()
      and public.is_teacher_assigned_to_batch(batch_id)
    )
  );

-- Drop and recreate attendance records insert policy
drop policy if exists "attendance_teacher_insert_records" on public.attendance_records;
create policy "attendance_teacher_insert_records" on public.attendance_records
  for insert with check (
    public.current_user_role() in ('owner', 'admin') or
    (
      public.current_user_role() = 'teacher'
      and exists (
        select 1 from public.attendance_sessions s
        where s.id = attendance_records.session_id
          and s.taken_by = auth.uid()
          and public.is_teacher_assigned_to_batch(s.batch_id)
      )
    )
  );

-- 5. Student & Parent Self-Access Policies
-- Allow students to read only their own profile
drop policy if exists "students_self_read" on public.students;
create policy "students_self_read" on public.students
  for select using (
    public.is_staff() or
    phone = (select phone from public.profiles where id = auth.uid()) or
    parent_phone = (select phone from public.profiles where id = auth.uid())
  );

-- Allow students to view only their own attendance records
drop policy if exists "attendance_records_student_read" on public.attendance_records;
create policy "attendance_records_student_read" on public.attendance_records
  for select using (
    public.is_staff() or
    student_id in (
      select id from public.students
      where phone = (select phone from public.profiles where id = auth.uid())
         or parent_phone = (select phone from public.profiles where id = auth.uid())
    )
  );

-- 6. Fee Management Tables & RLS
create table if not exists public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  course_name text not null,
  academic_year text not null,
  total_fee numeric(10,2) not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.fee_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric(10,2) not null,
  status text not null check (status in ('paid', 'pending', 'partial', 'overdue')),
  due_date date not null,
  paid_date date,
  receipt_no text unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fee_structures enable row level security;
alter table public.fee_records enable row level security;

-- Only owner and admin can manage fee structures
create policy "fee_structures_admin_all" on public.fee_structures
  for all using (public.current_user_role() in ('owner', 'admin'))
  with check (public.current_user_role() in ('owner', 'admin'));

create policy "fee_structures_staff_read" on public.fee_structures
  for select using (public.is_staff());

-- Fee records policies: Admin/Owner full access, students/parents view their own fees only
create policy "fee_records_admin_all" on public.fee_records
  for all using (public.current_user_role() in ('owner', 'admin'))
  with check (public.current_user_role() in ('owner', 'admin'));

create policy "fee_records_student_self_read" on public.fee_records
  for select using (
    public.current_user_role() in ('owner', 'admin') or
    student_id in (
      select id from public.students
      where phone = (select phone from public.profiles where id = auth.uid())
         or parent_phone = (select phone from public.profiles where id = auth.uid())
    )
  );
