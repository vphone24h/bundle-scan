import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from './usePermissions';
import { AuditLog, ActionGroup, ACTION_GROUPS, getDateRange, TimeFilter } from '@/types/auditLog';

export interface AuditLogFilters {
  search: string;
  actionTypes: string[];
  actionGroup: ActionGroup;
  branchId: string;
  userIds: string[];
  timeFilter: TimeFilter;
  customStartDate?: Date;
  customEndDate?: Date;
}

export function useAuditLogs(filters: AuditLogFilters) {
  const { data: permissions } = usePermissions();

  return useQuery({
    queryKey: ['audit-logs', filters, permissions?.branchId, permissions?.role],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      // Branch filtering based on permissions
      if (permissions?.role !== 'super_admin' && permissions?.branchId) {
        // Non-super_admin can only see their branch logs
        query = query.eq('branch_id', permissions.branchId);
      } else if (filters.branchId && filters.branchId !== 'all') {
        // Super admin can filter by branch
        query = query.eq('branch_id', filters.branchId);
      }

      // Action type filter
      if (filters.actionTypes.length > 0 && !filters.actionTypes.includes('all')) {
        query = query.in('action_type', filters.actionTypes);
      }

      // Action group filter (by table names)
      if (filters.actionGroup !== 'all') {
        const tables = ACTION_GROUPS[filters.actionGroup]?.tables || [];
        if (tables.length > 0) {
          query = query.in('table_name', tables);
        }
      }

      // User filter
      if (filters.userIds.length > 0) {
        query = query.in('user_id', filters.userIds);
      }

      // Time filter
      const dateRange = getDateRange(filters.timeFilter, filters.customStartDate, filters.customEndDate);
      if (dateRange) {
        query = query
          .gte('created_at', dateRange.start.toISOString())
          .lt('created_at', dateRange.end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: !!permissions,
  });
}

// Hook to get all users for filter dropdown
export function useAuditLogUsers() {
  const { data: permissions } = usePermissions();

  return useQuery({
    queryKey: ['audit-log-users', permissions?.branchId, permissions?.role],
    queryFn: async () => {
      // Get user_roles with profiles
      let query = supabase
        .from('user_roles')
        .select('user_id, user_role, branch_id');

      // Non-super_admin can only see users in their branch
      if (permissions?.role !== 'super_admin' && permissions?.branchId) {
        query = query.eq('branch_id', permissions.branchId);
      }

      const { data: roles, error: rolesError } = await query;
      if (rolesError) throw rolesError;

      const userIds = roles?.map(r => r.user_id) || [];
      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      return roles?.map(role => {
        const profile = profiles?.find(p => p.user_id === role.user_id);
        return {
          user_id: role.user_id,
          display_name: profile?.display_name || 'N/A',
          user_role: role.user_role,
          branch_id: role.branch_id,
        };
      }) || [];
    },
    enabled: !!permissions,
  });
}
