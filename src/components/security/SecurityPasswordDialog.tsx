import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useVerifySecurityPassword, useRequestResetOTP, useVerifyResetOTP } from '@/hooks/useSecurityPassword';
import { toast } from 'sonner';
import { Lock, KeyRound, Loader2, Mail, Fingerprint } from 'lucide-react';
import { isBiometricLikelySupported, saveSecurityPassword, getSavedSecurityPassword, hasSavedSecurityPassword } from '@/lib/biometricAuth';

interface SecurityPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export function SecurityPasswordDialog({ open, onOpenChange, onSuccess, title, description }: SecurityPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'verify' | 'reset_request' | 'reset_verify'>('verify');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [biometricLoading, setBiometricLoading] = useState(false);

  const verify = useVerifySecurityPassword();
  const requestOTP = useRequestResetOTP();
  const verifyOTP = useVerifyResetOTP();

  const canUseBiometric = isBiometricLikelySupported() && hasSavedSecurityPassword();

  const handleVerifySuccess = (pw: string) => {
    // Save for Face ID next time
    saveSecurityPassword(pw);
    onSuccess();
    onOpenChange(false);
    setPassword('');
  };

  const handleVerify = async () => {
    if (!password.trim()) return;
    try {
      const result = await verify.mutateAsync(password);
      if (result.valid) {
        handleVerifySuccess(password);
      } else {
        toast.error('Mật khẩu không đúng');
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi xác thực');
    }
  };

  const handleBiometric = async () => {
    setBiometricLoading(true);
    try {
      const savedPw = getSavedSecurityPassword();
      if (!savedPw) {
        toast.info('Chưa có mật khẩu đã lưu. Vui lòng nhập thủ công lần đầu.');
        setBiometricLoading(false);
        return;
      }
      const result = await verify.mutateAsync(savedPw);
      if (result.valid) {
        handleVerifySuccess(savedPw);
      } else {
        toast.error('Mật khẩu đã lưu không còn đúng. Vui lòng nhập lại.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi xác thực');
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleRequestOTP = async () => {
    try {
      await requestOTP.mutateAsync();
      toast.success('Đã gửi mã OTP về email chủ cửa hàng');
      setMode('reset_verify');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi gửi OTP');
    }
  };

  const handleResetWithOTP = async () => {
    if (newPassword !== newPasswordConfirm) {
      toast.error('Mật khẩu mới không khớp');
      return;
    }
    if (newPassword.length < 4) {
      toast.error('Mật khẩu mới phải có ít nhất 4 ký tự');
      return;
    }
    try {
      await verifyOTP.mutateAsync({ otp, newPassword });
      toast.success('Đã đặt lại mật khẩu bảo mật');
      saveSecurityPassword(newPassword);
      onSuccess();
      onOpenChange(false);
      setMode('verify');
      setOtp('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi xác thực OTP');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setMode('verify'); setPassword(''); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {title || 'Nhập mật khẩu bảo mật'}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {mode === 'verify' && (
          <div className="space-y-4">
            {/* Face ID / Biometric button */}
            {canUseBiometric && (
              <>
                <Button
                  onClick={handleBiometric}
                  disabled={biometricLoading || verify.isPending}
                  variant="outline"
                  className="w-full h-14 text-base gap-3 border-primary/30 hover:border-primary hover:bg-primary/5"
                >
                  {biometricLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Fingerprint className="h-6 w-6 text-primary" />
                  )}
                  Mở khoá bằng Face ID
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">hoặc nhập mật khẩu</span>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Mật khẩu bảo mật</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                autoFocus={!canUseBiometric}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleVerify} disabled={verify.isPending || !password.trim()} className="flex-1">
                {verify.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <KeyRound className="h-4 w-4 mr-2" />
                Xác nhận
              </Button>
            </div>
            {isBiometricLikelySupported() && !hasSavedSecurityPassword() && (
              <p className="text-xs text-muted-foreground text-center">
                💡 Nhập mật khẩu lần đầu, từ lần sau có thể dùng Face ID
              </p>
            )}
            <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={() => setMode('reset_request')}>
              Quên mật khẩu?
            </Button>
          </div>
        )}

        {mode === 'reset_request' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Hệ thống sẽ gửi mã OTP về email của chủ cửa hàng (Admin Tổng) để khôi phục mật khẩu bảo mật.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleRequestOTP} disabled={requestOTP.isPending} className="flex-1">
                {requestOTP.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Mail className="h-4 w-4 mr-2" />
                Gửi mã OTP
              </Button>
              <Button variant="outline" onClick={() => setMode('verify')}>Quay lại</Button>
            </div>
          </div>
        )}

        {mode === 'reset_verify' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mã OTP</Label>
              <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Nhập mã 6 số..." maxLength={6} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Mật khẩu mới</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nhập mật khẩu mới..." />
            </div>
            <div className="space-y-2">
              <Label>Xác nhận mật khẩu mới</Label>
              <Input type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} placeholder="Nhập lại..." />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleResetWithOTP} disabled={verifyOTP.isPending || !otp || !newPassword} className="flex-1">
                {verifyOTP.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Đặt lại mật khẩu
              </Button>
              <Button variant="outline" onClick={() => setMode('reset_request')}>Quay lại</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
