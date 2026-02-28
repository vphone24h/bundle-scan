import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { HardDriveDownload, Loader2, Package, FileDown, FileUp, Users, Truck, Wallet, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { exportToExcel, formatDateForExcel } from '@/lib/exportExcel';

type BackupTable = 'products' | 'import_receipts' | 'export_receipts' | 'customers' | 'suppliers' | 'cash_book';

interface BackupOption {
  key: BackupTable;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const BACKUP_OPTIONS: BackupOption[] = [
  {
    key: 'products',
    label: 'Sản phẩm & Tồn kho',
    icon: <Package className="h-4 w-4" />,
    description: 'Toàn bộ sản phẩm, IMEI, giá nhập, trạng thái',
  },
  {
    key: 'import_receipts',
    label: 'Phiếu nhập hàng',
    icon: <FileDown className="h-4 w-4" />,
    description: 'Lịch sử nhập hàng và chi tiết từng phiếu',
  },
  {
    key: 'export_receipts',
    label: 'Phiếu xuất hàng',
    icon: <FileUp className="h-4 w-4" />,
    description: 'Lịch sử bán hàng và chi tiết từng phiếu',
  },
  {
    key: 'customers',
    label: 'Khách hàng',
    icon: <Users className="h-4 w-4" />,
    description: 'Danh sách khách hàng, SĐT, địa chỉ, công nợ',
  },
  {
    key: 'suppliers',
    label: 'Nhà cung cấp',
    icon: <Truck className="h-4 w-4" />,
    description: 'Danh sách nhà cung cấp và thông tin liên hệ',
  },
  {
    key: 'cash_book',
    label: 'Sổ quỹ',
    icon: <Wallet className="h-4 w-4" />,
    description: 'Toàn bộ thu chi, giao dịch tài chính',
  },
];

export function DataBackupSection() {
  const { data: tenant } = useCurrentTenant();
  const [selected, setSelected] = useState<Set<BackupTable>>(new Set(BACKUP_OPTIONS.map(o => o.key)));
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingSQL, setIsExportingSQL] = useState(false);

  const toggleOption = (key: BackupTable) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(BACKUP_OPTIONS.map(o => o.key)));
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  const handleExport = async () => {
    if (!tenant?.id) {
      toast.error('Không tìm thấy thông tin cửa hàng');
      return;
    }
    if (selected.size === 0) {
      toast.error('Vui lòng chọn ít nhất một loại dữ liệu');
      return;
    }

    setIsExporting(true);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let exportCount = 0;

    try {
      // Products
      if (selected.has('products')) {
        const { data, error } = await supabase
          .from('products')
          .select('*, categories(name), branches(name)')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (data && data.length > 0) {
          exportToExcel({
            filename: `SaoLuu_SanPham_${dateStr}`,
            sheetName: 'Sản phẩm',
            columns: [
              { header: 'Tên sản phẩm', key: 'name', width: 30 },
              { header: 'SKU', key: 'sku', width: 15 },
              { header: 'IMEI', key: 'imei', width: 20 },
              { header: 'Danh mục', key: 'category_name', width: 15 },
              { header: 'Chi nhánh', key: 'branch_name', width: 15 },
              { header: 'Giá nhập', key: 'import_price', width: 15, isNumeric: true },
              { header: 'Giá bán', key: 'sale_price', width: 15, isNumeric: true },
              { header: 'Số lượng', key: 'quantity', width: 10, isNumeric: true },
              { header: 'Trạng thái', key: 'status_label', width: 12 },
              { header: 'Bảo hành', key: 'warranty', width: 12 },
              { header: 'NCC', key: 'supplier_name', width: 20 },
              { header: 'Ghi chú', key: 'note', width: 25 },
              { header: 'Ngày tạo', key: 'created_date', width: 15 },
            ],
            data: data.map(p => ({
              ...p,
              category_name: p.categories?.name || '',
              branch_name: p.branches?.name || '',
              status_label: p.status === 'in_stock' ? 'Tồn kho' : p.status === 'sold' ? 'Đã bán' : p.status,
              created_date: formatDateForExcel(p.created_at),
            })),
          });
          exportCount++;
        }
      }

      // Import receipts
      if (selected.has('import_receipts')) {
        const { data, error } = await supabase
          .from('import_receipts')
          .select('*, suppliers(name), branches(name)')
          .eq('tenant_id', tenant.id)
          .order('import_date', { ascending: false });

        if (error) throw error;
        if (data && data.length > 0) {
          exportToExcel({
            filename: `SaoLuu_PhieuNhap_${dateStr}`,
            sheetName: 'Phiếu nhập',
            columns: [
              { header: 'Mã phiếu', key: 'code', width: 20 },
              { header: 'NCC', key: 'supplier_name', width: 20 },
              { header: 'Chi nhánh', key: 'branch_name', width: 15 },
              { header: 'Tổng tiền', key: 'total_amount', width: 15, isNumeric: true },
              { header: 'Đã thanh toán', key: 'paid_amount', width: 15, isNumeric: true },
              { header: 'Còn nợ', key: 'debt_amount', width: 15, isNumeric: true },
              { header: 'Ngày nhập', key: 'import_date_fmt', width: 15 },
              { header: 'Ghi chú', key: 'note', width: 25 },
            ],
            data: data.map(r => ({
              ...r,
              supplier_name: r.suppliers?.name || '',
              branch_name: r.branches?.name || '',
              debt_amount: Number(r.total_amount || 0) - Number(r.paid_amount || 0),
              import_date_fmt: formatDateForExcel(r.import_date),
            })),
          });
          exportCount++;
        }
      }

      // Export receipts
      if (selected.has('export_receipts')) {
        const { data, error } = await supabase
          .from('export_receipts')
          .select('*, customers(name, phone), branches(name)')
          .eq('tenant_id', tenant.id)
          .order('export_date', { ascending: false });

        if (error) throw error;
        if (data && data.length > 0) {
          exportToExcel({
            filename: `SaoLuu_PhieuXuat_${dateStr}`,
            sheetName: 'Phiếu xuất',
            columns: [
              { header: 'Mã phiếu', key: 'code', width: 20 },
              { header: 'Khách hàng', key: 'customer_name', width: 20 },
              { header: 'SĐT khách', key: 'customer_phone', width: 15 },
              { header: 'Chi nhánh', key: 'branch_name', width: 15 },
              { header: 'Tổng tiền', key: 'total_amount', width: 15, isNumeric: true },
              { header: 'Đã thanh toán', key: 'paid_amount', width: 15, isNumeric: true },
              { header: 'Trạng thái', key: 'status_label', width: 12 },
              { header: 'Ngày xuất', key: 'export_date_fmt', width: 15 },
              { header: 'Ghi chú', key: 'note', width: 25 },
            ],
            data: data.map(r => ({
              ...r,
              customer_name: r.customers?.name || '',
              customer_phone: r.customers?.phone || '',
              branch_name: r.branches?.name || '',
              status_label: r.status === 'completed' ? 'Hoàn thành' : r.status === 'full_return' ? 'Trả hàng' : r.status,
              export_date_fmt: formatDateForExcel(r.export_date),
            })),
          });
          exportCount++;
        }
      }

      // Customers
      if (selected.has('customers')) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (data && data.length > 0) {
          exportToExcel({
            filename: `SaoLuu_KhachHang_${dateStr}`,
            sheetName: 'Khách hàng',
            columns: [
              { header: 'Tên khách hàng', key: 'name', width: 25 },
              { header: 'SĐT', key: 'phone', width: 15 },
              { header: 'Email', key: 'email', width: 25 },
              { header: 'Địa chỉ', key: 'address', width: 30 },
              { header: 'Tổng chi tiêu', key: 'total_spent', width: 15, isNumeric: true },
              { header: 'Điểm tích lũy', key: 'current_points', width: 12, isNumeric: true },
              { header: 'Hạng thành viên', key: 'tier_label', width: 15 },
              { header: 'Nguồn', key: 'source', width: 12 },
              { header: 'Ghi chú', key: 'note', width: 25 },
              { header: 'Ngày tạo', key: 'created_date', width: 15 },
            ],
            data: data.map(c => ({
              ...c,
              tier_label: c.membership_tier === 'regular' ? 'Tiêu chuẩn' : c.membership_tier === 'silver' ? 'Bạc' : c.membership_tier === 'gold' ? 'Vàng' : c.membership_tier === 'vip' ? 'VIP' : c.membership_tier,
              created_date: formatDateForExcel(c.created_at),
            })),
          });
          exportCount++;
        }
      }

      // Suppliers
      if (selected.has('suppliers')) {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (data && data.length > 0) {
          exportToExcel({
            filename: `SaoLuu_NhaCungCap_${dateStr}`,
            sheetName: 'Nhà cung cấp',
            columns: [
              { header: 'Tên NCC', key: 'name', width: 25 },
              { header: 'SĐT', key: 'phone', width: 15 },
              { header: 'Email', key: 'email', width: 25 },
              { header: 'Địa chỉ', key: 'address', width: 30 },
              { header: 'Mã số thuế', key: 'tax_code', width: 15 },
              { header: 'Công nợ', key: 'debt_amount', width: 15, isNumeric: true },
              { header: 'Ghi chú', key: 'note', width: 25 },
              { header: 'Ngày tạo', key: 'created_date', width: 15 },
            ],
            data: data.map(s => ({
              ...s,
              created_date: formatDateForExcel(s.created_at),
            })),
          });
          exportCount++;
        }
      }

      // Cash book
      if (selected.has('cash_book')) {
        const { data, error } = await supabase
          .from('cash_book')
          .select('*, branches(name)')
          .eq('tenant_id', tenant.id)
          .order('transaction_date', { ascending: false });

        if (error) throw error;
        if (data && data.length > 0) {
          exportToExcel({
            filename: `SaoLuu_SoQuy_${dateStr}`,
            sheetName: 'Sổ quỹ',
            columns: [
              { header: 'Ngày', key: 'transaction_date_fmt', width: 15 },
              { header: 'Loại', key: 'type_label', width: 10 },
              { header: 'Danh mục', key: 'category', width: 15 },
              { header: 'Mô tả', key: 'description', width: 30 },
              { header: 'Số tiền', key: 'amount', width: 15, isNumeric: true },
              { header: 'Nguồn tiền', key: 'payment_source_label', width: 12 },
              { header: 'Chi nhánh', key: 'branch_name', width: 15 },
              { header: 'Ghi chú', key: 'note', width: 25 },
            ],
            data: data.map(cb => ({
              ...cb,
              transaction_date_fmt: formatDateForExcel(cb.transaction_date),
              type_label: cb.type === 'income' ? 'Thu' : 'Chi',
              payment_source_label: cb.payment_source === 'cash' ? 'Tiền mặt' : cb.payment_source === 'bank' ? 'Chuyển khoản' : cb.payment_source,
              branch_name: cb.branches?.name || '',
            })),
          });
          exportCount++;
        }
      }

      if (exportCount === 0) {
        toast.info('Không có dữ liệu để sao lưu');
      } else {
        toast.success(`Đã tải ${exportCount} file sao lưu thành công`);
      }
    } catch (error) {
      console.error('Backup export error:', error);
      toast.error('Lỗi khi xuất dữ liệu: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSQL = async () => {
    if (!tenant?.id) {
      toast.error('Không tìm thấy thông tin cửa hàng');
      return;
    }

    setIsExportingSQL(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-tenant-data');

      if (error) throw error;
      if (!data) throw new Error('Không có dữ liệu trả về');

      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `database_export_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const totalRows = data._metadata?.total_rows || 0;
      const totalTables = data._metadata?.total_tables || 0;
      toast.success(`Đã xuất ${totalRows.toLocaleString()} bản ghi từ ${totalTables} bảng`);
    } catch (error) {
      console.error('SQL export error:', error);
      toast.error('Lỗi khi xuất dữ liệu: ' + (error as Error).message);
    } finally {
      setIsExportingSQL(false);
    }
  };

  const allSelected = selected.size === BACKUP_OPTIONS.length;

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700">
          <HardDriveDownload className="h-5 w-5" />
          Sao lưu dữ liệu
        </CardTitle>
        <CardDescription>
          Tải về bản sao lưu dữ liệu dưới dạng Excel để lưu trữ an toàn trên máy tính của bạn.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Chọn dữ liệu cần sao lưu:</p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={allSelected ? deselectAll : selectAll}
          >
            {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {BACKUP_OPTIONS.map(option => (
            <label
              key={option.key}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selected.has(option.key)
                  ? 'border-blue-300 bg-blue-100/50'
                  : 'border-border bg-background hover:bg-muted/50'
              }`}
            >
              <Checkbox
                checked={selected.has(option.key)}
                onCheckedChange={() => toggleOption(option.key)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {option.icon}
                  <span className="text-sm font-medium">{option.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
              </div>
            </label>
          ))}
        </div>

        <Button
          onClick={handleExport}
          disabled={isExporting || selected.size === 0}
          className="w-full"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Đang xuất dữ liệu...
            </>
          ) : (
            <>
              <HardDriveDownload className="h-4 w-4 mr-2" />
              Tải sao lưu ({selected.size} loại dữ liệu)
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          💡 Khuyến nghị: Sao lưu dữ liệu định kỳ hàng tuần để đảm bảo an toàn
        </p>

        {/* Full Database Export Section */}
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <Database className="h-4 w-4" />
            Xuất toàn bộ Database (JSON)
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            Xuất tất cả dữ liệu của cửa hàng thành 1 file JSON duy nhất, có thể import vào Supabase hoặc hệ thống khác.
          </p>
          <Button
            onClick={handleExportSQL}
            disabled={isExportingSQL}
            variant="outline"
            className="w-full"
          >
            {isExportingSQL ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang xuất toàn bộ dữ liệu...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Tải file JSON toàn bộ Database
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
