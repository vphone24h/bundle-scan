
-- Table to track onboarding tour completion per user
CREATE TABLE public.onboarding_tours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tour_key TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tenant_id UUID,
  UNIQUE(user_id, tour_key)
);

ALTER TABLE public.onboarding_tours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tours" ON public.onboarding_tours
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tours" ON public.onboarding_tours
  FOR INSERT WITH CHECK (auth.uid() = user_id);
