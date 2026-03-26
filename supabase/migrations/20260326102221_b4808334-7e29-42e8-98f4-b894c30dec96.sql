
-- First, update all references from duplicate branches to the keeper branch
-- Keeper: d7cb264d-63a4-40d8-a52e-b16b465cc92c
-- Duplicates: b84e8f5d, ebb73116, 548737d5, ff88387a

DO $$
DECLARE
  keeper_id UUID := 'd7cb264d-63a4-40d8-a52e-b16b465cc92c';
  dup_ids UUID[] := ARRAY[
    'b84e8f5d-b809-4730-a138-dfa28577169e',
    'ebb73116-aa12-4972-aaab-2adcbd641038',
    '548737d5-8ab3-4de9-b970-ffc19a65528d',
    'ff88387a-2057-48d2-91c5-2dfa72d7621b'
  ];
BEGIN
  UPDATE import_returns SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE cash_book SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE products SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE import_receipts SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE export_receipts SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE export_returns SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE user_roles SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE audit_logs SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE debt_payments SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE customers SET preferred_branch_id = keeper_id WHERE preferred_branch_id = ANY(dup_ids);
  UPDATE point_transactions SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE stock_counts SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE einvoices SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE invoice_templates SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE stock_transfer_requests SET from_branch_id = keeper_id WHERE from_branch_id = ANY(dup_ids);
  UPDATE stock_transfer_requests SET to_branch_id = keeper_id WHERE to_branch_id = ANY(dup_ids);
  UPDATE user_branch_access SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE suppliers SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE landing_orders SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE staff_reviews SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE customer_vouchers SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE daily_stats SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);
  UPDATE warehouse_value_snapshots SET branch_id = keeper_id WHERE branch_id = ANY(dup_ids);

  -- Now delete duplicates
  DELETE FROM branches WHERE id = ANY(dup_ids);
END $$;

-- Prevent future duplicates
CREATE UNIQUE INDEX idx_branches_unique_name_tenant ON branches (tenant_id, name) WHERE tenant_id IS NOT NULL;
