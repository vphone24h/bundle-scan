import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EyeOff, Eye, Trash2, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from '@/hooks/useTenant';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function DataManagementSection() {
  const { data: tenant, refetch: refetchTenant } = useCurrentTenant();
  const queryClient = useQueryClient();
  
  const [isHidden, setIsHidden] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  
  // Delete dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'password'>('confirm');
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync with tenant data
  useEffect(() => {
    if (tenant?.is_data_hidden !== undefined) {
      setIsHidden(tenant.is_data_hidden);
    }
  }, [tenant?.is_data_hidden]);

  const handleToggleVisibility = async (newValue: boolean) => {
    setIsToggling(true);
    try {
      const { data, error } = await supabase.functions.invoke('tenant-data-management', {
        body: {
          action: 'toggle_data_visibility',
          isHidden: newValue,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setIsHidden(newValue);
      await refetchTenant();
      
      // Invalidate all data queries to force refresh
      queryClient.invalidateQueries();
      
      toast.success(newValue ? 'Đã ẩn toàn bộ dữ liệu' : 'Đã hiện lại dữ liệu');
    } catch (error) {
      console.error('Toggle visibility error:', error);
      toast.error('Không thể thay đổi trạng thái: ' + (error as Error).message);
    } finally {
      setIsToggling(false);
    }
  };

  const handleDeleteData = async () => {
    if (deleteStep === 'confirm') {
      if (confirmText.toLowerCase() !== 'tôi đồng ý xoá') {
        toast.error('Vui lòng nhập đúng văn bản xác nhận');
        return;
      }
      setDeleteStep('password');
      return;
    }

    if (!password) {
      toast.error('Vui lòng nhập mật khẩu');
      return;
    }

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('tenant-data-management', {
        body: {
          action: 'delete_all_data',
          confirmText: confirmText.toLowerCase(),
          password,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Close dialog and reset
      setShowDeleteDialog(false);
      setDeleteStep('confirm');
      setConfirmText('');
      setPassword('');
      
      // Invalidate all data queries
      queryClient.invalidateQueries();
      
      toast.success('Đã xoá toàn bộ dữ liệu kho thành công');
    } catch (error) {
      console.error('Delete data error:', error);
      toast.error('Không thể xoá dữ liệu: ' + (error as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const resetDeleteDialog = () => {
    setShowDeleteDialog(false);
    setDeleteStep('confirm');
    setConfirmText('');
    setPassword('');
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-5 w-5" />
          Quản lý dữ liệu kho
        </CardTitle>
        <CardDescription>
          Các thao tác nhạy cảm - Chỉ Super Admin có quyền thực hiện
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle Data Visibility */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {isHidden ? (
              <EyeOff className="h-5 w-5 text-warning" />
            ) : (
              <Eye className="h-5 w-5 text-primary" />
            )}
            <div>
              <Label className="text-base font-medium">Ẩn toàn bộ dữ liệu</Label>
              <p className="text-sm text-muted-foreground">
                Khi bật, tất cả dữ liệu sẽ hiển thị là 0/trống
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isToggling && <Loader2 className="h-4 w-4 animate-spin" />}
            <Switch
              checked={isHidden}
              onCheckedChange={handleToggleVisibility}
              disabled={isToggling}
            />
          </div>
        </div>

        {/* Delete All Data */}
        <div className="flex items-center justify-between p-4 border border-destructive/30 rounded-lg bg-destructive/5">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive" />
            <div>
              <Label className="text-base font-medium text-destructive">Xoá toàn bộ dữ liệu kho</Label>
              <p className="text-sm text-muted-foreground">
                Xoá sản phẩm, phiếu nhập/xuất, sổ quỹ, công nợ - KHÔNG THỂ HOÀN TÁC
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Xoá dữ liệu
          </Button>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={resetDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {deleteStep === 'confirm' ? 'Xác nhận xoá dữ liệu' : 'Xác thực mật khẩu'}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  {deleteStep === 'confirm' ? (
                    <>
                      <p className="text-destructive font-medium">
                        CẢNH BÁO: Hành động này không thể hoàn tác!
                      </p>
                      <p>
                        Toàn bộ dữ liệu sau sẽ bị xoá vĩnh viễn:
                      </p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        <li>Tất cả sản phẩm và IMEI</li>
                        <li>Phiếu nhập hàng và lịch sử nhập</li>
                        <li>Phiếu xuất hàng và lịch sử bán</li>
                        <li>Sổ quỹ và các giao dịch</li>
                        <li>Công nợ nhà cung cấp/khách hàng</li>
                        <li>Phiếu kiểm kho</li>
                        <li>Lịch sử thao tác (Audit logs)</li>
                      </ul>
                      <div className="pt-2">
                        <Label>
                          Nhập chính xác: <span className="font-mono text-destructive">"tôi đồng ý xoá"</span>
                        </Label>
                        <Input
                          className="mt-2"
                          placeholder="Nhập văn bản xác nhận..."
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <p>Nhập mật khẩu tài khoản Admin để xác thực:</p>
                      <Input
                        type="password"
                        placeholder="Mật khẩu..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                      />
                    </>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={resetDeleteDialog}>Huỷ</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleDeleteData}
                disabled={
                  isDeleting ||
                  (deleteStep === 'confirm' && confirmText.toLowerCase() !== 'tôi đồng ý xoá') ||
                  (deleteStep === 'password' && !password)
                }
              >
                {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {deleteStep === 'confirm' ? 'Tiếp tục' : 'Xoá dữ liệu'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}