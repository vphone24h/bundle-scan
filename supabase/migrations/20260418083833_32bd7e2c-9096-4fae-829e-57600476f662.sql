CREATE TABLE IF NOT EXISTS public.global_smtp_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  smtp_user TEXT,
  smtp_password TEXT,
  smtp_host TEXT NOT NULL DEFAULT 'smtp.gmail.com',
  smtp_port INTEGER NOT NULL DEFAULT 465,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.global_smtp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admin can read global smtp"
ON public.global_smtp_config FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = auth.uid() AND platform_role = 'platform_admin'
  )
);

CREATE POLICY "Platform admin can upsert global smtp"
ON public.global_smtp_config FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = auth.uid() AND platform_role = 'platform_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = auth.uid() AND platform_role = 'platform_admin'
  )
);

INSERT INTO public.global_smtp_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;