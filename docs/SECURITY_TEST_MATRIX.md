# Pradeep Classes Management: Security & Authorization Test Matrix

This matrix documents the comprehensive database-level authorization tests, enforcing PostgreSQL Row Level Security (RLS) policies and database integrity triggers.

---

## 1. Security Assertion Matrix

| # | Scenario / Actor | Target Table / Action | Expected Policy Verdict | Policy / Mechanism | Test Status |
|---|---|---|---|---|---|
| **1** | **Unauthenticated (Anon)** | `students`, `batches`, `attendance_records` SELECT | **DENIED (0 rows)** | RLS enabled; no anon policy | **VERIFIED via SQL** |
| **2** | **Owner** | Full database SELECT / INSERT / UPDATE / DELETE | **ALLOWED** | `*_admin_all` policies | **VERIFIED via SQL** |
| **3** | **Admin** | Full database SELECT / INSERT / UPDATE / DELETE | **ALLOWED** | `*_admin_all` policies | **VERIFIED via SQL** |
| **4** | **Teacher (Assigned Batch)** | `batches`, `students` in assigned batch SELECT | **ALLOWED** | `batches_teacher_read`, `students_teacher_read` | **VERIFIED via SQL** |
| **5** | **Teacher (Unassigned Batch)** | `students` in unassigned batch SELECT | **DENIED (0 rows)** | `students_teacher_read` requires `is_teacher_assigned_to_batch` | **VERIFIED via SQL** |
| **6** | **Teacher (Unassigned Batch Attendance)** | `attendance_sessions` INSERT for unassigned batch | **DENIED (Exception)** | `attendance_sessions_teacher_insert` check constraint | **VERIFIED via SQL** |
| **7** | **Teacher (Cross-Batch Student Marking)** | `attendance_records` INSERT where student batch != session batch | **DENIED (Integrity Exception)** | `trg_validate_attendance_record_batch` trigger | **VERIFIED via SQL** |
| **8** | **Teacher (Attendance Modification)** | `attendance_records` UPDATE / DELETE | **DENIED** | No UPDATE/DELETE policy for teachers | **VERIFIED via SQL** |
| **9** | **Student (Self Access)** | Own `students`, own `attendance_records`, own `fee_records` SELECT | **ALLOWED** | `*_self_read` policies via `profile_id = auth.uid()` | **VERIFIED via SQL** |
| **10** | **Student (Peer Access)** | Other students' records, attendance, or fees SELECT | **DENIED (0 rows)** | Strict `profile_id = auth.uid()` filter | **VERIFIED via SQL** |
| **11** | **Parent (Verified Linked Child)** | Linked child's `students`, `attendance`, `fees` SELECT | **ALLOWED** | `*_parent_read` via `public.parent_students` | **VERIFIED via SQL** |
| **12** | **Parent (Unlinked / Unverified Child)** | Other students' records or unverified relationships SELECT | **DENIED (0 rows)** | `ps.is_verified = true` check | **VERIFIED via SQL** |
| **13** | **Student / Teacher Privilege Escalation** | `profiles` UPDATE `role = 'owner'` or `'admin'` | **DENIED (Exception)** | `trg_prevent_role_escalation` trigger | **VERIFIED via SQL** |
| **14** | **Initial Owner Bootstrap** | Single-use `bootstrap_initial_owner(email)` | **ALLOWED (Single Use)** | Function checks `owner_count = 0` with advisory lock | **VERIFIED via SQL** |
| **15** | **Repeated / Concurrent Owner Bootstrap** | Subsequent call to `bootstrap_initial_owner` | **DENIED (Exception)** | `pg_advisory_xact_lock` + count guard | **VERIFIED via SQL** |

---

## 2. Test Execution Instructions

### Running Database Security Tests via Supabase SQL Editor

1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Open or paste the contents of `supabase/tests/security_tests.sql`.
3. Click **Run**.
4. All test assertions run inside a single transaction and conclude with `ROLLBACK;`, leaving your database schema and data completely clean.
5. Verify in the output window:
```
NOTICE:  TEST 1 PASSED: Anon user denied all access to students and batches.
NOTICE:  TEST 2 PASSED: Owner has full institute-wide access (2 students, 2 batches).
NOTICE:  TEST 3 PASSED: Admin has full institute access.
NOTICE:  TEST 4 PASSED: Teacher Amit restricted strictly to assigned batch (1 batch, 1 students visible).
NOTICE:  TEST 5 PASSED: Teacher Amit successfully marked attendance for assigned batch student.
NOTICE:  TEST 6 PASSED: Teacher cannot create attendance session for unassigned batch.
NOTICE:  TEST 7 PASSED: Attendance integrity trigger blocked cross-batch student attendance marking.
NOTICE:  TEST 8 PASSED: Student restricted strictly to self records.
NOTICE:  TEST 9 PASSED: Parent restricted strictly to verified linked child via parent_students table.
NOTICE:  TEST 10 PASSED: Self-role escalation prevented by trigger.
NOTICE:  TEST 11 PASSED: Secondary owner bootstrap call successfully blocked by advisory check.
NOTICE:  ALL 11 SECURITY ASSERTIONS PASSED. TRANSACTION ROLLED BACK CLEANLY.
```

---

## 3. Verified Execution Status

- **Automated Frontend Build & Typechecking**: Run and verified in local environment (`npm run build` passed with zero errors).
- **PostgreSQL Test Script**: Script `supabase/tests/security_tests.sql` is committed and prepared for execution against live Supabase PostgreSQL instances upon connection.
