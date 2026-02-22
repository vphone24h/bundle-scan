import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, ChevronDown, ChevronUp, User, Bell, Mail, MonitorSmartphone } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface SendHistoryRecord {
  user_id: string;
  display_name: string | null;
  tenant_name: string | null;
  channel: string;
  executed_at: string;
}

const CHANNEL_ICONS: Record<string, { icon: typeof Bell; label: string }> = {
  bell: { icon: Bell, label: 'Chuông' },
  popup: { icon: MonitorSmartphone, label: 'Popup' },
  email: { icon: Mail, label: 'Email' },
};

// ===== MANUAL NOTIFICATION HISTORY =====
export function ManualNotificationHistory({ notificationId }: { notificationId: string }) {
  const [expanded, setExpanded] = useState(false);

  const { data: reads = [], isLoading } = useQuery({
    queryKey: ['notification-read-history', notificationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_notification_reads')
        .select('notification_id, user_id, read_at')
        .eq('notification_id', notificationId);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Get profile info
      const userIds = data.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, tenant_id')
        .in('user_id', userIds);

      // Get tenant names
      const tenantIds = [...new Set((profiles || []).map(p => p.tenant_id).filter(Boolean))];
      let tenantMap: Record<string, string> = {};
      if (tenantIds.length > 0) {
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id, name')
          .in('id', tenantIds);
        tenantMap = Object.fromEntries((tenants || []).map(t => [t.id, t.name]));
      }

      const profileMap = Object.fromEntries(
        (profiles || []).map(p => [p.user_id, { name: p.display_name, tenant: tenantMap[p.tenant_id || ''] || null }])
      );

      return data.map(r => ({
        user_id: r.user_id,
        display_name: profileMap[r.user_id]?.name || 'N/A',
        tenant_name: profileMap[r.user_id]?.tenant || null,
        read_at: r.read_at,
      }));
    },
    enabled: expanded,
  });

  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-[10px] text-muted-foreground p-0 hover:bg-transparent"
        onClick={() => setExpanded(!expanded)}
      >
        <History className="h-3 w-3 mr-1" />
        Lịch sử đọc
        {expanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
      </Button>

      {expanded && (
        <div className="mt-1.5 border rounded-md bg-muted/30">
          {isLoading ? (
            <p className="text-[10px] text-muted-foreground p-2">Đang tải...</p>
          ) : reads.length === 0 ? (
            <p className="text-[10px] text-muted-foreground p-2">Chưa có ai đọc</p>
          ) : (
            <ScrollArea className={reads.length > 5 ? 'h-[150px]' : ''}>
              <div className="divide-y">
                {reads.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 text-[11px]">
                    <User className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{r.display_name}</span>
                    {r.tenant_name && (
                      <span className="text-muted-foreground truncate text-[10px]">({r.tenant_name})</span>
                    )}
                    <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">
                      {format(new Date(r.read_at), 'dd/MM HH:mm', { locale: vi })}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          <div className="px-2 py-1 border-t">
            <p className="text-[10px] text-muted-foreground">Tổng: {reads.length} người đã đọc</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== AUTOMATION SEND HISTORY =====
export function AutomationSendHistory({ automationId }: { automationId: string }) {
  const [expanded, setExpanded] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['automation-send-history', automationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_execution_logs')
        .select('id, user_id, channel, executed_at, tenant_id')
        .eq('automation_id', automationId)
        .order('executed_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const tenantIds = [...new Set(data.map(r => r.tenant_id).filter(Boolean))];
      let tenantMap: Record<string, string> = {};
      if (tenantIds.length > 0) {
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id, name')
          .in('id', tenantIds as string[]);
        tenantMap = Object.fromEntries((tenants || []).map(t => [t.id, t.name]));
      }

      const profileMap = Object.fromEntries(
        (profiles || []).map(p => [p.user_id, p.display_name])
      );

      return data.map(r => ({
        user_id: r.user_id,
        display_name: profileMap[r.user_id] || 'N/A',
        tenant_name: tenantMap[r.tenant_id || ''] || null,
        channel: r.channel,
        executed_at: r.executed_at,
      })) as SendHistoryRecord[];
    },
    enabled: expanded,
  });

  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-[10px] text-muted-foreground p-0 hover:bg-transparent"
        onClick={() => setExpanded(!expanded)}
      >
        <History className="h-3 w-3 mr-1" />
        Lịch sử gửi
        {expanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
      </Button>

      {expanded && (
        <div className="mt-1.5 border rounded-md bg-muted/30">
          {isLoading ? (
            <p className="text-[10px] text-muted-foreground p-2">Đang tải...</p>
          ) : logs.length === 0 ? (
            <p className="text-[10px] text-muted-foreground p-2">Chưa có lịch sử gửi</p>
          ) : (
            <ScrollArea className={logs.length > 5 ? 'h-[150px]' : ''}>
              <div className="divide-y">
                {logs.map((r, i) => {
                  const chInfo = CHANNEL_ICONS[r.channel];
                  const Icon = chInfo?.icon || Bell;
                  return (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 text-[11px]">
                      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{r.display_name}</span>
                      {r.tenant_name && (
                        <span className="text-muted-foreground truncate text-[10px]">({r.tenant_name})</span>
                      )}
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
                        {chInfo?.label || r.channel}
                      </Badge>
                      <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">
                        {format(new Date(r.executed_at), 'dd/MM HH:mm', { locale: vi })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
          <div className="px-2 py-1 border-t">
            <p className="text-[10px] text-muted-foreground">Tổng: {logs.length} lượt gửi</p>
          </div>
        </div>
      )}
    </div>
  );
}
