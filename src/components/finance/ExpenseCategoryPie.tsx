import React from "react";
import type { CategoryBreakdown } from "../../types/finance";

interface ExpenseCategoryPieProps {
  categories: CategoryBreakdown[];
}

const CATEGORY_LABELS: Record<string, string> = {
  rent: "Campus Rent",
  electricity_utilities: "Electricity & Utilities",
  internet_software: "Internet & Cloud Tech",
  stationery_supplies: "Stationery & Supplies",
  marketing_advertising: "Marketing & Ads",
  maintenance: "Repairs & Maintenance",
  teacher_payroll: "Teacher Payroll",
  other: "Other Expenses",
};

const CATEGORY_COLORS = [
  "bg-blue-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-slate-400",
];

export const ExpenseCategoryPie: React.FC<ExpenseCategoryPieProps> = ({ categories }) => {
  const total = categories.reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-base font-bold text-slate-900 font-['Manrope']">Expense Distribution</h3>
        <p className="text-xs text-slate-500">Breakdown of operational outflows by category</p>
      </div>

      {categories.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-xs text-slate-400">
          No expenses recorded for this period
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((c, idx) => {
            const pct = total > 0 ? Math.round((Number(c.amount) / total) * 100) : 0;
            const colorClass = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">
                    {CATEGORY_LABELS[c.category] || c.category}
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    ₹{Number(c.amount).toLocaleString("en-IN")} ({pct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full rounded-full ${colorClass} transition-all duration-500`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
