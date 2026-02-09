
-- Create a function to merge duplicate suppliers atomically
-- Updates all references from duplicate supplier IDs to the primary supplier ID, then deletes duplicates
CREATE OR REPLACE FUNCTION public.merge_suppliers(
  _primary_id uuid,
  _duplicate_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
  _primary_tenant uuid;
  _dup_id uuid;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  _tenant_id := public.get_user_tenant_id_secure();
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND';
  END IF;

  -- Must be admin
  IF NOT public.is_tenant_admin(auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN: Only admins can merge suppliers';
  END IF;

  -- Verify primary supplier belongs to this tenant
  SELECT tenant_id INTO _primary_tenant
  FROM public.suppliers
  WHERE id = _primary_id AND tenant_id = _tenant_id;

  IF _primary_tenant IS NULL THEN
    RAISE EXCEPTION 'Primary supplier not found or not in your tenant';
  END IF;

  -- Verify all duplicates belong to same tenant
  FOREACH _dup_id IN ARRAY _duplicate_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.suppliers WHERE id = _dup_id AND tenant_id = _tenant_id
    ) THEN
      RAISE EXCEPTION 'Duplicate supplier % not found or not in your tenant', _dup_id;
    END IF;
  END LOOP;

  -- 1. Update products
  UPDATE public.products
  SET supplier_id = _primary_id
  WHERE supplier_id = ANY(_duplicate_ids);

  -- 2. Update import_receipts
  UPDATE public.import_receipts
  SET supplier_id = _primary_id
  WHERE supplier_id = ANY(_duplicate_ids);

  -- 3. Update import_returns
  UPDATE public.import_returns
  SET supplier_id = _primary_id
  WHERE supplier_id = ANY(_duplicate_ids);

  -- 4. Update product_imports
  UPDATE public.product_imports
  SET supplier_id = _primary_id
  WHERE supplier_id = ANY(_duplicate_ids);

  -- 5. Update stock_transfer_items
  UPDATE public.stock_transfer_items
  SET supplier_id = _primary_id
  WHERE supplier_id = ANY(_duplicate_ids);

  -- 6. Update debt_payments (entity_type = 'supplier')
  UPDATE public.debt_payments
  SET entity_id = _primary_id::text
  WHERE entity_type = 'supplier'
    AND entity_id = ANY(SELECT unnest(_duplicate_ids)::text);

  -- 7. Delete duplicate suppliers
  DELETE FROM public.suppliers
  WHERE id = ANY(_duplicate_ids)
    AND tenant_id = _tenant_id;

  -- Log the merge action
  INSERT INTO public.audit_logs (
    tenant_id, user_id, action_type, table_name,
    record_id, description, new_data
  ) VALUES (
    _tenant_id, auth.uid(), 'MERGE', 'suppliers',
    _primary_id::text,
    'Gộp ' || array_length(_duplicate_ids, 1) || ' nhà cung cấp trùng',
    jsonb_build_object(
      'primary_id', _primary_id,
      'merged_ids', _duplicate_ids
    )
  );
END;
$$;
