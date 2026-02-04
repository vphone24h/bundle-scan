-- Add branch_id to invoice_templates for per-branch templates
ALTER TABLE public.invoice_templates 
ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE;

-- Create unique constraint: only one template per branch (or one global default without branch)
CREATE UNIQUE INDEX idx_invoice_templates_branch_tenant 
ON public.invoice_templates (tenant_id, branch_id) 
WHERE branch_id IS NOT NULL;

-- Update existing default templates to not have branch_id (they become global fallback)
-- New templates will be created per branch when needed

-- Add index for faster lookups
CREATE INDEX idx_invoice_templates_branch_id ON public.invoice_templates(branch_id);