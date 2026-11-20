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
