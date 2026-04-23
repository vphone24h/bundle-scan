import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductServicePackage {
  id: string;
  tenant_id: string;
  product_group_id: string | null;
  name: string;
  price: number;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function useProductServicePackages(productGroupId?: string | null) {
  return useQuery({
    queryKey: ['product-service-packages', productGroupId],
    queryFn: async () => {
      let query = supabase
        .from('product_service_packages' as any)
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (productGroupId) {
        query = query.eq('product_group_id', productGroupId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ProductServicePackage[];
    },
    enabled: !!productGroupId,
  });
}

export function useAllTenantServicePackages() {
  return useQuery({
    queryKey: ['product-service-packages-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_service_packages' as any)
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ProductServicePackage[];
    },
  });
}

export function useCreateServicePackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pkg: {
      product_group_id?: string | null;
      name: string;
      price: number;
      description?: string | null;
      display_order?: number;
    }) => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data, error } = await supabase
        .from('product_service_packages' as any)
        .insert([{ ...pkg, tenant_id: tenantId }])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ProductServicePackage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-service-packages'] });
      queryClient.invalidateQueries({ queryKey: ['product-service-packages-all'] });
    },
  });
}

export function useUpdateServicePackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductServicePackage> & { id: string }) => {
      const { error } = await supabase
        .from('product_service_packages' as any)
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-service-packages'] });
      queryClient.invalidateQueries({ queryKey: ['product-service-packages-all'] });
    },
  });
}

export function useDeleteServicePackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_service_packages' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-service-packages'] });
      queryClient.invalidateQueries({ queryKey: ['product-service-packages-all'] });
    },
  });
}