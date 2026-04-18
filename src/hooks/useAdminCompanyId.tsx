import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { usePlatformUser } from './useTenant';

/**
 * Returns the company_id for the current admin user.
 * - platform_admin → null (root data, company_id IS NULL)
 * - company_admin → their company_id
 *
 * Fallbacks are required because some legacy company_admin rows only have tenant_id
 * or are linked through user_roles instead of platform_users.company_id.
 */
export function useAdminCompanyId(): { companyId: string | null; isPlatformAdmin: boolean; isCompanyAdmin: boolean; isLoading: boolean } {
  const { user } = useAuth();
  const { data: platformUser, isLoading: platformUserLoading } = usePlatformUser();

  const isPlatformAdmin = platformUser?.platform_role === 'platform_admin';
  const isCompanyAdmin = platformUser?.platform_role === 'company_admin';

  const { data: derivedCompanyId, isLoading: derivedLoading } = useQuery({
    queryKey: ['derived-admin-company-id', user?.id, platformUser?.tenant_id],
    enabled: !!user?.id && isCompanyAdmin && !platformUser?.company_id,
    queryFn: async () => {
      if (!user?.id) return null;

      if (platformUser?.tenant_id) {
        const { data: tenantByPlatformUser, error: tenantError } = await supabase
          .from('tenants')
          .select('company_id')
          .eq('id', platformUser.tenant_id)
          .maybeSingle();

        if (tenantError) throw tenantError;
        if (tenantByPlatformUser?.company_id) return tenantByPlatformUser.company_id;
      }

      const { data: roleRows, error: rolesError } = await supabase
        .from('user_roles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .not('tenant_id', 'is', null);

      if (rolesError) throw rolesError;

      const tenantIds = (roleRows || [])
        .map((row) => row.tenant_id)
        .filter((tenantId): tenantId is string => Boolean(tenantId));

      if (tenantIds.length === 0) return null;

      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('company_id')
        .in('id', tenantIds)
        .not('company_id', 'is', null);

      if (tenantsError) throw tenantsError;

      return tenants?.[0]?.company_id ?? null;
    },
  });

  const companyId = isCompanyAdmin
    ? (platformUser?.company_id ?? derivedCompanyId ?? null)
    : null;

  return {
    companyId,
    isPlatformAdmin,
    isCompanyAdmin,
    isLoading: platformUserLoading || (isCompanyAdmin && !platformUser?.company_id ? derivedLoading : false),
  };
}
