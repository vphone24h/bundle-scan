-- Backfill group_id cho các sản phẩm có biến thể nhưng đang thiếu group_id.
-- Tìm product_group cùng tenant_id và có name khớp với "tên gốc" (đã loại bỏ chuỗi biến thể).
WITH candidates AS (
  SELECT
    p.id AS product_id,
    p.tenant_id,
    BTRIM(
      REGEXP_REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(p.name, COALESCE(p.variant_1, ''), ''),
            COALESCE(p.variant_2, ''), ''
          ),
          COALESCE(p.variant_3, ''), ''
        ),
        '\s+', ' ', 'g'
      )
    ) AS base_name
  FROM public.products p
  WHERE p.group_id IS NULL
    AND (p.variant_1 IS NOT NULL OR p.variant_2 IS NOT NULL OR p.variant_3 IS NOT NULL)
),
matched AS (
  SELECT DISTINCT ON (c.product_id)
    c.product_id,
    pg.id AS group_id
  FROM candidates c
  JOIN public.product_groups pg
    ON pg.tenant_id = c.tenant_id
   AND LOWER(BTRIM(pg.name)) = LOWER(c.base_name)
  ORDER BY c.product_id, pg.created_at ASC
)
UPDATE public.products p
SET group_id = m.group_id
FROM matched m
WHERE p.id = m.product_id;