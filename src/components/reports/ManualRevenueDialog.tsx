import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Calculator } from 'lucide-react';
import { formatCurrency } from '@/lib/mockData';

const INDUSTRIES = [
  { value: 'thuong_mai', label: 'Thương mại', gtgt: 1, tncn: 0.5, hint: 'Bán iPhone chọn mục này' },
  { value: 'dich_vu', label: 'Dịch vụ', gtgt: 5, tncn: 2 },
  { value: 'san_xuat', label: 'Sản xuất', gtgt: 3, tncn: 1.5 },
  { value: 'van_tai', label: 'Vận tải – Ăn uống', gtgt: 3, tncn: 1.5 },
  { value: 'cho_thue', label: 'Cho thuê tài sản', gtgt: 5, tncn: 5 },
];

const QUARTERS = [
  { value: 'q1', label: 'Quý 1 (Tháng 1-3)' },
  { value: 'q2', label: 'Quý 2 (Tháng 4-6)' },
  { value: 'q3', label: 'Quý 3 (Tháng 7-9)' },
  { value: 'q4', label: 'Quý 4 (Tháng 10-12)' },
];

const TAX_METHODS = [
  { value: 'revenue', label: 'Theo doanh số' },
  { value: 'profit', label: 'Theo lợi nhuận' },
];

export interface ManualRevenueData {
  revenue: number;
  profit: number;
  quarter: string;
  industry: string;
  taxMethod: string;
}

interface ManualRevenueDialogProps {
  onApply: (data: ManualRevenueData) => void;
}

export function ManualRevenueDialog({ onApply }: ManualRevenueDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [revenue, setRevenue] = useState('');
  const [profit, setProfit] = useState('');
  const [quarter, setQuarter] = useState('');
  const [industry, setIndustry] = useState('');
  const [taxMethod, setTaxMethod] = useState('');

  const revenueNum = parseFloat(revenue.replace(/[,.]/g, '')) || 0;
  const profitNum = parseFloat(profit.replace(/[,.]/g, '')) || 0;
  const mustUseProfit = revenueNum >= 3_000_000_000;

  const selectedIndustry = INDUSTRIES.find(i => i.value === industry);

  // Auto-force profit method if revenue >= 3B
  const effectiveMethod = mustUseProfit ? 'profit' : taxMethod;

  // Calculate preview
  const taxPreview = (() => {
    if (!selectedIndustry || !effectiveMethod) return null;
    
    const gtgt = revenueNum * (selectedIndustry.gtgt / 100);
    let tncn = 0;

    if (effectiveMethod === 'revenue') {
      const taxableRevenue = Math.max(0, revenueNum - 500_000_000);
      tncn = taxableRevenue * (selectedIndustry.tncn / 100);
    } else {
      // Determine rate based on annual revenue estimate
      let tncnRate = 0.15;
      if (revenueNum >= 50_000_000_000) tncnRate = 0.20;
      else if (revenueNum >= 3_000_000_000) tncnRate = 0.17;
      tncn = Math.max(0, profitNum) * tncnRate;
    }

    return { gtgt, tncn, total: gtgt + tncn };
  })();

  const canProceedStep1 = !!revenue && !!quarter && revenueNum > 0;
  const canProceedStep2 = !!industry;
  const canProceedStep3 = !!effectiveMethod;

  const handleReset = () => {
    setStep(1);
    setRevenue('');
    setProfit('');
    setQuarter('');
    setIndustry('');
    setTaxMethod('');
  };

  const handleApply = () => {
    onApply({
      revenue: revenueNum,
      profit: profitNum,
      quarter,
      industry,
      taxMethod: effectiveMethod,
    });
    setOpen(false);
  };

  const formatInputNumber = (val: string) => {
    const num = val.replace(/[^\d]/g, '');
    if (!num) return '';
    return parseInt(num).toLocaleString('vi-VN');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) handleReset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Tự điền doanh thu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Tự điền doanh thu & lợi nhuận
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Dành cho cửa hàng mới chưa có dữ liệu trên hệ thống
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-1">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  step === s ? 'bg-primary text-primary-foreground' :
                  step > s ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {step > s ? '✓' : s}
                </div>
                <span className={step === s ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                  {s === 1 ? 'Nhập số liệu' : s === 2 ? 'Ngành nghề' : 'Hình thức'}
                </span>
                {s < 3 && <span className="text-muted-foreground mx-1">→</span>}
              </div>
            ))}
          </div>

          {/* Step 1: Revenue + Profit + Quarter */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Chọn quý kê khai <span className="text-destructive">*</span></Label>
                <Select value={quarter} onValueChange={setQuarter}>
                  <SelectTrigger><SelectValue placeholder="Chọn quý..." /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {QUARTERS.map(q => (
                      <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Doanh thu trong quý (VNĐ) <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="VD: 500,000,000"
                  value={revenue}
                  onChange={e => setRevenue(formatInputNumber(e.target.value))}
                  inputMode="numeric"
                />
                {revenueNum > 0 && (
                  <p className="text-xs text-muted-foreground">= {formatCurrency(revenueNum)}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Lợi nhuận trong quý (VNĐ)</Label>
                <Input
                  placeholder="VD: 100,000,000"
                  value={profit}
                  onChange={e => setProfit(formatInputNumber(e.target.value))}
                  inputMode="numeric"
                />
                {profitNum > 0 && (
                  <p className="text-xs text-muted-foreground">= {formatCurrency(profitNum)}</p>
                )}
                <p className="text-[10px] text-muted-foreground italic">
                  Lợi nhuận = Doanh thu - Chi phí. Cần nhập nếu chọn hình thức kê khai theo lợi nhuận.
                </p>
              </div>

              <Button 
                className="w-full" 
                onClick={() => setStep(2)} 
                disabled={!canProceedStep1}
              >
                Tiếp tục → Chọn ngành nghề
              </Button>
            </div>
          )}

          {/* Step 2: Industry */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Chọn ngành nghề <span className="text-destructive">*</span></Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger><SelectValue placeholder="Chọn ngành nghề..." /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {INDUSTRIES.map(i => (
                      <SelectItem key={i.value} value={i.value}>
                        {i.label} (GTGT {i.gtgt}% – TNCN {i.tncn}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedIndustry?.hint && (
                  <p className="text-xs text-muted-foreground italic">💡 {selectedIndustry.hint}</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  ← Quay lại
                </Button>
                <Button className="flex-1" onClick={() => setStep(3)} disabled={!canProceedStep2}>
                  Tiếp tục →
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Tax Method + Result */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Hình thức kê khai <span className="text-destructive">*</span></Label>
                <Select 
                  value={effectiveMethod} 
                  onValueChange={setTaxMethod}
                  disabled={mustUseProfit}
                >
                  <SelectTrigger><SelectValue placeholder="Chọn hình thức..." /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {TAX_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mustUseProfit && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ Doanh thu từ 3 tỷ trở lên bắt buộc kê khai theo lợi nhuận
                  </p>
                )}
              </div>

              {/* Tax Preview */}
              {taxPreview && canProceedStep3 && (
                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
                  <p className="text-sm font-medium text-center">Số thuế phải đóng (ước tính)</p>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Thuế GTGT ({selectedIndustry?.gtgt}%)</p>
                      <p className="text-sm font-bold text-primary">{formatCurrency(taxPreview.gtgt)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Thuế TNCN</p>
                      <p className="text-sm font-bold text-primary">{formatCurrency(taxPreview.tncn)}</p>
                    </div>
                  </div>
                  <div className="text-center pt-2 border-t border-primary/20">
                    <p className="text-[10px] text-muted-foreground">TỔNG THUẾ PHẢI NỘP</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(taxPreview.total)}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                  ← Quay lại
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleApply} 
                  disabled={!canProceedStep3}
                >
                  Áp dụng & xuất Excel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
