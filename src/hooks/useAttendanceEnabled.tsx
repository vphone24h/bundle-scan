import { useEffect, useState } from 'react';
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
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const isPreviewHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.includes('lovable.app') ||
    hostname.includes('lovable.dev') ||
    hostname.includes('lovableproject.com');

  const accountCompanyId = currentTenant?.company_id ?? platformUser?.company_id ?? null;
  const hostnameCompanyResolved = status === 'resolved' && !!hostnameCompanyId;
  const preferHostnameCompany = hostnameCompanyResolved && !isPreviewHost;
  const companyId = preferHostnameCompany ? hostnameCompanyId : (accountCompanyId ?? hostnameCompanyId);
  const source = preferHostnameCompany ? 'hostname' : accountCompanyId ? 'account' : 'hostname-fallback';
  const accountContextLoading = platformUserLoading || currentTenantLoading;
  const canQuery = !!companyId && (preferHostnameCompany || (!accountContextLoading && (!!accountCompanyId || status === 'resolved')));
  const queryIdentity = `${companyId ?? 'none'}:${source}`;
  const [validatedIdentity, setValidatedIdentity] = useState<string | null>(null);

  useEffect(() => {
    setValidatedIdentity(null);
  }, [queryIdentity]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['attendance-enabled', companyId, source],
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
    enabled: canQuery,
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!canQuery) {
      setValidatedIdentity(queryIdentity);
      return;
    }

    if (!isFetching && data !== undefined) {
      setValidatedIdentity(queryIdentity);
    }
  }, [canQuery, data, isFetching, queryIdentity]);

  // Real domains must follow the current company/domain, not the last logged account.
  // Also wait for one fresh validation to avoid showing stale persisted cache.
  const awaitingFreshValidation = canQuery && validatedIdentity !== queryIdentity;
  const resolving = accountContextLoading || (!companyId && status === 'loading') || isLoading || awaitingFreshValidation;

  return { enabled: !!data, isLoading: resolving };
}
