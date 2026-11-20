-- ====================================================================
-- Migration: 0006_security_integrity_fixes.sql
-- Description: Comprehensive Security, Multi-Tenant Isolation & Integrity Corrections:
--              1. Drop default/not-null on profiles.institute_id; public signups without
--                 an invitation get institute_id = NULL and role = 'student' (zero institute access).
--              2. Introduce public.institute_invitations table and invitation-gated onboarding.
--              3. Hardened handle_new_user() verifying invitations and rejecting unverified claims.
--              4. Profile institute_id tamper-proofing trigger and self-role lock.
--              5. Collision-proof sequence advancement with manual format validation.
--              6. Batch capacity update concurrency guard (FOR UPDATE lock on active students).
--              7. Archived-batch student deactivation/edit fix in fn_enforce_student_batch_allocation().
--              8. Genuinely immutable audit retention on student_batch_history.
--              9. Cross-tenant allocation validation triggers on all junction tables.
--             10. Enhanced transfer_student_batch RPC with active student/institute validation.
--             11. Helper functions bound strictly to auth.uid() without user enumeration parameters.
--             12. Systematic cleanup of all legacy policies & strict tenant scoping across all 13 tables + invitations.
-- Date: 2026-11-20
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Ensure institute_id on all tenant tables & enable RLS
-- --------------------------------------------------------------------
alter table public.parent_students
  add column if not exists institute_id uuid not null default '11111111-2222-3333-4444-555555555555' references public.institutes(id);

alter table public.attendance_records
  add column if not exists institute_id uuid not null default '11111111-2222-3333-4444-555555555555' references public.institutes(id);

-- Drop NOT NULL and DEFAULT on profiles.institute_id so uninvited public signups do NOT join any institute
alter table public.profiles
  alter column institute_id drop default,
  alter column institute_id drop not null;

create index if not exists idx_parent_students_institute on public.parent_students(institute_id);
create index if not exists idx_attendance_records_institute on public.attendance_records(institute_id);
create index if not exists idx_profiles_institute on public.profiles(institute_id);

alter table public.institutes enable row level security;
alter table public.profiles enable row level security;
alter table public.batches enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.teacher_batches enable row level security;
alter table public.parent_students enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.fee_structures enable row level security;
alter table public.fee_records enable row level security;
alter table public.audit_logs enable row level security;
alter table public.student_batch_history enable row level security;

-- --------------------------------------------------------------------
-- 2. Institute Invitations Table & Trusted Onboarding
-- --------------------------------------------------------------------
create table if not exists public.institute_invitations (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'teacher', 'student', 'parent')),
  invited_by uuid references public.profiles(id) on delete set null,
  token text unique not null default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invitations_lookup
  on public.institute_invitations(lower(email), status, expires_at);
create index if not exists idx_invitations_token
  on public.institute_invitations(token) where status = 'pending';
create index if not exists idx_invitations_institute
  on public.institute_invitations(institute_id);

alter table public.institute_invitations enable row level security;

-- --------------------------------------------------------------------
-- 3. Protect profiles.institute_id and Role from Unauthorized Modification
-- --------------------------------------------------------------------
create or replace function public.fn_protect_profile_institute_id()
returns trigger as $$
begin
  if new.institute_id is distinct from old.institute_id then
    if coalesce(current_setting('institute.internal_bootstrap_in_progress', true), 'false') != 'true' then
      raise exception 'Unauthorized: Modifying profile institute_id is strictly prohibited';
    end if;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_protect_profile_institute_id on public.profiles;
create trigger trg_protect_profile_institute_id
  before update on public.profiles
  for each row execute function public.fn_protect_profile_institute_id();

-- --------------------------------------------------------------------
-- 4. Hardened handle_new_user(): Public Signup Has Zero Institute Access
-- --------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_inst uuid := null;
  v_role app_role := 'student';
  v_invitation_id uuid := null;
  v_is_bootstrap boolean;
  v_meta_token text;
begin
  v_is_bootstrap := coalesce(current_setting('institute.internal_bootstrap_in_progress', true), 'false') = 'true';

  -- 1. Authorized Internal Bootstrap Procedure
  if v_is_bootstrap then
    if nullif(current_setting('institute.target_institute_id', true), '') is not null then
      v_inst := current_setting('institute.target_institute_id', true)::uuid;
    else
      v_inst := '11111111-2222-3333-4444-555555555555'::uuid;
    end if;
    if nullif(current_setting('institute.target_role', true), '') is not null then
      v_role := current_setting('institute.target_role', true)::app_role;
    end if;

  else
    -- 2. Trusted Invitation Verification
    -- Check for invitation token in metadata
    v_meta_token := nullif(trim(new.raw_user_meta_data->>'invitation_token'), '');
    if v_meta_token is not null then
      select id, institute_id, role::app_role
      into v_invitation_id, v_inst, v_role
      from public.institute_invitations
      where token = v_meta_token
        and status = 'pending'
        and expires_at > now()
      for update;
    end if;

    -- If no valid token, check for pending invitation by user email
    if v_invitation_id is null and new.email is not null then
      select id, institute_id, role::app_role
      into v_invitation_id, v_inst, v_role
      from public.institute_invitations
      where lower(email) = lower(new.email)
        and status = 'pending'
        and expires_at > now()
      order by created_at desc
      limit 1
      for update;
    end if;

    if v_invitation_id is not null then
      -- Mark invitation accepted
      update public.institute_invitations
      set status = 'accepted',
          accepted_at = now(),
          accepted_by = new.id,
          updated_at = now()
      where id = v_invitation_id;
    else
      -- 3. Public Signup without Invitation:
      -- DO NOT grant access or membership to Pradeep Classes or any institute.
      -- institute_id remains NULL. Client metadata is strictly ignored.
      v_inst := null;
      v_role := 'student';
    end if;
  end if;

  insert into public.profiles (id, full_name, role, institute_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_role,
    v_inst
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- --------------------------------------------------------------------
-- 5. Trusted Invitation Management RPCs
-- --------------------------------------------------------------------
create or replace function public.create_institute_invitation(
  p_email text,
  p_role text default 'student'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_caller_inst uuid;
  v_inv_id uuid;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated: Must be logged in to create invitations';
  end if;

  select role::text, institute_id into v_caller_role, v_caller_inst
  from public.profiles
  where id = auth.uid();

  if v_caller_role is null or v_caller_role not in ('owner', 'admin') or v_caller_inst is null then
    raise exception 'Unauthorized: Only institute Owner or Admin can issue invitations';
  end if;

  if p_role not in ('owner', 'admin', 'teacher', 'student', 'parent') then
    raise exception 'Invalid invitation role: %', p_role;
  end if;

  if p_role = 'owner' and v_caller_role != 'owner' then
    raise exception 'Unauthorized: Only an institute Owner can invite another Owner';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.institute_invitations (
    institute_id,
    email,
    role,
    invited_by,
    token,
    status,
    expires_at
  )
  values (
    v_caller_inst,
    lower(trim(p_email)),
    p_role,
    auth.uid(),
    v_token,
    'pending',
    now() + interval '7 days'
  )
  returning id into v_inv_id;

  return jsonb_build_object(
    'invitation_id', v_inv_id,
    'email', lower(trim(p_email)),
    'role', p_role,
    'token', v_token,
    'institute_id', v_caller_inst
  );
end;
$$;

create or replace function public.accept_institute_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv_id uuid;
  v_inv_inst uuid;
  v_inv_role text;
  v_inv_email text;
  v_user_email text;
  v_current_inst uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated: Must be logged in to accept invitations';
  end if;

  select email into v_user_email from auth.users where id = auth.uid();
  select institute_id into v_current_inst from public.profiles where id = auth.uid();

  if v_current_inst is not null then
    raise exception 'User is already an active member of an institute';
  end if;

  select id, institute_id, role, email
  into v_inv_id, v_inv_inst, v_inv_role, v_inv_email
  from public.institute_invitations
  where token = p_token
    and status = 'pending'
    and expires_at > now()
  for update;

  if v_inv_id is null then
    raise exception 'Invalid or expired invitation token';
  end if;

  if v_inv_email is not null and lower(v_inv_email) != lower(v_user_email) then
    raise exception 'Invitation email mismatch: invitation was issued for %', v_inv_email;
  end if;

  perform set_config('institute.internal_bootstrap_in_progress', 'true', true);

  update public.profiles
  set institute_id = v_inv_inst,
      role = v_inv_role::app_role,
      updated_at = now()
  where id = auth.uid();

  update public.institute_invitations
  set status = 'accepted',
      accepted_at = now(),
      accepted_by = auth.uid(),
      updated_at = now()
  where id = v_inv_id;

  perform set_config('institute.internal_bootstrap_in_progress', 'false', true);

  return jsonb_build_object('success', true, 'institute_id', v_inv_inst, 'role', v_inv_role);
end;
$$;

revoke all on function public.create_institute_invitation(text, text) from public, anon;
grant execute on function public.create_institute_invitation(text, text) to authenticated;

revoke all on function public.accept_institute_invitation(text) from public, anon;
grant execute on function public.accept_institute_invitation(text) to authenticated;

-- --------------------------------------------------------------------
-- 6. Collision-Proof Sequence Advancement & Format Validation
-- --------------------------------------------------------------------
select setval('public.admission_no_seq',
  greatest(
    1000,
    coalesce((
      select max(substring(admission_no from '[0-9]+$')::bigint)
      from public.students
      where admission_no ~ '^PC-[0-9]{4}-[0-9]+$'
    ), 1000)
  )
);

create or replace function public.fn_generate_admission_no()
returns trigger as $$
declare
  v_year text := to_char(current_date, 'YYYY');
  v_seq bigint;
  v_candidate text;
begin
  if new.admission_no is null or trim(new.admission_no) = '' then
    loop
      v_seq := nextval('public.admission_no_seq');
      v_candidate := 'PC-' || v_year || '-' || lpad(v_seq::text, 4, '0');
      if not exists (select 1 from public.students where admission_no = v_candidate) then
        new.admission_no := v_candidate;
        exit;
      end if;
    end loop;
  else
    if new.admission_no !~ '^PC-[0-9]{4}-[0-9]{4,}$' then
      raise exception 'Invalid admission number format: "%". Must follow pattern PC-YYYY-XXXX', new.admission_no;
    end if;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

-- --------------------------------------------------------------------
-- 7. Archived Batch Fix in fn_enforce_student_batch_allocation()
-- --------------------------------------------------------------------
create or replace function public.fn_enforce_student_batch_allocation()
returns trigger as $$
declare
  v_batch_capacity integer;
  v_batch_status text;
  v_batch_name text;
  v_batch_institute uuid;
  v_current_count integer;
  v_is_enrolling_or_reactivating boolean;
begin
  if new.batch_id is not null then
    select max_capacity, status, name, institute_id
    into v_batch_capacity, v_batch_status, v_batch_name, v_batch_institute
    from public.batches
    where id = new.batch_id
    for share;

    if not found then
      raise exception 'Target batch % does not exist', new.batch_id;
    end if;

    if v_batch_institute is distinct from new.institute_id then
      raise exception 'Cross-tenant batch allocation prohibited: batch institute % != student institute %',
        v_batch_institute, new.institute_id;
    end if;

    v_is_enrolling_or_reactivating := (
      (tg_op = 'INSERT' and new.status = 'active')
      or
      (tg_op = 'UPDATE' and new.status = 'active' and (
        old.batch_id is distinct from new.batch_id
        or old.status is distinct from 'active'
      ))
    );

    if v_is_enrolling_or_reactivating then
      if v_batch_status is distinct from 'active' then
        raise exception 'Cannot enroll or reactivate student in an inactive or archived batch (Status: %)', v_batch_status;
      end if;

      select count(*) into v_current_count
      from public.students
      where batch_id = new.batch_id
        and status = 'active'
        and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

      if v_current_count >= v_batch_capacity then
        raise exception 'Batch capacity exceeded (Max: %, Currently Enrolled: %)',
          v_batch_capacity, v_current_count;
      end if;
    end if;
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

-- --------------------------------------------------------------------
-- 8. Batch Capacity Update Concurrency Guard
-- --------------------------------------------------------------------
create or replace function public.fn_validate_batch_capacity_update()
returns trigger as $$
declare
  v_active_students integer;
begin
  if tg_op = 'UPDATE' and new.max_capacity < old.max_capacity then
    perform id
    from public.students
    where batch_id = new.id
      and status = 'active'
    for update;

    select count(*) into v_active_students
    from public.students
    where batch_id = new.id
      and status = 'active';

    if new.max_capacity < v_active_students then
      raise exception 'Cannot reduce batch max_capacity to %: currently % active students are enrolled',
        new.max_capacity, v_active_students;
    end if;
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_validate_batch_capacity_update on public.batches;
create trigger trg_validate_batch_capacity_update
  before update on public.batches
  for each row execute function public.fn_validate_batch_capacity_update();

-- --------------------------------------------------------------------
-- 9. Immutable Audit Retention on student_batch_history
-- --------------------------------------------------------------------
alter table public.student_batch_history
  add column if not exists student_name text,
  add column if not exists student_admission_no text,
  add column if not exists from_batch_name text,
  add column if not exists to_batch_name text,
  add column if not exists transferred_by_name text;

alter table public.student_batch_history
  alter column student_id drop not null,
  alter column to_batch_id drop not null,
  alter column from_batch_id drop not null,
  alter column transferred_by drop not null;

alter table public.student_batch_history
  drop constraint if exists student_batch_history_student_id_fkey,
  drop constraint if exists student_batch_history_from_batch_id_fkey,
  drop constraint if exists student_batch_history_to_batch_id_fkey,
  drop constraint if exists student_batch_history_transferred_by_fkey;

alter table public.student_batch_history
  add constraint student_batch_history_student_id_fkey
    foreign key (student_id) references public.students(id) on delete set null,
  add constraint student_batch_history_from_batch_id_fkey
    foreign key (from_batch_id) references public.batches(id) on delete set null,
  add constraint student_batch_history_to_batch_id_fkey
    foreign key (to_batch_id) references public.batches(id) on delete set null,
  add constraint student_batch_history_transferred_by_fkey
    foreign key (transferred_by) references public.profiles(id) on delete set null;

create or replace function public.fn_prevent_history_deletion()
returns trigger as $$
begin
  raise exception 'Audit records in student_batch_history are immutable and cannot be deleted';
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_prevent_history_deletion on public.student_batch_history;
create trigger trg_prevent_history_deletion
  before delete on public.student_batch_history
  for each row execute function public.fn_prevent_history_deletion();

create or replace function public.fn_prevent_history_modification()
returns trigger as $$
begin
  if (old.student_id is not null and new.student_id is null) or
     (old.from_batch_id is not null and new.from_batch_id is null) or
     (old.to_batch_id is not null and new.to_batch_id is null) or
     (old.transferred_by is not null and new.transferred_by is null) then
    if new.reason is not distinct from old.reason and
       new.transfer_date is not distinct from old.transfer_date and
       new.student_name is not distinct from old.student_name and
       new.student_admission_no is not distinct from old.student_admission_no and
       new.from_batch_name is not distinct from old.from_batch_name and
       new.to_batch_name is not distinct from old.to_batch_name and
       new.transferred_by_name is not distinct from old.transferred_by_name and
       new.institute_id is not distinct from old.institute_id then
      return new;
    end if;
  end if;

  raise exception 'Audit records in student_batch_history are immutable and cannot be modified';
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_prevent_history_modification on public.student_batch_history;
create trigger trg_prevent_history_modification
  before update on public.student_batch_history
  for each row execute function public.fn_prevent_history_modification();

-- --------------------------------------------------------------------
-- 10. Cross-Tenant Allocation Validation Triggers
-- --------------------------------------------------------------------
create or replace function public.fn_validate_teacher_batches_tenant()
returns trigger as $$
declare
  v_teacher_inst uuid;
  v_batch_inst uuid;
begin
  select institute_id into v_teacher_inst from public.teachers where id = new.teacher_id;
  if not found then
    raise exception 'Teacher with ID % does not exist', new.teacher_id;
  end if;

  select institute_id into v_batch_inst from public.batches where id = new.batch_id;
  if not found then
    raise exception 'Batch with ID % does not exist', new.batch_id;
  end if;

  if v_teacher_inst is distinct from v_batch_inst then
    raise exception 'Cross-tenant assignment prohibited: teacher institute % != batch institute %',
      v_teacher_inst, v_batch_inst;
  end if;

  new.institute_id := v_teacher_inst;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_validate_teacher_batches_tenant on public.teacher_batches;
create trigger trg_validate_teacher_batches_tenant
  before insert or update on public.teacher_batches
  for each row execute function public.fn_validate_teacher_batches_tenant();

create or replace function public.fn_validate_student_batch_history_tenant()
returns trigger as $$
declare
  v_student_inst uuid;
  v_to_batch_inst uuid;
  v_from_batch_inst uuid;
  v_transferred_by_inst uuid;
begin
  if new.student_id is not null then
    select institute_id into v_student_inst from public.students where id = new.student_id;
    if v_student_inst is distinct from new.institute_id then
      raise exception 'Cross-tenant batch history prohibited: student institute % != history institute %',
        v_student_inst, new.institute_id;
    end if;
  end if;

  if new.to_batch_id is not null then
    select institute_id into v_to_batch_inst from public.batches where id = new.to_batch_id;
    if v_to_batch_inst is distinct from new.institute_id then
      raise exception 'Cross-tenant batch history prohibited: target batch institute % != history institute %',
        v_to_batch_inst, new.institute_id;
    end if;
  end if;

  if new.from_batch_id is not null then
    select institute_id into v_from_batch_inst from public.batches where id = new.from_batch_id;
    if v_from_batch_inst is distinct from new.institute_id then
      raise exception 'Cross-tenant batch history prohibited: source batch institute % != history institute %',
        v_from_batch_inst, new.institute_id;
    end if;
  end if;

  if new.transferred_by is not null then
    select institute_id into v_transferred_by_inst from public.profiles where id = new.transferred_by;
    if v_transferred_by_inst is distinct from new.institute_id then
      raise exception 'Cross-tenant transferred_by prohibited: user institute % != history institute %',
        v_transferred_by_inst, new.institute_id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_validate_student_batch_history_tenant on public.student_batch_history;
create trigger trg_validate_student_batch_history_tenant
  before insert on public.student_batch_history
  for each row execute function public.fn_validate_student_batch_history_tenant();

create or replace function public.fn_validate_parent_students_tenant()
returns trigger as $$
declare
  v_parent_inst uuid;
  v_student_inst uuid;
begin
  select institute_id into v_parent_inst from public.profiles where id = new.parent_profile_id;
  if not found then
    raise exception 'Parent profile with ID % does not exist', new.parent_profile_id;
  end if;

  select institute_id into v_student_inst from public.students where id = new.student_id;
  if not found then
    raise exception 'Student with ID % does not exist', new.student_id;
  end if;

  if v_parent_inst is distinct from v_student_inst then
    raise exception 'Cross-tenant parent link prohibited: parent institute % != student institute %',
      v_parent_inst, v_student_inst;
  end if;

  new.institute_id := v_student_inst;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_validate_parent_students_tenant on public.parent_students;
create trigger trg_validate_parent_students_tenant
  before insert or update on public.parent_students
  for each row execute function public.fn_validate_parent_students_tenant();

-- --------------------------------------------------------------------
-- 11. Enhanced transfer_student_batch() RPC Function
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
  v_student_adm text;
  v_student_name text;
  v_old_batch_id uuid;
  v_student_inst uuid;
  v_student_status record_status;
  v_inst_active boolean;
  v_target_batch_name text;
  v_history_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated: Must be logged in to execute batch transfers';
  end if;

  select role, institute_id into v_caller_role, v_caller_inst
  from public.profiles
  where id = auth.uid();

  if v_caller_role is null or v_caller_role not in ('owner', 'admin') or v_caller_inst is null then
    raise exception 'Unauthorized: Only an institute Owner or Admin can execute batch transfers';
  end if;

  select admission_no, full_name, batch_id, institute_id, status
  into v_student_adm, v_student_name, v_old_batch_id, v_student_inst, v_student_status
  from public.students
  where id = p_student_id
  for update;

  if not found then
    raise exception 'Student with ID % does not exist', p_student_id;
  end if;

  if v_student_inst is distinct from v_caller_inst then
    raise exception 'Unauthorized: Caller institute % does not match student institute %',
      v_caller_inst, v_student_inst;
  end if;

  if v_student_status != 'active' then
    raise exception 'Cannot transfer student %: student is currently % (must be active)',
      p_student_id, v_student_status;
  end if;

  select is_active into v_inst_active
  from public.institutes
  where id = v_student_inst;

  if v_inst_active is not true then
    raise exception 'Cannot transfer student: Institute % is currently inactive', v_student_inst;
  end if;

  if v_old_batch_id is not distinct from p_to_batch_id then
    raise exception 'Student is already enrolled in the specified batch';
  end if;

  select name into v_target_batch_name
  from public.batches
  where id = p_to_batch_id
    and institute_id = v_student_inst;

  if not found then
    raise exception 'Target batch % does not exist in the student institute', p_to_batch_id;
  end if;

  insert into public.student_batch_history (
    student_id,
    from_batch_id,
    to_batch_id,
    transfer_date,
    reason,
    transferred_by,
    institute_id,
    student_name,
    student_admission_no,
    from_batch_name,
    to_batch_name,
    transferred_by_name
  )
  values (
    p_student_id,
    v_old_batch_id,
    p_to_batch_id,
    now(),
    p_reason,
    auth.uid(),
    v_student_inst,
    v_student_name,
    v_student_adm,
    (select name from public.batches where id = v_old_batch_id),
    v_target_batch_name,
    (select full_name from public.profiles where id = auth.uid())
  )
  returning id into v_history_id;

  update public.students
  set batch_id = p_to_batch_id,
      updated_at = now()
  where id = p_student_id;

  return jsonb_build_object(
    'success', true,
    'student_id', p_student_id,
    'from_batch_id', v_old_batch_id,
    'to_batch_id', p_to_batch_id,
    'to_batch_name', v_target_batch_name,
    'history_id', v_history_id
  );
end;
$$;

revoke all on function public.transfer_student_batch(uuid, uuid, text) from public, anon;
grant execute on function public.transfer_student_batch(uuid, uuid, text) to authenticated;

-- --------------------------------------------------------------------
-- 12. Systematic Dynamic Drop of All Legacy Policies
-- --------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in (
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'institutes', 'profiles', 'batches', 'students', 'teachers', 'teacher_batches',
        'parent_students', 'attendance_sessions', 'attendance_records', 'fee_structures',
        'fee_records', 'audit_logs', 'student_batch_history', 'institute_invitations'
      )
  ) loop
    execute format('drop policy if exists %I on %I.%I;', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- --------------------------------------------------------------------
-- 13. Hardened Security Definer Helpers Bound Strictly to auth.uid()
-- --------------------------------------------------------------------
drop function if exists public.is_student_in_batch(uuid, uuid);
drop function if exists public.is_student_in_batch(uuid);
create or replace function public.is_student_in_batch(target_batch_id uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.students
    where profile_id = auth.uid()
      and batch_id = target_batch_id
      and institute_id = public.current_user_institute_id()
      and status = 'active'
  );
$$;

drop function if exists public.is_parent_ward_in_batch(uuid, uuid);
drop function if exists public.is_parent_ward_in_batch(uuid);
create or replace function public.is_parent_ward_in_batch(target_batch_id uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.parent_students ps
    join public.students s on s.id = ps.student_id
    where ps.parent_profile_id = auth.uid()
      and s.batch_id = target_batch_id
      and ps.institute_id = public.current_user_institute_id()
      and s.institute_id = public.current_user_institute_id()
      and s.status = 'active'
      and ps.is_verified = true
  );
$$;

drop function if exists public.is_teacher_assigned_to_batch(uuid, uuid);
drop function if exists public.is_teacher_assigned_to_batch(uuid);
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
      and tb.institute_id = public.current_user_institute_id()
      and t.institute_id = public.current_user_institute_id()
      and t.is_active = true
  );
$$;

drop function if exists public.is_student_owner_of_record(uuid);
create or replace function public.is_student_owner_of_record(target_student_id uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.students
    where id = target_student_id
      and profile_id = auth.uid()
      and institute_id = public.current_user_institute_id()
  );
$$;

drop function if exists public.is_student_linked_to_parent(uuid);
create or replace function public.is_student_linked_to_parent(target_student_id uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.parent_students ps
    where ps.parent_profile_id = auth.uid()
      and ps.student_id = target_student_id
      and ps.institute_id = public.current_user_institute_id()
      and ps.is_verified = true
  );
$$;

drop function if exists public.get_current_teacher_id();
create or replace function public.get_current_teacher_id()
returns uuid language sql stable security definer
set search_path = public
as $$
  select id from public.teachers
  where profile_id = auth.uid()
    and institute_id = public.current_user_institute_id()
    and is_active = true;
$$;

drop function if exists public.is_teacher_assigned_to_student_batch(uuid);
create or replace function public.is_teacher_assigned_to_student_batch(p_teacher_id uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teacher_batches tb
    where tb.teacher_id = p_teacher_id
      and tb.institute_id = public.current_user_institute_id()
      and (
        (public.current_user_role() = 'student' and public.is_student_in_batch(tb.batch_id))
        or (public.current_user_role() = 'parent' and public.is_parent_ward_in_batch(tb.batch_id))
      )
  );
$$;

revoke all on function public.is_student_in_batch(uuid) from public, anon;
grant execute on function public.is_student_in_batch(uuid) to authenticated;

revoke all on function public.is_parent_ward_in_batch(uuid) from public, anon;
grant execute on function public.is_parent_ward_in_batch(uuid) to authenticated;

revoke all on function public.is_teacher_assigned_to_batch(uuid) from public, anon;
grant execute on function public.is_teacher_assigned_to_batch(uuid) to authenticated;

revoke all on function public.is_student_owner_of_record(uuid) from public, anon;
grant execute on function public.is_student_owner_of_record(uuid) to authenticated;

revoke all on function public.is_student_linked_to_parent(uuid) from public, anon;
grant execute on function public.is_student_linked_to_parent(uuid) to authenticated;

revoke all on function public.get_current_teacher_id() from public, anon;
grant execute on function public.get_current_teacher_id() to authenticated;

revoke all on function public.is_teacher_assigned_to_student_batch(uuid) from public, anon;
grant execute on function public.is_teacher_assigned_to_student_batch(uuid) to authenticated;

-- Helper to check if caller is admin in their assigned institute
create or replace function public.is_current_user_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select coalesce(
    public.current_user_role() in ('owner', 'admin')
    and public.current_user_institute_id() is not null,
    false
  );
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer
set search_path = public
as $$
  select coalesce(
    public.current_user_role() in ('owner', 'admin', 'teacher')
    and public.current_user_institute_id() is not null,
    false
  );
$$;

grant execute on function public.is_current_user_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;

-- --------------------------------------------------------------------
-- 14. Systematic Recreation of Hardened Tenant-Scoped RLS Policies
-- --------------------------------------------------------------------

-- Policies for public.institutes
create policy institutes_read on public.institutes
  for select to authenticated
  using (
    id = public.current_user_institute_id()
  );

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

-- Policies for public.institute_invitations
create policy invitations_admin_all on public.institute_invitations
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

-- Policies for public.profiles
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (
      institute_id is not null
      and institute_id = public.current_user_institute_id()
      and public.is_current_user_admin()
    )
  );

create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (
    institute_id is not null
    and institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  )
  with check (
    institute_id is not null
    and institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

create policy profiles_self_update on public.profiles
  for update to authenticated
  using (
    id = auth.uid()
  )
  with check (
    id = auth.uid()
    and institute_id is not distinct from public.current_user_institute_id()
    and role = public.current_user_role()
  );

-- Policies for public.batches
create policy batches_admin_all on public.batches
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

create policy batches_teacher_read on public.batches
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and public.is_teacher_assigned_to_batch(id)
  );

create policy batches_student_parent_read on public.batches
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and (
      (public.current_user_role() = 'student' and public.is_student_in_batch(id))
      or (public.current_user_role() = 'parent' and public.is_parent_ward_in_batch(id))
    )
  );

-- Policies for public.students
create policy students_admin_all on public.students
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

create policy students_teacher_read on public.students
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and batch_id is not null
    and public.is_teacher_assigned_to_batch(batch_id)
  );

create policy students_self_read on public.students
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'student'
    and profile_id = auth.uid()
  );

create policy students_parent_read on public.students
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'parent'
    and public.is_student_linked_to_parent(id)
  );

-- Policies for public.teachers
create policy teachers_admin_all on public.teachers
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

create policy teachers_staff_read on public.teachers
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.is_staff()
  );

create policy teachers_student_parent_read on public.teachers
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('student', 'parent')
    and public.is_teacher_assigned_to_student_batch(id)
  );

-- Policies for public.teacher_batches
create policy teacher_batches_admin_all on public.teacher_batches
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

create policy teacher_batches_teacher_read on public.teacher_batches
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and teacher_id = public.get_current_teacher_id()
  );

-- Policies for public.parent_students
create policy parent_students_admin_all on public.parent_students
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

create policy parent_students_parent_read on public.parent_students
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and parent_profile_id = auth.uid()
  );

create policy parent_students_student_read on public.parent_students
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.is_student_owner_of_record(student_id)
  );

-- Policies for public.attendance_sessions
create policy attendance_sessions_admin_all on public.attendance_sessions
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

create policy attendance_sessions_teacher_read on public.attendance_sessions
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and public.is_teacher_assigned_to_batch(batch_id)
  );

create policy attendance_sessions_teacher_insert on public.attendance_sessions
  for insert to authenticated
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and taken_by = auth.uid()
    and public.is_teacher_assigned_to_batch(batch_id)
  );

create policy attendance_sessions_student_parent_read on public.attendance_sessions
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and (
      (public.current_user_role() = 'student' and public.is_student_in_batch(batch_id))
      or (public.current_user_role() = 'parent' and public.is_parent_ward_in_batch(batch_id))
    )
  );

-- Policies for public.attendance_records
create policy attendance_records_admin_all on public.attendance_records
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

create policy attendance_records_teacher_read on public.attendance_records
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_records.session_id
        and s.institute_id = public.current_user_institute_id()
        and public.is_teacher_assigned_to_batch(s.batch_id)
    )
  );

create policy attendance_records_teacher_insert on public.attendance_records
  for insert to authenticated
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and exists (
      select 1 from public.attendance_sessions s
      join public.students st on st.id = attendance_records.student_id
      where s.id = attendance_records.session_id
        and s.taken_by = auth.uid()
        and s.institute_id = public.current_user_institute_id()
        and st.institute_id = public.current_user_institute_id()
        and public.is_teacher_assigned_to_batch(s.batch_id)
        and st.batch_id = s.batch_id
    )
  );

create policy attendance_records_student_read on public.attendance_records
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'student'
    and public.is_student_owner_of_record(student_id)
  );

create policy attendance_records_parent_read on public.attendance_records
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'parent'
    and public.is_student_linked_to_parent(student_id)
  );

-- Policies for public.fee_structures
create policy fee_structures_admin_all on public.fee_structures
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

create policy fee_structures_read on public.fee_structures
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
  );

-- Policies for public.fee_records
create policy fee_records_admin_all on public.fee_records
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

create policy fee_records_student_read on public.fee_records
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'student'
    and public.is_student_owner_of_record(student_id)
  );

create policy fee_records_parent_read on public.fee_records
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'parent'
    and public.is_student_linked_to_parent(student_id)
  );

-- Policies for public.audit_logs
create policy audit_admin_read on public.audit_logs
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

create policy audit_staff_insert on public.audit_logs
  for insert to authenticated
  with check (
    institute_id = public.current_user_institute_id()
    and public.is_staff()
  );

-- Policies for public.student_batch_history (Genuinely Immutable: Read & Insert Only, No Update/Delete)
create policy batch_history_admin_read on public.student_batch_history
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

create policy batch_history_admin_insert on public.student_batch_history
  for insert to authenticated
  with check (
    institute_id = public.current_user_institute_id()
    and public.is_current_user_admin()
  );

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

create policy batch_history_student_read on public.student_batch_history
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and (
      (student_id is not null and public.is_student_owner_of_record(student_id))
      or (student_id is not null and public.is_student_linked_to_parent(student_id))
    )
  );
