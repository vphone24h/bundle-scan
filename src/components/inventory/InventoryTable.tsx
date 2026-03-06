import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone, FileText, Package } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InventoryItem } from '@/hooks/useInventory';
import { IMEIDetailDialog } from './IMEIDetailDialog';
import { NonIMEIDetailDialog } from './NonIMEIDetailDialog';
import { cn } from '@/lib/utils';
import { formatCurrencyWithSpaces } from '@/lib/formatNumber';
import { usePermissions } from '@/hooks/usePermissions';

interface InventoryTableProps {
  data: InventoryItem[];
  isLoading?: boolean;
}

export function InventoryTable({ data, isLoading }: InventoryTableProps) {
  const { t } = useTranslation();
  const { data: permissions } = usePermissions();
  const canViewImportPrice = permissions?.canViewImportPrice ?? false;
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showIMEIDialog, setShowIMEIDialog] = useState(false);
  const [showNonIMEIDialog, setShowNonIMEIDialog] = useState(false);

  const handleViewDetail = (item: InventoryItem) => {
    setSelectedItem(item);
    if (item.hasImei) setShowIMEIDialog(true);
    else setShowNonIMEIDialog(true);
  };

  const getStockBadgeClass = (stock: number) => {
    if (stock === 0) return 'bg-muted text-muted-foreground';
    if (stock === 1) return 'bg-destructive text-destructive-foreground';
    if (stock <= 2) return 'bg-orange-500 text-white';
    return 'bg-primary text-primary-foreground';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium">{t('tours.inventory.noInventoryData')}</h3>
        <p className="text-muted-foreground">{t('tours.inventory.noInventoryDataDesc')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card overflow-x-auto" data-tour="inventory-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] whitespace-nowrap">#</TableHead>
              <TableHead className="min-w-[200px]">{t('tours.inventory.productCol')}</TableHead>
              <TableHead className="whitespace-nowrap hidden md:table-cell">{t('tours.inventory.branchCol')}</TableHead>
              <TableHead className="text-center whitespace-nowrap hidden sm:table-cell">{t('tours.inventory.typeCol')}</TableHead>
              <TableHead className="text-center whitespace-nowrap hidden lg:table-cell">{t('tours.inventory.totalImportedCol')}</TableHead>
              <TableHead className="text-center whitespace-nowrap hidden lg:table-cell">{t('tours.inventory.soldCol')}</TableHead>
              <TableHead className="text-center whitespace-nowrap">{t('tours.inventory.stockCol')}</TableHead>
              {canViewImportPrice && <TableHead className="text-right whitespace-nowrap hidden md:table-cell">{t('tours.inventory.avgImportPriceCol')}</TableHead>}
              <TableHead className="text-right whitespace-nowrap">{t('tours.inventory.actionsCol')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={`${item.productName}-${item.sku}-${item.branchId}`}>
                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium line-clamp-2">{item.productName}</span>
                    <span className="text-xs text-muted-foreground">SKU: {item.sku}</span>
                    {item.categoryName && <Badge variant="outline" className="w-fit text-xs">{item.categoryName}</Badge>}
                    <span className="text-xs text-muted-foreground md:hidden">{item.branchName || '-'}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{item.branchName || <span className="text-muted-foreground">-</span>}</TableCell>
                <TableCell className="text-center hidden sm:table-cell">
                  {item.hasImei ? (
                    <Badge variant="secondary" className="gap-1"><Smartphone className="h-3 w-3" />IMEI</Badge>
                  ) : (
                    <Badge variant="outline">{t('tours.inventory.normalType')}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center hidden lg:table-cell"><Badge variant="outline">{item.totalImported}</Badge></TableCell>
                <TableCell className="text-center hidden lg:table-cell"><Badge variant="secondary">{item.totalSold}</Badge></TableCell>
                <TableCell className="text-center"><Badge className={cn('min-w-[40px]', getStockBadgeClass(item.stock))}>{item.stock}</Badge></TableCell>
                {canViewImportPrice && <TableCell className="text-right hidden md:table-cell font-medium">{formatCurrencyWithSpaces(item.avgImportPrice)}</TableCell>}
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => handleViewDetail(item)}
                    className="flex-col gap-0.5 h-auto py-1.5 px-2 sm:flex-row sm:gap-2 sm:py-2 sm:px-3 text-xs"
                    {...(index === 0 ? { 'data-tour': 'inventory-detail-btn' } : {})}
                  >
                    {item.hasImei ? (
                      <><Smartphone className="h-4 w-4" /><span className="text-[10px] sm:text-xs leading-none">IMEI</span></>
                    ) : (
                      <><FileText className="h-4 w-4" /><span className="text-[10px] sm:text-xs leading-none">{t('tours.inventory.detailBtn')}</span></>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedItem && <IMEIDetailDialog open={showIMEIDialog} onOpenChange={setShowIMEIDialog} productName={selectedItem.productName} sku={selectedItem.sku} branchId={selectedItem.branchId} />}
      {selectedItem && <NonIMEIDetailDialog open={showNonIMEIDialog} onOpenChange={setShowNonIMEIDialog} productId={selectedItem.productId} productName={selectedItem.productName} sku={selectedItem.sku} totalStock={selectedItem.stock} avgImportPrice={selectedItem.avgImportPrice} branchId={selectedItem.branchId} />}
    </>
  );
}