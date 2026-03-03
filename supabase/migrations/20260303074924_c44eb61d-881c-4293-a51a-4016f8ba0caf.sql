ALTER TABLE public.subscription_plans 
ADD COLUMN max_purchases integer DEFAULT NULL;

COMMENT ON COLUMN public.subscription_plans.max_purchases IS 'Số lần mua tối đa cho gói này. NULL = không giới hạn';