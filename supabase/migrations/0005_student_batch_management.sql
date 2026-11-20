-- ====================================================================
-- Migration: 0005_student_batch_management.sql
-- Description: Milestone 2: Student & Batch Management Schema Enhancements,
--              Multi-Tenant Scaffolding, Concurrency-Safe Capacity Lock,
--              PostgreSQL Admission Number Sequence, and Transactional Transfer RPC.
-- Date: 2026-11-20
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Helper function: is_current_user_admin()
-- --------------------------------------------------------------------
create or replace function public.is_current_user_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('owner', 'admin'), false);
$$;

grant execute on function public.is_current_user_admin() to authenticated;

-- --------------------------------------------------------------------
-- 2. Multi-Tenant Foundation: institutes table
-- --------------------------------------------------------------------
create table if not exists public.institutes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  contact_email text,
  contact_phone text,
  address text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.institutes enable row level security;

-- Seed Pradeep Classes as the default active institute
insert into public.institutes (id, name, slug)
values ('11111111-2222-3333-4444-555555555555', 'Pradeep Classes', 'pradeep-classes')
on conflict (id) do nothing;

-- --------------------------------------------------------------------
-- 3. Add institute_id to existing core tables
-- --------------------------------------------------------------------
alter table public.profiles
  add column if not exists institute_id uuid not null default '11111111-2222-3333-4444-555555555555' references public.institutes(id);

alter table public.batches
  add column if not exists institute_id uuid not null default '11111111-2222-3333-4444-555555555555' references public.institutes(id);

alter table public.students
  add column if not exists institute_id uuid not null default '11111111-2222-3333-4444-555555555555' references public.institutes(id);

alter table public.teachers
  add column if not exists institute_id uuid not null default '11111111-2222-3333-4444-555555555555' references public.institutes(id);

alter table public.teacher_batches
  add column if not exists institute_id uuid not null default '11111111-2222-3333-4444-555555555555' references public.institutes(id);

alter table public.attendance_sessions
  add column if not exists institute_id uuid not null default '11111111-2222-3333-4444-555555555555' references public.institutes(id);

alter table public.fee_structures
  add column if not exists institute_id uuid not null default '11111111-2222-3333-4444-555555555555' references public.institutes(id);

alter table public.fee_records
  add column if not exists institute_id uuid not null default '11111111-2222-3333-4444-555555555555' references public.institutes(id);

alter table public.audit_logs
  add column if not exists institute_id uuid not null default '11111111-2222-3333-4444-555555555555' references public.institutes(id);

-- Ensure any existing rows have institute_id assigned
update public.profiles set institute_id = '11111111-2222-3333-4444-555555555555' where institute_id is null;
update public.batches set institute_id = '11111111-2222-3333-4444-555555555555' where institute_id is null;
update public.students set institute_id = '11111111-2222-3333-4444-555555555555' where institute_id is null;
update public.teachers set institute_id = '11111111-2222-3333-4444-555555555555' where institute_id is null;

-- --------------------------------------------------------------------
-- 4. Tenant-Aware Authorization Helpers & Policies
-- --------------------------------------------------------------------
create or replace function public.current_user_institute_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select institute_id from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_user_institute_id() to authenticated;

-- RLS policies for public.institutes
drop policy if exists institutes_read on public.institutes;
create policy institutes_read on public.institutes
  for select to authenticated
  using (
    id = public.current_user_institute_id()
    or public.is_current_user_admin()
  );

drop policy if exists institutes_update on public.institutes;
create policy institutes_update on public.institutes
  for update to authenticated
  using (
    id = public.current_user_institute_id()
    and public.is_current_user_admin()
  )
  with check (
    id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

-- --------------------------------------------------------------------
-- 5. Batches Schema Enhancements & Status Synchronization
-- --------------------------------------------------------------------
alter table public.batches
  add column if not exists max_capacity integer not null default 40 check (max_capacity > 0),
  add column if not exists timing text,
  add column if not exists room_number text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  add column if not exists updated_at timestamptz not null default now();

-- Trigger to synchronize status and is_active (single source of truth)
create or replace function public.fn_sync_batch_status()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.status is null then
      new.status := case when new.is_active then 'active' else 'archived' end;
    else
      new.is_active := (new.status = 'active');
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      new.is_active := (new.status = 'active');
    elsif new.is_active is distinct from old.is_active then
      new.status := case when new.is_active then 'active' else 'archived' end;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_batch_status on public.batches;
create trigger trg_sync_batch_status
  before insert or update on public.batches
  for each row execute function public.fn_sync_batch_status();

-- --------------------------------------------------------------------
-- 6. Students Schema Enhancements
-- --------------------------------------------------------------------
alter table public.students
  add column if not exists email text,
  add column if not exists date_of_birth date,
  add column if not exists gender text check (gender is null or gender in ('male', 'female', 'other')),
  add column if not exists address text,
  add column if not exists city text default 'Kota',
  add column if not exists emergency_contact text,
  add column if not exists parent_relation text default 'Parent',
  add column if not exists parent_email text,
  add column if not exists notes text,
  add column if not exists photo_url text;

-- --------------------------------------------------------------------
-- 7. Sequential Admission Number Generator in PostgreSQL
-- --------------------------------------------------------------------
create sequence if not exists public.admission_no_seq minvalue 1 start with 1001;

create or replace function public.fn_generate_admission_no()
returns trigger as $$
begin
  if new.admission_no is null or trim(new.admission_no) = '' then
    new.admission_no := 'PC-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.admission_no_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_generate_admission_no on public.students;
create trigger trg_generate_admission_no
  before insert on public.students
  for each row execute function public.fn_generate_admission_no();

-- --------------------------------------------------------------------
-- 8. Batch Capacity Concurrency Enforcement & Tenant Consistency Trigger
-- --------------------------------------------------------------------
create or replace function public.fn_enforce_student_batch_allocation()
returns trigger as $$
declare
  v_batch_capacity integer;
  v_batch_status text;
  v_batch_name text;
  v_batch_institute uuid;
  v_current_count integer;
begin
  if new.batch_id is not null then
    -- Explicit row lock on target batch to prevent concurrent race condition over-enrollments
    select max_capacity, status, name, institute_id
    into v_batch_capacity, v_batch_status, v_batch_name, v_batch_institute
    from public.batches
    where id = new.batch_id
    for update;

    if not found then
      raise exception 'Target batch % does not exist', new.batch_id;
    end if;

    -- Strict tenant isolation check
    if v_batch_institute is distinct from new.institute_id then
      raise exception 'Cross-tenant batch allocation prohibited: student institute % != batch institute %',
        new.institute_id, v_batch_institute;
    end if;

    -- Reject enrollment in inactive or archived batch
    if v_batch_status != 'active' then
      raise exception 'Cannot enroll student in an inactive or archived batch (Status: %)', v_batch_status;
    end if;

    -- Count active enrolled students
    if new.status = 'active' then
      select count(*)
      into v_current_count
      from public.students
      where batch_id = new.batch_id
        and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and status = 'active';

      if v_current_count >= v_batch_capacity then
        raise exception 'Batch capacity exceeded (Max: %, Currently Enrolled: %)', v_batch_capacity, v_current_count;
      end if;
    end if;

    new.batch_name := v_batch_name;
  else
    new.batch_name := coalesce(new.batch_name, 'Unassigned');
  end if;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_student_batch_allocation on public.students;
create trigger trg_enforce_student_batch_allocation
  before insert or update of batch_id, status, institute_id on public.students
  for each row execute function public.fn_enforce_student_batch_allocation();

-- --------------------------------------------------------------------
-- 9. Student Batch Transfer History Table & Indexes
-- --------------------------------------------------------------------
create table if not exists public.student_batch_history (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) default '11111111-2222-3333-4444-555555555555',
  student_id uuid not null references public.students(id) on delete cascade,
  from_batch_id uuid references public.batches(id) on delete set null,
  to_batch_id uuid not null references public.batches(id) on delete restrict,
  transfer_date timestamptz not null default now(),
  transferred_by uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.student_batch_history enable row level security;

-- Performance and tenant indexes
create index if not exists idx_student_batch_history_student on public.student_batch_history(student_id);
create index if not exists idx_student_batch_history_institute on public.student_batch_history(institute_id);
create index if not exists idx_students_batch_id on public.students(batch_id);
create index if not exists idx_students_institute_id on public.students(institute_id);
create index if not exists idx_batches_institute_id on public.batches(institute_id);
create index if not exists idx_teacher_batches_batch_id on public.teacher_batches(batch_id);
create index if not exists idx_teacher_batches_teacher_id on public.teacher_batches(teacher_id);

-- RLS policies for student_batch_history
drop policy if exists batch_history_admin_all on public.student_batch_history;
create policy batch_history_admin_all on public.student_batch_history
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

drop policy if exists batch_history_teacher_read on public.student_batch_history;
create policy batch_history_teacher_read on public.student_batch_history
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and (
      public.is_teacher_assigned_to_batch(from_batch_id)
      or public.is_teacher_assigned_to_batch(to_batch_id)
    )
  );

drop policy if exists batch_history_student_read on public.student_batch_history;
create policy batch_history_student_read on public.student_batch_history
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and (
      public.is_student_owner_of_record(student_id, auth.uid())
      or public.is_student_linked_to_parent(student_id, auth.uid())
    )
  );

-- --------------------------------------------------------------------
-- 10. Transactional RPC Function for Student Batch Transfer
-- --------------------------------------------------------------------
create or replace function public.transfer_student_batch(
  p_student_id uuid,
  p_to_batch_id uuid,
  p_reason text default 'Administrative Batch Transfer'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role app_role;
  v_caller_inst uuid;
  v_old_batch_id uuid;
  v_student_inst uuid;
  v_to_batch_name text;
  v_history_id uuid;
begin
  -- Authenticate and authorize caller
  select role, institute_id into v_caller_role, v_caller_inst
  from public.profiles
  where id = auth.uid();

  if v_caller_role is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Unauthorized: Only Owner or Admin can execute batch transfers';
  end if;

  -- Lock student row
  select batch_id, institute_id into v_old_batch_id, v_student_inst
  from public.students
  where id = p_student_id
  for update;

  if not found then
    raise exception 'Student with ID % not found', p_student_id;
  end if;

  -- Verify tenant consistency with caller
  if v_student_inst is distinct from v_caller_inst then
    raise exception 'Unauthorized: Cross-tenant operation prohibited';
  end if;

  if v_old_batch_id is not distinct from p_to_batch_id then
    raise exception 'Student is already enrolled in the specified batch';
  end if;

  -- Update student batch (this triggers trg_enforce_student_batch_allocation
  -- which validates target batch status, capacity lock, and tenant consistency)
  update public.students
  set batch_id = p_to_batch_id,
      updated_at = now()
  where id = p_student_id;

  -- Log in student_batch_history
  insert into public.student_batch_history (
    institute_id,
    student_id,
    from_batch_id,
    to_batch_id,
    transferred_by,
    reason
  ) values (
    v_student_inst,
    p_student_id,
    v_old_batch_id,
    p_to_batch_id,
    auth.uid(),
    p_reason
  ) returning id into v_history_id;

  -- Audit log entry
  insert into public.audit_logs (
    actor_id,
    action,
    table_name,
    record_id,
    institute_id
  ) values (
    auth.uid(),
    'STUDENT_BATCH_TRANSFER',
    'students',
    p_student_id,
    v_student_inst
  );

  select name into v_to_batch_name from public.batches where id = p_to_batch_id;

  return jsonb_build_object(
    'success', true,
    'student_id', p_student_id,
    'from_batch_id', v_old_batch_id,
    'to_batch_id', p_to_batch_id,
    'to_batch_name', v_to_batch_name,
    'history_id', v_history_id
  );
end;
$$;

-- Grant execution permission
grant execute on function public.transfer_student_batch(uuid, uuid, text) to authenticated;
