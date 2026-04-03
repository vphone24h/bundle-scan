// Shared utility for payment source label resolution
// Used in reports, cashbook, and other places that display payment_source values

const LEGACY_SOURCE_MAP: Record<string, string> = {
  'cashBook.cash': 'cash',
  'cashBook.bankCard': 'bank_card',
  'cashBook.eWallet': 'e_wallet',
};

const DEFAULT_LABELS: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_card: 'Thẻ ngân hàng',
  e_wallet: 'Ví điện tử',
};

export function normalizePaymentSource(source: string): string {
  return LEGACY_SOURCE_MAP[source] || source;
}

/**
 * Get a human-readable label for a payment source key.
 * @param source - raw payment_source from DB
 * @param customSources - optional list of custom payment sources [{id, name}]
 */
export function getPaymentSourceLabel(
  source: string,
  customSources?: Array<{ id: string; name: string }>
): string {
  const normalized = normalizePaymentSource(source);
  
  // Check default labels
  if (DEFAULT_LABELS[normalized]) return DEFAULT_LABELS[normalized];
  
  // Check custom sources
  if (customSources) {
    const custom = customSources.find(s => s.id === normalized);
    if (custom) return custom.name;
  }
  
  return source;
}
