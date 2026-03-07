import { useState, useMemo } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useImportReceipts, useImportReceiptDetails, ImportReceipt } from '@/hooks/useImportReceipts';
import { useAllProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useBranches } from '@/hooks/useBranches';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateRangeApplyFilter } from '@/components/ui/date-range-apply-filter';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Search, Download, FileText, MoreHorizontal, Eye, Pencil, RotateCcw, Loader2, Filter, X, StickyNote, Trash2, Settings2, AlertTriangle, Wrench, ArrowRightLeft, CheckSquare, Square, PlayCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ScrollableTableWrapper } from '@/components/ui/scrollable-table-wrapper';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isToday } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { exportToExcelMultiSheet, formatDateForExcel } from '@/lib/exportExcel';
import { fetchAllRows } from '@/lib/fetchAllRows';
import type { Product } from '@/hooks/useProducts';
import { EditImportReceiptDialog } from '@/components/import/EditImportReceiptDialog';
import { ReturnImportReceiptDialog } from '@/components/import/ReturnImportReceiptDialog';
import { EditProductDialog } from '@/components/import/EditProductDialog';
import { DeleteProductDialog } from '@/components/products/DeleteProductDialog';
import { AdjustQuantityDialog } from '@/components/products/AdjustQuantityDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useMarkProductWarranty } from '@/hooks/useWarrantyInventory';
import { WarrantyNoteDialog } from '@/components/import/WarrantyNoteDialog';
import { ImportInventorySummary } from '@/components/import/ImportInventorySummary';
import { TransferStockDialog } from '@/components/import/TransferStockDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
import { OnboardingTourOverlay, TourStep } from '@/components/onboarding/OnboardingTourOverlay';

const useImportHistoryConstants = () => {
  const { t } = useTranslation();
  return {
    receiptTour: [
      {
        title: t('tours.importHistory.receiptTabTitle'),
        description: t('tours.importHistory.receiptTabDesc'),
        targetSelector: '[data-tour="import-history-receipts-tab"]',
        position: 'bottom' as const,
      },
      {
        title: t('tours.importHistory.menuBtnTitle'),
        description: t('tours.importHistory.menuBtnDesc'),
        targetSelector: '[data-tour="import-receipt-menu"]',
        position: 'left' as const,
      },
    ],
    receiptTourInfo: [
      {
        title: t('tours.importHistory.receiptTabInfoTitle'),
        description: t('tours.importHistory.receiptTabInfoDesc'),
        isInfo: true,
        position: 'center' as const,
      },
    ],
    productTour: [
      {
        title: t('tours.importHistory.productTabTitle'),
        description: t('tours.importHistory.productTabDesc'),
        targetSelector: '[data-tour="import-history-products-tab"]',
        position: 'bottom' as const,
      },
      {
        title: t('tours.importHistory.productActionTitle'),
        description: t('tours.importHistory.productActionDesc'),
        targetSelector: '[data-tour="import-product-actions"]',
        position: 'left' as const,
      },
    ],
    productTourInfo: [
      {
        title: t('tours.importHistory.productTabInfoTitle'),
        description: t('tours.importHistory.productTabInfoDesc'),
        isInfo: true,
        position: 'center' as const,
      },
    ]
  };
};


export default function ImportHistoryPage() {
  const { receiptTour, receiptTourInfo, productTour, productTourInfo } = useImportHistoryConstants();
  const { completeTour } = useOnboardingTour('import_history');
  const { isCompleted: receiptTourDone, completeTour: completeReceiptTour } = useOnboardingTour('import_receipt_tab');
  const { isCompleted: productTourDone, completeTour: completeProductTour } = useOnboardingTour('import_product_tab');
  const [activeTab, setActiveTab] = useState<'receipts' | 'products'>('receipts');
  // Tour: track which tab tour has been shown this session
  const [receiptTabTourSeen, setReceiptTabTourSeen] = useState(false);
  const [productTabTourSeen, setProductTabTourSeen] = useState(false);
  const [activeTour, setActiveTour] = useState<'receipt-tab' | 'product-tab' | null>(null);
  const [manualTourActive, setManualTourActive] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const navigate = useNavigate();
  const { data: receipts, isLoading: receiptsLoading } = useImportReceipts({ pageSize: 500 });

  // Server-side pagination state for products tab
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(100);
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { data: branches } = useBranches();
  const { data: permissions } = usePermissions();
  const markWarranty = useMarkProductWarranty();
  // Fetch staff profiles from import receipts' created_by
  const staffUserIds = useMemo(() => {
    if (!receipts) return [];
    return [...new Set(receipts.map(r => r.created_by).filter(Boolean))] as string[];
  }, [receipts]);
  
  const { data: staffProfiles } = useQuery({
    queryKey: ['staff-profiles-import', staffUserIds],
    queryFn: async () => {
      if (staffUserIds.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', staffUserIds);
      return data || [];
    },
    enabled: staffUserIds.length > 0,
  });

  // Maps for staff name lookup: receipt_id → created_by, created_by → display_name
  const receiptCreatorMap = useMemo(() => {
    const map = new Map<string, string>();
    receipts?.forEach(r => {
      if (r.created_by) map.set(r.id, r.created_by);
    });
    return map;
  }, [receipts]);

  const staffNameMap = useMemo(() => {
    const map = new Map<string, string>();
    staffProfiles?.forEach(p => {
      map.set(p.user_id, p.display_name || 'Nhân viên');
    });
    return map;
  }, [staffProfiles]);

  const getStaffName = (product: Product) => {
    if (!product.import_receipt_id) return '-';
    const createdBy = receiptCreatorMap.get(product.import_receipt_id);
    if (!createdBy) return '-';
    return staffNameMap.get(createdBy) || '-';
  };

  
  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('_all_');
  const [supplierFilter, setSupplierFilter] = useState('_all_');
  const [statusFilter, setStatusFilter] = useState('_all_');
  const [branchFilter, setBranchFilter] = useState('_all_');
  const [showFilters, setShowFilters] = useState(false);

  // Server-side filtered products query
  const productServerFilters = useMemo(() => ({
    search: searchTerm || undefined,
    categoryId: categoryFilter,
    supplierId: supplierFilter,
    branchId: branchFilter,
    status: statusFilter,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page: productPage,
    pageSize: productPageSize,
  }), [searchTerm, categoryFilter, supplierFilter, branchFilter, statusFilter, dateFrom, dateTo, productPage, productPageSize]);

  const { data: products, isLoading: productsLoading, totalCount: productsTotalCount } = useAllProducts(productServerFilters);
  
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const { data: receiptDetails, isLoading: detailsLoading } = useImportReceiptDetails(selectedReceiptId);
  
  // Track products marked for warranty (for instant UI update)
  const [warrantyMarkedIds, setWarrantyMarkedIds] = useState<Set<string>>(new Set());
  
  // Warranty note dialog state
  const [warrantyProduct, setWarrantyProduct] = useState<Product | null>(null);

  // Dialog states for edit and return
  const [editReceipt, setEditReceipt] = useState<ImportReceipt | null>(null);
  const [returnReceipt, setReturnReceipt] = useState<ImportReceipt | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);

  // Multi-select for stock transfer
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [showTransferDialog, setShowTransferDialog] = useState(false);

  // Calculate receipt return status
  const getReceiptReturnStatus = (receipt: ImportReceipt): 'completed' | 'cancelled' | 'full_return' => {
    if (receipt.status === 'cancelled') return 'cancelled';
    
    // Check if all products from this receipt are returned
    const receiptProducts = products?.filter(p => p.import_receipt_id === receipt.id) || [];
    if (receiptProducts.length === 0) return receipt.status as 'completed' | 'cancelled';
    
    const allReturned = receiptProducts.every(p => p.status === 'returned');
    if (allReturned) return 'full_return';
    
    return 'completed';
  };

  // Filter receipts
  const filteredReceipts = useMemo(() => {
    if (!receipts) return [];
    
    return receipts.filter((r) => {
      // Search filter
      const matchesSearch = 
        r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.suppliers?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Date filter
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const receiptDate = startOfDay(new Date(r.import_date));
        if (dateFrom && dateTo) {
          matchesDate = isWithinInterval(receiptDate, {
            start: startOfDay(parseISO(dateFrom)),
            end: endOfDay(parseISO(dateTo))
          });
        } else if (dateFrom) {
          matchesDate = receiptDate >= startOfDay(parseISO(dateFrom));
        } else if (dateTo) {
          matchesDate = receiptDate <= endOfDay(parseISO(dateTo));
        }
      }
      
      // Supplier filter
      const matchesSupplier = supplierFilter === '_all_' || r.supplier_id === supplierFilter;
      
      // Branch filter
      const matchesBranch = branchFilter === '_all_' || r.branch_id === branchFilter;
      
      return matchesSearch && matchesDate && matchesSupplier && matchesBranch;
    });
  }, [receipts, searchTerm, dateFrom, dateTo, supplierFilter, branchFilter]);

  // Products are already server-side filtered & paginated
  const filteredProducts = products || [];
  const productsTotalPages = Math.max(1, Math.ceil(productsTotalCount / productPageSize));

  // Pagination for receipts tab (client-side)
  const receiptsPagination = usePagination(filteredReceipts, { 
    storageKey: 'import-receipts'
  });

  // Server-side pagination wrapper for products tab
  const productsPagination = {
    paginatedData: filteredProducts as Product[],
    currentPage: productPage,
    pageSize: productPageSize,
    totalItems: productsTotalCount,
    totalPages: productsTotalPages,
    setPage: setProductPage,
    setPageSize: (size: number) => { setProductPageSize(size); setProductPage(1); },
    goToFirstPage: () => setProductPage(1),
    goToLastPage: () => setProductPage(productsTotalPages),
    goToNextPage: () => setProductPage(p => Math.min(p + 1, productsTotalPages)),
    goToPreviousPage: () => setProductPage(p => Math.max(1, p - 1)),
    startIndex: (productPage - 1) * productPageSize + 1,
    endIndex: Math.min(productPage * productPageSize, productsTotalCount),
  };

  const handleView = (receipt: ImportReceipt) => {
    setSelectedReceiptId(receipt.id);
  };

  const handleEdit = (receipt: ImportReceipt) => {
    setEditReceipt(receipt);
  };

  const handleReturn = (receipt: ImportReceipt) => {
    setReturnReceipt(receipt);
  };

  const handleReturnProduct = (product: Product) => {
    if (product.status !== 'in_stock') {
      toast({
        title: 'Không thể trả hàng',
        description: 'Sản phẩm này đã bán hoặc đã trả trước đó',
        variant: 'destructive',
      });
      return;
    }
    navigate(`/returns?type=import&productId=${product.id}`);
  };

  const handleWarrantyConfirm = (note: string) => {
    if (!warrantyProduct) return;
    
    setWarrantyMarkedIds(prev => new Set(prev).add(warrantyProduct.id));
    markWarranty.mutate({ 
      productId: warrantyProduct.id, 
      warrantyNote: note 
    }, {
      onSuccess: () => {
        setWarrantyProduct(null);
        // Navigate to warranty tab
        navigate('/inventory?tab=warranty');
      },
      onError: () => {
        // Remove from marked IDs if failed
        setWarrantyMarkedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(warrantyProduct.id);
          return newSet;
        });
        setWarrantyProduct(null);
      }
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setCategoryFilter('_all_');
    setSupplierFilter('_all_');
    setStatusFilter('_all_');
    setBranchFilter('_all_');
    setProductPage(1);
  };

  const hasActiveFilters = dateFrom || dateTo || categoryFilter !== '_all_' || supplierFilter !== '_all_' || statusFilter !== '_all_' || branchFilter !== '_all_';

  // Multi-select helpers for stock transfer
  const toggleProductSelect = (productId: string) => {
    setSelectedProductIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const inStockProducts = useMemo(() => 
    filteredProducts.filter(p => p.status === 'in_stock'),
    [filteredProducts]
  );

  const selectableOnPage = useMemo(() => 
    productsPagination.paginatedData.filter((p: Product) => p.status === 'in_stock'),
    [productsPagination.paginatedData]
  );

  const allPageSelected = selectableOnPage.length > 0 && selectableOnPage.every((p: Product) => selectedProductIds.has(p.id));

  const toggleSelectAllOnPage = () => {
    if (allPageSelected) {
      setSelectedProductIds(prev => {
        const newSet = new Set(prev);
        selectableOnPage.forEach((p: Product) => newSet.delete(p.id));
        return newSet;
      });
    } else {
      setSelectedProductIds(prev => {
        const newSet = new Set(prev);
        selectableOnPage.forEach((p: Product) => newSet.add(p.id));
        return newSet;
      });
    }
  };

  // Get selected products and validate they are from the same branch
  const selectedProducts = useMemo(() => {
    return filteredProducts.filter(p => selectedProductIds.has(p.id) && p.status === 'in_stock');
  }, [filteredProducts, selectedProductIds]);

  const selectedBranchId = useMemo(() => {
    if (selectedProducts.length === 0) return null;
    const branchIds = new Set(selectedProducts.map(p => p.branch_id));
    if (branchIds.size > 1) return 'mixed';
    return selectedProducts[0].branch_id;
  }, [selectedProducts]);

  const selectedBranchName = useMemo(() => {
    if (!selectedBranchId || selectedBranchId === 'mixed') return '';
    return selectedProducts[0]?.branches?.name || '';
  }, [selectedProducts, selectedBranchId]);

  const canTransferStock = permissions?.role === 'super_admin' || permissions?.role === 'branch_admin';

  const handleOpenTransfer = () => {
    if (!canTransferStock) {
      toast({ title: 'Không có quyền', description: 'Chỉ Admin Tổng và Admin Chi nhánh được chuyển hàng', variant: 'destructive' });
      return;
    }
    if (selectedProducts.length === 0) {
      toast({ title: 'Chưa chọn sản phẩm', description: 'Vui lòng chọn ít nhất 1 sản phẩm tồn kho để chuyển', variant: 'destructive' });
      return;
    }
    if (selectedBranchId === 'mixed') {
      toast({ title: 'Không thể chuyển', description: 'Các sản phẩm chọn phải cùng một chi nhánh. Vui lòng bỏ chọn sản phẩm khác chi nhánh.', variant: 'destructive' });
      return;
    }
    if (!selectedBranchId) {
      toast({ title: 'Lỗi', description: 'Sản phẩm chưa được gán chi nhánh', variant: 'destructive' });
      return;
    }
    setShowTransferDialog(true);
  };

  // Export to Excel - Both sheets (Receipts + Products) fetching ALL data from DB
  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      // 1. Fetch ALL import receipts from DB
      const allReceipts = await fetchAllRows<any>(() => {
        let q = supabase
          .from('import_receipts')
          .select(`*, suppliers(name), branches(name)`)
          .order('import_date', { ascending: false });
        if (supplierFilter !== '_all_') q = q.eq('supplier_id', supplierFilter);
        if (branchFilter !== '_all_') q = q.eq('branch_id', branchFilter);
        if (dateFrom) q = q.gte('import_date', dateFrom);
        if (dateTo) q = q.lte('import_date', dateTo + 'T23:59:59');
        return q;
      });

      // 2. Fetch ALL products from DB
      const allProducts = await fetchAllRows<any>(() => {
        let q = supabase
          .from('products')
          .select(`*, categories(name), suppliers(name), branches(name)`)
          .order('import_date', { ascending: false });
        if (categoryFilter !== '_all_') q = q.eq('category_id', categoryFilter);
        if (supplierFilter !== '_all_') q = q.eq('supplier_id', supplierFilter);
        if (branchFilter !== '_all_') q = q.eq('branch_id', branchFilter);
        if (statusFilter !== '_all_') q = q.eq('status', statusFilter as any);
        if (dateFrom) q = q.gte('import_date', dateFrom);
        if (dateTo) q = q.lte('import_date', dateTo + 'T23:59:59');
        return q;
      });

      // 3. Fetch staff names
      const userIds = [...new Set(allReceipts.map((r: any) => r.created_by).filter(Boolean))];
      let allStaffMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);
        if (profiles) profiles.forEach(p => allStaffMap.set(p.user_id, p.display_name || 'Nhân viên'));
      }

      // Build receipt creator map for products
      const receiptCreatorMapAll = new Map<string, string>();
      allReceipts.forEach((r: any) => { if (r.created_by) receiptCreatorMapAll.set(r.id, r.created_by); });

      if (allReceipts.length === 0 && allProducts.length === 0) {
        toast({ title: 'Không có dữ liệu', description: 'Không có dữ liệu nào để xuất', variant: 'destructive' });
        return;
      }

      exportToExcelMultiSheet({
        filename: `Lich_su_nhap_hang_${format(new Date(), 'ddMMyyyy')}`,
        sheets: [
          {
            sheetName: 'Theo phiếu nhập',
            columns: [
              { header: 'STT', key: 'stt', width: 6, isNumeric: true },
              { header: 'Mã phiếu', key: 'code', width: 18 },
              { header: 'Ngày nhập', key: 'import_date', width: 18, format: (v) => formatDateForExcel(v, 'dd/MM/yyyy HH:mm') },
              { header: 'Tổng tiền', key: 'total_amount', width: 15, isNumeric: true },
              { header: 'Đã thanh toán', key: 'paid_amount', width: 15, isNumeric: true },
              { header: 'Còn nợ', key: 'debt_amount', width: 15, isNumeric: true },
              { header: 'Nhà cung cấp', key: 'supplier_name', width: 25 },
              { header: 'Chi nhánh', key: 'branch_name', width: 20 },
              { header: 'Nhân viên', key: 'staff_name', width: 18 },
              { header: 'Ghi chú', key: 'note', width: 30 },
              { header: 'Trạng thái', key: 'status', width: 12, format: (v) => v === 'completed' ? 'Hoàn tất' : 'Đã huỷ' },
            ],
            data: allReceipts.map((r: any, index: number) => ({
              stt: index + 1,
              code: r.code,
              import_date: r.import_date,
              total_amount: r.total_amount,
              paid_amount: r.paid_amount,
              debt_amount: r.debt_amount,
              supplier_name: r.suppliers?.name || '',
              branch_name: r.branches?.name || '',
              staff_name: r.created_by ? (allStaffMap.get(r.created_by) || '') : '',
              note: r.note || '',
              status: r.status,
            })),
          },
          {
            sheetName: 'Theo chi tiết SP',
            columns: [
              { header: 'IMEI', key: 'imei', width: 18 },
              { header: 'Tên sản phẩm', key: 'name', width: 35 },
              { header: 'SKU', key: 'sku', width: 35 },
              { header: 'Giá nhập', key: 'import_price', width: 15, isNumeric: true },
              { header: 'Ngày nhập', key: 'import_date', width: 12, format: (v) => formatDateForExcel(v) },
              { header: 'Nhà cung cấp', key: 'supplier_name', width: 18 },
              { header: 'Chi nhánh', key: 'branch_name', width: 15 },
              { header: 'Thư mục', key: 'category_name', width: 15 },
              { header: 'Số lượng', key: 'quantity', width: 10, isNumeric: true },
              { header: 'Nhân viên nhập', key: 'staff_name', width: 18 },
              { header: 'Ghi chú', key: 'note', width: 30 },
              { header: 'Trạng thái', key: 'status', width: 12, format: (v: string) => v === 'in_stock' ? 'Tồn kho' : v === 'sold' ? 'Đã bán' : v === 'returned' ? 'Đã trả NCC' : v === 'deleted' ? 'Đã xóa' : v },
            ],
            data: allProducts.map((p: any) => ({
              imei: p.imei || '',
              name: p.name,
              sku: p.sku,
              import_price: p.import_price,
              import_date: p.import_date,
              supplier_name: p.suppliers?.name || '',
              branch_name: p.branches?.name || '',
              category_name: p.categories?.name || '',
              quantity: p.quantity || 1,
              staff_name: (() => {
                if (!p.import_receipt_id) return '';
                const createdBy = receiptCreatorMapAll.get(p.import_receipt_id);
                if (!createdBy) return '';
                return allStaffMap.get(createdBy) || '';
              })(),
              note: p.note || '',
              status: p.status,
            })),
          },
        ],
      });

      toast({ title: 'Xuất Excel thành công', description: `Đã xuất ${allReceipts.length} phiếu và ${allProducts.length} sản phẩm` });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Lỗi xuất Excel', description: 'Không thể tải dữ liệu. Vui lòng thử lại.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = receiptsLoading || productsLoading;

  // Shell-first: no spinner, render layout immediately with empty data

  return (
    <MainLayout>
      <PageHeader
        title="Lịch sử nhập hàng"
        description="Theo dõi các phiếu nhập và sản phẩm đã nhập"
        helpText="Xem danh sách tất cả phiếu nhập đã tạo. Có thể lọc theo ngày, nhà cung cấp, trạng thái thanh toán. Nhấn vào phiếu để xem chi tiết sản phẩm, chỉnh sửa hoặc trả hàng."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (activeTab === 'receipts') {
                  setReceiptTabTourSeen(true);
                  setActiveTour('receipt-tab');
                } else {
                  setProductTabTourSeen(true);
                  setActiveTour('product-tab');
                }
              }}
              className="h-8 text-xs sm:text-sm"
            >
              <PlayCircle className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Xem hướng dẫn</span>
              <span className="sm:hidden">Xem HD</span>
            </Button>
            <Button asChild>
              <Link to="/import/new">
                <FileText className="mr-2 h-4 w-4" />
                Tạo phiếu mới
              </Link>
            </Button>
          </div>
        }
      />

      <div className="p-6 lg:p-8 space-y-4">
        {/* Reminder banner */}
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Nhớ xuất file ra Excel mỗi ngày để lưu trữ dữ liệu!
            </p>
            <p className="text-xs opacity-80">
              Dữ liệu được lưu trữ đám mây rất bảo mật, không thể mất được, nhưng hãy nhớ xuất ra Excel mỗi ngày để dễ khôi phục hơn nếu có rủi ro.
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Search row */}
              <div className="flex flex-col sm:flex-row gap-4">
                <SearchInput
                  placeholder="Tìm theo tên sản phẩm, IMEI, mã phiếu..."
                  value={searchTerm}
                  onChange={(v) => { setSearchTerm(v); setProductPage(1); }}
                  containerClassName="flex-1"
                />
                <Button
                  variant={showFilters ? 'secondary' : 'outline'}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Bộ lọc
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                      !
                    </Badge>
                  )}
                </Button>
              </div>

              {/* Extended filters */}
              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 pt-4 border-t">
                  <div className="sm:col-span-2 lg:col-span-3">
                    <DateRangeApplyFilter
                      startDate={dateFrom}
                      endDate={dateTo}
                      onApply={(s, e) => { setDateFrom(s); setDateTo(e); }}
                      isLoading={productsLoading}
                      layout="stacked"
                      labelClassName="text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Danh mục</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả danh mục</SelectItem>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Nhà cung cấp</Label>
                    <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả NCC</SelectItem>
                        {suppliers?.map((sup) => (
                          <SelectItem key={sup.id} value={sup.id}>
                            {sup.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Chi nhánh</Label>
                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả chi nhánh</SelectItem>
                        {branches?.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Trạng thái</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả trạng thái</SelectItem>
                        <SelectItem value="in_stock">Tồn kho</SelectItem>
                        <SelectItem value="sold">Đã bán</SelectItem>
                        <SelectItem value="returned">Đã trả NCC</SelectItem>
                        <SelectItem value="deleted">Đã xóa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
                      <X className="h-4 w-4 mr-1" />
                      Xóa lọc
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => {
          const tab = v as 'receipts' | 'products';
          setActiveTab(tab);
          // Trigger tour: info nếu chưa có data, chi tiết nếu có data
          if (tab === 'receipts' && !receiptTabTourSeen && !receiptTourDone) {
            setReceiptTabTourSeen(true);
            setTimeout(() => setActiveTour('receipt-tab'), 400);
          } else if (tab === 'products' && !productTabTourSeen && !productTourDone) {
            setProductTabTourSeen(true);
            setTimeout(() => setActiveTour('product-tab'), 400);
          }
        }} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="receipts" data-tour="import-history-receipts-tab" className={cn(searchTerm && activeTab !== 'receipts' && filteredReceipts.length > 0 && 'tab-flash-red')}>
                Theo phiếu nhập
              </TabsTrigger>
              <TabsTrigger value="products" data-tour="import-history-products-tab" className={cn(searchTerm && activeTab !== 'products' && productsTotalCount > 0 && 'tab-flash-red')}>
                Theo sản phẩm
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="receipts">
            <div className="flex justify-end mb-4">
              <Button variant="outline" onClick={handleExportAll} disabled={isExporting}>
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {isExporting ? 'Đang tải dữ liệu...' : 'Xuất Excel'}
              </Button>
            </div>
            <ScrollableTableWrapper className="rounded-lg border bg-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Ngày nhập</th>
                    <th className="text-right">Tổng tiền</th>
                    <th className="text-right">Đã thanh toán</th>
                    <th className="text-right">Còn nợ</th>
                    <th>Nhà cung cấp</th>
                    <th>Chi nhánh</th>
                    <th>Nhân viên</th>
                    <th>Ghi chú</th>
                    <th>Trạng thái</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {receiptsPagination.paginatedData.map((receipt) => (
                    <tr key={receipt.id}>
                      <td 
                        className="font-mono font-medium text-primary cursor-pointer hover:underline"
                        onClick={() => handleView(receipt)}
                      >
                        {receipt.code}
                      </td>
                      <td>{formatDate(new Date(receipt.import_date))}</td>
                      <td className="text-right font-medium">{formatCurrency(Number(receipt.total_amount))}</td>
                      <td className="text-right text-success">{formatCurrency(Number(receipt.paid_amount))}</td>
                      <td className="text-right">
                        {Number(receipt.debt_amount) > 0 ? (
                          <span className="text-destructive font-medium">
                            {formatCurrency(Number(receipt.debt_amount))}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{receipt.suppliers?.name || '-'}</td>
                      <td>{receipt.branches?.name || '-'}</td>
                      <td className="text-sm">{receipt.created_by ? (staffNameMap.get(receipt.created_by) || '-') : '-'}</td>
                      <td className="max-w-[150px] truncate" title={receipt.note || ''}>
                        {receipt.note ? (
                          <span className="flex items-center gap-1">
                            <StickyNote className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{receipt.note}</span>
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {(() => {
                          const returnStatus = getReceiptReturnStatus(receipt);
                          return (
                            <Badge
                              className={cn(
                                returnStatus === 'completed'
                                  ? 'status-in-stock'
                                  : returnStatus === 'full_return'
                                  ? 'bg-destructive/10 text-destructive border-destructive/20'
                                  : 'bg-destructive/10 text-destructive border-destructive/20'
                              )}
                            >
                              {returnStatus === 'completed' ? 'Hoàn tất' : returnStatus === 'full_return' ? 'Đã trả' : 'Đã huỷ'}
                            </Badge>
                          );
                        })()}
                      </td>
                      <td>
                        <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" data-tour="import-receipt-menu">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleView(receipt)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Xem chi tiết
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(receipt)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleReturn(receipt)}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Trả hàng
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredReceipts.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  {hasActiveFilters ? 'Không tìm thấy phiếu nhập phù hợp' : 'Chưa có phiếu nhập nào'}
                </div>
              )}
            </ScrollableTableWrapper>
            {filteredReceipts.length > 0 && (
              <TablePagination
                currentPage={receiptsPagination.currentPage}
                totalPages={receiptsPagination.totalPages}
                pageSize={receiptsPagination.pageSize}
                totalItems={receiptsPagination.totalItems}
                startIndex={receiptsPagination.startIndex}
                endIndex={receiptsPagination.endIndex}
                onPageChange={receiptsPagination.setPage}
                onPageSizeChange={receiptsPagination.setPageSize}
              />
            )}
          </TabsContent>

          <TabsContent value="products">
            {/* Tổng hợp giá trị kho hàng nhập */}
            <ImportInventorySummary 
              isFiltered={Boolean(hasActiveFilters) || searchTerm.length > 0}
              filteredProducts={Boolean(hasActiveFilters) || searchTerm.length > 0 ? filteredProducts : undefined}
            />

            {/* Transfer bar + Export */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                {canTransferStock && selectedProductIds.size > 0 && (
                  <>
                    <Badge variant="secondary" className="gap-1">
                      <CheckSquare className="h-3.5 w-3.5" />
                      Đã chọn: {selectedProducts.length}
                    </Badge>
                    {selectedBranchId === 'mixed' && (
                      <Badge variant="destructive" className="text-xs">
                        Khác chi nhánh!
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      onClick={handleOpenTransfer}
                      disabled={selectedBranchId === 'mixed' || selectedProducts.length === 0}
                      className="gap-1.5"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      Chuyển hàng
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedProductIds(new Set())}
                      className="text-xs"
                    >
                      Bỏ chọn tất cả
                    </Button>
                  </>
                )}
              </div>
              <Button variant="outline" onClick={handleExportAll} disabled={isExporting}>
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {isExporting ? 'Đang tải dữ liệu...' : 'Xuất Excel'}
              </Button>
            </div>
            <ScrollableTableWrapper className="rounded-lg border bg-card">
              <table className="data-table">
                <thead>
                  <tr>
                    {canTransferStock && (
                      <th className="w-10">
                        <Checkbox
                          checked={allPageSelected}
                          onCheckedChange={toggleSelectAllOnPage}
                          aria-label="Chọn tất cả trên trang"
                        />
                      </th>
                    )}
                    <th>Tên sản phẩm</th>
                    <th>SKU</th>
                    <th>IMEI</th>
                    <th>Danh mục</th>
                    <th className="text-center">SL</th>
                    <th className="text-right">Giá nhập</th>
                    <th className="text-right">Thành tiền</th>
                    <th>Ngày nhập</th>
                    <th>Nhà cung cấp</th>
                    <th>Chi nhánh</th>
                    <th>Nhân viên nhập</th>
                    <th>Ghi chú</th>
                    <th>Trạng thái</th>
                    <th className="w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {productsPagination.paginatedData.map((product) => (
                    <tr key={product.id} className={cn(canTransferStock && selectedProductIds.has(product.id) && 'bg-primary/5')}>
                      {canTransferStock && (
                        <td>
                          {product.status === 'in_stock' ? (
                            <Checkbox
                              checked={selectedProductIds.has(product.id)}
                              onCheckedChange={() => toggleProductSelect(product.id)}
                              aria-label={`Chọn ${product.name}`}
                            />
                          ) : (
                            <span className="block w-4" />
                          )}
                        </td>
                      )}
                      <td className="font-medium">{product.name}</td>
                      <td className="text-muted-foreground">{product.sku}</td>
                      <td className="font-mono text-sm">{product.imei || '-'}</td>
                      <td>{product.categories?.name || '-'}</td>
                      <td className="text-center font-medium">{product.quantity}</td>
                      <td className="text-right font-medium">
                        {formatCurrency(Number(product.import_price))}
                      </td>
                      <td className="text-right font-medium text-primary">
                        {formatCurrency(Number(product.import_price) * product.quantity)}
                      </td>
                      <td>{formatDate(new Date(product.import_date))}</td>
                      <td>{product.suppliers?.name || '-'}</td>
                      <td>{product.branches?.name || '-'}</td>
                      <td className="text-sm">{getStaffName(product)}</td>
                      <td className="max-w-[120px] truncate" title={product.note || ''}>
                        {product.note ? (
                          <span className="flex items-center gap-1">
                            <StickyNote className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{product.note}</span>
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {product.status === 'deleted' ? (
                          <div className="flex flex-col gap-1">
                            <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                              Đã xóa
                            </Badge>
                            {product.note && (
                              <span className="text-xs text-destructive/80 max-w-[150px] truncate" title={product.note}>
                                {product.note.replace('[ĐÃ XÓA] ', '')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge
                            className={cn(
                              product.status === 'in_stock'
                                ? (!product.imei && product.quantity === 0 ? 'bg-muted text-muted-foreground' : 'status-in-stock')
                                : product.status === 'sold'
                                ? 'status-sold'
                                : 'status-pending'
                            )}
                          >
                            {product.status === 'in_stock'
                              ? (!product.imei && product.quantity === 0 ? 'Hết hàng' : 'Tồn kho')
                              : product.status === 'sold'
                              ? 'Đã bán'
                              : 'Đã trả'}
                          </Badge>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-1" data-tour="import-product-actions">
                          {product.status === 'in_stock' && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setEditProduct(product)}
                                className="h-7 w-7"
                                title="Sửa thông tin"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleReturnProduct(product)}
                                className="h-7 text-xs"
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                Trả
                              </Button>
                               {/* Warranty button - only for IMEI products */}
                               {product.imei && (
                                 <>
                                   {warrantyMarkedIds.has(product.id) ? (
                                     <span className="text-xs text-destructive opacity-60 font-medium">
                                       Đã BH
                                     </span>
                                   ) : (
                                     <Button 
                                       variant="outline" 
                                       size="sm"
                                       onClick={() => setWarrantyProduct(product)}
                                       disabled={markWarranty.isPending}
                                       className="h-7 text-xs gap-1"
                                       title="Chuyển sang bảo hành"
                                     >
                                       <Wrench className="h-3 w-3" />
                                       BH
                                     </Button>
                                   )}
                                 </>
                               )}
                              {/* Adjust quantity - only for non-IMEI products and super_admin */}
                              {!product.imei && permissions?.canAdjustProductQuantity && (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setAdjustProduct(product)}
                                  className="h-7 w-7"
                                  title="Điều chỉnh số lượng"
                                >
                                  <Settings2 className="h-3 w-3" />
                                </Button>
                              )}
                              {/* Transfer button - for admin roles */}
                              {canTransferStock && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedProductIds(new Set([product.id]));
                                    setTimeout(() => setShowTransferDialog(true), 0);
                                  }}
                                  className="h-7 text-xs gap-1"
                                  title="Chuyển sang chi nhánh khác"
                                >
                                  <ArrowRightLeft className="h-3 w-3" />
                                  Chuyển
                                </Button>
                              )}
                               {/* Delete button - only for IMEI products and super_admin */}
                              {product.imei && permissions?.canDeleteIMEIProducts && (
                                 <Button 
                                   variant="ghost" 
                                   size="icon"
                                   onClick={() => setDeleteProduct(product)}
                                   className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                   title="Xóa sản phẩm"
                                 >
                                   <Trash2 className="h-3 w-3" />
                                 </Button>
                               )}
                            </>
                          )}
                          {(product.status === 'warranty' || warrantyMarkedIds.has(product.id)) && product.status !== 'in_stock' && (
                            <span className="text-xs text-destructive opacity-60 font-medium">
                              Đã BH
                            </span>
                          )}
                          {product.status !== 'in_stock' && product.status !== 'warranty' && !warrantyMarkedIds.has(product.id) && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProducts.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  {hasActiveFilters ? 'Không tìm thấy sản phẩm phù hợp' : 'Không có sản phẩm nào'}
                </div>
              )}
            </ScrollableTableWrapper>
            {filteredProducts.length > 0 && (
              <TablePagination
                currentPage={productsPagination.currentPage}
                totalPages={productsPagination.totalPages}
                pageSize={productsPagination.pageSize}
                totalItems={productsPagination.totalItems}
                startIndex={productsPagination.startIndex}
                endIndex={productsPagination.endIndex}
                onPageChange={productsPagination.setPage}
                onPageSizeChange={productsPagination.setPageSize}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Receipt Detail Dialog */}
      <Dialog open={!!selectedReceiptId} onOpenChange={() => setSelectedReceiptId(null)}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg break-all">Chi tiết phiếu nhập {receiptDetails?.receipt?.code}</DialogTitle>
          </DialogHeader>

          {detailsLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : receiptDetails?.receipt && (
            <div className="space-y-4 sm:space-y-6">
              {/* Info */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 text-sm bg-muted/30 rounded-lg p-3 sm:p-4">
                <div>
                  <span className="text-muted-foreground block text-xs">Ngày nhập</span>
                  <span className="font-medium text-sm">
                    {formatDate(new Date(receiptDetails.receipt.import_date))}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Nhà cung cấp</span>
                  <span className="font-medium text-sm truncate block">{receiptDetails.receipt.suppliers?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Chi nhánh</span>
                  <span className="font-medium text-sm truncate block">{receiptDetails.receipt.branches?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Trạng thái</span>
                  <Badge
                    className={cn(
                      'text-xs mt-0.5',
                      receiptDetails.receipt.status === 'completed'
                        ? 'status-in-stock'
                        : 'bg-destructive/10 text-destructive'
                    )}
                  >
                    {receiptDetails.receipt.status === 'completed' ? 'Hoàn tất' : 'Đã huỷ'}
                  </Badge>
                </div>
              </div>

              {/* Products - Mobile Card View & Desktop Table */}
              <div>
                <h4 className="font-semibold mb-3 text-sm sm:text-base">
                  Danh sách sản phẩm ({receiptDetails.productImports?.length || 0} dòng)
                </h4>
                
                {/* Mobile Card View */}
                <div className="sm:hidden space-y-2">
                  {receiptDetails.productImports?.map((item: any, index: number) => (
                    <div key={item.id} className="p-3 border rounded-lg bg-card space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm flex items-center gap-2">
                            <span className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded flex-shrink-0">{index + 1}</span>
                            <span className="truncate">{item.products?.name || 'N/A'}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 font-mono">
                            {item.products?.imei || item.products?.sku || '-'}
                          </div>
                          {item.products?.categories?.name && (
                            <div className="text-xs text-muted-foreground">
                              {item.products.categories.name}
                            </div>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs flex-shrink-0',
                            item.products?.status === 'in_stock'
                              ? 'border-success text-success'
                              : item.products?.status === 'sold'
                              ? 'border-primary text-primary'
                              : item.products?.status === 'deleted'
                              ? 'border-destructive text-destructive bg-destructive/10'
                              : item.products?.status === 'warranty'
                              ? 'border-warning text-warning bg-warning/10'
                              : 'border-amber-500 text-amber-600'
                          )}
                        >
                          {item.products?.status === 'in_stock'
                            ? (!item.products?.imei && (item.products as any)?.quantity === 0 ? 'Hết hàng' : 'Tồn kho')
                            : item.products?.status === 'sold'
                            ? 'Đã bán'
                            : item.products?.status === 'deleted'
                            ? 'Đã xóa'
                            : item.products?.status === 'warranty'
                            ? 'Bảo hành'
                            : 'Đã trả'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-sm pt-2 border-t">
                        <span className="text-muted-foreground">SL: {item.quantity}</span>
                        <span className="font-medium">{formatCurrency(Number(item.import_price) * item.quantity)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">STT</th>
                          <th className="text-left p-3 font-medium">Tên sản phẩm</th>
                          <th className="text-left p-3 font-medium">SKU</th>
                          <th className="text-left p-3 font-medium">IMEI</th>
                          <th className="text-left p-3 font-medium">Danh mục</th>
                          <th className="text-center p-3 font-medium">SL</th>
                          <th className="text-right p-3 font-medium">Đơn giá</th>
                          <th className="text-right p-3 font-medium">Thành tiền</th>
                          <th className="text-center p-3 font-medium">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {receiptDetails.productImports?.map((item: any, index: number) => (
                          <tr key={item.id} className="hover:bg-muted/30">
                            <td className="p-3 text-muted-foreground">{index + 1}</td>
                            <td className="p-3 font-medium">{item.products?.name || 'N/A'}</td>
                            <td className="p-3 font-mono text-xs">{item.products?.sku || '-'}</td>
                            <td className="p-3 font-mono text-xs">
                              {item.products?.imei || <span className="text-muted-foreground">-</span>}
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {item.products?.categories?.name || '-'}
                            </td>
                            <td className="p-3 text-center">{item.quantity}</td>
                            <td className="p-3 text-right font-medium">
                              {formatCurrency(Number(item.import_price))}
                            </td>
                            <td className="p-3 text-right font-medium">
                              {formatCurrency(Number(item.import_price) * item.quantity)}
                            </td>
                            <td className="p-3 text-center">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs',
                                  item.products?.status === 'in_stock'
                                    ? 'border-success text-success'
                                    : item.products?.status === 'sold'
                                    ? 'border-primary text-primary'
                                    : item.products?.status === 'deleted'
                                    ? 'border-destructive text-destructive bg-destructive/10'
                                    : item.products?.status === 'warranty'
                                    ? 'border-warning text-warning bg-warning/10'
                                    : 'border-amber-500 text-amber-600'
                                )}
                              >
                                {item.products?.status === 'in_stock'
                                  ? (!item.products?.imei && (item.products as any)?.quantity === 0 ? 'Hết hàng' : 'Tồn kho')
                                  : item.products?.status === 'sold'
                                  ? 'Đã bán'
                                  : item.products?.status === 'deleted'
                                  ? 'Đã xóa'
                                  : item.products?.status === 'warranty'
                                  ? 'Bảo hành'
                                  : 'Đã trả'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="rounded-lg bg-muted/50 p-3 sm:p-4 space-y-3">
                <h4 className="font-semibold text-sm sm:text-base">Thanh toán</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                  <div className="flex justify-between sm:block text-sm">
                    <span className="text-muted-foreground">Tổng tiền:</span>
                    <span className="sm:ml-2 font-bold sm:text-lg">{formatCurrency(Number(receiptDetails.receipt.total_amount))}</span>
                  </div>
                  <div className="flex justify-between sm:block text-sm">
                    <span className="text-muted-foreground">Đã thanh toán:</span>
                    <span className="sm:ml-2 text-success font-medium sm:text-lg">
                      {formatCurrency(Number(receiptDetails.receipt.paid_amount))}
                    </span>
                  </div>
                  {Number(receiptDetails.receipt.debt_amount) > 0 && (
                    <div className="flex justify-between sm:block text-sm">
                      <span className="text-muted-foreground">Còn nợ:</span>
                      <span className="sm:ml-2 text-destructive font-medium sm:text-lg">
                        {formatCurrency(Number(receiptDetails.receipt.debt_amount))}
                      </span>
                    </div>
                  )}
                </div>
                {receiptDetails.payments && receiptDetails.payments.length > 0 && (
                  <div className="pt-3 border-t text-sm text-muted-foreground flex flex-wrap gap-2 sm:gap-3">
                    <span>Hình thức:</span>
                    {receiptDetails.payments.map((p: any) => (
                      <Badge key={p.id} variant="outline" className="font-normal text-xs">
                        {p.payment_type === 'cash'
                          ? 'Tiền mặt'
                          : p.payment_type === 'bank_card'
                          ? 'Thẻ NH'
                          : p.payment_type === 'e_wallet'
                          ? 'Ví ĐT'
                          : 'Công nợ'}
                        : {formatCurrency(Number(p.amount))}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {receiptDetails.receipt.note && (
                <div className="rounded-lg border p-3 sm:p-4">
                  <h4 className="font-semibold mb-2 text-sm sm:text-base">Ghi chú</h4>
                  <p className="text-sm text-muted-foreground">{receiptDetails.receipt.note}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Receipt Dialog */}
      <EditImportReceiptDialog
        receipt={editReceipt}
        open={!!editReceipt}
        onOpenChange={(open) => !open && setEditReceipt(null)}
      />

      {/* Return Receipt Dialog */}
      <ReturnImportReceiptDialog
        receipt={returnReceipt}
        open={!!returnReceipt}
        onOpenChange={(open) => !open && setReturnReceipt(null)}
      />

      {/* Edit Product Dialog */}
      <EditProductDialog
        product={editProduct}
        open={!!editProduct}
        onOpenChange={(open) => !open && setEditProduct(null)}
      />

      {/* Adjust Quantity Dialog - only for non-IMEI products */}
      {adjustProduct && !adjustProduct.imei && (
        <AdjustQuantityDialog
          open={!!adjustProduct}
          onOpenChange={(open) => !open && setAdjustProduct(null)}
          productId={adjustProduct.id}
          productName={adjustProduct.name}
          sku={adjustProduct.sku}
          currentQuantity={adjustProduct.quantity}
        />
      )}

      {/* Delete Product Dialog - only for IMEI products */}
      {deleteProduct && deleteProduct.imei && (
        <DeleteProductDialog
          open={!!deleteProduct}
          onOpenChange={(open) => !open && setDeleteProduct(null)}
          productId={deleteProduct.id}
          productName={deleteProduct.name}
          sku={deleteProduct.sku}
          imei={deleteProduct.imei}
        />
      )}

      {/* Warranty Note Dialog */}
      <WarrantyNoteDialog
        open={!!warrantyProduct}
        onOpenChange={(open) => !open && setWarrantyProduct(null)}
        onConfirm={handleWarrantyConfirm}
        productName={warrantyProduct?.name}
        isLoading={markWarranty.isPending}
      />

      {/* Transfer Stock Dialog */}
      {showTransferDialog && selectedBranchId && selectedBranchId !== 'mixed' && (
        <TransferStockDialog
          open={showTransferDialog}
          onOpenChange={setShowTransferDialog}
          selectedProducts={selectedProducts}
          fromBranchId={selectedBranchId}
          fromBranchName={selectedBranchName}
          onSuccess={() => setSelectedProductIds(new Set())}
        />
      )}
      <OnboardingTourOverlay
        steps={(receipts?.length ?? 0) > 0 ? receiptTour : receiptTourInfo}
        isActive={activeTour === 'receipt-tab' || (manualTourActive && activeTab === 'receipts')}
        onComplete={() => { setActiveTour(null); setManualTourActive(false); if ((receipts?.length ?? 0) > 0) { completeReceiptTour(); completeTour(); } }}
        onSkip={() => { setActiveTour(null); setManualTourActive(false); if ((receipts?.length ?? 0) > 0) { completeReceiptTour(); completeTour(); } }}
        tourKey="import_receipt_tab"
      />
      <OnboardingTourOverlay
        steps={(products?.length ?? 0) > 0 ? productTour : productTourInfo}
        isActive={activeTour === 'product-tab' || (manualTourActive && activeTab === 'products')}
        onComplete={() => { setActiveTour(null); setManualTourActive(false); if ((products?.length ?? 0) > 0) { completeProductTour(); completeTour(); } }}
        onSkip={() => { setActiveTour(null); setManualTourActive(false); if ((products?.length ?? 0) > 0) { completeProductTour(); completeTour(); } }}
        tourKey="import_product_tab"
      />
    </MainLayout>
  );
}
