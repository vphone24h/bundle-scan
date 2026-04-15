import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchInput } from '@/components/ui/search-input';
import { MessageCircle, RefreshCw, Loader2, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  sent: { label: 'Đã gửi', variant: 'default' },
  success: { label: 'Thành công', variant: 'default' },
  failed: { label: 'Lỗi', variant: 'destructive' },
  error: { label: 'Lỗi', variant: 'destructive' },
  pending: { label: 'Đang gửi', variant: 'secondary' },
};

const PAGE_SIZE = 20;

interface ZaloLogSectionProps {
  zaloLogs: any[];
  isLoading: boolean;
  onRefetch: () => void;
}

export function ZaloLogSection({ zaloLogs, isLoading, onRefetch }: ZaloLogSectionProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [resending, setResending] = useState<string | null>(null);

  const filtered = (zaloLogs || []).filter(log =>
    !search ||
    log.customer_phone?.includes(search) ||
    log.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    log.message_type?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
      onRefetch();
    } catch (err: any) {
      toast.error('Gửi lại thất bại: ' + (err.message || 'Lỗi'));
    } finally {
      setResending(null);
    }
  };

  const getMessageTypeLabel = (type: string) => {
    switch (type) {
      case 'order_confirmation': return 'Đặt hàng';
      case 'export_confirmation': return 'Xuất hàng';
      case 'test': return 'Test';
      case 'bulk_crm': return 'CRM';
      case 'automation': return 'Tự động';
      default: return type;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Tìm theo SĐT, tên khách..."
          className="flex-1"
        />
        <Button variant="outline" size="sm" onClick={onRefetch}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Chưa có lịch sử gửi Zalo</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Thời gian</TableHead>
                  <TableHead className="text-xs">Khách hàng</TableHead>
                  <TableHead className="text-xs">SĐT</TableHead>
                  <TableHead className="text-xs">Loại</TableHead>
                  <TableHead className="text-xs">Trạng thái</TableHead>
                  <TableHead className="text-xs w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map(log => {
                  const st = STATUS_BADGE[log.status] || STATUS_BADGE.pending;
                  const isFailed = log.status === 'failed' || log.status === 'error';
                  return (
                    <TableRow 
                      key={log.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedLog(log)}
                    >
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: vi })}
                      </TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">{log.customer_name || '-'}</TableCell>
                      <TableCell className="text-xs">{log.customer_phone}</TableCell>
                      <TableCell className="text-xs">{getMessageTypeLabel(log.message_type)}</TableCell>
                      <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                      <TableCell>
                        {isFailed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={resending === log.id}
                            onClick={(e) => { e.stopPropagation(); handleResend(log); }}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Detail popup */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <MessageCircle className="h-4 w-4 text-blue-500" />
              Chi tiết tin nhắn Zalo
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Khách hàng</p>
                  <p className="font-medium">{selectedLog.customer_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">SĐT</p>
                  <p className="font-medium">{selectedLog.customer_phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Thời gian</p>
                  <p>{format(new Date(selectedLog.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Loại</p>
                  <p>{getMessageTypeLabel(selectedLog.message_type)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Trạng thái</p>
                  <Badge variant={STATUS_BADGE[selectedLog.status]?.variant || 'secondary'} className="text-[10px]">
                    {STATUS_BADGE[selectedLog.status]?.label || selectedLog.status}
                  </Badge>
                </div>
              </div>
              {selectedLog.message_content && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Nội dung tin nhắn</p>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                    {selectedLog.message_content}
                  </div>
                </div>
              )}
              {selectedLog.error_message && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Lỗi</p>
                  <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-xs">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}