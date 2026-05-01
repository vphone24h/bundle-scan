export interface TemplateElement {
  id: string;
  type: 'text' | 'image' | 'dynamic' | 'table' | 'line';
  x: number;
  y: number;
  w: number;
  h: number;
  content?: string;
  field?: string;
  /** Label prefix for dynamic fields, e.g. "Tên Khách hàng: " */
  fieldLabel?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  textAlign?: 'left' | 'center' | 'right';
  textTransform?: 'none' | 'uppercase';
  imageUrl?: string;
  tableColumns?: { label: string; field: string; width: number }[];
}

export const GRID_COLS = 200;
export const GRID_ROWS = 100;

export const PAPER_SIZES = {
  A4: { width: 210, height: 297, label: 'A4 (210×297mm)' },
  A5: { width: 148, height: 210, label: 'A5 (148×210mm)' },
};

export const DYNAMIC_FIELDS = [
  { group: 'Cửa hàng', icon: 'Store', fields: [
    { key: 'store_name', label: 'Tên cửa hàng' },
    { key: 'store_phone', label: 'SĐT cửa hàng' },
    { key: 'store_address', label: 'Địa chỉ cửa hàng' },
    { key: 'store_email', label: 'Email cửa hàng' },
    { key: 'store_province', label: 'Tỉnh thành (cửa hàng)' },
    { key: 'store_logo', label: 'Logo cửa hàng' },
  ]},
  { group: 'Chi nhánh', icon: 'Building', fields: [
    { key: 'location_name', label: 'Tên chi nhánh' },
    { key: 'location_address', label: 'Địa chỉ chi nhánh' },
    { key: 'location_phone', label: 'SĐT chi nhánh' },
    { key: 'location_province', label: 'Tỉnh thành (chi nhánh)' },
  ]},
  { group: 'Đơn hàng', icon: 'FileText', fields: [
    { key: 'invoice_code', label: 'Mã đơn hàng' },
    { key: 'created_on', label: 'Ngày tạo' },
    { key: 'created_on_time', label: 'Thời gian tạo' },
    { key: 'modified_on', label: 'Ngày cập nhật' },
    { key: 'staff_name', label: 'Nhân viên bán hàng' },
    { key: 'assignee_name', label: 'Người phụ trách' },
    { key: 'source', label: 'Nguồn đơn' },
    { key: 'order_note', label: 'Ghi chú đơn hàng' },
    { key: 'warranty_number', label: 'Số bảo hành' },
    { key: 'warranty_qr', label: 'QR bảo hành' },
  ]},
  { group: 'Khách hàng', icon: 'User', fields: [
    { key: 'customer_name', label: 'Tên khách hàng' },
    { key: 'customer_phone', label: 'SĐT khách hàng' },
    { key: 'billing_address', label: 'Địa chỉ khách' },
    { key: 'customer_code', label: 'Mã khách hàng' },
    { key: 'customer_group', label: 'Nhóm khách hàng' },
    { key: 'customer_debt', label: 'Nợ hiện tại' },
    { key: 'debt_before', label: 'Nợ trước khi mua' },
    { key: 'customer_email', label: 'Email khách hàng' },
  ]},
  { group: 'Giao hàng', icon: 'Truck', fields: [
    { key: 'shipping_name', label: 'Người nhận' },
    { key: 'shipping_phone', label: 'SĐT người nhận' },
    { key: 'shipping_address', label: 'Địa chỉ giao hàng' },
    { key: 'ship_date', label: 'Ngày hẹn giao hàng' },
  ]},
  { group: 'Tổng tiền', icon: 'DollarSign', fields: [
    { key: 'total', label: 'Tổng tiền' },
    { key: 'subtotal', label: 'Tổng trước giảm giá' },
    { key: 'paid_amount', label: 'Đã thanh toán' },
    { key: 'debt', label: 'Còn nợ' },
    { key: 'discount', label: 'Giảm giá' },
    { key: 'total_quantity', label: 'Tổng số lượng' },
    { key: 'payment_method', label: 'Phương thức thanh toán' },
    { key: 'bank_qr', label: 'QR chuyển khoản' },
  ]},
];

export const TABLE_FIELD_OPTIONS = [
  { key: 'line_stt', label: 'STT' },
  { key: 'line_variant', label: 'Tên SP' },
  { key: 'serials', label: 'IMEI/Serial' },
  { key: 'line_qty', label: 'SL' },
  { key: 'line_price', label: 'Đơn giá' },
  { key: 'line_amount', label: 'Thành tiền' },
  { key: 'line_warranty', label: 'Bảo hành' },
];

export function getFieldLabel(key: string): string {
  for (const g of DYNAMIC_FIELDS) {
    const f = g.fields.find((f) => f.key === key);
    if (f) return f.label;
  }
  return key;
}

let _idCounter = 0;
export const genId = () => `el_${Date.now()}_${++_idCounter}`;
