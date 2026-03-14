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

const TENANT_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function getPersistedTenantKey(hostname: string) {
  return `tenant_resolver_cache_v1:${hostname}`;
}

function isNetworkLikeError(error: any): boolean {
  if (!error) return false;

  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toUpperCase();

  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('timeout') ||
    message.includes('err_') ||
    message.includes('connection') ||
    message.includes('network request failed') ||
    message.includes('load failed') ||
    message.includes('offline') ||
    code === 'PGRST301' ||
    code.startsWith('08')
  );
}

function readPersistedTenant(hostname: string): ResolvedTenant | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(getPersistedTenantKey(hostname));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      tenantId?: string;
      subdomain?: string | null;
      tenantName?: string | null;
      savedAt?: number;
    };

    if (!parsed?.tenantId || typeof parsed.savedAt !== 'number') {
      return null;
    }

    if (Date.now() - parsed.savedAt > TENANT_CACHE_TTL_MS) {
      window.localStorage.removeItem(getPersistedTenantKey(hostname));
      return null;
    }

    return {
      tenantId: parsed.tenantId,
      subdomain: parsed.subdomain ?? null,
      tenantName: parsed.tenantName ?? null,
      status: 'resolved',
      isMainDomain: false,
    };
  } catch {
    return null;
  }
}

function persistResolvedTenant(hostname: string, result: ResolvedTenant) {
  if (typeof window === 'undefined') return;
  if (result.status !== 'resolved' || !result.tenantId) return;

  try {
    window.localStorage.setItem(
      getPersistedTenantKey(hostname),
      JSON.stringify({
        tenantId: result.tenantId,
        subdomain: result.subdomain,
        tenantName: result.tenantName,
        savedAt: Date.now(),
      })
    );
  } catch {
    // Ignore storage errors
  }
}

/**
 * Resolve tenant - shared function that caches and deduplicates requests
 */
async function resolveTenantOnce(hostname: string): Promise<ResolvedTenant> {
  // Return cached result immediately (except stale not_found)
  if (cachedResult && cacheHostname === hostname && cachedResult.status !== 'not_found') {
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
        subdomain: hostInfo.subdomain,
        tenantName: null,
        status: 'main_domain',
        isMainDomain: true,
      };
      cachedResult = result;
      cacheHostname = hostname;
      return result;
    }

    // FAST PATH: Check if inline script already resolved the tenant
    const prefetch = (window as any).__STORE_PREFETCH__;
    if (prefetch) {
      const tenantId = prefetch.tenantId;
      const tenant = prefetch.tenant;
      if (tenantId) {
        const result: ResolvedTenant = {
          tenantId,
          subdomain: tenant?.subdomain || prefetch.storeId || null,
          tenantName: tenant?.name || null,
          status: 'resolved',
          isMainDomain: false,
        };
        cachedResult = result;
        cacheHostname = hostname;
        persistResolvedTenant(hostname, result);
        return result;
      }
    }

    // Has subdomain - resolve tenant
    if (hostInfo.subdomain) {
      try {
        const { data, error } = await supabase
          .rpc('lookup_tenant_by_subdomain', { _subdomain: hostInfo.subdomain });

        const tenant = Array.isArray(data) ? data[0] : data;

        if (error || !tenant) {
          const isNetworkError = isNetworkLikeError(error);
          if (isNetworkError) {
            const fallback = readPersistedTenant(hostname);
            if (fallback) {
              cachedResult = fallback;
              cacheHostname = hostname;
              return fallback;
            }
          }

          const result: ResolvedTenant = {
            tenantId: null,
            subdomain: hostInfo.subdomain,
            tenantName: tenant?.name || null,
            status: 'not_found',
            isMainDomain: false,
          };

          return result;
        }

        const result: ResolvedTenant = {
          tenantId: tenant.id,
          subdomain: tenant.subdomain,
          tenantName: tenant.name,
          status: 'resolved',
          isMainDomain: false,
        };
        cachedResult = result;
        cacheHostname = hostname;
        persistResolvedTenant(hostname, result);
        return result;
      } catch (err) {
        console.error('Error resolving tenant:', err);

        const fallback = readPersistedTenant(hostname);
        if (fallback) {
          cachedResult = fallback;
          cacheHostname = hostname;
          return fallback;
        }

        // Don't cache network errors - allow retry
        return {
          tenantId: null,
          subdomain: hostInfo.subdomain,
          tenantName: null,
          status: 'not_found',
          isMainDomain: false,
        };
      }
    }

    // Custom domain case - resolve via custom_domains table
    try {
      const { data: tenantId, error } = await supabase
        .rpc('resolve_tenant_by_domain', { _domain: hostInfo.hostname });

      if (error || !tenantId) {
        const isNetworkError = isNetworkLikeError(error);
        if (isNetworkError) {
          const fallback = readPersistedTenant(hostname);
          if (fallback) {
            cachedResult = fallback;
            cacheHostname = hostname;
            return fallback;
          }
        }

        const result: ResolvedTenant = {
          tenantId: null,
          subdomain: null,
          tenantName: null,
          status: 'not_found',
          isMainDomain: false,
        };

        return result;
      }

      const result: ResolvedTenant = {
        tenantId,
        subdomain: null,
        tenantName: null,
        status: 'resolved',
        isMainDomain: false,
      };
      cachedResult = result;
      cacheHostname = hostname;
      persistResolvedTenant(hostname, result);
      return result;
    } catch (err) {
      console.error('Error resolving custom domain:', err);

      const fallback = readPersistedTenant(hostname);
      if (fallback) {
        cachedResult = fallback;
        cacheHostname = hostname;
        return fallback;
      }

      // Don't cache network errors
      return {
        tenantId: null,
        subdomain: null,
        tenantName: null,
        status: 'not_found',
        isMainDomain: false,
      };
    }
  })();

  try {
    return await resolutionPromise;
  } finally {
    resolutionPromise = null;
  }
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
    
    // Main domain or no subdomain detected = instant resolve
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

    // FAST PATH: Inline script may have already resolved the tenant
    const prefetch = (window as any).__STORE_PREFETCH__;
    if (prefetch?.tenantId) {
      const result: ResolvedTenant = {
        tenantId: prefetch.tenantId,
        subdomain: prefetch.tenant?.subdomain || prefetch.storeId || null,
        tenantName: prefetch.tenant?.name || null,
        status: 'resolved',
        isMainDomain: false,
      };
      cachedResult = result;
      cacheHostname = hostname;
      persistResolvedTenant(hostname, result);
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
    let retryCount = 0;
    const maxRetries = 3;

    const attempt = () => {
      resolveTenantOnce(hostname).then((result) => {
        if (cancelled) return;

        // If not_found and not cached (network error), retry
        if (result.status === 'not_found' && !cachedResult && retryCount < maxRetries) {
          retryCount++;
          setTimeout(attempt, 1500 * retryCount);
          return;
        }

        setTenant(result);
      });
    };

    attempt();

    return () => {
      cancelled = true;
    };
  }, [hostname, syncResult]);

  useEffect(() => {
    if (tenant.status !== 'not_found' || tenant.isMainDomain) return;

    let cancelled = false;

    const retryResolve = () => {
      resolveTenantOnce(hostname).then((result) => {
        if (cancelled) return;
        if (result.status === 'resolved') {
          setTenant(result);
        }
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        retryResolve();
      }
    };

    window.addEventListener('online', retryResolve);
    window.addEventListener('focus', retryResolve);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener('online', retryResolve);
      window.removeEventListener('focus', retryResolve);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [tenant.status, tenant.isMainDomain, hostname]);
  
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
