CREATE TABLE IF NOT EXISTS public.zalo_oa_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  zalo_user_id text NOT NULL,
  phone text,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, zalo_user_id)
);

ALTER TABLE public.zalo_oa_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view followers" ON public.zalo_oa_followers
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Service role full access on zalo_followers" ON public.zalo_oa_followers
  FOR ALL TO service_role
  USING (true);