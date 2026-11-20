import React, { useState, useEffect } from "react";
import { Modal, Button } from "../common";
import { studentsService, type LiveBatchOption } from "../../services/studentsService";
import { ArrowRightLeft, AlertTriangle } from "lucide-react";
import type { Student } from "../../types";

interface BatchTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onSuccess: () => void;
}

export const BatchTransferModal: React.FC<BatchTransferModalProps> = ({
  isOpen,
  onClose,
  student,
  onSuccess,
}) => {
  const [batches, setBatches] = useState<LiveBatchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetBatchId, setTargetBatchId] = useState("");
  const [reason, setReason] = useState("Administrative batch reallocation");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && student) {
      loadBatches();
      setError(null);
    }
  }, [isOpen, student]);

  const loadBatches = async () => {
    setLoading(true);
    const list = await studentsService.getLiveBatches();
    // Exclude student's current batch
    const candidateBatches = list.filter((b) => b.id !== student?.batch_id);
    setBatches(candidateBatches);
    if (candidateBatches.length > 0) {
      const available = candidateBatches.find((b) => b.is_available) || candidateBatches[0];
      setTargetBatchId(available.id);
    }
    setLoading(false);
  };

  if (!student) return null;

  const selectedTargetBatch = batches.find((b) => b.id === targetBatchId);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBatchId) {
      setError("Please select a target batch.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await studentsService.transferBatch(
      student.id,
      targetBatchId,
      reason.trim() || undefined
    );

    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || "Batch transfer failed. The target batch might be full.");
      return;
    }

    onSuccess();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer Student to Another Batch"
      subtitle="ACADEMIC REALLOCATION"
    >
      <form onSubmit={handleTransfer} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Current Student & Batch info */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Student Name:</span>
            <span className="font-bold text-slate-800">{student.full_name}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Admission ID:</span>
            <span className="font-mono text-slate-700 font-bold">{student.admission_no}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Current Batch:</span>
            <span className="font-semibold text-[#16466f] bg-[#16466f]/10 px-2 py-0.5 rounded">
              {student.batch_name || "Unassigned"}
            </span>
          </div>
        </div>

        {/* Target Batch Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Destination Batch (Real-time Capacity) *
          </label>
          {loading ? (
            <div className="h-10 px-3 flex items-center text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg">
              Checking available batches...
            </div>
          ) : batches.length === 0 ? (
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
              No alternative active batches available for transfer.
            </div>
          ) : (
            <select
              value={targetBatchId}
              onChange={(e) => setTargetBatchId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white outline-none focus:border-[#16466f]"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id} disabled={!b.is_available}>
                  {b.name} — ({b.enrolled_count}/{b.max_capacity} Seats
                  {!b.is_available ? " • FULL" : ""})
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedTargetBatch && !selectedTargetBatch.is_available && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 text-xs text-amber-800 rounded-lg">
            This batch has reached its maximum capacity of {selectedTargetBatch.max_capacity} students.
          </div>
        )}

        {/* Reason for Transfer */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Reason for Batch Transfer
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white outline-none focus:border-[#16466f]"
            placeholder="e.g. Schedule clash resolved / Shifted to Advanced"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={!targetBatchId || (selectedTargetBatch && !selectedTargetBatch.is_available)}
            icon={<ArrowRightLeft size={14} />}
          >
            Execute Transfer
          </Button>
        </div>
      </form>
    </Modal>
  );
};
