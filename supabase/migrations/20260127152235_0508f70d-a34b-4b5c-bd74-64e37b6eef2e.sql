-- Create backup tables for test mode
-- These tables store a copy of warehouse data when test mode is enabled

-- Backup for products
CREATE TABLE public.products_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  backup_date timestamp with time zone DEFAULT now(),
  data jsonb NOT NULL
);

ALTER TABLE public.products_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tenant products_backup"
  ON public.products_backup FOR ALL
  USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- Backup for import_receipts
CREATE TABLE public.import_receipts_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  backup_date timestamp with time zone DEFAULT now(),
  data jsonb NOT NULL
);

ALTER TABLE public.import_receipts_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tenant import_receipts_backup"
  ON public.import_receipts_backup FOR ALL
  USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- Backup for export_receipts
CREATE TABLE public.export_receipts_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  backup_date timestamp with time zone DEFAULT now(),
  data jsonb NOT NULL
);

ALTER TABLE public.export_receipts_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tenant export_receipts_backup"
  ON public.export_receipts_backup FOR ALL
  USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- Backup for cash_book
CREATE TABLE public.cash_book_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  backup_date timestamp with time zone DEFAULT now(),
  data jsonb NOT NULL
);

ALTER TABLE public.cash_book_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tenant cash_book_backup"
  ON public.cash_book_backup FOR ALL
  USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- Add column to track if backup exists
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS has_data_backup boolean DEFAULT false;