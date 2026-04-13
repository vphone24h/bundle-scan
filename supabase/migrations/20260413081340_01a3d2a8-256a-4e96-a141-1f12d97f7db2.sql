
-- Create leave_requests table
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  leave_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_leave_requests_tenant_status ON public.leave_requests(tenant_id, status);
CREATE INDEX idx_leave_requests_user ON public.leave_requests(user_id, leave_date);

-- Unique constraint: one request per user per date
CREATE UNIQUE INDEX idx_leave_requests_unique ON public.leave_requests(user_id, leave_date) WHERE status != 'rejected';

-- Enable RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view leave requests in their tenant"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can create their own leave requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can update leave requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
