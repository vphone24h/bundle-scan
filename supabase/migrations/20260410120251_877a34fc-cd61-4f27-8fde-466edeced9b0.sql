DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_payroll_records_tenant_period_user'
  ) THEN
    CREATE INDEX idx_payroll_records_tenant_period_user
      ON public.payroll_records (tenant_id, payroll_period_id, user_id);
  END IF;
END $$;