import React, { useState, useEffect } from "react";
import { 
  Briefcase, 
  Settings, 
  RefreshCw, 
  FileText,
  Sparkles
} from "lucide-react";
import { Button } from "../components/common";
import { SalaryConfigModal } from "../components/finance/SalaryConfigModal";
import { DisbursePayrollModal } from "../components/finance/DisbursePayrollModal";
import { SalarySlipModal } from "../components/finance/SalarySlipModal";
import { getTeacherSalaryConfigs, getTeacherPayrolls, generateMonthlyPayroll } from "../services/financeService";
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
    <div className="space-y-6 pb-12 font-['Inter']">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#102f50] text-amber-400">
              <Briefcase size={20} />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-['Manrope']">
              Teacher Payroll Management
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Faculty remuneration structures, monthly payroll sheets, disbursement settlements, and vouchers
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20 font-mono"
          />

          <Button
            variant="primary"
            size="sm"
            onClick={handleGeneratePayroll}
            isLoading={isGenerating}
            className="text-xs bg-[#102f50] hover:bg-[#16466f] text-white"
          >
            <Sparkles size={13} className="mr-1.5 text-amber-400" />
            Generate Sheets
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
            className="text-xs text-slate-600 border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw size={14} className={`mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchData} className="text-xs text-rose-700 border-rose-300">
            Retry
          </Button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Monthly Liability
          </span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1 font-['Manrope']">
            ₹{totalLiability.toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Month: {selectedMonth}</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Settled Outflow
          </span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1 font-['Manrope']">
            ₹{totalPaid.toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {payrolls.filter((p) => p.status === "paid").length} disbursements completed
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Pending Liabilities
          </span>
          <div className="text-2xl font-extrabold text-amber-600 mt-1 font-['Manrope']">
            ₹{totalPending.toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
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
                      </div>
                    </td>
                  </tr>
                ))}

                {payrolls.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <p className="text-xs text-slate-500">No payroll records generated for {selectedMonth}.</p>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleGeneratePayroll}
                          isLoading={isGenerating}
                          className="text-xs bg-[#102f50] hover:bg-[#16466f] text-white mt-1"
                        >
                          <Sparkles size={13} className="mr-1.5 text-amber-400" />
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
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Faculty Member</th>
                  <th className="py-3 px-4">Pay Model</th>
                  <th className="py-3 px-4 text-right">Base Salary (₹)</th>
                  <th className="py-3 px-4 text-right">Per-Lecture / Hourly Rate (₹)</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salaryConfigs.map((cfg) => (
                  <tr key={cfg.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {cfg.teacher_name}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {cfg.calculation_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                      ₹{Number(cfg.base_amount).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                      ₹{Number(cfg.per_lecture_rate).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingConfig(cfg)}
                        className="text-[11px] py-1 px-3 border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        <Settings size={12} className="mr-1 text-slate-400" />
                        Edit Rate
                      </Button>
                    </td>
                  </tr>
                ))}
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
    </div>
  );
};
