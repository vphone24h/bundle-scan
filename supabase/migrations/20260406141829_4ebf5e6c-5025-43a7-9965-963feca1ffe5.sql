
CREATE OR REPLACE FUNCTION public.get_cash_book_balances_by_branches(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
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
      AND branch_id IS NOT NULL
      AND branch_id IN (SELECT id FROM branches WHERE tenant_id = p_tenant_id)
    GROUP BY payment_source
  ) sub;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;
