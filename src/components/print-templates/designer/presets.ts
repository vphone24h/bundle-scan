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

/**
 * Full-page preset templates — load all elements at once to fill the entire page.
 */
export const FULL_PAGE_PRESETS: { name: string; description: string; elements: Omit<TemplateElement, 'id'>[] }[] = [
  {
    name: 'Hoá đơn ĐTDĐ + Bảo hành',
    description: 'Mẫu cửa hàng điện thoại có chính sách bảo hành',
    elements: [
      // ─── HEADER ───
      { type: 'image', x: 3, y: 1, w: 18, h: 9, imageUrl: '' }, // Logo placeholder
      { type: 'dynamic', x: 22, y: 1, w: 60, h: 5, field: 'store_name', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
      { type: 'dynamic', x: 22, y: 5, w: 60, h: 3, field: 'store_address', fontSize: 9, textAlign: 'center' },
      { type: 'dynamic', x: 22, y: 8, w: 60, h: 3, field: 'store_phone', fontSize: 9, textAlign: 'center' },
      { type: 'dynamic', x: 130, y: 1, w: 65, h: 4, field: 'staff_name', fontSize: 10, textAlign: 'right' },
      { type: 'dynamic', x: 130, y: 5, w: 65, h: 4, field: 'location_name', fontSize: 10, textAlign: 'right' },

      // ─── TITLE ───
      { type: 'line', x: 3, y: 12, w: 194, h: 1 },
      { type: 'text', x: 5, y: 13, w: 190, h: 5, content: 'HOÁ ĐƠN BÁN HÀNG KIỂM BẢO HÀNH', fontSize: 16, fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' },
      { type: 'line', x: 3, y: 18, w: 194, h: 1 },

      // ─── CUSTOMER INFO ───
      { type: 'dynamic', x: 5, y: 20, w: 95, h: 4, field: 'customer_name', fontSize: 11, fontWeight: 'bold' },
      { type: 'dynamic', x: 100, y: 20, w: 95, h: 4, field: 'customer_phone', fontSize: 11 },
      { type: 'dynamic', x: 5, y: 24, w: 95, h: 4, field: 'billing_address', fontSize: 11 },
      { type: 'dynamic', x: 100, y: 24, w: 95, h: 4, field: 'created_on', fontSize: 11, textAlign: 'right' },

      // ─── PRODUCT TABLE ───
      {
        type: 'table', x: 3, y: 29, w: 194, h: 15,
        tableColumns: [
          { label: 'STT', field: 'line_stt', width: 7 },
          { label: 'IMEI máy', field: 'serials', width: 22 },
          { label: 'Tên sản phẩm', field: 'line_variant', width: 38 },
          { label: 'Đơn giá', field: 'line_price', width: 16 },
          { label: 'Thành tiền', field: 'line_amount', width: 17 },
        ],
      },

      // ─── TOTAL ───
      { type: 'dynamic', x: 100, y: 45, w: 95, h: 5, field: 'total', fontSize: 14, fontWeight: 'bold', textAlign: 'right' },

      // ─── WARRANTY POLICY LEFT ───
      { type: 'text', x: 3, y: 51, w: 95, h: 4, content: 'CHÍNH SÁCH BẢO HÀNH MÁY CŨ TẠI VKHO', fontSize: 10, fontWeight: 'bold' },
      { type: 'text', x: 3, y: 55, w: 95, h: 20, content: 'KHI MUA HÀNG TẠI SHOP SẼ NHẬN NGAY GÓI QUÀ TẶNG TRỊ GIÁ 500K, BAO GỒM:\n- 6 tháng 1 đổi 1 tất cả lỗi của máy phát sinh, bảo quốc tế vĩnh viễn, phần mềm trọn đời\n- BẢO HÀNH CẢ: MÀN HÌNH, NGUỒN, FACE ID - Lỗi là đổi\n- Bảo hành toàn diện máy như: camera, main, loa, mic, chuông, rung, và các thiết bị ngoại vi khác.\n- Tặng dán cường lực màn hình – bảo hành trọn đời\n- Phụ kiện sạc cáp, bảo hành trọn đời máy', fontSize: 8 },

      // ─── WARRANTY POLICY RIGHT ───
      { type: 'text', x: 100, y: 51, w: 95, h: 4, content: 'CHÍNH SÁCH BẢO HÀNH MÁY MỚI 100% TẠI VKHO', fontSize: 10, fontWeight: 'bold' },
      { type: 'text', x: 100, y: 55, w: 95, h: 20, content: '- Lỗi đổi mới đập hộp trong 30 ngày tại shop.\n- Máy Chính Hãng VN Bảo Hành 1 Năm Theo Apple Không tốn phí gì cả\n- Máy Mỹ Bảo Hành 1 Năm Apple, tốn phí vận chuyển máy sang Mỹ\n- Gói Bảo Hành Vip bảo hành 1 năm 1 đổi 1 lỗi là đổi! đối với máy mới.\n- 1 Đổi 1 Tất cả lỗi đổi máy cùng tình trạng máy hiện tại', fontSize: 8 },

      // ─── NOTES ───
      { type: 'line', x: 3, y: 76, w: 194, h: 1 },
      { type: 'text', x: 3, y: 77, w: 194, h: 8, content: 'Lưu ý: Quý khách vui lòng kiểm tra phụ kiện, màn hình, ngoại hình, phiếu bảo hành máy trước khi ra về.\nCamera đi Bar, Club quay vào Laser gây ra camera bị tím sẽ không được bảo hành.\nTừ chối máy vô nước, giận người yêu đập chơi...\nTừ chối các trường hợp liên quan đến mất tài khoản, mật khẩu iCloud', fontSize: 8, fontStyle: 'italic' },

      // ─── CONTACT ───
      { type: 'text', x: 3, y: 85, w: 194, h: 4, content: 'MỌI THÔNG TIN KHIẾU NẠI KHÁCH LIÊN HỆ Call & Zalo: 0909 999 888', fontSize: 10, fontWeight: 'bold', textAlign: 'center' },

      // ─── SIGNATURES ───
      { type: 'line', x: 3, y: 89, w: 194, h: 1 },
      { type: 'text', x: 10, y: 90, w: 40, h: 4, content: 'Người mua hàng', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
      { type: 'text', x: 120, y: 90, w: 40, h: 4, content: 'Người bán hàng', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
      { type: 'text', x: 10, y: 94, w: 40, h: 3, content: '(Ký và ghi rõ họ tên)', fontSize: 9, fontStyle: 'italic', textAlign: 'center' },
      { type: 'text', x: 120, y: 94, w: 40, h: 3, content: '(Ký và ghi rõ họ tên)', fontSize: 9, fontStyle: 'italic', textAlign: 'center' },
    ],
  },
  {
    name: 'Hoá đơn bán lẻ cơ bản',
    description: 'Mẫu đơn giản cho bán lẻ tổng hợp',
    elements: [
      // ─── HEADER ───
      { type: 'image', x: 3, y: 1, w: 18, h: 9, imageUrl: '' },
      { type: 'dynamic', x: 22, y: 2, w: 60, h: 5, field: 'store_name', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
      { type: 'dynamic', x: 22, y: 7, w: 60, h: 3, field: 'store_address', fontSize: 9, textAlign: 'center' },
      { type: 'dynamic', x: 22, y: 10, w: 60, h: 3, field: 'store_phone', fontSize: 9, textAlign: 'center' },

      // ─── TITLE ───
      { type: 'line', x: 3, y: 14, w: 194, h: 1 },
      { type: 'text', x: 5, y: 15, w: 190, h: 5, content: 'HOÁ ĐƠN BÁN HÀNG', fontSize: 18, fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' },

      // ─── ORDER + CUSTOMER ───
      { type: 'dynamic', x: 5, y: 22, w: 90, h: 4, field: 'invoice_code', fontSize: 11 },
      { type: 'dynamic', x: 100, y: 22, w: 95, h: 4, field: 'created_on', fontSize: 11, textAlign: 'right' },
      { type: 'dynamic', x: 5, y: 26, w: 90, h: 4, field: 'customer_name', fontSize: 11, fontWeight: 'bold' },
      { type: 'dynamic', x: 100, y: 26, w: 95, h: 4, field: 'customer_phone', fontSize: 11, textAlign: 'right' },
      { type: 'dynamic', x: 5, y: 30, w: 120, h: 4, field: 'billing_address', fontSize: 11 },
      { type: 'dynamic', x: 140, y: 30, w: 55, h: 4, field: 'staff_name', fontSize: 11, textAlign: 'right' },

      // ─── TABLE ───
      {
        type: 'table', x: 3, y: 35, w: 194, h: 25,
        tableColumns: [
          { label: 'STT', field: 'line_stt', width: 7 },
          { label: 'Tên sản phẩm', field: 'line_variant', width: 45 },
          { label: 'SL', field: 'line_qty', width: 8 },
          { label: 'Đơn giá', field: 'line_price', width: 18 },
          { label: 'Thành tiền', field: 'line_amount', width: 22 },
        ],
      },

      // ─── TOTALS ───
      { type: 'dynamic', x: 100, y: 62, w: 95, h: 4, field: 'discount', fontSize: 11, textAlign: 'right' },
      { type: 'dynamic', x: 100, y: 66, w: 95, h: 5, field: 'total', fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
      { type: 'dynamic', x: 100, y: 71, w: 95, h: 4, field: 'paid_amount', fontSize: 11, textAlign: 'right' },
      { type: 'dynamic', x: 100, y: 75, w: 95, h: 4, field: 'debt', fontSize: 11, textAlign: 'right' },

      // ─── NOTE ───
      { type: 'text', x: 5, y: 80, w: 190, h: 4, content: 'Cảm ơn quý khách đã mua hàng!', fontSize: 12, fontStyle: 'italic', textAlign: 'center' },

      // ─── SIGNATURES ───
      { type: 'line', x: 3, y: 85, w: 194, h: 1 },
      { type: 'text', x: 10, y: 87, w: 40, h: 4, content: 'Người mua hàng', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
      { type: 'text', x: 120, y: 87, w: 40, h: 4, content: 'Người bán hàng', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
      { type: 'text', x: 10, y: 91, w: 40, h: 3, content: '(Ký và ghi rõ họ tên)', fontSize: 9, fontStyle: 'italic', textAlign: 'center' },
      { type: 'text', x: 120, y: 91, w: 40, h: 3, content: '(Ký và ghi rõ họ tên)', fontSize: 9, fontStyle: 'italic', textAlign: 'center' },
    ],
  },
];
