import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { translateAuthError } from '@/lib/authErrors';

export function ChangePasswordCard() {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ field: 'current' | 'new' | 'confirm' | null; message: string }>({ field: null, message: '' });

  const reset = () => {
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setError({ field: null, message: '' });
  };

  const handleSave = async () => {
    setError({ field: null, message: '' });

    if (!currentPw) {
      setError({ field: 'current', message: 'Vui lòng nhập mật khẩu hiện tại' });
      return;
    }
    if (newPw.length < 6) {
      setError({ field: 'new', message: 'Mật khẩu mới tối thiểu 6 ký tự' });
      return;
    }
    if (newPw !== confirmPw) {
      setError({ field: 'confirm', message: 'Mật khẩu xác nhận không khớp' });
      return;
    }
    if (newPw === currentPw) {
      setError({ field: 'new', message: 'Mật khẩu mới phải khác mật khẩu cũ' });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Không tìm thấy email người dùng');

      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPw,
      });
      if (signInError) {
        setError({ field: 'current', message: 'Mật khẩu hiện tại không đúng' });
        setLoading(false);
        return;
      }

      // Update to new password — synced with auth system
      const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
      if (updateError) {
        setError({ field: 'new', message: translateAuthError(updateError, 'Không thể đổi mật khẩu') });
        setLoading(false);
        return;
      }

      toast.success('Đã đổi mật khẩu thành công. Lần đăng nhập sau hãy dùng mật khẩu mới.');
      reset();
    } catch (e: any) {
      toast.error(translateAuthError(e, 'Không thể đổi mật khẩu'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-5 w-5 text-primary" />
          Đổi mật khẩu đăng nhập
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Mật khẩu hiện tại</Label>
          <div className="relative">
            <Input
              type={showPw ? 'text' : 'password'}
              value={currentPw}
              onChange={(e) => { setCurrentPw(e.target.value); if (error.field === 'current') setError({ field: null, message: '' }); }}
              placeholder="••••••••"
              className={error.field === 'current' ? 'border-destructive ring-1 ring-destructive focus-visible:ring-destructive pr-10' : 'pr-10'}
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error.field === 'current' && <p className="text-xs text-destructive font-medium">{error.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Mật khẩu mới</Label>
          <Input
            type={showPw ? 'text' : 'password'}
            value={newPw}
            onChange={(e) => { setNewPw(e.target.value); if (error.field === 'new') setError({ field: null, message: '' }); }}
            placeholder="Tối thiểu 6 ký tự"
            className={error.field === 'new' ? 'border-destructive ring-1 ring-destructive focus-visible:ring-destructive' : ''}
            autoComplete="new-password"
            minLength={6}
          />
          {error.field === 'new' && <p className="text-xs text-destructive font-medium">{error.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Xác nhận mật khẩu mới</Label>
          <Input
            type={showPw ? 'text' : 'password'}
            value={confirmPw}
            onChange={(e) => { setConfirmPw(e.target.value); if (error.field === 'confirm') setError({ field: null, message: '' }); }}
            placeholder="Nhập lại mật khẩu mới"
            className={error.field === 'confirm' ? 'border-destructive ring-1 ring-destructive focus-visible:ring-destructive' : ''}
            autoComplete="new-password"
            minLength={6}
          />
          {error.field === 'confirm' && <p className="text-xs text-destructive font-medium">{error.message}</p>}
        </div>

        <p className="text-xs text-muted-foreground">
          Mật khẩu mới sẽ được đồng bộ với hệ thống đăng nhập ngay lập tức.
        </p>

        <Button onClick={handleSave} disabled={loading || !currentPw || !newPw || !confirmPw} className="w-full sm:w-auto">
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <KeyRound className="h-4 w-4 mr-2" />
          Đổi mật khẩu
        </Button>
      </CardContent>
    </Card>
  );
}
