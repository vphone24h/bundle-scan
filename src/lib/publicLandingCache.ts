const PUBLIC_LANDING_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const PUBLIC_LANDING_CACHE_PREFIX = 'public_landing_cache_v1';
const PUBLIC_LANDING_LAST_SUCCESS_KEY = `${PUBLIC_LANDING_CACHE_PREFIX}:last_success`;

export interface PublicLandingCachePayload {
  tenant: { id: string; name: string; subdomain: string; status: string };
  settings: unknown;
  branches: unknown[];
}

interface PublicLandingCacheRecord extends PublicLandingCachePayload {
  savedAt: number;
}

function buildKey(id: string) {
  return `${PUBLIC_LANDING_CACHE_PREFIX}:${id}`;
}

export function getPublicLandingCacheKeys(params: {
  subdomain?: string | null;
  tenantId?: string | null;
  hostname?: string | null;
}): string[] {
  const keys = new Set<string>();

  const normalizedSubdomain = (params.subdomain || '').trim().toLowerCase();
  const normalizedTenantId = (params.tenantId || '').trim();
  const normalizedHostname = (params.hostname || '').trim().toLowerCase();

  if (normalizedSubdomain) keys.add(buildKey(`subdomain:${normalizedSubdomain}`));
  if (normalizedTenantId) keys.add(buildKey(`tenant:${normalizedTenantId}`));
  if (normalizedHostname) keys.add(buildKey(`host:${normalizedHostname}`));

  return Array.from(keys);
}

export function readPublicLandingCache(keys: string[]): PublicLandingCachePayload | null {
  if (typeof window === 'undefined') return null;

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as Partial<PublicLandingCacheRecord>;
      if (!parsed || typeof parsed.savedAt !== 'number') {
        window.localStorage.removeItem(key);
        continue;
      }

      if (Date.now() - parsed.savedAt > PUBLIC_LANDING_CACHE_TTL_MS) {
        window.localStorage.removeItem(key);
        continue;
      }

      if (!parsed.tenant || !('settings' in parsed)) {
        continue;
      }

      return {
        tenant: parsed.tenant as PublicLandingCachePayload['tenant'],
        settings: parsed.settings,
        branches: Array.isArray(parsed.branches) ? parsed.branches : [],
      };
    } catch {
      // Ignore malformed cache entries and continue to next key
    }
  }

  return null;
}

export function writePublicLandingCache(keys: string[], payload: PublicLandingCachePayload) {
  if (typeof window === 'undefined') return;
  if (!payload?.tenant || !payload.tenant.id) return;

  const record: PublicLandingCacheRecord = {
    ...payload,
    branches: Array.isArray(payload.branches) ? payload.branches : [],
    savedAt: Date.now(),
  };

  for (const key of keys) {
    try {
      window.localStorage.setItem(key, JSON.stringify(record));
    } catch {
      // Ignore storage errors
    }
  }
}
