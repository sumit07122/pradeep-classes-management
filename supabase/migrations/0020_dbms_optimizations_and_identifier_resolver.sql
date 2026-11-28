-- Migration 0020: Comprehensive DBMS Optimizations & Universal Login Identifier Resolver

-- 1. Index Design for Unindexed Foreign Keys & High-Frequency Query Paths
CREATE INDEX IF NOT EXISTS idx_fee_records_student_id 
    ON public.fee_records (student_id);

CREATE INDEX IF NOT EXISTS idx_fee_records_inst_status 
    ON public.fee_records (institute_id, status);

CREATE INDEX IF NOT EXISTS idx_attendance_records_student 
    ON public.attendance_records (student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_inst_date 
    ON public.attendance_sessions (institute_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_teachers_institute_active 
    ON public.teachers (institute_id, is_active);

CREATE INDEX IF NOT EXISTS idx_timetables_batch_day 
    ON public.timetables (batch_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_timetables_teacher_day 
    ON public.timetables (teacher_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_study_materials_batch_inst 
    ON public.study_materials (institute_id, batch_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_institute_date 
    ON public.audit_logs (institute_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_marks_inst_exam_student 
    ON public.exam_marks (institute_id, exam_id, student_id);

CREATE INDEX IF NOT EXISTS idx_teacher_payrolls_inst_month 
    ON public.teacher_payrolls (institute_id, payroll_month);

CREATE INDEX IF NOT EXISTS idx_class_diaries_institute_created 
    ON public.class_diaries (institute_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_students_normalized_adm 
    ON public.students (regexp_replace(admission_no, '[^0-9]', '', 'g'));

CREATE INDEX IF NOT EXISTS idx_teachers_name_lower 
    ON public.teachers (lower(full_name));

-- 2. Domain & Integrity Check Constraints
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_fee_records_amount_non_negative'
    ) THEN
        ALTER TABLE public.fee_records 
            ADD CONSTRAINT chk_fee_records_amount_non_negative CHECK (amount >= 0 AND paid_amount >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_students_admission_no_length'
    ) THEN
        ALTER TABLE public.students 
            ADD CONSTRAINT chk_students_admission_no_length CHECK (char_length(trim(admission_no)) >= 2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_teachers_full_name_length'
    ) THEN
        ALTER TABLE public.teachers 
            ADD CONSTRAINT chk_teachers_full_name_length CHECK (char_length(trim(full_name)) >= 2);
    END IF;
END $$;

-- 3. Universal Login Identifier Resolver RPC
-- Maps student registration numbers (PC001, PC-2025-0001, 001) and faculty names (Avinash, Keshav, etc.)
-- to canonical auth accounts transparently.
CREATE OR REPLACE FUNCTION public.resolve_login_identifier(p_input text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_cleaned text;
  v_digits text;
  v_matched_email text;
  v_search_name text;
BEGIN
  IF p_input IS NULL OR trim(p_input) = '' THEN
    RETURN NULL;
  END IF;

  v_cleaned := lower(trim(p_input));

  -- 1. If it already contains an '@', return lowercased directly
  IF v_cleaned LIKE '%@%' THEN
    RETURN v_cleaned;
  END IF;

  -- 2. Check if student registration number (e.g. 'PC001', 'PC-2025-0001', 'pc01', '1', etc.)
  IF v_cleaned LIKE 'pc%' OR v_cleaned ~ '^[0-9]+$' THEN
    -- Extract only digits
    v_digits := regexp_replace(v_cleaned, '[^0-9]', '', 'g');

    -- Try direct match on admission_no or normalized digits
    SELECT lower(p.email) INTO v_matched_email
    FROM public.students s
    JOIN auth.users p ON p.id = s.profile_id
    WHERE lower(s.admission_no) = v_cleaned
       OR replace(lower(s.admission_no), '-', '') = replace(v_cleaned, '-', '')
       OR (length(v_digits) > 0 AND s.admission_no ILIKE '%' || lpad(v_digits, 4, '0'))
       OR (length(v_digits) > 0 AND regexp_replace(s.admission_no, '[^0-9]', '', 'g') = lpad(v_digits, 4, '0'))
    LIMIT 1;

    IF v_matched_email IS NOT NULL THEN
      RETURN v_matched_email;
    END IF;

    -- Canonical fallback if 1-4 digits
    IF length(v_digits) > 0 THEN
      RETURN 'pc-2025-' || lpad(v_digits, 4, '0') || '@student.pradeepclasses.in';
    END IF;
  END IF;

  -- 3. Check if faculty name or title (e.g. 'Avinash', 'Avinash Sir', 'Keshav', 'Pavan', etc.)
  v_search_name := regexp_replace(v_cleaned, '(^mr\.?\s+|^dr\.?\s+|\s+sir$)', '', 'gi');
  v_search_name := trim(v_search_name);

  SELECT lower(u.email) INTO v_matched_email
  FROM public.teachers t
  JOIN auth.users u ON u.id = t.profile_id
  WHERE lower(t.full_name) = v_cleaned
     OR lower(t.full_name) ILIKE '%' || v_search_name || '%'
     OR lower(regexp_replace(t.full_name, '(^mr\.?\s+|^dr\.?\s+|\s+sir$)', '', 'gi')) ILIKE '%' || v_search_name || '%'
  ORDER BY 
    CASE WHEN lower(t.full_name) = v_cleaned THEN 1
         WHEN lower(t.full_name) ILIKE v_search_name || '%' THEN 2
         ELSE 3 END
  LIMIT 1;

  IF v_matched_email IS NOT NULL THEN
    RETURN v_matched_email;
  END IF;

  -- 4. Check if Admin / Owner
  IF v_cleaned IN ('admin', 'owner', 'superadmin', 'administrator', 'director', 'pradeep') THEN
    RETURN 'admin@pradeepclasses.in';
  END IF;

  -- 5. Fallback as faculty handle
  RETURN v_cleaned || '@faculty.pradeepclasses.in';
END;
$$;

-- Grant execution to public / anon / authenticated
GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO anon, authenticated, service_role;

-- 4. Refresh Statistics
ANALYZE public.students;
ANALYZE public.teachers;
ANALYZE public.fee_records;
ANALYZE public.attendance_records;
ANALYZE public.batches;
