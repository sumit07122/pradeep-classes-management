# Pradeep Classes Management: Initial Owner Bootstrap Guide

This document outlines the secure procedure for bootstrapping the initial **Institute Owner** account in production or staging Supabase environments.

---

## Security Principles

1. **No Self-Privilege Escalation**:
   Public registration (`supabase.auth.signUp`) assigns users the safe unprivileged role (`student`) by default. Users cannot promote themselves or create owner/admin records via the frontend API.
2. **Single-Use Bootstrap Guarantee**:
   The `bootstrap_initial_owner` SQL function checks if any owner already exists. If an owner is present, the function immediately terminates with an exception.
3. **Execution Isolation**:
   Only database administrators with access to the Supabase SQL Editor or direct PostgreSQL connection can execute the bootstrap command. `anon` and `authenticated` roles are stripped of execution privileges.

---

## Step-by-Step Bootstrap Process

### Step 1: Create the User in Supabase Auth

1. Go to your **Supabase Dashboard** -> **Authentication** -> **Users**.
2. Click **Add User** -> **Create User**.
3. Enter the email address for the Institute Owner (e.g., `owner@pradeepclasses.in`) and a secure password.
4. Confirm user creation.

---

### Step 2: Run the Single-Use Bootstrap Function

1. In your Supabase Dashboard, navigate to the **SQL Editor**.
2. Run the following command (replace with your owner's email):

```sql
SELECT public.bootstrap_initial_owner('owner@pradeepclasses.in');
```

3. **Expected output**:
```json
{
  "status": "success",
  "message": "Initial owner bootstrapped successfully.",
  "user_id": "YOUR-USER-UUID",
  "email": "owner@pradeepclasses.in"
}
```

---

### Step 3: Verification

1. Verify the `public.profiles` table:
```sql
SELECT id, full_name, role, created_at
FROM public.profiles
WHERE role = 'owner';
```
2. Verify that subsequent bootstrap attempts are blocked:
```sql
SELECT public.bootstrap_initial_owner('another_user@pradeepclasses.in');
-- Expected: ERROR: Bootstrap failed: An institute owner already exists. Contact existing owner to assign permissions.
```

---

### Step 4: Signing in to the Web App

1. Navigate to the application URL: `https://app.pradeepclasses.in/login`.
2. Enter the bootstrapped email and password.
3. The application will authenticate via Supabase, retrieve the `owner` role, and grant full access to the Institute Management Workspace.
