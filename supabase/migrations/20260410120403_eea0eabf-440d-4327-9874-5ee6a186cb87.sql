DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_payroll_records_tenant_period_status'
  ) THEN
    CREATE INDEX idx_payroll_records_tenant_period_status
      ON public.payroll_records (tenant_id, payroll_period_id, status);
  END IF;
END $$;