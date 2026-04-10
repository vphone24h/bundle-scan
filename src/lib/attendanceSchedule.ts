interface ScheduleLike {
  type: 'fixed' | 'custom';
  fixedShiftId?: string;
  customDays?: Record<string, string>;
}

interface BuildRecurringShiftAssignmentsOptions {
  tenantId: string;
  userId: string;
  selectedShiftId?: string;
  scheduleData: ScheduleLike;
}

const DAY_OF_WEEK_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function buildRecurringShiftAssignments({
  tenantId,
  userId,
  selectedShiftId,
  scheduleData,
}: BuildRecurringShiftAssignmentsOptions) {
  const fixedShiftId = selectedShiftId || scheduleData.fixedShiftId;

  if (scheduleData.type === 'custom') {
    return Object.entries(scheduleData.customDays || {}).flatMap(([dayKey, shiftId]) => {
      const dayOfWeek = DAY_OF_WEEK_MAP[dayKey];

      if (!shiftId || dayOfWeek === undefined) return [];

      return [{
        tenant_id: tenantId,
        user_id: userId,
        shift_id: shiftId,
        assignment_type: 'fixed' as const,
        day_of_week: dayOfWeek,
      }];
    });
  }

  if (!fixedShiftId) return [];

  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    tenant_id: tenantId,
    user_id: userId,
    shift_id: fixedShiftId,
    assignment_type: 'fixed' as const,
    day_of_week: dayOfWeek,
  }));
}