-- Add note column to branches table
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS note text;