-- ====================================================================
-- Migration: 0007_attendance_management.sql
-- Description: Milestone 3: Daily Attendance Management & Academic Operations
--              1. Teacher update policy on attendance_records for recorded sessions.
--              2. Atomic transactional RPC submit_batch_attendance().
--              3. Attendance analytics helper get_student_attendance_summary().
--              4. Attendance defaulters detection get_batch_attendance_defaulters().
-- Date: 2026-11-20
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Teacher Update Policy on attendance_records
-- --------------------------------------------------------------------
drop policy if exists attendance_records_teacher_update on public.attendance_records;
create policy attendance_records_teacher_update on public.attendance_records
  for update to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_records.session_id
        and s.taken_by = auth.uid()
        and s.institute_id = public.current_user_institute_id()
    )
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_records.session_id
        and s.taken_by = auth.uid()
        and s.institute_id = public.current_user_institute_id()
    )
  );

-- --------------------------------------------------------------------
-- 2. Atomic Batch Attendance Submission RPC
-- --------------------------------------------------------------------
create or replace function public.submit_batch_attendance(
  p_batch_id uuid,
  p_session_date date,
  p_records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_caller_inst uuid;
  v_batch_inst uuid;
  v_batch_name text;
  v_session_id uuid;
  v_rec jsonb;
  v_student_id uuid;
  v_status text;
  v_note text;
  v_student_batch uuid;
  v_student_inst uuid;
  v_total integer := 0;
  v_present integer := 0;
  v_absent integer := 0;
  v_late integer := 0;
  v_leave integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated: Must be logged in to record attendance';
  end if;

  select role::text, institute_id into v_caller_role, v_caller_inst
  from public.profiles
  where id = auth.uid();

  if v_caller_inst is null or v_caller_role not in ('owner', 'admin', 'teacher') then
    raise exception 'Unauthorized: Only institute staff can submit attendance';
  end if;

  select institute_id, name into v_batch_inst, v_batch_name
  from public.batches
  where id = p_batch_id;

  if not found then
    raise exception 'Batch % does not exist', p_batch_id;
  end if;

  if v_batch_inst is distinct from v_caller_inst then
    raise exception 'Unauthorized: Cannot submit attendance for another institute batch';
  end if;

  if v_caller_role = 'teacher' and not public.is_teacher_assigned_to_batch(p_batch_id) then
    raise exception 'Unauthorized: Teacher is not assigned to batch %', v_batch_name;
  end if;

  -- Insert or get existing session
  insert into public.attendance_sessions (batch_id, session_date, taken_by, institute_id)
  values (p_batch_id, p_session_date, auth.uid(), v_caller_inst)
  on conflict (batch_id, session_date)
  do update set taken_by = auth.uid()
  returning id into v_session_id;

  -- Process student records
  for v_rec in select * from jsonb_array_elements(p_records) loop
    v_student_id := (v_rec->>'student_id')::uuid;
    v_status := lower(trim(coalesce(v_rec->>'status', 'present')));
    v_note := nullif(trim(v_rec->>'note'), '');

    if v_status not in ('present', 'absent', 'late', 'leave') then
      raise exception 'Invalid attendance status "%" for student %', v_status, v_student_id;
    end if;

    select batch_id, institute_id into v_student_batch, v_student_inst
    from public.students
    where id = v_student_id;

    if not found or v_student_inst is distinct from v_caller_inst then
      raise exception 'Student % does not belong to this institute', v_student_id;
    end if;

    if v_student_batch is distinct from p_batch_id then
      raise exception 'Student % is not enrolled in target batch %', v_student_id, v_batch_name;
    end if;

    insert into public.attendance_records (session_id, student_id, status, note, marked_at, institute_id)
    values (v_session_id, v_student_id, v_status, v_note, now(), v_caller_inst)
    on conflict (session_id, student_id)
    do update set
      status = excluded.status,
      note = excluded.note,
      marked_at = now();

    v_total := v_total + 1;
    if v_status = 'present' then v_present := v_present + 1;
    elsif v_status = 'absent' then v_absent := v_absent + 1;
    elsif v_status = 'late' then v_late := v_late + 1;
    elsif v_status = 'leave' then v_leave := v_leave + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'batch_id', p_batch_id,
    'session_date', p_session_date,
    'total_marked', v_total,
    'present_count', v_present,
    'absent_count', v_absent,
    'late_count', v_late,
    'leave_count', v_leave
  );
end;
$$;

revoke all on function public.submit_batch_attendance(uuid, date, jsonb) from public, anon;
grant execute on function public.submit_batch_attendance(uuid, date, jsonb) to authenticated;

-- --------------------------------------------------------------------
-- 3. Student Attendance Analytics Helper
-- --------------------------------------------------------------------
create or replace function public.get_student_attendance_summary(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_caller_inst uuid;
  v_student_inst uuid;
  v_student_batch uuid;
  v_total_sessions integer := 0;
  v_attended integer := 0;
  v_absent integer := 0;
  v_late integer := 0;
  v_leave integer := 0;
  v_percentage numeric := 100.0;
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated';
  end if;

  select role::text, institute_id into v_caller_role, v_caller_inst
  from public.profiles
  where id = auth.uid();

  select institute_id, batch_id into v_student_inst, v_student_batch
  from public.students
  where id = p_student_id;

  if not found or v_student_inst is distinct from v_caller_inst then
    raise exception 'Student not found in caller institute';
  end if;

  -- Caller permission check
  if v_caller_role in ('owner', 'admin') or
     (v_caller_role = 'teacher' and public.is_teacher_assigned_to_batch(v_student_batch)) or
     (v_caller_role = 'student' and public.is_student_owner_of_record(p_student_id)) or
     (v_caller_role = 'parent' and public.is_student_linked_to_parent(p_student_id)) then
    -- Allowed
  else
    raise exception 'Unauthorized to view this student attendance summary';
  end if;

  select
    count(*),
    count(*) filter (where status in ('present', 'late')),
    count(*) filter (where status = 'absent'),
    count(*) filter (where status = 'late'),
    count(*) filter (where status = 'leave')
  into v_total_sessions, v_attended, v_absent, v_late, v_leave
  from public.attendance_records
  where student_id = p_student_id
    and institute_id = v_caller_inst;

  if v_total_sessions > 0 then
    v_percentage := round((v_attended::numeric / v_total_sessions::numeric) * 100.0, 1);
  end if;

  return jsonb_build_object(
    'student_id', p_student_id,
    'total_sessions', v_total_sessions,
    'attended_sessions', v_attended,
    'absent_count', v_absent,
    'late_count', v_late,
    'leave_count', v_leave,
    'percentage', v_percentage,
    'is_defaulter', (v_percentage < 75.0 and v_total_sessions >= 5)
  );
end;
$$;

revoke all on function public.get_student_attendance_summary(uuid) from public, anon;
grant execute on function public.get_student_attendance_summary(uuid) to authenticated;

-- --------------------------------------------------------------------
-- 4. Batch Defaulters Detection Helper (< 75% Attendance)
-- --------------------------------------------------------------------
create or replace function public.get_batch_attendance_defaulters(
  p_batch_id uuid,
  p_threshold numeric default 75.0
)
returns table (
  student_id uuid,
  full_name text,
  admission_no text,
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
  v_batch_inst uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated';
  end if;

  select role::text, institute_id into v_caller_role, v_caller_inst
  from public.profiles
  where id = auth.uid();

  select institute_id into v_batch_inst
  from public.batches
  where id = p_batch_id;

  if not found or v_batch_inst is distinct from v_caller_inst then
    raise exception 'Batch not found in caller institute';
  end if;

  if v_caller_role not in ('owner', 'admin') and
     not (v_caller_role = 'teacher' and public.is_teacher_assigned_to_batch(p_batch_id)) then
    raise exception 'Unauthorized to view batch attendance defaulters';
  end if;

  return query
  select
    s.id as student_id,
    s.full_name,
    s.admission_no,
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
  left join public.attendance_records ar on ar.student_id = s.id and ar.institute_id = v_caller_inst
  where s.batch_id = p_batch_id
    and s.institute_id = v_caller_inst
    and s.status = 'active'
  group by s.id, s.full_name, s.admission_no, s.phone, s.parent_phone
  having count(ar.id) > 0
     and round((count(ar.id) filter (where ar.status in ('present', 'late'))::numeric / count(ar.id)::numeric) * 100.0, 1) < p_threshold
  order by attendance_percentage asc;
end;
$$;

revoke all on function public.get_batch_attendance_defaulters(uuid, numeric) from public, anon;
grant execute on function public.get_batch_attendance_defaulters(uuid, numeric) to authenticated;
