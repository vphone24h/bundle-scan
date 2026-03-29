import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PermissionMap } from '@/config/permissionDefinitions';

/**
 * Fetch custom (granular) permissions for a specific user in a tenant.
 */
export function useUserCustomPermissions(userId: string | null, tenantId: string | null) {
  return useQuery({
    queryKey: ['user-custom-permissions', userId, tenantId],
    queryFn: async (): Promise<PermissionMap | null> => {
      if (!userId || !tenantId) return null;

      const { data, error } = await supabase
        .from('user_custom_permissions')
        .select('permissions')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching custom permissions:', error);
        return null;
      }

      return (data?.permissions as PermissionMap) || null;
    },
    enabled: !!userId && !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Save custom permissions for a user (upsert).
 */
export function useSaveCustomPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      tenantId,
      permissions,
    }: {
      userId: string;
      tenantId: string;
      permissions: PermissionMap;
    }) => {
      const { error } = await supabase
        .from('user_custom_permissions')
        .upsert(
          {
            user_id: userId,
            tenant_id: tenantId,
            permissions: permissions as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,tenant_id' }
        );

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-custom-permissions', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
    },
  });
}
