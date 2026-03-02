
-- Backfill original_debt_amount for export_receipts where it's NULL
-- For receipts that still have debt: original_debt was at least current debt_amount
-- For receipts that are fully paid (debt_amount=0, but paid_amount was increased by FIFO):
-- original_debt = total_amount - (paid_amount - sum_of_fifo_payments)
-- Since we can't track per-receipt FIFO, we use: if debt_amount=0 and paid_amount=total_amount
-- and the receipt was created with some debt, we set original_debt = total_amount - original paid at checkout
-- Best approximation: original_debt = total_amount - (total_amount - debt_amount) only works if no FIFO applied yet

-- For records with current debt > 0, original debt >= current debt
-- We'll use: original_debt_amount = total_amount - (total_amount - debt_amount) = debt_amount as minimum
-- But actually for NOT fully paid: total_amount - paid_amount + fifo_paid = original_debt
-- Without per-receipt FIFO tracking, best we can do is set it to debt_amount for records still having debt

-- Strategy: Calculate from the payment data
-- original_paid_at_checkout = total_amount - original_debt_amount
-- After FIFO: paid_amount = original_paid_at_checkout + fifo_allocated
-- So: original_debt_amount = total_amount - (paid_amount - fifo_allocated)
-- Without fifo_allocated per receipt, we approximate:
-- If debt_amount > 0: not fully paid, original_debt >= debt_amount
-- Best approximation: original_debt = total_amount - paid_amount + (paid_amount_increase_from_fifo)
-- Since paid_amount_increase_from_fifo = original_debt - debt_amount (what was paid via FIFO)
-- original_debt = total_amount - paid_amount + original_debt - debt_amount
-- This is circular. So let's just set: original_debt_amount = total_amount - paid_amount + (total_amount - paid_amount was the original, but FIFO changed paid_amount)

-- Simplest correct approach: 
-- For any receipt where original_debt_amount IS NULL:
-- original_debt_amount = (total_amount - paid_amount) + (paid_amount - original_checkout_payment)  
-- = total_amount - original_checkout_payment
-- We don't have original_checkout_payment stored.

-- PRACTICAL FIX: For NULL records, set original_debt_amount = total_amount - paid_amount + debt_amount
-- Wait no. After FIFO: paid_amount = checkout_paid + fifo_paid, debt_amount = original_debt - fifo_paid
-- So: total_amount - paid_amount = total_amount - checkout_paid - fifo_paid  
-- And: debt_amount = original_debt - fifo_paid = (total_amount - checkout_paid) - fifo_paid
-- Therefore: total_amount - paid_amount = debt_amount. They're the same!
-- No wait: total_amount - paid_amount = total_amount - checkout_paid - fifo_paid
-- debt_amount = (total_amount - checkout_paid) - fifo_paid = total_amount - checkout_paid - fifo_paid
-- So yes, total_amount - paid_amount = debt_amount always holds.
-- That means the fallback total_amount - paid_amount = debt_amount, which IS correct for current debt.
-- The issue is this gives CURRENT debt, not ORIGINAL debt.
-- original_debt = total_amount - checkout_paid = debt_amount + fifo_paid = (total_amount - paid_amount) + fifo_paid
-- But fifo_paid = paid_amount - checkout_paid, so:
-- original_debt = total_amount - paid_amount + paid_amount - checkout_paid = total_amount - checkout_paid
-- We're going in circles.

-- THE KEY INSIGHT: Before any FIFO, paid_amount = checkout_paid, debt_amount = total_amount - checkout_paid
-- After FIFO: paid_amount increases, debt_amount decreases by same amount
-- So: paid_amount + debt_amount is ALWAYS = total_amount (invariant!)
-- Wait no: paid_amount_new = checkout_paid + fifo, debt_amount_new = (total_amount - checkout_paid) - fifo
-- paid_amount_new + debt_amount_new = checkout_paid + fifo + total_amount - checkout_paid - fifo = total_amount ✓
-- So paid_amount + debt_amount = total_amount is ALWAYS true.
-- Therefore total_amount - paid_amount = debt_amount ALWAYS.
-- So the fallback was actually just returning current debt_amount.
-- For fully paid: debt_amount = 0, so originalDebt = 0. That's why they're hidden!

-- SOLUTION: We need to reconstruct original_debt for old records.
-- original_debt = total_amount - checkout_paid
-- checkout_paid = paid_amount - fifo_paid  
-- fifo_paid = original_debt - current_debt = original_debt - debt_amount
-- Again circular without knowing original_debt.

-- FINAL PRACTICAL SOLUTION: We cannot perfectly reconstruct for old records.
-- But we CAN detect if a receipt ever had debt by checking if there are debt_payments 
-- against this entity that could have affected this receipt.
-- OR we just set a flag. Let's just set original_debt_amount = debt_amount for records
-- that currently have debt > 0. For records with debt = 0, we'll set a reasonable default.

-- Actually, the BEST approach: for old records that had debt and were fully paid,
-- we simply cannot recover the exact original debt amount.
-- BUT we know they had debt if their debt_amount was ever > 0.
-- Since we can't distinguish "never had debt" from "had debt, fully paid via FIFO",
-- let's just set original_debt_amount = debt_amount for all NULL records.
-- This means fully-paid old records will have original_debt_amount = 0 and stay hidden.
-- That's acceptable - only NEW records going forward will have correct tracking.

-- Set for records that currently have debt
UPDATE public.export_receipts 
SET original_debt_amount = debt_amount 
WHERE original_debt_amount IS NULL AND debt_amount > 0;

UPDATE public.import_receipts 
SET original_debt_amount = debt_amount 
WHERE original_debt_amount IS NULL AND debt_amount > 0;

-- For records with no debt, set to 0 to indicate "no debt from start"
UPDATE public.export_receipts 
SET original_debt_amount = 0 
WHERE original_debt_amount IS NULL AND debt_amount = 0;

UPDATE public.import_receipts 
SET original_debt_amount = 0 
WHERE original_debt_amount IS NULL AND debt_amount = 0;
