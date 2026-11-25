// src/services/financeService.ts
// Financial ledger, expense tracking, and teacher payroll service
import { getSupabase } from "../lib/supabase";
import type {
  FinancialDashboardSummary,
  InstituteIncome,
  InstituteExpense,
  TeacherSalaryConfig,
  TeacherPayroll,
  CreateExpensePayload,
  CreateIncomePayload,
  DisbursePayrollPayload,
} from "../types/finance";

let mockClient: any = null;

export function setSupabaseClient(client: any) {
  mockClient = client;
}

function getClient(): any {
  return mockClient || getSupabase();
}

const INSTITUTE_ID = "11111111-2222-3333-4444-555555555555";

/**
 * Fetch high-level aggregated financial dashboard summary
 */
export async function getFinancialDashboard(
  startDate?: string,
  endDate?: string
): Promise<FinancialDashboardSummary> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc(
    "get_institute_financial_dashboard",
    {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    }
  );

  if (error) {
    console.error("Error fetching financial dashboard RPC:", error);
    throw new Error(error.message || "Failed to load financial dashboard");
  }

  return (
    data || {
      total_fees_billed: 0,
      total_fees_collected: 0,
      outstanding_dues: 0,
      total_other_income: 0,
      total_expenses: 0,
      total_teacher_salaries_paid: 0,
      net_operating_surplus: 0,
      expenses_by_category: [],
      incomes_by_method: [],
      monthly_trends: [],
    }
  );
}

/**
 * Fetch direct institute incomes (books, registration fees, other income)
 */
export async function getIncomes(): Promise<InstituteIncome[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("institute_incomes")
    .select("*")
    .eq("institute_id", INSTITUTE_ID)
    .order("income_date", { ascending: false });

  if (error) {
    console.error("Error fetching institute incomes:", error);
    throw error;
  }
  return (data as InstituteIncome[]) || [];
}

/**
 * Create a new direct institute income record
 */
export async function createIncome(
  payload: CreateIncomePayload
): Promise<InstituteIncome> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("institute_incomes")
    .insert([
      {
        ...payload,
        institute_id: INSTITUTE_ID,
        recorded_by: user?.id || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error creating institute income:", error);
    throw error;
  }
  return data as InstituteIncome;
}

/**
 * Reverse an income transaction with audit reason
 */
export async function reverseIncome(id: string, reason: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("institute_incomes")
    .update({
      status: "reversed",
      reversal_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error reversing income:", error);
    throw error;
  }
}

/**
 * Update an existing direct institute income record
 */
export async function updateIncome(
  id: string,
  payload: Partial<CreateIncomePayload>
): Promise<InstituteIncome> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("institute_incomes")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating institute income:", error);
    throw error;
  }
  return data as InstituteIncome;
}

/**
 * Delete a direct institute income record
 */
export async function deleteIncome(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("institute_incomes")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting institute income:", error);
    throw error;
  }
}

/**
 * Fetch institute operational expenses
 */
export async function getExpenses(): Promise<InstituteExpense[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("institute_expenses")
    .select("*")
    .eq("institute_id", INSTITUTE_ID)
    .order("expense_date", { ascending: false });

  if (error) {
    console.error("Error fetching institute expenses:", error);
    throw error;
  }
  return (data as InstituteExpense[]) || [];
}

/**
 * Upload an expense supporting receipt to Supabase Storage
 */
export async function uploadExpenseReceipt(file: File): Promise<string> {
  const supabase = getSupabase();
  const fileExt = file.name.split(".").pop();
  const fileName = `receipt_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `receipts/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("expense-receipts")
    .upload(filePath, file);

  if (uploadError) {
    console.error("Error uploading expense receipt:", uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage
    .from("expense-receipts")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Generate a secure time-limited signed URL for viewing an expense receipt
 */
export async function getExpenseReceiptSignedUrl(receiptUrl: string): Promise<string> {
  if (!receiptUrl) return "";
  if (receiptUrl.startsWith("blob:") || receiptUrl.startsWith("data:")) return receiptUrl;

  try {
    const supabase = getSupabase();
    let path = receiptUrl;
    if (path.includes("expense-receipts/")) {
      path = path.split("expense-receipts/")[1];
    }
    const { data, error } = await supabase.storage
      .from("expense-receipts")
      .createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) {
      return receiptUrl;
    }
    return data.signedUrl;
  } catch (err) {
    console.error("Failed to generate signed receipt URL:", err);
    return receiptUrl;
  }
}

/**
 * Record a new institute expense
 */
export async function createExpense(
  payload: CreateExpensePayload,
  receiptFile?: File
): Promise<InstituteExpense> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let receiptUrl = payload.receipt_url || null;
  if (receiptFile) {
    receiptUrl = await uploadExpenseReceipt(receiptFile);
  }

  const { data, error } = await supabase
    .from("institute_expenses")
    .insert([
      {
        ...payload,
        receipt_url: receiptUrl,
        institute_id: INSTITUTE_ID,
        recorded_by: user?.id || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error recording institute expense:", error);
    throw error;
  }
  return data as InstituteExpense;
}

/**
 * Reverse an approved expense with audit reason
 */
export async function reverseExpense(id: string, reason: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("institute_expenses")
    .update({
      status: "reversed",
      reversal_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error reversing expense:", error);
    throw error;
  }
}

/**
 * Update an existing institute expense record
 */
export async function updateExpense(
  id: string,
  payload: Partial<CreateExpensePayload>,
  receiptFile?: File
): Promise<InstituteExpense> {
  const supabase = getSupabase();
  let receiptUrl = payload.receipt_url;
  if (receiptFile) {
    receiptUrl = await uploadExpenseReceipt(receiptFile);
  }

  const updateData: any = {
    ...payload,
    ...(receiptUrl !== undefined && { receipt_url: receiptUrl }),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("institute_expenses")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating institute expense:", error);
    throw error;
  }
  return data as InstituteExpense;
}

/**
 * Delete an institute expense record
 */
export async function deleteExpense(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("institute_expenses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting institute expense:", error);
    throw error;
  }
}

/**
 * Fetch all teacher salary configurations
 */
export async function getTeacherSalaryConfigs(): Promise<TeacherSalaryConfig[]> {
  const supabase = getSupabase();
  const { data: configs, error: cfgError } = await supabase
    .from("teacher_salary_configs")
    .select(`
      *,
      teachers (
        id,
        full_name,
        subject
      )
    `)
    .eq("institute_id", INSTITUTE_ID);

  if (cfgError) {
    console.error("Error fetching teacher salary configs:", cfgError);
    throw cfgError;
  }

  // Also query active faculty to surface unconfigured teachers
  const { data: teachers, error: tError } = await supabase
    .from("teachers")
    .select("id, full_name, subject, is_active")
    .order("full_name");

  if (tError || !teachers || teachers.length === 0) {
    return (configs || []).map((row: any) => ({
      ...row,
      teacher_name: row.teachers?.full_name || "Faculty Member",
    }));
  }

  const existingMap = new Map<string, any>();
  (configs || []).forEach((c: any) => {
    existingMap.set(c.teacher_id, c);
  });

  const merged: TeacherSalaryConfig[] = [];
  teachers.forEach((t: any) => {
    const existing = existingMap.get(t.id);
    if (existing) {
      merged.push({
        ...existing,
        teacher_name: t.full_name || existing.teachers?.full_name || "Faculty Member",
      });
      existingMap.delete(t.id);
    } else {
      merged.push({
        id: `unconfigured-${t.id}`,
        institute_id: INSTITUTE_ID,
        teacher_id: t.id,
        calculation_type: "monthly_fixed",
        base_amount: 0,
        per_lecture_rate: 0,
        teacher_name: t.full_name || "Faculty Member",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  });

  // Append any existing configs not matched
  existingMap.forEach((c: any) => {
    merged.push({
      ...c,
      teacher_name: c.teachers?.full_name || "Faculty Member",
    });
  });

  return merged;
}

/**
 * Update or insert a teacher salary configuration
 */
export async function updateTeacherSalaryConfig(
  teacherId: string,
  calculationType: "monthly_fixed" | "per_lecture" | "hourly",
  baseAmount: number,
  perLectureRate: number
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("teacher_salary_configs")
    .upsert(
      {
        institute_id: INSTITUTE_ID,
        teacher_id: teacherId,
        calculation_type: calculationType,
        base_amount: baseAmount,
        per_lecture_rate: perLectureRate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "teacher_id" }
    );

  if (error) {
    console.error("Error updating teacher salary config:", error);
    throw error;
  }
}

/**
 * Fetch teacher payroll sheets for a specific month
 */
export async function getTeacherPayrolls(
  month?: string
): Promise<TeacherPayroll[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("teacher_payrolls")
    .select(`
      *,
      teachers (
        full_name,
        subject
      )
    `)
    .eq("institute_id", INSTITUTE_ID)
    .order("created_at", { ascending: false });

  if (month) {
    query = query.eq("payroll_month", month);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching teacher payrolls:", error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    ...row,
    teacher_name: row.teachers?.full_name || "Faculty Member",
    teacher_subject: row.teachers?.subject || "Academics",
  }));
}

/**
 * Automatically generate pending monthly payroll sheets for active faculty
 */
export async function generateMonthlyPayroll(
  month: string
): Promise<{ success: boolean; generated_count: number }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc(
    "generate_monthly_teacher_payrolls",
    { p_month: month }
  );

  if (error) {
    console.error("Error generating monthly payroll:", error);
    throw new Error(error.message || "Failed to generate monthly payroll sheets");
  }

  return {
    success: data?.success || false,
    generated_count: data?.generated_count || 0,
  };
}

/**
 * Disburse a teacher payroll sheet atomically
 */
export async function disbursePayroll(
  payrollId: string,
  payload: DisbursePayrollPayload
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("record_teacher_payroll_payment", {
    p_payroll_id: payrollId,
    p_payment_method: payload.payment_method,
    p_transaction_reference: payload.transaction_reference || null,
    p_notes: payload.notes || null,
  });

  if (error) {
    console.error("Error disbursing teacher payroll:", error);
    throw new Error(error.message || "Failed to process payroll disbursement");
  }
}

/**
 * Permanently delete an erroneous or duplicate teacher payroll record atomically.
 * Automatically cleans up any associated institute expense row.
 */
export async function deleteTeacherPayroll(
  payrollId: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    if (!payrollId || typeof payrollId !== "string" || payrollId.trim() === "") {
      return { success: false, error: "Payroll ID is required." };
    }

    const client = getClient();
    if (!client) {
      return { success: false, error: "Database service is not configured." };
    }

    const { data, error } = await client.rpc("admin_delete_payroll_record", {
      p_payroll_id: payrollId.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && typeof data === "object" && data.success === false) {
      return {
        success: false,
        error: data.error || data.message || "Failed to delete payroll record",
      };
    }

    return {
      success: true,
      message: data?.message || "Payroll record deleted successfully",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to delete payroll record",
    };
  }
}

export const financeService = {
  getFinancialDashboard,
  getIncomes,
  createIncome,
  updateIncome,
  deleteIncome,
  reverseIncome,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  reverseExpense,
  getTeacherPayrolls,
  getTeacherSalaryConfigs,
  updateTeacherSalaryConfig,
  generateMonthlyPayroll,
  disbursePayroll,
  deleteTeacherPayroll,
  setSupabaseClient,
};
