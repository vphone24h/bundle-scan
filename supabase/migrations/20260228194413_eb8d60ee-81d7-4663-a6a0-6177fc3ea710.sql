ALTER TABLE public.tenant_landing_settings 
ADD COLUMN custom_trust_badges jsonb DEFAULT NULL;

COMMENT ON COLUMN public.tenant_landing_settings.custom_trust_badges IS 'Array of {icon, title, desc} for custom trust badges. NULL means use industry defaults.';