# Pradeep Classes Management: Database & Security Architecture

## 1. Domain Entities & Database Schema

The database is built on PostgreSQL with Row Level Security (RLS) enabled on all public schema tables.

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
| id (uuid, PK/FK)---+----+              +--------------+               |
| full_name (text)   |                                  |               |
| role (app_role)    |                          +--------------------+  |
| phone (text)       |                          | teacher_batches    |  |
+--------------------+                          +--------------------+  |
                                                | teacher_id (FK)----+--+
+--------------------+                          | batch_id (FK)------+--+
|  public.students   |                          +--------------------+
+--------------------+
| id (uuid, PK)      |
| admission_no (text)|
| full_name (text)   |
| class_name (text)  |
| batch_name (text)  |
| batch_id (FK)      |
| phone (text)       |
| parent_name (text) |
| parent_phone (text)|
| status (status)    |
+--------------------+
```

---

## 2. Role-Based Permissions & RLS Matrix

The system enforces 5 distinct roles defined in PostgreSQL enum `public.app_role`:
- `owner`: Institute proprietor with unlimited administrative, financial, and configuration authority.
- `admin`: Administrative staff with student admission, teacher management, batch scheduling, and fee recording capabilities.
- `teacher`: Academic faculty restricted to viewing assigned batches, managing study material, and taking attendance for assigned classes.
- `student`: Enrolled candidate restricted to self-profile, own attendance, test marks, and fee payment receipts.
- `parent`: Guardian authorized to inspect attendance, evaluation reports, and fee dues for their registered ward.

| Resource / Table | Owner | Admin | Teacher | Student / Parent |
| :--- | :---: | :---: | :---: | :---: |
| `profiles` | Full CRUD | Read Staff | Read Self | Read Self |
| `students` | Full CRUD | Full CRUD | Read Assigned Batches | Read Self (matching phone) |
| `teachers` | Full CRUD | Full CRUD | Read Faculty Directory | Read Assigned Faculty |
| `batches` | Full CRUD | Full CRUD | Read Assigned Batches | Read Enrolled Batch |
| `attendance_sessions` | Full CRUD | Full CRUD | Insert/Read Assigned Batches | Read Self Sessions |
| `attendance_records` | Full CRUD | Full CRUD | Insert Assigned Batches | Read Self Records |
| `fee_records` | Full CRUD | Full CRUD | No Access | Read Self Invoices |
| `audit_logs` | Read Only | Read Only | No Access | No Access |

---

## 3. Server-Side Security Enforcement

1. **Function `current_user_role()`**:
   Defined as `SECURITY DEFINER` with fixed `search_path = public`, extracting the calling user's role from `public.profiles` based on `auth.uid()`.
2. **Batch-Scoped Attendance Validation**:
   `is_teacher_assigned_to_batch(batch_id)` verifies that `teacher_batches` maps the teacher's `profile_id` to the session's `batch_id` before allowing attendance writes.
3. **Role Escalation Trigger**:
   `trg_prevent_role_escalation` intercepts any row update to `profiles` and rejects attempts to modify the `role` column unless executed by an existing `owner`.

---

## 4. Multi-Tenant SaaS Preparation

The data access layer and schema definitions are prepared for multi-tenant extensions:
- All queries route through central services (`studentsService`, `batchesService`, etc.).
- The schema is ready for an `institute_id uuid references public.institutes(id)` column across all tables, allowing tenant partitioning in future releases.
