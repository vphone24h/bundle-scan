import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatNumberWithSpaces, parseFormattedNumber, formatCurrencyWithSpaces } from '@/lib/formatNumber';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCreateExportReturn } from '@/hooks/useReturns';
import { useCustomPaymentSources } from '@/hooks/useCustomPaymentSources';
import type { ExportReceiptItemDetail } from '@/hooks/useExportReceipts';

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

interface ExportReturnFormProps {
  item: ExportReceiptItemDetail | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ExportReturnForm({ item, onSuccess, onCancel }: ExportReturnFormProps) {
  const [feeType, setFeeType] = useState<'none' | 'percentage' | 'fixed_amount'>('none');
  const [feePercentage, setFeePercentage] = useState<number>(0);
  const [feeAmount, setFeeAmount] = useState<number>(0);
  const [feeDisplayAmount, setFeeDisplayAmount] = useState<string>('');
  const [note, setNote] = useState('');
  const [isBusinessAccounting, setIsBusinessAccounting] = useState(true);
  const [payments, setPayments] = useState<PaymentLine[]>([]);

  const createExportReturn = useCreateExportReturn();
  const { data: customPaymentSources = [] } = useCustomPaymentSources();
  const isSubmittingRef = useRef(false);

  const allPaymentSources = useMemo(() => {
    const custom = customPaymentSources.map((s) => ({
      value: s.id,
      label: s.name,
    }));
    return [...BUILT_IN_PAYMENT_SOURCES, ...custom];
  }, [customPaymentSources]);

  // Calculate refund amount
  const calculateRefund = () => {
    if (!item) return 0;
    if (feeType === 'none') return item.sale_price;
    if (feeType === 'percentage') return item.sale_price * (1 - feePercentage / 100);
    return item.sale_price - feeAmount;
  };

  const refundAmount = calculateRefund();
  const storeKeepAmount = (item?.sale_price || 0) - refundAmount;

  // Initialize payments when refund amount changes
  useEffect(() => {
    setPayments([
      { id: '1', source: 'cash', amount: refundAmount, displayAmount: formatNumberWithSpaces(refundAmount) }
    ]);
  }, [refundAmount]);

  if (!item) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chọn sản phẩm để trả hàng từ Lịch sử xuất hàng
        </CardContent>
      </Card>
    );
  }

  const totalPayment = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = refundAmount - totalPayment;

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

  const handleFeeAmountChange = (value: string) => {
    const numValue = parseFormattedNumber(value);
    setFeeAmount(numValue);
    setFeeDisplayAmount(formatNumberWithSpaces(numValue));
  };

  const handleSubmit = async () => {
    // Prevent double submit
    if (isSubmittingRef.current || createExportReturn.isPending) {
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

    isSubmittingRef.current = true;

    try {
      await createExportReturn.mutateAsync({
        item: {
          id: item.id,
          product_id: item.product_id,
          export_receipt_id: item.receipt_id,
          export_receipt_item_id: item.id,
          customer_id: null,
          branch_id: item.export_receipts?.branch_id || null,
          product_name: item.product_name,
          sku: item.sku,
          imei: item.imei,
          import_price: 0, // Will be fetched from product
          sale_price: item.sale_price,
          sale_date: item.export_receipts?.export_date || null,
        },
        feeType,
        feePercentage,
        feeAmount,
        payments: payments.filter(p => p.amount > 0).map(p => ({
          source: p.source,
          amount: p.amount,
        })),
        isBusinessAccounting,
        note: note || null,
      });

      toast({
        title: 'Trả hàng thành công',
        description: `Đã hoàn ${formatCurrencyWithSpaces(refundAmount)} cho khách hàng`,
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể hoàn tất trả hàng',
        variant: 'destructive',
      });
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="space-y-6">
      {/* Product Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin sản phẩm trả</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground">Tên sản phẩm</Label>
              <p className="font-medium">{item.product_name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">SKU</Label>
              <p className="font-medium">{item.sku}</p>
            </div>
            {item.imei && (
              <div>
                <Label className="text-muted-foreground">IMEI</Label>
                <p className="font-mono">{item.imei}</p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">Giá bán</Label>
              <p className="font-bold text-primary">{formatCurrencyWithSpaces(item.sale_price)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Khách hàng</Label>
              <p>{item.export_receipts?.customers?.name || '-'}</p>
              <p className="text-xs text-muted-foreground">{item.export_receipts?.customers?.phone}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Chi nhánh</Label>
              <p>{item.export_receipts?.branches?.name || '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Ngày bán</Label>
              <p>{item.export_receipts?.export_date ? new Date(item.export_receipts.export_date).toLocaleDateString('vi-VN') : '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Return Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hình thức trả hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={feeType} onValueChange={(v) => setFeeType(v as any)}>
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
              <RadioGroupItem value="none" id="none" />
              <Label htmlFor="none" className="flex-1 cursor-pointer">
                <div className="font-medium">Trả lại đúng số tiền đã bán</div>
                <div className="text-sm text-muted-foreground">Hoàn tiền 100%, không mất phí</div>
              </Label>
            </div>
            
            <div className="p-3 rounded-lg border hover:bg-accent/50">
              <div className="flex items-center space-x-2 cursor-pointer">
                <RadioGroupItem value="percentage" id="percentage" />
                <Label htmlFor="percentage" className="flex-1 cursor-pointer">
                  <div className="font-medium">Trả hàng mất phí theo %</div>
                </Label>
              </div>
              {feeType === 'percentage' && (
                <div className="mt-3 ml-6">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={feePercentage}
                      onChange={(e) => setFeePercentage(parseFloat(e.target.value) || 0)}
                      className="w-24"
                    />
                    <span>%</span>
                    <span className="text-muted-foreground">= {formatCurrencyWithSpaces(storeKeepAmount)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg border hover:bg-accent/50">
              <div className="flex items-center space-x-2 cursor-pointer">
                <RadioGroupItem value="fixed_amount" id="fixed_amount" />
                <Label htmlFor="fixed_amount" className="flex-1 cursor-pointer">
                  <div className="font-medium">Trả hàng mất phí theo số tiền cụ thể</div>
                </Label>
              </div>
              {feeType === 'fixed_amount' && (
                <div className="mt-3 ml-6">
                  <div className="flex items-center gap-2">
                    <Input
                      value={feeDisplayAmount}
                      onChange={(e) => handleFeeAmountChange(e.target.value)}
                      className="w-40 text-right"
                      placeholder="0"
                    />
                    <span>đ</span>
                  </div>
                </div>
              )}
            </div>
          </RadioGroup>

          {/* Refund Summary */}
          <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between">
              <span>Giá bán:</span>
              <span className="font-medium">{formatCurrencyWithSpaces(item.sale_price)}</span>
            </div>
            <div className="flex justify-between text-success">
              <span>Số tiền hoàn cho khách:</span>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Dòng tiền hoàn cho khách</CardTitle>
          <Button variant="outline" size="sm" onClick={handleAddPayment}>
            <Plus className="h-4 w-4 mr-1" />
            Thêm
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
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
            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span>Tổng hoàn trả:</span>
                <span className="font-bold">{formatCurrencyWithSpaces(totalPayment)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Cần hoàn trả:</span>
                <span className="font-bold">{formatCurrencyWithSpaces(refundAmount)}</span>
              </div>
              {Math.abs(remaining) > 1 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>{remaining > 0 ? 'Còn thiếu:' : 'Dư:'}</span>
                  <span className="font-bold">{formatCurrencyWithSpaces(Math.abs(remaining))}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Accounting */}
      {feeType !== 'none' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="business_accounting"
                checked={isBusinessAccounting}
                onCheckedChange={(checked) => setIsBusinessAccounting(checked === true)}
              />
              <Label htmlFor="business_accounting" className="cursor-pointer">
                <span className="font-medium">Hạch toán kinh doanh</span>
                <p className="text-sm text-muted-foreground">
                  Phí trả hàng sẽ được tính vào Thu nhập khác trong báo cáo
                </p>
              </Label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Note */}
      <Card>
        <CardContent className="pt-6">
          <Label>Ghi chú</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú cho phiếu trả hàng..."
            className="mt-2"
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          Hủy
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={createExportReturn.isPending || Math.abs(remaining) > 1}
        >
          {createExportReturn.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Xác nhận trả hàng
        </Button>
      </div>
    </div>
  );
}
