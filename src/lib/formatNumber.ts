/**
 * Format number with thousand separators (using spaces)
 * Example: 1000000 -> "1 000 000"
 */
export function formatNumberWithSpaces(value: number | string): string {
  if (value === '' || value === null || value === undefined) return '';
  
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/\s/g, '')) : value;
  
  if (isNaN(numValue)) return '';
  
  return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Parse formatted number string back to number
 * Example: "1 000 000" -> 1000000
 */
export function parseFormattedNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/\s/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format currency with VND suffix
 * Example: 1000000 -> "1 000 000đ"
 */
export function formatCurrencyWithSpaces(value: number | string): string {
  const formatted = formatNumberWithSpaces(value);
  return formatted ? `${formatted}đ` : '';
}
