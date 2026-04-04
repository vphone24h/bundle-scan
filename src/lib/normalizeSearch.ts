export function normalizeProductSearchQuery(value: string): string {
  return value
    .trim()
    .replace(/([a-zà-ỹ])([A-ZÀ-Ỹ])/g, '$1 $2')
    .replace(/([A-Za-zÀ-ỹ])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-zÀ-ỹ])/g, '$1 $2')
    .replace(/[-_/.,|:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeLooseSearchValue(value: string): string {
  return normalizeProductSearchQuery(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function createProductSearchCandidates(value: string): string[] {
  const original = value.trim().replace(/\s+/g, ' ');
  const normalized = normalizeProductSearchQuery(original);

  return Array.from(new Set([normalized, original].filter(Boolean)));
}