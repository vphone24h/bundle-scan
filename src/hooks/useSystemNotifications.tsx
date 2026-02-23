import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  full_content: string | null;
  notification_type: 'info' | 'article' | 'popup' | 'startup';
  link_url: string | null;
  is_pinned: boolean;
  is_active: boolean;
  show_as_startup_popup: boolean;
  target_audience: string;
  target_tenant_ids: string[];
  send_frequency: string;
  scheduled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  is_read?: boolean;
}

// Fetch all active system notifications with read status
export function useSystemNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['system-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get user's tenant_id for filtering
      // Lấy tenant_id từ platform_users (chính xác hơn profiles)
      const { data: pu } = await supabase
        .from('platform_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();
      const tenantId = pu?.tenant_id;
      
      const { data: notifications, error } = await supabase
        .from('system_notifications')
        .select('*')
        .eq('is_active', true)
        .neq('source', 'automation')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Filter: show only notifications targeting 'all' or user's tenant
      const filtered = (notifications || []).filter(n => {
        if (n.is_pinned) return true;
        if (n.target_audience === 'all') return true;
        if (!n.target_tenant_ids || n.target_tenant_ids.length === 0) return true;
        return tenantId && (n.target_tenant_ids as string[]).includes(tenantId);
      });

      // Get read status
      const { data: reads } = await supabase
        .from('system_notification_reads')
        .select('notification_id')
        .eq('user_id', user.id);

      const readIds = new Set((reads || []).map(r => r.notification_id));

      return filtered.map(n => ({
        ...n,
        is_read: readIds.has(n.id),
      })) as SystemNotification[];
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });
}

export function useUnreadSystemNotificationCount() {
  const { data: notifications } = useSystemNotifications();
  return (notifications || []).filter(n => !n.is_read).length;
}

export function useMarkSystemNotificationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('system_notification_reads')
        .upsert({ notification_id: notificationId, user_id: user.id }, { onConflict: 'notification_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
    },
  });
}

export function useMarkAllSystemNotificationsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: notifications } = useSystemNotifications();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      const unread = (notifications || []).filter(n => !n.is_read);
      if (unread.length === 0) return;
      
      const inserts = unread.map(n => ({ notification_id: n.id, user_id: user.id }));
      const { error } = await supabase
        .from('system_notification_reads')
        .upsert(inserts, { onConflict: 'notification_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
    },
  });
}

// Startup popup
export function useStartupNotification() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['startup-notification', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: notifications, error } = await supabase
        .from('system_notifications')
        .select('*')
        .eq('is_active', true)
        .eq('show_as_startup_popup', true)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      if (!notifications || notifications.length === 0) return null;

      const notification = notifications[0];

      // Check if dismissed today
      const { data: dismissals } = await supabase
        .from('system_notification_dismissals')
        .select('dismissed_at')
        .eq('notification_id', notification.id)
        .eq('user_id', user.id);

      if (dismissals && dismissals.length > 0) {
        const lastDismissal = new Date(dismissals[0].dismissed_at);
        const today = new Date();
        if (
          lastDismissal.getFullYear() === today.getFullYear() &&
          lastDismissal.getMonth() === today.getMonth() &&
          lastDismissal.getDate() === today.getDate()
        ) {
          return null; // Already dismissed today
        }
      }

      return notification as SystemNotification;
    },
    enabled: !!user?.id,
  });
}

export function useDismissStartupNotification() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('system_notification_dismissals')
        .upsert(
          { notification_id: notificationId, user_id: user.id, dismissed_at: new Date().toISOString() },
          { onConflict: 'notification_id,user_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['startup-notification'] });
    },
  });
}

// Admin hooks
export function useAllSystemNotifications() {
  return useQuery({
    queryKey: ['system-notifications-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_notifications')
        .select('*')
        .neq('source', 'automation')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SystemNotification[];
    },
  });
}

export function useCreateSystemNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notification: Partial<SystemNotification>) => {
      const { data, error } = await supabase
        .from('system_notifications')
        .insert(notification as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['system-notifications-admin'] });
    },
  });
}

export function useUpdateSystemNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SystemNotification> & { id: string }) => {
      const { data, error } = await supabase
        .from('system_notifications')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['system-notifications-admin'] });
    },
  });
}

export function useDeleteSystemNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('system_notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['system-notifications-admin'] });
    },
  });
}
