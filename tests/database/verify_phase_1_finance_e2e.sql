-- tests/database/verify_phase_1_finance_e2e.sql
-- Comprehensive Phase 1 Finance & Teacher Payroll End-to-End Verification Test Suite

DO $$
DECLARE
    v_expenses_count INTEGER;
    v_total_expenses NUMERIC;
    v_salary_configs_count INTEGER;
    v_payrolls_count INTEGER;
    v_dash JSONB;
    v_dash_expenses NUMERIC;
    v_rls_count INTEGER;
BEGIN
    -- 1. Verify all 4 tables exist and have RLS active
    SELECT count(*) INTO v_rls_count
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN ('institute_incomes', 'institute_expenses', 'teacher_salary_configs', 'teacher_payrolls')
      AND rowsecurity = true;
    
    ASSERT v_rls_count = 4, 'RLS must be enabled on all 4 finance tables';

    -- 2. Verify approved operational expenses
    SELECT count(*), COALESCE(SUM(amount), 0)
    INTO v_expenses_count, v_total_expenses
    FROM public.institute_expenses
    WHERE status = 'approved';

    ASSERT v_expenses_count >= 4, 'At least 4 approved operational expenses must exist in ledger';
    ASSERT v_total_expenses >= 48500, 'Total approved expenses must equal or exceed initial seed';

    -- 3. Verify teacher salary configurations
    SELECT count(*) INTO v_salary_configs_count
    FROM public.teacher_salary_configs;

    ASSERT v_salary_configs_count >= 3, 'All institute teachers must have salary configs';

    -- 4. Verify teacher monthly payroll sheets
    SELECT count(*) INTO v_payrolls_count
    FROM public.teacher_payrolls;

    ASSERT v_payrolls_count >= 3, 'All institute teachers must have monthly payroll sheets';

    -- 5. Verify Financial Dashboard RPC aggregates correctly
    v_dash := public.get_institute_financial_dashboard();
    v_dash_expenses := (v_dash->>'total_expenses')::numeric;

    ASSERT v_dash_expenses = v_total_expenses, 'Dashboard RPC total_expenses must match ledger sum';
    ASSERT (v_dash->'expenses_by_category') IS NOT NULL, 'Dashboard must return categorical expense breakdown';
    ASSERT jsonb_array_length(v_dash->'monthly_trends') = 6, 'Dashboard must return 6-month trend array';

    RAISE NOTICE 'PHASE 1 FINANCE E2E AUDIT: 100 PERCENT PASS';
END $$;
