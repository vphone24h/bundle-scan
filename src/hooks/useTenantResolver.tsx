import { useState, useEffect } from 'react';
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

/**
 * Hook to resolve tenant from current hostname/subdomain
 * 
 * Usage:
 * - On main domain (vkho.vn): returns { status: 'main_domain' }
 * - On subdomain (store.vkho.vn): resolves tenant and returns tenant info
 */
export function useTenantResolver() {
  const [tenant, setTenant] = useState<ResolvedTenant>({
    tenantId: null,
    subdomain: null,
    tenantName: null,
    status: 'loading',
    isMainDomain: true,
  });

  useEffect(() => {
    const resolveTenant = async () => {
      const hostInfo = detectTenantFromHostname();
      
      // Main domain - no tenant resolution needed
      if (hostInfo.isMainDomain && !hostInfo.subdomain) {
        setTenant({
          tenantId: null,
          subdomain: null,
          tenantName: null,
          status: 'main_domain',
          isMainDomain: true,
        });
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
            setTenant({
              tenantId: null,
              subdomain: hostInfo.subdomain,
              tenantName: null,
              status: 'not_found',
              isMainDomain: false,
            });
            return;
          }
          
          if (!data) {
            setTenant({
              tenantId: null,
              subdomain: hostInfo.subdomain,
              tenantName: null,
              status: 'not_found',
              isMainDomain: false,
            });
            return;
          }
          
          // Check if tenant is accessible
          if (data.status === 'locked') {
            setTenant({
              tenantId: null,
              subdomain: hostInfo.subdomain,
              tenantName: data.name,
              status: 'not_found', // Treat locked as not found
              isMainDomain: false,
            });
            return;
          }
          
          setTenant({
            tenantId: data.id,
            subdomain: data.subdomain,
            tenantName: data.name,
            status: 'resolved',
            isMainDomain: false,
          });
        } catch (err) {
          console.error('Error resolving tenant:', err);
          setTenant({
            tenantId: null,
            subdomain: hostInfo.subdomain,
            tenantName: null,
            status: 'not_found',
            isMainDomain: false,
          });
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
          setTenant({
            tenantId: null,
            subdomain: null,
            tenantName: null,
            status: 'not_found',
            isMainDomain: false,
          });
          return;
        }
        
        const tenantData = data.tenants as any;
        
        setTenant({
          tenantId: tenantData.id,
          subdomain: tenantData.subdomain,
          tenantName: tenantData.name,
          status: 'resolved',
          isMainDomain: false,
        });
      } catch (err) {
        console.error('Error resolving custom domain:', err);
        setTenant({
          tenantId: null,
          subdomain: null,
          tenantName: null,
          status: 'not_found',
          isMainDomain: false,
        });
      }
    };
    
    resolveTenant();
  }, []);
  
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
