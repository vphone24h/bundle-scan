
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
  words text[];
  word text;
  condition text := '';
BEGIN
  -- Split search into individual words
  words := string_to_array(trim(p_search), ' ');
  -- Remove empty strings
  words := array_remove(words, '');
  
  IF array_length(words, 1) IS NULL OR array_length(words, 1) = 0 THEN
    RETURN;
  END IF;

  -- If single word, use simple ILIKE (fast path)
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
      )
    ORDER BY
      CASE WHEN p.name ILIKE words[1] || '%' THEN 0
           WHEN p.sku ILIKE words[1] || '%' THEN 1
           ELSE 2
      END,
      p.name
    LIMIT p_limit;
    RETURN;
  END IF;

  -- Multiple words: each word must match name (AND logic)
  -- This allows partial/wrong words to be skipped naturally
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
      -- Strategy: count how many words match, rank by match count
      -- At least half the words must match (fuzzy tolerance)
      (SELECT count(*) FROM unnest(words) w WHERE p.name ILIKE '%' || w || '%')
      >= GREATEST(1, array_length(words, 1) - 1)
    )
  ORDER BY
    -- Products matching more words rank higher
    (SELECT count(*) FROM unnest(words) w WHERE p.name ILIKE '%' || w || '%') DESC,
    CASE WHEN p.name ILIKE '%' || words[1] || '%' THEN 0 ELSE 1 END,
    p.name
  LIMIT p_limit;
END;
$$;
