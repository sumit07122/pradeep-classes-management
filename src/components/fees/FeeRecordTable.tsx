import React from 'react';
import { Search, IndianRupee, FileText, CheckCircle2, MessageSquare } from 'lucide-react';
import { Badge, Button } from '../common';
import type { FeeRecord, FeeStatus } from '../../types/fees';

interface FeeRecordTableProps {
  records: FeeRecord[];
  statusFilter: FeeStatus | 'all';
  onStatusFilterChange: (status: FeeStatus | 'all') => void;
  searchTerm: string;
  onSearchChange: (q: string) => void;
  onCollectPayment: (record: FeeRecord) => void;
  onViewReceipt: (record: FeeRecord) => void;
  onViewHistory?: (record: FeeRecord) => void;
  onSendWhatsAppReminder?: (record: FeeRecord) => void;
  canManageFees: boolean;
}

export const FeeRecordTable: React.FC<FeeRecordTableProps> = ({
  records,
  statusFilter,
  onStatusFilterChange,
  searchTerm,
  onSearchChange,
  onCollectPayment,
  onViewReceipt,
  onViewHistory,
  onSendWhatsAppReminder,
  canManageFees,
}) => {
  const filterTabs: { label: string; value: FeeStatus | 'all' }[] = [
    { label: 'All Records', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Partial', value: 'partial' },
    { label: 'Paid', value: 'paid' },
    { label: 'Overdue', value: 'overdue' },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 border-b border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/50">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onStatusFilterChange(tab.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === tab.value
                  ? 'bg-[#16466f] text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative max-w-xs w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by student, admission, receipt..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#16466f]"
          />
        </div>
      </div>

      {/* Records Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50 text-slate-600 font-semibold tracking-wider text-[11px] uppercase">
              <th className="py-3 px-4">Student & Admission</th>
              <th className="py-3 px-4">Batch & Title</th>
              <th className="py-3 px-4">Total Amount</th>
              <th className="py-3 px-4">Paid / Balance Due</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Receipt / Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  No fee records found matching your filter criteria.
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const isSettled = r.status === 'paid';
                const hasReceipt = Boolean(r.receipt_no);

                return (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Student */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{r.student_name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{r.admission_no}</div>
                    </td>

                    {/* Batch & Title */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 flex items-center gap-1.5 flex-wrap">
                        <span>{r.title}</span>
                        {r.is_historical && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                            Historical
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">{r.batch_name}</div>
                    </td>

                    {/* Total Amount */}
                    <td className="py-3 px-4 font-bold text-slate-900 font-['Manrope']">
                      ₹{r.amount.toLocaleString('en-IN')}
                    </td>

                    {/* Paid / Balance Due */}
                    <td className="py-3 px-4">
                      <div className="text-emerald-700 font-semibold">
                        ₹{r.paid_amount.toLocaleString('en-IN')} paid
                      </div>
                      {r.balance_due > 0 ? (
                        <div className="text-rose-600 text-[11px] font-semibold">
                          ₹{r.balance_due.toLocaleString('en-IN')} due
                        </div>
                      ) : (
                        <div className="text-slate-400 text-[11px] flex items-center gap-1">
                          <CheckCircle2 size={11} className="text-emerald-500" /> Settled
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          r.status === 'paid'
                            ? 'success'
                            : r.status === 'partial'
                            ? 'warning'
                            : r.status === 'overdue'
                            ? 'danger'
                            : 'info'
                        }
                        size="sm"
                        showDot
                      >
                        {r.status.toUpperCase()}
                      </Badge>
                    </td>

                    {/* Receipt / Date */}
                    <td className="py-3 px-4">
                      {r.receipt_no ? (
                        <span className="font-mono text-[11px] font-semibold text-indigo-700 block">
                          {r.receipt_no}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px] block">No receipt yet</span>
                      )}
                      <span className="text-[11px] text-slate-500">
                        {r.paid_date ? `Paid ${r.paid_date}` : `Due ${r.due_date}`}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManageFees && onViewHistory && (
                          <button
                            type="button"
                            onClick={() => onViewHistory(r)}
                            className="p-1.5 text-slate-400 hover:text-[#16466f] transition rounded"
                            title="Payment History & Reversals"
                          >
                            <IndianRupee size={13} />
                          </button>
                        )}

                        {hasReceipt && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onViewReceipt(r)}
                            icon={<FileText size={12} />}
                          >
                            Receipt
                          </Button>
                        )}

                        {canManageFees && !isSettled && onSendWhatsAppReminder && (
                          <button
                            type="button"
                            onClick={() => onSendWhatsAppReminder(r)}
                            className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition rounded"
                            title="Send WhatsApp Fee Reminder"
                          >
                            <MessageSquare size={13} />
                          </button>
                        )}

                        {canManageFees && !isSettled && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onCollectPayment(r)}
                            icon={<IndianRupee size={12} />}
                          >
                            Collect
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/30">
        <span>Showing {records.length} {records.length === 1 ? 'record' : 'records'}</span>
      </div>
    </div>
  );
};
