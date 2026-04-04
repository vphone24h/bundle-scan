CREATE OR REPLACE FUNCTION public.search_products_for_sale(p_search text, p_limit int DEFAULT 15)
RETURNS TABLE(
  id uuid, name text, sku text, imei text,
  import_price numeric, sale_price numeric, status text,
  category_id uuid, branch_id uuid, unit text, quantity int,
  category_name text, branch_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  normalized text;
  words text[];
BEGIN
  -- Normalize: replace common separators with space, collapse whitespace
  normalized := trim(regexp_replace(
    regexp_replace(p_search, '[-_/.,|:+]+', ' ', 'g'),
    '\s+', ' ', 'g'
  ));

  IF normalized = '' THEN RETURN; END IF;

  -- Also try original input as-is for exact substring match
  -- Split normalized into words
  words := array_remove(string_to_array(normalized, ' '), '');

  IF array_length(words, 1) IS NULL OR array_length(words, 1) = 0 THEN
    RETURN;
  END IF;

  -- Single word: fast path with ILIKE on name, sku, imei
  IF array_length(words, 1) = 1 THEN
    RETURN QUERY
    SELECT
      p.id, p.name, p.sku, p.imei,
      p.import_price, p.sale_price, p.status::text,
      p.category_id, p.branch_id, p.unit, p.quantity,
      c.name AS category_name, b.name AS branch_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN branches b ON b.id = p.branch_id
    WHERE p.status = 'in_stock'
      AND p.tenant_id = (SELECT get_user_tenant_id_secure())
      AND (
        p.name ILIKE '%' || words[1] || '%'
        OR p.sku ILIKE '%' || words[1] || '%'
        OR p.imei ILIKE '%' || words[1] || '%'
        -- Also try original un-normalized input as exact substring
        OR p.name ILIKE '%' || trim(p_search) || '%'
        OR p.sku ILIKE '%' || trim(p_search) || '%'
        OR p.imei ILIKE '%' || trim(p_search) || '%'
      )
    ORDER BY
      CASE WHEN p.name ILIKE words[1] || '%' THEN 0
           WHEN p.sku ILIKE words[1] || '%' THEN 1
           WHEN p.name ILIKE '%' || trim(p_search) || '%' THEN 2
           ELSE 3
      END,
      p.name
    LIMIT p_limit;
    RETURN;
  END IF;

  -- Multiple words: fuzzy match across name + sku + imei
  -- A word matches if it appears in name OR sku OR imei
  RETURN QUERY
  SELECT
    p.id, p.name, p.sku, p.imei,
    p.import_price, p.sale_price, p.status::text,
    p.category_id, p.branch_id, p.unit, p.quantity,
    c.name AS category_name, b.name AS branch_name
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN branches b ON b.id = p.branch_id
  WHERE p.status = 'in_stock'
    AND p.tenant_id = (SELECT get_user_tenant_id_secure())
    AND (
      -- Count words matching across all searchable fields
      (SELECT count(*) FROM unnest(words) w
       WHERE p.name ILIKE '%' || w || '%'
          OR p.sku ILIKE '%' || w || '%'
          OR p.imei ILIKE '%' || w || '%'
      ) >= GREATEST(1, array_length(words, 1) - 1)
      -- Also match original input as-is
      OR p.name ILIKE '%' || trim(p_search) || '%'
      OR p.sku ILIKE '%' || trim(p_search) || '%'
    )
  ORDER BY
    (SELECT count(*) FROM unnest(words) w
     WHERE p.name ILIKE '%' || w || '%'
        OR p.sku ILIKE '%' || w || '%'
        OR p.imei ILIKE '%' || w || '%'
    ) DESC,
    CASE WHEN p.name ILIKE '%' || words[1] || '%' THEN 0 ELSE 1 END,
    p.name
  LIMIT p_limit;
END;
$$;