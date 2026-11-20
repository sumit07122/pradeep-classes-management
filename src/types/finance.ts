// src/types/finance.ts
// Financial domain types for Pradeep Classes Management Platform

export type IncomeSourceType = 'student_fee' | 'admission_fee' | 'study_material' | 'other';
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
export type TransactionStatus = 'completed' | 'reversed' | 'approved' | 'pending' | 'cancelled';

export type ExpenseCategory = 
  | 'rent'
  | 'electricity_utilities'
  | 'internet_software'
  | 'stationery_supplies'
  | 'marketing_advertising'
  | 'maintenance'
  | 'teacher_payroll'
  | 'other';

export interface InstituteIncome {
  id: string;
  institute_id: string;
  source_type: IncomeSourceType;
  amount: number;
  payment_method: PaymentMethod;
  transaction_reference?: string | null;
  income_date: string;
  description?: string | null;
  fee_payment_id?: string | null;
  status: 'completed' | 'reversed';
  reversal_reason?: string | null;
  recorded_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstituteExpense {
  id: string;
  institute_id: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  payment_method: PaymentMethod;
  description?: string | null;
  receipt_url?: string | null;
  vendor_name?: string | null;
  status: 'approved' | 'reversed';
  reversal_reason?: string | null;
  recorded_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeacherSalaryConfig {
  id: string;
  institute_id: string;
  teacher_id: string;
  calculation_type: 'monthly_fixed' | 'per_lecture' | 'hourly';
  base_amount: number;
  per_lecture_rate: number;
  teacher_name?: string;
  created_at: string;
  updated_at: string;
}

export interface TeacherPayroll {
  id: string;
  institute_id: string;
  teacher_id: string;
  teacher_name?: string;
  teacher_subject?: string;
  payroll_month: string; // 'YYYY-MM'
  base_salary: number;
  lecture_count: number;
  lecture_amount: number;
  allowances: number;
  deductions: number;
  bonus: number;
  net_amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  payment_date?: string | null;
  payment_method?: PaymentMethod | null;
  transaction_reference?: string | null;
  notes?: string | null;
  processed_by?: string | null;
  expense_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryBreakdown {
  category: ExpenseCategory;
  amount: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  amount: number;
}

export interface MonthlyTrendPoint {
  month: string;
  income: number;
  expense: number;
}

export interface FinancialDashboardSummary {
  total_fees_billed: number;
  total_fees_collected: number;
  outstanding_dues: number;
  total_other_income: number;
  total_expenses: number;
  total_teacher_salaries_paid: number;
  net_operating_surplus: number;
  expenses_by_category: CategoryBreakdown[];
  incomes_by_method: PaymentMethodBreakdown[];
  monthly_trends: MonthlyTrendPoint[];
}

export interface CreateExpensePayload {
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  payment_method: PaymentMethod;
  description: string;
  vendor_name?: string;
  receipt_url?: string;
}

export interface CreateIncomePayload {
  source_type: IncomeSourceType;
  amount: number;
  income_date: string;
  payment_method: PaymentMethod;
  description?: string;
  transaction_reference?: string;
}

export interface DisbursePayrollPayload {
  payment_method: PaymentMethod;
  transaction_reference?: string;
  notes?: string;
}
