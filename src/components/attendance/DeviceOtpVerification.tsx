import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Smartphone, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  deviceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeviceOtpVerification({ deviceId, open, onOpenChange }: Props) {
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpPreview, setOtpPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const sendOtp = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-device-otp', {
        body: { action: 'send', device_id: deviceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setOtpSent(true);
      setOtpPreview(data.otp_preview || '');
      toast.success('Mã OTP đã được tạo');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Vui lòng nhập mã OTP 6 số');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-device-otp', {
        body: { action: 'verify', device_id: deviceId, otp_code: otp },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Thiết bị đã được xác nhận!');
      qc.invalidateQueries({ queryKey: ['my-device'] });
      qc.invalidateQueries({ queryKey: ['trusted-devices'] });
      onOpenChange(false);
      setOtp('');
      setOtpSent(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Xác minh thiết bị
          </DialogTitle>
        </DialogHeader>

        {!otpSent ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Smartphone className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Xác nhận thiết bị bằng OTP</p>
                <p className="text-xs text-muted-foreground">Mã xác nhận sẽ được gửi đến email hoặc hiển thị cho admin</p>
              </div>
            </div>
            <Button className="w-full" onClick={sendOtp} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Gửi mã OTP
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {otpPreview && (
              <div className="p-3 bg-primary/10 rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-1">Mã OTP (hiển thị cho admin)</p>
                <p className="text-2xl font-bold tracking-widest text-primary">{otpPreview}</p>
              </div>
            )}
            <Input
              placeholder="Nhập mã OTP 6 số"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-lg tracking-widest"
              maxLength={6}
            />
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setOtpSent(false); setOtp(''); }}>Gửi lại</Button>
              <Button onClick={verifyOtp} disabled={loading || otp.length !== 6}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Xác nhận
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
