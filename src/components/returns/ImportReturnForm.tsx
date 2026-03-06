import { useState, useMemo, useEffect } from 'react';
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
import { useCreateImportReturn } from '@/hooks/useReturns';
import { useCustomPaymentSources } from '@/hooks/useCustomPaymentSources';
import type { Product } from '@/hooks/useProducts';

interface PaymentLine {
  id: string;
  source: string;
  amount: number;
  displayAmount: string;
}

const BUILT_IN_PAYMENT_SOURCES = [
  { value: 'debt', label: 'Công nợ' },
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'bank_card', label: 'Thẻ ngân hàng' },
  { value: 'e_wallet', label: 'Ví điện tử' },
];

interface ImportReturnFormProps {
  product: Product | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ImportReturnForm({ product, onSuccess, onCancel }: ImportReturnFormProps) {
  const [feeType, setFeeType] = useState<'none' | 'percentage' | 'fixed_amount'>('none');
  const [feePercentage, setFeePercentage] = useState<number>(0);
  const [feeAmount, setFeeAmount] = useState<number>(0);
  const [feeDisplayAmount, setFeeDisplayAmount] = useState<string>('');
  const [note, setNote] = useState('');
  const [recordToCashBook, setRecordToCashBook] = useState(true);
  const [payments, setPayments] = useState<PaymentLine[]>([]);

  const createImportReturn = useCreateImportReturn();
  const { data: customPaymentSources = [] } = useCustomPaymentSources();

  const allPaymentSources = useMemo(() => {
    const custom = customPaymentSources.map((s) => ({
      value: s.id,
      label: s.name,
    }));
    return [...BUILT_IN_PAYMENT_SOURCES, ...custom];
  }, [customPaymentSources]);

  // Calculate refund amount based on fee type
  const calculateRefund = () => {
    if (!product) return 0;
    if (feeType === 'none') return product.import_price;
    if (feeType === 'percentage') return product.import_price * (1 - feePercentage / 100);
    return product.import_price - feeAmount;
  };

  const refundAmount = calculateRefund();
  const supplierKeepAmount = (product?.import_price || 0) - refundAmount;

  // Initialize payments when refund amount changes
  useEffect(() => {
    if (product) {
      setPayments([
        { id: '1', source: 'cash', amount: refundAmount, displayAmount: formatNumberWithSpaces(refundAmount) }
      ]);
    }
  }, [refundAmount]);

  if (!product) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chọn sản phẩm để trả hàng từ Lịch sử nhập hàng
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

  const handleSubmit = async () => {
    if (recordToCashBook && totalPayment !== refundAmount) {
      toast({
        title: 'Số tiền không khớp',
        description: `Tổng tiền hoàn trả phải bằng ${formatCurrencyWithSpaces(refundAmount)}`,
        variant: 'destructive',
      });
      return;
    }

    try {
      await createImportReturn.mutateAsync({
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          imei: product.imei,
          import_price: product.import_price,
          import_receipt_id: product.import_receipt_id,
          supplier_id: product.supplier_id,
          branch_id: product.branch_id,
          import_date: product.import_date,
        },
        feeType,
        feePercentage,
        feeAmount: feeType === 'fixed_amount' ? feeAmount : (feeType === 'percentage' ? supplierKeepAmount : 0),
        payments: recordToCashBook ? payments.filter(p => p.amount > 0).map(p => ({
          source: p.source,
          amount: p.amount,
        })) : [],
        recordToCashBook,
        note: note || null,
      });

      toast({
        title: 'Trả hàng thành công',
        description: `Đã trả ${product.name} cho nhà cung cấp`,
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể hoàn tất trả hàng',
        variant: 'destructive',
      });
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
              <p className="font-medium">{product.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">SKU</Label>
              <p className="font-medium">{product.sku}</p>
            </div>
            {product.imei && (
              <div>
                <Label className="text-muted-foreground">IMEI</Label>
                <p className="font-mono">{product.imei}</p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">Giá nhập</Label>
              <p className="font-bold text-primary">{formatCurrencyWithSpaces(product.import_price)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Nhà cung cấp</Label>
              <p>{product.suppliers?.name || '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Chi nhánh</Label>
              <p>{product.branches?.name || '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Ngày nhập</Label>
              <p>{new Date(product.import_date).toLocaleDateString('vi-VN')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fee Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hình thức trả hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={feeType}
            onValueChange={(v) => setFeeType(v as 'none' | 'percentage' | 'fixed_amount')}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <RadioGroupItem value="none" id="fee_none_import" />
              <Label htmlFor="fee_none_import" className="cursor-pointer flex-1">
                Trả lại đúng số tiền đã nhập (100%)
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <RadioGroupItem value="percentage" id="fee_pct_import" />
              <Label htmlFor="fee_pct_import" className="cursor-pointer flex-1">
                Trả hàng mất phí theo %
              </Label>
            </div>
            {feeType === 'percentage' && (
              <div className="ml-8">
                <Label className="text-xs text-muted-foreground">Phí (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={feePercentage || ''}
                  onChange={(e) => setFeePercentage(Number(e.target.value))}
                  placeholder="VD: 10"
                  className="w-32"
                />
              </div>
            )}
            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <RadioGroupItem value="fixed_amount" id="fee_fixed_import" />
              <Label htmlFor="fee_fixed_import" className="cursor-pointer flex-1">
                Trả hàng mất phí cố định
              </Label>
            </div>
            {feeType === 'fixed_amount' && (
              <div className="ml-8">
                <Label className="text-xs text-muted-foreground">Phí cố định</Label>
                <Input
                  value={feeDisplayAmount}
                  onChange={(e) => {
                    const num = parseFormattedNumber(e.target.value);
                    setFeeAmount(num);
                    setFeeDisplayAmount(formatNumberWithSpaces(num));
                  }}
                  placeholder="0"
                  className="w-48 text-right"
                />
              </div>
            )}
          </RadioGroup>

          {/* Summary */}
          <div className="mt-4 p-3 rounded-lg bg-muted/50 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Tổng giá nhập:</span>
              <span className="font-medium">{formatCurrencyWithSpaces(product.import_price)}</span>
            </div>
            {feeType !== 'none' && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Phí giữ lại:</span>
                <span className="font-medium">-{formatCurrencyWithSpaces(supplierKeepAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-primary font-bold">
              <span>Hoàn trả NCC:</span>
              <span>{formatCurrencyWithSpaces(refundAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash Book Toggle */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="record_to_cashbook_import"
              checked={recordToCashBook}
              onCheckedChange={(checked) => setRecordToCashBook(checked === true)}
            />
            <Label htmlFor="record_to_cashbook_import" className="cursor-pointer">
              <span className="font-medium">Ghi dòng tiền vào sổ quỹ</span>
              <p className="text-sm text-muted-foreground">
                Bỏ tích nếu không muốn ảnh hưởng sổ quỹ (ví dụ: bảo hành)
              </p>
            </Label>
          </div>
          {!recordToCashBook && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning">
              ⚠️ Giao dịch này sẽ KHÔNG được ghi vào sổ quỹ
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Lines */}
      {recordToCashBook && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Dòng tiền hoàn trả</CardTitle>
            <Button variant="outline" size="sm" onClick={handleAddPayment}>
              <Plus className="h-4 w-4 mr-1" />
              Thêm
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payments.map((payment, index) => (
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
                {remaining !== 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Còn thiếu:</span>
                    <span className="font-bold">{formatCurrencyWithSpaces(Math.abs(remaining))}</span>
                  </div>
                )}
              </div>
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
          disabled={createImportReturn.isPending || (recordToCashBook && remaining !== 0)}
        >
          {createImportReturn.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Xác nhận trả hàng
        </Button>
      </div>
    </div>
  );
}
