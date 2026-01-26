import { useCurrentTenant, calculateRemainingDays } from '@/hooks/useTenant';
import { AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function TrialBanner() {
  const { data: tenant } = useCurrentTenant();
  const navigate = useNavigate();

  if (!tenant) return null;

  const remainingDays = calculateRemainingDays(tenant);

  // Don't show if active with subscription or lifetime
  if (tenant.status === 'active' && tenant.subscription_plan === 'lifetime') {
    return null;
  }

  // Show warning banner for trial users or those about to expire
  if (tenant.status === 'trial' || (tenant.status === 'active' && remainingDays <= 7)) {
    const isUrgent = remainingDays <= 7;
    
    return (
      <div className={`px-4 py-2 text-center text-sm flex items-center justify-center gap-2 ${
        isUrgent 
          ? 'bg-destructive/10 text-destructive border-b border-destructive/20' 
          : 'bg-primary/10 text-primary border-b border-primary/20'
      }`}>
        <Clock className="h-4 w-4" />
        <span>
          {tenant.status === 'trial' ? 'Dùng thử: ' : ''}
          Còn <strong>{remainingDays}</strong> ngày
          {remainingDays <= 3 && ' - Gia hạn ngay để tiếp tục sử dụng!'}
        </span>
        <Button 
          size="sm" 
          variant={isUrgent ? 'destructive' : 'default'}
          className="ml-2 h-7"
          onClick={() => navigate('/subscription')}
        >
          Nâng cấp
        </Button>
      </div>
    );
  }

  // Show locked/expired banner
  if (tenant.status === 'expired' || tenant.status === 'locked') {
    return (
      <div className="bg-destructive text-destructive-foreground px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">
            {tenant.status === 'locked' 
              ? 'Tài khoản của bạn đã bị khóa' 
              : 'Thời hạn sử dụng đã hết'}
          </span>
        </div>
        <p className="text-sm mt-1 opacity-90">
          {tenant.status === 'locked' 
            ? tenant.locked_reason || 'Vui lòng liên hệ hỗ trợ'
            : 'Vui lòng gia hạn để tiếp tục sử dụng đầy đủ tính năng'}
        </p>
        {tenant.status === 'expired' && (
          <Button 
            size="sm" 
            variant="secondary"
            className="mt-2"
            onClick={() => navigate('/subscription')}
          >
            Gia hạn ngay
          </Button>
        )}
      </div>
    );
  }

  return null;
}