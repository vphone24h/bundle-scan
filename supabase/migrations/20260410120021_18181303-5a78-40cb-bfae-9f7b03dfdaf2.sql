DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_records_payroll_period_user_key'
      AND conrelid = 'public.payroll_records'::regclass
  ) THEN
    ALTER TABLE public.payroll_records
      ADD CONSTRAINT payroll_records_payroll_period_user_key
      UNIQUE (payroll_period_id, user_id);
  END IF;
END $$;