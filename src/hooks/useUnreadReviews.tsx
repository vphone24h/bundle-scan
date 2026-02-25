import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCurrentTenant } from './useTenant';
import { usePermissions } from './usePermissions';

export function useUnreadReviewCount() {
  const { user } = useAuth();
  const { data: tenant } = useCurrentTenant();
  const { data: permissions } = usePermissions();

  return useQuery({
    queryKey: ['unread-review-count', user?.id, tenant?.id],
    queryFn: async () => {
      if (!user?.id || !tenant?.id) return 0;

      const lastViewed = localStorage.getItem(`reviews_last_viewed_${user.id}`);

      let query = supabase
        .from('staff_reviews' as any)
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);

      // Staff only sees their own reviews
      if (permissions?.role === 'staff') {
        query = query.eq('staff_user_id', user.id);
      } else if (permissions?.role === 'branch_admin' && permissions?.branchId) {
        query = query.eq('branch_id', permissions.branchId);
      }

      if (lastViewed) {
        query = query.gt('created_at', lastViewed);
      }

      const { count } = await query;
      return count || 0;
    },
    enabled: !!user?.id && !!tenant?.id && !!permissions,
    refetchInterval: 60000, // Check every minute
  });
}
