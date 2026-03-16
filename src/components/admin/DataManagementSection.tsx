import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { EyeOff, Eye, Trash2, Loader2, AlertTriangle, ShieldAlert, RotateCcw, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from '@/hooks/useTenant';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RestoreSupplierNoteSection } from './RestoreSupplierNoteSection';
import { UpdateImportDatesSection } from './UpdateImportDatesSection';
import { DataBackupSection } from './DataBackupSection';

export function DataManagementSection() {
  const { data: tenant, refetch: refetchTenant } = useCurrentTenant();
  const queryClient = useQueryClient();
  
  const [isHidden, setIsHidden] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  
  // Toggle password dialog states
  const [showToggleDialog, setShowToggleDialog] = useState(false);
  const [togglePassword, setTogglePassword] = useState('');
  const [pendingToggleValue, setPendingToggleValue] = useState(false);
  
  // Stop test dialog states
  const [showStopTestDialog, setShowStopTestDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  
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
      
      toast.success('Đã xoá toàn bộ dữ liệu thành công. Không thể khôi phục.');
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

  return (
    <div className="space-y-6">
      {/* Data Backup Section */}
      <DataBackupSection />

      {/* Test Mode Section */}
      <Card className="border-orange-200 bg-orange-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <Database className="h-5 w-5" />
            Quản lý dữ liệu Test
          </CardTitle>
          <CardDescription>
            Bật chế độ Test để ẩn toàn bộ dữ liệu kho (giống như mới tạo). Dữ liệu thật sẽ được backup tự động.
          </CardDescription>
        </CardHeader>
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
                <Label className="text-base font-medium">Nút Test</Label>
                <p className="text-sm text-muted-foreground">
                  {isHidden 
                    ? 'Đang ẩn dữ liệu - Tất cả module hiển thị trống' 
                    : 'Đang hiển thị dữ liệu bình thường'}
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
                  Kết thúc chế độ test: xoá dữ liệu hoặc khôi phục bản gốc
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
                        ? 'Dữ liệu hiện tại sẽ được backup tự động. Toàn bộ module sẽ hiển thị trống.'
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
                  Ngưng chế độ Test
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-4">
                    <p>Chọn hành động sau khi ngưng test:</p>
                    
                    <RadioGroup 
                      value={restoreOption} 
                      onValueChange={(v) => setRestoreOption(v as 'restore' | 'delete')}
                      className="space-y-3"
                    >
                      <div className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                        restoreOption === 'restore' ? 'border-primary bg-primary/5' : ''
                      } ${!hasBackup ? 'opacity-50' : 'hover:bg-muted/50 cursor-pointer'}`}>
                        <RadioGroupItem 
                          value="restore" 
                          id="restore" 
                          className="mt-1" 
                          disabled={!hasBackup} 
                        />
                        <div className="flex-1">
                          <Label 
                            htmlFor="restore" 
                            className={`font-medium flex items-center gap-2 cursor-pointer ${!hasBackup ? 'text-muted-foreground' : ''}`}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Khôi phục dữ liệu gốc
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {hasBackup 
                              ? 'Xoá dữ liệu test và khôi phục lại dữ liệu đã backup'
                              : 'Không có bản backup'}
                          </p>
                        </div>
                      </div>
                      <div className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                        restoreOption === 'delete' ? 'border-destructive bg-destructive/5' : ''
                      } hover:bg-muted/50 cursor-pointer`}>
                        <RadioGroupItem value="delete" id="delete" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="delete" className="font-medium flex items-center gap-2 cursor-pointer">
                            <Trash2 className="h-4 w-4" />
                            Xoá toàn bộ dữ liệu
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Xoá sạch tất cả dữ liệu, bắt đầu lại từ đầu
                          </p>
                        </div>
                      </div>
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
                  {restoreOption === 'restore' 
                    ? 'Dữ liệu test sẽ bị xoá và dữ liệu gốc sẽ được khôi phục.'
                    : 'Toàn bộ dữ liệu kho sẽ bị xoá vĩnh viễn. Hành động này không thể hoàn tác.'}
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
                  {restoreOption === 'restore' ? 'Khôi phục' : 'Xoá dữ liệu'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </CardContent>
      </Card>
    </div>
  );
}
