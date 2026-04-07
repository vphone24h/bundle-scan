import { usePlatformUser } from './useTenant';

/**
 * Returns the company_id for the current admin user.
 * - platform_admin → null (root data, company_id IS NULL)
 * - company_admin → their company_id
 * 
 * Used to scope all config table queries.
 */
export function useAdminCompanyId(): { companyId: string | null; isPlatformAdmin: boolean; isCompanyAdmin: boolean; isLoading: boolean } {
  const { data: platformUser, isLoading } = usePlatformUser();
  
  const isPlatformAdmin = platformUser?.platform_role === 'platform_admin';
  const isCompanyAdmin = platformUser?.platform_role === 'company_admin';
  const companyId = isCompanyAdmin ? (platformUser?.company_id ?? null) : null;
  
  return { companyId, isPlatformAdmin, isCompanyAdmin, isLoading };
}
