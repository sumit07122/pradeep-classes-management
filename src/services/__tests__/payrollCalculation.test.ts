import { calculateNetPayroll } from "../payrollHelper";

export function testPayrollCalculation() {
  const result1 = calculateNetPayroll({
    baseSalary: 60000,
    lectureCount: 0,
    lectureRate: 0,
    allowances: 5000,
    bonus: 2000,
    deductions: 3000,
  });

  if (result1 !== 64000) {
    throw new Error(`Expected 64000, got ${result1}`);
  }

  const result2 = calculateNetPayroll({
    baseSalary: 0,
    lectureCount: 20,
    lectureRate: 1500,
    allowances: 0,
    bonus: 0,
    deductions: 0,
  });

  if (result2 !== 30000) {
    throw new Error(`Expected 30000, got ${result2}`);
  }

  console.log("Payroll calculation tests passed");
}
