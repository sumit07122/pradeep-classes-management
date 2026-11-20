# Pradeep Classes Management: Hardened Initial Owner Bootstrap Guide

This document outlines the hardened procedure for bootstrapping the initial **Institute Owner** account in production or staging Supabase environments.

---

## Security Architecture & Trust Boundaries

1. **Transactional Advisory Locking**:
   The `bootstrap_initial_owner` SQL function acquires a session transaction lock via `perform pg_advisory_xact_lock(hashtext('initial_owner_bootstrap_lock'))`. This guarantees that concurrent bootstrap requests are serialized and only a single owner can ever be created.
2. **Name Preservation**:
   The function inspects `auth.users.raw_user_meta_data->>'full_name'` to preserve the user's authentic name rather than hardcoding placeholder strings.
3. **Privilege Revocation & Trusted Execution Context**:
   Execution privileges on `bootstrap_initial_owner` are revoked from `public`, `anon`, and `authenticated`. Only database superusers and trusted administrative connections (Supabase SQL Editor or direct postgres CLI / server-side service role) can call it. Frontend clients cannot execute this function.
4. **Pre-Bootstrap Guard Against Untrusted Insertion**:
   Untrusted authenticated users cannot insert a profile with `role = 'owner'` or `'admin'`, even before any owner exists in the database. The `trg_prevent_role_escalation` trigger blocks direct inserts unless the `institute.internal_bootstrap_in_progress` transaction setting is active, which is set exclusively inside `bootstrap_initial_owner()`. Normal user signups continue to receive the safe default `student` role via `handle_new_user()`.
5. **Trigger Enforcement on Subsequent Roles**:
   `trg_prevent_role_escalation` ensures that once an owner exists, subsequent Owner or Admin role assignments can only be executed by an existing authenticated Owner.

---

## Step-by-Step Bootstrap Process

### Step 1: Create the Auth Account in Supabase

1. Open your **Supabase Dashboard** -> **Authentication** -> **Users**.
2. Click **Add User** -> **Create User**.
3. Enter the email address for the Institute Owner (e.g., `owner@pradeepclasses.in`) and a secure password.
4. Provide the Owner's full name in user metadata if prompted.

---

### Step 2: Execute the Locked Bootstrap Function

1. Navigate to the **SQL Editor** in the Supabase Dashboard.
2. Run the single-use bootstrap command:

```sql
SELECT public.bootstrap_initial_owner('owner@pradeepclasses.in');
```

3. **Expected Output**:
```json
{
  "status": "success",
  "message": "Initial owner bootstrapped successfully.",
  "user_id": "c4d2e7a1-8b3f-42e1-95c7-123456789abc",
  "email": "owner@pradeepclasses.in",
  "full_name": "Pradeep Sharma"
}
```

---

### Step 3: Verification & Security Checks

1. Verify that the owner profile is present:
```sql
SELECT id, full_name, role, created_at
FROM public.profiles
WHERE role = 'owner';
```

2. Confirm that repeated calls are blocked:
```sql
SELECT public.bootstrap_initial_owner('intruder@pradeepclasses.in');
-- Expected output:
-- ERROR: Bootstrap aborted: An institute owner already exists. Contact existing owner to assign administrative privileges.
```

---

### Step 4: Sign in to the Application

1. Open `https://app.pradeepclasses.in/login`.
2. Sign in with the bootstrapped email and password.
3. The application will authenticate, load the verified `owner` profile, and grant full institute workspace control.
