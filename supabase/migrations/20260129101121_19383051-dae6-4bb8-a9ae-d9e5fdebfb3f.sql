-- Add 'deleted' status to product_status enum
ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'deleted';