-- ============================================================================
-- Migration: 0017_admin_user_provisioning.sql
-- Description: Administrative User Provisioning RPCs with pgcrypto password hashing,
--              status toggling, password resetting, and tenant-isolated listing.
-- ============================================================================

-- 1. Add is_active column to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Ensure pgcrypto extension is available in extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- RPC 1: List Institute Users with linked student/teacher records
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_institute_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role text,
  phone text,
  is_active boolean,
  created_at timestamptz,
  linked_student_id uuid,
  linked_student_name text,
  linked_admission_no text,
  linked_teacher_id uuid,
  linked_teacher_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role public.app_role;
  v_inst_id uuid;
BEGIN
  -- 1. Authorization check
  v_caller_role := public.current_user_role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 2. Resolve institute ID
  v_inst_id := coalesce(public.current_user_institute_id(), '11111111-2222-3333-4444-555555555555'::uuid);

  -- 3. Return tenant-isolated user accounts
  RETURN QUERY
  SELECT 
    p.id,
    coalesce(u.email::text, '')::text AS email,
    p.full_name::text,
    p.role::text,
    coalesce(p.phone, u.phone::text, s.phone, t.phone)::text AS phone,
    p.is_active,
    p.created_at,
    s.id AS linked_student_id,
    s.full_name::text AS linked_student_name,
    s.admission_no::text AS linked_admission_no,
    t.id AS linked_teacher_id,
    t.full_name::text AS linked_teacher_name
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.students s ON s.profile_id = p.id
  LEFT JOIN public.teachers t ON t.profile_id = p.id
  WHERE p.institute_id = v_inst_id
  ORDER BY p.created_at DESC;
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 2: Admin Create Institute User with pgcrypto password hashing & linking
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_institute_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_student_id uuid DEFAULT NULL,
  p_teacher_id uuid DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role public.app_role;
  v_inst_id uuid;
  v_user_id uuid;
  v_role public.app_role;
  v_encrypted_password text;
  v_email text;
  v_phone text;
  v_admission_no text;
BEGIN
  -- 1. Authorization check
  v_caller_role := public.current_user_role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 2. Validate role
  BEGIN
    v_role := p_role::public.app_role;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END;

  IF v_role = 'owner' AND v_caller_role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only an owner can provision another owner';
  END IF;

  -- 3. Resolve institute ID
  v_inst_id := coalesce(public.current_user_institute_id(), '11111111-2222-3333-4444-555555555555'::uuid);

  -- 4. Clean phone
  v_phone := nullif(trim(p_phone), '');
  IF v_phone IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users WHERE phone = v_phone) THEN
    RAISE EXCEPTION 'User with phone % already exists', v_phone;
  END IF;

  -- 5. Resolve email
  IF p_email IS NULL OR trim(p_email) = '' THEN
    IF p_student_id IS NOT NULL THEN
      SELECT admission_no INTO v_admission_no
      FROM public.students
      WHERE id = p_student_id AND institute_id = v_inst_id;
      
      IF v_admission_no IS NULL THEN
        RAISE EXCEPTION 'Student not found in this institute';
      END IF;
      v_email := lower(v_admission_no) || '@pradeepclasses.in';
    ELSE
      RAISE EXCEPTION 'Email is required';
    END IF;
  ELSE
    v_email := lower(trim(p_email));
  END IF;

  -- 6. Check if user with email already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'User with email % already exists', v_email;
  END IF;

  -- 7. Validate password
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long';
  END IF;

  -- 8. Validate linked student/teacher if provided
  IF p_student_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND institute_id = v_inst_id) THEN
      RAISE EXCEPTION 'Student record not found in this institute';
    END IF;
  END IF;

  IF p_teacher_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.teachers WHERE id = p_teacher_id AND institute_id = v_inst_id) THEN
      RAISE EXCEPTION 'Teacher record not found in this institute';
    END IF;
  END IF;

  -- 9. Hash password using pgcrypto
  v_encrypted_password := extensions.crypt(p_password, extensions.gen_salt('bf'));
  v_user_id := gen_random_uuid();

  -- 10. Prepare context for triggers (handle_new_user and prevent_self_role_escalation)
  PERFORM set_config('institute.internal_bootstrap_in_progress', 'true', true);
  PERFORM set_config('institute.target_institute_id', v_inst_id::text, true);
  PERFORM set_config('institute.target_role', v_role::text, true);

  -- 11. Insert into auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    is_sso_user,
    is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    v_encrypted_password,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'email_verified', true),
    now(),
    now(),
    v_phone,
    CASE WHEN v_phone IS NOT NULL THEN now() ELSE NULL END,
    false,
    false
  );

  -- 12. Insert into auth.identities for GoTrue auth compatibility
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  );

  -- 13. Ensure profile record is accurately set
  UPDATE public.profiles
  SET phone = v_phone,
      full_name = p_full_name,
      role = v_role,
      institute_id = v_inst_id,
      is_active = true
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, full_name, role, phone, institute_id, is_active)
    VALUES (v_user_id, p_full_name, v_role, v_phone, v_inst_id, true);
  END IF;

  -- 14. Link to student or teacher record if requested
  IF p_student_id IS NOT NULL THEN
    UPDATE public.students
    SET profile_id = v_user_id,
        phone = coalesce(students.phone, v_phone),
        email = coalesce(students.email, v_email)
    WHERE id = p_student_id AND institute_id = v_inst_id;
  END IF;

  IF p_teacher_id IS NOT NULL THEN
    UPDATE public.teachers
    SET profile_id = v_user_id,
        phone = coalesce(teachers.phone, v_phone)
    WHERE id = p_teacher_id AND institute_id = v_inst_id;
  END IF;

  -- 15. Audit log entry
  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, after_data, institute_id)
  VALUES (
    auth.uid(),
    'ADMIN_USER_PROVISIONED',
    'profiles',
    v_user_id,
    jsonb_build_object(
      'email', v_email,
      'role', v_role::text,
      'full_name', p_full_name,
      'linked_student_id', p_student_id,
      'linked_teacher_id', p_teacher_id
    ),
    v_inst_id
  );

  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'User provisioned successfully',
    'id', v_user_id,
    'email', v_email,
    'full_name', p_full_name,
    'role', v_role::text,
    'phone', v_phone,
    'is_active', true,
    'linked_student_id', p_student_id,
    'linked_teacher_id', p_teacher_id
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 3: Admin Reset User Password
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role public.app_role;
  v_inst_id uuid;
  v_target_inst uuid;
  v_target_role public.app_role;
  v_encrypted_password text;
BEGIN
  -- 1. Authorization check
  v_caller_role := public.current_user_role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 2. Resolve caller institute ID
  v_inst_id := coalesce(public.current_user_institute_id(), '11111111-2222-3333-4444-555555555555'::uuid);

  -- 3. Verify target profile
  SELECT institute_id, role INTO v_target_inst, v_target_role
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_target_inst IS DISTINCT FROM v_inst_id AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: Cross-tenant password reset prohibited';
  END IF;

  IF v_target_role = 'owner' AND v_caller_role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only an owner can reset an owner password';
  END IF;

  -- 4. Validate password
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long';
  END IF;

  -- 5. Update auth.users password
  v_encrypted_password := extensions.crypt(p_new_password, extensions.gen_salt('bf'));

  UPDATE auth.users
  SET encrypted_password = v_encrypted_password,
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user record not found for id %', p_user_id;
  END IF;

  -- 6. Audit log entry
  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, after_data, institute_id)
  VALUES (
    auth.uid(),
    'ADMIN_USER_PASSWORD_RESET',
    'auth.users',
    p_user_id,
    jsonb_build_object('reset_user_id', p_user_id, 'target_role', v_target_role::text),
    v_inst_id
  );

  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Password reset successfully',
    'user_id', p_user_id
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 4: Admin Toggle User Status
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_toggle_user_status(
  p_user_id uuid,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.app_role;
  v_inst_id uuid;
  v_target_inst uuid;
  v_target_role public.app_role;
BEGIN
  -- 1. Authorization check
  v_caller_role := public.current_user_role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 2. Resolve caller institute ID
  v_inst_id := coalesce(public.current_user_institute_id(), '11111111-2222-3333-4444-555555555555'::uuid);

  -- 3. Verify target profile
  SELECT institute_id, role INTO v_target_inst, v_target_role
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_target_inst IS DISTINCT FROM v_inst_id AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: Cross-tenant status update prohibited';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot toggle active status of yourself';
  END IF;

  IF v_target_role = 'owner' AND v_caller_role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only an owner can modify an owner status';
  END IF;

  -- 4. Update profile is_active
  UPDATE public.profiles
  SET is_active = p_is_active
  WHERE id = p_user_id;

  -- 5. Sync teachers.is_active if applicable
  UPDATE public.teachers
  SET is_active = p_is_active
  WHERE profile_id = p_user_id;

  -- 6. Audit log entry
  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, after_data, institute_id)
  VALUES (
    auth.uid(),
    'ADMIN_USER_STATUS_TOGGLED',
    'profiles',
    p_user_id,
    jsonb_build_object('target_user_id', p_user_id, 'is_active', p_is_active),
    v_inst_id
  );

  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'User status updated successfully',
    'user_id', p_user_id,
    'is_active', p_is_active
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- Grants for authenticated users
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_list_institute_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_institute_user(text, text, text, text, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_status(uuid, boolean) TO authenticated;
