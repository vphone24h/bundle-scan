import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

import { formatNumberWithSpaces, parseFormattedNumber, formatCurrencyWithSpaces } from '@/lib/formatNumber';
import { Plus, Trash2, Loader2, RotateCcw, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCreateExportReturn } from '@/hooks/useReturns';
import { useCustomPaymentSources } from '@/hooks/useCustomPaymentSources';
import type { ExportReceipt } from '@/hooks/useExportReceipts';

interface PaymentLine {
  id: string;
  source: string;
  amount: number;
  displayAmount: string;
}

const BUILT_IN_PAYMENT_SOURCES = [
  { value: 'debt', label: 'Công nợ khách hàng' },
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'bank_card', label: 'Thẻ ngân hàng' },
  { value: 'e_wallet', label: 'Ví điện tử' },
];

interface ReceiptReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: ExportReceipt | null;
  onSuccess: () => void;
}

export function ReceiptReturnDialog({
  open,
  onOpenChange,
  receipt,
  onSuccess,
}: ReceiptReturnDialogProps) {
  // Require explicit user selection (no default)
  const [feeType, setFeeType] = useState<'' | 'none' | 'percentage' | 'fixed_amount'>('');
  const [feePercentage, setFeePercentage] = useState<number>(0);
  const [feeAmount, setFeeAmount] = useState<number>(0);
  const [feeDisplayAmount, setFeeDisplayAmount] = useState<string>('');
  const [note, setNote] = useState('');
  const [isBusinessAccounting, setIsBusinessAccounting] = useState(true);
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [paymentsTouched, setPaymentsTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const createExportReturn = useCreateExportReturn();
  const { data: customPaymentSources = [] } = useCustomPaymentSources();

  const allPaymentSources = useMemo(() => {
    const custom = customPaymentSources.map((s) => ({
      value: s.id,
      label: s.name,
    }));
    return [...BUILT_IN_PAYMENT_SOURCES, ...custom];
  }, [customPaymentSources]);

  // Get returnable items (not already returned)
  const returnableItems = receipt?.export_receipt_items?.filter(
    (item) => item.status !== 'returned'
  ) || [];

  const totalSalePrice = returnableItems.reduce((sum, item) => sum + item.sale_price, 0);

  // Calculate refund amount
  const calculateRefund = () => {
    // No selection yet -> display as full refund, but submission will be blocked
    if (feeType === '') return totalSalePrice;
    if (feeType === 'none') return totalSalePrice;
    if (feeType === 'percentage') return totalSalePrice * (1 - feePercentage / 100);
    return totalSalePrice - feeAmount;
  };

  const refundAmount = calculateRefund();
  const storeKeepAmount = totalSalePrice - refundAmount;

  // Initialize payments (no default source; amount can be auto-filled until user edits)
  useEffect(() => {
    if (!open) return;

    // First open / reset: ensure at least one line exists
    if (payments.length === 0) {
      setPayments([{ id: '1', source: '', amount: 0, displayAmount: '' }]);
      return;
    }

    // If user hasn't touched payments yet, keep amount in sync with refund
    if (!paymentsTouched && payments.length === 1) {
      setPayments((prev) => {
        if (prev.length !== 1) return prev;
        return [
          {
            ...prev[0],
            amount: refundAmount,
            displayAmount: formatNumberWithSpaces(refundAmount),
          },
        ];
      });
    }
  }, [refundAmount, open, payments.length, paymentsTouched]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setFeeType('');
      setFeePercentage(0);
      setFeeAmount(0);
      setFeeDisplayAmount('');
      setNote('');
      setIsBusinessAccounting(true);
      setPaymentsTouched(false);
      setCurrentIndex(0);
    }
  }, [open]);

  if (!receipt) return null;

  const totalPayment = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = refundAmount - totalPayment;

  const handleAddPayment = () => {
    setPaymentsTouched(true);
    setPayments([
      ...payments,
      { id: Date.now().toString(), source: '', amount: 0, displayAmount: '' }
    ]);
  };

  const handleRemovePayment = (id: string) => {
    if (payments.length > 1) {
      setPaymentsTouched(true);
      setPayments(payments.filter(p => p.id !== id));
    }
  };

  const handlePaymentChange = (id: string, field: 'source' | 'amount', value: string) => {
    setPaymentsTouched(true);
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

  const handleFeeAmountChange = (value: string) => {
    const numValue = parseFormattedNumber(value);
    setFeeAmount(numValue);
    setFeeDisplayAmount(formatNumberWithSpaces(numValue));
  };

  // Calculate fee for each item proportionally
  const calculateItemFee = (itemSalePrice: number) => {
    if (feeType === '' || feeType === 'none') return { feeType: 'none' as const, feePercentage: 0, feeAmount: 0 };
    if (feeType === 'percentage') {
      return { feeType: 'percentage' as const, feePercentage, feeAmount: 0 };
    }
    // Fixed amount - distribute proportionally
    const proportion = itemSalePrice / totalSalePrice;
    return { 
      feeType: 'fixed_amount' as const, 
      feePercentage: 0, 
      feeAmount: Math.round(feeAmount * proportion) 
    };
  };

  // Calculate payment for each item proportionally
  const calculateItemPayments = (itemSalePrice: number, itemFee: { feeType: string; feePercentage: number; feeAmount: number }) => {
    let itemRefund = itemSalePrice;
    if (itemFee.feeType === 'percentage') {
      itemRefund = itemSalePrice * (1 - itemFee.feePercentage / 100);
    } else if (itemFee.feeType === 'fixed_amount') {
      itemRefund = itemSalePrice - itemFee.feeAmount;
    }
    
    const proportion = itemRefund / refundAmount;
    return payments
      .filter(p => p.amount > 0)
      .map(p => ({
        source: p.source,
        amount: Math.round(p.amount * proportion),
      }));
  };

  const handleSubmit = async () => {
    // Require explicit fee choice
    if (feeType === '') {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng chọn hình thức trả hàng (100% / mất phí % / mất phí số tiền).',
        variant: 'destructive',
      });
      return;
    }

    // Validate fee inputs
    if (feeType === 'percentage') {
      if (!Number.isFinite(feePercentage) || feePercentage <= 0 || feePercentage >= 100) {
        toast({
          title: 'Phí không hợp lệ',
          description: 'Phí % phải > 0 và < 100.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (feeType === 'fixed_amount') {
      if (!Number.isFinite(feeAmount) || feeAmount <= 0 || feeAmount >= totalSalePrice) {
        toast({
          title: 'Phí không hợp lệ',
          description: 'Phí cố định phải > 0 và nhỏ hơn tổng giá bán.',
          variant: 'destructive',
        });
        return;
      }
    }

    // Require payment lines
    const validPayments = payments
      .filter(p => p.amount > 0)
      .filter(p => !!p.source);

    if (validPayments.length === 0) {
      toast({
        title: 'Thiếu dòng tiền',
        description: 'Vui lòng chọn dòng tiền hoàn cho khách và nhập số tiền.',
        variant: 'destructive',
      });
      return;
    }

    if (Math.abs(totalPayment - refundAmount) > 1) {
      toast({
        title: 'Số tiền không khớp',
        description: `Tổng tiền hoàn cho khách phải bằng ${formatCurrencyWithSpaces(refundAmount)}`,
        variant: 'destructive',
      });
      return;
    }

    if (returnableItems.length === 0) {
      toast({
        title: 'Không có sản phẩm để trả',
        description: 'Tất cả sản phẩm trong phiếu đã được trả trước đó',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Process each item sequentially - WITHOUT recording to cash book individually
      const returnCodes: string[] = [];
      for (let i = 0; i < returnableItems.length; i++) {
        setCurrentIndex(i);
        const item = returnableItems[i];
        const itemFee = calculateItemFee(item.sale_price);
        const itemPayments = calculateItemPayments(item.sale_price, itemFee)
          .filter(p => p.amount > 0)
          .filter(p => !!p.source);

        const result = await createExportReturn.mutateAsync({
          item: {
            id: item.id,
            product_id: item.product_id,
            export_receipt_id: receipt.id,
            export_receipt_item_id: item.id,
            customer_id: receipt.customer_id || null,
            branch_id: receipt.branch_id || null,
            product_name: item.product_name,
            sku: item.sku,
            imei: item.imei,
            import_price: 0,
            sale_price: item.sale_price,
            sale_date: receipt.export_date || null,
          },
          feeType: itemFee.feeType,
          feePercentage: itemFee.feePercentage,
          feeAmount: itemFee.feeAmount,
          payments: itemPayments,
          isBusinessAccounting,
          recordToCashBook: false, // Don't record individually - we'll consolidate below
          note: i === 0 ? (note || `Trả toàn bộ phiếu ${receipt.code}`) : null,
        });
        returnCodes.push(result.code);
      }

      // Consolidated cash book entry - ONE entry per payment source for the whole receipt
      const validPayments = payments.filter(p => p.amount > 0 && !!p.source);
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      const { data: { user } } = await supabase.auth.getUser();

      if (user && tenantId) {
        for (const payment of validPayments) {
          if (payment.source !== 'debt') {
            // Build product details for the note
            const productDetails = returnableItems.map(item => 
              `${item.product_name}${item.imei ? ` (IMEI: ${item.imei})` : ''}: ${formatCurrencyWithSpaces(item.sale_price)}`
            ).join('\n');

            await supabase.from('cash_book').insert([{
              type: 'expense' as const,
              category: 'Hoan tien khach hang',
              description: `Trả hàng phiếu ${receipt.code} (${returnableItems.length} SP)`,
              amount: payment.amount,
              payment_source: payment.source,
              is_business_accounting: false,
              branch_id: receipt.branch_id,
              reference_id: receipt.id,
              reference_type: 'export_return_receipt',
              created_by: user.id,
              tenant_id: tenantId,
              note: productDetails,
            }]);
          }
        }

        // Consolidated fee income entry if applicable
        if (storeKeepAmount > 0) {
          await supabase.from('cash_book').insert([{
            type: 'income' as const,
            category: 'Thu nhap khac',
            description: `Phí trả hàng phiếu ${receipt.code} (${returnableItems.length} SP)`,
            amount: storeKeepAmount,
            payment_source: validPayments[0]?.source || 'cash',
            is_business_accounting: false,
            branch_id: receipt.branch_id,
            reference_id: receipt.id,
            reference_type: 'export_return_fee',
            created_by: user.id,
            tenant_id: tenantId,
          }]);
        }
      }

      toast({
        title: 'Trả hàng thành công',
        description: `Đã hoàn ${formatCurrencyWithSpaces(refundAmount)} cho khách hàng (${returnableItems.length} sản phẩm)`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể hoàn tất trả hàng',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setCurrentIndex(0);
    }
  };

  const cannotReturn = receipt.status === 'full_return' || receipt.status === 'cancelled';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Trả hàng - Phiếu {receipt.code}
          </DialogTitle>
        </DialogHeader>

        {cannotReturn ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-4 text-destructive" />
            <p className="font-medium text-foreground">Không thể trả hàng</p>
            <p className="text-sm mt-1">
              {receipt.status === 'full_return' 
                ? 'Phiếu này đã được trả hàng hoàn toàn' 
                : 'Phiếu này đã bị hủy'}
            </p>
          </div>
        ) : returnableItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-4 text-amber-500" />
            <p className="font-medium text-foreground">Không có sản phẩm để trả</p>
            <p className="text-sm mt-1">Tất cả sản phẩm trong phiếu đã được trả trước đó</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
            <div className="space-y-4 pb-4">
              {/* Items to return */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Sản phẩm sẽ trả ({returnableItems.length})</span>
                    <Badge variant="secondary">
                      Tổng: {formatCurrencyWithSpaces(totalSalePrice)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="space-y-2 text-sm">
                    {returnableItems.map((item, index) => (
                      <div key={item.id} className="flex justify-between items-center py-1 border-b last:border-0">
                        <div>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.imei ? `IMEI: ${item.imei}` : `SKU: ${item.sku}`}
                          </div>
                        </div>
                        <span className="font-medium">{formatCurrencyWithSpaces(item.sale_price)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Customer info */}
              {receipt.customers && (
                <Card>
                  <CardContent className="py-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Khách hàng:</span>
                      <div className="text-right">
                        <div className="font-medium">{receipt.customers.name}</div>
                        <div className="text-xs text-muted-foreground">{receipt.customers.phone}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Fee Type */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Hình thức trả hàng</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <RadioGroup value={feeType} onValueChange={(v) => setFeeType(v as any)} className="space-y-2">
                    <div className="flex items-center space-x-2 p-2 rounded border hover:bg-accent/50 cursor-pointer">
                        <RadioGroupItem value="none" id="r-none" />
                      <Label htmlFor="r-none" className="flex-1 cursor-pointer text-sm">
                        Trả lại đúng số tiền đã bán (100%)
                      </Label>
                    </div>
                    
                    <div className="p-2 rounded border hover:bg-accent/50">
                      <div className="flex items-center space-x-2 cursor-pointer">
                         <RadioGroupItem value="percentage" id="r-percentage" />
                        <Label htmlFor="r-percentage" className="flex-1 cursor-pointer text-sm">
                          Trả hàng mất phí theo %
                        </Label>
                      </div>
                      {feeType === 'percentage' && (
                        <div className="mt-2 ml-6 flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={feePercentage}
                            onChange={(e) => setFeePercentage(parseFloat(e.target.value) || 0)}
                            className="w-20 h-8"
                          />
                          <span className="text-sm">%</span>
                          <span className="text-sm text-muted-foreground">
                            = {formatCurrencyWithSpaces(storeKeepAmount)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-2 rounded border hover:bg-accent/50">
                      <div className="flex items-center space-x-2 cursor-pointer">
                         <RadioGroupItem value="fixed_amount" id="r-fixed" />
                        <Label htmlFor="r-fixed" className="flex-1 cursor-pointer text-sm">
                          Trả hàng mất phí cố định
                        </Label>
                      </div>
                      {feeType === 'fixed_amount' && (
                        <div className="mt-2 ml-6 flex items-center gap-2">
                          <Input
                            value={feeDisplayAmount}
                            onChange={(e) => handleFeeAmountChange(e.target.value)}
                            className="w-32 h-8 text-right"
                            placeholder="0"
                          />
                          <span className="text-sm">đ</span>
                        </div>
                      )}
                    </div>
                  </RadioGroup>

                  {/* Refund Summary */}
                  <div className="mt-3 p-3 bg-muted rounded-lg space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Tổng giá bán:</span>
                      <span className="font-medium">{formatCurrencyWithSpaces(totalSalePrice)}</span>
                    </div>
                    <div className="flex justify-between text-success">
                      <span>Hoàn cho khách:</span>
                      <span className="font-bold">{formatCurrencyWithSpaces(refundAmount)}</span>
                    </div>
                    {storeKeepAmount > 0 && (
                      <div className="flex justify-between text-primary">
                        <span>Cửa hàng giữ lại:</span>
                        <span className="font-bold">{formatCurrencyWithSpaces(storeKeepAmount)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Payment Lines */}
              <Card>
                <CardHeader className="py-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Dòng tiền hoàn trả</CardTitle>
                  <Button variant="outline" size="sm" className="h-7" onClick={handleAddPayment}>
                    <Plus className="h-3 w-3 mr-1" />
                    Thêm
                  </Button>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex gap-2 items-center">
                        <select
                          value={payment.source}
                          onChange={(e) => handlePaymentChange(payment.id, 'source', e.target.value)}
                          className="flex-1 h-8 px-2 rounded-md border border-input bg-background text-sm"
                        >
                          <option value="" disabled>
                            Chọn nguồn tiền
                          </option>
                          {allPaymentSources.map(src => (
                            <option key={src.value} value={src.value}>{src.label}</option>
                          ))}
                        </select>
                        <Input
                          value={payment.displayAmount}
                          onChange={(e) => handlePaymentChange(payment.id, 'amount', e.target.value)}
                          placeholder="0"
                          className="w-32 h-8 text-right"
                        />
                        {payments.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemovePayment(payment.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}

                    {Math.abs(remaining) > 1 && (
                      <div className="text-sm text-right text-destructive">
                        {remaining > 0 ? `Còn thiếu: ${formatCurrencyWithSpaces(remaining)}` : `Dư: ${formatCurrencyWithSpaces(Math.abs(remaining))}`}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Business Accounting */}
              {feeType !== 'none' && (
                <Card>
                  <CardContent className="py-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="receipt_business_accounting"
                        checked={isBusinessAccounting}
                        onCheckedChange={(checked) => setIsBusinessAccounting(checked === true)}
                      />
                      <Label htmlFor="receipt_business_accounting" className="cursor-pointer text-sm">
                        Hạch toán kinh doanh (phí vào Thu nhập khác)
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Note */}
              <Card>
                <CardContent className="py-3">
                  <Label className="text-sm">Ghi chú</Label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ghi chú cho phiếu trả hàng..."
                    className="mt-2 h-16"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Đóng
          </Button>
          {!cannotReturn && returnableItems.length > 0 && (
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                feeType === '' ||
                Math.abs(remaining) > 1 ||
                payments.filter(p => p.amount > 0 && !!p.source).length === 0
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang xử lý ({currentIndex + 1}/{returnableItems.length})
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Trả {returnableItems.length} sản phẩm
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
