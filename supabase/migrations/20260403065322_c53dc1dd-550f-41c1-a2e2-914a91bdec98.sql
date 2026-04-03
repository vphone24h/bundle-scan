DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'data_management_job_status'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.data_management_job_status AS ENUM ('queued', 'processing', 'completed', 'failed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.data_management_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  requested_by_email TEXT,
  delete_mode TEXT NOT NULL DEFAULT 'full',
  status public.data_management_job_status NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  current_step TEXT,
  notify_email TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT data_management_jobs_delete_mode_check CHECK (delete_mode IN ('full', 'keep_templates')),
  CONSTRAINT data_management_jobs_progress_check CHECK (progress >= 0 AND progress <= 100)
);

CREATE INDEX IF NOT EXISTS idx_data_management_jobs_tenant_created_at
  ON public.data_management_jobs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_management_jobs_status
  ON public.data_management_jobs (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_management_jobs_one_active_per_tenant
  ON public.data_management_jobs (tenant_id)
  WHERE status IN ('queued', 'processing');

ALTER TABLE public.data_management_jobs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_data_management_jobs(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = _tenant_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
      AND pu.platform_role = 'platform_admin'
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_access_data_management_jobs(UUID) TO authenticated;

DROP POLICY IF EXISTS "Tenant members can view data management jobs" ON public.data_management_jobs;
CREATE POLICY "Tenant members can view data management jobs"
ON public.data_management_jobs
FOR SELECT
TO authenticated
USING (public.can_access_data_management_jobs(tenant_id));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_data_management_jobs_updated_at ON public.data_management_jobs;
CREATE TRIGGER update_data_management_jobs_updated_at
BEFORE UPDATE ON public.data_management_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();