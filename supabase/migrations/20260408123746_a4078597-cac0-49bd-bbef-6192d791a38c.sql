-- Add 'cancelled' to repair_status enum
ALTER TYPE public.repair_status ADD VALUE IF NOT EXISTS 'cancelled';