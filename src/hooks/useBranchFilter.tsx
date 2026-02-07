import { useMemo } from 'react';
import { usePermissions } from './usePermissions';
import { useCurrentUserBranchAccess } from './useUserBranchAccess';

/**
 * Hook để lấy branch filter dữ liệu theo vai trò:
 * - Super Admin: null (xem tất cả chi nhánh)
 * - Branch Admin, Staff, Cashier: branch_id chính + các chi nhánh bổ sung được cấp quyền
 * 
 * Sử dụng hook này trong tất cả các query để đảm bảo phân quyền theo chi nhánh
 */
export function useBranchFilter() {
  const { data: permissions, isLoading } = usePermissions();
  const { data: extraBranchIds, isLoading: extraLoading } = useCurrentUserBranchAccess();

  const branchFilter = useMemo(() => {
    if (isLoading || !permissions || extraLoading) {
      return {
        branchId: undefined as string | null | undefined,
        branchIds: undefined as string[] | undefined,
        shouldFilter: false,
        canViewAllBranches: false,
        isLoading: true,
      };
    }

    // Super Admin can see all branches
    if (permissions.canViewAllBranches) {
      return {
        branchId: null, // null means no filter
        branchIds: null as string[] | null,
        shouldFilter: false,
        canViewAllBranches: true,
        isLoading: false,
      };
    }

    // Other roles: filter by assigned branch + extra branches
    const allBranchIds: string[] = [];
    if (permissions.branchId) {
      allBranchIds.push(permissions.branchId);
    }
    if (extraBranchIds && extraBranchIds.length > 0) {
      for (const id of extraBranchIds) {
        if (!allBranchIds.includes(id)) {
          allBranchIds.push(id);
        }
      }
    }

    return {
      branchId: permissions.branchId,
      branchIds: allBranchIds.length > 0 ? allBranchIds : null,
      shouldFilter: true,
      canViewAllBranches: false,
      isLoading: false,
    };
  }, [permissions, isLoading, extraBranchIds, extraLoading]);

  return branchFilter;
}

/**
 * Helper function để build query với branch filter
 * Sử dụng trong các hook lấy dữ liệu
 */
export function applyBranchFilter<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  branchId: string | null | undefined,
  shouldFilter: boolean,
  columnName: string = 'branch_id'
): T {
  if (shouldFilter && branchId) {
    return query.eq(columnName, branchId);
  }
  return query;
}
