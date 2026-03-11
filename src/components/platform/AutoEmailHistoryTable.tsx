import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Mail, CheckCircle, XCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import DOMPurify from 'dompurify';
import type { PlatformEmailAutomationLog } from '@/hooks/usePlatformEmailAutomations';

const PAGE_SIZE = 20;

function PaginationControls({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

type StatusFilter = 'all' | 'sent' | 'failed';

export function AutoEmailHistoryTable() {
  const queryClient = useQueryClient();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [bulkResending, setBulkResending] = useState(false);
  const [page, setPage] = useState(1);
  const [previewLog, setPreviewLog] = useState<PlatformEmailAutomationLog | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['platform-email-automation-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_email_automation_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as PlatformEmailAutomationLog[];
    },
  });

  const stats = useMemo(() => {
    if (!logs) return { total: 0, sent: 0, failed: 0 };
    return {
      total: logs.length,
      sent: logs.filter(l => l.status === 'sent').length,
      failed: logs.filter(l => l.status !== 'sent').length,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    if (statusFilter === 'sent') return logs.filter(l => l.status === 'sent');
    if (statusFilter === 'failed') return logs.filter(l => l.status !== 'sent');
    return logs;
  }, [logs, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pagedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resendMutation = useMutation({
    mutationFn: async (log: PlatformEmailAutomationLog) => {
      setResendingId(log.id);
      const { data: automation } = await supabase
        .from('platform_email_automations' as any)
        .select('html_content')
        .eq('id', log.automation_id)
        .single();
      const { data, error } = await supabase.functions.invoke('send-bulk-email', {
        body: {
          emails: [log.recipient_email],
          subject: log.subject,
          htmlContent: (automation as any)?.html_content || '<p>Nội dung email</p>',
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Đã gửi lại email');
      queryClient.invalidateQueries({ queryKey: ['platform-email-automation-logs'] });
    },
    onError: (err: any) => toast.error('Lỗi gửi lại: ' + err.message),
    onSettled: () => setResendingId(null),
  });

  const bulkResendMutation = useMutation({
    mutationFn: async () => {
      setBulkResending(true);
      const failedLogs = (logs || []).filter(l => l.status !== 'sent');
      if (failedLogs.length === 0) throw new Error('Không có email thất bại');

      // Group by automation_id to get html_content
      const automationIds = [...new Set(failedLogs.map(l => l.automation_id).filter(Boolean))];
      const automationContents: Record<string, string> = {};
      for (const aid of automationIds) {
        const { data } = await supabase
          .from('platform_email_automations' as any)
          .select('html_content')
          .eq('id', aid)
          .single();
        if (data) automationContents[aid as string] = (data as any).html_content;
      }

      // Group by subject + automation for batch sending
      const grouped: Record<string, { emails: string[]; subject: string; html: string }> = {};
      for (const log of failedLogs) {
        const key = `${log.automation_id || 'none'}_${log.subject}`;
        if (!grouped[key]) {
          grouped[key] = {
            emails: [],
            subject: log.subject,
            html: (log.automation_id ? automationContents[log.automation_id] : null) || '<p>Nội dung email</p>',
          };
        }
        grouped[key].emails.push(log.recipient_email);
      }

      let totalSent = 0, totalFailed = 0;
      for (const g of Object.values(grouped)) {
        const { data, error } = await supabase.functions.invoke('send-bulk-email', {
          body: { emails: g.emails, subject: g.subject, htmlContent: g.html },
        });
        if (!error && data) {
          totalSent += data.sent || 0;
          totalFailed += data.failed || 0;
        } else {
          totalFailed += g.emails.length;
        }
      }
      return { totalSent, totalFailed };
    },
    onSuccess: ({ totalSent, totalFailed }) => {
      toast.success(`Gửi lại: ${totalSent} thành công${totalFailed > 0 ? `, ${totalFailed} thất bại` : ''}`);
      queryClient.invalidateQueries({ queryKey: ['platform-email-automation-logs'] });
    },
    onError: (err: any) => toast.error('Lỗi gửi lại: ' + err.message),
    onSettled: () => setBulkResending(false),
  });

  const handleFilterChange = (filter: StatusFilter) => {
    setStatusFilter(prev => prev === filter ? 'all' : filter);
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Chưa có email tự động nào được gửi</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          className="cursor-pointer text-xs px-3 py-1"
          onClick={() => handleFilterChange('all')}
        >
          Tất cả: {stats.total}
        </Badge>
        <Badge
          variant={statusFilter === 'sent' ? 'default' : 'outline'}
          className={`cursor-pointer text-xs px-3 py-1 ${statusFilter === 'sent' ? '' : 'text-green-600 border-green-300 hover:bg-green-50'}`}
          onClick={() => handleFilterChange('sent')}
        >
          <CheckCircle className="h-3 w-3 mr-1" /> Thành công: {stats.sent}
        </Badge>
        <Badge
          variant={statusFilter === 'failed' ? 'destructive' : 'outline'}
          className={`cursor-pointer text-xs px-3 py-1 ${statusFilter === 'failed' ? '' : 'text-destructive border-destructive/30 hover:bg-destructive/10'}`}
          onClick={() => handleFilterChange('failed')}
        >
          <XCircle className="h-3 w-3 mr-1" /> Thất bại: {stats.failed}
        </Badge>

        {statusFilter === 'failed' && stats.failed > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto text-xs h-7"
            onClick={() => bulkResendMutation.mutate()}
            disabled={bulkResending}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${bulkResending ? 'animate-spin' : ''}`} />
            Gửi lại tất cả ({stats.failed})
          </Button>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Người nhận</TableHead>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedLogs.map((log) => (
                <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setPreviewLog(log)}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>
                      {log.recipient_name && <span className="font-medium">{log.recipient_name} · </span>}
                      {log.recipient_email}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs line-clamp-1">{log.subject}</TableCell>
                  <TableCell>
                    {log.status === 'sent' ? (
                      <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="h-3.5 w-3.5" /> Đã gửi</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3.5 w-3.5" /> Lỗi</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.status !== 'sent' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); resendMutation.mutate(log); }} disabled={resendingId === log.id} title="Gửi lại">
                        <RefreshCw className={`h-4 w-4 ${resendingId === log.id ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {pagedLogs.map((log) => (
          <Card key={log.id} className="p-4 cursor-pointer active:bg-muted/50" onClick={() => setPreviewLog(log)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium line-clamp-1">{log.subject}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {log.recipient_name && `${log.recipient_name} · `}{log.recipient_email}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {log.status === 'sent' ? (
                  <Badge variant="secondary" className="text-xs gap-1"><CheckCircle className="h-3 w-3 text-green-600" /> Đã gửi</Badge>
                ) : (
                  <>
                    <Badge variant="destructive" className="text-xs gap-1"><XCircle className="h-3 w-3" /> Lỗi</Badge>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); resendMutation.mutate(log); }} disabled={resendingId === log.id}>
                      <RefreshCw className={`h-3 w-3 mr-1 ${resendingId === log.id ? 'animate-spin' : ''}`} />Gửi lại
                    </Button>
                  </>
                )}
              </div>
            </div>
            {log.error_message && <p className="text-[10px] text-destructive mt-1">{log.error_message}</p>}
          </Card>
        ))}
        <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewLog} onOpenChange={(open) => !open && setPreviewLog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết email</DialogTitle>
          </DialogHeader>
          {previewLog && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Người nhận</p>
                  <p className="font-medium">{previewLog.recipient_name && `${previewLog.recipient_name} · `}{previewLog.recipient_email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Thời gian</p>
                  <p>{format(new Date(previewLog.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tiêu đề</p>
                <p className="text-sm font-medium">{previewLog.subject}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Trạng thái</p>
                {previewLog.status === 'sent' ? (
                  <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Đã gửi</Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Lỗi: {previewLog.error_message}</Badge>
                )}
              </div>
              {previewLog.body_html ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Nội dung</p>
                  <div className="border rounded-lg p-4 bg-white text-black text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewLog.body_html) }} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Không có nội dung HTML (email cũ chưa lưu body)</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
