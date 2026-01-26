import { useState } from 'react';
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
  const [reason, setReason] = useState('');
  const einvoiceAPI = useEInvoiceAPI();

  const handleCancel = async () => {
    if (!reason.trim()) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập lý do huỷ hoá đơn',
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
        title: 'Thành công',
        description: 'Hoá đơn đã được huỷ',
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể huỷ hoá đơn',
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
            Huỷ hoá đơn
          </DialogTitle>
          <DialogDescription>
            Bạn đang huỷ hoá đơn số {invoice.invoice_series}/{invoice.invoice_number}.
            Hành động này sẽ được gửi lên cơ quan thuế và không thể hoàn tác.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Lý do huỷ hoá đơn *</Label>
            <Textarea
              id="reason"
              placeholder="Nhập lý do huỷ hoá đơn (bắt buộc)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={einvoiceAPI.isPending || !reason.trim()}
          >
            {einvoiceAPI.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Xác nhận huỷ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
