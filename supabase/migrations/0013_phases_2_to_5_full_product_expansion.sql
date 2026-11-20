-- Migration 0013: Full Product Expansion (Phases 2 through 5)
--
-- Phase 2: Class Sessions, Teacher Class Diary & Syllabus Tracking
-- Phase 3: Student Motivation, Gamification, Points & Badges
-- Phase 4: Student Document Vault & Certificate Studio
-- Phase 5: Super Admin Platform Controls & Multi-Institute Architecture

-- ============================================================================
-- PHASE 2: ACADEMIC DELIVERY, CLASS DIARY & SYLLABUS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL DEFAULT '11111111-2222-3333-4444-555555555555'::uuid REFERENCES public.institutes(id),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  timetable_id uuid REFERENCES public.timetables(id) ON DELETE SET NULL,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  subject text NOT NULL,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  start_time time NOT NULL,
  end_time time NOT NULL,
  actual_duration_minutes integer DEFAULT 90,
  status text NOT NULL DEFAULT 'conducted' CHECK (status IN ('scheduled', 'conducted', 'cancelled', 'rescheduled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.class_diaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL DEFAULT '11111111-2222-3333-4444-555555555555'::uuid REFERENCES public.institutes(id),
  session_id uuid NOT NULL UNIQUE REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  chapter_name text NOT NULL,
  topics_covered text NOT NULL,
  teaching_remarks text,
  next_planned_topic text,
  homework_notes text,
  is_draft boolean NOT NULL DEFAULT false,
  submitted_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.syllabus_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL DEFAULT '11111111-2222-3333-4444-555555555555'::uuid REFERENCES public.institutes(id),
  course_name text NOT NULL,
  subject text NOT NULL,
  chapter_no integer NOT NULL,
  title text NOT NULL,
  total_estimated_hours numeric(5, 2) DEFAULT 10.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institute_id, course_name, subject, chapter_no)
);

CREATE TABLE IF NOT EXISTS public.syllabus_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.syllabus_chapters(id) ON DELETE CASCADE,
  topic_no integer NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chapter_id, topic_no)
);

CREATE TABLE IF NOT EXISTS public.batch_topic_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL DEFAULT '11111111-2222-3333-4444-555555555555'::uuid REFERENCES public.institutes(id),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.syllabus_topics(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'planned', 'in_progress', 'completed', 'needs_revision')),
  completed_on date,
  teacher_remarks text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_id, topic_id)
);

-- ============================================================================
-- PHASE 3: STUDENT MOTIVATION & GAMIFICATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL DEFAULT '11111111-2222-3333-4444-555555555555'::uuid REFERENCES public.institutes(id),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  points integer NOT NULL,
  event_type text NOT NULL,
  reason text NOT NULL,
  awarded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL DEFAULT '11111111-2222-3333-4444-555555555555'::uuid REFERENCES public.institutes(id),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  badge_code text NOT NULL,
  badge_name text NOT NULL,
  description text NOT NULL,
  icon_name text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, badge_code)
);

CREATE TABLE IF NOT EXISTS public.student_streaks (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  institute_id uuid NOT NULL DEFAULT '11111111-2222-3333-4444-555555555555'::uuid REFERENCES public.institutes(id),
  current_attendance_streak integer NOT NULL DEFAULT 1,
  longest_attendance_streak integer NOT NULL DEFAULT 1,
  last_attended_date date DEFAULT CURRENT_DATE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- PHASE 4: STUDENT DOCUMENT VAULT & CERTIFICATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL DEFAULT '11111111-2222-3333-4444-555555555555'::uuid REFERENCES public.institutes(id),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  title text NOT NULL,
  file_url text NOT NULL,
  is_verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL DEFAULT '11111111-2222-3333-4444-555555555555'::uuid REFERENCES public.institutes(id),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  certificate_no text NOT NULL UNIQUE,
  certificate_type text NOT NULL,
  title text NOT NULL,
  course_name text NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  signatory_title text NOT NULL DEFAULT 'Director & Head of Academics',
  pdf_url text,
  verification_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_certificates ENABLE ROW LEVEL SECURITY;

-- 1. Class Sessions Policies
CREATE POLICY "class_sessions_staff_all" ON public.class_sessions
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('super_admin', 'owner', 'admin', 'teacher'));

CREATE POLICY "class_sessions_student_read" ON public.class_sessions
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'student'
    AND batch_id IN (SELECT batch_id FROM public.students WHERE profile_id = auth.uid())
  );

-- 2. Class Diaries Policies
CREATE POLICY "class_diaries_staff_all" ON public.class_diaries
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('super_admin', 'owner', 'admin', 'teacher'));

CREATE POLICY "class_diaries_student_read" ON public.class_diaries
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'student'
    AND is_draft = false
    AND session_id IN (
      SELECT id FROM public.class_sessions
      WHERE batch_id IN (SELECT batch_id FROM public.students WHERE profile_id = auth.uid())
    )
  );

-- 3. Syllabus Policies
CREATE POLICY "syllabus_chapters_read" ON public.syllabus_chapters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "syllabus_chapters_staff_write" ON public.syllabus_chapters
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('super_admin', 'owner', 'admin'));

CREATE POLICY "syllabus_topics_read" ON public.syllabus_topics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "syllabus_topics_staff_write" ON public.syllabus_topics
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('super_admin', 'owner', 'admin'));

CREATE POLICY "batch_topic_progress_read" ON public.batch_topic_progress
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "batch_topic_progress_staff_all" ON public.batch_topic_progress
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('super_admin', 'owner', 'admin', 'teacher'));

-- 4. Gamification & Motivation Policies
CREATE POLICY "points_ledger_staff_all" ON public.student_points_ledger
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('super_admin', 'owner', 'admin', 'teacher'));

CREATE POLICY "points_ledger_student_read" ON public.student_points_ledger
  FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid()));

CREATE POLICY "student_badges_staff_all" ON public.student_badges
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('super_admin', 'owner', 'admin', 'teacher'));

CREATE POLICY "student_badges_read" ON public.student_badges
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "student_streaks_read" ON public.student_streaks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "student_streaks_staff_all" ON public.student_streaks
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('super_admin', 'owner', 'admin', 'teacher'));

-- 5. Student Documents Policies
CREATE POLICY "student_documents_staff_all" ON public.student_documents
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('super_admin', 'owner', 'admin'));

CREATE POLICY "student_documents_student_read" ON public.student_documents
  FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid()));

-- 6. Student Certificates Policies
CREATE POLICY "student_certificates_read" ON public.student_certificates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "student_certificates_staff_all" ON public.student_certificates
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('super_admin', 'owner', 'admin'));

-- ============================================================================
-- SEED FOUNDATION DATA (Sample Syllabus & Conducted Sessions for Demo)
-- ============================================================================

DO $$
DECLARE
  v_inst_id UUID := '11111111-2222-3333-4444-555555555555';
  v_batch_jee UUID;
  v_batch_neet UUID;
  v_teacher_rajesh UUID;
  v_teacher_sunita UUID;
  v_chap_phys UUID;
  v_chap_chem UUID;
  v_topic_1 UUID;
  v_topic_2 UUID;
  v_topic_3 UUID;
  v_session_id UUID;
  v_student_aarav UUID;
BEGIN
  -- Get active batches & teachers
  SELECT id INTO v_batch_jee FROM public.batches WHERE name ILIKE '%JEE%' LIMIT 1;
  SELECT id INTO v_batch_neet FROM public.batches WHERE name ILIKE '%NEET%' LIMIT 1;
  SELECT id INTO v_teacher_rajesh FROM public.teachers WHERE full_name ILIKE '%Rajesh%' LIMIT 1;
  SELECT id INTO v_teacher_sunita FROM public.teachers WHERE full_name ILIKE '%Patil%' LIMIT 1;
  SELECT id INTO v_student_aarav FROM public.students WHERE full_name ILIKE '%Aarav%' LIMIT 1;

  -- 1. Seed Syllabus Chapters
  IF v_chap_phys IS NULL THEN
    INSERT INTO public.syllabus_chapters (institute_id, course_name, subject, chapter_no, title, total_estimated_hours)
    VALUES (v_inst_id, 'JEE Advanced', 'Physics', 1, 'Electrostatics & Electric Potential', 16.0)
    ON CONFLICT (institute_id, course_name, subject, chapter_no) DO UPDATE SET title = EXCLUDED.title
    RETURNING id INTO v_chap_phys;
  END IF;

  INSERT INTO public.syllabus_chapters (institute_id, course_name, subject, chapter_no, title, total_estimated_hours)
  VALUES (v_inst_id, 'JEE Advanced', 'Chemistry', 1, 'Organic Chemistry Reaction Mechanisms', 14.0)
  ON CONFLICT (institute_id, course_name, subject, chapter_no) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_chap_chem;

  -- 2. Seed Syllabus Topics
  INSERT INTO public.syllabus_topics (chapter_id, topic_no, title, description)
  VALUES 
    (v_chap_phys, 1, 'Coulomb''s Law & Superposition Principle', 'Electrostatic forces and vector form calculations')
  ON CONFLICT (chapter_id, topic_no) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_topic_1;

  INSERT INTO public.syllabus_topics (chapter_id, topic_no, title, description)
  VALUES 
    (v_chap_phys, 2, 'Electric Field Intensity & Gauss''s Law Applications', 'Spherical, planar and line charge distributions')
  ON CONFLICT (chapter_id, topic_no) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_topic_2;

  -- 3. Seed Batch Topic Progress
  IF v_batch_jee IS NOT NULL AND v_topic_1 IS NOT NULL THEN
    INSERT INTO public.batch_topic_progress (institute_id, batch_id, topic_id, status, completed_on, teacher_remarks)
    VALUES (v_inst_id, v_batch_jee, v_topic_1, 'completed', CURRENT_DATE - 3, 'Mastered by all students with numerical drills')
    ON CONFLICT (batch_id, topic_id) DO NOTHING;

    INSERT INTO public.batch_topic_progress (institute_id, batch_id, topic_id, status, completed_on, teacher_remarks)
    VALUES (v_inst_id, v_batch_jee, v_topic_2, 'in_progress', NULL, 'Ongoing classroom problem-solving')
    ON CONFLICT (batch_id, topic_id) DO NOTHING;
  END IF;

  -- 4. Seed Conducted Class Session & Diary Entry
  IF v_batch_jee IS NOT NULL AND v_teacher_rajesh IS NOT NULL THEN
    INSERT INTO public.class_sessions (
      institute_id, batch_id, teacher_id, subject, session_date, start_time, end_time, actual_duration_minutes, status
    ) VALUES (
      v_inst_id, v_batch_jee, v_teacher_rajesh, 'Physics', CURRENT_DATE, '09:00:00', '10:30:00', 90, 'conducted'
    ) RETURNING id INTO v_session_id;

    IF v_session_id IS NOT NULL THEN
      INSERT INTO public.class_diaries (
        institute_id, session_id, chapter_name, topics_covered, teaching_remarks, next_planned_topic, homework_notes, is_draft
      ) VALUES (
        v_inst_id, v_session_id, 'Electrostatics & Electric Potential',
        'Gauss''s Law applications on infinite plane sheets and spherical conductors. Solved 6 past JEE Advanced problems.',
        'High student engagement. Concept of flux through non-standard closed surfaces reviewed.',
        'Electric Potential due to a dipole and equipotential surfaces',
        'Solve Exercise 3.2 problems 14 to 28 from Institute Physics Module',
        false
      ) ON CONFLICT (session_id) DO NOTHING;
    END IF;
  END IF;

  -- 5. Seed Student Gamification & Streaks
  IF v_student_aarav IS NOT NULL THEN
    INSERT INTO public.student_streaks (student_id, institute_id, current_attendance_streak, longest_attendance_streak, last_attended_date)
    VALUES (v_student_aarav, v_inst_id, 14, 18, CURRENT_DATE)
    ON CONFLICT (student_id) DO UPDATE SET current_attendance_streak = 14;

    INSERT INTO public.student_points_ledger (institute_id, student_id, points, event_type, reason)
    VALUES
      (v_inst_id, v_student_aarav, 150, 'attendance_streak', '14-Day Consecutive Attendance Streak'),
      (v_inst_id, v_student_aarav, 100, 'exam_top_rank', 'Rank 1 in JEE Advanced Mechanics Mock Test'),
      (v_inst_id, v_student_aarav, 50, 'homework_completed', 'Completed Organic Chemistry Practice Problem Set')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.student_badges (institute_id, student_id, badge_code, badge_name, description, icon_name)
    VALUES
      (v_inst_id, v_student_aarav, 'streak_master', 'Streak Master (14 Days)', 'Maintained perfect attendance for 14 continuous days', 'Flame'),
      (v_inst_id, v_student_aarav, 'top_scorer', 'Academic Achiever', 'Ranked 1st in batch competitive test series', 'Trophy')
    ON CONFLICT (student_id, badge_code) DO NOTHING;

    -- Seed Sample Certificate
    INSERT INTO public.student_certificates (
      institute_id, student_id, certificate_no, certificate_type, title, course_name, issue_date, signatory_title, verification_token
    ) VALUES (
      v_inst_id, v_student_aarav, 'PC-CERT-2026-0001', 'merit',
      'Certificate of Academic Excellence', 'JEE Advanced 2026 Batch', CURRENT_DATE,
      'Director & Head of Academics', 'PC-VERIFY-AARAV-2026'
    ) ON CONFLICT (certificate_no) DO NOTHING;
  END IF;

END $$;

NOTIFY pgrst, 'reload schema';
