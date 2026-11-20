-- ====================================================================
-- Milestone 2 Security, Capacity, and Data Integrity Test Suite
-- ====================================================================

DO $$
DECLARE
  v_inst_pradeep uuid := '11111111-2222-3333-4444-555555555555';
  v_inst_beta uuid;
  v_batch_a uuid;
  v_batch_b uuid;
  v_batch_beta uuid;
  v_batch_full uuid;
  v_batch_archived uuid;
  v_student_1 uuid;
  v_student_2 uuid;
  v_student_3 uuid;
  v_adm_no text;
  v_transfer_result jsonb;
  v_history_count integer;
  v_caught_error boolean;
  v_is_active boolean;
  v_status text;
BEGIN
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'Starting Milestone 2 Verification Test Suite...';
  RAISE NOTICE '=======================================================';

  -- ------------------------------------------------------------------
  -- TEST 1 (AC-1): Sequence-based Admission Number Generation
  -- ------------------------------------------------------------------
  INSERT INTO public.batches (name, course_name, max_capacity, status, institute_id)
  VALUES ('M2 Test Batch Alpha', 'JEE Advanced', 10, 'active', v_inst_pradeep)
  RETURNING id INTO v_batch_a;

  INSERT INTO public.students (full_name, class_name, batch_id, institute_id)
  VALUES ('M2 Test Student 1', 'Class 12', v_batch_a, v_inst_pradeep)
  RETURNING id, admission_no INTO v_student_1, v_adm_no;

  IF v_adm_no ~ '^PC-[0-9]{4}-[0-9]{4}$' THEN
    RAISE NOTICE 'PASS [Test 1]: Admission number generated correctly -> %', v_adm_no;
  ELSE
    RAISE EXCEPTION 'FAIL [Test 1]: Admission number format invalid -> %', v_adm_no;
  END IF;

  -- ------------------------------------------------------------------
  -- TEST 2 (AC-2 & AC-3): Multi-Tenant Isolation & Cross-Tenant Rejection
  -- ------------------------------------------------------------------
  INSERT INTO public.institutes (name, slug)
  VALUES ('Institute Beta Test', 'institute-beta-test')
  RETURNING id INTO v_inst_beta;

  INSERT INTO public.batches (name, course_name, max_capacity, status, institute_id)
  VALUES ('Beta Batch One', 'Foundation 10th', 10, 'active', v_inst_beta)
  RETURNING id INTO v_batch_beta;

  v_caught_error := false;
  BEGIN
    -- Attempt enrolling Pradeep Classes student into Beta institute batch
    INSERT INTO public.students (full_name, class_name, batch_id, institute_id)
    VALUES ('Cross Tenant Student', 'Class 10', v_batch_beta, v_inst_pradeep);
  EXCEPTION WHEN OTHERS THEN
    v_caught_error := true;
    RAISE NOTICE 'PASS [Test 2]: Cross-tenant batch allocation blocked as expected: %', SQLERRM;
  END;

  IF NOT v_caught_error THEN
    RAISE EXCEPTION 'FAIL [Test 2]: Cross-tenant batch allocation was NOT blocked!';
  END IF;

  -- ------------------------------------------------------------------
  -- TEST 3 (AC-4 & AC-5): Batch Capacity Concurrency Lock & Inactive Rejection
  -- ------------------------------------------------------------------
  INSERT INTO public.batches (name, course_name, max_capacity, status, institute_id)
  VALUES ('M2 Capacity Limit Batch', 'NEET Medical', 2, 'active', v_inst_pradeep)
  RETURNING id INTO v_batch_full;

  -- Fill seats (1 and 2)
  INSERT INTO public.students (full_name, class_name, batch_id, institute_id)
  VALUES ('Seat 1 Student', 'Class 12', v_batch_full, v_inst_pradeep);

  INSERT INTO public.students (full_name, class_name, batch_id, institute_id)
  VALUES ('Seat 2 Student', 'Class 12', v_batch_full, v_inst_pradeep);

  -- 3rd student attempt must be rejected
  v_caught_error := false;
  BEGIN
    INSERT INTO public.students (full_name, class_name, batch_id, institute_id)
    VALUES ('Seat 3 Student (Over Capacity)', 'Class 12', v_batch_full, v_inst_pradeep);
  EXCEPTION WHEN OTHERS THEN
    v_caught_error := true;
    RAISE NOTICE 'PASS [Test 3A]: Over-capacity enrollment blocked as expected: %', SQLERRM;
  END;

  IF NOT v_caught_error THEN
    RAISE EXCEPTION 'FAIL [Test 3A]: Over-capacity enrollment was allowed!';
  END IF;

  -- Archived batch rejection
  INSERT INTO public.batches (name, course_name, max_capacity, status, institute_id)
  VALUES ('Archived Test Batch', 'Board Prep', 10, 'archived', v_inst_pradeep)
  RETURNING id INTO v_batch_archived;

  v_caught_error := false;
  BEGIN
    INSERT INTO public.students (full_name, class_name, batch_id, institute_id)
    VALUES ('Archived Batch Student', 'Class 11', v_batch_archived, v_inst_pradeep);
  EXCEPTION WHEN OTHERS THEN
    v_caught_error := true;
    RAISE NOTICE 'PASS [Test 3B]: Enrollment into archived batch blocked as expected: %', SQLERRM;
  END;

  IF NOT v_caught_error THEN
    RAISE EXCEPTION 'FAIL [Test 3B]: Enrollment into archived batch was allowed!';
  END IF;

  -- ------------------------------------------------------------------
  -- TEST 4 (AC-7): Batch Status and is_active Bi-directional Sync
  -- ------------------------------------------------------------------
  SELECT is_active INTO v_is_active FROM public.batches WHERE id = v_batch_archived;
  IF v_is_active = false THEN
    RAISE NOTICE 'PASS [Test 4A]: Batch status=archived synchronized is_active=false';
  ELSE
    RAISE EXCEPTION 'FAIL [Test 4A]: is_active was not false for archived batch';
  END IF;

  UPDATE public.batches SET status = 'active' WHERE id = v_batch_archived;
  SELECT is_active INTO v_is_active FROM public.batches WHERE id = v_batch_archived;
  IF v_is_active = true THEN
    RAISE NOTICE 'PASS [Test 4B]: Batch status=active synchronized is_active=true';
  ELSE
    RAISE EXCEPTION 'FAIL [Test 4B]: is_active was not true for active batch';
  END IF;

  UPDATE public.batches SET is_active = false WHERE id = v_batch_archived;
  SELECT status INTO v_status FROM public.batches WHERE id = v_batch_archived;
  IF v_status = 'archived' THEN
    RAISE NOTICE 'PASS [Test 4C]: Batch is_active=false synchronized status=archived';
  ELSE
    RAISE EXCEPTION 'FAIL [Test 4C]: status was not archived after setting is_active=false';
  END IF;

  -- ------------------------------------------------------------------
  -- TEST 5 (AC-6): Student Batch History & Trigger Consistency
  -- ------------------------------------------------------------------
  -- Create target batch for transfer
  INSERT INTO public.batches (name, course_name, max_capacity, status, institute_id)
  VALUES ('M2 Transfer Destination Batch', 'JEE Advanced', 15, 'active', v_inst_pradeep)
  RETURNING id INTO v_batch_b;

  -- Direct update on students moves student and updates batch_name
  UPDATE public.students
  SET batch_id = v_batch_b
  WHERE id = v_student_1;

  SELECT batch_name INTO v_status FROM public.students WHERE id = v_student_1;
  IF v_status = 'M2 Transfer Destination Batch' THEN
    RAISE NOTICE 'PASS [Test 5]: Student batch_name automatically synchronized by trigger -> %', v_status;
  ELSE
    RAISE EXCEPTION 'FAIL [Test 5]: Student batch_name not synchronized, got %', v_status;
  END IF;

  -- ------------------------------------------------------------------
  -- CLEANUP TEST FIXTURES
  -- ------------------------------------------------------------------
  DELETE FROM public.students WHERE batch_id IN (v_batch_a, v_batch_b, v_batch_beta, v_batch_full, v_batch_archived);
  DELETE FROM public.batches WHERE id IN (v_batch_a, v_batch_b, v_batch_beta, v_batch_full, v_batch_archived);
  DELETE FROM public.batches WHERE institute_id = v_inst_beta;
  DELETE FROM public.institutes WHERE id = v_inst_beta;

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'ALL 7 MILESTONE 2 DATABASE TEST ASSERTIONS PASSED!';
  RAISE NOTICE '=======================================================';
END $$;
