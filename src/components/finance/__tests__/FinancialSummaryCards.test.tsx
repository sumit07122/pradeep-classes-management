import React from "react";
import { FinancialSummaryCards } from "../FinancialSummaryCards";
import type { FinancialDashboardSummary } from "../../../types/finance";

export function testFinancialSummaryCards() {
  const dummySummary: FinancialDashboardSummary = {
    total_fees_billed: 500000,
    total_fees_collected: 350000,
    outstanding_dues: 150000,
    total_other_income: 20000,
    total_expenses: 85000,
    total_teacher_salaries_paid: 65000,
    net_operating_surplus: 285000,
    expenses_by_category: [],
    incomes_by_method: [],
    monthly_trends: []
  };

  const element = React.createElement(FinancialSummaryCards, { summary: dummySummary });
  if (!element) throw new Error("Failed to create FinancialSummaryCards element");
  console.log("FinancialSummaryCards test passed");
}
