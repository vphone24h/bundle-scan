-- Fix: Move INSERT policy from einvoice_configs (wrong) to einvoices (correct)
DROP POLICY IF EXISTS "Users can insert own tenant einvoices" ON public.einvoice_configs;

-- Create the correct INSERT policy on einvoices table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'einvoices' AND policyname = 'Users can insert own tenant einvoices'
  ) THEN
    CREATE POLICY "Users can insert own tenant einvoices"
    ON public.einvoices FOR INSERT
    WITH CHECK (public.is_platform_admin(auth.uid()) OR tenant_id = public.get_user_tenant_id_secure());
  END IF;
END $$;