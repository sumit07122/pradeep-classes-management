-- ============================================================================
-- Migration 0010: Student Roll Number, Attendance Defaulters RPC & Schema Hardening
-- Institute: Pradeep Classes
-- Description:
--   1. Adds optional roll_no column to public.students for class-level roll numbering.
--   2. Adds public.get_institute_attendance_defaulters RPC for Owner/Admin analytics.
--   3. Relaxes homework.description NOT NULL constraint to allow optional descriptions.
--   4. Adds backwards-compatible columns (message, target_role, batch_id) and sync trigger to announcements.
--   5. Sets single-tenant default institute_id across all public relational tables.
-- ============================================================================

-- 1. Student Roll Number Column
alter table public.students add column if not exists roll_no text;

-- 2. Institute Attendance Defaulters Analytics RPC
create or replace function public.get_institute_attendance_defaulters(
  p_threshold numeric default 75.0
)
returns table (
  student_id uuid,
  full_name text,
  admission_no text,
  batch_name text,
  phone text,
  parent_phone text,
  total_sessions bigint,
  attended_sessions bigint,
  absent_count bigint,
  attendance_percentage numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_caller_inst uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated';
  end if;

  select role::text, institute_id into v_caller_role, v_caller_inst
  from public.profiles
  where id = auth.uid();

  if v_caller_inst is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Unauthorized to view institute attendance defaulters';
  end if;

  return query
  select
    s.id as student_id,
    s.full_name,
    s.admission_no,
    coalesce(b.name, 'Unassigned')::text as batch_name,
    s.phone,
    s.parent_phone,
    count(ar.id) as total_sessions,
    count(ar.id) filter (where ar.status in ('present', 'late')) as attended_sessions,
    count(ar.id) filter (where ar.status = 'absent') as absent_count,
    case
      when count(ar.id) = 0 then 100.0
      else round((count(ar.id) filter (where ar.status in ('present', 'late'))::numeric / count(ar.id)::numeric) * 100.0, 1)
    end as attendance_percentage
  from public.students s
  left join public.batches b on b.id = s.batch_id
  left join public.attendance_records ar on ar.student_id = s.id and ar.institute_id = v_caller_inst
  where s.institute_id = v_caller_inst
    and s.status = 'active'
  group by s.id, s.full_name, s.admission_no, b.name, s.phone, s.parent_phone
  having count(ar.id) > 0
     and round((count(ar.id) filter (where ar.status in ('present', 'late'))::numeric / count(ar.id)::numeric) * 100.0, 1) < p_threshold
  order by attendance_percentage asc;
end;
$$;

revoke all on function public.get_institute_attendance_defaulters(numeric) from public, anon;
grant execute on function public.get_institute_attendance_defaulters(numeric) to authenticated;

-- 3. Relax Homework Description Constraint
alter table public.homework alter column description drop not null;

-- 4. Announcements Compatibility Columns & Bi-directional Sync Trigger
alter table public.announcements 
  add column if not exists message text,
  add column if not exists target_role text,
  add column if not exists batch_id uuid;

create or replace function public.fn_sync_announcements_columns()
returns trigger
language plpgsql
as $$
begin
  -- Sync content <-> message
  if NEW.message is not null and (NEW.content is null or NEW.content = '') then
    NEW.content := NEW.message;
  elsif NEW.content is not null and (NEW.message is null or NEW.message = '') then
    NEW.message := NEW.content;
  end if;

  if NEW.content is null then
    NEW.content := coalesce(NEW.message, '');
  end if;
  if NEW.message is null then
    NEW.message := NEW.content;
  end if;

  -- Sync target_type <-> target_role
  if NEW.target_role is not null and (NEW.target_type is null or NEW.target_type = '') then
    NEW.target_type := case 
      when NEW.target_role in ('students', 'faculty', 'staff') then 'all'
      else NEW.target_role
    end;
  elsif NEW.target_type is not null and (NEW.target_role is null or NEW.target_role = '') then
    NEW.target_role := NEW.target_type;
  end if;

  if NEW.target_type is null then
    NEW.target_type := 'all';
  end if;
  if NEW.target_role is null then
    NEW.target_role := NEW.target_type;
  end if;

  if NEW.target_type not in ('all', 'batch', 'staff') then
    NEW.target_type := 'all';
  end if;

  if NEW.priority not in ('normal', 'urgent', 'announcement') then
    if NEW.priority = 'high' then
      NEW.priority := 'urgent';
    else
      NEW.priority := 'normal';
    end if;
  end if;

  -- Sync target_batch_id <-> batch_id
  if NEW.batch_id is not null and NEW.target_batch_id is null then
    NEW.target_batch_id := NEW.batch_id;
  elsif NEW.target_batch_id is not null and NEW.batch_id is null then
    NEW.batch_id := NEW.target_batch_id;
  end if;

  return NEW;
end;
$$;

create trigger trg_sync_announcements_columns
before insert or update on public.announcements
for each row
execute function public.fn_sync_announcements_columns();

-- 5. Set Single-Tenant Default institute_id
alter table public.whatsapp_settings alter column institute_id set default '11111111-2222-3333-4444-555555555555'::uuid;
alter table public.whatsapp_message_queue alter column institute_id set default '11111111-2222-3333-4444-555555555555'::uuid;
alter table public.exams alter column institute_id set default '11111111-2222-3333-4444-555555555555'::uuid;
alter table public.exam_marks alter column institute_id set default '11111111-2222-3333-4444-555555555555'::uuid;
alter table public.homework alter column institute_id set default '11111111-2222-3333-4444-555555555555'::uuid;
alter table public.study_materials alter column institute_id set default '11111111-2222-3333-4444-555555555555'::uuid;
alter table public.announcements alter column institute_id set default '11111111-2222-3333-4444-555555555555'::uuid;
alter table public.timetables alter column institute_id set default '11111111-2222-3333-4444-555555555555'::uuid;
alter table public.institute_settings alter column institute_id set default '11111111-2222-3333-4444-555555555555'::uuid;
