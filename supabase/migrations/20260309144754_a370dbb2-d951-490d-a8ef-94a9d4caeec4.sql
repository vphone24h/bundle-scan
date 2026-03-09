
ALTER TABLE public.debt_payments ADD COLUMN balance_after numeric DEFAULT NULL;

DO $$
DECLARE
  rec RECORD;
  running_balance numeric;
  prev_entity uuid;
  prev_type text;
BEGIN
  prev_entity := '00000000-0000-0000-0000-000000000000'::uuid;
  prev_type := '';
  running_balance := 0;
  
  FOR rec IN (
    SELECT dp.id, dp.entity_id, dp.entity_type, dp.payment_type, dp.amount
    FROM public.debt_payments dp
    ORDER BY dp.entity_type, dp.entity_id, dp.created_at ASC
  ) LOOP
    IF rec.entity_id IS DISTINCT FROM prev_entity OR rec.entity_type IS DISTINCT FROM prev_type THEN
      IF rec.entity_type = 'customer' THEN
        SELECT COALESCE(SUM(
          CASE WHEN original_debt_amount > 0 THEN original_debt_amount
               ELSE GREATEST(total_amount - paid_amount, 0)
          END
        ), 0) INTO running_balance
        FROM public.export_receipts
        WHERE customer_id = rec.entity_id AND status = 'completed';
      ELSE
        SELECT COALESCE(SUM(
          CASE WHEN original_debt_amount > 0 THEN original_debt_amount
               ELSE GREATEST(total_amount - paid_amount, 0)
          END
        ), 0) INTO running_balance
        FROM public.import_receipts
        WHERE supplier_id = rec.entity_id AND status = 'completed';
      END IF;
      
      prev_entity := rec.entity_id;
      prev_type := rec.entity_type;
    END IF;
    
    IF rec.payment_type = 'addition' THEN
      running_balance := running_balance + rec.amount;
    ELSE
      running_balance := running_balance - rec.amount;
    END IF;
    
    UPDATE public.debt_payments SET balance_after = running_balance WHERE id = rec.id;
  END LOOP;
END $$;
