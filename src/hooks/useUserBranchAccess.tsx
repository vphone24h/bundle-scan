import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Hook để lấy danh sách chi nhánh bổ sung mà một user được quyền xem
 */
export function useUserBranchAccess(userId: string | null) {
  return useQuery({
    queryKey: ['user-branch-access', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('user_branch_access')
        .select('id, branch_id, created_at')
        .eq('user_id', userId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}

/**
 * Hook để lấy danh sách branch_id bổ sung của user hiện tại (dùng cho filter tồn kho)
 */
export function useCurrentUserBranchAccess() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-branch-access', user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as string[];

      const { data, error } = await supabase
        .from('user_branch_access')
        .select('branch_id')
        .eq('user_id', user.id);

      if (error) throw error;
      return (data || []).map(d => d.branch_id);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook để Super Admin quản lý quyền xem chi nhánh cho user
 */
export function useManageBranchAccess() {
  const queryClient = useQueryClient();

  const grantAccess = useMutation({
    mutationFn: async ({ userId, branchId, tenantId }: { userId: string; branchId: string; tenantId: string }) => {
      const { error } = await supabase
        .from('user_branch_access')
        .insert({
          user_id: userId,
          branch_id: branchId,
          tenant_id: tenantId,
          granted_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-branch-access', variables.userId] });
    },
  });

  const revokeAccess = useMutation({
    mutationFn: async ({ userId, branchId }: { userId: string; branchId: string }) => {
      const { error } = await supabase
        .from('user_branch_access')
        .delete()
        .eq('user_id', userId)
        .eq('branch_id', branchId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-branch-access', variables.userId] });
    },
  });

  return { grantAccess, revokeAccess };
}
