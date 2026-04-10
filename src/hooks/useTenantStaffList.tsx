import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant, usePlatformUser } from './useTenant';

export interface TenantStaffListItem {
  user_id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  user_role: string | null;
  branch_id: string | null;
}

export function useTenantStaffList() {
  const { data: currentTenant } = useCurrentTenant();
  const { data: platformUser } = usePlatformUser();
  const tenantId = currentTenant?.id || platformUser?.tenant_id;

  return useQuery({
    queryKey: ['tenant-staff-list', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [{ data: platformUsers, error: platformUsersError }, { data: roles, error: rolesError }] = await Promise.all([
        supabase
          .from('platform_users')
          .select('user_id, email')
          .eq('tenant_id', tenantId!),
        supabase
          .from('user_roles')
          .select('user_id, user_role, branch_id, tenant_id')
          .eq('tenant_id', tenantId!),
      ]);

      if (platformUsersError) throw platformUsersError;
      if (rolesError) throw rolesError;

      const scopedUsers = platformUsers || [];
      const scopedRoles = roles || [];
      const userIds = [...new Set([
        ...scopedUsers.map((item) => item.user_id),
        ...scopedRoles.map((item) => item.user_id),
      ])];

      if (!userIds.length) return [] as TenantStaffListItem[];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, phone')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const preferredRoles = new Map<string, (typeof scopedRoles)[number]>();
      for (const role of scopedRoles) {
        const existing = preferredRoles.get(role.user_id);
        if (!existing || (!existing.tenant_id && role.tenant_id)) {
          preferredRoles.set(role.user_id, role);
        }
      }

      const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
      const platformUserMap = new Map(scopedUsers.map((item) => [item.user_id, item]));

      return userIds
        .map((userId) => {
          const profile = profileMap.get(userId);
          const role = preferredRoles.get(userId);
          const platformUserEntry = platformUserMap.get(userId);

          return {
            user_id: userId,
            display_name: profile?.display_name || platformUserEntry?.email || userId.slice(0, 8),
            phone: profile?.phone || null,
            email: platformUserEntry?.email || null,
            user_role: role?.user_role || null,
            branch_id: role?.branch_id || null,
          } satisfies TenantStaffListItem;
        })
        .sort((a, b) => a.display_name.localeCompare(b.display_name, 'vi'));
    },
  });
}