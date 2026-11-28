-- Migration: 0019_student_photo_lock_and_historical_fees.sql
-- Description: Adds profile locking for student self-service photo upload, and historical fee record tracking

-- 1. Extend students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS is_profile_locked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS photo_uploaded_at TIMESTAMPTZ;

-- 2. Extend fee_records table
ALTER TABLE public.fee_records 
ADD COLUMN IF NOT EXISTS is_historical BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS historical_period TEXT;

-- 3. Dedicated RPC to atomically set and permanently lock student photo, name, and phone
CREATE OR REPLACE FUNCTION public.lock_student_profile(
    p_student_id UUID,
    p_photo_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_student RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated: Must be logged in to update profile';
    END IF;

    SELECT role::text INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

    SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student not found: %', p_student_id;
    END IF;

    -- If caller is student, verify it is their own profile and not already locked
    IF v_caller_role = 'student' THEN
        IF v_student.profile_id IS DISTINCT FROM v_caller_id THEN
            RAISE EXCEPTION 'Unauthorized: You can only update your own student profile';
        END IF;

        IF v_student.is_profile_locked = true THEN
            RAISE EXCEPTION 'Profile locked: Photo, name, and phone cannot be altered once verified';
        END IF;
    END IF;

    -- Update and lock profile
    UPDATE public.students
    SET 
        photo_url = COALESCE(p_photo_url, photo_url),
        is_profile_locked = true,
        photo_uploaded_at = now(),
        updated_at = now()
    WHERE id = p_student_id;

    RETURN jsonb_build_object(
        'success', true,
        'student_id', p_student_id,
        'photo_url', COALESCE(p_photo_url, v_student.photo_url),
        'is_profile_locked', true,
        'locked_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lock_student_profile(UUID, TEXT) TO authenticated;
