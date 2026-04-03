import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { useBranchFilter } from './useBranchFilter';
import { usePermissions } from './usePermissions';
import { useCurrentTenant } from './useTenant';
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
  unit: string;
  total_import_cost?: number;
  is_printed: boolean;
  import_date_modified?: boolean;
  created_at?: string;
  updated_at?: string;
  group_id: string | null;
  variant_1: string | null;
  variant_2: string | null;
  variant_3: string | null;
  // Joined fields (optional - not all queries include joins)
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
  const { data: permissions, isLoading: permissionsLoading } = usePermissions();
  const branchId = permissions?.branchId ?? null;
  const shouldFilter = !permissions?.canViewAllBranches;
  const { data: tenant } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const hasServerFilters = !!filters;

  const result = useQuery({
    queryKey: [
      'products',
      user?.id,
      branchId,
      shouldFilter,
      isDataHidden,
      filters?.search ?? '',
      filters?.categoryId ?? '',
      filters?.supplierId ?? '',
      filters?.status ?? '',
      filters?.branchId ?? '',
      filters?.dateFrom ?? '',
      filters?.dateTo ?? '',
      filters?.printedFilter ?? '',
      page,
      pageSize,
    ],
    queryFn: async () => {
      if (isDataHidden) return { items: [] as Product[], totalCount: 0 };

      let query = supabase
        .from('products')
        .select(`
          id, name, sku, imei, category_id, sale_price, import_price,
          import_date, supplier_id, branch_id, import_receipt_id, status,
          note, quantity, unit, is_printed,
          group_id, variant_1, variant_2, variant_3
        `)
        .in('status', ['in_stock', 'sold', 'returned', 'template'])
        .order('import_date', { ascending: false });

      // Branch filter: include template products (no branch) alongside branch-specific products
      if (shouldFilter && branchId) {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
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

      // Server-side pagination (N+1 để tránh count exact chậm)
      if (hasServerFilters) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize; // fetch pageSize + 1
        query = query.range(from, to);
      } else {
        // Default: limit to 500 for backward compat (non-paginated consumers)
        query = query.limit(500);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as Product[];

      if (hasServerFilters) {
        const hasMore = rows.length > pageSize;
        const items = hasMore ? rows.slice(0, pageSize) : rows;
        const totalCount = hasMore
          ? (page * pageSize) + 1
          : ((page - 1) * pageSize) + items.length;

        return { items, totalCount };
      }

      return { items: rows, totalCount: rows.length };
    },
    enabled: !!user?.id && !permissionsLoading,
    staleTime: 5 * 60 * 1000, // 5 min cache
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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
          quantity, total_import_cost, created_at, updated_at, unit,
          import_date_modified,
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

      const items = (data || []) as Product[];

      // Lấy số lượng gốc từ product_imports cho sản phẩm không IMEI
      const nonImeiIds = items.filter(p => !p.imei).map(p => p.id);
      if (nonImeiIds.length > 0) {
        const BATCH = 100;
        const piMap = new Map<string, number>();
        for (let i = 0; i < nonImeiIds.length; i += BATCH) {
          const batch = nonImeiIds.slice(i, i + BATCH);
          const { data: piData } = await supabase
            .from('product_imports')
            .select('product_id, quantity')
            .in('product_id', batch);
          (piData || []).forEach(pi => {
            piMap.set(pi.product_id, (piMap.get(pi.product_id) || 0) + pi.quantity);
          });
        }
        items.forEach(p => {
          if (!p.imei && piMap.has(p.id)) {
            (p as any).current_stock = p.quantity; // Tồn kho thực tế
            (p as any).original_import_quantity = piMap.get(p.id)!;
            p.quantity = piMap.get(p.id)!; // Tổng nhập
          }
        });
      }

      return { items, totalCount: count || 0 };
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
