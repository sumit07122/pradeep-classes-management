import { 
  getFinancialDashboard, 
  getIncomes, 
  createIncome, 
  getExpenses, 
  createExpense, 
  getTeacherPayrolls, 
  disbursePayroll 
} from "../financeService";
import type { 
  FinancialDashboardSummary, 
  InstituteExpense, 
  TeacherPayroll 
} from "../../types/finance";

export async function testFinanceService() {
  console.log("Testing finance service signatures and exports...");
  if (typeof getFinancialDashboard !== "function") throw new Error("getFinancialDashboard is not exported");
  if (typeof getIncomes !== "function") throw new Error("getIncomes is not exported");
  if (typeof createIncome !== "function") throw new Error("createIncome is not exported");
  if (typeof getExpenses !== "function") throw new Error("getExpenses is not exported");
  if (typeof createExpense !== "function") throw new Error("createExpense is not exported");
  if (typeof getTeacherPayrolls !== "function") throw new Error("getTeacherPayrolls is not exported");
  if (typeof disbursePayroll !== "function") throw new Error("disbursePayroll is not exported");

  const mockSummary: Partial<FinancialDashboardSummary> = { total_expenses: 0 };
  const mockExpense: Partial<InstituteExpense> = { amount: 100 };
  const mockPayroll: Partial<TeacherPayroll> = { net_amount: 50000 };

  console.log("Finance service tests passed:", !!mockSummary && !!mockExpense && !!mockPayroll);
}
