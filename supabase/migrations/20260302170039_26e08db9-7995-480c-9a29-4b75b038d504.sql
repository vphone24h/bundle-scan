
-- Add parent_id to landing_product_categories for hierarchical support
ALTER TABLE public.landing_product_categories 
ADD COLUMN parent_id uuid REFERENCES public.landing_product_categories(id) ON DELETE SET NULL;

-- Index for faster tree queries
CREATE INDEX idx_landing_product_categories_parent ON public.landing_product_categories(parent_id);
