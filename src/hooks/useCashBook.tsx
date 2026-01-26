import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type CashBookType = Database['public']['Enums']['cash_book_type'];

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

      const { data, error } = await supabase
        .from('cash_book')
        .insert([{
          ...entry,
          created_by: user?.id,
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
    mutationFn: async ({ id, ...updates }: Partial<CashBookEntry> & { id: string }) => {
      const { data, error } = await supabase
        .from('cash_book')
        .update(updates)
        .eq('id', id)
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
