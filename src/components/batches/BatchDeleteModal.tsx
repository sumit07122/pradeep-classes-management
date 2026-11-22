import React, { useState } from "react";
import { Modal, Button, Input } from "../common";
import { AlertTriangle, Trash2, Users, ShieldAlert } from "lucide-react";
import type { Batch } from "../../types";
import { batchesService } from "../../services/batchesService";

export interface BatchDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: Batch | null;
  onSuccess: (message: string) => void;
}

export const BatchDeleteModal: React.FC<BatchDeleteModalProps> = ({
  isOpen,
  onClose,
  batch,
  onSuccess,
}) => {
  if (!batch) return null;

  const enrolledCount = batch.student_count || 0;
  const hasEnrolled = enrolledCount > 0;

  const [confirmText, setConfirmText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (hasEnrolled && confirmText.trim() !== "DELETE") {
      setError("Please type DELETE to confirm cascade deletion of this active batch.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await batchesService.deleteBatch(batch.id, hasEnrolled);

    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || "Failed to delete batch.");
    } else {
      onSuccess(
        `Batch "${batch.name}" and associated records deleted successfully.`
      );
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Academic Batch"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600">
          <div className="font-semibold text-slate-800 text-sm">{batch.name}</div>
          <div>Course: {batch.course_name} • Academic Year: {batch.academic_year || "Current"}</div>
        </div>

        {hasEnrolled ? (
          <div className="space-y-3">
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <Users size={15} />
                <span>{enrolledCount} Students Enrolled</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800/90">
                Deleting this batch will unassign all {enrolledCount} enrolled students (moving them to "Unassigned" status) and permanently purge all timetables, class sessions, and faculty allocations for this batch.
              </p>
            </div>

            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start gap-2">
              <ShieldAlert size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                Type <strong>DELETE</strong> below to confirm cascade deletion:
              </div>
            </div>

            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={isSubmitting}
                disabled={confirmText.trim() !== "DELETE"}
                onClick={handleDelete}
                icon={<Trash2 size={14} />}
              >
                Permanently Delete Batch
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Are you sure you want to delete batch <strong>"{batch.name}"</strong>? This will permanently remove its schedules and faculty assignments.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={isSubmitting}
                onClick={handleDelete}
                icon={<Trash2 size={14} />}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
