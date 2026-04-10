
-- Add overtime_enabled to salary_templates
ALTER TABLE public.salary_templates ADD COLUMN IF NOT EXISTS overtime_enabled boolean NOT NULL DEFAULT false;

-- Create overtime configs table
CREATE TABLE public.salary_template_overtimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.salary_templates(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  overtime_type text NOT NULL DEFAULT 'full_day',
  name text NOT NULL DEFAULT '',
  calc_type text NOT NULL DEFAULT 'multiplier',
  value numeric NOT NULL DEFAULT 150,
  description text DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_template_overtimes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant overtimes"
  ON public.salary_template_overtimes FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own tenant overtimes"
  ON public.salary_template_overtimes FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own tenant overtimes"
  ON public.salary_template_overtimes FOR UPDATE
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own tenant overtimes"
  ON public.salary_template_overtimes FOR DELETE
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.platform_users WHERE user_id = auth.uid()));
