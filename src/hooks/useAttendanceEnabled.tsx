import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompanyResolver';

/**
 * Check if attendance system is enabled for the current company.
 * Uses the global CompanyContext (resolved from hostname) — works for ALL accounts
 * under the same domain, regardless of tenant/user role.
 */
export function useAttendanceEnabled() {
  const { companyId, status } = useCompany();

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-enabled', companyId],
    queryFn: async () => {
      if (!companyId) return false;
      const { data, error } = await supabase
        .from('companies')
        .select('attendance_enabled')
        .eq('id', companyId)
        .maybeSingle();
      if (error) return false;
      return data?.attendance_enabled ?? false;
    },
    enabled: !!companyId && status === 'resolved',
    staleTime: 60_000,
  });

  // While company is still loading, treat as loading (don't flash menu items)
  const resolving = status === 'loading' || isLoading;

  return { enabled: !!data, isLoading: resolving };
}
