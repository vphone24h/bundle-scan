import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, ShoppingCart } from 'lucide-react';

interface OrderLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderCount: number;
  freeOrderLimit: number;
}

export function OrderLimitDialog({ open, onOpenChange, orderCount, freeOrderLimit }: OrderLimitDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <Crown className="h-5 w-5" />
            Nâng cấp gói Chuyên nghiệp
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <p>
              Cửa hàng của bạn đã xuất <strong className="text-foreground">{orderCount.toLocaleString()}</strong> / <strong className="text-foreground">{freeOrderLimit.toLocaleString()}</strong> đơn hàng miễn phí.
            </p>
            <p>
              Để tiếp tục xuất hàng, vui lòng nâng cấp lên gói <strong className="text-amber-600">Chuyên nghiệp</strong> để sử dụng không giới hạn.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
            onClick={() => {
              onOpenChange(false);
              navigate('/subscription');
            }}
          >
            <Crown className="h-4 w-4 mr-2" />
            Nâng cấp ngay
          </Button>
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Để sau
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
