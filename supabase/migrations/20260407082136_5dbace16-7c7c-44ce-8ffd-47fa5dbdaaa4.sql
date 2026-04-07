
-- Add company_admin to platform_role enum
ALTER TYPE public.platform_role ADD VALUE IF NOT EXISTS 'company_admin';

-- Add company_id column to platform_users for company admins
ALTER TABLE public.platform_users 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_platform_users_company_id ON public.platform_users(company_id);
