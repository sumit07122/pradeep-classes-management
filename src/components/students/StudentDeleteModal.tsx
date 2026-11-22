import React, { useState } from "react";
import { Modal, Button, Input } from "../common";
import { AlertTriangle, Trash2, Archive, ShieldAlert } from "lucide-react";
import type { Student } from "../../types";
import { studentsService } from "../../services/studentsService";

export interface StudentDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onSuccess: (message: string) => void;
}

export const StudentDeleteModal: React.FC<StudentDeleteModalProps> = ({
  isOpen,
  onClose,
  student,
  onSuccess,
}) => {
  if (!student) return null;

  const [mode, setMode] = useState<"choose" | "archive" | "force_delete">("choose");
  const [archiveReason, setArchiveReason] = useState("Deactivated and moved to archives");
  const [confirmText, setConfirmText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleArchive = async () => {
    setIsSubmitting(true);
    setError(null);

    const res = await studentsService.updateStudentStatus(
      student.id,
      "archived",
      archiveReason,
      new Date().toISOString().split("T")[0]
    );

    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || "Failed to archive student record.");
    } else {
      onSuccess(
        `Student ${student.full_name} has been archived. All financial records and attendance history preserved.`
      );
      onClose();
    }
  };

  const handleForceDelete = async () => {
    if (confirmText.trim() !== "DELETE") {
      setError("Please type DELETE to confirm permanent deletion.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await studentsService.deleteStudent(student.id, true);

    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || "Failed to permanently delete student.");
    } else {
      onSuccess(
        `Student ${student.full_name} and all dependent records have been permanently purged.`
      );
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Deletion & Archival Options"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600">
          <div className="font-semibold text-slate-800 text-sm">{student.full_name}</div>
          <div>
            Admission ID: {student.admission_no} • Class: {student.class_name} • Phone: {student.phone || "N/A"}
          </div>
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              Leading education ERPs offer two paths when removing a student:
            </p>

            {/* Option 1: Soft Archive */}
            <div
              onClick={() => setMode("archive")}
              className="p-3.5 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 cursor-pointer transition flex items-start gap-3"
            >
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                <Archive size={18} />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-emerald-900 flex items-center justify-between">
                  <span>Soft Archive Student (Recommended)</span>
                  <span className="text-[10px] bg-emerald-200/80 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">
                    PRESERVES AUDIT
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800/80 mt-1">
                  Safely moves student to Archived tab, unassigns batch, and deactivates active portal login, while strictly retaining fee payments, receipt numbers, and academic exam marks for audits.
                </p>
              </div>
            </div>

            {/* Option 2: Hard Cascade Delete */}
            <div
              onClick={() => setMode("force_delete")}
              className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50 cursor-pointer transition flex items-start gap-3"
            >
              <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0">
                <Trash2 size={18} />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-rose-900">
                  Permanently Delete Student & Cascade Purge
                </div>
                <p className="text-[11px] text-rose-700/80 mt-1">
                  Permanently deletes student and cascades to purge all linked fee records, attendance logs, exam marks, and login account. Irreversible.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {mode === "archive" && (
          <div className="space-y-3">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
              Archiving <strong>{student.full_name}</strong> preserves historical fee receipts and past exams while setting status to Archived.
            </div>

            <Input
              label="Archival Reason / Note"
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="e.g. Completed coaching, or requested refund"
            />

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setMode("choose")}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  isLoading={isSubmitting}
                  onClick={handleArchive}
                >
                  Confirm Archive
                </Button>
              </div>
            </div>
          </div>
        )}

        {mode === "force_delete" && (
          <div className="space-y-3">
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start gap-2">
              <ShieldAlert size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Danger:</strong> This permanently cascades and purges fee payment history, attendance sessions, exam marks, and portal login account.
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Type <strong>DELETE</strong> below to confirm:
              </label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
              />
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setMode("choose")}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  isLoading={isSubmitting}
                  disabled={confirmText.trim() !== "DELETE"}
                  onClick={handleForceDelete}
                  icon={<Trash2 size={14} />}
                >
                  Permanently Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
