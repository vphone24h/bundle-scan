/**
 * Tenant Resolver - Detect store from subdomain
 * 
 * Ví dụ:
 * - vkho.vn → null (trang chính)
 * - www.vkho.vn → null (trang chính)
 * - storeid.vkho.vn → "storeid"
 * - localhost:5173 → null (dev mode)
 */

// Primary domains include all company domains registered in the system
// These are checked statically; additional company domains are resolved at runtime
const PRIMARY_DOMAINS = ['vkho.vn', 'nguyenkieuanh.net'];
const PRIMARY_DOMAIN = PRIMARY_DOMAINS[0]; // default for URL building

/**
 * Dynamically add a company domain to the primary domains list
 * Called by CompanyProvider when a new company domain is resolved
 */
export function registerCompanyDomain(domain: string) {
  const normalized = domain.toLowerCase().replace(/^www\./, '');
  if (!PRIMARY_DOMAINS.includes(normalized)) {
    PRIMARY_DOMAINS.push(normalized);
  }
}
const RESERVED_SUBDOMAINS = ['www', 'api', 'admin', 'app', 'dashboard'];

export interface TenantInfo {
  subdomain: string | null;
  isMainDomain: boolean;
  hostname: string;
}

/**
 * Detect tenant subdomain from current hostname
 */
export function detectTenantFromHostname(): TenantInfo {
  const hostname = window.location.hostname;
  
  // Check for ?store= query param (for testing/dev mode)
  const params = new URLSearchParams(window.location.search);
  const storeParam = params.get('store');
  if (storeParam) {
    return {
      subdomain: storeParam.toLowerCase(),
      isMainDomain: false,
      hostname,
    };
  }
  
  // Development mode (localhost)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return {
      subdomain: null,
      isMainDomain: true,
      hostname,
    };
  }
  
  // Lovable preview domain (all variations)
  if (
    hostname.includes('lovable.app') || 
    hostname.includes('lovable.dev') ||
    hostname.includes('lovableproject.com')
  ) {
    return {
      subdomain: null,
      isMainDomain: true,
      hostname,
    };
  }
  
  // Check if it's any primary domain
  const matchedPrimary = PRIMARY_DOMAINS.find(
    d => hostname === d || hostname === `www.${d}`
  );
  if (matchedPrimary) {
    return {
      subdomain: null,
      isMainDomain: true,
      hostname,
    };
  }
  
  // Check if it's a subdomain of any primary domain
  for (const domain of PRIMARY_DOMAINS) {
    if (hostname.endsWith(`.${domain}`)) {
      const subdomain = hostname.replace(`.${domain}`, '');
      
      // Check reserved subdomains
      if (RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) {
        return {
          subdomain: null,
          isMainDomain: true,
          hostname,
        };
      }
      
      return {
        subdomain: subdomain.toLowerCase(),
        isMainDomain: false,
        hostname,
      };
    }
  }
  
  // Custom domain - need to resolve via API
  return {
    subdomain: null,
    isMainDomain: false, // Could be custom domain
    hostname,
  };
}

/**
 * Check if current hostname is a store subdomain
 */
export function isStoreSubdomain(): boolean {
  const { subdomain, isMainDomain } = detectTenantFromHostname();
  return subdomain !== null && !isMainDomain;
}

/**
 * Get store ID from subdomain
 */
export function getStoreIdFromSubdomain(): string | null {
  const { subdomain } = detectTenantFromHostname();
  return subdomain;
}

/**
 * Build store URL from store ID
 */
export function buildStoreUrl(storeId: string): string {
  if (window.location.hostname === 'localhost') {
    // In dev mode, just use query param
    return `${window.location.origin}?store=${storeId}`;
  }
  return `https://${storeId}.${PRIMARY_DOMAIN}`;
}

/**
 * Redirect to store subdomain
 */
export function redirectToStoreSubdomain(storeId: string): void {
  const url = buildStoreUrl(storeId);
  if (url !== window.location.href) {
    window.location.href = url;
  }
}
