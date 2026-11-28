import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { whatsappService } from "./whatsappService";

export interface AutomationExecutionResult {
  automationName: string;
  processedCount: number;
  queuedCount: number;
  details: string;
  error?: string;
}

export const whatsappAutomationService = {
  /**
   * Helper to insert queued rows safely via Security Definer RPC
   */
  async insertQueueRows(rows: any[]): Promise<{ count: number; error?: string }> {
    if (!supabase || rows.length === 0) return { count: 0 };
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc(
        "enqueue_whatsapp_automation_messages",
        { p_rows: rows }
      );
      if (!rpcErr && rpcRes && rpcRes.success) {
        return { count: rpcRes.count || 0 };
      }
      const { data, error } = await supabase
        .from("whatsapp_message_queue")
        .insert(rows)
        .select("id");
      if (error) throw error;
      return { count: data?.length || 0 };
    } catch (err: any) {
      return { count: 0, error: err.message };
    }
  },

  /**
   * 1A. Attendance Batch 5-Minute Delayed Auto-Dispatch
   * Called right after attendance is submitted for a batch.
   * Dispatches WhatsApp absent alerts to parents scheduled 5 minutes later.
   */
  async scheduleBatchAttendance5MinDispatch(params: {
    batchId: string;
    batchName: string;
    sessionDate: string;
    absentStudents: {
      student_id: string;
      student_name: string;
      parent_phone?: string;
      phone?: string;
    }[];
  }): Promise<AutomationExecutionResult> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        automationName: "Batch Attendance 5-Min Auto-Dispatch",
        processedCount: 0,
        queuedCount: 0,
        details: "Database not configured.",
      };
    }

    try {
      const { absentStudents, batchName, sessionDate } = params;
      if (absentStudents.length === 0) {
        return {
          automationName: "Batch Attendance 5-Min Auto-Dispatch",
          processedCount: 0,
          queuedCount: 0,
          details: "No absent students in this batch roll call.",
        };
      }

      const scheduledTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { data: settings } = await whatsappService.getSettings();
      const isLive = Boolean(settings?.is_enabled && settings?.phone_number_id && settings?.api_token);
      const queueStatus = "pending";

      const rows = absentStudents.map((s) => {
        const rawPhone = s.parent_phone || s.phone || "0000000000";
        const cleanPhone = rawPhone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        const body = `Dear Parent, ${s.student_name} was marked absent from ${batchName} lecture on ${sessionDate} at Pradeep Classes. Please reply or contact the coaching reception at +91 8126180408 if this was informed.`;

        return {
          institute_id: "11111111-2222-3333-4444-555555555555",
          student_id: s.student_id,
          recipient_phone: formattedPhone,
          recipient_name: s.student_name,
          event_type: "attendance_absent",
          template_name: "batch_absent_5min_delay",
          message_body: body,
          parameters: {
            batch_name: batchName,
            session_date: sessionDate,
            scheduled_delay: "5_minutes",
          },
          status: queueStatus,
          scheduled_for: scheduledTime,
          attempts: 0,
          max_attempts: 3,
          error_message: isLive ? null : "Simulated in test mode (WhatsApp credentials not set).",
        };
      });

      const insRes = await this.insertQueueRows(rows);
      if (insRes.error) throw new Error(insRes.error);

      return {
        automationName: "Batch Attendance 5-Min Auto-Dispatch",
        processedCount: absentStudents.length,
        queuedCount: insRes.count,
        details: `Successfully scheduled 5-minute delayed dispatches for ${insRes.count} absent students in ${batchName}. Scheduled for ${new Date(scheduledTime).toLocaleTimeString()}.`,
      };
    } catch (err: any) {
      return {
        automationName: "Batch Attendance 5-Min Auto-Dispatch",
        processedCount: 0,
        queuedCount: 0,
        details: "Failed to schedule batch attendance dispatches",
        error: err.message,
      };
    }
  },

  /**
   * 1B. Daily Absence WhatsApp Digest (6:30 PM)
   * Scans all day-end attendance sessions for today, consolidates absent students,
   * and queues personalized parent notice.
   */
  async runDailyAbsenceDigest(dateParam?: string): Promise<AutomationExecutionResult> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        automationName: "Daily Absence WhatsApp Digest (6:30 PM)",
        processedCount: 0,
        queuedCount: 0,
        details: "Database not configured.",
      };
    }

    try {
      const today = dateParam || new Date().toISOString().split("T")[0];

      // 1. Fetch all attendance sessions from today
      const { data: sessions, error: sessErr } = await supabase
        .from("attendance_sessions")
        .select("id, batch_id")
        .eq("session_date", today);

      if (sessErr) throw sessErr;
      if (!sessions || sessions.length === 0) {
        return {
          automationName: "Daily Absence WhatsApp Digest (6:30 PM)",
          processedCount: 0,
          queuedCount: 0,
          details: `No attendance sessions recorded for ${today}.`,
        };
      }

      const sessionIds = sessions.map((s) => s.id);

      // 2. Fetch all absent records from these sessions
      const { data: records, error: recErr } = await supabase
        .from("attendance_records")
        .select(`
          id, student_id, status,
          students (id, full_name, admission_no, phone, parent_phone, parent_name)
        `)
        .in("session_id", sessionIds)
        .eq("status", "absent");

      if (recErr) throw recErr;
      if (!records || records.length === 0) {
        return {
          automationName: "Daily Absence WhatsApp Digest (6:30 PM)",
          processedCount: 0,
          queuedCount: 0,
          details: `All students attended classes on ${today}! Zero absent records detected.`,
        };
      }

      // 3. Deduplicate by student_id
      const uniqueStudentMap = new Map<string, any>();
      records.forEach((r: any) => {
        if (r.students && !uniqueStudentMap.has(r.student_id)) {
          uniqueStudentMap.set(r.student_id, r.students);
        }
      });

      const uniqueStudents = Array.from(uniqueStudentMap.values());
      const { data: settings } = await whatsappService.getSettings();
      const isLive = Boolean(settings?.is_enabled && settings?.phone_number_id && settings?.api_token);
      const queueStatus = "pending";

      const rows: any[] = [];
      for (const student of uniqueStudents) {
        const alreadyQueued = await whatsappService.checkDuplicateNotification(
          student.id,
          "attendance_absent",
          today
        );
        if (alreadyQueued) continue;

        const rawPhone = student.parent_phone || student.phone || "0000000000";
        const cleanPhone = rawPhone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        const body = `Dear Parent, ${student.full_name} was marked absent from today's classes at Pradeep Classes. Please reply if this was informed.`;

        rows.push({
          institute_id: "11111111-2222-3333-4444-555555555555",
          student_id: student.id,
          recipient_phone: formattedPhone,
          recipient_name: student.parent_name || student.full_name,
          event_type: "attendance_absent",
          template_name: "daily_absence_digest_630pm",
          message_body: body,
          status: queueStatus,
          attempts: 0,
          max_attempts: 3,
          error_message: isLive ? null : "Simulated in test mode (WhatsApp credentials not set).",
        });
      }

      let queuedCount = 0;
      if (rows.length > 0) {
        const insRes = await this.insertQueueRows(rows);
        if (insRes.error) throw new Error(insRes.error);
        queuedCount = insRes.count;
      }

      return {
        automationName: "Daily Absence WhatsApp Digest (6:30 PM)",
        processedCount: uniqueStudents.length,
        queuedCount,
        details: `Scan complete for ${today}: Found ${uniqueStudents.length} absent students. Queued ${queuedCount} consolidated WhatsApp digest notifications (${uniqueStudents.length - queuedCount} were already notified today).`,
      };
    } catch (err: any) {
      return {
        automationName: "Daily Absence WhatsApp Digest (6:30 PM)",
        processedCount: 0,
        queuedCount: 0,
        details: "Daily absence scan encountered an error",
        error: err.message,
      };
    }
  },

  /**
   * 2A. Instant Fee Deposit Receipt WhatsApp Notification
   * Called immediately whenever a fee payment is collected.
   */
  async triggerInstantFeeDepositReceipt(params: {
    studentId: string;
    studentName: string;
    amountPaid: number;
    paymentMode: string;
    receiptId: string;
    remainingBalance: number;
    parentPhone?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { success: false, error: "Database not configured" };

    try {
      const rawPhone = params.parentPhone || "0000000000";
      const cleanPhone = rawPhone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

      const body = `Dear Parent, fee payment of ₹${params.amountPaid.toLocaleString("en-IN")} for ${params.studentName} has been received successfully via ${params.paymentMode.toUpperCase()}. Receipt No: ${params.receiptId.slice(0, 8).toUpperCase()}. Remaining Balance: ₹${params.remainingBalance.toLocaleString("en-IN")}. Thank you for your continued trust in Pradeep Classes.`;

      const { data: settings } = await whatsappService.getSettings();
      const isLive = Boolean(settings?.is_enabled && settings?.phone_number_id && settings?.api_token);
      const queueStatus = "pending";

      const row = {
        institute_id: "11111111-2222-3333-4444-555555555555",
        student_id: params.studentId,
        recipient_phone: formattedPhone,
        recipient_name: params.studentName,
        event_type: "fee_receipt",
        template_name: "fee_deposit_receipt_instant",
        message_body: body,
        parameters: {
          amount_paid: params.amountPaid,
          payment_mode: params.paymentMode,
          receipt_no: params.receiptId,
          remaining_balance: params.remainingBalance,
        },
        status: queueStatus,
        attempts: 0,
        max_attempts: 3,
        error_message: isLive ? null : "Simulated in test mode (WhatsApp credentials not set).",
      };

      const insRes = await this.insertQueueRows([row]);
      if (insRes.error) throw new Error(insRes.error);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to trigger instant fee receipt" };
    }
  },

  /**
   * 2B. Monthly Fee Due Auto-Reminder (1st & 10th of every month)
   * Scans students with overdue balances (outstanding_amount > 0) and generates
   * personalized WhatsApp payment reminders.
   */
  async scanAndQueueMonthlyFeeReminders(): Promise<AutomationExecutionResult> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        automationName: "Monthly Fee Due Auto-Reminder (1st & 10th)",
        processedCount: 0,
        queuedCount: 0,
        details: "Database not configured.",
      };
    }

    try {
      // Fetch fee records with positive pending balances
      const { data: records, error } = await supabase
        .from("fee_records")
        .select(`
          id, student_id, total_amount, paid_amount, due_date, fee_title,
          students (id, full_name, admission_no, phone, parent_phone, parent_name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!records || records.length === 0) {
        return {
          automationName: "Monthly Fee Due Auto-Reminder (1st & 10th)",
          processedCount: 0,
          queuedCount: 0,
          details: "All fee invoices are currently settled in full! Zero pending balances detected.",
        };
      }

      // Group balances by student
      const studentBalanceMap = new Map<string, { student: any; totalDue: number; feeTitles: string[] }>();
      records.forEach((r: any) => {
        if (!r.students) return;
        const pendingAmount = Number(r.total_amount) - Number(r.paid_amount);
        if (pendingAmount <= 0) return;

        const current = studentBalanceMap.get(r.student_id) || {
          student: r.students,
          totalDue: 0,
          feeTitles: [],
        };
        current.totalDue += pendingAmount;
        if (r.fee_title && !current.feeTitles.includes(r.fee_title)) {
          current.feeTitles.push(r.fee_title);
        }
        studentBalanceMap.set(r.student_id, current);
      });

      const { data: settings } = await whatsappService.getSettings();
      const isLive = Boolean(settings?.is_enabled && settings?.phone_number_id && settings?.api_token);
      const queueStatus = "pending";

      const rows: any[] = [];
      const thisMonth = new Date().toISOString().slice(0, 7); // e.g. 2026-11

      for (const [studentId, item] of studentBalanceMap.entries()) {
        const rawPhone = item.student.parent_phone || item.student.phone || "0000000000";
        const cleanPhone = rawPhone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        const body = `Dear Parent, this is an official fee reminder from Pradeep Classes. An overdue balance of ₹${item.totalDue.toLocaleString("en-IN")} is pending for ${item.student.full_name}. Please deposit the due fee at your earliest convenience via the student portal: https://app.pradeepclasses.in/portal or visit the administrative block. For assistance: +91 8126180408.`;

        rows.push({
          institute_id: "11111111-2222-3333-4444-555555555555",
          student_id: studentId,
          recipient_phone: formattedPhone,
          recipient_name: item.student.parent_name || item.student.full_name,
          event_type: "fee_due_reminder",
          template_name: "monthly_fee_due_reminder",
          message_body: body,
          parameters: {
            student_name: item.student.full_name,
            total_due: item.totalDue,
            fee_titles: item.feeTitles.join(", "),
            month: thisMonth,
          },
          status: queueStatus,
          attempts: 0,
          max_attempts: 3,
          error_message: isLive ? null : "Simulated in test mode (WhatsApp credentials not set).",
        });
      }

      let queuedCount = 0;
      if (rows.length > 0) {
        const insRes = await this.insertQueueRows(rows);
        if (insRes.error) throw new Error(insRes.error);
        queuedCount = insRes.count;
      }

      return {
        automationName: "Monthly Fee Due Auto-Reminder (1st & 10th)",
        processedCount: studentBalanceMap.size,
        queuedCount,
        details: `Scan complete: Found ${studentBalanceMap.size} students with overdue fees. Successfully queued ${queuedCount} personalized WhatsApp fee reminders.`,
      };
    } catch (err: any) {
      return {
        automationName: "Monthly Fee Due Auto-Reminder (1st & 10th)",
        processedCount: 0,
        queuedCount: 0,
        details: "Fee due reminder scan failed",
        error: err.message,
      };
    }
  },

  /**
   * 3. Automated Exam Scorecard Dispatch
   * When faculty completes entering marks for weekly or monthly tests,
   * 1-click broadcasts personalized report cards to each student's parent via WhatsApp.
   */
  async broadcastExamScorecards(examId: string): Promise<AutomationExecutionResult> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        automationName: "Automated Exam Scorecard Dispatch",
        processedCount: 0,
        queuedCount: 0,
        details: "Database not configured.",
      };
    }

    try {
      // 1. Fetch exam metadata
      const { data: exam, error: examErr } = await supabase
        .from("exams")
        .select("id, title, subject, max_marks, exam_date, batches (name)")
        .eq("id", examId)
        .single();

      if (examErr) throw examErr;
      if (!exam) throw new Error("Exam not found");

      const batchName = (exam as any).batches?.name || "Batch";

      // 2. Fetch marks evaluated for this exam
      const { data: marks, error: marksErr } = await supabase
        .from("exam_marks")
        .select(`
          id, student_id, marks_obtained, is_absent, remarks,
          students (id, full_name, admission_no, phone, parent_phone, parent_name)
        `)
        .eq("exam_id", examId);

      if (marksErr) throw marksErr;
      if (!marks || marks.length === 0) {
        return {
          automationName: "Automated Exam Scorecard Dispatch",
          processedCount: 0,
          queuedCount: 0,
          details: "No student marks recorded for this exam yet.",
        };
      }

      const { data: settings } = await whatsappService.getSettings();
      const isLive = Boolean(settings?.is_enabled && settings?.phone_number_id && settings?.api_token);
      const queueStatus = "pending";

      const rows: any[] = [];
      marks.forEach((m: any) => {
        if (!m.students) return;

        const rawPhone = m.students.parent_phone || m.students.phone || "0000000000";
        const cleanPhone = rawPhone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        let body = "";
        if (m.is_absent) {
          body = `Dear Parent, ${m.students.full_name} was marked absent for ${exam.title} (${exam.subject}) assessment held on ${exam.exam_date} for ${batchName}. Please contact faculty for re-assessment. Pradeep Classes.`;
        } else {
          const score = Number(m.marks_obtained);
          const max = Number(exam.max_marks);
          const pct = max > 0 ? ((score / max) * 100).toFixed(1) : "0";
          body = `Dear Parent, ${m.students.full_name}'s scorecard for ${exam.title} (${exam.subject}) is evaluated: Score: ${score}/${max} (${pct}%). ${m.remarks ? "Faculty Remarks: " + m.remarks : ""} Pradeep Classes Academic Assessment Desk.`;
        }

        rows.push({
          institute_id: "11111111-2222-3333-4444-555555555555",
          student_id: m.students.id,
          recipient_phone: formattedPhone,
          recipient_name: m.students.parent_name || m.students.full_name,
          event_type: "exam_scorecard",
          template_name: "exam_scorecard_broadcast",
          message_body: body,
          parameters: {
            exam_title: exam.title,
            subject: exam.subject,
            max_marks: exam.max_marks,
            marks_obtained: m.marks_obtained,
            is_absent: m.is_absent,
          },
          status: queueStatus,
          attempts: 0,
          max_attempts: 3,
          error_message: isLive ? null : "Simulated in test mode (WhatsApp credentials not set).",
        });
      });

      let queuedCount = 0;
      if (rows.length > 0) {
        const insRes = await this.insertQueueRows(rows);
        if (insRes.error) throw new Error(insRes.error);
        queuedCount = insRes.count;
      }

      return {
        automationName: "Automated Exam Scorecard Dispatch",
        processedCount: marks.length,
        queuedCount,
        details: `Successfully generated and queued ${queuedCount} personalized WhatsApp scorecards for ${exam.title} (${exam.subject}).`,
      };
    } catch (err: any) {
      return {
        automationName: "Automated Exam Scorecard Dispatch",
        processedCount: 0,
        queuedCount: 0,
        details: "Scorecard broadcast failed",
        error: err.message,
      };
    }
  },

  /**
   * 4. Daily Class Diary & Homework Parent Broadcast (7:00 PM)
   * Sends brief daily summary of topics covered in class and homework assigned directly to parents.
   */
  async broadcastDailyDiaryAndHomework(params?: {
    batchId?: string;
    date?: string;
  }): Promise<AutomationExecutionResult> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        automationName: "Daily Class Diary & Homework Parent Broadcast (7:00 PM)",
        processedCount: 0,
        queuedCount: 0,
        details: "Database not configured.",
      };
    }

    try {
      const targetDate = params?.date || new Date().toISOString().split("T")[0];

      // 1. Fetch class sessions for today
      let sessionQuery = supabase
        .from("class_sessions")
        .select(`
          id, batch_id, subject, topics_covered, session_date,
          batches (id, name)
        `)
        .eq("session_date", targetDate);

      if (params?.batchId) {
        sessionQuery = sessionQuery.eq("batch_id", params.batchId);
      }

      const { data: sessions, error: sErr } = await sessionQuery;
      if (sErr) throw sErr;

      // 2. Fetch homework assigned today
      let hwQuery = supabase
        .from("homework")
        .select("id, batch_id, title, description, due_date")
        .eq("assigned_date", targetDate);

      if (params?.batchId) {
        hwQuery = hwQuery.eq("batch_id", params.batchId);
      }

      const { data: homeworks } = await hwQuery;

      if ((!sessions || sessions.length === 0) && (!homeworks || homeworks.length === 0)) {
        return {
          automationName: "Daily Class Diary & Homework Parent Broadcast (7:00 PM)",
          processedCount: 0,
          queuedCount: 0,
          details: `No class diary or homework sessions logged for ${targetDate}.`,
        };
      }

      // Group diary entries by batch
      interface BatchSummaryItem {
        batchName: string;
        topics: string[];
        homeworks: string[];
      }
      const batchSummaries = new Map<string, BatchSummaryItem>();
      (sessions || []).forEach((s: any) => {
        const bId = s.batch_id;
        const bName = s.batches?.name || "Academic Batch";
        const cur: BatchSummaryItem = batchSummaries.get(bId) || { batchName: bName, topics: [], homeworks: [] };
        if (s.topics_covered) cur.topics.push(`${s.subject || "Topic"}: ${s.topics_covered}`);
        batchSummaries.set(bId, cur);
      });

      (homeworks || []).forEach((h: any) => {
        const bId = h.batch_id;
        const cur: BatchSummaryItem = batchSummaries.get(bId) || { batchName: "Academic Batch", topics: [], homeworks: [] };
        cur.homeworks.push(`${h.title} (Due: ${h.due_date || "Next Class"})`);
        batchSummaries.set(bId, cur);
      });

      // For each batch, fetch enrolled students
      const { data: settings } = await whatsappService.getSettings();
      const isLive = Boolean(settings?.is_enabled && settings?.phone_number_id && settings?.api_token);
      const queueStatus = "pending";

      const rows: any[] = [];
      let totalRecipients = 0;

      for (const [batchId, summary] of batchSummaries.entries()) {
        const { data: batchStudents } = await supabase
          .from("students")
          .select("id, full_name, phone, parent_phone, parent_name")
          .eq("batch_id", batchId)
          .eq("status", "enrolled");

        if (!batchStudents || batchStudents.length === 0) continue;
        totalRecipients += batchStudents.length;

        const topicsText = summary.topics.length > 0 ? summary.topics.join("; ") : "Regular revision & exercises";
        const hwText = summary.homeworks.length > 0 ? summary.homeworks.join("; ") : "Review daily notes";

        const messageBody = `Dear Parent, Daily Academic Digest for ${summary.batchName} (${targetDate}):\n📚 Topics Covered: ${topicsText}\n📝 Homework Assigned: ${hwText}\nPlease monitor your ward's daily revision. Pradeep Classes Academic Faculty.`;

        batchStudents.forEach((student: any) => {
          const rawPhone = student.parent_phone || student.phone || "0000000000";
          const cleanPhone = rawPhone.replace(/\D/g, "");
          const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

          rows.push({
            institute_id: "11111111-2222-3333-4444-555555555555",
            student_id: student.id,
            recipient_phone: formattedPhone,
            recipient_name: student.parent_name || student.full_name,
            event_type: "class_diary",
            template_name: "daily_diary_homework_7pm",
            message_body: messageBody,
            parameters: {
              batch_id: batchId,
              batch_name: summary.batchName,
              date: targetDate,
            },
            status: queueStatus,
            attempts: 0,
            max_attempts: 3,
            error_message: isLive ? null : "Simulated in test mode (WhatsApp credentials not set).",
          });
        });
      }

      let queuedCount = 0;
      if (rows.length > 0) {
        const insRes = await this.insertQueueRows(rows);
        if (insRes.error) throw new Error(insRes.error);
        queuedCount = insRes.count;
      }

      return {
        automationName: "Daily Class Diary & Homework Parent Broadcast (7:00 PM)",
        processedCount: totalRecipients,
        queuedCount,
        details: `Compiled digest across ${batchSummaries.size} active batches for ${targetDate}. Successfully queued ${queuedCount} WhatsApp daily summaries to parents.`,
      };
    } catch (err: any) {
      return {
        automationName: "Daily Class Diary & Homework Parent Broadcast (7:00 PM)",
        processedCount: 0,
        queuedCount: 0,
        details: "Daily diary digest broadcast failed",
        error: err.message,
      };
    }
  },

  /**
   * 5. Automated Student Birthday Wishes
   * Automatically detects students celebrating birthdays today and dispatches a warm greeting message.
   */
  async scanAndQueueBirthdayWishes(): Promise<AutomationExecutionResult> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        automationName: "Automated Student Birthday Wishes",
        processedCount: 0,
        queuedCount: 0,
        details: "Database not configured.",
      };
    }

    try {
      const today = new Date();
      const monthDay = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`; // e.g. "11-28"

      // Fetch enrolled students with dob populated
      const { data: students, error } = await supabase
        .from("students")
        .select("id, full_name, admission_no, phone, parent_phone, dob")
        .not("dob", "is", null);

      if (error) throw error;

      // Filter for birthdays today (matching MM-DD)
      const birthdayStudents = (students || []).filter((s) => {
        if (!s.dob) return false;
        return s.dob.endsWith(monthDay);
      });

      if (birthdayStudents.length === 0) {
        return {
          automationName: "Automated Student Birthday Wishes",
          processedCount: 0,
          queuedCount: 0,
          details: `No student birthdays detected for today (${today.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}).`,
        };
      }

      const { data: settings } = await whatsappService.getSettings();
      const isLive = Boolean(settings?.is_enabled && settings?.phone_number_id && settings?.api_token);
      const queueStatus = "pending";

      const rows: any[] = [];
      const thisYear = today.getFullYear().toString();

      for (const student of birthdayStudents) {
        const alreadySent = await whatsappService.checkDuplicateNotification(
          student.id,
          "birthday_wishes",
          thisYear
        );
        if (alreadySent) continue;

        const rawPhone = student.phone || student.parent_phone || "0000000000";
        const cleanPhone = rawPhone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        const body = `🎉 Happy Birthday to our dear student ${student.full_name}! May you achieve great success and excellence in your studies. Wishing you a wonderful year ahead from the entire Pradeep Classes Faculty & Management Team! 🎂✨`;

        rows.push({
          institute_id: "11111111-2222-3333-4444-555555555555",
          student_id: student.id,
          recipient_phone: formattedPhone,
          recipient_name: student.full_name,
          event_type: "birthday_wishes",
          template_name: "student_birthday_greeting",
          message_body: body,
          parameters: {
            student_name: student.full_name,
            year: thisYear,
          },
          status: queueStatus,
          attempts: 0,
          max_attempts: 3,
          error_message: isLive ? null : "Simulated in test mode (WhatsApp credentials not set).",
        });
      }

      let queuedCount = 0;
      if (rows.length > 0) {
        const insRes = await this.insertQueueRows(rows);
        if (insRes.error) throw new Error(insRes.error);
        queuedCount = insRes.count;
      }

      return {
        automationName: "Automated Student Birthday Wishes",
        processedCount: birthdayStudents.length,
        queuedCount,
        details: `Detected ${birthdayStudents.length} student birthday celebrant(s) today! Successfully queued ${queuedCount} warm birthday greetings.`,
      };
    } catch (err: any) {
      return {
        automationName: "Automated Student Birthday Wishes",
        processedCount: 0,
        queuedCount: 0,
        details: "Birthday wishes scan encountered an error",
        error: err.message,
      };
    }
  },
};
