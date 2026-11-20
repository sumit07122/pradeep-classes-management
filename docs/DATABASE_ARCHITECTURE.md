# Pradeep Classes Management: Database & Security Architecture

## 1. Domain Entities & Database Schema (Post-Migration 0003)

The database runs on PostgreSQL 15+ with strict Row Level Security (RLS) enabled across all public schema tables.

```
+--------------------+        +---------------------+        +--------------------+
|   auth.users       |        |   public.batches    |        |  public.teachers   |
+--------------------+        +---------------------+        +--------------------+
| id (uuid, PK)      |<---+   | id (uuid, PK)       |        | id (uuid, PK)      |
| email (text)       |    |   | name (text)         |        | full_name (text)   |
+--------------------+    |   | course_name (text)  |        | subject (text)     |
                          |   | academic_year (text)|        | phone (text)       |
+--------------------+    |   +---------------------+        | profile_id (FK)    |
|  public.profiles   |    |              ^                   +--------------------+
+--------------------+    |              |                              ^
| id (uuid, PK/FK)---+----+              |                              |
| full_name (text)   |                   +--------------+               |
| role (app_role)    |                                  |               |
| phone (text)       |<---+                     +--------------------+  |
+--------------------+    |                     | teacher_batches    |  |
         ^                |                     +--------------------+  |
         |                |                     | teacher_id (FK)----+--+
+--------------------+    |                     | batch_id (FK)------+--+
|  parent_students   |    |                     +--------------------+
+--------------------+    |
| parent_profile_id -+----+                     +--------------------+
| student_id --------+----+                     |  public.students   |
| relationship_type  |    |                     +--------------------+
| is_verified (bool) |    |                     | id (uuid, PK)      |
+--------------------+    +-------------------->| profile_id (FK)    |
                                                | admission_no (text)|
                                                | full_name (text)   |
                                                | class_name (text)  |
                                                | batch_id (FK)      |
                                                +--------------------+
```

---

## 2. Permissive RLS Cleanup & Access Control Model

In PostgreSQL, multiple permissive RLS policies on the same table are combined using logical `OR`. Legacy broad policies (`*_staff_read` and phone-number-based policies) from migrations 0001 and 0002 have been **completely dropped** in migration 0003.

### Table Access Matrix

| Table | Owner / Admin | Teacher | Student | Parent |
| :--- | :---: | :---: | :---: | :---: |
| `profiles` | Full CRUD | Read Directory | Read Self (`id = auth.uid()`) | Read Self (`id = auth.uid()`) |
| `batches` | Full CRUD | Read Assigned Batches | Read Enrolled Batch | Read Child's Enrolled Batch |
| `students` | Full CRUD | Read Assigned Batch Students | Read Self (`profile_id = auth.uid()`) | Read Verified Linked Children (`parent_students`) |
| `teachers` | Full CRUD | Read Faculty Directory | Read Batch Teachers | Read Child's Batch Teachers |
| `teacher_batches` | Full CRUD | Read Own Assignments | No Access | No Access |
| `attendance_sessions`| Full CRUD | Read & Insert Assigned Batches (No Update/Delete) | Read Enrolled Batch Sessions | Read Child's Batch Sessions |
| `attendance_records` | Full CRUD | Read & Insert Assigned Students (No Update/Delete) | Read Self Records | Read Linked Child Records |
| `parent_students` | Full CRUD | No Access | Read Links to Self | Read Verified Self Links (`is_verified = true`) |
| `fee_structures` | Full CRUD | Read Only | Read Only | Read Only |
| `fee_records` | Full CRUD | No Access | Read Self Invoices | Read Verified Child Invoices |
| `audit_logs` | Read Only | No Access | No Access | No Access |

---

## 3. Attendance Integrity & Enforcement Triggers

1. **Trigger `trg_validate_attendance_record`**:
   Before insert or update on `public.attendance_records`, verifies that `student.batch_id == session.batch_id`. Rejects any cross-batch attendance marking with an integrity exception.
2. **Attendance Session Ownership**:
   Teachers may only insert an attendance session where `taken_by = auth.uid()` AND `is_teacher_assigned_to_batch(batch_id)`.
3. **No Direct Teacher Deletions**:
   Attendance updates or corrections must be performed by an Administrator or Owner.

---

## 4. Parent Verification Workflow

Administrators verify parent-student links through the following procedure:
1. The student is registered in `public.students`.
2. The parent registers an account in `auth.users`, receiving a `public.profiles` entry with `role = 'parent'`.
3. An Administrator navigates to **Student Management** -> **Parent Links** and creates a row in `public.parent_students` matching the parent's UUID and the student's ID.
4. The administrator sets `is_verified = true`, which records `verified_by = auth.uid()` and `verified_at = now()`.
5. Once verified, the parent account immediately gains RLS-authorized access to their child's attendance and fee status.

---

## 5. Cumulative RLS Policy Audit (After Migrations 0001, 0002 & 0003)

Every public table has Row Level Security enabled (`ENABLE ROW LEVEL SECURITY`). The table below lists all surviving, active policies across the cumulative migration history and their effective permissions.

| Table | Policy Name | Command | Target / Condition | Effective Scope |
| :--- | :--- | :---: | :--- | :--- |
| `profiles` | `profiles_self_read` | SELECT | `id = auth.uid() OR current_user_role() IN ('owner', 'admin')` | Users view own profile; Admins/Owners view staff directory |
| `profiles` | `profiles_admin_update` | UPDATE | `current_user_role() IN ('owner', 'admin')` | Only Admins/Owners can edit profile records |
| `batches` | `batches_admin_all` | ALL | `current_user_role() IN ('owner', 'admin')` | Full CRUD for Admins and Owners |
| `batches` | `batches_teacher_read` | SELECT | `role = 'teacher' AND is_teacher_assigned_to_batch(id)` | Scoped: Teachers view assigned batches only |
| `batches` | `batches_student_read` | SELECT | `role = 'student' AND student.batch_id = batches.id` | Scoped: Students view enrolled batch |
| `batches` | `batches_parent_read` | SELECT | `role = 'parent' AND parent_students.is_verified` | Scoped: Parents view verified child's batch |
| `students` | `students_admin_all` | ALL | `current_user_role() IN ('owner', 'admin')` | Full CRUD for Admins and Owners |
| `students` | `students_teacher_read` | SELECT | `role = 'teacher' AND is_teacher_assigned_to_batch(batch_id)` | Scoped: Teachers view assigned batch students only |
| `students` | `students_self_read` | SELECT | `role = 'student' AND profile_id = auth.uid()` | Scoped: Students view own student record only |
| `students` | `students_parent_read` | SELECT | `role = 'parent' AND parent_students.is_verified` | Scoped: Parents view verified linked child only |
| `teachers` | `teachers_admin_all` | ALL | `current_user_role() IN ('owner', 'admin')` | Full CRUD for Admins and Owners |
| `teachers` | `teachers_staff_read` | SELECT | `current_user_role() IN ('owner', 'admin', 'teacher')` | Faculty directory readable by staff |
| `teachers` | `teachers_student_parent_read` | SELECT | `is_teacher_assigned_to_batch(...)` | Students/Parents view only assigned faculty |
| `teacher_batches` | `teacher_batches_admin_all` | ALL | `current_user_role() IN ('owner', 'admin')` | Full CRUD for Admins and Owners |
| `teacher_batches` | `teacher_batches_teacher_read` | SELECT | `role = 'teacher' AND teacher.profile_id = auth.uid()` | Scoped: Teachers view own assignments only |
| `attendance_sessions` | `attendance_sessions_admin_all` | ALL | `current_user_role() IN ('owner', 'admin')` | Full CRUD for Admins and Owners |
| `attendance_sessions` | `attendance_sessions_teacher_read` | SELECT | `role = 'teacher' AND is_teacher_assigned_to_batch(batch_id)` | Teachers view assigned batch sessions |
| `attendance_sessions` | `attendance_sessions_teacher_insert` | INSERT | `role = 'teacher' AND taken_by = auth.uid() AND is_assigned` | Teachers create session for assigned batch only |
| `attendance_sessions` | `attendance_sessions_student_read` | SELECT | `role = 'student' AND student.batch_id = batch_id` | Students view sessions for enrolled batch |
| `attendance_sessions` | `attendance_sessions_parent_read` | SELECT | `role = 'parent' AND child.batch_id = batch_id` | Parents view sessions for child's batch |
| `attendance_records` | `attendance_records_admin_all` | ALL | `current_user_role() IN ('owner', 'admin')` | Full CRUD for Admins and Owners |
| `attendance_records` | `attendance_records_teacher_read` | SELECT | `role = 'teacher' AND is_teacher_assigned_to_batch(...)` | Teachers view assigned batch records |
| `attendance_records` | `attendance_records_teacher_insert` | INSERT | `role = 'teacher' AND session.taken_by = auth.uid() AND batch matches` | Teachers mark attendance for assigned students |
| `attendance_records` | `attendance_records_student_read` | SELECT | `role = 'student' AND student.profile_id = auth.uid()` | Students view own attendance records only |
| `attendance_records` | `attendance_records_parent_read` | SELECT | `role = 'parent' AND parent_students.is_verified` | Parents view verified linked child's records |
| `parent_students` | `parent_students_admin_all` | ALL | `current_user_role() IN ('owner', 'admin')` | Full CRUD for Admins and Owners |
| `parent_students` | `parent_students_parent_read` | SELECT | `parent_profile_id = auth.uid() AND is_verified = true` | Parents view own verified relationship links |
| `parent_students` | `parent_students_student_read` | SELECT | `student.profile_id = auth.uid()` | Students view parent links tied to themselves |
| `fee_structures` | `fee_structures_admin_all` | ALL | `current_user_role() IN ('owner', 'admin')` | Full CRUD for Admins and Owners |
| `fee_structures` | `fee_structures_read` | SELECT | `is_staff() OR role IN ('student', 'parent')` | Public institute fee structure schedule |
| `fee_records` | `fee_records_admin_all` | ALL | `current_user_role() IN ('owner', 'admin')` | Full CRUD for Admins and Owners |
| `fee_records` | `fee_records_student_read` | SELECT | `role = 'student' AND student.profile_id = auth.uid()` | Students view own fee records only |
| `fee_records` | `fee_records_parent_read` | SELECT | `role = 'parent' AND parent_students.is_verified` | Parents view verified linked child's fees |
| `audit_logs` | `audit_admin_read` | SELECT | `current_user_role() IN ('owner', 'admin')` | Only Admins and Owners can inspect audit trails |
| `audit_logs` | `audit_staff_insert` | INSERT | `is_staff()` | Staff members can write audit log entries |

**Dropped Residual Policies**:
All legacy broad permissive policies (`batches_staff_read`, `students_staff_read`, `students_self_read` with phone check, `attendance_staff_read`, `attendance_records_staff_read`, `fee_structures_staff_read`, `fee_records_student_self_read`) were explicitly dropped in Migration 0003 Section 1, eliminating any possibility of permissive `OR` policy leaks.
