
CREATE OR REPLACE FUNCTION public.get_total_warehouse_value(p_tenant_id uuid, p_branch_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  branch_breakdown jsonb := '[]'::jsonb;
BEGIN
  WITH
  -- 1. Inventory value from products (same logic as get_inventory_summary)
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
  -- 2. Cash book balance (income - expense) per branch
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
  -- 3. Customer debt (remaining) = receipt debt_amount + manual additions (unallocated)
  -- Same logic as get_customer_debt_summary
  cd AS (
    SELECT
      COALESCE(er.branch_id, dp_branch.branch_id) as branch_id,
      COALESCE(b1.name, b2.name, 'Không xác định') as branch_name,
      COALESCE(er_debt, 0) + COALESCE(add_remaining, 0) as value
    FROM (
      SELECT customer_id, branch_id, SUM(debt_amount) as er_debt
      FROM export_receipts
      WHERE tenant_id = p_tenant_id
        AND status IN ('completed', 'partial_return', 'full_return')
        AND (p_branch_id IS NULL OR branch_id = p_branch_id)
      GROUP BY customer_id, branch_id
    ) er
    FULL OUTER JOIN (
      SELECT entity_id::uuid as customer_id, branch_id,
        SUM(CASE WHEN payment_type = 'addition' THEN amount - COALESCE(allocated_amount, 0) ELSE 0 END) as add_remaining
      FROM debt_payments
      WHERE entity_type = 'customer'
        AND payment_type = 'addition'
        AND EXISTS (SELECT 1 FROM customers c WHERE c.id = entity_id::uuid AND c.tenant_id = p_tenant_id)
        AND (p_branch_id IS NULL OR branch_id = p_branch_id)
      GROUP BY entity_id, branch_id
    ) dp_branch ON dp_branch.customer_id = er.customer_id
    LEFT JOIN branches b1 ON b1.id = er.branch_id
    LEFT JOIN branches b2 ON b2.id = dp_branch.branch_id
  ),
  -- 4. Supplier debt (remaining) = receipt debt_amount + manual additions (unallocated)
  -- Same logic as get_supplier_debt_summary
  sd AS (
    SELECT
      COALESCE(ir.branch_id, dp_branch.branch_id) as branch_id,
      COALESCE(b1.name, b2.name, 'Không xác định') as branch_name,
      COALESCE(ir_debt, 0) + COALESCE(add_remaining, 0) as value
    FROM (
      SELECT supplier_id, branch_id, SUM(debt_amount) as ir_debt
      FROM import_receipts
      WHERE tenant_id = p_tenant_id
        AND status::text IN ('completed', 'partial_return', 'full_return')
        AND (p_branch_id IS NULL OR branch_id = p_branch_id)
      GROUP BY supplier_id, branch_id
    ) ir
    FULL OUTER JOIN (
      SELECT entity_id::uuid as supplier_id, branch_id,
        SUM(CASE WHEN payment_type = 'addition' THEN amount - COALESCE(allocated_amount, 0) ELSE 0 END) as add_remaining
      FROM debt_payments
      WHERE entity_type = 'supplier'
        AND payment_type = 'addition'
        AND EXISTS (SELECT 1 FROM suppliers s WHERE s.id = entity_id::uuid AND s.tenant_id = p_tenant_id)
        AND (p_branch_id IS NULL OR branch_id = p_branch_id)
      GROUP BY entity_id, branch_id
    ) dp_branch ON dp_branch.supplier_id = ir.supplier_id
    LEFT JOIN branches b1 ON b1.id = ir.branch_id
    LEFT JOIN branches b2 ON b2.id = dp_branch.branch_id
  ),
  -- Aggregate all branches
  all_branches AS (
    SELECT id, name FROM branches WHERE tenant_id = p_tenant_id AND (p_branch_id IS NULL OR id = p_branch_id)
  ),
  per_branch AS (
    SELECT
      ab.id as bid,
      ab.name as bname,
      COALESCE(SUM(inv.value), 0) as inv_val,
      COALESCE((SELECT SUM(cb2.value) FROM cb cb2 WHERE cb2.branch_id = ab.id), 0) as cash_val,
      COALESCE((SELECT SUM(cd2.value) FROM cd cd2 WHERE cd2.branch_id = ab.id), 0) as cust_val,
      COALESCE((SELECT SUM(sd2.value) FROM sd sd2 WHERE sd2.branch_id = ab.id), 0) as supp_val
    FROM all_branches ab
    LEFT JOIN inv ON inv.branch_id = ab.id
    GROUP BY ab.id, ab.name
  )
  SELECT jsonb_build_object(
    'inventoryValue', COALESCE((SELECT SUM(inv_val) FROM per_branch), 0),
    'cashBalance', COALESCE((SELECT SUM(cash_val) FROM per_branch), 0),
    'customerDebt', COALESCE((SELECT SUM(cust_val) FROM per_branch), 0),
    'supplierDebt', COALESCE((SELECT SUM(supp_val) FROM per_branch), 0),
    'totalValue', COALESCE((SELECT SUM(inv_val + cash_val + cust_val - supp_val) FROM per_branch), 0),
    'branches', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'branchId', bid,
          'branchName', bname,
          'inventoryValue', inv_val,
          'cashBalance', cash_val,
          'customerDebt', cust_val,
          'supplierDebt', supp_val,
          'totalValue', inv_val + cash_val + cust_val - supp_val
        ) ORDER BY (inv_val + cash_val + cust_val - supp_val) DESC
      ) FROM per_branch),
      '[]'::jsonb
    )
  ) INTO result;

  RETURN result;
END;
$$;
