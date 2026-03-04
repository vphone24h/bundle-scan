import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { useBranchFilter } from './useBranchFilter';
import { useState, useCallback } from 'react';

type ProductStatus = Database['public']['Enums']['product_status'];

// Helper to get current user's tenant_id
async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  imei: string | null;
  category_id: string | null;
  sale_price: number | null;
  import_price: number;
  import_date: string;
  supplier_id: string | null;
  branch_id: string | null;
  import_receipt_id: string | null;
  status: ProductStatus;
  note: string | null;
  quantity: number;
  total_import_cost: number;
  is_printed: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  categories?: { name: string } | null;
  suppliers?: { name: string } | null;
  branches?: { name: string } | null;
}

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  supplierId?: string;
  status?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  printedFilter?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Server-side paginated products hook.
 * Returns { data: Product[], totalCount, isLoading, ... }
 * `data` is always an array for backward compatibility.
 */
export function useProducts(filters?: ProductFilters) {
  const { user } = useAuth();
  const { branchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const hasServerFilters = !!filters;

  const result = useQuery({
    queryKey: ['products', user?.id, branchId, filters],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          categories(name),
          suppliers(name),
          branches(name)
        `, { count: 'exact' })
        .in('status', ['in_stock', 'sold', 'returned'])
        .order('import_date', { ascending: false });

      if (shouldFilter && branchId) {
        query = query.eq('branch_id', branchId);
      }

      if (filters?.search) {
        const s = filters.search.trim();
        if (s) {
          query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,imei.ilike.%${s}%`);
        }
      }
      if (filters?.categoryId && filters.categoryId !== '_all_') {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters?.supplierId && filters.supplierId !== '_all_') {
        query = query.eq('supplier_id', filters.supplierId);
      }
      if (filters?.status && filters.status !== '_all_') {
        query = query.eq('status', filters.status as ProductStatus);
      }
      if (filters?.branchId && filters.branchId !== '_all_') {
        query = query.eq('branch_id', filters.branchId);
      }
      if (filters?.dateFrom) {
        query = query.gte('import_date', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('import_date', filters.dateTo + 'T23:59:59');
      }
      if (filters?.printedFilter === 'printed') {
        query = query.eq('is_printed', true);
      } else if (filters?.printedFilter === 'not_printed') {
        query = query.eq('is_printed', false);
      }

      // Server-side pagination
      if (hasServerFilters) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      } else {
        // Default: limit to 500 for backward compat (non-paginated consumers)
        query = query.limit(500);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      // Return array with totalCount attached
      const items = (data || []) as Product[];
      return { items, totalCount: count || 0 };
    },
    enabled: !!user?.id && !branchLoading,
    staleTime: 2 * 60 * 1000, // 2 min cache
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });

  return {
    ...result,
    // Backward compatible: `data` is array of Product[]
    data: result.data?.items || [],
    totalCount: result.data?.totalCount || 0,
  };
}

// Hook to get ALL products including deleted (for Import History page)
export function useAllProducts(filters?: {
  search?: string;
  categoryId?: string;
  supplierId?: string;
  branchId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const { user } = useAuth();
  const { branchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 100;

  const result = useQuery({
    queryKey: ['all-products', user?.id, branchId, filters],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          id, name, sku, imei, category_id, import_price, import_date,
          supplier_id, branch_id, import_receipt_id, status, note,
          quantity, total_import_cost, created_at, updated_at,
          categories(name), suppliers(name), branches(name)
        `, { count: 'exact' })
        .order('import_date', { ascending: false });

      const effectiveBranchId = filters?.branchId && filters.branchId !== '_all_'
        ? filters.branchId
        : (shouldFilter && branchId ? branchId : null);

      if (effectiveBranchId) {
        query = query.eq('branch_id', effectiveBranchId);
      }

      if (filters?.search) {
        const s = filters.search.trim();
        if (s) {
          query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,imei.ilike.%${s}%`);
        }
      }
      if (filters?.categoryId && filters.categoryId !== '_all_') {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters?.supplierId && filters.supplierId !== '_all_') {
        query = query.eq('supplier_id', filters.supplierId);
      }
      if (filters?.status && filters.status !== '_all_') {
        query = query.eq('status', filters.status as any);
      }
      if (filters?.dateFrom) {
        query = query.gte('import_date', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('import_date', filters.dateTo + 'T23:59:59');
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { items: (data || []) as Product[], totalCount: count || 0 };
    },
    enabled: !!user?.id && !branchLoading,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });

  return {
    ...result,
    data: result.data?.items || [],
    totalCount: result.data?.totalCount || 0,
  };
}

/**
 * Helper hook for server-side pagination state management.
 * Use this in list pages instead of usePagination.
 */
export function useServerPagination(defaultPageSize = 50) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const goToFirstPage = useCallback(() => setPage(1), []);
  const goToLastPage = useCallback((totalPages: number) => setPage(totalPages), []);
  const goToNextPage = useCallback(() => setPage(p => p + 1), []);
  const goToPreviousPage = useCallback(() => setPage(p => Math.max(1, p - 1)), []);

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,
  };
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: {
      name: string;
      sku: string;
      imei?: string | null;
      category_id?: string | null;
      import_price: number;
      supplier_id?: string | null;
      import_receipt_id?: string | null;
      note?: string | null;
    }) => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data, error } = await supabase
        .from('products')
        .insert([{ ...product, tenant_id: tenantId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCheckIMEI() {
  return useMutation({
    mutationFn: async (imei: string) => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, status')
        .eq('imei', imei)
        .eq('tenant_id', tenantId)
        .in('status', ['in_stock', 'warranty'])
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
  });
}

export function useBatchCheckIMEI() {
  return useMutation({
    mutationFn: async (imeis: string[]): Promise<Set<string>> => {
      if (imeis.length === 0) return new Set();
      
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const BATCH_SIZE = 100;
      const existingIMEIs = new Set<string>();
      
      for (let i = 0; i < imeis.length; i += BATCH_SIZE) {
        const batch = imeis.slice(i, i + BATCH_SIZE);
        
        const { data, error } = await supabase
          .from('products')
          .select('imei')
          .in('imei', batch)
          .eq('tenant_id', tenantId)
          .in('status', ['in_stock', 'warranty']);

        if (error) throw error;
        
        data?.forEach(item => {
          if (item.imei) existingIMEIs.add(item.imei);
        });
      }
      
      return existingIMEIs;
    },
  });
}
