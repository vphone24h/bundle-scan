-- Drop minigame tables
DROP TABLE IF EXISTS public.minigame_spins CASCADE;
DROP TABLE IF EXISTS public.minigame_participants CASCADE;
DROP TABLE IF EXISTS public.minigame_prizes CASCADE;
DROP TABLE IF EXISTS public.minigame_campaigns CASCADE;

-- Drop minigame enums
DROP TYPE IF EXISTS public.minigame_status CASCADE;

-- Create ads/applications table
CREATE TABLE public.advertisements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  click_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  ad_type TEXT DEFAULT 'partner', -- 'internal' or 'partner'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

-- RLS Policies - All authenticated users can view active ads
CREATE POLICY "All users can view active advertisements"
ON public.advertisements
FOR SELECT
USING (
  is_active = true 
  AND start_date <= now() 
  AND (end_date IS NULL OR end_date >= now())
);

-- Tenant admins can manage their ads
CREATE POLICY "Tenant admins can manage advertisements"
ON public.advertisements
FOR ALL
USING (
  is_platform_admin(auth.uid()) 
  OR (tenant_id = get_user_tenant_id_secure() AND get_user_role(auth.uid()) IN ('super_admin', 'branch_admin'))
);

-- Create index for efficient queries
CREATE INDEX idx_advertisements_active ON public.advertisements(is_active, start_date, end_date);
CREATE INDEX idx_advertisements_tenant ON public.advertisements(tenant_id);
CREATE INDEX idx_advertisements_order ON public.advertisements(display_order);

-- Update trigger for updated_at
CREATE TRIGGER update_advertisements_updated_at
  BEFORE UPDATE ON public.advertisements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();