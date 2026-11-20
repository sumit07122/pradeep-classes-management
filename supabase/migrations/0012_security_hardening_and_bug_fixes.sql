-- Migration 0012: Security Hardening, Timetable Conflict Clarity, and Monthly Payroll Generator
-- 
-- 1. Updates fn_check_timetable_conflicts() to output the existing slot's schedule in error messages.
-- 2. Restricts SECURITY DEFINER RPCs (get_institute_financial_dashboard, record_teacher_payroll_payment) to 'owner' and 'admin' roles.
-- 3. Hardens record_teacher_payroll_payment with LEFT JOIN on profiles and pending status validation.
-- 4. Converts 'expense-receipts' storage bucket to private with RBAC policies.
-- 5. Implements generate_monthly_teacher_payrolls RPC for automated monthly payroll batch generation.
-- 6. Reloads PostgREST schema cache.

-- 1. Clear Timetable Conflict Reporting
CREATE OR REPLACE FUNCTION public.fn_check_timetable_conflicts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_conflict_batch text;
  v_conflict_start time;
  v_conflict_end time;
BEGIN
  IF NOT new.is_active THEN
    RETURN new;
  END IF;

  -- 0. Validate positive duration
  IF new.start_time >= new.end_time THEN
    RAISE EXCEPTION 'Invalid class timing: End time (%) must be strictly after start time (%). Note: Please use 24-hour time format (e.g. 13:30 for 1:30 PM).',
      new.end_time, new.start_time;
  END IF;

  -- 1. Check Teacher conflict
  IF new.teacher_id IS NOT NULL THEN
    SELECT b.name, t.start_time, t.end_time 
    INTO v_conflict_batch, v_conflict_start, v_conflict_end
    FROM public.timetables t
    JOIN public.batches b ON b.id = t.batch_id
    WHERE t.id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND t.institute_id = new.institute_id
      AND t.teacher_id = new.teacher_id
      AND t.day_of_week = new.day_of_week
      AND t.is_active = true
      AND (new.start_time, new.end_time) OVERLAPS (t.start_time, t.end_time)
    LIMIT 1;

    IF v_conflict_batch IS NOT NULL THEN
      RAISE EXCEPTION 'Teacher scheduling conflict: Teacher is already scheduled for batch "%" on % between % and %. Please choose a non-overlapping time slot.',
        v_conflict_batch, new.day_of_week, v_conflict_start, v_conflict_end;
    END IF;
  END IF;

  -- 2. Check Room conflict
  IF new.room_number IS NOT NULL AND trim(new.room_number) != '' THEN
    SELECT b.name, t.start_time, t.end_time
    INTO v_conflict_batch, v_conflict_start, v_conflict_end
    FROM public.timetables t
    JOIN public.batches b ON b.id = t.batch_id
    WHERE t.id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND t.institute_id = new.institute_id
      AND lower(trim(t.room_number)) = lower(trim(new.room_number))
      AND t.day_of_week = new.day_of_week
      AND t.is_active = true
      AND (new.start_time, new.end_time) OVERLAPS (t.start_time, t.end_time)
    LIMIT 1;

    IF v_conflict_batch IS NOT NULL THEN
      RAISE EXCEPTION 'Classroom conflict: Room "%" is already occupied by batch "%" on % between % and %. Please choose another room or time slot.',
        new.room_number, v_conflict_batch, new.day_of_week, v_conflict_start, v_conflict_end;
    END IF;
  END IF;

  RETURN new;
END;
$$;

-- 2. Hardened Financial Dashboard Aggregation
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
    -- Verify RBAC: Only owner or admin may view institute financial metrics
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Access denied: unauthorized financial operation';
    END IF;

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

    -- 7. Incomes by payment method (combining student fees and other incomes)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'method', m.payment_mode,
        'amount', m.method_total
    )), '[]'::jsonb)
    INTO v_incomes_by_method
    FROM (
        SELECT payment_mode, SUM(amount) as method_total
        FROM (
            SELECT payment_mode, amount
            FROM public.fee_payments
            WHERE institute_id = v_institute_id AND is_reversal = false
              AND (p_start_date IS NULL OR payment_date >= p_start_date)
              AND (p_end_date IS NULL OR payment_date <= p_end_date)
            UNION ALL
            SELECT payment_method as payment_mode, amount
            FROM public.institute_incomes
            WHERE institute_id = v_institute_id AND status = 'completed'
              AND (p_start_date IS NULL OR income_date >= p_start_date)
              AND (p_end_date IS NULL OR income_date <= p_end_date)
        ) all_inc
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

-- 3. Hardened Payroll Payment Settlement RPC
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
BEGIN
    -- Verify RBAC: Only owner or admin can disburse payroll
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Access denied: unauthorized financial operation';
    END IF;

    -- 1. Fetch and lock payroll record
    SELECT tp.*, COALESCE(p.full_name, t.full_name, 'Faculty Member') as teacher_name
    INTO v_payroll
    FROM public.teacher_payrolls tp
    JOIN public.teachers t ON t.id = tp.teacher_id
    LEFT JOIN public.profiles p ON p.id = t.profile_id
    WHERE tp.id = p_payroll_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll record not found';
    END IF;

    IF v_payroll.status != 'pending' THEN
        RAISE EXCEPTION 'Cannot disburse payroll with status %', v_payroll.status;
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

-- 4. Monthly Payroll Batch Generator RPC
CREATE OR REPLACE FUNCTION public.generate_monthly_teacher_payrolls(p_month TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inst_id UUID := '11111111-2222-3333-4444-555555555555';
    v_config RECORD;
    v_count INT := 0;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Access denied: unauthorized financial operation';
    END IF;

    FOR v_config IN
        SELECT c.*, t.full_name
        FROM public.teacher_salary_configs c
        JOIN public.teachers t ON t.id = c.teacher_id
        WHERE c.institute_id = v_inst_id
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.teacher_payrolls
            WHERE teacher_id = v_config.teacher_id AND payroll_month = p_month
        ) THEN
            INSERT INTO public.teacher_payrolls (
                institute_id,
                teacher_id,
                payroll_month,
                base_salary,
                allowances,
                deductions,
                bonus,
                net_amount,
                status
            ) VALUES (
                v_inst_id,
                v_config.teacher_id,
                p_month,
                v_config.base_salary,
                0,
                0,
                0,
                v_config.base_salary,
                'pending'
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'generated_count', v_count, 'month', p_month);
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_monthly_teacher_payrolls TO authenticated;

-- 5. Hardened Private Storage for Expense Receipts
UPDATE storage.buckets SET public = false WHERE id = 'expense-receipts';

DROP POLICY IF EXISTS "Public can view expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Staff can view expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload expense receipts" ON storage.objects;

CREATE POLICY "Staff can view expense receipts" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'expense-receipts'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Staff can upload expense receipts" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'expense-receipts'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
