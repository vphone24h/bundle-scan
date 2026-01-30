
-- Fix RLS for imei_histories - check tenant via product_id -> products table
DROP POLICY IF EXISTS "Authenticated users can view imei histories" ON public.imei_histories;
DROP POLICY IF EXISTS "Authenticated users can manage imei histories" ON public.imei_histories;

CREATE POLICY "Users can view own tenant imei histories"
ON public.imei_histories
FOR SELECT
USING (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = imei_histories.product_id 
    AND p.tenant_id = get_user_tenant_id_secure()
  )
);

CREATE POLICY "Users can insert own tenant imei histories"
ON public.imei_histories
FOR INSERT
WITH CHECK (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = imei_histories.product_id 
    AND p.tenant_id = get_user_tenant_id_secure()
  )
);

CREATE POLICY "Users can update own tenant imei histories"
ON public.imei_histories
FOR UPDATE
USING (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = imei_histories.product_id 
    AND p.tenant_id = get_user_tenant_id_secure()
  )
);

CREATE POLICY "Users can delete own tenant imei histories"
ON public.imei_histories
FOR DELETE
USING (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = imei_histories.product_id 
    AND p.tenant_id = get_user_tenant_id_secure()
  )
);

-- Fix RLS for einvoice_items - check tenant via einvoice_id -> einvoices table
DROP POLICY IF EXISTS "Users can manage einvoice_items" ON public.einvoice_items;

CREATE POLICY "Users can view own tenant einvoice items"
ON public.einvoice_items
FOR SELECT
USING (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.einvoices e 
    WHERE e.id = einvoice_items.einvoice_id 
    AND e.tenant_id = get_user_tenant_id_secure()
  )
);

CREATE POLICY "Users can insert own tenant einvoice items"
ON public.einvoice_items
FOR INSERT
WITH CHECK (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.einvoices e 
    WHERE e.id = einvoice_items.einvoice_id 
    AND e.tenant_id = get_user_tenant_id_secure()
  )
);

CREATE POLICY "Users can update own tenant einvoice items"
ON public.einvoice_items
FOR UPDATE
USING (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.einvoices e 
    WHERE e.id = einvoice_items.einvoice_id 
    AND e.tenant_id = get_user_tenant_id_secure()
  )
);

CREATE POLICY "Users can delete own tenant einvoice items"
ON public.einvoice_items
FOR DELETE
USING (
  is_platform_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.einvoices e 
    WHERE e.id = einvoice_items.einvoice_id 
    AND e.tenant_id = get_user_tenant_id_secure()
  )
);
