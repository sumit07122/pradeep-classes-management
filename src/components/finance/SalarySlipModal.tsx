import React from "react";
import { X, Printer, Award } from "lucide-react";
import { Button } from "../common";
import type { TeacherPayroll } from "../../types/finance";

interface SalarySlipModalProps {
  isOpen: boolean;
  payroll: TeacherPayroll | null;
  onClose: () => void;
}

export const SalarySlipModal: React.FC<SalarySlipModalProps> = ({
  isOpen,
  payroll,
  onClose,
}) => {
  if (!isOpen || !payroll) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-['Inter']">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="px-6 py-3 bg-[#102f50] text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider font-['Manrope']">
              Faculty Salary Slip
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} className="text-xs bg-white/10 hover:bg-white/20 text-white border-white/20">
              <Printer size={13} className="mr-1.5" />
              Print
            </Button>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Salary Voucher */}
        <div className="p-8 overflow-y-auto print:p-0 space-y-6 bg-white text-slate-900">
          {/* Institute Branding Header */}
          <div className="text-center pb-4 border-b-2 border-slate-900">
            <h2 className="text-xl font-extrabold uppercase tracking-tight text-[#102f50] font-['Manrope']">
              Pradeep Classes
            </h2>
            <p className="text-xs text-slate-600 font-medium">
              101, Vidya Complex, Near Station Road, Mumbai — 400001
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Official Faculty Remuneration Voucher
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 font-['Inter']">
            <div>
              <span className="text-slate-500">Employee Name:</span>
              <div className="font-bold text-slate-900 text-sm">{payroll.teacher_name}</div>
            </div>
            <div>
              <span className="text-slate-500">Department / Subject:</span>
              <div className="font-bold text-slate-900 text-sm">{payroll.teacher_subject || "Academics"}</div>
            </div>
            <div>
              <span className="text-slate-500">Payroll Month:</span>
              <div className="font-bold text-slate-900 font-mono">{payroll.payroll_month}</div>
            </div>
            <div>
              <span className="text-slate-500">Disbursement Status:</span>
              <div className="font-bold uppercase text-xs">
                <span className={`px-2 py-0.5 rounded-full ${
                  payroll.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}>
                  {payroll.status}
                </span>
              </div>
            </div>
            {payroll.payment_date && (
              <div>
                <span className="text-slate-500">Payment Date:</span>
                <div className="font-semibold text-slate-800 font-mono">{payroll.payment_date}</div>
              </div>
            )}
            {payroll.transaction_reference && (
              <div>
                <span className="text-slate-500">Transaction Reference:</span>
                <div className="font-semibold text-slate-800 font-mono">{payroll.transaction_reference}</div>
              </div>
            )}
          </div>

          {/* Earnings & Deductions Breakdown */}
          <div className="grid grid-cols-2 gap-6 text-xs">
            {/* Earnings */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-3 py-2 font-bold uppercase tracking-wider text-slate-700 text-[10px]">
                Earnings (INR)
              </div>
              <div className="divide-y divide-slate-100 p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Base Salary</span>
                  <span className="font-mono font-bold">₹{Number(payroll.base_salary).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-600">Lecture Fees ({payroll.lecture_count} lectures)</span>
                  <span className="font-mono font-bold">₹{Number(payroll.lecture_amount).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-600">Special Allowances</span>
                  <span className="font-mono font-bold">₹{Number(payroll.allowances).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-600">Performance Bonus</span>
                  <span className="font-mono font-bold">₹{Number(payroll.bonus).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-3 py-2 font-bold uppercase tracking-wider text-slate-700 text-[10px]">
                Deductions (INR)
              </div>
              <div className="divide-y divide-slate-100 p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">TDS / Advance Adjustments</span>
                  <span className="font-mono font-bold">₹{Number(payroll.deductions).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between pt-1 text-slate-400">
                  <span>Other Deductions</span>
                  <span className="font-mono">₹0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Salary Banner */}
          <div className="p-4 rounded-xl bg-[#102f50] text-white flex justify-between items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Net Disbursed Compensation
              </span>
              <p className="text-[10px] text-slate-400">Total payable after allowances & deductions</p>
            </div>
            <div className="text-2xl font-extrabold font-mono text-amber-300">
              ₹{Number(payroll.net_amount).toLocaleString("en-IN")}
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-10 flex justify-between items-end text-xs text-slate-500">
            <div className="text-center">
              <div className="w-36 border-b border-slate-300 pb-1" />
              <span className="text-[10px] block mt-1">Authorized Signatory</span>
            </div>
            <div className="text-center">
              <div className="w-36 border-b border-slate-300 pb-1" />
              <span className="text-[10px] block mt-1">Faculty Member Signature</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
