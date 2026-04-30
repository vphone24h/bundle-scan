import { format, getDaysInMonth } from 'date-fns';

export type PaidLeaveOverrideMap = Record<string, number[]>;

export function getPaidLeaveMonthKey(date: Date) {
  return format(date, 'yyyy-MM');
}

export function parsePaidLeaveMonthKey(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month };
}

export function normalizePaidLeaveDays(days: number[] | undefined, maxDay: number) {
  return Array.from(new Set((days || []).filter((day) => Number.isInteger(day) && day >= 1 && day <= maxDay))).sort((a, b) => a - b);
}

export function getPaidLeaveDaysForMonth(params: {
  monthDate: Date;
  overrides?: PaidLeaveOverrideMap;
  defaultDays?: number[];
}) {
  const { monthDate, overrides, defaultDays = [] } = params;
  const maxDay = getDaysInMonth(monthDate);
  const monthKey = getPaidLeaveMonthKey(monthDate);
  return normalizePaidLeaveDays(overrides?.[monthKey] ?? defaultDays, maxDay);
}

export function mapPaidLeaveOverrideRows(
  rows: Array<{ year: number; month: number; leave_dates: string[] | null }>
) {
  return rows.reduce<PaidLeaveOverrideMap>((acc, row) => {
    const monthKey = `${row.year}-${String(row.month).padStart(2, '0')}`;
    acc[monthKey] = normalizePaidLeaveDays(
      (row.leave_dates || []).map((dateStr) => Number(dateStr.split('-').pop() || 0)),
      31
    );
    return acc;
  }, {});
}

export function buildPaidLeaveOverrideRows(params: {
  tenantId: string;
  userId: string;
  overrides?: PaidLeaveOverrideMap;
}) {
  const { tenantId, userId, overrides = {} } = params;

  return Object.entries(overrides)
    .map(([monthKey, days]) => {
      const { year, month } = parsePaidLeaveMonthKey(monthKey);
      const normalizedDays = normalizePaidLeaveDays(days, 31);

      return {
        tenant_id: tenantId,
        user_id: userId,
        year,
        month,
        leave_dates: normalizedDays.map((day) => `${monthKey}-${String(day).padStart(2, '0')}`),
      };
    })
    .filter((row) => row.leave_dates.length > 0);
}