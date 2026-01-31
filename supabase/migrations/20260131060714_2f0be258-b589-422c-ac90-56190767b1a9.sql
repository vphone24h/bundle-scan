-- Add per-section alignment columns for K80 invoice template
ALTER TABLE public.invoice_templates
ADD COLUMN IF NOT EXISTS section1_align text DEFAULT 'center',
ADD COLUMN IF NOT EXISTS section2_align text DEFAULT 'center',
ADD COLUMN IF NOT EXISTS section3_align text DEFAULT 'left',
ADD COLUMN IF NOT EXISTS section4_align text DEFAULT 'left',
ADD COLUMN IF NOT EXISTS section5_align text DEFAULT 'left';

-- Add comment for clarity
COMMENT ON COLUMN public.invoice_templates.section1_align IS 'Alignment for store info section (name, phone, address)';
COMMENT ON COLUMN public.invoice_templates.section2_align IS 'Alignment for invoice title section';
COMMENT ON COLUMN public.invoice_templates.section3_align IS 'Alignment for invoice details (code, date, customer)';
COMMENT ON COLUMN public.invoice_templates.section4_align IS 'Alignment for product list section';
COMMENT ON COLUMN public.invoice_templates.section5_align IS 'Alignment for total/payment section';