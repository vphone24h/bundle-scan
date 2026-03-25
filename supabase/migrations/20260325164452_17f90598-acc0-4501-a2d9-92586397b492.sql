-- Deduplicate categories: keep oldest per (name, parent_id, tenant_id), reassign references

-- Update products
WITH to_merge AS (
  SELECT id AS old_id, FIRST_VALUE(id) OVER (PARTITION BY name, parent_id, tenant_id ORDER BY created_at) AS keep_id
  FROM categories
)
UPDATE products SET category_id = tm.keep_id
FROM to_merge tm WHERE products.category_id = tm.old_id AND tm.old_id != tm.keep_id;

-- Update export_receipt_items
WITH to_merge AS (
  SELECT id AS old_id, FIRST_VALUE(id) OVER (PARTITION BY name, parent_id, tenant_id ORDER BY created_at) AS keep_id
  FROM categories
)
UPDATE export_receipt_items SET category_id = tm.keep_id
FROM to_merge tm WHERE export_receipt_items.category_id = tm.old_id AND tm.old_id != tm.keep_id;

-- Update product_groups
WITH to_merge AS (
  SELECT id AS old_id, FIRST_VALUE(id) OVER (PARTITION BY name, parent_id, tenant_id ORDER BY created_at) AS keep_id
  FROM categories
)
UPDATE product_groups SET category_id = tm.keep_id
FROM to_merge tm WHERE product_groups.category_id = tm.old_id AND tm.old_id != tm.keep_id;

-- Update landing_products
WITH to_merge AS (
  SELECT id AS old_id, FIRST_VALUE(id) OVER (PARTITION BY name, parent_id, tenant_id ORDER BY created_at) AS keep_id
  FROM categories
)
UPDATE landing_products SET category_id = tm.keep_id
FROM to_merge tm WHERE landing_products.category_id = tm.old_id AND tm.old_id != tm.keep_id;

-- Update landing_articles
WITH to_merge AS (
  SELECT id AS old_id, FIRST_VALUE(id) OVER (PARTITION BY name, parent_id, tenant_id ORDER BY created_at) AS keep_id
  FROM categories
)
UPDATE landing_articles SET category_id = tm.keep_id
FROM to_merge tm WHERE landing_articles.category_id = tm.old_id AND tm.old_id != tm.keep_id;

-- Update platform_articles
WITH to_merge AS (
  SELECT id AS old_id, FIRST_VALUE(id) OVER (PARTITION BY name, parent_id, tenant_id ORDER BY created_at) AS keep_id
  FROM categories
)
UPDATE platform_articles SET category_id = tm.keep_id
FROM to_merge tm WHERE platform_articles.category_id = tm.old_id AND tm.old_id != tm.keep_id;

-- Update parent_id within categories
WITH to_merge AS (
  SELECT id AS old_id, FIRST_VALUE(id) OVER (PARTITION BY name, parent_id, tenant_id ORDER BY created_at) AS keep_id
  FROM categories
)
UPDATE categories SET parent_id = tm.keep_id
FROM to_merge tm WHERE categories.parent_id = tm.old_id AND tm.old_id != tm.keep_id;

-- Delete duplicates (keep oldest)
DELETE FROM categories
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY name, parent_id, tenant_id ORDER BY created_at) AS rn
    FROM categories
  ) ranked WHERE rn > 1
);

-- Prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_unique_name_parent_tenant 
ON categories (tenant_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'), name)