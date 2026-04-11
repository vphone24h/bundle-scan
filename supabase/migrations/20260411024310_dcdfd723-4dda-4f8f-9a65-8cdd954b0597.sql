
-- Create daily_backups table
CREATE TABLE public.daily_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  backup_date DATE NOT NULL,
  file_path TEXT,
  file_size BIGINT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  stats JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(tenant_id, backup_date)
);

-- Enable RLS
ALTER TABLE public.daily_backups ENABLE ROW LEVEL SECURITY;

-- Policy: users can view backups of their own tenant
CREATE POLICY "Users can view own tenant backups"
  ON public.daily_backups
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
  ));

-- Policy: service role can manage all backups (for edge function)
CREATE POLICY "Service role manages backups"
  ON public.daily_backups
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for quick lookup
CREATE INDEX idx_daily_backups_tenant_date ON public.daily_backups(tenant_id, backup_date DESC);
CREATE INDEX idx_daily_backups_expires ON public.daily_backups(expires_at) WHERE expires_at IS NOT NULL;

-- Create storage bucket for daily backups
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('daily-backups', 'daily-backups', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can download their tenant's backups
CREATE POLICY "Users can download own tenant backups"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'daily-backups'
    AND (storage.foldername(name))[1] IN (
      SELECT p.tenant_id::text FROM profiles p WHERE p.user_id = auth.uid()
    )
  );

-- Service role can upload/delete
CREATE POLICY "Service role manages backup files"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'daily-backups')
  WITH CHECK (bucket_id = 'daily-backups');
