import React, { useState, useEffect } from "react";
import { 
  Briefcase, 
  Settings, 
  RefreshCw, 
  FileText,
  Calculator,
  Layers,
  Trash2,
  Users,
  CheckCircle2
} from "lucide-react";
import { Button, Modal } from "../components/common";
import { SalaryConfigModal } from "../components/finance/SalaryConfigModal";
import { DisbursePayrollModal } from "../components/finance/DisbursePayrollModal";
import { SalarySlipModal } from "../components/finance/SalarySlipModal";
import { getTeacherSalaryConfigs, getTeacherPayrolls, generateMonthlyPayroll, deleteTeacherPayroll } from "../services/financeService";
import type { TeacherSalaryConfig, TeacherPayroll as TeacherPayrollRecord } from "../types/finance";

export const TeacherPayroll: React.FC = () => {
  const currentMonthStr = new Date().toISOString().substring(0, 7); // 'YYYY-MM'
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [activeTab, setActiveTab] = useState<"payroll" | "configs">("payroll");

  const [payrolls, setPayrolls] = useState<TeacherPayrollRecord[]>([]);
  const [salaryConfigs, setSalaryConfigs] = useState<TeacherSalaryConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [editingConfig, setEditingConfig] = useState<TeacherSalaryConfig | null>(null);
  const [disbursingPayroll, setDisbursingPayroll] = useState<TeacherPayrollRecord | null>(null);
  const [slipPayroll, setSlipPayroll] = useState<TeacherPayrollRecord | null>(null);
  const [deletingPayroll, setDeletingPayroll] = useState<TeacherPayrollRecord | null>(null);
  const [isDeletingPayroll, setIsDeletingPayroll] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleGeneratePayroll = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setSuccessMessage(null);
      const res = await generateMonthlyPayroll(selectedMonth);
      setSuccessMessage(`Processed payroll generation for ${selectedMonth} (${res.generated_count} new sheets created).`);
      await fetchData();
    } catch (err: any) {
      console.error("Error generating payroll:", err);
      setError(err.message || "Failed to generate monthly payroll sheets");
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [payrollData, configData] = await Promise.all([
        getTeacherPayrolls(selectedMonth),
        getTeacherSalaryConfigs(),
      ]);
      setPayrolls(payrollData);
      setSalaryConfigs(configData);
    } catch (err: any) {
      console.error("Error fetching payroll data:", err);
      setError(err.message || "Failed to load faculty payroll data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const totalLiability = payrolls.reduce((sum, p) => sum + Number(p.net_amount), 0);
  const totalPaid = payrolls
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.net_amount), 0);
  const totalPending = payrolls
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + Number(p.net_amount), 0);

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#102f50] text-amber-400 shadow-sm shrink-0">
              <Briefcase size={20} />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight font-display">
                Teacher Payroll Management
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Faculty remuneration structures, monthly payroll sheets, disbursement settlements, and vouchers
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20 font-mono shadow-xs"
          />

          <Button
            variant="primary"
            size="sm"
            onClick={handleGeneratePayroll}
            isLoading={isGenerating}
            className="text-xs shadow-sm"
          >
            <Calculator size={14} className="mr-1.5 opacity-80" />
            Generate Sheets
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
            className="text-xs text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw size={13} className={`mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between shadow-xs">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchData} className="text-xs text-rose-700 border-rose-300">
            Retry
          </Button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Total Monthly Liability
          </span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1 font-display">
            ₹{totalLiability.toLocaleString("en-IN")}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Month: {selectedMonth}</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Settled Outflow
          </span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1 font-display">
            ₹{totalPaid.toLocaleString("en-IN")}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {payrolls.filter((p) => p.status === "paid").length} disbursements completed
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Pending Liabilities
          </span>
          <div className="text-2xl font-extrabold text-amber-600 mt-1 font-display">
            ₹{totalPending.toLocaleString("en-IN")}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {payrolls.filter((p) => p.status === "pending").length} teachers awaiting settlement
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("payroll")}
          className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 ${
            activeTab === "payroll"
              ? "border-[#102f50] text-[#102f50]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Monthly Payroll Sheets ({selectedMonth})
        </button>
        <button
          onClick={() => setActiveTab("configs")}
          className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 ${
            activeTab === "configs"
              ? "border-[#102f50] text-[#102f50]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Faculty Salary Configurations ({salaryConfigs.length})
        </button>
      </div>

      {/* Tab 1: Monthly Payroll Sheets */}
      {activeTab === "payroll" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Faculty Member</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4 text-right">Base (₹)</th>
                  <th className="py-3 px-4 text-center">Lectures</th>
                  <th className="py-3 px-4 text-right">Lecture Amount (₹)</th>
                  <th className="py-3 px-4 text-right">Allowances</th>
                  <th className="py-3 px-4 text-right">Net Amount (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payrolls.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {p.teacher_name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {p.teacher_subject}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                      ₹{Number(p.base_salary).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold whitespace-nowrap">
                      {p.lecture_count}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                      ₹{Number(p.lecture_amount).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-600 whitespace-nowrap">
                      +₹{Number(p.allowances + p.bonus).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 font-mono text-sm whitespace-nowrap">
                      ₹{Number(p.net_amount).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          p.status === "paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        {p.status === "pending" ? (
                          <Button
                            size="sm"
                            onClick={() => setDisbursingPayroll(p)}
                            className="text-[11px] py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Disburse
                          </Button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Paid {p.payment_date}
                          </span>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSlipPayroll(p)}
                          className="text-[11px] py-1 px-2 border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                          <FileText size={12} className="mr-1" />
                          Slip
                        </Button>

                        <button
                          onClick={() => setDeletingPayroll(p)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Delete payroll sheet"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {payrolls.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shadow-inner">
                          <Layers size={22} className="text-[#102f50]" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">No Payroll Sheets for {selectedMonth}</h4>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Generate monthly compensation sheets from active faculty salary configurations and logged lectures.
                          </p>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleGeneratePayroll}
                          isLoading={isGenerating}
                          className="text-xs mt-1 shadow-sm"
                        >
                          <Calculator size={14} className="mr-1.5" />
                          Generate Payroll Sheets for {selectedMonth}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Salary Configurations */}
      {activeTab === "configs" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Faculty Member</th>
                  <th className="py-3 px-4">Pay Model</th>
                  <th className="py-3 px-4 text-right">Base Salary (₹)</th>
                  <th className="py-3 px-4 text-right">Per-Lecture / Hourly Rate (₹)</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salaryConfigs.map((cfg) => {
                  const isUnconfigured = cfg.id.startsWith("unconfigured-") || (Number(cfg.base_amount) === 0 && Number(cfg.per_lecture_rate) === 0);
                  return (
                    <tr key={cfg.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {cfg.teacher_name}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isUnconfigured ? (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">
                            Not Set
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wide">
                            {cfg.calculation_type.replace("_", " ")}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold whitespace-nowrap">
                        ₹{Number(cfg.base_amount).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold whitespace-nowrap">
                        ₹{Number(cfg.per_lecture_rate).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Button
                          variant={isUnconfigured ? "primary" : "outline"}
                          size="sm"
                          onClick={() => setEditingConfig(cfg)}
                          className="text-[11px] py-1 px-3 shadow-2xs"
                        >
                          <Settings size={12} className="mr-1 opacity-70" />
                          {isUnconfigured ? "Set Salary" : "Edit Rate"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {salaryConfigs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto gap-2">
                        <Users size={24} className="text-slate-400" />
                        <h4 className="text-sm font-bold text-slate-800">No Faculty Registered</h4>
                        <p className="text-xs text-slate-500">
                          Register faculty in the Teachers module to configure compensation models.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Salary Config Modal */}
      <SalaryConfigModal
        isOpen={!!editingConfig}
        config={editingConfig}
        onClose={() => setEditingConfig(null)}
        onSuccess={fetchData}
      />

      {/* Disburse Modal */}
      <DisbursePayrollModal
        isOpen={!!disbursingPayroll}
        payroll={disbursingPayroll}
        onClose={() => setDisbursingPayroll(null)}
        onSuccess={fetchData}
      />

      {/* Salary Slip Modal */}
      <SalarySlipModal
        isOpen={!!slipPayroll}
        payroll={slipPayroll}
        onClose={() => setSlipPayroll(null)}
      />

      {/* Delete Payroll Sheet Modal */}
      {deletingPayroll && (
        <Modal
          isOpen={Boolean(deletingPayroll)}
          onClose={() => setDeletingPayroll(null)}
          title="Delete Faculty Payroll Sheet"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Are you sure you want to permanently delete the payroll sheet for{" "}
              <strong>{deletingPayroll.teacher_name}</strong> for month{" "}
              <strong>{deletingPayroll.payroll_month}</strong> (₹{Number(deletingPayroll.net_amount).toLocaleString("en-IN")})?
            </p>
            {deletingPayroll.status === "paid" && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg">
                <strong>Notice:</strong> This record was marked as disbursed. Deleting it will also remove the corresponding expense ledger entry and reverse the liability.
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingPayroll(null)}
                disabled={isDeletingPayroll}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                isLoading={isDeletingPayroll}
                onClick={async () => {
                  try {
                    setIsDeletingPayroll(true);
                    await deleteTeacherPayroll(deletingPayroll.id);
                    setSuccessMessage(`Payroll record for ${deletingPayroll.teacher_name} deleted.`);
                    setDeletingPayroll(null);
                    await fetchData();
                  } catch (err: any) {
                    setError(err.message || "Failed to delete payroll sheet");
                  } finally {
                    setIsDeletingPayroll(false);
                  }
                }}
              >
                Delete Record
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
