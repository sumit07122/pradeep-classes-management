import React from "react";
import type { MonthlyTrendPoint } from "../../types/finance";

interface CashFlowChartProps {
  trends: MonthlyTrendPoint[];
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ trends }) => {
  const maxVal = Math.max(
    ...trends.map((t) => Math.max(t.income, t.expense)),
    10000
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-bold text-slate-900 font-['Manrope']">Monthly Cash Flow Trend</h3>
          <p className="text-xs text-slate-500">6-month comparison of total income vs institute expenses</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" />
            <span className="text-slate-600">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-rose-500 inline-block" />
            <span className="text-slate-600">Expenses</span>
          </div>
        </div>
      </div>

      <div className="h-56 flex items-end justify-between gap-3 pt-6 pb-2 border-b border-slate-100">
        {trends.map((t, idx) => {
          const incHeight = Math.round((t.income / maxVal) * 100);
          const expHeight = Math.round((t.expense / maxVal) * 100);

          return (
            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
              <div className="w-full flex items-end justify-center gap-1.5 h-full">
                {/* Income bar */}
                <div
                  style={{ height: `${Math.max(incHeight, 4)}%` }}
                  className="w-4 sm:w-6 bg-emerald-500 rounded-t-md transition-all group-hover:bg-emerald-600 relative"
                  title={`Income: ₹${t.income.toLocaleString("en-IN")}`}
                />
                {/* Expense bar */}
                <div
                  style={{ height: `${Math.max(expHeight, 4)}%` }}
                  className="w-4 sm:w-6 bg-rose-500 rounded-t-md transition-all group-hover:bg-rose-600 relative"
                  title={`Expense: ₹${t.expense.toLocaleString("en-IN")}`}
                />
              </div>
              <span className="text-[11px] font-semibold text-slate-500 mt-2 font-mono">
                {t.month}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between items-center text-[11px] text-slate-400 mt-3 font-mono">
        <span>0</span>
        <span>Peak: ₹{maxVal.toLocaleString("en-IN")}</span>
      </div>
    </div>
  );
};
