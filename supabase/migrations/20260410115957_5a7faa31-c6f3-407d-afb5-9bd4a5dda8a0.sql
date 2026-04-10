DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_payroll_records_tenant_period'
  ) THEN
    CREATE INDEX idx_payroll_records_tenant_period
      ON public.payroll_records (tenant_id, payroll_period_id);
  END IF;
END $$;