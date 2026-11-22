# Design Specification: Universal ERP Lifecycle, Multi-Status Categorization, Safe Cascading Purge & Clean Handover

**Date:** 2026-11-22  
**Target Institute:** Pradeep Classes Management Platform  
**Authors:** Antigravity Team & Pradeep Classes Lead  
**Status:** APPROVED FOR PLANNING (Builder Check Integrated)

---

## 1. Intent & Problem Statement

Currently in Pradeep Classes Management Platform:
1. **Foreign Key Deletion Blockers:** Administrators are hard-blocked from deleting teachers if historical payroll exists (`"Cannot delete faculty member with 1 historical payroll record(s). Please deactivate them instead"`). In real operations, accidental entries or demo data cannot be removed without developer intervention.
2. **Limited Student Statuses:** Students only support "Active", "On hold", and "Archived". There is no dedicated categorization for **Passed Out / Alumni**, **Rusticated / Suspended**, or **Dropped Out / Withdrawn**, which are standard in educational ERP systems.
3. **Missing Administrative Lifecycle Actions:** Several modules (Batches, Payroll entries, Students) lack direct permanent deletion or granular status management, requiring manual database scripts.
4. **Demo Data in Live Environment:** Seeded sample records (Dr. Rajesh Sharma, Aarav Sharma, demo batches "JEE Advanced 2026", demo payroll, sample points/badges) must be cleanly removed so the institute administrator can onboard real students, faculty, and fee structures for an official handover.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Full Student Lifecycle Categorization:** Support 6 defined canonical states: `active`, `on_hold`, `alumni` (Passed Out), `rusticated` (Suspended/Expelled), `dropped_out` (Withdrawn), and `archived`.
- **Full Faculty Lifecycle Categorization:** Support 3 defined canonical states: `active`, `on_leave`, and `relieved` (Resigned/Relieved).
- **Universal Deactivate vs. Delete:**
  - **Deactivate (Soft Archive):** Reversible 1-click status change that preserves financial, academic, and attendance history while revoking active access and removing from daily registers.
  - **Delete (Hard Cascade):** Allows administrators to permanently purge any record, even if child records exist (payroll, attendance, submissions), with an explicit safety confirmation dialog explaining what will be purged.
- **Zero Developer Dependency:** Every module in the dashboard (Students, Teachers, Batches, Timetables, Homework, Materials, Payroll, Expenses) must have direct Edit, Deactivate/Status, and Delete capabilities.
- **Pristine Demo Data Purge:** An authorized Owner RPC to wipe all demo/test records cleanly, leaving institute settings, WhatsApp settings, and administrative accounts intact.

### Non-Goals
- **Parent Portal:** Parent accounts remain out of scope.
- **Automated External Legal Archival:** Export to government tax formats is handled through standard CSV/PDF exports already built.
- **Student Data Destruction Compliance (GDPR Right to Be Forgotten):** Hard delete serves as full physical deletion; no third-party shredder needed.

### Anti-Goals
- **Accidental Mass Deletion:** Hard cascade delete must never trigger silently or on a single unconfirmed click.
- **Silent Orphaned Records:** Deleting a teacher or student must never leave dangling `auth.users` login accounts or orphaned foreign keys.

---

## 3. Builder Check Architectural Decisions (Settled Rulings)

1. **Purge Demo Data Scope:**
   - `admin_purge_demo_data()` performs a **complete operational clean slate for the current institute**: it wipes all students, teachers, batches, attendance sessions/records, timetable slots, diaries, homework, materials, demo expenses/incomes, and payroll sheets.
   - It strictly preserves the institute profile, institute settings, WhatsApp settings, and authorized Owner/Admin user accounts.
2. **User Authentication Handling on Delete:**
   - When deleting a student or teacher with `force_cascade = true`, the RPC locates any linked `profiles` row (`student_id` or `teacher_id`).
   - If found, it revokes sessions, deletes the `profiles` entry, and safely removes the unprivileged student/teacher identity from `auth.users`. It is strictly forbidden from deleting any user account that holds `super_admin`, `owner`, or `admin` roles.
3. **Financial Ledger & Cascade Policies:**
   - Permanent delete (`force_cascade = true`) is intended for removing test/demo records or mistaken entries; it physically cleans up linked payroll and fee ledger items to prevent foreign key errors.
   - For real institute departures, the UI explicitly recommends and defaults to **Deactivate / Relieve / Rusticate / Drop Out**, which keeps 100% of the financial ledger, payroll disbursement history, and fee collections permanently intact.
4. **Behavior of Non-Active States:**
   - **Batch Allocation:** Marking a student as `rusticated` or `dropped_out` unassigns them from their batch (`batch_id = NULL`), freeing the seat count. `on_hold` students remain assigned but flagged. `alumni` retain historical batch reference.
   - **Portal Login Access:** `rusticated`, `dropped_out`, and `archived` students, and `relieved` teachers immediately have portal login access revoked (`profiles.is_active = false`). `alumni` retain read-only portal access to view past results, report cards, and certificates.
   - **Daily Registers:** Daily attendance registers and active timetables filter strictly for `status = 'active'` (and `on_hold`), excluding all alumni, rusticated, dropped out, and archived students.
5. **Database Migration Normalization:**
   - Migration `0018` normalizes all statuses to canonical lowercase (`active`, `on_hold`, `alumni`, `rusticated`, `dropped_out`, `archived`), executing an `UPDATE students SET status = 'archived' WHERE status IN ('inactive', 'Archived')` before adding the updated check constraint.

---

## 4. Database Schema & RPC Architecture (`0018_erp_lifecycle_and_clean_handover.sql`)

### 4.1 Student Status Expansion
```sql
UPDATE students SET status = 'archived' WHERE status IN ('inactive', 'Archived');
UPDATE students SET status = 'active' WHERE status = 'Active';
UPDATE students SET status = 'on_hold' WHERE status = 'On hold';

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE students ADD CONSTRAINT students_status_check 
  CHECK (status IN ('active', 'on_hold', 'alumni', 'rusticated', 'dropped_out', 'archived'));

ALTER TABLE students 
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS exit_date date;
```

### 4.2 Teacher Status Expansion
```sql
ALTER TABLE teachers 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'relieved')),
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS relieving_date date;
```

### 4.3 Cascade Deletion RPCs

#### `admin_delete_student(p_student_id UUID, p_force_cascade BOOLEAN)`
- Checks calling user role (must be `owner`, `admin`, or `super_admin`).
- If `p_force_cascade = false`:
  - Counts linked fee records, attendance records, exam marks, and doubt submissions.
  - If count > 0, returns `{ success: false, error: "Student has linked records. Use force cascade to delete permanently, or archive instead.", linked_counts: {...} }`.
- If `p_force_cascade = true`:
  - Deletes child rows: `attendance_records`, `exam_marks`, `homework_submissions`, `student_doubts`, `student_points_ledger`, `student_badges`, `student_streaks`, `fee_payments`, `fee_records`, `student_documents`, `student_certificates`.
  - Cleans up linked student user from `profiles` and `auth.users` (safely ignoring admin/owner accounts).
  - Deletes `students` row.
  - Logs action in `audit_logs`.

#### `admin_delete_teacher(p_teacher_id UUID, p_force_cascade BOOLEAN)`
- Checks calling user role.
- If `p_force_cascade = false`:
  - Counts linked payroll records (`teacher_payrolls`), assigned batches (`teacher_batches`), and diaries (`class_diaries`).
  - If count > 0, returns warning with counts.
- If `p_force_cascade = true`:
  - Deletes `teacher_payrolls`, `teacher_salary_configs`, `teacher_batches`.
  - Nullifies or cleans up teacher reference in `timetables` and `class_diaries`.
  - Cleans up linked teacher user from `profiles` and `auth.users` (safely ignoring admin/owner accounts).
  - Deletes `teachers` row.
  - Logs action in `audit_logs`.

#### `admin_delete_batch(p_batch_id UUID, p_force_cascade BOOLEAN)`
- If `p_force_cascade = false` and students are enrolled, returns warning.
- If `p_force_cascade = true`:
  - Sets `students.batch_id = NULL, students.batch_name = NULL` for enrolled students.
  - Deletes `teacher_batches` linkages, batch timetables, and empty batch attendance sessions.
  - Deletes `batches` row.

#### `admin_delete_payroll_record(p_payroll_id UUID)`
- Allows Owner/Admin to delete an erroneous/unpaid or paid payroll record directly.

#### `admin_purge_demo_data()`
- Restricted strictly to `owner` or `super_admin`.
- Wipes all operational demo data:
  - All students, teachers, batches, attendance sessions/records, timetables, diaries, homework, materials, demo expenses/incomes, and payroll sheets.
- Preserves:
  - Institute profile and institute settings.
  - WhatsApp configuration and templates.
  - Authorized Owner and Admin user accounts in `profiles` and `auth.users`.

---

## 5. Frontend User Experience & Workflows

### 5.1 Students Page (`src/pages/Students.tsx`)
1. **Status Filter Tabs:**
   - `All Students` | `Active` | `On Hold` | `Alumni / Passed Out` | `Rusticated / Suspended` | `Dropped Out` | `Archived`
2. **Row / Card Quick Actions:**
   - **Edit Student:** Opens Edit Modal.
   - **Change Status Modal:** Dropdown to switch status between Active, On Hold, Alumni, Rusticated, Dropped Out, with reason/notes and effective date.
   - **Delete Student (Trash Button):**
     - Opens Safety Modal.
     - Offers:
       1. *"Soft Archive Student"* (Preserves all history).
       2. *"Permanently Delete Student & All Linked Records"* (Purges completely; requires typing `"DELETE"`).

### 5.2 Teachers Page (`src/pages/Teachers.tsx`)
1. **Status Pills:** `Active Faculty` | `On Leave` | `Relieved / Resigned`
2. **Card Actions:**
   - **Edit Faculty:** Updates profile, subject, salary configuration.
   - **Status Dropdown / Toggle:** Switch between Active, On Leave, and Relieved.
   - **Delete Teacher (Trash Button):**
     - Resolves the current error banner:
       - Detects if payroll records exist.
       - Modal displays:
         - Option 1: *"Mark as Relieved / Resigned"* (Recommended for real staff; keeps financial trail).
         - Option 2: *"Permanently Delete Faculty & Purge Linked Records"* (For demo/mistaken records; executes `admin_delete_teacher(id, force_cascade=true)`).

### 5.3 Batches Page (`src/pages/Batches.tsx`)
- Add **Edit Batch** button.
- Add **Delete Batch** button with safety modal.

### 5.4 Teacher Payroll Page (`src/pages/TeacherPayroll.tsx`)
- Add trash/delete action on each payroll sheet line item allowing authorized Owner/Admin to cancel/delete a payroll row.

### 5.5 Clean Handover Tool in Settings (`src/pages/Settings.tsx`)
- Dedicated **"Institute Data & Handover"** card under Settings (visible to Owner/Super Admin):
  - Warning banner: *"Prepare Platform for Handover: Purge all demo/sample data before onboarding real institute records."*
  - Button: **"Purge All Demo Data & Reset to Clean Slate"**.
  - High-friction confirmation modal requiring user to type `"PURGE DEMO DATA"`.
  - On confirm, executes `admin_purge_demo_data()` and resets institute directories to clean empty states.

---

## 6. Implementation Stages & Verification Strategy

1. **Stage 1 (Database & RPCs):** Migration `0018_erp_lifecycle_and_clean_handover.sql` with unit tests for status transitions, cascade deletions, and demo purge.
2. **Stage 2 (Services):** Update `studentsService.ts`, `teachersService.ts`, `batchesService.ts`, and `financeService.ts`.
3. **Stage 3 (Teachers Page):** Solve the deletion blocker by implementing the dual Relieve vs. Force-Delete modal.
4. **Stage 4 (Students Page):** Implement the 6-status tabs, status change modal (Alumni, Rusticated, Dropped Out), and cascade delete modal.
5. **Stage 5 (Batches & Payroll):** Add Delete Batch and Delete Payroll Sheet actions.
6. **Stage 6 (Clean Slate Handover Tool & Execution):** Add Settings purge modal and execute clean state.
7. **Stage 7 (Full Verification & Build):** Run all test suites and compile production build.
