 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from './useAuth';
 
 // =====================================================
 // TYPES
 // =====================================================
 
 export interface CustomerTag {
   id: string;
   tenant_id: string;
   name: string;
   color: string;
   description: string | null;
   created_at: string;
 }
 
 export interface CustomerTagAssignment {
   id: string;
   customer_id: string;
   tag_id: string;
   assigned_at: string;
   tag?: CustomerTag;
 }
 
 export interface ContactChannel {
   id: string;
   customer_id: string;
   channel_type: 'zalo' | 'facebook' | 'tiktok' | 'other';
   channel_url: string | null;
   note: string | null;
 }
 
 export interface CareScheduleType {
   id: string;
   tenant_id: string | null;
   name: string;
   is_default: boolean;
   display_order: number;
 }
 
 export interface CareSchedule {
   id: string;
   tenant_id: string;
   customer_id: string;
   care_type_id: string | null;
   care_type_name: string;
   scheduled_date: string;
   scheduled_time: string | null;
   note: string | null;
   status: 'pending' | 'completed' | 'cancelled' | 'overdue';
   completed_at: string | null;
   completed_by: string | null;
   assigned_staff_id: string | null;
   reminder_days: number;
   created_at: string;
    customer?: {
      id: string;
      name: string;
      phone: string;
      preferred_branch_id?: string | null;
    };
 }
 
 export interface CareLog {
   id: string;
   tenant_id: string;
   customer_id: string;
   action_type: string;
   content: string;
   result: string | null;
   schedule_id: string | null;
   staff_id: string;
   staff_name: string | null;
   created_at: string;
 }
 
 export interface CareReminder {
   id: string;
   tenant_id: string;
   schedule_id: string;
   user_id: string;
   reminder_type: 'app' | 'email' | 'both';
   scheduled_for: string;
   is_read: boolean;
   is_sent: boolean;
   schedule?: CareSchedule;
 }
 
 export type CRMStatus = 'new' | 'caring' | 'purchased' | 'inactive';
 
 export const CRM_STATUS_LABELS: Record<CRMStatus, string> = {
   new: 'Mới',
   caring: 'Đang chăm sóc',
   purchased: 'Đã mua',
   inactive: 'Ngừng chăm sóc',
 };
 
 export const CRM_STATUS_COLORS: Record<CRMStatus, string> = {
   new: 'bg-blue-100 text-blue-800',
   caring: 'bg-yellow-100 text-yellow-800',
   purchased: 'bg-green-100 text-green-800',
   inactive: 'bg-gray-100 text-gray-800',
 };
 
 // Helper to get tenant_id
 async function getCurrentTenantId(): Promise<string | null> {
   const { data } = await supabase.rpc('get_user_tenant_id_secure');
   return data;
 }
 
 // =====================================================
 // CUSTOMER TAGS HOOKS
 // =====================================================
 
 export function useCustomerTags() {
   const { user } = useAuth();
    return useQuery({
      queryKey: ['customer-tags', user?.id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('customer_tags')
          .select('*')
          .order('name');
        if (error) throw error;
        return data as CustomerTag[];
      },
      enabled: !!user?.id,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
    });
 }
 
 export function useCreateCustomerTag() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async (tag: { name: string; color: string; description?: string }) => {
       const tenantId = await getCurrentTenantId();
       if (!tenantId) throw new Error('Không tìm thấy tenant');
 
       const { data, error } = await supabase
         .from('customer_tags')
         .insert([{ ...tag, tenant_id: tenantId, created_by: user?.id }])
         .select()
         .single();
 
       if (error) throw error;
       return data as CustomerTag;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['customer-tags'] });
     },
   });
 }
 
export function useUpdateCustomerTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const { error } = await supabase
        .from('customer_tags')
        .update({ name, color, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-tags'] });
    },
  });
}

export function useDeleteCustomerTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from('customer_tags')
        .delete()
        .eq('id', tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-tags'] });
    },
  });
 }
 
 // Customer Tag Assignments
 export function useCustomerTagAssignments(customerId: string | null) {
   return useQuery({
     queryKey: ['customer-tag-assignments', customerId],
     queryFn: async () => {
       if (!customerId) return [];
       const { data, error } = await supabase
         .from('customer_tag_assignments')
         .select('*, tag:customer_tags(*)')
         .eq('customer_id', customerId);
       if (error) throw error;
       return data as (CustomerTagAssignment & { tag: CustomerTag })[];
     },
     enabled: !!customerId,
   });
 }
 
 export function useAssignCustomerTag() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async ({ customerId, tagId }: { customerId: string; tagId: string }) => {
       const { data, error } = await supabase
         .from('customer_tag_assignments')
         .insert([{ customer_id: customerId, tag_id: tagId, assigned_by: user?.id }])
         .select()
         .single();
       if (error) throw error;
       return data;
     },
     onSuccess: (_, { customerId }) => {
       queryClient.invalidateQueries({ queryKey: ['customer-tag-assignments', customerId] });
       queryClient.invalidateQueries({ queryKey: ['customers-with-points'] });
     },
   });
 }
 
 export function useRemoveCustomerTag() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ customerId, tagId }: { customerId: string; tagId: string }) => {
       const { error } = await supabase
         .from('customer_tag_assignments')
         .delete()
         .eq('customer_id', customerId)
         .eq('tag_id', tagId);
       if (error) throw error;
     },
     onSuccess: (_, { customerId }) => {
       queryClient.invalidateQueries({ queryKey: ['customer-tag-assignments', customerId] });
       queryClient.invalidateQueries({ queryKey: ['customers-with-points'] });
     },
   });
 }
 
 // =====================================================
 // CONTACT CHANNELS HOOKS
 // =====================================================
 
 export function useContactChannels(customerId: string | null) {
   return useQuery({
     queryKey: ['contact-channels', customerId],
     queryFn: async () => {
       if (!customerId) return [];
       const { data, error } = await supabase
         .from('customer_contact_channels')
         .select('*')
         .eq('customer_id', customerId);
       if (error) throw error;
       return data as ContactChannel[];
     },
     enabled: !!customerId,
   });
 }
 
 export function useSaveContactChannels() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ customerId, channels }: { 
       customerId: string; 
       channels: Omit<ContactChannel, 'id' | 'customer_id'>[] 
     }) => {
       // Delete existing channels
       await supabase
         .from('customer_contact_channels')
         .delete()
         .eq('customer_id', customerId);
 
       // Insert new channels
       if (channels.length > 0) {
         const { error } = await supabase
           .from('customer_contact_channels')
           .insert(channels.map(ch => ({ ...ch, customer_id: customerId })));
         if (error) throw error;
       }
     },
     onSuccess: (_, { customerId }) => {
       queryClient.invalidateQueries({ queryKey: ['contact-channels', customerId] });
     },
   });
 }
 
 // =====================================================
 // CARE SCHEDULE TYPES HOOKS
 // =====================================================
 
 export function useCareScheduleTypes() {
   const { user } = useAuth();
   return useQuery({
     queryKey: ['care-schedule-types', user?.id],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('care_schedule_types')
         .select('*')
         .order('display_order');
       if (error) throw error;
       return data as CareScheduleType[];
     },
     enabled: !!user?.id,
   });
 }
 
 export function useCreateCareScheduleType() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (name: string) => {
       const tenantId = await getCurrentTenantId();
       if (!tenantId) throw new Error('Không tìm thấy tenant');
 
       const { data, error } = await supabase
         .from('care_schedule_types')
         .insert([{ name, tenant_id: tenantId }])
         .select()
         .single();
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['care-schedule-types'] });
     },
   });
 }
 
 // =====================================================
 // CARE SCHEDULES HOOKS
 // =====================================================
 
 export function useCareSchedules(filters?: {
   customerId?: string;
   status?: string;
   staffId?: string;
   fromDate?: string;
   toDate?: string;
 }) {
   const { user } = useAuth();
   return useQuery({
     queryKey: ['care-schedules', user?.id, filters],
     queryFn: async () => {
        let query = supabase
          .from('customer_care_schedules')
          .select('*, customer:customers(id, name, phone, preferred_branch_id)')
          .order('scheduled_date', { ascending: true });
 
       if (filters?.customerId) {
         query = query.eq('customer_id', filters.customerId);
       }
       if (filters?.status) {
         query = query.eq('status', filters.status);
       }
       if (filters?.staffId) {
         query = query.eq('assigned_staff_id', filters.staffId);
       }
       if (filters?.fromDate) {
         query = query.gte('scheduled_date', filters.fromDate);
       }
       if (filters?.toDate) {
         query = query.lte('scheduled_date', filters.toDate);
       }
 
       const { data, error } = await query.limit(500);
       if (error) throw error;
       return data as CareSchedule[];
     },
     enabled: !!user?.id,
     staleTime: 1000 * 60 * 2,
     gcTime: 1000 * 60 * 10,
     refetchOnWindowFocus: false,
   });
 }
 
 export function useCreateCareSchedule() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async (schedule: {
       customerIds: string[];
       careTypeId?: string;
       careTypeName: string;
       scheduledDate: string;
       scheduledTime?: string;
       note?: string;
       assignedStaffId?: string;
       reminderDays?: number;
     }) => {
       const tenantId = await getCurrentTenantId();
       if (!tenantId) throw new Error('Không tìm thấy tenant');
 
       // Create schedules for all selected customers
       const schedulesToInsert = schedule.customerIds.map(customerId => ({
         tenant_id: tenantId,
         customer_id: customerId,
         care_type_id: schedule.careTypeId || null,
         care_type_name: schedule.careTypeName,
         scheduled_date: schedule.scheduledDate,
         scheduled_time: schedule.scheduledTime || null,
         note: schedule.note || null,
         assigned_staff_id: schedule.assignedStaffId || null,
         reminder_days: schedule.reminderDays || 0,
         created_by: user?.id,
       }));

       const { data, error } = await supabase
         .from('customer_care_schedules')
         .insert(schedulesToInsert)
         .select();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['care-schedules'] });
     },
   });
 }
 
 export function useCompleteCareSchedule() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async ({ scheduleId, result }: { scheduleId: string; result?: string }) => {
       const { error } = await supabase
         .from('customer_care_schedules')
         .update({
           status: 'completed',
           completed_at: new Date().toISOString(),
           completed_by: user?.id,
         })
         .eq('id', scheduleId);
 
       if (error) throw error;
 
       // Create care log if result provided
       if (result) {
         const { data: schedule } = await supabase
           .from('customer_care_schedules')
           .select('customer_id, tenant_id, care_type_name')
           .eq('id', scheduleId)
           .single();
 
         if (schedule) {
           await supabase.from('customer_care_logs').insert([{
             tenant_id: schedule.tenant_id,
             customer_id: schedule.customer_id,
             action_type: 'task_completed',
             content: `Hoàn thành: ${schedule.care_type_name}`,
             result,
             schedule_id: scheduleId,
             staff_id: user?.id,
           }]);
         }
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['care-schedules'] });
       queryClient.invalidateQueries({ queryKey: ['care-logs'] });
     },
   });
 }
 
 // =====================================================
 // CARE LOGS HOOKS
 // =====================================================
 
 export function useCareLogs(customerId: string | null) {
   return useQuery({
     queryKey: ['care-logs', customerId],
     queryFn: async () => {
       if (!customerId) return [];
       const { data, error } = await supabase
         .from('customer_care_logs')
         .select('*')
         .eq('customer_id', customerId)
         .order('created_at', { ascending: false });
       if (error) throw error;
       return data as CareLog[];
     },
     enabled: !!customerId,
   });
 }
 
 export function useCreateCareLog() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async (log: {
       customerId: string;
       actionType: string;
       content: string;
       result?: string;
       scheduleId?: string;
     }) => {
       const tenantId = await getCurrentTenantId();
       if (!tenantId) throw new Error('Không tìm thấy tenant');
 
       const { data, error } = await supabase
         .from('customer_care_logs')
         .insert([{
           tenant_id: tenantId,
           customer_id: log.customerId,
           action_type: log.actionType,
           content: log.content,
           result: log.result || null,
           schedule_id: log.scheduleId || null,
           staff_id: user?.id,
         }])
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: (_, { customerId }) => {
       queryClient.invalidateQueries({ queryKey: ['care-logs', customerId] });
       queryClient.invalidateQueries({ queryKey: ['customers-with-points'] });
     },
   });
 }
 
 // =====================================================
 // CARE REMINDERS HOOKS
 // =====================================================
 
 export function useMyReminders() {
   const { user } = useAuth();
   return useQuery({
     queryKey: ['my-reminders', user?.id],
     queryFn: async () => {
       if (!user?.id) return [];
       const { data, error } = await supabase
         .from('care_reminders')
         .select('*, schedule:customer_care_schedules(*, customer:customers(id, name, phone))')
         .eq('user_id', user.id)
         .eq('is_read', false)
         .lte('scheduled_for', new Date().toISOString())
         .order('scheduled_for', { ascending: false });
 
       if (error) throw error;
       return data as (CareReminder & { schedule: CareSchedule })[];
     },
     enabled: !!user?.id,
     refetchInterval: 60000, // Refresh every minute
   });
 }
 
 export function useMarkReminderRead() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (reminderId: string) => {
       const { error } = await supabase
         .from('care_reminders')
         .update({ is_read: true })
         .eq('id', reminderId);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['my-reminders'] });
     },
   });
 }
 
 // =====================================================
 // STAFF MANAGEMENT FOR CRM
 // =====================================================
 
 export function useStaffList() {
   const { user } = useAuth();
   return useQuery({
     queryKey: ['staff-list', user?.id],
     queryFn: async () => {
       const tenantId = await getCurrentTenantId();
       if (!tenantId) return [];
 
       const { data, error } = await supabase
         .from('user_roles')
        .select('user_id, user_role, branch_id')
         .eq('tenant_id', tenantId)
         .neq('user_role', 'cashier');
 
       if (error) throw error;

      // Get profile info for each user
      if (data.length === 0) return [];

      const userIds = data.map(d => d.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

      return data.map(d => ({
        ...d,
        display_name: profileMap.get(d.user_id) || 'Nhân viên',
      }));
     },
     enabled: !!user?.id,
   });
 }
 
export function useAssignStaffToCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, staffId }: { customerId: string; staffId: string | null }) => {
      const { error } = await supabase
        .from('customers')
        .update({ assigned_staff_id: staffId })
        .eq('id', customerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers-with-points'] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail'] });
    },
  });
}

// Bulk assign staff to multiple customers
export function useBulkAssignStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerIds, staffId }: { customerIds: string[]; staffId: string | null }) => {
      const { error } = await supabase
        .from('customers')
        .update({ assigned_staff_id: staffId })
        .in('id', customerIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers-with-points'] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail'] });
    },
  });
}

// Bulk assign tag to multiple customers
export function useBulkAssignTag() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ customerIds, tagId }: { customerIds: string[]; tagId: string }) => {
      const rows = customerIds.map(cid => ({
        customer_id: cid,
        tag_id: tagId,
        assigned_by: user?.id,
      }));
      // Use upsert to avoid duplicate errors
      const { error } = await supabase
        .from('customer_tag_assignments')
        .upsert(rows, { onConflict: 'customer_id,tag_id', ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers-with-points'] });
      queryClient.invalidateQueries({ queryKey: ['customer-tag-assignments'] });
    },
  });
}

export function useUpdateCustomerCRMStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, status }: { customerId: string; status: CRMStatus }) => {
      const { error } = await supabase
        .from('customers')
        .update({ crm_status: status })
        .eq('id', customerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers-with-points'] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail'] });
    },
  });
}