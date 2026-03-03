import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebtSettings, useUpsertDebtSettings } from '@/hooks/useDebtSettings';
import { toast } from 'sonner';
import { Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DebtSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_DAYS = [7, 15, 30, 60];

export function DebtSettingsDialog({ open, onOpenChange }: DebtSettingsDialogProps) {
  const { t } = useTranslation();
  const { data: settings } = useDebtSettings();
  const upsert = useUpsertDebtSettings();
  const [days, setDays] = useState(15);

  useEffect(() => {
    if (settings) setDays(settings.overdue_days);
  }, [settings]);

  const handleSave = async () => {
    if (days < 1 || days > 365) {
      toast.error(t('common.error'));
      return;
    }
    try {
      await upsert.mutateAsync(days);
      toast.success(t('common.success'));
      onOpenChange(false);
    } catch {
      toast.error(t('common.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            {t('common.debtSettings')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t('common.overdueDaysSetting')}</Label>
            <p className="text-xs text-muted-foreground mb-2">
              {t('common.overdueDaysDesc')}
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_DAYS.map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant={days === d ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDays(d)}
                >
                  {d} {t('common.dayUnit')}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              placeholder={t('common.customDays')}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
