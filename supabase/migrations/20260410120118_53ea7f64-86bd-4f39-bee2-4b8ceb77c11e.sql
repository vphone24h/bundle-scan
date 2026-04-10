DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_payroll_records_user_period'
  ) THEN
    CREATE INDEX idx_payroll_records_user_period
      ON public.payroll_records (user_id, payroll_period_id);
  END IF;
END $$;