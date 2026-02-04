-- Add 'warranty' value to the product_status enum
ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'warranty';