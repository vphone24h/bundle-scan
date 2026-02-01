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
  category_id: 'Danh mục',
  type: 'Loại',
  payment_source: 'Nguồn tiền',
  user_role: 'Vai trò',
  display_name: 'Tên hiển thị',
  phone: 'Số điện thoại',
  address: 'Địa chỉ',
  email: 'Email',
  product_name: 'Tên sản phẩm',
  customer_id: 'ID Khách hàng',
  supplier_id: 'Nhà cung cấp',
  branch_id: 'Chi nhánh',
  created_at: 'Ngày tạo',
  updated_at: 'Ngày cập nhật',
  import_date: 'Ngày nhập',
  export_date: 'Ngày xuất',
  is_business_accounting: 'Hạch toán KD',
  transaction_date: 'Ngày giao dịch',
  balance_before: 'Số dư trước xóa',
  balance_after: 'Số dư sau xóa',
  warranty: 'Bảo hành',
  quantity: 'Số lượng',
  old_quantity: 'SL cũ',
  new_quantity: 'SL mới',
  adjusted_quantity: 'SL điều chỉnh',
  reason: 'Lý do',
  supplier_name: 'Nhà cung cấp',
  product_id: 'ID Sản phẩm',
  tenant_id: 'ID Cửa hàng',
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

  // Check if this is an update-type action
  const isUpdateAction = ['update', 'UPDATE', 'ADJUST_QUANTITY', 'RESTORE_PRODUCT_METADATA'].includes(log.action_type);
  const isCreateAction = ['create', 'CREATE'].includes(log.action_type);
  const isDeleteAction = ['delete', 'DELETE'].includes(log.action_type);

  // Get changes for update action
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  if (isUpdateAction && log.old_data && log.new_data) {
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
    
    // Also check old_data keys that might not be in new_data
    for (const key of Object.keys(oldData)) {
      if (!(key in newData) && key !== 'updated_at' && key !== 'created_at') {
        const alreadyAdded = changes.find(c => c.field === key);
        if (!alreadyAdded) {
          changes.push({
            field: key,
            oldValue: oldData[key],
            newValue: newData[key],
          });
        }
      }
    }
  }

  // Extract product info from old_data or new_data for product-related actions
  const getProductInfo = () => {
    // Check both old_data and new_data
    const newData = log.new_data as Record<string, unknown> | null;
    const oldData = log.old_data as Record<string, unknown> | null;
    
    // Try to extract from new_data first, then fall back to old_data
    const data = newData || oldData;
    if (!data) return null;
    
    // Common product identifier fields - check multiple possible field names
    const productName = data.name || data.product_name || oldData?.name || oldData?.product_name;
    const sku = data.sku || oldData?.sku;
    const imei = data.imei || oldData?.imei;
    
    if (productName || sku || imei) {
      return { productName, sku, imei };
    }
    return null;
  };

  // Check if name/imei/sku were changed (if so, show them in changes section instead of product info)
  const hasNameOrImeiChange = changes.some(c => ['name', 'imei', 'sku'].includes(c.field));

  // Show product info for product-related tables AND actions
  const isProductRelated = log.table_name === 'products' || 
    ['ADJUST_QUANTITY', 'RESTORE_PRODUCT_METADATA', 'DELETE_PRODUCT'].includes(log.action_type);
  
  // Only show product info header if name/imei didn't change (to avoid confusion)
  const productInfo = isProductRelated && !hasNameOrImeiChange ? getProductInfo() : null;

  // Get action description based on action type
  const getActionDescription = () => {
    switch (log.action_type) {
      case 'ADJUST_QUANTITY':
        return 'Điều chỉnh số lượng sản phẩm trong kho';
      case 'RESTORE_PRODUCT_METADATA':
        return 'Phục hồi thông tin nhà cung cấp và ghi chú từ file Excel';
      case 'UPDATE':
      case 'update':
        return 'Cập nhật thông tin';
      default:
        return log.description;
    }
  };

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
            <div className="p-3 bg-muted/30 rounded-lg">
              <span className="font-medium text-sm">Mô tả: </span>
              <span className="text-sm">{getActionDescription()}</span>
            </div>

            {/* Product Info - Show which product was affected */}
            {productInfo && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2 text-primary">
                  <FileText className="h-4 w-4" />
                  Sản phẩm được thao tác
                </h4>
                <div className="space-y-1 text-sm">
                  {productInfo.productName && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[60px]">Tên:</span>
                      <span className="font-medium">{String(productInfo.productName)}</span>
                    </div>
                  )}
                  {productInfo.sku && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[60px]">SKU:</span>
                      <span className="font-mono text-xs bg-muted px-1 rounded">{String(productInfo.sku)}</span>
                    </div>
                  )}
                  {productInfo.imei && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[60px]">IMEI:</span>
                      <span className="font-mono text-xs bg-muted px-1 rounded">{String(productInfo.imei)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Changes for update-type actions */}
            {isUpdateAction && changes.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Chi tiết thay đổi (Trước → Sau)
                  </h4>
                  <div className="space-y-2">
                    {changes.map(({ field, oldValue, newValue }) => (
                      <div key={field} className="p-3 bg-muted/30 rounded border-l-4 border-amber-500">
                        <div className="font-medium text-sm mb-2">
                          {FIELD_LABELS[field] || field}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                          <div className="flex-1 p-2 bg-red-500/10 rounded">
                            <span className="text-xs text-muted-foreground block mb-1">Trước:</span>
                            <span className="line-through text-muted-foreground">
                              {formatFieldValue(field, oldValue)}
                            </span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                          <div className="flex-1 p-2 bg-green-500/10 rounded">
                            <span className="text-xs text-muted-foreground block mb-1">Sau:</span>
                            <span className="font-medium text-foreground">
                              {formatFieldValue(field, newValue)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Show data snapshot if no changes detected but has data */}
            {isUpdateAction && changes.length === 0 && (log.new_data || log.old_data) && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm mb-3">Dữ liệu sau thao tác</h4>
                  <div className="space-y-1">
                    {Object.entries((log.new_data || log.old_data) as Record<string, unknown>)
                      .filter(([key]) => !['created_at', 'updated_at', 'id', 'tenant_id'].includes(key))
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

            {/* New data for create */}
            {isCreateAction && log.new_data && (
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
            {isDeleteAction && log.old_data && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm mb-3 text-destructive">Dữ liệu đã xóa</h4>
                  
                  {/* Hiển thị số dư nguồn tiền nếu là xóa sổ quỹ */}
                  {log.table_name === 'cash_book' && (log.old_data as Record<string, unknown>).balance_before !== undefined && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <h5 className="font-medium text-sm mb-2 text-destructive">Biến động số dư nguồn tiền</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-2 bg-background rounded">
                          <div className="text-xs text-muted-foreground">Số dư trước xóa</div>
                          <div className="font-semibold text-lg">
                            {Number((log.old_data as Record<string, unknown>).balance_before || 0).toLocaleString('vi-VN')} đ
                          </div>
                        </div>
                        <div className="text-center p-2 bg-background rounded">
                          <div className="text-xs text-muted-foreground">Số dư sau xóa</div>
                          <div className="font-semibold text-lg">
                            {Number((log.old_data as Record<string, unknown>).balance_after || 0).toLocaleString('vi-VN')} đ
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-center text-sm">
                        <span className="text-muted-foreground">Nguồn tiền: </span>
                        <span className="font-medium">{(log.old_data as Record<string, unknown>).payment_source as string || 'N/A'}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    {Object.entries(log.old_data as Record<string, unknown>)
                      .filter(([key]) => !['created_at', 'updated_at', 'id', 'balance_before', 'balance_after'].includes(key))
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
