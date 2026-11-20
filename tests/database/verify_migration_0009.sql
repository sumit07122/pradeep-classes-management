-- ====================================================================
-- Test: verify_migration_0009.sql
-- Description: Verification of Migration 0009 Features:
--              1. Payment ledger immutability trigger (rejection of raw delete/update)
--              2. Payment reversal RPC (atomic reversal, balance deduction, audit logging)
--              3. Invoice number generation vs unique installment receipts
--              4. Automated WhatsApp attendance notification queueing & message text
--              5. Exams, tests, marks calculation, grading, ranking & publication
--              6. Timetable scheduling & double-booking conflict detection
--              7. Clean rollback leaving zero test residue
-- ====================================================================

DO $$
DECLARE
  v_results jsonb := '[]'::jsonb;

  v_inst uuid := '11111111-2222-3333-4444-555555555555';
  v_owner uuid := '28fe332f-4814-442d-a797-6833e2472ce3';
  v_teacher uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();

  v_batch_id uuid := gen_random_uuid();
  v_teacher_rec uuid := gen_random_uuid();
  v_student_rec uuid := gen_random_uuid();

  v_fee_rec uuid;
  v_payment_id uuid;
  v_reversal_res jsonb;
  v_invoice_res jsonb;
  v_attendance_res jsonb;
  v_exam_id uuid;
  v_exam_res jsonb;
  v_cnt integer;
  v_whatsapp_msg record;
BEGIN
  -- Setup teacher & student users
  PERFORM set_config('institute.internal_bootstrap_in_progress', 'true', true);
  PERFORM set_config('institute.target_institute_id', v_inst::text, true);

  PERFORM set_config('institute.target_role', 'teacher', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (v_teacher, 'test.teacher09@audit.internal', jsonb_build_object('full_name', 'Teacher Nine'));

  PERFORM set_config('institute.target_role', 'student', true);
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (v_student, 'test.student09@audit.internal', jsonb_build_object('full_name', 'Student Nine'));

  PERFORM set_config('institute.internal_bootstrap_in_progress', 'false', true);

  -- Setup domain entities
  INSERT INTO public.batches (id, name, course_name, academic_year, max_capacity, institute_id, status)
  VALUES (v_batch_id, 'M09 Test Batch', 'JEE 2027', '2026-2027', 30, v_inst, 'active');

  INSERT INTO public.teachers (id, profile_id, full_name, subject, phone, institute_id, is_active)
  VALUES (v_teacher_rec, v_teacher, 'Teacher Nine', 'Physics', '9899001122', v_inst, true);

  INSERT INTO public.teacher_batches (teacher_id, batch_id, institute_id)
  VALUES (v_teacher_rec, v_batch_id, v_inst);

  INSERT INTO public.students (id, profile_id, admission_no, full_name, class_name, phone, batch_id, institute_id, status)
  VALUES (v_student_rec, v_student, 'PC-2026-9901', 'Student Nine', 'Class 12', '9811223344', v_batch_id, v_inst, 'active');

  -- ------------------------------------------------------------------
  -- 1. PAYMENT LEDGER IMMUTABILITY & REVERSAL TEST
  -- ------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- Create invoice
  v_invoice_res := public.create_student_fee_invoice(v_student_rec, 'Term Tuition', 30000, current_date + 30);
  v_fee_rec := (v_invoice_res->>'record_id')::uuid;

  IF (v_invoice_res->>'invoice_no') LIKE 'INV-2026-%' THEN
    v_results := v_results || jsonb_build_object('test_id', 'T1', 'feature', 'Invoicing', 'name', 'Invoice Number Format INV-YYYY-XXXX', 'status', 'PASS');
  ELSE
    v_results := v_results || jsonb_build_object('test_id', 'T1', 'feature', 'Invoicing', 'name', 'Invoice Number Format INV-YYYY-XXXX', 'status', 'FAIL');
  END IF;

  -- Collect partial payment of 10,000
  v_invoice_res := public.collect_fee_payment(v_fee_rec, 10000, 'upi', 'UPI/TEST-1', 'Initial payment');
  v_payment_id := (v_invoice_res->>'payment_id')::uuid;

  -- Attempt raw DELETE on fee_payments -> MUST FAIL
  BEGIN
    DELETE FROM public.fee_payments WHERE id = v_payment_id;
    v_results := v_results || jsonb_build_object('test_id', 'T2', 'feature', 'Ledger', 'name', 'Immutability Trigger Blocks Raw DELETE', 'status', 'FAIL');
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', 'T2', 'feature', 'Ledger', 'name', 'Immutability Trigger Blocks Raw DELETE', 'status', 'PASS');
  END;

  -- Attempt raw UPDATE on fee_payments -> MUST FAIL
  BEGIN
    UPDATE public.fee_payments SET amount = 5000 WHERE id = v_payment_id;
    v_results := v_results || jsonb_build_object('test_id', 'T3', 'feature', 'Ledger', 'name', 'Immutability Trigger Blocks Raw UPDATE', 'status', 'FAIL');
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', 'T3', 'feature', 'Ledger', 'name', 'Immutability Trigger Blocks Raw UPDATE', 'status', 'PASS');
  END;

  -- Perform official payment reversal
  v_reversal_res := public.reverse_fee_payment(v_payment_id, 'Mistaken double entry by parent');
  IF (v_reversal_res->>'success')::boolean = true AND (v_reversal_res->>'new_paid_total')::numeric = 0 THEN
    v_results := v_results || jsonb_build_object('test_id', 'T4', 'feature', 'Ledger', 'name', 'Atomic Payment Reversal & Balance Restoration', 'status', 'PASS');
  ELSE
    v_results := v_results || jsonb_build_object('test_id', 'T4', 'feature', 'Ledger', 'name', 'Atomic Payment Reversal & Balance Restoration', 'status', 'FAIL');
  END IF;

  -- ------------------------------------------------------------------
  -- 2. AUTOMATIC WHATSAPP ATTENDANCE NOTIFICATION QUEUE TEST
  -- ------------------------------------------------------------------
  -- Configure WhatsApp settings
  UPDATE public.whatsapp_settings
  SET is_enabled = true, notify_on_present = true, notify_on_absent = true
  WHERE institute_id = v_inst;

  -- Submit attendance for batch as Teacher Nine
  PERFORM set_config('request.jwt.claim.sub', v_teacher::text, true);
  v_attendance_res := public.submit_batch_attendance(
    v_batch_id,
    current_date,
    jsonb_build_array(jsonb_build_object('student_id', v_student_rec, 'status', 'present'))
  );

  -- Check if message was queued
  SELECT * INTO v_whatsapp_msg
  FROM public.whatsapp_message_queue
  WHERE student_id = v_student_rec
    AND event_type = 'attendance_present'
    AND status = 'pending'
  LIMIT 1;

  IF v_whatsapp_msg.id IS NOT NULL AND v_whatsapp_msg.message_body LIKE '%marked PRESENT%' THEN
    v_results := v_results || jsonb_build_object('test_id', 'T5', 'feature', 'WhatsApp', 'name', 'Automatic Attendance WhatsApp Queueing', 'status', 'PASS');
  ELSE
    v_results := v_results || jsonb_build_object('test_id', 'T5', 'feature', 'WhatsApp', 'name', 'Automatic Attendance WhatsApp Queueing', 'status', 'FAIL');
  END IF;

  -- ------------------------------------------------------------------
  -- 3. EXAMINATIONS, MARKS & GRADES TEST
  -- ------------------------------------------------------------------
  -- Create exam as Teacher
  INSERT INTO public.exams (institute_id, batch_id, title, subject, exam_type, exam_date, total_marks, passing_marks, status, created_by)
  VALUES (v_inst, v_batch_id, 'Physics Optics Unit Test', 'Physics', 'unit_test', current_date + 7, 50, 20, 'scheduled', v_teacher)
  RETURNING id INTO v_exam_id;

  -- Submit marks (45/50 -> 90% -> A+, Rank 1)
  v_exam_res := public.submit_exam_marks(
    v_exam_id,
    jsonb_build_array(jsonb_build_object('student_id', v_student_rec, 'marks_obtained', 45, 'remarks', 'Excellent'))
  );

  SELECT count(*) INTO v_cnt
  FROM public.exam_marks
  WHERE exam_id = v_exam_id AND grade = 'A+' AND rank_in_batch = 1;

  IF v_cnt = 1 THEN
    v_results := v_results || jsonb_build_object('test_id', 'T6', 'feature', 'Academics', 'name', 'Exam Marks Entry, Grade & Rank Calculation', 'status', 'PASS');
  ELSE
    v_results := v_results || jsonb_build_object('test_id', 'T6', 'feature', 'Academics', 'name', 'Exam Marks Entry, Grade & Rank Calculation', 'status', 'FAIL');
  END IF;

  -- Publish results
  PERFORM public.publish_exam_results(v_exam_id);
  SELECT count(*) INTO v_cnt FROM public.exams WHERE id = v_exam_id AND status = 'published';

  IF v_cnt = 1 THEN
    v_results := v_results || jsonb_build_object('test_id', 'T7', 'feature', 'Academics', 'name', 'Exam Results Publication to Student Portal', 'status', 'PASS');
  ELSE
    v_results := v_results || jsonb_build_object('test_id', 'T7', 'feature', 'Academics', 'name', 'Exam Results Publication to Student Portal', 'status', 'FAIL');
  END IF;

  -- ------------------------------------------------------------------
  -- 4. TIMETABLE CONFLICT DETECTION TEST
  -- ------------------------------------------------------------------
  -- First schedule: Monday 09:00 - 10:30 in Room 101 with Teacher Nine
  INSERT INTO public.timetables (institute_id, batch_id, teacher_id, subject, day_of_week, start_time, end_time, room_number)
  VALUES (v_inst, v_batch_id, v_teacher_rec, 'Physics', 'Monday', '09:00', '10:30', 'Room 101');

  -- Conflicting schedule: Same teacher on Monday 10:00 - 11:30 (overlaps by 30 mins) -> MUST BE REJECTED
  BEGIN
    INSERT INTO public.timetables (institute_id, batch_id, teacher_id, subject, day_of_week, start_time, end_time, room_number)
    VALUES (v_inst, v_batch_id, v_teacher_rec, 'Physics', 'Monday', '10:00', '11:30', 'Room 102');
    v_results := v_results || jsonb_build_object('test_id', 'T8', 'feature', 'Timetable', 'name', 'Timetable Double-Booking Conflict Detection', 'status', 'FAIL');
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_object('test_id', 'T8', 'feature', 'Timetable', 'name', 'Timetable Double-Booking Conflict Detection', 'status', 'PASS');
  END;

  -- ------------------------------------------------------------------
  -- Clean Rollback
  -- ------------------------------------------------------------------
  RAISE EXCEPTION 'MIGRATION_0009_VERIFICATION::: %', v_results::text;
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;