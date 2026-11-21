-- Migration 0015: Student Documents Storage Policies, Doubts Desk & Homework Submissions
--
-- 1. Storage bucket policies for student-documents
-- 2. Student doubts tracking table with teacher response workflow
-- 3. Homework submissions table with evaluation workflow

-- 1. Create table student_doubts if not exists
CREATE TABLE IF NOT EXISTS public.student_doubts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL DEFAULT '11111111-2222-3333-4444-555555555555'::uuid REFERENCES public.institutes(id),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  subject text NOT NULL,
  topic text,
  question text NOT NULL,
  attachment_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved')),
  response text,
  responded_by uuid REFERENCES public.profiles(id),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create table homework_submissions if not exists
CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL DEFAULT '11111111-2222-3333-4444-555555555555'::uuid REFERENCES public.institutes(id),
  homework_id uuid NOT NULL REFERENCES public.homework(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  submission_text text,
  file_url text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'returned', 'resubmit')),
  grade text,
  remarks text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  graded_at timestamptz,
  graded_by uuid REFERENCES public.profiles(id),
  UNIQUE (homework_id, student_id)
);

-- 3. Enable RLS
ALTER TABLE public.student_doubts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

-- 4. Policies for student_doubts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'student_doubts_staff_all' AND tablename = 'student_doubts') THEN
    CREATE POLICY "student_doubts_staff_all" ON public.student_doubts
      FOR ALL TO authenticated
      USING (public.current_user_role() IN ('super_admin', 'owner', 'admin', 'teacher'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'student_doubts_student_read' AND tablename = 'student_doubts') THEN
    CREATE POLICY "student_doubts_student_read" ON public.student_doubts
      FOR SELECT TO authenticated
      USING (student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'student_doubts_student_insert' AND tablename = 'student_doubts') THEN
    CREATE POLICY "student_doubts_student_insert" ON public.student_doubts
      FOR INSERT TO authenticated
      WITH CHECK (student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid()));
  END IF;
END $$;

-- 5. Policies for homework_submissions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'homework_submissions_staff_all' AND tablename = 'homework_submissions') THEN
    CREATE POLICY "homework_submissions_staff_all" ON public.homework_submissions
      FOR ALL TO authenticated
      USING (public.current_user_role() IN ('super_admin', 'owner', 'admin', 'teacher'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'homework_submissions_student_select' AND tablename = 'homework_submissions') THEN
    CREATE POLICY "homework_submissions_student_select" ON public.homework_submissions
      FOR SELECT TO authenticated
      USING (student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'homework_submissions_student_insert' AND tablename = 'homework_submissions') THEN
    CREATE POLICY "homework_submissions_student_insert" ON public.homework_submissions
      FOR INSERT TO authenticated
      WITH CHECK (student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'homework_submissions_student_update' AND tablename = 'homework_submissions') THEN
    CREATE POLICY "homework_submissions_student_update" ON public.homework_submissions
      FOR UPDATE TO authenticated
      USING (student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid()))
      WITH CHECK (student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid()));
  END IF;
END $$;

-- 6. Storage Policies for student-documents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'student_docs_staff_read' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "student_docs_staff_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'student-documents' AND public.current_user_role() IN ('super_admin', 'owner', 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'student_docs_staff_upload' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "student_docs_staff_upload" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'student-documents' AND public.current_user_role() IN ('super_admin', 'owner', 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'student_docs_staff_delete' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "student_docs_staff_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'student-documents' AND public.current_user_role() IN ('super_admin', 'owner', 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'student_docs_student_read' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "student_docs_student_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'student-documents' AND public.current_user_role() = 'student' AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.students WHERE profile_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'student_docs_student_upload' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "student_docs_student_upload" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'student-documents' AND public.current_user_role() = 'student' AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.students WHERE profile_id = auth.uid()));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
