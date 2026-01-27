-- Sửa trigger để filter theo tenant_id của customer
CREATE OR REPLACE FUNCTION public.update_customer_membership_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tier membership_tier;
BEGIN
  -- Chỉ lấy tier settings của tenant tương ứng (hoặc null nếu tenant không có cài đặt riêng)
  SELECT tier INTO new_tier
  FROM membership_tier_settings
  WHERE min_spent <= NEW.total_spent
    AND (tenant_id = NEW.tenant_id OR (tenant_id IS NULL AND NOT EXISTS (
      SELECT 1 FROM membership_tier_settings WHERE tenant_id = NEW.tenant_id
    )))
  ORDER BY min_spent DESC
  LIMIT 1;
  
  IF new_tier IS NOT NULL AND new_tier != NEW.membership_tier THEN
    NEW.membership_tier := new_tier;
  END IF;
  
  RETURN NEW;
END;
$$;