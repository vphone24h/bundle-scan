
-- Create companies table (tier 1 tenant - domain/company level)
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Only platform_admin can manage companies
CREATE POLICY "Platform admins can view companies"
  ON public.companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE user_id = auth.uid()
      AND platform_role = 'platform_admin'
    )
  );

CREATE POLICY "Platform admins can insert companies"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE user_id = auth.uid()
      AND platform_role = 'platform_admin'
    )
  );

CREATE POLICY "Platform admins can update companies"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE user_id = auth.uid()
      AND platform_role = 'platform_admin'
    )
  );

CREATE POLICY "Platform admins can delete companies"
  ON public.companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE user_id = auth.uid()
      AND platform_role = 'platform_admin'
    )
  );

-- Add company_id to tenants table
ALTER TABLE public.tenants ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_tenants_company_id ON public.tenants(company_id);
CREATE INDEX idx_companies_domain ON public.companies(domain);

-- Insert default company for vkho.vn
INSERT INTO public.companies (domain, name, status)
VALUES ('vkho.vn', 'VKho Platform', 'active');

-- Assign all existing tenants to default company
UPDATE public.tenants
SET company_id = (SELECT id FROM public.companies WHERE domain = 'vkho.vn' LIMIT 1)
WHERE company_id IS NULL;

-- Also allow anonymous to lookup company by domain (for runtime resolution)
CREATE OR REPLACE FUNCTION public.lookup_company_by_domain(_domain text)
RETURNS TABLE(id uuid, domain text, name text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.domain, c.name, c.status
  FROM public.companies c
  WHERE c.domain = lower(trim(_domain))
    AND c.status = 'active'
  LIMIT 1;
$$;
