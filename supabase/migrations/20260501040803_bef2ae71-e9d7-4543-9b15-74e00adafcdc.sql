DROP FUNCTION IF EXISTS public.confirm_stock_count(uuid);

CREATE OR REPLACE FUNCTION public.confirm_stock_count(p_stock_count_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid := public.get_user_tenant_id_secure();
  v_stock_count public.stock_counts%ROWTYPE;
  v_item RECORD;
  v_product RECORD;
  v_export_receipt_id uuid := NULL;
  v_import_receipt_id uuid := NULL;
  v_export_code text;
  v_import_code text;
  v_remaining_qty numeric := 0;
  v_processed_qty numeric := 0;
  v_current_qty numeric := 0;
  v_current_total_cost numeric := 0;
  v_avg_price numeric := 0;
  v_new_qty numeric := 0;
  v_new_total_cost numeric := 0;
  v_surplus_cost numeric := 0;
  v_missing_items_count integer := 0;
  v_surplus_items_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Chưa đăng nhập';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy tenant';
  END IF;

  SELECT *
  INTO v_stock_count
  FROM public.stock_counts
  WHERE id = p_stock_count_id
    AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy phiếu kiểm kho';
  END IF;

  IF v_stock_count.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Phiếu kiểm kho không còn ở trạng thái nháp';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.stock_count_items
    WHERE stock_count_id = p_stock_count_id
  ) THEN
    RAISE EXCEPTION 'Phiếu kiểm kho chưa có sản phẩm';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stock_count_items
    WHERE stock_count_id = p_stock_count_id
      AND has_imei = true
      AND COALESCE(variance, 0) <> 0
      AND imei IS NULL
  ) THEN
    RAISE EXCEPTION 'Có dòng kiểm kho IMEI chưa hợp lệ';
  END IF;

  FOR v_item IN
    SELECT *
    FROM public.stock_count_items
    WHERE stock_count_id = p_stock_count_id
    ORDER BY created_at ASC, id ASC
  LOOP
    IF COALESCE(v_item.variance, 0)::numeric < 0 THEN
      IF v_export_receipt_id IS NULL THEN
        v_export_code := 'XDC' || to_char(clock_timestamp(), 'DDHH24MISS');

        INSERT INTO public.export_receipts (
          code,
          tenant_id,
          branch_id,
          export_date,
          created_by,
          customer_id,
          total_amount,
          paid_amount,
          debt_amount,
          status,
          note
        ) VALUES (
          v_export_code,
          v_tenant_id,
          v_stock_count.branch_id,
          now(),
          v_user_id,
          NULL,
          0,
          0,
          0,
          'completed',
          'Điều chỉnh kho - Hao hụt từ phiếu kiểm kho ' || v_stock_count.code
        )
        RETURNING id INTO v_export_receipt_id;
      END IF;

      v_missing_items_count := v_missing_items_count + 1;

      IF v_item.has_imei = true AND v_item.product_id IS NOT NULL THEN
        UPDATE public.products
        SET status = 'sold'
        WHERE id = v_item.product_id
          AND tenant_id = v_tenant_id;

        INSERT INTO public.export_receipt_items (
          receipt_id,
          product_id,
          product_name,
          sku,
          imei,
          sale_price,
          quantity,
          status,
          note
        ) VALUES (
          v_export_receipt_id,
          v_item.product_id,
          v_item.product_name,
          v_item.sku,
          v_item.imei,
          0,
          1,
          'sold',
          'Hao hụt - Kiểm kho'
        );
      ELSE
        v_remaining_qty := abs(COALESCE(v_item.variance, 0)::numeric);

        FOR v_product IN
          SELECT id, quantity, total_import_cost, import_price, status
          FROM public.products
          WHERE tenant_id = v_tenant_id
            AND branch_id IS NOT DISTINCT FROM v_stock_count.branch_id
            AND imei IS NULL
            AND status = 'in_stock'
            AND name = v_item.product_name
            AND sku = v_item.sku
            AND COALESCE(quantity, 0) > 0
          ORDER BY import_date ASC NULLS LAST, created_at ASC NULLS LAST, id ASC
        LOOP
          EXIT WHEN v_remaining_qty <= 0;

          v_current_qty := COALESCE(v_product.quantity, 0)::numeric;
          IF v_current_qty <= 0 THEN
            CONTINUE;
          END IF;

          v_processed_qty := LEAST(v_current_qty, v_remaining_qty);
          v_current_total_cost := COALESCE(v_product.total_import_cost, 0)::numeric;
          v_avg_price := CASE
            WHEN v_current_qty > 0 THEN v_current_total_cost / v_current_qty
            ELSE COALESCE(v_product.import_price, v_item.import_price, 0)::numeric
          END;
          v_new_qty := ROUND((v_current_qty - v_processed_qty)::numeric, 3);
          v_new_total_cost := GREATEST(0, ROUND((v_current_total_cost - (v_avg_price * v_processed_qty))::numeric, 3));

          UPDATE public.products
          SET
            quantity = CASE WHEN v_new_qty <= 0 THEN 0 ELSE v_new_qty END,
            total_import_cost = CASE WHEN v_new_qty <= 0 THEN 0 ELSE v_new_total_cost END,
            status = CASE WHEN v_new_qty <= 0 THEN 'sold' ELSE status END
          WHERE id = v_product.id
            AND tenant_id = v_tenant_id;

          v_remaining_qty := ROUND((v_remaining_qty - v_processed_qty)::numeric, 3);
        END LOOP;

        IF v_remaining_qty > 0 THEN
          RAISE EXCEPTION 'Không đủ tồn kho để xác nhận kiểm kho cho sản phẩm % (%). Còn thiếu %', v_item.product_name, v_item.sku, v_remaining_qty;
        END IF;

        INSERT INTO public.export_receipt_items (
          receipt_id,
          product_id,
          product_name,
          sku,
          imei,
          sale_price,
          quantity,
          status,
          note
        ) VALUES (
          v_export_receipt_id,
          NULL,
          v_item.product_name,
          v_item.sku,
          NULL,
          0,
          abs(COALESCE(v_item.variance, 0)::numeric),
          'sold',
          'Hao hụt ' || abs(COALESCE(v_item.variance, 0)::numeric) || ' sản phẩm - Kiểm kho'
        );
      END IF;
    ELSIF COALESCE(v_item.variance, 0)::numeric > 0 THEN
      IF v_import_receipt_id IS NULL THEN
        v_import_code := 'NDC' || to_char(clock_timestamp(), 'DDHH24MISS');

        INSERT INTO public.import_receipts (
          code,
          tenant_id,
          branch_id,
          import_date,
          created_by,
          supplier_id,
          total_amount,
          paid_amount,
          debt_amount,
          status,
          note
        ) VALUES (
          v_import_code,
          v_tenant_id,
          v_stock_count.branch_id,
          now(),
          v_user_id,
          NULL,
          0,
          0,
          0,
          'completed',
          'Điều chỉnh kho - Bổ sung từ phiếu kiểm kho ' || v_stock_count.code
        )
        RETURNING id INTO v_import_receipt_id;
      END IF;

      v_surplus_items_count := v_surplus_items_count + 1;

      IF v_item.has_imei = true THEN
        INSERT INTO public.products (
          tenant_id,
          name,
          sku,
          imei,
          quantity,
          import_price,
          total_import_cost,
          import_date,
          import_receipt_id,
          branch_id,
          status,
          note
        ) VALUES (
          v_tenant_id,
          v_item.product_name,
          v_item.sku,
          v_item.imei,
          1,
          COALESCE(v_item.import_price, 0)::numeric,
          COALESCE(v_item.import_price, 0)::numeric,
          now(),
          v_import_receipt_id,
          v_stock_count.branch_id,
          'in_stock',
          'Bổ sung từ kiểm kho ' || v_stock_count.code
        );
      ELSE
        v_surplus_cost := ROUND((COALESCE(v_item.import_price, 0)::numeric * COALESCE(v_item.variance, 0)::numeric), 3);

        INSERT INTO public.products (
          tenant_id,
          name,
          sku,
          imei,
          quantity,
          import_price,
          total_import_cost,
          import_date,
          import_receipt_id,
          branch_id,
          status,
          note
        ) VALUES (
          v_tenant_id,
          v_item.product_name,
          v_item.sku,
          NULL,
          COALESCE(v_item.variance, 0)::numeric,
          COALESCE(v_item.import_price, 0)::numeric,
          v_surplus_cost,
          now(),
          v_import_receipt_id,
          v_stock_count.branch_id,
          'in_stock',
          'Bổ sung từ kiểm kho ' || v_stock_count.code
        );
      END IF;
    END IF;
  END LOOP;

  UPDATE public.stock_counts
  SET
    status = 'confirmed',
    confirmed_by = v_user_id,
    confirmed_at = now(),
    adjustment_import_receipt_id = v_import_receipt_id,
    adjustment_export_receipt_id = v_export_receipt_id,
    updated_at = now()
  WHERE id = p_stock_count_id
    AND tenant_id = v_tenant_id;

  INSERT INTO public.audit_logs (
    user_id,
    tenant_id,
    action_type,
    table_name,
    record_id,
    branch_id,
    description,
    new_data
  ) VALUES (
    v_user_id,
    v_tenant_id,
    'CONFIRM_STOCK_COUNT',
    'stock_counts',
    p_stock_count_id,
    v_stock_count.branch_id,
    'Xác nhận phiếu kiểm kho ' || v_stock_count.code,
    jsonb_build_object(
      'totalVariance', v_stock_count.total_variance,
      'missingCount', v_missing_items_count,
      'surplusCount', v_surplus_items_count,
      'adjustmentImportReceiptId', v_import_receipt_id,
      'adjustmentExportReceiptId', v_export_receipt_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'stockCountId', p_stock_count_id,
    'adjustmentImportReceiptId', v_import_receipt_id,
    'adjustmentExportReceiptId', v_export_receipt_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_stock_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_stock_count(uuid) TO authenticated;