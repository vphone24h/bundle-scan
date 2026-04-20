-- ============================================================
-- 1) Self-heal function: rebuild allocated_amount cho 1 entity
-- ============================================================
-- Logic:
--   Tổng "consumed" của các additions = max(0, total_payments + total_order_paid - total_order_amount)
--   Trong đó:
--     - total_payments = SUM(amount của debt_payments type='payment' còn tồn tại)
--     - Phần allocate sang đơn hàng đã được phản ánh ở export/import_receipts.paid_amount
--     - Phần dư còn lại mới phân bổ vào các additions (FIFO theo created_at)
--
-- Đơn giản hóa: allocated trên từng addition không thể vượt quá (sum tất cả payments)
-- minus (sum debt_amount đã trả trên các đơn hàng).
-- => Tính lại theo công thức: target_allocated_total =
--      max(0, sum(payments.amount) - max(0, sum(orders.original_debt) - sum(orders.current_debt)))
-- => Nhưng để chính xác và an toàn, ta dùng cách trực tiếp hơn:
--      target_allocated_total cho additions = max(0, sum(payments) - reduction_already_applied_to_orders_via_payments)
--
-- Cách thực dụng & đúng nhất: 
--   total_addition_allocated = max(0, total_settled - total_order_settled)
--   với:
--     total_settled = SUM(payments where type='payment')
--     total_order_settled = SUM(orders.paid_amount) - SUM(orders.original_paid_at_creation) — không có cột này
--   
-- Vì không có lịch sử "paid tại lúc tạo đơn", ta dùng cách đơn giản & an toàn:
--   Lặp FIFO: với mỗi payment còn tồn tại, allocate vào order còn debt trước, dư mới sang addition.
--   Nhưng vì payments hiện tại không còn lưu chi tiết FIFO target → ta tính NGƯỢC:
--     allocated_per_addition = min(addition.amount, max(0, remaining_payment_after_orders))
-- 
-- IMPLEMENTATION: 
--   sum_payments = SUM(amount) WHERE type='payment'
--   sum_orders_paid_from_payments = SUM(orders.paid_amount) -- bao gồm cả thanh toán lúc tạo
--   => Không tách được. Vì vậy ta dùng công thức APPROXIMATE-CORRECT:
--     total_to_allocate_on_additions = max(0, sum_payments - sum_orders_debt_reduced)
--   sum_orders_debt_reduced = SUM(GREATEST(0, original_debt_amount - debt_amount))
--   (original_debt_amount là cột đã có trên export_receipts/import_receipts)

CREATE OR REPLACE FUNCTION public.heal_debt_allocations(
  p_entity_type text,
  p_entity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum_payments numeric := 0;
  v_sum_orders_reduced numeric := 0;
  v_target_allocated numeric := 0;
  v_remaining numeric;
  v_addition record;
  v_new_allocated numeric;
  v_changes int := 0;
  v_old_total numeric := 0;
  v_new_total numeric := 0;
BEGIN
  IF p_entity_type NOT IN ('customer','supplier') THEN
    RAISE EXCEPTION 'Invalid entity_type: %', p_entity_type;
  END IF;

  -- Tổng tiền đã thu/trả nợ (payments còn tồn tại)
  SELECT COALESCE(SUM(amount), 0) INTO v_sum_payments
  FROM debt_payments
  WHERE entity_type = p_entity_type
    AND entity_id = p_entity_id
    AND payment_type = 'payment';

  -- Tổng phần đã giảm trên đơn hàng (= original_debt - current_debt)
  IF p_entity_type = 'customer' THEN
    SELECT COALESCE(SUM(GREATEST(0, COALESCE(original_debt_amount, debt_amount + paid_amount) - COALESCE(debt_amount,0))), 0)
      INTO v_sum_orders_reduced
    FROM export_receipts
    WHERE customer_id = p_entity_id
      AND status IN ('completed','partial_return','full_return');
  ELSE
    SELECT COALESCE(SUM(GREATEST(0, COALESCE(original_debt_amount, debt_amount + paid_amount) - COALESCE(debt_amount,0))), 0)
      INTO v_sum_orders_reduced
    FROM import_receipts
    WHERE supplier_id = p_entity_id
      AND status = 'completed';
  END IF;

  -- Phần payments còn dư sau khi trừ vào orders => phân bổ vào additions
  v_target_allocated := GREATEST(0, v_sum_payments - v_sum_orders_reduced);

  -- Lấy tổng allocated hiện tại (để báo cáo)
  SELECT COALESCE(SUM(allocated_amount), 0) INTO v_old_total
  FROM debt_payments
  WHERE entity_type = p_entity_type
    AND entity_id = p_entity_id
    AND payment_type = 'addition';

  -- Reset & re-allocate FIFO theo created_at
  v_remaining := v_target_allocated;
  FOR v_addition IN
    SELECT id, amount, COALESCE(allocated_amount, 0) AS allocated_amount
    FROM debt_payments
    WHERE entity_type = p_entity_type
      AND entity_id = p_entity_id
      AND payment_type = 'addition'
    ORDER BY created_at ASC
  LOOP
    v_new_allocated := LEAST(v_addition.amount, v_remaining);
    IF v_new_allocated <> v_addition.allocated_amount THEN
      UPDATE debt_payments
      SET allocated_amount = v_new_allocated
      WHERE id = v_addition.id;
      v_changes := v_changes + 1;
    END IF;
    v_remaining := v_remaining - v_new_allocated;
    v_new_total := v_new_total + v_new_allocated;
  END LOOP;

  RETURN jsonb_build_object(
    'entity_type', p_entity_type,
    'entity_id', p_entity_id,
    'sum_payments', v_sum_payments,
    'sum_orders_reduced', v_sum_orders_reduced,
    'target_allocated_total', v_target_allocated,
    'old_allocated_total', v_old_total,
    'new_allocated_total', v_new_total,
    'rows_changed', v_changes
  );
END;
$$;

-- ============================================================
-- 2) Self-heal toàn bộ tenant
-- ============================================================
CREATE OR REPLACE FUNCTION public.heal_debt_allocations_for_tenant(
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity record;
  v_total_entities int := 0;
  v_total_changes int := 0;
  v_result jsonb;
  v_drift_entities jsonb := '[]'::jsonb;
BEGIN
  FOR v_entity IN
    SELECT DISTINCT entity_type, entity_id
    FROM debt_payments
    WHERE tenant_id = p_tenant_id
      AND payment_type = 'addition'
  LOOP
    v_result := public.heal_debt_allocations(v_entity.entity_type, v_entity.entity_id);
    v_total_entities := v_total_entities + 1;
    IF (v_result->>'rows_changed')::int > 0 THEN
      v_total_changes := v_total_changes + (v_result->>'rows_changed')::int;
      v_drift_entities := v_drift_entities || jsonb_build_array(v_result);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'entities_scanned', v_total_entities,
    'entities_with_drift', jsonb_array_length(v_drift_entities),
    'total_rows_changed', v_total_changes,
    'drift_details', v_drift_entities
  );
END;
$$;

-- ============================================================
-- 3) Trigger guard: tự động heal khi xóa debt_payment kiểu 'payment'
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_heal_allocations_on_payment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.payment_type = 'payment' THEN
    PERFORM public.heal_debt_allocations(OLD.entity_type, OLD.entity_id);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS heal_allocations_after_payment_delete ON public.debt_payments;
CREATE TRIGGER heal_allocations_after_payment_delete
AFTER DELETE ON public.debt_payments
FOR EACH ROW
EXECUTE FUNCTION public.trg_heal_allocations_on_payment_delete();

-- ============================================================
-- 4) Chạy ngay self-heal cho tenant vphone5 (763625c0-bbde-4ac1-9668-2ed55aa8fa40)
-- ============================================================
DO $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.heal_debt_allocations_for_tenant('763625c0-bbde-4ac1-9668-2ed55aa8fa40'::uuid);
  RAISE NOTICE 'Heal result for vphone5: %', v_result;
END $$;
