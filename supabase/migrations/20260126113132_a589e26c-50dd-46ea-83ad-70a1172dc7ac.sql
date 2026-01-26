
-- Bảng khách hàng
CREATE TABLE public.customers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    address TEXT,
    email TEXT,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bảng phiếu xuất hàng
CREATE TABLE public.export_receipts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    export_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    customer_id UUID REFERENCES public.customers(id),
    total_amount NUMERIC NOT NULL DEFAULT 0,
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    debt_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'partial_return', 'full_return')),
    note TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bảng chi tiết sản phẩm trong phiếu xuất
CREATE TABLE public.export_receipt_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_id UUID NOT NULL REFERENCES public.export_receipts(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    imei TEXT,
    category_id UUID REFERENCES public.categories(id),
    sale_price NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'sold' CHECK (status IN ('sold', 'returned')),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bảng thanh toán phiếu xuất
CREATE TABLE public.export_receipt_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_id UUID NOT NULL REFERENCES public.export_receipts(id) ON DELETE CASCADE,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'bank_card', 'e_wallet', 'debt')),
    amount NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bảng lịch sử IMEI
CREATE TABLE public.imei_histories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id),
    imei TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('import', 'export', 'return', 'trade_in')),
    reference_id UUID, -- ID của phiếu nhập/xuất
    reference_type TEXT CHECK (reference_type IN ('import_receipt', 'export_receipt')),
    price NUMERIC,
    customer_id UUID REFERENCES public.customers(id),
    note TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bảng cấu hình mẫu in hóa đơn
CREATE TABLE public.invoice_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Mẫu mặc định',
    paper_size TEXT NOT NULL DEFAULT 'K80' CHECK (paper_size IN ('K80', 'A4')),
    show_logo BOOLEAN DEFAULT true,
    show_store_name BOOLEAN DEFAULT true,
    store_name TEXT,
    show_store_address BOOLEAN DEFAULT true,
    store_address TEXT,
    show_store_phone BOOLEAN DEFAULT true,
    store_phone TEXT,
    show_customer_info BOOLEAN DEFAULT true,
    show_sale_date BOOLEAN DEFAULT true,
    show_receipt_code BOOLEAN DEFAULT true,
    show_product_name BOOLEAN DEFAULT true,
    show_sku BOOLEAN DEFAULT true,
    show_imei BOOLEAN DEFAULT true,
    show_sale_price BOOLEAN DEFAULT true,
    show_total BOOLEAN DEFAULT true,
    show_paid_amount BOOLEAN DEFAULT true,
    show_debt BOOLEAN DEFAULT true,
    show_note BOOLEAN DEFAULT true,
    show_thank_you BOOLEAN DEFAULT true,
    thank_you_text TEXT DEFAULT 'Cảm ơn quý khách!',
    font_size TEXT DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),
    text_align TEXT DEFAULT 'left' CHECK (text_align IN ('left', 'center', 'right')),
    field_order JSONB DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_receipt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imei_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
CREATE POLICY "Authenticated users can view customers" ON public.customers FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage customers" ON public.customers FOR ALL USING (is_authenticated());

-- RLS Policies for export_receipts
CREATE POLICY "Authenticated users can view export receipts" ON public.export_receipts FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage export receipts" ON public.export_receipts FOR ALL USING (is_authenticated());

-- RLS Policies for export_receipt_items
CREATE POLICY "Authenticated users can view export receipt items" ON public.export_receipt_items FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage export receipt items" ON public.export_receipt_items FOR ALL USING (is_authenticated());

-- RLS Policies for export_receipt_payments
CREATE POLICY "Authenticated users can view export payments" ON public.export_receipt_payments FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage export payments" ON public.export_receipt_payments FOR ALL USING (is_authenticated());

-- RLS Policies for imei_histories
CREATE POLICY "Authenticated users can view imei histories" ON public.imei_histories FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage imei histories" ON public.imei_histories FOR ALL USING (is_authenticated());

-- RLS Policies for invoice_templates
CREATE POLICY "Authenticated users can view templates" ON public.invoice_templates FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage templates" ON public.invoice_templates FOR ALL USING (is_authenticated());

-- Indexes
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_export_receipts_date ON public.export_receipts(export_date DESC);
CREATE INDEX idx_export_receipts_customer ON public.export_receipts(customer_id);
CREATE INDEX idx_export_receipt_items_receipt ON public.export_receipt_items(receipt_id);
CREATE INDEX idx_export_receipt_items_imei ON public.export_receipt_items(imei);
CREATE INDEX idx_imei_histories_imei ON public.imei_histories(imei);
CREATE INDEX idx_imei_histories_product ON public.imei_histories(product_id);

-- Update triggers
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_export_receipts_updated_at BEFORE UPDATE ON public.export_receipts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoice_templates_updated_at BEFORE UPDATE ON public.invoice_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default invoice template
INSERT INTO public.invoice_templates (name, is_default) VALUES ('Mẫu mặc định', true);
