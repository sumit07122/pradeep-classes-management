-- Migration 0011: Institute Finance, Expense Ledger, and Teacher Payroll System
-- Pradeep Classes Management Platform

-- 1. Institute Incomes Table
CREATE TABLE IF NOT EXISTS public.institute_incomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('student_fee', 'admission_fee', 'study_material', 'other')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
    transaction_reference TEXT,
    income_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    fee_payment_id UUID REFERENCES public.fee_payments(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'reversed')),
    reversal_reason TEXT,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Institute Expenses Table
CREATE TABLE IF NOT EXISTS public.institute_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN (
        'rent', 'electricity_utilities', 'internet_software', 
        'stationery_supplies', 'marketing_advertising', 'maintenance', 
        'teacher_payroll', 'other'
    )),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
    description TEXT,
    receipt_url TEXT,
    vendor_name TEXT,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'reversed')),
    reversal_reason TEXT,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Teacher Salary Configurations
CREATE TABLE IF NOT EXISTS public.teacher_salary_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL UNIQUE REFERENCES public.teachers(id) ON DELETE CASCADE,
    calculation_type TEXT NOT NULL DEFAULT 'monthly_fixed' CHECK (calculation_type IN ('monthly_fixed', 'per_lecture', 'hourly')),
    base_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (base_amount >= 0),
    per_lecture_rate NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (per_lecture_rate >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Teacher Monthly Payroll Sheets
CREATE TABLE IF NOT EXISTS public.teacher_payrolls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    payroll_month VARCHAR(7) NOT NULL, -- e.g. '2026-11'
    base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
    lecture_count INTEGER NOT NULL DEFAULT 0 CHECK (lecture_count >= 0),
    lecture_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (lecture_amount >= 0),
    allowances NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (allowances >= 0),
    deductions NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
    bonus NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (bonus >= 0),
    net_amount NUMERIC(12, 2) NOT NULL CHECK (net_amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    payment_date DATE,
    payment_method TEXT CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
    transaction_reference TEXT,
    notes TEXT,
    processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    expense_id UUID REFERENCES public.institute_expenses(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_teacher_payroll_month UNIQUE (teacher_id, payroll_month)
);

-- Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_institute_incomes_date ON public.institute_incomes(income_date);
CREATE INDEX IF NOT EXISTS idx_institute_incomes_institute ON public.institute_incomes(institute_id);
CREATE INDEX IF NOT EXISTS idx_institute_expenses_date ON public.institute_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_institute_expenses_category ON public.institute_expenses(category);
CREATE INDEX IF NOT EXISTS idx_institute_expenses_institute ON public.institute_expenses(institute_id);
CREATE INDEX IF NOT EXISTS idx_teacher_payrolls_month ON public.teacher_payrolls(payroll_month);
CREATE INDEX IF NOT EXISTS idx_teacher_payrolls_teacher ON public.teacher_payrolls(teacher_id);

-- Enable Row Level Security
ALTER TABLE public.institute_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institute_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_salary_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_payrolls ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if any
DROP POLICY IF EXISTS "incomes_owner_admin_all" ON public.institute_incomes;
DROP POLICY IF EXISTS "expenses_owner_admin_all" ON public.institute_expenses;
DROP POLICY IF EXISTS "salary_configs_owner_admin" ON public.teacher_salary_configs;
DROP POLICY IF EXISTS "payrolls_owner_admin_all" ON public.teacher_payrolls;
DROP POLICY IF EXISTS "payrolls_teacher_read_own" ON public.teacher_payrolls;

-- RLS Policies
CREATE POLICY "incomes_owner_admin_all" ON public.institute_incomes
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "expenses_owner_admin_all" ON public.institute_expenses
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "salary_configs_owner_admin" ON public.teacher_salary_configs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "payrolls_owner_admin_all" ON public.teacher_payrolls
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "payrolls_teacher_read_own" ON public.teacher_payrolls
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.teachers t
            WHERE t.id = teacher_payrolls.teacher_id AND t.profile_id = auth.uid()
        )
    );

-- Storage bucket for expense receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Public can view expense receipts" ON storage.objects;

CREATE POLICY "Authenticated users can upload receipts" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'expense-receipts');

CREATE POLICY "Public can view expense receipts" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'expense-receipts');

-- RPC 1: Aggregate Financial Dashboard
CREATE OR REPLACE FUNCTION public.get_institute_financial_dashboard(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_institute_id UUID := '11111111-2222-3333-4444-555555555555';
    v_total_fees_billed NUMERIC(12,2) := 0;
    v_total_fees_collected NUMERIC(12,2) := 0;
    v_total_other_income NUMERIC(12,2) := 0;
    v_total_expenses NUMERIC(12,2) := 0;
    v_total_salaries_paid NUMERIC(12,2) := 0;
    v_expenses_by_category JSONB;
    v_incomes_by_method JSONB;
    v_monthly_trends JSONB;
BEGIN
    -- 1. Total fees billed
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_fees_billed
    FROM public.fee_records
    WHERE institute_id = v_institute_id;

    -- 2. Total fees collected
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_fees_collected
    FROM public.fee_payments
    WHERE institute_id = v_institute_id
      AND is_reversal = false
      AND (p_start_date IS NULL OR payment_date >= p_start_date)
      AND (p_end_date IS NULL OR payment_date <= p_end_date);

    -- 3. Total other income
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_other_income
    FROM public.institute_incomes
    WHERE institute_id = v_institute_id
      AND status = 'completed'
      AND source_type != 'student_fee'
      AND (p_start_date IS NULL OR income_date >= p_start_date)
      AND (p_end_date IS NULL OR income_date <= p_end_date);

    -- 4. Total expenses
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_expenses
    FROM public.institute_expenses
    WHERE institute_id = v_institute_id
      AND status = 'approved'
      AND (p_start_date IS NULL OR expense_date >= p_start_date)
      AND (p_end_date IS NULL OR expense_date <= p_end_date);

    -- 5. Total salaries paid
    SELECT COALESCE(SUM(net_amount), 0)
    INTO v_total_salaries_paid
    FROM public.teacher_payrolls
    WHERE institute_id = v_institute_id
      AND status = 'paid'
      AND (p_start_date IS NULL OR payment_date >= p_start_date)
      AND (p_end_date IS NULL OR payment_date <= p_end_date);

    -- 6. Expenses by category
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'category', cat.category,
        'amount', cat.cat_total
    )), '[]'::jsonb)
    INTO v_expenses_by_category
    FROM (
        SELECT category, SUM(amount) as cat_total
        FROM public.institute_expenses
        WHERE institute_id = v_institute_id
          AND status = 'approved'
          AND (p_start_date IS NULL OR expense_date >= p_start_date)
          AND (p_end_date IS NULL OR expense_date <= p_end_date)
        GROUP BY category
        ORDER BY cat_total DESC
    ) cat;

    -- 7. Incomes by payment method
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'method', m.payment_mode,
        'amount', m.method_total
    )), '[]'::jsonb)
    INTO v_incomes_by_method
    FROM (
        SELECT payment_mode, SUM(amount) as method_total
        FROM public.fee_payments
        WHERE institute_id = v_institute_id AND is_reversal = false
        GROUP BY payment_mode
    ) m;

    -- 8. Monthly trends (past 6 months)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'month', t.m_label,
        'income', t.m_income,
        'expense', t.m_expense
    )), '[]'::jsonb)
    INTO v_monthly_trends
    FROM (
        WITH months AS (
            SELECT to_char(date_trunc('month', d), 'YYYY-MM') AS m_label
            FROM generate_series(
                CURRENT_DATE - INTERVAL '5 months',
                CURRENT_DATE,
                INTERVAL '1 month'
            ) d
        )
        SELECT 
            m.m_label,
            COALESCE((
                SELECT SUM(fp.amount) 
                FROM public.fee_payments fp
                WHERE to_char(fp.payment_date, 'YYYY-MM') = m.m_label
                  AND fp.institute_id = v_institute_id
                  AND fp.is_reversal = false
            ), 0) + COALESCE((
                SELECT SUM(ii.amount) 
                FROM public.institute_incomes ii
                WHERE to_char(ii.income_date, 'YYYY-MM') = m.m_label
                  AND ii.institute_id = v_institute_id
                  AND ii.status = 'completed'
                  AND ii.source_type != 'student_fee'
            ), 0) AS m_income,
            COALESCE((
                SELECT SUM(ie.amount) 
                FROM public.institute_expenses ie
                WHERE to_char(ie.expense_date, 'YYYY-MM') = m.m_label
                  AND ie.institute_id = v_institute_id
                  AND ie.status = 'approved'
            ), 0) AS m_expense
        FROM months m
        ORDER BY m.m_label ASC
    ) t;

    RETURN jsonb_build_object(
        'total_fees_billed', v_total_fees_billed,
        'total_fees_collected', v_total_fees_collected,
        'outstanding_dues', GREATEST(v_total_fees_billed - v_total_fees_collected, 0),
        'total_other_income', v_total_other_income,
        'total_expenses', v_total_expenses,
        'total_teacher_salaries_paid', v_total_salaries_paid,
        'net_operating_surplus', (v_total_fees_collected + v_total_other_income) - v_total_expenses,
        'expenses_by_category', v_expenses_by_category,
        'incomes_by_method', v_incomes_by_method,
        'monthly_trends', v_monthly_trends
    );
END;
$$;

-- RPC 2: Atomic Payroll Payment Settlement
CREATE OR REPLACE FUNCTION public.record_teacher_payroll_payment(
    p_payroll_id UUID,
    p_payment_method TEXT,
    p_transaction_reference TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payroll RECORD;
    v_expense_id UUID;
    v_teacher_name TEXT;
BEGIN
    -- 1. Fetch and lock payroll record
    SELECT tp.*, p.full_name as teacher_name
    INTO v_payroll
    FROM public.teacher_payrolls tp
    JOIN public.teachers t ON t.id = tp.teacher_id
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE tp.id = p_payroll_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll record not found';
    END IF;

    IF v_payroll.status = 'paid' THEN
        RAISE EXCEPTION 'This payroll sheet has already been paid on %', v_payroll.payment_date;
    END IF;

    -- 2. Insert into institute_expenses ledger under 'teacher_payroll'
    INSERT INTO public.institute_expenses (
        institute_id,
        category,
        amount,
        expense_date,
        payment_method,
        description,
        vendor_name,
        status,
        recorded_by
    ) VALUES (
        v_payroll.institute_id,
        'teacher_payroll',
        v_payroll.net_amount,
        CURRENT_DATE,
        p_payment_method,
        COALESCE(p_notes, 'Salary disbursement for ' || v_payroll.teacher_name || ' (' || v_payroll.payroll_month || ')'),
        v_payroll.teacher_name,
        'approved',
        auth.uid()
    ) RETURNING id INTO v_expense_id;

    -- 3. Update teacher_payrolls status
    UPDATE public.teacher_payrolls
    SET status = 'paid',
        payment_date = CURRENT_DATE,
        payment_method = p_payment_method,
        transaction_reference = p_transaction_reference,
        notes = p_notes,
        expense_id = v_expense_id,
        processed_by = auth.uid(),
        updated_at = now()
    WHERE id = p_payroll_id;

    RETURN jsonb_build_object(
        'success', true,
        'payroll_id', p_payroll_id,
        'expense_id', v_expense_id,
        'net_amount', v_payroll.net_amount,
        'status', 'paid'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_institute_financial_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_teacher_payroll_payment TO authenticated;

-- Seed Teacher Salary Configurations and Sample Expenses
DO $$
DECLARE
    v_inst_id UUID := '11111111-2222-3333-4444-555555555555';
    v_t1 UUID;
    v_t2 UUID;
    v_t3 UUID;
    v_current_month VARCHAR(7) := to_char(CURRENT_DATE, 'YYYY-MM');
BEGIN
    -- Get teacher IDs
    SELECT t.id INTO v_t1 FROM public.teachers t JOIN public.profiles p ON p.id = t.profile_id WHERE p.full_name = 'Dr. Rajesh Sharma' LIMIT 1;
    SELECT t.id INTO v_t2 FROM public.teachers t JOIN public.profiles p ON p.id = t.profile_id WHERE p.full_name = 'Prof. Sunita Patil' LIMIT 1;
    SELECT t.id INTO v_t3 FROM public.teachers t JOIN public.profiles p ON p.id = t.profile_id WHERE p.full_name = 'Er. Manoj Deshmukh' LIMIT 1;

    -- Seed Salary Configs
    IF v_t1 IS NOT NULL THEN
        INSERT INTO public.teacher_salary_configs (institute_id, teacher_id, calculation_type, base_amount, per_lecture_rate)
        VALUES (v_inst_id, v_t1, 'monthly_fixed', 65000, 0)
        ON CONFLICT (teacher_id) DO UPDATE SET base_amount = 65000, calculation_type = 'monthly_fixed';

        INSERT INTO public.teacher_payrolls (institute_id, teacher_id, payroll_month, base_salary, lecture_count, lecture_amount, allowances, deductions, bonus, net_amount, status)
        VALUES (v_inst_id, v_t1, v_current_month, 65000, 24, 0, 5000, 2000, 0, 68000, 'pending')
        ON CONFLICT (teacher_id, payroll_month) DO NOTHING;
    END IF;

    IF v_t2 IS NOT NULL THEN
        INSERT INTO public.teacher_salary_configs (institute_id, teacher_id, calculation_type, base_amount, per_lecture_rate)
        VALUES (v_inst_id, v_t2, 'per_lecture', 0, 1500)
        ON CONFLICT (teacher_id) DO UPDATE SET per_lecture_rate = 1500, calculation_type = 'per_lecture';

        INSERT INTO public.teacher_payrolls (institute_id, teacher_id, payroll_month, base_salary, lecture_count, lecture_amount, allowances, deductions, bonus, net_amount, status)
        VALUES (v_inst_id, v_t2, v_current_month, 0, 20, 30000, 0, 0, 2000, 32000, 'pending')
        ON CONFLICT (teacher_id, payroll_month) DO NOTHING;
    END IF;

    IF v_t3 IS NOT NULL THEN
        INSERT INTO public.teacher_salary_configs (institute_id, teacher_id, calculation_type, base_amount, per_lecture_rate)
        VALUES (v_inst_id, v_t3, 'per_lecture', 0, 1500)
        ON CONFLICT (teacher_id) DO UPDATE SET per_lecture_rate = 1500, calculation_type = 'per_lecture';

        INSERT INTO public.teacher_payrolls (institute_id, teacher_id, payroll_month, base_salary, lecture_count, lecture_amount, allowances, deductions, bonus, net_amount, status)
        VALUES (v_inst_id, v_t3, v_current_month, 0, 18, 27000, 0, 0, 0, 27000, 'pending')
        ON CONFLICT (teacher_id, payroll_month) DO NOTHING;
    END IF;

    -- Seed realistic operational expenses for current month
    INSERT INTO public.institute_expenses (institute_id, category, amount, expense_date, payment_method, description, vendor_name, status)
    VALUES 
        (v_inst_id, 'rent', 35000, CURRENT_DATE - INTERVAL '15 days', 'bank_transfer', 'Campus lease payment for Vidya Complex', 'Vidya Commercial Properties', 'approved'),
        (v_inst_id, 'electricity_utilities', 4500, CURRENT_DATE - INTERVAL '10 days', 'upi', 'Monthly electricity bill', 'Tata Power / State Discom', 'approved'),
        (v_inst_id, 'internet_software', 2800, CURRENT_DATE - INTERVAL '5 days', 'upi', 'High-speed fiber internet and portal cloud hosting', 'Airtel Broadband', 'approved'),
        (v_inst_id, 'stationery_supplies', 6200, CURRENT_DATE - INTERVAL '2 days', 'cash', 'Classroom whiteboard markers, student test notebooks & printing sheets', 'Pragati Paper Mart', 'approved')
    ON CONFLICT DO NOTHING;
END $$;
