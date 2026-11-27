import React, { useState, useEffect } from "react";
import { X, Users, AlertCircle, Check } from "lucide-react";
import { Button, Input, LoadingSpinner } from "../common";
import { batchesService } from "../../services/batchesService";
import { feesService } from "../../services/feesService";
import type { Batch } from "../../types";
import type { FeeStructure } from "../../types/fees";

interface BatchInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvoicesGenerated?: () => void;
}

export const BatchInvoiceModal: React.FC<BatchInvoiceModalProps> = ({
  isOpen,
  onClose,
  onInvoicesGenerated,
}) => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedStructureId, setSelectedStructureId] = useState("");
  
  const [title, setTitle] = useState(`Monthly Tuition Fee - ${new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}`);
  const [amount, setAmount] = useState<number | "">("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    setErrorNotice(null);
    try {
      const [batchRes, structData] = await Promise.all([
        batchesService.getBatches(),
        feesService.getFeeStructures(),
      ]);
      setBatches(batchRes.data || []);
      setFeeStructures(structData || []);

      if (batchRes.data && batchRes.data.length > 0) {
        setSelectedBatchId(batchRes.data[0].id);
        // Find matching fee structure
        const matching = (structData || []).find((s) => s.course_name === batchRes.data[0].name);
        if (matching) {
          setSelectedStructureId(matching.id);
          setAmount(matching.total_fee);
        }
      }
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to load batches or fee plans");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchChange = (batchId: string) => {
    setSelectedBatchId(batchId);
    const b = batches.find((x) => x.id === batchId);
    if (b) {
      const matching = feeStructures.find((s) => s.course_name === b.name);
      if (matching) {
        setSelectedStructureId(matching.id);
        setAmount(matching.total_fee);
      }
    }
  };

  const handleStructureChange = (structId: string) => {
    setSelectedStructureId(structId);
    const fs = feeStructures.find((s) => s.id === structId);
    if (fs) {
      setAmount(fs.total_fee);
    }
  };

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);
  const studentCount = selectedBatch?.student_count || 0;
  const totalBilledEstimate = studentCount * (Number(amount) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) {
      setErrorNotice("Please select a target batch.");
      return;
    }
    if (!title.trim()) {
      setErrorNotice("Invoice title is required.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setErrorNotice("Please enter a valid billing amount.");
      return;
    }
    if (!dueDate) {
      setErrorNotice("Due date is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    try {
      const res = await feesService.batchIssueInvoices({
        batch_id: selectedBatchId,
        title: title.trim(),
        amount: Number(amount),
        fee_structure_id: selectedStructureId || undefined,
        due_date: dueDate,
        notes: notes.trim() || undefined,
      });

      if (res.error) throw new Error(res.error);

      setSuccessNotice(`Successfully issued ${res.count} fee invoices for ${selectedBatch?.name || "batch"}!`);
      setTimeout(() => {
        onInvoicesGenerated?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to generate batch invoices.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Users size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Batch Fee Billing
              </h2>
              <p className="text-xs text-slate-400">
                Bulk generate fee dues for all enrolled students in a batch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner label="Loading batches..." size="md" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errorNotice && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle size={15} className="text-rose-600 shrink-0" />
                <span>{errorNotice}</span>
              </div>
            )}

            {successNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <Check size={15} className="text-emerald-600 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}

            {/* Batch Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Target Batch
              </label>
              <select
                value={selectedBatchId}
                onChange={(e) => handleBatchChange(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#16466f]"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.student_count} enrolled students)
                  </option>
                ))}
              </select>
            </div>

            {/* Fee Plan Template (Optional) */}
            {feeStructures.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Apply Fee Plan Rate (Optional)
                </label>
                <select
                  value={selectedStructureId}
                  onChange={(e) => handleStructureChange(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#16466f]"
                >
                  <option value="">-- Custom Amount --</option>
                  {feeStructures.map((fs) => (
                    <option key={fs.id} value={fs.id}>
                      {fs.course_name} (₹{fs.total_fee.toLocaleString("en-IN")})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Title & Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Invoice Title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Input
                label="Tuition Fee per Student (₹)"
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>

            {/* Due Date & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Payment Due Date"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <Input
                label="Notes / Ledger Tag"
                placeholder="e.g. December tuition invoice"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Calculation Preview */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 text-slate-700">
              <div className="flex justify-between">
                <span>Enrolled Students in Batch:</span>
                <span className="font-bold text-slate-900">{studentCount} students</span>
              </div>
              <div className="flex justify-between">
                <span>Fee per Student:</span>
                <span className="font-bold text-slate-900">
                  ₹{(Number(amount) || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 text-sm font-extrabold text-[#102f50]">
                <span>Total Batch Billing:</span>
                <span>₹{totalBilledEstimate.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                disabled={studentCount === 0}
              >
                Generate Invoices ({studentCount} Students)
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
