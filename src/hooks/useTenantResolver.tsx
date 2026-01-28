import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  detectTenantFromHostname, 
  TenantInfo,
  getStoreIdFromSubdomain 
} from '@/lib/tenantResolver';

export interface ResolvedTenant {
  tenantId: string | null;
  subdomain: string | null;
  tenantName: string | null;
  status: 'loading' | 'resolved' | 'not_found' | 'main_domain';
  isMainDomain: boolean;
}

// Cache tenant resolution to avoid repeated API calls
let cachedResult: ResolvedTenant | null = null;
let cacheHostname: string | null = null;

/**
 * Hook to resolve tenant from current hostname/subdomain
 * Results are cached per hostname to avoid redundant API calls
 */
export function useTenantResolver() {
  // Check cache first
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  
  const [tenant, setTenant] = useState<ResolvedTenant>(() => {
    // Return cached result if same hostname
    if (cachedResult && cacheHostname === hostname) {
      return cachedResult;
    }
    return {
      tenantId: null,
      subdomain: null,
      tenantName: null,
      status: 'loading',
      isMainDomain: true,
    };
  });

  useEffect(() => {
    // Skip if already cached for this hostname
    if (cachedResult && cacheHostname === hostname && tenant.status !== 'loading') {
      return;
    }

    const resolveTenant = async () => {
      const hostInfo = detectTenantFromHostname();
      
      // Main domain - no tenant resolution needed
      if (hostInfo.isMainDomain && !hostInfo.subdomain) {
        const result: ResolvedTenant = {
          tenantId: null,
          subdomain: null,
          tenantName: null,
          status: 'main_domain',
          isMainDomain: true,
        };
        cachedResult = result;
        cacheHostname = hostname;
        setTenant(result);
        return;
      }
      
      // Has subdomain - resolve tenant
      if (hostInfo.subdomain) {
        try {
          const { data, error } = await supabase
            .from('tenants')
            .select('id, name, subdomain, status')
            .eq('subdomain', hostInfo.subdomain)
            .maybeSingle();
          
          if (error) {
            console.error('Error resolving tenant:', error);
            const result: ResolvedTenant = {
              tenantId: null,
              subdomain: hostInfo.subdomain,
              tenantName: null,
              status: 'not_found',
              isMainDomain: false,
            };
            cachedResult = result;
            cacheHostname = hostname;
            setTenant(result);
            return;
          }
          
          if (!data) {
            const result: ResolvedTenant = {
              tenantId: null,
              subdomain: hostInfo.subdomain,
              tenantName: null,
              status: 'not_found',
              isMainDomain: false,
            };
            cachedResult = result;
            cacheHostname = hostname;
            setTenant(result);
            return;
          }
          
          // Check if tenant is accessible
          if (data.status === 'locked') {
            const result: ResolvedTenant = {
              tenantId: null,
              subdomain: hostInfo.subdomain,
              tenantName: data.name,
              status: 'not_found',
              isMainDomain: false,
            };
            cachedResult = result;
            cacheHostname = hostname;
            setTenant(result);
            return;
          }
          
          const result: ResolvedTenant = {
            tenantId: data.id,
            subdomain: data.subdomain,
            tenantName: data.name,
            status: 'resolved',
            isMainDomain: false,
          };
          cachedResult = result;
          cacheHostname = hostname;
          setTenant(result);
        } catch (err) {
          console.error('Error resolving tenant:', err);
          const result: ResolvedTenant = {
            tenantId: null,
            subdomain: hostInfo.subdomain,
            tenantName: null,
            status: 'not_found',
            isMainDomain: false,
          };
          cachedResult = result;
          cacheHostname = hostname;
          setTenant(result);
        }
        return;
      }
      
      // Custom domain case - resolve via custom_domains table
      try {
        const { data, error } = await supabase
          .from('custom_domains')
          .select('tenant_id, tenants(id, name, subdomain, status)')
          .eq('domain', hostInfo.hostname)
          .eq('is_verified', true)
          .maybeSingle();
        
        if (error || !data || !data.tenants) {
          const result: ResolvedTenant = {
            tenantId: null,
            subdomain: null,
            tenantName: null,
            status: 'not_found',
            isMainDomain: false,
          };
          cachedResult = result;
          cacheHostname = hostname;
          setTenant(result);
          return;
        }
        
        const tenantData = data.tenants as any;
        
        const result: ResolvedTenant = {
          tenantId: tenantData.id,
          subdomain: tenantData.subdomain,
          tenantName: tenantData.name,
          status: 'resolved',
          isMainDomain: false,
        };
        cachedResult = result;
        cacheHostname = hostname;
        setTenant(result);
      } catch (err) {
        console.error('Error resolving custom domain:', err);
        const result: ResolvedTenant = {
          tenantId: null,
          subdomain: null,
          tenantName: null,
          status: 'not_found',
          isMainDomain: false,
        };
        cachedResult = result;
        cacheHostname = hostname;
        setTenant(result);
      }
    };
    
    resolveTenant();
  }, [hostname, tenant.status]);
  
  return tenant;
}

/**
 * Get store ID from URL (subdomain or query param for dev)
 */
export function useStoreIdFromUrl(): string | null {
  const [storeId, setStoreId] = useState<string | null>(null);
  
  useEffect(() => {
    // First check subdomain
    const subdomainStoreId = getStoreIdFromSubdomain();
    if (subdomainStoreId) {
      setStoreId(subdomainStoreId);
      return;
    }
    
    // Fallback to query param (for dev mode)
    const params = new URLSearchParams(window.location.search);
    const queryStoreId = params.get('store');
    if (queryStoreId) {
      setStoreId(queryStoreId.toLowerCase());
    }
  }, []);
  
  return storeId;
}
