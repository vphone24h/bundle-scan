import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CustomerRatingSummary {
  count: number;
  average: number;
}

/**
 * Aggregates staff_reviews by customer_phone within current tenant.
 * Returns a Map<phone, { count, average }>.
 * Reuses existing staff_reviews data — KH đã đánh giá NV nào, sao nào.
 */
export function useCustomerRatingsByPhone() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['customer-ratings-by-phone', user?.id],
    queryFn: async () => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) return new Map<string, CustomerRatingSummary>();

      const { data, error } = await supabase
        .from('staff_reviews' as any)
        .select('customer_phone, rating')
        .eq('tenant_id', tenantId)
        .not('customer_phone', 'is', null);

      if (error) throw error;

      const map = new Map<string, { sum: number; count: number }>();
      for (const row of (data || []) as any[]) {
        const phone = (row.customer_phone || '').trim();
        if (!phone) continue;
        const cur = map.get(phone) || { sum: 0, count: 0 };
        cur.sum += Number(row.rating) || 0;
        cur.count += 1;
        map.set(phone, cur);
      }

      const result = new Map<string, CustomerRatingSummary>();
      map.forEach((v, k) => {
        result.set(k, { count: v.count, average: v.count > 0 ? v.sum / v.count : 0 });
      });
      return result;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
}
