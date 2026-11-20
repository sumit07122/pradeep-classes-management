-- ====================================================================
-- Test: verify_milestone4_fees.sql
-- Description: Automated verification of Milestone 4 Fee Management & RPCs
-- ====================================================================

do $$
declare
  v_owner_id uuid := '28fe332f-4814-442d-a797-6833e2472ce3'::uuid;
  v_inst_id uuid := '11111111-2222-3333-4444-555555555555'::uuid;
  v_student_id uuid;
  v_batch_id uuid;
  v_invoice_res jsonb;
  v_record_id uuid;
  v_payment_res jsonb;
  v_summary_res jsonb;
  v_receipt_no text;
  v_ledger_count integer;
begin
  -- 1. Verify function registrations
  assert (select count(*) from pg_proc where proname = 'collect_fee_payment') = 1,
    'FAIL: collect_fee_payment RPC not found';
  assert (select count(*) from pg_proc where proname = 'create_student_fee_invoice') = 1,
    'FAIL: create_student_fee_invoice RPC not found';
  assert (select count(*) from pg_proc where proname = 'get_institute_fee_summary') = 1,
    'FAIL: get_institute_fee_summary RPC not found';
  assert (select count(*) from pg_proc where proname = 'generate_fee_receipt_no') = 1,
    'FAIL: generate_fee_receipt_no function not found';

  raise notice 'PASS: All Milestone 4 fee functions and RPCs exist.';

  -- Set auth context to Owner
  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- 2. Setup Test Data
  v_batch_id := gen_random_uuid();
  insert into public.batches (id, name, course_name, academic_year, max_capacity, institute_id, status)
  values (v_batch_id, 'M4 Test Batch', 'JEE 2026', '2026-2027', 30, v_inst_id, 'active');

  v_student_id := gen_random_uuid();
  insert into public.students (id, admission_no, full_name, class_name, batch_id, institute_id, status)
  values (v_student_id, 'PC-2026-9901', 'Test Fee Student', 'Class 11', v_batch_id, v_inst_id, 'active');

  -- 3. Test Create Fee Invoice
  v_invoice_res := public.create_student_fee_invoice(
    v_student_id,
    'Term 1 Tuition Test',
    30000,
    current_date + 10,
    'Initial enrollment installment'
  );

  assert (v_invoice_res->>'success')::boolean = true, 'FAIL: invoice creation failed';
  v_record_id := (v_invoice_res->>'record_id')::uuid;
  assert v_record_id is not null, 'FAIL: record_id missing from invoice response';
  assert (v_invoice_res->>'amount')::numeric = 30000, 'FAIL: invoice amount mismatch';
  assert (v_invoice_res->>'status') = 'pending', 'FAIL: expected status pending';
  raise notice 'PASS: Student fee invoice created successfully: %', v_invoice_res;

  -- 4. Test Partial Payment Collection (₹12,000 of ₹30,000)
  v_payment_res := public.collect_fee_payment(
    v_record_id,
    12000,
    'upi',
    'UPI/TEST9901',
    'Partial installment paid'
  );

  assert (v_payment_res->>'success')::boolean = true, 'FAIL: partial payment failed';
  assert (v_payment_res->>'amount_paid')::numeric = 12000, 'FAIL: amount_paid mismatch';
  assert (v_payment_res->>'total_paid')::numeric = 12000, 'FAIL: total_paid mismatch';
  assert (v_payment_res->>'balance_due')::numeric = 18000, 'FAIL: balance_due mismatch';
  assert (v_payment_res->>'status') = 'partial', 'FAIL: expected status partial';
  v_receipt_no := v_payment_res->>'receipt_no';
  assert v_receipt_no like 'REC-2026-%', 'FAIL: receipt_no format invalid: %', v_receipt_no;

  -- Verify ledger entry
  select count(*) into v_ledger_count
  from public.fee_payments
  where fee_record_id = v_record_id;
  assert v_ledger_count = 1, 'FAIL: expected 1 fee_payments record';
  raise notice 'PASS: Partial payment recorded with receipt: %', v_receipt_no;

  -- 5. Test Full Balance Settlement (₹18,000 remaining)
  v_payment_res := public.collect_fee_payment(
    v_record_id,
    18000,
    'cash',
    null,
    'Balance settlement in cash'
  );

  assert (v_payment_res->>'success')::boolean = true, 'FAIL: settlement failed';
  assert (v_payment_res->>'total_paid')::numeric = 30000, 'FAIL: total_paid mismatch';
  assert (v_payment_res->>'balance_due')::numeric = 0, 'FAIL: balance_due mismatch';
  assert (v_payment_res->>'status') = 'paid', 'FAIL: expected status paid';

  -- Verify ledger entry count is now 2
  select count(*) into v_ledger_count
  from public.fee_payments
  where fee_record_id = v_record_id;
  assert v_ledger_count = 2, 'FAIL: expected 2 fee_payments records';
  raise notice 'PASS: Full payment settled successfully with 2 ledger transactions.';

  -- 6. Test Overpayment Protection (Cannot pay when balance is 0)
  begin
    perform public.collect_fee_payment(
      v_record_id,
      500,
      'cash'
    );
    raise exception 'FAIL: Overpayment was permitted!';
  exception when others then
    if sqlerrm like '%FAIL%' then raise; end if;
    raise notice 'PASS: Overpayment correctly rejected with message: %', sqlerrm;
  end;

  -- 7. Test Financial Summary Helper
  v_summary_res := public.get_institute_fee_summary();
  assert (v_summary_res->>'total_billed')::numeric >= 30000, 'FAIL: total_billed mismatch';
  assert (v_summary_res->>'total_collected')::numeric >= 30000, 'FAIL: total_collected mismatch';
  raise notice 'PASS: Institute fee summary computed: %', v_summary_res;

  -- 8. Rollback cleanly
  raise exception 'ROLLBACK_TEST_TRANSACTION_SUCCESS';
exception when others then
  if sqlerrm = 'ROLLBACK_TEST_TRANSACTION_SUCCESS' then
    raise notice 'SUCCESS: All Milestone 4 Fee assertions passed cleanly and test transaction rolled back.';
  else
    raise;
  end if;
end;
$$;
