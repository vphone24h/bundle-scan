import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, User, Bell, Mail, MonitorSmartphone } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const CHANNEL_ICONS: Record<string, { icon: typeof Bell; label: string }> = {
  bell: { icon: Bell, label: 'Chuông' },
  popup: { icon: MonitorSmartphone, label: 'Popup' },
  email: { icon: Mail, label: 'Email' },
};

// ===== MANUAL NOTIFICATION READ HISTORY TABLE =====
export function ManualNotificationHistoryTable() {
  const { data: reads = [], isLoading } = useQuery({
    queryKey: ['all-notification-read-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_notification_reads')
        .select('notification_id, user_id, read_at')
        .order('read_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map(r => r.user_id))];
      const notifIds = [...new Set(data.map(r => r.notification_id))];

      const [{ data: profiles }, { data: notifs }] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, tenant_id').in('user_id', userIds),
        supabase.from('system_notifications').select('id, title').in('id', notifIds),
      ]);

      const tenantIds = [...new Set((profiles || []).map(p => p.tenant_id).filter(Boolean))];
      let tenantMap: Record<string, string> = {};
      if (tenantIds.length > 0) {
        const { data: tenants } = await supabase.from('tenants').select('id, name').in('id', tenantIds);
        tenantMap = Object.fromEntries((tenants || []).map(t => [t.id, t.name]));
      }

      const profileMap = Object.fromEntries(
        (profiles || []).map(p => [p.user_id, { name: p.display_name, tenant: tenantMap[p.tenant_id || ''] || null }])
      );
      const notifMap = Object.fromEntries((notifs || []).map(n => [n.id, n.title]));

      return data.map(r => ({
        user_id: r.user_id,
        display_name: profileMap[r.user_id]?.name || 'N/A',
        tenant_name: profileMap[r.user_id]?.tenant || null,
        notification_title: notifMap[r.notification_id] || 'N/A',
        read_at: r.read_at,
      }));
    },
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Lịch sử đọc thông báo</h3>
        <Badge variant="secondary" className="text-[10px]">{reads.length}</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-xs text-muted-foreground p-4">Đang tải...</p>
          ) : reads.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">Chưa có lịch sử</p>
          ) : (
            <ScrollArea className="h-[250px]">
              <div className="divide-y">
                {reads.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/30">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{r.display_name}</span>
                      {r.tenant_name && (
                        <span className="text-muted-foreground ml-1">({r.tenant_name})</span>
                      )}
                      <p className="text-[10px] text-muted-foreground truncate">📢 {r.notification_title}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {format(new Date(r.read_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </span>
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

// ===== AUTOMATION SEND HISTORY TABLE =====
export function AutomationHistoryTable() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['all-automation-send-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_execution_logs')
        .select('id, automation_id, user_id, channel, executed_at, tenant_id')
        .order('executed_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map(r => r.user_id))];
      const autoIds = [...new Set(data.map(r => r.automation_id))];

      const [{ data: profiles }, { data: automations }] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name').in('user_id', userIds),
        supabase.from('notification_automations').select('id, title').in('id', autoIds),
      ]);

      const tenantIds = [...new Set(data.map(r => r.tenant_id).filter(Boolean))];
      let tenantMap: Record<string, string> = {};
      if (tenantIds.length > 0) {
        const { data: tenants } = await supabase.from('tenants').select('id, name').in('id', tenantIds as string[]);
        tenantMap = Object.fromEntries((tenants || []).map(t => [t.id, t.name]));
      }

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.display_name]));
      const autoMap = Object.fromEntries((automations || []).map(a => [a.id, a.title]));

      return data.map(r => ({
        user_id: r.user_id,
        display_name: profileMap[r.user_id] || 'N/A',
        tenant_name: tenantMap[r.tenant_id || ''] || null,
        automation_title: autoMap[r.automation_id] || 'N/A',
        channel: r.channel,
        executed_at: r.executed_at,
      }));
    },
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Lịch sử gửi tự động</h3>
        <Badge variant="secondary" className="text-[10px]">{logs.length}</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-xs text-muted-foreground p-4">Đang tải...</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">Chưa có lịch sử</p>
          ) : (
            <ScrollArea className="h-[250px]">
              <div className="divide-y">
                {logs.map((r, i) => {
                  const chInfo = CHANNEL_ICONS[r.channel];
                  const Icon = chInfo?.icon || Bell;
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/30">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{r.display_name}</span>
                        {r.tenant_name && (
                          <span className="text-muted-foreground ml-1">({r.tenant_name})</span>
                        )}
                        <p className="text-[10px] text-muted-foreground truncate">⚡ {r.automation_title}</p>
                      </div>
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
                        {chInfo?.label || r.channel}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(r.executed_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
