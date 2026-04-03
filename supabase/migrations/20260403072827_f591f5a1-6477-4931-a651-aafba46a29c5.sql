
-- Allow tenant members / platform admins to INSERT jobs
DROP POLICY IF EXISTS "Tenant members can create data management jobs" ON public.data_management_jobs;
CREATE POLICY "Tenant members can create data management jobs"
ON public.data_management_jobs
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_data_management_jobs(tenant_id));

-- Allow tenant members / platform admins to UPDATE jobs (progress, status, etc.)
DROP POLICY IF EXISTS "Tenant members can update data management jobs" ON public.data_management_jobs;
CREATE POLICY "Tenant members can update data management jobs"
ON public.data_management_jobs
FOR UPDATE
TO authenticated
USING (public.can_access_data_management_jobs(tenant_id));
