import * as XLSX from 'xlsx';

export function downloadImportTemplate() {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  
  // Define headers matching import form fields
  const headers = [
    'Tên sản phẩm (*)',
    'SKU (*)',
    'IMEI (nếu có)',
    'Danh mục (*)',
    'Giá nhập (*)',
    'Số lượng (*)',
    'Ghi chú',
  ];

  // Sample data to guide users
  const sampleData = [
    ['iPhone 15 Pro Max 256GB', 'IP15PM256', '353456789012345', 'Điện thoại', 28000000, 1, 'Màu Titan Tự nhiên'],
    ['iPhone 15 Pro Max 256GB', 'IP15PM256', '353456789012346', 'Điện thoại', 28000000, 1, 'Màu Titan Xanh'],
    ['Ốp lưng iPhone 15 Pro Max', 'OL15PM001', '', 'Phụ kiện', 150000, 10, 'Ốp silicon trong suốt'],
    ['Sạc nhanh 65W USB-C', 'SC65W001', '', 'Phụ kiện', 350000, 5, ''],
    ['AirPods Pro 2', 'APP2001', '356789012345678', 'Tai nghe', 5500000, 1, 'Hàng chính hãng'],
  ];

  // Create worksheet with headers and sample data
  const wsData = [headers, ...sampleData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 30 }, // Tên sản phẩm
    { wch: 15 }, // SKU
    { wch: 18 }, // IMEI
    { wch: 15 }, // Danh mục
    { wch: 15 }, // Giá nhập
    { wch: 10 }, // Số lượng
    { wch: 25 }, // Ghi chú
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Nhập hàng');

  // Create instructions sheet
  const instructionsData = [
    ['HƯỚNG DẪN NHẬP HÀNG TỪ EXCEL'],
    [''],
    ['1. Các trường có dấu (*) là bắt buộc'],
    ['2. Tên sản phẩm: Nhập tên đầy đủ của sản phẩm'],
    ['3. SKU: Mã sản phẩm duy nhất trong hệ thống'],
    ['4. IMEI: Chỉ nhập cho sản phẩm có số IMEI (điện thoại, máy tính bảng...). Nếu có IMEI, số lượng tự động = 1'],
    ['5. Danh mục: Phải trùng khớp với tên danh mục đã có trong hệ thống'],
    ['6. Giá nhập: Giá nhập kho của sản phẩm (số nguyên, không có dấu phẩy)'],
    ['7. Số lượng: Số lượng nhập kho (bỏ qua nếu có IMEI)'],
    ['8. Ghi chú: Thông tin bổ sung (tuỳ chọn)'],
    [''],
    ['LƯU Ý:'],
    ['- Mỗi dòng IMEI là một sản phẩm riêng biệt'],
    ['- Sản phẩm không có IMEI có thể nhập số lượng > 1'],
    ['- IMEI không được trùng với sản phẩm đang tồn kho'],
    ['- Danh mục phải được tạo trước trong hệ thống'],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Hướng dẫn');

  // Download file
  XLSX.writeFile(wb, 'Mau_Nhap_Hang.xlsx');
}
