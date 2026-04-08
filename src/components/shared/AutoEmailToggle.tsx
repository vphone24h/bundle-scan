import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Mail, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTenantLandingSettings } from '@/hooks/useTenantLanding';

interface AutoEmailToggleProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  hasCustomerEmail: boolean;
}

export function AutoEmailToggle({ id, checked, onCheckedChange, hasCustomerEmail }: AutoEmailToggleProps) {
  const navigate = useNavigate();
  const { data: landingSettings } = useTenantLandingSettings();
  const emailConfigured = !!(landingSettings as any)?.order_email_enabled;

  if (!emailConfigured) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 text-sm border-dashed border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950"
        onClick={() => {
          navigate('/website-editor');
          // Scroll to email config section after navigation
          setTimeout(() => {
            const el = document.getElementById('email-config-section');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 500);
        }}
      >
        <Settings className="h-4 w-4" />
        Cấu hình email để gửi mail tự động
      </Button>
    );
  }

  return (
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
  );
}
