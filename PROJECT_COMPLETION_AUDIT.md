# Pradeep Classes Management Platform
## Complete Project-Wide System Audit & Remediation Plan

**Document Version:** 1.0.0  
**Audit Date:** November 20, 2026  
**Auditor:** Principal Software Architect & Full-Stack Engineering Team  
**Target Institute:** Pradeep Classes (Single-Institute Deployment Mode)  
**Database:** Supabase PostgreSQL 17 (`gajibrwnccddnrbnhwmh`, Region: `ap-southeast-2`)  
**Repository:** https://github.com/sumit07122/pradeep-classes-management

---

## 1. Executive Summary

This comprehensive audit inspects the entire codebase, database schema, remote migrations (0001 through 0008), role-based access control, security policies, and UI workflows. 

The application has established strong foundational building blocks:
- Clean multi-tenant database isolation safeguards (`institutes`, `current_user_institute_id()`, `current_user_role()`).
- High-integrity student admission numbering (`PC-YYYY-XXXX`) and batch capacity enforcement with row locks.
- Live attendance roll-call interface and batch submission RPC with idempotency.
- Fee invoicing and installment collection with row-level locking (`SELECT FOR UPDATE`).

However, several critical modules remain incomplete, contain mock data, or lack necessary database tables and security triggers:
1. **Academics (`Academics.tsx`)**: Completely static mockup; no database tables for exams, tests, marks entry, or report cards.
2. **Parent Portal Removal**: Traces of parent portal roles, routes, and components remain in `AppRoutes`, `Portal.tsx`, `useAuth`, and `RoleSwitcherDev`.
3. **WhatsApp Automation**: Missing automated queue triggers after attendance submission, provider configuration settings, queue tables, and retry logic.
4. **Financial Ledger Immutability**: Admins currently have direct `UPDATE`/`DELETE` permissions on `fee_payments`, and installment receipts share a single receipt number with invoices.
5. **Homework, Materials & Timetable**: Completely unbuilt; no storage bucket policies or schedule conflict detection.
6. **Dashboards**: Hardcoded mock numbers for attendance and fee collection on the overview dashboard.
7. **Institute Settings & Announcements**: No dedicated management interface for institute profile, grading scales, or batch notices.

---

## 2. Technology Stack & Current Repository Inventory

| Layer | Component | Status | Finding |
| :--- | :--- | :---: | :--- |
| **Frontend** | React 18, Vite 6, TypeScript | ✅ Healthy | Compiles clean (`tsc -b && vite build` in ~13s) |
| **Styling** | Tailwind CSS + Custom Design System | ✅ Healthy | Consistent palette (`#16466f`, `#0e3150`, `#f8fafc`) |
| **Auth** | Supabase Auth + JWT Context | ✅ Healthy | Secure login, session persistence, role hydration |
| **Database** | PostgreSQL 17 on Supabase | ✅ Applied 0001-0008 | Rock-solid RLS on core tables, but missing academic & communication tables |
| **Storage** | Supabase Storage | ⚠️ Missing Buckets | Need secure buckets for `materials` and `homework` |
| **Edge Functions**| Supabase Edge Functions | ⚠️ Incomplete | Need WhatsApp Cloud API notification dispatcher function |
| **Deployment** | Vercel (Production) | 🔄 Ready | Target domain `app.pradeepclasses.in` |

---

## 3. Detailed Component & Route Audit

### 3.1 Frontend Routes (`src/routes/AppRoutes.tsx`)
- **Current Routes**: `/login`, `/dashboard`, `/students`, `/teachers`, `/batches`, `/attendance`, `/fees`, `/academics`, `/portal`, `/unauthorized`, `/config-error`.
- **Issues Identified**:
  - `/portal` allows `"parent"`. The Parent Portal must be completely decommissioned.
  - Missing dedicated routes for `/exams`, `/homework`, `/materials`, `/timetable`, `/announcements`, `/settings`, and `/reports`.
  - `/academics` is an unlinked placeholder page.
- **Action**: Add dedicated routes for all operational modules, wrap with role-based route guards, and restrict `/portal` strictly to `student` (with `owner`/`admin` preview).

### 3.2 Pages & UI Components
1. **`Dashboard.tsx`**:
   - *Defect*: Hardcodes `"92%"` for attendance and `"₹48,500"` for fee collection.
   - *Fix*: Connect to live RPC `get_institute_fee_summary()` and attendance daily stats. Create 4 distinct views:
     - **Owner Dashboard**: Complete institute revenue, collection trends, attendance defaulters, faculty status.
     - **Admin Dashboard**: Operational student counts, today's roll calls, overdue invoices, upcoming exams.
     - **Teacher Dashboard**: Assigned batches, today's classes/timetable, pending attendance submissions, assigned exams.
     - **Student Dashboard**: Personal attendance percentage, exam schedule, latest marks, fee dues, homework deadlines.
2. **`Academics.tsx`**:
   - *Defect*: Static HTML cards with hardcoded text ("JEE Mock #4", "Physics Thermodynamics Test").
   - *Fix*: Implement full Exam Management: create exam, enter marks table with absent/present flags, calculate percentages and grades, rank students, and export report cards.
3. **`Teachers.tsx` & `teachersService.ts`**:
   - *Defect*: Only has basic "Add Teacher" modal; lacks Edit Teacher, Deactivate/Reactivate Teacher, and Batch Assignment drawer.
   - *Fix*: Implement complete Teacher CRUD with active status toggle, subject specialization, and batch allocation.
4. **`Portal.tsx`**:
   - *Defect*: Displays "GUARDIAN & PARENT PORTAL" when role is parent.
   - *Fix*: Remove all parent portal branches. Rebrand as the pure **Student Academic Portal** with live tabs for Attendance Calendar, Fee Invoices & Receipts, Examination Marks, Homework, and Timetable.
5. **`Batches.tsx` & `Students.tsx`**:
   - *Status*: Excellent condition from Milestone 2 with admission number formatting, capacity enforcement, batch transfer modals, and CSV export.
   - *Enhancement*: Add quick links to batch attendance, batch exams, and batch fee summaries.

---

## 4. Database Schema & RLS Audit (Migrations 0001–0008)

### 4.1 Identified Gaps in Migrations 0001–0008
1. **`fee_payments` Immutability & Reversals**:
   - Policy `fee_payments_admin_all` allows raw `DELETE` and `UPDATE`.
   - No table-level trigger blocks destructive ledger alterations.
   - *Fix*: Implement `fn_prevent_payment_ledger_tampering()` trigger. Add support for financial adjustments via reversal records (`is_reversal`, `reversal_ref_id`, `reversal_reason`).
2. **Installment Receipt Numbers vs Invoice Numbers**:
   - In `collect_fee_payment()`, the receipt number was shared across installments.
   - *Fix*: Add `invoice_no` (`INV-YYYY-XXXX`) on `fee_records` and ensure every row in `fee_payments` receives its own unique transaction receipt number (`REC-YYYY-XXXX`).
3. **Historical Attendance Window**:
   - Teachers could edit sessions from previous terms indefinitely.
   - *Fix*: Restrict `attendance_records_teacher_update` to sessions created within the last 48 hours unless caller is Admin or Owner.
4. **Parent Table Removal**:
   - `parent_students` table is obsolete since the Parent Portal is eliminated. We retain guardian information directly on `students` (`parent_name`, `parent_phone`, `parent_relation`, `parent_email`) for emergency contact records.

### 4.2 Missing Schema Required for Complete System
A new migration (`0009_complete_institute_management.sql`) is required to introduce:
- `whatsapp_settings` & `whatsapp_message_queue`
- `exams` & `exam_marks`
- `homework` & `homework_submissions`
- `study_materials`
- `timetables`
- `announcements`
- `institute_settings`

---

## 5. WhatsApp Automation System Design

### 5.1 Trigger Mechanism
Upon successful execution of `submit_batch_attendance()`:
- Inside the atomic transaction (or via `AFTER INSERT OR UPDATE` trigger on `attendance_records`), an entry is inserted into `public.whatsapp_message_queue`.
- **Deduplication**: If attendance was already marked with the same status on that date, no duplicate message is queued. If status changed (e.g. absent -> present), an update notification is queued.
- **Payload**:
  - `recipient_phone`: Student's phone (`students.phone`).
  - `template_name`: `attendance_present`, `attendance_absent`, `attendance_late`, `attendance_leave`.
  - `parameters`: `{"student_name": s.full_name, "date": session_date, "batch_name": b.name}`.
  - `status`: `'pending'`.

### 5.2 Provider Integration & Dispatcher
- **Official Cloud API**: Uses WhatsApp Business Cloud API (`https://graph.facebook.com/v20.0/{phone_number_id}/messages`).
- **Edge Function / Background Dispatcher**: `send-whatsapp-notifications` processes pending queue entries with exponential backoff and rate limiting.
- **Provider Settings UI**: In Institute Settings, Owner configures `phone_number_id`, `business_account_id`, `access_token`, and enables/disables live dispatch.
- **Test Mode**: If credentials are not yet entered, the UI displays messages as *"Queued (Test Mode - Awaiting WhatsApp Cloud API Credentials)"* with full preview of payload and manual retry.

---

## 6. Implementation Roadmap

- [x] **Stage 1**: Full project audit and `PROJECT_COMPLETION_AUDIT.md`.
- [ ] **Stage 2**: Migration `0009_complete_institute_management.sql`:
  - Payment ledger immutability trigger & reversal support.
  - Attendance 48h teacher edit window.
  - WhatsApp queue & settings schema + automatic attendance trigger.
  - Exams & marks schema + ranking RPC.
  - Homework, study materials & timetable schema.
  - Announcements & institute settings schema.
- [ ] **Stage 3**: Complete Teacher & Student CRUD:
  - Teacher edit, deactivate/reactivate, and assignment drawer.
  - Student guardian record maintenance.
- [ ] **Stage 4**: Complete Attendance & WhatsApp UI:
  - WhatsApp notification logs & queue manager drawer.
  - Attendance calendar & monthly reports.
- [ ] **Stage 5**: Complete Fee & Financial Management:
  - Unique invoice numbers vs installment receipt numbers.
  - Payment reversal / refund workflow.
  - Financial reports & CSV export.
- [ ] **Stage 6**: Complete Examination & Academic Management:
  - Exam scheduler, marks entry sheet, grade calculator, report card generator.
- [ ] **Stage 7**: Complete Homework, Study Materials & Timetable:
  - Homework assignment & submission tracker.
  - Study material upload/download center.
  - Timetable grid with schedule conflict detection.
- [ ] **Stage 8**: Complete Announcements & In-App Alerts:
  - Targeted announcement broadcast (all students vs specific batch).
- [ ] **Stage 9**: Complete Role-Specific Dashboards & Settings:
  - Owner, Admin, Teacher, and Student dashboard views powered by live queries.
  - Institute profile, WhatsApp credentials, grading system settings.
- [ ] **Stage 10**: Complete Parent Portal Removal:
  - Purge parent role references from routes, contexts, and navigation.
- [ ] **Stage 11**: End-to-End Automated Testing:
  - Multi-role security test suite across Owner, Admin, Teacher, and Student.
- [ ] **Stage 12**: Production Build & Final Acceptance Deliverables.
