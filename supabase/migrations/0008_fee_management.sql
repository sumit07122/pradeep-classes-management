-- ====================================================================
-- Migration: 0008_fee_management.sql
-- Description: Milestone 4: Fee Management & Financial Operations
--              1. Schema enhancements on fee_records.
--              2. Payment ledger table fee_payments for installments & audit.
--              3. Receipt number sequence & generator function.
--              4. Atomic payment collection RPC collect_fee_payment().
--              5. Student invoice creation RPC create_student_fee_invoice().
--              6. Institute financial summary helper get_institute_fee_summary().
--              7. Multi-tenant RLS policies on fee_payments & fee_records.
-- Date: 2026-11-20
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Schema Enhancements on fee_records
-- --------------------------------------------------------------------
alter table public.fee_records
  add column if not exists title text not null default 'Tuition Fee',
  add column if not exists fee_structure_id uuid references public.fee_structures(id) on delete set null,
  add column if not exists paid_amount numeric not null default 0 check (paid_amount >= 0),
  add column if not exists discount_amount numeric not null default 0 check (discount_amount >= 0),
  add column if not exists payment_mode text check (payment_mode is null or payment_mode in ('cash', 'upi', 'cheque', 'bank_transfer', 'card')),
  add column if not exists transaction_ref text,
  add column if not exists collected_by uuid references public.profiles(id) on delete set null;

-- Sync existing paid records if any exist
update public.fee_records
set paid_amount = amount
where status = 'paid' and paid_amount = 0;

-- --------------------------------------------------------------------
-- 2. Fee Payments Ledger Table
-- --------------------------------------------------------------------
create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  fee_record_id uuid not null references public.fee_records(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payment_mode text not null check (payment_mode in ('cash', 'upi', 'cheque', 'bank_transfer', 'card')),
  transaction_ref text,
  receipt_no text not null,
  notes text,
  collected_by uuid references public.profiles(id) on delete set null,
  institute_id uuid not null references public.institutes(id) on delete restrict,
  payment_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.fee_payments enable row level security;

create index if not exists idx_fee_payments_record on public.fee_payments(fee_record_id);
create index if not exists idx_fee_payments_student on public.fee_payments(student_id);
create index if not exists idx_fee_payments_institute on public.fee_payments(institute_id);
create index if not exists idx_fee_payments_receipt on public.fee_payments(receipt_no);

-- --------------------------------------------------------------------
-- 3. Atomic Receipt Number Generator
-- --------------------------------------------------------------------
create sequence if not exists public.fee_receipt_seq start with 1001;

create or replace function public.generate_fee_receipt_no()
returns text
language plpgsql
as $$
declare
  v_seq bigint;
  v_year text;
begin
  select nextval('public.fee_receipt_seq') into v_seq;
  v_year := to_char(current_date, 'YYYY');
  return 'REC-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- --------------------------------------------------------------------
-- 4. Atomic Payment Collection RPC
-- --------------------------------------------------------------------
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

  -- Lock record for update
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

  v_new_paid := coalesce(v_rec.paid_amount, 0) + p_amount;
  if v_new_paid > v_rec.amount then
    raise exception 'Payment of ₹% exceeds remaining balance of ₹%', p_amount, (v_rec.amount - coalesce(v_rec.paid_amount, 0));
  end if;

  if v_new_paid >= v_rec.amount then
    v_new_status := 'paid';
  else
    v_new_status := 'partial';
  end if;

  -- Generate receipt number
  v_receipt_no := coalesce(v_rec.receipt_no, public.generate_fee_receipt_no());

  -- Update fee record
  update public.fee_records
  set
    paid_amount = v_new_paid,
    status = v_new_status,
    paid_date = case when v_new_status = 'paid' then current_date else paid_date end,
    receipt_no = v_receipt_no,
    payment_mode = p_payment_mode,
    transaction_ref = coalesce(p_transaction_ref, transaction_ref),
    collected_by = auth.uid(),
    notes = case
      when p_notes is not null and length(trim(p_notes)) > 0
      then coalesce(notes || E'\n', '') || '[' || current_date::text || '] ' || trim(p_notes)
      else notes
    end,
    updated_at = now()
  where id = p_record_id;

  -- Insert into payment ledger
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
    p_transaction_ref,
    v_receipt_no,
    p_notes,
    auth.uid(),
    v_caller_inst,
    current_date
  ) returning id into v_payment_id;

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'record_id', p_record_id,
    'student_id', v_rec.student_id,
    'amount_paid', p_amount,
    'total_paid', v_new_paid,
    'total_amount', v_rec.amount,
    'balance_due', (v_rec.amount - v_new_paid),
    'status', v_new_status,
    'receipt_no', v_receipt_no,
    'payment_mode', p_payment_mode,
    'payment_date', current_date
  );
end;
$$;

revoke all on function public.collect_fee_payment(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.collect_fee_payment(uuid, numeric, text, text, text) to authenticated;

-- --------------------------------------------------------------------
-- 5. Student Invoice Creation RPC
-- --------------------------------------------------------------------
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
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated';
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

  insert into public.fee_records (
    student_id,
    title,
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
    'student_id', p_student_id,
    'amount', p_amount,
    'due_date', p_due_date,
    'status', case when p_due_date < current_date then 'overdue' else 'pending' end
  );
end;
$$;

revoke all on function public.create_student_fee_invoice(uuid, text, numeric, date, text, uuid) from public, anon;
grant execute on function public.create_student_fee_invoice(uuid, text, numeric, date, text, uuid) to authenticated;

-- --------------------------------------------------------------------
-- 6. Institute Financial Summary Helper RPC
-- --------------------------------------------------------------------
create or replace function public.get_institute_fee_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_caller_inst uuid;
  v_total_billed numeric := 0;
  v_total_collected numeric := 0;
  v_total_pending numeric := 0;
  v_overdue_count integer := 0;
  v_pending_students integer := 0;
  v_collection_pct numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated';
  end if;

  select role::text, institute_id into v_caller_role, v_caller_inst
  from public.profiles
  where id = auth.uid();

  if v_caller_inst is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Unauthorized';
  end if;

  select
    coalesce(sum(amount), 0),
    coalesce(sum(paid_amount), 0),
    coalesce(sum(amount - paid_amount), 0),
    count(*) filter (where status = 'overdue' or (status = 'pending' and due_date < current_date)),
    count(distinct student_id) filter (where status in ('pending', 'partial', 'overdue'))
  into
    v_total_billed,
    v_total_collected,
    v_total_pending,
    v_overdue_count,
    v_pending_students
  from public.fee_records
  where institute_id = v_caller_inst;

  if v_total_billed > 0 then
    v_collection_pct := round((v_total_collected / v_total_billed) * 100.0, 1);
  end if;

  return jsonb_build_object(
    'total_billed', v_total_billed,
    'total_collected', v_total_collected,
    'total_pending', v_total_pending,
    'collection_percentage', v_collection_pct,
    'overdue_invoices_count', v_overdue_count,
    'pending_students_count', v_pending_students
  );
end;
$$;

revoke all on function public.get_institute_fee_summary() from public, anon;
grant execute on function public.get_institute_fee_summary() to authenticated;

-- --------------------------------------------------------------------
-- 7. Multi-Tenant RLS Policies for fee_payments
-- --------------------------------------------------------------------
drop policy if exists fee_payments_admin_all on public.fee_payments;
create policy fee_payments_admin_all on public.fee_payments
  for all to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  )
  with check (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() in ('owner', 'admin')
  );

drop policy if exists fee_payments_student_read on public.fee_payments;
create policy fee_payments_student_read on public.fee_payments
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'student'
    and public.is_student_owner_of_record(student_id)
  );

drop policy if exists fee_payments_parent_read on public.fee_payments;
create policy fee_payments_parent_read on public.fee_payments
  for select to authenticated
  using (
    institute_id = public.current_user_institute_id()
    and public.current_user_role() = 'parent'
    and public.is_student_linked_to_parent(student_id)
  );
