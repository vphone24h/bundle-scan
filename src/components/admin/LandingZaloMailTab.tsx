import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { MessageCircle, RefreshCw, Loader2, Send } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  sent: { label: 'Đã gửi', variant: 'default' },
  success: { label: 'Thành công', variant: 'default' },
  failed: { label: 'Lỗi', variant: 'destructive' },
  error: { label: 'Lỗi', variant: 'destructive' },
  pending: { label: 'Đang gửi', variant: 'secondary' },
};

function useZaloLogs() {
  return useQuery({
    queryKey: ['zalo-message-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zalo_message_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
  });
}

function ZaloLogsTable() {
  const { data: logs, isLoading, refetch } = useZaloLogs();
  const [search, setSearch] = useState('');
  const [resending, setResending] = useState<string | null>(null);

  const filtered = (logs || []).filter(log =>
    !search ||
    log.customer_phone?.includes(search) ||
    log.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    log.message_type?.toLowerCase().includes(search.toLowerCase())
  );

  const handleResend = async (log: any) => {
    setResending(log.id);
    try {
      const { error } = await supabase.functions.invoke('send-zalo-message', {
        body: {
          tenant_id: log.tenant_id,
          customer_name: log.customer_name,
          customer_phone: log.customer_phone,
          message_type: log.message_type,
        },
      });
      if (error) throw error;
      toast.success('Đã gửi lại tin nhắn Zalo!');
      refetch();
    } catch (err: any) {
      toast.error('Gửi lại thất bại: ' + (err.message || 'Lỗi'));
    } finally {
      setResending(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Tìm theo SĐT, tên khách..."
          className="flex-1"
        />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">Chưa có lịch sử gửi Zalo</p>
      ) : (
        <div className="border rounded-lg overflow-auto max-h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Thời gian</TableHead>
                <TableHead className="text-xs">Khách hàng</TableHead>
                <TableHead className="text-xs">SĐT</TableHead>
                <TableHead className="text-xs">Loại</TableHead>
                <TableHead className="text-xs">Trạng thái</TableHead>
                <TableHead className="text-xs">Lỗi</TableHead>
                <TableHead className="text-xs w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(log => {
                const st = STATUS_BADGE[log.status] || STATUS_BADGE.pending;
                const isFailed = log.status === 'failed' || log.status === 'error';
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: vi })}
                    </TableCell>
                    <TableCell className="text-xs max-w-[120px] truncate">{log.customer_name || '-'}</TableCell>
                    <TableCell className="text-xs">{log.customer_phone}</TableCell>
                    <TableCell className="text-xs">
                      {log.message_type === 'order_confirmation' ? 'Đặt hàng' :
                       log.message_type === 'export_confirmation' ? 'Xuất hàng' :
                       log.message_type === 'test' ? 'Test' : log.message_type}
                    </TableCell>
                    <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                    <TableCell className="text-xs text-destructive max-w-[150px] truncate">{log.error_message || '-'}</TableCell>
                    <TableCell>
                      {isFailed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={resending === log.id}
                          onClick={() => handleResend(log)}
                        >
                          {resending === log.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function LandingZaloMailTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" />
          Quản lý Zalo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ZaloLogsTable />
      </CardContent>
    </Card>
  );
}
