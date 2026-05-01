import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CreditCard, Settings2, MapPin, Smartphone, Youtube, ArrowRight } from 'lucide-react';

interface AttendanceGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGoPayrollTemplates: () => void;
  onGoEmployeeSetup: () => void;
  onGoLocations: () => void;
  onGoDevices: () => void;
  videoUrl?: string | null;
}

interface StepProps {
  index: number;
  icon: React.ReactNode;
  title: string;
  hint: string;
  ctaLabel: string;
  onCta: () => void;
  children?: React.ReactNode;
}

function Step({ index, icon, title, hint, ctaLabel, onCta, children }: StepProps) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
          {index}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-primary">{icon}</span>
            <h4 className="font-semibold text-sm sm:text-base">{title}</h4>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">{hint}</p>
          {children}
          <Button
            size="sm"
            className="mt-3 gap-1.5"
            onClick={onCta}
          >
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function AttendanceGuideDialog({
  open,
  onOpenChange,
  onGoPayrollTemplates,
  onGoEmployeeSetup,
  onGoLocations,
  onGoDevices,
  videoUrl,
}: AttendanceGuideDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Hướng dẫn cài đặt chấm công</DialogTitle>
          <DialogDescription>
            Thực hiện 4 bước sau để bắt đầu sử dụng chấm công cho nhân viên
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Step
            index={1}
            icon={<CreditCard className="h-4 w-4" />}
            title="Tạo bảng lương cho nhân viên"
            hint="Vào tab Bảng lương / Mẫu lương để tạo mẫu lương (theo giờ, theo tháng…)"
            ctaLabel="Tạo ngay"
            onCta={() => { onOpenChange(false); onGoPayrollTemplates(); }}
          />

          <Step
            index={2}
            icon={<Settings2 className="h-4 w-4" />}
            title="Gắn bảng lương cho nhân viên"
            hint="Vào tab Cài đặt → chọn nhân viên để gán mẫu lương, ca làm và xếp lịch."
            ctaLabel="Gắn ngay"
            onCta={() => { onOpenChange(false); onGoEmployeeSetup(); }}
          />

          <Step
            index={3}
            icon={<MapPin className="h-4 w-4" />}
            title="Tạo điểm chấm công"
            hint="Vào Chấm công / Điểm CC để khai báo địa chỉ và bán kính cho phép chấm công."
            ctaLabel="Tại đây"
            onCta={() => { onOpenChange(false); onGoLocations(); }}
          />

          <Step
            index={4}
            icon={<Smartphone className="h-4 w-4" />}
            title="Xác minh thiết bị chấm công"
            hint="Thao tác này thực hiện trên thiết bị của nhân viên. Nhân viên phải xác nhận thiết bị mới chấm công được."
            ctaLabel="Mở Thiết bị xác minh"
            onCta={() => { onOpenChange(false); onGoDevices(); }}
          >
            <ol className="mt-2 space-y-1 text-xs sm:text-sm text-muted-foreground list-decimal list-inside bg-muted/40 rounded-md p-3">
              <li>Đăng nhập tài khoản nhân viên muốn chấm công</li>
              <li>Vào tab <strong>Công của tôi</strong> → chọn nút <strong>Chấm công</strong> trên đầu</li>
              <li>Nhấn <strong>Xác nhận thiết bị</strong></li>
              <li>Admin vào lại <strong>Chấm công / Thiết bị</strong> để duyệt là xong</li>
            </ol>
          </Step>

          {videoUrl ? (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => window.open(videoUrl, '_blank')}
            >
              <Youtube className="h-4 w-4 text-red-500" />
              Video hướng dẫn chi tiết
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2 p-3 rounded-md bg-muted/40 text-xs sm:text-sm text-muted-foreground">
              <Youtube className="h-4 w-4 text-red-500" />
              Video hướng dẫn chi tiết sẽ được cập nhật sau
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
