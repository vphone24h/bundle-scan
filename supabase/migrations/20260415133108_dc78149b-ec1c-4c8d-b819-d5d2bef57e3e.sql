
ALTER TABLE public.daily_backups ADD COLUMN IF NOT EXISTS backup_type TEXT NOT NULL DEFAULT 'daily';
