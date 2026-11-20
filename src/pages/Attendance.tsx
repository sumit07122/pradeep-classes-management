import React, { useState, useEffect } from "react";
import {
  ClipboardCheck,
  Calendar,
  Download,
  AlertTriangle,
  Users,
  CheckCircle2,
} from "lucide-react";
import { Button, AlertNotice, LoadingSpinner, EmptyState } from "../components/common";
import { AttendanceStats, RollCallTable, AttendanceDefaultersModal } from "../components/attendance";
import { batchesService } from "../services/batchesService";
import { attendanceService } from "../services/attendanceService";
import { useAuth } from "../hooks/useAuth";
import type {
  Batch,
  RollCallStudent,
  AttendanceSummary,
  AttendanceSession,
  AttendanceStatus,
} from "../types";

export const Attendance: React.FC = () => {
  const { role } = useAuth();

  // Helper for today's local date YYYY-MM-DD
  const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getYesterdayDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [sessionDate, setSessionDate] = useState<string>(getTodayDateString());

  const [students, setStudents] = useState<RollCallStudent[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({
    total_enrolled: 0,
    present_count: 0,
    absent_count: 0,
    late_count: 0,
    leave_count: 0,
    attendance_rate: 100,
  });
  const [session, setSession] = useState<AttendanceSession | null>(null);

  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingRollCall, setLoadingRollCall] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDefaultersOpen, setIsDefaultersOpen] = useState(false);

  // 1. Load Batches
  useEffect(() => {
    loadBatches();
  }, [role]);

  const loadBatches = async () => {
    setLoadingBatches(true);
    try {
      const res = await batchesService.getBatches();
      const data = (res.data || []).filter((b) => b.status === "active");
      setBatches(data);
      if (data.length > 0) {
        setSelectedBatchId((prev) => (prev && data.some((b) => b.id === prev) ? prev : data[0].id));
      } else {
        setSelectedBatchId("");
      }
    } catch (err: any) {
      console.error("Error loading batches for attendance:", err);
      setNotice({ type: "error", message: "Failed to load active institute batches." });
    } finally {
      setLoadingBatches(false);
    }
  };

  // 2. Load Roll Call when batch or date changes
  useEffect(() => {
    if (selectedBatchId && sessionDate) {
      loadRollCall(selectedBatchId, sessionDate);
    } else {
      setStudents([]);
    }
  }, [selectedBatchId, sessionDate]);

  const loadRollCall = async (batchId: string, date: string) => {
    setLoadingRollCall(true);
    setHasUnsavedChanges(false);
    try {
      const data = await attendanceService.getBatchRollCall(batchId, date);
      setSession(data.session);
      setStudents(data.students);
      setSummary(data.summary);
    } catch (err: any) {
      console.error("Error loading roll call:", err);
      setNotice({ type: "error", message: err.message || "Failed to load batch roll call." });
    } finally {
      setLoadingRollCall(false);
    }
  };

  // 3. Roll call state mutations
  const handleStatusChange = (studentId: string, newStatus: AttendanceStatus) => {
    setStudents((prev) => {
      const updated = prev.map((s) => (s.student_id === studentId ? { ...s, status: newStatus } : s));
      recalculateSummary(updated);
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, note: note || undefined } : s))
    );
    setHasUnsavedChanges(true);
  };

  const handleBulkStatusChange = (bulkStatus: AttendanceStatus) => {
    setStudents((prev) => {
      const updated = prev.map((s) => ({ ...s, status: bulkStatus }));
      recalculateSummary(updated);
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  const recalculateSummary = (list: RollCallStudent[]) => {
    let p = 0;
    let a = 0;
    let l = 0;
    let e = 0;
    list.forEach((s) => {
      if (s.status === "present") p++;
      else if (s.status === "absent") a++;
      else if (s.status === "late") l++;
      else if (s.status === "leave") e++;
    });
    const total = list.length;
    const rate = total > 0 ? Math.round(((p + l) / total) * 100) : 100;
    setSummary({
      total_enrolled: total,
      present_count: p,
      absent_count: a,
      late_count: l,
      leave_count: e,
      attendance_rate: rate,
    });
  };

  // 4. Save Attendance
  const handleSaveAttendance = async () => {
    if (!selectedBatchId) return;
    if (students.length === 0) {
      setNotice({ type: "info", message: "No students in this batch to record attendance for." });
      return;
    }

    setSaving(true);
    try {
      const res = await attendanceService.saveBatchAttendance({
        batch_id: selectedBatchId,
        session_date: sessionDate,
        records: students.map((s) => ({
          student_id: s.student_id,
          status: s.status,
          note: s.note,
        })),
      });

      setHasUnsavedChanges(false);
      setNotice({
        type: "success",
        message: `Attendance submitted successfully for ${res.total_marked} students (${res.present_count} present, ${res.absent_count} absent).`,
      });

      // Reload to get updated session info and record IDs
      await loadRollCall(selectedBatchId, sessionDate);
    } catch (err: any) {
      console.error("Failed to save attendance:", err);
      setNotice({ type: "error", message: err.message || "Failed to record attendance." });
    } finally {
      setSaving(false);
    }
  };

  // 5. CSV Export
  const handleExportCsv = () => {
    const currentBatch = batches.find((b) => b.id === selectedBatchId);
    attendanceService.exportAttendanceToCsv(
      currentBatch?.name || "Batch",
      sessionDate,
      students
    );
  };

  const currentBatch = batches.find((b) => b.id === selectedBatchId);

  return (
    <div className="space-y-5">
      {notice && (
        <AlertNotice
          type={notice.type}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}

      {/* Top Header */}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">DAILY ACADEMIC OPERATIONS</div>
          <h1>Batch Attendance Register</h1>
          <p>
            {role === "teacher"
              ? "Record and manage student attendance for your assigned batches."
              : "Audit and verify daily roll call across all coaching institute batches."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedBatchId && students.length > 0 && (
            <Button
              variant="outline"
              onClick={handleExportCsv}
              icon={<Download size={15} />}
            >
              Export CSV
            </Button>
          )}

          {selectedBatchId && (
            <Button
              variant="outline"
              onClick={() => setIsDefaultersOpen(true)}
              icon={<AlertTriangle size={15} className="text-amber-500" />}
            >
              Defaulters (&lt;75%)
            </Button>
          )}

          <Button
            variant="primary"
            onClick={handleSaveAttendance}
            isLoading={saving}
            disabled={saving || loadingRollCall || students.length === 0 || !hasUnsavedChanges && session !== null}
            icon={<ClipboardCheck size={16} />}
          >
            {session ? (hasUnsavedChanges ? "Update Attendance Roll" : "Saved & Verified") : "Save Attendance Roll"}
          </Button>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <section className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Batch Selection */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
            <Users size={15} className="text-[#16466f]" />
            Select Batch:
          </label>
          {loadingBatches ? (
            <div className="h-9 px-3 flex items-center text-xs text-slate-400">Loading batches...</div>
          ) : batches.length === 0 ? (
            <div className="text-xs text-rose-600 font-semibold">No active batches available</div>
          ) : (
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-[#16466f] min-w-[200px]"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.course_name})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Date Selection */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
            <Calendar size={15} className="text-[#16466f]" />
            Session Date:
          </label>
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            max={getTodayDateString()}
            className="h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white outline-none focus:border-[#16466f]"
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSessionDate(getTodayDateString())}
              className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors ${
                sessionDate === getTodayDateString()
                  ? "bg-[#16466f] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSessionDate(getYesterdayDateString())}
              className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors ${
                sessionDate === getYesterdayDateString()
                  ? "bg-[#16466f] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Yesterday
            </button>
          </div>
        </div>
      </section>

      {/* KPI Stats Banner */}
      {selectedBatchId && students.length > 0 && (
        <AttendanceStats summary={summary} />
      )}

      {/* Audit Banner if session was previously taken */}
      {session && (
        <div className="px-4 py-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>
              Attendance roll recorded for <b>{sessionDate}</b>
              {session.taken_by_name && (
                <> by <b>{session.taken_by_name}</b></>
              )}
            </span>
          </div>
          {hasUnsavedChanges && (
            <span className="font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-[11px]">
              Unsaved Changes
            </span>
          )}
        </div>
      )}

      {/* Roll Call Table / States */}
      {loadingRollCall ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80">
          <LoadingSpinner size="lg" />
          <span className="mt-3 text-xs text-slate-500 font-medium">Fetching batch roll call...</span>
        </div>
      ) : batches.length === 0 ? (
        <EmptyState
          title="No Active Batches"
          description="Create and activate student batches to begin recording daily attendance."
        />
      ) : students.length === 0 ? (
        <EmptyState
          title="No Students Enrolled"
          description={`There are currently no active students assigned to ${currentBatch?.name || "this batch"}. Enroll students to record attendance.`}
        />
      ) : (
        <RollCallTable
          students={students}
          batchName={currentBatch?.name || "Batch"}
          onStatusChange={handleStatusChange}
          onNoteChange={handleNoteChange}
          onBulkStatusChange={handleBulkStatusChange}
        />
      )}

      {/* Defaulters Modal */}
      {selectedBatchId && (
        <AttendanceDefaultersModal
          isOpen={isDefaultersOpen}
          onClose={() => setIsDefaultersOpen(false)}
          batchId={selectedBatchId}
          batchName={currentBatch?.name || "Batch"}
        />
      )}
    </div>
  );
};
