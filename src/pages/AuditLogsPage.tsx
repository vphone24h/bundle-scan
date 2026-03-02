import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AuditLogFiltersComponent } from '@/components/audit/AuditLogFilters';
import { AuditLogTable } from '@/components/audit/AuditLogTable';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { useAuditLogs, AuditLogFilters, useAuditLogUsers } from '@/hooks/useAuditLogs';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranches } from '@/hooks/useBranches';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ShieldCheck, ChevronDown, ChevronUp, Eye, History, AlertTriangle, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const defaultFilters: AuditLogFilters = {
  search: '',
  actionTypes: [],
  actionGroup: 'all',
  branchId: 'all',
  userIds: [],
  timeFilter: 'all',
};

export default function AuditLogsPage() {
  const { t } = useTranslation();
  const { data: permissions } = usePermissions();
  const { data: branches } = useBranches();
  const { data: users } = useAuditLogUsers();
  const [filters, setFilters] = useState<AuditLogFilters>(defaultFilters);
  const [isFeatureDescOpen, setIsFeatureDescOpen] = useState(false);

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
      // Search by audit log ID (mã thao tác)
      if (log.id.toLowerCase().includes(searchLower)) return true;
      if (log.id.slice(0, 8).toUpperCase().includes(filters.search.toUpperCase())) return true;

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

  // Pagination
  const pagination = usePagination(filteredLogs, { 
    storageKey: 'audit-logs'
  });

  return (
    <MainLayout>
      <PageHeader 
        title={t('pages.auditLogs.title')}
        helpText={t('pages.auditLogs.helpText')}
        description={permissions?.role === 'super_admin'
          ? t('pages.auditLogs.description')
          : t('pages.auditLogs.descriptionBranch')
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        {/* Feature Description */}
        <Collapsible open={isFeatureDescOpen} onOpenChange={setIsFeatureDescOpen}>
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <span>Mục đích tính năng: Chống thất thoát & Giám sát nhân sự</span>
                  </div>
                  {isFeatureDescOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                    <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                      <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Giám sát minh bạch</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ghi lại mọi thao tác: nhập hàng, xuất hàng, sửa số lượng, thu chi...
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                    <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900">
                      <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Phát hiện bất thường</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Đánh dấu đỏ các thao tác nhạy cảm: xóa phiếu, sửa sổ quỹ, điều chỉnh tồn kho
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                    <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                      <History className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Truy vết chi tiết</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        So sánh "Trước vs Sau" mỗi thay đổi - ai sửa gì, lúc nào, giá trị cũ/mới
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                    <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
                      <UserCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Quy trách nhiệm</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Mỗi thao tác gắn với nhân viên cụ thể - không thể phủ nhận hoặc xóa log
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    <strong>💡 Lưu ý:</strong> Lịch sử thao tác không thể bị xóa hoặc chỉnh sửa. 
                    Mọi hành động đều được lưu vĩnh viễn để đảm bảo tính minh bạch và ngăn ngừa gian lận.
                  </p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Filters */}
        <AuditLogFiltersComponent 
          filters={filters} 
          onFiltersChange={setFilters} 
        />

        {/* Table */}
        <AuditLogTable
          logs={pagination.paginatedData}
          isLoading={isLoading}
          profileMap={profileMap}
          roleMap={roleMap}
          branchMap={branchMap}
        />
        
        {filteredLogs.length > 0 && (
          <TablePagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        )}
      </div>
    </MainLayout>
  );
}
