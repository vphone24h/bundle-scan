import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CompanyInfo {
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

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
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
    return {
      companyId: parsed.companyId,
      domain: parsed.domain,
      name: parsed.name,
      status: 'resolved',
    };
  } catch {
    return null;
  }
}

function persistCompany(hostname: string, info: CompanyInfo) {
  if (info.status !== 'resolved' || !info.companyId) return;
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
async function resolveCompanyFromHostname(hostname: string): Promise<CompanyInfo> {
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

  // Fallback to default
  try {
    const { data } = await supabase.rpc('lookup_company_by_domain', { _domain: 'vkho.vn' });
    const company = Array.isArray(data) ? data[0] : data;
    if (company) {
      return { companyId: company.id, domain: company.domain, name: company.name, status: 'resolved' };
    }
  } catch {}

  return { companyId: null, domain: null, name: null, status: 'not_found' };
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  const [company, setCompany] = useState<CompanyInfo>(() => {
    // Check in-memory cache
    if (cachedCompany && cachedForHostname === hostname) return cachedCompany;
    // Check localStorage
    const persisted = readPersistedCompany(normalizeHostname(hostname));
    if (persisted) {
      cachedCompany = persisted;
      cachedForHostname = hostname;
      return persisted;
    }
    return { companyId: null, domain: null, name: null, status: 'loading' };
  });

  useEffect(() => {
    if (company.status === 'resolved' && cachedForHostname === hostname) return;

    let cancelled = false;
    resolveCompanyFromHostname(hostname).then(result => {
      if (cancelled) return;
      cachedCompany = result;
      cachedForHostname = hostname;
      persistCompany(normalizeHostname(hostname), result);
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
