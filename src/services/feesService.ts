import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type {
  FeeRecord,
  FeeSummary,
  FeeStructure,
  CollectFeePayload,
  CreateInvoicePayload,
  FeePayment,
  FeeStatus,
} from "../types/fees";

export const feesService = {
  /**
   * Fetch all fee records for the caller's institute with student & batch relations
   */
  async getFeeRecords(filters?: {
    status?: FeeStatus | "all";
    query?: string;
  }): Promise<{ data: FeeRecord[]; error?: string; isDemo: boolean }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: [], error: "Database service is not configured.", isDemo: false };
    }

    try {
      let queryBuilder = supabase
        .from("fee_records")
        .select(`
          id,
          student_id,
          title,
          amount,
          paid_amount,
          discount_amount,
          status,
          due_date,
          paid_date,
          receipt_no,
          payment_mode,
          transaction_ref,
          notes,
          fee_structure_id,
          institute_id,
          created_at,
          updated_at,
          students (
            id,
            full_name,
            admission_no,
            phone,
            parent_name,
            parent_phone,
            batches (
              id,
              name
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        queryBuilder = queryBuilder.eq("status", filters.status);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        return { data: [], error: error.message, isDemo: false };
      }

      let mapped: FeeRecord[] = (data || []).map((row: any) => {
        const student = row.students;
        const total = Number(row.amount) || 0;
        const paid = Number(row.paid_amount) || 0;
        const balance = Math.max(0, total - paid);

        return {
          id: row.id,
          student_id: row.student_id,
          student_name: student?.full_name || "Unknown Student",
          admission_no: student?.admission_no || "PC-2026-XXXX",
          batch_name: student?.batches?.name || "Unassigned Batch",
          title: row.title || "Tuition Fee",
          amount: total,
          paid_amount: paid,
          discount_amount: Number(row.discount_amount) || 0,
          balance_due: balance,
          status: row.status as FeeStatus,
          due_date: row.due_date,
          paid_date: row.paid_date,
          receipt_no: row.receipt_no,
          payment_mode: row.payment_mode,
          transaction_ref: row.transaction_ref,
          notes: row.notes,
          fee_structure_id: row.fee_structure_id,
          institute_id: row.institute_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });

      if (filters?.query) {
        const q = filters.query.toLowerCase().trim();
        mapped = mapped.filter(
          (r) =>
            r.student_name?.toLowerCase().includes(q) ||
            r.admission_no?.toLowerCase().includes(q) ||
            r.receipt_no?.toLowerCase().includes(q) ||
            r.title.toLowerCase().includes(q) ||
            r.batch_name?.toLowerCase().includes(q)
        );
      }

      return { data: mapped, isDemo: false };
    } catch (err: any) {
      return { data: [], error: err?.message || "Failed to fetch fee records", isDemo: false };
    }
  },

  /**
   * Aggregate financial summary (billed, collected, pending, overdue count)
   */
  async getFeeSummary(): Promise<FeeSummary> {
    const zeroSummary: FeeSummary = {
      total_billed: 0,
      total_collected: 0,
      total_pending: 0,
      collection_percentage: 0,
      overdue_invoices_count: 0,
      pending_students_count: 0,
    };

    if (!isSupabaseConfigured || !supabase) {
      return zeroSummary;
    }

    try {
      const { data, error } = await supabase
        .from("fee_records")
        .select("amount, paid_amount, discount_amount, status, due_date, student_id");

      if (error || !data) return zeroSummary;

      let totalBilled = 0;
      let totalCollected = 0;
      let overdueCount = 0;
      const pendingStudentIds = new Set<string>();
      const today = new Date().toISOString().split("T")[0];

      data.forEach((r: any) => {
        const amt = Number(r.amount) || 0;
        const paid = Number(r.paid_amount) || 0;
        totalBilled += amt;
        totalCollected += paid;

        if (r.status !== "paid") {
          pendingStudentIds.add(r.student_id);
          if (r.due_date && r.due_date < today) {
            overdueCount++;
          }
        }
      });

      const totalPending = Math.max(0, totalBilled - totalCollected);
      const collectionPct = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

      return {
        total_billed: totalBilled,
        total_collected: totalCollected,
        total_pending: totalPending,
        collection_percentage: collectionPct,
        overdue_invoices_count: overdueCount,
        pending_students_count: pendingStudentIds.size,
      };
    } catch (err) {
      console.error("Failed to calculate fee summary:", err);
      return zeroSummary;
    }
  },

  /**
   * Fetch standard fee structures for the institute
   */
  async getFeeStructures(): Promise<FeeStructure[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from("fee_structures")
        .select("*")
        .order("course_name");

      if (error) throw error;
      return (data || []).map((row) => ({
        id: row.id,
        course_name: row.course_name,
        academic_year: row.academic_year,
        total_fee: Number(row.total_fee) || 0,
        description: row.description,
        institute_id: row.institute_id,
        created_at: row.created_at,
      }));
    } catch (err: any) {
      console.error("Failed to load fee structures:", err);
      return [];
    }
  },

  /**
   * Collect an atomic fee payment (full or partial)
   */
  async collectPayment(payload: CollectFeePayload): Promise<any> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Database service is not configured.");
    }

    const { data, error } = await supabase.rpc("collect_fee_payment", {
      p_record_id: payload.record_id,
      p_amount: payload.amount,
      p_payment_mode: payload.payment_mode,
      p_transaction_ref: payload.transaction_ref || null,
      p_notes: payload.notes || null,
    });

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Create a new fee invoice for a student
   */
  async createInvoice(payload: CreateInvoicePayload): Promise<any> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Database service is not configured.");
    }

    const { data, error } = await supabase.rpc("create_student_fee_invoice", {
      p_student_id: payload.student_id,
      p_title: payload.title,
      p_amount: payload.amount,
      p_due_date: payload.due_date,
      p_notes: payload.notes || null,
      p_fee_structure_id: payload.fee_structure_id || null,
    });

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Fetch complete payment transaction history for a fee record
   */
  async getPaymentHistory(recordId: string): Promise<FeePayment[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from("fee_payments")
        .select("*")
        .eq("record_id", recordId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((p: any) => ({
        id: p.id,
        fee_record_id: p.fee_record_id || p.record_id || "",
        student_id: p.student_id || "",
        amount: Number(p.amount) || 0,
        payment_mode: p.payment_mode,
        receipt_no: p.receipt_no,
        transaction_ref: p.transaction_ref,
        notes: p.notes,
        collected_by: p.collected_by || null,
        institute_id: p.institute_id || "",
        payment_date: p.payment_date,
        is_reversal: p.is_reversal ?? false,
        reversal_reason: p.reversal_reason,
        created_at: p.created_at,
      }));
    } catch (err: any) {
      console.error("Failed to load payment history:", err);
      return [];
    }
  },

  /**
   * Fetch single student's fee records (student portal view)
   */
  async getStudentFeeRecords(studentId: string): Promise<FeeRecord[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from("fee_records")
        .select(`
          id,
          student_id,
          title,
          amount,
          paid_amount,
          discount_amount,
          status,
          due_date,
          paid_date,
          receipt_no,
          payment_mode,
          transaction_ref,
          notes,
          fee_structure_id,
          institute_id,
          created_at,
          updated_at
        `)
        .eq("student_id", studentId)
        .order("due_date", { ascending: true });

      if (error) throw error;

      return (data || []).map((row: any) => {
        const total = Number(row.amount) || 0;
        const paid = Number(row.paid_amount) || 0;

        return {
          id: row.id,
          student_id: row.student_id,
          title: row.title || "Tuition Fee",
          amount: total,
          paid_amount: paid,
          discount_amount: Number(row.discount_amount) || 0,
          balance_due: Math.max(0, total - paid),
          status: row.status as FeeStatus,
          due_date: row.due_date,
          paid_date: row.paid_date,
          receipt_no: row.receipt_no,
          payment_mode: row.payment_mode,
          transaction_ref: row.transaction_ref,
          notes: row.notes,
          fee_structure_id: row.fee_structure_id,
          institute_id: row.institute_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });
    } catch (err: any) {
      console.error("Failed to load student fee ledger:", err);
      return [];
    }
  },

  /**
   * Reverse an existing fee payment (authorized staff only)
   */
  async reversePayment(
    paymentId: string,
    reason: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database service is not configured." };
    }

    try {
      const { data, error } = await supabase.rpc("reverse_fee_payment", {
        p_payment_id: paymentId,
        p_reason: reason,
      });

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Export fee records to CSV
   */
  exportFeeLedgerCsv(records: FeeRecord[]): void {
    if (records.length === 0) return;

    const headers = [
      "Receipt No",
      "Student Name",
      "Admission No",
      "Batch",
      "Fee Title",
      "Total Amount (INR)",
      "Paid Amount (INR)",
      "Balance Due (INR)",
      "Status",
      "Due Date",
      "Paid Date",
      "Payment Mode",
      "Reference",
    ];

    const rows = records.map((r) => [
      `"${r.receipt_no || "—"}"`,
      `"${r.student_name || "—"}"`,
      `"${r.admission_no || "—"}"`,
      `"${r.batch_name || "—"}"`,
      `"${r.title}"`,
      r.amount,
      r.paid_amount,
      r.balance_due,
      `"${r.status.toUpperCase()}"`,
      `"${r.due_date}"`,
      `"${r.paid_date || "—"}"`,
      `"${r.payment_mode ? r.payment_mode.toUpperCase() : "—"}"`,
      `"${r.transaction_ref || "—"}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Pradeep_Classes_Fee_Ledger_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },
};
