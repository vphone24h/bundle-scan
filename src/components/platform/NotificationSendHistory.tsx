import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { History, User, Bell, Mail, MonitorSmartphone, Pin, PinOff, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CHANNEL_ICONS: Record<string, { icon: typeof Bell; label: string }> = {
  bell: { icon: Bell, label: 'Chuông' },
  popup: { icon: MonitorSmartphone, label: 'Popup' },
  email: { icon: Mail, label: 'Email' },
};

// ===== COMBINED NOTIFICATION HISTORY =====
interface HistoryItem {
  id: string;
  title: string;
  message: string;
  source: 'manual' | 'automation';
  is_pinned: boolean;
  is_active: boolean;
  notification_type: string;
  created_at: string;
  target_audience: string;
  read_count: number;
}

function useNotificationHistory() {
  return useQuery({
    queryKey: ['notification-send-history'],
    queryFn: async () => {
      // Get all sent notifications (both manual and automation)
      const { data: notifications, error } = await supabase
        .from('system_notifications')
        .select('id, title, message, source, is_pinned, is_active, notification_type, created_at, target_audience')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      // Get read counts per notification
      const notifIds = (notifications || []).map(n => n.id);
      let readCounts: Record<string, number> = {};
      if (notifIds.length > 0) {
        const { data: reads } = await supabase
          .from('system_notification_reads')
          .select('notification_id');
        if (reads) {
          for (const r of reads) {
            readCounts[r.notification_id] = (readCounts[r.notification_id] || 0) + 1;
          }
        }
      }

      return (notifications || []).map(n => ({
        ...n,
        source: (n.source || 'manual') as 'manual' | 'automation',
        read_count: readCounts[n.id] || 0,
      })) as HistoryItem[];
    },
  });
}

function useTogglePin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pin }: { id: string; pin: boolean }) => {
      const updateData: any = { is_pinned: pin };
      // Khi ghim: áp dụng cho tất cả tài khoản
      if (pin) {
        updateData.target_audience = 'all';
        updateData.target_tenant_ids = [];
      }
      const { error } = await supabase
        .from('system_notifications')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { pin }) => {
      queryClient.invalidateQueries({ queryKey: ['notification-send-history'] });
      queryClient.invalidateQueries({ queryKey: ['system-notifications-admin'] });
      toast.success(pin ? 'Đã ghim thông báo (áp dụng tất cả TK)' : 'Đã bỏ ghim');
    },
  });
}

// ===== MANUAL NOTIFICATION READ HISTORY TABLE =====
export function ManualNotificationHistoryTable() {
  return <UnifiedNotificationHistory />;
}

// ===== AUTOMATION SEND HISTORY TABLE (kept for backwards compat) =====
export function AutomationHistoryTable() {
  return null; // Merged into ManualNotificationHistoryTable
}

// ===== UNIFIED COMPONENT =====
function UnifiedNotificationHistory() {
  const { data: items = [], isLoading } = useNotificationHistory();
  const togglePin = useTogglePin();
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'automation'>('all');
  const [search, setSearch] = useState('');

  const filtered = items.filter(item => {
    if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Lịch sử gửi thông báo</h3>
        <Badge variant="secondary" className="text-[10px]">{filtered.length}</Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên thông báo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as any)}>
          <SelectTrigger className="w-full sm:w-[160px] h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="manual">Thủ công</SelectItem>
            <SelectItem value="automation">Tự động</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-xs text-muted-foreground p-4">Đang tải...</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">Không có thông báo nào</p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="divide-y">
                {filtered.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium truncate max-w-[200px]">{item.title}</span>
                        {item.is_pinned && (
                          <Badge variant="default" className="text-[9px] px-1 py-0 bg-amber-500 hover:bg-amber-600">
                            📌 Ghim
                          </Badge>
                        )}
                        <Badge
                          variant={item.source === 'automation' ? 'secondary' : 'outline'}
                          className="text-[9px] px-1 py-0"
                        >
                          {item.source === 'automation' ? '⚡ Tự động' : '✏️ Thủ công'}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.message}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          👁 {item.read_count} đã đọc
                        </span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {item.target_audience === 'all' ? 'Tất cả' : 'Nhóm'}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 shrink-0 ${item.is_pinned ? 'text-amber-500' : 'text-muted-foreground'}`}
                      onClick={() => togglePin.mutate({ id: item.id, pin: !item.is_pinned })}
                      title={item.is_pinned ? 'Bỏ ghim' : 'Ghim (áp dụng tất cả TK)'}
                    >
                      {item.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
