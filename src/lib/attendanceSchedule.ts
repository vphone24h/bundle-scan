interface ScheduleLike {
  type: 'fixed' | 'custom' | 'weekly' | 'flexible';
  fixedShiftId?: string;
  customDays?: Record<string, string>;
  weeklyDays?: Record<string, string>; // date (yyyy-MM-dd) -> shiftId
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
  // Flexible mode: nhân viên làm theo giờ tự do — không xếp lịch.
  // Cứ check-in/check-out là tính giờ. Trả về mảng rỗng để không tạo shift_assignments.
  if (scheduleData.type === 'flexible') {
    return [];
  }

  const fixedShiftId = selectedShiftId || scheduleData.fixedShiftId;

  if (scheduleData.type === 'weekly') {
    return Object.entries(scheduleData.weeklyDays || {}).flatMap(([dateStr, shiftId]) => {
      if (!shiftId) return [];
      return [{
        tenant_id: tenantId,
        user_id: userId,
        shift_id: shiftId,
        assignment_type: 'daily' as const,
        specific_date: dateStr,
      }];
    });
  }

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