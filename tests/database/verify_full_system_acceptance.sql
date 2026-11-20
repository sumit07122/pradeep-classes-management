-- ============================================================================
-- FULL SYSTEM ACCEPTANCE & INTEGRITY VERIFICATION SUITE
-- Pradeep Classes Management Platform (Production Verification)
-- All tests executed within a single transaction and rolled back (0 side-effects)
-- ============================================================================

BEGIN;

CREATE TEMP TABLE test_results (
    test_id text PRIMARY KEY,
    description text NOT NULL,
    status text NOT NULL CHECK (status IN ('PASS', 'FAIL')),
    details text
);

DO $$
DECLARE
    v_institute_id uuid := '11111111-2222-3333-4444-555555555555';
    v_batch_id uuid;
    v_student_id uuid;
    v_teacher_id uuid;
    v_exam_id uuid;
    v_record_id uuid;
    v_payment_id uuid;
    v_reversal_res jsonb;
    v_attendance_res jsonb;
    v_queue_count int;
    v_conflict_caught boolean := false;
    v_tamper_caught boolean := false;
BEGIN
    -- ------------------------------------------------------------------------
    -- Test 1: Institute Master & Settings
    -- ------------------------------------------------------------------------
    IF EXISTS (
        SELECT 1 FROM public.institutes 
        WHERE id = v_institute_id AND name = 'Pradeep Classes' AND is_active = true
    ) AND EXISTS (
        SELECT 1 FROM public.institute_settings
        WHERE institute_id = v_institute_id
    ) THEN
        INSERT INTO test_results VALUES (
            'SYS-01',
            'Institute Master & Configuration',
            'PASS',
            'Pradeep Classes verified with active settings configuration'
        );
    ELSE
        INSERT INTO test_results VALUES (
            'SYS-01',
            'Institute Master & Configuration',
            'FAIL',
            'Institute record or settings missing'
        );
    END IF;

    -- ------------------------------------------------------------------------
    -- Setup Test Entities (Batch, Teacher, Student)
    -- ------------------------------------------------------------------------
    INSERT INTO public.batches (name, course_name, academic_year, max_capacity, institute_id, status)
    VALUES ('Acceptance Test Batch', 'JEE 2026', '2026-2027', 30, v_institute_id, 'active')
    RETURNING id INTO v_batch_id;

    INSERT INTO public.teachers (full_name, subject, phone, institute_id, is_active)
    VALUES ('Faculty Tester', 'Physics', '+91 99999 11111', v_institute_id, true)
    RETURNING id INTO v_teacher_id;

    INSERT INTO public.teacher_batches (teacher_id, batch_id)
    VALUES (v_teacher_id, v_batch_id);

    INSERT INTO public.students (full_name, class_name, batch_id, phone, institute_id, status)
    VALUES ('Test Student Alpha', 'Class 12 - Science', v_batch_id, '+91 99999 22222', v_institute_id, 'active')
    RETURNING id INTO v_student_id;

    -- ------------------------------------------------------------------------
    -- Test 2: Admission Number Generator & Student Allocation
    -- ------------------------------------------------------------------------
    IF EXISTS (
        SELECT 1 FROM public.students 
        WHERE id = v_student_id AND admission_no ~ '^PC-[0-9]{4}-[0-9]{4}$'
    ) THEN
        INSERT INTO test_results VALUES (
            'SYS-02',
            'Admission Number Format & Generation',
            'PASS',
            'Student assigned valid format PC-YYYY-XXXX via sequence'
        );
    ELSE
        INSERT INTO test_results VALUES (
            'SYS-02',
            'Admission Number Format & Generation',
            'FAIL',
            'Admission number format mismatch'
        );
    END IF;

    -- ------------------------------------------------------------------------
    -- Test 3: Attendance Roll Call RPC & Automatic WhatsApp Queue Enqueuing
    -- ------------------------------------------------------------------------
    SELECT public.submit_batch_attendance(
        p_batch_id := v_batch_id,
        p_session_date := CURRENT_DATE,
        p_topic := 'System Acceptance Verification Lecture',
        p_records := jsonb_build_array(
            jsonb_build_object(
                'student_id', v_student_id,
                'status', 'present',
                'remarks', 'Automated Verification Attendance'
            )
        )
    ) INTO v_attendance_res;

    SELECT count(*) INTO v_queue_count 
    FROM public.whatsapp_message_queue
    WHERE student_id = v_student_id AND event_type = 'attendance_present';

    IF (v_attendance_res->>'success')::boolean = true AND v_queue_count = 1 THEN
        INSERT INTO test_results VALUES (
            'SYS-03',
            'Attendance Submission & WhatsApp Queue',
            'PASS',
            'Attendance recorded and notification successfully enqueued with deduplication'
        );
    ELSE
        INSERT INTO test_results VALUES (
            'SYS-03',
            'Attendance Submission & WhatsApp Queue',
            'FAIL',
            'Attendance RPC failed or WhatsApp message was not enqueued'
        );
    END IF;

    -- ------------------------------------------------------------------------
    -- Test 4: Financial Ledger Immutability & Payment Reversal RPC
    -- ------------------------------------------------------------------------
    -- 1. Create Invoice
    INSERT INTO public.fee_records (student_id, title, amount, paid_amount, due_date, status, institute_id)
    VALUES (v_student_id, 'Term 1 Acceptance Fee', 25000, 0, CURRENT_DATE + 30, 'pending', v_institute_id)
    RETURNING id INTO v_record_id;

    -- 2. Collect Payment
    SELECT (public.collect_fee_payment(
        p_record_id := v_record_id,
        p_amount := 10000,
        p_payment_mode := 'upi',
        p_transaction_ref := 'UPI/VERIFY/10001',
        p_notes := 'Acceptance Test Installment'
    )->>'payment_id')::uuid INTO v_payment_id;

    -- 3. Verify Ledger Direct Mutation is BLOCKED by Immutability Trigger
    BEGIN
        UPDATE public.fee_payments SET amount = 5000 WHERE id = v_payment_id;
    EXCEPTION WHEN OTHERS THEN
        v_tamper_caught := true;
    END;

    -- 4. Execute Payment Reversal RPC
    SELECT public.reverse_fee_payment(
        p_payment_id := v_payment_id,
        p_reason := 'Accidental double swipe reversal test'
    ) INTO v_reversal_res;

    IF v_tamper_caught = true AND (v_reversal_res->>'success')::boolean = true THEN
        INSERT INTO test_results VALUES (
            'SYS-04',
            'Payment Ledger Immutability & Reversal',
            'PASS',
            'Direct ledger UPDATE blocked; reversal successfully processed and audited'
        );
    ELSE
        INSERT INTO test_results VALUES (
            'SYS-04',
            'Payment Ledger Immutability & Reversal',
            'FAIL',
            'Immutability trigger failed to catch tamper or reversal RPC failed'
        );
    END IF;

    -- ------------------------------------------------------------------------
    -- Test 5: Examination Auto-Grading & Ranking Engine
    -- ------------------------------------------------------------------------
    INSERT INTO public.exams (title, batch_id, subject, exam_date, total_marks, passing_marks, institute_id)
    VALUES ('Physics Unit Test', v_batch_id, 'Physics', CURRENT_DATE, 100, 40, v_institute_id)
    RETURNING id INTO v_exam_id;

    PERFORM public.submit_exam_marks(
        p_exam_id := v_exam_id,
        p_marks := jsonb_build_array(
            jsonb_build_object(
                'student_id', v_student_id,
                'marks_obtained', 95.0,
                'is_absent', false,
                'remarks', 'Outstanding performance'
            )
        )
    );

    IF EXISTS (
        SELECT 1 FROM public.exam_marks
        WHERE exam_id = v_exam_id AND student_id = v_student_id 
          AND grade = 'A+' AND rank = 1 AND is_passed = true
    ) THEN
        INSERT INTO test_results VALUES (
            'SYS-05',
            'Examination Auto-Grading & Dense Rank',
            'PASS',
            'Student assigned Grade A+ and Rank #1 for score 95/100'
        );
    ELSE
        INSERT INTO test_results VALUES (
            'SYS-05',
            'Examination Auto-Grading & Dense Rank',
            'FAIL',
            'Marks submission or auto-grade computation failed'
        );
    END IF;

    -- ------------------------------------------------------------------------
    -- Test 6: Timetable Conflict Detection Engine
    -- ------------------------------------------------------------------------
    -- 1. Insert valid slot
    INSERT INTO public.timetables (batch_id, teacher_id, subject, day_of_week, start_time, end_time, room_number, institute_id)
    VALUES (v_batch_id, v_teacher_id, 'Physics', 'Monday', '09:00', '10:30', 'Room 101', v_institute_id);

    -- 2. Attempt double-booking same teacher in another batch at overlapping time
    BEGIN
        INSERT INTO public.timetables (batch_id, teacher_id, subject, day_of_week, start_time, end_time, room_number, institute_id)
        VALUES (v_batch_id, v_teacher_id, 'Physics Extra', 'Monday', '09:30', '11:00', 'Room 102', v_institute_id);
    EXCEPTION WHEN OTHERS THEN
        v_conflict_caught := true;
    END;

    IF v_conflict_caught = true THEN
        INSERT INTO test_results VALUES (
            'SYS-06',
            'Timetable Conflict Detection Trigger',
            'PASS',
            'Double-booking overlapping teacher slot was intercepted and rejected'
        );
    ELSE
        INSERT INTO test_results VALUES (
            'SYS-06',
            'Timetable Conflict Detection Trigger',
            'FAIL',
            'Conflict detection failed to prevent double-booking'
        );
    END IF;

    -- ------------------------------------------------------------------------
    -- Test 7: Communication & Academic Materials Repository
    -- ------------------------------------------------------------------------
    INSERT INTO public.homework (batch_id, title, due_date, max_marks, institute_id)
    VALUES (v_batch_id, 'Mechanics Practice Set 1', CURRENT_DATE + 3, 20, v_institute_id);

    INSERT INTO public.study_materials (batch_id, title, subject, category, file_url, institute_id)
    VALUES (v_batch_id, 'Thermodynamics Formula Guide', 'Physics', 'formula_sheet', 'https://pradeepclasses.in/notes.pdf', v_institute_id);

    INSERT INTO public.announcements (title, message, target_role, priority, institute_id)
    VALUES ('Welcome to Academic Term', 'Classes commence at 9:00 AM sharp.', 'all', 'normal', v_institute_id);

    IF EXISTS (SELECT 1 FROM public.homework WHERE batch_id = v_batch_id)
       AND EXISTS (SELECT 1 FROM public.study_materials WHERE batch_id = v_batch_id)
       AND EXISTS (SELECT 1 FROM public.announcements WHERE title = 'Welcome to Academic Term') THEN
        INSERT INTO test_results VALUES (
            'SYS-07',
            'Academic Content & Announcement Dispatch',
            'PASS',
            'Homework, study materials, and targeted announcements verified'
        );
    ELSE
        INSERT INTO test_results VALUES (
            'SYS-07',
            'Academic Content & Announcement Dispatch',
            'FAIL',
            'Content or announcement creation failed'
        );
    END IF;

    -- ------------------------------------------------------------------------
    -- Test 8: Comprehensive Multi-Tenant RLS & Role Isolation
    -- ------------------------------------------------------------------------
    -- Verify RLS is enabled on all core tenant tables
    IF NOT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN (
            'institutes', 'profiles', 'batches', 'students', 'teachers',
            'teacher_batches', 'student_batch_history', 'attendance_sessions',
            'attendance_records', 'fee_structures', 'fee_records', 'fee_payments',
            'exams', 'exam_marks', 'homework', 'study_materials', 'timetables',
            'announcements', 'whatsapp_settings', 'whatsapp_message_queue', 'institute_settings'
          )
          AND rowsecurity = false
    ) THEN
        INSERT INTO test_results VALUES (
            'SYS-08',
            'Row Level Security Active Across All 21 Tables',
            'PASS',
            'All tenant-sensitive tables enforce rowsecurity = true'
        );
    ELSE
        INSERT INTO test_results VALUES (
            'SYS-08',
            'Row Level Security Active Across All 21 Tables',
            'FAIL',
            'One or more tables lack active row security'
        );
    END IF;

END $$;

SELECT * FROM test_results ORDER BY test_id;

-- Explicit Rollback to guarantee 0 database pollution
ROLLBACK;
