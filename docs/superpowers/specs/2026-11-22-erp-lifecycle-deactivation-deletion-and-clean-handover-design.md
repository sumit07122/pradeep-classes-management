# Design Specification: Universal ERP Lifecycle, Multi-Status Categorization, Safe Cascading Purge & Clean Handover

**Date:** 2026-11-22  
**Target Institute:** Pradeep Classes Management Platform  
**Authors:** Antigravity Team & Pradeep Classes Lead  
**Status:** DRAFT (Under Builder Check)

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
- **Full Student Lifecycle Categorization:** Support 6 defined states: `Active`, `On Hold`, `Alumni` (Passed Out), `Rusticated` (Suspended/Expelled), `Dropped Out` (Withdrawn), and `Archived`.
- **Full Faculty Lifecycle Categorization:** Support 3 defined states: `Active`, `On Leave`, and `Relieved / Resigned`.
- **Universal Deactivate vs. Delete:**
  - **Deactivate (Soft):** Reversible 1-click status change that preserves financial, academic, and attendance history while revoking active access and removing from daily registers.
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

## 3. Database Schema & RPC Architecture (`0018_erp_lifecycle_and_clean_handover.sql`)

### 3.1 Student Status Expansion
Modify `students` table:
```sql
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE students ADD CONSTRAINT students_status_check 
  CHECK (status IN ('active', 'on_hold', 'alumni', 'rusticated', 'dropped_out', 'archived', 'Active', 'On hold', 'Archived'));

ALTER TABLE students 
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS exit_date date;
```

### 3.2 Teacher Status Expansion
Modify `teachers` table:
```sql
ALTER TABLE teachers 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'relieved')),
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS relieving_date date;
```

### 3.3 Cascade Deletion RPCs

#### `admin_delete_student(p_student_id UUID, p_force_cascade BOOLEAN)`
- Checks calling user role (must be `owner`, `admin`, or `super_admin`).
- If `p_force_cascade = false`:
  - Counts linked fee records, attendance records, exam marks, and doubt submissions.
  - If any count > 0, returns `{ success: false, error: "Student has X attendance and Y fee records. Use force cascade to delete permanently, or archive instead.", linked_counts: {...} }`.
- If `p_force_cascade = true`:
  - Deletes student attendance records (`attendance_records`).
  - Deletes student exam marks (`exam_marks`).
  - Deletes homework submissions (`homework_submissions`).
  - Deletes doubts (`student_doubts`).
  - Deletes points ledger, streaks, and badges (`student_points_ledger`, `student_badges`, `student_streaks`).
  - Deletes student fee payments and fee records (`fee_payments`, `fee_records`).
  - Deletes student documents and certificates (`student_documents`, `student_certificates`).
  - Unlinks or removes user login account from `profiles` and `auth.users`.
  - Deletes the `students` row.
  - Logs action in `audit_logs`.

#### `admin_delete_teacher(p_teacher_id UUID, p_force_cascade BOOLEAN)`
- Checks calling user role.
- If `p_force_cascade = false`:
  - Counts linked payroll records (`teacher_payrolls`), assigned batches (`teacher_batches`), and diaries (`class_diaries`).
  - If any count > 0, returns `{ success: false, error: "Teacher has X payroll records and Y assigned batches...", linked_counts: {...} }`.
- If `p_force_cascade = true`:
  - Deletes teacher payroll records (`teacher_payrolls`).
  - Deletes teacher salary configs (`teacher_salary_configs`).
  - Deletes teacher batch linkages (`teacher_batches`).
  - Nullifies or cleans up teacher reference in `timetables` and `class_diaries` (or deletes if orphaned).
  - Unlinks or removes user login account from `profiles` and `auth.users`.
  - Deletes `teachers` row.
  - Logs action in `audit_logs`.

#### `admin_delete_batch(p_batch_id UUID, p_force_cascade BOOLEAN)`
- If `p_force_cascade = false`:
  - Checks if active students are assigned (`students.batch_id = p_batch_id`). If > 0, returns warning.
- If `p_force_cascade = true`:
  - Sets `students.batch_id = NULL, students.batch_name = NULL` for enrolled students.
  - Deletes `teacher_batches` linkages.
  - Deletes batch timetables and attendance sessions.
  - Deletes batch row.

#### `admin_delete_payroll_record(p_payroll_id UUID)`
- Allows Owner/Admin to delete or cancel an erroneous/unpaid or paid payroll record directly.

#### `admin_purge_demo_data()`
- Restricted strictly to `owner` or `super_admin`.
- Wipes:
  - All students and related attendance, fee records, badges, points.
  - All teachers (except does not touch the logged-in owner/admin profile).
  - All demo batches.
  - All demo timetables, diaries, homework, materials.
  - All demo expenses and incomes.
  - All demo payroll records.
- Preserves:
  - Institute profile and institute settings.
  - WhatsApp configuration and templates.
  - Authorized Owner and Admin user accounts in `profiles` and `auth.users`.

---

## 4. Frontend User Experience & Workflows

### 4.1 Students Page (`src/pages/Students.tsx`)
1. **Status Filter Tabs (Sub-Navigation):**
   - `All Students` (Count)
   - `Active` (Count, green)
   - `On Hold` (Count, yellow)
   - `Alumni / Passed Out` (Count, blue)
   - `Rusticated / Suspended` (Count, red)
   - `Dropped Out` (Count, orange)
   - `Archived` (Count, gray)
2. **Row / Card Quick Actions:**
   - **Edit Student:** Opens Edit Modal.
   - **Change Status Modal:** Dropdown to switch status between Active, On Hold, Alumni, Rusticated, Dropped Out. If selecting Rusticated or Dropped Out, prompts for a reason/note and effective date.
   - **Delete Student (Trash Button):**
     - Opens Safety Modal:
       - If student has linked records: Displays breakdown (e.g. "3 Attendance Records, 1 Fee Record").
       - Offers two choices:
         1. *"Soft Archive Student"* (Safe, preserves history).
         2. *"Permanently Delete Student & All Linked Records"* (Requires typing `"DELETE"` to confirm).

### 4.2 Teachers Page (`src/pages/Teachers.tsx`)
1. **Status Pills:**
   - `Active Faculty`
   - `On Leave`
   - `Relieved / Resigned`
2. **Card Actions:**
   - **Edit Faculty:** Updates profile, subject, salary configuration.
   - **Status Dropdown / Toggle:** Switch between Active, On Leave, and Relieved.
   - **Delete Teacher (Trash Button):**
     - Solves the screenshot blocker:
       - Detects if payroll records exist.
       - Modal displays:
         - *"This faculty member has 1 historical payroll record and 2 assigned batches."*
         - Option 1: *"Mark as Relieved / Resigned"* (Recommended for real staff; keeps financial trail).
         - Option 2: *"Permanently Delete Faculty & Purge Linked Records"* (For demo/mistaken records; executes `admin_delete_teacher(id, force_cascade=true)`).

### 4.3 Batches Page (`src/pages/Batches.tsx`)
- Add **Edit Batch** button.
- Add **Delete Batch** button with confirmation modal (prompting to unassign enrolled students or cancel).

### 4.4 Teacher Payroll Page (`src/pages/TeacherPayroll.tsx`)
- Add a trash/delete action on each payroll sheet line item allowing authorized Owner/Admin to cancel/delete a payroll row.

### 4.5 Clean Handover Tool in Settings (`src/pages/Settings.tsx`)
- Dedicated **"Institute Data & Handover"** card under Settings (visible to Owner/Super Admin):
  - Warning banner: *"Prepare Platform for Handover: Purge all demo/sample data before onboarding real institute records."*
  - Button: **"Purge All Demo Data & Reset to Clean Slate"**.
  - High-friction confirmation modal requiring user to type `"PURGE DEMO DATA"`.
  - On confirm, executes `admin_purge_demo_data()` and resets institute directories to clean empty states.

---

## 5. Security & Permission Matrix

| Role | Change Student Status | Delete Student (Cascade) | Relieve Teacher | Delete Teacher (Cascade) | Delete Batch | Purge Demo Data |
|---|---|---|---|---|---|---|
| **Super Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ⚠️ (Requires confirm) | ✅ | ❌ (Owner only) |
| **Teacher** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Student** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 6. Implementation Stages & Verification Strategy

1. **Stage 1 (Database & RPCs):** Migration `0018_erp_lifecycle_and_clean_handover.sql` with unit tests for status transitions and cascade deletions.
2. **Stage 2 (Services):** Update `studentsService.ts`, `teachersService.ts`, `batchesService.ts`, and `financeService.ts`.
3. **Stage 3 (Teachers Page):** Solve the deletion blocker by implementing the dual Relieve vs. Force-Delete modal.
4. **Stage 4 (Students Page):** Implement the 6-status tabs, status change modal (Alumni, Rusticated, Dropped Out), and cascade delete modal.
5. **Stage 5 (Batches & Payroll):** Add Delete Batch and Delete Payroll Sheet actions.
6. **Stage 6 (Clean Slate Handover Tool & Execution):** Add Settings purge modal and verify clean state.
7. **Stage 7 (Full Verification & Build):** Run all test suites and compile production build.
