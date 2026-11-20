import React, { useState, useEffect } from 'react';
import { CreditCard, AlertCircle } from 'lucide-react';
import { Modal, Button } from '../common';
import { feesService } from '../../services/feesService';
import type { FeeRecord, PaymentMode } from '../../types/fees';

interface CollectFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: FeeRecord | null;
  onSuccess: (receiptData: any) => void;
}

export const CollectFeeModal: React.FC<CollectFeeModalProps> = ({
  isOpen,
  onClose,
  record,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('upi');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      setAmount(record.balance_due);
      setPaymentMode('upi');
      setTransactionRef('');
      setNotes('');
      setError(null);
    }
  }, [record, isOpen]);

  if (!record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }
    if (amount > record.balance_due) {
      setError(`Payment cannot exceed the outstanding balance of ₹${record.balance_due.toLocaleString('en-IN')}.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await feesService.collectPayment({
        record_id: record.id,
        amount,
        payment_mode: paymentMode,
        transaction_ref: transactionRef.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess({
        ...res,
        student_name: record.student_name,
        admission_no: record.admission_no,
        batch_name: record.batch_name,
        title: record.title,
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to collect fee:', err);
      setError(err.message || 'Payment processing failed. Please check connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Fee Payment & Issue Receipt"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Student & Invoice Overview */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Student:</span>
            <span className="font-bold text-slate-800">{record.student_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Admission No:</span>
            <span className="font-mono text-slate-700">{record.admission_no}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Fee Title / Batch:</span>
            <span className="font-semibold text-slate-800">{record.title} • {record.batch_name}</span>
          </div>
          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between font-['Manrope'] text-sm">
            <span className="font-bold text-slate-700">Outstanding Balance:</span>
            <span className="font-extrabold text-rose-600">
              ₹{record.balance_due.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Payment Amount Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Payment Amount (₹) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
            <input
              type="number"
              min="1"
              max={record.balance_due}
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
              className="w-full pl-8 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f]"
            />
          </div>
          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
            <span>Enter partial amount or leave full balance</span>
            <button
              type="button"
              onClick={() => setAmount(record.balance_due)}
              className="text-[#16466f] font-semibold hover:underline"
            >
              Full Balance (₹{record.balance_due.toLocaleString('en-IN')})
            </button>
          </div>
        </div>

        {/* Payment Mode Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Payment Mode <span className="text-rose-500">*</span>
          </label>
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
            className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f]"
          >
            <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
            <option value="cash">Cash in Hand</option>
            <option value="bank_transfer">Direct Bank Transfer (NEFT/IMPS)</option>
            <option value="cheque">Cheque</option>
            <option value="card">Debit / Credit Card</option>
          </select>
        </div>

        {/* Transaction Reference */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Transaction Reference / Cheque No. {paymentMode !== 'cash' && <span className="text-slate-400">(Recommended)</span>}
          </label>
          <input
            type="text"
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
            placeholder={paymentMode === 'upi' ? 'e.g. UPI Ref / UTR number' : paymentMode === 'cheque' ? 'Cheque No. & Bank Name' : 'Transaction / Slip ID'}
            className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f]"
          />
        </div>

        {/* Internal Note */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Remark / Notes <span className="text-slate-400">(Optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Collected by front desk, parent promised remainder on 10th..."
            className="w-full px-3 py-1.5 text-xs text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f]"
          />
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            isLoading={submitting}
            icon={<CreditCard size={14} />}
          >
            Confirm & Issue Receipt
          </Button>
        </div>
      </form>
    </Modal>
  );
};
