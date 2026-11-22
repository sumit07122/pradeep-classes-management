import React, { useState } from "react";
import { Modal, Button, Input } from "../common";
import {
  UserCheck,
  Clock,
  GraduationCap,
  Ban,
  UserMinus,
  Archive,
  AlertCircle,
} from "lucide-react";
import type { Student, StudentStatus } from "../../types";
import { studentsService } from "../../services/studentsService";

export interface StudentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onSuccess: (message: string) => void;
}

export const StudentStatusModal: React.FC<StudentStatusModalProps> = ({
  isOpen,
  onClose,
  student,
  onSuccess,
}) => {
  if (!student) return null;

  const normalizeStatus = (st: string): string => st.toLowerCase().replace(/\s+/g, "_");
  const current = normalizeStatus(student.status || "active");

  const [status, setStatus] = useState<string>(
    ["active", "on_hold", "alumni", "rusticated", "dropped_out", "archived"].includes(current)
      ? current
      : "active"
  );
  const [reason, setReason] = useState(student.status_reason || "");
  const [exitDate, setExitDate] = useState(
    student.exit_date || new Date().toISOString().split("T")[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExitStatus = ["alumni", "rusticated", "dropped_out", "archived"].includes(status);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const res = await studentsService.updateStudentStatus(
      student.id,
      status as StudentStatus,
      reason.trim(),
      isExitStatus ? exitDate : undefined
    );

    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || "Failed to update student status.");
    } else {
      const labels: Record<string, string> = {
        active: "Active",
        on_hold: "On Hold",
        alumni: "Alumni / Passed Out",
        rusticated: "Rusticated / Suspended",
        dropped_out: "Dropped Out",
        archived: "Archived",
      };
      onSuccess(`Student ${student.full_name} status updated to ${labels[status] || status}.`);
      onClose();
    }
  };

  const statusOptions = [
    { id: "active", label: "Active", icon: UserCheck, color: "emerald", desc: "Currently enrolled and attending classes" },
    { id: "on_hold", label: "On Hold", icon: Clock, color: "amber", desc: "Temporarily paused / fees pending" },
    { id: "alumni", label: "Alumni", icon: GraduationCap, color: "blue", desc: "Course completed / Passed out" },
    { id: "rusticated", label: "Rusticated", icon: Ban, color: "rose", desc: "Disciplinary suspension or expulsion" },
    { id: "dropped_out", label: "Dropped Out", icon: UserMinus, color: "orange", desc: "Left institute before course completion" },
    { id: "archived", label: "Archived", icon: Archive, color: "slate", desc: "Inactive / historical record" },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Lifecycle Status"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600">
          <div className="font-semibold text-slate-800 text-sm">{student.full_name}</div>
          <div>Admission ID: {student.admission_no} • Class: {student.class_name} • Batch: {student.batch_name || "Unassigned"}</div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Select Lifecycle Status
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {statusOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = status === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStatus(opt.id)}
                  className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Icon size={14} className={isSelected ? "text-white" : "text-slate-500"} />
                    <span>{opt.label}</span>
                  </div>
                  <span className={`text-[10px] mt-1 line-clamp-1 ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {isExitStatus && (
          <Input
            label="Exit / Status Effective Date"
            type="date"
            required
            value={exitDate}
            onChange={(e) => setExitDate(e.target.value)}
          />
        )}

        <Input
          label="Administrative Reason / Note"
          placeholder="e.g. Scored 99.4 percentile in JEE, or moved to another city"
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
