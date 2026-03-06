import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useSecurityPasswordStatus, useSetSecurityPassword, useRemoveSecurityPassword } from '@/hooks/useSecurityPassword';
import { toast } from 'sonner';
import { Shield, Loader2, Trash2, KeyRound } from 'lucide-react';

export function SecurityPasswordSettings() {
  const { data: hasPassword, isLoading } = useSecurityPasswordStatus();
  const setPassword = useSetSecurityPassword();
  const removePassword = useRemoveSecurityPassword();

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [removePw, setRemovePw] = useState('');
  const [showRemove, setShowRemove] = useState(false);

  const handleSet = async () => {
    if (pw1 !== pw2) {
      toast.error('Mật khẩu không khớp');
      return;
    }
    if (pw1.length < 4) {
      toast.error('Mật khẩu phải có ít nhất 4 ký tự');
      return;
    }
    try {
      await setPassword.mutateAsync(pw1);
      toast.success(hasPassword ? 'Đã đổi mật khẩu bảo mật' : 'Đã đặt mật khẩu bảo mật');
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

        <div className="space-y-3 max-w-sm">
          <div className="space-y-1.5">
            <Label className="text-sm">{hasPassword ? 'Mật khẩu mới' : 'Mật khẩu'}</Label>
            <Input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="Nhập mật khẩu..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Xác nhận mật khẩu</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Nhập lại mật khẩu..."
              onKeyDown={(e) => e.key === 'Enter' && handleSet()} />
          </div>
          <Button onClick={handleSet} disabled={setPassword.isPending || !pw1 || !pw2} size="sm">
            {setPassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <KeyRound className="h-4 w-4 mr-2" />
            {hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}
          </Button>
        </div>

        {hasPassword && (
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
