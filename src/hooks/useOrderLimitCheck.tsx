import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useAppConfig } from './useAppConfig';

/**
 * Hook to check if the current tenant has exceeded the free order limit.
 * 
 * Logic:
 * - Platform admin configures `free_order_limit` in payment_config (default: 1000)
 * - Count total export_receipts for the tenant
 * - If tenant has active/trial subscription → unlimited
 * - If tenant is free (no subscription or expired) and count >= limit → blocked
 */
export function useOrderLimitCheck() {
  const { data: tenant } = useCurrentTenant();
  const { data: configs } = useAppConfig();

  const freeOrderLimit = parseInt(
    configs?.find(c => c.config_key === 'free_order_limit')?.config_value || '1000',
    10
  );

  const { data: orderCount = 0, isLoading } = useQuery({
    queryKey: ['tenant-order-count', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return 0;
      const { count, error } = await supabase
        .from('export_receipts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!tenant?.id,
    staleTime: 60 * 1000, // 1 minute cache
  });

  // Check if tenant has an active paid subscription
  const hasActiveSubscription = (() => {
    if (!tenant) return false;
    // If subscription_end_date exists and is in the future → paid active
    if (tenant.subscription_end_date) {
      return new Date(tenant.subscription_end_date) > new Date();
    }
    // If subscription_plan is set but no end date (lifetime) → active
    if (tenant.subscription_plan === 'lifetime') return true;
    return false;
  })();

  const isLimitReached = !hasActiveSubscription && orderCount >= freeOrderLimit;

  return {
    orderCount,
    freeOrderLimit,
    isLimitReached,
    hasActiveSubscription,
    remaining: Math.max(0, freeOrderLimit - orderCount),
    isLoading,
  };
}
