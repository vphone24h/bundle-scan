import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type CashBookType = Database['public']['Enums']['cash_book_type'];

// Helper to get current user's tenant_id
async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export interface CashBookEntry {
  id: string;
  transaction_date: string;
  type: CashBookType;
  category: string;
  description: string;
  amount: number;
  payment_source: string;
  is_business_accounting: boolean;
  branch_id: string | null;
  reference_id: string | null;
  reference_type: string | null;
  created_by: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  branches?: { name: string } | null;
}

export interface CashBookCategory {
  id: string;
  name: string;
  type: CashBookType;
  is_default: boolean;
  created_at: string;
}

export function useCashBook(filters?: {
  startDate?: string;
  endDate?: string;
  type?: CashBookType;
  branchId?: string;
}) {
  return useQuery({
    queryKey: ['cash-book', filters],
    queryFn: async () => {
      let query = supabase
        .from('cash_book')
        .select('*, branches(name)')
        .order('transaction_date', { ascending: false });

      if (filters?.startDate) {
        query = query.gte('transaction_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('transaction_date', filters.endDate + 'T23:59:59');
      }
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.branchId) {
        query = query.eq('branch_id', filters.branchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CashBookEntry[];
    },
  });
}

export function useCashBookCategories(type?: CashBookType) {
  return useQuery({
    queryKey: ['cash-book-categories', type],
    queryFn: async () => {
      let query = supabase
        .from('cash_book_categories')
        .select('*')
        .order('name');

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CashBookCategory[];
    },
  });
}

export function useCreateCashBookEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: {
      type: CashBookType;
      category: string;
      description: string;
      amount: number;
      payment_source: string;
      is_business_accounting?: boolean;
      branch_id?: string | null;
      reference_id?: string | null;
      reference_type?: string | null;
      note?: string;
      transaction_date?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get current tenant_id
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data, error } = await supabase
        .from('cash_book')
        .insert([{
          ...entry,
          created_by: user?.id,
          tenant_id: tenantId,
        }])
        .select()
        .single();

      if (error) throw error;
      return data as CashBookEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
    },
  });
}

export function useUpdateCashBookEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      oldData,
      ...updates 
    }: Partial<CashBookEntry> & { 
      id: string;
      oldData?: CashBookEntry; // Dữ liệu cũ để ghi audit log
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get user's branch_id for audit log
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('branch_id')
        .eq('user_id', user?.id)
        .single();
      
      // Update cash book entry
      const { data, error } = await supabase
        .from('cash_book')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Ghi audit log
      if (oldData) {
        await supabase.from('audit_logs').insert([{
          user_id: user?.id,
          action_type: 'update',
          table_name: 'cash_book',
          record_id: id,
          branch_id: userRole?.branch_id || null,
          old_data: {
            type: oldData.type,
            category: oldData.category,
            description: oldData.description,
            amount: oldData.amount,
            payment_source: oldData.payment_source,
            is_business_accounting: oldData.is_business_accounting,
            note: oldData.note,
          },
          new_data: {
            type: data.type,
            category: data.category,
            description: data.description,
            amount: data.amount,
            payment_source: data.payment_source,
            is_business_accounting: data.is_business_accounting,
            note: data.note,
          },
          description: `Sửa sổ quỹ: ${oldData.description} → ${data.description}`,
        }]);
      }

      return data as CashBookEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

export function useDeleteCashBookEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      entry, 
      reason 
    }: { 
      entry: CashBookEntry; 
      reason: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get user's branch_id for audit log
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('branch_id')
        .eq('user_id', user?.id)
        .single();

      // Tính số dư nguồn tiền TRƯỚC khi xóa
      let balanceQuery = supabase
        .from('cash_book')
        .select('type, amount')
        .eq('payment_source', entry.payment_source);
      
      if (entry.branch_id) {
        balanceQuery = balanceQuery.eq('branch_id', entry.branch_id);
      }

      const { data: allEntries } = await balanceQuery;
      
      const balanceBefore = (allEntries || []).reduce((sum, e) => {
        return sum + (e.type === 'income' ? Number(e.amount) : -Number(e.amount));
      }, 0);

      // Tính số dư SAU khi xóa
      const entryImpact = entry.type === 'income' ? Number(entry.amount) : -Number(entry.amount);
      const balanceAfter = balanceBefore - entryImpact;

      // Delete cash book entry
      const { error } = await supabase
        .from('cash_book')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;

      // Ghi audit log với dữ liệu trước khi xóa và số dư nguồn tiền
      await supabase.from('audit_logs').insert([{
        user_id: user?.id,
        action_type: 'delete',
        table_name: 'cash_book',
        record_id: entry.id,
        branch_id: userRole?.branch_id || null,
        old_data: {
          type: entry.type,
          category: entry.category,
          description: entry.description,
          amount: entry.amount,
          payment_source: entry.payment_source,
          is_business_accounting: entry.is_business_accounting,
          note: entry.note,
          transaction_date: entry.transaction_date,
          // Số dư nguồn tiền trước và sau khi xóa
          balance_before: balanceBefore,
          balance_after: balanceAfter,
        },
        new_data: null,
        description: `Xóa sổ quỹ: ${entry.description} (${entry.type === 'income' ? 'Thu' : 'Chi'}: ${entry.amount.toLocaleString('vi-VN')}đ). Nguồn: ${entry.payment_source}. Lý do: ${reason}`,
      }]);

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}
