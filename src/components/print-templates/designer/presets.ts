import type { TemplateElement } from './types';

export const PRESET_BLOCKS: { name: string; icon: string; elements: Omit<TemplateElement, 'id'>[] }[] = [
  {
    name: 'Header (Logo + Shop)',
    icon: 'LayoutTemplate',
    elements: [
      { type: 'dynamic', x: 5, y: 2, w: 90, h: 6, field: 'store_name', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
      { type: 'dynamic', x: 5, y: 8, w: 90, h: 4, field: 'store_address', fontSize: 11, textAlign: 'center' },
      { type: 'dynamic', x: 5, y: 12, w: 90, h: 4, field: 'store_phone', fontSize: 11, textAlign: 'center' },
    ],
  },
  {
    name: 'Thông tin đơn hàng',
    icon: 'FileText',
    elements: [
      { type: 'text', x: 5, y: 20, w: 90, h: 5, content: 'HOÁ ĐƠN BÁN HÀNG', fontSize: 18, fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' },
      { type: 'dynamic', x: 5, y: 26, w: 45, h: 4, field: 'invoice_code', fontSize: 11 },
      { type: 'dynamic', x: 50, y: 26, w: 45, h: 4, field: 'created_on', fontSize: 11, textAlign: 'right' },
      { type: 'dynamic', x: 5, y: 30, w: 45, h: 4, field: 'staff_name', fontSize: 11 },
    ],
  },
  {
    name: 'Thông tin khách hàng',
    icon: 'User',
    elements: [
      { type: 'dynamic', x: 5, y: 36, w: 60, h: 4, field: 'customer_name', fontSize: 12, fontWeight: 'bold' },
      { type: 'dynamic', x: 5, y: 40, w: 45, h: 4, field: 'customer_phone', fontSize: 11 },
      { type: 'dynamic', x: 5, y: 44, w: 90, h: 4, field: 'billing_address', fontSize: 11 },
    ],
  },
  {
    name: 'Bảng sản phẩm',
    icon: 'Table',
    elements: [
      {
        type: 'table', x: 5, y: 50, w: 190, h: 25,
        tableColumns: [
          { label: 'STT', field: 'line_stt', width: 8 },
          { label: 'Tên SP', field: 'line_variant', width: 40 },
          { label: 'SL', field: 'line_qty', width: 10 },
          { label: 'Đơn giá', field: 'line_price', width: 20 },
          { label: 'Thành tiền', field: 'line_amount', width: 22 },
        ],
      },
    ],
  },
  {
    name: 'Tổng tiền',
    icon: 'DollarSign',
    elements: [
      { type: 'dynamic', x: 100, y: 78, w: 90, h: 5, field: 'total', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
    ],
  },
  {
    name: 'Chữ ký',
    icon: 'FileText',
    elements: [
      { type: 'text', x: 5, y: 88, w: 45, h: 4, content: 'Người mua hàng', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
      { type: 'text', x: 100, y: 88, w: 45, h: 4, content: 'Người bán hàng', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
      { type: 'text', x: 5, y: 92, w: 45, h: 3, content: '(Ký, ghi rõ họ tên)', fontSize: 9, textAlign: 'center' },
      { type: 'text', x: 100, y: 92, w: 45, h: 3, content: '(Ký, ghi rõ họ tên)', fontSize: 9, textAlign: 'center' },
    ],
  },
];
