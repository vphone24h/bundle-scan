
DROP FUNCTION IF EXISTS public.get_supplier_debt_summary(boolean, uuid);

CREATE OR REPLACE FUNCTION public.get_supplier_debt_summary(
  _show_settled boolean DEFAULT false,
  _branch_id uuid DEFAULT NULL::uuid
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
  first_debt_date timestamp with time zone,
  days_overdue integer,
  merged_entity_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid;
BEGIN
  _tenant_id := public.get_user_tenant_id_secure();
  IF _tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH per_supplier AS (
    SELECT
      ir.supplier_id AS sid,
      SUM(ir.debt_amount) AS receipt_debt,
      MIN(ir.import_date) AS first_date
    FROM import_receipts ir
    WHERE ir.tenant_id = _tenant_id
      AND ir.status = 'completed'
      AND (_branch_id IS NULL OR ir.branch_id = _branch_id)
      AND (ir.debt_amount > 0 OR COALESCE(ir.original_debt_amount, 0) > 0 OR ir.total_amount > ir.paid_amount)
    GROUP BY ir.supplier_id
  ),
  per_supplier_additions AS (
    SELECT
      dp.entity_id::uuid AS sid,
      SUM(dp.amount - COALESCE(dp.allocated_amount, 0)) AS additions_remaining,
      MIN(dp.created_at) AS first_addition_date
    FROM debt_payments dp
    WHERE dp.entity_type = 'supplier'
      AND dp.payment_type = 'addition'
      AND (_branch_id IS NULL OR dp.branch_id = _branch_id)
      AND EXISTS (SELECT 1 FROM suppliers s WHERE s.id = dp.entity_id::uuid AND s.tenant_id = _tenant_id)
    GROUP BY dp.entity_id
  ),
  per_supplier_payments AS (
    SELECT
      dp.entity_id::uuid AS sid,
      SUM(dp.amount) AS total_paid
    FROM debt_payments dp
    WHERE dp.entity_type = 'supplier'
      AND dp.payment_type = 'payment'
      AND (_branch_id IS NULL OR dp.branch_id = _branch_id)
      AND EXISTS (SELECT 1 FROM suppliers s WHERE s.id = dp.entity_id::uuid AND s.tenant_id = _tenant_id)
    GROUP BY dp.entity_id
  ),
  all_supplier_ids AS (
    SELECT DISTINCT COALESCE(ps.sid, pa.sid, pp.sid) AS sid
    FROM per_supplier ps
    FULL OUTER JOIN per_supplier_additions pa ON pa.sid = ps.sid
    FULL OUTER JOIN per_supplier_payments pp ON pp.sid = COALESCE(ps.sid, pa.sid)
  ),
  supplier_with_data AS (
    SELECT
      s.id AS sid,
      s.name AS sname,
      COALESCE(s.phone, '') AS sphone,
      s.branch_id AS real_branch_id,
      COALESCE(ps.receipt_debt, 0) AS receipt_debt,
      COALESCE(pa.additions_remaining, 0) AS additions_remaining,
      COALESCE(pp.total_paid, 0) AS total_paid,
      LEAST(ps.first_date, pa.first_addition_date) AS first_dt
    FROM all_supplier_ids asi
    JOIN suppliers s ON s.id = asi.sid AND s.tenant_id = _tenant_id
    LEFT JOIN per_supplier ps ON ps.sid = asi.sid
    LEFT JOIN per_supplier_additions pa ON pa.sid = asi.sid
    LEFT JOIN per_supplier_payments pp ON pp.sid = asi.sid
  ),
  grouped AS (
    SELECT
      sd.sname,
      sd.sphone,
      sd.real_branch_id AS gbranch_id,
      array_agg(sd.sid ORDER BY sd.first_dt ASC NULLS LAST) AS all_ids,
      (array_agg(sd.sid ORDER BY sd.first_dt ASC NULLS LAST))[1] AS primary_id,
      SUM(sd.receipt_debt) AS g_receipt_debt,
      SUM(sd.additions_remaining) AS g_additions_remaining,
      SUM(sd.total_paid) AS g_total_paid,
      MIN(sd.first_dt) AS g_first_date
    FROM supplier_with_data sd
    GROUP BY sd.sname, sd.sphone, sd.real_branch_id
  )
  SELECT
    g.primary_id AS entity_id,
    g.sname AS entity_name,
    NULLIF(g.sphone, '') AS entity_phone,
    g.gbranch_id AS branch_id,
    b.name AS branch_name,
    (g.g_receipt_debt + g.g_additions_remaining + g.g_total_paid)::numeric AS total_amount,
    g.g_total_paid::numeric AS paid_amount,
    (g.g_receipt_debt + g.g_additions_remaining)::numeric AS remaining_amount,
    g.g_first_date AS first_debt_date,
    CASE 
      WHEN g.g_first_date IS NOT NULL 
      THEN EXTRACT(DAY FROM now() - g.g_first_date)::integer
      ELSE 0
    END AS days_overdue,
    g.all_ids AS merged_entity_ids
  FROM grouped g
  LEFT JOIN branches b ON b.id = g.gbranch_id
  WHERE 
    CASE WHEN _show_settled 
      THEN (g.g_receipt_debt + g.g_additions_remaining + g.g_total_paid) > 0
           OR g.g_total_paid > 0
      ELSE (g.g_receipt_debt + g.g_additions_remaining) > 0
    END
  ORDER BY (g.g_receipt_debt + g.g_additions_remaining) DESC;
END;
$function$;
