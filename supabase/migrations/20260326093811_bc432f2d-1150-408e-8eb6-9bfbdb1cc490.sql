
CREATE OR REPLACE FUNCTION public.get_total_warehouse_value(p_tenant_id uuid, p_branch_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  inv_value numeric := 0;
  cash_bal numeric := 0;
  cust_debt numeric := 0;
  supp_debt numeric := 0;
  branch_breakdown jsonb := '[]'::jsonb;
BEGIN
  -- Build per-branch breakdown
  WITH 
  -- 1. Inventory value from products table (in_stock only)
  inv AS (
    SELECT 
      p.branch_id,
      b.name as branch_name,
      SUM(
        CASE 
          WHEN p.imei IS NOT NULL AND p.imei != '' THEN COALESCE(p.import_price, 0)
          ELSE COALESCE(NULLIF(p.total_import_cost, 0), p.import_price * p.quantity, 0)
        END
      ) as value
    FROM products p
    LEFT JOIN branches b ON b.id = p.branch_id
    WHERE p.tenant_id = p_tenant_id
      AND p.status = 'in_stock'
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
    GROUP BY p.branch_id, b.name
  ),
  -- 2. Cash book balance
  cb AS (
    SELECT 
      c.branch_id,
      COALESCE(b.name, 'Không xác định') as branch_name,
      SUM(CASE WHEN c.type = 'income' THEN c.amount ELSE -c.amount END) as value
    FROM cash_book c
    LEFT JOIN branches b ON b.id = c.branch_id
    WHERE c.tenant_id = p_tenant_id
      AND (p_branch_id IS NULL OR c.branch_id = p_branch_id)
    GROUP BY c.branch_id, b.name
  ),
  -- 3. Customer debt = (export receipts debt) + (manual additions) - (payments)
  cd_invoices AS (
    SELECT 
      er.branch_id,
      COALESCE(b.name, 'Không xác định') as branch_name,
      SUM(COALESCE(er.debt_amount, 0)) as debt_total
    FROM export_receipts er
    LEFT JOIN branches b ON b.id = er.branch_id
    WHERE er.tenant_id = p_tenant_id
      AND er.status != 'cancelled'
      AND COALESCE(er.debt_amount, 0) > 0
      AND (p_branch_id IS NULL OR er.branch_id = p_branch_id)
    GROUP BY er.branch_id, b.name
  ),
  cd_additions AS (
    SELECT
      dp.branch_id,
      COALESCE(b.name, 'Không xác định') as branch_name,
      SUM(dp.amount) as added
    FROM debt_payments dp
    LEFT JOIN branches b ON b.id = dp.branch_id
    WHERE dp.entity_type = 'customer'
      AND dp.payment_type = 'addition'
      AND dp.tenant_id = p_tenant_id
      AND (p_branch_id IS NULL OR dp.branch_id = p_branch_id)
    GROUP BY dp.branch_id, b.name
  ),
  cd_payments AS (
    SELECT 
      dp.branch_id,
      COALESCE(b.name, 'Không xác định') as branch_name,
      SUM(dp.amount) as paid
    FROM debt_payments dp
    LEFT JOIN branches b ON b.id = dp.branch_id
    WHERE dp.entity_type = 'customer'
      AND dp.payment_type = 'payment'
      AND dp.tenant_id = p_tenant_id
      AND (p_branch_id IS NULL OR dp.branch_id = p_branch_id)
    GROUP BY dp.branch_id, b.name
  ),
  -- 4. Supplier debt
  sd_invoices AS (
    SELECT 
      ir.branch_id,
      COALESCE(b.name, 'Không xác định') as branch_name,
      SUM(COALESCE(ir.debt_amount, 0)) as debt_total
    FROM import_receipts ir
    LEFT JOIN branches b ON b.id = ir.branch_id
    WHERE ir.tenant_id = p_tenant_id
      AND ir.status != 'cancelled'
      AND COALESCE(ir.debt_amount, 0) > 0
      AND (p_branch_id IS NULL OR ir.branch_id = p_branch_id)
    GROUP BY ir.branch_id, b.name
  ),
  sd_additions AS (
    SELECT
      dp.branch_id,
      COALESCE(b.name, 'Không xác định') as branch_name,
      SUM(dp.amount) as added
    FROM debt_payments dp
    LEFT JOIN branches b ON b.id = dp.branch_id
    WHERE dp.entity_type = 'supplier'
      AND dp.payment_type = 'addition'
      AND dp.tenant_id = p_tenant_id
      AND (p_branch_id IS NULL OR dp.branch_id = p_branch_id)
    GROUP BY dp.branch_id, b.name
  ),
  sd_payments AS (
    SELECT
      dp.branch_id,
      COALESCE(b.name, 'Không xác định') as branch_name,
      SUM(dp.amount) as paid
    FROM debt_payments dp
    LEFT JOIN branches b ON b.id = dp.branch_id
    WHERE dp.entity_type = 'supplier'
      AND dp.payment_type = 'payment'
      AND dp.tenant_id = p_tenant_id
      AND (p_branch_id IS NULL OR dp.branch_id = p_branch_id)
    GROUP BY dp.branch_id, b.name
  ),
  -- Collect all branches
  all_branches AS (
    SELECT DISTINCT branch_id, branch_name FROM inv WHERE branch_id IS NOT NULL
    UNION SELECT DISTINCT branch_id, branch_name FROM cb WHERE branch_id IS NOT NULL
    UNION SELECT DISTINCT branch_id, branch_name FROM cd_invoices WHERE branch_id IS NOT NULL
    UNION SELECT DISTINCT branch_id, branch_name FROM sd_invoices WHERE branch_id IS NOT NULL
  ),
  combined AS (
    SELECT 
      ab.branch_id,
      ab.branch_name,
      COALESCE(i.value, 0) as inventory_value,
      COALESCE(c.value, 0) as cash_balance,
      GREATEST(0, COALESCE(cdi.debt_total, 0) + COALESCE(cda.added, 0) - COALESCE(cdp.paid, 0)) as customer_debt,
      GREATEST(0, COALESCE(sdi.debt_total, 0) + COALESCE(sda.added, 0) - COALESCE(sdp.paid, 0)) as supplier_debt
    FROM all_branches ab
    LEFT JOIN inv i ON i.branch_id = ab.branch_id
    LEFT JOIN cb c ON c.branch_id = ab.branch_id
    LEFT JOIN cd_invoices cdi ON cdi.branch_id = ab.branch_id
    LEFT JOIN cd_additions cda ON cda.branch_id = ab.branch_id
    LEFT JOIN cd_payments cdp ON cdp.branch_id = ab.branch_id
    LEFT JOIN sd_invoices sdi ON sdi.branch_id = ab.branch_id
    LEFT JOIN sd_additions sda ON sda.branch_id = ab.branch_id
    LEFT JOIN sd_payments sdp ON sdp.branch_id = ab.branch_id
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'branchId', branch_id,
      'branchName', branch_name,
      'inventoryValue', inventory_value,
      'cashBalance', cash_balance,
      'customerDebt', customer_debt,
      'supplierDebt', supplier_debt,
      'totalValue', inventory_value + cash_balance + customer_debt - supplier_debt
    )
  ), '[]'::jsonb) INTO branch_breakdown
  FROM combined;

  -- Totals
  SELECT 
    COALESCE(SUM((b->>'inventoryValue')::numeric), 0),
    COALESCE(SUM((b->>'cashBalance')::numeric), 0),
    COALESCE(SUM((b->>'customerDebt')::numeric), 0),
    COALESCE(SUM((b->>'supplierDebt')::numeric), 0)
  INTO inv_value, cash_bal, cust_debt, supp_debt
  FROM jsonb_array_elements(branch_breakdown) b;

  result := jsonb_build_object(
    'inventoryValue', inv_value,
    'cashBalance', cash_bal,
    'customerDebt', cust_debt,
    'supplierDebt', supp_debt,
    'totalValue', inv_value + cash_bal + cust_debt - supp_debt,
    'branches', branch_breakdown
  );

  RETURN result;
END;
$$;
