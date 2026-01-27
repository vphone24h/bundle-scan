-- Bảng lưu custom domains cho các tenant (gói trả phí)
CREATE TABLE IF NOT EXISTS public.custom_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain text NOT NULL UNIQUE,
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamp with time zone,
  verification_token text,
  ssl_status text DEFAULT 'pending', -- pending, active, failed
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index cho lookup nhanh
CREATE INDEX idx_custom_domains_domain ON public.custom_domains(domain);
CREATE INDEX idx_custom_domains_tenant ON public.custom_domains(tenant_id);

-- RLS
ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

-- Platform admin có thể quản lý tất cả
CREATE POLICY "Platform admins can manage all custom_domains"
ON public.custom_domains
FOR ALL
USING (is_platform_admin(auth.uid()));

-- Tenant có thể xem domain của mình
CREATE POLICY "Tenant users can view own custom_domains"
ON public.custom_domains
FOR SELECT
USING (tenant_id = get_user_tenant_id_secure());

-- Tenant có thể thêm domain (chỉ INSERT, không UPDATE/DELETE - cần admin)
CREATE POLICY "Tenant users can add custom_domains"
ON public.custom_domains
FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id_secure());

-- Trigger update timestamp
CREATE TRIGGER update_custom_domains_updated_at
BEFORE UPDATE ON public.custom_domains
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Thêm cột cho tenants để hỗ trợ routing
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS primary_domain text,
ADD COLUMN IF NOT EXISTS allow_custom_domain boolean DEFAULT false;

-- Function để resolve tenant từ domain/subdomain
CREATE OR REPLACE FUNCTION public.resolve_tenant_by_domain(_domain text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Ưu tiên 1: Custom domain đã verify
  SELECT tenant_id FROM public.custom_domains 
  WHERE domain = _domain AND is_verified = true
  UNION ALL
  -- Ưu tiên 2: Subdomain của tenant
  SELECT id FROM public.tenants 
  WHERE subdomain = split_part(_domain, '.', 1)
  LIMIT 1
$$;

-- Function để tạo verification token
CREATE OR REPLACE FUNCTION public.generate_domain_verification_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := 'lovable_verify_';
  i integer;
BEGIN
  FOR i IN 1..32 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;