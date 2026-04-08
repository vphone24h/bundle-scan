
-- Add ticket password columns
ALTER TABLE public.repair_orders 
  ADD COLUMN IF NOT EXISTS ticket_password_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ticket_password text;

-- Fix RLS on repair_orders
DROP POLICY IF EXISTS "tenant_isolation" ON public.repair_orders;
CREATE POLICY "tenant_isolation" ON public.repair_orders
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id_secure()::text)
  WITH CHECK (tenant_id = public.get_user_tenant_id_secure()::text);

-- Fix RLS on repair_order_items
DROP POLICY IF EXISTS "tenant_isolation" ON public.repair_order_items;
CREATE POLICY "tenant_isolation" ON public.repair_order_items
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id_secure()::text)
  WITH CHECK (tenant_id = public.get_user_tenant_id_secure()::text);

-- Fix RLS on repair_request_types
DROP POLICY IF EXISTS "tenant_isolation" ON public.repair_request_types;
CREATE POLICY "tenant_isolation" ON public.repair_request_types
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id_secure()::text)
  WITH CHECK (tenant_id = public.get_user_tenant_id_secure()::text);

-- Fix RLS on repair_status_history
DROP POLICY IF EXISTS "tenant_isolation" ON public.repair_status_history;
CREATE POLICY "tenant_isolation" ON public.repair_status_history
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id_secure()::text)
  WITH CHECK (tenant_id = public.get_user_tenant_id_secure()::text);
