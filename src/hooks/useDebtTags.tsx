import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface DebtTag {
  id: string;
  name: string;
  color: string;
  tenant_id: string;
  created_at: string;
}

export interface DebtTagAssignment {
  id: string;
  tag_id: string;
  entity_id: string;
  entity_type: 'customer' | 'supplier';
  tenant_id: string;
}

export function useDebtTags() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['debt-tags', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debt_tags')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as DebtTag[];
    },
    enabled: !!user?.id,
  });
}

export function useDebtTagAssignments(entityType?: 'customer' | 'supplier') {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['debt-tag-assignments', user?.id, entityType],
    queryFn: async () => {
      let query = supabase.from('debt_tag_assignments').select('*');
      if (entityType) query = query.eq('entity_type', entityType);
      const { data, error } = await query;
      if (error) throw error;
      return data as DebtTagAssignment[];
    },
    enabled: !!user?.id,
  });
}

export function useCreateDebtTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tag: { name: string; color: string }) => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');
      const { data, error } = await supabase
        .from('debt_tags')
        .insert([{ ...tag, tenant_id: tenantId }])
        .select()
        .single();
      if (error) throw error;
      return data as DebtTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debt-tags'] });
    },
  });
}

export function useUpdateDebtTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const { data, error } = await supabase
        .from('debt_tags')
        .update({ name, color })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DebtTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debt-tags'] });
    },
  });
}

export function useDeleteDebtTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase.from('debt_tags').delete().eq('id', tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debt-tags'] });
      queryClient.invalidateQueries({ queryKey: ['debt-tag-assignments'] });
    },
  });
}

export function useAssignDebtTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assignment: { tag_id: string; entity_id: string; entity_type: 'customer' | 'supplier' }) => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');
      const { data, error } = await supabase
        .from('debt_tag_assignments')
        .insert([{ ...assignment, tenant_id: tenantId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debt-tag-assignments'] });
    },
  });
}

export function useRemoveDebtTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tagId, entityId, entityType }: { tagId: string; entityId: string; entityType: string }) => {
      const { error } = await supabase
        .from('debt_tag_assignments')
        .delete()
        .eq('tag_id', tagId)
        .eq('entity_id', entityId)
        .eq('entity_type', entityType);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debt-tag-assignments'] });
    },
  });
}
