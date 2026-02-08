
-- Add branch_id to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_suppliers_branch_id ON public.suppliers(branch_id);

-- Update RLS policy to ensure branch-level filtering still works through tenant_id
-- (existing RLS policies on suppliers already filter by tenant_id, branch_id is application-level filtering)
