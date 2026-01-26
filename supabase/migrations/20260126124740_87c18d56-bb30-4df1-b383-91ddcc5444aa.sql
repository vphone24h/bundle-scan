-- Enum for return types
CREATE TYPE public.return_type AS ENUM ('import_return', 'export_return');

-- Enum for return fee type
CREATE TYPE public.return_fee_type AS ENUM ('none', 'percentage', 'fixed_amount');

-- Table for import returns (returning to suppliers)
CREATE TABLE public.import_returns (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL,
    return_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    product_id UUID NOT NULL REFERENCES public.products(id),
    import_receipt_id UUID REFERENCES public.import_receipts(id),
    supplier_id UUID REFERENCES public.suppliers(id),
    branch_id UUID REFERENCES public.branches(id),
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    imei TEXT,
    import_price NUMERIC NOT NULL,
    original_import_date TIMESTAMP WITH TIME ZONE,
    total_refund_amount NUMERIC NOT NULL DEFAULT 0,
    note TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for export returns (customer returns)
CREATE TABLE public.export_returns (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL,
    return_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    product_id UUID NOT NULL REFERENCES public.products(id),
    export_receipt_id UUID REFERENCES public.export_receipts(id),
    export_receipt_item_id UUID REFERENCES public.export_receipt_items(id),
    customer_id UUID REFERENCES public.customers(id),
    branch_id UUID REFERENCES public.branches(id),
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    imei TEXT,
    import_price NUMERIC NOT NULL,
    sale_price NUMERIC NOT NULL,
    original_sale_date TIMESTAMP WITH TIME ZONE,
    fee_type return_fee_type NOT NULL DEFAULT 'none',
    fee_percentage NUMERIC DEFAULT 0,
    fee_amount NUMERIC DEFAULT 0,
    refund_amount NUMERIC NOT NULL DEFAULT 0,
    store_keep_amount NUMERIC NOT NULL DEFAULT 0,
    new_import_receipt_id UUID REFERENCES public.import_receipts(id),
    is_business_accounting BOOLEAN DEFAULT true,
    note TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for return payments
CREATE TABLE public.return_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    return_id UUID NOT NULL,
    return_type return_type NOT NULL,
    payment_source TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for import_returns
CREATE POLICY "Authenticated users can view import returns"
ON public.import_returns
FOR SELECT
USING (is_authenticated());

CREATE POLICY "Authenticated users can manage import returns"
ON public.import_returns
FOR ALL
USING (is_authenticated());

-- RLS policies for export_returns
CREATE POLICY "Authenticated users can view export returns"
ON public.export_returns
FOR SELECT
USING (is_authenticated());

CREATE POLICY "Authenticated users can manage export returns"
ON public.export_returns
FOR ALL
USING (is_authenticated());

-- RLS policies for return_payments
CREATE POLICY "Authenticated users can view return payments"
ON public.return_payments
FOR SELECT
USING (is_authenticated());

CREATE POLICY "Authenticated users can manage return payments"
ON public.return_payments
FOR ALL
USING (is_authenticated());

-- Triggers for updated_at
CREATE TRIGGER update_import_returns_updated_at
    BEFORE UPDATE ON public.import_returns
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_export_returns_updated_at
    BEFORE UPDATE ON public.export_returns
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();