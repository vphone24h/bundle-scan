import { useMemo } from 'react';
import { usePermissions } from './usePermissions';

/**
 * Hook để lấy branch_id cần filter dữ liệu theo vai trò:
 * - Super Admin: null (xem tất cả chi nhánh)
 * - Branch Admin, Staff, Cashier: branch_id được gán
 * 
 * Sử dụng hook này trong tất cả các query để đảm bảo phân quyền theo chi nhánh
 */
export function useBranchFilter() {
  const { data: permissions, isLoading } = usePermissions();

  const branchFilter = useMemo(() => {
    if (!permissions) {
      return {
        branchId: undefined as string | null | undefined,
        shouldFilter: false,
        canViewAllBranches: false,
        isLoading: true,
      };
    }

    // Super Admin can see all branches
    if (permissions.canViewAllBranches) {
      return {
        branchId: null, // null means no filter
        shouldFilter: false,
        canViewAllBranches: true,
        isLoading: false,
      };
    }

    // Other roles: filter by assigned branch
    return {
      branchId: permissions.branchId,
      shouldFilter: true,
      canViewAllBranches: false,
      isLoading: false,
    };
  }, [permissions, isLoading]);

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

