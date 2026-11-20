// src/services/payrollHelper.ts

export interface PayrollCalculationInput {
  baseSalary: number;
  lectureCount: number;
  lectureRate: number;
  allowances: number;
  bonus: number;
  deductions: number;
}

/**
 * Calculates net payable amount for a teacher's monthly payroll sheet
 */
export function calculateNetPayroll(input: PayrollCalculationInput): number {
  const lectureAmount = Math.max(input.lectureCount, 0) * Math.max(input.lectureRate, 0);
  const grossPay = Math.max(input.baseSalary, 0) + lectureAmount + Math.max(input.allowances, 0) + Math.max(input.bonus, 0);
  const netPay = grossPay - Math.max(input.deductions, 0);
  return Math.max(netPay, 0);
}
