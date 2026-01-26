-- ========================================
-- MULTI-TENANT SAAS DATABASE SCHEMA
-- ========================================

-- 1. TENANT STATUS ENUM
CREATE TYPE public.tenant_status AS ENUM ('trial', 'active', 'expired', 'locked');

-- 2. SUBSCRIPTION PLAN ENUM
CREATE TYPE public.subscription_plan AS ENUM ('monthly', 'yearly', 'lifetime');

-- 3. PAYMENT STATUS ENUM
CREATE TYPE public.payment_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- 4. PLATFORM ROLE ENUM (for platform-level roles)
CREATE TYPE public.platform_role AS ENUM ('platform_admin', 'tenant_admin');

-- ========================================
-- CORE TENANT TABLES
-- ========================================

-- 5. TENANTS TABLE - Each registered business
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- Business name
    subdomain TEXT NOT NULL UNIQUE, -- Unique subdomain
    owner_id UUID NOT NULL, -- Reference to auth.users
    status tenant_status NOT NULL DEFAULT 'trial',
    trial_start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    trial_end_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days'),
    subscription_plan subscription_plan,
    subscription_start_date TIMESTAMP WITH TIME ZONE,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    max_branches INTEGER DEFAULT 1,
    max_users INTEGER DEFAULT 5,
    phone TEXT,
    email TEXT,
    address TEXT,
    note TEXT,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. SUBSCRIPTION PLANS TABLE - Pricing configuration
CREATE TABLE public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plan_type subscription_plan NOT NULL UNIQUE,
    price NUMERIC NOT NULL DEFAULT 0,
    duration_days INTEGER, -- NULL for lifetime
    max_branches INTEGER DEFAULT 1,
    max_users INTEGER DEFAULT 5,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. PAYMENT REQUESTS TABLE
CREATE TABLE public.payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
    amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'bank_transfer', -- bank_transfer, momo, vnpay, etc.
    payment_code TEXT NOT NULL UNIQUE, -- Unique payment reference code
    payment_proof_url TEXT, -- Screenshot/proof of payment
    status payment_status NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID, -- Platform admin who approved
    rejected_reason TEXT,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. SUBSCRIPTION HISTORY TABLE
CREATE TABLE public.subscription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.subscription_plans(id),
    payment_request_id UUID REFERENCES public.payment_requests(id),
    action TEXT NOT NULL, -- 'trial_start', 'subscription_start', 'renewal', 'extension', 'expired', 'locked', 'unlocked'
    old_status tenant_status,
    new_status tenant_status,
    old_end_date TIMESTAMP WITH TIME ZONE,
    new_end_date TIMESTAMP WITH TIME ZONE,
    days_added INTEGER,
    note TEXT,
    performed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. PLATFORM USERS TABLE - Platform admin and tenant owners
CREATE TABLE public.platform_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE, -- NULL for platform_admin
    platform_role platform_role NOT NULL DEFAULT 'tenant_admin',
    display_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ========================================
-- UPDATE EXISTING TABLES WITH TENANT_ID
-- ========================================

-- Add tenant_id to existing tables
ALTER TABLE public.branches ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.customers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.import_receipts ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.export_receipts ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.cash_book ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_templates ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.point_settings ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.membership_tier_settings ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.stock_counts ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.import_returns ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.export_returns ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.debt_payments ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Get user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id FROM public.platform_users WHERE user_id = _user_id LIMIT 1
$$;

-- Check if user is platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.platform_users 
        WHERE user_id = _user_id 
        AND platform_role = 'platform_admin'
        AND is_active = true
    )
$$;

-- Check if user belongs to a tenant
CREATE OR REPLACE FUNCTION public.belongs_to_tenant(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.platform_users 
        WHERE user_id = _user_id 
        AND tenant_id = _tenant_id
        AND is_active = true
    )
    OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id
        AND tenant_id = _tenant_id
    )
$$;

-- Check if tenant is accessible (not locked/expired)
CREATE OR REPLACE FUNCTION public.is_tenant_accessible(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.tenants
        WHERE id = _tenant_id
        AND status IN ('trial', 'active')
    )
$$;

-- Get current tenant for user
CREATE OR REPLACE FUNCTION public.get_current_tenant()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT get_user_tenant_id(auth.uid())
$$;

-- ========================================
-- ENABLE RLS ON NEW TABLES
-- ========================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_users ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES FOR TENANTS
-- ========================================

-- Platform admins can see all tenants
CREATE POLICY "Platform admins can view all tenants"
ON public.tenants FOR SELECT
USING (is_platform_admin(auth.uid()));

-- Platform admins can manage all tenants
CREATE POLICY "Platform admins can manage tenants"
ON public.tenants FOR ALL
USING (is_platform_admin(auth.uid()));

-- Tenant owners can view their own tenant
CREATE POLICY "Tenant owners can view own tenant"
ON public.tenants FOR SELECT
USING (owner_id = auth.uid() OR belongs_to_tenant(auth.uid(), id));

-- ========================================
-- RLS POLICIES FOR SUBSCRIPTION PLANS
-- ========================================

-- Anyone authenticated can view active plans
CREATE POLICY "Authenticated users can view active plans"
ON public.subscription_plans FOR SELECT
USING (is_authenticated() AND is_active = true);

-- Platform admins can manage plans
CREATE POLICY "Platform admins can manage plans"
ON public.subscription_plans FOR ALL
USING (is_platform_admin(auth.uid()));

-- ========================================
-- RLS POLICIES FOR PAYMENT REQUESTS
-- ========================================

-- Platform admins can view all payment requests
CREATE POLICY "Platform admins can view all payments"
ON public.payment_requests FOR SELECT
USING (is_platform_admin(auth.uid()));

-- Platform admins can manage payment requests
CREATE POLICY "Platform admins can manage payments"
ON public.payment_requests FOR ALL
USING (is_platform_admin(auth.uid()));

-- Tenant users can view/create their own payment requests
CREATE POLICY "Tenant users can view own payments"
ON public.payment_requests FOR SELECT
USING (belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant users can create payments"
ON public.payment_requests FOR INSERT
WITH CHECK (belongs_to_tenant(auth.uid(), tenant_id));

-- ========================================
-- RLS POLICIES FOR SUBSCRIPTION HISTORY
-- ========================================

-- Platform admins can view all history
CREATE POLICY "Platform admins can view all history"
ON public.subscription_history FOR SELECT
USING (is_platform_admin(auth.uid()));

-- Platform admins can manage history
CREATE POLICY "Platform admins can manage history"
ON public.subscription_history FOR ALL
USING (is_platform_admin(auth.uid()));

-- Tenant users can view their own history
CREATE POLICY "Tenant users can view own history"
ON public.subscription_history FOR SELECT
USING (belongs_to_tenant(auth.uid(), tenant_id));

-- ========================================
-- RLS POLICIES FOR PLATFORM USERS
-- ========================================

-- Platform admins can view all platform users
CREATE POLICY "Platform admins can view all platform users"
ON public.platform_users FOR SELECT
USING (is_platform_admin(auth.uid()));

-- Platform admins can manage platform users
CREATE POLICY "Platform admins can manage platform users"
ON public.platform_users FOR ALL
USING (is_platform_admin(auth.uid()));

-- Users can view their own record
CREATE POLICY "Users can view own platform user"
ON public.platform_users FOR SELECT
USING (user_id = auth.uid());

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX idx_tenants_subdomain ON public.tenants(subdomain);
CREATE INDEX idx_tenants_owner_id ON public.tenants(owner_id);
CREATE INDEX idx_tenants_status ON public.tenants(status);
CREATE INDEX idx_payment_requests_tenant ON public.payment_requests(tenant_id);
CREATE INDEX idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX idx_platform_users_user_id ON public.platform_users(user_id);
CREATE INDEX idx_platform_users_tenant_id ON public.platform_users(tenant_id);

-- Indexes for tenant_id on existing tables
CREATE INDEX idx_branches_tenant ON public.branches(tenant_id);
CREATE INDEX idx_categories_tenant ON public.categories(tenant_id);
CREATE INDEX idx_suppliers_tenant ON public.suppliers(tenant_id);
CREATE INDEX idx_products_tenant ON public.products(tenant_id);
CREATE INDEX idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX idx_import_receipts_tenant ON public.import_receipts(tenant_id);
CREATE INDEX idx_export_receipts_tenant ON public.export_receipts(tenant_id);
CREATE INDEX idx_cash_book_tenant ON public.cash_book(tenant_id);
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX idx_user_roles_tenant ON public.user_roles(tenant_id);

-- ========================================
-- INSERT DEFAULT SUBSCRIPTION PLANS
-- ========================================

INSERT INTO public.subscription_plans (name, plan_type, price, duration_days, max_branches, max_users, description) VALUES
('Gói Tháng', 'monthly', 299000, 30, 2, 10, 'Sử dụng đầy đủ tính năng trong 30 ngày'),
('Gói Năm', 'yearly', 3000000, 365, 5, 30, 'Sử dụng đầy đủ tính năng trong 1 năm - Tiết kiệm 17%'),
('Gói Vĩnh Viễn', 'lifetime', 9000000, NULL, 10, 100, 'Sử dụng vĩnh viễn không giới hạn thời gian');

-- ========================================
-- UPDATE TRIGGER FOR TENANTS
-- ========================================

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON public.subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_requests_updated_at
    BEFORE UPDATE ON public.payment_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_platform_users_updated_at
    BEFORE UPDATE ON public.platform_users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();