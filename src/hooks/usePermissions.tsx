import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type UserRole = 'super_admin' | 'branch_admin' | 'staff' | 'cashier';

export interface UserPermissions {
  role: UserRole;
  branchId: string | null;
  // Quyền xem
  canViewAllBranches: boolean;
  canViewReports: boolean;
  canViewCashBook: boolean;
  canViewImportPrice: boolean;
  canViewAuditLogs: boolean;
  // Quyền thao tác
  canManageUsers: boolean;
  canManageBranches: boolean;
  canImportProducts: boolean;
  canExportProducts: boolean;
  canManageProducts: boolean;
  canManageCategories: boolean;
  canManageSuppliers: boolean;
  canManageCustomers: boolean;
  canManageInvoiceTemplates: boolean;
  canManageCashBook: boolean;
  // Quyền quản lý nhân viên chi nhánh
  canManageBranchStaff: boolean;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  role: 'staff',
  branchId: null,
  canViewAllBranches: false,
  canViewReports: false,
  canViewCashBook: false,
  canViewImportPrice: false,
  canViewAuditLogs: false,
  canManageUsers: false,
  canManageBranches: false,
  canImportProducts: false,
  canExportProducts: false,
  canManageProducts: false,
  canManageCategories: false,
  canManageSuppliers: false,
  canManageCustomers: false,
  canManageInvoiceTemplates: false,
  canManageCashBook: false,
  canManageBranchStaff: false,
};

function getPermissionsForRole(role: UserRole, branchId: string | null): UserPermissions {
  const base = { role, branchId };

  switch (role) {
    case 'super_admin':
      return {
        ...base,
        canViewAllBranches: true,
        canViewReports: true,
        canViewCashBook: true,
        canViewImportPrice: true,
        canViewAuditLogs: true,
        canManageUsers: true,
        canManageBranches: true,
        canImportProducts: true,
        canExportProducts: true,
        canManageProducts: true,
        canManageCategories: true,
        canManageSuppliers: true,
        canManageCustomers: true,
        canManageInvoiceTemplates: true,
        canManageCashBook: true,
        canManageBranchStaff: true,
      };

    case 'branch_admin':
      return {
        ...base,
        canViewAllBranches: false,
        canViewReports: true,
        canViewCashBook: true,
        canViewImportPrice: true,
        canViewAuditLogs: false,
        canManageUsers: false,
        canManageBranches: false,
        canImportProducts: true,
        canExportProducts: true,
        canManageProducts: true,
        canManageCategories: true,
        canManageSuppliers: true,
        canManageCustomers: true,
        canManageInvoiceTemplates: true,
        canManageCashBook: true,
        canManageBranchStaff: true,
      };

    case 'cashier':
      return {
        ...base,
        canViewAllBranches: false,
        canViewReports: true, // Chỉ xem báo cáo bán hàng
        canViewCashBook: true,
        canViewImportPrice: false,
        canViewAuditLogs: false,
        canManageUsers: false,
        canManageBranches: false,
        canImportProducts: false,
        canExportProducts: true,
        canManageProducts: false,
        canManageCategories: false,
        canManageSuppliers: false,
        canManageCustomers: true, // Cần thêm khách hàng khi bán
        canManageInvoiceTemplates: false,
        canManageCashBook: true, // Thu chi tại quầy
        canManageBranchStaff: false,
      };

    case 'staff':
    default:
      return {
        ...base,
        canViewAllBranches: false,
        canViewReports: false,
        canViewCashBook: false,
        canViewImportPrice: false,
        canViewAuditLogs: false,
        canManageUsers: false,
        canManageBranches: false,
        canImportProducts: false,
        canExportProducts: true,
        canManageProducts: false,
        canManageCategories: false,
        canManageSuppliers: false,
        canManageCustomers: true, // Cần thêm khách hàng khi bán
        canManageInvoiceTemplates: false,
        canManageCashBook: false,
        canManageBranchStaff: false,
      };
  }
}

export function usePermissions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return DEFAULT_PERMISSIONS;

      const { data, error } = await supabase
        .from('user_roles')
        .select('user_role, branch_id')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        console.error('Error fetching permissions:', error);
        return DEFAULT_PERMISSIONS;
      }

      const role = (data.user_role as UserRole) || 'staff';
      const branchId = data.branch_id as string | null;

      return getPermissionsForRole(role, branchId);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache 5 phút
  });
}

// Hook để lấy danh sách chi nhánh mà user được phép xem
export function useAccessibleBranches() {
  const { data: permissions } = usePermissions();

  return useQuery({
    queryKey: ['accessible-branches', permissions?.role, permissions?.branchId],
    queryFn: async () => {
      if (!permissions) return [];

      if (permissions.canViewAllBranches) {
        // Super admin: lấy tất cả chi nhánh
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .order('is_default', { ascending: false });

        if (error) throw error;
        return data;
      } else if (permissions.branchId) {
        // Các role khác: chỉ lấy chi nhánh được gán
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .eq('id', permissions.branchId);

        if (error) throw error;
        return data;
      }

      return [];
    },
    enabled: !!permissions,
  });
}

// Hook để ghi audit log
export function useAuditLog() {
  const { user } = useAuth();
  const { data: permissions } = usePermissions();

  const logAction = async (params: {
    actionType: 'create' | 'update' | 'delete' | 'view' | 'login' | 'logout';
    tableName?: string;
    recordId?: string;
    oldData?: Record<string, unknown>;
    newData?: Record<string, unknown>;
    description?: string;
  }) => {
    if (!user?.id) return;

    try {
      await supabase.from('audit_logs').insert([{
        user_id: user.id,
        action_type: params.actionType,
        table_name: params.tableName || null,
        record_id: params.recordId || null,
        branch_id: permissions?.branchId || null,
        old_data: params.oldData ? JSON.parse(JSON.stringify(params.oldData)) : null,
        new_data: params.newData ? JSON.parse(JSON.stringify(params.newData)) : null,
        description: params.description || null,
      }]);
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  };

  return { logAction };
}
