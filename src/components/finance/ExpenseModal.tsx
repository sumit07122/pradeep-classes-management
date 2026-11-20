import React, { useState } from "react";
import { X, UploadCloud, AlertCircle } from "lucide-react";
import { Button } from "../common";
import { createExpense } from "../../services/financeService";
import type { ExpenseCategory, PaymentMethod } from "../../types/finance";

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [category, setCategory] = useState<ExpenseCategory>("rent");
  const [amount, setAmount] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");
  const [vendorName, setVendorName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid expense amount greater than ₹0");
      return;
    }
    if (!description.trim()) {
      setError("Please provide a brief description or purpose of this expense");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await createExpense(
        {
          category,
          amount: numAmount,
          expense_date: expenseDate,
          payment_method: paymentMethod,
          vendor_name: vendorName.trim() || undefined,
          description: description.trim(),
        },
        receiptFile || undefined
      );

      // Reset and close
      setAmount("");
      setDescription("");
      setVendorName("");
      setReceiptFile(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error creating expense:", err);
      setError(err.message || "Failed to record expense");
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
            <h3 className="text-base font-bold font-['Manrope']">Record Institute Expense</h3>
            <p className="text-[11px] text-slate-300">Add an operational cash outflow to the ledger</p>
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
            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expense Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
                required
              >
                <option value="rent">Campus Rent</option>
                <option value="electricity_utilities">Electricity & Utilities</option>
                <option value="internet_software">Internet & Software</option>
                <option value="stationery_supplies">Stationery & Supplies</option>
                <option value="marketing_advertising">Marketing & Advertising</option>
                <option value="maintenance">Repairs & Maintenance</option>
                <option value="other">Other Operational Expense</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder="e.g. 5000"
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Expense Date *</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
                required
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
                required
              >
                <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                <option value="bank_transfer">Bank Transfer (NEFT / IMPS)</option>
                <option value="cash">Cash In Hand</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Vendor Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Vendor / Payee Name</label>
            <input
              type="text"
              placeholder="e.g. Pragati Paper Mart / Vidya Properties"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description / Purpose *</label>
            <textarea
              rows={2}
              placeholder="Provide context for this expenditure..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
              required
            />
          </div>

          {/* Receipt File */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Supporting Receipt / Invoice</label>
            <div className="border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50 text-center hover:bg-slate-100/50 transition-colors">
              <label className="cursor-pointer flex flex-col items-center gap-1">
                <UploadCloud size={20} className="text-slate-400" />
                <span className="text-[11px] font-medium text-slate-600">
                  {receiptFile ? receiptFile.name : "Choose receipt image or PDF (max 5MB)"}
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
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
              className="text-xs bg-[#102f50] hover:bg-[#163a60] text-white"
            >
              {isSubmitting ? "Recording..." : "Save Expense"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
