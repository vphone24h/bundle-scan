import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DataBackupSection } from './DataBackupSection';
import { CrossPlatformBackupSection } from './CrossPlatformBackupSection';

type DataManagementJob = {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  current_step: string | null;
  error_message: string | null;
  delete_mode: 'full' | 'keep_templates';
  notify_email: string | null;
  created_at: string;
  updated_at?: string | null;
  completed_at: string | null;
};

const JOB_HANDLED_STORAGE_KEY = 'vkho_data_management_job_handled';
const ACTIVE_DELETE_JOB_KEY = 'vkho_active_delete_job_id';
const STALE_JOB_MINUTES = 10;

function isStaleDeleteJob(job?: DataManagementJob | null) {
  if (!job || (job.status !== 'queued' && job.status !== 'processing')) return false;

  const referenceTime = job.updated_at || job.created_at;
  if (!referenceTime) return false;

  const timestamp = new Date(referenceTime).getTime();
  if (Number.isNaN(timestamp)) return false;

  return Date.now() - timestamp > STALE_JOB_MINUTES * 60 * 1000;
}

function getJobStatusLabel(status?: DataManagementJob['status']) {
  switch (status) {
    case 'queued':
      return 'Đang vào hàng chờ';
    case 'processing':
      return 'Đang xử lý';
    case 'completed':
      return 'Đã hoàn tất';
    case 'failed':
      return 'Đã thất bại';
    default:
      return 'Chưa có tác vụ';
  }
}

function formatJobTime(value?: string | null) {
  if (!value) return null;

  try {
    return new Date(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
}

export function DataManagementSection() {
  const { data: tenant, refetch: refetchTenant } = useCurrentTenant();
  const queryClient = useQueryClient();
  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const verifyPassword = useVerifySecurityPassword();

  const [isHidden, setIsHidden] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [securityPw, setSecurityPw] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [showToggleDialog, setShowToggleDialog] = useState(false);
  const [togglePassword, setTogglePassword] = useState('');
  const [pendingToggleValue, setPendingToggleValue] = useState(false);

  const [showStopTestDialog, setShowStopTestDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteMode, setDeleteMode] = useState<'full' | 'keep_templates'>('full');

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [isStopping, setIsStopping] = useState(false);

  const { data: latestDeleteJob, refetch: refetchLatestDeleteJob } = useQuery({
    queryKey: ['data-management-latest-job', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      if (!tenant?.id) return null;

        const { data, error } = await supabase
        .from('data_management_jobs' as any)
          .select('id, status, progress, current_step, error_message, delete_mode, notify_email, created_at, updated_at, completed_at, job_type')
        .eq('tenant_id', tenant.id)
        .eq('job_type', 'delete_restore')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data as unknown as DataManagementJob | null) ?? null;
    },
    refetchInterval: (query) => {
      const status = (query.state.data as DataManagementJob | null)?.status;
      return status === 'queued' || status === 'processing' ? 2000 : false;
    },
  });

  const hasActiveDeleteJob =
    (latestDeleteJob?.status === 'queued' || latestDeleteJob?.status === 'processing') &&
    !isStaleDeleteJob(latestDeleteJob);

  const isDeleteJobStale = isStaleDeleteJob(latestDeleteJob);

  useEffect(() => {
    if (tenant) {
      setIsHidden(tenant.is_data_hidden || false);
      setHasBackup((tenant as any).has_data_backup || false);
    }
  }, [tenant]);

  useEffect(() => {
    if (!latestDeleteJob?.id || !latestDeleteJob?.status || typeof window === 'undefined') return;
    if (latestDeleteJob.status !== 'completed' && latestDeleteJob.status !== 'failed') return;

    const activeDeleteJobId = window.sessionStorage.getItem(ACTIVE_DELETE_JOB_KEY);
    if (activeDeleteJobId !== latestDeleteJob.id) return;

    const handledKey = `${latestDeleteJob.id}:${latestDeleteJob.status}`;
    const lastHandledKey = window.sessionStorage.getItem(JOB_HANDLED_STORAGE_KEY);
    if (lastHandledKey === handledKey) return;

    window.sessionStorage.setItem(JOB_HANDLED_STORAGE_KEY, handledKey);
    window.sessionStorage.removeItem(ACTIVE_DELETE_JOB_KEY);

    if (latestDeleteJob.status === 'failed') {
      toast.error(latestDeleteJob.error_message || 'Không thể xoá dữ liệu.');
      return;
    }

    setShowPasswordDialog(false);
    setShowStopTestDialog(false);
    setConfirmText('');
    setPassword('');
    setIsHidden(false);
    setHasBackup(false);

    clearPersistedQueryCache();

    // Remove all cached query data so stale products/inventory don't persist
    queryClient.removeQueries();

    toast.success(
      latestDeleteJob.delete_mode === 'keep_templates'
        ? 'Đã xoá lịch sử ở nền và giữ lại sản phẩm mẫu.'
        : 'Đã xoá toàn bộ dữ liệu ở nền thành công.',
    );

    setTimeout(() => {
      window.location.reload();
    }, 500);
  }, [latestDeleteJob, queryClient, refetchTenant]);

  const clearPersistedQueryCache = () => {
    try {
      localStorage.removeItem('vkho_query_cache_v1');
    } catch (error) {
      console.warn('Could not clear persisted query cache:', error);
    }
  };

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
      queryClient.invalidateQueries();

      toast.success(pendingToggleValue ? 'Đã bật chế độ Test - Dữ liệu gốc đã được backup' : 'Đã tắt chế độ Test');
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
    if (hasActiveDeleteJob) {
      toast.info('Đang có một yêu cầu xoá dữ liệu chạy ở nền.');
      return;
    }

    setConfirmText('');
    setDeleteMode('full');
    setShowStopTestDialog(true);
  };

  const handleConfirmTextSubmit = () => {
    const normalized = confirmText.normalize('NFC').toLowerCase().trim();
    if (normalized !== 'tôi đồng ý xoá' && normalized !== 'tôi đồng ý xóa') {
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
          confirmText: confirmText.normalize('NFC').toLowerCase().trim(),
          password,
          restoreOption: 'delete',
          deleteMode,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setShowPasswordDialog(false);
      setShowStopTestDialog(false);
      setConfirmText('');
      setPassword('');

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(JOB_HANDLED_STORAGE_KEY);
        if (data?.jobId) {
          window.sessionStorage.setItem(ACTIVE_DELETE_JOB_KEY, data.jobId);
        }
      }

      await Promise.all([refetchLatestDeleteJob(), refetchTenant()]);

      toast.success(
        data?.alreadyRunning
          ? 'Hệ thống đang tiếp tục yêu cầu xoá dữ liệu trước đó.'
          : 'Đã bắt đầu xoá dữ liệu ở nền. Khi xong hệ thống sẽ báo trong app và qua email nếu mail đã cấu hình.',
      );
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
      <DataBackupSection />
      <CrossPlatformBackupSection />

      <Card className="border-orange-200 bg-orange-50/50">
        <CardHeader>
          <CardTitle
            className={`flex items-center gap-2 text-orange-700 ${needsUnlock ? 'cursor-pointer' : ''}`}
            onClick={() => needsUnlock && document.getElementById('security-pw-input')?.focus()}
          >
            <Database className="h-5 w-5" />
            Quản lý dữ liệu Test
            {needsUnlock && <Lock className="ml-auto h-4 w-4 text-muted-foreground" />}
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
              <Button onClick={handleUnlockSection} disabled={isVerifying || !securityPw} size="sm">
                {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mở khoá'}
              </Button>
            </div>
          </CardContent>
        ) : (
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border bg-background p-4">
              <div className="flex items-center gap-3">
                {isHidden ? <EyeOff className="h-5 w-5 text-orange-500" /> : <Eye className="h-5 w-5 text-primary" />}
                <div>
                  <Label className="text-base font-medium">Ẩn dữ liệu</Label>
                  <p className="text-sm text-muted-foreground">{isHidden ? 'Đang ẩn dữ liệu kho' : 'Bật để ẩn dữ liệu kho, tắt sẽ hiện lại'}</p>
                  {hasBackup && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                      <Database className="h-3 w-3" />
                      Có bản backup dữ liệu gốc
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isToggling && <Loader2 className="h-4 w-4 animate-spin" />}
                <Switch checked={isHidden} onCheckedChange={handleToggleRequest} disabled={isToggling || hasActiveDeleteJob} />
              </div>
            </div>

            {latestDeleteJob && (latestDeleteJob.status === 'queued' || latestDeleteJob.status === 'processing') && (
              <div className="space-y-3 rounded-lg border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Tiến trình xoá dữ liệu</p>
                    <p className="text-sm text-muted-foreground">
                      {isDeleteJobStale ? 'Tác vụ cũ đã bị treo, có thể bấm xoá lại' : getJobStatusLabel(latestDeleteJob.status)}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-foreground">{latestDeleteJob.progress ?? 0}%</p>
                </div>

                <Progress value={latestDeleteJob.progress ?? 0} className="h-2" />

                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{latestDeleteJob.current_step || 'Đang chuẩn bị xử lý dữ liệu...'}</p>
                  {isDeleteJobStale && (
                    <p className="text-destructive">Tác vụ này đã đứng quá lâu, hệ thống sẽ cho chạy lại khi bạn bấm xoá lần nữa.</p>
                  )}
                  {latestDeleteJob.notify_email && (
                    <p>Sẽ báo hoàn tất qua email: {latestDeleteJob.notify_email}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-background p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <Label className="text-base font-medium text-destructive">Nút Ngưng Test</Label>
                  <p className="text-sm text-muted-foreground">
                    Xoá toàn bộ dữ liệu (sản phẩm, khách hàng, NCC, đơn hàng, báo cáo...). Hệ thống sẽ chia nhỏ và xử lý ở nền.
                  </p>
                </div>
              </div>
              <Button variant="destructive" onClick={handleStopTestRequest} disabled={hasActiveDeleteJob}>
                {hasActiveDeleteJob ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {hasActiveDeleteJob ? 'Đang xử lý...' : 'Ngưng Test'}
              </Button>
            </div>

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
                  <Button onClick={handleToggleVisibility} disabled={isToggling || !togglePassword}>
                    {isToggling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Xác nhận
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showStopTestDialog} onOpenChange={resetStopTestDialog}>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Xoá dữ liệu
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-4">
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                        <p className="font-medium text-destructive">⚠️ Hành động này KHÔNG THỂ hoàn tác!</p>
                        <p className="mt-1 text-muted-foreground">Yêu cầu sẽ chạy nền theo từng đợt để tránh lỗi nghẽn khi dữ liệu lớn.</p>
                      </div>

                      <RadioGroup value={deleteMode} onValueChange={(v) => setDeleteMode(v as 'full' | 'keep_templates')} className="space-y-3">
                        <label
                          htmlFor="mode-full"
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${deleteMode === 'full' ? 'border-destructive bg-destructive/5' : 'border-border'}`}
                        >
                          <RadioGroupItem value="full" id="mode-full" className="mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">Xoá toàn bộ dữ liệu</p>
                            <p className="text-xs text-muted-foreground">Xoá tất cả: sản phẩm, tồn kho, IMEI, phiếu nhập/xuất, khách hàng, NCC, sổ quỹ, báo cáo</p>
                          </div>
                        </label>
                        <label
                          htmlFor="mode-keep"
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${deleteMode === 'keep_templates' ? 'border-primary bg-primary/5' : 'border-border'}`}
                        >
                          <RadioGroupItem value="keep_templates" id="mode-keep" className="mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">Xoá lịch sử, giữ sản phẩm mẫu</p>
                            <p className="text-xs text-muted-foreground">Xoá phiếu nhập/xuất, sổ quỹ, báo cáo. Giữ lại danh sách sản phẩm (tồn kho = 0) để nhập lại nhanh</p>
                          </div>
                        </label>
                      </RadioGroup>

                      <div className="space-y-2 pt-2">
                        <Label>
                          Nhập <span className="font-mono text-destructive">"tôi đồng ý xoá"</span> để xác nhận
                        </Label>
                        <Input placeholder="tôi đồng ý xoá" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={resetStopTestDialog}>Huỷ</AlertDialogCancel>
                  <Button
                    variant="destructive"
                    onClick={handleConfirmTextSubmit}
                    disabled={(() => {
                      const normalized = confirmText.normalize('NFC').toLowerCase().trim();
                      return normalized !== 'tôi đồng ý xoá' && normalized !== 'tôi đồng ý xóa';
                    })()}
                  >
                    Tiếp tục
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Dialog open={showPasswordDialog} onOpenChange={resetPasswordDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <ShieldAlert className="h-5 w-5" />
                    Xác nhận mật khẩu Admin
                  </DialogTitle>
                  <DialogDescription>
                    Sau khi xác nhận, hệ thống sẽ chạy xoá dữ liệu ở nền theo từng đợt. Khi xong sẽ báo trong app và qua email nếu đã cấu hình mail.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nhập mật khẩu Admin</Label>
                    <Input type="password" placeholder="Mật khẩu..." value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetPasswordDialog}>
                    Huỷ
                  </Button>
                  <Button variant="destructive" onClick={handleStopTest} disabled={isStopping || !password}>
                    {isStopping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Bắt đầu xoá nền
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
