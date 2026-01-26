import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Clock, User, Building2, FileText, ArrowRight, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AuditLog, ACTION_LABELS, TABLE_LABELS } from '@/types/auditLog';

interface AuditLogDetailDialogProps {
  log: AuditLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileMap: Map<string, string>;
  roleMap: Map<string, string>;
  branchMap: Map<string, string>;
}

// Field labels for display
const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  name: 'Tên',
  sku: 'SKU',
  imei: 'IMEI',
  code: 'Mã',
  import_price: 'Giá nhập',
  sale_price: 'Giá bán',
  amount: 'Số tiền',
  total_amount: 'Tổng tiền',
  paid_amount: 'Đã thanh toán',
  debt_amount: 'Công nợ',
  status: 'Trạng thái',
  note: 'Ghi chú',
  description: 'Mô tả',
  category: 'Danh mục',
  type: 'Loại',
  payment_source: 'Nguồn tiền',
  user_role: 'Vai trò',
  display_name: 'Tên hiển thị',
  phone: 'Số điện thoại',
  address: 'Địa chỉ',
  email: 'Email',
  product_name: 'Tên sản phẩm',
  customer_id: 'ID Khách hàng',
  supplier_id: 'ID NCC',
  branch_id: 'ID Chi nhánh',
  created_at: 'Ngày tạo',
  updated_at: 'Ngày cập nhật',
  import_date: 'Ngày nhập',
  export_date: 'Ngày xuất',
  is_business_accounting: 'Hạch toán KD',
};

// Status translations
const STATUS_LABELS: Record<string, string> = {
  in_stock: 'Trong kho',
  sold: 'Đã bán',
  returned: 'Đã trả',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  income: 'Thu',
  expense: 'Chi',
};

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  
  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'Có' : 'Không';
  }
  
  // Handle status fields
  if (key === 'status' || key === 'type') {
    return STATUS_LABELS[String(value)] || String(value);
  }
  
  // Handle user role
  if (key === 'user_role') {
    const roles: Record<string, string> = {
      super_admin: 'Admin tổng',
      branch_admin: 'Quản lý chi nhánh',
      cashier: 'Thu ngân',
      staff: 'Nhân viên',
    };
    return roles[String(value)] || String(value);
  }
  
  // Handle money fields
  if (key.includes('price') || key.includes('amount')) {
    const num = Number(value);
    if (!isNaN(num)) {
      return num.toLocaleString('vi-VN') + ' đ';
    }
  }
  
  // Handle dates
  if (key.includes('_at') || key.includes('date')) {
    try {
      return format(new Date(String(value)), 'dd/MM/yyyy HH:mm', { locale: vi });
    } catch {
      return String(value);
    }
  }
  
  return String(value);
}

export function AuditLogDetailDialog({ 
  log, 
  open, 
  onOpenChange,
  profileMap,
  roleMap,
  branchMap,
}: AuditLogDetailDialogProps) {
  if (!log) return null;

  const actionInfo = ACTION_LABELS[log.action_type] || { label: log.action_type, color: 'bg-gray-500' };
  const userRole = log.user_id ? roleMap.get(log.user_id) : null;

  // Get changes for update action
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  if (log.action_type === 'update' && log.old_data && log.new_data) {
    const oldData = log.old_data as Record<string, unknown>;
    const newData = log.new_data as Record<string, unknown>;
    
    for (const key of Object.keys(newData)) {
      if (oldData[key] !== newData[key] && key !== 'updated_at') {
        changes.push({
          field: key,
          oldValue: oldData[key],
          newValue: newData[key],
        });
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Chi tiết thao tác
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Thời gian:</span>
                  <span>{format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Người thực hiện:</span>
                  <span>{log.user_id ? profileMap.get(log.user_id) || 'N/A' : 'Hệ thống'}</span>
                </div>
                {userRole && (
                  <div className="flex items-center gap-2 text-sm ml-6">
                    <span className="text-muted-foreground">Vai trò:</span>
                    <span>
                      {userRole === 'super_admin' ? 'Admin tổng' : 
                       userRole === 'branch_admin' ? 'Quản lý CN' : 
                       userRole === 'cashier' ? 'Thu ngân' : 'Nhân viên'}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Chi nhánh:</span>
                  <span>{log.branch_id ? branchMap.get(log.branch_id) || 'N/A' : 'Toàn hệ thống'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Hành động:</span>
                  <Badge className={`${actionInfo.color} text-white`}>
                    {actionInfo.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Bảng dữ liệu:</span>
                  <span>{log.table_name ? TABLE_LABELS[log.table_name] || log.table_name : '-'}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            {log.description && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <span className="font-medium text-sm">Mô tả: </span>
                <span className="text-sm">{log.description}</span>
              </div>
            )}

            {/* Changes for update */}
            {log.action_type === 'update' && changes.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Thay đổi
                  </h4>
                  <div className="space-y-2">
                    {changes.map(({ field, oldValue, newValue }) => (
                      <div key={field} className="flex items-center gap-2 text-sm p-2 bg-muted/30 rounded">
                        <span className="font-medium min-w-[120px]">
                          {FIELD_LABELS[field] || field}:
                        </span>
                        <span className="text-muted-foreground line-through">
                          {formatFieldValue(field, oldValue)}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {formatFieldValue(field, newValue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* New data for create */}
            {log.action_type === 'create' && log.new_data && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm mb-3">Dữ liệu tạo mới</h4>
                  <div className="space-y-1">
                    {Object.entries(log.new_data as Record<string, unknown>)
                      .filter(([key]) => !['created_at', 'updated_at', 'id'].includes(key))
                      .map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-sm">
                          <span className="font-medium min-w-[120px] text-muted-foreground">
                            {FIELD_LABELS[key] || key}:
                          </span>
                          <span>{formatFieldValue(key, value)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}

            {/* Old data for delete */}
            {log.action_type === 'delete' && log.old_data && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm mb-3 text-destructive">Dữ liệu đã xóa</h4>
                  <div className="space-y-1">
                    {Object.entries(log.old_data as Record<string, unknown>)
                      .filter(([key]) => !['created_at', 'updated_at', 'id'].includes(key))
                      .map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-sm">
                          <span className="font-medium min-w-[120px] text-muted-foreground">
                            {FIELD_LABELS[key] || key}:
                          </span>
                          <span className="text-muted-foreground">{formatFieldValue(key, value)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}

            {/* IP Address if available */}
            {log.ip_address && (
              <div className="text-xs text-muted-foreground pt-2">
                IP: {log.ip_address}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
