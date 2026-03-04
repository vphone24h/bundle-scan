import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { useBranchFilter } from './useBranchFilter';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { useBranchFilter } from './useBranchFilter';

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

export function useProducts() {
  const { user } = useAuth();
  const { branchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  return useQuery({
    // Keyed by user AND branch to prevent cross-tenant/branch cache leakage
    queryKey: ['products', user?.id, branchId],
    queryFn: async () => {
      const buildQuery = () => {
        let q = supabase
          .from('products')
          .select(`
            *,
            categories(name),
            suppliers(name),
            branches(name)
          `)
          .in('status', ['in_stock', 'sold', 'returned'])
          .order('import_date', { ascending: false });

        if (shouldFilter && branchId) {
          q = q.eq('branch_id', branchId);
        }
        return q;
      };

      const data = await fetchAllRows<Product>(buildQuery);
      return data;
    },
    enabled: !!user?.id && !branchLoading,
  });
}

// Hook to get ALL products including deleted (for Import History page)
export function useAllProducts() {
  const { user } = useAuth();
  const { branchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  return useQuery({
    queryKey: ['all-products', user?.id, branchId],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          imei,
          category_id,
          import_price,
          import_date,
          supplier_id,
          branch_id,
          import_receipt_id,
          status,
          note,
          quantity,
          total_import_cost,
          created_at,
          updated_at,
          categories(name),
          suppliers(name),
          branches(name)
        `)
        .order('import_date', { ascending: false });

      // Apply branch filter for non-Super Admin users
      if (shouldFilter && branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user?.id && !branchLoading,
  });
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
      // Lấy tenant_id hiện tại để kiểm tra trong phạm vi cửa hàng
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Chỉ chặn IMEI đang tồn kho hoặc đang bảo hành
      // Cho phép nhập lại IMEI đã bán (sold) hoặc đã trả NCC (returned)
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, status')
        .eq('imei', imei)
        .eq('tenant_id', tenantId)
        .in('status', ['in_stock', 'warranty'])
        .limit(1);

      if (error) throw error;
      
      // Trả về bản ghi đầu tiên nếu có
      return data && data.length > 0 ? data[0] : null;
    },
  });
}

// Hook để kiểm tra nhiều IMEI cùng lúc (batch check) - tối ưu cho nhập Excel
export function useBatchCheckIMEI() {
  return useMutation({
    mutationFn: async (imeis: string[]): Promise<Set<string>> => {
      if (imeis.length === 0) return new Set();
      
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Chia thành các batch nhỏ để tránh query quá lớn (Supabase giới hạn)
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
