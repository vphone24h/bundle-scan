// Audit Log Types và Labels

export interface AuditLog {
  id: string;
  user_id: string | null;
  action_type: string;
  table_name: string | null;
  record_id: string | null;
  branch_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  description: string | null;
  ip_address: string | null;
  created_at: string;
}

// Nhóm thao tác - theo 5 loại nghiệp vụ chính
export type ActionGroup = 
  | 'all' 
  | 'cashbook'      // 1. Sổ quỹ: chỉnh, xóa
  | 'import'        // 2. Nhập hàng, sửa nhập, trả hàng nhập
  | 'export'        // 3. Xuất hàng, sửa xuất, trả hàng xuất
  | 'debt'          // 4. Công nợ: trả nợ NCC, khách trả nợ
  | 'stock_count'   // 5. Kiểm kho
  | 'system';       // Hệ thống (ẩn nếu cần)

export const ACTION_GROUPS: Record<ActionGroup, { label: string; icon: string; tables: string[] }> = {
  all: {
    label: 'Tất cả',
    icon: 'List',
    tables: [],
  },
  cashbook: {
    label: 'Sổ quỹ',
    icon: 'Wallet',
    tables: ['cash_book', 'cash_book_categories'],
  },
  import: {
    label: 'Nhập hàng',
    icon: 'Download',
    tables: ['import_receipts', 'products', 'import_returns', 'receipt_payments', 'stock_transfer_requests'],
  },
  export: {
    label: 'Xuất hàng',
    icon: 'Upload',
    tables: ['export_receipts', 'export_receipt_items', 'export_returns', 'export_receipt_payments', 'return_payments'],
  },
  debt: {
    label: 'Công nợ',
    icon: 'CreditCard',
    tables: ['debt_payments'],
  },
  stock_count: {
    label: 'Kiểm kho',
    icon: 'ClipboardList',
    tables: ['stock_counts', 'stock_count_items'],
  },
  system: {
    label: 'Hệ thống',
    icon: 'Settings',
    tables: ['branches', 'user_roles', 'profiles', 'invoice_templates', 'categories', 'suppliers', 'customers'],
  },
};

// Loại thao tác
export type ActionType = 'create' | 'update' | 'delete' | 'view' | 'login' | 'logout' | 'print' | 'export' | 'adjust';

export const ACTION_LABELS: Record<string, { label: string; color: string; critical?: boolean }> = {
  // Thao tác cơ bản
  create: { label: 'Tạo mới', color: 'bg-green-500' },
  update: { label: 'Cập nhật', color: 'bg-blue-500' },
  delete: { label: 'Xóa', color: 'bg-red-500', critical: true },
  view: { label: 'Xem', color: 'bg-gray-500' },
  login: { label: 'Đăng nhập', color: 'bg-purple-500' },
  logout: { label: 'Đăng xuất', color: 'bg-orange-500' },
  print: { label: 'In', color: 'bg-cyan-500' },
  export: { label: 'Xuất file', color: 'bg-indigo-500' },
  adjust: { label: 'Điều chỉnh', color: 'bg-yellow-600' },
  
  // Thao tác sản phẩm & kho
  ADJUST_QUANTITY: { label: 'Điều chỉnh SL', color: 'bg-yellow-600' },
  RESTORE_PRODUCT_METADATA: { label: 'Phục hồi NCC', color: 'bg-teal-500' },
  UPDATE: { label: 'Cập nhật', color: 'bg-blue-500' },
  CREATE: { label: 'Tạo mới', color: 'bg-green-500' },
  DELETE: { label: 'Xóa', color: 'bg-red-500', critical: true },
  
  // Thao tác nhập/xuất
  IMPORT: { label: 'Nhập hàng', color: 'bg-emerald-500' },
  EXPORT: { label: 'Xuất hàng', color: 'bg-blue-500' },
  RETURN: { label: 'Trả hàng bán', color: 'bg-red-500' },
  IMPORT_RETURN: { label: 'Trả hàng nhập', color: 'bg-orange-500' },
  PAYMENT: { label: 'Thanh toán', color: 'bg-cyan-500' },
  
  // Thao tác kiểm kho
  STOCK_COUNT: { label: 'Kiểm kho', color: 'bg-cyan-500' },
  BALANCE: { label: 'Cân bằng kho', color: 'bg-amber-500' },
  
  // ========== THAO TÁC QUAN TRỌNG (CRITICAL) ==========
  // Xóa sản phẩm
  DELETE_IMEI_PRODUCT: { label: 'Xóa sản phẩm', color: 'bg-red-600', critical: true },
  
  // Xóa phiếu nhập/xuất
  DELETE_IMPORT: { label: 'Xóa phiếu nhập', color: 'bg-red-600', critical: true },
  DELETE_EXPORT: { label: 'Xóa phiếu xuất', color: 'bg-red-600', critical: true },
  DELETE_IMPORT_RECEIPT: { label: 'Xóa phiếu nhập', color: 'bg-red-600', critical: true },
  DELETE_EXPORT_RECEIPT: { label: 'Xóa phiếu xuất', color: 'bg-red-600', critical: true },
  
  // Sổ quỹ - xóa và chỉnh sửa
  DELETE_CASH_BOOK: { label: 'Xóa sổ quỹ', color: 'bg-red-600', critical: true },
  UPDATE_CASH_BOOK: { label: 'Sửa sổ quỹ', color: 'bg-orange-600', critical: true },
  EDIT_CASH_BOOK: { label: 'Sửa sổ quỹ', color: 'bg-orange-600', critical: true },
  TRANSFER_FUNDS: { label: 'Chuyển tiền nội bộ', color: 'bg-indigo-500' },
  
  // Ngưng test / xóa dữ liệu / chế độ test
  DELETE_ALL_WAREHOUSE_DATA: { label: 'Ngưng Test', color: 'bg-gray-600', critical: true },
  ENABLE_TEST_MODE: { label: 'Bật chế độ Test', color: 'bg-yellow-500' },
  DISABLE_TEST_MODE: { label: 'Tắt chế độ Test', color: 'bg-gray-500' },
  SHOW_ALL_DATA: { label: 'Hiện dữ liệu', color: 'bg-teal-500' },
  
  // Chuyển hàng giữa chi nhánh
  TRANSFER_STOCK: { label: 'Chuyển hàng', color: 'bg-violet-500' },
  RECEIVE_STOCK: { label: 'Nhận hàng', color: 'bg-teal-500' },
  APPROVE_TRANSFER: { label: 'Duyệt chuyển hàng', color: 'bg-green-500' },
  REJECT_TRANSFER: { label: 'Từ chối chuyển', color: 'bg-red-500' },
};

// Tên bảng dữ liệu
export const TABLE_LABELS: Record<string, string> = {
  products: 'Sản phẩm',
  categories: 'Danh mục',
  suppliers: 'Nhà cung cấp',
  customers: 'Khách hàng',
  import_receipts: 'Phiếu nhập',
  export_receipts: 'Phiếu xuất',
  export_receipt_items: 'Chi tiết phiếu xuất',
  cash_book: 'Sổ quỹ',
  cash_book_categories: 'Danh mục sổ quỹ',
  branches: 'Chi nhánh',
  user_roles: 'Phân quyền',
  profiles: 'Hồ sơ người dùng',
  import_returns: 'Trả hàng nhập',
  export_returns: 'Trả hàng bán',
  invoice_templates: 'Mẫu hóa đơn',
  receipt_payments: 'Thanh toán nhập',
  return_payments: 'Thanh toán trả hàng',
  export_receipt_payments: 'Thanh toán xuất',
  imei_histories: 'Lịch sử IMEI',
  debt_payments: 'Thanh toán công nợ',
  stock_counts: 'Phiếu kiểm kho',
  stock_count_items: 'Chi tiết kiểm kho',
  stock_transfer_requests: 'Chuyển hàng',
  stock_transfer_items: 'Chi tiết chuyển hàng',
};

// Time filter options
export type TimeFilter = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom' | 'all';

export const TIME_FILTER_LABELS: Record<TimeFilter, string> = {
  all: 'Tất cả',
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  this_week: 'Tuần này',
  last_week: 'Tuần trước',
  this_month: 'Tháng này',
  last_month: 'Tháng trước',
  custom: 'Tùy chọn',
};

// Helper function to get date range
export function getDateRange(filter: TimeFilter, customStart?: Date, customEnd?: Date): { start: Date; end: Date } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (filter) {
    case 'all':
      return null;
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      };
    case 'yesterday':
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      return {
        start: yesterday,
        end: today,
      };
    case 'this_week':
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000);
      return {
        start: startOfWeek,
        end: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      };
    case 'last_week':
      const lastWeekEnd = new Date(today.getTime() - (today.getDay() === 0 ? 6 : today.getDay() - 1) * 24 * 60 * 60 * 1000);
      const lastWeekStart = new Date(lastWeekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      return {
        start: lastWeekStart,
        end: lastWeekEnd,
      };
    case 'this_month':
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: startOfMonth,
        end: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      };
    case 'last_month':
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: startOfLastMonth,
        end: endOfLastMonth,
      };
    case 'custom':
      if (customStart && customEnd) {
        return { start: customStart, end: new Date(customEnd.getTime() + 24 * 60 * 60 * 1000) };
      }
      return null;
    default:
      return null;
  }
}
