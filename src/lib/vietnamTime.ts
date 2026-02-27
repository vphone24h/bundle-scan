export const VIETNAM_TZ_OFFSET = '+07:00';

const HAS_TIMEZONE_SUFFIX_REGEX = /(Z|[+-]\d{2}:\d{2})$/i;

export function toVietnamDate(dateInput: string | Date): Date {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00';

  return new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`);
}

export function toVietnamDateTimeInputValue(dateInput: string | Date = new Date()): string {
  const vnDate = toVietnamDate(dateInput);
  const yyyy = vnDate.getFullYear();
  const mm = String(vnDate.getMonth() + 1).padStart(2, '0');
  const dd = String(vnDate.getDate()).padStart(2, '0');
  const hh = String(vnDate.getHours()).padStart(2, '0');
  const min = String(vnDate.getMinutes()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function toVietnamTimestampInput(value: string): string {
  if (!value) return value;

  if (HAS_TIMEZONE_SUFFIX_REGEX.test(value)) {
    return value;
  }

  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return `${withSeconds}${VIETNAM_TZ_OFFSET}`;
}
