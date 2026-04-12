
CREATE TABLE public.overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  request_type TEXT NOT NULL DEFAULT 'extra_hours',
  request_date DATE NOT NULL,
  overtime_minutes INTEGER NOT NULL DEFAULT 0,
  attendance_id UUID REFERENCES public.attendance_records(id),
  status TEXT NOT NULL DEFAULT 'pending',
  review_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id, request_date, request_type)
);

ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view overtime requests"
ON public.overtime_requests FOR SELECT
TO authenticated
USING (
  tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid())
);

CREATE POLICY "Tenant members can insert overtime requests"
ON public.overtime_requests FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid())
);

CREATE POLICY "Tenant members can update overtime requests"
ON public.overtime_requests FOR UPDATE
TO authenticated
USING (
  tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid())
);
