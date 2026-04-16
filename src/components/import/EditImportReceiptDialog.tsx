import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, CalendarIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useImportReceiptDetails, useUpdateImportReceipt, ImportReceipt } from '@/hooks/useImportReceipts';
import { formatNumberWithSpaces, parseFormattedNumber, formatCurrencyWithSpaces } from '@/lib/formatNumber';
import { PRODUCT_UNITS, DECIMAL_UNITS } from '@/types/warehouse';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { SecurityPasswordDialog } from '@/components/security/SecurityPasswordDialog';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface EditImportReceiptDialogProps {
  receipt: ImportReceipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProductEdit {
  productId: string;
  name: string;
  sku: string;
  imei: string | null;
  category_id: string | null;
  import_price: number;
  originalPrice: number;
  displayPrice: string;
  quantity: number;
  unit: string;
}

export function EditImportReceiptDialog({ receipt, open, onOpenChange }: EditImportReceiptDialogProps) {
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { data: details, isLoading: detailsLoading } = useImportReceiptDetails(receipt?.id || null);
  const updateReceipt = useUpdateImportReceipt();

  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked: securityUnlocked, unlock: securityUnlock } = useSecurityUnlock('edit-import-receipt');
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);

  const [supplierId, setSupplierId] = useState<string>('_none_');
  const [productEdits, setProductEdits] = useState<ProductEdit[]>([]);
  const [importDate, setImportDate] = useState('');
  const [originalImportDate, setOriginalImportDate] = useState('');

  // Load data when dialog opens
  useEffect(() => {
    if (receipt && details?.productImports) {
      setSupplierId(receipt.supplier_id ?? '_none_');
      const dateStr = receipt.import_date
        ? format(parseISO(receipt.import_date), "yyyy-MM-dd'T'HH:mm")
        : '';
      setImportDate(dateStr);
      setOriginalImportDate(dateStr);
      setProductEdits(
        details.productImports.map((item: any) => ({
          productId: item.product_id ?? item.id ?? item.products?.id,
          name: item.products?.name || item.name || '',
          sku: item.products?.sku || item.sku || '',
          imei: item.products?.imei || item.imei || null,
          category_id: item.products?.category_id ?? item.category_id ?? null,
          import_price: Number(item.import_price),
          originalPrice: Number(item.import_price),
          displayPrice: formatNumberWithSpaces(Number(item.import_price)),
          quantity: Number(item.quantity) || 1,
          unit: item.products?.unit || item.unit || 'cái',
        }))
      );
    }
  }, [receipt, details]);

  // Check if receipt is older than 1 month
  const canEditDate = receipt?.import_date
    ? differenceInDays(new Date(), new Date(receipt.import_date)) <= 30
    : true;

  const handleImportDateChange = (newDate: string) => {
    if (!canEditDate) return;
    if (newDate !== originalImportDate && hasSecurityPassword && !securityUnlocked) {
      setShowSecurityDialog(true);
      return;
    }
    setImportDate(newDate);
  };

  const handleSecuritySuccess = () => {
    securityUnlock();
    setShowSecurityDialog(false);
  };

  const handleProductChange = (index: number, field: keyof ProductEdit, value: any) => {
    setProductEdits(prev => {
      const updated = [...prev];
      if (field === 'import_price') {
        const numValue = parseFormattedNumber(value);
        updated[index] = {
          ...updated[index],
          import_price: numValue,
          displayPrice: formatNumberWithSpaces(numValue),
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!receipt) return;

    const dateChanged = importDate && importDate !== originalImportDate;

    // Require security password for date change
    if (dateChanged && hasSecurityPassword && !securityUnlocked) {
      setShowSecurityDialog(true);
      return;
    }

    const productUpdates = productEdits.map(edit => ({
      productId: edit.productId,
      name: edit.name,
      category_id: edit.category_id,
      import_price: edit.import_price,
      oldImportPrice: edit.originalPrice,
      unit: edit.unit,
      quantity: edit.quantity,
      hasImei: !!edit.imei,
    }));

    try {
      // Only pass supplierId if it's a valid UUID (not empty string)
      const validSupplierId = supplierId === '_none_' ? null : supplierId;
      const originalSupplierId = receipt.supplier_id || null;

      await updateReceipt.mutateAsync({
        receiptId: receipt.id,
        productUpdates,
        newSupplierId: validSupplierId !== originalSupplierId ? validSupplierId : undefined,
        importDate: dateChanged ? new Date(importDate).toISOString() : undefined,
      });

      toast({
        title: 'Cập nhật thành công',
        description: dateChanged
          ? 'Phiếu nhập đã được chỉnh sửa, ngày nhập đã cập nhật cho tất cả sản phẩm'
          : 'Phiếu nhập đã được chỉnh sửa',
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật phiếu nhập',
        variant: 'destructive',
      });
    }
  };

  const totalAmount = productEdits.reduce((sum, p) => sum + p.import_price * p.quantity, 0);
  const dateChanged = importDate && importDate !== originalImportDate;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa phiếu nhập {receipt?.code}</DialogTitle>
        </DialogHeader>

        {detailsLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Import Date */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                Ngày giờ nhập
              </Label>
              <Input
                type="datetime-local"
                value={importDate}
                onChange={(e) => handleImportDateChange(e.target.value)}
                disabled={!canEditDate}
                className={cn(
                  dateChanged && 'border-green-500 ring-1 ring-green-500/30'
                )}
              />
              {!canEditDate && (
                <p className="text-xs text-destructive">
                  Phiếu nhập quá 1 tháng, không cho phép sửa ngày
                </p>
              )}
              {dateChanged && canEditDate && (
                <p className="text-xs text-green-600 font-medium">
                  ⚠ Ngày nhập đã thay đổi — tất cả sản phẩm trong phiếu sẽ đồng bộ ngày mới
                </p>
              )}
            </div>

            {/* Supplier */}
            <div className="space-y-2">
              <Label>Nhà cung cấp</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn nhà cung cấp" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="_none_">Không có</SelectItem>
                  {suppliers?.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Products */}
            <div className="space-y-4">
              <Label>Danh sách sản phẩm</Label>
              {productEdits.map((product, index) => (
                <div key={product.productId} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      SKU: {product.sku}
                      {product.imei && ` • IMEI: ${product.imei}`}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tên sản phẩm</Label>
                      <Input
                        value={product.name}
                        onChange={(e) => handleProductChange(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Danh mục</Label>
                      <Select
                        value={product.category_id || '_none_'}
                        onValueChange={(v) => handleProductChange(index, 'category_id', v === '_none_' ? null : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn danh mục" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="_none_">Không có</SelectItem>
                          {categories?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Giá nhập</Label>
                      <Input
                        value={product.displayPrice}
                        onChange={(e) => handleProductChange(index, 'import_price', e.target.value)}
                        className="text-right"
                      />
                    </div>
                  </div>
                  {/* Quantity & Unit editable for non-IMEI products */}
                  {!product.imei && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Số lượng</Label>
                        <Input
                          type="number"
                          min={DECIMAL_UNITS.includes(product.unit) ? 0.001 : 1}
                          step={DECIMAL_UNITS.includes(product.unit) ? 0.1 : 1}
                          value={product.quantity}
                          onChange={(e) => {
                            const isDecimal = DECIMAL_UNITS.includes(product.unit);
                            const qty = isDecimal 
                              ? Math.max(0.001, parseFloat(e.target.value) || 0.001)
                              : Math.max(1, parseInt(e.target.value) || 1);
                            setProductEdits(prev => {
                              const updated = [...prev];
                              updated[index] = { ...updated[index], quantity: qty };
                              return updated;
                            });
                          }}
                          className="text-right"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Đơn vị</Label>
                        <Select
                          value={product.unit}
                          onValueChange={(v) => {
                            setProductEdits(prev => {
                              const updated = [...prev];
                              // Reset quantity when switching unit types
                              const wasDecimal = DECIMAL_UNITS.includes(updated[index].unit);
                              const isDecimal = DECIMAL_UNITS.includes(v);
                              const newQty = (wasDecimal !== isDecimal) ? 1 : updated[index].quantity;
                              updated[index] = { ...updated[index], unit: v, quantity: newQty };
                              return updated;
                            });
                          }}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {PRODUCT_UNITS.map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Thành tiền</Label>
                        <div className="h-10 flex items-center justify-end px-3 bg-muted/50 rounded-md text-sm font-medium">
                          {formatCurrencyWithSpaces(product.import_price * product.quantity)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex justify-between font-medium">
                <span>Tổng tiền mới:</span>
                <span className="text-lg">{formatCurrencyWithSpaces(totalAmount)}</span>
              </div>
              {details?.receipt && totalAmount !== Number(details.receipt.total_amount) && (
                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                  <span>Chênh lệch:</span>
                  <span className={totalAmount > Number(details.receipt.total_amount) ? 'text-destructive' : 'text-success'}>
                    {totalAmount > Number(details.receipt.total_amount) ? '+' : ''}
                    {formatCurrencyWithSpaces(totalAmount - Number(details.receipt.total_amount))}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={updateReceipt.isPending}>
            {updateReceipt.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <SecurityPasswordDialog
      open={showSecurityDialog}
      onOpenChange={setShowSecurityDialog}
      onSuccess={handleSecuritySuccess}
      title="Xác nhận chỉnh sửa ngày nhập"
      description="Thay đổi ngày nhập là thao tác nhạy cảm. Vui lòng nhập mật khẩu bảo mật."
    />
    </>
  );
}
