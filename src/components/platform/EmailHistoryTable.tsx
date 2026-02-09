import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Eye, Mail, CheckCircle, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface EmailRecord {
  id: string;
  subject: string;
  html_content: string | null;
  recipients: string[];
  total_recipients: number;
  success_count: number;
  fail_count: number;
  sent_by: string | null;
  created_at: string;
}

export function EmailHistoryTable() {
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);

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
                <TableHead>Ngày giờ</TableHead>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Người nhận</TableHead>
                <TableHead>Kết quả</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(email.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium line-clamp-1">{email.subject}</span>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedEmail(email)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
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
            className="p-4 cursor-pointer active:bg-muted/50"
            onClick={() => setSelectedEmail(email)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm line-clamp-1">{email.subject}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(email.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">{email.total_recipients}</Badge>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs">
              {email.success_count > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" /> {email.success_count} thành công
                </span>
              )}
              {email.fail_count > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3 w-3" /> {email.fail_count} thất bại
                </span>
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
                    <span className="text-sm text-green-600">{selectedEmail.success_count} thành công</span>
                    {selectedEmail.fail_count > 0 && (
                      <span className="text-sm text-destructive">{selectedEmail.fail_count} thất bại</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Tiêu đề</p>
                <p className="text-sm font-medium">{selectedEmail.subject}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Người nhận ({selectedEmail.total_recipients})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedEmail.recipients as string[]).map((email, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {email}
                    </Badge>
                  ))}
                </div>
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
