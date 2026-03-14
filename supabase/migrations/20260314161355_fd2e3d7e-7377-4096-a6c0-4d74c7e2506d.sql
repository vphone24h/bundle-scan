-- Fast customer search optimized for sales flow (phone-first + tenant-isolated)
CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone_digits_prefix
ON public.customers (
  tenant_id,
  (regexp_replace(phone, '\D', '', 'g')) text_pattern_ops
);

CREATE OR REPLACE FUNCTION public.search_customers_for_sale(
  _query text,
  _limit integer DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  name text,
  phone text,
  address text,
  email text,
  source text,
  current_points integer,
  pending_points integer,
  total_spent numeric,
  membership_tier public.membership_tier,
  status public.customer_status,
  birthday date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
  _raw text;
  _phone_q text;
  _safe_limit integer;
BEGIN
  _tenant_id := public.get_user_tenant_id_secure();
  IF _tenant_id IS NULL THEN
    RETURN;
  END IF;

  _raw := btrim(COALESCE(_query, ''));
  IF length(_raw) < 2 THEN
    RETURN;
  END IF;

  _safe_limit := GREATEST(1, LEAST(COALESCE(_limit, 5), 20));
  _phone_q := regexp_replace(_raw, '\D', '', 'g');

  IF _phone_q ~ '^\d{4,}$' THEN
    RETURN QUERY
    SELECT
      c.id,
      c.name,
      c.phone,
      c.address,
      c.email,
      c.source,
      c.current_points,
      c.pending_points,
      c.total_spent,
      c.membership_tier,
      c.status,
      c.birthday
    FROM public.customers c
    WHERE c.tenant_id = _tenant_id
      AND regexp_replace(c.phone, '\D', '', 'g') LIKE _phone_q || '%'
    ORDER BY
      CASE WHEN regexp_replace(c.phone, '\D', '', 'g') = _phone_q THEN 0 ELSE 1 END,
      c.updated_at DESC
    LIMIT _safe_limit;
  ELSE
    RETURN QUERY
    SELECT
      c.id,
      c.name,
      c.phone,
      c.address,
      c.email,
      c.source,
      c.current_points,
      c.pending_points,
      c.total_spent,
      c.membership_tier,
      c.status,
      c.birthday
    FROM public.customers c
    WHERE c.tenant_id = _tenant_id
      AND c.name ILIKE '%' || _raw || '%'
    ORDER BY similarity(c.name, _raw) DESC NULLS LAST, c.updated_at DESC
    LIMIT _safe_limit;
  END IF;
END;
$$;