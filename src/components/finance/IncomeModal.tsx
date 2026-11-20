import React, { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { Button } from "../common";
import { createIncome } from "../../services/financeService";
import type { IncomeSourceType, PaymentMethod } from "../../types/finance";

interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const IncomeModal: React.FC<IncomeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [sourceType, setSourceType] = useState<IncomeSourceType>("admission_fee");
  const [amount, setAmount] = useState<string>("");
  const [incomeDate, setIncomeDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");
  const [transactionReference, setTransactionReference] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid income amount greater than ₹0");
      return;
    }
    if (!description.trim()) {
      setError("Please provide a brief description for this income");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await createIncome({
        source_type: sourceType,
        amount: numAmount,
        income_date: incomeDate,
        payment_method: paymentMethod,
        transaction_reference: transactionReference.trim() || undefined,
        description: description.trim(),
      });

      // Reset and close
      setAmount("");
      setDescription("");
      setTransactionReference("");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error creating income record:", err);
      setError(err.message || "Failed to record income");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-['Inter']">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#102f50] text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold font-['Manrope']">Record Institute Income</h3>
            <p className="text-[11px] text-slate-300">Add direct non-fee revenue to the institutional ledger</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Income Source */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Income Category *</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as IncomeSourceType)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
                required
              >
                <option value="admission_fee">Admission & Registration Fee</option>
                <option value="study_material">Study Material & Book Sale</option>
                <option value="other">Other Operational Revenue</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 pl-7 pr-3 py-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20 font-mono"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date Received *</label>
              <input
                type="date"
                value={incomeDate}
                onChange={(e) => setIncomeDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20 font-mono"
                required
              />
            </div>

            {/* Payment Mode */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
                required
              >
                <option value="upi">UPI (GPay, PhonePe, Paytm)</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Direct Bank Transfer / NEFT</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other Mode</option>
              </select>
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Transaction Reference / Receipt No. (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. UPI-9284729184 or Manual Receipt #104"
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description / Notes *</label>
            <textarea
              rows={2}
              placeholder="e.g. Registration kit fee for new admission"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
              required
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs text-slate-600 border-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              className="text-xs bg-[#102f50] hover:bg-[#16466f] text-white"
            >
              Record Income
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
