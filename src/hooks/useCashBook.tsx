import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { sendActivityAlert } from '@/lib/activityAlert';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
import { fetchAllRows } from '@/lib/fetchAllRows';

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
  recipient_name: string | null;
  recipient_phone: string | null;
  created_by_name: string | null;
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
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;
  const { branchId: userBranchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  return useQuery({
    // Keyed by tenant AND branch to prevent cross-tenant/branch cache leakage
    queryKey: ['cash-book', tenant?.id, userBranchId, filters, isDataHidden],
    queryFn: async () => {
      // Chế độ test: trả về dữ liệu rỗng
      if (isDataHidden) return [] as CashBookEntry[];

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

      // Priority: UI filter > user's assigned branch filter
      if (filters?.branchId) {
        // If user is trying to filter a branch they don't have access to, return empty
        if (shouldFilter && userBranchId && filters.branchId !== userBranchId) {
          return [] as CashBookEntry[];
        }
        query = query.eq('branch_id', filters.branchId);
      } else if (shouldFilter && userBranchId) {
        // Apply user's branch filter
        query = query.eq('branch_id', userBranchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CashBookEntry[];
    },
    enabled: !isTenantLoading && !branchLoading && !!tenant?.id,
    refetchOnWindowFocus: false,
  });
}

export function useCashBookCategories(type?: CashBookType) {
  const { data: tenant } = useCurrentTenant();
  return useQuery({
    // Keyed by tenant to prevent cross-tenant cache leakage
    queryKey: ['cash-book-categories', tenant?.id, type],
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
    enabled: !!tenant?.id,
  });
}

export function useCreateCashBookCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (category: { name: string; type: CashBookType }) => {
      const { data, error } = await supabase
        .from('cash_book_categories')
        .insert([{
          name: category.name,
          type: category.type,
          is_default: false,
        }])
        .select()
        .single();

      if (error) throw error;
      return data as CashBookCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-book-categories'] });
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
      recipient_name?: string | null;
      recipient_phone?: string | null;
      created_by_name?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get current tenant_id
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // If created_by_name not provided, fetch from profile
      let createdByName = entry.created_by_name;
      if (!createdByName && user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle();
        createdByName = profile?.display_name || user.email || null;
      }

      const { data, error } = await supabase
        .from('cash_book')
        .insert([{
          ...entry,
          created_by: user?.id,
          tenant_id: tenantId,
          created_by_name: createdByName,
        }])
        .select()
        .single();

      if (error) throw error;

      // Send email alert to admin (fire-and-forget)
      sendActivityAlert('cashbook', tenantId, {
        type: entry.type,
        category: entry.category,
        description: entry.description,
        amount: entry.amount,
        paymentSource: entry.payment_source,
        recipientName: entry.recipient_name || undefined,
        recipientPhone: entry.recipient_phone || undefined,
        note: entry.note || undefined,
      });

      return data as CashBookEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
    },
  });
}

// Hook chuyển tiền giữa các nguồn với audit log
export function useTransferFunds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transfer: {
      fromSource: string;
      toSource: string;
      amount: number;
      note?: string;
      branchId?: string | null;
      fromSourceName: string;
      toSourceName: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Get user's branch_id for audit log
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('branch_id')
        .eq('user_id', user?.id)
        .maybeSingle();

      const noteText = transfer.note ? ` - ${transfer.note}` : '';
      const formattedAmount = transfer.amount.toLocaleString('vi-VN');

      // Tạo 2 giao dịch: CHI từ nguồn A và THU vào nguồn B
      const [expenseResult, incomeResult] = await Promise.all([
        // Chi từ nguồn gốc
        supabase
          .from('cash_book')
          .insert([{
            type: 'expense' as const,
            category: 'Chuyển tiền nội bộ',
            description: `Chuyển tiền: ${transfer.fromSourceName} → ${transfer.toSourceName}${noteText}`,
            amount: transfer.amount,
            payment_source: transfer.fromSource,
            is_business_accounting: false,
            branch_id: transfer.branchId || null,
            note: `Chuyển ${formattedAmount}đ sang ${transfer.toSourceName}`,
            created_by: user?.id,
            tenant_id: tenantId,
          }])
          .select()
          .single(),
        // Thu vào nguồn đích
        supabase
          .from('cash_book')
          .insert([{
            type: 'income' as const,
            category: 'Chuyển tiền nội bộ',
            description: `Nhận tiền: ${transfer.fromSourceName} → ${transfer.toSourceName}${noteText}`,
            amount: transfer.amount,
            payment_source: transfer.toSource,
            is_business_accounting: false,
            branch_id: transfer.branchId || null,
            note: `Nhận ${formattedAmount}đ từ ${transfer.fromSourceName}`,
            created_by: user?.id,
            tenant_id: tenantId,
          }])
          .select()
          .single(),
      ]);

      if (expenseResult.error) throw expenseResult.error;
      if (incomeResult.error) throw incomeResult.error;

      // Ghi audit log cho việc chuyển tiền
      await supabase.from('audit_logs').insert([{
        tenant_id: tenantId,
        user_id: user?.id,
        action_type: 'TRANSFER_FUNDS',
        table_name: 'cash_book',
        branch_id: userRole?.branch_id || transfer.branchId || null,
        old_data: {
          from_source: transfer.fromSource,
          from_source_name: transfer.fromSourceName,
        },
        new_data: {
          to_source: transfer.toSource,
          to_source_name: transfer.toSourceName,
          amount: transfer.amount,
          note: transfer.note || null,
          expense_entry_id: expenseResult.data?.id,
          income_entry_id: incomeResult.data?.id,
        },
        description: `Chuyển tiền nội bộ: ${formattedAmount}đ từ ${transfer.fromSourceName} sang ${transfer.toSourceName}${noteText}`,
      }]);

      return {
        expenseEntry: expenseResult.data,
        incomeEntry: incomeResult.data,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

// Hook chuyển tiền giữa các chi nhánh
export function useTransferFundsBetweenBranches() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transfer: {
      fromBranchId: string;
      toBranchId: string;
      fromBranchName: string;
      toBranchName: string;
      paymentSource: string;
      paymentSourceName: string;
      amount: number;
      note?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const noteText = transfer.note ? ` - ${transfer.note}` : '';
      const formattedAmount = transfer.amount.toLocaleString('vi-VN');

      // CHI từ chi nhánh A, THU vào chi nhánh B (cùng nguồn tiền)
      const [expenseResult, incomeResult] = await Promise.all([
        supabase
          .from('cash_book')
          .insert([{
            type: 'expense' as const,
            category: 'Chuyển tiền liên chi nhánh',
            description: `Chuyển tiền: ${transfer.fromBranchName} → ${transfer.toBranchName}${noteText}`,
            amount: transfer.amount,
            payment_source: transfer.paymentSource,
            is_business_accounting: false,
            branch_id: transfer.fromBranchId,
            note: `Chuyển ${formattedAmount}đ (${transfer.paymentSourceName}) sang ${transfer.toBranchName}`,
            created_by: user?.id,
            tenant_id: tenantId,
          }])
          .select()
          .single(),
        supabase
          .from('cash_book')
          .insert([{
            type: 'income' as const,
            category: 'Chuyển tiền liên chi nhánh',
            description: `Nhận tiền: ${transfer.fromBranchName} → ${transfer.toBranchName}${noteText}`,
            amount: transfer.amount,
            payment_source: transfer.paymentSource,
            is_business_accounting: false,
            branch_id: transfer.toBranchId,
            note: `Nhận ${formattedAmount}đ (${transfer.paymentSourceName}) từ ${transfer.fromBranchName}`,
            created_by: user?.id,
            tenant_id: tenantId,
          }])
          .select()
          .single(),
      ]);

      if (expenseResult.error) throw expenseResult.error;
      if (incomeResult.error) throw incomeResult.error;

      await supabase.from('audit_logs').insert([{
        tenant_id: tenantId,
        user_id: user?.id,
        action_type: 'TRANSFER_FUNDS_BETWEEN_BRANCHES',
        table_name: 'cash_book',
        branch_id: transfer.fromBranchId,
        old_data: {
          from_branch_id: transfer.fromBranchId,
          from_branch_name: transfer.fromBranchName,
        },
        new_data: {
          to_branch_id: transfer.toBranchId,
          to_branch_name: transfer.toBranchName,
          payment_source: transfer.paymentSource,
          amount: transfer.amount,
          note: transfer.note || null,
        },
        description: `Chuyển tiền liên chi nhánh: ${formattedAmount}đ từ ${transfer.fromBranchName} sang ${transfer.toBranchName} (${transfer.paymentSourceName})${noteText}`,
      }]);

      return { expenseEntry: expenseResult.data, incomeEntry: incomeResult.data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
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
      
      // Get tenant_id for audit log
      const tenantId = await getCurrentTenantId();
      
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

      // Ghi audit log với tenant_id
      if (oldData) {
        await supabase.from('audit_logs').insert([{
          tenant_id: tenantId,
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
      
      // Get tenant_id for audit log
      const tenantId = await getCurrentTenantId();
      
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

      // Ghi audit log với tenant_id, dữ liệu trước khi xóa và số dư nguồn tiền
      await supabase.from('audit_logs').insert([{
        tenant_id: tenantId,
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
