import React, { useState, useEffect } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { Modal, Button, Badge, Input, LoadingSpinner, AlertNotice } from "../common";
import { feesService } from "../../services/feesService";
import type { FeeRecord, FeePayment } from "../../types/fees";

interface PaymentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: FeeRecord | null;
  onReversalSuccess?: () => void;
}

export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
  isOpen,
  onClose,
  record,
  onReversalSuccess,
}) => {
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reversingPaymentId, setReversingPaymentId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (record && isOpen) {
      loadHistory();
    }
  }, [record, isOpen]);

  const loadHistory = async () => {
    if (!record) return;
    setLoading(true);
    try {
      const history = await feesService.getPaymentHistory(record.id);
      setPayments(history);
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to load payment history");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingPaymentId || !reversalReason.trim()) {
      setErrorNotice("Please enter a valid reason for reversing this payment.");
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);

    const res = await feesService.reversePayment(reversingPaymentId, reversalReason.trim());
    setIsSubmitting(false);

    if (res.error) {
      setErrorNotice(res.error);
    } else {
      setSuccessNotice("Payment reversed successfully. Balance adjusted.");
      setReversingPaymentId(null);
      setReversalReason("");
      loadHistory();
      if (onReversalSuccess) onReversalSuccess();
    }
  };

  if (!isOpen || !record) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Payment History & Reversals — ${record.student_name}`}
    >
      <div className="space-y-4 max-h-[75vh] flex flex-col">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex justify-between">
          <div>
            <b>Invoice:</b> {record.title}
          </div>
          <div>
            <b>Billed:</b> ₹{record.amount.toLocaleString()} | <b>Paid:</b> ₹{record.paid_amount.toLocaleString()} |{" "}
            <b>Due:</b> ₹{record.balance_due.toLocaleString()}
          </div>
        </div>

        {errorNotice && (
          <AlertNotice
            type="error"
            message={errorNotice}
            onDismiss={() => setErrorNotice(null)}
          />
        )}

        {successNotice && (
          <AlertNotice
            type="success"
            message={successNotice}
            onDismiss={() => setSuccessNotice(null)}
          />
        )}

        {loading ? (
          <LoadingSpinner label="Loading transaction ledger..." size="md" />
        ) : (
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {payments.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                No installment payments logged for this invoice yet.
              </div>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{p.receipt_no}</span>
                      <Badge variant="blue" size="sm">
                        {p.payment_mode.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(p.created_at).toLocaleString()} {p.transaction_ref && `• Ref: ${p.transaction_ref}`}
                    </div>
                    {p.notes && <div className="text-[11px] text-slate-600 mt-1 italic">{p.notes}</div>}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm text-emerald-700">
                      ₹{p.amount.toLocaleString()}
                    </span>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-rose-600"
                      icon={<RotateCcw size={13} />}
                      onClick={() => {
                        setReversingPaymentId(p.id);
                        setErrorNotice(null);
                      }}
                      title="Reverse Payment"
                    >
                      Reverse
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Reversal Confirmation Panel */}
        {reversingPaymentId && (
          <form
            onSubmit={handleConfirmReversal}
            className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-3 text-xs"
          >
            <div className="flex items-start gap-2 text-rose-900 font-bold">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
              <span>Authorize Payment Reversal</span>
            </div>
            <p className="text-[11px] text-rose-800 leading-relaxed">
              This action appends an immutable reversal record to the ledger, generates a reversal reference, and reopens the student's pending balance.
            </p>

            <Input
              label="Reversal Reason (Required for Audit Trail)"
              required
              placeholder="e.g. Bank chargeback / Cheque dishonored / Erroneous amount"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReversingPaymentId(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="bg-rose-600 hover:bg-rose-700"
                isLoading={isSubmitting}
                icon={<RotateCcw size={13} />}
              >
                Confirm Reversal
              </Button>
            </div>
          </form>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
