export type FeeStatus = 'paid' | 'pending' | 'partial' | 'overdue';
export type PaymentMode = 'cash' | 'upi' | 'cheque' | 'bank_transfer' | 'card';

export interface FeeStructure {
  id: string;
  course_name: string;
  academic_year: string;
  total_fee: number;
  description: string | null;
  institute_id: string;
  created_at: string;
}

export interface FeePayment {
  id: string;
  fee_record_id: string;
  student_id: string;
  amount: number;
  payment_mode: PaymentMode;
  transaction_ref: string | null;
  receipt_no: string;
  notes: string | null;
  collected_by: string | null;
  institute_id: string;
  payment_date: string;
  created_at: string;
  student_name?: string;
  admission_no?: string;
}

export interface FeeRecord {
  id: string;
  student_id: string;
  student_name?: string;
  admission_no?: string;
  batch_name?: string;
  student_phone?: string;
  parent_name?: string;
  parent_phone?: string;
  title: string;
  amount: number;
  paid_amount: number;
  discount_amount: number;
  balance_due: number;
  status: FeeStatus;
  due_date: string;
  paid_date: string | null;
  receipt_no: string | null;
  payment_mode: PaymentMode | null;
  transaction_ref: string | null;
  notes: string | null;
  fee_structure_id: string | null;
  institute_id: string;
  is_historical?: boolean;
  historical_period?: string;
  created_at: string;
  updated_at: string;
}

export interface FeeSummary {
  total_billed: number;
  total_collected: number;
  total_pending: number;
  collection_percentage: number;
  overdue_invoices_count: number;
  pending_students_count: number;
}

export interface CollectFeePayload {
  record_id: string;
  amount: number;
  payment_mode: PaymentMode;
  transaction_ref?: string;
  notes?: string;
}

export interface CreateInvoicePayload {
  student_id: string;
  title: string;
  amount: number;
  due_date: string;
  notes?: string;
  fee_structure_id?: string;
}
