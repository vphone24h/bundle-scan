DELETE FROM public.warehouse_value_snapshots WHERE snapshot_date < CURRENT_DATE;

CREATE OR REPLACE FUNCTION public.backfill_warehouse_snapshots_v2(_tid UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d DATE;
  v_day_end TIMESTAMPTZ;
  inv_imei NUMERIC := 0;
  inv_non_imei NUMERIC := 0;
  inv_val NUMERIC := 0;
  cash_val NUMERIC := 0;
  cust_debt NUMERIC := 0;
  supp_debt NUMERIC := 0;
  inserted INT := 0;
  start_date DATE;
  tid_text TEXT := _tid::TEXT;
BEGIN
  SELECT LEAST(
    COALESCE((SELECT MIN(import_date::DATE) FROM public.products WHERE tenant_id = _tid AND import_date IS NOT NULL), CURRENT_DATE),
    COALESCE((SELECT MIN(transaction_date::DATE) FROM public.cash_book WHERE tenant_id = _tid), CURRENT_DATE),
    COALESCE((SELECT MIN(created_at::DATE) FROM public.debt_payments WHERE tenant_id = _tid), CURRENT_DATE),
    COALESCE((SELECT MIN(return_date::DATE) FROM public.export_returns WHERE tenant_id = _tid), CURRENT_DATE),
    COALESCE((SELECT MIN(return_date::DATE) FROM public.import_returns WHERE tenant_id = _tid), CURRENT_DATE)
  ) INTO start_date;

  FOR d IN SELECT generate_series(start_date, CURRENT_DATE - 1, '1 day'::INTERVAL)::DATE
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.warehouse_value_snapshots
      WHERE tenant_id = tid_text
        AND snapshot_date = d
        AND branch_id IS NULL
    ) THEN
      CONTINUE;
    END IF;

    v_day_end := (d + 1)::timestamp;

    WITH sold_imei AS (
      SELECT ei.imei, MAX(er.created_at) AS last_sold_at
      FROM public.export_receipt_items ei
      JOIN public.export_receipts er ON er.id = ei.receipt_id
      WHERE er.tenant_id = _tid
        AND COALESCE(ei.imei, '') <> ''
        AND er.created_at < v_day_end
      GROUP BY ei.imei
    ),
    customer_return_imei AS (
      SELECT ret.imei, MAX(ret.return_date) AS last_return_at
      FROM public.export_returns ret
      WHERE ret.tenant_id = _tid
        AND COALESCE(ret.imei, '') <> ''
        AND ret.return_date < v_day_end
      GROUP BY ret.imei
    ),
    supplier_return_imei AS (
      SELECT ret.imei, MAX(ret.return_date) AS last_supplier_return_at
      FROM public.import_returns ret
      WHERE ret.tenant_id = _tid
        AND COALESCE(ret.imei, '') <> ''
        AND ret.return_date < v_day_end
      GROUP BY ret.imei
    )
    SELECT COALESCE(SUM(p.import_price), 0)
    INTO inv_imei
    FROM public.products p
    LEFT JOIN sold_imei s ON s.imei = p.imei
    LEFT JOIN customer_return_imei cr ON cr.imei = p.imei
    LEFT JOIN supplier_return_imei sr ON sr.imei = p.imei
    WHERE p.tenant_id = _tid
      AND COALESCE(p.imei, '') <> ''
      AND p.status <> 'deleted'
      AND p.import_price IS NOT NULL
      AND p.import_price > 0
      AND p.import_date < v_day_end
      AND CASE
        WHEN COALESCE(sr.last_supplier_return_at, '-infinity'::timestamptz) >= GREATEST(
          p.import_date,
          COALESCE(s.last_sold_at, '-infinity'::timestamptz),
          COALESCE(cr.last_return_at, '-infinity'::timestamptz)
        ) THEN FALSE
        WHEN COALESCE(cr.last_return_at, '-infinity'::timestamptz) >= GREATEST(
          p.import_date,
          COALESCE(s.last_sold_at, '-infinity'::timestamptz),
          COALESCE(sr.last_supplier_return_at, '-infinity'::timestamptz)
        ) THEN TRUE
        WHEN COALESCE(s.last_sold_at, '-infinity'::timestamptz) >= GREATEST(
          p.import_date,
          COALESCE(cr.last_return_at, '-infinity'::timestamptz),
          COALESCE(sr.last_supplier_return_at, '-infinity'::timestamptz)
        ) THEN FALSE
        ELSE TRUE
      END;

    WITH imported AS (
      SELECT pi.product_id,
             SUM(COALESCE(pi.quantity, 0)) AS imported_qty,
             SUM(COALESCE(pi.quantity, 0) * COALESCE(pi.import_price, 0)) AS imported_cost
      FROM public.product_imports pi
      JOIN public.products p ON p.id = pi.product_id
      WHERE p.tenant_id = _tid
        AND (p.imei IS NULL OR p.imei = '')
        AND p.status <> 'deleted'
        AND pi.import_date < v_day_end
      GROUP BY pi.product_id
    ),
    sold AS (
      SELECT ei.product_id,
             SUM(COALESCE(ei.quantity, 0)) AS sold_qty
      FROM public.export_receipt_items ei
      JOIN public.export_receipts er ON er.id = ei.receipt_id
      JOIN public.products p ON p.id = ei.product_id
      WHERE er.tenant_id = _tid
        AND ei.product_id IS NOT NULL
        AND (p.imei IS NULL OR p.imei = '')
        AND p.status <> 'deleted'
        AND er.created_at < v_day_end
      GROUP BY ei.product_id
    ),
    customer_returns AS (
      SELECT ret.product_id,
             SUM(COALESCE(ret.quantity, 0)) AS return_qty,
             SUM(COALESCE(ret.quantity, 0) * COALESCE(ret.import_price, 0)) AS return_cost
      FROM public.export_returns ret
      JOIN public.products p ON p.id = ret.product_id
      WHERE ret.tenant_id = _tid
        AND ret.product_id IS NOT NULL
        AND (p.imei IS NULL OR p.imei = '')
        AND p.status <> 'deleted'
        AND ret.return_date < v_day_end
      GROUP BY ret.product_id
    ),
    supplier_returns AS (
      SELECT ret.product_id,
             SUM(COALESCE(ret.quantity, 0)) AS return_qty,
             SUM(COALESCE(ret.quantity, 0) * COALESCE(ret.import_price, 0)) AS return_cost
      FROM public.import_returns ret
      JOIN public.products p ON p.id = ret.product_id
      WHERE ret.tenant_id = _tid
        AND ret.product_id IS NOT NULL
        AND (p.imei IS NULL OR p.imei = '')
        AND p.status <> 'deleted'
        AND ret.return_date < v_day_end
      GROUP BY ret.product_id
    )
    SELECT COALESCE(SUM(
      GREATEST(
        COALESCE(i.imported_qty, 0)
        + COALESCE(cr.return_qty, 0)
        - COALESCE(s.sold_qty, 0)
        - COALESCE(sr.return_qty, 0),
        0
      ) *
      CASE
        WHEN NULLIF(
          COALESCE(i.imported_qty, 0)
          + COALESCE(cr.return_qty, 0)
          - COALESCE(sr.return_qty, 0),
          0
        ) IS NULL THEN 0
        ELSE (
          COALESCE(i.imported_cost, 0)
          + COALESCE(cr.return_cost, 0)
          - COALESCE(sr.return_cost, 0)
        ) / NULLIF(
          COALESCE(i.imported_qty, 0)
          + COALESCE(cr.return_qty, 0)
          - COALESCE(sr.return_qty, 0),
          0
        )
      END
    ), 0)
    INTO inv_non_imei
    FROM public.products p
    LEFT JOIN imported i ON i.product_id = p.id
    LEFT JOIN sold s ON s.product_id = p.id
    LEFT JOIN customer_returns cr ON cr.product_id = p.id
    LEFT JOIN supplier_returns sr ON sr.product_id = p.id
    WHERE p.tenant_id = _tid
      AND (p.imei IS NULL OR p.imei = '')
      AND p.status <> 'deleted';

    inv_val := COALESCE(inv_imei, 0) + COALESCE(inv_non_imei, 0);

    SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)
    INTO cash_val
    FROM public.cash_book
    WHERE tenant_id = _tid
      AND transaction_date::DATE <= d;

    SELECT COALESCE(SUM(CASE WHEN payment_type = 'debt_increase' THEN amount WHEN payment_type = 'debt_payment' THEN -amount ELSE 0 END), 0)
    INTO cust_debt
    FROM public.debt_payments
    WHERE tenant_id = _tid
      AND entity_type = 'customer'
      AND created_at::DATE <= d;
    IF cust_debt < 0 THEN cust_debt := 0; END IF;

    SELECT COALESCE(SUM(CASE WHEN payment_type = 'debt_increase' THEN amount WHEN payment_type = 'debt_payment' THEN -amount ELSE 0 END), 0)
    INTO supp_debt
    FROM public.debt_payments
    WHERE tenant_id = _tid
      AND entity_type = 'supplier'
      AND created_at::DATE <= d;
    IF supp_debt < 0 THEN supp_debt := 0; END IF;

    INSERT INTO public.warehouse_value_snapshots (
      tenant_id, branch_id, snapshot_date,
      inventory_value, cash_balance, customer_debt, supplier_debt, total_value
    ) VALUES (
      tid_text, NULL, d,
      inv_val, cash_val, cust_debt, supp_debt,
      inv_val + cash_val + cust_debt - supp_debt
    );

    inserted := inserted + 1;
  END LOOP;

  RETURN inserted;
END;
$$;