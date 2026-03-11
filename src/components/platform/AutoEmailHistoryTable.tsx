import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Mail, CheckCircle, XCircle, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Ban, Zap } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import DOMPurify from 'dompurify';
import type { PlatformEmailAutomationLog } from '@/hooks/usePlatformEmailAutomations';
import { usePlatformEmailAutomations } from '@/hooks/usePlatformEmailAutomations';

const PAGE_SIZE = 20;

interface GroupedScenario {
  automationId: string | null;
  automationName: string;
  logs: PlatformEmailAutomationLog[];
  sent: number;
  failed: number;
  skipped: number;
  lastRun: string;
}

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

function ScenarioDetail({ group }: { group: GroupedScenario }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [page, setPage] = useState(1);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [bulkResending, setBulkResending] = useState(false);
  const [previewLog, setPreviewLog] = useState<PlatformEmailAutomationLog | null>(null);

  const filteredLogs = useMemo(() => {
    const active = group.logs.filter(l => !(l as any).skip_resend);
    if (statusFilter === 'sent') return active.filter(l => l.status === 'sent');
    if (statusFilter === 'failed') return active.filter(l => l.status !== 'sent');
    return active;
  }, [group.logs, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pagedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const failedCount = group.logs.filter(l => l.status !== 'sent' && !(l as any).skip_resend).length;

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
      if (data?.sent > 0) {
        await supabase
          .from('platform_email_automation_logs' as any)
          .update({ status: 'sent', error_message: null, sent_at: new Date().toISOString() } as any)
          .eq('id', log.id);
      }
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
      const failedLogs = group.logs.filter(l => l.status !== 'sent' && !(l as any).skip_resend);
      if (failedLogs.length === 0) throw new Error('Không có email thất bại');

      const { data: automation } = group.automationId
        ? await supabase.from('platform_email_automations' as any).select('html_content').eq('id', group.automationId).single()
        : { data: null };
      const htmlContent = (automation as any)?.html_content || '<p>Nội dung email</p>';

      const emails = failedLogs.map(l => l.recipient_email);
      const { data, error } = await supabase.functions.invoke('send-bulk-email', {
        body: { emails, subject: failedLogs[0].subject, htmlContent },
      });
      if (error) throw error;

      const failedEmailSet = new Set(data?.failedEmails || []);
      const successLogIds = failedLogs.filter(l => !failedEmailSet.has(l.recipient_email)).map(l => l.id);
      if (successLogIds.length > 0) {
        await supabase
          .from('platform_email_automation_logs' as any)
          .update({ status: 'sent', error_message: null, sent_at: new Date().toISOString() } as any)
          .in('id', successLogIds);
      }
      return { sent: data?.sent || 0, failed: data?.failed || 0 };
    },
    onSuccess: ({ sent, failed }) => {
      toast.success(`Gửi lại: ${sent} thành công${failed > 0 ? `, ${failed} thất bại` : ''}`);
      queryClient.invalidateQueries({ queryKey: ['platform-email-automation-logs'] });
    },
    onError: (err: any) => toast.error('Lỗi: ' + err.message),
    onSettled: () => setBulkResending(false),
  });

  const skipMutation = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase
        .from('platform_email_automation_logs' as any)
        .update({ skip_resend: true } as any)
        .eq('id', logId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Đã đánh dấu bỏ qua');
      queryClient.invalidateQueries({ queryKey: ['platform-email-automation-logs'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          className="cursor-pointer text-xs px-3 py-1"
          onClick={() => { setStatusFilter('all'); setPage(1); }}
        >
          Tất cả: {group.logs.filter(l => !(l as any).skip_resend).length}
        </Badge>
        <Badge
          variant={statusFilter === 'sent' ? 'default' : 'outline'}
          className={`cursor-pointer text-xs px-3 py-1 ${statusFilter === 'sent' ? '' : 'text-green-600 border-green-300 hover:bg-green-50'}`}
          onClick={() => { setStatusFilter(s => s === 'sent' ? 'all' : 'sent'); setPage(1); }}
        >
          <CheckCircle className="h-3 w-3 mr-1" /> Thành công: {group.sent}
        </Badge>
        <Badge
          variant={statusFilter === 'failed' ? 'destructive' : 'outline'}
          className={`cursor-pointer text-xs px-3 py-1 ${statusFilter === 'failed' ? '' : 'text-destructive border-destructive/30 hover:bg-destructive/10'}`}
          onClick={() => { setStatusFilter(s => s === 'failed' ? 'all' : 'failed'); setPage(1); }}
        >
          <XCircle className="h-3 w-3 mr-1" /> Thất bại: {failedCount}
        </Badge>
        {group.skipped > 0 && (
          <Badge variant="outline" className="text-xs px-3 py-1 text-muted-foreground">
            <Ban className="h-3 w-3 mr-1" /> Bỏ qua: {group.skipped}
          </Badge>
        )}

        {failedCount > 0 && statusFilter === 'failed' && (
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto text-xs h-7"
            onClick={() => bulkResendMutation.mutate()}
            disabled={bulkResending}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${bulkResending ? 'animate-spin' : ''}`} />
            Gửi lại tất cả ({failedCount})
          </Button>
        )}
      </div>

      {/* Log list */}
      <div className="space-y-2">
        {pagedLogs.map(log => (
          <Card key={log.id} className="p-3 cursor-pointer hover:bg-muted/50" onClick={() => setPreviewLog(log)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">
                  {log.recipient_name && `${log.recipient_name} · `}{log.recipient_email}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </p>
                {log.error_message && (
                  <p className="text-[10px] text-destructive mt-1 line-clamp-2">{log.error_message}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {log.status === 'sent' ? (
                  <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
                    <CheckCircle className="h-3 w-3 text-green-600" /> Đã gửi
                  </Badge>
                ) : (
                  <>
                    <Badge variant="destructive" className="text-[10px] gap-0.5 px-1.5 py-0">
                      <XCircle className="h-3 w-3" /> Lỗi
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={(e) => { e.stopPropagation(); resendMutation.mutate(log); }}
                      disabled={resendingId === log.id}
                    >
                      <RefreshCw className={`h-3 w-3 mr-0.5 ${resendingId === log.id ? 'animate-spin' : ''}`} /> Gửi lại
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-1.5 text-muted-foreground"
                      onClick={(e) => { e.stopPropagation(); skipMutation.mutate(log.id); }}
                      title="Bỏ qua, không gửi lại nữa"
                    >
                      <Ban className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />

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
                <p className="text-xs text-muted-foreground italic">Không có nội dung HTML</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AutoEmailHistoryTable() {
  const { data: automations = [] } = usePlatformEmailAutomations();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['platform-email-automation-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_email_automation_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as unknown as (PlatformEmailAutomationLog & { skip_resend?: boolean })[];
    },
  });

  const groups = useMemo((): GroupedScenario[] => {
    if (!logs) return [];
    const nameMap: Record<string, string> = {};
    automations.forEach(a => { nameMap[a.id] = a.name; });

    const map: Record<string, PlatformEmailAutomationLog[]> = {};
    for (const log of logs) {
      const key = log.automation_id || '__manual__';
      if (!map[key]) map[key] = [];
      map[key].push(log);
    }

    return Object.entries(map).map(([key, groupLogs]) => {
      const activeLogs = groupLogs.filter(l => !(l as any).skip_resend);
      return {
        automationId: key === '__manual__' ? null : key,
        automationName: key === '__manual__' ? 'Gửi thủ công' : (nameMap[key] || 'Kịch bản đã xóa'),
        logs: groupLogs,
        sent: activeLogs.filter(l => l.status === 'sent').length,
        failed: activeLogs.filter(l => l.status !== 'sent').length,
        skipped: groupLogs.filter(l => (l as any).skip_resend).length,
        lastRun: groupLogs[0]?.created_at || '',
      };
    }).sort((a, b) => b.lastRun.localeCompare(a.lastRun));
  }, [logs, automations]);

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
    <div className="space-y-3">
      {groups.map(group => {
        const isExpanded = expandedId === (group.automationId || '__manual__');
        const key = group.automationId || '__manual__';

        return (
          <Card key={key}>
            <CardContent className="p-0">
              {/* Summary row */}
              <div
                className="flex items-center gap-3 p-3 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : key)}
              >
                <div className="shrink-0 text-muted-foreground">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
                <Zap className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{group.automationName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Lần cuối: {format(new Date(group.lastRun), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
                    <CheckCircle className="h-3 w-3 text-green-600" /> {group.sent}
                  </Badge>
                  {group.failed > 0 && (
                    <Badge variant="destructive" className="text-[10px] gap-0.5 px-1.5 py-0">
                      <XCircle className="h-3 w-3" /> {group.failed}
                    </Badge>
                  )}
                  {group.skipped > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-0.5 px-1.5 py-0 text-muted-foreground">
                      <Ban className="h-3 w-3" /> {group.skipped}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t px-3 sm:px-4 py-3">
                  <ScenarioDetail group={group} />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
