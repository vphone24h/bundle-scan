
ALTER TABLE public.export_receipts 
  ADD COLUMN repair_order_id UUID REFERENCES public.repair_orders(id),
  ADD COLUMN is_repair BOOLEAN DEFAULT false;

CREATE INDEX idx_export_receipts_repair ON public.export_receipts(repair_order_id) WHERE repair_order_id IS NOT NULL;
