import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "../common";
import { reverseExpense } from "../../services/financeService";
import type { InstituteExpense } from "../../types/finance";

interface ExpenseReversalModalProps {
  isOpen: boolean;
  expense: InstituteExpense | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ExpenseReversalModal: React.FC<ExpenseReversalModalProps> = ({
  isOpen,
  expense,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !expense) return null;

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("A formal reversal reason is required for financial audit tracking.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await reverseExpense(expense.id, reason.trim());
      setReason("");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error reversing expense:", err);
      setError(err.message || "Failed to reverse expense transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-['Inter']">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-rose-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            <h3 className="text-sm font-bold font-['Manrope']">Audit Expense Reversal</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-rose-200 hover:text-white hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleReverse} className="p-6 space-y-4">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            You are reversing an approved expenditure of{" "}
            <b>₹{Number(expense.amount).toLocaleString("en-IN")}</b> for{" "}
            <b>{expense.description || expense.category}</b>. In accordance with financial
            integrity rules, this record will remain in the ledger marked as <b>REVERSED</b> with your audit note.
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Reason for Reversal *
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Inadvertent duplicate entry, vendor issued full refund, erroneous receipt..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              required
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs border-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {isSubmitting ? "Processing..." : "Confirm Reversal"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
