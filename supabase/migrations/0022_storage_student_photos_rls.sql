-- Migration: 0022_storage_student_photos_rls.sql
-- Description: Configures public bucket and RLS policies on storage.objects for student-photos

-- 1. Ensure bucket exists and has correct public settings and size limits
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('student-photos', 'student-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE 
SET public = true, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Drop any previous student-photos policies to avoid duplicates
DROP POLICY IF EXISTS "student_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "student_photos_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "student_photos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "student_photos_staff_delete" ON storage.objects;

-- 3. Policy: Public / Authenticated Read
CREATE POLICY "student_photos_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'student-photos');

-- 4. Policy: Authenticated Insert (Students can upload passport photos, Staff can upload)
CREATE POLICY "student_photos_authenticated_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'student-photos');

-- 5. Policy: Authenticated Update (Needed for upsert: true)
CREATE POLICY "student_photos_authenticated_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'student-photos')
  WITH CHECK (bucket_id = 'student-photos');

-- 6. Policy: Staff Delete (Management can purge or replace photos)
CREATE POLICY "student_photos_staff_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND public.current_user_role() IN ('super_admin', 'owner', 'admin')
  );
