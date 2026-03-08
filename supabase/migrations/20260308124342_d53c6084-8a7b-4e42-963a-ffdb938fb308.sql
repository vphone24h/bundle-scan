
CREATE OR REPLACE FUNCTION public.get_customers_paginated(
  _search text DEFAULT NULL,
  _branch_id uuid DEFAULT NULL,
  _tier text DEFAULT NULL,
  _crm_status text DEFAULT NULL,
  _staff_id uuid DEFAULT NULL,
  _tag_id uuid DEFAULT NULL,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid;
  _offset integer;
  _result jsonb;
BEGIN
  _tenant_id := public.get_user_tenant_id_secure();
  IF _tenant_id IS NULL THEN
    RETURN jsonb_build_object('items', '[]'::jsonb, 'hasMore', false);
  END IF;

  _offset := (_page - 1) * _page_size;

  IF _tag_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'items', COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb),
      'hasMore', COUNT(*) > _page_size
    ) INTO _result
    FROM (
      SELECT c.id, c.name, c.phone, c.email, c.address, c.note, c.source,
             c.total_spent, c.current_points, c.pending_points,
             c.total_points_earned, c.total_points_used,
             c.membership_tier, c.status, c.birthday,
             c.last_purchase_date, c.preferred_branch_id,
             c.created_at, c.updated_at,
             c.crm_status, c.assigned_staff_id, c.last_care_date
      FROM customers c
      INNER JOIN customer_tag_assignments cta ON cta.customer_id = c.id AND cta.tag_id = _tag_id
      WHERE c.tenant_id = _tenant_id
        AND (_branch_id IS NULL OR c.preferred_branch_id = _branch_id)
        AND (_tier IS NULL OR c.membership_tier::text = _tier)
        AND (_crm_status IS NULL OR c.crm_status::text = _crm_status)
        AND (_staff_id IS NULL OR c.assigned_staff_id = _staff_id)
        AND (
          _search IS NULL
          OR (
            CASE WHEN _search ~ '^\d+$' THEN c.phone LIKE _search || '%'
            ELSE c.name ILIKE '%' || _search || '%' OR c.phone ILIKE '%' || _search || '%'
            END
          )
        )
      ORDER BY c.created_at DESC
      LIMIT _page_size + 1
      OFFSET _offset
    ) sub;
  ELSE
    SELECT jsonb_build_object(
      'items', COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb),
      'hasMore', COUNT(*) > _page_size
    ) INTO _result
    FROM (
      SELECT c.id, c.name, c.phone, c.email, c.address, c.note, c.source,
             c.total_spent, c.current_points, c.pending_points,
             c.total_points_earned, c.total_points_used,
             c.membership_tier, c.status, c.birthday,
             c.last_purchase_date, c.preferred_branch_id,
             c.created_at, c.updated_at,
             c.crm_status, c.assigned_staff_id, c.last_care_date
      FROM customers c
      WHERE c.tenant_id = _tenant_id
        AND (_branch_id IS NULL OR c.preferred_branch_id = _branch_id)
        AND (_tier IS NULL OR c.membership_tier::text = _tier)
        AND (_crm_status IS NULL OR c.crm_status::text = _crm_status)
        AND (_staff_id IS NULL OR c.assigned_staff_id = _staff_id)
        AND (
          _search IS NULL
          OR (
            CASE WHEN _search ~ '^\d+$' THEN c.phone LIKE _search || '%'
            ELSE c.name ILIKE '%' || _search || '%' OR c.phone ILIKE '%' || _search || '%'
            END
          )
        )
      ORDER BY c.created_at DESC
      LIMIT _page_size + 1
      OFFSET _offset
    ) sub;
  END IF;

  RETURN _result;
END;
$function$;

-- Add composite index for the most common query pattern
CREATE INDEX IF NOT EXISTS idx_customers_tenant_created_desc 
ON customers (tenant_id, created_at DESC);

-- Add index for branch + tenant filter
CREATE INDEX IF NOT EXISTS idx_customers_tenant_branch_created 
ON customers (tenant_id, preferred_branch_id, created_at DESC);
