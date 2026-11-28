import React, { useState, useEffect } from "react";
import { History, IndianRupee, FileText, CheckCircle2, Search } from "lucide-react";
import { Modal, Button, Input, AlertNotice } from "../common";
import { feesService } from "../../services/feesService";
import { supabase } from "../../lib/supabase";

interface HistoricalFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface StudentOption {
  id: string;
  full_name: string;
  admission_no: string;
  batch_name?: string;
}

export const HistoricalFeeModal: React.FC<HistoricalFeeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  
  const [period, setPeriod] = useState("October 2026");
  const [customPeriod, setCustomPeriod] = useState("");
  const [paidDate, setPaidDate] = useState("2026-10-15");
  const [amount, setAmount] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "cheque" | "bank_transfer">("cash");
  const [notes, setNotes] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStudents();
      // Generate a suggested historical receipt prefix
      setReceiptNo(`HIST-${Date.now().toString().slice(-6)}`);
    }
  }, [isOpen]);

  const loadStudents = async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from("students")
        .select("id, full_name, admission_no, batch_name")
        .eq("status", "active")
        .order("full_name", { ascending: true });
      setStudents(data || []);
    } catch (err) {
      console.error("Failed to load students for historical fees:", err);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.admission_no.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setError("Please select a student.");
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError("Please enter a valid fee amount.");
      return;
    }

    if (!receiptNo.trim()) {
      setError("Please provide a receipt or reference number.");
      return;
    }

    const finalPeriod = period === "Custom" ? customPeriod.trim() : period;
    if (!finalPeriod) {
      setError("Please specify the historical academic period.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const res = await feesService.recordHistoricalPayment({
        student_id: selectedStudentId,
        amount: numericAmount,
        paid_date: paidDate,
        historical_period: finalPeriod,
        receipt_no: receiptNo.trim(),
        payment_mode: paymentMode,
        notes: notes.trim() || undefined,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to record payment.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred while saving the record.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Prior Historical Fee Payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
          <History size={16} className="text-amber-600 shrink-0" />
          <span>
            Use this administrative entry to record physical cash books or past offline receipts
            collected prior to the ERP deployment. These records are marked with an audited <strong>HISTORICAL</strong> badge.
          </span>
        </div>

        {error && <AlertNotice type="error" message={error} onDismiss={() => setError(null)} />}

        {/* Student Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Enrolled Student <span className="text-rose-500">*</span>
          </label>
          <div className="relative mb-1">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name or admission number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
            />
          </div>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            required
            className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20 max-h-32"
          >
            <option value="">-- Choose Student ({filteredStudents.length} available) --</option>
            {filteredStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.admission_no}) - {s.batch_name}
              </option>
            ))}
          </select>
        </div>

        {/* Period & Payment Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Historical Month / Period <span className="text-rose-500">*</span>
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
            >
              <option value="October 2026">October 2026</option>
              <option value="September 2026">September 2026</option>
              <option value="August 2026">August 2026</option>
              <option value="July 2026">July 2026</option>
              <option value="June 2026">June 2026</option>
              <option value="Admission Session Fee 2025-2026">Admission Session Fee 2025-2026</option>
              <option value="Custom">Custom Period / Term...</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Historical Payment Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20 font-mono"
            />
          </div>
        </div>

        {period === "Custom" && (
          <Input
            label="Custom Period Description"
            placeholder="e.g. Quarter 1 Advance / Summer Crash Course"
            required
            value={customPeriod}
            onChange={(e) => setCustomPeriod(e.target.value)}
          />
        )}

        {/* Amount & Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Fee Amount Paid (₹)"
            type="number"
            min="1"
            step="1"
            required
            placeholder="e.g. 1500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            icon={<IndianRupee size={14} />}
          />

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Payment Method <span className="text-rose-500">*</span>
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as any)}
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
            >
              <option value="cash">Cash Counter</option>
              <option value="upi">UPI / QR Code</option>
              <option value="cheque">Bank Cheque</option>
              <option value="bank_transfer">Direct Bank Transfer</option>
            </select>
          </div>
        </div>

        {/* Receipt Number & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Historical Receipt / Voucher Number"
            required
            placeholder="e.g. BOOK-1 #045"
            value={receiptNo}
            onChange={(e) => setReceiptNo(e.target.value)}
            icon={<FileText size={14} />}
          />

          <Input
            label="Internal Settlement Remarks"
            placeholder="e.g. Verified from offline diary"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isLoading}
            className="bg-[#102f50] hover:bg-[#16466f]"
          >
            <CheckCircle2 size={14} className="mr-1.5 text-emerald-400" />
            Save Historical Record
          </Button>
        </div>
      </form>
    </Modal>
  );
};
