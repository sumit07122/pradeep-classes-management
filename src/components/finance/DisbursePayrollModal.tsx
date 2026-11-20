import React, { useState } from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "../common";
import { disbursePayroll } from "../../services/financeService";
import type { TeacherPayroll, PaymentMethod } from "../../types/finance";

interface DisbursePayrollModalProps {
  isOpen: boolean;
  payroll: TeacherPayroll | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const DisbursePayrollModal: React.FC<DisbursePayrollModalProps> = ({
  isOpen,
  payroll,
  onClose,
  onSuccess,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [transactionRef, setTransactionRef] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !payroll) return null;

  const handleDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await disbursePayroll(payroll.id, {
        payment_method: paymentMethod,
        transaction_reference: transactionRef.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error disbursing payroll:", err);
      setError(err.message || "Failed to process disbursement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-['Inter']">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 bg-[#102f50] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <h3 className="text-sm font-bold font-['Manrope']">Disburse Faculty Salary</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleDisburse} className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-xs text-slate-500 font-medium">Faculty Member</div>
            <div className="text-sm font-bold text-slate-900">{payroll.teacher_name}</div>
            <div className="flex justify-between items-baseline pt-2 border-t border-slate-200/60">
              <span className="text-xs text-slate-500">Period: {payroll.payroll_month}</span>
              <span className="text-base font-extrabold text-emerald-600 font-mono">
                ₹{Number(payroll.net_amount).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Disbursement Method *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none"
              required
            >
              <option value="bank_transfer">Direct Bank Transfer (NEFT / IMPS)</option>
              <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
              <option value="cheque">Bank Cheque</option>
              <option value="cash">Cash In Hand</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Transaction / Reference Number</label>
            <input
              type="text"
              placeholder="e.g. UTR / IMPS / UPI Ref ID"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Disbursement Remarks</label>
            <textarea
              rows={2}
              placeholder="Optional notes regarding this payment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              {isSubmitting ? "Settling..." : "Confirm & Settle Payout"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
