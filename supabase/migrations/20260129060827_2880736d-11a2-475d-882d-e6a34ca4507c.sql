-- Allow tenant admins (super_admin/branch_admin) to view platform users within their own tenant
-- This is required so the Users page can display emails for managed staff.

ALTER TABLE public.platform_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='platform_users' AND policyname='Tenant admins can view own tenant platform users'
  ) THEN
    CREATE POLICY "Tenant admins can view own tenant platform users"
    ON public.platform_users
    FOR SELECT
    USING (
      (tenant_id = public.get_user_tenant_id_secure())
      AND public.is_tenant_admin(auth.uid())
    );
  END IF;
END $$;