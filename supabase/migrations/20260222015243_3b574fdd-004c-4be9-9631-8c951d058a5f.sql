-- Add tenant_id to push_subscriptions for scoping
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS tenant_id text;

-- Create index for efficient tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant_id ON public.push_subscriptions(tenant_id);
