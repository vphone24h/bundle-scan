import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Percent, Calendar, Wallet, Trash2, AlertCircle, Play, Square } from 'lucide-react';
import { formatNumber, formatInputNumber, parseFormattedNumber } from '@/lib/formatNumber';
import {
  useCompanyInterestEnabled,
  useDebtInterestConfig,
  useDebtInterestPayments,
  useAccruedInterest,
  useSaveInterestConfig,
  useStopInterestConfig,
  usePayInterest,
  useDeleteInterestPayment,
} from '@/hooks/useDebtInterest';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Props {
  entityType: 'customer' | 'supplier';
  entityId: string;
  mergedEntityIds?: string[];
}

export function DebtInterestTab({ entityType, entityId, mergedEntityIds }: Props) {
  const { enabled: featureEnabled, adminPhone } = useCompanyInterestEnabled();
  const { data: config } = useDebtInterestConfig(entityType, entityId);
  const { data: payments } = useDebtInterestPayments(entityType, entityId);
  const accrual = useAccruedInterest(entityType, entityId, mergedEntityIds);

  const saveConfig = useSaveInterestConfig();
  const stopConfig = useStopInterestConfig();
  const payInterest = usePayInterest();
  const deletePayment = useDeleteInterestPayment();

  const [rateInput, setRateInput] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');

  useEffect(() => {
    if (config?.monthly_rate_percent != null) {
      setRateInput(String(config.monthly_rate_percent));
    }
  }, [config?.monthly_rate_percent]);

  // Feature OFF — show contact admin
  if (!featureEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <div className="rounded-full bg-orange-100 dark:bg-orange-950 p-4 mb-4">
          <AlertCircle className="h-8 w-8 text-orange-600" />
        </div>
        <h3 className="font-semibold text-base mb-2">Tính năng tính lãi đang tắt</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          Vui lòng liên hệ admin công ty để bật chức năng tính lãi công nợ.
        </p>
        {adminPhone ? (
          <a
            href={`tel:${adminPhone}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
          >
            <Phone className="h-4 w-4" />
            {adminPhone}
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">(Chưa có số liên hệ admin)</p>
        )}
      </div>
    );
  }

  const isActive = !!config?.is_active;

  const handleSaveConfig = () => {
    const rate = Number(rateInput);
    if (!rate || rate <= 0) return;
    saveConfig.mutate({
      entity_type: entityType,
      entity_id: entityId,
      monthly_rate_percent: rate,
      existing_id: config?.id || null,
      // Reset start_date when activating fresh, keep when only updating rate of active
      start_date: !isActive ? new Date().toISOString() : undefined,
    });
  };

  const handlePayInterest = () => {
    const amt = parseFormattedNumber(payAmount);
    if (!amt || amt <= 0) return;
    payInterest.mutate(
      { entity_type: entityType, entity_id: entityId, amount: amt, note: payNote.trim() || undefined },
      {
        onSuccess: () => {
          setPayAmount('');
          setPayNote('');
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Config card */}
      <Card className="border-orange-200 bg-orange-50/30 dark:bg-orange-950/20 dark:border-orange-900">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <Percent className="h-4 w-4 text-orange-600" />
              Cấu hình lãi suất
            </div>
            {isActive ? (
              <Badge className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300">
                Đang tính lãi
              </Badge>
            ) : (
              <Badge variant="outline">Chưa bật</Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Lãi suất / tháng (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                placeholder="VD: 5"
              />
            </div>
            <Button
              onClick={handleSaveConfig}
              disabled={saveConfig.isPending || !rateInput || Number(rateInput) <= 0}
              className="gap-1"
            >
              <Play className="h-4 w-4" />
              {isActive ? 'Cập nhật' : 'Bắt đầu'}
            </Button>
          </div>

          {isActive && config && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-2 border-t">
              <Calendar className="h-3.5 w-3.5" />
              Bắt đầu tính lãi từ: <span className="font-medium text-foreground">
                {format(new Date(config.start_date), 'dd/MM/yyyy HH:mm', { locale: vi })}
              </span>
            </div>
          )}

          {isActive && config && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1 text-destructive hover:text-destructive"
              onClick={() => stopConfig.mutate(config.id)}
              disabled={stopConfig.isPending}
            >
              <Square className="h-3.5 w-3.5" />
              Dừng tính lãi
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {isActive && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Tổng lãi phát sinh</p>
                <p className="font-bold text-orange-600">{formatNumber(Math.round(accrual.accrued))}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Đã đóng lãi</p>
                <p className="font-bold text-green-600">{formatNumber(Math.round(accrual.paidInterest))}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Lãi còn lại</p>
                <p className="font-bold text-destructive">{formatNumber(Math.round(accrual.remainingInterest))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pay interest */}
      {isActive && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Wallet className="h-4 w-4 text-green-600" />
              Đóng lãi (chỉ trừ lãi, không liên quan gốc)
            </div>
            <div>
              <Label className="text-xs">Số tiền đóng lãi</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={payAmount}
                onChange={(e) => setPayAmount(formatInputNumber(e.target.value))}
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs">Ghi chú (tùy chọn)</Label>
              <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="..." />
            </div>
            <Button
              onClick={handlePayInterest}
              disabled={payInterest.isPending || !payAmount}
              className="w-full"
            >
              Xác nhận đóng lãi
            </Button>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {(payments?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Lịch sử đóng lãi</p>
          {(payments || []).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50/40 dark:bg-green-950/20 dark:border-green-900 p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  {format(new Date(p.paid_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </p>
                {p.note && <p className="text-sm truncate">{p.note}</p>}
              </div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-green-600">-{formatNumber(p.amount)}</p>
                <button
                  type="button"
                  onClick={() => deletePayment.mutate(p.id)}
                  className="p-1 rounded hover:bg-muted text-destructive"
                  title="Xóa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}