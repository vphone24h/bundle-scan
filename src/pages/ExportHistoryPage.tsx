import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  Pencil
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useBranches } from '@/hooks/useBranches';
import { 
  useExportReceipts, 
  useExportReceiptItems, 
  useReturnProduct,
  type ExportReceipt,
  type ExportReceiptItemDetail 
} from '@/hooks/useExportReceipts';
import { useInvoiceTemplateByBranch } from '@/hooks/useInvoiceTemplates';
import { InvoicePrintDialog } from '@/components/export/InvoicePrintDialog';
import { EditExportItemDialog } from '@/components/export/EditExportItemDialog';
import { ReceiptReturnDialog } from '@/components/returns/ReceiptReturnDialog';
import { exportToExcel, formatDateForExcel } from '@/lib/exportExcel';
import { supabase } from '@/integrations/supabase/client';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  completed: { label: 'Hoàn tất', variant: 'default' },
  cancelled: { label: 'Đã hủy', variant: 'destructive' },
  partial_return: { label: 'Trả một phần', variant: 'secondary' },
  full_return: { label: 'Đã trả hàng', variant: 'outline' },
};

const paymentLabels: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_card: 'Thẻ NH',
  e_wallet: 'Ví điện tử',
  debt: 'Công nợ',
};

export default function ExportHistoryPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('_all_');
  const [branchFilter, setBranchFilter] = useState('_all_');
  const [showFilters, setShowFilters] = useState(false);
  
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
  const { data: receipts, isLoading: receiptsLoading } = useExportReceipts();
  const { data: items, isLoading: itemsLoading } = useExportReceiptItems();
  const { data: branches } = useBranches();
  const returnProduct = useReturnProduct();
  
  // Get template based on the print receipt's branch
  const printBranchId = printReceipt?.branch_id || null;
  const { data: template } = useInvoiceTemplateByBranch(printBranchId);
  const printBranch = printBranchId ? branches?.find(b => b.id === printBranchId) : null;

  // Fetch staff names from profiles for both tabs
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  useEffect(() => {
    // Collect all created_by IDs from both receipts and items
    const receiptUserIds = receipts?.map(r => r.created_by).filter(Boolean) || [];
    const itemUserIds = items?.map(i => i.export_receipts?.created_by).filter(Boolean) || [];
    const userIds = [...new Set([...receiptUserIds, ...itemUserIds])] as string[];
    if (userIds.length === 0) return;
    supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', userIds)
      .then(({ data }) => {
        if (data) {
          setStaffNames(Object.fromEntries(data.map(p => [p.user_id, p.display_name])));
        }
      });
  }, [items, receipts]);

  // Filter receipts
  const filteredReceipts = receipts?.filter((receipt) => {
    const matchesSearch =
      receipt.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.customers?.phone?.includes(searchTerm);
    
    const matchesStatus = statusFilter === '_all_' || receipt.status === statusFilter;
    
    const matchesDate = !dateFilter || 
      format(new Date(receipt.export_date), 'yyyy-MM-dd') === dateFilter;
    
    const matchesBranch = branchFilter === '_all_' || receipt.branch_id === branchFilter;

    return matchesSearch && matchesStatus && matchesDate && matchesBranch;
  });

  const hasActiveFilters = dateFilter || statusFilter !== '_all_' || branchFilter !== '_all_';

  const clearFilters = () => {
    setDateFilter('');
    setStatusFilter('_all_');
    setBranchFilter('_all_');
  };

  // Filter items
  const filteredItemsRaw = items?.filter((item) => {
    const matchesSearch =
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.imei?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.export_receipts?.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.export_receipts?.customers?.phone?.includes(searchTerm);

    return matchesSearch;
  }) || [];

  // Group non-IMEI items by: product_name + branch + receipt_id + sale_price
  const groupedItems = useMemo(() => {
    const grouped: Map<string, ExportReceiptItemDetail & { quantity: number; groupedIds: string[] }> = new Map();
    
    filteredItemsRaw.forEach((item) => {
      // Only group items without IMEI
      if (!item.imei) {
        const groupKey = `${item.product_name}|${item.export_receipts?.branch_id || ''}|${item.receipt_id}|${item.sale_price}`;
        
        if (grouped.has(groupKey)) {
          const existing = grouped.get(groupKey)!;
          existing.quantity += 1;
          existing.groupedIds.push(item.id);
        } else {
          grouped.set(groupKey, {
            ...item,
            quantity: 1,
            groupedIds: [item.id],
          });
        }
      } else {
        // IMEI products are not grouped, keep as individual rows
        grouped.set(item.id, {
          ...item,
          quantity: 1,
          groupedIds: [item.id],
        });
      }
    });
    
    return Array.from(grouped.values());
  }, [filteredItemsRaw]);

  // Pagination for receipts tab
  const receiptsPagination = usePagination(filteredReceipts || [], { 
    storageKey: 'export-receipts'
  });

  // Pagination for items tab - use grouped items
  const itemsPagination = usePagination(groupedItems, { 
    storageKey: 'export-items'
  });

  // Handle view detail
  const handleViewDetail = (receipt: ExportReceipt) => {
    setSelectedReceipt(receipt);
    setShowDetailDialog(true);
  };

  // Handle print
  const handlePrint = (receipt: ExportReceipt) => {
    setPrintReceipt({
      code: receipt.code,
      export_date: receipt.export_date,
      customer: receipt.customers,
      items: receipt.export_receipt_items,
      payments: receipt.export_receipt_payments,
      total_amount: receipt.total_amount,
      paid_amount: receipt.paid_amount,
      debt_amount: receipt.debt_amount,
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
    setReturnReceipt(receipt);
    setShowReturnDialog(true);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!filteredReceipts?.length) {
      toast({
        title: 'Không có dữ liệu',
        description: 'Không có phiếu xuất nào để xuất',
        variant: 'destructive',
      });
      return;
    }

    exportToExcel({
      filename: `Lich_su_xuat_hang_${format(new Date(), 'ddMMyyyy')}`,
      sheetName: 'Lịch sử xuất hàng',
      columns: [
        { header: 'STT', key: 'stt', width: 6, isNumeric: true },
        { header: 'Mã phiếu', key: 'code', width: 18 },
        { header: 'Ngày xuất', key: 'export_date', width: 18, format: (v) => formatDateForExcel(v, 'dd/MM/yyyy HH:mm') },
        { header: 'Khách hàng', key: 'customer_name', width: 25 },
        { header: 'SĐT', key: 'customer_phone', width: 15 },
        { header: 'Số SP', key: 'item_count', width: 8, isNumeric: true },
        { header: 'Tổng tiền', key: 'total_amount', width: 15, isNumeric: true },
        { header: 'Thuế (%)', key: 'vat_rate', width: 10, isNumeric: true },
        { header: 'Tiền thuế', key: 'vat_amount', width: 15, isNumeric: true },
        { header: 'Đã thanh toán', key: 'paid_amount', width: 15, isNumeric: true },
        { header: 'Công nợ', key: 'debt_amount', width: 15, isNumeric: true },
        { header: 'Trạng thái', key: 'status', width: 15, format: (v) => statusLabels[v]?.label || v },
        { header: 'Chi nhánh', key: 'branch_name', width: 20 },
        { header: 'Nhân viên', key: 'staff_name', width: 18 },
      ],
      data: filteredReceipts.map((r, index) => ({
        stt: index + 1,
        code: r.code,
        export_date: r.export_date,
        customer_name: r.customers?.name || 'Khách lẻ',
        customer_phone: r.customers?.phone || '',
        item_count: r.export_receipt_items?.length || 0,
        total_amount: r.total_amount,
        vat_rate: r.vat_rate || 0,
        vat_amount: r.vat_amount || 0,
        paid_amount: r.paid_amount,
        debt_amount: r.debt_amount,
        status: r.status,
        branch_name: branches?.find(b => b.id === r.branch_id)?.name || '',
        staff_name: r.created_by ? (staffNames[r.created_by] || '') : '',
      })),
    });

    toast({
      title: 'Xuất Excel thành công',
      description: `Đã xuất ${filteredReceipts.length} phiếu xuất hàng`,
    });
  };

  return (
    <MainLayout>
      <PageHeader
        title="Lịch sử xuất hàng"
        description="Xem và quản lý các phiếu xuất hàng"
      />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm theo mã phiếu, IMEI, tên SP, khách hàng, SĐT..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
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
              <Button variant="outline" onClick={handleExportExcel}>
                <FileDown className="h-4 w-4 mr-2" />
                Xuất Excel
              </Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label className="text-xs">Ngày</Label>
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
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
      <Tabs defaultValue="receipts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="receipts" className="gap-2">
            <FileText className="h-4 w-4" />
            Theo phiếu xuất
          </TabsTrigger>
          <TabsTrigger value="items" className="gap-2">
            <Package className="h-4 w-4" />
            Theo chi tiết SP
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: By Receipt */}
        <TabsContent value="receipts">
          <Card>
            <CardContent className="pt-6">
              {receiptsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Đang tải...
                </div>
              ) : filteredReceipts?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Không có phiếu xuất nào
                </div>
              ) : (
                <Table>
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
                    {receiptsPagination.paginatedData.map((receipt) => (
                      <TableRow key={receipt.id}>
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
                          {receipt.export_receipt_items?.length || 0}
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
                          {receipt.created_by ? (staffNames[receipt.created_by] || '-') : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusLabels[receipt.status]?.variant || 'default'}>
                            {statusLabels[receipt.status]?.label || receipt.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
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
                    ))}
                  </TableBody>
                </Table>
              )}
              {(filteredReceipts?.length || 0) > 0 && (
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: By Item */}
        <TabsContent value="items">
          <Card>
            <CardContent className="pt-6">
              {itemsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Đang tải...
                </div>
              ) : groupedItems?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Không có sản phẩm nào
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead className="text-center">SL</TableHead>
                      <TableHead className="text-right">Đơn giá</TableHead>
                      <TableHead className="text-right">Thành tiền</TableHead>
                      <TableHead>Bảo hành</TableHead>
                      <TableHead>Khách hàng</TableHead>
                      <TableHead>Nhân viên</TableHead>
                      <TableHead>Ngày bán</TableHead>
                      <TableHead>Chi nhánh</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsPagination.paginatedData.map((item) => {
                      const groupedItem = item as ExportReceiptItemDetail & { quantity: number; groupedIds: string[] };
                      const quantity = groupedItem.quantity || 1;
                      const totalPrice = item.sale_price * quantity;
                      const isGrouped = quantity > 1 && !item.imei;
                      
                      return (
                        <TableRow key={groupedItem.groupedIds?.join('-') || item.id}>
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
                            {(item as any).warranty || '-'}
                          </TableCell>
                          <TableCell>
                            <div>{item.export_receipts?.customers?.name || '-'}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.export_receipts?.customers?.phone}
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.export_receipts?.created_by ? staffNames[item.export_receipts.created_by] || '-' : '-'}
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
              )}
              {groupedItems.length > 0 && (
                <TablePagination
                  currentPage={itemsPagination.currentPage}
                  totalPages={itemsPagination.totalPages}
                  pageSize={itemsPagination.pageSize}
                  totalItems={itemsPagination.totalItems}
                  startIndex={itemsPagination.startIndex}
                  endIndex={itemsPagination.endIndex}
                  onPageChange={itemsPagination.setPage}
                  onPageSizeChange={itemsPagination.setPageSize}
                />
              )}
            </CardContent>
          </Card>
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
                <div className="font-medium mb-2 text-sm">Sản phẩm ({selectedReceipt.export_receipt_items?.length || 0})</div>
                
                {/* Mobile Card View */}
                <div className="sm:hidden space-y-2">
                  {selectedReceipt.export_receipt_items?.map((item, index) => {
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
                      {selectedReceipt.export_receipt_items?.map((item, index) => {
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
        receipt={printReceipt}
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
        receipt={returnReceipt}
        onSuccess={() => {
          setShowReturnDialog(false);
          setReturnReceipt(null);
        }}
      />
    </MainLayout>
  );
}
