import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';
import { EInvoice, useEInvoiceAPI } from '@/hooks/useEInvoice';
import { toast } from '@/hooks/use-toast';

interface EInvoiceCancelDialogProps {
  invoice: EInvoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EInvoiceCancelDialog({ invoice, open, onOpenChange }: EInvoiceCancelDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const einvoiceAPI = useEInvoiceAPI();

  const handleCancel = async () => {
    if (!reason.trim()) {
      toast({
        title: t('common.error'),
        description: t('pages.eInvoice.cancelReasonRequired'),
        variant: 'destructive',
      });
      return;
    }

    try {
      await einvoiceAPI.mutateAsync({
        action: 'cancel',
        data: {
          einvoiceId: invoice.id,
          reason: reason.trim(),
        },
      });

      toast({
        title: t('common.success'),
        description: t('pages.eInvoice.cancelSuccess'),
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('pages.eInvoice.cancelError'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('pages.eInvoice.cancelInvoice')}
          </DialogTitle>
          <DialogDescription>
            {t('pages.eInvoice.cancelInvoiceDesc', { series: invoice.invoice_series, number: invoice.invoice_number })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">{t('pages.eInvoice.cancelReason')}</Label>
            <Textarea
              id="reason"
              placeholder={t('pages.eInvoice.cancelReasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={einvoiceAPI.isPending || !reason.trim()}
          >
            {einvoiceAPI.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('pages.eInvoice.confirmCancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}