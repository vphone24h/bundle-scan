-- Drop the old unique constraint on tier only
ALTER TABLE public.membership_tier_settings 
DROP CONSTRAINT IF EXISTS membership_tier_settings_tier_key;

-- Create composite unique constraint on (tier, tenant_id)
-- This allows each tenant to have their own tier settings
ALTER TABLE public.membership_tier_settings 
ADD CONSTRAINT membership_tier_settings_tier_tenant_unique 
UNIQUE (tier, tenant_id);