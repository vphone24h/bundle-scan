import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
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
  import_price: number;
  import_date: string;
  supplier_id: string | null;
  branch_id: string | null;
  import_receipt_id: string | null;
  status: ProductStatus;
  note: string | null;
  quantity: number;
  total_import_cost: number;
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
      let query = supabase
        .from('products')
        .select(`
          *,
          categories(name),
          suppliers(name),
          branches(name)
        `)
        .in('status', ['in_stock', 'sold', 'returned'])
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
          *,
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

      // Kiểm tra IMEI trong phạm vi TENANT với các status: in_stock, sold, returned
      // Sử dụng .select() thay vì .maybeSingle() vì có thể có nhiều bản ghi cùng IMEI
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, status')
        .eq('imei', imei)
        .eq('tenant_id', tenantId)
        .in('status', ['in_stock', 'sold', 'returned'])
        .limit(1);

      if (error) throw error;
      
      // Trả về bản ghi đầu tiên nếu có
      return data && data.length > 0 ? data[0] : null;
    },
  });
}
