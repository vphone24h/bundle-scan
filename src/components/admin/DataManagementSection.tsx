import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useSecurityPasswordStatus, useVerifySecurityPassword } from '@/hooks/useSecurityPassword';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EyeOff, Eye, Trash2, Loader2, AlertTriangle, ShieldAlert, Database, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from '@/hooks/useTenant';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RestoreSupplierNoteSection } from './RestoreSupplierNoteSection';
import { UpdateImportDatesSection } from './UpdateImportDatesSection';
import { DataBackupSection } from './DataBackupSection';
import { CrossPlatformBackupSection } from './CrossPlatformBackupSection';

export function DataManagementSection() {
  const { data: tenant, refetch: refetchTenant } = useCurrentTenant();
  const queryClient = useQueryClient();
  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const verifyPassword = useVerifySecurityPassword();
  
  const [isHidden, setIsHidden] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  
  // Security password unlock state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [securityPw, setSecurityPw] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Toggle password dialog states
  const [showToggleDialog, setShowToggleDialog] = useState(false);
  const [togglePassword, setTogglePassword] = useState('');
  const [pendingToggleValue, setPendingToggleValue] = useState(false);
  
  // Stop test dialog states
  const [showStopTestDialog, setShowStopTestDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteMode, setDeleteMode] = useState<'full' | 'keep_templates'>('full');
  
  // Password confirmation dialog
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [isStopping, setIsStopping] = useState(false);

  // Sync with tenant data
  useEffect(() => {
    if (tenant) {
      setIsHidden(tenant.is_data_hidden || false);
      setHasBackup((tenant as any).has_data_backup || false);
    }
  }, [tenant]);

  const handleToggleRequest = (newValue: boolean) => {
    setPendingToggleValue(newValue);
    setTogglePassword('');
    setShowToggleDialog(true);
  };

  const handleToggleVisibility = async () => {
    if (!togglePassword) {
      toast.error('Vui lòng nhập mật khẩu');
      return;
    }

    setIsToggling(true);
    try {
      const { data, error } = await supabase.functions.invoke('tenant-data-management', {
        body: {
          action: 'toggle_data_visibility',
          isHidden: pendingToggleValue,
          password: togglePassword,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setIsHidden(pendingToggleValue);
      if (pendingToggleValue) {
        setHasBackup(true);
      }
      setShowToggleDialog(false);
      setTogglePassword('');
      await refetchTenant();
      
      // Invalidate all data queries to force refresh
      queryClient.invalidateQueries();
      
      toast.success(pendingToggleValue 
        ? 'Đã bật chế độ Test - Dữ liệu gốc đã được backup' 
        : 'Đã tắt chế độ Test');
    } catch (error) {
      console.error('Toggle visibility error:', error);
      toast.error('Không thể thay đổi trạng thái: ' + (error as Error).message);
    } finally {
      setIsToggling(false);
    }
  };

  const resetToggleDialog = () => {
    setShowToggleDialog(false);
    setTogglePassword('');
  };

  const handleStopTestRequest = () => {
    setConfirmText('');
    setDeleteMode('full');
    setShowStopTestDialog(true);
  };

  const handleConfirmTextSubmit = () => {
    if (confirmText.toLowerCase() !== 'tôi đồng ý xoá') {
      toast.error('Vui lòng nhập đúng "tôi đồng ý xoá"');
      return;
    }
    setShowStopTestDialog(false);
    setPassword('');
    setShowPasswordDialog(true);
  };

  const handleStopTest = async () => {
    if (!password) {
      toast.error('Vui lòng nhập mật khẩu');
      return;
    }

    setIsStopping(true);
    try {
      const { data, error } = await supabase.functions.invoke('tenant-data-management', {
        body: {
          action: 'stop_test_mode',
          confirmText: confirmText.toLowerCase(),
          password,
          restoreOption: 'delete',
          deleteMode,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Reset states
      setShowPasswordDialog(false);
      setConfirmText('');
      setPassword('');
      setIsHidden(false);
      setHasBackup(false);
      
      // Invalidate all data queries
      await refetchTenant();
      queryClient.invalidateQueries();
      
      toast.success(deleteMode === 'keep_templates' 
        ? 'Đã xoá lịch sử & reset tồn kho. Sản phẩm mẫu được giữ lại.'
        : 'Đã xoá toàn bộ dữ liệu thành công. Không thể khôi phục.');
    } catch (error) {
      console.error('Stop test error:', error);
      toast.error('Không thể thực hiện: ' + (error as Error).message);
    } finally {
      setIsStopping(false);
    }
  };

  const resetStopTestDialog = () => {
    setShowStopTestDialog(false);
    setConfirmText('');
  };

  const resetPasswordDialog = () => {
    setShowPasswordDialog(false);
    setPassword('');
  };

      const handleUnlockSection = async () => {
    if (!securityPw) {
      toast.error('Vui lòng nhập mật khẩu bảo mật');
      return;
    }
    setIsVerifying(true);
    try {
      const result = await verifyPassword.mutateAsync(securityPw);
      if (result.valid) {
        setIsUnlocked(true);
        setSecurityPw('');
      } else {
        toast.error('Mật khẩu bảo mật không đúng');
      }
    } catch {
      toast.error('Mật khẩu bảo mật không đúng');
    } finally {
      setIsVerifying(false);
    }
  };

  const needsUnlock = hasSecurityPassword && !isUnlocked;

  return (
    <div className="space-y-6">
      {/* Data Backup Section */}
      <DataBackupSection />

      {/* Cross-platform Backup/Restore */}
      <CrossPlatformBackupSection />

      {/* Test Mode Section */}
      <Card className="border-orange-200 bg-orange-50/50">
        <CardHeader>
          <CardTitle 
            className={`flex items-center gap-2 text-orange-700 ${needsUnlock ? 'cursor-pointer' : ''}`}
            onClick={() => needsUnlock && document.getElementById('security-pw-input')?.focus()}
          >
            <Database className="h-5 w-5" />
            Quản lý dữ liệu Test
            {needsUnlock && <Lock className="h-4 w-4 ml-auto text-muted-foreground" />}
          </CardTitle>
          {!needsUnlock && (
            <CardDescription>
              Bật chế độ Test để ẩn toàn bộ dữ liệu kho (giống như mới tạo). Dữ liệu thật sẽ được backup tự động.
            </CardDescription>
          )}
        </CardHeader>
        {needsUnlock ? (
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                id="security-pw-input"
                type="password"
                placeholder="Nhập mật khẩu bảo mật..."
                value={securityPw}
                onChange={(e) => setSecurityPw(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlockSection()}
                className="flex-1"
              />
              <Button 
                onClick={handleUnlockSection} 
                disabled={isVerifying || !securityPw}
                size="sm"
              >
                {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mở khoá'}
              </Button>
            </div>
          </CardContent>
        ) : (
        <CardContent className="space-y-6">
          {/* Toggle Data Visibility - Test Mode */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
            <div className="flex items-center gap-3">
              {isHidden ? (
                <EyeOff className="h-5 w-5 text-orange-500" />
              ) : (
                <Eye className="h-5 w-5 text-primary" />
              )}
              <div>
                <Label className="text-base font-medium">Ẩn dữ liệu</Label>
                <p className="text-sm text-muted-foreground">
                  {isHidden 
                    ? 'Đang ẩn dữ liệu kho' 
                    : 'Bật để ẩn dữ liệu kho, tắt sẽ hiện lại'}
                </p>
                {hasBackup && (
                  <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                    <Database className="h-3 w-3" />
                    Có bản backup dữ liệu gốc
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isToggling && <Loader2 className="h-4 w-4 animate-spin" />}
              <Switch
                checked={isHidden}
                onCheckedChange={handleToggleRequest}
                disabled={isToggling}
              />
            </div>
          </div>

          {/* Stop Test Button */}
          <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-white">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <Label className="text-base font-medium text-destructive">Nút Ngưng Test</Label>
                <p className="text-sm text-muted-foreground">
                  Xoá toàn bộ dữ liệu (sản phẩm, khách hàng, NCC, đơn hàng, báo cáo...). Không thể khôi phục.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={handleStopTestRequest}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Ngưng Test
            </Button>
          </div>

          {/* Toggle Password Dialog */}
          <AlertDialog open={showToggleDialog} onOpenChange={resetToggleDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  {pendingToggleValue ? 'Bật chế độ Test' : 'Tắt chế độ Test'}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-4">
                    <p>
                      {pendingToggleValue 
                        ? 'Dữ liệu hiện tại sẽ được ẩn tạm thời. Khi tắt Test sẽ hiển thị lại bình thường, không mất dữ liệu.'
                        : 'Dữ liệu sẽ được hiển thị lại bình thường.'}
                    </p>
                    <div className="space-y-2">
                      <Label>Nhập mật khẩu Admin để xác nhận</Label>
                      <Input
                        type="password"
                        placeholder="Mật khẩu..."
                        value={togglePassword}
                        onChange={(e) => setTogglePassword(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={resetToggleDialog}>Huỷ</AlertDialogCancel>
                <Button
                  onClick={handleToggleVisibility}
                  disabled={isToggling || !togglePassword}
                >
                  {isToggling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Xác nhận
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Stop Test Confirmation Dialog */}
          <AlertDialog open={showStopTestDialog} onOpenChange={resetStopTestDialog}>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Xoá dữ liệu
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm space-y-1">
                      <p className="font-medium text-destructive">⚠️ Hành động này KHÔNG THỂ hoàn tác!</p>
                    </div>

                    {/* Delete mode selection */}
                    <RadioGroup value={deleteMode} onValueChange={(v) => setDeleteMode(v as 'full' | 'keep_templates')} className="space-y-3">
                      <label htmlFor="mode-full" className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${deleteMode === 'full' ? 'border-destructive bg-destructive/5' : 'border-border'}`}>
                        <RadioGroupItem value="full" id="mode-full" className="mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-medium text-sm text-foreground">Xoá toàn bộ dữ liệu</p>
                          <p className="text-xs text-muted-foreground">Xoá tất cả: sản phẩm, tồn kho, IMEI, phiếu nhập/xuất, khách hàng, NCC, sổ quỹ, báo cáo</p>
                        </div>
                      </label>
                      <label htmlFor="mode-keep" className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${deleteMode === 'keep_templates' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                        <RadioGroupItem value="keep_templates" id="mode-keep" className="mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-medium text-sm text-foreground">Xoá lịch sử, giữ sản phẩm mẫu</p>
                          <p className="text-xs text-muted-foreground">Xoá phiếu nhập/xuất, sổ quỹ, báo cáo. Giữ lại danh sách sản phẩm (tồn kho = 0) để nhập lại nhanh</p>
                        </div>
                      </label>
                    </RadioGroup>

                    <div className="space-y-2 pt-2">
                      <Label>
                        Nhập <span className="font-mono text-destructive">"tôi đồng ý xoá"</span> để xác nhận
                      </Label>
                      <Input
                        placeholder="tôi đồng ý xoá"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                      />
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={resetStopTestDialog}>Huỷ</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleConfirmTextSubmit}
                  disabled={confirmText.toLowerCase() !== 'tôi đồng ý xoá'}
                >
                  Tiếp tục
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Password Confirmation Dialog */}
          <Dialog open={showPasswordDialog} onOpenChange={resetPasswordDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-destructive flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Xác nhận mật khẩu Admin
                </DialogTitle>
                <DialogDescription>
                  Toàn bộ dữ liệu sẽ bị xoá vĩnh viễn. Hành động này không thể hoàn tác.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nhập mật khẩu Admin</Label>
                  <Input
                    type="password"
                    placeholder="Mật khẩu..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetPasswordDialog}>
                  Huỷ
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleStopTest}
                  disabled={isStopping || !password}
                >
                  {isStopping && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Xoá vĩnh viễn
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </CardContent>
        )}
      </Card>
    </div>
  );
}
