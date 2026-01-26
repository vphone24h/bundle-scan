import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useImportReceiptDetails, useUpdateImportReceipt, ImportReceipt } from '@/hooks/useImportReceipts';
import { formatNumberWithSpaces, parseFormattedNumber, formatCurrencyWithSpaces } from '@/lib/formatNumber';

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
}

export function EditImportReceiptDialog({ receipt, open, onOpenChange }: EditImportReceiptDialogProps) {
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { data: details, isLoading: detailsLoading } = useImportReceiptDetails(receipt?.id || null);
  const updateReceipt = useUpdateImportReceipt();

  const [supplierId, setSupplierId] = useState<string>('');
  const [productEdits, setProductEdits] = useState<ProductEdit[]>([]);

  // Load data when dialog opens
  useEffect(() => {
    if (receipt && details?.productImports) {
      setSupplierId(receipt.supplier_id || '');
      setProductEdits(
        details.productImports.map((item: any) => ({
          productId: item.product_id,
          name: item.products?.name || '',
          sku: item.products?.sku || '',
          imei: item.products?.imei || null,
          category_id: item.products?.category_id || null,
          import_price: Number(item.import_price),
          originalPrice: Number(item.import_price),
          displayPrice: formatNumberWithSpaces(Number(item.import_price)),
        }))
      );
    }
  }, [receipt, details]);

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

    const productUpdates = productEdits.map(edit => ({
      productId: edit.productId,
      name: edit.name,
      category_id: edit.category_id,
      import_price: edit.import_price,
      oldImportPrice: edit.originalPrice,
    }));

    try {
      await updateReceipt.mutateAsync({
        receiptId: receipt.id,
        productUpdates,
        newSupplierId: supplierId !== receipt.supplier_id ? supplierId : undefined,
      });

      toast({
        title: 'Cập nhật thành công',
        description: 'Phiếu nhập đã được chỉnh sửa',
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

  const totalAmount = productEdits.reduce((sum, p) => sum + p.import_price, 0);

  return (
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
            {/* Supplier */}
            <div className="space-y-2">
              <Label>Nhà cung cấp</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn nhà cung cấp" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
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
  );
}
