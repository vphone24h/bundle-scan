DROP FUNCTION IF EXISTS public.get_export_receipt_items_paginated(integer,integer,text,uuid,uuid);

CREATE FUNCTION public.get_export_receipt_items_paginated(
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 15,
  _search text DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _branch_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  receipt_id uuid,
  product_id uuid,
  product_name text,
  sku text,
  imei text,
  category_id uuid,
  sale_price numeric,
  status text,
  note text,
  warranty text,
  created_at timestamptz,
  category_name text,
  receipt_code text,
  export_date timestamptz,
  receipt_branch_id uuid,
  receipt_customer_id uuid,
  receipt_created_by uuid,
  receipt_status text,
  receipt_sales_staff_id uuid,
  customer_name text,
  customer_phone text,
  branch_name text,
  has_more boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _offset integer;
  _fetch_size integer;
BEGIN
  _tenant_id := public.get_user_tenant_id_secure();
  IF _tenant_id IS NULL THEN
    RETURN;
  END IF;

  _offset := (_page - 1) * _page_size;
  _fetch_size := _page_size + 1;

  RETURN QUERY
  WITH filtered_items AS (
    SELECT eri.*,
           er.export_date AS item_export_date
    FROM export_receipt_items eri
    INNER JOIN export_receipts er ON er.id = eri.receipt_id
    WHERE er.tenant_id = _tenant_id
      AND (_branch_id IS NULL OR er.branch_id = _branch_id)
      AND (_category_id IS NULL OR eri.category_id = _category_id)
      AND (_search IS NULL OR (
        eri.product_name ILIKE '%' || _search || '%'
        OR eri.sku ILIKE '%' || _search || '%'
        OR eri.imei ILIKE '%' || _search || '%'
      ))
    ORDER BY er.export_date DESC, eri.created_at DESC
    OFFSET _offset
    LIMIT _fetch_size
  )
  SELECT
    fi.id,
    fi.receipt_id,
    fi.product_id,
    fi.product_name,
    fi.sku,
    fi.imei,
    fi.category_id,
    fi.sale_price,
    fi.status,
    fi.note,
    fi.warranty,
    fi.created_at,
    cat.name AS category_name,
    er2.code AS receipt_code,
    er2.export_date,
    er2.branch_id AS receipt_branch_id,
    er2.customer_id AS receipt_customer_id,
    er2.created_by AS receipt_created_by,
    er2.status AS receipt_status,
    er2.sales_staff_id AS receipt_sales_staff_id,
    c.name AS customer_name,
    c.phone AS customer_phone,
    b.name AS branch_name,
    (SELECT COUNT(*) FROM filtered_items) > _page_size AS has_more
  FROM filtered_items fi
  INNER JOIN export_receipts er2 ON er2.id = fi.receipt_id
  LEFT JOIN categories cat ON cat.id = fi.category_id
  LEFT JOIN customers c ON c.id = er2.customer_id
  LEFT JOIN branches b ON b.id = er2.branch_id
  ORDER BY fi.item_export_date DESC, fi.created_at DESC
  LIMIT _page_size;
END;
$$;