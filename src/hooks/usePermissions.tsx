import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { PermissionMap, getDefaultPermissionsForRole } from '@/config/permissionDefinitions';

export type UserRole = 'super_admin' | 'branch_admin' | 'staff' | 'cashier';

export interface UserPermissions {
  role: UserRole;
  branchId: string | null;
  // Quyền xem
  canViewAllBranches: boolean;
  canViewReports: boolean;
  canViewCashBook: boolean;
  canViewImportPrice: boolean;
  canViewSalePrice: boolean;
  canViewAuditLogs: boolean;
  canViewProducts: boolean;
  canViewInventory: boolean;
  canViewWarranty: boolean;
  canViewStockCheck: boolean;
  canViewInventoryImportPrice: boolean;
  canViewStaffReviews: boolean;
  canViewDebt: boolean;
  canViewCRM: boolean;
  canViewWebsite: boolean;
  canViewSocial: boolean;
  canViewApp: boolean;
  canViewSubscription: boolean;
  canViewGuide: boolean;
  canViewSettings: boolean;
  // Quyền thao tác
  canManageUsers: boolean;
  canManageBranchStaff: boolean;
  canManageBranches: boolean;
  canImportProducts: boolean;
  canExportProducts: boolean;
  canCreateImportReceipt: boolean;
  canCreateExportReceipt: boolean;
  canTransferStock: boolean;
  canCreateReturn: boolean;
  canManageRepair: boolean;
  canManageProducts: boolean;
  canManageCategories: boolean;
  canManageSuppliers: boolean;
  canManageCustomers: boolean;
  canManageInvoiceTemplates: boolean;
  canManageCashBook: boolean;
  canViewImportHistory: boolean;
  canViewImportHistoryPrice: boolean;
  canViewExportHistory: boolean;
  canViewExportCustomerInfo: boolean;
  // Quyền đặc biệt (chỉ Super Admin)
  canEditSalePrice: boolean;
  canAdjustProductQuantity: boolean;
  canDeleteIMEIProducts: boolean;
  // Granular permissions (from custom permissions table)
  granular: PermissionMap;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  role: 'staff',
  branchId: null,
  canViewAllBranches: false,
  canViewReports: false,
  canViewCashBook: false,
  canViewImportPrice: false,
  canViewSalePrice: true,
  canViewAuditLogs: false,
  canViewProducts: true,
  canViewInventory: true,
  canViewWarranty: false,
  canViewStockCheck: false,
  canViewInventoryImportPrice: false,
  canViewStaffReviews: true,
  canViewDebt: false,
  canViewCRM: true,
  canViewWebsite: false,
  canViewSocial: false,
  canViewApp: false,
  canViewSubscription: false,
  canViewGuide: true,
  canViewSettings: false,
  canManageUsers: false,
  canManageBranchStaff: false,
  canManageBranches: false,
  canImportProducts: false,
  canExportProducts: false,
  canCreateImportReceipt: false,
  canCreateExportReceipt: false,
  canTransferStock: false,
  canCreateReturn: false,
  canManageProducts: false,
  canManageCategories: false,
  canManageSuppliers: false,
  canManageCustomers: false,
  canManageInvoiceTemplates: false,
  canManageCashBook: false,
  canViewImportHistory: false,
  canViewImportHistoryPrice: false,
  canViewExportHistory: false,
  canViewExportCustomerInfo: false,
  canEditSalePrice: false,
  canAdjustProductQuantity: false,
  canDeleteIMEIProducts: false,
  granular: getDefaultPermissionsForRole('staff'),
};

/**
 * Map granular permission keys to the legacy UserPermissions fields.
 * Custom permissions override role-based defaults.
 */
function mapGranularToLegacy(role: UserRole, branchId: string | null, granular: PermissionMap): UserPermissions {
  return {
    role,
    branchId,
    canViewAllBranches: role === 'super_admin' || !!granular.view_other_branches,
    canViewReports: !!granular.view_reports,
    canViewCashBook: !!granular.view_reports, // cashbook tied to reports
    canViewImportPrice: !!granular.view_import_price,
    canViewSalePrice: !!granular.view_sale_price,
    canViewAuditLogs: !!granular.view_audit_logs,
    canViewProducts: !!granular.view_products,
    canViewInventory: !!granular.view_inventory,
    canViewWarranty: !!granular.view_warranty,
    canViewStockCheck: !!granular.view_stock_check,
    canViewInventoryImportPrice: !!granular.view_inventory_import_price,
    canViewStaffReviews: role === 'staff',
    canViewDebt: !!granular.view_debt,
    canViewCRM: !!granular.view_crm,
    canViewWebsite: !!granular.view_website,
    canViewSocial: !!granular.view_social,
    canViewApp: !!granular.view_app,
    canViewSubscription: !!granular.view_subscription,
    canViewGuide: !!granular.view_guide,
    canViewSettings: !!granular.view_settings,
    canManageUsers: !!granular.manage_users || role === 'super_admin',
    canManageBranchStaff: role === 'branch_admin' || role === 'super_admin',
    canManageBranches: !!granular.manage_branches,
    canImportProducts: !!granular.create_import || !!granular.view_import_history,
    canExportProducts: !!granular.create_export || !!granular.view_export_history,
    canCreateImportReceipt: !!granular.create_import,
    canCreateExportReceipt: !!granular.create_export,
    canTransferStock: !!granular.transfer_stock,
    canCreateReturn: !!granular.create_return,
    canManageProducts: role === 'super_admin' || role === 'branch_admin',
    canManageCategories: role === 'super_admin' || role === 'branch_admin',
    canManageSuppliers: !!granular.view_suppliers,
    canManageCustomers: !!granular.view_crm,
    canManageInvoiceTemplates: role === 'super_admin' || role === 'branch_admin' || role === 'cashier',
    canManageCashBook: !!granular.view_reports,
    canViewImportHistory: !!granular.view_import_history,
    canViewImportHistoryPrice: !!granular.view_import_history_price,
    canViewExportHistory: !!granular.view_export_history,
    canViewExportCustomerInfo: !!granular.view_export_customer_info,
    canEditSalePrice: role === 'super_admin' || role === 'branch_admin',
    canAdjustProductQuantity: role === 'super_admin',
    canDeleteIMEIProducts: role === 'super_admin',
    granular,
  };
}

function getPermissionsForRole(role: UserRole, branchId: string | null): UserPermissions {
  const granular = getDefaultPermissionsForRole(role);
  return mapGranularToLegacy(role, branchId, granular);
}

export function usePermissions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return DEFAULT_PERMISSIONS;

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

      // Check for custom permissions
      if (tenantId) {
        const { data: customPerms } = await supabase
          .from('user_custom_permissions')
          .select('permissions')
          .eq('user_id', user.id)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (customPerms?.permissions) {
          const granular = customPerms.permissions as unknown as PermissionMap;
          return mapGranularToLegacy(role, branchId, granular);
        }
      }

      return getPermissionsForRole(role, branchId);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
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
