
-- Fix RLS for salary_template_bonuses
DROP POLICY IF EXISTS "Tenant members manage bonuses" ON public.salary_template_bonuses;
CREATE POLICY "Users can select own tenant bonuses" ON public.salary_template_bonuses FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own tenant bonuses" ON public.salary_template_bonuses FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own tenant bonuses" ON public.salary_template_bonuses FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own tenant bonuses" ON public.salary_template_bonuses FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));

-- Fix RLS for salary_template_commissions
DROP POLICY IF EXISTS "Tenant members manage commissions" ON public.salary_template_commissions;
CREATE POLICY "Users can select own tenant commissions" ON public.salary_template_commissions FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own tenant commissions" ON public.salary_template_commissions FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own tenant commissions" ON public.salary_template_commissions FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own tenant commissions" ON public.salary_template_commissions FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));

-- Fix RLS for salary_template_allowances
DROP POLICY IF EXISTS "Tenant members manage allowances" ON public.salary_template_allowances;
CREATE POLICY "Users can select own tenant allowances" ON public.salary_template_allowances FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own tenant allowances" ON public.salary_template_allowances FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own tenant allowances" ON public.salary_template_allowances FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own tenant allowances" ON public.salary_template_allowances FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));

-- Fix RLS for salary_template_holidays
DROP POLICY IF EXISTS "Tenant members manage holidays" ON public.salary_template_holidays;
CREATE POLICY "Users can select own tenant holidays" ON public.salary_template_holidays FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own tenant holidays" ON public.salary_template_holidays FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own tenant holidays" ON public.salary_template_holidays FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own tenant holidays" ON public.salary_template_holidays FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));

-- Fix RLS for salary_template_penalties
DROP POLICY IF EXISTS "Tenant members manage penalties" ON public.salary_template_penalties;
CREATE POLICY "Users can select own tenant penalties" ON public.salary_template_penalties FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own tenant penalties" ON public.salary_template_penalties FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own tenant penalties" ON public.salary_template_penalties FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own tenant penalties" ON public.salary_template_penalties FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM platform_users WHERE user_id = auth.uid()));
