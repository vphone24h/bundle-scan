import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Mail, Settings, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTenantLandingSettings } from '@/hooks/useTenantLanding';

interface AutoEmailToggleProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  hasCustomerEmail: boolean;
  zaloChecked?: boolean;
  onZaloCheckedChange?: (checked: boolean) => void;
  hasCustomerPhone?: boolean;
}

export function AutoEmailToggle({ id, checked, onCheckedChange, hasCustomerEmail, zaloChecked, onZaloCheckedChange, hasCustomerPhone }: AutoEmailToggleProps) {
  const navigate = useNavigate();
  const { data: landingSettings } = useTenantLandingSettings();
  const emailConfigured = !!(landingSettings as any)?.order_email_enabled;
  const zaloConfigured = !!(landingSettings as any)?.zalo_access_token && !!(landingSettings as any)?.zalo_oa_id;

  return (
    <>
      {!emailConfigured ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-sm border-dashed border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950"
          onClick={() => {
            navigate('/landing-settings?tab=settings#email-config-section');
            const tryScroll = (attempts = 0) => {
              const el = document.getElementById('email-config-section');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              } else if (attempts < 10) {
                setTimeout(() => tryScroll(attempts + 1), 300);
              }
            };
            setTimeout(() => tryScroll(), 500);
          }}
        >
          <Settings className="h-4 w-4" />
          Cấu hình email để gửi mail tự động
        </Button>
      ) : (
        <>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <Label htmlFor={id} className="flex items-center gap-2 cursor-pointer text-sm">
              <Mail className="h-4 w-4 text-primary" />
              Tự động gửi email cho khách
            </Label>
            <Switch
              id={id}
              checked={checked}
              onCheckedChange={onCheckedChange}
            />
          </div>
          {checked && !hasCustomerEmail && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Mail className="h-3 w-3" />
              Khách chưa có email — sẽ không gửi được
            </p>
          )}
        </>
      )}

      {/* Zalo OA toggle */}
      {!zaloConfigured ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-sm border-dashed border-blue-400 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
          onClick={() => {
            navigate('/landing-settings?tab=settings#zalo-config-section');
            const tryScroll = (attempts = 0) => {
              const el = document.getElementById('zalo-config-section');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              } else if (attempts < 10) {
                setTimeout(() => tryScroll(attempts + 1), 300);
              }
            };
            setTimeout(() => tryScroll(), 500);
          }}
        >
          <MessageCircle className="h-4 w-4" />
          Kết nối Zalo OA để gửi Zalo tự động
        </Button>
      ) : onZaloCheckedChange ? (
        <>
          <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
            <Label htmlFor={`${id}-zalo`} className="flex items-center gap-2 cursor-pointer text-sm">
              <MessageCircle className="h-4 w-4 text-blue-500" />
              Tự động gửi Zalo cho khách
            </Label>
            <Switch
              id={`${id}-zalo`}
              checked={zaloChecked ?? false}
              onCheckedChange={onZaloCheckedChange}
              className="data-[state=checked]:bg-blue-500"
            />
          </div>
          {zaloChecked && !hasCustomerPhone && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              Khách chưa có SĐT — sẽ không gửi Zalo được
            </p>
          )}
        </>
      ) : null}
    </>
  );
}