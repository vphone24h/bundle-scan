ALTER TABLE public.data_management_jobs
ADD COLUMN IF NOT EXISTS job_type TEXT NOT NULL DEFAULT 'delete_restore',
ADD COLUMN IF NOT EXISTS source_bucket TEXT,
ADD COLUMN IF NOT EXISTS source_path TEXT,
ADD COLUMN IF NOT EXISTS result_summary JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.data_management_jobs
DROP CONSTRAINT IF EXISTS data_management_jobs_delete_mode_check;

ALTER TABLE public.data_management_jobs
ADD CONSTRAINT data_management_jobs_delete_mode_check
CHECK (delete_mode IN ('full', 'keep_templates', 'merge'));

CREATE INDEX IF NOT EXISTS idx_data_management_jobs_job_type_status
  ON public.data_management_jobs (job_type, status, created_at DESC);

DROP POLICY IF EXISTS "Tenant members can create data management jobs" ON public.data_management_jobs;
CREATE POLICY "Tenant members can create data management jobs"
ON public.data_management_jobs
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_data_management_jobs(tenant_id));

DROP POLICY IF EXISTS "Tenant members can update data management jobs" ON public.data_management_jobs;
CREATE POLICY "Tenant members can update data management jobs"
ON public.data_management_jobs
FOR UPDATE
TO authenticated
USING (public.can_access_data_management_jobs(tenant_id));