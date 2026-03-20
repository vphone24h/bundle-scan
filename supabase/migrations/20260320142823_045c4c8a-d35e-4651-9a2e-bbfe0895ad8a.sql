-- Turn off all AI features for all shops
UPDATE tenant_landing_settings SET ai_description_enabled = false, auto_image_enabled = false;

-- Ensure defaults are false
ALTER TABLE tenant_landing_settings ALTER COLUMN ai_description_enabled SET DEFAULT false;
ALTER TABLE tenant_landing_settings ALTER COLUMN auto_image_enabled SET DEFAULT false;