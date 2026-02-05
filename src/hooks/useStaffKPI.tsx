 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from './useAuth';
 
 // =====================================================
 // TYPES
 // =====================================================
 
 export interface StaffKPISetting {
   id: string;
   tenant_id: string;
   user_id: string;
   kpi_type: 'revenue' | 'orders';
   target_value: number;
   period_type: 'daily' | 'weekly' | 'monthly';
   is_active: boolean;
   created_at: string;
   updated_at: string;
 }
 
 export interface StaffKPIStats {
   total_revenue: number;
   total_orders: number;
   total_customers: number;
   new_customers: number;
   conversion_rate: number;
 }
 
 export interface StaffWithKPI {
   user_id: string;
   display_name: string;
   user_role: string;
   branch_id: string | null;
   branch_name: string | null;
   kpi_setting: StaffKPISetting | null;
   stats: StaffKPIStats | null;
   achievement_percentage: number;
 }
 
 // Helper to get tenant_id
 async function getCurrentTenantId(): Promise<string | null> {
   const { data } = await supabase.rpc('get_user_tenant_id_secure');
   return data;
 }
 
 // =====================================================
 // STAFF KPI SETTINGS HOOKS
 // =====================================================
 
 export function useStaffKPISettings() {
   const { user } = useAuth();
   return useQuery({
     queryKey: ['staff-kpi-settings', user?.id],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('staff_kpi_settings')
         .select('*')
         .order('created_at', { ascending: false });
       if (error) throw error;
       return data as StaffKPISetting[];
     },
     enabled: !!user?.id,
   });
 }
 
 export function useStaffKPISetting(userId: string | null) {
   const { user } = useAuth();
   return useQuery({
     queryKey: ['staff-kpi-setting', userId],
     queryFn: async () => {
       if (!userId) return null;
       const { data, error } = await supabase
         .from('staff_kpi_settings')
         .select('*')
         .eq('user_id', userId)
         .single();
       if (error && error.code !== 'PGRST116') throw error;
       return data as StaffKPISetting | null;
     },
     enabled: !!user?.id && !!userId,
   });
 }
 
 export function useUpsertStaffKPI() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async (setting: {
       userId: string;
       kpiType: 'revenue' | 'orders';
       targetValue: number;
       periodType: 'daily' | 'weekly' | 'monthly';
     }) => {
       const tenantId = await getCurrentTenantId();
       if (!tenantId) throw new Error('Không tìm thấy tenant');
 
       const { data, error } = await supabase
         .from('staff_kpi_settings')
         .upsert({
           tenant_id: tenantId,
           user_id: setting.userId,
           kpi_type: setting.kpiType,
           target_value: setting.targetValue,
           period_type: setting.periodType,
           is_active: true,
           created_by: user?.id,
           updated_at: new Date().toISOString(),
         }, { onConflict: 'tenant_id,user_id' })
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['staff-kpi-settings'] });
       queryClient.invalidateQueries({ queryKey: ['staff-kpi-setting'] });
       queryClient.invalidateQueries({ queryKey: ['staff-with-kpi'] });
     },
   });
 }
 
 // =====================================================
 // STAFF KPI STATS HOOKS
 // =====================================================
 
 export function useStaffKPIStatsRealtime(userId: string | null, startDate: Date, endDate: Date) {
   const { user } = useAuth();
   return useQuery({
     queryKey: ['staff-kpi-stats', userId, startDate.toISOString(), endDate.toISOString()],
     queryFn: async () => {
       if (!userId) return null;
       const tenantId = await getCurrentTenantId();
       if (!tenantId) return null;
 
       const { data, error } = await supabase.rpc('get_staff_kpi_stats', {
         p_tenant_id: tenantId,
         p_user_id: userId,
         p_start_date: startDate.toISOString().split('T')[0],
         p_end_date: endDate.toISOString().split('T')[0],
       });
 
       if (error) throw error;
       return data?.[0] as StaffKPIStats | null;
     },
     enabled: !!user?.id && !!userId,
   });
 }
 
 // =====================================================
 // COMBINED STAFF WITH KPI DATA
 // =====================================================
 
 export function useStaffWithKPI(periodStart: Date, periodEnd: Date) {
   const { user } = useAuth();
   
   return useQuery({
     queryKey: ['staff-with-kpi', user?.id, periodStart.toISOString(), periodEnd.toISOString()],
     queryFn: async () => {
       const tenantId = await getCurrentTenantId();
       if (!tenantId) return [];
 
       // Get all staff (excluding cashier)
       const { data: staffData, error: staffError } = await supabase
         .from('user_roles')
         .select('user_id, user_role, branch_id')
         .eq('tenant_id', tenantId)
         .neq('user_role', 'cashier');
 
       if (staffError) throw staffError;
       if (!staffData || staffData.length === 0) return [];
 
       const userIds = staffData.map(s => s.user_id);
 
       // Get profiles
       const { data: profiles } = await supabase
         .from('profiles')
         .select('user_id, display_name')
         .in('user_id', userIds);
 
       const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
 
       // Get branches
       const branchIds = staffData.map(s => s.branch_id).filter(Boolean) as string[];
       const { data: branches } = await supabase
         .from('branches')
         .select('id, name')
         .in('id', branchIds);
 
       const branchMap = new Map(branches?.map(b => [b.id, b.name]) || []);
 
       // Get KPI settings
       const { data: kpiSettings } = await supabase
         .from('staff_kpi_settings')
         .select('*')
         .eq('tenant_id', tenantId)
         .in('user_id', userIds);
 
       const kpiMap = new Map(kpiSettings?.map(k => [k.user_id, k]) || []);
 
       // Get stats for each staff
       const result: StaffWithKPI[] = [];
 
       for (const staff of staffData) {
         const kpiSetting = kpiMap.get(staff.user_id) as StaffKPISetting | undefined;
         
         // Get stats
         const { data: statsData } = await supabase.rpc('get_staff_kpi_stats', {
           p_tenant_id: tenantId,
           p_user_id: staff.user_id,
           p_start_date: periodStart.toISOString().split('T')[0],
           p_end_date: periodEnd.toISOString().split('T')[0],
         });
 
         const stats = statsData?.[0] as StaffKPIStats | null;
 
         // Calculate achievement percentage
         let achievement = 0;
         if (kpiSetting && stats) {
           if (kpiSetting.kpi_type === 'revenue' && kpiSetting.target_value > 0) {
             achievement = (stats.total_revenue / kpiSetting.target_value) * 100;
           } else if (kpiSetting.kpi_type === 'orders' && kpiSetting.target_value > 0) {
             achievement = (stats.total_orders / kpiSetting.target_value) * 100;
           }
         }
 
         result.push({
           user_id: staff.user_id,
           display_name: profileMap.get(staff.user_id) || 'Nhân viên',
           user_role: staff.user_role,
           branch_id: staff.branch_id,
           branch_name: staff.branch_id ? branchMap.get(staff.branch_id) || null : null,
           kpi_setting: kpiSetting || null,
           stats,
           achievement_percentage: Math.round(achievement * 100) / 100,
         });
       }
 
       // Sort by achievement percentage (descending)
       return result.sort((a, b) => b.achievement_percentage - a.achievement_percentage);
     },
     enabled: !!user?.id,
   });
 }
 
 // =====================================================
 // TOP PERFORMERS
 // =====================================================
 
 export function useTopPerformers(limit: number = 5) {
   const today = new Date();
   const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
   const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
 
   const { data: staffWithKPI, isLoading } = useStaffWithKPI(firstOfMonth, lastOfMonth);
 
   return {
     data: staffWithKPI?.slice(0, limit) || [],
     isLoading,
   };
 }