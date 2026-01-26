-- Create enum for e-invoice provider types
CREATE TYPE public.einvoice_provider AS ENUM ('vnpt', 'viettel', 'fpt', 'misa', 'other');

-- Create enum for e-invoice status
CREATE TYPE public.einvoice_status AS ENUM ('draft', 'pending', 'issued', 'cancelled', 'adjusted', 'error');

-- E-Invoice provider configurations per tenant
CREATE TABLE public.einvoice_configs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    provider einvoice_provider NOT NULL DEFAULT 'vnpt',
    provider_name TEXT NOT NULL,
    api_url TEXT NOT NULL,
    username TEXT,
    api_key_encrypted TEXT, -- Store encrypted API key
    tax_code TEXT NOT NULL, -- Mã số thuế doanh nghiệp
    company_name TEXT NOT NULL,
    company_address TEXT,
    company_phone TEXT,
    company_email TEXT,
    invoice_series TEXT, -- Ký hiệu hoá đơn (e.g., 1C24TXX)
    invoice_template TEXT, -- Mẫu số hoá đơn
    is_active BOOLEAN NOT NULL DEFAULT true,
    sandbox_mode BOOLEAN NOT NULL DEFAULT true, -- Test mode
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, provider)
);

-- E-Invoice records
CREATE TABLE public.einvoices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    branch_id UUID REFERENCES public.branches(id),
    export_receipt_id UUID REFERENCES public.export_receipts(id),
    config_id UUID REFERENCES public.einvoice_configs(id) NOT NULL,
    
    -- Invoice identification
    invoice_series TEXT, -- Ký hiệu hoá đơn
    invoice_number TEXT, -- Số hoá đơn
    invoice_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    provider_invoice_id TEXT, -- ID từ nhà cung cấp
    lookup_code TEXT, -- Mã tra cứu
    
    -- Customer info
    customer_name TEXT NOT NULL,
    customer_tax_code TEXT,
    customer_address TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    
    -- Amounts
    subtotal NUMERIC NOT NULL DEFAULT 0,
    vat_rate NUMERIC NOT NULL DEFAULT 10,
    vat_amount NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    amount_in_words TEXT,
    
    -- Status
    status einvoice_status NOT NULL DEFAULT 'draft',
    error_message TEXT,
    provider_response JSONB,
    
    -- Adjustment/Cancellation
    original_invoice_id UUID REFERENCES public.einvoices(id),
    adjustment_reason TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID,
    
    -- Metadata
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- E-Invoice items
CREATE TABLE public.einvoice_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    einvoice_id UUID REFERENCES public.einvoices(id) ON DELETE CASCADE NOT NULL,
    line_number INTEGER NOT NULL DEFAULT 1,
    product_name TEXT NOT NULL,
    product_code TEXT,
    unit TEXT DEFAULT 'Cái',
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    amount NUMERIC NOT NULL DEFAULT 0,
    vat_rate NUMERIC DEFAULT 10,
    vat_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- E-Invoice API logs for debugging
CREATE TABLE public.einvoice_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    einvoice_id UUID REFERENCES public.einvoices(id),
    action TEXT NOT NULL, -- create, cancel, lookup, adjust
    request_data JSONB,
    response_data JSONB,
    status_code INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.einvoice_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.einvoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.einvoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.einvoice_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for einvoice_configs
CREATE POLICY "Users can view own tenant einvoice_configs"
ON public.einvoice_configs FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Admins can manage own tenant einvoice_configs"
ON public.einvoice_configs FOR ALL
USING (is_platform_admin(auth.uid()) OR (tenant_id = get_user_tenant_id_secure() AND get_user_role(auth.uid()) IN ('super_admin', 'branch_admin')));

-- RLS Policies for einvoices
CREATE POLICY "Users can view own tenant einvoices"
ON public.einvoices FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can insert own tenant einvoices"
ON public.einvoice_configs FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can manage own tenant einvoices"
ON public.einvoices FOR ALL
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- RLS Policies for einvoice_items
CREATE POLICY "Users can manage einvoice_items"
ON public.einvoice_items FOR ALL
USING (is_authenticated());

-- RLS Policies for einvoice_logs
CREATE POLICY "Users can view own tenant einvoice_logs"
ON public.einvoice_logs FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can insert einvoice_logs"
ON public.einvoice_logs FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- Indexes for performance
CREATE INDEX idx_einvoices_tenant_id ON public.einvoices(tenant_id);
CREATE INDEX idx_einvoices_status ON public.einvoices(status);
CREATE INDEX idx_einvoices_invoice_date ON public.einvoices(invoice_date);
CREATE INDEX idx_einvoices_export_receipt ON public.einvoices(export_receipt_id);
CREATE INDEX idx_einvoice_items_einvoice_id ON public.einvoice_items(einvoice_id);
CREATE INDEX idx_einvoice_logs_tenant_id ON public.einvoice_logs(tenant_id);

-- Trigger for updated_at
CREATE TRIGGER update_einvoice_configs_updated_at
BEFORE UPDATE ON public.einvoice_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_einvoices_updated_at
BEFORE UPDATE ON public.einvoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();