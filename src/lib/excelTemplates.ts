import * as XLSX from 'xlsx';

export function downloadImportTemplate() {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  
  // Define headers matching import form fields - synced with user's template
  const headers = [
    'IMEI',
    'Tên sản phẩm (*)',
    'SKU (*)',
    'Giá nhập (*)',
    'Ngày nhập',
    'Nhà cung cấp',
    'Chi nhánh',
    'Danh mục (*)',
    'Số lượng (*)',
    'Ghi chú',
  ];

  // Sample data to guide users - matching user's format
  const sampleData = [
    ['354331121643275', 'iPhone16ProMax-256GB-Trắng', 'iPhone16ProMax-256GB-Trắng', 21700000, '28/1/2026', 'Thu Khách', 'Dĩ An', 'iPhone', 1, 'pin 96 sạc 251'],
    ['351572591443554', 'iPhone12ProMax-128GB-Trắng', 'iPhone12ProMax-128GB-Trắng', 7300000, '27/1/2026', 'Thu Khách', 'Dĩ An', 'iPhone', 1, 'PIN 100'],
    ['', 'Ốp lưng iPhone 15 Pro Max', 'OL15PM001', 150000, '', '', '', 'Phụ kiện', 10, 'Ốp silicon trong suốt'],
    ['', 'Sạc nhanh 65W USB-C', 'SC65W001', 350000, '', '', '', 'Phụ kiện', 5, ''],
  ];

  // Create worksheet with headers and sample data
  const wsData = [headers, ...sampleData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 18 }, // IMEI
    { wch: 35 }, // Tên sản phẩm
    { wch: 35 }, // SKU
    { wch: 15 }, // Giá nhập
    { wch: 12 }, // Ngày nhập
    { wch: 18 }, // Nhà cung cấp
    { wch: 15 }, // Chi nhánh
    { wch: 15 }, // Danh mục
    { wch: 10 }, // Số lượng
    { wch: 30 }, // Ghi chú
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Nhập hàng');

  // Create instructions sheet
  const instructionsData = [
    ['HƯỚNG DẪN NHẬP HÀNG TỪ EXCEL'],
    [''],
    ['1. Các trường có dấu (*) là bắt buộc'],
    ['2. IMEI: Chỉ nhập cho sản phẩm có số IMEI (điện thoại, máy tính bảng...). Nếu có IMEI, số lượng tự động = 1'],
    ['3. Tên sản phẩm: Nhập tên đầy đủ của sản phẩm'],
    ['4. SKU: Mã sản phẩm duy nhất trong hệ thống'],
    ['5. Giá nhập: Giá nhập kho của sản phẩm (số nguyên, không có dấu phẩy)'],
    ['6. Ngày nhập: Định dạng DD/MM/YYYY (VD: 28/1/2026). Để trống sẽ lấy ngày hiện tại'],
    ['7. Nhà cung cấp: Tên nhà cung cấp (phải trùng với tên đã có trong hệ thống)'],
    ['8. Chi nhánh: Tên chi nhánh nhập hàng (phải trùng với tên đã có trong hệ thống)'],
    ['9. Danh mục: Phải trùng khớp với tên danh mục đã có trong hệ thống'],
    ['10. Số lượng: Số lượng nhập kho (bỏ qua nếu có IMEI)'],
    ['11. Ghi chú: Thông tin bổ sung về sản phẩm (tuỳ chọn)'],
    [''],
    ['LƯU Ý:'],
    ['- Mỗi dòng IMEI là một sản phẩm riêng biệt'],
    ['- Sản phẩm không có IMEI có thể nhập số lượng > 1'],
    ['- IMEI không được trùng với sản phẩm đang tồn kho'],
    ['- Danh mục, Nhà cung cấp, Chi nhánh phải được tạo trước trong hệ thống'],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions['!cols'] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Hướng dẫn');

  // Download file
  XLSX.writeFile(wb, 'Mau_Nhap_Hang.xlsx');
}
