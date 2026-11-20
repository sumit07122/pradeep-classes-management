import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Receipt, 
  Briefcase, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp
} from "lucide-react";
import { Button } from "../components/common";
import { FinancialSummaryCards } from "../components/finance/FinancialSummaryCards";
import { CashFlowChart } from "../components/finance/CashFlowChart";
import { ExpenseCategoryPie } from "../components/finance/ExpenseCategoryPie";
import { getFinancialDashboard, getIncomes, getExpenses } from "../services/financeService";
import type { FinancialDashboardSummary, InstituteIncome, InstituteExpense } from "../types/finance";

export const FinanceDashboard: React.FC = () => {
  const [summary, setSummary] = useState<FinancialDashboardSummary | null>(null);
  const [recentIncomes, setRecentIncomes] = useState<InstituteIncome[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<InstituteExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "incomes" | "expenses">("all");

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [dashSummary, incomes, expenses] = await Promise.all([
        getFinancialDashboard(),
        getIncomes(),
        getExpenses(),
      ]);
      setSummary(dashSummary);
      setRecentIncomes(incomes.slice(0, 10));
      setRecentExpenses(expenses.slice(0, 10));
    } catch (err: any) {
      console.error("Error loading financial dashboard:", err);
      setError(err.message || "Failed to load financial records");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 pb-12 font-['Inter']">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#102f50] text-amber-400">
              <TrendingUp size={20} />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-['Manrope']">
              Institute Finance & Business Analytics
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time operating income, expense audits, and teacher payroll oversight for Pradeep Classes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="text-xs text-slate-600 border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw size={14} className={`mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Link to="/finance/expenses">
            <Button variant="outline" size="sm" className="text-xs text-slate-700 border-slate-300 hover:bg-slate-50">
              <Receipt size={14} className="mr-1.5 text-slate-500" />
              Expense Ledger
            </Button>
          </Link>

          <Link to="/finance/payroll">
            <Button size="sm" className="text-xs bg-[#102f50] hover:bg-[#163a60] text-white">
              <Briefcase size={14} className="mr-1.5 text-amber-300" />
              Teacher Payroll
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={loadData} className="text-xs text-rose-700 border-rose-300">
            Retry
          </Button>
        </div>
      )}

      {/* Financial KPI Cards */}
      {summary && <FinancialSummaryCards summary={summary} />}

      {/* Visual Analytics Charts */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CashFlowChart trends={summary.monthly_trends || []} />
          </div>
          <div>
            <ExpenseCategoryPie categories={summary.expenses_by_category || []} />
          </div>
        </div>
      )}

      {/* Recent Ledger Transactions */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-['Manrope']">Recent Ledger Transactions</h3>
            <p className="text-xs text-slate-500">Latest recorded income inflows and operational outflows</p>
          </div>

          <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Recent
            </button>
            <button
              onClick={() => setActiveTab("incomes")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "incomes" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Incomes
            </button>
            <button
              onClick={() => setActiveTab("expenses")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "expenses" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Expenses
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type / Category</th>
                <th className="py-3 px-4">Description / Payee</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Combine or filter rows */}
              {activeTab !== "expenses" &&
                recentIncomes.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600">{inc.income_date}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700">
                        <ArrowUpRight size={12} />
                        {inc.source_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      {inc.description || "Direct income"}
                    </td>
                    <td className="py-3 px-4 uppercase text-slate-500 font-mono text-[11px]">
                      {inc.payment_method.replace("_", " ")}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-emerald-600 font-mono">
                      +₹{Number(inc.amount).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                        {inc.status}
                      </span>
                    </td>
                  </tr>
                ))}

              {activeTab !== "incomes" &&
                recentExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600">{exp.expense_date}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700">
                        <ArrowDownRight size={12} />
                        {exp.category.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      {exp.vendor_name ? `${exp.vendor_name} — ` : ""}
                      {exp.description || "Operational expense"}
                    </td>
                    <td className="py-3 px-4 uppercase text-slate-500 font-mono text-[11px]">
                      {exp.payment_method.replace("_", " ")}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-rose-600 font-mono">
                      -₹{Number(exp.amount).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        exp.status === "approved" ? "bg-slate-100 text-slate-700" : "bg-rose-100 text-rose-800"
                      }`}>
                        {exp.status}
                      </span>
                    </td>
                  </tr>
                ))}

              {recentIncomes.length === 0 && recentExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No transactions recorded in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
