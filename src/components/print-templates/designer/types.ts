export interface TemplateElement {
  id: string;
  type: 'text' | 'image' | 'dynamic' | 'table' | 'line';
  x: number;
  y: number;
  w: number;
  h: number;
  content?: string;
  field?: string;
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
  { group: 'Shop', icon: 'Store', fields: [
    { key: 'store_name', label: 'Tên cửa hàng' },
    { key: 'store_phone', label: 'SĐT cửa hàng' },
    { key: 'store_address', label: 'Địa chỉ cửa hàng' },
  ]},
  { group: 'Đơn hàng', icon: 'FileText', fields: [
    { key: 'created_on', label: 'Ngày tạo' },
    { key: 'invoice_code', label: 'Mã hoá đơn' },
    { key: 'staff_name', label: 'Nhân viên' },
    { key: 'location_name', label: 'Chi nhánh' },
  ]},
  { group: 'Khách hàng', icon: 'User', fields: [
    { key: 'customer_name', label: 'Tên khách' },
    { key: 'customer_phone', label: 'SĐT khách' },
    { key: 'billing_address', label: 'Địa chỉ khách' },
  ]},
  { group: 'Tổng tiền', icon: 'DollarSign', fields: [
    { key: 'total', label: 'Tổng tiền' },
    { key: 'paid_amount', label: 'Đã thanh toán' },
    { key: 'debt', label: 'Còn nợ' },
    { key: 'discount', label: 'Giảm giá' },
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
