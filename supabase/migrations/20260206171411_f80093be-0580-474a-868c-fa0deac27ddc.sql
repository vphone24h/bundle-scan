-- Add supplier and note columns to stock_transfer_items
ALTER TABLE public.stock_transfer_items 
  ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id),
  ADD COLUMN supplier_name text,
  ADD COLUMN note text;