
CREATE OR REPLACE FUNCTION public.get_total_warehouse_value(p_tenant_id uuid, p_branch_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  inv_value numeric := 0;
  cash_balance numeric := 0;
  customer_debt numeric := 0;
  supplier_debt numeric := 0;
  branch_breakdown jsonb := '[]'::jsonb;
BEGIN
  -- 1. Inventory value by branch
  WITH inv AS (
    SELECT 
      pi2.branch_id,
      b.name as branch_name,
      SUM(
        CASE 
          WHEN pi2.imei IS NOT NULL AND pi2.imei != '' THEN COALESCE(pi2.import_price, 0)
          ELSE COALESCE(pi2.total_import_cost, pi2.import_price * pi2.quantity, 0)
        END
      ) as value
    FROM product_imports pi2
    JOIN branches b ON b.id = pi2.branch_id
    WHERE pi2.tenant_id = p_tenant_id
      AND pi2.status = 'in_stock'
      AND (p_branch_id IS NULL OR pi2.branch_id = p_branch_id)
    GROUP BY pi2.branch_id, b.name
  ),
  -- 2. Cash book balance by branch
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
  -- 3. Customer debt (remaining) by branch
  cd AS (
    SELECT 
      er.branch_id,
      COALESCE(b.name, 'Không xác định') as branch_name,
      SUM(
        COALESCE(eri.sale_price, 0) * 
        CASE WHEN eri.status = 'sold' THEN 1 WHEN eri.status = 'returned' THEN -1 ELSE 0 END
      ) as invoice_total
    FROM export_receipt_items eri
    JOIN export_receipts er ON er.id = eri.export_receipt_id
    LEFT JOIN branches b ON b.id = er.branch_id
    WHERE er.tenant_id = p_tenant_id
      AND er.status != 'cancelled'
      AND (p_branch_id IS NULL OR er.branch_id = p_branch_id)
    GROUP BY er.branch_id, b.name
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
  -- 4. Supplier debt by branch (from import receipts)
  sd AS (
    SELECT 
      ir.branch_id,
      COALESCE(b.name, 'Không xác định') as branch_name,
      SUM(COALESCE(ir.debt_amount, 0)) as debt_total
    FROM import_receipts ir
    LEFT JOIN branches b ON b.id = ir.branch_id
    WHERE ir.tenant_id = p_tenant_id
      AND ir.status != 'cancelled'
      AND (p_branch_id IS NULL OR ir.branch_id = p_branch_id)
    GROUP BY ir.branch_id, b.name
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
  -- Combine all branches
  all_branches AS (
    SELECT branch_id, branch_name FROM inv
    UNION SELECT branch_id, branch_name FROM cb WHERE branch_id IS NOT NULL
    UNION SELECT branch_id, branch_name FROM cd WHERE branch_id IS NOT NULL
    UNION SELECT branch_id, branch_name FROM sd WHERE branch_id IS NOT NULL
  ),
  combined AS (
    SELECT 
      ab.branch_id,
      ab.branch_name,
      COALESCE(i.value, 0) as inventory_value,
      COALESCE(c.value, 0) as cash_balance,
      GREATEST(0, COALESCE(cdinv.invoice_total, 0) + COALESCE(cdadd.added, 0) - COALESCE(cdpay.paid, 0)) as customer_debt,
      GREATEST(0, COALESCE(s.debt_total, 0) + COALESCE(sdadd.added, 0) - COALESCE(sdpay.paid, 0)) as supplier_debt
    FROM all_branches ab
    LEFT JOIN inv i ON i.branch_id = ab.branch_id
    LEFT JOIN cb c ON c.branch_id = ab.branch_id
    LEFT JOIN cd cdinv ON cdinv.branch_id = ab.branch_id
    LEFT JOIN cd_payments cdpay ON cdpay.branch_id = ab.branch_id
    LEFT JOIN cd_additions cdadd ON cdadd.branch_id = ab.branch_id
    LEFT JOIN sd s ON s.branch_id = ab.branch_id
    LEFT JOIN sd_payments sdpay ON sdpay.branch_id = ab.branch_id
    LEFT JOIN sd_additions sdadd ON sdadd.branch_id = ab.branch_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'branchId', branch_id,
      'branchName', branch_name,
      'inventoryValue', inventory_value,
      'cashBalance', cash_balance,
      'customerDebt', customer_debt,
      'supplierDebt', supplier_debt,
      'totalValue', inventory_value + cash_balance + customer_debt - supplier_debt
    )
  ) INTO branch_breakdown
  FROM combined;

  -- Totals
  SELECT 
    COALESCE(SUM((b->>'inventoryValue')::numeric), 0),
    COALESCE(SUM((b->>'cashBalance')::numeric), 0),
    COALESCE(SUM((b->>'customerDebt')::numeric), 0),
    COALESCE(SUM((b->>'supplierDebt')::numeric), 0)
  INTO inv_value, cash_balance, customer_debt, supplier_debt
  FROM jsonb_array_elements(COALESCE(branch_breakdown, '[]'::jsonb)) b;

  result := jsonb_build_object(
    'inventoryValue', inv_value,
    'cashBalance', cash_balance,
    'customerDebt', customer_debt,
    'supplierDebt', supplier_debt,
    'totalValue', inv_value + cash_balance + customer_debt - supplier_debt,
    'branches', COALESCE(branch_breakdown, '[]'::jsonb)
  );

  RETURN result;
END;
$$;
