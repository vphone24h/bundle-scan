import { useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Clock, User, Eye, Building2, ArrowRight, Copy } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AuditLog, ACTION_LABELS, TABLE_LABELS, ACTION_GROUPS, ActionGroup } from '@/types/auditLog';
import { usePermissions } from '@/hooks/usePermissions';
import { AuditLogDetailDialog } from './AuditLogDetailDialog';
import { History } from 'lucide-react';
import { toast } from 'sonner';

interface AuditLogTableProps {
  logs: AuditLog[];
  isLoading: boolean;
  profileMap: Map<string, string>;
  roleMap: Map<string, string>;
  branchMap: Map<string, string>;
}

// Helper to determine action group from table name
function getActionGroup(tableName: string | null): ActionGroup {
  if (!tableName) return 'system';
  for (const [group, config] of Object.entries(ACTION_GROUPS)) {
    if (group !== 'all' && config.tables.includes(tableName)) {
      return group as ActionGroup;
    }
  }
  return 'system';
}

// Helper to get display target from log data
function getTargetDisplay(log: AuditLog): string {
  const data = log.new_data || log.old_data;
  if (!data) return '-';

  // Try common identifier fields
  if (data.imei) return `IMEI: ${data.imei}`;
  if (data.code) return `Mã: ${data.code}`;
  if (data.name) return String(data.name);
  if (data.sku) return `SKU: ${data.sku}`;
  if (data.product_name) return String(data.product_name);
  if (data.display_name) return String(data.display_name);
  
  return log.record_id ? `ID: ${log.record_id.slice(0, 8)}...` : '-';
}

// Helper to get change summary
function getChangeSummary(log: AuditLog): { field: string; from: string; to: string } | null {
  if (log.action_type !== 'update' || !log.old_data || !log.new_data) return null;
  
  const oldData = log.old_data as Record<string, unknown>;
  const newData = log.new_data as Record<string, unknown>;
  
  // Find first changed field (prioritize important ones)
  const priorityFields = ['import_price', 'sale_price', 'status', 'amount', 'name', 'user_role'];
  
  for (const field of priorityFields) {
    if (oldData[field] !== undefined && newData[field] !== undefined && oldData[field] !== newData[field]) {
      return {
        field,
        from: formatValue(oldData[field]),
        to: formatValue(newData[field]),
      };
    }
  }
  
  // Check other fields
  for (const key of Object.keys(newData)) {
    if (oldData[key] !== newData[key] && key !== 'updated_at' && key !== 'created_at') {
      return {
        field: key,
        from: formatValue(oldData[key]),
        to: formatValue(newData[key]),
      };
    }
  }
  
  return null;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'number') {
    return value.toLocaleString('vi-VN');
  }
  return String(value);
}

const ACTION_GROUP_LABELS: Record<ActionGroup, { label: string; color: string }> = {
  all: { label: 'Khác', color: 'bg-gray-500' },
  cashbook: { label: 'Sổ quỹ', color: 'bg-amber-500' },
  import: { label: 'Nhập hàng', color: 'bg-emerald-500' },
  export: { label: 'Xuất hàng', color: 'bg-blue-500' },
  debt: { label: 'Công nợ', color: 'bg-orange-500' },
  stock_count: { label: 'Kiểm kho', color: 'bg-cyan-500' },
  system: { label: 'Hệ thống', color: 'bg-purple-500' },
};

export function AuditLogTable({ logs, isLoading, profileMap, roleMap, branchMap }: AuditLogTableProps) {
  const { data: permissions } = usePermissions();
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Đang tải...</div>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Không có lịch sử thao tác nào phù hợp với bộ lọc
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <History className="h-4 w-4 sm:h-5 sm:w-5" />
            Danh sách thao tác ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead className="whitespace-nowrap min-w-[80px]">Mã TT</TableHead>
                   <TableHead className="whitespace-nowrap min-w-[120px]">Thời gian</TableHead>
                   <TableHead className="whitespace-nowrap hidden sm:table-cell min-w-[140px]">Nhân viên</TableHead>
                   <TableHead className="whitespace-nowrap hidden lg:table-cell">Chi nhánh</TableHead>
                   <TableHead className="whitespace-nowrap hidden md:table-cell">Nhóm</TableHead>
                   <TableHead className="whitespace-nowrap">Hành động</TableHead>
                   <TableHead className="whitespace-nowrap hidden lg:table-cell">Đối tượng</TableHead>
                   <TableHead className="whitespace-nowrap hidden xl:table-cell">Chi tiết</TableHead>
                   <TableHead className="w-[60px]"></TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const actionInfo = ACTION_LABELS[log.action_type] || { label: log.action_type, color: 'bg-gray-500' };
                  const isCritical = actionInfo.critical === true;
                  const actionGroup = getActionGroup(log.table_name);
                  const groupInfo = ACTION_GROUP_LABELS[actionGroup];
                  const changeSummary = getChangeSummary(log);
                  const userRole = log.user_id ? roleMap.get(log.user_id) : null;

                  return (
                    <TableRow 
                      key={log.id} 
                      className={`group cursor-pointer transition-colors ${
                        isCritical 
                          ? 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedLog(log)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[10px] sm:text-xs text-muted-foreground">
                            #{log.id.slice(0, 8).toUpperCase()}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(log.id);
                              toast.success('Đã sao chép mã thao tác');
                            }}
                            className="p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs sm:text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground hidden sm:block" />
                          <span className={isCritical ? 'font-medium text-red-700 dark:text-red-400' : ''}>
                            {format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: vi })}
                          </span>
                        </div>
                        {/* Mobile: Show user below time */}
                        <div className="sm:hidden text-xs text-muted-foreground mt-1">
                          {log.user_id ? profileMap.get(log.user_id) || 'N/A' : 'Hệ thống'}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className={`text-sm font-medium ${isCritical ? 'text-red-700 dark:text-red-400' : ''}`}>
                              {log.user_id ? profileMap.get(log.user_id) || 'N/A' : 'Hệ thống'}
                            </span>
                          </div>
                          {userRole && (
                            <span className="text-xs text-muted-foreground ml-4">
                              {userRole === 'super_admin' ? 'Admin tổng' : 
                               userRole === 'branch_admin' ? 'Quản lý CN' : 
                               userRole === 'cashier' ? 'Kế toán' : 'Nhân viên'}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {log.branch_id ? branchMap.get(log.branch_id) || 'N/A' : 'Toàn HT'}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className={`${groupInfo.color} text-white text-xs`}>
                          {groupInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge className={`${actionInfo.color} text-white text-xs w-fit ${
                            isCritical ? 'ring-2 ring-red-300 dark:ring-red-700 animate-pulse' : ''
                          }`}>
                            {isCritical && '⚠️ '}{actionInfo.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground line-clamp-2">
                            {(() => {
                              const desc = log.description || (log.table_name ? TABLE_LABELS[log.table_name] || log.table_name : '-');
                              // For transfer actions, only show the header part (before product details)
                              if (['TRANSFER_STOCK', 'RECEIVE_STOCK', 'APPROVE_TRANSFER', 'REJECT_TRANSFER'].includes(log.action_type)) {
                                const match = desc.match(/^(.+?:\s*\d+\s*SP[^:]+):/);
                                return match ? match[1] : desc;
                              }
                              return desc;
                            })()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm">{getTargetDisplay(log)}</span>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell max-w-[200px]">
                        {changeSummary ? (
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-muted-foreground line-through">{changeSummary.from}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{changeSummary.to}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {log.description || '-'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <AuditLogDetailDialog
        log={selectedLog}
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
        profileMap={profileMap}
        roleMap={roleMap}
        branchMap={branchMap}
      />
    </>
  );
}
