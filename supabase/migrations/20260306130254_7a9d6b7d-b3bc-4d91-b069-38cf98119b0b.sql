
-- RPC: Get customer debt summary (server-side, no row limit)
CREATE OR REPLACE FUNCTION public.get_customer_debt_summary(
  _show_settled boolean DEFAULT false,
  _branch_id uuid DEFAULT NULL
)
RETURNS TABLE(
  entity_id uuid,
  entity_name text,
  entity_phone text,
  branch_id uuid,
  branch_name text,
  total_amount numeric,
  paid_amount numeric,
  remaining_amount numeric,
  first_debt_date timestamptz,
  days_overdue integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
BEGIN
  _tenant_id := public.get_user_tenant_id_secure();
  IF _tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH receipt_debts AS (
    SELECT
      er.customer_id,
      SUM(er.debt_amount) AS current_debt,
      MIN(er.export_date) AS first_date,
      MAX(er.branch_id) AS r_branch_id
    FROM export_receipts er
    WHERE er.tenant_id = _tenant_id
      AND er.status = 'completed'
      AND (_branch_id IS NULL OR er.branch_id = _branch_id)
      AND (
        er.debt_amount > 0
        OR COALESCE(er.original_debt_amount, 0) > 0
        OR er.total_amount > er.paid_amount
      )
    GROUP BY er.customer_id
  ),
  debt_additions AS (
    SELECT
      dp.entity_id::uuid AS customer_id,
      SUM(dp.amount - COALESCE(dp.allocated_amount, 0)) AS additions_remaining,
      SUM(dp.amount) AS total_additions,
      MIN(dp.created_at) AS first_addition_date,
      MAX(dp.branch_id) AS a_branch_id
    FROM debt_payments dp
    WHERE dp.entity_type = 'customer'
      AND dp.payment_type = 'addition'
      AND (_branch_id IS NULL OR dp.branch_id = _branch_id)
      -- tenant filter via entity_id matching customers in tenant
      AND EXISTS (SELECT 1 FROM customers c WHERE c.id = dp.entity_id::uuid AND c.tenant_id = _tenant_id)
    GROUP BY dp.entity_id
  ),
  debt_payments_sum AS (
    SELECT
      dp.entity_id::uuid AS customer_id,
      SUM(dp.amount) AS total_paid_amount
    FROM debt_payments dp
    WHERE dp.entity_type = 'customer'
      AND dp.payment_type = 'payment'
      AND (_branch_id IS NULL OR dp.branch_id = _branch_id)
      AND EXISTS (SELECT 1 FROM customers c WHERE c.id = dp.entity_id::uuid AND c.tenant_id = _tenant_id)
    GROUP BY dp.entity_id
  ),
  combined AS (
    SELECT DISTINCT COALESCE(rd.customer_id, da.customer_id, dps.customer_id) AS cid
    FROM receipt_debts rd
    FULL OUTER JOIN debt_additions da ON da.customer_id = rd.customer_id
    FULL OUTER JOIN debt_payments_sum dps ON dps.customer_id = COALESCE(rd.customer_id, da.customer_id)
  )
  SELECT
    c.id AS entity_id,
    c.name AS entity_name,
    c.phone AS entity_phone,
    COALESCE(rd.r_branch_id, da.a_branch_id) AS branch_id,
    b.name AS branch_name,
    -- total = remaining + paid
    (COALESCE(rd.current_debt, 0) + COALESCE(da.additions_remaining, 0) + COALESCE(dps.total_paid_amount, 0))::numeric AS total_amount,
    COALESCE(dps.total_paid_amount, 0)::numeric AS paid_amount,
    (COALESCE(rd.current_debt, 0) + COALESCE(da.additions_remaining, 0))::numeric AS remaining_amount,
    LEAST(rd.first_date, da.first_addition_date) AS first_debt_date,
    CASE 
      WHEN LEAST(rd.first_date, da.first_addition_date) IS NOT NULL 
      THEN EXTRACT(DAY FROM now() - LEAST(rd.first_date, da.first_addition_date))::integer
      ELSE 0
    END AS days_overdue
  FROM combined cb
  JOIN customers c ON c.id = cb.cid AND c.tenant_id = _tenant_id
  LEFT JOIN receipt_debts rd ON rd.customer_id = cb.cid
  LEFT JOIN debt_additions da ON da.customer_id = cb.cid
  LEFT JOIN debt_payments_sum dps ON dps.customer_id = cb.cid
  LEFT JOIN branches b ON b.id = COALESCE(rd.r_branch_id, da.a_branch_id)
  WHERE 
    CASE WHEN _show_settled 
      THEN (COALESCE(rd.current_debt, 0) + COALESCE(da.additions_remaining, 0) + COALESCE(dps.total_paid_amount, 0)) > 0
           OR COALESCE(dps.total_paid_amount, 0) > 0
      ELSE (COALESCE(rd.current_debt, 0) + COALESCE(da.additions_remaining, 0)) > 0
    END
  ORDER BY (COALESCE(rd.current_debt, 0) + COALESCE(da.additions_remaining, 0)) DESC;
END;
$$;

-- RPC: Get supplier debt summary (server-side, no row limit)
CREATE OR REPLACE FUNCTION public.get_supplier_debt_summary(
  _show_settled boolean DEFAULT false,
  _branch_id uuid DEFAULT NULL
)
RETURNS TABLE(
  entity_id uuid,
  entity_name text,
  entity_phone text,
  branch_id uuid,
  branch_name text,
  total_amount numeric,
  paid_amount numeric,
  remaining_amount numeric,
  first_debt_date timestamptz,
  days_overdue integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
BEGIN
  _tenant_id := public.get_user_tenant_id_secure();
  IF _tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH receipt_debts AS (
    SELECT
      ir.supplier_id,
      SUM(ir.debt_amount) AS current_debt,
      MIN(ir.import_date) AS first_date,
      MAX(ir.branch_id) AS r_branch_id
    FROM import_receipts ir
    WHERE ir.tenant_id = _tenant_id
      AND ir.status = 'completed'
      AND (_branch_id IS NULL OR ir.branch_id = _branch_id)
      AND (
        ir.debt_amount > 0
        OR COALESCE(ir.original_debt_amount, 0) > 0
        OR ir.total_amount > ir.paid_amount
      )
    GROUP BY ir.supplier_id
  ),
  debt_additions AS (
    SELECT
      dp.entity_id::uuid AS supplier_id,
      SUM(dp.amount - COALESCE(dp.allocated_amount, 0)) AS additions_remaining,
      SUM(dp.amount) AS total_additions,
      MIN(dp.created_at) AS first_addition_date,
      MAX(dp.branch_id) AS a_branch_id
    FROM debt_payments dp
    WHERE dp.entity_type = 'supplier'
      AND dp.payment_type = 'addition'
      AND (_branch_id IS NULL OR dp.branch_id = _branch_id)
      AND EXISTS (SELECT 1 FROM suppliers s WHERE s.id = dp.entity_id::uuid AND s.tenant_id = _tenant_id)
    GROUP BY dp.entity_id
  ),
  debt_payments_sum AS (
    SELECT
      dp.entity_id::uuid AS supplier_id,
      SUM(dp.amount) AS total_paid_amount
    FROM debt_payments dp
    WHERE dp.entity_type = 'supplier'
      AND dp.payment_type = 'payment'
      AND (_branch_id IS NULL OR dp.branch_id = _branch_id)
      AND EXISTS (SELECT 1 FROM suppliers s WHERE s.id = dp.entity_id::uuid AND s.tenant_id = _tenant_id)
    GROUP BY dp.entity_id
  ),
  combined AS (
    SELECT DISTINCT COALESCE(rd.supplier_id, da.supplier_id, dps.supplier_id) AS sid
    FROM receipt_debts rd
    FULL OUTER JOIN debt_additions da ON da.supplier_id = rd.supplier_id
    FULL OUTER JOIN debt_payments_sum dps ON dps.supplier_id = COALESCE(rd.supplier_id, da.supplier_id)
  )
  SELECT
    s.id AS entity_id,
    s.name AS entity_name,
    s.phone AS entity_phone,
    COALESCE(rd.r_branch_id, da.a_branch_id) AS branch_id,
    b.name AS branch_name,
    (COALESCE(rd.current_debt, 0) + COALESCE(da.additions_remaining, 0) + COALESCE(dps.total_paid_amount, 0))::numeric AS total_amount,
    COALESCE(dps.total_paid_amount, 0)::numeric AS paid_amount,
    (COALESCE(rd.current_debt, 0) + COALESCE(da.additions_remaining, 0))::numeric AS remaining_amount,
    LEAST(rd.first_date, da.first_addition_date) AS first_debt_date,
    CASE 
      WHEN LEAST(rd.first_date, da.first_addition_date) IS NOT NULL 
      THEN EXTRACT(DAY FROM now() - LEAST(rd.first_date, da.first_addition_date))::integer
      ELSE 0
    END AS days_overdue
  FROM combined cb
  JOIN suppliers s ON s.id = cb.sid AND s.tenant_id = _tenant_id
  LEFT JOIN receipt_debts rd ON rd.supplier_id = cb.sid
  LEFT JOIN debt_additions da ON da.supplier_id = cb.sid
  LEFT JOIN debt_payments_sum dps ON dps.supplier_id = cb.sid
  LEFT JOIN branches b ON b.id = COALESCE(rd.r_branch_id, da.a_branch_id)
  WHERE 
    CASE WHEN _show_settled 
      THEN (COALESCE(rd.current_debt, 0) + COALESCE(da.additions_remaining, 0) + COALESCE(dps.total_paid_amount, 0)) > 0
           OR COALESCE(dps.total_paid_amount, 0) > 0
      ELSE (COALESCE(rd.current_debt, 0) + COALESCE(da.additions_remaining, 0)) > 0
    END
  ORDER BY (COALESCE(rd.current_debt, 0) + COALESCE(da.additions_remaining, 0)) DESC;
END;
$$;
