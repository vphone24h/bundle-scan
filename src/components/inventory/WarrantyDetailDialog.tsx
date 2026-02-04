import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Wrench, Undo2, Package, AlertTriangle, X, Banknote, CreditCard, Wallet, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InventoryItem, ProductDetail } from '@/hooks/useInventory';
import { useRestoreFromWarranty, useMarkDefectiveReturn } from '@/hooks/useWarrantyInventory';
import { formatCurrencyWithSpaces } from '@/lib/formatNumber';

// Built-in payment sources (same as CashBook)
const builtInPaymentSources = [
  { id: 'cash', name: 'Tiền mặt', icon: Banknote, color: 'text-green-600' },
  { id: 'bank_card', name: 'Thẻ ngân hàng', icon: CreditCard, color: 'text-blue-600' },
  { id: 'e_wallet', name: 'Ví điện tử', icon: Wallet, color: 'text-purple-600' },
];

// Load custom payment sources from localStorage (same as CashBook)
const getCustomPaymentSources = (): { id: string; name: string }[] => {
  try {
    const stored = localStorage.getItem('customPaymentSources');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

interface WarrantyDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem;
}

export function WarrantyDetailDialog({
  open,
  onOpenChange,
  item,
}: WarrantyDetailDialogProps) {
  const restoreFromWarranty = useRestoreFromWarranty();
  const markDefective = useMarkDefectiveReturn();
  
  // Track which products have been restored (for instant UI feedback)
  const [restoredIds, setRestoredIds] = useState<Set<string>>(new Set());
  // Track which products are being processed for defective return
  const [defectiveDialog, setDefectiveDialog] = useState<ProductDetail | null>(null);
  const [paymentSource, setPaymentSource] = useState<string>('');
  const [defectiveNote, setDefectiveNote] = useState('');
  
  // All payment sources (built-in + custom from localStorage)
  const allPaymentSources = useMemo(() => {
    const customSources = getCustomPaymentSources();
    return [
      ...builtInPaymentSources,
      ...customSources.map(s => ({ id: s.id, name: s.name, icon: Wallet, color: 'text-gray-600' })),
    ];
  }, []);

  const handleRestore = async (productId: string) => {
    setRestoredIds(prev => new Set(prev).add(productId));
    await restoreFromWarranty.mutateAsync(productId);
  };

  const handleDefectiveReturn = async () => {
    if (!defectiveDialog || !paymentSource) return;
    
    await markDefective.mutateAsync({
      productId: defectiveDialog.id,
      paymentSource,
      note: defectiveNote || `Hàng lỗi không sửa được`,
      importPrice: defectiveDialog.importPrice,
      supplierId: defectiveDialog.supplierId,
      productName: defectiveDialog.name,
      sku: item.sku,
      imei: defectiveDialog.imei,
      supplierName: defectiveDialog.supplierName,
      branchId: defectiveDialog.branchId,
    });
    
    setDefectiveDialog(null);
    setPaymentSource('');
    setDefectiveNote('');
  };

  const openDefectiveDialog = (product: ProductDetail) => {
    setDefectiveDialog(product);
    setPaymentSource('');
    setDefectiveNote('');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-warning" />
              Chi tiết hàng bảo hành - {item.productName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Product info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">SKU</p>
                <p className="font-medium">{item.sku}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Chi nhánh</p>
                <p className="font-medium">{item.branchName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Số lượng BH</p>
                <p className="font-medium text-warning">{item.stock}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Giá nhập TB</p>
                <p className="font-medium">{formatCurrencyWithSpaces(item.avgImportPrice)}</p>
              </div>
            </div>

            {/* Products list */}
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    {item.hasImei && <TableHead>IMEI</TableHead>}
                    <TableHead className="text-right">Giá nhập</TableHead>
                    <TableHead>Ngày nhập</TableHead>
                    <TableHead>Nhà cung cấp</TableHead>
                    <TableHead>Ghi chú</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.products.map((product, index) => (
                    <TableRow key={product.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      {item.hasImei && (
                        <TableCell className="font-mono text-sm">{product.imei}</TableCell>
                      )}
                      <TableCell className="text-right font-medium">
                        {formatCurrencyWithSpaces(product.importPrice)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(product.importDate), 'dd/MM/yyyy', { locale: vi })}
                      </TableCell>
                      <TableCell>{product.supplierName || '-'}</TableCell>
                      <TableCell className="max-w-[150px] truncate" title={product.note || ''}>
                        {product.note || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Restore button - show "Đã nhập" if clicked */}
                          {restoredIds.has(product.id) ? (
                            <span className="text-xs text-success opacity-70 font-medium">
                              Đã nhập
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestore(product.id)}
                              disabled={restoreFromWarranty.isPending}
                              className="gap-1"
                            >
                              <Undo2 className="h-3 w-3" />
                              Nhập lại kho
                            </Button>
                          )}
                          
                          {/* Defective return button */}
                          {!restoredIds.has(product.id) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDefectiveDialog(product)}
                              className="gap-1 text-destructive border-destructive/50 hover:bg-destructive/10"
                            >
                              <X className="h-3 w-3" />
                              Hàng lỗi
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {item.products.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">Không có sản phẩm chi tiết</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Defective Return Dialog */}
      <Dialog open={!!defectiveDialog} onOpenChange={() => setDefectiveDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Xử lý hàng lỗi
            </DialogTitle>
          </DialogHeader>
          
          {defectiveDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{defectiveDialog.name}</p>
                {defectiveDialog.imei && (
                  <p className="text-sm text-muted-foreground font-mono">{defectiveDialog.imei}</p>
                )}
                <p className="text-sm mt-1">
                  Giá nhập: <span className="font-medium">{formatCurrencyWithSpaces(defectiveDialog.importPrice)}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label>Nguồn tiền hoàn trả từ NCC <span className="text-destructive">*</span></Label>
                <Select value={paymentSource} onValueChange={setPaymentSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn nguồn tiền nhận hoàn" />
                  </SelectTrigger>
                  <SelectContent>
                    {allPaymentSources.map((source) => {
                      const IconComponent = source.icon;
                      return (
                        <SelectItem key={source.id} value={source.id}>
                          <div className="flex items-center gap-2">
                            <IconComponent className={`h-4 w-4 ${source.color}`} />
                            <span>{source.name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                    <SelectItem value="debt_reduction">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-orange-600" />
                        <span>Trừ vào công nợ NCC</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Textarea
                  value={defectiveNote}
                  onChange={(e) => setDefectiveNote(e.target.value)}
                  placeholder="Lý do trả hàng lỗi..."
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDefectiveDialog(null)}
                >
                  Hủy
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDefectiveReturn}
                  disabled={!paymentSource || markDefective.isPending}
                >
                  {markDefective.isPending ? 'Đang xử lý...' : 'Xác nhận trả NCC'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
