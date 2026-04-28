-- Add variant_groups (JSONB array) to support up to 5 variant levels for landing products
ALTER TABLE public.landing_products
  ADD COLUMN IF NOT EXISTS variant_groups jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: convert existing 2-level variant data into the new variant_groups structure
UPDATE public.landing_products
SET variant_groups = (
  SELECT jsonb_agg(g)
  FROM (
    SELECT jsonb_build_object(
      'name', COALESCE(variant_group_1_name, 'Biến thể 1'),
      'options', COALESCE(variant_options_1, '[]'::jsonb)
    ) AS g
    WHERE jsonb_typeof(variant_options_1) = 'array'
      AND jsonb_array_length(variant_options_1) > 0
    UNION ALL
    SELECT jsonb_build_object(
      'name', COALESCE(variant_group_2_name, 'Biến thể 2'),
      'options', COALESCE(variant_options_2, '[]'::jsonb)
    )
    WHERE jsonb_typeof(variant_options_2) = 'array'
      AND jsonb_array_length(variant_options_2) > 0
  ) sub
)
WHERE (variant_groups IS NULL OR variant_groups = '[]'::jsonb)
  AND (
    (jsonb_typeof(variant_options_1) = 'array' AND jsonb_array_length(variant_options_1) > 0)
    OR (jsonb_typeof(variant_options_2) = 'array' AND jsonb_array_length(variant_options_2) > 0)
  );

-- Ensure non-null
UPDATE public.landing_products SET variant_groups = '[]'::jsonb WHERE variant_groups IS NULL;