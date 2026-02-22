
-- System notifications table (created by platform admin)
CREATE TABLE public.system_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  full_content TEXT,
  notification_type TEXT NOT NULL DEFAULT 'info' CHECK (notification_type IN ('info', 'article', 'popup', 'startup')),
  link_url TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_as_startup_popup BOOLEAN NOT NULL DEFAULT false,
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'group')),
  target_tenant_ids UUID[] DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Track which users have read which system notifications
CREATE TABLE public.system_notification_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES public.system_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- Track startup popup dismissals (max 1/day)
CREATE TABLE public.system_notification_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES public.system_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- Enable RLS
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_notification_dismissals ENABLE ROW LEVEL SECURITY;

-- System notifications: all authenticated users can read active ones
CREATE POLICY "Authenticated users can view active notifications"
  ON public.system_notifications FOR SELECT TO authenticated
  USING (is_active = true);

-- Platform admins can manage notifications
CREATE POLICY "Platform admins can insert notifications"
  ON public.system_notifications FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid() AND platform_role = 'platform_admin')
  );

CREATE POLICY "Platform admins can update notifications"
  ON public.system_notifications FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid() AND platform_role = 'platform_admin')
  );

CREATE POLICY "Platform admins can delete notifications"
  ON public.system_notifications FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid() AND platform_role = 'platform_admin')
  );

-- Reads: users can manage their own reads
CREATE POLICY "Users can view their own reads"
  ON public.system_notification_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can mark as read"
  ON public.system_notification_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Dismissals: users can manage their own
CREATE POLICY "Users can view their own dismissals"
  ON public.system_notification_dismissals FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can dismiss"
  ON public.system_notification_dismissals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_system_notifications_active ON public.system_notifications(is_active, created_at DESC);
CREATE INDEX idx_system_notifications_pinned ON public.system_notifications(is_pinned, is_active);
CREATE INDEX idx_system_notification_reads_user ON public.system_notification_reads(user_id, notification_id);
CREATE INDEX idx_system_notification_dismissals_user ON public.system_notification_dismissals(user_id, notification_id);

-- Updated_at trigger
CREATE TRIGGER update_system_notifications_updated_at
  BEFORE UPDATE ON public.system_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
