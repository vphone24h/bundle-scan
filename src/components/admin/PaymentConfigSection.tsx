import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Building2, MessageCircle, Pencil, Trash2, Check } from 'lucide-react';
import { VIETNAMESE_BANKS } from '@/lib/vietnameseBanks';

interface PaymentConfig {
  payment_cod_enabled?: boolean;
  payment_transfer_enabled?: boolean;
  payment_bank_name?: string | null;
  payment_account_number?: string | null;
  payment_account_holder?: string | null;
  payment_confirm_zalo_url?: string | null;
  payment_confirm_messenger_url?: string | null;
}

interface PaymentConfigSectionProps {
  formData: PaymentConfig;
  onChange: (key: string, value: any) => void;
}

export function PaymentConfigSection({ formData, onChange }: PaymentConfigSectionProps) {
  const hasBankInfo = !!(formData.payment_bank_name && formData.payment_account_number && formData.payment_account_holder);
  const [editingBank, setEditingBank] = useState(!hasBankInfo);

  const bankLabel = VIETNAMESE_BANKS.find(b => b.code === formData.payment_bank_name);

  const handleClearBank = () => {
    onChange('payment_bank_name', null);
    onChange('payment_account_number', null);
    onChange('payment_account_holder', null);
    onChange('payment_confirm_zalo_url', null);
    onChange('payment_confirm_messenger_url', null);
    setEditingBank(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-5 w-5 text-primary" />
          Cấu hình thanh toán
        </CardTitle>
        <CardDescription>
          Thiết lập phương thức thanh toán cho website bán hàng
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* COD toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Thanh toán COD (Thu tiền khi nhận hàng)</Label>
            <p className="text-xs text-muted-foreground">Khách hàng thanh toán khi nhận hàng</p>
          </div>
          <Switch
            checked={formData.payment_cod_enabled !== false}
            onCheckedChange={(v) => onChange('payment_cod_enabled', v)}
          />
        </div>

        {/* Bank transfer toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Thanh toán chuyển khoản ngân hàng</Label>
            <p className="text-xs text-muted-foreground">Khách chuyển khoản qua QR VietQR</p>
          </div>
          <Switch
            checked={!!formData.payment_transfer_enabled}
            onCheckedChange={(v) => onChange('payment_transfer_enabled', v)}
          />
        </div>

        {/* Bank info */}
        {formData.payment_transfer_enabled && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Thông tin chuyển khoản
              </h4>
              {hasBankInfo && !editingBank && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingBank(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={handleClearBank}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {hasBankInfo && !editingBank ? (
              /* Collapsed summary view */
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ngân hàng</span>
                  <span className="font-medium">{bankLabel ? `${bankLabel.name} (${bankLabel.code})` : formData.payment_bank_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Số tài khoản</span>
                  <span className="font-mono font-medium">{formData.payment_account_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chủ tài khoản</span>
                  <span className="font-medium">{formData.payment_account_holder}</span>
                </div>
                {formData.payment_confirm_zalo_url && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Zalo</span>
                    <span className="text-xs truncate max-w-48">{formData.payment_confirm_zalo_url}</span>
                  </div>
                )}
                {formData.payment_confirm_messenger_url && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Messenger</span>
                    <span className="text-xs truncate max-w-48">{formData.payment_confirm_messenger_url}</span>
                  </div>
                )}
              </div>
            ) : (
              /* Edit form */
              <>
                <div className="space-y-2">
                  <Label className="text-sm">Tên ngân hàng <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.payment_bank_name || ''}
                    onValueChange={(v) => onChange('payment_bank_name', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn ngân hàng..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {VIETNAMESE_BANKS.map(bank => (
                        <SelectItem key={bank.code} value={bank.code}>
                          {bank.name} ({bank.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Số tài khoản <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.payment_account_number || ''}
                    onChange={(e) => onChange('payment_account_number', e.target.value)}
                    placeholder="Nhập số tài khoản"
                    inputMode="numeric"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Tên chủ tài khoản <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.payment_account_holder || ''}
                    onChange={(e) => onChange('payment_account_holder', e.target.value.toUpperCase())}
                    placeholder="VD: NGUYEN VAN A"
                  />
                </div>

                <div className="bg-primary/5 rounded-lg p-3 text-xs text-primary">
                  <p className="font-medium mb-1">📋 Nội dung chuyển khoản tự động:</p>
                  <p>Hệ thống sẽ tự tạo nội dung theo format: <code className="bg-primary/10 px-1 rounded">MÃ_SP + SĐT_KHÁCH</code></p>
                  <p className="mt-1">VD: <code className="bg-primary/10 px-1 rounded">IPHONE17-0901234567</code></p>
                </div>

                {hasBankInfo && (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setEditingBank(false)}>
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    Xong
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {/* Confirm payment links */}
        {formData.payment_transfer_enabled && editingBank && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Link xác nhận thanh toán
            </h4>
            <p className="text-xs text-muted-foreground">
              Sau khi chuyển khoản, khách sẽ được hướng dẫn gửi ảnh xác nhận qua Zalo hoặc Messenger
            </p>

            <div className="space-y-2">
              <Label className="text-sm">Link Zalo</Label>
              <Input
                value={formData.payment_confirm_zalo_url || ''}
                onChange={(e) => onChange('payment_confirm_zalo_url', e.target.value)}
                placeholder="VD: https://zalo.me/0901234567"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Link Facebook Messenger</Label>
              <Input
                value={formData.payment_confirm_messenger_url || ''}
                onChange={(e) => onChange('payment_confirm_messenger_url', e.target.value)}
                placeholder="VD: https://m.me/tenfanpage"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
