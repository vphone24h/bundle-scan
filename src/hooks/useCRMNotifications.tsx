 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from './useAuth';
 
 // =====================================================
 // TYPES
 // =====================================================
 
 export interface CRMNotification {
   id: string;
   tenant_id: string;
   user_id: string;
   notification_type: 'care_reminder' | 'overdue_care' | 'new_customer' | 'kpi_update' | 'system';
   title: string;
   message: string;
   reference_type: string | null;
   reference_id: string | null;
   is_read: boolean;
   read_at: string | null;
   is_email_sent: boolean;
   email_sent_at: string | null;
   created_at: string;
 }
 
 export const NOTIFICATION_TYPE_LABELS: Record<CRMNotification['notification_type'], string> = {
   care_reminder: 'Nhắc chăm sóc',
   overdue_care: 'Quá hạn',
   new_customer: 'Khách mới',
   kpi_update: 'Cập nhật KPI',
   system: 'Hệ thống',
 };
 
 export const NOTIFICATION_TYPE_COLORS: Record<CRMNotification['notification_type'], string> = {
   care_reminder: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
   overdue_care: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
   new_customer: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
   kpi_update: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
   system: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
 };
 
 // =====================================================
 // NOTIFICATION HOOKS
 // =====================================================
 
 export function useCRMNotifications(limit: number = 50) {
   const { user } = useAuth();
   return useQuery({
     queryKey: ['crm-notifications', user?.id, limit],
     queryFn: async () => {
       if (!user?.id) return [];
       const { data, error } = await supabase
         .from('crm_notifications')
         .select('*')
         .eq('user_id', user.id)
         .order('created_at', { ascending: false })
         .limit(limit);
       if (error) throw error;
       return data as CRMNotification[];
     },
     enabled: !!user?.id,
     refetchInterval: 60000, // Refresh every minute
   });
 }
 
 export function useUnreadNotificationCount() {
   const { user } = useAuth();
   return useQuery({
     queryKey: ['unread-notifications-count', user?.id],
     queryFn: async () => {
       if (!user?.id) return 0;
       const { count, error } = await supabase
         .from('crm_notifications')
         .select('*', { count: 'exact', head: true })
         .eq('user_id', user.id)
         .eq('is_read', false);
       if (error) throw error;
       return count || 0;
     },
     enabled: !!user?.id,
     refetchInterval: 30000, // Refresh every 30 seconds
   });
 }
 
 export function useMarkNotificationRead() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (notificationId: string) => {
       const { error } = await supabase
         .from('crm_notifications')
         .update({ 
           is_read: true,
           read_at: new Date().toISOString(),
         })
         .eq('id', notificationId);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['crm-notifications'] });
       queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
     },
   });
 }
 
 export function useMarkAllNotificationsRead() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async () => {
       if (!user?.id) throw new Error('Chưa đăng nhập');
       const { error } = await supabase
         .from('crm_notifications')
         .update({ 
           is_read: true,
           read_at: new Date().toISOString(),
         })
         .eq('user_id', user.id)
         .eq('is_read', false);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['crm-notifications'] });
       queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
     },
   });
 }
 
 // =====================================================
 // CREATE NOTIFICATION (for internal use)
 // =====================================================
 
 export function useCreateNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notification: {
      userId: string;
      notificationType: CRMNotification['notification_type'];
      title: string;
      message: string;
      referenceType?: string;
      referenceId?: string;
    }) => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data, error } = await supabase
        .from('crm_notifications')
        .insert({
          tenant_id: tenantId,
          user_id: notification.userId,
          notification_type: notification.notificationType,
          title: notification.title,
          message: notification.message,
          reference_type: notification.referenceType || null,
          reference_id: notification.referenceId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
    },
  });
}

// =====================================================
// TRIGGER CARE REMINDERS (calls edge function)
// =====================================================

export function useTriggerCareReminders() {
   const queryClient = useQueryClient();
 
   return useMutation({
    mutationFn: async (params?: { scheduleId?: string; userId?: string; sendAll?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('send-care-reminder-email', {
        body: params || { sendAll: true },
      });

      if (error) throw new Error(error.message);
      return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['crm-notifications'] });
       queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
      queryClient.invalidateQueries({ queryKey: ['care-schedules'] });
     },
   });
 }