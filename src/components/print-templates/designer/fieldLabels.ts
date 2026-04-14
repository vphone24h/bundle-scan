/**
 * Default display labels for dynamic fields.
 * Fields listed here will auto-prepend the label when added to a template.
 * Fields NOT listed (like store_name) are typically standalone and don't need a prefix.
 */
export const DEFAULT_FIELD_LABELS: Record<string, string> = {
  // Customer
  customer_name: 'Tên Khách hàng: ',
  customer_phone: 'Điện Thoại: ',
  billing_address: 'Địa chỉ: ',
  customer_code: 'Mã KH: ',
  customer_group: 'Nhóm KH: ',
  customer_debt: 'Nợ hiện tại: ',
  debt_before: 'Nợ trước mua: ',
  customer_email: 'Email KH: ',
  // Order
  invoice_code: 'Mã đơn: ',
  created_on: 'Ngày: ',
  created_on_time: 'Thời gian: ',
  modified_on: 'Cập nhật: ',
  staff_name: 'Nhân viên bán hàng: ',
  assignee_name: 'Người phụ trách: ',
  source: 'Nguồn đơn: ',
  order_note: 'Ghi chú: ',
  warranty_number: 'Bảo Hành: ',
  // Store
  store_phone: 'ĐT: ',
  store_address: 'ĐC: ',
  store_email: 'Email: ',
  store_province: 'Tỉnh thành: ',
  // Branch
  location_address: 'ĐC chi nhánh: ',
  location_phone: 'ĐT chi nhánh: ',
  location_province: 'Tỉnh thành: ',
  // Shipping
  shipping_name: 'Người nhận: ',
  shipping_phone: 'SĐT người nhận: ',
  shipping_address: 'ĐC giao hàng: ',
  ship_date: 'Ngày giao: ',
  // Totals
  total: 'TỔNG CỘNG: ',
  subtotal: 'Tạm tính: ',
  paid_amount: 'Đã thanh toán: ',
  debt: 'Còn nợ: ',
  discount: 'Giảm giá: ',
  total_quantity: 'Tổng SL: ',
  payment_method: 'Thanh toán: ',
};

/** Get default label for a field key, or empty string if none */
export function getDefaultFieldLabel(key: string): string {
  return DEFAULT_FIELD_LABELS[key] || '';
}
