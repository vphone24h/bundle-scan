import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AuditLogFiltersComponent } from '@/components/audit/AuditLogFilters';
import { AuditLogTable } from '@/components/audit/AuditLogTable';
import { useAuditLogs, AuditLogFilters, useAuditLogUsers } from '@/hooks/useAuditLogs';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranches } from '@/hooks/useBranches';
import { supabase } from '@/integrations/supabase/client';

const defaultFilters: AuditLogFilters = {
  search: '',
  actionTypes: [],
  actionGroup: 'all',
  branchId: 'all',
  userIds: [],
  timeFilter: 'all',
};

export default function AuditLogsPage() {
  const { data: permissions } = usePermissions();
  const { data: branches } = useBranches();
  const { data: users } = useAuditLogUsers();
  const [filters, setFilters] = useState<AuditLogFilters>(defaultFilters);

  const { data: logs, isLoading } = useAuditLogs(filters);

  // Get profiles for all user_ids in logs
  const userIds = useMemo(() => {
    return [...new Set(logs?.map(log => log.user_id).filter(Boolean) || [])];
  }, [logs]);

  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-logs', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds as string[]);
      if (error) throw error;
      return data;
    },
    enabled: userIds.length > 0,
  });

  // Create maps for display
  const profileMap = useMemo(() => 
    new Map(profiles?.map(p => [p.user_id, p.display_name]) || []), 
    [profiles]
  );
  
  const roleMap = useMemo(() => 
    new Map(users?.map(u => [u.user_id, u.user_role || 'staff']) || []),
    [users]
  );
  
  const branchMap = useMemo(() => 
    new Map(branches?.map(b => [b.id, b.name]) || []),
    [branches]
  );

  // Client-side search filtering
  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    if (!filters.search) return logs;

    const searchLower = filters.search.toLowerCase();
    return logs.filter(log => {
      // Search in description
      if (log.description?.toLowerCase().includes(searchLower)) return true;
      
      // Search in user name
      const userName = log.user_id ? profileMap.get(log.user_id) : null;
      if (userName?.toLowerCase().includes(searchLower)) return true;
      
      // Search in data (IMEI, code, product name, etc.)
      const data = log.new_data || log.old_data;
      if (data) {
        const dataStr = JSON.stringify(data).toLowerCase();
        if (dataStr.includes(searchLower)) return true;
      }
      
      return false;
    });
  }, [logs, filters.search, profileMap]);

  return (
    <MainLayout>
      <PageHeader 
        title="Lịch sử thao tác" 
        description={permissions?.role === 'super_admin' 
          ? "Theo dõi toàn bộ thao tác trong hệ thống"
          : "Theo dõi thao tác của chi nhánh"
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        {/* Filters */}
        <AuditLogFiltersComponent 
          filters={filters} 
          onFiltersChange={setFilters} 
        />

        {/* Table */}
        <AuditLogTable
          logs={filteredLogs}
          isLoading={isLoading}
          profileMap={profileMap}
          roleMap={roleMap}
          branchMap={branchMap}
        />
      </div>
    </MainLayout>
  );
}
