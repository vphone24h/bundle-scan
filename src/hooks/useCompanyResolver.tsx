import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { registerCompanyDomain } from '@/lib/tenantResolver';

export interface CompanyInfo {
  companyId: string | null;
  domain: string | null;
  name: string | null;
  status: 'loading' | 'resolved' | 'not_found';
}

const CompanyContext = createContext<CompanyInfo>({
  companyId: null,
  domain: null,
  name: null,
  status: 'loading',
});

// In-memory cache
let cachedCompany: CompanyInfo | null = null;
let cachedForHostname: string | null = null;

// localStorage cache
const COMPANY_CACHE_KEY = 'company_resolver_cache_v1';
const COMPANY_CACHE_TTL = 1000 * 60 * 60 * 24; // 24h

export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function isHostnameCompatibleWithCompany(hostname: string, companyDomain: string | null): boolean {
  if (!companyDomain) return false;

  const normalizedHostname = normalizeHostname(hostname);
  const normalizedDomain = normalizeHostname(companyDomain);

  return (
    normalizedHostname === normalizedDomain ||
    normalizedHostname.endsWith(`.${normalizedDomain}`)
  );
}

function readPersistedCompany(hostname: string): CompanyInfo | null {
  try {
    const raw = localStorage.getItem(`${COMPANY_CACHE_KEY}:${hostname}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > COMPANY_CACHE_TTL) {
      localStorage.removeItem(`${COMPANY_CACHE_KEY}:${hostname}`);
      return null;
    }
    const persistedCompany = {
      companyId: parsed.companyId,
      domain: parsed.domain,
      name: parsed.name,
      status: 'resolved',
    } as CompanyInfo;

    if (!isHostnameCompatibleWithCompany(hostname, persistedCompany.domain)) {
      localStorage.removeItem(`${COMPANY_CACHE_KEY}:${hostname}`);
      return null;
    }

    return persistedCompany;
  } catch {
    return null;
  }
}

function persistCompany(hostname: string, info: CompanyInfo) {
  if (info.status !== 'resolved' || !info.companyId) return;
  if (!isHostnameCompatibleWithCompany(hostname, info.domain)) return;
  try {
    localStorage.setItem(`${COMPANY_CACHE_KEY}:${hostname}`, JSON.stringify({
      companyId: info.companyId,
      domain: info.domain,
      name: info.name,
      savedAt: Date.now(),
    }));
  } catch {}
}

/**
 * Resolve company from current hostname.
 * 
 * Logic:
 * 1. Normalize hostname (lowercase, remove www.)
 * 2. Check if hostname matches a company domain directly
 * 3. Check if hostname is a subdomain of a company domain (e.g. shop.mycompany.vn)
 * 4. Fallback to default company (vkho.vn)
 */
export function getCachedCompanyForHostname(hostname: string): CompanyInfo | null {
  const normalizedHostname = normalizeHostname(hostname);

  if (
    cachedCompany &&
    cachedForHostname &&
    normalizeHostname(cachedForHostname) === normalizedHostname &&
    isHostnameCompatibleWithCompany(hostname, cachedCompany.domain)
  ) {
    return cachedCompany;
  }

  const persisted = readPersistedCompany(normalizedHostname);
  if (persisted) {
    cachedCompany = persisted;
    cachedForHostname = hostname;
    if (persisted.domain) {
      registerCompanyDomain(persisted.domain);
    }
    return persisted;
  }

  return null;
}

export async function resolveCompanyFromHostname(hostname: string): Promise<CompanyInfo> {
  const normalized = normalizeHostname(hostname);

  // Dev/preview mode → default company
  if (normalized === 'localhost' || normalized === '127.0.0.1' ||
      normalized.includes('lovable.app') || normalized.includes('lovable.dev') ||
      normalized.includes('lovableproject.com')) {
    // Check ?company= param for testing
    const params = new URLSearchParams(window.location.search);
    const companyParam = params.get('company');
    if (companyParam) {
      try {
        const { data } = await supabase.rpc('lookup_company_by_domain', { _domain: companyParam });
        const company = Array.isArray(data) ? data[0] : data;
        if (company) {
          return { companyId: company.id, domain: company.domain, name: company.name, status: 'resolved' };
        }
      } catch {}
    }
    // Default company
    try {
      const { data } = await supabase.rpc('lookup_company_by_domain', { _domain: 'vkho.vn' });
      const company = Array.isArray(data) ? data[0] : data;
      if (company) {
        return { companyId: company.id, domain: company.domain, name: company.name, status: 'resolved' };
      }
    } catch {}
    return { companyId: null, domain: 'vkho.vn', name: 'VKho', status: 'resolved' };
  }

  // Try exact domain match first
  try {
    const { data } = await supabase.rpc('lookup_company_by_domain', { _domain: normalized });
    const company = Array.isArray(data) ? data[0] : data;
    if (company) {
      return { companyId: company.id, domain: company.domain, name: company.name, status: 'resolved' };
    }
  } catch {}

  // Try parent domains (e.g., shop1.mycompany.vn → mycompany.vn)
  const parts = normalized.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    try {
      const { data } = await supabase.rpc('lookup_company_by_domain', { _domain: parentDomain });
      const company = Array.isArray(data) ? data[0] : data;
      if (company) {
        return { companyId: company.id, domain: company.domain, name: company.name, status: 'resolved' };
      }
    } catch {}
  }

  return { companyId: null, domain: null, name: null, status: 'not_found' };
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  const [company, setCompany] = useState<CompanyInfo>(() => {
    const cached = getCachedCompanyForHostname(hostname);
    if (cached) return cached;

    // FAST PATH: read inline-script prefetch result so we can skip the loading state.
    if (typeof window !== 'undefined') {
      const prefetch = (window as any).__STORE_PREFETCH__;
      if (prefetch) {
        if (prefetch.isCompanyDomain && prefetch.companyId) {
          const normalizedHost = normalizeHostname(hostname);
          const info: CompanyInfo = {
            companyId: prefetch.companyId,
            domain: normalizedHost,
            name: prefetch.companyName || null,
            status: 'resolved',
          };
          cachedCompany = info;
          cachedForHostname = hostname;
          registerCompanyDomain(normalizedHost);
          return info;
        }
        // If inline script already resolved a tenant for this host, it's NOT a company domain.
        if (prefetch.tenantId || prefetch.tenant) {
          return { companyId: null, domain: null, name: null, status: 'not_found' };
        }
      }
    }

    return { companyId: null, domain: null, name: null, status: 'loading' };
  });

  useEffect(() => {
    if (
      company.status === 'resolved' &&
      cachedForHostname === hostname &&
      isHostnameCompatibleWithCompany(hostname, company.domain)
    ) return;

    let cancelled = false;

    // Prefer prefetch promise from inline script when available — avoids a duplicate RPC.
    const prefetch = typeof window !== 'undefined' ? (window as any).__STORE_PREFETCH__ : null;
    if (prefetch?.companyCheckPromise && company.status === 'loading') {
      prefetch.companyCheckPromise.then((isCompany: boolean) => {
        if (cancelled) return;
        if (isCompany && prefetch.companyId) {
          const normalizedHost = normalizeHostname(hostname);
          const info: CompanyInfo = {
            companyId: prefetch.companyId,
            domain: normalizedHost,
            name: prefetch.companyName || null,
            status: 'resolved',
          };
          cachedCompany = info;
          cachedForHostname = hostname;
          persistCompany(normalizedHost, info);
          registerCompanyDomain(normalizedHost);
          setCompany(info);
        } else {
          setCompany({ companyId: null, domain: null, name: null, status: 'not_found' });
        }
      }).catch(() => {
        if (cancelled) return;
        // Fallback to standard async resolution on prefetch failure
        resolveCompanyFromHostname(hostname).then(result => {
          if (cancelled) return;
          setCompany(result);
        });
      });
      return () => { cancelled = true; };
    }

    resolveCompanyFromHostname(hostname).then(result => {
      if (cancelled) return;
      cachedCompany = result;
      cachedForHostname = hostname;
      if (result.status === 'resolved' && !isHostnameCompatibleWithCompany(hostname, result.domain)) {
        cachedCompany = null;
        setCompany({ companyId: null, domain: null, name: null, status: 'not_found' });
        return;
      }

      persistCompany(normalizeHostname(hostname), result);
      // Register company domain so tenantResolver treats it as a primary domain
      if (result.domain) {
        registerCompanyDomain(result.domain);
      }
      setCompany(result);
    });
    return () => { cancelled = true; };
  }, [hostname]);

  return (
    <CompanyContext.Provider value={company}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyInfo {
  return useContext(CompanyContext);
}

/**
 * Get current company ID (sync, from cache)
 */
export function getCurrentCompanyId(): string | null {
  return cachedCompany?.companyId ?? null;
}

/**
 * Get current company domain
 */
export function getCurrentCompanyDomain(): string | null {
  return cachedCompany?.domain ?? null;
}
