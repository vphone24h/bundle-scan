-- Create enum for stock count status
CREATE TYPE public.stock_count_status AS ENUM ('draft', 'confirmed');

-- Create enum for stock count scope
CREATE TYPE public.stock_count_scope AS ENUM ('all', 'category', 'product');

-- Create enum for stock count item status
CREATE TYPE public.stock_count_item_status AS ENUM ('ok', 'missing', 'surplus', 'pending');

-- Create stock_counts table
CREATE TABLE public.stock_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  branch_id UUID REFERENCES public.branches(id),
  count_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  confirmed_by UUID,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  scope stock_count_scope NOT NULL DEFAULT 'all',
  scope_category_id UUID REFERENCES public.categories(id),
  status stock_count_status NOT NULL DEFAULT 'draft',
  note TEXT,
  total_system_quantity INTEGER NOT NULL DEFAULT 0,
  total_actual_quantity INTEGER NOT NULL DEFAULT 0,
  total_variance INTEGER NOT NULL DEFAULT 0,
  adjustment_import_receipt_id UUID REFERENCES public.import_receipts(id),
  adjustment_export_receipt_id UUID REFERENCES public.export_receipts(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stock_count_items table for tracking individual items
CREATE TABLE public.stock_count_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_count_id UUID NOT NULL REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  imei TEXT,
  has_imei BOOLEAN NOT NULL DEFAULT false,
  system_quantity INTEGER NOT NULL DEFAULT 0,
  actual_quantity INTEGER NOT NULL DEFAULT 0,
  variance INTEGER NOT NULL DEFAULT 0,
  status stock_count_item_status NOT NULL DEFAULT 'pending',
  is_checked BOOLEAN NOT NULL DEFAULT false,
  import_price NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_counts
CREATE POLICY "Authenticated users can view stock counts"
ON public.stock_counts FOR SELECT
USING (is_authenticated());

CREATE POLICY "Authenticated users can insert stock counts"
ON public.stock_counts FOR INSERT
WITH CHECK (is_authenticated());

CREATE POLICY "Authenticated users can update draft stock counts"
ON public.stock_counts FOR UPDATE
USING (is_authenticated() AND status = 'draft');

-- RLS Policies for stock_count_items
CREATE POLICY "Authenticated users can view stock count items"
ON public.stock_count_items FOR SELECT
USING (is_authenticated());

CREATE POLICY "Authenticated users can insert stock count items"
ON public.stock_count_items FOR INSERT
WITH CHECK (is_authenticated());

CREATE POLICY "Authenticated users can update stock count items"
ON public.stock_count_items FOR UPDATE
USING (is_authenticated());

CREATE POLICY "Authenticated users can delete stock count items"
ON public.stock_count_items FOR DELETE
USING (is_authenticated());

-- Create indexes for better performance
CREATE INDEX idx_stock_counts_branch_id ON public.stock_counts(branch_id);
CREATE INDEX idx_stock_counts_status ON public.stock_counts(status);
CREATE INDEX idx_stock_counts_count_date ON public.stock_counts(count_date);
CREATE INDEX idx_stock_count_items_stock_count_id ON public.stock_count_items(stock_count_id);
CREATE INDEX idx_stock_count_items_imei ON public.stock_count_items(imei);

-- Create trigger for updated_at
CREATE TRIGGER update_stock_counts_updated_at
  BEFORE UPDATE ON public.stock_counts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_count_items_updated_at
  BEFORE UPDATE ON public.stock_count_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();