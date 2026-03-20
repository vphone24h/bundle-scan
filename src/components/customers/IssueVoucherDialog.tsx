import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useVoucherTemplates, useIssueVoucher } from '@/hooks/useVouchers';
import { formatNumber, formatInputNumber, parseFormattedNumber } from '@/lib/formatNumber';
import { toast } from 'sonner';
import { Ticket } from 'lucide-react';

interface IssueVoucherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
}

export function IssueVoucherDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  customerPhone,
  customerEmail,
}: IssueVoucherDialogProps) {
  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customName, setCustomName] = useState('');
  const [customDiscountType, setCustomDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [customDiscountValue, setCustomDiscountValue] = useState('');

  const { data: templates } = useVoucherTemplates();
  const issueVoucher = useIssueVoucher();

  const activeTemplates = templates?.filter(t => t.is_active) || [];

  const handleSubmit = async () => {
    try {
      if (mode === 'template') {
        if (!selectedTemplateId) {
          toast.error('Vui lòng chọn voucher mẫu');
          return;
        }
        await issueVoucher.mutateAsync({
          customer_id: customerId,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail || undefined,
          voucher_template_id: selectedTemplateId,
          source: 'manual',
        });
      } else {
        // Custom voucher - use the issue voucher with a custom approach
        if (!customName.trim()) {
          toast.error('Vui lòng nhập tên voucher');
          return;
        }
        const value = parseFormattedNumber(customDiscountValue);
        if (value <= 0) {
          toast.error('Giá trị giảm giá phải lớn hơn 0');
          return;
        }
        if (customDiscountType === 'percentage' && value > 100) {
          toast.error('Phần trăm giảm giá không thể vượt quá 100%');
          return;
        }

        // Import supabase directly for custom voucher
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
        if (!tenantId) throw new Error('Không tìm thấy tenant');

        const { data: code } = await supabase.rpc('generate_voucher_code');

        const { error } = await supabase
          .from('customer_vouchers' as any)
          .insert([{
            tenant_id: tenantId,
            customer_id: customerId,
            code: code || `VC-${Date.now()}`,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: customerEmail || null,
            discount_type: customDiscountType,
            discount_value: value,
            voucher_name: customName.trim(),
            source: 'manual',
          }]);

        if (error) throw error;
      }

      toast.success('Đã cấp voucher cho khách hàng');
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Có lỗi xảy ra');
    }
  };

  const resetForm = () => {
    setMode('template');
    setSelectedTemplateId('');
    setCustomName('');
    setCustomDiscountType('amount');
    setCustomDiscountValue('');
  };

  const selectedTemplate = activeTemplates.find(t => t.id === selectedTemplateId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Cấp voucher thủ công
          </DialogTitle>
          <DialogDescription>
            Khách hàng: <strong>{customerName}</strong> - {customerPhone}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Phương thức</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as 'template' | 'custom')}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="template" id="mode-template" />
                <label htmlFor="mode-template" className="text-sm">Từ mẫu voucher</label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="mode-custom" />
                <label htmlFor="mode-custom" className="text-sm">Tùy chỉnh</label>
              </div>
            </RadioGroup>
          </div>

          {mode === 'template' ? (
            <div className="space-y-3">
              <div>
                <Label>Chọn voucher mẫu *</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Chọn voucher..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTemplates.length === 0 ? (
                      <SelectItem value="_none" disabled>Chưa có voucher mẫu</SelectItem>
                    ) : (
                      activeTemplates.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} - {t.discount_type === 'amount' 
                            ? `${formatNumber(t.discount_value)}đ` 
                            : `${t.discount_value}%`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {selectedTemplate && (
                <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                  <p className="font-medium">{selectedTemplate.name}</p>
                  <p>Giảm: {selectedTemplate.discount_type === 'amount' 
                    ? `${formatNumber(selectedTemplate.discount_value)}đ` 
                    : `${selectedTemplate.discount_value}%`}
                  </p>
                  {selectedTemplate.description && (
                    <p className="text-muted-foreground">{selectedTemplate.description}</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Tên voucher *</Label>
                <Input
                  className="mt-1"
                  placeholder="VD: Giảm giá sinh nhật"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
              <div>
                <Label>Loại giảm giá</Label>
                <Select value={customDiscountType} onValueChange={(v) => setCustomDiscountType(v as 'amount' | 'percentage')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount">Số tiền (đ)</SelectItem>
                    <SelectItem value="percentage">Phần trăm (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Giá trị giảm *</Label>
                <Input
                  className="mt-1"
                  placeholder={customDiscountType === 'amount' ? 'VD: 50 000' : 'VD: 10'}
                  value={customDiscountValue}
                  onChange={(e) => setCustomDiscountValue(formatInputNumber(e.target.value))}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={issueVoucher.isPending}>
              Cấp voucher
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
