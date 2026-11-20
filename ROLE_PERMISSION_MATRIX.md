# Pradeep Classes Management Platform — Role & Permission Matrix

**System Architecture:** Single-Institute Operation (`Pradeep Classes`)  
**Active Operational Roles:** 4 Roles (`owner`, `admin`, `teacher`, `student`)  
**Deprecated Role:** `parent` (Completely dismantled; guardian contact info retained as administrative contact attributes on `students`)  

---

## 1. Role Definitions

| Role | Designation | Primary Responsibilities | Authorization Boundary |
|---|---|---|---|
| **`owner`** | Institute Principal / Managing Director | Full administrative authority over institute configuration, financial ledgers, fee reversals, staff employment, and Meta WhatsApp Cloud API credentials. | Unrestricted across Pradeep Classes (`institute_id = '11111111-2222-3333-4444-555555555555'`). |
| **`admin`** | Academic Coordinator / Operations Manager | Daily operational management: student admissions, batch allocation, timetable scheduling, fee collection, exam creation, and announcements. | Full operational write access; cannot re-assign institute ownership or delete audit trails. |
| **`teacher`** | Faculty Member / Classroom Instructor | Roll call marking for assigned batches, academic marks entry, study notes upload, and daily homework assignment. | Read access to assigned batch students and timetable; write access to roll call (within 48-hour window), exam marks, and study materials. |
| **`student`** | Enrolled Coaching Candidate | Personal academic portal view: attendance compliance percentage, report cards, fee receipts, timetable, and study materials download. | Read-only access strictly restricted to own student record, enrolled batch schedule, and published results (`profile_id = auth.uid()`). |

---

## 2. Comprehensive Table-Level CRUD Permissions Matrix

| Database Entity | Action | Owner | Admin | Teacher | Student | Enforcement Mechanism |
|---|---|:---:|:---:|:---:|:---:|---|
| **`institutes`** | SELECT | Yes | Yes | Yes | Yes | `institutes_read_active` |
| | UPDATE | Yes | No | No | No | `institutes_owner_update` |
| **`profiles`** | SELECT | Yes | Yes | Staff-Only | Own-Only | `profiles_read_own_or_staff` |
| | UPDATE | Yes (Non-Role) | Yes (Non-Role) | Own-Only | Own-Only | `trg_prevent_role_escalation` |
| **`batches`** | SELECT | Yes | Yes | Yes | Enrolled | `batches_read_policy` |
| | INSERT / UPDATE | Yes | Yes | No | No | `batches_staff_all` |
| **`students`** | SELECT | Yes | Yes | Assigned Batches | Own Record | `students_read_scoped` |
| | INSERT / UPDATE | Yes | Yes | No | No | `students_staff_write` |
| **`student_batch_history`** | SELECT | Yes | Yes | No | No | `batch_history_admin_read` |
| | INSERT | Yes (Via RPC) | Yes (Via RPC) | No | No | `trg_validate_student_batch_history_tenant` |
| | UPDATE / DELETE | **BLOCKED** | **BLOCKED** | **BLOCKED** | **BLOCKED** | `trg_prevent_history_deletion/modification` |
| **`teachers`** | SELECT | Yes | Yes | Yes | Assigned Faculty | `teachers_read_active` |
| | INSERT / UPDATE | Yes | Yes | No | No | `teachers_staff_write` |
| **`teacher_batches`** | SELECT | Yes | Yes | Own Batches | Enrolled Batches | `teacher_batches_read` |
| | INSERT / UPDATE | Yes | Yes | No | No | `teacher_batches_write` |
| **`attendance_sessions`** | SELECT | Yes | Yes | Assigned Batches | Enrolled Batch | `attendance_sessions_read` |
| | INSERT / UPDATE | Yes | Yes | Assigned Batches (48h) | No | `attendance_records_teacher_update` |
| **`attendance_records`** | SELECT | Yes | Yes | Assigned Batches | Own Records | `attendance_records_read` |
| | INSERT / UPDATE | Yes | Yes | Assigned Batches (48h) | No | `validate_attendance_record_integrity` |
| **`fee_structures`** | SELECT | Yes | Yes | No | Yes | `fee_structures_read` |
| | INSERT / UPDATE | Yes | Yes | No | No | `fee_structures_write` |
| **`fee_records`** | SELECT | Yes | Yes | No | Own Invoices | `fee_records_student_read` |
| | INSERT / UPDATE | Yes | Yes | No | No | `fee_records_admin_all` |
| **`fee_payments`** | SELECT | Yes | Yes | No | Own Receipts | `fee_payments_student_read` |
| | INSERT (Collect) | Yes (Via RPC) | Yes (Via RPC) | No | No | `collect_fee_payment` (Row-Locking) |
| | REVERSE | Yes (Via RPC) | Yes (Via RPC) | No | No | `reverse_fee_payment` |
| | DIRECT UPDATE/DELETE | **BLOCKED** | **BLOCKED** | **BLOCKED** | **BLOCKED** | `trg_prevent_payment_ledger_tampering` |
| **`exams`** | SELECT | Yes | Yes | Yes | Published Only | `exams_read_published_or_staff` |
| | INSERT / UPDATE | Yes | Yes | Yes | No | `exams_staff_write` |
| **`exam_marks`** | SELECT | Yes | Yes | Yes | Own Marks (Published) | `exam_marks_read_policy` |
| | INSERT / UPDATE | Yes | Yes | Yes | No | `submit_exam_marks` (Auto-Grading) |
| **`timetables`** | SELECT | Yes | Yes | Yes | Enrolled Batch | `timetables_read_policy` |
| | INSERT / UPDATE | Yes | Yes | No | No | `trg_check_timetable_conflicts` |
| **`homework`** | SELECT | Yes | Yes | Yes | Enrolled Batch | `homework_read_policy` |
| | INSERT / UPDATE | Yes | Yes | Yes | No | `homework_staff_write` |
| **`study_materials`** | SELECT | Yes | Yes | Yes | Enrolled Batch | `study_materials_read` |
| | INSERT / UPDATE | Yes | Yes | Yes | No | `study_materials_staff_write` |
| **`announcements`** | SELECT | Yes | Yes | Target: Teachers/All | Target: Students/All | `announcements_read_targeted` |
| | INSERT / UPDATE | Yes | Yes | No | No | `announcements_staff_write` |
| **`whatsapp_settings`** | ALL | Yes | No | No | No | `whatsapp_settings_owner_only` |
| **`whatsapp_message_queue`** | SELECT / RETRY | Yes | Yes | No | No | `whatsapp_queue_staff_read` |
| **`institute_settings`** | SELECT | Yes | Yes | Yes | Yes | `institute_settings_read` |
| | UPDATE | Yes | No | No | No | `institute_settings_owner_write` |

---

## 3. UI Navigation Routing Matrix

| Route Path | View / Module Name | Owner | Admin | Teacher | Student |
|---|---|:---:|:---:|:---:|:---:|
| `/dashboard` | Executive KPI Overview | Yes | Yes | Yes (Faculty View) | Redirects to `/portal` |
| `/students` | Student Admissions Directory | Yes | Yes | No (403) | No (403) |
| `/teachers` | Faculty Directory & Batches | Yes | Yes | No (403) | No (403) |
| `/batches` | Classroom Sections & Seats | Yes | Yes | Yes | No (403) |
| `/attendance` | Roll Call & Defaulters | Yes | Yes | Yes | No (403) |
| `/fees` | Fee Invoicing & Ledger | Yes | Yes | No (403) | No (403) |
| `/academics` | Exams & Auto-Grading Sheet | Yes | Yes | Yes | No (403) |
| `/timetable` | Weekly Schedule Grid | Yes | Yes | Yes | Yes |
| `/materials` | Study Materials & Homework | Yes | Yes | Yes | Yes |
| `/announcements` | Broadcasts & WhatsApp Queue | Yes | Yes | Yes (Read-Only) | Yes (Read-Only) |
| `/reports` | Comprehensive CSV Exports | Yes | Yes | No (403) | No (403) |
| `/settings` | Institute Profile & WABA Setup | Yes | Yes (Profile Only) | No (403) | No (403) |
| `/portal` | Student Academic Portal | Yes | Yes | No (403) | Yes (Primary Home) |
