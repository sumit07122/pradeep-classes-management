import React, { useState, useEffect } from "react";
import { Plus, Download, RefreshCw, MessageSquare, Layers, Users, History } from "lucide-react";
import { Button, AlertNotice, LoadingSpinner, EmptyState } from "../components/common";
import {
  FeeStatsSummary,
  FeeRecordTable,
  CollectFeeModal,
  CreateInvoiceModal,
  PrintableReceiptModal,
  PaymentHistoryModal,
  FeeStructuresModal,
  BatchInvoiceModal,
} from "../components/fees";
import { HistoricalFeeModal } from "../components/fees/HistoricalFeeModal";
import { WhatsAppNotificationModal, type NotificationTarget } from "../components/whatsapp/WhatsAppNotificationModal";
import { feesService } from "../services/feesService";
import { useAuth } from "../hooks/useAuth";
import type { FeeRecord, FeeSummary, FeeStatus } from "../types/fees";

export const Fees: React.FC = () => {
  const { role } = useAuth();
  const canManageFees = role === "owner" || role === "admin" || role === "super_admin" || (role as string) === "accountant";

  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [summary, setSummary] = useState<FeeSummary>({
    total_billed: 0,
    total_collected: 0,
    total_pending: 0,
    collection_percentage: 0,
    overdue_invoices_count: 0,
    pending_students_count: 0,
  });

  const [statusFilter, setStatusFilter] = useState<FeeStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Modal States
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [isFeeStructuresOpen, setIsFeeStructuresOpen] = useState(false);
  const [isBatchInvoiceOpen, setIsBatchInvoiceOpen] = useState(false);
  const [isHistoricalFeeOpen, setIsHistoricalFeeOpen] = useState(false);
  const [collectRecord, setCollectRecord] = useState<FeeRecord | null>(null);
  const [historyRecord, setHistoryRecord] = useState<FeeRecord | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);
  const [whatsappModalData, setWhatsappModalData] = useState<{
    isOpen: boolean;
    targets: NotificationTarget[];
  }>({
    isOpen: false,
    targets: [],
  });

  const handleSendSingleFeeReminder = (record: FeeRecord) => {
    setWhatsappModalData({
      isOpen: true,
      targets: [
        {
          student_id: record.student_id,
          student_name: record.student_name || "Student",
          batch_name: record.batch_name,
          amount_due: record.balance_due,
          fee_title: record.title,
          phone: record.student_phone,
          parent_name: record.parent_name,
          parent_phone: record.parent_phone,
          record_id: record.id,
        },
      ],
    });
  };

  const handleSendBulkFeeReminders = () => {
    const pendingRecords = records.filter((r) => r.balance_due > 0);
    if (pendingRecords.length === 0) return;
    setWhatsappModalData({
      isOpen: true,
      targets: pendingRecords.map((r) => ({
        student_id: r.student_id,
        student_name: r.student_name || "Student",
        batch_name: r.batch_name,
        amount_due: r.balance_due,
        fee_title: r.title,
        phone: r.student_phone,
        parent_name: r.parent_name,
        parent_phone: r.parent_phone,
        record_id: r.id,
      })),
    });
  };

  useEffect(() => {
    loadFeesData();
  }, [statusFilter]);

  const loadFeesData = async () => {
    setLoading(true);
    try {
      const [recordsRes, summaryRes] = await Promise.all([
        feesService.getFeeRecords({
          status: statusFilter,
          query: searchTerm,
        }),
        feesService.getFeeSummary(),
      ]);

      setRecords(recordsRes.data);
      setSummary(summaryRes);
    } catch (err: any) {
      console.error("Failed to load fee ledger:", err);
      setNotice({ type: "error", message: "Failed to load fee ledger from database." });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (q: string) => {
    setSearchTerm(q);
  };

  // Filter client-side on searchTerm as well
  const displayedRecords = records.filter((r) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.student_name?.toLowerCase().includes(q) ||
      r.admission_no?.toLowerCase().includes(q) ||
      r.receipt_no?.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.batch_name?.toLowerCase().includes(q)
    );
  });

  const handlePaymentSuccess = (receiptData: any) => {
    setNotice({
      type: "success",
      message: `Payment of ₹${receiptData.amount_paid.toLocaleString("en-IN")} collected successfully. Receipt: ${receiptData.receipt_no}`,
    });
    // Open receipt modal for printing
    setActiveReceipt(receiptData);
    loadFeesData();
  };

  const handleViewReceipt = (record: FeeRecord) => {
    setActiveReceipt({
      receipt_no: record.receipt_no || "REC-2026-0000",
      student_name: record.student_name || "Student",
      admission_no: record.admission_no || "PC-2026-XXXX",
      batch_name: record.batch_name,
      title: record.title,
      amount_paid: record.paid_amount,
      total_paid: record.paid_amount,
      total_amount: record.amount,
      balance_due: record.balance_due,
      payment_mode: record.payment_mode || "Cash",
      payment_date: record.paid_date || record.due_date,
      transaction_ref: record.transaction_ref || undefined,
      notes: record.notes || undefined,
    });
  };

  const handleExportCsv = () => {
    feesService.exportFeeLedgerCsv(displayedRecords);
  };

  return (
    <div className="space-y-5">
      {notice && (
        <AlertNotice
          type={notice.type}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}

      {/* Top Welcome & Actions */}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">FINANCIAL MANAGEMENT & ACCOUNTS</div>
          <h1>Fee Collection & Tuition Ledger</h1>
          <p>
            Track student tuition invoices, record cash/online payments, and issue official Pradeep Classes receipts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageFees && records.some((r) => r.balance_due > 0) && (
            <Button
              variant="outline"
              onClick={handleSendBulkFeeReminders}
              icon={<MessageSquare size={14} className="text-emerald-600" />}
              className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            >
              Remind Pending
            </Button>
          )}

          <Button
            variant="outline"
            onClick={loadFeesData}
            icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
          >
            Refresh
          </Button>

          {displayedRecords.length > 0 && (
            <Button
              variant="outline"
              onClick={handleExportCsv}
              icon={<Download size={15} />}
            >
              Export CSV
            </Button>
          )}

          {canManageFees && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsFeeStructuresOpen(true)}
                icon={<Layers size={14} className="text-amber-600" />}
              >
                Fee Plans
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsHistoricalFeeOpen(true)}
                icon={<History size={14} className="text-amber-700" />}
                className="border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100"
              >
                Record Historical
              </Button>
              <Button
                variant="secondary"
                onClick={() => setIsBatchInvoiceOpen(true)}
                icon={<Users size={14} className="text-blue-600" />}
              >
                Batch Invoicing
              </Button>
              <Button
                variant="primary"
                onClick={() => setIsCreateInvoiceOpen(true)}
                icon={<Plus size={16} />}
              >
                Issue Invoice
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <FeeStatsSummary summary={summary} />

      {/* Fee Table or Empty State */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80">
          <LoadingSpinner size="lg" />
          <span className="mt-3 text-xs text-slate-500 font-medium">Loading institute fee ledger...</span>
        </div>
      ) : records.length === 0 && !searchTerm && statusFilter === "all" ? (
        <EmptyState
          title="No Fee Records Yet"
          description="Start issuing tuition fee invoices to enrolled students to track collections and generate receipts."
          actionLabel={canManageFees ? "Issue First Fee Invoice" : undefined}
          onAction={canManageFees ? () => setIsCreateInvoiceOpen(true) : undefined}
        />
      ) : (
        <FeeRecordTable
          records={displayedRecords}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          onCollectPayment={(rec) => setCollectRecord(rec)}
          onViewReceipt={handleViewReceipt}
          onViewHistory={(rec) => setHistoryRecord(rec)}
          onSendWhatsAppReminder={handleSendSingleFeeReminder}
          canManageFees={canManageFees}
        />
      )}

      {/* Modals */}
      <CollectFeeModal
        isOpen={Boolean(collectRecord)}
        onClose={() => setCollectRecord(null)}
        record={collectRecord}
        onSuccess={handlePaymentSuccess}
      />

      <PaymentHistoryModal
        isOpen={Boolean(historyRecord)}
        onClose={() => setHistoryRecord(null)}
        record={historyRecord}
        onReversalSuccess={() => {
          setNotice({ type: "success", message: "Fee payment reversed and ledger adjusted." });
          loadFeesData();
        }}
      />

      <CreateInvoiceModal
        isOpen={isCreateInvoiceOpen}
        onClose={() => setIsCreateInvoiceOpen(false)}
        onSuccess={() => {
          setNotice({ type: "success", message: "Fee invoice issued successfully." });
          loadFeesData();
        }}
      />

      <PrintableReceiptModal
        isOpen={Boolean(activeReceipt)}
        onClose={() => setActiveReceipt(null)}
        receipt={activeReceipt}
      />

      <FeeStructuresModal
        isOpen={isFeeStructuresOpen}
        onClose={() => setIsFeeStructuresOpen(false)}
        onStructuresUpdated={() => {
          loadFeesData();
        }}
      />

      <BatchInvoiceModal
        isOpen={isBatchInvoiceOpen}
        onClose={() => setIsBatchInvoiceOpen(false)}
        onInvoicesGenerated={() => {
          setNotice({ type: "success", message: "Batch fee invoices generated successfully." });
          loadFeesData();
        }}
      />

      <HistoricalFeeModal
        isOpen={isHistoricalFeeOpen}
        onClose={() => setIsHistoricalFeeOpen(false)}
        onSuccess={() => {
          setNotice({ type: "success", message: "Prior historical fee payment recorded successfully." });
          loadFeesData();
        }}
      />

      {/* WhatsApp One-Click Fee Reminder Modal */}
      <WhatsAppNotificationModal
        isOpen={whatsappModalData.isOpen}
        onClose={() => setWhatsappModalData((prev) => ({ ...prev, isOpen: false }))}
        type="fee_reminder"
        targets={whatsappModalData.targets}
        onSuccess={(count) => {
          setNotice({
            type: "success",
            message: `${count} WhatsApp fee reminder(s) queued for dispatch.`,
          });
        }}
      />
    </div>
  );
};
