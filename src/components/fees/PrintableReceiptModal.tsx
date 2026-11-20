import React from 'react';
import { Printer, CheckCircle } from 'lucide-react';
import { Modal, Button } from '../common';

interface PrintableReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: {
    receipt_no: string;
    student_name: string;
    admission_no: string;
    batch_name?: string;
    title: string;
    amount_paid: number;
    total_paid?: number;
    total_amount?: number;
    balance_due?: number;
    payment_mode?: string;
    payment_date?: string;
    transaction_ref?: string;
    notes?: string;
  } | null;
}

export const PrintableReceiptModal: React.FC<PrintableReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
}) => {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = receipt.payment_date || new Date().toISOString().split('T')[0];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Official Tuition Fee Receipt">
      <div className="space-y-4">
        {/* Printable Paper Canvas */}
        <div
          id="pradeep-receipt-paper"
          className="p-6 bg-white border-2 border-slate-200 rounded-xl shadow-sm text-slate-800 space-y-4 font-sans print:border-none print:shadow-none print:p-0"
        >
          {/* Header */}
          <div className="border-b-2 border-[#16466f] pb-3 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <div className="text-xl font-extrabold tracking-tight text-[#16466f] font-['Manrope']">
                PRADEEP CLASSES
              </div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Premier Coaching for JEE • NEET • Foundations
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle size={12} /> Payment Verified
              </span>
              <div className="text-xs font-mono font-bold text-slate-700 mt-1">
                {receipt.receipt_no}
              </div>
            </div>
          </div>

          {/* Meta Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                Student Name
              </span>
              <b className="font-bold text-slate-900 text-sm">{receipt.student_name}</b>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                Admission No.
              </span>
              <b className="font-mono text-slate-800 text-sm">{receipt.admission_no}</b>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                Enrolled Batch
              </span>
              <span className="font-semibold text-slate-800">{receipt.batch_name || 'Class Batch'}</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                Date of Payment
              </span>
              <span className="font-semibold text-slate-800">{formattedDate}</span>
            </div>
          </div>

          {/* Fee Itemization Table */}
          <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">Payment Mode</th>
                <th className="py-2.5 px-3 text-right">Amount Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2.5 px-3">
                  <div className="font-bold text-slate-800">{receipt.title}</div>
                  {receipt.transaction_ref && (
                    <div className="text-[11px] text-slate-500 font-mono">
                      Ref: {receipt.transaction_ref}
                    </div>
                  )}
                  {receipt.notes && (
                    <div className="text-[11px] text-slate-500 italic mt-0.5">
                      Note: {receipt.notes}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right uppercase font-semibold text-slate-600">
                  {receipt.payment_mode || 'Cash'}
                </td>
                <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 font-['Manrope'] text-sm">
                  ₹{receipt.amount_paid.toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Dues Summary Box */}
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs space-y-1">
            {receipt.total_amount !== undefined && (
              <div className="flex justify-between text-slate-600">
                <span>Total Invoiced Fee:</span>
                <span className="font-semibold">₹{receipt.total_amount.toLocaleString('en-IN')}</span>
              </div>
            )}
            {receipt.total_paid !== undefined && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Total Accumulated Payments:</span>
                <span>₹{receipt.total_paid.toLocaleString('en-IN')}</span>
              </div>
            )}
            {receipt.balance_due !== undefined && (
              <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-200">
                <span>Remaining Balance Due:</span>
                <span className={receipt.balance_due > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                  {receipt.balance_due > 0 ? `₹${receipt.balance_due.toLocaleString('en-IN')}` : 'Nil (Full Settled)'}
                </span>
              </div>
            )}
          </div>

          {/* Signatures & Verification */}
          <div className="pt-4 border-t border-dashed border-slate-300 flex items-end justify-between text-[10px] text-slate-500">
            <div>
              <p>• Official computer-generated receipt.</p>
              <p>• Fees once paid are non-refundable & non-transferable.</p>
              <p>• Subject to Pradeep Classes terms of enrollment.</p>
            </div>
            <div className="text-center">
              <div className="h-10 border-b border-slate-400 w-32 mb-1"></div>
              <span className="font-bold uppercase tracking-wider text-[9px] text-slate-600">
                Authorized Cashier
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            icon={<Printer size={14} />}
          >
            Print / Save Receipt
          </Button>
        </div>
      </div>
    </Modal>
  );
};
