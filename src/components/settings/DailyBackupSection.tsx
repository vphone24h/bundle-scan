import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { Database, Download, Loader2, CheckCircle2, XCircle, Clock, RefreshCw, Archive, Crown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export function DailyBackupSection() {
  const { data: tenant } = useCurrentTenant();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();

  // Check if tenant has active paid plan
  const hasPaidPlan = (() => {
    if (!tenant) return false;
    if (tenant.subscription_plan === 'lifetime') return true;
    if (tenant.subscription_plan && tenant.subscription_end_date) {
      return new Date(tenant.subscription_end_date) > new Date();
    }
    return false;
  })();

  const { data: backups, isLoading, refetch } = useQuery({
    queryKey: ['daily-backups', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('daily_backups' as any)
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('backup_date', { ascending: false })
        .limit(60);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenant?.id,
  });

  const handleDownload = async (backup: any) => {
    if (!backup.file_path) return;
    setDownloading(backup.id);
    try {
      const { data, error } = await supabase.storage
        .from('daily-backups')
        .download(backup.file_path);
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      const label = backup.backup_type === 'full' ? 'FullBackup' : 'Backup';
      a.download = `${label}_${backup.backup_date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Đã tải file backup');
    } catch (err: any) {
      toast.error('Lỗi tải file: ' + err.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleManualBackup = async () => {
    if (!tenant?.id) return;
    setGenerating(true);
    try {
      const today = new Date();
      today.setHours(today.getHours() + 7);
      const dateStr = today.toISOString().split('T')[0];

      const { data, error } = await supabase.functions.invoke('daily-backup', {
        body: { tenantId: tenant.id, date: dateStr, mode: 'full' },
      });
      if (error) throw error;
      if (data && !data.ok) throw new Error(data.error || 'Backup thất bại');
      toast.success('Đã tạo backup toàn bộ dữ liệu thành công!');
      refetch();
    } catch (err: any) {
      toast.error('Lỗi tạo backup: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-5 w-5 text-primary" />
          Backup dữ liệu
        </CardTitle>
        {hasPaidPlan ? (
          <>
            <p className="text-xs text-muted-foreground mt-1">
              Hệ thống tự động backup dữ liệu trong ngày lúc 23:59 mỗi ngày. Nhấn "Tạo ngay" để backup toàn bộ lịch sử bán/nhập hàng. File lưu trữ 60 ngày.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualBackup}
              disabled={generating}
              className="mt-2 w-full sm:w-auto"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              {generating ? 'Đang tạo...' : 'Tạo ngay (toàn bộ dữ liệu)'}
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mt-1">
              Chức năng backup tự động chỉ khả dụng với tài khoản mua gói sử dụng. Gói miễn phí vui lòng nhấn nút "Tạo ngay" để backup thủ công.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleManualBackup}
                disabled={generating}
                className="w-full sm:w-auto"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Archive className="h-4 w-4 mr-2" />
                )}
                {generating ? 'Đang tạo...' : 'Tạo ngay (thủ công)'}
              </Button>
              <Button
                size="sm"
                onClick={() => navigate('/subscription')}
                className="w-full sm:w-auto gap-1.5"
              >
                <Crown className="h-4 w-4" />
                Nâng cấp gói sử dụng
              </Button>
            </div>
          </>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !backups?.length ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Chưa có backup nào. Nhấn "Tạo ngay" để tạo backup đầu tiên.
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-1">
              {backups.map((b: any) => {
                const stats = b.stats || {};
                const isFullBackup = b.backup_type === 'full';
                const rawDate = b.backup_date?.replace('_full', '') || b.backup_date;
                const dateFormatted = (() => {
                  try {
                    return format(parseISO(rawDate), 'dd/MM/yyyy', { locale: vi });
                  } catch {
                    return rawDate;
                  }
                })();

                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {statusIcon(b.status)}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{dateFormatted}</p>
                          {isFullBackup ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                              Toàn bộ
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                              Trong ngày
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {b.status === 'completed' && (
                            <>
                              <span>{stats.exports || 0} bán</span>
                              <span>•</span>
                              <span>{stats.imports || 0} nhập</span>
                              <span>•</span>
                              <span>{stats.inventory || 0} tồn</span>
                              {b.file_size > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{formatSize(b.file_size)}</span>
                                </>
                              )}
                            </>
                          )}
                          {b.status === 'failed' && (
                            <span className="text-destructive">{b.error_message || 'Lỗi'}</span>
                          )}
                          {b.status === 'processing' && <span>Đang xử lý...</span>}
                        </div>
                      </div>
                    </div>

                    {b.status === 'completed' && b.file_path && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(b)}
                        disabled={downloading === b.id}
                        className="shrink-0 ml-2"
                      >
                        {downloading === b.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
