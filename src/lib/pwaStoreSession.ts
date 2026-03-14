const PWA_STORE_IDENTITY_KEY = 'pwa_store_identity_v1';
const PWA_LAST_ROUTE_KEY = 'pwa_last_route_v1';
const PWA_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

interface StoredRecordBase {
  savedAt: number;
}

interface StoredStoreIdentity extends StoredRecordBase {
  shop_id: string | null;
  shop_domain: string;
  tenant_id: string | null;
}

interface StoredLastRoute extends StoredRecordBase {
  shop_domain: string;
  pathname: string;
  search: string;
}

function isFresh(savedAt: number) {
  return Number.isFinite(savedAt) && Date.now() - savedAt <= PWA_SESSION_TTL_MS;
}

export function writePwaStoreIdentity(payload: {
  shopId: string | null;
  shopDomain: string;
  tenantId: string | null;
}) {
  if (typeof window === 'undefined') return;

  const shopDomain = payload.shopDomain.trim().toLowerCase();
  const shopId = payload.shopId?.trim().toLowerCase() || null;
  const tenantId = payload.tenantId?.trim() || null;

  if (!shopDomain || (!shopId && !tenantId)) return;

  const record: StoredStoreIdentity = {
    shop_id: shopId,
    shop_domain: shopDomain,
    tenant_id: tenantId,
    savedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(PWA_STORE_IDENTITY_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage errors
  }
}

export function readPwaStoreIdentity(currentHostname?: string | null) {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(PWA_STORE_IDENTITY_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredStoreIdentity>;
    if (!parsed || typeof parsed.savedAt !== 'number' || !isFresh(parsed.savedAt)) {
      window.localStorage.removeItem(PWA_STORE_IDENTITY_KEY);
      return null;
    }

    const shopDomain = typeof parsed.shop_domain === 'string' ? parsed.shop_domain.trim().toLowerCase() : '';
    const hostname = (currentHostname || '').trim().toLowerCase();

    if (!shopDomain) return null;
    if (hostname && hostname !== shopDomain) return null;

    const shopId = typeof parsed.shop_id === 'string' && parsed.shop_id.trim()
      ? parsed.shop_id.trim().toLowerCase()
      : null;
    const tenantId = typeof parsed.tenant_id === 'string' && parsed.tenant_id.trim()
      ? parsed.tenant_id.trim()
      : null;

    if (!shopId && !tenantId) return null;

    return {
      shopId,
      shopDomain,
      tenantId,
    };
  } catch {
    return null;
  }
}

export function writePwaLastRoute(payload: {
  shopDomain: string;
  pathname: string;
  search?: string;
}) {
  if (typeof window === 'undefined') return;

  const shopDomain = payload.shopDomain.trim().toLowerCase();
  const pathname = payload.pathname?.trim() || '/';
  const search = payload.search?.trim() || '';

  if (!shopDomain || !pathname.startsWith('/')) return;

  const record: StoredLastRoute = {
    shop_domain: shopDomain,
    pathname,
    search,
    savedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(PWA_LAST_ROUTE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage errors
  }
}

export function readPwaLastRoute(currentHostname?: string | null) {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(PWA_LAST_ROUTE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredLastRoute>;
    if (!parsed || typeof parsed.savedAt !== 'number' || !isFresh(parsed.savedAt)) {
      window.localStorage.removeItem(PWA_LAST_ROUTE_KEY);
      return null;
    }

    const shopDomain = typeof parsed.shop_domain === 'string' ? parsed.shop_domain.trim().toLowerCase() : '';
    const hostname = (currentHostname || '').trim().toLowerCase();

    if (!shopDomain || !parsed.pathname || typeof parsed.pathname !== 'string') return null;
    if (hostname && shopDomain !== hostname) return null;

    const pathname = parsed.pathname.trim();
    if (!pathname.startsWith('/')) return null;

    const search = typeof parsed.search === 'string' ? parsed.search : '';

    return {
      shopDomain,
      pathname,
      search,
    };
  } catch {
    return null;
  }
}
