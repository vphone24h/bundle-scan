
-- Product groups table for variant configuration
CREATE TABLE public.product_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  sku_prefix text,
  category_id uuid REFERENCES public.categories(id),
  variant_1_label text,
  variant_2_label text,
  variant_3_label text,
  variant_1_values text[] DEFAULT '{}',
  variant_2_values text[] DEFAULT '{}',
  variant_3_values text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add variant columns to products table
ALTER TABLE public.products ADD COLUMN group_id uuid REFERENCES public.product_groups(id);
ALTER TABLE public.products ADD COLUMN variant_1 text;
ALTER TABLE public.products ADD COLUMN variant_2 text;
ALTER TABLE public.products ADD COLUMN variant_3 text;

-- Enable RLS
ALTER TABLE public.product_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_groups (same pattern as products)
CREATE POLICY "Users can view own tenant product_groups"
  ON public.product_groups FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert own tenant product_groups"
  ON public.product_groups FOR INSERT
  TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update own tenant product_groups"
  ON public.product_groups FOR UPDATE
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can delete own tenant product_groups"
  ON public.product_groups FOR DELETE
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

-- Index for fast lookup
CREATE INDEX idx_product_groups_tenant ON public.product_groups(tenant_id);
CREATE INDEX idx_products_group_id ON public.products(group_id) WHERE group_id IS NOT NULL;
