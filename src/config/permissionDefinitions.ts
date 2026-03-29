/**
 * Granular permission definitions for the advanced RBAC system.
 * Each permission key maps to a checkbox in the permission editor.
 */

export interface PermissionItem {
  key: string;
  label: string;
  description?: string;
}

export interface PermissionCategory {
  key: string;
  label: string;
  children: PermissionItem[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    key: 'products',
    label: 'Sản phẩm',
    children: [
      { key: 'view_products', label: 'Xem sản phẩm' },
      { key: 'view_import_price', label: 'Thấy giá nhập', description: 'Không tick → hiển thị "***"' },
      { key: 'view_sale_price', label: 'Thấy giá bán', description: 'Không tick → hiển thị "***"' },
    ],
  },
  {
    key: 'inventory',
    label: 'Tồn kho',
    children: [
      { key: 'view_inventory', label: 'Xem tồn kho' },
      { key: 'view_inventory_import_price', label: 'Thấy giá nhập trong tồn kho' },
      { key: 'view_warranty', label: 'Hàng bảo hành' },
      { key: 'view_stock_check', label: 'Kiểm kho' },
    ],
  },
  {
    key: 'import',
    label: 'Nhập hàng',
    children: [
      { key: 'create_import', label: 'Tạo phiếu nhập' },
      { key: 'view_import_history', label: 'Lịch sử nhập' },
      { key: 'view_import_history_price', label: 'Xem giá nhập trong lịch sử', description: 'Con của "Lịch sử nhập"' },
      { key: 'transfer_stock', label: 'Chuyển hàng' },
    ],
  },
  {
    key: 'export',
    label: 'Bán hàng / Xuất hàng',
    children: [
      { key: 'create_export', label: 'Tạo đơn' },
      { key: 'view_export_history', label: 'Lịch sử bán' },
      { key: 'view_export_customer_info', label: 'Xem thông tin khách', description: 'Con của "Lịch sử bán"' },
      { key: 'create_return', label: 'Trả hàng' },
    ],
  },
  {
    key: 'crm',
    label: 'Khách hàng / CRM',
    children: [
      { key: 'view_crm', label: 'Xem khách hàng / CRM' },
    ],
  },
  {
    key: 'suppliers',
    label: 'Nhà cung cấp',
    children: [
      { key: 'view_suppliers', label: 'Xem nhà cung cấp' },
    ],
  },
  {
    key: 'debt',
    label: 'Công nợ',
    children: [
      { key: 'view_debt', label: 'Xem công nợ' },
    ],
  },
  {
    key: 'reports',
    label: 'Báo cáo',
    children: [
      { key: 'view_reports', label: 'Xem báo cáo' },
    ],
  },
  {
    key: 'branch_management',
    label: 'Quản lý chi nhánh',
    children: [
      { key: 'manage_branches', label: 'Quản lý chi nhánh' },
    ],
  },
  {
    key: 'user_management',
    label: 'Quản lý người dùng',
    children: [
      { key: 'manage_users', label: 'Quản lý người dùng' },
    ],
  },
  {
    key: 'audit',
    label: 'Lịch sử thao tác',
    children: [
      { key: 'view_audit_logs', label: 'Xem lịch sử thao tác' },
    ],
  },
  {
    key: 'website',
    label: 'Website bán hàng',
    children: [
      { key: 'view_website', label: 'Website bán hàng' },
    ],
  },
  {
    key: 'social',
    label: 'Mạng xã hội',
    children: [
      { key: 'view_social', label: 'Mạng xã hội' },
    ],
  },
  {
    key: 'app',
    label: 'Ứng dụng',
    children: [
      { key: 'view_app', label: 'Ứng dụng' },
    ],
  },
  {
    key: 'subscription',
    label: 'Gói dịch vụ',
    children: [
      { key: 'view_subscription', label: 'Gói dịch vụ' },
    ],
  },
  {
    key: 'guide',
    label: 'Hướng dẫn',
    children: [
      { key: 'view_guide', label: 'Hướng dẫn' },
    ],
  },
  {
    key: 'settings',
    label: 'Cài đặt',
    children: [
      { key: 'view_settings', label: 'Cài đặt' },
    ],
  },
  {
    key: 'cross_branch',
    label: 'Quyền chi nhánh',
    children: [
      { key: 'view_other_branches', label: 'Cho phép xem hàng hóa chi nhánh khác', description: 'Không tick → chỉ thấy dữ liệu chi nhánh hiện tại' },
    ],
  },
];

/** All permission keys as a flat list */
export const ALL_PERMISSION_KEYS = PERMISSION_CATEGORIES.flatMap(cat =>
  cat.children.map(c => c.key)
);

export type PermissionMap = Record<string, boolean>;

/** Get default permission map for a given role */
export function getDefaultPermissionsForRole(role: string): PermissionMap {
  switch (role) {
    case 'super_admin':
      return Object.fromEntries(ALL_PERMISSION_KEYS.map(k => [k, true]));

    case 'branch_admin':
      return {
        view_products: true,
        view_import_price: true,
        view_sale_price: true,
        view_inventory: true,
        view_inventory_import_price: true,
        view_warranty: true,
        view_stock_check: true,
        create_import: true,
        view_import_history: true,
        view_import_history_price: true,
        transfer_stock: true,
        create_export: true,
        view_export_history: true,
        view_export_customer_info: true,
        create_return: true,
        view_crm: true,
        view_suppliers: true,
        view_debt: true,
        view_reports: true,
        manage_branches: false,
        manage_users: false,
        view_audit_logs: true,
        view_website: true,
        view_social: true,
        view_app: true,
        view_subscription: false,
        view_guide: true,
        view_settings: true,
        view_other_branches: false,
      };

    case 'cashier':
      return {
        view_products: true,
        view_import_price: true,
        view_sale_price: true,
        view_inventory: true,
        view_inventory_import_price: true,
        view_warranty: true,
        view_stock_check: true,
        create_import: false,
        view_import_history: true,
        view_import_history_price: true,
        transfer_stock: false,
        create_export: false,
        view_export_history: true,
        view_export_customer_info: true,
        create_return: false,
        view_crm: true,
        view_suppliers: true,
        view_debt: true,
        view_reports: true,
        manage_branches: false,
        manage_users: false,
        view_audit_logs: false,
        view_website: false,
        view_social: false,
        view_app: false,
        view_subscription: false,
        view_guide: true,
        view_settings: false,
        view_other_branches: false,
      };

    case 'staff':
    default:
      return {
        view_products: true,
        view_import_price: false,
        view_sale_price: true,
        view_inventory: true,
        view_inventory_import_price: false,
        view_warranty: false,
        view_stock_check: false,
        create_import: false,
        view_import_history: false,
        view_import_history_price: false,
        transfer_stock: false,
        create_export: true,
        view_export_history: true,
        view_export_customer_info: true,
        create_return: false,
        view_crm: true,
        view_suppliers: false,
        view_debt: false,
        view_reports: false,
        manage_branches: false,
        manage_users: false,
        view_audit_logs: false,
        view_website: false,
        view_social: false,
        view_app: false,
        view_subscription: false,
        view_guide: true,
        view_settings: false,
        view_other_branches: false,
      };
  }
}
