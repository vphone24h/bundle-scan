CREATE OR REPLACE FUNCTION public.get_cash_book_balances(
  p_tenant_id uuid,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_object_agg(source, jsonb_build_object('income', inc, 'expense', exp))
  INTO result
  FROM (
    SELECT
      payment_source AS source,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS inc,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS exp
    FROM cash_book
    WHERE tenant_id = p_tenant_id
      AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    GROUP BY payment_source
  ) sub;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;