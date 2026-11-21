import React, { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import { Button } from "../common";
import { createIncome, updateIncome } from "../../services/financeService";
import type { IncomeSourceType, PaymentMethod, InstituteIncome } from "../../types/finance";

interface IncomeModalProps {
  isOpen: boolean;
  initialData?: InstituteIncome | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const IncomeModal: React.FC<IncomeModalProps> = ({
  isOpen,
  initialData,
  onClose,
  onSuccess,
}) => {
  const [sourceType, setSourceType] = useState<IncomeSourceType>("admission_fee");
  const [amount, setAmount] = useState<string>("");
  const [incomeDate, setIncomeDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setSourceType(initialData.source_type);
      setAmount(String(initialData.amount));
      setIncomeDate(initialData.income_date);
      setPaymentMethod(initialData.payment_method);
      setTransactionRef(initialData.transaction_reference || "");
      setDescription(initialData.description || "");
    } else {
      setSourceType("admission_fee");
      setAmount("");
      setIncomeDate(new Date().toISOString().split("T")[0]);
      setPaymentMethod("upi");
      setTransactionRef("");
      setDescription("");
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid revenue amount greater than ₹0");
      return;
    }
    if (!description.trim()) {
      setError("Please provide a description or payer context for this income");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (initialData) {
        await updateIncome(initialData.id, {
          source_type: sourceType,
          amount: numAmount,
          income_date: incomeDate,
          payment_method: paymentMethod,
          transaction_reference: transactionRef.trim() || undefined,
          description: description.trim(),
        });
      } else {
        await createIncome({
          source_type: sourceType,
          amount: numAmount,
          income_date: incomeDate,
          payment_method: paymentMethod,
          transaction_reference: transactionRef.trim() || undefined,
          description: description.trim(),
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error saving income:", err);
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
            <h3 className="text-base font-bold font-['Manrope']">
              {initialData ? "Edit Institute Income" : "Record Direct Institute Income"}
            </h3>
            <p className="text-[11px] text-slate-300">
              {initialData
                ? "Update details of this revenue entry"
                : "Add direct institute inflow (admissions, study modules, exams, events)"}
            </p>
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
            {/* Revenue Source Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Income Category *</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as IncomeSourceType)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
                required
              >
                <option value="admission_fee">Admission & Registration Fee</option>
                <option value="study_material">Books & Study Materials</option>
                <option value="student_fee">Direct Student Fee Receipt</option>
                <option value="other">Other Operational Revenue</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder="e.g. 2500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20 font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Date *</label>
              <input
                type="date"
                value={incomeDate}
                onChange={(e) => setIncomeDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
                required
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Channel *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
                required
              >
                <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                <option value="cash">Cash In Hand</option>
                <option value="bank_transfer">Bank Transfer (NEFT / IMPS)</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Reference No */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Ref / Cheque No.</label>
            <input
              type="text"
              placeholder="e.g. UPI Ref / Bank UTR / Receipt No."
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Payer Details / Description *</label>
            <textarea
              rows={2}
              placeholder="e.g. Sold JEE Advanced 2026 Physics module set to Rohan Verma..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
              required
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
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
              className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {isSubmitting ? "Saving..." : initialData ? "Save Changes" : "Save Income"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
