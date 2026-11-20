import React, { useState, useEffect } from "react";
import { 
  Receipt, 
  PlusCircle, 
  Search, 
  RefreshCw, 
  FileText, 
  ExternalLink 
} from "lucide-react";
import { Button } from "../components/common";
import { ExpenseModal } from "../components/finance/ExpenseModal";
import { ExpenseReversalModal } from "../components/finance/ExpenseReversalModal";
import { getExpenses, getExpenseReceiptSignedUrl } from "../services/financeService";
import type { InstituteExpense } from "../types/finance";

const CATEGORY_NAMES: Record<string, string> = {
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

export const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<InstituteExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [reversalTarget, setReversalTarget] = useState<InstituteExpense | null>(null);

  const handleViewReceipt = async (url: string) => {
    try {
      const signed = await getExpenseReceiptSignedUrl(url);
      window.open(signed, "_blank", "noopener,noreferrer");
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getExpenses();
      setExpenses(data);
    } catch (err: any) {
      console.error("Error loading expenses:", err);
      setError(err.message || "Failed to load expense ledger");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const filteredExpenses = expenses.filter((exp) => {
    const matchesSearch =
      (exp.description?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (exp.vendor_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      exp.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" || exp.category === selectedCategory;

    const matchesStatus =
      selectedStatus === "all" || exp.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalOutflow = filteredExpenses
    .filter((e) => e.status === "approved")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-6 pb-12 font-['Inter']">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#102f50] text-amber-400">
              <Receipt size={20} />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-['Manrope']">
              Institute Expenses Ledger
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete operational expense records, supporting receipts, and audited reversals
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchExpenses}
            disabled={isLoading}
            className="text-xs text-slate-600 border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw size={14} className={`mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs bg-[#102f50] hover:bg-[#163a60] text-white"
          >
            <PlusCircle size={15} className="mr-1.5 text-amber-300" />
            Record Expense
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchExpenses} className="text-xs text-rose-700 border-rose-300">
            Retry
          </Button>
        </div>
      )}

      {/* Summary Outflow Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Filtered Outflow</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1 font-['Manrope']">
            ₹{totalOutflow.toLocaleString("en-IN")}
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#102f50]/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
          >
            {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
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
                      {CATEGORY_NAMES[exp.category] || exp.category}
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
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        exp.status === "approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {exp.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    {exp.status === "approved" ? (
                      exp.category === "teacher_payroll" ? (
                        <span
                          className="text-[10px] font-semibold text-slate-400 cursor-help"
                          title="Faculty salary disbursements are managed through the Teacher Payroll sheet"
                        >
                          Payroll Linked
                        </span>
                      ) : (
                        <button
                          onClick={() => setReversalTarget(exp)}
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
                        Reason
                      </span>
                    )}
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

      {/* Add Expense Modal */}
      <ExpenseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchExpenses}
      />

      {/* Expense Reversal Modal */}
      <ExpenseReversalModal
        isOpen={!!reversalTarget}
        expense={reversalTarget}
        onClose={() => setReversalTarget(null)}
        onSuccess={fetchExpenses}
      />
    </div>
  );
};
