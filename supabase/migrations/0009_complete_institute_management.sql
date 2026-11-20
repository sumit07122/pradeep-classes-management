-- ====================================================================
-- Migration: 0009_complete_institute_management.sql
-- Description: Comprehensive Institute Operations & Academic Management
--              1. Financial ledger immutability trigger & reversal support.
--              2. Unique invoice numbering vs installment receipt sequence.
--              3. Attendance 48h teacher edit window.
--              4. WhatsApp settings & automated message queue infrastructure.
--              5. Automatic student WhatsApp attendance notification trigger.
--              6. Exams, tests, marks entry, grades & report cards.
--              7. Homework, assignments & study materials.
--              8. Timetables & schedule conflict detection.
--              9. Announcements & institute notices.
--             10. Institute settings & academic preferences.
--             11. Tenant-isolated RLS policies for all new tables.
-- Date: 2026-11-20
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Financial Ledger Immutability & Reversals
-- --------------------------------------------------------------------
alter table public.fee_payments
  add column if not exists is_reversal boolean not null default false,
  add column if not exists reversal_ref_id uuid references public.fee_payments(id) on delete restrict,
  add column if not exists reversal_reason text;

-- Sequence for invoice numbers
create sequence if not exists public.fee_invoice_seq start with 1001;

alter table public.fee_records
  add column if not exists invoice_no text;

-- Populate invoice numbers for existing records
update public.fee_records
set invoice_no = 'INV-' || to_char(created_at, 'YYYY') || '-' || lpad(id::text, 4, '0')
where invoice_no is null;

-- Trigger to prevent UPDATE or DELETE on fee_payments ledger
create or replace function public.fn_prevent_payment_ledger_tampering()
returns trigger
language plpgsql
as $$
begin
  if current_setting('institute.internal_reversal_in_progress', true) = 'true' then
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Payment ledger entries are immutable and cannot be deleted. Use reverse_fee_payment() to issue a formal reversal transaction.';
  end if;

  if tg_op = 'UPDATE' then
    raise exception 'Payment ledger entries are immutable and cannot be modified. Record adjustments through offsetting reversal transactions.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_payment_ledger_tampering on public.fee_payments;
create trigger trg_prevent_payment_ledger_tampering
  before update or delete on public.fee_payments
  for each row execute function public.fn_prevent_payment_ledger_tampering();

-- Updated collect_fee_payment to guarantee unique receipts per installment
create or replace function public.collect_fee_payment(
  p_record_id uuid,
  p_amount numeric,
  p_payment_mode text,
  p_transaction_ref text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_caller_inst uuid;
  v_rec record;
  v_new_paid numeric;
  v_new_status text;
  v_receipt_no text;
  v_payment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated: Must be logged in to record fee payments';
  end if;

  select role::text, institute_id into v_caller_role, v_caller_inst
  from public.profiles
  where id = auth.uid();

  if v_caller_inst is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Unauthorized: Only institute owners and admins can collect fee payments';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  if p_payment_mode not in ('cash', 'upi', 'cheque', 'bank_transfer', 'card') then
    raise exception 'Invalid payment mode: %', p_payment_mode;
  end if;

  -- Lock record for update (Row-level lock)
  select * into v_rec
  from public.fee_records
  where id = p_record_id
  for update;

  if not found then
    raise exception 'Fee record % not found', p_record_id;
  end if;

  if v_rec.institute_id is distinct from v_caller_inst then
    raise exception 'Unauthorized: Fee record belongs to another institute';
  end if;

  if v_rec.paid_amount + p_amount > v_rec.amount then
    raise exception 'Payment of ₹% exceeds remaining balance of ₹%',
      p_amount, (v_rec.amount - v_rec.paid_amount);
  end if;

  v_new_paid := v_rec.paid_amount + p_amount;
  if v_new_paid >= v_rec.amount then
    v_new_status := 'paid';
  else
    v_new_status := 'partial';
  end if;

  -- Generate a UNIQUE receipt number for every payment event
  v_receipt_no := public.generate_fee_receipt_no();

  -- Insert payment ledger row
  insert into public.fee_payments (
    fee_record_id,
    student_id,
    amount,
    payment_mode,
    transaction_ref,
    receipt_no,
    notes,
    collected_by,
    institute_id,
    payment_date
  ) values (
    p_record_id,
    v_rec.student_id,
    p_amount,
    p_payment_mode,
    nullif(trim(p_transaction_ref), ''),
    v_receipt_no,
    nullif(trim(p_notes), ''),
    auth.uid(),
    v_caller_inst,
    current_date
  ) returning id into v_payment_id;

  -- Update fee record balance & keep latest receipt
  update public.fee_records
  set
    paid_amount = v_new_paid,
    status = v_new_status,
    payment_mode = p_payment_mode,
    transaction_ref = coalesce(nullif(trim(p_transaction_ref), ''), transaction_ref),
    collected_by = auth.uid(),
    receipt_no = v_receipt_no,
    updated_at = now()
  where id = p_record_id;

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'receipt_no', v_receipt_no,
    'amount_collected', p_amount,
    'total_paid', v_new_paid,
    'balance_due', v_rec.amount - v_new_paid,
    'status', v_new_status
  );
end;
$$;

-- Atomic Payment Reversal RPC
create or replace function public.reverse_fee_payment(
  p_payment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_caller_inst uuid;
  v_pay record;
  v_rec record;
  v_new_paid numeric;
  v_new_status text;
  v_reversal_id uuid;
  v_reversal_receipt text;
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated';
  end if;

  select role::text, institute_id into v_caller_role, v_caller_inst
  from public.profiles
  where id = auth.uid();

  if v_caller_inst is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Unauthorized: Only institute owners and admins can reverse fee payments';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'A valid reversal reason of at least 5 characters is mandatory';
  end if;

  -- Lock target payment row
  select * into v_pay
  from public.fee_payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment record % not found', p_payment_id;
  end if;

  if v_pay.institute_id is distinct from v_caller_inst then
    raise exception 'Unauthorized: Payment record belongs to another institute';
  end if;

  if v_pay.is_reversal then
    raise exception 'Cannot reverse an existing reversal transaction';
  end if;

  -- Check if already reversed
  if exists (
    select 1 from public.fee_payments
    where reversal_ref_id = p_payment_id and is_reversal = true
  ) then
    raise exception 'This payment has already been reversed';
  end if;

  -- Lock parent invoice
  select * into v_rec
  from public.fee_records
  where id = v_pay.fee_record_id
  for update;

  v_new_paid := greatest(0, v_rec.paid_amount - v_pay.amount);
  if v_new_paid = 0 then
    v_new_status := case when v_rec.due_date < current_date then 'overdue' else 'pending' end;
  else
    v_new_status := 'partial';
  end if;

  v_reversal_receipt := 'REV-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.fee_receipt_seq')::text, 4, '0');

  -- Insert offsetting reversal record
  insert into public.fee_payments (
    fee_record_id,
    student_id,
    amount,
    payment_mode,
    transaction_ref,
    receipt_no,
    notes,
    collected_by,
    institute_id,
    payment_date,
    is_reversal,
    reversal_ref_id,
    reversal_reason
  ) values (
    v_rec.id,
    v_pay.student_id,
    -v_pay.amount,
    v_pay.payment_mode,
    'REV/' || v_pay.receipt_no,
    v_reversal_receipt,
    trim(p_reason),
    auth.uid(),
    v_caller_inst,
    current_date,
    true,
    v_pay.id,
    trim(p_reason)
  ) returning id into v_reversal_id;

  -- Update fee record
  update public.fee_records
  set
    paid_amount = v_new_paid,
    status = v_new_status,
    updated_at = now()
  where id = v_rec.id;

  -- Record in audit log
  insert into public.audit_logs (
    actor_id,
    action,
    table_name,
    record_id,
    before_data,
    after_data,
    institute_id
  ) values (
    auth.uid(),
    'PAYMENT_REVERSAL',
    'fee_payments',
    p_payment_id,
    jsonb_build_object('amount', v_pay.amount, 'receipt_no', v_pay.receipt_no),
    jsonb_build_object('reversal_id', v_reversal_id, 'reason', p_reason, 'adjusted_balance', v_rec.amount - v_new_paid),
    v_caller_inst
  );

  return jsonb_build_object(
    'success', true,
    'reversal_id', v_reversal_id,
    'reversal_receipt', v_reversal_receipt,
    'reversed_amount', v_pay.amount,
    'new_paid_total', v_new_paid,
    'new_status', v_new_status
  );
end;
$$;

revoke all on function public.reverse_fee_payment(uuid, text) from public, anon;
grant execute on function public.reverse_fee_payment(uuid, text) to authenticated;

-- Updated create_student_fee_invoice to generate INV-YYYY-XXXX invoice numbers
create or replace function public.create_student_fee_invoice(
  p_student_id uuid,
  p_title text,
  p_amount numeric,
  p_due_date date,
  p_notes text default null,
  p_fee_structure_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_caller_inst uuid;
  v_student_inst uuid;
  v_record_id uuid;
  v_invoice_no text;
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated: Must be logged in to create invoices';
  end if;

  select role::text, institute_id into v_caller_role, v_caller_inst
  from public.profiles
  where id = auth.uid();

  if v_caller_inst is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Unauthorized: Only institute owners and admins can create fee invoices';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Invoice amount must be greater than zero';
  end if;

  if p_due_date is null then
    raise exception 'Due date is required';
  end if;

  select institute_id into v_student_inst
  from public.students
  where id = p_student_id;

  if not found or v_student_inst is distinct from v_caller_inst then
    raise exception 'Student not found in caller institute';
  end if;

  v_invoice_no := 'INV-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.fee_invoice_seq')::text, 4, '0');

  insert into public.fee_records (
    student_id,
    title,
    invoice_no,
    amount,
    paid_amount,
    discount_amount,
    status,
    due_date,
    notes,
    fee_structure_id,
    institute_id
  ) values (
    p_student_id,
    coalesce(nullif(trim(p_title), ''), 'Tuition Fee'),
    v_invoice_no,
    p_amount,
    0,
    0,
    case when p_due_date < current_date then 'overdue' else 'pending' end,
    p_due_date,
    p_notes,
    p_fee_structure_id,
    v_caller_inst
  ) returning id into v_record_id;

  return jsonb_build_object(
    'success', true,
    'record_id', v_record_id,
    'invoice_no', v_invoice_no,
    'student_id', p_student_id,
    'amount', p_amount,
    'due_date', p_due_date,
    'status', case when p_due_date < current_date then 'overdue' else 'pending' end
  );
end;
$$;

-- --------------------------------------------------------------------
-- 2. Attendance 48h Modification Window for Teachers
-- --------------------------------------------------------------------
drop policy if exists attendance_records_teacher_update on public.attendance_records;
create policy attendance_records_teacher_update on public.attendance_records
  for update to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and (
      public.current_user_role() in ('owner', 'admin')
      or (
        public.current_user_role() = 'teacher'
        and exists (
          select 1 from public.attendance_sessions s
          where s.id = attendance_records.session_id
            and s.taken_by = auth.uid()
            and s.institute_id = public.current_user_institute_id()
            and s.session_date >= (current_date - interval '2 days')::date
            and public.is_teacher_assigned_to_batch(s.batch_id)
        )
      )
    )
  )
  with check (
    institute_id = public.current_user_institute_id()
    and (
      public.current_user_role() in ('owner', 'admin')
      or (
        public.current_user_role() = 'teacher'
        and exists (
          select 1 from public.attendance_sessions s
          where s.id = attendance_records.session_id
            and s.taken_by = auth.uid()
            and s.institute_id = public.current_user_institute_id()
            and s.session_date >= (current_date - interval '2 days')::date
            and public.is_teacher_assigned_to_batch(s.batch_id)
        )
      )
    )
  );

-- --------------------------------------------------------------------
-- 3. WhatsApp Integration & Automated Message Queue
-- --------------------------------------------------------------------
create table if not exists public.whatsapp_settings (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade unique,
  provider text not null default 'meta_cloud_api' check (provider in ('meta_cloud_api', 'twilio', 'gupshup')),
  phone_number_id text,
  business_account_id text,
  api_token text,
  sender_phone_number text,
  is_enabled boolean not null default false,
  notify_on_present boolean not null default true,
  notify_on_absent boolean not null default true,
  notify_on_late boolean not null default true,
  notify_on_leave boolean not null default true,
  template_present text not null default 'attendance_present',
  template_absent text not null default 'attendance_absent',
  template_late text not null default 'attendance_late',
  template_leave text not null default 'attendance_leave',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_settings enable row level security;

create policy whatsapp_settings_admin_all on public.whatsapp_settings
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  );

-- Seed default WhatsApp settings for Pradeep Classes
insert into public.whatsapp_settings (institute_id, is_enabled)
values ('11111111-2222-3333-4444-555555555555', false)
on conflict (institute_id) do nothing;

create table if not exists public.whatsapp_message_queue (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  recipient_phone text not null,
  recipient_name text not null,
  event_type text not null check (event_type in ('attendance_present', 'attendance_absent', 'attendance_late', 'attendance_leave', 'fee_receipt', 'announcement', 'test_message')),
  template_name text not null,
  message_body text not null,
  parameters jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  provider_response_id text,
  error_message text,
  sent_at timestamptz,
  reference_id uuid,
  created_at timestamptz not null default now()
);

alter table public.whatsapp_message_queue enable row level security;

create index if not exists idx_whatsapp_queue_status on public.whatsapp_message_queue(institute_id, status);
create index if not exists idx_whatsapp_queue_ref on public.whatsapp_message_queue(reference_id, event_type);

create policy whatsapp_queue_admin_all on public.whatsapp_message_queue
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  );

-- Function to queue WhatsApp attendance notification for a student
create or replace function public.queue_attendance_whatsapp_notification(
  p_session_id uuid,
  p_student_id uuid,
  p_status text,
  p_session_date date,
  p_batch_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student record;
  v_settings record;
  v_event_type text;
  v_template text;
  v_body text;
  v_clean_phone text;
  v_existing_id uuid;
begin
  select s.institute_id, s.full_name, s.phone into v_student
  from public.students s
  where s.id = p_student_id;

  if not found or v_student.phone is null or length(trim(v_student.phone)) < 10 then
    return;
  end if;

  -- Clean phone (digits only)
  v_clean_phone := regexp_replace(v_student.phone, '\D', '', 'g');
  if length(v_clean_phone) = 10 then
    v_clean_phone := '91' || v_clean_phone;
  end if;

  select * into v_settings
  from public.whatsapp_settings
  where institute_id = v_student.institute_id;

  if not found then
    return;
  end if;

  if p_status = 'present' and not coalesce(v_settings.notify_on_present, true) then return; end if;
  if p_status = 'absent' and not coalesce(v_settings.notify_on_absent, true) then return; end if;
  if p_status = 'late' and not coalesce(v_settings.notify_on_late, true) then return; end if;
  if p_status = 'leave' and not coalesce(v_settings.notify_on_leave, true) then return; end if;

  v_event_type := 'attendance_' || p_status;

  case p_status
    when 'present' then
      v_template := coalesce(v_settings.template_present, 'attendance_present');
      v_body := 'Hello ' || v_student.full_name || ', your attendance at Pradeep Classes has been marked PRESENT for ' || to_char(p_session_date, 'DD Mon YYYY') || '. Batch: ' || p_batch_name || '.';
    when 'absent' then
      v_template := coalesce(v_settings.template_absent, 'attendance_absent');
      v_body := 'Hello ' || v_student.full_name || ', your attendance at Pradeep Classes has been marked ABSENT for ' || to_char(p_session_date, 'DD Mon YYYY') || '. Batch: ' || p_batch_name || '. Please contact the institute if this is incorrect.';
    when 'late' then
      v_template := coalesce(v_settings.template_late, 'attendance_late');
      v_body := 'Hello ' || v_student.full_name || ', your attendance at Pradeep Classes has been marked LATE for ' || to_char(p_session_date, 'DD Mon YYYY') || '.';
    when 'leave' then
      v_template := coalesce(v_settings.template_leave, 'attendance_leave');
      v_body := 'Hello ' || v_student.full_name || ', your attendance at Pradeep Classes has been marked as LEAVE for ' || to_char(p_session_date, 'DD Mon YYYY') || '.';
    else
      return;
  end case;

  -- Check if identical message already queued
  select id into v_existing_id
  from public.whatsapp_message_queue
  where reference_id = p_session_id
    and student_id = p_student_id
    and event_type = v_event_type
    and status in ('pending', 'sent')
  limit 1;

  if v_existing_id is not null then
    return; -- Avoid duplicate dispatch
  end if;

  -- Cancel any previous conflicting notification for this session (e.g. absent was changed to present)
  update public.whatsapp_message_queue
  set status = 'cancelled'
  where reference_id = p_session_id
    and student_id = p_student_id
    and status = 'pending'
    and event_type != v_event_type;

  -- Enqueue notification
  insert into public.whatsapp_message_queue (
    institute_id,
    student_id,
    recipient_phone,
    recipient_name,
    event_type,
    template_name,
    message_body,
    parameters,
    reference_id,
    status
  ) values (
    v_student.institute_id,
    p_student_id,
    v_clean_phone,
    v_student.full_name,
    v_event_type,
    v_template,
    v_body,
    jsonb_build_object(
      'student_name', v_student.full_name,
      'date', to_char(p_session_date, 'DD Mon YYYY'),
      'batch_name', p_batch_name,
      'status', upper(p_status)
    ),
    p_session_id,
    'pending'
  );
end;
$$;

-- Upgrade submit_batch_attendance to automatically trigger WhatsApp queue
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
      raise exception 'Student % is enrolled in batch %, not batch %', v_student_id, v_student_batch, p_batch_id;
    end if;

    insert into public.attendance_records (session_id, student_id, status, note, institute_id)
    values (v_session_id, v_student_id, v_status, v_note, v_caller_inst)
    on conflict (session_id, student_id)
    do update set
      status = excluded.status,
      note = excluded.note,
      updated_at = now();

    -- Enqueue WhatsApp Attendance Notification
    perform public.queue_attendance_whatsapp_notification(
      v_session_id,
      v_student_id,
      v_status,
      p_session_date,
      v_batch_name
    );

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
    'total_marked', v_total,
    'present', v_present,
    'absent', v_absent,
    'late', v_late,
    'leave', v_leave
  );
end;
$$;

-- --------------------------------------------------------------------
-- 4. Examinations & Academic Assessment Schema
-- --------------------------------------------------------------------
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  title text not null,
  subject text not null,
  exam_type text not null default 'weekly_test' check (exam_type in ('weekly_test', 'unit_test', 'mock_exam', 'term_exam', 'board_practice')),
  exam_date date not null,
  start_time time,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  total_marks numeric not null check (total_marks > 0),
  passing_marks numeric not null check (passing_marks >= 0 and passing_marks <= total_marks),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'completed', 'published')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exams enable row level security;
create index if not exists idx_exams_batch on public.exams(batch_id);
create index if not exists idx_exams_institute on public.exams(institute_id);

create policy exams_admin_all on public.exams
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  );

create policy exams_teacher_manage on public.exams
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and public.is_teacher_assigned_to_batch(batch_id)
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and public.is_teacher_assigned_to_batch(batch_id)
  );

create policy exams_student_read on public.exams
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'student'
    and status in ('scheduled', 'completed', 'published')
    and public.is_student_in_batch(batch_id)
  );

create table if not exists public.exam_marks (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  marks_obtained numeric check (marks_obtained is null or (marks_obtained >= 0)),
  is_absent boolean not null default false,
  percentage numeric check (percentage is null or (percentage >= 0 and percentage <= 100)),
  grade text,
  rank_in_batch integer,
  remarks text,
  entered_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id)
);

alter table public.exam_marks enable row level security;
create index if not exists idx_exam_marks_exam on public.exam_marks(exam_id);
create index if not exists idx_exam_marks_student on public.exam_marks(student_id);

create policy exam_marks_admin_all on public.exam_marks
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  );

create policy exam_marks_teacher_manage on public.exam_marks
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and exists (
      select 1 from public.exams e
      where e.id = exam_marks.exam_id
        and e.institute_id = public.current_user_institute_id()
        and public.is_teacher_assigned_to_batch(e.batch_id)
    )
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and exists (
      select 1 from public.exams e
      where e.id = exam_marks.exam_id
        and e.institute_id = public.current_user_institute_id()
        and public.is_teacher_assigned_to_batch(e.batch_id)
    )
  );

create policy exam_marks_student_read on public.exam_marks
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'student'
    and public.is_student_owner_of_record(student_id)
    and exists (
      select 1 from public.exams e
      where e.id = exam_marks.exam_id
        and e.status = 'published'
    )
  );

-- RPC: Submit Marks & Auto-Calculate Grades & Rankings
create or replace function public.submit_exam_marks(
  p_exam_id uuid,
  p_marks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_caller_inst uuid;
  v_exam record;
  v_rec jsonb;
  v_student_id uuid;
  v_marks_val numeric;
  v_is_absent boolean;
  v_remarks text;
  v_pct numeric;
  v_grade text;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated';
  end if;

  select role::text, institute_id into v_caller_role, v_caller_inst
  from public.profiles
  where id = auth.uid();

  select * into v_exam
  from public.exams
  where id = p_exam_id;

  if not found or v_exam.institute_id is distinct from v_caller_inst then
    raise exception 'Exam not found';
  end if;

  if v_caller_role not in ('owner', 'admin') and
     not (v_caller_role = 'teacher' and public.is_teacher_assigned_to_batch(v_exam.batch_id)) then
    raise exception 'Unauthorized to enter marks for this exam';
  end if;

  for v_rec in select * from jsonb_array_elements(p_marks) loop
    v_student_id := (v_rec->>'student_id')::uuid;
    v_is_absent := coalesce((v_rec->>'is_absent')::boolean, false);
    v_remarks := nullif(trim(v_rec->>'remarks'), '');

    if v_is_absent then
      v_marks_val := null;
      v_pct := null;
      v_grade := 'AB';
    else
      v_marks_val := (v_rec->>'marks_obtained')::numeric;
      if v_marks_val is null or v_marks_val < 0 or v_marks_val > v_exam.total_marks then
        raise exception 'Invalid marks % for student % (Max: %)', v_marks_val, v_student_id, v_exam.total_marks;
      end if;
      v_pct := round((v_marks_val / v_exam.total_marks) * 100.0, 1);
      if v_pct >= 90 then v_grade := 'A+';
      elsif v_pct >= 80 then v_grade := 'A';
      elsif v_pct >= 70 then v_grade := 'B';
      elsif v_pct >= 60 then v_grade := 'C';
      elsif v_pct >= 40 then v_grade := 'D';
      else v_grade := 'F';
      end if;
    end if;

    insert into public.exam_marks (
      institute_id,
      exam_id,
      student_id,
      marks_obtained,
      is_absent,
      percentage,
      grade,
      remarks,
      entered_by,
      updated_at
    ) values (
      v_caller_inst,
      p_exam_id,
      v_student_id,
      v_marks_val,
      v_is_absent,
      v_pct,
      v_grade,
      v_remarks,
      auth.uid(),
      now()
    ) on conflict (exam_id, student_id)
    do update set
      marks_obtained = excluded.marks_obtained,
      is_absent = excluded.is_absent,
      percentage = excluded.percentage,
      grade = excluded.grade,
      remarks = excluded.remarks,
      entered_by = auth.uid(),
      updated_at = now();

    v_count := v_count + 1;
  end loop;

  -- Rank students descending by marks
  with ranked as (
    select id, dense_rank() over (order by marks_obtained desc nulls last) as rnk
    from public.exam_marks
    where exam_id = p_exam_id and is_absent = false
  )
  update public.exam_marks m
  set rank_in_batch = ranked.rnk
  from ranked
  where m.id = ranked.id;

  update public.exams
  set status = 'completed', updated_at = now()
  where id = p_exam_id and status = 'scheduled';

  return jsonb_build_object('success', true, 'total_marked', v_count);
end;
$$;

revoke all on function public.submit_exam_marks(uuid, jsonb) from public, anon;
grant execute on function public.submit_exam_marks(uuid, jsonb) to authenticated;

-- RPC: Publish Exam Results
create or replace function public.publish_exam_results(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_caller_inst uuid;
  v_exam record;
begin
  if auth.uid() is null then raise exception 'Unauthenticated'; end if;

  select role::text, institute_id into v_caller_role, v_caller_inst
  from public.profiles where id = auth.uid();

  select * into v_exam from public.exams where id = p_exam_id;
  if not found or v_exam.institute_id is distinct from v_caller_inst then
    raise exception 'Exam not found';
  end if;

  if v_caller_role not in ('owner', 'admin') and
     not (v_caller_role = 'teacher' and public.is_teacher_assigned_to_batch(v_exam.batch_id)) then
    raise exception 'Unauthorized to publish results';
  end if;

  update public.exams
  set status = 'published', updated_at = now()
  where id = p_exam_id;

  -- Audit log
  insert into public.audit_logs (actor_id, action, table_name, record_id, after_data, institute_id)
  values (auth.uid(), 'PUBLISH_EXAM_RESULTS', 'exams', p_exam_id, jsonb_build_object('title', v_exam.title), v_caller_inst);

  return jsonb_build_object('success', true, 'status', 'published');
end;
$$;

revoke all on function public.publish_exam_results(uuid) from public, anon;
grant execute on function public.publish_exam_results(uuid) to authenticated;

-- --------------------------------------------------------------------
-- 5. Homework & Study Materials Schema
-- --------------------------------------------------------------------
create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  title text not null,
  subject text not null,
  description text not null,
  due_date date not null,
  attachment_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.homework enable row level security;
create index if not exists idx_homework_batch on public.homework(batch_id);

create policy homework_admin_all on public.homework
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  );

create policy homework_teacher_manage on public.homework
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and public.is_teacher_assigned_to_batch(batch_id)
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and public.is_teacher_assigned_to_batch(batch_id)
  );

create policy homework_student_read on public.homework
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'student'
    and public.is_student_in_batch(batch_id)
  );

create table if not exists public.study_materials (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete cascade,
  course_name text not null,
  subject text not null,
  title text not null,
  description text,
  file_url text not null,
  file_name text not null,
  file_size_kb numeric,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.study_materials enable row level security;

create policy study_materials_admin_all on public.study_materials
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  );

create policy study_materials_teacher_all on public.study_materials
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and (batch_id is null or public.is_teacher_assigned_to_batch(batch_id))
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and (batch_id is null or public.is_teacher_assigned_to_batch(batch_id))
  );

create policy study_materials_student_read on public.study_materials
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'student'
    and (
      batch_id is null
      or public.is_student_in_batch(batch_id)
    )
  );

-- --------------------------------------------------------------------
-- 6. Timetables & Schedules Schema + Conflict Detection Trigger
-- --------------------------------------------------------------------
create table if not exists public.timetables (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete set null,
  subject text not null,
  day_of_week text not null check (day_of_week in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  room_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.timetables enable row level security;

create policy timetables_admin_all on public.timetables
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  );

create policy timetables_teacher_read on public.timetables
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
  );

create policy timetables_student_read on public.timetables
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'student'
    and public.is_student_in_batch(batch_id)
  );

-- Trigger: Conflict Detection for Timetables
create or replace function public.fn_check_timetable_conflicts()
returns trigger
language plpgsql
as $$
declare
  v_conflict_batch text;
begin
  if not new.is_active then
    return new;
  end if;

  -- 1. Check Teacher conflict
  if new.teacher_id is not null then
    select b.name into v_conflict_batch
    from public.timetables t
    join public.batches b on b.id = t.batch_id
    where t.id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and t.institute_id = new.institute_id
      and t.teacher_id = new.teacher_id
      and t.day_of_week = new.day_of_week
      and t.is_active = true
      and (new.start_time, new.end_time) overlaps (t.start_time, t.end_time)
    limit 1;

    if v_conflict_batch is not null then
      raise exception 'Teacher scheduling conflict: Teacher is already scheduled for batch "%" on % between % and %',
        v_conflict_batch, new.day_of_week, new.start_time, new.end_time;
    end if;
  end if;

  -- 2. Check Room conflict
  if new.room_number is not null and trim(new.room_number) != '' then
    select b.name into v_conflict_batch
    from public.timetables t
    join public.batches b on b.id = t.batch_id
    where t.id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and t.institute_id = new.institute_id
      and lower(trim(t.room_number)) = lower(trim(new.room_number))
      and t.day_of_week = new.day_of_week
      and t.is_active = true
      and (new.start_time, new.end_time) overlaps (t.start_time, t.end_time)
    limit 1;

    if v_conflict_batch is not null then
      raise exception 'Classroom conflict: Room "%" is already occupied by batch "%" on % between % and %',
        new.room_number, v_conflict_batch, new.day_of_week, new.start_time, new.end_time;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_timetable_conflicts on public.timetables;
create trigger trg_check_timetable_conflicts
  before insert or update on public.timetables
  for each row execute function public.fn_check_timetable_conflicts();

-- --------------------------------------------------------------------
-- 7. Announcements Schema
-- --------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  title text not null,
  content text not null,
  target_type text not null default 'all' check (target_type in ('all', 'batch', 'staff')),
  target_batch_id uuid references public.batches(id) on delete cascade,
  priority text not null default 'normal' check (priority in ('normal', 'urgent', 'announcement')),
  is_pinned boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;
create index if not exists idx_announcements_institute on public.announcements(institute_id);

create policy announcements_admin_all on public.announcements
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  );

create policy announcements_teacher_read on public.announcements
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'teacher'
    and (
      target_type in ('all', 'staff')
      or (target_type = 'batch' and public.is_teacher_assigned_to_batch(target_batch_id))
    )
  );

create policy announcements_student_read on public.announcements
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'student'
    and (
      target_type = 'all'
      or (target_type = 'batch' and public.is_student_in_batch(target_batch_id))
    )
  );

-- --------------------------------------------------------------------
-- 8. Institute Settings Schema
-- --------------------------------------------------------------------
create table if not exists public.institute_settings (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade unique,
  tagline text not null default 'Excellence in Coaching & Board Preparations',
  address text not null default '101, Vidya Complex, Near Station Road',
  city text not null default 'Mumbai',
  phone text not null default '+91 98200 12345',
  email text not null default 'contact@pradeepclasses.in',
  website text not null default 'https://pradeepclasses.in',
  current_academic_year text not null default '2026-2027',
  attendance_threshold numeric not null default 75.0,
  grading_scale jsonb not null default '[{"grade":"A+","min":90},{"grade":"A","min":80},{"grade":"B","min":70},{"grade":"C","min":60},{"grade":"D","min":40},{"grade":"F","min":0}]'::jsonb,
  invoice_prefix text not null default 'INV',
  receipt_prefix text not null default 'REC',
  terms_and_conditions text default 'Fees once paid are non-refundable. Minimum 75% attendance is required to appear for institute test series.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.institute_settings enable row level security;

create policy institute_settings_admin_all on public.institute_settings
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  );

create policy institute_settings_member_read on public.institute_settings
  for select to authenticated
  using (institute_id = public.current_user_institute_id());

-- Seed default settings for Pradeep Classes
insert into public.institute_settings (institute_id)
values ('11111111-2222-3333-4444-555555555555')
on conflict (institute_id) do nothing;
