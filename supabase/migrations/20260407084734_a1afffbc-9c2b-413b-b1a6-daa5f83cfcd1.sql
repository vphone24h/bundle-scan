
-- Company branding/settings table
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  display_name TEXT,
  slogan TEXT,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  description TEXT,
  bank_accounts JSONB DEFAULT '[]'::jsonb,
  subscription_plans JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Public read (landing pages need to read branding)
CREATE POLICY "Anyone can read company settings"
  ON public.company_settings FOR SELECT
  USING (true);

-- Platform admins and company admins can update their own company settings
CREATE POLICY "Platform admins can manage all company settings"
  ON public.company_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      WHERE pu.user_id = auth.uid()
      AND pu.platform_role = 'platform_admin'
      AND pu.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      WHERE pu.user_id = auth.uid()
      AND pu.platform_role = 'platform_admin'
      AND pu.is_active = true
    )
  );

CREATE POLICY "Company admins can manage their own company settings"
  ON public.company_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      WHERE pu.user_id = auth.uid()
      AND pu.platform_role = 'company_admin'
      AND pu.company_id = company_settings.company_id
      AND pu.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      WHERE pu.user_id = auth.uid()
      AND pu.platform_role = 'company_admin'
      AND pu.company_id = company_settings.company_id
      AND pu.is_active = true
    )
  );
