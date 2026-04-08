
-- Enum for repair status
CREATE TYPE public.repair_status AS ENUM (
  'received',
  'pending_check', 
  'repairing',
  'waiting_parts',
  'completed',
  'returned'
);

-- Repair request types (configurable per tenant)
CREATE TABLE public.repair_request_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tenant_id TEXT,
  display_order INT DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_request_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.repair_request_types
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT raw_app_meta_data->>'tenant_id' FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT raw_app_meta_data->>'tenant_id' FROM auth.users WHERE id = auth.uid()));

-- Main repair orders table
CREATE TABLE public.repair_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  tenant_id TEXT,
  branch_id UUID REFERENCES public.branches(id),
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT,
  customer_phone TEXT,
  -- Device info
  device_name TEXT NOT NULL,
  device_imei TEXT,
  device_model TEXT,
  device_password TEXT,
  device_condition TEXT,
  device_images TEXT[] DEFAULT '{}',
  quantity INT NOT NULL DEFAULT 1,
  -- Request
  request_type_id UUID REFERENCES public.repair_request_types(id),
  request_type_name TEXT DEFAULT 'Sửa chữa',
  status public.repair_status NOT NULL DEFAULT 'received',
  estimated_price NUMERIC DEFAULT 0,
  due_date TIMESTAMPTZ,
  -- Staff
  received_by TEXT,
  received_by_name TEXT,
  technician_id TEXT,
  technician_name TEXT,
  -- Financial
  total_service_price NUMERIC DEFAULT 0,
  total_parts_price NUMERIC DEFAULT 0,
  total_parts_cost NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  -- Linking to export receipt when returned
  export_receipt_id UUID,
  -- Meta
  note TEXT,
  send_email BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_repair_orders_tenant ON public.repair_orders(tenant_id);
CREATE INDEX idx_repair_orders_status ON public.repair_orders(status);
CREATE INDEX idx_repair_orders_code ON public.repair_orders(code);
CREATE INDEX idx_repair_orders_customer ON public.repair_orders(customer_id);
CREATE INDEX idx_repair_orders_imei ON public.repair_orders(device_imei);

ALTER TABLE public.repair_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.repair_orders
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT raw_app_meta_data->>'tenant_id' FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT raw_app_meta_data->>'tenant_id' FROM auth.users WHERE id = auth.uid()));

-- Repair order items (services & parts)
CREATE TABLE public.repair_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  repair_order_id UUID NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  tenant_id TEXT,
  item_type TEXT NOT NULL DEFAULT 'service', -- 'service' or 'part'
  product_id UUID REFERENCES public.products(id),
  product_name TEXT,
  product_sku TEXT,
  product_imei TEXT,
  description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC DEFAULT 0, -- for parts from inventory
  total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  import_receipt_id UUID, -- link to import if part was purchased
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_repair_items_order ON public.repair_order_items(repair_order_id);

ALTER TABLE public.repair_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.repair_order_items
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT raw_app_meta_data->>'tenant_id' FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT raw_app_meta_data->>'tenant_id' FROM auth.users WHERE id = auth.uid()));

-- Status history
CREATE TABLE public.repair_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  repair_order_id UUID NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  tenant_id TEXT,
  old_status public.repair_status,
  new_status public.repair_status NOT NULL,
  changed_by TEXT,
  changed_by_name TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.repair_status_history
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT raw_app_meta_data->>'tenant_id' FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT raw_app_meta_data->>'tenant_id' FROM auth.users WHERE id = auth.uid()));

-- Auto-generate repair code
CREATE OR REPLACE FUNCTION public.generate_repair_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
  prefix TEXT;
BEGIN
  prefix := 'SC';
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 3) AS INT)), 0) + 1
  INTO next_num
  FROM public.repair_orders
  WHERE tenant_id = NEW.tenant_id;
  
  NEW.code := prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_repair_code
  BEFORE INSERT ON public.repair_orders
  FOR EACH ROW
  WHEN (NEW.code IS NULL OR NEW.code = '')
  EXECUTE FUNCTION public.generate_repair_code();

-- Update timestamp trigger
CREATE TRIGGER update_repair_orders_updated_at
  BEFORE UPDATE ON public.repair_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.repair_orders;
