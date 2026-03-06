import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useSecurityPasswordStatus, useSetSecurityPassword, useRemoveSecurityPassword, useRequestResetOTP, useVerifyResetOTP } from '@/hooks/useSecurityPassword';
import { toast } from 'sonner';
import { Shield, Loader2, Trash2, KeyRound, Mail } from 'lucide-react';

export function SecurityPasswordSettings() {
  const { data: hasPassword, isLoading } = useSecurityPasswordStatus();
  const setPassword = useSetSecurityPassword();
  const removePassword = useRemoveSecurityPassword();
  const requestOTP = useRequestResetOTP();
  const verifyOTP = useVerifyResetOTP();

  const [oldPw, setOldPw] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [removePw, setRemovePw] = useState('');
  const [showRemove, setShowRemove] = useState(false);

  // OTP reset flow
  const [showOtpReset, setShowOtpReset] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPwOtp, setNewPwOtp] = useState('');
  const [newPwOtp2, setNewPwOtp2] = useState('');

  const handleSet = async () => {
    if (pw1 !== pw2) {
      toast.error('Mật khẩu không khớp');
      return;
    }
    if (pw1.length < 4) {
      toast.error('Mật khẩu phải có ít nhất 4 ký tự');
      return;
    }
    if (hasPassword && !oldPw) {
      toast.error('Vui lòng nhập mật khẩu cũ');
      return;
    }
    try {
      await setPassword.mutateAsync({ password: pw1, oldPassword: hasPassword ? oldPw : undefined });
      toast.success(hasPassword ? 'Đã đổi mật khẩu bảo mật' : 'Đã đặt mật khẩu bảo mật');
      setOldPw('');
      setPw1('');
      setPw2('');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi');
    }
  };

  const handleRemove = async () => {
    try {
      await removePassword.mutateAsync(removePw);
      toast.success('Đã gỡ mật khẩu bảo mật');
      setRemovePw('');
      setShowRemove(false);
    } catch (e: any) {
      toast.error(e.message || 'Lỗi');
    }
  };

  const handleRequestOTP = async () => {
    try {
      await requestOTP.mutateAsync();
      setOtpSent(true);
      toast.success('Mã OTP đã được gửi về email chủ cửa hàng');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi');
    }
  };

  const handleVerifyOTP = async () => {
    if (newPwOtp !== newPwOtp2) {
      toast.error('Mật khẩu mới không khớp');
      return;
    }
    if (newPwOtp.length < 4) {
      toast.error('Mật khẩu phải có ít nhất 4 ký tự');
      return;
    }
    try {
      await verifyOTP.mutateAsync({ otp, newPassword: newPwOtp });
      toast.success('Đã khôi phục mật khẩu bảo mật thành công');
      setShowOtpReset(false);
      setOtpSent(false);
      setOtp('');
      setNewPwOtp('');
      setNewPwOtp2('');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi');
    }
  };

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5 text-primary" />
          Mật khẩu bảo mật
          {hasPassword && (
            <span className="text-xs font-normal text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Đã bật</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {hasPassword
            ? 'Mật khẩu bảo mật đang bật. Lợi nhuận trên trang chủ sẽ bị ẩn và trang Báo cáo yêu cầu nhập mật khẩu để truy cập.'
            : 'Đặt mật khẩu bảo mật để ẩn lợi nhuận trên trang chủ và yêu cầu nhập mật khẩu khi vào trang Báo cáo. Chỉ Admin Tổng được đặt.'
          }
        </p>

        {/* OTP Reset Flow */}
        {showOtpReset ? (
          <div className="space-y-3 max-w-sm border rounded-lg p-4 bg-muted/30">
            <p className="text-sm font-medium">Khôi phục mật khẩu qua OTP</p>
            {!otpSent ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Hệ thống sẽ gửi mã OTP về email của chủ cửa hàng (Admin Tổng).</p>
                <div className="flex gap-2">
                  <Button onClick={handleRequestOTP} disabled={requestOTP.isPending} size="sm">
                    {requestOTP.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Mail className="h-4 w-4 mr-2" />
                    Gửi mã OTP
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowOtpReset(false)}>Hủy</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label className="text-sm">Mã OTP</Label>
                  <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Nhập mã 6 số..." maxLength={6} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Mật khẩu mới</Label>
                  <Input type="password" value={newPwOtp} onChange={(e) => setNewPwOtp(e.target.value)} placeholder="Mật khẩu mới..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Xác nhận mật khẩu mới</Label>
                  <Input type="password" value={newPwOtp2} onChange={(e) => setNewPwOtp2(e.target.value)} placeholder="Nhập lại..." />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleVerifyOTP} disabled={verifyOTP.isPending || !otp || !newPwOtp} size="sm">
                    {verifyOTP.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Xác nhận
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setShowOtpReset(false); setOtpSent(false); }}>Hủy</Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-w-sm">
            {/* Old password field - only when changing */}
            {hasPassword && (
              <div className="space-y-1.5">
                <Label className="text-sm">Mật khẩu cũ</Label>
                <Input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder="Nhập mật khẩu cũ..." />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm">{hasPassword ? 'Mật khẩu mới' : 'Mật khẩu'}</Label>
              <Input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="Nhập mật khẩu..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Xác nhận mật khẩu</Label>
              <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Nhập lại mật khẩu..."
                onKeyDown={(e) => e.key === 'Enter' && handleSet()} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={handleSet} disabled={setPassword.isPending || !pw1 || !pw2} size="sm">
                {setPassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <KeyRound className="h-4 w-4 mr-2" />
                {hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}
              </Button>
              {hasPassword && (
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setShowOtpReset(true)}>
                  Quên mật khẩu?
                </Button>
              )}
            </div>
          </div>
        )}

        {hasPassword && !showOtpReset && (
          <div className="pt-3 border-t">
            {!showRemove ? (
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => setShowRemove(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Gỡ mật khẩu bảo mật
              </Button>
            ) : (
              <div className="space-y-2 max-w-sm">
                <Label className="text-sm">Nhập mật khẩu hiện tại để gỡ</Label>
                <Input type="password" value={removePw} onChange={(e) => setRemovePw(e.target.value)} placeholder="Mật khẩu hiện tại..." />
                <div className="flex gap-2">
                  <Button variant="destructive" size="sm" onClick={handleRemove} disabled={removePassword.isPending || !removePw}>
                    {removePassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Xác nhận gỡ
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setShowRemove(false); setRemovePw(''); }}>Hủy</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
