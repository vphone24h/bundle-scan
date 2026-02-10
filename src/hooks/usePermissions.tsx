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
  canViewProducts: boolean;
  canViewInventory: boolean;
  // Quyền thao tác
  canManageUsers: boolean; // Super Admin: quản lý tất cả user
  canManageBranchStaff: boolean; // Branch Admin: quản lý nhân viên chi nhánh
  canManageBranches: boolean;
  canImportProducts: boolean;   // Xem menu nhập hàng
  canExportProducts: boolean;   // Xem menu xuất hàng
  canCreateImportReceipt: boolean; // Tạo phiếu nhập mới
  canCreateExportReceipt: boolean; // Tạo phiếu xuất mới
  canManageProducts: boolean;
  canManageCategories: boolean;
  canManageSuppliers: boolean;
  canManageCustomers: boolean;
  canManageInvoiceTemplates: boolean;
  canManageCashBook: boolean;
  // Quyền đặc biệt (chỉ Super Admin)
  canEditSalePrice: boolean;
  canAdjustProductQuantity: boolean;
  canDeleteIMEIProducts: boolean;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  role: 'staff',
  branchId: null,
  canViewAllBranches: false,
  canViewReports: false,
  canViewCashBook: false,
  canViewImportPrice: false,
  canViewAuditLogs: false,
  canViewProducts: true,
  canViewInventory: true,
  canManageUsers: false,
  canManageBranchStaff: false,
  canManageBranches: false,
  canImportProducts: false,
  canExportProducts: false,
  canCreateImportReceipt: false,
  canCreateExportReceipt: false,
  canManageProducts: false,
  canManageCategories: false,
  canManageSuppliers: false,
  canManageCustomers: false,
  canManageInvoiceTemplates: false,
  canManageCashBook: false,
  canEditSalePrice: false,
  canAdjustProductQuantity: false,
  canDeleteIMEIProducts: false,
};

function getPermissionsForRole(role: UserRole, branchId: string | null): UserPermissions {
  const base = { role, branchId };

  switch (role) {
    case 'super_admin':
      // ✅ Quyền cao nhất – quản trị toàn hệ thống
      return {
        ...base,
        canViewAllBranches: true,
        canViewReports: true,
        canViewCashBook: true,
        canViewImportPrice: true,
        canViewAuditLogs: true,
        canViewProducts: true,
        canViewInventory: true,
        canManageUsers: true,
        canManageBranchStaff: true,
        canManageBranches: true,
        canImportProducts: true,
        canExportProducts: true,
        canCreateImportReceipt: true,
        canCreateExportReceipt: true,
        canManageProducts: true,
        canManageCategories: true,
        canManageSuppliers: true,
        canManageCustomers: true,
        canManageInvoiceTemplates: true,
        canManageCashBook: true,
        canEditSalePrice: true,
        canAdjustProductQuantity: true,
        canDeleteIMEIProducts: true,
      };

    case 'branch_admin':
      // ✅ Chỉ quản lý một chi nhánh được gán
      return {
        ...base,
        canViewAllBranches: false,
        canViewReports: true,
        canViewCashBook: true,
        canViewImportPrice: true,
        canViewAuditLogs: true,
        canViewProducts: true,
        canViewInventory: true,
        canManageUsers: false,
        canManageBranchStaff: true,
        canManageBranches: false,
        canImportProducts: true,
        canExportProducts: true,
        canCreateImportReceipt: true,
        canCreateExportReceipt: true,
        canManageProducts: true,
        canManageCategories: true,
        canManageSuppliers: true,
        canManageCustomers: true,
        canManageInvoiceTemplates: true,
        canManageCashBook: true,
        canEditSalePrice: true,
        canAdjustProductQuantity: false,
        canDeleteIMEIProducts: false,
      };

    case 'cashier':
      // ✅ Kế toán - phụ trách sổ sách, báo cáo tài chính
      return {
        ...base,
        canViewAllBranches: false,     // ❌ Chỉ chi nhánh được gán
        canViewReports: true,           // ✅ Xem tất cả báo cáo
        canViewCashBook: true,          // ✅ Xem sổ quỹ
        canViewImportPrice: true,       // ✅ Xem giá nhập, giá vốn
        canViewAuditLogs: false,        // ❌ Không xem audit logs
        canViewProducts: true,          // ✅ Xem sản phẩm
        canViewInventory: true,         // ✅ Xem tồn kho
        canManageUsers: false,          // ❌ Không quản lý tài khoản
        canManageBranchStaff: false,    // ❌ Không quản lý nhân viên
        canManageBranches: false,       // ❌ Không quản lý chi nhánh
        canImportProducts: true,        // ✅ Xem lịch sử nhập hàng
        canExportProducts: true,        // ✅ Xem lịch sử xuất hàng
        canCreateImportReceipt: false,  // ❌ Không tạo phiếu nhập
        canCreateExportReceipt: false,  // ❌ Không tạo phiếu xuất
        canManageProducts: false,       // ❌ Không sửa/xóa sản phẩm
        canManageCategories: false,     // ❌ Không quản lý danh mục
        canManageSuppliers: true,       // ✅ Xem NCC, công nợ NCC
        canManageCustomers: true,       // ✅ Xem khách hàng
        canManageInvoiceTemplates: true, // ✅ Hoá đơn điện tử
        canManageCashBook: true,        // ✅ Xem/tạo thu chi sổ quỹ
        canEditSalePrice: false,         // ❌ Không sửa giá bán
        canAdjustProductQuantity: false, // ❌
        canDeleteIMEIProducts: false,    // ❌
      };

    case 'staff':
    default:
      // ✅ Nhân viên bán hàng/kỹ thuật
      return {
        ...base,
        canViewAllBranches: false,
        canViewReports: false,
        canViewCashBook: false,
        canViewImportPrice: false,
        canViewAuditLogs: false,
        canViewProducts: true,
        canViewInventory: true,
        canManageUsers: false,
        canManageBranchStaff: false,
        canManageBranches: false,
        canImportProducts: false,
        canExportProducts: true,
        canCreateImportReceipt: false,
        canCreateExportReceipt: true,
        canManageProducts: false,
        canManageCategories: false,
        canManageSuppliers: false,
        canManageCustomers: true,
        canManageInvoiceTemplates: false,
        canManageCashBook: false,
        canEditSalePrice: false,
        canAdjustProductQuantity: false,
        canDeleteIMEIProducts: false,
      };
  }
}

export function usePermissions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return DEFAULT_PERMISSIONS;

      // Resolve tenant first, then pick the correct user_roles row for that tenant.
      // Without tenant_id filtering, `.single()` can return the wrong branch after reload.
      const { data: platformUser, error: puError } = await supabase
        .from('platform_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (puError) {
        console.error('Error fetching platform user:', puError);
        return DEFAULT_PERMISSIONS;
      }

      const tenantId = platformUser?.tenant_id;
      let rolesQuery = supabase
        .from('user_roles')
        .select('user_role, branch_id')
        .eq('user_id', user.id);

      if (tenantId) {
        rolesQuery = rolesQuery.eq('tenant_id', tenantId);
      }

      const { data, error } = await rolesQuery.maybeSingle();

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
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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
