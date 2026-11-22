-- ============================================================================
-- Migration: 0018_erp_lifecycle_and_clean_handover.sql
-- Description: Universal ERP Lifecycle, Cascade Deletions, Crisis Recovery
--              Backup/Restore, Actionable Undo, and Pristine Clean Handover.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Student Status Expansion & Data Normalization
-- ----------------------------------------------------------------------------

-- Drop trigger depending on status column before type alteration
DROP TRIGGER IF EXISTS trg_enforce_student_batch_allocation ON public.students;

-- Drop default before type alteration
ALTER TABLE public.students ALTER COLUMN status DROP DEFAULT;
-- Ensure column is text so we can freely map and check canonical statuses
ALTER TABLE public.students ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.students ALTER COLUMN status SET DEFAULT 'active';

-- Recreate batch allocation trigger
CREATE TRIGGER trg_enforce_student_batch_allocation 
  BEFORE INSERT OR UPDATE OF batch_id, status, institute_id 
  ON public.students FOR EACH ROW 
  EXECUTE FUNCTION fn_enforce_student_batch_allocation();

-- Normalize existing values
UPDATE public.students SET status = 'archived' WHERE status IN ('inactive', 'Archived');
UPDATE public.students SET status = 'active' WHERE status = 'Active';
UPDATE public.students SET status = 'on_hold' WHERE status = 'On hold';

-- Enforce canonical 6 statuses
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE public.students ADD CONSTRAINT students_status_check 
  CHECK (status IN ('active', 'on_hold', 'alumni', 'rusticated', 'dropped_out', 'archived'));

-- Add student lifecycle metadata columns
ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS exit_date date;

-- Update batch transfer RPC to use text for v_student_status
CREATE OR REPLACE FUNCTION public.transfer_student_batch(
  p_student_id uuid,
  p_to_batch_id uuid,
  p_reason text DEFAULT 'Administrative Batch Transfer'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role app_role;
  v_caller_inst uuid;
  v_student_adm text;
  v_student_name text;
  v_old_batch_id uuid;
  v_student_inst uuid;
  v_student_status text;
  v_inst_active boolean;
  v_target_batch_name text;
  v_history_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated: Must be logged in to execute batch transfers';
  END IF;

  SELECT role, institute_id INTO v_caller_role, v_caller_inst
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin', 'super_admin') OR v_caller_inst IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only an institute Owner, Admin, or Super Admin can execute batch transfers';
  END IF;

  SELECT admission_no, full_name, batch_id, institute_id, status
  INTO v_student_adm, v_student_name, v_old_batch_id, v_student_inst, v_student_status
  FROM public.students
  WHERE id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student with ID % does not exist', p_student_id;
  END IF;

  IF v_caller_role != 'super_admin' AND v_student_inst IS DISTINCT FROM v_caller_inst THEN
    RAISE EXCEPTION 'Unauthorized: Caller institute % does not match student institute %',
      v_caller_inst, v_student_inst;
  END IF;

  IF v_student_status != 'active' THEN
    RAISE EXCEPTION 'Cannot transfer student %: student is currently % (must be active)',
      p_student_id, v_student_status;
  END IF;

  SELECT is_active INTO v_inst_active
  FROM public.institutes
  WHERE id = v_student_inst;

  IF v_inst_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot transfer student: Institute % is currently inactive', v_student_inst;
  END IF;

  IF v_old_batch_id IS NOT DISTINCT FROM p_to_batch_id THEN
    RAISE EXCEPTION 'Student is already enrolled in the specified batch';
  END IF;

  SELECT name INTO v_target_batch_name
  FROM public.batches
  WHERE id = p_to_batch_id
    AND institute_id = v_student_inst;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target batch % does not exist in the student institute', p_to_batch_id;
  END IF;

  INSERT INTO public.student_batch_history (
    student_id,
    from_batch_id,
    to_batch_id,
    transfer_date,
    reason,
    transferred_by,
    institute_id,
    student_name,
    student_admission_no,
    from_batch_name,
    to_batch_name,
    transferred_by_name
  )
  VALUES (
    p_student_id,
    v_old_batch_id,
    p_to_batch_id,
    now(),
    p_reason,
    auth.uid(),
    v_student_inst,
    v_student_name,
    v_student_adm,
    (SELECT name FROM public.batches WHERE id = v_old_batch_id),
    v_target_batch_name,
    (SELECT full_name FROM public.profiles WHERE id = auth.uid())
  )
  RETURNING id INTO v_history_id;

  UPDATE public.students
  SET batch_id = p_to_batch_id,
      updated_at = now()
  WHERE id = p_student_id;

  RETURN jsonb_build_object(
    'success', true,
    'student_id', p_student_id,
    'from_batch_id', v_old_batch_id,
    'to_batch_id', p_to_batch_id,
    'to_batch_name', v_target_batch_name,
    'history_id', v_history_id
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Teacher Status Expansion
-- ----------------------------------------------------------------------------

ALTER TABLE public.teachers 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS relieving_date date;

ALTER TABLE public.teachers DROP CONSTRAINT IF EXISTS teachers_status_check;
ALTER TABLE public.teachers ADD CONSTRAINT teachers_status_check
  CHECK (status IN ('active', 'on_leave', 'relieved'));

-- ----------------------------------------------------------------------------
-- 3. Backup & Crisis Recovery Schema
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.institute_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE DEFAULT '11111111-2222-3333-4444-555555555555'::uuid,
  backup_type text NOT NULL CHECK (backup_type IN ('automated_daily', 'manual_export', 'pre_restore_snapshot', 'pre_purge_snapshot')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  record_counts jsonb NOT NULL,
  snapshot_data jsonb NOT NULL,
  checksum text NOT NULL,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_institute_backups_inst_created ON public.institute_backups(institute_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_institute_backups_type ON public.institute_backups(backup_type);

ALTER TABLE public.institute_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institute_backups_owner_admin" ON public.institute_backups;
CREATE POLICY "institute_backups_owner_admin" ON public.institute_backups
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'super_admin')));

-- ----------------------------------------------------------------------------
-- 4. Actionable Audit Trail & Undo Table Extensions
-- ----------------------------------------------------------------------------

ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS previous_state jsonb,
  ADD COLUMN IF NOT EXISTS new_state jsonb,
  ADD COLUMN IF NOT EXISTS is_reverted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reverted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reverted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_reverted ON public.audit_logs(is_reverted, created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. Helper Function: Internal Institute Snapshot Generator
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._internal_export_institute_snapshot(p_institute_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_students jsonb;
  v_teachers jsonb;
  v_batches jsonb;
  v_timetables jsonb;
  v_att_sess jsonb;
  v_att_rec jsonb;
  v_class_sess jsonb;
  v_class_diaries jsonb;
  v_homework jsonb;
  v_hw_subs jsonb;
  v_exams jsonb;
  v_exam_marks jsonb;
  v_materials jsonb;
  v_announcements jsonb;
  v_fee_structs jsonb;
  v_fee_records jsonb;
  v_fee_payments jsonb;
  v_salary_configs jsonb;
  v_teacher_batches jsonb;
  v_teacher_payrolls jsonb;
  v_incomes jsonb;
  v_expenses jsonb;
  v_doubts jsonb;
  v_points jsonb;
  v_badges jsonb;
  v_streaks jsonb;
  v_docs jsonb;
  v_certs jsonb;
  v_progress jsonb;
  v_counts jsonb;
  v_tables jsonb;
  v_backup jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_students FROM public.students t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_teachers FROM public.teachers t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_batches FROM public.batches t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_timetables FROM public.timetables t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_att_sess FROM public.attendance_sessions t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_att_rec FROM public.attendance_records t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_class_sess FROM public.class_sessions t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_class_diaries FROM public.class_diaries t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_homework FROM public.homework t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_hw_subs FROM public.homework_submissions t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_exams FROM public.exams t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_exam_marks FROM public.exam_marks t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_materials FROM public.study_materials t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_announcements FROM public.announcements t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_fee_structs FROM public.fee_structures t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_fee_records FROM public.fee_records t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_fee_payments FROM public.fee_payments t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_salary_configs FROM public.teacher_salary_configs t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_teacher_batches FROM public.teacher_batches t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_teacher_payrolls FROM public.teacher_payrolls t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_incomes FROM public.institute_incomes t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_expenses FROM public.institute_expenses t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_doubts FROM public.student_doubts t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_points FROM public.student_points_ledger t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_badges FROM public.student_badges t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_streaks FROM public.student_streaks t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_docs FROM public.student_documents t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_certs FROM public.student_certificates t WHERE t.institute_id = p_institute_id;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_progress FROM public.batch_topic_progress t WHERE t.institute_id = p_institute_id;

  v_counts := jsonb_build_object(
    'students', jsonb_array_length(v_students),
    'teachers', jsonb_array_length(v_teachers),
    'batches', jsonb_array_length(v_batches),
    'timetables', jsonb_array_length(v_timetables),
    'attendance_sessions', jsonb_array_length(v_att_sess),
    'attendance_records', jsonb_array_length(v_att_rec),
    'class_sessions', jsonb_array_length(v_class_sess),
    'class_diaries', jsonb_array_length(v_class_diaries),
    'homework', jsonb_array_length(v_homework),
    'homework_submissions', jsonb_array_length(v_hw_subs),
    'exams', jsonb_array_length(v_exams),
    'exam_marks', jsonb_array_length(v_exam_marks),
    'study_materials', jsonb_array_length(v_materials),
    'announcements', jsonb_array_length(v_announcements),
    'fee_structures', jsonb_array_length(v_fee_structs),
    'fee_records', jsonb_array_length(v_fee_records),
    'fee_payments', jsonb_array_length(v_fee_payments),
    'teacher_salary_configs', jsonb_array_length(v_salary_configs),
    'teacher_batches', jsonb_array_length(v_teacher_batches),
    'teacher_payrolls', jsonb_array_length(v_teacher_payrolls),
    'institute_incomes', jsonb_array_length(v_incomes),
    'institute_expenses', jsonb_array_length(v_expenses),
    'student_doubts', jsonb_array_length(v_doubts),
    'student_points_ledger', jsonb_array_length(v_points),
    'student_badges', jsonb_array_length(v_badges),
    'student_streaks', jsonb_array_length(v_streaks),
    'student_documents', jsonb_array_length(v_docs),
    'student_certificates', jsonb_array_length(v_certs),
    'batch_topic_progress', jsonb_array_length(v_progress)
  );

  v_tables := jsonb_build_object(
    'batches', v_batches,
    'teachers', v_teachers,
    'students', v_students,
    'timetables', v_timetables,
    'attendance_sessions', v_att_sess,
    'attendance_records', v_att_rec,
    'class_sessions', v_class_sess,
    'class_diaries', v_class_diaries,
    'homework', v_homework,
    'homework_submissions', v_hw_subs,
    'exams', v_exams,
    'exam_marks', v_exam_marks,
    'study_materials', v_materials,
    'announcements', v_announcements,
    'fee_structures', v_fee_structs,
    'fee_records', v_fee_records,
    'fee_payments', v_fee_payments,
    'teacher_salary_configs', v_salary_configs,
    'teacher_batches', v_teacher_batches,
    'teacher_payrolls', v_teacher_payrolls,
    'institute_incomes', v_incomes,
    'institute_expenses', v_expenses,
    'student_doubts', v_doubts,
    'student_points_ledger', v_points,
    'student_badges', v_badges,
    'student_streaks', v_streaks,
    'student_documents', v_docs,
    'student_certificates', v_certs,
    'batch_topic_progress', v_progress
  );

  v_backup := jsonb_build_object(
    'version', '1.0',
    'institute_id', p_institute_id,
    'timestamp', now(),
    'counts', v_counts,
    'tables', v_tables
  );

  RETURN v_backup;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. RPC 1: admin_delete_student
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_delete_student(
  p_student_id UUID,
  p_force_cascade BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role public.app_role;
  v_caller_inst uuid;
  v_student record;
  v_att_count int;
  v_fee_rec_count int;
  v_fee_pay_count int;
  v_exam_count int;
  v_doubt_count int;
  v_hw_sub_count int;
  v_total_linked int;
  v_prev_state jsonb;
  v_prof_role public.app_role;
BEGIN
  -- 1. Authorization check
  v_caller_role := public.current_user_role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only Owner, Admin, or Super Admin can delete students';
  END IF;

  v_caller_inst := coalesce(public.current_user_institute_id(), '11111111-2222-3333-4444-555555555555'::uuid);

  -- 2. Fetch student
  SELECT * INTO v_student FROM public.students WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student not found');
  END IF;

  IF v_caller_role != 'super_admin' AND v_student.institute_id IS DISTINCT FROM v_caller_inst THEN
    RAISE EXCEPTION 'Unauthorized: Student belongs to another institute';
  END IF;

  -- 3. Check linked records
  SELECT count(*) INTO v_att_count FROM public.attendance_records WHERE student_id = p_student_id;
  SELECT count(*) INTO v_fee_rec_count FROM public.fee_records WHERE student_id = p_student_id;
  SELECT count(*) INTO v_fee_pay_count FROM public.fee_payments WHERE student_id = p_student_id;
  SELECT count(*) INTO v_exam_count FROM public.exam_marks WHERE student_id = p_student_id;
  SELECT count(*) INTO v_doubt_count FROM public.student_doubts WHERE student_id = p_student_id;
  SELECT count(*) INTO v_hw_sub_count FROM public.homework_submissions WHERE student_id = p_student_id;
  v_total_linked := v_att_count + v_fee_rec_count + v_fee_pay_count + v_exam_count + v_doubt_count + v_hw_sub_count;

  -- 4. If not force_cascade and child records exist, return warning
  IF NOT coalesce(p_force_cascade, false) AND v_total_linked > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'blocked', true,
      'message', 'Cannot delete student with historical records. Deactivate them instead or set force cascade to permanently delete.',
      'counts', jsonb_build_object(
        'attendance', v_att_count,
        'fee_records', v_fee_rec_count,
        'fee_payments', v_fee_pay_count,
        'exams', v_exam_count,
        'doubts', v_doubt_count,
        'homework_submissions', v_hw_sub_count,
        'total', v_total_linked
      )
    );
  END IF;

  -- 5. Force cascade delete
  v_prev_state := to_jsonb(v_student);

  DELETE FROM public.attendance_records WHERE student_id = p_student_id;
  DELETE FROM public.exam_marks WHERE student_id = p_student_id;
  DELETE FROM public.homework_submissions WHERE student_id = p_student_id;
  DELETE FROM public.student_doubts WHERE student_id = p_student_id;
  DELETE FROM public.student_points_ledger WHERE student_id = p_student_id;
  DELETE FROM public.student_badges WHERE student_id = p_student_id;
  DELETE FROM public.student_streaks WHERE student_id = p_student_id;
  DELETE FROM public.fee_payments WHERE student_id = p_student_id;
  DELETE FROM public.fee_records WHERE student_id = p_student_id;
  DELETE FROM public.student_documents WHERE student_id = p_student_id;
  DELETE FROM public.student_certificates WHERE student_id = p_student_id;
  DELETE FROM public.parent_students WHERE student_id = p_student_id;
  DELETE FROM public.student_batch_history WHERE student_id = p_student_id;
  DELETE FROM public.whatsapp_message_queue WHERE student_id = p_student_id;

  -- Remove linked student auth identity (never delete admin/owner/super_admin)
  IF v_student.profile_id IS NOT NULL THEN
    SELECT role INTO v_prof_role FROM public.profiles WHERE id = v_student.profile_id;
    IF v_prof_role IS NOT NULL AND v_prof_role NOT IN ('owner', 'admin', 'super_admin') THEN
      DELETE FROM public.profiles WHERE id = v_student.profile_id;
      DELETE FROM auth.users WHERE id = v_student.profile_id;
    END IF;
  END IF;

  DELETE FROM public.students WHERE id = p_student_id;

  -- Audit log
  INSERT INTO public.audit_logs (
    actor_id, action, table_name, record_id, institute_id,
    previous_state, before_data, created_at
  ) VALUES (
    auth.uid(),
    'DELETE_STUDENT',
    'students',
    p_student_id,
    v_student.institute_id,
    v_prev_state,
    v_prev_state,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_id', p_student_id,
    'message', 'Student and linked records successfully deleted'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. RPC 2: admin_delete_teacher
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_delete_teacher(
  p_teacher_id UUID,
  p_force_cascade BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role public.app_role;
  v_caller_inst uuid;
  v_teacher record;
  v_payroll_count int;
  v_batch_count int;
  v_session_count int;
  v_timetable_count int;
  v_total_linked int;
  v_prev_state jsonb;
  v_prof_role public.app_role;
BEGIN
  -- 1. Authorization check
  v_caller_role := public.current_user_role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only Owner, Admin, or Super Admin can delete faculty';
  END IF;

  v_caller_inst := coalesce(public.current_user_institute_id(), '11111111-2222-3333-4444-555555555555'::uuid);

  -- 2. Fetch teacher
  SELECT * INTO v_teacher FROM public.teachers WHERE id = p_teacher_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Teacher not found');
  END IF;

  IF v_caller_role != 'super_admin' AND v_teacher.institute_id IS DISTINCT FROM v_caller_inst THEN
    RAISE EXCEPTION 'Unauthorized: Teacher belongs to another institute';
  END IF;

  -- 3. Check linked records
  SELECT count(*) INTO v_payroll_count FROM public.teacher_payrolls WHERE teacher_id = p_teacher_id;
  SELECT count(*) INTO v_batch_count FROM public.teacher_batches WHERE teacher_id = p_teacher_id;
  SELECT count(*) INTO v_session_count FROM public.class_sessions WHERE teacher_id = p_teacher_id;
  SELECT count(*) INTO v_timetable_count FROM public.timetables WHERE teacher_id = p_teacher_id;
  v_total_linked := v_payroll_count + v_batch_count + v_session_count + v_timetable_count;

  -- 4. If not force_cascade and child records exist, return warning
  IF NOT coalesce(p_force_cascade, false) AND v_total_linked > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'blocked', true,
      'message', 'Cannot delete faculty member with historical payroll, batches, or sessions. Mark them as relieved instead or set force cascade to permanently delete.',
      'counts', jsonb_build_object(
        'payroll', v_payroll_count,
        'batches', v_batch_count,
        'sessions', v_session_count,
        'timetables', v_timetable_count,
        'total', v_total_linked
      )
    );
  END IF;

  -- 5. Force cascade delete
  v_prev_state := to_jsonb(v_teacher);

  -- Remove linked payroll expenses if any
  DELETE FROM public.institute_expenses WHERE id IN (
    SELECT expense_id FROM public.teacher_payrolls WHERE teacher_id = p_teacher_id AND expense_id IS NOT NULL
  );
  DELETE FROM public.teacher_payrolls WHERE teacher_id = p_teacher_id;
  DELETE FROM public.teacher_salary_configs WHERE teacher_id = p_teacher_id;
  DELETE FROM public.teacher_batches WHERE teacher_id = p_teacher_id;

  -- Delete class diaries and class sessions
  DELETE FROM public.class_diaries WHERE session_id IN (
    SELECT id FROM public.class_sessions WHERE teacher_id = p_teacher_id
  );
  DELETE FROM public.class_sessions WHERE teacher_id = p_teacher_id;

  -- Unlink timetables
  UPDATE public.timetables SET teacher_id = NULL WHERE teacher_id = p_teacher_id;

  -- Handle linked teacher profile if any
  IF v_teacher.profile_id IS NOT NULL THEN
    UPDATE public.student_doubts SET responded_by = NULL WHERE responded_by = v_teacher.profile_id;
    UPDATE public.class_diaries SET created_by = NULL WHERE created_by = v_teacher.profile_id;
    UPDATE public.student_points_ledger SET awarded_by = NULL WHERE awarded_by = v_teacher.profile_id;
    UPDATE public.homework_submissions SET graded_by = NULL WHERE graded_by = v_teacher.profile_id;

    SELECT role INTO v_prof_role FROM public.profiles WHERE id = v_teacher.profile_id;
    IF v_prof_role IS NOT NULL AND v_prof_role NOT IN ('owner', 'admin', 'super_admin') THEN
      DELETE FROM public.profiles WHERE id = v_teacher.profile_id;
      DELETE FROM auth.users WHERE id = v_teacher.profile_id;
    END IF;
  END IF;

  DELETE FROM public.teachers WHERE id = p_teacher_id;

  INSERT INTO public.audit_logs (
    actor_id, action, table_name, record_id, institute_id,
    previous_state, before_data, created_at
  ) VALUES (
    auth.uid(),
    'DELETE_TEACHER',
    'teachers',
    p_teacher_id,
    v_teacher.institute_id,
    v_prev_state,
    v_prev_state,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_id', p_teacher_id,
    'message', 'Faculty member and linked records successfully deleted'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. RPC 3: admin_delete_batch
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_delete_batch(
  p_batch_id UUID,
  p_force_cascade BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role public.app_role;
  v_caller_inst uuid;
  v_batch record;
  v_student_count int;
  v_tt_count int;
  v_att_sess_count int;
  v_total_linked int;
  v_prev_state jsonb;
BEGIN
  -- 1. Authorization check
  v_caller_role := public.current_user_role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only Owner, Admin, or Super Admin can delete batches';
  END IF;

  v_caller_inst := coalesce(public.current_user_institute_id(), '11111111-2222-3333-4444-555555555555'::uuid);

  -- 2. Fetch batch
  SELECT * INTO v_batch FROM public.batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Batch not found');
  END IF;

  IF v_caller_role != 'super_admin' AND v_batch.institute_id IS DISTINCT FROM v_caller_inst THEN
    RAISE EXCEPTION 'Unauthorized: Batch belongs to another institute';
  END IF;

  -- 3. Check linked records
  SELECT count(*) INTO v_student_count FROM public.students WHERE batch_id = p_batch_id;
  SELECT count(*) INTO v_tt_count FROM public.timetables WHERE batch_id = p_batch_id;
  SELECT count(*) INTO v_att_sess_count FROM public.attendance_sessions WHERE batch_id = p_batch_id;
  v_total_linked := v_student_count + v_tt_count + v_att_sess_count;

  -- 4. If not force_cascade and child records exist, return warning
  IF NOT coalesce(p_force_cascade, false) AND v_total_linked > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'blocked', true,
      'message', 'Cannot delete batch with enrolled students or scheduled sessions. Set force cascade to permanently delete.',
      'counts', jsonb_build_object(
        'students', v_student_count,
        'timetables', v_tt_count,
        'attendance_sessions', v_att_sess_count,
        'total', v_total_linked
      )
    );
  END IF;

  -- 5. Force cascade delete
  v_prev_state := to_jsonb(v_batch);

  -- Unassign enrolled students (frees seat count)
  UPDATE public.students SET batch_id = NULL, batch_name = NULL WHERE batch_id = p_batch_id;

  -- Cascade child tables
  DELETE FROM public.teacher_batches WHERE batch_id = p_batch_id;
  DELETE FROM public.timetables WHERE batch_id = p_batch_id;

  DELETE FROM public.attendance_records WHERE session_id IN (
    SELECT id FROM public.attendance_sessions WHERE batch_id = p_batch_id
  );
  DELETE FROM public.attendance_sessions WHERE batch_id = p_batch_id;

  DELETE FROM public.class_diaries WHERE session_id IN (
    SELECT id FROM public.class_sessions WHERE batch_id = p_batch_id
  );
  DELETE FROM public.class_sessions WHERE batch_id = p_batch_id;

  DELETE FROM public.batch_topic_progress WHERE batch_id = p_batch_id;

  DELETE FROM public.homework_submissions WHERE homework_id IN (
    SELECT id FROM public.homework WHERE batch_id = p_batch_id
  );
  DELETE FROM public.homework WHERE batch_id = p_batch_id;

  DELETE FROM public.exam_marks WHERE exam_id IN (
    SELECT id FROM public.exams WHERE batch_id = p_batch_id
  );
  DELETE FROM public.exams WHERE batch_id = p_batch_id;

  DELETE FROM public.study_materials WHERE batch_id = p_batch_id;
  DELETE FROM public.announcements WHERE target_batch_id = p_batch_id;

  UPDATE public.student_doubts SET batch_id = NULL WHERE batch_id = p_batch_id;
  UPDATE public.student_batch_history SET from_batch_id = NULL WHERE from_batch_id = p_batch_id;
  UPDATE public.student_batch_history SET to_batch_id = NULL WHERE to_batch_id = p_batch_id;

  DELETE FROM public.batches WHERE id = p_batch_id;

  INSERT INTO public.audit_logs (
    actor_id, action, table_name, record_id, institute_id,
    previous_state, before_data, created_at
  ) VALUES (
    auth.uid(),
    'DELETE_BATCH',
    'batches',
    p_batch_id,
    v_batch.institute_id,
    v_prev_state,
    v_prev_state,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_id', p_batch_id,
    'message', 'Batch and associated schedules successfully deleted'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. RPC 4: admin_delete_payroll_record
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_delete_payroll_record(p_payroll_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role public.app_role;
  v_caller_inst uuid;
  v_payroll record;
  v_prev_state jsonb;
BEGIN
  -- 1. Authorization check
  v_caller_role := public.current_user_role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only Owner, Admin, or Super Admin can delete payroll records';
  END IF;

  v_caller_inst := coalesce(public.current_user_institute_id(), '11111111-2222-3333-4444-555555555555'::uuid);

  -- 2. Fetch payroll record
  SELECT * INTO v_payroll FROM public.teacher_payrolls WHERE id = p_payroll_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payroll record not found');
  END IF;

  IF v_caller_role != 'super_admin' AND v_payroll.institute_id IS DISTINCT FROM v_caller_inst THEN
    RAISE EXCEPTION 'Unauthorized: Payroll record belongs to another institute';
  END IF;

  v_prev_state := to_jsonb(v_payroll);

  -- Clean up linked expense if any
  IF v_payroll.expense_id IS NOT NULL THEN
    DELETE FROM public.institute_expenses WHERE id = v_payroll.expense_id;
  END IF;

  DELETE FROM public.teacher_payrolls WHERE id = p_payroll_id;

  INSERT INTO public.audit_logs (
    actor_id, action, table_name, record_id, institute_id,
    previous_state, before_data, created_at
  ) VALUES (
    auth.uid(),
    'DELETE_PAYROLL',
    'teacher_payrolls',
    p_payroll_id,
    v_payroll.institute_id,
    v_prev_state,
    v_prev_state,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_id', p_payroll_id,
    'message', 'Payroll record successfully deleted'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. RPC 5: admin_export_institute_backup
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_export_institute_backup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role public.app_role;
  v_caller_inst uuid;
  v_backup jsonb;
  v_checksum text;
  v_backup_id uuid;
BEGIN
  -- 1. Authorization check
  v_caller_role := public.current_user_role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only Owner or Super Admin can export full database backups';
  END IF;

  v_caller_inst := coalesce(public.current_user_institute_id(), '11111111-2222-3333-4444-555555555555'::uuid);

  -- 2. Generate backup JSON snapshot
  v_backup := public._internal_export_institute_snapshot(v_caller_inst);
  v_checksum := md5(v_backup::text);

  -- 3. Save snapshot to institute_backups
  INSERT INTO public.institute_backups (
    institute_id,
    backup_type,
    created_at,
    created_by,
    record_counts,
    snapshot_data,
    checksum,
    notes
  ) VALUES (
    v_caller_inst,
    'manual_export',
    now(),
    auth.uid(),
    v_backup->'counts',
    v_backup,
    v_checksum,
    'Manual export via admin_export_institute_backup'
  ) RETURNING id INTO v_backup_id;

  RETURN v_backup || jsonb_build_object('backup_id', v_backup_id, 'checksum', v_checksum);
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. RPC 6: admin_restore_institute_backup
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_restore_institute_backup(p_backup_json jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role public.app_role;
  v_caller_inst uuid;
  v_target_inst uuid;
  v_snapshot jsonb;
  v_checksum text;
  v_pre_backup_id uuid;
  v_tables jsonb;
BEGIN
  -- 1. Authorization check
  v_caller_role := public.current_user_role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only Owner or Super Admin can restore database backups';
  END IF;

  -- 2. Validate payload format
  IF p_backup_json IS NULL 
     OR (p_backup_json->>'version') IS DISTINCT FROM '1.0' 
     OR (p_backup_json->'tables') IS NULL 
     OR jsonb_typeof(p_backup_json->'tables') != 'object' THEN
    RAISE EXCEPTION 'Invalid backup payload: must be JSON with version "1.0" and a valid "tables" object';
  END IF;

  v_caller_inst := coalesce(public.current_user_institute_id(), '11111111-2222-3333-4444-555555555555'::uuid);
  v_target_inst := v_caller_inst;

  -- 3. Automatic Pre-Restore Safety Snapshot!
  v_snapshot := public._internal_export_institute_snapshot(v_target_inst);
  v_checksum := md5(v_snapshot::text);

  INSERT INTO public.institute_backups (
    institute_id,
    backup_type,
    created_at,
    created_by,
    record_counts,
    snapshot_data,
    checksum,
    notes
  ) VALUES (
    v_target_inst,
    'pre_restore_snapshot',
    now(),
    auth.uid(),
    v_snapshot->'counts',
    v_snapshot,
    v_checksum,
    'Automatic pre-restore safety snapshot before restoring backup'
  ) RETURNING id INTO v_pre_backup_id;

  -- 4. Clear current operational data for target institute in reverse FK order
  DELETE FROM public.student_doubts WHERE institute_id = v_target_inst;
  DELETE FROM public.student_points_ledger WHERE institute_id = v_target_inst;
  DELETE FROM public.student_badges WHERE institute_id = v_target_inst;
  DELETE FROM public.student_streaks WHERE institute_id = v_target_inst;
  DELETE FROM public.student_documents WHERE institute_id = v_target_inst;
  DELETE FROM public.student_certificates WHERE institute_id = v_target_inst;
  DELETE FROM public.parent_students WHERE institute_id = v_target_inst;
  DELETE FROM public.student_batch_history WHERE institute_id = v_target_inst;
  DELETE FROM public.whatsapp_message_queue WHERE institute_id = v_target_inst;
  DELETE FROM public.attendance_records WHERE institute_id = v_target_inst;
  DELETE FROM public.attendance_sessions WHERE institute_id = v_target_inst;
  DELETE FROM public.homework_submissions WHERE institute_id = v_target_inst;
  DELETE FROM public.homework WHERE institute_id = v_target_inst;
  DELETE FROM public.exam_marks WHERE institute_id = v_target_inst;
  DELETE FROM public.exams WHERE institute_id = v_target_inst;
  DELETE FROM public.class_diaries WHERE institute_id = v_target_inst;
  DELETE FROM public.class_sessions WHERE institute_id = v_target_inst;
  DELETE FROM public.timetables WHERE institute_id = v_target_inst;
  DELETE FROM public.study_materials WHERE institute_id = v_target_inst;
  DELETE FROM public.announcements WHERE institute_id = v_target_inst;
  DELETE FROM public.batch_topic_progress WHERE institute_id = v_target_inst;
  DELETE FROM public.fee_payments WHERE institute_id = v_target_inst;
  DELETE FROM public.fee_records WHERE institute_id = v_target_inst;
  DELETE FROM public.fee_structures WHERE institute_id = v_target_inst;
  DELETE FROM public.teacher_payrolls WHERE institute_id = v_target_inst;
  DELETE FROM public.teacher_salary_configs WHERE institute_id = v_target_inst;
  DELETE FROM public.teacher_batches WHERE institute_id = v_target_inst;
  DELETE FROM public.institute_expenses WHERE institute_id = v_target_inst;
  DELETE FROM public.institute_incomes WHERE institute_id = v_target_inst;
  DELETE FROM public.students WHERE institute_id = v_target_inst;
  DELETE FROM public.teachers WHERE institute_id = v_target_inst;
  DELETE FROM public.batches WHERE institute_id = v_target_inst;

  v_tables := p_backup_json->'tables';

  -- 5. Restore tables in dependency order
  IF jsonb_typeof(v_tables->'batches') = 'array' AND jsonb_array_length(v_tables->'batches') > 0 THEN
    INSERT INTO public.batches SELECT * FROM jsonb_populate_recordset(null::public.batches, v_tables->'batches')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'teachers') = 'array' AND jsonb_array_length(v_tables->'teachers') > 0 THEN
    INSERT INTO public.teachers
    SELECT
      r.id,
      CASE WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = r.profile_id) THEN r.profile_id ELSE NULL END,
      r.full_name, r.subject, r.phone, r.is_active, r.created_at, r.institute_id,
      coalesce(r.status, 'active'), r.status_reason, coalesce(r.status_changed_at, now()), r.relieving_date
    FROM jsonb_populate_recordset(null::public.teachers, v_tables->'teachers') r
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'students') = 'array' AND jsonb_array_length(v_tables->'students') > 0 THEN
    INSERT INTO public.students
    SELECT
      r.id, r.admission_no, r.full_name, r.class_name, r.batch_name, r.batch_id,
      r.phone, r.parent_name, r.parent_phone, coalesce(r.status, 'active'), r.joined_on, r.created_at,
      r.updated_at,
      CASE WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = r.profile_id) THEN r.profile_id ELSE NULL END,
      r.institute_id, r.email, r.date_of_birth, r.gender, r.address, r.city,
      r.emergency_contact, r.parent_relation, r.parent_email, r.notes, r.photo_url,
      r.roll_no, r.status_reason, coalesce(r.status_changed_at, now()), r.exit_date
    FROM jsonb_populate_recordset(null::public.students, v_tables->'students') r
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'timetables') = 'array' AND jsonb_array_length(v_tables->'timetables') > 0 THEN
    INSERT INTO public.timetables SELECT * FROM jsonb_populate_recordset(null::public.timetables, v_tables->'timetables')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'attendance_sessions') = 'array' AND jsonb_array_length(v_tables->'attendance_sessions') > 0 THEN
    INSERT INTO public.attendance_sessions SELECT * FROM jsonb_populate_recordset(null::public.attendance_sessions, v_tables->'attendance_sessions')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'attendance_records') = 'array' AND jsonb_array_length(v_tables->'attendance_records') > 0 THEN
    INSERT INTO public.attendance_records SELECT * FROM jsonb_populate_recordset(null::public.attendance_records, v_tables->'attendance_records')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'class_sessions') = 'array' AND jsonb_array_length(v_tables->'class_sessions') > 0 THEN
    INSERT INTO public.class_sessions SELECT * FROM jsonb_populate_recordset(null::public.class_sessions, v_tables->'class_sessions')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'class_diaries') = 'array' AND jsonb_array_length(v_tables->'class_diaries') > 0 THEN
    INSERT INTO public.class_diaries SELECT * FROM jsonb_populate_recordset(null::public.class_diaries, v_tables->'class_diaries')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'homework') = 'array' AND jsonb_array_length(v_tables->'homework') > 0 THEN
    INSERT INTO public.homework SELECT * FROM jsonb_populate_recordset(null::public.homework, v_tables->'homework')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'homework_submissions') = 'array' AND jsonb_array_length(v_tables->'homework_submissions') > 0 THEN
    INSERT INTO public.homework_submissions SELECT * FROM jsonb_populate_recordset(null::public.homework_submissions, v_tables->'homework_submissions')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'exams') = 'array' AND jsonb_array_length(v_tables->'exams') > 0 THEN
    INSERT INTO public.exams SELECT * FROM jsonb_populate_recordset(null::public.exams, v_tables->'exams')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'exam_marks') = 'array' AND jsonb_array_length(v_tables->'exam_marks') > 0 THEN
    INSERT INTO public.exam_marks SELECT * FROM jsonb_populate_recordset(null::public.exam_marks, v_tables->'exam_marks')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'study_materials') = 'array' AND jsonb_array_length(v_tables->'study_materials') > 0 THEN
    INSERT INTO public.study_materials SELECT * FROM jsonb_populate_recordset(null::public.study_materials, v_tables->'study_materials')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'announcements') = 'array' AND jsonb_array_length(v_tables->'announcements') > 0 THEN
    INSERT INTO public.announcements SELECT * FROM jsonb_populate_recordset(null::public.announcements, v_tables->'announcements')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'fee_structures') = 'array' AND jsonb_array_length(v_tables->'fee_structures') > 0 THEN
    INSERT INTO public.fee_structures SELECT * FROM jsonb_populate_recordset(null::public.fee_structures, v_tables->'fee_structures')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'fee_records') = 'array' AND jsonb_array_length(v_tables->'fee_records') > 0 THEN
    INSERT INTO public.fee_records SELECT * FROM jsonb_populate_recordset(null::public.fee_records, v_tables->'fee_records')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'fee_payments') = 'array' AND jsonb_array_length(v_tables->'fee_payments') > 0 THEN
    INSERT INTO public.fee_payments SELECT * FROM jsonb_populate_recordset(null::public.fee_payments, v_tables->'fee_payments')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'teacher_salary_configs') = 'array' AND jsonb_array_length(v_tables->'teacher_salary_configs') > 0 THEN
    INSERT INTO public.teacher_salary_configs SELECT * FROM jsonb_populate_recordset(null::public.teacher_salary_configs, v_tables->'teacher_salary_configs')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'teacher_batches') = 'array' AND jsonb_array_length(v_tables->'teacher_batches') > 0 THEN
    INSERT INTO public.teacher_batches SELECT * FROM jsonb_populate_recordset(null::public.teacher_batches, v_tables->'teacher_batches')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'teacher_payrolls') = 'array' AND jsonb_array_length(v_tables->'teacher_payrolls') > 0 THEN
    INSERT INTO public.teacher_payrolls SELECT * FROM jsonb_populate_recordset(null::public.teacher_payrolls, v_tables->'teacher_payrolls')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'institute_incomes') = 'array' AND jsonb_array_length(v_tables->'institute_incomes') > 0 THEN
    INSERT INTO public.institute_incomes SELECT * FROM jsonb_populate_recordset(null::public.institute_incomes, v_tables->'institute_incomes')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'institute_expenses') = 'array' AND jsonb_array_length(v_tables->'institute_expenses') > 0 THEN
    INSERT INTO public.institute_expenses SELECT * FROM jsonb_populate_recordset(null::public.institute_expenses, v_tables->'institute_expenses')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'student_doubts') = 'array' AND jsonb_array_length(v_tables->'student_doubts') > 0 THEN
    INSERT INTO public.student_doubts SELECT * FROM jsonb_populate_recordset(null::public.student_doubts, v_tables->'student_doubts')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'student_points_ledger') = 'array' AND jsonb_array_length(v_tables->'student_points_ledger') > 0 THEN
    INSERT INTO public.student_points_ledger SELECT * FROM jsonb_populate_recordset(null::public.student_points_ledger, v_tables->'student_points_ledger')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'student_badges') = 'array' AND jsonb_array_length(v_tables->'student_badges') > 0 THEN
    INSERT INTO public.student_badges SELECT * FROM jsonb_populate_recordset(null::public.student_badges, v_tables->'student_badges')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'student_streaks') = 'array' AND jsonb_array_length(v_tables->'student_streaks') > 0 THEN
    INSERT INTO public.student_streaks SELECT * FROM jsonb_populate_recordset(null::public.student_streaks, v_tables->'student_streaks')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'student_documents') = 'array' AND jsonb_array_length(v_tables->'student_documents') > 0 THEN
    INSERT INTO public.student_documents SELECT * FROM jsonb_populate_recordset(null::public.student_documents, v_tables->'student_documents')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'student_certificates') = 'array' AND jsonb_array_length(v_tables->'student_certificates') > 0 THEN
    INSERT INTO public.student_certificates SELECT * FROM jsonb_populate_recordset(null::public.student_certificates, v_tables->'student_certificates')
    ON CONFLICT DO NOTHING;
  END IF;

  IF jsonb_typeof(v_tables->'batch_topic_progress') = 'array' AND jsonb_array_length(v_tables->'batch_topic_progress') > 0 THEN
    INSERT INTO public.batch_topic_progress SELECT * FROM jsonb_populate_recordset(null::public.batch_topic_progress, v_tables->'batch_topic_progress')
    ON CONFLICT DO NOTHING;
  END IF;

  -- 6. Audit log
  INSERT INTO public.audit_logs (
    actor_id, action, table_name, institute_id,
    new_state, created_at
  ) VALUES (
    auth.uid(),
    'RESTORE_INSTITUTE_BACKUP',
    'institutes',
    v_target_inst,
    jsonb_build_object('pre_restore_snapshot_id', v_pre_backup_id, 'restored_counts', p_backup_json->'counts'),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Institute backup restored successfully',
    'pre_restore_snapshot_id', v_pre_backup_id,
    'restored_counts', p_backup_json->'counts'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. RPC 7: admin_undo_audit_action
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_undo_audit_action(p_audit_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role public.app_role;
  v_log record;
  v_prev jsonb;
  v_table_name text;
  v_record_id uuid;
BEGIN
  -- 1. Authorization check
  v_caller_role := public.current_user_role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only Owner, Admin, or Super Admin can revert actions';
  END IF;

  -- 2. Fetch audit log entry
  SELECT * INTO v_log FROM public.audit_logs WHERE id = p_audit_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audit log entry not found');
  END IF;

  IF v_log.is_reverted IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'This action has already been reverted');
  END IF;

  v_prev := coalesce(v_log.previous_state, v_log.before_data);
  IF v_prev IS NULL OR v_prev = 'null'::jsonb THEN
    RETURN jsonb_build_object('success', false, 'error', 'No previous state available to revert to');
  END IF;

  v_table_name := v_log.table_name;
  v_record_id := v_log.record_id;

  -- 3. Perform reversion based on table
  IF v_table_name = 'students' THEN
    IF EXISTS (SELECT 1 FROM public.students WHERE id = v_record_id) THEN
      UPDATE public.students SET
        status = coalesce(v_prev->>'status', status),
        status_reason = v_prev->>'status_reason',
        status_changed_at = coalesce((v_prev->>'status_changed_at')::timestamptz, now()),
        exit_date = (v_prev->>'exit_date')::date,
        full_name = coalesce(v_prev->>'full_name', full_name),
        class_name = coalesce(v_prev->>'class_name', class_name),
        batch_name = v_prev->>'batch_name',
        batch_id = (v_prev->>'batch_id')::uuid,
        phone = v_prev->>'phone',
        parent_name = v_prev->>'parent_name',
        parent_phone = v_prev->>'parent_phone',
        email = v_prev->>'email',
        roll_no = v_prev->>'roll_no',
        updated_at = now()
      WHERE id = v_record_id;
    ELSE
      INSERT INTO public.students SELECT * FROM jsonb_populate_record(null::public.students, v_prev)
      ON CONFLICT (id) DO NOTHING;
    END IF;

  ELSIF v_table_name = 'teachers' THEN
    IF EXISTS (SELECT 1 FROM public.teachers WHERE id = v_record_id) THEN
      UPDATE public.teachers SET
        status = coalesce(v_prev->>'status', status),
        status_reason = v_prev->>'status_reason',
        status_changed_at = coalesce((v_prev->>'status_changed_at')::timestamptz, now()),
        relieving_date = (v_prev->>'relieving_date')::date,
        full_name = coalesce(v_prev->>'full_name', full_name),
        subject = coalesce(v_prev->>'subject', subject),
        phone = v_prev->>'phone',
        is_active = coalesce((v_prev->>'is_active')::boolean, is_active)
      WHERE id = v_record_id;
    ELSE
      INSERT INTO public.teachers SELECT * FROM jsonb_populate_record(null::public.teachers, v_prev)
      ON CONFLICT (id) DO NOTHING;
    END IF;

  ELSIF v_table_name = 'batches' THEN
    IF EXISTS (SELECT 1 FROM public.batches WHERE id = v_record_id) THEN
      UPDATE public.batches SET
        name = coalesce(v_prev->>'name', name),
        course_name = coalesce(v_prev->>'course_name', course_name),
        academic_year = v_prev->>'academic_year',
        is_active = coalesce((v_prev->>'is_active')::boolean, is_active)
      WHERE id = v_record_id;
    ELSE
      INSERT INTO public.batches SELECT * FROM jsonb_populate_record(null::public.batches, v_prev)
      ON CONFLICT (id) DO NOTHING;
    END IF;

  ELSIF v_table_name = 'teacher_payrolls' THEN
    IF EXISTS (SELECT 1 FROM public.teacher_payrolls WHERE id = v_record_id) THEN
      UPDATE public.teacher_payrolls SET
        status = coalesce(v_prev->>'status', status),
        net_amount = coalesce((v_prev->>'net_amount')::numeric, net_amount),
        paid_at = (v_prev->>'paid_at')::timestamptz
      WHERE id = v_record_id;
    ELSE
      INSERT INTO public.teacher_payrolls SELECT * FROM jsonb_populate_record(null::public.teacher_payrolls, v_prev)
      ON CONFLICT (id) DO NOTHING;
    END IF;

  ELSE
    -- Generic restoration attempt
    BEGIN
      EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(null::public.%I, $1) ON CONFLICT (id) DO NOTHING', v_table_name, v_table_name)
      USING v_prev;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 4. Mark audit log entry as reverted
  UPDATE public.audit_logs SET
    is_reverted = true,
    reverted_at = now(),
    reverted_by = auth.uid()
  WHERE id = p_audit_id;

  -- 5. Record reversion in audit log
  INSERT INTO public.audit_logs (
    actor_id, action, table_name, record_id, institute_id,
    previous_state, new_state, created_at
  ) VALUES (
    auth.uid(),
    'UNDO_' || coalesce(v_log.action, 'ACTION'),
    v_log.table_name,
    v_record_id,
    v_log.institute_id,
    coalesce(v_log.new_state, v_log.after_data),
    v_prev,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'reverted_id', p_audit_id,
    'table_name', v_table_name,
    'record_id', v_record_id,
    'message', 'Action successfully undone'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 13. RPC 8: admin_purge_demo_data
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_purge_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role public.app_role;
  v_caller_inst uuid;
  v_snapshot jsonb;
  v_checksum text;
  v_backup_id uuid;
BEGIN
  -- 1. Authorization check
  v_caller_role := public.current_user_role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only Owner or Super Admin can purge demo data';
  END IF;

  v_caller_inst := coalesce(public.current_user_institute_id(), '11111111-2222-3333-4444-555555555555'::uuid);

  -- 2. Pre-purge safety snapshot
  v_snapshot := public._internal_export_institute_snapshot(v_caller_inst);
  v_checksum := md5(v_snapshot::text);

  INSERT INTO public.institute_backups (
    institute_id,
    backup_type,
    created_at,
    created_by,
    record_counts,
    snapshot_data,
    checksum,
    notes
  ) VALUES (
    v_caller_inst,
    'pre_purge_snapshot',
    now(),
    auth.uid(),
    v_snapshot->'counts',
    v_snapshot,
    v_checksum,
    'Automatic pre-purge snapshot before clearing demo data'
  ) RETURNING id INTO v_backup_id;

  -- 3. Clear operational records in reverse FK order
  DELETE FROM public.student_doubts WHERE institute_id = v_caller_inst;
  DELETE FROM public.student_points_ledger WHERE institute_id = v_caller_inst;
  DELETE FROM public.student_badges WHERE institute_id = v_caller_inst;
  DELETE FROM public.student_streaks WHERE institute_id = v_caller_inst;
  DELETE FROM public.student_documents WHERE institute_id = v_caller_inst;
  DELETE FROM public.student_certificates WHERE institute_id = v_caller_inst;
  DELETE FROM public.parent_students WHERE institute_id = v_caller_inst;
  DELETE FROM public.student_batch_history WHERE institute_id = v_caller_inst;
  DELETE FROM public.whatsapp_message_queue WHERE institute_id = v_caller_inst;
  DELETE FROM public.attendance_records WHERE institute_id = v_caller_inst;
  DELETE FROM public.attendance_sessions WHERE institute_id = v_caller_inst;
  DELETE FROM public.homework_submissions WHERE institute_id = v_caller_inst;
  DELETE FROM public.homework WHERE institute_id = v_caller_inst;
  DELETE FROM public.exam_marks WHERE institute_id = v_caller_inst;
  DELETE FROM public.exams WHERE institute_id = v_caller_inst;
  DELETE FROM public.class_diaries WHERE institute_id = v_caller_inst;
  DELETE FROM public.class_sessions WHERE institute_id = v_caller_inst;
  DELETE FROM public.timetables WHERE institute_id = v_caller_inst;
  DELETE FROM public.study_materials WHERE institute_id = v_caller_inst;
  DELETE FROM public.announcements WHERE institute_id = v_caller_inst;
  DELETE FROM public.batch_topic_progress WHERE institute_id = v_caller_inst;
  DELETE FROM public.fee_payments WHERE institute_id = v_caller_inst;
  DELETE FROM public.fee_records WHERE institute_id = v_caller_inst;
  DELETE FROM public.fee_structures WHERE institute_id = v_caller_inst;
  DELETE FROM public.teacher_payrolls WHERE institute_id = v_caller_inst;
  DELETE FROM public.teacher_salary_configs WHERE institute_id = v_caller_inst;
  DELETE FROM public.teacher_batches WHERE institute_id = v_caller_inst;
  DELETE FROM public.institute_expenses WHERE institute_id = v_caller_inst;
  DELETE FROM public.institute_incomes WHERE institute_id = v_caller_inst;
  DELETE FROM public.students WHERE institute_id = v_caller_inst;
  DELETE FROM public.teachers WHERE institute_id = v_caller_inst;
  DELETE FROM public.batches WHERE institute_id = v_caller_inst;

  -- 4. Clean demo user accounts: strictly preserve owner, admin, super_admin
  DELETE FROM auth.users
  WHERE id IN (
    SELECT id FROM public.profiles
    WHERE institute_id = v_caller_inst
      AND role NOT IN ('owner', 'admin', 'super_admin')
  );

  DELETE FROM public.profiles
  WHERE institute_id = v_caller_inst
    AND role NOT IN ('owner', 'admin', 'super_admin');

  -- 5. Audit log
  INSERT INTO public.audit_logs (
    actor_id, action, table_name, institute_id,
    new_state, created_at
  ) VALUES (
    auth.uid(),
    'PURGE_DEMO_DATA',
    'institutes',
    v_caller_inst,
    jsonb_build_object('pre_purge_snapshot_id', v_backup_id, 'purged_counts', v_snapshot->'counts'),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Demo data successfully purged. Institute is ready for clean onboarding.',
    'snapshot_id', v_backup_id,
    'purged_counts', v_snapshot->'counts'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 14. Grants
-- ----------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.admin_delete_student(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_teacher(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_batch(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_payroll_record(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_export_institute_backup() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_institute_backup(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_undo_audit_action(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_purge_demo_data() TO authenticated;
