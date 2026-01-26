
-- ============================================================
-- MULTI-TENANT ISOLATION: Siết RLS để mỗi tenant chỉ thấy dữ liệu của mình
-- ============================================================

-- 1. Tạo function lấy tenant_id của user hiện tại (từ platform_users hoặc user_roles)
CREATE OR REPLACE FUNCTION public.get_user_tenant_id_secure()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid() AND is_active = true LIMIT 1),
    (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)
  )
$$;

-- 2. Tạo function kiểm tra user có thuộc tenant không
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    _tenant_id IS NOT NULL 
    AND (
      public.is_platform_admin(auth.uid()) 
      OR public.get_user_tenant_id_secure() = _tenant_id
    )
$$;

-- ============================================================
-- PRODUCTS table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can manage products" ON public.products;

CREATE POLICY "Users can view own tenant products"
ON public.products FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users can manage own tenant products"
ON public.products FOR ALL
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

-- ============================================================
-- IMPORT_RECEIPTS table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view receipts" ON public.import_receipts;
DROP POLICY IF EXISTS "Authenticated users can manage receipts" ON public.import_receipts;

CREATE POLICY "Users can view own tenant import_receipts"
ON public.import_receipts FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users can manage own tenant import_receipts"
ON public.import_receipts FOR ALL
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

-- ============================================================
-- EXPORT_RECEIPTS table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view export receipts" ON public.export_receipts;
DROP POLICY IF EXISTS "Authenticated users can manage export receipts" ON public.export_receipts;

CREATE POLICY "Users can view own tenant export_receipts"
ON public.export_receipts FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users can manage own tenant export_receipts"
ON public.export_receipts FOR ALL
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

-- ============================================================
-- SUPPLIERS table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON public.suppliers;

CREATE POLICY "Users can view own tenant suppliers"
ON public.suppliers FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users can manage own tenant suppliers"
ON public.suppliers FOR ALL
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

-- ============================================================
-- CUSTOMERS table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can manage customers" ON public.customers;

CREATE POLICY "Users can view own tenant customers"
ON public.customers FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users can manage own tenant customers"
ON public.customers FOR ALL
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

-- ============================================================
-- CATEGORIES table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON public.categories;

CREATE POLICY "Users can view own tenant categories"
ON public.categories FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users can manage own tenant categories"
ON public.categories FOR ALL
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

-- ============================================================
-- BRANCHES table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view branches" ON public.branches;
DROP POLICY IF EXISTS "Authenticated users can manage branches" ON public.branches;

CREATE POLICY "Users can view own tenant branches"
ON public.branches FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users can manage own tenant branches"
ON public.branches FOR ALL
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

-- ============================================================
-- CASH_BOOK table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view cash book" ON public.cash_book;
DROP POLICY IF EXISTS "Authenticated users can manage cash book" ON public.cash_book;

CREATE POLICY "Users can view own tenant cash_book"
ON public.cash_book FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users can manage own tenant cash_book"
ON public.cash_book FOR ALL
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

-- ============================================================
-- DEBT_PAYMENTS table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view debt payments" ON public.debt_payments;
DROP POLICY IF EXISTS "Authenticated users can manage debt payments" ON public.debt_payments;

CREATE POLICY "Users can view own tenant debt_payments"
ON public.debt_payments FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users can manage own tenant debt_payments"
ON public.debt_payments FOR ALL
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

-- ============================================================
-- EXPORT_RETURNS table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view export returns" ON public.export_returns;
DROP POLICY IF EXISTS "Authenticated users can manage export returns" ON public.export_returns;

CREATE POLICY "Users can view own tenant export_returns"
ON public.export_returns FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users can manage own tenant export_returns"
ON public.export_returns FOR ALL
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

-- ============================================================
-- IMPORT_RETURNS table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view import returns" ON public.import_returns;
DROP POLICY IF EXISTS "Authenticated users can manage import returns" ON public.import_returns;

CREATE POLICY "Users can view own tenant import_returns"
ON public.import_returns FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users can manage own tenant import_returns"
ON public.import_returns FOR ALL
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

-- ============================================================
-- STOCK_COUNTS table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view stock counts" ON public.stock_counts;
DROP POLICY IF EXISTS "Authenticated users can insert stock counts" ON public.stock_counts;
DROP POLICY IF EXISTS "Authenticated users can update draft stock counts" ON public.stock_counts;
DROP POLICY IF EXISTS "Admins can update confirmed stock counts" ON public.stock_counts;

CREATE POLICY "Users can view own tenant stock_counts"
ON public.stock_counts FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users can insert own tenant stock_counts"
ON public.stock_counts FOR INSERT
WITH CHECK (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users can update draft stock_counts"
ON public.stock_counts FOR UPDATE
USING (
  (public.is_platform_admin(auth.uid()) OR tenant_id = public.get_user_tenant_id_secure())
  AND (status = 'draft' OR has_role(auth.uid(), 'admin'))
);

-- ============================================================
-- INVOICE_TEMPLATES table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view templates" ON public.invoice_templates;
DROP POLICY IF EXISTS "Authenticated users can manage templates" ON public.invoice_templates;

CREATE POLICY "Users can view own tenant invoice_templates"
ON public.invoice_templates FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Users can manage own tenant invoice_templates"
ON public.invoice_templates FOR ALL
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

-- ============================================================
-- POINT_SETTINGS table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view point settings" ON public.point_settings;
DROP POLICY IF EXISTS "Super admin can manage point settings" ON public.point_settings;

CREATE POLICY "Users can view own tenant point_settings"
ON public.point_settings FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Admins can manage own tenant point_settings"
ON public.point_settings FOR ALL
USING (
  public.is_platform_admin(auth.uid()) 
  OR (tenant_id = public.get_user_tenant_id_secure() AND has_role(auth.uid(), 'admin'))
);

-- ============================================================
-- MEMBERSHIP_TIER_SETTINGS table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view membership tiers" ON public.membership_tier_settings;
DROP POLICY IF EXISTS "Super admin can manage membership tiers" ON public.membership_tier_settings;

CREATE POLICY "Users can view own tenant membership_tier_settings"
ON public.membership_tier_settings FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

CREATE POLICY "Admins can manage own tenant membership_tier_settings"
ON public.membership_tier_settings FOR ALL
USING (
  public.is_platform_admin(auth.uid()) 
  OR (tenant_id = public.get_user_tenant_id_secure() AND has_role(auth.uid(), 'admin'))
);

-- ============================================================
-- AUDIT_LOGS table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Super admin can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Branch admin can view branch audit logs" ON public.audit_logs;

CREATE POLICY "Users can view own tenant audit_logs"
ON public.audit_logs FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
);

-- ============================================================
-- USER_ROLES table - siết theo tenant_id (nhân viên cùng tenant)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own tenant user_roles"
ON public.user_roles FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
  OR user_id = auth.uid()
);

CREATE POLICY "Admins can manage own tenant user_roles"
ON public.user_roles FOR ALL
USING (
  public.is_platform_admin(auth.uid()) 
  OR (tenant_id = public.get_user_tenant_id_secure() AND has_role(auth.uid(), 'admin'))
);

-- ============================================================
-- PROFILES table - siết theo tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own tenant profiles"
ON public.profiles FOR SELECT
USING (
  public.is_platform_admin(auth.uid()) 
  OR tenant_id = public.get_user_tenant_id_secure()
  OR user_id = auth.uid()
);
