-- Migration 0021: Admin User Username / Identifier Update RPC

CREATE OR REPLACE FUNCTION public.admin_update_user_username(
  p_user_id uuid,
  p_new_username text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_role public.app_role;
  v_inst_id uuid;
  v_target_inst uuid;
  v_target_role public.app_role;
  v_target_full_name text;
  v_cleaned text;
  v_new_email text;
BEGIN
  -- 1. Authorization check
  v_caller_role := public.current_user_role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can update usernames';
  END IF;

  -- 2. Resolve caller institute ID
  v_inst_id := coalesce(public.current_user_institute_id(), '11111111-2222-3333-4444-555555555555'::uuid);

  -- 3. Verify target user
  SELECT institute_id, role, full_name INTO v_target_inst, v_target_role, v_target_full_name
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_target_inst IS DISTINCT FROM v_inst_id AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: Cross-tenant username update prohibited';
  END IF;

  IF v_target_role = 'super_admin' AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: Only a super_admin can update super_admin credentials';
  END IF;

  -- 4. Clean input
  v_cleaned := trim(p_new_username);
  IF v_cleaned IS NULL OR length(v_cleaned) < 2 THEN
    RAISE EXCEPTION 'Username must be at least 2 characters long';
  END IF;

  -- 5. Resolve canonical email based on role
  IF v_cleaned LIKE '%@%' THEN
    v_new_email := lower(v_cleaned);
  ELSE
    IF v_target_role = 'student' THEN
      v_new_email := lower(v_cleaned) || '@student.pradeepclasses.in';
    ELSIF v_target_role = 'teacher' THEN
      v_new_email := regexp_replace(lower(v_cleaned), '[^a-z0-9.]', '.', 'g') || '@faculty.pradeepclasses.in';
    ELSE
      v_new_email := lower(v_cleaned) || '@pradeepclasses.in';
    END IF;
  END IF;

  -- 6. Check if email already in use by another user
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_new_email AND id != p_user_id) THEN
    RAISE EXCEPTION 'Username / identifier "%" is already in use by another account', v_cleaned;
  END IF;

  -- 7. Update auth.users
  UPDATE auth.users
  SET email = v_new_email,
      updated_at = now()
  WHERE id = p_user_id;

  -- 8. Update auth.identities
  UPDATE auth.identities
  SET identity_data = jsonb_set(coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_new_email)),
      updated_at = now()
  WHERE user_id = p_user_id;

  -- 9. If student, update students table
  IF v_target_role = 'student' THEN
    UPDATE public.students
    SET admission_no = v_cleaned,
        email = v_new_email,
        updated_at = now()
    WHERE profile_id = p_user_id AND institute_id = v_inst_id;
  END IF;

  -- 10. Audit log entry
  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, after_data, institute_id)
  VALUES (
    auth.uid(),
    'ADMIN_USER_USERNAME_UPDATE',
    'auth.users',
    p_user_id,
    jsonb_build_object('user_id', p_user_id, 'new_username', v_cleaned, 'new_email', v_new_email, 'role', v_target_role::text),
    v_inst_id
  );

  RETURN jsonb_build_object(
    'status', 'success',
    'user_id', p_user_id,
    'new_username', v_cleaned,
    'new_email', v_new_email,
    'message', 'Username updated successfully'
  );
END;
$$;
