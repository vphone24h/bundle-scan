-- Cho phép user xem được tier mặc định (tenant_id is null) + tier của tenant hiện tại
DROP POLICY IF EXISTS "Users can view own tenant membership_tier_settings" ON public.membership_tier_settings;

CREATE POLICY "Users can view tenant + default membership_tier_settings"
ON public.membership_tier_settings
FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR tenant_id = get_user_tenant_id_secure()
  OR tenant_id IS NULL
);
