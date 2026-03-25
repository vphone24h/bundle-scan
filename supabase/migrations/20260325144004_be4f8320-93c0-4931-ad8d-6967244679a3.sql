-- Reset all shops to OFF
UPDATE tenant_landing_settings 
SET ai_description_enabled = false, auto_image_enabled = false 
WHERE ai_description_enabled = true OR auto_image_enabled = true;

-- Ensure column defaults are false
ALTER TABLE tenant_landing_settings 
  ALTER COLUMN ai_description_enabled SET DEFAULT false,
  ALTER COLUMN auto_image_enabled SET DEFAULT false;