
-- 1. Bảng voucher mẫu (templates) do admin tạo
CREATE TABLE public.voucher_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  discount_type text NOT NULL DEFAULT 'amount' CHECK (discount_type IN ('amount', 'percentage')),
  discount_value numeric NOT NULL DEFAULT 0,
  description text,
  conditions text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.voucher_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users manage voucher templates"
  ON public.voucher_templates FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Anon can view active voucher templates"
  ON public.voucher_templates FOR SELECT TO anon
  USING (is_active = true);

-- 2. Bảng voucher đã phát cho khách hàng
CREATE TABLE public.customer_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  voucher_template_id uuid REFERENCES public.voucher_templates(id) ON DELETE SET NULL,
  code text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  discount_type text NOT NULL DEFAULT 'amount',
  discount_value numeric NOT NULL DEFAULT 0,
  voucher_name text NOT NULL,
  source text NOT NULL DEFAULT 'website', -- 'website', 'export', 'manual'
  status text NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'used')),
  used_at timestamptz,
  used_by uuid,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users manage customer vouchers"
  ON public.customer_vouchers FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Anon can insert vouchers via website"
  ON public.customer_vouchers FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can view own vouchers by phone"
  ON public.customer_vouchers FOR SELECT TO anon
  USING (true);

-- 3. Thêm cài đặt voucher vào tenant_landing_settings
ALTER TABLE public.tenant_landing_settings 
  ADD COLUMN IF NOT EXISTS voucher_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voucher_template_id uuid REFERENCES public.voucher_templates(id) ON DELETE SET NULL;

-- 4. Thêm cài đặt voucher vào point_settings
ALTER TABLE public.point_settings
  ADD COLUMN IF NOT EXISTS voucher_system_enabled boolean NOT NULL DEFAULT false;

-- 5. Function tạo mã voucher ngẫu nhiên
CREATE OR REPLACE FUNCTION public.generate_voucher_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := 'VC-';
  i integer;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 6. Function claim voucher từ website (anon-safe)
CREATE OR REPLACE FUNCTION public.claim_website_voucher(
  _tenant_id uuid,
  _customer_name text,
  _customer_phone text,
  _customer_email text,
  _branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _voucher_template_id uuid;
  _voucher_enabled boolean;
  _template RECORD;
  _code text;
  _voucher_id uuid;
  _customer_id uuid;
  _tag_id uuid;
BEGIN
  -- Check if voucher is enabled for this tenant's landing
  SELECT ls.voucher_enabled, ls.voucher_template_id
  INTO _voucher_enabled, _voucher_template_id
  FROM public.tenant_landing_settings ls
  WHERE ls.tenant_id = _tenant_id;

  IF NOT COALESCE(_voucher_enabled, false) OR _voucher_template_id IS NULL THEN
    RAISE EXCEPTION 'Voucher is not enabled for this store';
  END IF;

  -- Get template
  SELECT * INTO _template
  FROM public.voucher_templates
  WHERE id = _voucher_template_id AND tenant_id = _tenant_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher template not found or inactive';
  END IF;

  -- Check if customer already claimed (by phone + tenant)
  IF EXISTS (
    SELECT 1 FROM public.customer_vouchers
    WHERE tenant_id = _tenant_id
      AND customer_phone = _customer_phone
      AND source = 'website'
  ) THEN
    -- Return existing voucher
    SELECT jsonb_build_object(
      'already_claimed', true,
      'code', cv.code,
      'voucher_name', cv.voucher_name,
      'discount_type', cv.discount_type,
      'discount_value', cv.discount_value
    ) INTO _code
    FROM public.customer_vouchers cv
    WHERE cv.tenant_id = _tenant_id
      AND cv.customer_phone = _customer_phone
      AND cv.source = 'website'
    LIMIT 1;
    RETURN _code::jsonb;
  END IF;

  -- Generate unique code
  _code := public.generate_voucher_code();

  -- Upsert customer
  SELECT id INTO _customer_id
  FROM public.customers
  WHERE phone = _customer_phone AND tenant_id = _tenant_id
  LIMIT 1;

  IF _customer_id IS NULL THEN
    INSERT INTO public.customers (name, phone, email, tenant_id, source, preferred_branch_id)
    VALUES (_customer_name, _customer_phone, _customer_email, _tenant_id, 'Website', _branch_id)
    RETURNING id INTO _customer_id;

    -- Auto-tag "Khách mới từ Website"
    SELECT id INTO _tag_id
    FROM public.customer_tags
    WHERE tenant_id = _tenant_id AND name = 'Khách mới từ Website'
    LIMIT 1;

    IF _tag_id IS NULL THEN
      INSERT INTO public.customer_tags (tenant_id, name, color, description)
      VALUES (_tenant_id, 'Khách mới từ Website', '#10b981', 'Tự động gắn khi khách nhận voucher từ website')
      RETURNING id INTO _tag_id;
    END IF;

    INSERT INTO public.customer_tag_assignments (customer_id, tag_id)
    VALUES (_customer_id, _tag_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Create voucher
  INSERT INTO public.customer_vouchers (
    tenant_id, customer_id, voucher_template_id, code,
    customer_name, customer_phone, customer_email,
    discount_type, discount_value, voucher_name, source, branch_id
  ) VALUES (
    _tenant_id, _customer_id, _voucher_template_id, _code,
    _customer_name, _customer_phone, _customer_email,
    _template.discount_type, _template.discount_value, _template.name,
    'website', _branch_id
  )
  RETURNING id INTO _voucher_id;

  RETURN jsonb_build_object(
    'already_claimed', false,
    'code', _code,
    'voucher_name', _template.name,
    'discount_type', _template.discount_type,
    'discount_value', _template.discount_value,
    'voucher_id', _voucher_id
  );
END;
$$;

-- 7. Function tra cứu voucher công khai theo SĐT
CREATE OR REPLACE FUNCTION public.lookup_customer_vouchers_public(
  _phone text,
  _tenant_id uuid
)
RETURNS TABLE(
  id uuid, code text, voucher_name text,
  discount_type text, discount_value numeric,
  status text, source text, created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT cv.id, cv.code, cv.voucher_name,
    cv.discount_type, cv.discount_value,
    cv.status, cv.source, cv.created_at
  FROM public.customer_vouchers cv
  WHERE cv.customer_phone = _phone
    AND cv.tenant_id = _tenant_id
    AND cv.status = 'unused'
  ORDER BY cv.created_at DESC;
$$;

-- Triggers
CREATE TRIGGER update_voucher_templates_updated_at
  BEFORE UPDATE ON public.voucher_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_vouchers_updated_at
  BEFORE UPDATE ON public.customer_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_customer_vouchers_tenant_phone ON public.customer_vouchers (tenant_id, customer_phone);
CREATE INDEX idx_customer_vouchers_tenant_status ON public.customer_vouchers (tenant_id, status);
CREATE INDEX idx_voucher_templates_tenant ON public.voucher_templates (tenant_id);
