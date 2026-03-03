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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const { data: permissions } = usePermissions();
  const canViewImportPrice = permissions?.canViewImportPrice ?? false;

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t('importHistory.receiptCode')}</th>
            <th>{t('importHistory.importDate')}</th>
            <th className="text-center">{t('importHistory.productCount')}</th>
            {canViewImportPrice && <th className="text-right">{t('importHistory.totalAmount')}</th>}
            {canViewImportPrice && <th className="text-right">{t('importHistory.paidAmount')}</th>}
            {canViewImportPrice && <th className="text-right">{t('importHistory.debtAmount')}</th>}
            <th>{t('importHistory.supplier')}</th>
            <th>{t('importHistory.createdBy')}</th>
            <th>{t('importHistory.status')}</th>
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
                  {receipt.status === 'completed' ? t('importHistory.completed') : t('importHistory.cancelled')}
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
                      {t('importHistory.viewDetail')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(receipt)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      {t('importHistory.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onReturn(receipt)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {t('importHistory.returnGoods')}
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
          {t('importHistory.noReceipts')}
        </div>
      )}
    </div>
  );
}
