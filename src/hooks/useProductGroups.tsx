import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { usePermissions } from './usePermissions';
import { useCurrentTenant } from './useTenant';
import type { Product } from './useProducts';

export interface ProductGroupRow {
  group_key: string;          // group_id OR "solo:<product_id>"
  group_id: string | null;    // null when solo
  variant_count: number;
  rep: Product;               // representative variant (used for the row display)
}

export interface ProductGroupsFilters {
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
 * Server-side paginated PRODUCT GROUPS via RPC `list_product_groups`.
 * Scales to 100k+ products: only one row per group is sent over the wire,
 * pagination + sorting happens in Postgres.
 */
export function useProductGroups(filters: ProductGroupsFilters = {}) {
  const { user } = useAuth();
  const { isLoading: permissionsLoading } = usePermissions();
  const { data: tenant } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;

  const result = useQuery({
    queryKey: [
      'product-groups',
      user?.id,
      isDataHidden,
      filters.search ?? '',
      filters.categoryId ?? '',
      filters.supplierId ?? '',
      filters.status ?? '',
      filters.branchId ?? '',
      filters.dateFrom ?? '',
      filters.dateTo ?? '',
      filters.printedFilter ?? '',
      page,
      pageSize,
    ],
    queryFn: async () => {
      if (isDataHidden) return { items: [] as ProductGroupRow[], totalGroups: 0 };

      const norm = (v?: string) => (v && v !== '_all_' ? v : null);

      const { data, error } = await supabase.rpc('list_product_groups', {
        p_search: filters.search?.trim() || null,
        p_category_id: norm(filters.categoryId) as any,
        p_supplier_id: norm(filters.supplierId) as any,
        p_status: norm(filters.status),
        p_branch_id: norm(filters.branchId) as any,
        p_date_from: filters.dateFrom || null,
        p_date_to: filters.dateTo ? `${filters.dateTo}T23:59:59` : null,
        p_printed_filter: norm(filters.printedFilter),
        p_page: page,
        p_page_size: pageSize,
      });

      if (error) throw error;

      const payload = (data ?? {}) as { items?: ProductGroupRow[]; total_groups?: number };
      return {
        items: payload.items ?? [],
        totalGroups: Number(payload.total_groups ?? 0),
      };
    },
    enabled: !!user?.id && !permissionsLoading,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: (previous) => previous,
  });

  return {
    ...result,
    items: result.data?.items ?? [],
    totalGroups: result.data?.totalGroups ?? 0,
  };
}

/**
 * Lazy-load variants for a single group (called when user expands a row).
 */
export function useGroupVariants(groupKey: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['group-variants', groupKey, user?.id],
    queryFn: async () => {
      if (!groupKey) return [] as Product[];
      const { data, error } = await supabase.rpc('get_group_variants', {
        p_group_key: groupKey,
      });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
    enabled: !!groupKey && !!user?.id,
    staleTime: 30 * 1000,
  });
}

/**
 * Helper to invalidate both group list and variant caches after a mutation.
 */
export function useInvalidateProductGroups() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['product-groups'] });
    qc.invalidateQueries({ queryKey: ['group-variants'] });
    qc.invalidateQueries({ queryKey: ['products'] });
  };
}