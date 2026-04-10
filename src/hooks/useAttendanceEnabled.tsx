import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompanyResolver';
import { useCurrentTenant, usePlatformUser } from './useTenant';

/**
 * Check if attendance system is enabled for the current company.
 * Priority order:
 * 1. Company from the logged-in account/tenant
 * 2. Fallback to hostname-resolved company
 *
 * This prevents cross-domain leakage when a user account belongs to one company
 * but is opened from another domain or stale hostname cache.
 */
export function useAttendanceEnabled() {
  const { companyId: hostnameCompanyId, status } = useCompany();
  const { data: platformUser, isLoading: platformUserLoading } = usePlatformUser();
  const { data: currentTenant, isLoading: currentTenantLoading } = useCurrentTenant();

  const accountCompanyId = currentTenant?.company_id ?? platformUser?.company_id ?? null;
  const companyId = accountCompanyId ?? hostnameCompanyId;
  const accountContextLoading = platformUserLoading || currentTenantLoading;
  const canResolveFromHostname = !accountContextLoading && status === 'resolved';

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-enabled', companyId, accountCompanyId ? 'account' : 'hostname'],
    queryFn: async () => {
      if (!companyId) return false;
      const { data: enabled, error } = await supabase
        .rpc('get_company_attendance_enabled', { _company_id: companyId });
      if (error) {
        console.warn('attendance check failed:', error.message);
        return false;
      }
      return enabled ?? false;
    },
    enabled: !!companyId && (!accountContextLoading && (!!accountCompanyId || canResolveFromHostname)),
    staleTime: 60_000,
  });

  // Don't render attendance UI until account/company context is settled.
  const resolving = accountContextLoading || (!accountCompanyId && status === 'loading') || isLoading;

  return { enabled: !!data, isLoading: resolving };
}
