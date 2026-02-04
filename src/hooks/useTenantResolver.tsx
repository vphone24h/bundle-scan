import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  detectTenantFromHostname, 
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
let resolutionPromise: Promise<ResolvedTenant> | null = null;

/**
 * Resolve tenant - shared function that caches and deduplicates requests
 */
async function resolveTenantOnce(hostname: string): Promise<ResolvedTenant> {
  // Return cached result immediately
  if (cachedResult && cacheHostname === hostname) {
    return cachedResult;
  }
  
  // If already resolving, wait for that promise
  if (resolutionPromise) {
    return resolutionPromise;
  }
  
  // Start resolution
  resolutionPromise = (async () => {
    const hostInfo = detectTenantFromHostname();
    
    // Main domain - no tenant resolution needed (FAST PATH - no API call)
    if (hostInfo.isMainDomain) {
      const result: ResolvedTenant = {
        tenantId: null,
        subdomain: hostInfo.subdomain, // Could be null or from ?store= param
        tenantName: null,
        status: 'main_domain',
        isMainDomain: true,
      };
      cachedResult = result;
      cacheHostname = hostname;
      return result;
    }
    
    // Has subdomain - resolve tenant
    if (hostInfo.subdomain) {
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, name, subdomain, status')
          .eq('subdomain', hostInfo.subdomain)
          .maybeSingle();
        
        if (error || !data || data.status === 'locked') {
          const result: ResolvedTenant = {
            tenantId: null,
            subdomain: hostInfo.subdomain,
            tenantName: data?.name || null,
            status: 'not_found',
            isMainDomain: false,
          };
          cachedResult = result;
          cacheHostname = hostname;
          return result;
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
        return result;
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
        return result;
      }
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
        return result;
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
      return result;
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
      return result;
    }
  })();
  
  const result = await resolutionPromise;
  resolutionPromise = null;
  return result;
}

/**
 * Hook to resolve tenant from current hostname/subdomain
 * Results are cached per hostname to avoid redundant API calls
 */
export function useTenantResolver() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  
  // OPTIMIZATION: Compute sync result immediately without useState setter
  const syncResult = useMemo((): ResolvedTenant | null => {
    // Return cached result immediately
    if (cachedResult && cacheHostname === hostname) {
      return cachedResult;
    }
    
    // FAST PATH: Check domain synchronously without any API call
    const hostInfo = detectTenantFromHostname();
    if (hostInfo.isMainDomain) {
      const result: ResolvedTenant = {
        tenantId: null,
        subdomain: hostInfo.subdomain,
        tenantName: null,
        status: 'main_domain',
        isMainDomain: true,
      };
      // Cache immediately
      cachedResult = result;
      cacheHostname = hostname;
      return result;
    }
    
    return null;
  }, [hostname]);

  const [tenant, setTenant] = useState<ResolvedTenant>(() => {
    // Use sync result if available (no loading state needed!)
    if (syncResult) {
      return syncResult;
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
    // If sync result already resolved, skip async
    if (syncResult && tenant.status !== 'loading') {
      return;
    }
    
    // Sync result available but state not updated yet
    if (syncResult) {
      setTenant(syncResult);
      return;
    }

    let cancelled = false;
    
    resolveTenantOnce(hostname).then((result) => {
      if (!cancelled) {
        setTenant(result);
      }
    });
    
    return () => {
      cancelled = true;
    };
  }, [hostname, syncResult]);
  
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
