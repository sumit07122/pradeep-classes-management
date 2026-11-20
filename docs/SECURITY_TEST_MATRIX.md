# Pradeep Classes Management: Security & Authorization Test Matrix

This matrix documents the verification specifications for PostgreSQL Row Level Security (RLS) policies, database integrity triggers, and authentication trust boundaries across migrations 0001, 0002, and 0003.

---

## 1. Test Execution Status & Environment Reconciliation

| Test Category | Target Environment | Execution Tool | Current Status |
|---|---|---|---|
| **Frontend Type Checking** | Local Workstation | `npx tsc --noEmit` | **VERIFIED & PASSING (0 errors)** |
| **Production App Bundle** | Local Workstation | `npm run build` | **VERIFIED & PASSING (5.05s)** |
| **Local Database Execution** | Local PostgreSQL Daemon | `psql` / Supabase CLI | **NOT APPLICABLE** (No local PostgreSQL / Docker engine installed) |
| **Database RLS & Trigger Suite** | Live Supabase / PostgreSQL 15+ | Supabase SQL Editor | **READY & PENDING LIVE EXECUTION** |

*Note: In accordance with verification standards, database assertions are labeled PENDING until physically executed against a live Supabase instance with migrations 0001, 0002, and 0003 applied.*

---

## 2. Comprehensive Security Assertion Matrix

| # | Scenario / Actor | Target Table / Action | Expected Policy Verdict | Policy / Mechanism | Test Script Reference |
|---|---|---|---|---|---|
| **0** | **Untrusted User (Pre-Bootstrap)** | `profiles` INSERT `role = 'owner'` before any owner exists | **DENIED (Exception)** | `trg_prevent_role_escalation` checks `internal_bootstrap_in_progress` | `PRE-BOOTSTRAP TEST` in `security_tests.sql` |
| **1** | **Initial Owner Bootstrap** | Single-use `bootstrap_initial_owner(email)` in trusted SQL context | **ALLOWED (Preserves Name)** | Advisory lock + count check + metadata extraction | `BOOTSTRAP TEST` in `security_tests.sql` |
| **2** | **Unauthenticated (Anon)** | `students`, `batches`, `attendance_records` SELECT | **DENIED (0 rows)** | RLS enabled; no anon policy granted | `TEST 1` in `security_tests.sql` |
| **3** | **Owner** | Full database SELECT / INSERT / UPDATE / DELETE | **ALLOWED** | `*_admin_all` policies | `TEST 2` in `security_tests.sql` |
| **4** | **Admin** | Full database SELECT / INSERT / UPDATE / DELETE | **ALLOWED** | `*_admin_all` policies | `TEST 3` in `security_tests.sql` |
| **5** | **Teacher (Assigned Batch)** | `batches`, `students` in assigned batch SELECT | **ALLOWED** | `batches_teacher_read`, `students_teacher_read` | `TEST 4` in `security_tests.sql` |
| **6** | **Teacher (Unassigned Batch)** | `students` in unassigned batch SELECT | **DENIED (0 rows)** | Requires `is_teacher_assigned_to_batch` | `TEST 4` in `security_tests.sql` |
| **7** | **Teacher (Assigned Batch Attendance)** | `attendance_sessions` & `attendance_records` INSERT | **ALLOWED** | `attendance_*_teacher_insert` | `TEST 5` in `security_tests.sql` |
| **8** | **Teacher (Unassigned Batch Attendance)** | `attendance_sessions` INSERT for unassigned batch | **DENIED (Exception)** | Checked by RLS `attendance_sessions_teacher_insert` | `TEST 6` in `security_tests.sql` |
| **9** | **Teacher (Cross-Batch Student Marking)** | `attendance_records` INSERT where student batch != session batch | **DENIED (Integrity Exception)** | Database trigger `trg_validate_attendance_record` | `TEST 7` in `security_tests.sql` |
| **10** | **Teacher (Attendance Modification)** | `attendance_records` UPDATE / DELETE | **DENIED** | No UPDATE/DELETE policy granted to teachers | Verified in RLS grant schema |
| **11** | **Student (Self Access)** | Own `students`, own `attendance_records`, own `fee_records` SELECT | **ALLOWED** | Filtered by `profile_id = auth.uid()` | `TEST 8` in `security_tests.sql` |
| **12** | **Student (Peer Access)** | Other students' records, attendance, or fees SELECT | **DENIED (0 rows)** | Filtered by `profile_id = auth.uid()` | `TEST 8` in `security_tests.sql` |
| **13** | **Parent (Verified Linked Child)** | Linked child's `students`, `attendance`, `fees` SELECT | **ALLOWED** | `*_parent_read` via `public.parent_students` | `TEST 9` in `security_tests.sql` |
| **14** | **Parent (Unlinked / Unverified Child)** | Other students' records or unverified relationships SELECT | **DENIED (0 rows)** | Filtered by `is_verified = true` check | `TEST 9` in `security_tests.sql` |
| **15** | **Student / Teacher Privilege Escalation** | `profiles` UPDATE `role = 'owner'` or `'admin'` | **DENIED (Exception)** | Trigger `trg_prevent_role_escalation` | `TEST 10` in `security_tests.sql` |
| **16** | **Repeated / Concurrent Owner Bootstrap** | Subsequent call to `bootstrap_initial_owner` | **DENIED (Exception)** | `pg_advisory_xact_lock` + count check | `TEST 11` in `security_tests.sql` |

---

## 3. Live Execution Procedure in Supabase SQL Editor

The test file `supabase/tests/security_tests.sql` is authored in pure, standard SQL syntax without psql meta-commands:

1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Copy and paste the entire content of `supabase/tests/security_tests.sql`.
3. Click **Run**.
4. The script runs inside a transaction block (`BEGIN; ... ROLLBACK;`) and prints notices:
```
NOTICE:  PRE-BOOTSTRAP TEST PASSED: Direct privileged profile insertion blocked prior to owner existence.
NOTICE:  BOOTSTRAP TEST PASSED: Initial owner bootstrapped via authorized procedure preserving authentic name.
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
NOTICE:  TEST 11 PASSED: Secondary owner bootstrap call successfully blocked by advisory lock & count check.
```
5. If any assertion fails, PostgreSQL raises an exception and aborts immediately.
