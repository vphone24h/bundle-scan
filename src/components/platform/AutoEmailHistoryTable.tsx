import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Mail, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { PlatformEmailAutomationLog } from '@/hooks/usePlatformEmailAutomations';

export function AutoEmailHistoryTable() {
  const queryClient = useQueryClient();
  const [resendingId, setResendingId] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['platform-email-automation-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_email_automation_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as PlatformEmailAutomationLog[];
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (log: PlatformEmailAutomationLog) => {
      setResendingId(log.id);
      // Get the automation to retrieve html_content
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
    onError: (err: any) => {
      toast.error('Lỗi gửi lại: ' + err.message);
    },
    onSettled: () => setResendingId(null),
  });

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
              {logs.map((log) => (
                <TableRow key={log.id}>
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
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="h-3.5 w-3.5" /> Đã gửi
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-destructive">
                        <XCircle className="h-3.5 w-3.5" /> Lỗi
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.status !== 'sent' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => resendMutation.mutate(log)}
                        disabled={resendingId === log.id}
                        title="Gửi lại"
                      >
                        <RefreshCw className={`h-4 w-4 ${resendingId === log.id ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {logs.map((log) => (
          <Card key={log.id} className="p-4">
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
                  <Badge variant="secondary" className="text-xs gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" /> Đã gửi
                  </Badge>
                ) : (
                  <>
                    <Badge variant="destructive" className="text-xs gap-1">
                      <XCircle className="h-3 w-3" /> Lỗi
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => resendMutation.mutate(log)}
                      disabled={resendingId === log.id}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${resendingId === log.id ? 'animate-spin' : ''}`} />
                      Gửi lại
                    </Button>
                  </>
                )}
              </div>
            </div>
            {log.error_message && (
              <p className="text-[10px] text-destructive mt-1">{log.error_message}</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
