# Milestone 4 Implementation Plan: Fee Management & Financial Operations

## Overview
Milestone 4 delivers the complete, production-grade financial management system for Pradeep Classes (and future multi-tenant institutes). It transitions the fee workflow from static demo placeholders to live Supabase ledger operations with atomic receipt generation, partial payment tracking, audit logging, and parent/student portal integration.

---

## 1. Database Layer: Migration `0008_fee_management.sql`

### 1.1 Enhancements to `fee_records`
- Add `title text DEFAULT 'Tuition Fee' NOT NULL`
- Add `fee_structure_id uuid REFERENCES public.fee_structures(id) ON DELETE SET NULL`
- Add `paid_amount numeric DEFAULT 0 NOT NULL CHECK (paid_amount >= 0)`
- Add `discount_amount numeric DEFAULT 0 NOT NULL CHECK (discount_amount >= 0)`
- Add `payment_mode text CHECK (payment_mode IS NULL OR payment_mode IN ('cash', 'upi', 'cheque', 'bank_transfer', 'card'))`
- Add `transaction_ref text`
- Add `collected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL`
- Add constraint `CHECK (amount >= 0)`

### 1.2 Dedicated Payment History Table: `fee_payments`
Tracks individual partial payment installments with immutable audit trail:
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `fee_record_id uuid NOT NULL REFERENCES public.fee_records(id) ON DELETE CASCADE`
- `student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE`
- `amount numeric NOT NULL CHECK (amount > 0)`
- `payment_mode text NOT NULL CHECK (payment_mode IN ('cash', 'upi', 'cheque', 'bank_transfer', 'card'))`
- `transaction_ref text`
- `receipt_no text NOT NULL`
- `notes text`
- `collected_by uuid REFERENCES public.profiles(id)`
- `institute_id uuid NOT NULL REFERENCES public.institutes(id)`
- `payment_date date NOT NULL DEFAULT current_date`
- `created_at timestamptz NOT NULL DEFAULT now()`

### 1.3 Receipt Number Sequence & Atomic Generator
- Sequence: `fee_receipt_seq`
- Generator: `generate_fee_receipt_no()` producing format `REC-YYYY-XXXX` (e.g. `REC-2026-0001`).

### 1.4 Atomic Transactional RPCs
1. `collect_fee_payment(p_record_id, p_amount, p_payment_mode, p_transaction_ref, p_notes)`
   - Verifies caller role (`owner`, `admin`) and institute isolation.
   - Prevents overpayment (`paid_amount + p_amount <= amount`).
   - Updates `fee_records` status ('paid' or 'partial') and `paid_date`.
   - Generates unique receipt number if none exists.
   - Inserts row into `fee_payments`.
   - Returns full transaction payload.
2. `create_student_fee_invoice(p_student_id, p_title, p_amount, p_due_date, p_notes, p_fee_structure_id)`
   - Creates a pending invoice for a student with institute verification.
3. `get_institute_fee_summary()`
   - Returns aggregated financial KPIs: `total_billed`, `total_collected`, `total_pending`, `pending_students_count`, `collection_rate`.

### 1.5 Multi-Tenant RLS Policies
- `fee_records`:
  - Owner & Admin: full ALL scoped to `institute_id = current_user_institute_id()`.
  - Student: SELECT where `student_id` belongs to caller's linked student profile and institute.
  - Parent: SELECT where `student_id` is linked to caller's parent profile and institute.
- `fee_payments`:
  - Owner & Admin: full ALL scoped to `institute_id = current_user_institute_id()`.
  - Student: SELECT where `student_id` belongs to caller.
  - Parent: SELECT where `student_id` is linked to parent.
- `fee_structures`:
  - Owner & Admin: ALL scoped to institute.
  - Authenticated: SELECT scoped to caller's institute.

---

## 2. Frontend Layer

### 2.1 Type Definitions (`src/types/fees.ts`)
- `FeeRecord`, `FeePayment`, `FeeStructure`, `FeeSummary`, `FeeStatus`, `PaymentMode`.
- Payload interfaces for invoice generation and payment collection.

### 2.2 Service Implementation (`src/services/feesService.ts`)
- `getFeeRecords(filters)`
- `getFeeSummary()`
- `getFeeStructures()`
- `createFeeStructure(payload)`
- `createInvoice(payload)`
- `collectPayment(payload)`
- `getPaymentReceipt(receiptNo)`
- `getStudentFeeHistory(studentId)`
- `exportFeeLedgerCsv(records)`

### 2.3 UI Components (`src/components/fees/`)
- `FeeStatsSummary.tsx`: Real-time KPI cards (Total Target, Collected, Pending Dues, Collection Rate).
- `FeeRecordTable.tsx`: Searchable, filterable list of student fee records with status badges and action buttons.
- `CollectFeeModal.tsx`: Form for collecting payments with mode selector, reference number, partial/full payment calculation.
- `CreateInvoiceModal.tsx`: Form for generating new fee invoices / dues for students or batches.
- `PrintableReceiptModal.tsx`: Professional Pradeep Classes fee receipt modal with clean print layout (`window.print()`).

### 2.4 Pages Integration
- `src/pages/Fees.tsx`: Complete overhaul connecting to live Supabase ledger, real-time stats, filter by status, search, invoice creation, and payment collection.
- `src/pages/Portal.tsx`: Connect student/parent view to live fee records, balance breakdown, and receipt download.

---

## 3. Verification & Acceptance Testing
- Automated SQL test `tests/database/verify_milestone4_fees.sql`:
  - Test invoice creation.
  - Test full payment collection with receipt generation.
  - Test partial payment collection followed by completion.
  - Test rejection of overpayment.
  - Test cross-institute and unauthenticated isolation.
- TypeScript build check (`tsc -b && vite build` must pass with 0 errors).
- Clean Git commit and push to `origin/main`.
