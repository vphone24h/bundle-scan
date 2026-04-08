
ALTER TABLE public.repair_status_history
  ADD COLUMN technician_id TEXT,
  ADD COLUMN technician_name TEXT;
