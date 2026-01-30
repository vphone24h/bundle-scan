import { Category, Supplier, Product, ImportReceipt, PaperTemplate, DashboardStats } from '@/types/warehouse';

// Categories with hierarchy
export const mockCategories: Category[] = [
  { id: '1', name: 'Điện thoại', createdAt: new Date('2024-01-01') },
  { id: '2', name: 'iPhone', parentId: '1', createdAt: new Date('2024-01-01') },
  { id: '3', name: 'Samsung', parentId: '1', createdAt: new Date('2024-01-01') },
  { id: '4', name: 'Xiaomi', parentId: '1', createdAt: new Date('2024-01-01') },
  { id: '5', name: 'Phụ kiện', createdAt: new Date('2024-01-02') },
  { id: '6', name: 'Ốp lưng', parentId: '5', createdAt: new Date('2024-01-02') },
  { id: '7', name: 'Sạc & Cáp', parentId: '5', createdAt: new Date('2024-01-02') },
  { id: '8', name: 'Tai nghe', parentId: '5', createdAt: new Date('2024-01-02') },
  { id: '9', name: 'Laptop', createdAt: new Date('2024-01-03') },
  { id: '10', name: 'Trang sức', createdAt: new Date('2024-01-04') },
];

// Suppliers
export const mockSuppliers: Supplier[] = [
  { id: '1', name: 'Apple Việt Nam', phone: '0901234567', address: '123 Nguyễn Huệ, Q1, HCM', createdAt: new Date('2024-01-01') },
  { id: '2', name: 'Samsung Electronics', phone: '0912345678', address: '456 Lê Lợi, Q1, HCM', createdAt: new Date('2024-01-01') },
  { id: '3', name: 'Xiaomi Official', phone: '0923456789', address: '789 Trần Hưng Đạo, Q5, HCM', createdAt: new Date('2024-01-02') },
  { id: '4', name: 'Phụ kiện Thành Đạt', phone: '0934567890', address: '321 Hai Bà Trưng, Q3, HCM', createdAt: new Date('2024-01-03') },
  { id: '5', name: 'Công ty Vàng Bạc ABC', phone: '0945678901', address: '654 Lê Văn Sỹ, Q3, HCM', createdAt: new Date('2024-01-04') },
];

// Products
export const mockProducts: Product[] = [
  { id: '1', name: 'iPhone 15 Pro Max 256GB', sku: 'IP15PM256', imei: '353456789012345', categoryId: '2', categoryName: 'iPhone', importPrice: 28000000, importDate: new Date('2024-01-15'), supplierId: '1', supplierName: 'Apple Việt Nam', status: 'in_stock' },
  { id: '2', name: 'iPhone 15 Pro Max 256GB', sku: 'IP15PM256', imei: '353456789012346', categoryId: '2', categoryName: 'iPhone', importPrice: 28000000, importDate: new Date('2024-01-15'), supplierId: '1', supplierName: 'Apple Việt Nam', status: 'sold' },
  { id: '3', name: 'iPhone 14 Pro 128GB', sku: 'IP14P128', imei: '353456789012347', categoryId: '2', categoryName: 'iPhone', importPrice: 22000000, importDate: new Date('2024-01-16'), supplierId: '1', supplierName: 'Apple Việt Nam', status: 'in_stock' },
  { id: '4', name: 'Samsung Galaxy S24 Ultra', sku: 'SGS24U', imei: '354567890123456', categoryId: '3', categoryName: 'Samsung', importPrice: 25000000, importDate: new Date('2024-01-17'), supplierId: '2', supplierName: 'Samsung Electronics', status: 'in_stock' },
  { id: '5', name: 'Xiaomi 14 Ultra', sku: 'XM14U', imei: '355678901234567', categoryId: '4', categoryName: 'Xiaomi', importPrice: 18000000, importDate: new Date('2024-01-18'), supplierId: '3', supplierName: 'Xiaomi Official', status: 'in_stock' },
  { id: '6', name: 'Ốp lưng iPhone 15 Pro Max', sku: 'OL15PM001', categoryId: '6', categoryName: 'Ốp lưng', importPrice: 150000, importDate: new Date('2024-01-19'), supplierId: '4', supplierName: 'Phụ kiện Thành Đạt', status: 'in_stock' },
  { id: '7', name: 'Sạc nhanh 65W USB-C', sku: 'SC65W001', categoryId: '7', categoryName: 'Sạc & Cáp', importPrice: 350000, importDate: new Date('2024-01-19'), supplierId: '4', supplierName: 'Phụ kiện Thành Đạt', status: 'in_stock' },
  { id: '8', name: 'AirPods Pro 2', sku: 'APP2001', imei: '356789012345678', categoryId: '8', categoryName: 'Tai nghe', importPrice: 5500000, importDate: new Date('2024-01-20'), supplierId: '1', supplierName: 'Apple Việt Nam', status: 'in_stock' },
  { id: '9', name: 'Nhẫn vàng 18K', sku: 'NV18K001', categoryId: '10', categoryName: 'Trang sức', importPrice: 8500000, importDate: new Date('2024-01-21'), supplierId: '5', supplierName: 'Công ty Vàng Bạc ABC', status: 'in_stock' },
  { id: '10', name: 'Dây chuyền bạc 925', sku: 'DCB925001', categoryId: '10', categoryName: 'Trang sức', importPrice: 1200000, importDate: new Date('2024-01-21'), supplierId: '5', supplierName: 'Công ty Vàng Bạc ABC', status: 'in_stock' },
];

// Import receipts
export const mockImportReceipts: ImportReceipt[] = [
  {
    id: '1',
    code: 'PN20240115001',
    importDate: new Date('2024-01-15'),
    items: [
      { id: '1', productName: 'iPhone 15 Pro Max 256GB', sku: 'IP15PM256', imei: '353456789012345', categoryId: '2', categoryName: 'iPhone', importPrice: 28000000, quantity: 1, supplierId: '1', supplierName: 'Apple Việt Nam' },
      { id: '2', productName: 'iPhone 15 Pro Max 256GB', sku: 'IP15PM256', imei: '353456789012346', categoryId: '2', categoryName: 'iPhone', importPrice: 28000000, quantity: 1, supplierId: '1', supplierName: 'Apple Việt Nam' },
    ],
    totalAmount: 56000000,
    paidAmount: 50000000,
    debtAmount: 6000000,
    payments: [{ type: 'cash', amount: 30000000 }, { type: 'bank_card', amount: 20000000 }],
    supplierId: '1',
    supplierName: 'Apple Việt Nam',
    createdBy: 'Nguyễn Văn A',
    status: 'completed',
  },
  {
    id: '2',
    code: 'PN20240116001',
    importDate: new Date('2024-01-16'),
    items: [
      { id: '3', productName: 'iPhone 14 Pro 128GB', sku: 'IP14P128', imei: '353456789012347', categoryId: '2', categoryName: 'iPhone', importPrice: 22000000, quantity: 1, supplierId: '1', supplierName: 'Apple Việt Nam' },
    ],
    totalAmount: 22000000,
    paidAmount: 22000000,
    debtAmount: 0,
    payments: [{ type: 'bank_card', amount: 22000000 }],
    supplierId: '1',
    supplierName: 'Apple Việt Nam',
    createdBy: 'Nguyễn Văn A',
    status: 'completed',
  },
  {
    id: '3',
    code: 'PN20240119001',
    importDate: new Date('2024-01-19'),
    items: [
      { id: '6', productName: 'Ốp lưng iPhone 15 Pro Max', sku: 'OL15PM001', categoryId: '6', categoryName: 'Ốp lưng', importPrice: 150000, quantity: 10, supplierId: '4', supplierName: 'Phụ kiện Thành Đạt' },
      { id: '7', productName: 'Sạc nhanh 65W USB-C', sku: 'SC65W001', categoryId: '7', categoryName: 'Sạc & Cáp', importPrice: 350000, quantity: 5, supplierId: '4', supplierName: 'Phụ kiện Thành Đạt' },
    ],
    totalAmount: 500000,
    paidAmount: 500000,
    debtAmount: 0,
    payments: [{ type: 'cash', amount: 500000 }],
    supplierId: '4',
    supplierName: 'Phụ kiện Thành Đạt',
    createdBy: 'Trần Thị B',
    status: 'completed',
  },
];

// Paper templates for barcode printing
export const mockPaperTemplates: PaperTemplate[] = [
  {
    id: '1',
    name: 'Giấy cuộn 3 nhãn',
    description: 'Phù hợp với máy in nhiệt cầm tay và để bàn',
    size: '104 x 22 mm',
    labelCount: 3,
    dimensions: { width: 104, height: 22, unit: 'mm' },
    image: 'paper-template-1',
  },
  {
    id: '2',
    name: 'Giấy cuộn 2 nhãn (72mm)',
    description: 'Khổ nhỏ, tiết kiệm, phù hợp sản phẩm nhỏ',
    size: '72 x 22 mm',
    labelCount: 2,
    dimensions: { width: 72, height: 22, unit: 'mm' },
    image: 'paper-template-2',
  },
  {
    id: '3',
    name: 'Giấy cuộn 2 nhãn (74mm)',
    description: 'Khổ chuẩn cho máy in nhiệt phổ thông',
    size: '74 x 22 mm',
    labelCount: 2,
    dimensions: { width: 74, height: 22, unit: 'mm' },
    image: 'paper-template-3',
  },
  {
    id: '4',
    name: 'Mẫu giấy 12 nhãn',
    description: 'Tomy 103 - Phù hợp in hàng loạt trên máy in laser/inkjet',
    size: '202 x 162 mm',
    labelCount: 12,
    dimensions: { width: 202, height: 162, unit: 'mm' },
    image: 'paper-template-4',
  },
  {
    id: '5',
    name: 'Mẫu giấy 65 nhãn',
    description: 'A4 Tomy 145 - In số lượng lớn, tiết kiệm chi phí',
    size: 'A4 (210 x 297 mm)',
    labelCount: 65,
    dimensions: { width: 210, height: 297, unit: 'mm' },
    image: 'paper-template-5',
  },
  {
    id: '6',
    name: 'Tem hàng trang sức',
    description: 'Nhãn nhỏ, phù hợp gắn lên nhẫn, dây chuyền, lắc',
    size: '75 x 10 mm',
    labelCount: 1,
    dimensions: { width: 75, height: 10, unit: 'mm' },
    image: 'paper-template-6',
  },
  {
    id: '7',
    name: 'Giấy cuộn 55x30mm (365B)',
    description: 'Tem cuộn tối ưu cho máy in nhiệt KiotViet 365B',
    size: '55 x 30 mm',
    labelCount: 1,
    dimensions: { width: 55, height: 30, unit: 'mm' },
    image: 'paper-template-7',
  },
];

// Dashboard stats
export const mockDashboardStats: DashboardStats = {
  totalProducts: 10,
  inStockProducts: 9,
  soldProducts: 1,
  totalImportValue: 137200000,
  pendingDebt: 6000000,
  totalSuppliers: 5,
  totalCategories: 10,
  recentImports: 3,
};

// Helper function to format currency
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// Helper function to format date
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};
