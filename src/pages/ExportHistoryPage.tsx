import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { OnboardingTourOverlay, TourStep } from '@/components/onboarding/OnboardingTourOverlay';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search-input';
import { Input } from '@/components/ui/input';
import { DateRangeApplyFilter } from '@/components/ui/date-range-apply-filter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { TablePagination } from '@/components/ui/table-pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { 
  Search, 
  FileDown, 
  Eye, 
  Printer, 
  RotateCcw,
  FileText,
  Package,
  Calendar,
  Filter,
  X,
  Pencil,
  PlayCircle,
  Loader2,
} from 'lucide-react';
import { format, isToday } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useBranches } from '@/hooks/useBranches';
import { 
  useExportReceipts, 
  useExportReceiptItems, 
  useExportReceiptDetail,
  useReturnProduct,
  type ExportReceipt,
  type ExportReceiptItemDetail 
} from '@/hooks/useExportReceipts';
import { useInvoiceTemplateByBranch } from '@/hooks/useInvoiceTemplates';
import { InvoicePrintDialog } from '@/components/export/InvoicePrintDialog';
import { EditExportItemDialog } from '@/components/export/EditExportItemDialog';
import { ReceiptReturnDialog } from '@/components/returns/ReceiptReturnDialog';
import { exportToExcelMultiSheet, formatDateForExcel } from '@/lib/exportExcel';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useCategories } from '@/hooks/useCategories';
import { useCustomPaymentSources } from '@/hooks/useCustomPaymentSources';
import { ScrollableTableWrapper } from '@/components/ui/scrollable-table-wrapper';
import { useTranslation } from 'react-i18next';
import { usePendingOrderCount } from '@/hooks/useLandingOrders';
import { ShoppingBag } from 'lucide-react';

const LandingOrdersTab = lazy(() => import('@/components/admin/LandingOrdersTab').then(m => ({ default: m.LandingOrdersTab })));

const useExportHistoryConstants = () => {
  const { t } = useTranslation();
  return {
    statusLabels: {
      completed: { label: t('common.completed'), variant: 'default' as const },
      cancelled: { label: t('common.cancelled'), variant: 'destructive' as const },
      partial_return: { label: t('exportHistory.partialReturn'), variant: 'secondary' as const },
      full_return: { label: t('exportHistory.fullReturn'), variant: 'outline' as const },
    },
    paymentLabels: {
      cash: t('common.cash'),
      bank_card: t('common.bankCard'),
      e_wallet: t('common.eWallet'),
      debt: t('common.debt'),
    },
    receiptTour: [
      {
        title: t('tours.exportHistory.receiptTabTitle'),
        description: t('tours.exportHistory.receiptTabDesc'),
        targetSelector: '[data-tour="export-tab-receipts"]',
        position: 'bottom' as const,
      },
      {
        title: t('tours.exportHistory.actionBtnTitle'),
        description: t('tours.exportHistory.actionBtnDesc'),
        targetSelector: '[data-tour="export-receipt-actions"]',
        position: 'left' as const,
      },
    ],
    receiptTourInfo: [
      {
        title: t('tours.exportHistory.receiptTabInfoTitle'),
        description: t('tours.exportHistory.receiptTabInfoDesc'),
        isInfo: true,
        position: 'center' as const,
      },
    ],
    itemTour: [
      {
        title: t('tours.exportHistory.itemTabTitle'),
        description: t('tours.exportHistory.itemTabDesc'),
        targetSelector: '[data-tour="export-tab-items"]',
        position: 'bottom' as const,
      },
      {
        title: t('tours.exportHistory.returnBtnTitle'),
        description: t('tours.exportHistory.returnBtnDesc'),
        targetSelector: '[data-tour="export-item-return"]',
        position: 'left' as const,
      },
    ],
    itemTourInfo: [
      {
        title: t('tours.exportHistory.itemTabInfoTitle'),
        description: t('tours.exportHistory.itemTabInfoDesc'),
        isInfo: true,
        position: 'center' as const,
      },
    ],
  };
};

export default function ExportHistoryPage() {
  const { t } = useTranslation();
  const { statusLabels, paymentLabels, receiptTour, receiptTourInfo, itemTour, itemTourInfo } = useExportHistoryConstants();
  // Onboarding tour
  const { completeTour: completeHistoryTour } = useOnboardingTour('export_history');
  const { isCompleted: receiptTourDone, completeTour: completeReceiptTour } = useOnboardingTour('export_receipt_tab');
  const { isCompleted: itemTourDone, completeTour: completeItemTour } = useOnboardingTour('export_item_tab');
  const [activeTab, setActiveTab] = useState<'receipts' | 'items' | 'orders'>('receipts');
  const { data: pendingOrderCount } = usePendingOrderCount();
  const [receiptTabTourSeen, setReceiptTabTourSeen] = useState(false);
  const [itemTabTourSeen, setItemTabTourSeen] = useState(false);
  const [activeTour, setActiveTour] = useState<'receipt-tab' | 'item-tab' | null>(null);
  const [manualTourActive, setManualTourActive] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('_all_');
  const [branchFilter, setBranchFilter] = useState('_all_');
  const [paymentSourceFilter, setPaymentSourceFilter] = useState('_all_');
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('_all_');

  // Debounced search for server queries
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Server pagination state
  const [receiptPage, setReceiptPage] = useState(1);
  const [receiptPageSize, setReceiptPageSize] = useState(15);
  const [itemPage, setItemPage] = useState(1);
  const [itemPageSize, setItemPageSize] = useState(15);

  // Reset pages on filter change
  useEffect(() => {
    setReceiptPage(1);
    setItemPage(1);
  }, [debouncedSearch, statusFilter, dateFromFilter, dateToFilter, branchFilter, paymentSourceFilter, categoryFilter]);
  
  // Detail dialog
  const [selectedReceipt, setSelectedReceipt] = useState<ExportReceipt | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  
  // Print dialog
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printReceipt, setPrintReceipt] = useState<any>(null);
  
  // Edit item dialog
  const [editItem, setEditItem] = useState<ExportReceiptItemDetail | null>(null);
  
  // Return receipt dialog
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReceipt, setReturnReceipt] = useState<ExportReceipt | null>(null);

  // Hooks
  const { data: receipts, isLoading: receiptsLoading, isFetching: receiptsFetching, hasMore: receiptsHasMore } = useExportReceipts({
    search: debouncedSearch || undefined,
    status: statusFilter !== '_all_' ? statusFilter : undefined,
    dateFrom: dateFromFilter || undefined,
    dateTo: dateToFilter || undefined,
    branchId: branchFilter !== '_all_' ? branchFilter : undefined,
    page: receiptPage,
    pageSize: receiptPageSize,
  });
  const { data: items, isLoading: itemsLoading, isFetching: itemsFetching, totalCount: itemsTotalCount } = useExportReceiptItems(activeTab === 'items', {
    search: debouncedSearch || undefined,
    categoryId: categoryFilter !== '_all_' ? categoryFilter : undefined,
    page: itemPage,
    pageSize: itemPageSize,
  });
  // On-demand detail items for selected receipt (detail/print)
  const detailReceiptId = selectedReceipt?.id || printReceipt?.receiptId || null;
  const { data: detailItems, isLoading: detailItemsLoading } = useExportReceiptDetail(detailReceiptId);
  const { data: branches } = useBranches();
  const { data: categories } = useCategories();
  const returnProduct = useReturnProduct();
  const { data: permissions } = usePermissions();
  const { data: customPaymentSources = [] } = useCustomPaymentSources();
  const isSuperAdmin = permissions?.canViewAllBranches === true;
  
  // Get template based on the print receipt's branch
  const printBranchId = printReceipt?.branch_id || null;
  const { data: template } = useInvoiceTemplateByBranch(printBranchId);
  const printBranch = printBranchId ? branches?.find(b => b.id === printBranchId) : null;

  // Fetch staff names from profiles for both tabs (use sales_staff_id for NV bán)
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const staffUserIds = useMemo(() => {
    const receiptUserIds = receipts?.map(r => (r as any).sales_staff_id || r.created_by).filter(Boolean) || [];
    const itemUserIds = items?.map(i => (i.export_receipts as any)?.sales_staff_id || i.export_receipts?.created_by).filter(Boolean) || [];
    return [...new Set([...receiptUserIds, ...itemUserIds])].sort().join(',');
  }, [receipts, items]);

  useEffect(() => {
    if (!staffUserIds) return;
    const ids = staffUserIds.split(',');
    supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', ids)
      .then(({ data }) => {
        if (data) {
          setStaffNames(prev => {
            const next = Object.fromEntries(data.map(p => [p.user_id, p.display_name]));
            // Only update if changed
            if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
            return next;
          });
        }
      });
  }, [staffUserIds]);

  // Server-side filters handle search, status, date, branch. Only payment source is client-side.
  const filteredReceipts = useMemo(() => {
    if (paymentSourceFilter === '_all_') return receipts;
    return receipts?.filter(r => r.export_receipt_payments?.some(p => p.payment_type === paymentSourceFilter));
  }, [receipts, paymentSourceFilter]);

  const hasActiveFilters = dateFilter || dateFromFilter || dateToFilter || statusFilter !== '_all_' || branchFilter !== '_all_' || categoryFilter !== '_all_' || paymentSourceFilter !== '_all_';

  const clearFilters = () => {
    setDateFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setStatusFilter('_all_');
    setBranchFilter('_all_');
    setCategoryFilter('_all_');
    setPaymentSourceFilter('_all_');
  };

  // Group non-IMEI items (items are already server-filtered)
  const groupedItems = useMemo(() => {
    const grouped: Map<string, ExportReceiptItemDetail & { quantity: number; groupedIds: string[] }> = new Map();
    
    (items || []).forEach((item) => {
      if (!item.imei) {
        const groupKey = `${item.product_name}|${item.export_receipts?.branch_id || ''}|${item.receipt_id}|${item.sale_price}`;
        
        if (grouped.has(groupKey)) {
          const existing = grouped.get(groupKey)!;
          existing.quantity += 1;
          existing.groupedIds.push(item.id);
        } else {
          grouped.set(groupKey, { ...item, quantity: 1, groupedIds: [item.id] });
        }
      } else {
        grouped.set(item.id, { ...item, quantity: 1, groupedIds: [item.id] });
      }
    });
    
    return Array.from(grouped.values());
  }, [items]);

  // No totalCount — use hasMore for next/prev navigation

  // Handle view detail
  const handleViewDetail = (receipt: ExportReceipt) => {
    setSelectedReceipt(receipt);
    setShowDetailDialog(true);
  };

  // Handle print
  const handlePrint = (receipt: ExportReceipt) => {
    setPrintReceipt({
      receiptId: receipt.id,
      code: receipt.code,
      export_date: receipt.export_date,
      branch_id: receipt.branch_id,
      customer: receipt.customers,
      items: [], // will be filled by detailItems
      payments: receipt.export_receipt_payments,
      total_amount: receipt.total_amount,
      paid_amount: receipt.paid_amount,
      debt_amount: receipt.debt_amount,
      points_earned: (receipt as any).points_earned || 0,
      tax_amount: (receipt as any).tax_amount || 0,
      tax_rate: (receipt as any).tax_rate || 0,
      subtotal_amount: (receipt as any).subtotal_amount || 0,
    });
    setShowPrintDialog(true);
  };

  // Handle return - Navigate to Returns page (for single item)
  const handleReturn = (item: ExportReceiptItemDetail) => {
    if (item.status === 'returned') {
      toast({
        title: 'Đã trả hàng',
        description: 'Sản phẩm này đã được trả hàng trước đó',
        variant: 'destructive',
      });
      return;
    }
    navigate(`/returns?type=export&itemId=${item.id}`);
  };
  
  // Handle return receipt - Open dialog for full receipt return
  const handleReturnReceipt = (receipt: ExportReceipt) => {
    setSelectedReceipt(receipt); // trigger detailItems loading
    setReturnReceipt(receipt);
    setShowReturnDialog(true);
  };

  const CHUNK_SIZE = 5000;

  // Helper: fetch receipts page by page (500 per page, NO joins) to avoid timeout
  const fetchReceiptsStreaming = async () => {
    const allData: any[] = [];
    let from = 0;
    const pageSize = 500;
    while (true) {
      setExportProgress(`Đang tải phiếu ${from + 1}...`);
      let q = supabase
        .from('export_receipts')
        .select('id, code, export_date, total_amount, paid_amount, debt_amount, vat_rate, vat_amount, status, branch_id, customer_id, sales_staff_id, created_by')
        .order('export_date', { ascending: false });
      if (statusFilter !== '_all_') q = q.eq('status', statusFilter);
      if (dateFromFilter) q = q.gte('export_date', dateFromFilter);
      if (dateToFilter) q = q.lte('export_date', dateToFilter + 'T23:59:59');
      if (branchFilter !== '_all_') q = q.eq('branch_id', branchFilter);
      q = q.range(from, from + pageSize - 1);
      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) break;
      allData.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Fetch customer names separately (batch 500)
    setExportProgress('Đang tải thông tin khách hàng...');
    const customerIds = [...new Set(allData.map(r => r.customer_id).filter(Boolean))];
    const customerMap: Record<string, { name: string; phone: string }> = {};
    for (let i = 0; i < customerIds.length; i += 500) {
      const chunk = customerIds.slice(i, i + 500);
      const { data } = await supabase.from('customers').select('id, name, phone').in('id', chunk);
      if (data) data.forEach(c => { customerMap[c.id] = { name: c.name, phone: c.phone || '' }; });
    }

    // Fetch branch names separately
    setExportProgress('Đang tải thông tin chi nhánh...');
    const branchIds = [...new Set(allData.map(r => r.branch_id).filter(Boolean))];
    const branchMap: Record<string, string> = {};
    if (branchIds.length > 0) {
      const { data } = await supabase.from('branches').select('id, name').in('id', branchIds);
      if (data) data.forEach(b => { branchMap[b.id] = b.name; });
    }

    // Attach customer/branch info
    for (const r of allData) {
      r.customers = customerMap[r.customer_id] || { name: 'Khách lẻ', phone: '' };
      r.branches = { name: branchMap[r.branch_id] || '' };
    }

    return allData;
  };

  // Helper: fetch staff names
  const fetchStaffNames = async (receipts: any[]) => {
    const userIds = [...new Set(receipts.map((r: any) => r.sales_staff_id || r.created_by).filter(Boolean))];
    if (userIds.length === 0) return {};
    const allNames: Record<string, string> = {};
    for (let i = 0; i < userIds.length; i += 500) {
      const chunk = userIds.slice(i, i + 500);
      const { data } = await supabase.from('profiles').select('user_id, display_name').in('user_id', chunk);
      if (data) data.forEach(p => { allNames[p.user_id] = p.display_name; });
    }
    return allNames;
  };

  const receiptColumns = [
    { header: 'STT', key: 'stt', width: 6, isNumeric: true },
    { header: 'Mã phiếu', key: 'code', width: 18 },
    { header: 'Ngày xuất', key: 'export_date', width: 18, format: (v: any) => formatDateForExcel(v, 'dd/MM/yyyy HH:mm') },
    { header: 'Khách hàng', key: 'customer_name', width: 25 },
    { header: 'SĐT', key: 'customer_phone', width: 15 },
    { header: 'Tổng tiền', key: 'total_amount', width: 15, isNumeric: true },
    { header: 'Thuế (%)', key: 'vat_rate', width: 10, isNumeric: true },
    { header: 'Tiền thuế', key: 'vat_amount', width: 15, isNumeric: true },
    { header: 'Đã thanh toán', key: 'paid_amount', width: 15, isNumeric: true },
    { header: 'Công nợ', key: 'debt_amount', width: 15, isNumeric: true },
    { header: 'Trạng thái', key: 'status', width: 15, format: (v: any) => statusLabels[v]?.label || v },
    { header: 'Chi nhánh', key: 'branch_name', width: 20 },
    { header: 'Nhân viên', key: 'staff_name', width: 18 },
  ];

  const itemColumns = [
    { header: 'STT', key: 'stt', width: 6, isNumeric: true },
    { header: 'Mã phiếu', key: 'receipt_code', width: 18 },
    { header: 'Ngày xuất', key: 'export_date', width: 18, format: (v: any) => formatDateForExcel(v, 'dd/MM/yyyy HH:mm') },
    { header: 'Sản phẩm', key: 'product_name', width: 30 },
    { header: 'SKU', key: 'sku', width: 25 },
    { header: 'IMEI', key: 'imei', width: 18 },
    { header: 'Đơn giá', key: 'sale_price', width: 15, isNumeric: true },
    { header: 'Danh mục', key: 'category_name', width: 15 },
    { header: 'Khách hàng', key: 'customer_name', width: 25 },
    { header: 'SĐT', key: 'customer_phone', width: 15 },
    { header: 'Chi nhánh', key: 'branch_name', width: 20 },
    { header: 'Nhân viên', key: 'staff_name', width: 18 },
    { header: 'Bảo hành', key: 'warranty', width: 15 },
    { header: 'Trạng thái', key: 'status', width: 12 },
  ];

  // Export receipts to Excel — chunked if > 5000
  const handleExportReceiptsExcel = async () => {
    setIsExporting(true);
    setExportProgress('Đang tải dữ liệu...');
    try {
      const allReceipts = await fetchReceiptsStreaming();
      if (allReceipts.length === 0) {
        toast({ title: 'Không có dữ liệu', description: 'Không có phiếu xuất nào để xuất', variant: 'destructive' });
        return;
      }

      setExportProgress('Đang lấy thông tin nhân viên...');
      const allStaffNames = await fetchStaffNames(allReceipts);
      const dateStr = format(new Date(), 'ddMMyyyy_HHmm');

      const mapReceipt = (r: any, index: number) => ({
        stt: index + 1,
        code: r.code,
        export_date: r.export_date,
        customer_name: r.customers?.name || 'Khách lẻ',
        customer_phone: r.customers?.phone || '',
        total_amount: r.total_amount,
        vat_rate: r.vat_rate || 0,
        vat_amount: r.vat_amount || 0,
        paid_amount: r.paid_amount,
        debt_amount: r.debt_amount,
        status: r.status,
        branch_name: r.branches?.name || '',
        staff_name: (() => { const sid = r.sales_staff_id || r.created_by; return sid ? (allStaffNames[sid] || '') : ''; })(),
      });

      if (allReceipts.length <= CHUNK_SIZE) {
        setExportProgress('Đang tạo file Excel...');
        exportToExcelMultiSheet({
          filename: `Phieu_xuat_${dateStr}`,
          sheets: [{ sheetName: 'Theo phiếu xuất', columns: receiptColumns, data: allReceipts.map(mapReceipt) }],
        });
        toast({ title: 'Xuất thành công', description: `${allReceipts.length} phiếu` });
      } else {
        const totalFiles = Math.ceil(allReceipts.length / CHUNK_SIZE);
        for (let f = 0; f < totalFiles; f++) {
          const start = f * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, allReceipts.length);
          const chunk = allReceipts.slice(start, end);
          setExportProgress(`Đang xuất file ${f + 1}/${totalFiles}...`);
          exportToExcelMultiSheet({
            filename: `Phieu_xuat_${dateStr}_${f + 1}-${totalFiles}`,
            sheets: [{ sheetName: 'Theo phiếu xuất', columns: receiptColumns, data: chunk.map((r, i) => mapReceipt(r, start + i)) }],
          });
          // Small delay between downloads so browser doesn't block
          if (f < totalFiles - 1) await new Promise(r => setTimeout(r, 800));
        }
        toast({ title: 'Xuất thành công', description: `${allReceipts.length} phiếu / ${totalFiles} file` });
      }
    } catch (error: any) {
      console.error('Export receipts error:', error);
      toast({ title: 'Lỗi xuất Excel', description: error?.message || 'Không thể tải dữ liệu.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  };

  // Export items to Excel — chunked if > 5000
  const handleExportItemsExcel = async () => {
    setIsExporting(true);
    setExportProgress('Đang tải phiếu...');
    try {
      const allReceipts = await fetchReceiptsStreaming();
      const receiptIds = allReceipts.map((r: any) => r.id);
      if (receiptIds.length === 0) {
        toast({ title: 'Không có dữ liệu', description: 'Không có sản phẩm nào để xuất', variant: 'destructive' });
        return;
      }

      const receiptMap: Record<string, any> = {};
      allReceipts.forEach((r: any) => { receiptMap[r.id] = r; });

      setExportProgress('Đang tải chi tiết sản phẩm...');
      let allItemsRaw: any[] = [];
      for (let i = 0; i < receiptIds.length; i += 500) {
        const chunk = receiptIds.slice(i, i + 500);
        setExportProgress(`Đang tải SP (${Math.min(i + 500, receiptIds.length)}/${receiptIds.length} phiếu)...`);
        const { data, error } = await supabase
          .from('export_receipt_items')
          .select('id, receipt_id, product_name, sku, imei, sale_price, status, warranty, category_id, categories(name)')
          .in('receipt_id', chunk);
        if (error) throw error;
        if (data) allItemsRaw.push(...data);
      }

      setExportProgress('Đang lấy thông tin nhân viên...');
      const allStaffNames = await fetchStaffNames(allReceipts);
      const dateStr = format(new Date(), 'ddMMyyyy_HHmm');

      const mapItem = (item: any, index: number) => {
        const r = receiptMap[item.receipt_id];
        return {
          stt: index + 1,
          receipt_code: r?.code || '',
          export_date: r?.export_date || '',
          product_name: item.product_name,
          sku: item.sku,
          imei: item.imei || '',
          sale_price: item.sale_price,
          category_name: item.categories?.name || '',
          customer_name: r?.customers?.name || 'Khách lẻ',
          customer_phone: r?.customers?.phone || '',
          branch_name: r?.branches?.name || '',
          staff_name: (() => { const sid = r?.sales_staff_id || r?.created_by; return sid ? (allStaffNames[sid] || '') : ''; })(),
          warranty: item.warranty || '',
          status: item.status === 'sold' ? 'Đã bán' : item.status === 'returned' ? 'Đã trả' : item.status,
        };
      };

      if (allItemsRaw.length <= CHUNK_SIZE) {
        setExportProgress('Đang tạo file Excel...');
        exportToExcelMultiSheet({
          filename: `Chi_tiet_SP_${dateStr}`,
          sheets: [{ sheetName: 'Theo chi tiết SP', columns: itemColumns, data: allItemsRaw.map(mapItem) }],
        });
        toast({ title: 'Xuất thành công', description: `${allItemsRaw.length} sản phẩm` });
      } else {
        const totalFiles = Math.ceil(allItemsRaw.length / CHUNK_SIZE);
        for (let f = 0; f < totalFiles; f++) {
          const start = f * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, allItemsRaw.length);
          const chunk = allItemsRaw.slice(start, end);
          setExportProgress(`Đang xuất file ${f + 1}/${totalFiles}...`);
          exportToExcelMultiSheet({
            filename: `Chi_tiet_SP_${dateStr}_${f + 1}-${totalFiles}`,
            sheets: [{ sheetName: 'Theo chi tiết SP', columns: itemColumns, data: chunk.map((item, i) => mapItem(item, start + i)) }],
          });
          if (f < totalFiles - 1) await new Promise(r => setTimeout(r, 800));
        }
        toast({ title: 'Xuất thành công', description: `${allItemsRaw.length} SP / ${totalFiles} file` });
      }
    } catch (error: any) {
      console.error('Export items error:', error);
      toast({ title: 'Lỗi xuất Excel', description: error?.message || 'Không thể tải dữ liệu.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title={t('pages.exportHistory.title')}
        description={t('pages.exportHistory.description')}
        helpText={t('pages.exportHistory.helpText')}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => navigate('/export/new')}
              className="h-8 text-xs sm:text-sm"
            >
              <Package className="mr-1.5 h-4 w-4" />
              Bán hàng
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (activeTab === 'receipts') {
                  setReceiptTabTourSeen(true);
                  setActiveTour('receipt-tab');
                } else {
                  setItemTabTourSeen(true);
                  setActiveTour('item-tab');
                }
              }}
              className="h-8 text-xs sm:text-sm"
            >
              <PlayCircle className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Xem hướng dẫn</span>
              <span className="sm:hidden">Xem HD</span>
            </Button>
          </div>
        }
      />

      {/* Filters - hide when on orders tab */}
      {activeTab !== 'orders' && <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <SearchInput
                  placeholder="Tìm theo mã phiếu, IMEI, tên SP, khách hàng, SĐT..."
                  value={searchTerm}
                  onChange={setSearchTerm}
                  loading={!!debouncedSearch && (receiptsFetching || itemsFetching)}
                />
              </div>
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
              <Button variant="outline" onClick={activeTab === 'receipts' ? handleExportReceiptsExcel : handleExportItemsExcel} disabled={isExporting}>
                {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                {isExporting ? (exportProgress || 'Đang tải...') : activeTab === 'receipts' ? 'Xuất phiếu Excel' : 'Xuất chi tiết Excel'}
              </Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                <div className="sm:col-span-2">
                  <DateRangeApplyFilter
                    startDate={dateFromFilter}
                    endDate={dateToFilter}
                    onApply={(s, e) => { setDateFromFilter(s); setDateToFilter(e); }}
                    isLoading={receiptsFetching || itemsFetching}
                    layout="stacked"
                    labelClassName="text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Trạng thái</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="_all_">Tất cả</SelectItem>
                      <SelectItem value="completed">Hoàn tất</SelectItem>
                      <SelectItem value="partial_return">Trả một phần</SelectItem>
                      <SelectItem value="full_return">Đã trả hàng</SelectItem>
                      <SelectItem value="cancelled">Đã hủy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isSuperAdmin && (
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
                )}
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
                  <Label className="text-xs">Nguồn tiền</Label>
                  <Select value={paymentSourceFilter} onValueChange={setPaymentSourceFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="_all_">Tất cả nguồn tiền</SelectItem>
                      <SelectItem value="cash">Tiền mặt</SelectItem>
                      <SelectItem value="bank_card">Thẻ ngân hàng</SelectItem>
                      <SelectItem value="e_wallet">Ví điện tử</SelectItem>
                      <SelectItem value="debt">Công nợ</SelectItem>
                      {customPaymentSources.map((src) => (
                        <SelectItem key={src.id} value={src.id}>
                          {src.name}
                        </SelectItem>
                      ))}
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
      </Card>}


      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => {
        const tab = v as 'receipts' | 'items' | 'orders';
        setActiveTab(tab);
        // Tour: info nếu chưa có data, chi tiết nếu có data
        if (tab === 'receipts' && !receiptTabTourSeen && !receiptTourDone) {
          setReceiptTabTourSeen(true);
          setTimeout(() => setActiveTour('receipt-tab'), 400);
        } else if (tab === 'items' && !itemTabTourSeen && !itemTourDone) {
          setItemTabTourSeen(true);
          setTimeout(() => setActiveTour('item-tab'), 400);
        }
      }} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto scrollbar-none flex-nowrap">
          <TabsTrigger data-tour="export-tab-receipts" value="receipts" className={cn("gap-2 shrink-0", debouncedSearch && activeTab !== 'receipts' && filteredReceipts && filteredReceipts.length > 0 && 'tab-flash-red')}>
            <FileText className="h-4 w-4" />
            Theo phiếu xuất
          </TabsTrigger>
          <TabsTrigger data-tour="export-tab-items" value="items" className={cn("gap-2 shrink-0", debouncedSearch && activeTab !== 'items' && itemsTotalCount > 0 && 'tab-flash-red')}>
            <Package className="h-4 w-4" />
            Theo chi tiết SP
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2 relative shrink-0">
            <ShoppingBag className="h-4 w-4" />
            Đơn đặt hàng
            {!!pendingOrderCount && pendingOrderCount > 0 && (
              <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 h-5 min-w-5 flex items-center justify-center p-0 px-1 text-[10px]">
                {pendingOrderCount > 99 ? '99+' : pendingOrderCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <p className="text-xs text-muted-foreground mt-1 mb-2 px-1">
          {activeTab === 'receipts'
            ? 'Xem tổng quan từng đơn / theo phiếu Bán Hàng.'
            : activeTab === 'items'
            ? 'Xem chi tiết từng sản phẩm trong các phiếu Bán hàng.'
            : 'Quản lý đơn đặt hàng từ website bán hàng.'}
        </p>

        {/* Tab 1: By Receipt */}
        <TabsContent value="receipts">
          <Card>
             <CardContent className="pt-6">
              {receiptsLoading && !receipts?.length ? (
                <div className="space-y-3 py-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4 items-center">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-28" />
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-20 hidden lg:block" />
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              ) : filteredReceipts?.length === 0 && !receiptsFetching ? (
                <div className="text-center py-8 text-muted-foreground">
                  Không có phiếu xuất nào
                </div>
              ) : (
                <div className={receiptsFetching ? 'opacity-60' : ''}>
                <ScrollableTableWrapper className="rounded-lg border bg-card">
                <Table wrapperClassName="overflow-visible">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã phiếu</TableHead>
                      <TableHead>Ngày bán</TableHead>
                      <TableHead>Khách hàng</TableHead>
                      <TableHead className="hidden lg:table-cell">Chi nhánh</TableHead>
                      <TableHead className="text-center">Số SP</TableHead>
                      <TableHead className="text-right">Tổng tiền</TableHead>
                      <TableHead className="text-center">Thuế</TableHead>
                      <TableHead className="text-right">Đã TT</TableHead>
                      <TableHead className="text-right">Công nợ</TableHead>
                      <TableHead>Nhân viên</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(filteredReceipts || []).map((receipt) => {
                      const isReceiptToday = isToday(new Date(receipt.export_date));
                      return (
                      <TableRow key={receipt.id} className={isReceiptToday ? 'text-destructive' : ''}>
                        <TableCell 
                          className="font-medium text-primary cursor-pointer hover:underline"
                          onClick={() => handleViewDetail(receipt)}
                        >
                          {receipt.code}
                        </TableCell>
                        <TableCell>
                          {format(new Date(receipt.export_date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                        </TableCell>
                        <TableCell>
                          <div>{receipt.customers?.name || '-'}</div>
                          <div className="text-xs text-muted-foreground">
                            {receipt.customers?.phone}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {receipt.branches?.name || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {(receipt as any).item_count || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {receipt.total_amount.toLocaleString('vi-VN')}đ
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {receipt.vat_rate || 0}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {receipt.paid_amount.toLocaleString('vi-VN')}đ
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {receipt.debt_amount > 0 ? `${receipt.debt_amount.toLocaleString('vi-VN')}đ` : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {(() => {
                            const staffId = (receipt as any).sales_staff_id || receipt.created_by;
                            return staffId ? (staffNames[staffId] || '-') : '-';
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusLabels[receipt.status]?.variant || 'default'}>
                            {statusLabels[receipt.status]?.label || receipt.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1" data-tour="export-receipt-actions">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDetail(receipt)}
                              title="Xem chi tiết"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePrint(receipt)}
                              title="In hóa đơn"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleReturnReceipt(receipt)}
                              title="Trả hàng toàn bộ phiếu"
                              disabled={receipt.status === 'full_return' || receipt.status === 'cancelled'}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </ScrollableTableWrapper>
                </div>
              )}
              {(receipts?.length || 0) > 0 && (() => {
                const receiptsTotalEstimate = receiptsHasMore ? (receiptPage * receiptPageSize) + 1 : ((receiptPage - 1) * receiptPageSize) + (receipts?.length || 0);
                return (
                  <TablePagination
                    currentPage={receiptPage}
                    totalPages={Math.max(1, Math.ceil(receiptsTotalEstimate / receiptPageSize))}
                    pageSize={receiptPageSize}
                    totalItems={receiptsTotalEstimate}
                    startIndex={(receiptPage - 1) * receiptPageSize + 1}
                    endIndex={Math.min(receiptPage * receiptPageSize, receiptsTotalEstimate)}
                    onPageChange={setReceiptPage}
                    onPageSizeChange={(size) => { setReceiptPageSize(size); setReceiptPage(1); }}
                  />
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: By Item */}
        <TabsContent value="items">
          <Card>
            <CardContent className="pt-6">
              {itemsLoading && !items?.length ? (
                <div className="space-y-3 py-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4 items-center">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-5 w-12" />
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              ) : groupedItems?.length === 0 && !itemsFetching ? (
                <div className="text-center py-8 text-muted-foreground">
                  Không có sản phẩm nào
                </div>
              ) : (
                <div className={itemsFetching ? 'opacity-60' : ''}>
                <ScrollableTableWrapper className="rounded-lg border bg-card">
                <Table wrapperClassName="overflow-visible">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead className="text-center">SL</TableHead>
                      <TableHead className="text-right">Đơn giá</TableHead>
                      <TableHead className="text-right">Thành tiền</TableHead>
                      <TableHead>Bảo hành</TableHead>
                      <TableHead>Ghi chú</TableHead>
                      <TableHead>Khách hàng</TableHead>
                      <TableHead>Nhân viên</TableHead>
                      <TableHead>Ngày bán</TableHead>
                      <TableHead>Chi nhánh</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedItems.map((item) => {
                      const groupedItem = item as ExportReceiptItemDetail & { quantity: number; groupedIds: string[] };
                      const quantity = groupedItem.quantity || 1;
                      const totalPrice = item.sale_price * quantity;
                      const isGrouped = quantity > 1 && !item.imei;
                      const isItemToday = item.export_receipts?.export_date ? isToday(new Date(item.export_receipts.export_date)) : false;
                      
                      return (
                        <TableRow key={groupedItem.groupedIds?.join('-') || item.id} className={isItemToday ? 'text-destructive' : ''}>
                          <TableCell>
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-xs text-muted-foreground">
                              SKU: {item.sku}
                            </div>
                            {item.imei && (
                              <div className="text-xs text-muted-foreground">
                                IMEI: {item.imei}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {isGrouped ? (
                              <Badge variant="secondary" className="font-medium">
                                {quantity}
                              </Badge>
                            ) : (
                              quantity
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.sale_price.toLocaleString('vi-VN')}đ
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {totalPrice.toLocaleString('vi-VN')}đ
                          </TableCell>
                          <TableCell>
                            {item.warranty || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[150px] truncate text-sm" title={item.note || ''}>
                              {item.note || '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>{item.export_receipts?.customers?.name || '-'}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.export_receipts?.customers?.phone}
                            </div>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const staffId = (item.export_receipts as any)?.sales_staff_id || item.export_receipts?.created_by;
                              return staffId ? (staffNames[staffId] || '-') : '-';
                            })()}
                          </TableCell>
                          <TableCell>
                            {item.export_receipts?.export_date ? 
                              format(new Date(item.export_receipts.export_date), 'dd/MM/yyyy', { locale: vi }) : '-'}
                          </TableCell>
                          <TableCell>
                            {item.export_receipts?.branches?.name || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.status === 'sold' ? 'default' : 'secondary'}>
                              {item.status === 'sold' ? 'Đã bán' : 'Đã trả'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {!isGrouped && (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditItem(item)}
                                  className="h-7 w-7"
                                  title="Sửa thông tin"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleReturn(item)}
                                  disabled={item.status === 'returned' || returnProduct.isPending}
                                  title="Trả hàng"
                                  data-tour="export-item-return"
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  Trả
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </ScrollableTableWrapper>
                </div>
              )}
              {groupedItems.length > 0 && (
                <TablePagination
                  currentPage={itemPage}
                  totalPages={Math.max(1, Math.ceil(itemsTotalCount / itemPageSize))}
                  pageSize={itemPageSize}
                  totalItems={itemsTotalCount}
                  startIndex={(itemPage - 1) * itemPageSize + 1}
                  endIndex={Math.min(itemPage * itemPageSize, itemsTotalCount)}
                  onPageChange={setItemPage}
                  onPageSizeChange={(size) => { setItemPageSize(size); setItemPage(1); }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Landing Orders */}
        <TabsContent value="orders">
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground text-sm">Đang tải...</div>}>
            <LandingOrdersTab />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg break-all">Chi tiết phiếu xuất {selectedReceipt?.code}</DialogTitle>
          </DialogHeader>
          
          {selectedReceipt && (
            <div className="space-y-3 sm:space-y-4">
              {/* Receipt info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                <div className="flex justify-between sm:block">
                  <span className="text-muted-foreground">Ngày bán:</span>
                  <span className="sm:ml-2 font-medium">
                    {format(new Date(selectedReceipt.export_date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </span>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-muted-foreground">Trạng thái:</span>
                  <Badge className="sm:ml-2" variant={statusLabels[selectedReceipt.status]?.variant}>
                    {statusLabels[selectedReceipt.status]?.label}
                  </Badge>
                </div>
              </div>

              {/* Customer */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium mb-1 text-sm">Khách hàng</div>
                <div className="text-sm">
                  {selectedReceipt.customers?.name} - {selectedReceipt.customers?.phone}
                </div>
                {selectedReceipt.customers?.address && (
                  <div className="text-xs text-muted-foreground">
                    {selectedReceipt.customers.address}
                  </div>
                )}
              </div>

              {/* Items - Mobile Card View */}
              <div>
                <div className="font-medium mb-2 text-sm">Sản phẩm ({detailItems?.length || 0})</div>
                
                {detailItemsLoading && !detailItems ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Đang tải chi tiết...
                  </div>
                ) : !detailItems?.length ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">Không có sản phẩm</div>
                ) : (
                <>
                {/* Mobile Card View */}
                <div className="sm:hidden space-y-2">
                  {detailItems.map((item, index) => {
                    const quantity = (item as any).quantity || 1;
                    const totalPrice = item.sale_price * quantity;
                    return (
                      <div key={item.id} className="p-3 border rounded-lg bg-card space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm flex items-center gap-2">
                              <span className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded">{index + 1}</span>
                              <span className="truncate">{item.product_name}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 font-mono">
                              {item.imei || item.sku}
                            </div>
                          </div>
                          <Badge variant={item.status === 'sold' ? 'default' : 'secondary'} className="text-xs flex-shrink-0">
                            {item.status === 'sold' ? 'Đã bán' : 'Đã trả'}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t">
                          <span className="text-muted-foreground">SL: {quantity}</span>
                          <span className="font-medium">{totalPrice.toLocaleString('vi-VN')}đ</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">STT</TableHead>
                        <TableHead>Tên SP</TableHead>
                        <TableHead>IMEI/SKU</TableHead>
                        <TableHead className="text-center">SL</TableHead>
                        <TableHead className="text-right">Đơn giá</TableHead>
                        <TableHead className="text-right">Thành tiền</TableHead>
                        <TableHead>TT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailItems.map((item, index) => {
                        const quantity = (item as any).quantity || 1;
                        const totalPrice = item.sale_price * quantity;
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="text-center font-medium">{index + 1}</TableCell>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell>{item.imei || item.sku}</TableCell>
                            <TableCell className="text-center">{quantity}</TableCell>
                            <TableCell className="text-right">
                              {item.sale_price.toLocaleString('vi-VN')}đ
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {totalPrice.toLocaleString('vi-VN')}đ
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.status === 'sold' ? 'default' : 'secondary'} className="text-xs">
                                {item.status === 'sold' ? 'Đã bán' : 'Đã trả'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                </>
                )}
              </div>

              {/* Payment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="font-medium mb-2 text-sm">Thanh toán</div>
                  {selectedReceipt.export_receipt_payments?.map((payment, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{paymentLabels[payment.payment_type] || payment.payment_type}</span>
                      <span>{payment.amount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-muted rounded-lg space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Tổng tiền:</span>
                    <span className="font-bold">{selectedReceipt.total_amount.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Đã thanh toán:</span>
                    <span>{selectedReceipt.paid_amount.toLocaleString('vi-VN')}đ</span>
                  </div>
                  {selectedReceipt.debt_amount > 0 && (
                    <div className="flex justify-between text-destructive text-sm">
                      <span>Công nợ:</span>
                      <span>{selectedReceipt.debt_amount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDetailDialog(false)} className="w-full sm:w-auto">
              Đóng
            </Button>
            <Button onClick={() => selectedReceipt && handlePrint(selectedReceipt)} className="w-full sm:w-auto">
              <Printer className="h-4 w-4 mr-2" />
              In hóa đơn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <InvoicePrintDialog
        open={showPrintDialog}
        onOpenChange={setShowPrintDialog}
        receipt={printReceipt ? { ...printReceipt, items: detailItems || printReceipt.items } : null}
        template={template}
        branchInfo={printBranch}
      />

      {/* Edit Item Dialog */}
      <EditExportItemDialog
        item={editItem}
        open={!!editItem}
        onOpenChange={(open) => !open && setEditItem(null)}
      />
      
      {/* Receipt Return Dialog */}
      <ReceiptReturnDialog
        open={showReturnDialog}
        onOpenChange={setShowReturnDialog}
        receipt={returnReceipt ? { ...returnReceipt, export_receipt_items: detailItems || returnReceipt.export_receipt_items } : null}
        onSuccess={() => {
          setShowReturnDialog(false);
          setReturnReceipt(null);
        }}
      />
      <OnboardingTourOverlay
        steps={(receipts?.length ?? 0) > 0 ? receiptTour : receiptTourInfo}
        isActive={activeTour === 'receipt-tab' || (manualTourActive && activeTab === 'receipts')}
        onComplete={() => { setActiveTour(null); setManualTourActive(false); if ((receipts?.length ?? 0) > 0) { completeReceiptTour(); completeHistoryTour(); } }}
        onSkip={() => { setActiveTour(null); setManualTourActive(false); if ((receipts?.length ?? 0) > 0) { completeReceiptTour(); completeHistoryTour(); } }}
        tourKey="export_receipt_tab"
      />
      <OnboardingTourOverlay
        steps={(items?.length ?? 0) > 0 ? itemTour : itemTourInfo}
        isActive={activeTour === 'item-tab' || (manualTourActive && activeTab === 'items')}
        onComplete={() => { setActiveTour(null); setManualTourActive(false); if ((items?.length ?? 0) > 0) { completeItemTour(); completeHistoryTour(); } }}
        onSkip={() => { setActiveTour(null); setManualTourActive(false); if ((items?.length ?? 0) > 0) { completeItemTour(); completeHistoryTour(); } }}
        tourKey="export_item_tab"
      />
    </MainLayout>
  );
}
