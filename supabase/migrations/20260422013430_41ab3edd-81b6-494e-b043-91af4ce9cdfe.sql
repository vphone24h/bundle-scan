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
  processed INT := 0;
  start_date DATE;
BEGIN
  SELECT GREATEST(
    LEAST(
      COALESCE((SELECT MIN(import_date::DATE) FROM public.products WHERE tenant_id = _tid AND import_date IS NOT NULL), CURRENT_DATE),
      COALESCE((SELECT MIN(transaction_date::DATE) FROM public.cash_book WHERE tenant_id = _tid), CURRENT_DATE),
      COALESCE((SELECT MIN(created_at::DATE) FROM public.debt_payments WHERE tenant_id = _tid), CURRENT_DATE),
      COALESCE((SELECT MIN(export_date::DATE) FROM public.export_receipts WHERE tenant_id = _tid), CURRENT_DATE),
      COALESCE((SELECT MIN(import_date::DATE) FROM public.import_receipts WHERE tenant_id = _tid), CURRENT_DATE),
      COALESCE((SELECT MIN(return_date::DATE) FROM public.export_returns WHERE tenant_id = _tid), CURRENT_DATE),
      COALESCE((SELECT MIN(return_date::DATE) FROM public.import_returns WHERE tenant_id = _tid), CURRENT_DATE)
    ),
    CURRENT_DATE - 90
  ) INTO start_date;

  FOR d IN SELECT generate_series(start_date, CURRENT_DATE - 1, '1 day'::INTERVAL)::DATE
  LOOP
    v_day_end := (d + 1)::timestamp;

    WITH imei_events AS (
      SELECT
        p.id,
        p.import_price,
        p.import_date,
        GREATEST(
          COALESCE(sold.valid_sold_at, '-infinity'::timestamptz),
          COALESCE(cust_return.valid_customer_return_at, '-infinity'::timestamptz),
          COALESCE(supp_return.valid_supplier_return_at, '-infinity'::timestamptz),
          p.import_date
        ) AS latest_event_at,
        sold.valid_sold_at,
        cust_return.valid_customer_return_at,
        supp_return.valid_supplier_return_at
      FROM public.products p
      LEFT JOIN LATERAL (
        SELECT MAX(er.export_date) AS valid_sold_at
        FROM public.export_receipt_items ei
        JOIN public.export_receipts er ON er.id = ei.receipt_id
        WHERE er.tenant_id = _tid
          AND COALESCE(ei.imei, '') = COALESCE(p.imei, '')
          AND er.status IN ('completed', 'partial_return', 'full_return')
          AND er.export_date >= p.import_date
          AND er.export_date < v_day_end
      ) sold ON TRUE
      LEFT JOIN LATERAL (
        SELECT MAX(ret.return_date) AS valid_customer_return_at
        FROM public.export_returns ret
        WHERE ret.tenant_id = _tid
          AND COALESCE(ret.imei, '') = COALESCE(p.imei, '')
          AND ret.return_date >= p.import_date
          AND ret.return_date < v_day_end
      ) cust_return ON TRUE
      LEFT JOIN LATERAL (
        SELECT MAX(ret.return_date) AS valid_supplier_return_at
        FROM public.import_returns ret
        WHERE ret.tenant_id = _tid
          AND COALESCE(ret.imei, '') = COALESCE(p.imei, '')
          AND ret.return_date >= p.import_date
          AND ret.return_date < v_day_end
      ) supp_return ON TRUE
      WHERE p.tenant_id = _tid
        AND COALESCE(p.imei, '') <> ''
        AND p.status <> 'deleted'
        AND COALESCE(p.import_price, 0) > 0
        AND p.import_date < v_day_end
    )
    SELECT COALESCE(SUM(import_price), 0)
    INTO inv_imei
    FROM imei_events s
    WHERE CASE
      WHEN s.latest_event_at = s.supp_return.valid_supplier_return_at THEN FALSE
      WHEN s.latest_event_at = s.sold.valid_sold_at THEN FALSE
      ELSE TRUE
    END;

    WITH imported AS (
      SELECT pi.product_id,
             SUM(COALESCE(pi.quantity, 0)) AS imported_qty,
             SUM(COALESCE(pi.quantity, 0) * COALESCE(pi.import_price, 0)) AS imported_cost
      FROM public.product_imports pi
      JOIN public.products p ON p.id = pi.product_id
      WHERE p.tenant_id = _tid
        AND COALESCE(p.imei, '') = ''
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
        AND er.status IN ('completed', 'partial_return', 'full_return')
        AND ei.product_id IS NOT NULL
        AND COALESCE(p.imei, '') = ''
        AND p.status <> 'deleted'
        AND er.export_date < v_day_end
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
        AND COALESCE(p.imei, '') = ''
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
        AND COALESCE(p.imei, '') = ''
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
      AND COALESCE(p.imei, '') = ''
      AND p.status <> 'deleted';

    inv_val := COALESCE(inv_imei, 0) + COALESCE(inv_non_imei, 0);

    SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)
    INTO cash_val
    FROM public.cash_book
    WHERE tenant_id = _tid
      AND transaction_date < v_day_end;

    SELECT GREATEST(
      COALESCE((
        SELECT SUM(COALESCE(original_debt_amount, debt_amount, 0))
        FROM public.export_receipts
        WHERE tenant_id = _tid
          AND status IN ('completed', 'partial_return', 'full_return')
          AND export_date < v_day_end
      ), 0)
      + COALESCE((
        SELECT SUM(amount)
        FROM public.debt_payments
        WHERE tenant_id = _tid
          AND entity_type = 'customer'
          AND payment_type = 'addition'
          AND created_at < v_day_end
      ), 0)
      - COALESCE((
        SELECT SUM(amount)
        FROM public.debt_payments
        WHERE tenant_id = _tid
          AND entity_type = 'customer'
          AND payment_type = 'payment'
          AND created_at < v_day_end
      ), 0),
      0
    )
    INTO cust_debt;

    SELECT GREATEST(
      COALESCE((
        SELECT SUM(COALESCE(original_debt_amount, debt_amount, 0))
        FROM public.import_receipts
        WHERE tenant_id = _tid
          AND status::text IN ('completed', 'partial_return', 'full_return')
          AND import_date < v_day_end
      ), 0)
      + COALESCE((
        SELECT SUM(amount)
        FROM public.debt_payments
        WHERE tenant_id = _tid
          AND entity_type = 'supplier'
          AND payment_type = 'addition'
          AND created_at < v_day_end
      ), 0)
      - COALESCE((
        SELECT SUM(amount)
        FROM public.debt_payments
        WHERE tenant_id = _tid
          AND entity_type = 'supplier'
          AND payment_type = 'payment'
          AND created_at < v_day_end
      ), 0),
      0
    )
    INTO supp_debt;

    INSERT INTO public.warehouse_value_snapshots (
      tenant_id, branch_id, snapshot_date,
      inventory_value, cash_balance, customer_debt, supplier_debt, total_value
    ) VALUES (
      _tid::text, NULL, d,
      inv_val, cash_val, cust_debt, supp_debt,
      inv_val + cash_val + cust_debt - supp_debt
    )
    ON CONFLICT (tenant_id, snapshot_date) WHERE branch_id IS NULL
    DO UPDATE SET
      inventory_value = EXCLUDED.inventory_value,
      cash_balance = EXCLUDED.cash_balance,
      customer_debt = EXCLUDED.customer_debt,
      supplier_debt = EXCLUDED.supplier_debt,
      total_value = EXCLUDED.total_value;

    processed := processed + 1;
  END LOOP;

  RETURN processed;
END;
$$;