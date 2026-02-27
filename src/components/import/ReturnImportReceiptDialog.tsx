import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useImportReceiptDetails, useReturnImportReceipt, ImportReceipt } from '@/hooks/useImportReceipts';
import { useCustomPaymentSources } from '@/hooks/useCustomPaymentSources';
import { formatNumberWithSpaces, parseFormattedNumber, formatCurrencyWithSpaces } from '@/lib/formatNumber';
import { Badge } from '@/components/ui/badge';

interface ReturnImportReceiptDialogProps {
  receipt: ImportReceipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PaymentLine {
  id: string;
  source: string;
  amount: number;
  displayAmount: string;
}

const BUILT_IN_PAYMENT_SOURCES = [
  { value: 'debt', label: 'Giảm công nợ' },
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'bank_card', label: 'Thẻ ngân hàng' },
  { value: 'e_wallet', label: 'Ví điện tử' },
];

export function ReturnImportReceiptDialog({ receipt, open, onOpenChange }: ReturnImportReceiptDialogProps) {
  const { data: details, isLoading: detailsLoading } = useImportReceiptDetails(receipt?.id || null);
  const returnReceipt = useReturnImportReceipt();
  const { data: customPaymentSources = [] } = useCustomPaymentSources();

  const allPaymentSources = useMemo(() => {
    const custom = customPaymentSources.map((s) => ({
      value: s.id,
      label: s.name,
    }));
    return [...BUILT_IN_PAYMENT_SOURCES, ...custom];
  }, [customPaymentSources]);

  const [note, setNote] = useState('');
  const [payments, setPayments] = useState<PaymentLine[]>([]);

  // Count in-stock products
  const inStockProducts = details?.productImports?.filter(
    (item: any) => item.products?.status === 'in_stock'
  ) || [];
  
  const totalRefundAmount = inStockProducts.reduce(
    (sum: number, item: any) => sum + Number(item.import_price),
    0
  );

  // Initialize payments when data loads
  useEffect(() => {
    if (open && totalRefundAmount > 0) {
      setPayments([{
        id: '1',
        source: 'cash',
        amount: totalRefundAmount,
        displayAmount: formatNumberWithSpaces(totalRefundAmount),
      }]);
      setNote('');
    }
  }, [open, totalRefundAmount]);

  const handleAddPayment = () => {
    setPayments([
      ...payments,
      { id: Date.now().toString(), source: 'cash', amount: 0, displayAmount: '' }
    ]);
  };

  const handleRemovePayment = (id: string) => {
    if (payments.length > 1) {
      setPayments(payments.filter(p => p.id !== id));
    }
  };

  const handlePaymentChange = (id: string, field: 'source' | 'amount', value: string) => {
    setPayments(payments.map(p => {
      if (p.id !== id) return p;
      if (field === 'source') {
        return { ...p, source: value };
      } else {
        const numValue = parseFormattedNumber(value);
        return { ...p, amount: numValue, displayAmount: formatNumberWithSpaces(numValue) };
      }
    }));
  };

  const totalPayment = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totalRefundAmount - totalPayment;

  const handleSubmit = async () => {
    if (!receipt) return;

    if (totalPayment !== totalRefundAmount) {
      toast({
        title: 'Số tiền không khớp',
        description: `Tổng tiền hoàn trả phải bằng ${formatCurrencyWithSpaces(totalRefundAmount)}`,
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await returnReceipt.mutateAsync({
        receiptId: receipt.id,
        payments: payments.filter(p => p.amount > 0).map(p => ({
          source: p.source,
          amount: p.amount,
        })),
        note: note || null,
      });

      toast({
        title: 'Trả hàng thành công',
        description: `Đã trả ${result.productsReturned} sản phẩm về nhà cung cấp`,
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể hoàn tất trả hàng',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Trả toàn bộ phiếu nhập {receipt?.code}
          </DialogTitle>
        </DialogHeader>

        {detailsLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : inStockProducts.length === 0 ? (
          <div className="py-8 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto" />
            <div>
              <p className="font-medium">Không có sản phẩm nào để trả</p>
              <p className="text-sm text-muted-foreground">
                Tất cả sản phẩm trong phiếu này đã được bán hoặc đã trả trước đó.
              </p>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Products to return */}
            <div className="space-y-2">
              <Label>Sản phẩm sẽ trả ({inStockProducts.length} sản phẩm)</Label>
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {inStockProducts.map((item: any) => (
                  <div key={item.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{item.products?.name || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {item.products?.sku || 'N/A'}
                        {item.products?.imei && ` • IMEI: ${item.products.imei}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrencyWithSpaces(Number(item.import_price))}</p>
                      <Badge variant="outline" className="text-xs">Tồn kho</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supplier info */}
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex justify-between text-sm">
                <span>Nhà cung cấp:</span>
                <span className="font-medium">{receipt?.suppliers?.name || '-'}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span>Tổng tiền hoàn trả:</span>
                <span className="font-bold text-lg text-primary">
                  {formatCurrencyWithSpaces(totalRefundAmount)}
                </span>
              </div>
            </div>

            {/* Payment Lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Dòng tiền hoàn trả</Label>
                <Button variant="outline" size="sm" onClick={handleAddPayment}>
                  <Plus className="h-4 w-4 mr-1" />
                  Thêm
                </Button>
              </div>
              
              {payments.map((payment) => (
                <div key={payment.id} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Nguồn tiền</Label>
                    <select
                      value={payment.source}
                      onChange={(e) => handlePaymentChange(payment.id, 'source', e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      {allPaymentSources.map(src => (
                        <option key={src.value} value={src.value}>{src.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Số tiền</Label>
                    <Input
                      value={payment.displayAmount}
                      onChange={(e) => handlePaymentChange(payment.id, 'amount', e.target.value)}
                      placeholder="0"
                      className="text-right"
                    />
                  </div>
                  {payments.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-5"
                      onClick={() => handleRemovePayment(payment.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}

              {/* Summary */}
              <div className="pt-3 border-t space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Tổng hoàn trả:</span>
                  <span className="font-bold">{formatCurrencyWithSpaces(totalPayment)}</span>
                </div>
                {remaining !== 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>{remaining > 0 ? 'Còn thiếu:' : 'Vượt quá:'}</span>
                    <span className="font-bold">{formatCurrencyWithSpaces(Math.abs(remaining))}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú cho phiếu trả hàng..."
              />
            </div>
          </div>
        )}

        {inStockProducts.length > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={returnReceipt.isPending || remaining !== 0}
              variant="destructive"
            >
              {returnReceipt.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <RotateCcw className="h-4 w-4 mr-2" />
              Xác nhận trả hàng
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
