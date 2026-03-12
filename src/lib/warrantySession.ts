export interface WarrantySessionPayload<T> {
  searchValue: string;
  results: T[];
  updatedAt: string;
}

export function readWarrantySession<T>(storageKey: string | null): WarrantySessionPayload<T> | null {
  if (!storageKey || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<WarrantySessionPayload<T>>;
    const searchValue = typeof parsed.searchValue === 'string' ? parsed.searchValue.trim() : '';
    const results = Array.isArray(parsed.results) ? parsed.results : [];

    if (!searchValue) return null;

    return {
      searchValue,
      results,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeWarrantySession<T>(
  storageKey: string | null,
  payload: { searchValue: string; results: T[] }
) {
  if (!storageKey || typeof window === 'undefined') return;

  const searchValue = payload.searchValue.trim();
  if (!searchValue) return;

  const sessionPayload: WarrantySessionPayload<T> = {
    searchValue,
    results: Array.isArray(payload.results) ? payload.results : [],
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(sessionPayload));
  } catch {
    // Ignore quota/storage errors
  }
}

export function clearWarrantySession(storageKey: string | null) {
  if (!storageKey || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage errors
  }
}
