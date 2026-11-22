# Design Specification: PWA Mobile Suite, Admin User Management & Smart Unauthorized Redirect

**Document ID:** `2026-11-22-pwa-user-management-unauthorized-redirect`  
**Date:** 2026-11-22  
**Target Institute:** Pradeep Classes Management Platform  
**Target URL:** `https://app.pradeepclasses.in`  

---

## 1. Intent and Why

Coaching institute operations at Pradeep Classes require seamless, multi-device accessibility for the Owner, Administrators, Teachers, and Students.
- **Unauthorized Navigation Friction:** Currently, when an unauthorized user (such as a student navigating to administrative routes) attempts access, they are dumped onto a static 403 error screen (`/unauthorized`) with no smooth route back or ability to switch accounts. Redirecting directly to `/login` with context, friendly alerts, and a 1-click return button eliminates confusion.
- **PWA Mobile Accessibility:** Coaching staff and students frequently access the portal from mobile smartphones (Android and iOS). A complete PWA implementation (offline Service Worker caching, web app manifest, and 1-click "Install App" triggers) enables teachers to mark attendance and students to view class diaries without downloading a 50MB app store binary.
- **Admin User & Profile Creation:** Currently, creating students or teachers only inserts rows into business tables (`students`, `teachers`) without provisioning Supabase Auth login accounts. Institute administrators need a self-service User Management console to create logins, generate passwords, link profiles, and dispatch credentials via WhatsApp directly from the dashboard.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
1. **Smart Unauthorized Redirect:** Automatically route unauthorized route attempts to `/login` with preserved destination state and role-aware return options.
2. **PWA Mobile Suite:** Implement a service worker (`public/sw.js`), installation hook (`usePWAInstall`), topbar install trigger, and platform-specific installation guide (Android, iOS Safari, Desktop).
3. **Database-Level User Provisioning RPC:** Create a secure, transactional PostgreSQL function (`admin_create_institute_user`) allowing authenticated Owners and Admins to create auth users with encrypted passwords and link them to students or teachers without logging out the administrator.
4. **Admin User Management Console:** Add a dedicated **User Management** hub in `Settings.tsx` to view, filter, create, and reset credentials for institute users.
5. **Inline Onboarding:** Add a *"Generate Login Credentials"* toggle in both "Add Student" (`Students.tsx`) and "Add Teacher" (`Teachers.tsx`) modals with 1-click WhatsApp credentials dispatch.

### Non-Goals
- Building a native React Native / Swift / Kotlin mobile app (PWA fulfills this lightweight requirement).
- Implementing biometric WebAuthn logins in this phase.
- Modifying previously applied database migrations (new changes will go into sequential migration `0017_admin_user_provisioning.sql`).

### Anti-Goals
- Never log out the active Administrator or Owner when they create a student or teacher account.
- Never expose the Supabase `service_role` secret in frontend JavaScript.
- Never display dummy or hardcoded users in the User Management list.

---

## 3. Approaches Considered & Trade-offs

| Approach | Description | Trade-offs & Decision |
| :--- | :--- | :--- |
| **A. Client-side `supabase.auth.signUp()`** | Admin creates user via regular client auth signup. | **Rejected:** Client-side `signUp` automatically logs the current user in as the newly created user unless session persistence is manipulated, causing the admin to be kicked out of their dashboard. |
| **B. Supabase Edge Function (`admin-create-user`)** | Edge function using Supabase Admin SDK (`service_role` key). | **Viable, but requires network hop & secret sync:** Requires edge function deployment and external environment variables. |
| **C. PostgreSQL `security definer` RPC (`admin_create_institute_user`) (Selected)** | Transactional RPC that inserts into `auth.users` with `crypt()`, verifies caller is Owner/Admin, creates `profiles` record, and links to `students` or `teachers`. | **Selected:** 100% transactional, atomic, zero network hops, strictly respects RLS & institute tenancy, never logs out the admin, and works instantly. |

---

## 4. Architectural Design & Component Breakdown

### Part 1: Smart Unauthorized Routing
- **File:** `src/routes/ProtectedRoute.tsx`
  - When `!isAuthenticated`: Navigate to `/login` with `state: { from: location }`.
  - When `isAuthenticated` but `!allowedRoles.includes(role)`:
    Navigate to `/login` with `state: { from: location, unauthorized: true, requiredRoles: allowedRoles, currentRole: role }`.
- **File:** `src/pages/Login.tsx`
  - Detect `location.state?.unauthorized`.
  - Render an alert badge: *"Access Restricted: You are signed in as {currentRole}. This section requires {requiredRoles.join(', ')} privileges."*
  - Display primary button: *"Return to Authorized Workspace"* (routes to `/portal` for student, `/platform` for super admin, `/dashboard` for owner/admin/teacher).
  - Provide regular login fields below so users can switch accounts if they hold staff credentials.

### Part 2: PWA Implementation
- **File:** `public/sw.js`
  - Cache static assets (`/index.html`, `/manifest.json`, `/logo.png`, `/favicon.svg`, font files).
  - Network-first strategy for dynamic Supabase REST queries (`/rest/v1/*`), with graceful fallback.
- **File:** `src/hooks/usePWAInstall.ts`
  - Captures `beforeinstallprompt` event.
  - Exposes `canInstall`, `isInstalled`, `isIOS`, `triggerInstall()`.
- **File:** `src/components/common/PWAInstallPrompt.tsx`
  - Header pill in `Topbar.tsx` with pulse indicator when installation is available.
  - Interactive modal explaining how to install on Android/Desktop (1-click) vs iOS Safari (Share icon → Add to Home Screen).
- **File:** `src/pages/Settings.tsx`
  - Add "Mobile App & PWA Status" card showing installation status, offline readiness, and install trigger.

### Part 3: Database User Provisioning RPC
- **File:** `supabase/migrations/0017_admin_user_provisioning.sql`
  - **Function:** `public.admin_create_institute_user(p_email text, p_password text, p_full_name text, p_role text, p_student_id uuid default null, p_teacher_id uuid default null, p_phone text default null)`
  - **Security:** `SECURITY DEFINER set search_path = public, auth, extensions`.
  - **Permissions Check:** Ensures `auth.uid()` belongs to an active `owner`, `admin`, or `super_admin` of the target institute.
  - **Password Encryption:** Generates password hash via `extensions.crypt(p_password, extensions.gen_salt('bf'))`.
  - **Insertion:** Inserts into `auth.users` with `email_confirmed_at = now()`, metadata `{ full_name: p_full_name, role: p_role }`.
  - **Profile Upsert:** Inserts into `public.profiles` with `institute_id` matching caller's institute.
  - **Linkage:** If `p_student_id` is passed, updates `students.profile_id = v_user_id`. If `p_teacher_id` is passed, updates `teachers.profile_id = v_user_id`.
  - **Auditing:** Inserts into `audit_logs` tracking user creation by administrator.

### Part 4: Admin User Management UI & WhatsApp Dispatch
- **File:** `src/services/userService.ts`
  - Functions: `listInstituteUsers()`, `createInstituteUser()`, `resetUserPassword()`, `toggleUserStatus()`.
- **File:** `src/components/users/UserManagementTab.tsx`
  - Integrated into `src/pages/Settings.tsx` (Tabs: General Settings, Institute Profile, **User Logins & Accounts**, Security & PWA).
  - Table of all accounts: Name, Email, Role badge, Linked Record (e.g. "Student: Aarav Sharma"), Created Date, Actions.
  - "Create User Account" modal with password generator and immediate WhatsApp credentials share link.
- **Modals:**
  - `src/pages/Students.tsx`: Add *"Create Login Profile"* checkbox to "Add Student" modal.
  - `src/pages/Teachers.tsx`: Add *"Create Login Profile"* checkbox to "Add Teacher" modal.
  - Success popup displays formatted WhatsApp message:
    > *"Hello {Name}, welcome to Pradeep Classes! Your portal login is ready:\nPortal: https://app.pradeepclasses.in\nUsername: {email}\nPassword: {password}\nBatch: {batch}"*
    with a green **"Send via WhatsApp"** button.

---

## 5. Verification & Testing Criteria
1. **Unauthorized Test:** Log in as student, try navigating directly to `https://app.pradeepclasses.in/fees`. Verify clean redirect to `/login` with banner and "Return to Student Portal" button.
2. **PWA Test:** Verify `sw.js` registers in DevTools Application tab without console errors; verify `manifest.json` passes Lighthouse PWA audit; verify install button shows modal on mobile/desktop.
3. **RPC & Onboarding Test:** As Admin/Owner, create a student user with email `test.student@pradeepclasses.in`. Confirm auth user created in `auth.users`, linked in `students.profile_id`, and student can sign in with the temporary password.
4. **Build & Typecheck:** Run `npm run build` to confirm 0 TypeScript errors and clean production bundle.
