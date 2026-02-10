
-- Create debt_tags table
CREATE TABLE public.debt_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  tenant_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name, tenant_id)
);

-- Create debt_tag_assignments junction table
CREATE TABLE public.debt_tag_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tag_id UUID NOT NULL REFERENCES public.debt_tags(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('customer', 'supplier')),
  tenant_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tag_id, entity_id, entity_type)
);

-- Enable RLS
ALTER TABLE public.debt_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_tag_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for debt_tags
CREATE POLICY "Users can view debt tags in their tenant"
ON public.debt_tags FOR SELECT
USING (tenant_id = (SELECT (auth.jwt()->'app_metadata'->>'tenant_id')::text));

CREATE POLICY "Users can create debt tags in their tenant"
ON public.debt_tags FOR INSERT
WITH CHECK (tenant_id = (SELECT (auth.jwt()->'app_metadata'->>'tenant_id')::text));

CREATE POLICY "Users can update debt tags in their tenant"
ON public.debt_tags FOR UPDATE
USING (tenant_id = (SELECT (auth.jwt()->'app_metadata'->>'tenant_id')::text));

CREATE POLICY "Users can delete debt tags in their tenant"
ON public.debt_tags FOR DELETE
USING (tenant_id = (SELECT (auth.jwt()->'app_metadata'->>'tenant_id')::text));

-- RLS policies for debt_tag_assignments
CREATE POLICY "Users can view debt tag assignments in their tenant"
ON public.debt_tag_assignments FOR SELECT
USING (tenant_id = (SELECT (auth.jwt()->'app_metadata'->>'tenant_id')::text));

CREATE POLICY "Users can create debt tag assignments in their tenant"
ON public.debt_tag_assignments FOR INSERT
WITH CHECK (tenant_id = (SELECT (auth.jwt()->'app_metadata'->>'tenant_id')::text));

CREATE POLICY "Users can delete debt tag assignments in their tenant"
ON public.debt_tag_assignments FOR DELETE
USING (tenant_id = (SELECT (auth.jwt()->'app_metadata'->>'tenant_id')::text));

-- Indexes
CREATE INDEX idx_debt_tags_tenant ON public.debt_tags(tenant_id);
CREATE INDEX idx_debt_tag_assignments_entity ON public.debt_tag_assignments(entity_id, entity_type);
CREATE INDEX idx_debt_tag_assignments_tag ON public.debt_tag_assignments(tag_id);
