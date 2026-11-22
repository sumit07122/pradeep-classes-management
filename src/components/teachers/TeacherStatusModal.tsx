import React, { useState } from "react";
import { Modal, Button, Input } from "../common";
import { UserCheck, Clock, UserX, AlertCircle } from "lucide-react";
import type { Teacher, TeacherStatus } from "../../types";
import { teachersService } from "../../services/teachersService";

export interface TeacherStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: Teacher | null;
  onSuccess: (message: string) => void;
}

export const TeacherStatusModal: React.FC<TeacherStatusModalProps> = ({
  isOpen,
  onClose,
  teacher,
  onSuccess,
}) => {
  if (!teacher) return null;

  const currentStatus: TeacherStatus =
    (teacher.status as TeacherStatus) || (teacher.is_active ? "active" : "relieved");

  const [status, setStatus] = useState<TeacherStatus>(currentStatus);
  const [reason, setReason] = useState(teacher.status_reason || "");
  const [relievingDate, setRelievingDate] = useState(
    teacher.relieving_date || new Date().toISOString().split("T")[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const res = await teachersService.updateTeacherStatus(
      teacher.id,
      status,
      reason.trim(),
      status === "relieved" ? relievingDate : undefined
    );

    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || "Failed to update faculty status.");
    } else {
      const label =
        status === "active"
          ? "Active"
          : status === "on_leave"
          ? "On Leave"
          : "Relieved / Resigned";
      onSuccess(`Faculty ${teacher.full_name} status updated to ${label}.`);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Faculty Status"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600">
          <div className="font-semibold text-slate-800 text-sm">{teacher.full_name}</div>
          <div>Subject: {teacher.subject} • Phone: {teacher.phone || "N/A"}</div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Faculty Lifecycle Status
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setStatus("active")}
              className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                status === "active"
                  ? "bg-emerald-50 border-emerald-400 text-emerald-800 shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <UserCheck size={16} className={status === "active" ? "text-emerald-600" : "text-slate-400"} />
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatus("on_leave")}
              className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                status === "on_leave"
                  ? "bg-amber-50 border-amber-400 text-amber-800 shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Clock size={16} className={status === "on_leave" ? "text-amber-600" : "text-slate-400"} />
              On Leave
            </button>
            <button
              type="button"
              onClick={() => setStatus("relieved")}
              className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                status === "relieved"
                  ? "bg-slate-100 border-slate-400 text-slate-800 shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <UserX size={16} className={status === "relieved" ? "text-slate-700" : "text-slate-400"} />
              Relieved
            </button>
          </div>
        </div>

        {status === "relieved" && (
          <Input
            label="Relieving / Exit Date"
            type="date"
            required
            value={relievingDate}
            onChange={(e) => setRelievingDate(e.target.value)}
          />
        )}

        <Input
          label="Reason / Administrative Note"
          placeholder="e.g. Maternity leave until next quarter, or resigned for higher education"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Save Status
          </Button>
        </div>
      </form>
    </Modal>
  );
};
