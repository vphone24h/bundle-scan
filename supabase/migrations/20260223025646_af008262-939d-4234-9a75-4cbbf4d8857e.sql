
-- Add source column to distinguish manual vs automation notifications
ALTER TABLE public.system_notifications 
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- Update existing automation-created notifications (best effort: ones without created_by)
UPDATE public.system_notifications 
SET source = 'automation' 
WHERE created_by IS NULL AND notification_type = 'info';
