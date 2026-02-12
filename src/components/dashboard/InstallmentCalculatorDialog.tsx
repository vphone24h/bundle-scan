import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PriceInput } from '@/components/ui/price-input';
import { formatNumber } from '@/lib/formatNumber';
import { Calculator } from 'lucide-react';

interface InstallmentCalculatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BANK_OPTIONS = [
  { label: 'Mirae Asset', rate: 2.5 },
  { label: 'Home Credit', rate: 2 },
  { label: 'HD SAISON', rate: 2 },
  { label: 'FE Credit', rate: 2.5 },
];

export function InstallmentCalculatorDialog({ open, onOpenChange }: InstallmentCalculatorDialogProps) {
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [downPayment, setDownPayment] = useState<number>(0);
  const [months, setMonths] = useState<number>(9);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [customRate, setCustomRate] = useState<string>('');
  const [calculated, setCalculated] = useState(false);

  const interestRate = useMemo(() => {
    if (selectedBank === '_custom_') {
      return parseFloat(customRate) || 0;
    }
    const bank = BANK_OPTIONS.find(b => b.label === selectedBank);
    return bank ? bank.rate : 0;
  }, [selectedBank, customRate]);

  const result = useMemo(() => {
    if (!calculated || totalAmount <= 0 || months <= 0) return null;
    const principal = totalAmount - downPayment;
    if (principal <= 0) return null;
    const rateDecimal = interestRate / 100;
    const monthlyPayment = (principal + principal * rateDecimal * months) / months;
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + months, 1);
    return {
      monthlyPayment: Math.round(monthlyPayment),
      principal,
      totalInterest: Math.round(principal * rateDecimal * months),
      totalPay: Math.round(principal + principal * rateDecimal * months),
      startMonth,
      endMonth,
    };
  }, [calculated, totalAmount, downPayment, months, interestRate]);

  const handleCalculate = () => {
    setCalculated(true);
  };

  const handleReset = () => {
    setTotalAmount(0);
    setDownPayment(0);
    setMonths(9);
    setSelectedBank('');
    setCustomRate('');
    setCalculated(false);
  };

  const formatMonth = (d: Date) => {
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Tính toán tiền trả góp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Nhập các thông tin cần thiết, bạn sẽ nhận được kết quả mà khách hàng phải trả hằng tháng.
          </p>

          <div className="space-y-1.5">
            <Label>Tổng giá trị hàng hoá (thiết bị)</Label>
            <PriceInput value={totalAmount} onChange={setTotalAmount} placeholder="VD: 20,990,000" />
          </div>

          <div className="space-y-1.5">
            <Label>Số tiền trả trước</Label>
            <PriceInput value={downPayment} onChange={setDownPayment} placeholder="VD: 6,300,000" />
          </div>

          <div className="space-y-1.5">
            <Label>Số tháng khách muốn trả</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={months}
              onChange={e => setMonths(parseInt(e.target.value) || 0)}
              placeholder="VD: 9"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Mức lãi (ngân hàng)</Label>
            <Select value={selectedBank} onValueChange={(v) => { setSelectedBank(v); setCalculated(false); }}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn ngân hàng hoặc tự điền..." />
              </SelectTrigger>
              <SelectContent>
                {BANK_OPTIONS.map(b => (
                  <SelectItem key={b.label} value={b.label}>
                    {b.label} ({b.rate}%)
                  </SelectItem>
                ))}
                <SelectItem value="_custom_">Tự điền lãi suất...</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedBank === '_custom_' && (
            <div className="space-y-1.5">
              <Label>Hệ số lãi (%/tháng)</Label>
              <Input
                type="number"
                step="0.1"
                min={0}
                value={customRate}
                onChange={e => { setCustomRate(e.target.value); setCalculated(false); }}
                placeholder="VD: 2.5"
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleCalculate} className="flex-1">
              TÍNH TOÁN
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Xoá
            </Button>
          </div>

          {result && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3 border">
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Từ</p>
                  <p className="text-lg font-bold">{formatMonth(result.startMonth)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Đến</p>
                  <p className="text-lg font-bold">{formatMonth(result.endMonth)}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t pt-3">
                <p className="text-sm font-semibold uppercase">Khách phải trả hằng tháng</p>
                <p className="text-xl font-bold text-primary">{formatNumber(result.monthlyPayment)}đ</p>
              </div>

              <div className="text-xs text-muted-foreground space-y-1 border-t pt-2">
                <p>* Hệ số lãi: {interestRate}% ({(interestRate / 100).toFixed(4)})</p>
                <p>* Gốc vay: {formatNumber(result.principal)}đ</p>
                <p>* Tổng tiền lãi: {formatNumber(result.totalInterest)}đ</p>
                <p>* Tổng phải trả: {formatNumber(result.totalPay)}đ</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
