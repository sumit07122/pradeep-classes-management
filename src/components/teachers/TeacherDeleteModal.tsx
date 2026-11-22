import React, { useState } from "react";
import { Modal, Button, Input } from "../common";
import { AlertTriangle, Trash2, UserX, ShieldAlert } from "lucide-react";
import type { Teacher } from "../../types";
import { teachersService } from "../../services/teachersService";

export interface TeacherDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: Teacher | null;
  onSuccess: (message: string) => void;
}

export const TeacherDeleteModal: React.FC<TeacherDeleteModalProps> = ({
  isOpen,
  onClose,
  teacher,
  onSuccess,
}) => {
  if (!teacher) return null;

  const [mode, setMode] = useState<"choose" | "relieve" | "force_delete">("choose");
  const [relieveReason, setRelieveReason] = useState("Relieved from active faculty duties");
  const [confirmText, setConfirmText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRelieve = async () => {
    setIsSubmitting(true);
    setError(null);

    const res = await teachersService.updateTeacherStatus(
      teacher.id,
      "relieved",
      relieveReason,
      new Date().toISOString().split("T")[0]
    );

    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || "Failed to mark faculty as relieved.");
    } else {
      onSuccess(
        `Faculty member ${teacher.full_name} has been safely marked as Relieved. Financial and tax history preserved.`
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

    const res = await teachersService.deleteTeacher(teacher.id, true);

    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || "Failed to permanently delete faculty member.");
    } else {
      onSuccess(
        `Faculty member ${teacher.full_name} and all associated records have been permanently purged.`
      );
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Faculty Lifecycle & Deletion Options"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600">
          <div className="font-semibold text-slate-800 text-sm">{teacher.full_name}</div>
          <div>Subject: {teacher.subject} • Phone: {teacher.phone || "N/A"}</div>
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              Leading ERPs offer two distinct options when a faculty member leaves. Choose how you would like to handle{" "}
              <strong>{teacher.full_name}</strong>:
            </p>

            {/* Option 1: Relieve / Soft Archive */}
            <div
              onClick={() => setMode("relieve")}
              className="p-3.5 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 cursor-pointer transition flex items-start gap-3"
            >
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                <UserX size={18} />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-emerald-900 flex items-center justify-between">
                  <span>Mark as Relieved / Resigned</span>
                  <span className="text-[10px] bg-emerald-200/80 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">
                    RECOMMENDED
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800/80 mt-1">
                  Safely removes faculty from active timetables, lecture allocations, and batch lists while strictly preserving all historical payroll records, tax receipts, and past attendance sessions.
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
                  Permanently Delete Faculty & Purge Records
                </div>
                <p className="text-[11px] text-rose-700/80 mt-1">
                  Permanently removes this faculty member and cascades to remove all associated payroll entries, batch assignments, and portal login account. Irreversible.
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

        {mode === "relieve" && (
          <div className="space-y-3">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
              Marking <strong>{teacher.full_name}</strong> as relieved will move them to the "Relieved" tab and deactivate active timetable assignments without losing financial audit records.
            </div>

            <Input
              label="Relieving Reason / Note"
              value={relieveReason}
              onChange={(e) => setRelieveReason(e.target.value)}
              placeholder="e.g. End of contract or resigned"
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
                  onClick={handleRelieve}
                >
                  Confirm Relieve
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
                <strong>Warning:</strong> This will execute a cascade deletion across all linked databases, removing payroll disbursements, class attendance history, and auth credentials.
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
