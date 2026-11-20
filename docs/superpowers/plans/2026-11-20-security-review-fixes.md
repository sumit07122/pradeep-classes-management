# Corrective Security Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement corrective migration `0003_security_review_fixes.sql` and frontend auth hardening to eliminate permissive RLS leaks, enforce teacher batch-scoped access, replace phone-only parent authorization with verified parent-student relations, harden Owner bootstrap against concurrency, fail-closed on auth profile errors, and document reproducible SQL security verification tests.

**Architecture:** PostgreSQL Row Level Security (RLS) policies are combined with `OR`. This plan drops all legacy broad policies from `0001` and `0002`, replacing them with role-exclusive policies. It introduces `public.parent_students` and `public.students.profile_id` for cryptographic/relational authorization instead of telephone matching. Frontend auth service and context are refactored to fail-closed on unprovisioned profiles and decouple dev role switching from the session lifecycle.

**Architecture Diagram:**

```mermaid
graph TD
    subgraph "PostgreSQL Security Layer (Migration 0003)"
        Profiles[public.profiles] --> EscalationTrigger[trg_prevent_role_escalation (Owner only)]
        Users[auth.users] --> SingleUseBootstrap[bootstrap_initial_owner (Advisory Lock + Count=0)]
        TeacherBatches[public.teacher_batches] --> ScopeFunc[is_teacher_assigned_to_batch]
        ScopeFunc --> BatchPolicy[Batches RLS (Assigned only)]
        ScopeFunc --> StudentPolicy[Students RLS (Assigned only)]
        ScopeFunc --> SessionPolicy[Attendance Sessions RLS (Assigned only)]
        ScopeFunc --> RecordPolicy[Attendance Records RLS (Assigned & Batch-matched)]
        RecordPolicy --> IntegrityTrigger[trg_validate_attendance_record_batch]
        ParentStudents[public.parent_students (Verified)] --> ParentRLS[Parent Access RLS (Children only)]
    end

    subgraph "Frontend Auth Hardening"
        AuthService[authService] --> FailClosed[Fail-Closed Profile Resolution]
        AuthContext[AuthContext] --> StableInit[Stable Session Listener (No role-dep loop)]
    end
```

**Tech Stack:** PostgreSQL 15+ (Supabase), Row Level Security, React 18, TypeScript 5.7, Vite 6.

**Spec:** Corrective requirements for Milestone 1:
1. Safe sequential migration `0003_security_review_fixes.sql`.
2. Fix teacher data visibility (drop broad 0001 policies, enforce batch-scoped access for students, batches, attendance).
3. Enforce attendance integrity (session & record batch matching, duplicate prevention, updates restricted to admin/owner).
4. Replace phone-only parent relationships with `parent_students` verified table and `students.profile_id`.
5. Harden Owner bootstrap with transaction advisory locks, preserve user metadata name, prevent concurrent creation.
6. Fail-closed auth error handling, remove `role` dependency loop in `AuthContext`, clean up listeners.
7. Security test matrix and verification script in `supabase/tests/security_tests.sql`.

## Global Constraints

- Do not rewrite migration history: `0001` and `0002` must remain intact. All fixes must be in `0003_security_review_fixes.sql`.
- PostgreSQL RLS policies are permissive by default and combine with `OR`. Dropping the legacy broad policies (`*_staff_read`) is mandatory.
- Never expose Supabase `service_role` keys in client-side code or `VITE_` variables.
- When an authenticated user has no row in `public.profiles`, fail-closed: do NOT synthesize a guest/student profile.
- Dev role switcher must never trigger re-authentication or session reloading.
- `npm run build` (`tsc -b && vite build`) must pass with 0 errors.

## Review Focus

1. **Permissive Policy Overlap:** If `students_staff_read` is not dropped, any teacher can read all students despite new teacher-scoped policies. Ensure `drop policy if exists` runs for all legacy broad policies.
2. **Attendance Batch Mismatch Attack:** A teacher assigned to Batch A attempts to mark attendance for a student enrolled in Batch B within an attendance session for Batch A. Must be rejected by both RLS and trigger.
3. **Concurrent Owner Bootstrap Race Condition:** Two simultaneous calls to `bootstrap_initial_owner` with different emails. Advisory lock must serialize execution, and the second call must fail.
4. **Unprovisioned User Login:** An auth user exists in `auth.users` without a matching `public.profiles` row. Frontend must display a clear "Profile Not Provisioned" alert and deny entry.
5. **Dev Role Loop:** Changing dev role in local preview must update active UI role without triggering network re-authentication.

---

### Task 1: Write Migration `0003_security_review_fixes.sql` - Core RLS & Batch Scoping

**Files:**
- Create: `supabase/migrations/0003_security_review_fixes.sql`

**Interfaces:**
- Drops legacy broad policies:
  `batches_staff_read`, `students_staff_read`, `students_self_read`, `teachers_staff_read`, `teacher_batches_staff_read`, `attendance_staff_read`, `attendance_records_staff_read`, `attendance_records_student_read`.
- Produces:
  - Scoped policies for `batches`:
    - `batches_admin_all` (Owner/Admin)
    - `batches_teacher_read` (Assigned teachers only)
    - `batches_student_read` (Students enrolled in batch)
    - `batches_parent_read` (Parents of verified enrolled students)
  - Scoped policies for `students`:
    - `students_admin_all` (Owner/Admin)
    - `students_teacher_read` (Assigned teachers only)
    - `students_self_read` (Matching `profile_id = auth.uid()`)
    - `students_parent_read` (Verified linked parents)
  - Scoped policies for `teachers` & `teacher_batches`:
    - Teachers can view faculty directory and read only their own assignments.

- [ ] **Step 1: Write policy drops and replacements** for `batches`, `students`, `teachers`, and `teacher_batches`.
- [ ] **Step 2: Add `profile_id` column to `public.students`** with foreign key to `public.profiles(id)`.
- [ ] **Step 3: Verify SQL syntax.**

---

### Task 2: Attendance Integrity & Batch Validation Trigger

**Files:**
- Modify: `supabase/migrations/0003_security_review_fixes.sql`

**Interfaces:**
- Produces:
  - Scoped policies for `attendance_sessions`:
    - `attendance_sessions_admin_all` (Owner/Admin)
    - `attendance_sessions_teacher_read` (Assigned teachers only)
    - `attendance_sessions_teacher_insert` (Assigned teachers only, `taken_by = auth.uid()`)
    - `attendance_sessions_student_read` (Enrolled batch students/parents)
    - No UPDATE or DELETE policy for teachers.
  - Scoped policies for `attendance_records`:
    - `attendance_records_admin_all` (Owner/Admin)
    - `attendance_records_teacher_read` (Assigned teachers only)
    - `attendance_records_teacher_insert` (Assigned batch students only)
    - `attendance_records_student_read` (Own records only)
    - `attendance_records_parent_read` (Linked children only)
    - No UPDATE or DELETE policy for teachers.
  - Database Trigger `trg_validate_attendance_record_batch`:
    Rejects any insert into `attendance_records` if `student.batch_id != session.batch_id`.

- [ ] **Step 1: Add scoped attendance policies and trigger definition** into `0003_security_review_fixes.sql`.
- [ ] **Step 2: Add unique index** on `attendance_records(session_id, student_id)`.

---

### Task 3: Verified Parent-Student Relationship Table

**Files:**
- Modify: `supabase/migrations/0003_security_review_fixes.sql`

**Interfaces:**
- Produces:
  - `public.parent_students` table:
    `id uuid PK`, `parent_profile_id uuid FK`, `student_id uuid FK`, `relationship_type text`, `is_verified boolean`, `verified_by uuid FK`, `verified_at timestamptz`, `created_at timestamptz`.
  - RLS policies:
    - `parent_students_admin_all` (Owner/Admin full CRUD)
    - `parent_students_parent_read` (Parents can read only verified links where `parent_profile_id = auth.uid() and is_verified = true`)
    - `parent_students_student_read` (Students can read their linked parents)

- [ ] **Step 1: Define `parent_students` table and RLS policies** in `0003_security_review_fixes.sql`.
- [ ] **Step 2: Update student/parent fee policies** to use `parent_students` instead of phone number matching.

---

### Task 4: Harden Owner Bootstrap & Anti-Escalation

**Files:**
- Modify: `supabase/migrations/0003_security_review_fixes.sql`

**Interfaces:**
- Produces:
  - Hardened `bootstrap_initial_owner(target_email text)`:
    - Takes transaction advisory lock `pg_advisory_xact_lock(hashtext('initial_owner_bootstrap_lock'))`.
    - Checks count of existing owners. If > 0, raises exception.
    - Preserves existing `full_name` from `auth.users.raw_user_meta_data->>'full_name'` or profile.
    - Logs audit log entry.
  - Hardened `prevent_self_role_escalation()`:
    - Enforces that assigning `owner` or `admin` role requires caller to be `owner`.
    - Revokes execute from `public`, `anon`, `authenticated`.

- [ ] **Step 1: Implement hardened function and trigger in `0003_security_review_fixes.sql`.**
- [ ] **Step 2: Ensure proper privilege grants and revokes.**

---

### Task 5: Frontend Auth Service & Error Handling Hardening

**Files:**
- Modify: `src/services/authService.ts`
- Modify: `src/context/AuthContext.tsx`
- Modify: `src/types/auth.ts`
- Modify: `src/services/studentsService.ts`

**Interfaces:**
- `authService.getUserProfile`: returns `{ profile: UserProfile | null; error?: string; notProvisioned?: boolean }`.
- `authService.signIn`: fails closed if user has no valid profile (returns `notProvisioned` error).
- `AuthContext`:
  - Removes `role` from `useEffect` dependencies to prevent re-authentication loops on dev role switch.
  - Displays distinct error messages for network errors vs unprovisioned profile.
  - Proper unsubscribe cleanup.

- [ ] **Step 1: Refactor `authService.ts`** to fail closed on missing profile and return typed error reasons.
- [ ] **Step 2: Refactor `AuthContext.tsx`** to handle unprovisioned profile states cleanly and decouple `setDevRole`.
- [ ] **Step 3: Update `studentsService.ts`** to support `profile_id` on students.

---

### Task 6: Security Verification Test Suite & Documentation

**Files:**
- Create: `supabase/tests/security_tests.sql`
- Create: `docs/SECURITY_TEST_MATRIX.md`
- Modify: `docs/DATABASE_ARCHITECTURE.md`
- Modify: `docs/OWNER_BOOTSTRAP.md`

**Interfaces:**
- Produces:
  - `security_tests.sql`: Executable PostgreSQL test script using `SET LOCAL ROLE` and `set_config('request.jwt.claims', ...)` verifying all 11 security scenarios.
  - `SECURITY_TEST_MATRIX.md`: Complete matrix of roles, test actions, expected outcomes, and reproduction instructions.
  - Updated documentation in `DATABASE_ARCHITECTURE.md` and `OWNER_BOOTSTRAP.md`.

- [ ] **Step 1: Write `security_tests.sql`** with test cases for all 11 scenarios.
- [ ] **Step 2: Write `docs/SECURITY_TEST_MATRIX.md`**.
- [ ] **Step 3: Update `docs/DATABASE_ARCHITECTURE.md` and `docs/OWNER_BOOTSTRAP.md`**.

---

### Task 7: Build Verification, Review & Git Push

- [ ] **Step 1: Run TypeScript check:** `npx.cmd tsc --noEmit`.
- [ ] **Step 2: Run production build:** `npm.cmd run build`.
- [ ] **Step 3: Commit and push changes to `main` branch:** `git push origin main`.
- [ ] **Step 4: Report comprehensive results.**
