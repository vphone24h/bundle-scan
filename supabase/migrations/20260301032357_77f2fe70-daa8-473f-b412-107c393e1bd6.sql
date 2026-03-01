
-- Create platform_settings table for global admin config
CREATE TABLE public.platform_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ai_description_enabled boolean NOT NULL DEFAULT true,
  auto_image_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "Authenticated users can read platform settings"
ON public.platform_settings FOR SELECT
TO authenticated
USING (true);

-- Only platform admins can update
CREATE POLICY "Platform admins can update platform settings"
ON public.platform_settings FOR UPDATE
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Insert initial row
INSERT INTO public.platform_settings (ai_description_enabled, auto_image_enabled) VALUES (true, true);

-- Trigger for updated_at
CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
