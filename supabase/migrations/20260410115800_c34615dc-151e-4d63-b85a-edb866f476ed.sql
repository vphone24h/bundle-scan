WITH ranked_records AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY payroll_period_id, user_id
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
         ) AS row_num
  FROM public.payroll_records
  WHERE payroll_period_id IS NOT NULL
    AND user_id IS NOT NULL
)
DELETE FROM public.payroll_records pr
USING ranked_records rr
WHERE pr.id = rr.id
  AND rr.row_num > 1;

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