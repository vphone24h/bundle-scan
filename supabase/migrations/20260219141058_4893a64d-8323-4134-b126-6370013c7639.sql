
-- Bảng theo dõi email onboarding sequence đã gửi per tenant
CREATE TABLE IF NOT EXISTS public.onboarding_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL, -- 'day_0_action', 'day_2_import', 'day_5_video', 'day_10_sell', 'inactive_reminder_15d'
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email_type)
);

ALTER TABLE public.onboarding_email_logs ENABLE ROW LEVEL SECURITY;

-- Platform admins có thể xem tất cả
CREATE POLICY "Platform admins can view onboarding email logs"
  ON public.onboarding_email_logs FOR SELECT
  USING (public.is_platform_admin(auth.uid()));
