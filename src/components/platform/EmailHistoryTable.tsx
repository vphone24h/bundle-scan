import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Eye, Mail, CheckCircle, XCircle, RefreshCw, MailOpen, MailIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EmailRecord {
  id: string;
  subject: string;
  html_content: string | null;
  recipients: string[];
  total_recipients: number;
  success_count: number;
  fail_count: number;
  failed_emails: string[] | null;
  sent_by: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

interface EmailOpen {
  recipient_email: string;
  opened_at: string;
}

export function EmailHistoryTable() {
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  const [emailFilter, setEmailFilter] = useState<'all' | 'success' | 'failed'>('all');
  const queryClient = useQueryClient();

  const { data: emails, isLoading } = useQuery({
    queryKey: ['email-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as EmailRecord[];
    },
  });

  // Fetch email opens for selected email
  const { data: emailOpens } = useQuery({
    queryKey: ['email-opens', selectedEmail?.id],
    queryFn: async () => {
      if (!selectedEmail?.id) return [];
      const { data, error } = await supabase
        .from('email_opens')
        .select('recipient_email, opened_at')
        .eq('email_history_id', selectedEmail.id);
      if (error) throw error;
      return (data || []) as EmailOpen[];
    },
    enabled: !!selectedEmail?.id,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_history')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-history'] }),
  });

  const resendMutation = useMutation({
    mutationFn: async (record: EmailRecord) => {
      // Chỉ gửi lại email thất bại, KHÔNG gửi lại toàn bộ để tránh spam
      const failedList = record.failed_emails && record.failed_emails.length > 0
        ? record.failed_emails
        : null;
      if (!failedList || failedList.length === 0) throw new Error('Không có danh sách email thất bại để gửi lại. Bản ghi cũ không lưu danh sách này.');

      const { data, error } = await supabase.functions.invoke('send-bulk-email', {
        body: {
          emails: failedList,
          subject: record.subject,
          htmlContent: record.html_content || '',
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Gửi lại thành công',
        description: `Đã gửi ${data.sent} email${data.failed > 0 ? `, ${data.failed} vẫn thất bại` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['email-history'] });
    },
    onError: (err: any) => {
      toast({ title: 'Lỗi gửi lại', description: err.message, variant: 'destructive' });
    },
  });

  const handleView = (email: EmailRecord) => {
    setSelectedEmail(email);
    setEmailFilter('all');
    if (!email.is_read) markReadMutation.mutate(email.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!emails || emails.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Chưa có email nào được gửi</p>
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
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Ngày giờ</TableHead>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Người nhận</TableHead>
                <TableHead>Kết quả</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow
                  key={email.id}
                  className={!email.is_read ? 'bg-primary/5 font-medium' : ''}
                >
                  <TableCell>
                    {email.is_read ? (
                      <MailOpen className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <MailIcon className="h-4 w-4 text-primary" />
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(email.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="line-clamp-1">{email.subject}</span>
                      {email.html_content && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 font-normal"
                          dangerouslySetInnerHTML={{
                            __html: email.html_content.replace(/<[^>]*>/g, ' ').slice(0, 80),
                          }}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{email.total_recipients} người</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {email.success_count > 0 && (
                        <span className="flex items-center gap-1 text-sm text-green-600">
                          <CheckCircle className="h-3.5 w-3.5" />
                          {email.success_count}
                        </span>
                      )}
                      {email.fail_count > 0 && (
                        <span className="flex items-center gap-1 text-sm text-destructive">
                          <XCircle className="h-3.5 w-3.5" />
                          {email.fail_count}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleView(email)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {email.failed_emails && email.failed_emails.length > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => resendMutation.mutate(email)}
                          disabled={resendMutation.isPending}
                          title="Gửi lại email thất bại"
                        >
                          <RefreshCw className={`h-4 w-4 ${resendMutation.isPending ? 'animate-spin' : ''}`} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {emails.map((email) => (
          <Card
            key={email.id}
            className={`p-4 cursor-pointer active:bg-muted/50 ${!email.is_read ? 'border-primary/30 bg-primary/5' : ''}`}
            onClick={() => handleView(email)}
          >
            <div className="flex items-start gap-2">
              {email.is_read ? (
                <MailOpen className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              ) : (
                <MailIcon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm line-clamp-1 ${!email.is_read ? 'font-semibold' : 'font-medium'}`}>
                    {email.subject}
                  </p>
                  <Badge variant="secondary" className="shrink-0 text-xs">{email.total_recipients}</Badge>
                </div>
                {email.html_content && (
                  <p
                    className="text-xs text-muted-foreground line-clamp-1 mt-0.5"
                    dangerouslySetInnerHTML={{
                      __html: email.html_content.replace(/<[^>]*>/g, ' ').slice(0, 60),
                    }}
                  />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(email.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs">
                {email.success_count > 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" /> {email.success_count}
                  </span>
                )}
                {email.fail_count > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-3 w-3" /> {email.fail_count}
                  </span>
                )}
              </div>
              {email.failed_emails && email.failed_emails.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    resendMutation.mutate(email);
                  }}
                  disabled={resendMutation.isPending}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${resendMutation.isPending ? 'animate-spin' : ''}`} />
                  Gửi lại
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={(open) => !open && setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết email</DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Ngày gửi</p>
                  <p className="text-sm font-medium">
                    {format(new Date(selectedEmail.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Kết quả</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-sm cursor-pointer rounded px-2 py-0.5 transition-colors ${emailFilter === 'success' ? 'bg-green-100 text-green-700 font-semibold' : 'text-green-600 hover:bg-green-50'}`}
                      onClick={() => setEmailFilter(emailFilter === 'success' ? 'all' : 'success')}
                    >
                      {selectedEmail.success_count} thành công
                    </span>
                    {selectedEmail.fail_count > 0 && (
                      <span
                        className={`text-sm cursor-pointer rounded px-2 py-0.5 transition-colors ${emailFilter === 'failed' ? 'bg-destructive/15 text-destructive font-semibold' : 'text-destructive hover:bg-destructive/10'}`}
                        onClick={() => setEmailFilter(emailFilter === 'failed' ? 'all' : 'failed')}
                      >
                        {selectedEmail.fail_count} thất bại
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Tiêu đề</p>
                <p className="text-sm font-medium">{selectedEmail.subject}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">
                    Người nhận
                    {emailFilter === 'failed' && ` (${selectedEmail.failed_emails?.length || selectedEmail.fail_count} thất bại)`}
                    {emailFilter === 'success' && ` (${selectedEmail.success_count} thành công)`}
                    {emailFilter === 'all' && ` (${selectedEmail.total_recipients})`}
                  </p>
                  {emailFilter === 'failed' && selectedEmail.fail_count > 0 && (
                    <Button
                      onClick={() => {
                        resendMutation.mutate(selectedEmail);
                        setSelectedEmail(null);
                        setEmailFilter('all');
                      }}
                      disabled={resendMutation.isPending}
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${resendMutation.isPending ? 'animate-spin' : ''}`} />
                      Gửi lại {selectedEmail.failed_emails?.length || selectedEmail.fail_count} email
                    </Button>
                  )}
                </div>
                <TooltipProvider>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedEmail.recipients as string[])
                    .filter((email) => {
                      if (emailFilter === 'failed') return selectedEmail.failed_emails?.includes(email) ?? true;
                      if (emailFilter === 'success') return !(selectedEmail.failed_emails?.includes(email) ?? false);
                      return true;
                    })
                    .map((email, i) => {
                      const isFailed = selectedEmail.failed_emails?.includes(email);
                      const openRecord = emailOpens?.find(o => o.recipient_email === email);
                      const isOpened = !!openRecord;
                      return (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant={isFailed ? 'destructive' : 'outline'}
                              className={`text-xs cursor-default ${isOpened && !isFailed ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''}`}
                            >
                              {isOpened && !isFailed && <MailOpen className="h-3 w-3 mr-1 text-green-600" />}
                              {email}
                              {isFailed && <XCircle className="h-3 w-3 ml-1" />}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isFailed ? 'Gửi thất bại' : isOpened
                              ? `Đã xem lúc ${format(new Date(openRecord.opened_at), 'dd/MM/yyyy HH:mm', { locale: vi })}`
                              : 'Chưa xem'}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                </div>
                </TooltipProvider>
              </div>

              {selectedEmail.html_content && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Nội dung</p>
                  <div
                    className="border rounded-lg p-4 bg-muted/30 text-sm prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.html_content }}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
