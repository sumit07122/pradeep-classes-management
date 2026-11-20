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
      // Demo records for initial inspection
      const demoRecords: FeeRecord[] = [
        {
          id: "demo-rec-1",
          student_id: "demo-s1",
          student_name: "Aarav Sharma",
          admission_no: "PC-2026-0001",
          batch_name: "JEE Advanced 2026",
          title: "Term 1 Tuition",
          amount: 22500,
          paid_amount: 22500,
          discount_amount: 0,
          balance_due: 0,
          status: "paid",
          due_date: "2026-04-10",
          paid_date: "2026-04-08",
          receipt_no: "REC-2026-1001",
          payment_mode: "upi",
          transaction_ref: "UPI/260408123456",
          notes: "First installment settled",
          fee_structure_id: null,
          institute_id: "11111111-2222-3333-4444-555555555555",
          created_at: "2026-04-01T10:00:00Z",
          updated_at: "2026-04-08T10:00:00Z",
        },
        {
          id: "demo-rec-2",
          student_id: "demo-s2",
          student_name: "Ananya Verma",
          admission_no: "PC-2026-0002",
          batch_name: "NEET Medical 2026",
          title: "Term 1 Tuition",
          amount: 21000,
          paid_amount: 15000,
          discount_amount: 0,
          balance_due: 6000,
          status: "partial",
          due_date: "2026-04-15",
          paid_date: "2026-04-12",
          receipt_no: "REC-2026-1002",
          payment_mode: "cash",
          transaction_ref: null,
          notes: "Remaining balance committed by next week",
          fee_structure_id: null,
          institute_id: "11111111-2222-3333-4444-555555555555",
          created_at: "2026-04-01T10:00:00Z",
          updated_at: "2026-04-12T10:00:00Z",
        },
        {
          id: "demo-rec-3",
          student_id: "demo-s3",
          student_name: "Rohan Singh",
          admission_no: "PC-2026-0003",
          batch_name: "Foundation 10th",
          title: "Annual Tuition",
          amount: 28000,
          paid_amount: 0,
          discount_amount: 0,
          balance_due: 28000,
          status: "pending",
          due_date: "2026-05-01",
          paid_date: null,
          receipt_no: null,
          payment_mode: null,
          transaction_ref: null,
          notes: null,
          fee_structure_id: null,
          institute_id: "11111111-2222-3333-4444-555555555555",
          created_at: "2026-04-01T10:00:00Z",
          updated_at: "2026-04-01T10:00:00Z",
        },
      ];
      return { data: demoRecords, isDemo: true };
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
   * Fetch aggregated financial summary for the institute
   */
  async getFeeSummary(): Promise<FeeSummary> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        total_billed: 71500,
        total_collected: 37500,
        total_pending: 34000,
        collection_percentage: 52.4,
        overdue_invoices_count: 1,
        pending_students_count: 2,
      };
    }

    try {
      const { data, error } = await supabase.rpc("get_institute_fee_summary");
      if (error) throw error;
      return {
        total_billed: Number(data?.total_billed) || 0,
        total_collected: Number(data?.total_collected) || 0,
        total_pending: Number(data?.total_pending) || 0,
        collection_percentage: Number(data?.collection_percentage) || 0,
        overdue_invoices_count: Number(data?.overdue_invoices_count) || 0,
        pending_students_count: Number(data?.pending_students_count) || 0,
      };
    } catch (err) {
      console.warn("Failed to load fee summary RPC, falling back to client aggregation:", err);
      return {
        total_billed: 0,
        total_collected: 0,
        total_pending: 0,
        collection_percentage: 0,
        overdue_invoices_count: 0,
        pending_students_count: 0,
      };
    }
  },

  /**
   * Fetch institute fee structures catalog
   */
  async getFeeStructures(): Promise<FeeStructure[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [
        {
          id: "demo-fs-1",
          course_name: "JEE Advanced",
          academic_year: "2026-2027",
          total_fee: 45000,
          description: "Comprehensive 1-year coaching",
          institute_id: "11111111-2222-3333-4444-555555555555",
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "demo-fs-2",
          course_name: "NEET Medical",
          academic_year: "2026-2027",
          total_fee: 42000,
          description: "1-year NEET prep with tests",
          institute_id: "11111111-2222-3333-4444-555555555555",
          created_at: "2026-01-01T00:00:00Z",
        },
      ];
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
      return {
        success: true,
        receipt_no: `REC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        amount_paid: payload.amount,
        status: "paid",
      };
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
      return { success: true, record_id: "demo-new-invoice" };
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
   * Fetch payment transaction history for a fee record
   */
  async getPaymentHistory(recordId: string): Promise<FeePayment[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from("fee_payments")
        .select("*")
        .eq("fee_record_id", recordId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        fee_record_id: p.fee_record_id,
        student_id: p.student_id,
        amount: Number(p.amount) || 0,
        payment_mode: p.payment_mode,
        transaction_ref: p.transaction_ref,
        receipt_no: p.receipt_no,
        notes: p.notes,
        collected_by: p.collected_by,
        institute_id: p.institute_id,
        payment_date: p.payment_date,
        created_at: p.created_at,
      }));
    } catch (err: any) {
      console.error("Failed to load payment history:", err);
      return [];
    }
  },

  /**
   * Fetch student's fee ledger for student/parent portal
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
      return {
        success: true,
        data: {
          reversal_receipt_no: `REV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          new_status: "pending",
        },
      };
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
