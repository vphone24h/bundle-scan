-- 1. FIX platform_users RLS - Restrict to authenticated users within same tenant
DROP POLICY IF EXISTS "platform_users_select_policy" ON public.platform_users;
DROP POLICY IF EXISTS "platform_users_insert_policy" ON public.platform_users;
DROP POLICY IF EXISTS "platform_users_update_policy" ON public.platform_users;
DROP POLICY IF EXISTS "platform_users_delete_policy" ON public.platform_users;

CREATE POLICY "platform_users_select_authenticated"
  ON public.platform_users
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_platform_admin(auth.uid())
    OR public.user_belongs_to_tenant(tenant_id)
  );

CREATE POLICY "platform_users_insert_admin"
  ON public.platform_users
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_users_update_admin"
  ON public.platform_users
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_users_delete_admin"
  ON public.platform_users
  FOR DELETE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 2. FIX customers table RLS - Restrict to authenticated users within same tenant
DROP POLICY IF EXISTS "customers_select_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_update_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_policy" ON public.customers;

CREATE POLICY "customers_select_tenant_users"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "customers_insert_tenant_users"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "customers_update_tenant_users"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "customers_delete_tenant_users"
  ON public.customers
  FOR DELETE
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

-- 3. FIX email_queue RLS - Restrict to platform admins and service role only
DROP POLICY IF EXISTS "email_queue_select_policy" ON public.email_queue;
DROP POLICY IF EXISTS "email_queue_insert_policy" ON public.email_queue;
DROP POLICY IF EXISTS "email_queue_update_policy" ON public.email_queue;
DROP POLICY IF EXISTS "email_queue_delete_policy" ON public.email_queue;

CREATE POLICY "email_queue_select_platform_admin"
  ON public.email_queue
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "email_queue_insert_service_role"
  ON public.email_queue
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "email_queue_update_service_role"
  ON public.email_queue
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "email_queue_delete_service_role"
  ON public.email_queue
  FOR DELETE
  TO service_role
  USING (true);
