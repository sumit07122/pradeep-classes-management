import React from "react";
import { TrendingUp, TrendingDown, DollarSign, Wallet, AlertCircle, ArrowUpRight } from "lucide-react";
import type { FinancialDashboardSummary } from "../../types/finance";

interface FinancialSummaryCardsProps {
  summary: FinancialDashboardSummary;
}

export const FinancialSummaryCards: React.FC<FinancialSummaryCardsProps> = ({ summary }) => {
  const collectionRate = summary.total_fees_billed > 0
    ? Math.round((summary.total_fees_collected / summary.total_fees_billed) * 100)
    : 0;

  const isSurplus = summary.net_operating_surplus >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {/* 1. Actual Fees Collected */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-['Inter']">Fees Collected</span>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <DollarSign size={20} />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-slate-900 font-['Manrope']">
            ₹{summary.total_fees_collected.toLocaleString("en-IN")}
          </span>
          <span className="text-xs font-bold text-emerald-600 flex items-center bg-emerald-50 px-2 py-0.5 rounded-full">
            <ArrowUpRight size={13} className="mr-0.5" />
            {collectionRate}%
          </span>
        </div>
        <div className="text-xs text-slate-500 mt-2">
          Total billed: ₹{summary.total_fees_billed.toLocaleString("en-IN")}
        </div>
      </div>

      {/* 2. Outstanding Student Dues */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-['Inter']">Outstanding Dues</span>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <AlertCircle size={20} />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-slate-900 font-['Manrope']">
          ₹{summary.outstanding_dues.toLocaleString("en-IN")}
        </div>
        <div className="text-xs text-slate-500 mt-2">
          Uncollected student installment balances
        </div>
      </div>

      {/* 3. Direct Other Income */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-['Inter']">Direct Incomes</span>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Wallet size={20} />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-slate-900 font-['Manrope']">
          ₹{summary.total_other_income.toLocaleString("en-IN")}
        </div>
        <div className="text-xs text-slate-500 mt-2">
          Study materials, registration & other income
        </div>
      </div>

      {/* 4. Total Institute Expenses */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-['Inter']">Institute Expenses</span>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <TrendingDown size={20} />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-slate-900 font-['Manrope']">
          ₹{summary.total_expenses.toLocaleString("en-IN")}
        </div>
        <div className="text-xs text-slate-500 mt-2">
          Rent, utilities, maintenance, supplies
        </div>
      </div>

      {/* 5. Faculty Payroll Outflow */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-['Inter']">Teacher Payroll</span>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Wallet size={20} />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-slate-900 font-['Manrope']">
          ₹{summary.total_teacher_salaries_paid.toLocaleString("en-IN")}
        </div>
        <div className="text-xs text-slate-500 mt-2">
          Faculty salaries & lecture fees settled
        </div>
      </div>

      {/* 6. Net Operating Result */}
      <div className={`rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow ${
        isSurplus ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30"
      }`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-['Inter']">
            Net Operating Result
          </span>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
            isSurplus ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
          }`}>
            {isSurplus ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
        </div>
        <div className={`text-2xl font-extrabold font-['Manrope'] ${
          isSurplus ? "text-emerald-700" : "text-rose-700"
        }`}>
          {isSurplus ? "+" : "-"}₹{Math.abs(summary.net_operating_surplus).toLocaleString("en-IN")}
        </div>
        <div className="text-xs text-slate-600 mt-2 font-medium">
          {isSurplus ? "Net surplus after all recorded operational expenses" : "Net operating deficit (expenses exceed revenue)"}
        </div>
      </div>
    </div>
  );
};
