import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { ShoppingCart, RotateCcw } from 'lucide-react';

interface ResumeDraftDialogProps {
  open: boolean;
  itemCount: number;
  onResume: () => void;
  onDiscard: () => void;
  title?: string;
}

export function ResumeDraftDialog({ open, itemCount, onResume, onDiscard, title }: ResumeDraftDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            {title || 'Phát hiện đơn chưa hoàn thành'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Bạn có <span className="font-semibold text-foreground">{itemCount} sản phẩm</span> trong giỏ từ lần trước. Bạn muốn tiếp tục đơn cũ hay tạo đơn mới?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Đơn mới
          </AlertDialogCancel>
          <AlertDialogAction onClick={onResume} className="gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            Tiếp tục đơn cũ ({itemCount} SP)
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
