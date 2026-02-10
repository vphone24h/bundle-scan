// Core types for Warehouse Management System

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  children?: Category[];
  createdAt: Date;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  note?: string;
  createdAt: Date;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  imei?: string;
  categoryId: string;
  categoryName?: string;
  importPrice: number;
  salePrice?: number;
  importDate: Date;
  supplierId: string;
  supplierName?: string;
  branchId?: string;
  branchName?: string;
  status: 'in_stock' | 'sold' | 'returned';
  note?: string;
  importReceiptId?: string;
  quantity?: number; // For non-IMEI products
}

export interface ImportReceiptItem {
  id: string;
  productName: string;
  sku: string;
  imei?: string;
  categoryId: string;
  categoryName?: string;
  importPrice: number;
  salePrice?: number; // Giá bán gợi ý (không bắt buộc)
  quantity: number; // Always 1 for IMEI products, can be >1 for non-IMEI
  supplierId: string;
  supplierName?: string;
  note?: string;
}

export interface PaymentSource {
  type: 'cash' | 'bank_card' | 'e_wallet' | 'debt';
  amount: number;
}

export interface ImportReceipt {
  id: string;
  code: string;
  importDate: Date;
  items: ImportReceiptItem[];
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  payments: PaymentSource[];
  supplierId: string;
  supplierName?: string;
  createdBy: string;
  note?: string;
  status: 'completed' | 'cancelled';
}

export interface PaperTemplate {
  id: string;
  name: string;
  description: string;
  size: string;
  labelCount: number;
  dimensions: {
    width: number;
    height: number;
    unit: 'mm' | 'inch';
  };
  image?: string;
}

export interface BarcodeSettings {
  showPrice: boolean;
  priceWithVND: boolean;
  showProductName: boolean;
  showStoreName: boolean;
  storeName?: string;
  showCustomDescription: boolean;
  customDescription?: string;
}

// Stats for dashboard
export interface DashboardStats {
  totalProducts: number;
  inStockProducts: number;
  soldProducts: number;
  totalImportValue: number;
  pendingDebt: number;
  totalSuppliers: number;
  totalCategories: number;
  recentImports: number;
}
