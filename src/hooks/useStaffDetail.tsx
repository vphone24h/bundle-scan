import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export interface StaffExportReceipt {
  id: string;
  receipt_code: string;
  export_date: string;
  total_amount: number;
  status: string;
  customer_name: string | null;
  item_count: number;
}

export interface StaffCareLog {
  id: string;
  action_type: string;
  content: string;
  result: string | null;
  created_at: string;
  customer_name: string | null;
}

export interface StaffActivity {
  id: string;
  action_type: string;
  description: string | null;
  table_name: string | null;
  record_id: string | null;
  created_at: string;
}

// Fetch sold orders by a staff member
export function useStaffExportReceipts(userId: string | null, startDate: string, endDate: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['staff-export-receipts', userId, startDate, endDate],
    queryFn: async () => {
      if (!userId) return [];
      const tenantId = await getCurrentTenantId();
      if (!tenantId) return [];

      // Use sales_staff_id (nhân viên bán) instead of created_by
      // Fallback: also match created_by for old records without sales_staff_id
      const { data, error } = await supabase
        .from('export_receipts')
        .select('id, code, export_date, total_amount, status, customer_id, customers(name)')
        .eq('tenant_id', tenantId)
        .or(`sales_staff_id.eq.${userId},and(sales_staff_id.is.null,created_by.eq.${userId})`)
        .eq('status', 'completed')
        .gte('export_date', startDate)
        .lte('export_date', endDate + 'T23:59:59')
        .order('export_date', { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data || []).map((r: any) => ({
        id: r.id,
        receipt_code: r.code,
        export_date: r.export_date,
        total_amount: r.total_amount,
        status: r.status,
        customer_name: r.customers?.name || null,
        item_count: 0,
      })) as StaffExportReceipt[];
    },
    enabled: !!user?.id && !!userId,
  });
}

// Fetch care logs by a staff member
export function useStaffCareLogs(userId: string | null, startDate: string, endDate: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['staff-care-logs', userId, startDate, endDate],
    queryFn: async () => {
      if (!userId) return [];
      const tenantId = await getCurrentTenantId();
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('customer_care_logs')
        .select('id, action_type, content, result, created_at, customer_id, customers(name)')
        .eq('tenant_id', tenantId)
        .eq('staff_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data || []).map((r: any) => ({
        id: r.id,
        action_type: r.action_type,
        content: r.content,
        result: r.result,
        created_at: r.created_at,
        customer_name: r.customers?.name || null,
      })) as StaffCareLog[];
    },
    enabled: !!user?.id && !!userId,
  });
}

// Fetch audit log activity for a staff member
export function useStaffActivity(userId: string | null, startDate: string, endDate: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['staff-activity', userId, startDate, endDate],
    queryFn: async () => {
      if (!userId) return [];
      const tenantId = await getCurrentTenantId();
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action_type, description, table_name, record_id, created_at')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data || []).map((r: any) => ({
        id: r.id,
        action_type: r.action_type,
        description: r.description,
        table_name: r.table_name,
        record_id: r.record_id,
        created_at: r.created_at,
      })) as StaffActivity[];
    },
    enabled: !!user?.id && !!userId,
  });
}
