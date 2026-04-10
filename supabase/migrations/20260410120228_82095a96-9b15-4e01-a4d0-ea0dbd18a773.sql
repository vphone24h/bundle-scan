DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_payroll_records_tenant_status'
  ) THEN
    CREATE INDEX idx_payroll_records_tenant_status
      ON public.payroll_records (tenant_id, status);
  END IF;
END $$;