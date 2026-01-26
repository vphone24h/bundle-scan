-- Drop all existing VIEW policies that might conflict
DROP POLICY IF EXISTS "Users can view own tenant branches" ON public.branches;
DROP POLICY IF EXISTS "Users can view own tenant cash_book" ON public.cash_book;
DROP POLICY IF EXISTS "Users can view own tenant categories" ON public.categories;
DROP POLICY IF EXISTS "Users can view own tenant customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view own tenant suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can view own tenant products" ON public.products;
DROP POLICY IF EXISTS "Users can view own tenant import_receipts" ON public.import_receipts;
DROP POLICY IF EXISTS "Users can view own tenant export_receipts" ON public.export_receipts;
DROP POLICY IF EXISTS "Users can view own tenant export_returns" ON public.export_returns;
DROP POLICY IF EXISTS "Users can view own tenant debt_payments" ON public.debt_payments;
DROP POLICY IF EXISTS "Users can view own tenant invoice_templates" ON public.invoice_templates;
DROP POLICY IF EXISTS "Users can view own tenant point_settings" ON public.point_settings;
DROP POLICY IF EXISTS "Users can view own tenant membership_tier_settings" ON public.membership_tier_settings;
DROP POLICY IF EXISTS "Users can view own tenant return_payments" ON public.return_payments;

-- Drop any insert/update/delete policies 
DROP POLICY IF EXISTS "Users can insert own tenant branches" ON public.branches;
DROP POLICY IF EXISTS "Users can update own tenant branches" ON public.branches;
DROP POLICY IF EXISTS "Users can delete own tenant branches" ON public.branches;
DROP POLICY IF EXISTS "Users can insert own tenant cash_book" ON public.cash_book;
DROP POLICY IF EXISTS "Users can update own tenant cash_book" ON public.cash_book;
DROP POLICY IF EXISTS "Users can delete own tenant cash_book" ON public.cash_book;
DROP POLICY IF EXISTS "Users can insert own tenant categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own tenant categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own tenant categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own tenant customers" ON public.customers;
DROP POLICY IF EXISTS "Users can update own tenant customers" ON public.customers;
DROP POLICY IF EXISTS "Users can delete own tenant customers" ON public.customers;
DROP POLICY IF EXISTS "Users can insert own tenant suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update own tenant suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete own tenant suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can insert own tenant products" ON public.products;
DROP POLICY IF EXISTS "Users can update own tenant products" ON public.products;
DROP POLICY IF EXISTS "Users can delete own tenant products" ON public.products;
DROP POLICY IF EXISTS "Users can insert own tenant import_receipts" ON public.import_receipts;
DROP POLICY IF EXISTS "Users can update own tenant import_receipts" ON public.import_receipts;
DROP POLICY IF EXISTS "Users can delete own tenant import_receipts" ON public.import_receipts;
DROP POLICY IF EXISTS "Users can insert own tenant export_receipts" ON public.export_receipts;
DROP POLICY IF EXISTS "Users can update own tenant export_receipts" ON public.export_receipts;
DROP POLICY IF EXISTS "Users can delete own tenant export_receipts" ON public.export_receipts;
DROP POLICY IF EXISTS "Users can insert own tenant export_returns" ON public.export_returns;
DROP POLICY IF EXISTS "Users can update own tenant export_returns" ON public.export_returns;
DROP POLICY IF EXISTS "Users can delete own tenant export_returns" ON public.export_returns;
DROP POLICY IF EXISTS "Users can insert own tenant debt_payments" ON public.debt_payments;
DROP POLICY IF EXISTS "Users can update own tenant debt_payments" ON public.debt_payments;
DROP POLICY IF EXISTS "Users can delete own tenant debt_payments" ON public.debt_payments;
DROP POLICY IF EXISTS "Users can insert own tenant invoice_templates" ON public.invoice_templates;
DROP POLICY IF EXISTS "Users can update own tenant invoice_templates" ON public.invoice_templates;
DROP POLICY IF EXISTS "Users can delete own tenant invoice_templates" ON public.invoice_templates;
DROP POLICY IF EXISTS "Admins can insert own tenant point_settings" ON public.point_settings;
DROP POLICY IF EXISTS "Admins can update own tenant point_settings" ON public.point_settings;
DROP POLICY IF EXISTS "Admins can delete own tenant point_settings" ON public.point_settings;
DROP POLICY IF EXISTS "Admins can insert own tenant membership_tier_settings" ON public.membership_tier_settings;
DROP POLICY IF EXISTS "Admins can update own tenant membership_tier_settings" ON public.membership_tier_settings;
DROP POLICY IF EXISTS "Admins can delete own tenant membership_tier_settings" ON public.membership_tier_settings;
DROP POLICY IF EXISTS "Users can insert own tenant return_payments" ON public.return_payments;
DROP POLICY IF EXISTS "Users can update own tenant return_payments" ON public.return_payments;
DROP POLICY IF EXISTS "Users can delete own tenant return_payments" ON public.return_payments;

-- Now recreate all proper policies

-- branches
CREATE POLICY "Users can view own tenant branches"
ON public.branches FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can insert own tenant branches"
ON public.branches FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can update own tenant branches"
ON public.branches FOR UPDATE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure())
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can delete own tenant branches"
ON public.branches FOR DELETE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- cash_book
CREATE POLICY "Users can view own tenant cash_book"
ON public.cash_book FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can insert own tenant cash_book"
ON public.cash_book FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can update own tenant cash_book"
ON public.cash_book FOR UPDATE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure())
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can delete own tenant cash_book"
ON public.cash_book FOR DELETE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- categories  
CREATE POLICY "Users can view own tenant categories"
ON public.categories FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can insert own tenant categories"
ON public.categories FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can update own tenant categories"
ON public.categories FOR UPDATE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure())
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can delete own tenant categories"
ON public.categories FOR DELETE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- customers
CREATE POLICY "Users can view own tenant customers"
ON public.customers FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can insert own tenant customers"
ON public.customers FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can update own tenant customers"
ON public.customers FOR UPDATE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure())
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can delete own tenant customers"
ON public.customers FOR DELETE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- suppliers
CREATE POLICY "Users can view own tenant suppliers"
ON public.suppliers FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can insert own tenant suppliers"
ON public.suppliers FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can update own tenant suppliers"
ON public.suppliers FOR UPDATE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure())
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can delete own tenant suppliers"
ON public.suppliers FOR DELETE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- products
CREATE POLICY "Users can view own tenant products"
ON public.products FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can insert own tenant products"
ON public.products FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can update own tenant products"
ON public.products FOR UPDATE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure())
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can delete own tenant products"
ON public.products FOR DELETE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- import_receipts
CREATE POLICY "Users can view own tenant import_receipts"
ON public.import_receipts FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can insert own tenant import_receipts"
ON public.import_receipts FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can update own tenant import_receipts"
ON public.import_receipts FOR UPDATE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure())
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can delete own tenant import_receipts"
ON public.import_receipts FOR DELETE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- export_receipts
CREATE POLICY "Users can view own tenant export_receipts"
ON public.export_receipts FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can insert own tenant export_receipts"
ON public.export_receipts FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can update own tenant export_receipts"
ON public.export_receipts FOR UPDATE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure())
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can delete own tenant export_receipts"
ON public.export_receipts FOR DELETE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- export_returns
CREATE POLICY "Users can view own tenant export_returns"
ON public.export_returns FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can insert own tenant export_returns"
ON public.export_returns FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can update own tenant export_returns"
ON public.export_returns FOR UPDATE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure())
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can delete own tenant export_returns"
ON public.export_returns FOR DELETE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- debt_payments
CREATE POLICY "Users can view own tenant debt_payments"
ON public.debt_payments FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can insert own tenant debt_payments"
ON public.debt_payments FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can update own tenant debt_payments"
ON public.debt_payments FOR UPDATE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure())
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can delete own tenant debt_payments"
ON public.debt_payments FOR DELETE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- invoice_templates
CREATE POLICY "Users can view own tenant invoice_templates"
ON public.invoice_templates FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can insert own tenant invoice_templates"
ON public.invoice_templates FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can update own tenant invoice_templates"
ON public.invoice_templates FOR UPDATE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure())
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can delete own tenant invoice_templates"
ON public.invoice_templates FOR DELETE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- point_settings
CREATE POLICY "Users can view own tenant point_settings"
ON public.point_settings FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Admins can insert own tenant point_settings"
ON public.point_settings FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR (tenant_id = get_user_tenant_id_secure() AND has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Admins can update own tenant point_settings"
ON public.point_settings FOR UPDATE
USING (is_platform_admin(auth.uid()) OR (tenant_id = get_user_tenant_id_secure() AND has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (is_platform_admin(auth.uid()) OR (tenant_id = get_user_tenant_id_secure() AND has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Admins can delete own tenant point_settings"
ON public.point_settings FOR DELETE
USING (is_platform_admin(auth.uid()) OR (tenant_id = get_user_tenant_id_secure() AND has_role(auth.uid(), 'admin'::app_role)));

-- membership_tier_settings
CREATE POLICY "Users can view own tenant membership_tier_settings"
ON public.membership_tier_settings FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Admins can insert own tenant membership_tier_settings"
ON public.membership_tier_settings FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR (tenant_id = get_user_tenant_id_secure() AND has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Admins can update own tenant membership_tier_settings"
ON public.membership_tier_settings FOR UPDATE
USING (is_platform_admin(auth.uid()) OR (tenant_id = get_user_tenant_id_secure() AND has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (is_platform_admin(auth.uid()) OR (tenant_id = get_user_tenant_id_secure() AND has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Admins can delete own tenant membership_tier_settings"
ON public.membership_tier_settings FOR DELETE
USING (is_platform_admin(auth.uid()) OR (tenant_id = get_user_tenant_id_secure() AND has_role(auth.uid(), 'admin'::app_role)));

-- return_payments  
CREATE POLICY "Users can view own tenant return_payments"
ON public.return_payments FOR SELECT
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can insert own tenant return_payments"
ON public.return_payments FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can update own tenant return_payments"
ON public.return_payments FOR UPDATE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure())
WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can delete own tenant return_payments"
ON public.return_payments FOR DELETE
USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());