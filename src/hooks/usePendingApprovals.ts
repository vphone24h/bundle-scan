import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { fetchAllRows } from '@/lib/fetchAllRows';

export function usePendingApprovals() {
  const { data: currentTenant } = useCurrentTenant();
  const tenantId = currentTenant?.id;

  const { data } = useQuery({
    queryKey: ['pending-approvals-count', tenantId],
    queryFn: async () => {
      if (!tenantId) return { corrections: 0, overtime: 0, absences: 0, leaveRequests: 0 };

      // Khoảng thời gian = tháng hiện tại (đồng bộ với OvertimeReviewsTab)
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const [correctionsRes, overtimeRes, absencesRes, leaveRes, attendanceRes, shiftRows, hourlyRes, tenantRes] = await Promise.all([
        supabase
          .from('attendance_correction_requests')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'pending'),
        supabase
          .from('overtime_requests')
          .select('user_id, request_date, request_type, status')
          .eq('tenant_id', tenantId)
          .gte('request_date', monthStart)
          .lte('request_date', monthEnd),
        supabase
          .from('absence_reviews')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('is_excused', false)
          .is('reviewed_at', null),
        supabase
          .from('leave_requests')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'pending'),
        supabase
          .from('attendance_records')
          .select('user_id, date, check_in_time, check_out_time, total_work_minutes, overtime_minutes, work_shifts(start_time)')
          .eq('tenant_id', tenantId)
          .gte('date', monthStart)
          .lte('date', monthEnd),
        fetchAllRows<any>(() =>
          supabase
            .from('shift_assignments')
            .select('user_id, day_of_week, specific_date, assignment_type')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
        ),
        supabase
          .from('employee_salary_configs')
          .select('user_id, salary_templates(salary_type, enable_overtime)')
          .eq('tenant_id', tenantId),
        supabase
          .from('tenants')
          .select('compensation_threshold_minutes')
          .eq('id', tenantId)
          .maybeSingle(),
      ]);

      const skipOvertimeUserIds = new Set(
        (hourlyRes.data || [])
          .filter((c: any) => {
            const t = c.salary_templates;
            if (!t) return false;
            // Bỏ qua: lương theo giờ HOẶC template tắt tăng ca
            return t.salary_type === 'hourly' || t.enable_overtime === false;
          })
          .map((c: any) => c.user_id as string),
      );
      const netThreshold = typeof (tenantRes.data as any)?.compensation_threshold_minutes === 'number'
        ? (tenantRes.data as any).compensation_threshold_minutes
        : 15;

      // Đồng bộ logic với OvertimeReviewsTab: pending = OT request status pending + auto-detected
      const otRows = overtimeRequests_safe(overtimeRes.data);
      const existingKeys = new Set(otRows.map(r => `${r.user_id}_${r.request_date}_${r.request_type}`));
      const pendingRequestCount = otRows.filter(r => !r.status || r.status === 'pending').length;

      let autoDetected = 0;
      const attendance = attendanceRes.data || [];
      const assignments = shiftRows || [];
      for (const att of attendance) {
        if (!att.check_in_time || !(att as any).check_out_time) continue;
        if (skipOvertimeUserIds.has(att.user_id)) continue;
        const dateStr = att.date;
        const dow = new Date(dateStr).getDay();
        const userAssignments = assignments.filter((sa: any) => sa.user_id === att.user_id);
        const isScheduled = userAssignments.some((sa: any) =>
          (sa.assignment_type === 'fixed' && sa.day_of_week === dow) || sa.specific_date === dateStr
        );
        if (!isScheduled && !existingKeys.has(`${att.user_id}_${dateStr}_day_off`)) autoDetected++;
        if (isScheduled && (att.overtime_minutes || 0) > netThreshold && !existingKeys.has(`${att.user_id}_${dateStr}_extra_hours`)) autoDetected++;
        const shift = (att as any).work_shifts;
        if (isScheduled && att.check_in_time && shift?.start_time) {
          const [sh, sm] = String(shift.start_time).split(':').map(Number);
          const ci = new Date(att.check_in_time);
          const ss = new Date(ci); ss.setHours(sh, sm, 0, 0);
          const earlyMin = Math.round((ss.getTime() - ci.getTime()) / 60000);
          if (earlyMin > netThreshold && !existingKeys.has(`${att.user_id}_${dateStr}_early_checkin`)) autoDetected++;
        }
      }

      return {
        corrections: correctionsRes.count ?? 0,
        overtime: pendingRequestCount + autoDetected,
        absences: absencesRes.count ?? 0,
        leaveRequests: leaveRes.count ?? 0,
      };
    },
    enabled: !!tenantId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const corrections = data?.corrections ?? 0;
  const overtime = data?.overtime ?? 0;
  const absences = data?.absences ?? 0;
  const leaveRequests = data?.leaveRequests ?? 0;
  // Gộp: badge "Duyệt xin nghỉ" hiển thị cả đơn pending + ngày vắng auto-detect chưa duyệt
  const leaveCombined = leaveRequests + absences;

  return {
    corrections,
    overtime,
    absences,
    leaveRequests: leaveCombined,
    /** Total pending for attendance parent tab (corrections + remote) */
    attendanceTotal: corrections,
    /** Total pending for payroll parent tab */
    payrollTotal: overtime + leaveCombined,
    /** Grand total */
    total: corrections + overtime + leaveCombined,
  };
}

function overtimeRequests_safe(data: any): Array<{ user_id: string; request_date: string; request_type: string; status: string | null }> {
  return Array.isArray(data) ? data : [];
}
