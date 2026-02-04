import { useState } from 'react';
import { Smartphone, FileText, Package, Wrench, Undo2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InventoryItem } from '@/hooks/useInventory';
import { WarrantyDetailDialog } from './WarrantyDetailDialog';
import { cn } from '@/lib/utils';
import { formatCurrencyWithSpaces } from '@/lib/formatNumber';

interface WarrantyTableProps {
  data: InventoryItem[];
  isLoading?: boolean;
}

export function WarrantyTable({ data, isLoading }: WarrantyTableProps) {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const handleViewDetail = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowDetailDialog(true);
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
        <Wrench className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium">Không có hàng bảo hành</h3>
        <p className="text-muted-foreground">
          Chưa có sản phẩm nào đang trong quá trình bảo hành
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] whitespace-nowrap">#</TableHead>
              <TableHead className="min-w-[200px]">Sản phẩm</TableHead>
              <TableHead className="whitespace-nowrap hidden md:table-cell">Chi nhánh</TableHead>
              <TableHead className="text-center whitespace-nowrap hidden sm:table-cell">Loại</TableHead>
              <TableHead className="text-center whitespace-nowrap">Số lượng BH</TableHead>
              <TableHead className="text-right whitespace-nowrap hidden md:table-cell">Giá nhập TB</TableHead>
              <TableHead className="text-right whitespace-nowrap">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={`${item.productName}-${item.sku}-${item.branchId}`}>
                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium line-clamp-2">{item.productName}</span>
                    <span className="text-xs text-muted-foreground">
                      SKU: {item.sku}
                    </span>
                    {item.categoryName && (
                      <Badge variant="outline" className="w-fit text-xs">
                        {item.categoryName}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground md:hidden">
                      {item.branchName || '-'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {item.branchName || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center hidden sm:table-cell">
                  {item.hasImei ? (
                    <Badge variant="secondary" className="gap-1">
                      <Smartphone className="h-3 w-3" />
                      IMEI
                    </Badge>
                  ) : (
                    <Badge variant="outline">Thường</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge className="bg-warning text-warning-foreground min-w-[40px]">
                    {item.stock}
                  </Badge>
                </TableCell>
                <TableCell className="text-right hidden md:table-cell font-medium">
                  {formatCurrencyWithSpaces(item.avgImportPrice)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetail(item)}
                    className="gap-1 text-xs sm:text-sm sm:gap-2"
                  >
                    {item.hasImei ? (
                      <>
                        <Smartphone className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Chi tiết</span>
                      </>
                    ) : (
                      <>
                        <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Chi tiết</span>
                      </>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Warranty Detail Dialog */}
      {selectedItem && (
        <WarrantyDetailDialog
          open={showDetailDialog}
          onOpenChange={setShowDetailDialog}
          item={selectedItem}
        />
      )}
    </>
  );
}
