import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

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
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories(name),
          suppliers(name),
          branches(name)
        `)
        .order('import_date', { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
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
