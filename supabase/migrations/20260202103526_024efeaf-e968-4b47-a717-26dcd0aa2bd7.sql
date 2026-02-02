-- Add new columns for points display and custom description formatting
ALTER TABLE public.invoice_templates 
ADD COLUMN IF NOT EXISTS show_points_earned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_description_bold BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_description_align TEXT DEFAULT 'center' CHECK (custom_description_align IN ('left', 'center', 'right'));