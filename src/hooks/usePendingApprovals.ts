import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';

export function usePendingApprovals() {
  const { data: currentTenant } = useCurrentTenant();
  const tenantId = currentTenant?.id;

  const { data } = useQuery({
    queryKey: ['pending-approvals-count', tenantId],
    queryFn: async () => {
      if (!tenantId) return { corrections: 0, overtime: 0, absences: 0, leaveRequests: 0 };

      const [correctionsRes, overtimeRes, absencesRes, leaveRes] = await Promise.all([
        supabase
          .from('attendance_correction_requests')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'pending'),
        supabase
          .from('overtime_requests')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'pending'),
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
      ]);

      return {
        corrections: correctionsRes.count ?? 0,
        overtime: overtimeRes.count ?? 0,
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

  return {
    corrections,
    overtime,
    absences,
    leaveRequests,
    /** Total pending for attendance parent tab (corrections + remote) */
    attendanceTotal: corrections,
    /** Total pending for payroll parent tab */
    payrollTotal: overtime + absences + leaveRequests,
    /** Grand total */
    total: corrections + overtime + absences + leaveRequests,
  };
}
