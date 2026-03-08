import { useState, useEffect, useMemo } from 'react';
import { PaymentSource } from '@/types/warehouse';
import { formatCurrency } from '@/lib/mockData';
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
import { Banknote, CreditCard, Wallet, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCustomPaymentSources } from '@/hooks/useCustomPaymentSources';
import { useTranslation } from 'react-i18next';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  totalAmount: number;
  onConfirm: (payments: PaymentSource[], skipCashBook?: boolean) => void;
  isSubmitting?: boolean;
}

type PaymentType = string;

export function PaymentDialog({ open, onClose, totalAmount, onConfirm, isSubmitting = false }: PaymentDialogProps) {
  const { t } = useTranslation();
  const { data: customPaymentSources = [] } = useCustomPaymentSources();

  const builtInPaymentOptions = useMemo(() => [
    { type: 'cash', label: t('common.cash'), icon: <Banknote className="h-5 w-5" /> },
    { type: 'bank_card', label: t('common.bankCard'), icon: <CreditCard className="h-5 w-5" /> },
    { type: 'e_wallet', label: t('common.eWallet'), icon: <Wallet className="h-5 w-5" /> },
    { type: 'debt', label: t('common.debt'), icon: <Clock className="h-5 w-5" /> },
  ], [t]);

  const paymentOptions = useMemo(() => {
    const custom = customPaymentSources.map(s => ({
      type: s.id,
      label: s.name,
      icon: <Wallet className="h-5 w-5" />,
    }));
    return [...builtInPaymentOptions, ...custom];
  }, [customPaymentSources, builtInPaymentOptions]);

  const [selectedTypes, setSelectedTypes] = useState<PaymentType[]>(['cash']);
  const [addToCashBook, setAddToCashBook] = useState(true);
  const [amounts, setAmounts] = useState<Record<PaymentType, number>>({
    cash: totalAmount,
    bank_card: 0,
    e_wallet: 0,
    debt: 0,
  });

  useEffect(() => {
    if (open) {
      setSelectedTypes(['cash']);
      setAddToCashBook(true);
      setAmounts({
        cash: totalAmount,
        bank_card: 0,
        e_wallet: 0,
        debt: 0,
      });
    }
  }, [open, totalAmount]);

  const togglePaymentType = (type: PaymentType) => {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length === 1) return;
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
      setAmounts({ ...amounts, [type]: 0 });
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const totalPaid = selectedTypes.reduce((sum, type) => sum + (amounts[type] || 0), 0);
  const isValid = totalPaid === totalAmount;
  const difference = totalPaid - totalAmount;

  const handleConfirm = () => {
    const payments: PaymentSource[] = selectedTypes
      .filter((type) => amounts[type] > 0)
      .map((type) => ({ type, amount: amounts[type] }));
    onClose();
    onConfirm(payments, !addToCashBook);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('common.importPayment')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="rounded-lg bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground">{t('common.totalImportAmount')}</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</p>
          </div>

          {/* Cash book toggle */}
          <div className="flex items-center space-x-2 pt-2 border-t">
            <Checkbox
              id="add-to-cashbook"
              checked={addToCashBook}
              onCheckedChange={(checked) => setAddToCashBook(checked === true)}
            />
            <Label htmlFor="add-to-cashbook" className="cursor-pointer text-sm">
              {t('common.recordToCashBook')}
            </Label>
          </div>
          {!addToCashBook && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {t('common.noCashBookImpact')}
            </p>
          )}

          {addToCashBook && (
            <>
              <div className="space-y-3">
                <Label>{t('common.selectPaymentSource')}</Label>
                <div className="grid grid-cols-2 gap-3">
                  {paymentOptions.map((option) => (
                    <button
                      key={option.type}
                      onClick={() => togglePaymentType(option.type)}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-lg border transition-all',
                        selectedTypes.includes(option.type)
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-muted-foreground'
                      )}
                    >
                      {option.icon}
                      <span className="text-sm font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>{t('common.enterAmountPerSource')}</Label>
                {selectedTypes.map((type) => {
                  const option = paymentOptions.find((o) => o.type === type)!;
                  const remaining = totalAmount - selectedTypes.reduce((sum, t) => t === type ? sum : sum + (amounts[t] || 0), 0);
                  return (
                    <div key={type} className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 w-32">
                          {option.icon}
                          <span className="text-sm">{option.label}</span>
                        </div>
                        <Input
                          type="number"
                          value={amounts[type] || ''}
                          onChange={(e) =>
                            setAmounts({ ...amounts, [type]: Number(e.target.value) || 0 })
                          }
                          className="flex-1"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex gap-1.5 ml-[8.5rem]">
                        {[totalAmount, remaining > 0 ? remaining : null, ...[500000, 1000000, 5000000, 10000000].filter(v => v <= totalAmount)].filter((v, i, arr) => v != null && v > 0 && arr.indexOf(v) === i).slice(0, 4).map((quickVal) => (
                          <button
                            key={quickVal}
                            type="button"
                            onClick={() => setAmounts({ ...amounts, [type]: quickVal! })}
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded border transition-colors',
                              amounts[type] === quickVal
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                            )}
                          >
                            {quickVal! >= 1000000 ? `${(quickVal! / 1000000).toLocaleString('vi-VN')}tr` : `${(quickVal! / 1000).toLocaleString('vi-VN')}k`}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('common.totalEntered')}:</span>
                  <span className="font-medium">{formatCurrency(totalPaid)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('common.needToPay')}:</span>
                  <span className="font-medium">{formatCurrency(totalAmount)}</span>
                </div>
                {!isValid && (
                  <div
                    className={cn(
                      'flex items-center gap-2 text-sm pt-2 border-t',
                      difference > 0 ? 'text-warning' : 'text-destructive'
                    )}
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span>
                      {difference > 0
                        ? `${t('common.surplus')} ${formatCurrency(difference)}`
                        : `${t('common.shortage')} ${formatCurrency(Math.abs(difference))}`}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={addToCashBook && !isValid}>
            {t('common.confirmPayment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
