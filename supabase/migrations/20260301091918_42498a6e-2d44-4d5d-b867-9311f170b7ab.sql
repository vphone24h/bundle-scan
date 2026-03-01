-- Phase 3: Add customization columns to tenant_landing_settings
-- Hero text overrides
ALTER TABLE public.tenant_landing_settings ADD COLUMN IF NOT EXISTS hero_title text;
ALTER TABLE public.tenant_landing_settings ADD COLUMN IF NOT EXISTS hero_subtitle text;
ALTER TABLE public.tenant_landing_settings ADD COLUMN IF NOT EXISTS hero_cta text;

-- Homepage section ordering and visibility (JSONB array of {id, enabled} objects)
ALTER TABLE public.tenant_landing_settings ADD COLUMN IF NOT EXISTS custom_home_sections jsonb;

-- Font family override
ALTER TABLE public.tenant_landing_settings ADD COLUMN IF NOT EXISTS custom_font_family text;

-- Layout style override (e.g. 'apple', 'tgdd', 'hasaki', 'nike', etc.)
ALTER TABLE public.tenant_landing_settings ADD COLUMN IF NOT EXISTS custom_layout_style text;