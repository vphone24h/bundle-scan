DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_payroll_records_period_name'
  ) THEN
    CREATE INDEX idx_payroll_records_period_name
      ON public.payroll_records (payroll_period_id, user_name);
  END IF;
END $$;