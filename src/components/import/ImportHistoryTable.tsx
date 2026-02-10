import { ImportReceipt } from '@/types/warehouse';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, Pencil, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

interface ImportHistoryTableProps {
  receipts: ImportReceipt[];
  onView: (receipt: ImportReceipt) => void;
  onEdit: (receipt: ImportReceipt) => void;
  onReturn: (receipt: ImportReceipt) => void;
}

export function ImportHistoryTable({
  receipts,
  onView,
  onEdit,
  onReturn,
}: ImportHistoryTableProps) {
  const { data: permissions } = usePermissions();
  const canViewImportPrice = permissions?.canViewImportPrice ?? false;

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Mã phiếu</th>
            <th>Ngày nhập</th>
            <th className="text-center">Số lượng SP</th>
            {canViewImportPrice && <th className="text-right">Tổng tiền</th>}
            {canViewImportPrice && <th className="text-right">Đã thanh toán</th>}
            {canViewImportPrice && <th className="text-right">Còn nợ</th>}
            <th>Nhà cung cấp</th>
            <th>Người tạo</th>
            <th>Trạng thái</th>
            <th className="w-16"></th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt) => (
            <tr key={receipt.id}>
              <td className="font-mono font-medium text-primary">{receipt.code}</td>
              <td>{formatDate(receipt.importDate)}</td>
              <td className="text-center">{receipt.items.length}</td>
              {canViewImportPrice && <td className="text-right font-medium">{formatCurrency(receipt.totalAmount)}</td>}
              {canViewImportPrice && <td className="text-right text-success">{formatCurrency(receipt.paidAmount)}</td>}
              {canViewImportPrice && (
                <td className="text-right">
                  {receipt.debtAmount > 0 ? (
                    <span className="text-destructive font-medium">
                      {formatCurrency(receipt.debtAmount)}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
              )}
              <td>{receipt.supplierName}</td>
              <td>{receipt.createdBy}</td>
              <td>
                <Badge
                  className={cn(
                    receipt.status === 'completed'
                      ? 'status-in-stock'
                      : 'bg-destructive/10 text-destructive border-destructive/20'
                  )}
                >
                  {receipt.status === 'completed' ? 'Hoàn tất' : 'Đã huỷ'}
                </Badge>
              </td>
              <td>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover">
                    <DropdownMenuItem onClick={() => onView(receipt)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Xem chi tiết
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(receipt)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Chỉnh sửa
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onReturn(receipt)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Trả hàng
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {receipts.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          Chưa có phiếu nhập nào
        </div>
      )}
    </div>
  );
}
