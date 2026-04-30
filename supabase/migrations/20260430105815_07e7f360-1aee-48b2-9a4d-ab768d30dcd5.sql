-- Sửa RLS policy cho paid_leave_default_dates và paid_leave_overrides
-- Bỏ yêu cầu role 'admin' cứng, dùng tenant scoping giống employee_salary_configs

DROP POLICY IF EXISTS "Tenant admins manage default leave dates" ON public.paid_leave_default_dates;
DROP POLICY IF EXISTS "Users view own default leave dates" ON public.paid_leave_default_dates;

CREATE POLICY "paid_leave_default_dates_tenant"
ON public.paid_leave_default_dates
FOR ALL
USING (tenant_id IN (SELECT pu.tenant_id FROM public.platform_users pu WHERE pu.user_id = auth.uid()))
WITH CHECK (tenant_id IN (SELECT pu.tenant_id FROM public.platform_users pu WHERE pu.user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant admins manage leave overrides" ON public.paid_leave_overrides;
DROP POLICY IF EXISTS "Users view own leave overrides" ON public.paid_leave_overrides;

CREATE POLICY "paid_leave_overrides_tenant"
ON public.paid_leave_overrides
FOR ALL
USING (tenant_id IN (SELECT pu.tenant_id FROM public.platform_users pu WHERE pu.user_id = auth.uid()))
WITH CHECK (tenant_id IN (SELECT pu.tenant_id FROM public.platform_users pu WHERE pu.user_id = auth.uid()));