import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { CreditCard, MessageCircle } from 'lucide-react';
import { BankAccountEditor } from './BankAccountEditor';

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
          <div className="border rounded-lg p-4 bg-muted/30">
            <BankAccountEditor
              bankName={formData.payment_bank_name || ''}
              accountNumber={formData.payment_account_number || ''}
              accountHolder={formData.payment_account_holder || ''}
              onSave={(bank, account, holder) => {
                onChange('payment_bank_name', bank);
                onChange('payment_account_number', account);
                onChange('payment_account_holder', holder);
              }}
            />
          </div>
        )}

        {/* Confirm payment links */}
        {formData.payment_transfer_enabled && (
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
