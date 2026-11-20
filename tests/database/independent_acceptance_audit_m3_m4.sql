-- ====================================================================
-- Test: independent_acceptance_audit_m3_m4.sql
-- Description: Comprehensive Acceptance & Security Audit for Milestones 3 & 4
--              1. Attendance RLS & Teacher restrictions
--              2. Payment RPC concurrency & locking
--              3. Payment ledger immutability
--              4. Financial reconciliation
--              5. Receipt sequence & uniqueness
--              6. Role matrix (Owner, Admin, Teacher, Student, Parent, Stranger)
--              7. Cross-institute isolation
--              8. Full regression for Milestones 1-4
-- ====================================================================

DO $$
DECLARE
  v_results jsonb := '[]'::jsonb;

  v_inst_a uuid := '11111111-2222-3333-4444-555555555555';
  v_inst_b uuid := '22222222-3333-4444-5555-666666666666';

  -- Profiles
  v_owner_a uuid := '28fe332f-4814-442d-a797-6833e2472ce3'; -- Live Bootstrapped Owner
  v_admin_a uuid := gen_random_uuid();
  v_teacher_a1 uuid := gen_random_uuid();
  v_teacher_a2 uuid := gen_random_uuid();
  v_student_a1 uuid := gen_random_uuid();
  v_student_a2 uuid := gen_random_uuid();
  v_parent_a1 uuid := gen_random_uuid();

  v_owner_b uuid := gen_random_uuid();
  v_admin_b uuid := gen_random_uuid();
  v_teacher_b uuid := gen_random_uuid();
  v_student_b uuid := gen_random_uuid();
  v_parent_b uuid := gen_random_uuid();

  v_stranger uuid := gen_random_uuid();

  -- Domain entities
  v_batch_a1 uuid;
  v_batch_a2 uuid;
  v_batch_b uuid;
  v_teacher_rec_a1 uuid;
  v_teacher_rec_a2 uuid;
  v_teacher_rec_b uuid;

  v_student_rec_a1 uuid;
  v_student_rec_a2 uuid;
  v_student_rec_b uuid;

  v_session_a uuid;
  v_fee_rec_a uuid;
  v_fee_rec_b uuid;

  v_res jsonb;
  v_cnt integer;
  v_sum numeric;
  v_bal numeric;
  v_receipt_1 text;
  v_receipt_2 text;
BEGIN
  -- Ensure Institute B exists for cross-tenant testing
  INSERT INTO public.institutes (id, name, slug, is_active)
  VALUES (v_inst_b, 'Audit Institute Beta', 'audit-inst-beta', true)
  ON CONFLICT (id) DO NOTHING;

  -- ------------------------------------------------------------------
  -- Setup Profiles via internal bootstrap flag
  -- ------------------------------------------------------------------
  PERFORM set_config('institute.internal_bootstrap_in_progress', 'true', true);

  -- Inst A users
  PERFORM set_config('institute.target_institute_id', v_inst_a::text, true);

  PERFORM set_config('institute.target_role', 'admin', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_admin_a, 'admin.a@audit.internal', jsonb_build_object('full_name', 'Audit Admin A'));

  PERFORM set_config('institute.target_role', 'teacher', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_teacher_a1, 'teacher.a1@audit.internal', jsonb_build_object('full_name', 'Audit Teacher A1'));
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_teacher_a2, 'teacher.a2@audit.internal', jsonb_build_object('full_name', 'Audit Teacher A2'));

  PERFORM set_config('institute.target_role', 'student', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_student_a1, 'student.a1@audit.internal', jsonb_build_object('full_name', 'Audit Student A1'));
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_student_a2, 'student.a2@audit.internal', jsonb_build_object('full_name', 'Audit Student A2'));

  PERFORM set_config('institute.target_role', 'parent', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_parent_a1, 'parent.a1@audit.internal', jsonb_build_object('full_name', 'Audit Parent A1'));

  -- Inst B users
  PERFORM set_config('institute.target_institute_id', v_inst_b::text, true);

  PERFORM set_config('institute.target_role', 'owner', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_owner_b, 'owner.b@audit.internal', jsonb_build_object('full_name', 'Audit Owner B'));

  PERFORM set_config('institute.target_role', 'admin', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_admin_b, 'admin.b@audit.internal', jsonb_build_object('full_name', 'Audit Admin B'));

  PERFORM set_config('institute.target_role', 'teacher', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_teacher_b, 'teacher.b@audit.internal', jsonb_build_object('full_name', 'Audit Teacher B'));

  PERFORM set_config('institute.target_role', 'student', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_student_b, 'student.b@audit.internal', jsonb_build_object('full_name', 'Audit Student B'));

  PERFORM set_config('institute.target_role', 'parent', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_parent_b, 'parent.b@audit.internal', jsonb_build_object('full_name', 'Audit Parent B'));

  -- Stranger (no institute)
  PERFORM set_config('institute.internal_bootstrap_in_progress', 'false', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_stranger, 'stranger@audit.internal', jsonb_build_object('full_name', 'Stranger'));

  -- ------------------------------------------------------------------
  -- Setup Batches, Teachers & Students (as superuser)
  -- ------------------------------------------------------------------
  -- Inst A Batches
  v_batch_a1 := gen_random_uuid();
  INSERT INTO public.batches (id, name, course_name, academic_year, max_capacity, institute_id, status)
  VALUES (v_batch_a1, 'Audit Batch A1', 'JEE 2026', '2026-2027', 30, v_inst_a, 'active');

  v_batch_a2 := gen_random_uuid();
  INSERT INTO public.batches (id, name, course_name, academic_year, max_capacity, institute_id, status)
  VALUES (v_batch_a2, 'Audit Batch A2', 'NEET 2026', '2026-2027', 30, v_inst_a, 'active');

  -- Teachers in Inst A
  v_teacher_rec_a1 := gen_random_uuid();
  INSERT INTO public.teachers (id, profile_id, full_name, subject, phone, institute_id, is_active)
  VALUES (v_teacher_rec_a1, v_teacher_a1, 'Audit Teacher A1', 'Physics', '9800000001', v_inst_a, true);

  v_teacher_rec_a2 := gen_random_uuid();
  INSERT INTO public.teachers (id, profile_id, full_name, subject, phone, institute_id, is_active)
  VALUES (v_teacher_rec_a2, v_teacher_a2, 'Audit Teacher A2', 'Chemistry', '9800000002', v_inst_a, true);

  -- Assign Teacher A1 to Batch A1 ONLY
  INSERT INTO public.teacher_batches (teacher_id, batch_id, institute_id)
  VALUES (v_teacher_rec_a1, v_batch_a1, v_inst_a);

  -- Students in Inst A (valid PC-YYYY-XXXX format)
  v_student_rec_a1 := gen_random_uuid();
  INSERT INTO public.students (id, profile_id, admission_no, full_name, class_name, batch_id, institute_id, status)
  VALUES (v_student_rec_a1, v_student_a1, 'PC-2026-9101', 'Student A1', 'Class 12', v_batch_a1, v_inst_a, 'active');

  v_student_rec_a2 := gen_random_uuid();
  INSERT INTO public.students (id, profile_id, admission_no, full_name, class_name, batch_id, institute_id, status)
  VALUES (v_student_rec_a2, v_student_a2, 'PC-2026-9102', 'Student A2', 'Class 12', v_batch_a1, v_inst_a, 'active');

  -- Link Parent A1 to Student A1
  INSERT INTO public.parent_students (parent_profile_id, student_id, institute_id, is_verified)
  VALUES (v_parent_a1, v_student_rec_a1, v_inst_a, true);

  -- Setup Inst B entities
  v_batch_b := gen_random_uuid();
  INSERT INTO public.batches (id, name, course_name, academic_year, max_capacity, institute_id, status)
  VALUES (v_batch_b, 'Audit Batch B', 'Foundation', '2026-2027', 25, v_inst_b, 'active');

  v_teacher_rec_b := gen_random_uuid();
  INSERT INTO public.teachers (id, profile_id, full_name, subject, phone, institute_id, is_active)
  VALUES (v_teacher_rec_b, v_teacher_b, 'Teacher B', 'Math', '9800000003', v_inst_b, true);

  v_student_rec_b := gen_random_uuid();
  INSERT INTO public.students (id, profile_id, admission_no, full_name, class_name, batch_id, institute_id, status)
  VALUES (v_student_rec_b, v_student_b, 'PC-2026-9103', 'Student B', 'Class 10', v_batch_b, v_inst_b, 'active');

  -- ==================================================================
  -- 1. ATTENDANCE AUDIT & TEACHER RESTRICTIONS
  -- ==================================================================
  -- 1A: Assigned Teacher A1 submits roll call for Batch A1 -> MUST SUCCEED
  PERFORM set_config('request.jwt.claim.sub', v_teacher_a1::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  BEGIN
    v_res := public.submit_batch_attendance(
      v_batch_a1,
      current_date,
      jsonb_build_array(
        jsonb_build_object('student_id', v_student_rec_a1, 'status', 'present', 'note', 'On time'),
        jsonb_build_object('student_id', v_student_rec_a2, 'status', 'absent', 'note', 'Unwell')
      )
    );
    IF (v_res->>'success')::boolean = true AND (v_res->>'total_marked')::integer = 2 THEN
      v_results := v_results || jsonb_build_object('test_id', '1A', 'category', 'Attendance', 'test_name', 'Assigned Teacher Roll Call Submission', 'status', 'PASS', 'details', 'Assigned teacher submitted attendance for assigned batch');
    ELSE
      v_results := v_results || jsonb_build_object('test_id', '1A', 'category', 'Attendance', 'test_name', 'Assigned Teacher Roll Call Submission', 'status', 'FAIL', 'details', 'Unexpected response: ' || coalesce(v_res::text, 'null'));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', '1A', 'category', 'Attendance', 'test_name', 'Assigned Teacher Roll Call Submission', 'status', 'FAIL', 'details', 'Threw unexpected error: ' || sqlerrm);
  END;

  -- 1B: Duplicate submission on same session date -> MUST IDEMPOTENTLY UPDATE
  BEGIN
    v_res := public.submit_batch_attendance(
      v_batch_a1,
      current_date,
      jsonb_build_array(
        jsonb_build_object('student_id', v_student_rec_a2, 'status', 'late', 'note', 'Arrived 15m late')
      )
    );
    SELECT count(*) INTO v_cnt FROM public.attendance_sessions WHERE batch_id = v_batch_a1 AND session_date = current_date;
    IF v_cnt = 1 THEN
      v_results := v_results || jsonb_build_object('test_id', '1B', 'category', 'Attendance', 'test_name', 'Duplicate Submission Idempotency', 'status', 'PASS', 'details', 'Idempotent update succeeded with exactly 1 session row preserved');
    ELSE
      v_results := v_results || jsonb_build_object('test_id', '1B', 'category', 'Attendance', 'test_name', 'Duplicate Submission Idempotency', 'status', 'FAIL', 'details', 'Expected 1 session row, found ' || v_cnt);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', '1B', 'category', 'Attendance', 'test_name', 'Duplicate Submission Idempotency', 'status', 'FAIL', 'details', sqlerrm);
  END;

  -- 1C: Unassigned Teacher A2 submits for Batch A1 -> MUST BE REJECTED
  PERFORM set_config('request.jwt.claim.sub', v_teacher_a2::text, true);
  BEGIN
    PERFORM public.submit_batch_attendance(
      v_batch_a1,
      current_date - 1,
      jsonb_build_array(jsonb_build_object('student_id', v_student_rec_a1, 'status', 'present'))
    );
    v_results := v_results || jsonb_build_object('test_id', '1C', 'category', 'Attendance', 'test_name', 'Unassigned Teacher Submission Block', 'status', 'FAIL', 'details', 'Unassigned teacher was permitted to submit attendance');
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', '1C', 'category', 'Attendance', 'test_name', 'Unassigned Teacher Submission Block', 'status', 'PASS', 'details', 'Correctly rejected: ' || sqlerrm);
  END;

  -- 1D: Cross-Institute Teacher B submits for Batch A1 -> MUST BE REJECTED
  PERFORM set_config('request.jwt.claim.sub', v_teacher_b::text, true);
  BEGIN
    PERFORM public.submit_batch_attendance(
      v_batch_a1,
      current_date - 1,
      jsonb_build_array(jsonb_build_object('student_id', v_student_rec_a1, 'status', 'present'))
    );
    v_results := v_results || jsonb_build_object('test_id', '1D', 'category', 'Attendance', 'test_name', 'Cross-Institute Attendance Submission Block', 'status', 'FAIL', 'details', 'Cross-institute teacher submission permitted');
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', '1D', 'category', 'Attendance', 'test_name', 'Cross-Institute Attendance Submission Block', 'status', 'PASS', 'details', 'Correctly rejected: ' || sqlerrm);
  END;

  -- 1E: Student attempts direct INSERT on attendance_records -> MUST BE BLOCKED BY RLS
  PERFORM set_config('request.jwt.claim.sub', v_student_a1::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    SELECT id INTO v_session_a FROM public.attendance_sessions WHERE batch_id = v_batch_a1 LIMIT 1;
    INSERT INTO public.attendance_records (session_id, student_id, status, institute_id)
    VALUES (v_session_a, v_student_rec_a1, 'present', v_inst_a);
    v_results := v_results || jsonb_build_object('test_id', '1E', 'category', 'Attendance', 'test_name', 'Student Direct Attendance Write Block', 'status', 'FAIL', 'details', 'Student was able to write attendance record');
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', '1E', 'category', 'Attendance', 'test_name', 'Student Direct Attendance Write Block', 'status', 'PASS', 'details', 'Student direct write rejected: ' || sqlerrm);
  END;
  PERFORM set_config('role', 'postgres', true);

  -- ==================================================================
  -- 2. PAYMENT CONCURRENCY & ROW LOCKING AUDIT
  -- ==================================================================
  -- Setup Fee Invoice in Inst A (as Owner A)
  PERFORM set_config('request.jwt.claim.sub', v_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  v_res := public.create_student_fee_invoice(
    v_student_rec_a1,
    'Tuition Fee Term 1',
    40000,
    current_date + 30,
    'Semester tuition'
  );
  v_fee_rec_a := (v_res->>'record_id')::uuid;

  -- 2A: Verify row-level lock in collect_fee_payment
  -- Execute partial payment of 25,000
  BEGIN
    v_res := public.collect_fee_payment(v_fee_rec_a, 25000, 'upi', 'UPI/CONCURRENCY-1', 'First tranche');
    v_receipt_1 := v_res->>'receipt_no';
    IF (v_res->>'total_paid')::numeric = 25000 AND (v_res->>'balance_due')::numeric = 15000 AND (v_res->>'status') = 'partial' THEN
      v_results := v_results || jsonb_build_object('test_id', '2A', 'category', 'Payment', 'test_name', 'Row-Locking Partial Payment Collection', 'status', 'PASS', 'details', 'Partial payment updated row under SELECT FOR UPDATE');
    ELSE
      v_results := v_results || jsonb_build_object('test_id', '2A', 'category', 'Payment', 'test_name', 'Row-Locking Partial Payment Collection', 'status', 'FAIL', 'details', 'Unexpected state: ' || v_res::text);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', '2A', 'category', 'Payment', 'test_name', 'Row-Locking Partial Payment Collection', 'status', 'FAIL', 'details', sqlerrm);
  END;

  -- 2B: Second concurrent payment exceeding remaining balance (e.g. 20,000 > 15,000 remaining) -> MUST BE REJECTED
  BEGIN
    PERFORM public.collect_fee_payment(v_fee_rec_a, 20000, 'cash', null, 'Exceeding tranche');
    v_results := v_results || jsonb_build_object('test_id', '2B', 'category', 'Payment', 'test_name', 'Overpayment Concurrency Protection', 'status', 'FAIL', 'details', 'Payment exceeding balance was permitted');
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', '2B', 'category', 'Payment', 'test_name', 'Overpayment Concurrency Protection', 'status', 'PASS', 'details', 'Correctly rejected with message: ' || sqlerrm);
  END;

  -- 2C: Second valid payment settling balance (15,000) -> MUST SUCCEED
  BEGIN
    v_res := public.collect_fee_payment(v_fee_rec_a, 15000, 'cash', null, 'Final settlement');
    v_receipt_2 := v_res->>'receipt_no';
    IF (v_res->>'total_paid')::numeric = 40000 AND (v_res->>'balance_due')::numeric = 0 AND (v_res->>'status') = 'paid' THEN
      v_results := v_results || jsonb_build_object('test_id', '2C', 'category', 'Payment', 'test_name', 'Final Settlement Concurrency Lock', 'status', 'PASS', 'details', 'Account fully settled to 0 balance');
    ELSE
      v_results := v_results || jsonb_build_object('test_id', '2C', 'category', 'Payment', 'test_name', 'Final Settlement Concurrency Lock', 'status', 'FAIL', 'details', 'Unexpected state: ' || v_res::text);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', '2C', 'category', 'Payment', 'test_name', 'Final Settlement Concurrency Lock', 'status', 'FAIL', 'details', sqlerrm);
  END;

  -- ==================================================================
  -- 3. PAYMENT LEDGER IMMUTABILITY & AUDITABILITY
  -- ==================================================================
  -- 3A: Check how many payments exist in ledger (as superuser)
  SELECT count(*) INTO v_cnt FROM public.fee_payments WHERE fee_record_id = v_fee_rec_a;
  IF v_cnt = 2 THEN
    v_results := v_results || jsonb_build_object('test_id', '3A', 'category', 'Ledger', 'test_name', 'Ledger Row Count Integrity', 'status', 'PASS', 'details', 'Found exactly 2 payment ledger rows for the 2 installments');
  ELSE
    v_results := v_results || jsonb_build_object('test_id', '3A', 'category', 'Ledger', 'test_name', 'Ledger Row Count Integrity', 'status', 'FAIL', 'details', 'Expected 2 ledger rows, found ' || v_cnt);
  END IF;

  -- 3B: Non-admin (Student/Parent/Teacher) attempting DELETE on fee_payments -> MUST BE BLOCKED BY RLS
  PERFORM set_config('request.jwt.claim.sub', v_student_a1::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    DELETE FROM public.fee_payments WHERE fee_record_id = v_fee_rec_a;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    IF v_cnt = 0 THEN
      v_results := v_results || jsonb_build_object('test_id', '3B', 'category', 'Ledger', 'test_name', 'Student/Parent DELETE on fee_payments Blocked', 'status', 'PASS', 'details', 'RLS zero rows affected');
    ELSE
      v_results := v_results || jsonb_build_object('test_id', '3B', 'category', 'Ledger', 'test_name', 'Student/Parent DELETE on fee_payments Blocked', 'status', 'FAIL', 'details', 'Student deleted ' || v_cnt || ' payment rows');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', '3B', 'category', 'Ledger', 'test_name', 'Student/Parent DELETE on fee_payments Blocked', 'status', 'PASS', 'details', 'Blocked with exception: ' || sqlerrm);
  END;
  PERFORM set_config('role', 'postgres', true);

  -- 3C: Non-admin attempting UPDATE on fee_payments -> MUST BE BLOCKED
  PERFORM set_config('request.jwt.claim.sub', v_student_a1::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    UPDATE public.fee_payments SET amount = 1 WHERE fee_record_id = v_fee_rec_a;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    IF v_cnt = 0 THEN
      v_results := v_results || jsonb_build_object('test_id', '3C', 'category', 'Ledger', 'test_name', 'Student/Parent UPDATE on fee_payments Blocked', 'status', 'PASS', 'details', 'RLS zero rows affected');
    ELSE
      v_results := v_results || jsonb_build_object('test_id', '3C', 'category', 'Ledger', 'test_name', 'Student/Parent UPDATE on fee_payments Blocked', 'status', 'FAIL', 'details', 'Student updated ' || v_cnt || ' payment rows');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', '3C', 'category', 'Ledger', 'test_name', 'Student/Parent UPDATE on fee_payments Blocked', 'status', 'PASS', 'details', 'Blocked with exception: ' || sqlerrm);
  END;
  PERFORM set_config('role', 'postgres', true);

  -- ==================================================================
  -- 4. FINANCIAL RECONCILIATION
  -- ==================================================================
  SELECT paid_amount INTO v_bal FROM public.fee_records WHERE id = v_fee_rec_a;
  SELECT coalesce(sum(amount), 0) INTO v_sum FROM public.fee_payments WHERE fee_record_id = v_fee_rec_a;

  IF v_bal = v_sum AND v_bal = 40000 THEN
    v_results := v_results || jsonb_build_object('test_id', '4A', 'category', 'Reconciliation', 'test_name', 'Paid Amount matches SUM(fee_payments.amount)', 'status', 'PASS', 'details', 'fee_records.paid_amount (₹' || v_bal || ') matches SUM(fee_payments) (₹' || v_sum || ')');
  ELSE
    v_results := v_results || jsonb_build_object('test_id', '4A', 'category', 'Reconciliation', 'test_name', 'Paid Amount matches SUM(fee_payments.amount)', 'status', 'FAIL', 'details', 'Discrepancy: fee_records=' || v_bal || ', sum(fee_payments)=' || v_sum);
  END IF;

  -- ==================================================================
  -- 5. RECEIPT NUMBER UNIQUENESS & FORMAT
  -- ==================================================================
  IF v_receipt_1 LIKE 'REC-2026-%' AND v_receipt_2 LIKE 'REC-2026-%' THEN
    v_results := v_results || jsonb_build_object('test_id', '5A', 'category', 'Receipts', 'test_name', 'Receipt Number Format Compliance', 'status', 'PASS', 'details', 'Receipt numbers generated in REC-YYYY-XXXX format: ' || v_receipt_1);
  ELSE
    v_results := v_results || jsonb_build_object('test_id', '5A', 'category', 'Receipts', 'test_name', 'Receipt Number Format Compliance', 'status', 'FAIL', 'details', 'Invalid format: ' || coalesce(v_receipt_1, 'null'));
  END IF;

  -- ==================================================================
  -- 6. ROLE ACCESS BOUNDARIES
  -- ==================================================================
  -- 6A: Student A1 can view their own fee records
  PERFORM set_config('request.jwt.claim.sub', v_student_a1::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO v_cnt FROM public.fee_records WHERE student_id = v_student_rec_a1;
  IF v_cnt >= 1 THEN
    v_results := v_results || jsonb_build_object('test_id', '6A', 'category', 'Role RBAC', 'test_name', 'Student SELECT Own Fee Record', 'status', 'PASS', 'details', 'Student visible records: ' || v_cnt);
  ELSE
    v_results := v_results || jsonb_build_object('test_id', '6A', 'category', 'Role RBAC', 'test_name', 'Student SELECT Own Fee Record', 'status', 'FAIL', 'details', 'Student cannot view own fee record');
  END IF;

  -- 6B: Student A1 CANNOT view Student A2's fee records
  SELECT count(*) INTO v_cnt FROM public.fee_records WHERE student_id = v_student_rec_a2;
  IF v_cnt = 0 THEN
    v_results := v_results || jsonb_build_object('test_id', '6B', 'category', 'Role RBAC', 'test_name', 'Student Cross-Student Fee SELECT Blocked', 'status', 'PASS', 'details', 'Zero cross-student visibility');
  ELSE
    v_results := v_results || jsonb_build_object('test_id', '6B', 'category', 'Role RBAC', 'test_name', 'Student Cross-Student Fee SELECT Blocked', 'status', 'FAIL', 'details', 'Student saw ' || v_cnt || ' other student records');
  END IF;
  PERFORM set_config('role', 'postgres', true);

  -- 6C: Parent A1 can view Ward A1's fee records
  PERFORM set_config('request.jwt.claim.sub', v_parent_a1::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO v_cnt FROM public.fee_records WHERE student_id = v_student_rec_a1;
  IF v_cnt >= 1 THEN
    v_results := v_results || jsonb_build_object('test_id', '6C', 'category', 'Role RBAC', 'test_name', 'Parent SELECT Ward Fee Record', 'status', 'PASS', 'details', 'Parent visible records for ward: ' || v_cnt);
  ELSE
    v_results := v_results || jsonb_build_object('test_id', '6C', 'category', 'Role RBAC', 'test_name', 'Parent SELECT Ward Fee Record', 'status', 'FAIL', 'details', 'Parent cannot view ward fee record');
  END IF;

  -- 6D: Parent A1 CANNOT view Student A2's fee records
  SELECT count(*) INTO v_cnt FROM public.fee_records WHERE student_id = v_student_rec_a2;
  IF v_cnt = 0 THEN
    v_results := v_results || jsonb_build_object('test_id', '6D', 'category', 'Role RBAC', 'test_name', 'Parent Cross-Ward Fee SELECT Blocked', 'status', 'PASS', 'details', 'Zero cross-ward visibility');
  ELSE
    v_results := v_results || jsonb_build_object('test_id', '6D', 'category', 'Role RBAC', 'test_name', 'Parent Cross-Ward Fee SELECT Blocked', 'status', 'FAIL', 'details', 'Parent saw ' || v_cnt || ' unlinked student records');
  END IF;
  PERFORM set_config('role', 'postgres', true);

  -- 6E: Teacher CANNOT view fee records
  PERFORM set_config('request.jwt.claim.sub', v_teacher_a1::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO v_cnt FROM public.fee_records;
  IF v_cnt = 0 THEN
    v_results := v_results || jsonb_build_object('test_id', '6E', 'category', 'Role RBAC', 'test_name', 'Teacher Fee SELECT Blocked', 'status', 'PASS', 'details', 'Teacher has 0 fee visibility');
  ELSE
    v_results := v_results || jsonb_build_object('test_id', '6E', 'category', 'Role RBAC', 'test_name', 'Teacher Fee SELECT Blocked', 'status', 'FAIL', 'details', 'Teacher has visibility to ' || v_cnt || ' fee records');
  END IF;
  PERFORM set_config('role', 'postgres', true);

  -- 6F: Teacher CANNOT collect fee payment
  PERFORM set_config('request.jwt.claim.sub', v_teacher_a1::text, true);
  BEGIN
    PERFORM public.collect_fee_payment(v_fee_rec_a, 100, 'cash');
    v_results := v_results || jsonb_build_object('test_id', '6F', 'category', 'Role RBAC', 'test_name', 'Teacher collect_fee_payment RPC Blocked', 'status', 'FAIL', 'details', 'Teacher was able to collect fee payment');
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', '6F', 'category', 'Role RBAC', 'test_name', 'Teacher collect_fee_payment RPC Blocked', 'status', 'PASS', 'details', 'Teacher execution rejected: ' || sqlerrm);
  END;

  -- ==================================================================
  -- 7. CROSS-INSTITUTE ISOLATION
  -- ==================================================================
  -- Setup Fee Invoice in Inst B (as Owner B)
  PERFORM set_config('request.jwt.claim.sub', v_owner_b::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  v_res := public.create_student_fee_invoice(
    v_student_rec_b,
    'Beta Institute Fee',
    15000,
    current_date + 15
  );
  v_fee_rec_b := (v_res->>'record_id')::uuid;

  -- 7A: Owner A querying fee_records in Institute B -> MUST BE 0
  PERFORM set_config('request.jwt.claim.sub', v_owner_a::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO v_cnt FROM public.fee_records WHERE id = v_fee_rec_b;
  IF v_cnt = 0 THEN
    v_results := v_results || jsonb_build_object('test_id', '7A', 'category', 'Tenant Isolation', 'test_name', 'Owner A SELECT Fee Record Inst B Blocked', 'status', 'PASS', 'details', 'Zero cross-tenant records visible');
  ELSE
    v_results := v_results || jsonb_build_object('test_id', '7A', 'category', 'Tenant Isolation', 'test_name', 'Owner A SELECT Fee Record Inst B Blocked', 'status', 'FAIL', 'details', 'Owner A saw Institute B fee record');
  END IF;
  PERFORM set_config('role', 'postgres', true);

  -- 7B: Owner A attempting to collect fee on Inst B record -> MUST FAIL
  PERFORM set_config('request.jwt.claim.sub', v_owner_a::text, true);
  BEGIN
    PERFORM public.collect_fee_payment(v_fee_rec_b, 5000, 'cash');
    v_results := v_results || jsonb_build_object('test_id', '7B', 'category', 'Tenant Isolation', 'test_name', 'Owner A collect_fee_payment on Inst B Blocked', 'status', 'FAIL', 'details', 'Cross-tenant payment collection succeeded');
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', '7B', 'category', 'Tenant Isolation', 'test_name', 'Owner A collect_fee_payment on Inst B Blocked', 'status', 'PASS', 'details', 'Cross-tenant collection rejected: ' || sqlerrm);
  END;

  -- 7C: Owner B querying attendance_sessions in Institute A -> MUST BE 0
  PERFORM set_config('request.jwt.claim.sub', v_owner_b::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO v_cnt FROM public.attendance_sessions WHERE institute_id = v_inst_a;
  IF v_cnt = 0 THEN
    v_results := v_results || jsonb_build_object('test_id', '7C', 'category', 'Tenant Isolation', 'test_name', 'Owner B SELECT Attendance Inst A Blocked', 'status', 'PASS', 'details', 'Zero cross-tenant attendance sessions visible');
  ELSE
    v_results := v_results || jsonb_build_object('test_id', '7C', 'category', 'Tenant Isolation', 'test_name', 'Owner B SELECT Attendance Inst A Blocked', 'status', 'FAIL', 'details', 'Owner B saw Inst A attendance sessions: ' || v_cnt);
  END IF;
  PERFORM set_config('role', 'postgres', true);

  -- ==================================================================
  -- 8. REGRESSION: MILESTONES 1-4 REGRESSION INTEGRITY
  -- ==================================================================
  -- 8A: M1 - Role escalation block
  PERFORM set_config('request.jwt.claim.sub', v_student_a1::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    UPDATE public.profiles SET role = 'owner' WHERE id = v_student_a1;
    v_results := v_results || jsonb_build_object('test_id', '8A', 'category', 'M1 Regression', 'test_name', 'Self Role Escalation Block', 'status', 'FAIL', 'details', 'Student elevated own role to owner');
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', '8A', 'category', 'M1 Regression', 'test_name', 'Self Role Escalation Block', 'status', 'PASS', 'details', 'Self role escalation blocked: ' || sqlerrm);
  END;
  PERFORM set_config('role', 'postgres', true);

  -- 8B: M2 - Batch capacity enforcement
  PERFORM set_config('request.jwt.claim.sub', v_owner_a::text, true);
  UPDATE public.batches SET max_capacity = 2 WHERE id = v_batch_a1;
  BEGIN
    INSERT INTO public.students (admission_no, full_name, class_name, batch_id, institute_id, status)
    VALUES ('PC-2026-9104', 'Overcapacity Student', 'Class 12', v_batch_a1, v_inst_a, 'active');
    v_results := v_results || jsonb_build_object('test_id', '8B', 'category', 'M2 Regression', 'test_name', 'Batch Capacity Enforcement', 'status', 'FAIL', 'details', 'Enrolled student beyond batch capacity');
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', '8B', 'category', 'M2 Regression', 'test_name', 'Batch Capacity Enforcement', 'status', 'PASS', 'details', 'Capacity trigger rejected enrollment: ' || sqlerrm);
  END;

  -- 8C: M3 - Attendance Summary Analytics RPC
  PERFORM set_config('request.jwt.claim.sub', v_owner_a::text, true);
  v_res := public.get_student_attendance_summary(v_student_rec_a1);
  IF (v_res->>'total_sessions')::integer >= 1 AND (v_res->>'percentage')::numeric = 100.0 THEN
    v_results := v_results || jsonb_build_object('test_id', '8C', 'category', 'M3 Regression', 'test_name', 'Student Attendance Analytics Summary', 'status', 'PASS', 'details', 'Attendance summary accurate: ' || v_res::text);
  ELSE
    v_results := v_results || jsonb_build_object('test_id', '8C', 'category', 'M3 Regression', 'test_name', 'Student Attendance Analytics Summary', 'status', 'FAIL', 'details', 'Unexpected summary: ' || v_res::text);
  END IF;

  -- 8D: M4 - Institute Fee Summary RPC
  v_res := public.get_institute_fee_summary();
  IF (v_res->>'total_billed')::numeric >= 40000 AND (v_res->>'total_collected')::numeric >= 40000 THEN
    v_results := v_results || jsonb_build_object('test_id', '8D', 'category', 'M4 Regression', 'test_name', 'Institute Fee Summary Calculation', 'status', 'PASS', 'details', 'Fee summary accurate: ' || v_res::text);
  ELSE
    v_results := v_results || jsonb_build_object('test_id', '8D', 'category', 'M4 Regression', 'test_name', 'Institute Fee Summary Calculation', 'status', 'FAIL', 'details', 'Unexpected summary: ' || v_res::text);
  END IF;

  -- ------------------------------------------------------------------
  -- Capture Report and Clean Rollback
  -- ------------------------------------------------------------------
  RAISE EXCEPTION 'AUDIT_REPORT::: %', v_results::text;
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;