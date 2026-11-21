-- Migration: 0016_finance_rls_super_admin.sql
-- Description: Expand institute finance and teacher salary RLS policies to include super_admin role

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'institute_incomes' AND policyname = 'incomes_owner_admin_all'
  ) THEN
    DROP POLICY incomes_owner_admin_all ON institute_incomes;
  END IF;
END $$;

CREATE POLICY incomes_owner_admin_all ON institute_incomes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role, 'super_admin'::app_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role, 'super_admin'::app_role])
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'institute_expenses' AND policyname = 'expenses_owner_admin_all'
  ) THEN
    DROP POLICY expenses_owner_admin_all ON institute_expenses;
  END IF;
END $$;

CREATE POLICY expenses_owner_admin_all ON institute_expenses
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role, 'super_admin'::app_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role, 'super_admin'::app_role])
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'teacher_salary_configs' AND policyname = 'salary_configs_owner_admin'
  ) THEN
    DROP POLICY salary_configs_owner_admin ON teacher_salary_configs;
  END IF;
END $$;

CREATE POLICY salary_configs_owner_admin ON teacher_salary_configs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role, 'super_admin'::app_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role, 'super_admin'::app_role])
    )
  );
