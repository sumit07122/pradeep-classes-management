import React, { useState, useEffect } from "react";
import {
  Receipt,
  PlusCircle,
  Search,
  RefreshCw,
  FileText,
  ExternalLink,
  Edit2,
  Trash2,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { Button, Modal } from "../components/common";
import { ExpenseModal } from "../components/finance/ExpenseModal";
import { ExpenseReversalModal } from "../components/finance/ExpenseReversalModal";
import { IncomeModal } from "../components/finance/IncomeModal";
import { IncomeReversalModal } from "../components/finance/IncomeReversalModal";
import {
  getExpenses,
  getIncomes,
  deleteExpense,
  deleteIncome,
  getExpenseReceiptSignedUrl,
} from "../services/financeService";
import { useAuth } from "../hooks/useAuth";
import type { InstituteExpense, InstituteIncome } from "../types/finance";

const EXPENSE_CATEGORIES: Record<string, string> = {
  all: "All Categories",
  rent: "Campus Rent",
  electricity_utilities: "Electricity & Utilities",
  internet_software: "Internet & Cloud Tech",
  stationery_supplies: "Stationery & Supplies",
  marketing_advertising: "Marketing & Ads",
  maintenance: "Repairs & Maintenance",
  teacher_payroll: "Teacher Payroll",
  other: "Other Operational",
};

const INCOME_CATEGORIES: Record<string, string> = {
  all: "All Inflow Sources",
  admission_fee: "Admission & Registration",
  study_material: "Books & Study Materials",
  student_fee: "Direct Student Fee Receipt",
  other: "Other Revenue",
};

export const Expenses: React.FC = () => {
  const { role } = useAuth();
  const canManage = role === "owner" || role === "admin" || role === "super_admin";

  const [activeTab, setActiveTab] = useState<"expenses" | "incomes">("expenses");

  // Expenses State
  const [expenses, setExpenses] = useState<InstituteExpense[]>([]);
  const [expenseLoading, setExpenseLoading] = useState(true);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [selectedExpenseCat, setSelectedExpenseCat] = useState<string>("all");
  const [selectedExpenseStatus, setSelectedExpenseStatus] = useState<string>("all");
  const [editingExpense, setEditingExpense] = useState<InstituteExpense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<InstituteExpense | null>(null);
  const [expenseReversalTarget, setExpenseReversalTarget] = useState<InstituteExpense | null>(null);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  // Incomes State
  const [incomes, setIncomes] = useState<InstituteIncome[]>([]);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const [incomeSearch, setIncomeSearch] = useState("");
  const [selectedIncomeCat, setSelectedIncomeCat] = useState<string>("all");
  const [selectedIncomeStatus, setSelectedIncomeStatus] = useState<string>("all");
  const [editingIncome, setEditingIncome] = useState<InstituteIncome | null>(null);
  const [deletingIncome, setDeletingIncome] = useState<InstituteIncome | null>(null);
  const [incomeReversalTarget, setIncomeReversalTarget] = useState<InstituteIncome | null>(null);
  const [isAddIncomeOpen, setIsAddIncomeOpen] = useState(false);

  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchExpenses = async () => {
    try {
      setExpenseLoading(true);
      setError(null);
      const data = await getExpenses();
      setExpenses(data);
    } catch (err: any) {
      console.error("Error loading expenses:", err);
      setError(err.message || "Failed to load expense ledger");
    } finally {
      setExpenseLoading(false);
    }
  };

  const fetchIncomes = async () => {
    try {
      setIncomeLoading(true);
      setError(null);
      const data = await getIncomes();
      setIncomes(data);
    } catch (err: any) {
      console.error("Error loading incomes:", err);
      setError(err.message || "Failed to load income ledger");
    } finally {
      setIncomeLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchIncomes();
  }, []);

  const handleViewReceipt = async (url: string) => {
    try {
      const signed = await getExpenseReceiptSignedUrl(url);
      window.open(signed, "_blank", "noopener,noreferrer");
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  // Delete Handlers
  const handleConfirmDeleteExpense = async () => {
    if (!deletingExpense) return;
    try {
      setIsActionSubmitting(true);
      await deleteExpense(deletingExpense.id);
      setNotice(`Expense of ₹${Number(deletingExpense.amount).toLocaleString("en-IN")} deleted successfully.`);
      setDeletingExpense(null);
      fetchExpenses();
    } catch (err: any) {
      setError(err.message || "Failed to delete expense record.");
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleConfirmDeleteIncome = async () => {
    if (!deletingIncome) return;
    try {
      setIsActionSubmitting(true);
      await deleteIncome(deletingIncome.id);
      setNotice(`Income entry of ₹${Number(deletingIncome.amount).toLocaleString("en-IN")} deleted successfully.`);
      setDeletingIncome(null);
      fetchIncomes();
    } catch (err: any) {
      setError(err.message || "Failed to delete income record.");
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Filtered Lists
  const filteredExpenses = expenses.filter((exp) => {
    const matchesSearch =
      (exp.description?.toLowerCase() || "").includes(expenseSearch.toLowerCase()) ||
      (exp.vendor_name?.toLowerCase() || "").includes(expenseSearch.toLowerCase()) ||
      exp.category.toLowerCase().includes(expenseSearch.toLowerCase());

    const matchesCategory =
      selectedExpenseCat === "all" || exp.category === selectedExpenseCat;

    const matchesStatus =
      selectedExpenseStatus === "all" || exp.status === selectedExpenseStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const filteredIncomes = incomes.filter((inc) => {
    const matchesSearch =
      (inc.description?.toLowerCase() || "").includes(incomeSearch.toLowerCase()) ||
      (inc.transaction_reference?.toLowerCase() || "").includes(incomeSearch.toLowerCase()) ||
      inc.source_type.toLowerCase().includes(incomeSearch.toLowerCase());

    const matchesCategory =
      selectedIncomeCat === "all" || inc.source_type === selectedIncomeCat;

    const matchesStatus =
      selectedIncomeStatus === "all" || inc.status === selectedIncomeStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalExpenseOutflow = filteredExpenses
    .filter((e) => e.status === "approved")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalIncomeInflow = filteredIncomes
    .filter((i) => i.status === "completed")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <div className="space-y-6 pb-12 font-['Inter']">
      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-emerald-900 font-bold ml-2">✕</button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-900 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#102f50] text-amber-400">
              <Receipt size={20} />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-['Manrope']">
              Institute Cash Ledger & Finance Operations
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage operational expenses, direct revenue inflows, receipts, edits, and audited reversals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchExpenses();
              fetchIncomes();
            }}
            disabled={expenseLoading || incomeLoading}
            className="text-xs text-slate-600 border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw size={14} className={`mr-1.5 ${expenseLoading || incomeLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {canManage && activeTab === "expenses" && (
            <Button
              size="sm"
              onClick={() => {
                setEditingExpense(null);
                setIsAddExpenseOpen(true);
              }}
              className="text-xs bg-[#102f50] hover:bg-[#163a60] text-white"
            >
              <PlusCircle size={15} className="mr-1.5 text-amber-300" />
              Record Expense
            </Button>
          )}

          {canManage && activeTab === "incomes" && (
            <Button
              size="sm"
              onClick={() => {
                setEditingIncome(null);
                setIsAddIncomeOpen(true);
              }}
              className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              <PlusCircle size={15} className="mr-1.5 text-amber-200" />
              Record Income
            </Button>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("expenses")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${activeTab === "expenses"
            ? "bg-[#102f50] text-white shadow-sm"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
        >
          <ArrowUpRight size={14} className={activeTab === "expenses" ? "text-amber-300" : "text-rose-600"} />
          Operational Expenses ({expenses.length})
        </button>

        <button
          onClick={() => setActiveTab("incomes")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${activeTab === "incomes"
            ? "bg-[#102f50] text-white shadow-sm"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
        >
          <ArrowDownLeft size={14} className={activeTab === "incomes" ? "text-emerald-300" : "text-emerald-600"} />
          Direct Incomes & Revenue ({incomes.length})
        </button>
      </div>

      {/* TAB 1: OPERATIONAL EXPENSES */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          {/* Summary Outflow Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Filtered Outflow</span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1 font-['Manrope']">
                ₹{totalExpenseOutflow.toLocaleString("en-IN")}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Entries</span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1 font-['Manrope']">
                {filteredExpenses.length} Records
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Audited Reversals</span>
              <div className="text-2xl font-extrabold text-rose-600 mt-1 font-['Manrope']">
                {expenses.filter((e) => e.status === "reversed").length} Reversed
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-72 relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search vendor, description..."
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedExpenseCat}
                onChange={(e) => setSelectedExpenseCat(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
              >
                {Object.entries(EXPENSE_CATEGORIES).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={selectedExpenseStatus}
                onChange={(e) => setSelectedExpenseStatus(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="reversed">Reversed</option>
              </select>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Vendor / Payee</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Receipt</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {exp.expense_date}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                          {EXPENSE_CATEGORIES[exp.category] || exp.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {exp.vendor_name || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate" title={exp.description || ""}>
                        {exp.description || "—"}
                      </td>
                      <td className="py-3.5 px-4 uppercase text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {exp.payment_method.replace("_", " ")}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {exp.receipt_url ? (
                          <button
                            type="button"
                            onClick={() => handleViewReceipt(exp.receipt_url!)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            <FileText size={13} />
                            View
                            <ExternalLink size={10} />
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 font-mono text-sm whitespace-nowrap">
                        ₹{Number(exp.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${exp.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                            }`}
                        >
                          {exp.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {exp.category === "teacher_payroll" ? (
                            <span
                              className="text-[10px] font-semibold text-slate-400 cursor-help"
                              title="Faculty payroll disbursements are managed through the Teacher Payroll sheet"
                            >
                              Payroll Linked
                            </span>
                          ) : (
                            <>
                              {canManage && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingExpense(exp);
                                      setIsAddExpenseOpen(true);
                                    }}
                                    className="p-1 text-slate-400 hover:text-[#16466f] transition"
                                    title="Edit Expense"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => setDeletingExpense(exp)}
                                    className="p-1 text-slate-400 hover:text-rose-600 transition"
                                    title="Delete Expense"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}

                              {exp.status === "approved" ? (
                                canManage && (
                                  <button
                                    onClick={() => setExpenseReversalTarget(exp)}
                                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline"
                                    title="Reverse transaction"
                                  >
                                    Reverse
                                  </button>
                                )
                              ) : (
                                <span
                                  className="text-[10px] text-slate-400 cursor-help"
                                  title={exp.reversal_reason || "Reversed transaction"}
                                >
                                  Reversed
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400">
                        No expense records matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DIRECT REVENUE INCOMES */}
      {activeTab === "incomes" && (
        <div className="space-y-4">
          {/* Summary Inflow Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Filtered Direct Revenue</span>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1 font-['Manrope']">
                ₹{totalIncomeInflow.toLocaleString("en-IN")}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Inflow Records</span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1 font-['Manrope']">
                {filteredIncomes.length} Records
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Audited Reversals</span>
              <div className="text-2xl font-extrabold text-rose-600 mt-1 font-['Manrope']">
                {incomes.filter((i) => i.status === "reversed").length} Reversed
              </div>
            </div>
          </div>

          {/* Incomes Filters Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-72 relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search description, reference..."
                value={incomeSearch}
                onChange={(e) => setIncomeSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedIncomeCat}
                onChange={(e) => setSelectedIncomeCat(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
              >
                {Object.entries(INCOME_CATEGORIES).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={selectedIncomeStatus}
                onChange={(e) => setSelectedIncomeStatus(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="reversed">Reversed</option>
              </select>
            </div>
          </div>

          {/* Incomes Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Description / Payer</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredIncomes.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {inc.income_date}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100">
                          {INCOME_CATEGORIES[inc.source_type] || inc.source_type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 max-w-sm truncate" title={inc.description || ""}>
                        {inc.description || "—"}
                      </td>
                      <td className="py-3.5 px-4 uppercase text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {inc.payment_method.replace("_", " ")}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {inc.transaction_reference || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-emerald-700 font-mono text-sm whitespace-nowrap">
                        +₹{Number(inc.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${inc.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                            }`}
                        >
                          {inc.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {canManage && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingIncome(inc);
                                  setIsAddIncomeOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-emerald-700 transition"
                                title="Edit Income"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => setDeletingIncome(inc)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition"
                                title="Delete Income"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}

                          {inc.status === "completed" ? (
                            canManage && (
                              <button
                                onClick={() => setIncomeReversalTarget(inc)}
                                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline"
                                title="Reverse transaction"
                              >
                                Reverse
                              </button>
                            )
                          ) : (
                            <span
                              className="text-[10px] text-slate-400 cursor-help"
                              title={inc.reversal_reason || "Reversed transaction"}
                            >
                              Reversed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredIncomes.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        No direct income records matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal (Add / Edit) */}
      <ExpenseModal
        isOpen={isAddExpenseOpen}
        initialData={editingExpense}
        onClose={() => {
          setIsAddExpenseOpen(false);
          setEditingExpense(null);
        }}
        onSuccess={fetchExpenses}
      />

      {/* Income Modal (Add / Edit) */}
      <IncomeModal
        isOpen={isAddIncomeOpen}
        initialData={editingIncome}
        onClose={() => {
          setIsAddIncomeOpen(false);
          setEditingIncome(null);
        }}
        onSuccess={fetchIncomes}
      />

      {/* Expense Reversal Modal */}
      <ExpenseReversalModal
        isOpen={!!expenseReversalTarget}
        expense={expenseReversalTarget}
        onClose={() => setExpenseReversalTarget(null)}
        onSuccess={fetchExpenses}
      />

      {/* Income Reversal Modal */}
      <IncomeReversalModal
        isOpen={!!incomeReversalTarget}
        income={incomeReversalTarget}
        onClose={() => setIncomeReversalTarget(null)}
        onSuccess={fetchIncomes}
      />

      {/* Delete Expense Modal */}
      {deletingExpense && (
        <Modal
          isOpen={!!deletingExpense}
          onClose={() => setDeletingExpense(null)}
          title="Delete Expense Record"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-bold text-sm text-rose-900">
                  Delete Expense of ₹{Number(deletingExpense.amount).toLocaleString("en-IN")}?
                </h4>
                <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                  Category: <b>{EXPENSE_CATEGORIES[deletingExpense.category] || deletingExpense.category}</b><br />
                  Description: {deletingExpense.description || "None"}<br />
                  This will permanently remove the record from the operational expense ledger.
                </p>
              </div>
            </div>

            <div className="modal-actions pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingExpense(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={isActionSubmitting}
                onClick={handleConfirmDeleteExpense}
                icon={<Trash2 size={15} />}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Income Modal */}
      {deletingIncome && (
        <Modal
          isOpen={!!deletingIncome}
          onClose={() => setDeletingIncome(null)}
          title="Delete Income Record"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-bold text-sm text-rose-900">
                  Delete Income Entry of ₹{Number(deletingIncome.amount).toLocaleString("en-IN")}?
                </h4>
                <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                  Source: <b>{INCOME_CATEGORIES[deletingIncome.source_type] || deletingIncome.source_type}</b><br />
                  Description: {deletingIncome.description || "None"}<br />
                  This will permanently remove the entry from the direct revenue ledger.
                </p>
              </div>
            </div>

            <div className="modal-actions pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingIncome(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={isActionSubmitting}
                onClick={handleConfirmDeleteIncome}
                icon={<Trash2 size={15} />}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
