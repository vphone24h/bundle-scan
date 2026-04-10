DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_payroll_records_period_net_salary'
  ) THEN
    CREATE INDEX idx_payroll_records_period_net_salary
      ON public.payroll_records (payroll_period_id, net_salary DESC);
  END IF;
END $$;