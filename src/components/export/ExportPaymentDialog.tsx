import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Banknote, CreditCard, Wallet, FileText, Star, Gift } from 'lucide-react';
import { formatNumber, formatInputNumber, parseFormattedNumber } from '@/lib/formatNumber';
import type { ExportPayment } from '@/hooks/useExportReceipts';

interface CustomerPointInfo {
  current_points: number;
  pending_points: number;
  membership_tier: string;
}

interface PointSettings {
  is_enabled: boolean;
  redeem_points: number;
  redeem_value: number;
  max_redeem_percentage: number;
}

interface ExportPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  onConfirm: (payments: ExportPayment[], pointsRedeemed: number, pointsDiscount: number) => void;
  isLoading?: boolean;
  customerPoints?: CustomerPointInfo | null;
  pointSettings?: PointSettings | null;
}

const paymentTypes = [
  { type: 'cash' as const, label: 'Tiền mặt', icon: Banknote },
  { type: 'bank_card' as const, label: 'Thẻ ngân hàng', icon: CreditCard },
  { type: 'e_wallet' as const, label: 'Ví điện tử', icon: Wallet },
  { type: 'debt' as const, label: 'Công nợ', icon: FileText },
];

const MEMBERSHIP_TIER_NAMES: Record<string, string> = {
  regular: 'Thường',
  silver: 'Bạc',
  gold: 'Vàng',
  vip: 'VIP',
};

export function ExportPaymentDialog({
  open,
  onOpenChange,
  totalAmount,
  onConfirm,
  isLoading,
  customerPoints,
  pointSettings,
}: ExportPaymentDialogProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['cash']);
  const [amounts, setAmounts] = useState<Record<string, string>>({
    cash: '',
    bank_card: '',
    e_wallet: '',
    debt: '',
  });

  // Points redemption
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState('');

  // Calculate max points that can be redeemed
  const maxRedeemByPercentage = pointSettings?.max_redeem_percentage 
    ? Math.floor(totalAmount * pointSettings.max_redeem_percentage / 100 / (pointSettings.redeem_value / pointSettings.redeem_points))
    : 0;
  const maxRedeemByBalance = customerPoints?.current_points || 0;
  const maxPointsCanRedeem = Math.min(maxRedeemByPercentage, maxRedeemByBalance);

  // Calculate discount from points
  const pointsValue = pointSettings ? 
    Math.floor(parseFormattedNumber(pointsToRedeem) / pointSettings.redeem_points) * pointSettings.redeem_value : 0;
  
  // Ensure points discount doesn't exceed total
  const actualPointsDiscount = Math.min(pointsValue, totalAmount);
  const actualPointsUsed = pointSettings && actualPointsDiscount > 0 ? 
    Math.ceil(actualPointsDiscount / pointSettings.redeem_value * pointSettings.redeem_points) : 0;

  // Adjusted total after points discount
  const adjustedTotal = totalAmount - actualPointsDiscount;

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedTypes(['cash']);
      setAmounts({
        cash: totalAmount.toString(),
        bank_card: '',
        e_wallet: '',
        debt: '',
      });
      setUsePoints(false);
      setPointsToRedeem('');
    }
  }, [open, totalAmount]);

  // Update cash amount when points are used
  useEffect(() => {
    if (usePoints && actualPointsDiscount > 0) {
      // Recalculate cash amount
      const otherPayments = selectedTypes
        .filter(t => t !== 'cash' && t !== 'debt')
        .reduce((sum, t) => sum + (parseFloat(amounts[t]) || 0), 0);
      const debtAmt = parseFloat(amounts.debt) || 0;
      const remaining = adjustedTotal - otherPayments - debtAmt;
      
      if (remaining >= 0 && selectedTypes.includes('cash')) {
        setAmounts(prev => ({ ...prev, cash: remaining.toString() }));
      }
    }
  }, [actualPointsDiscount, usePoints]);

  const togglePaymentType = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
      setAmounts({ ...amounts, [type]: '' });
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleAmountChange = (type: string, value: string) => {
    setAmounts({ ...amounts, [type]: value });
  };

  // Calculate totals
  const paidTotal = selectedTypes
    .filter((t) => t !== 'debt')
    .reduce((sum, type) => sum + (parseFloat(amounts[type]) || 0), 0);
  
  const debtAmount = parseFloat(amounts.debt) || 0;
  const totalEntered = paidTotal + debtAmount;
  const remaining = adjustedTotal - totalEntered;

  // Auto-fill remaining to last selected payment
  const handleAutoFill = () => {
    if (remaining > 0 && selectedTypes.length > 0) {
      const lastType = selectedTypes[selectedTypes.length - 1];
      const currentAmount = parseFloat(amounts[lastType]) || 0;
      setAmounts({ ...amounts, [lastType]: (currentAmount + remaining).toString() });
    }
  };

  const handleConfirm = () => {
    const payments: ExportPayment[] = selectedTypes
      .map((type) => ({
        payment_type: type as ExportPayment['payment_type'],
        amount: parseFloat(amounts[type]) || 0,
      }))
      .filter((p) => p.amount > 0);

    onConfirm(payments, usePoints ? actualPointsUsed : 0, usePoints ? actualPointsDiscount : 0);
  };

  const canUsePoints = pointSettings?.is_enabled && (customerPoints?.current_points || 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thanh toán</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Total amount */}
          <div className="p-4 bg-muted rounded-lg text-center">
            <div className="text-sm text-muted-foreground">Tổng tiền cần thanh toán</div>
            <div className="text-2xl font-bold text-primary">
              {formatNumber(totalAmount)}đ
            </div>
            {actualPointsDiscount > 0 && (
              <div className="text-sm text-green-600 mt-1">
                Giảm giá điểm: -{formatNumber(actualPointsDiscount)}đ
              </div>
            )}
            {actualPointsDiscount > 0 && (
              <div className="text-lg font-semibold mt-1">
                Còn lại: {formatNumber(adjustedTotal)}đ
              </div>
            )}
          </div>

          {/* Points redemption */}
          {canUsePoints && (
            <div className="p-4 border rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  <span className="font-medium">Đổi điểm thưởng</span>
                </div>
                <Badge variant="outline">
                  {MEMBERSHIP_TIER_NAMES[customerPoints?.membership_tier || 'regular']}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Gift className="h-4 w-4" />
                <span>
                  Điểm hiện có: <strong className="text-foreground">{formatNumber(customerPoints?.current_points || 0)}</strong>
                  {(customerPoints?.pending_points || 0) > 0 && (
                    <span className="text-yellow-600"> (+{formatNumber(customerPoints?.pending_points || 0)} treo)</span>
                  )}
                </span>
              </div>

              <div className="flex items-center space-x-2 mb-3">
                <Checkbox
                  id="use-points"
                  checked={usePoints}
                  onCheckedChange={(checked) => {
                    setUsePoints(checked === true);
                    if (!checked) {
                      setPointsToRedeem('');
                    }
                  }}
                />
                <Label htmlFor="use-points" className="cursor-pointer">
                  Sử dụng điểm để giảm giá
                </Label>
              </div>

              {usePoints && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Số điểm muốn dùng"
                      value={pointsToRedeem}
                      onChange={(e) => setPointsToRedeem(formatInputNumber(e.target.value))}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPointsToRedeem(formatNumber(maxPointsCanRedeem))}
                    >
                      Tối đa
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tối đa có thể dùng: {formatNumber(maxPointsCanRedeem)} điểm 
                    (= {formatNumber(Math.floor(maxPointsCanRedeem / (pointSettings?.redeem_points || 1)) * (pointSettings?.redeem_value || 0))}đ)
                    <br />
                    Quy đổi: {pointSettings?.redeem_points} điểm = {formatNumber(pointSettings?.redeem_value || 0)}đ
                    <br />
                    Giới hạn: Tối đa {pointSettings?.max_redeem_percentage}% giá trị đơn hàng
                  </div>
                  {actualPointsUsed > 0 && (
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded text-sm text-green-700 dark:text-green-300">
                      Dùng <strong>{formatNumber(actualPointsUsed)}</strong> điểm → 
                      Giảm <strong>{formatNumber(actualPointsDiscount)}đ</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Payment types */}
          <div className="space-y-3">
            {paymentTypes.map(({ type, label, icon: Icon }) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={type}
                    checked={selectedTypes.includes(type)}
                    onCheckedChange={() => togglePaymentType(type)}
                  />
                  <Label
                    htmlFor={type}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Label>
                </div>
                {selectedTypes.includes(type) && (
                  <Input
                    type="number"
                    placeholder="Nhập số tiền"
                    value={amounts[type]}
                    onChange={(e) => handleAmountChange(type, e.target.value)}
                    className="ml-6"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="pt-4 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span>Đã nhập:</span>
              <span className="font-medium">{formatNumber(totalEntered)}đ</span>
            </div>
            {remaining !== 0 && (
              <div className="flex justify-between text-sm">
                <span>{remaining > 0 ? 'Còn thiếu:' : 'Thừa:'}</span>
                <span className={remaining > 0 ? 'text-destructive font-medium' : 'text-green-600 font-medium'}>
                  {formatNumber(Math.abs(remaining))}đ
                </span>
              </div>
            )}
            {remaining > 0 && (
              <Button variant="outline" size="sm" onClick={handleAutoFill} className="w-full">
                Điền tự động số còn thiếu
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || remaining > 0 || totalEntered === 0}
          >
            {isLoading ? 'Đang xử lý...' : 'Hoàn tất xuất hàng'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
