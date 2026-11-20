import React, { useState, useEffect } from "react";
import {
  ClipboardCheck,
  IndianRupee,
  BookOpen,
  Calendar,
  Award,
  AlertCircle,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { StatCard, Badge, LoadingSpinner, Button } from "../components/common";
import { attendanceService } from "../services/attendanceService";
import { feesService } from "../services/feesService";
import { PrintableReceiptModal } from "../components/fees";
import { supabase } from "../lib/supabase";
import type { StudentAttendanceStats, FeeRecord } from "../types";

export const Portal: React.FC = () => {
  const { user, role, isDemoMode } = useAuth();

  const [studentInfo, setStudentInfo] = useState<{
    id: string;
    full_name: string;
    admission_no: string;
    batch_name: string;
    course_name: string;
  } | null>(null);

  const [attendanceStats, setAttendanceStats] = useState<StudentAttendanceStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<
    {
      id: string;
      session_date: string;
      batch_name: string;
      status: string;
      note: string | null;
    }[]
  >([]);

  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPortalData();
  }, [user, role]);

  const loadPortalData = async () => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let targetStudentId: string | null = null;
      let targetStudent: any = null;

      if (role === "student") {
        const { data, error } = await supabase
          .from("students")
          .select("id, full_name, admission_no, batch_id, batches(name, course_name)")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (error) console.error("Error loading student profile:", error);
        if (data) {
          targetStudentId = data.id;
          targetStudent = data;
        }
      } else if (role === "parent") {
        const { data, error } = await supabase
          .from("parent_students")
          .select("student_id, students(id, full_name, admission_no, batch_id, batches(name, course_name))")
          .eq("parent_profile_id", user.id)
          .eq("is_verified", true)
          .maybeSingle();

        if (error) console.error("Error loading parent ward:", error);
        if (data && data.students) {
          targetStudentId = (data.students as any).id;
          targetStudent = data.students;
        }
      }

      if (targetStudentId && targetStudent) {
        setStudentInfo({
          id: targetStudentId,
          full_name: targetStudent.full_name,
          admission_no: targetStudent.admission_no,
          batch_name: targetStudent.batches?.name || "Assigned Batch",
          course_name: targetStudent.batches?.course_name || "Enrolled Course",
        });

        // Load live attendance stats
        try {
          const stats = await attendanceService.getStudentAttendanceSummary(targetStudentId);
          setAttendanceStats(stats);
        } catch (e) {
          console.warn("Could not load attendance stats RPC:", e);
        }

        // Load recent attendance logs
        try {
          const logs = await attendanceService.getStudentRecentAttendance(targetStudentId, 8);
          setRecentLogs(logs);
        } catch (e) {
          console.warn("Could not load recent attendance logs:", e);
        }

        // Load live fee records
        try {
          const fees = await feesService.getStudentFeeRecords(targetStudentId);
          setFeeRecords(fees);
        } catch (e) {
          console.warn("Could not load student fee records:", e);
        }
      }
    } catch (err) {
      console.error("Error loading portal data:", err);
    } finally {
      setLoading(false);
    }
  };

  const displayName = studentInfo?.full_name || user?.full_name || (role === "parent" ? "Guardian" : "Student");
  const admissionNo = studentInfo?.admission_no || "PC-2026-0001";
  const batchName = studentInfo?.batch_name || "Class 10 Science";

  const totalSessions = attendanceStats?.total_sessions ?? 0;
  const attendedSessions = attendanceStats?.attended_sessions ?? 0;
  const attendanceRate = attendanceStats?.percentage ?? 100;
  const isDefaulter = attendanceStats?.is_defaulter ?? false;

  // Fee calculation
  const totalFeeBilled = feeRecords.reduce((acc, r) => acc + r.amount, 0);
  const totalFeePaid = feeRecords.reduce((acc, r) => acc + r.paid_amount, 0);
  const totalFeeDue = Math.max(0, totalFeeBilled - totalFeePaid);
  const isFeeFullySettled = totalFeeDue === 0 && feeRecords.length > 0;

  const handleOpenReceipt = (rec: FeeRecord) => {
    setActiveReceipt({
      receipt_no: rec.receipt_no || "REC-2026-0000",
      student_name: studentInfo?.full_name || "Student",
      admission_no: studentInfo?.admission_no || "PC-2026-XXXX",
      batch_name: studentInfo?.batch_name || "Batch",
      title: rec.title,
      amount_paid: rec.paid_amount,
      total_paid: rec.paid_amount,
      total_amount: rec.amount,
      balance_due: rec.balance_due,
      payment_mode: rec.payment_mode || "Online",
      payment_date: rec.paid_date || rec.due_date,
      transaction_ref: rec.transaction_ref || undefined,
      notes: rec.notes || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">{role === "parent" ? "GUARDIAN & PARENT PORTAL" : "STUDENT ACADEMIC PORTAL"}</div>
          <h1>Welcome, {displayName}</h1>
          <p>
            {role === "parent"
              ? "Monitor your ward's classroom attendance, tuition fee schedule, and official receipts."
              : "Review your attendance progress, enrolled batch schedule, and tuition fee records."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info" size="md">
            Admission No: {admissionNo}
          </Badge>
          <Badge variant="success" size="md">
            Batch: {batchName}
          </Badge>
        </div>
      </div>

      {/* Low Attendance Warning if < 75% */}
      {isDefaulter && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3 text-xs">
          <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <b className="font-bold text-sm block mb-0.5">Critical Attendance Alert: Below 75% Minimum</b>
            Your recorded attendance has dropped to {attendanceRate}%. The institute requires a minimum of 75% attendance for exam eligibility. Please meet your batch coordinator to resolve accumulated absences.
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <section className="stats-grid">
        <StatCard
          title="Attendance Rate"
          value={`${attendanceRate}%`}
          delta={`${attendedSessions}/${totalSessions} Sessions`}
          note={isDefaulter ? "defaulter (<75%)" : "in good standing"}
          icon={ClipboardCheck}
          tone={attendanceRate >= 80 ? "green" : "amber"}
          isDemo={isDemoMode && !studentInfo}
        />
        <StatCard
          title="Fee Status"
          value={
            feeRecords.length === 0
              ? "In Good Standing"
              : isFeeFullySettled
              ? "Fully Settled"
              : `₹${totalFeeDue.toLocaleString("en-IN")}`
          }
          delta={
            feeRecords.length === 0
              ? "Verified"
              : isFeeFullySettled
              ? "All Clear"
              : "Outstanding Balance"
          }
          note={isFeeFullySettled ? "no pending dues" : `₹${totalFeePaid.toLocaleString("en-IN")} paid`}
          icon={IndianRupee}
          tone={isFeeFullySettled || feeRecords.length === 0 ? "green" : "amber"}
          isDemo={isDemoMode && !studentInfo}
        />
        <StatCard
          title="Enrolled Batch"
          value={batchName}
          delta={studentInfo?.course_name || "Regular"}
          note="active enrollment"
          icon={BookOpen}
          tone="violet"
          isDemo={isDemoMode && !studentInfo}
        />
        <StatCard
          title="Academic Status"
          value="Regular"
          delta="2026-2027"
          note="Pradeep Classes"
          icon={Award}
          tone="amber"
          isDemo={isDemoMode && !studentInfo}
        />
      </section>

      {/* Main Grid: Attendance Log & Fee Receipts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Attendance Log */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Recent Attendance Log</h3>
              <p>Official roll call records marked by your teachers</p>
            </div>
            {totalSessions > 0 && (
              <span className="text-xs font-semibold text-slate-500">
                {attendedSessions} present of {totalSessions}
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No daily attendance sessions have been recorded for your batch yet.
            </div>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-slate-400" />
                    <span className="font-semibold text-slate-800">{log.session_date}</span>
                    <span className="text-slate-400">• {log.batch_name}</span>
                    {log.note && <span className="text-slate-500 italic text-[11px]">({log.note})</span>}
                  </div>
                  <Badge
                    variant={
                      log.status === "present"
                        ? "success"
                        : log.status === "absent"
                        ? "danger"
                        : log.status === "late"
                        ? "warning"
                        : "info"
                    }
                    size="sm"
                    showDot
                  >
                    {log.status.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tuition Fee Invoices & Receipts */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Tuition Fee & Receipts</h3>
              <p>Invoiced terms, payment records, and official receipts</p>
            </div>
            {feeRecords.length > 0 && (
              <span className="text-xs font-semibold text-slate-500">
                ₹{totalFeePaid.toLocaleString("en-IN")} of ₹{totalFeeBilled.toLocaleString("en-IN")}
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : feeRecords.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
              No tuition fee invoices or pending dues recorded for your account.
            </div>
          ) : (
            <div className="space-y-2.5">
              {feeRecords.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{r.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Total: ₹{r.amount.toLocaleString("en-IN")} • Due: {r.due_date}
                      {r.balance_due > 0 && (
                        <span className="text-rose-600 font-bold ml-1">
                          (₹{r.balance_due.toLocaleString("en-IN")} remaining)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        r.status === "paid"
                          ? "success"
                          : r.status === "partial"
                          ? "warning"
                          : r.status === "overdue"
                          ? "danger"
                          : "info"
                      }
                      size="sm"
                      showDot
                    >
                      {r.status.toUpperCase()}
                    </Badge>

                    {r.receipt_no && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenReceipt(r)}
                        icon={<FileText size={12} />}
                      >
                        Receipt
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Printable Receipt Modal */}
      <PrintableReceiptModal
        isOpen={Boolean(activeReceipt)}
        onClose={() => setActiveReceipt(null)}
        receipt={activeReceipt}
      />
    </div>
  );
};
