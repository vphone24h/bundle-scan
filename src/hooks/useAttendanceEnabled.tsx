import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant, usePlatformUser } from './useTenant';

/**
 * Check if attendance system is enabled for the current tenant's company.
 * Returns { enabled, isLoading }
 */
export function useAttendanceEnabled() {
  const { data: tenant } = useCurrentTenant();
  const { data: platformUser } = usePlatformUser();
  const companyId = ((tenant as any)?.company_id as string | null | undefined) ?? platformUser?.company_id ?? null;

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
    enabled: !!companyId,
    staleTime: 60_000,
  });

  return { enabled: !!data, isLoading };
}