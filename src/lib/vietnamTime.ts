/**
 * Local timezone utilities.
 * All functions use the browser's local timezone for consistency
 * across Dashboard, Reports, Cash Book, and all other features.
 */

/**
 * Get the browser's timezone offset as a string like "+07:00" or "-05:00"
 */
function getBrowserTzOffset(date: Date = new Date()): string {
  const offsetMinutes = date.getTimezoneOffset(); // e.g. -420 for +07:00
  const sign = offsetMinutes <= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
  const mins = String(absMinutes % 60).padStart(2, '0');
  return `${sign}${hours}:${mins}`;
}

export const VIETNAM_TZ_OFFSET = getBrowserTzOffset();

const HAS_TIMEZONE_SUFFIX_REGEX = /(Z|[+-]\d{2}:\d{2})$/i;

/**
 * Parse a date string/Date and return a Date object representing
 * the same instant, interpreted in the browser's local timezone.
 * For display purposes: ensures consistent local-time rendering.
 */
export function toVietnamDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) return dateInput;
  // If the string has no timezone suffix, treat as local time
  if (!HAS_TIMEZONE_SUFFIX_REGEX.test(dateInput)) {
    return new Date(dateInput);
  }
  return new Date(dateInput);
}

/**
 * Format current (or given) date as a datetime-local input value
 * in the browser's local timezone: "YYYY-MM-DDTHH:mm"
 */
export function toVietnamDateTimeInputValue(dateInput: string | Date = new Date()): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Append the browser's timezone offset to a datetime-local string
 * so the server stores the correct absolute instant.
 * e.g. "2026-03-05T14:30" → "2026-03-05T14:30:00+07:00"
 */
export function toVietnamTimestampInput(value: string): string {
  if (!value) return value;

  if (HAS_TIMEZONE_SUFFIX_REGEX.test(value)) {
    return value;
  }

  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const offset = getBrowserTzOffset(new Date(value));
  return `${withSeconds}${offset}`;
}

/**
 * Helper: get today's date string in browser local timezone as "YYYY-MM-DD"
 */
export function getLocalDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Helper: get start/end ISO strings for a local date range,
 * properly converted to UTC for database queries.
 */
export function getLocalDateRangeISO(startDate: string, endDate: string): { startISO: string; endISO: string } {
  const startISO = new Date(`${startDate}T00:00:00`).toISOString();
  const endISO = new Date(`${endDate}T23:59:59.999`).toISOString();
  return { startISO, endISO };
}
