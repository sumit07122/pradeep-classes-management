-- tests/database/verify_finance_and_payroll.sql
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('institute_incomes', 'institute_expenses', 'teacher_salary_configs', 'teacher_payrolls')) = 4, 'All 4 finance tables must exist';
  ASSERT (SELECT count(*) FROM pg_proc WHERE proname IN ('get_institute_financial_dashboard', 'record_teacher_payroll_payment')) = 2, 'Both finance RPCs must exist';
  RAISE NOTICE 'Finance database verification passed';
END $$;
