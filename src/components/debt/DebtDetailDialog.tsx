import { useState, useMemo } from 'react';
import { useDebtDetail, useDebtPaymentHistory } from '@/hooks/useDebt';
import { formatNumber } from '@/lib/formatNumber';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, History, Phone, Building2, Filter, Pencil, ChevronDown, ChevronRight, Package, Wallet, Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { EditCustomerDebtDialog } from './EditCustomerDebtDialog';
import { DebtPaymentDialog } from './DebtPaymentDialog';
import { DebtAdditionDialog } from './DebtAdditionDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DebtDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'customer' | 'supplier';
  entityId: string;
  entityName: string;
  entityPhone: string | null;
  branchName: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  branchId?: string | null;
  mergedEntityIds?: string[];
}

export function DebtDetailDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  entityPhone,
  branchName,
  totalAmount,
  paidAmount,
  remainingAmount,
  branchId,
  mergedEntityIds,
}: DebtDetailDialogProps) {
  const [historyFilter, setHistoryFilter] = useState<'all' | 'addition' | 'payment'>('all');
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showAddition, setShowAddition] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [onlyShowDebt, setOnlyShowDebt] = useState(true);
  const { data: allReceipts, isLoading: receiptsLoading } = useDebtDetail(entityType, entityId, mergedEntityIds);
  const { data: paymentHistory, isLoading: historyLoading } = useDebtPaymentHistory(entityType, entityId, mergedEntityIds);

  // Use all receipts - filtering is done in the UI based on checkbox
  const receipts = useMemo(() => {
    if (!allReceipts) return [];
    return allReceipts;
  }, [allReceipts]);

  // Reliable formula (same as list view):
  // remaining = sum(receipt.debt_amount) + sum(addition remaining)
  // total_paid = sum(payments)
  // total_debt = remaining + total_paid
  const liveTotals = useMemo(() => {
    const currentDebtFromReceipts = (allReceipts || []).reduce((sum: number, r: any) => {
      return sum + (Number(r.debt_amount) || 0);
    }, 0);

    const additionsData = (paymentHistory || []).filter((p: any) => p.payment_type === 'addition');
    const additionsRemaining = additionsData.reduce((sum: number, p: any) => 
      sum + (Number(p.amount) - (Number(p.allocated_amount) || 0)), 0);
    const totalFromAdditions = additionsData.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    
    const totalPaid = (paymentHistory || [])
      .filter((p: any) => p.payment_type === 'payment')
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

    const remaining = currentDebtFromReceipts + additionsRemaining;
    const totalDebt = remaining + totalPaid;
    const totalFromOrders = totalDebt - totalFromAdditions;
    return { totalAmount: totalDebt, paidAmount: totalPaid, remainingAmount: remaining, totalFromOrders, totalFromAdditions };
  }, [allReceipts, paymentHistory]);

  const liveTotal = liveTotals.totalAmount;
  const livePaid = liveTotals.paidAmount;
  const liveRemaining = liveTotals.remainingAmount;

  // Calculate total sales amount from all receipts (to derive "paid at checkout")
  const totalSalesAmount = useMemo(() => {
    if (!allReceipts) return 0;
    return allReceipts.reduce((sum: number, r: any) => sum + (Number(r.total_amount) || 0), 0);
  }, [allReceipts]);

  const paidAtCheckout = totalSalesAmount - liveTotal;

  // Use stored balance_after from DB (immutable history)
  // For old records without balance_after, fall back to dynamic calculation
  const enrichedHistory = useMemo(() => {
    if (!paymentHistory) return [];

    // Sort descending (newest first)
    const sorted = [...paymentHistory].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // For records without stored balance_after, calculate dynamically as fallback
    // Work backwards from current remaining amount
    let balance = liveRemaining;
    const enriched = sorted.map(payment => {
      const storedBalance = (payment as any).balance_after;
      if (storedBalance != null) {
        // Use permanently stored value - immutable history
        return {
          ...payment,
          balance_after: Number(storedBalance),
        };
      }
      // Fallback for old records without stored balance
      const balanceAfterThis = balance;
      if (payment.payment_type === 'addition') {
        balance -= Number(payment.amount);
      } else {
        balance += Number(payment.amount);
      }
      return {
        ...payment,
        balance_after: balanceAfterThis,
      };
    });

    // Apply filter
    if (historyFilter === 'all') return enriched;
    return enriched.filter(p => p.payment_type === historyFilter);
  }, [paymentHistory, historyFilter, liveRemaining]);

  const additionCount = paymentHistory?.filter(p => p.payment_type === 'addition').length || 0;
  const paymentCount = paymentHistory?.filter(p => p.payment_type === 'payment').length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex flex-col gap-1">
            <span>Chi tiết công nợ</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
        {/* Header Summary */}
        <Card className="bg-muted/50 relative shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={() => setShowEditCustomer(true)}
            title="Sửa thông tin"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-bold text-primary">
                  {entityName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-semibold">{entityName}</p>
                {entityPhone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {entityPhone}
                  </p>
                )}
              </div>
              {branchName && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{branchName}</span>
                </div>
              )}
            </div>

            {/* Row 1: Tổng đơn hàng & Trả tại quầy */}
            {paidAtCheckout > 0 && (
              <div className="flex items-center justify-between text-sm mb-2 pb-2 border-b border-dashed">
                <div>
                  <span className="text-muted-foreground">Tổng đơn hàng: </span>
                  <span className="font-medium">{formatNumber(totalSalesAmount)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Trả tại quầy: </span>
                  <span className="font-medium text-blue-600">{formatNumber(paidAtCheckout)}</span>
                </div>
              </div>
            )}

            {/* Row 2: Tổng nợ, Đã thu, Còn lại */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div>
                <p className="text-sm text-muted-foreground">Tổng nợ</p>
                <p className="font-semibold">{formatNumber(liveTotal)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  {entityType === 'customer' ? 'Đã thu nợ' : 'Đã trả nợ'}
                </p>
                <p className="font-semibold text-green-600">{formatNumber(livePaid)}</p>
              </div>
            </div>

            <div className="flex justify-end mt-1">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Còn lại</p>
                <p className="text-xl font-bold text-destructive">{formatNumber(liveRemaining)}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <Button
                size="sm"
                variant="default"
                className="flex-1 gap-1"
                onClick={() => setShowPayment(true)}
                disabled={liveRemaining <= 0}
              >
                <Wallet className="h-4 w-4" />
                Thu nợ
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1"
                onClick={() => setShowAddition(true)}
              >
                <Plus className="h-4 w-4" />
                Thêm nợ
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="orders" className="flex flex-col">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Đơn hàng phát sinh</span>
              <span className="sm:hidden">Đơn hàng</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">
                Lịch sử {entityType === 'customer' ? 'thu' : 'trả'} nợ
              </span>
              <span className="sm:hidden">Lịch sử</span>
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders" className="flex-1 mt-4 min-h-0">
            {/* Summary breakdown */}
            <div className="grid grid-cols-3 gap-2 mb-3 p-3 rounded-lg bg-muted/50 text-sm">
              <div>
                <p className="text-muted-foreground">Nợ từ đơn hàng</p>
                <p className="font-semibold">{formatNumber(liveTotals.totalFromOrders)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Nợ từ phiếu thêm</p>
                <p className="font-semibold">{formatNumber(liveTotals.totalFromAdditions)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tổng nợ</p>
                <p className="font-bold">{formatNumber(liveTotal)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Checkbox
                id="only-debt"
                checked={onlyShowDebt}
                onCheckedChange={(v) => setOnlyShowDebt(!!v)}
              />
              <Label htmlFor="only-debt" className="text-sm cursor-pointer">
                Chỉ hiển thị đơn có công nợ
              </Label>
            </div>

            <div>
              {receiptsLoading || historyLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (() => {
                // Combine receipt rows and addition rows
                const debtAdditions = (paymentHistory || [])
                  .filter(p => p.payment_type === 'addition')
                  .map(p => ({
                    id: p.id,
                    type: 'addition' as const,
                    date: p.created_at,
                    code: null,
                    amount: Number(p.amount),
                    allocatedAmount: Number(p.allocated_amount) || 0,
                    remainingDebt: Number(p.amount) - (Number(p.allocated_amount) || 0),
                    isFullyPaid: (Number(p.allocated_amount) || 0) >= Number(p.amount),
                    description: p.description,
                    createdBy: p.profiles?.display_name || null,
                    storedBalance: (p as any).balance_after != null ? Number((p as any).balance_after) : null,
                  }));

                const receiptRows = (receipts || []).map((r: any) => {
                  // Use original_debt_amount if available and > 0, otherwise calculate from total - paid
                  const storedOriginal = Number(r.original_debt_amount) || 0;
                  const calculatedOriginal = Math.max((Number(r.total_amount) || 0) - (Number(r.paid_amount) || 0), 0);
                  const originalDebt = storedOriginal > 0 ? storedOriginal : calculatedOriginal;
                  const currentDebt = Number(r.debt_amount) || 0;
                  const isFullyPaid = currentDebt === 0 && originalDebt > 0;
                  return {
                    id: r.id,
                    type: 'order' as const,
                    date: entityType === 'customer' ? r.export_date : r.import_date,
                    code: r.code,
                    totalAmount: Number(r.total_amount) || 0,
                    originalDebt,
                    currentDebt,
                    isFullyPaid,
                    receipt: r,
                  };
                });

                // Include payment entries to calculate actual remaining balance
                const paymentEntries = (paymentHistory || [])
                  .filter(p => p.payment_type === 'payment')
                  .map(p => ({
                    id: p.id,
                    type: 'payment' as const,
                    date: p.created_at,
                    sortDate: new Date(p.created_at).getTime(),
                    amount: Number(p.amount),
                    description: p.description,
                    createdBy: p.profiles?.display_name || null,
                    storedBalance: (p as any).balance_after != null ? Number((p as any).balance_after) : null,
                  }));

                // Merge and sort by date ascending for running balance
                const allItems = [
                  ...receiptRows.map(r => ({ ...r, sortDate: new Date(r.date).getTime() })),
                  ...debtAdditions.map(a => ({ ...a, sortDate: new Date(a.date).getTime() })),
                  ...paymentEntries,
                ].sort((a, b) => a.sortDate - b.sortDate);

                // Calculate running balance (oldest to newest) - includes payments as deductions
                let runningBalance = 0;
                const itemsWithBalance = allItems.map(item => {
                  if (item.type === 'order') {
                    runningBalance += (item as any).originalDebt;
                  } else if (item.type === 'addition') {
                    runningBalance += (item as any).amount;
                  } else if (item.type === 'payment') {
                    runningBalance -= (item as any).amount;
                  }
                  return { ...item, runningBalance };
                });

                // Reverse to show newest first
                const sortedItems = [...itemsWithBalance].reverse();

                const filteredItems = onlyShowDebt
                  ? sortedItems.filter(item => {
                      if (item.type === 'payment') return true; // Always show payments for balance context
                      if (item.type === 'addition') return !(item as any).isFullyPaid;
                      return (item as any).originalDebt > 0;
                    })
                  : sortedItems;

                if (filteredItems.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      Không có dữ liệu phát sinh công nợ
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {filteredItems.map((item) => {
                      if (item.type === 'order') {
                        const r = item as typeof receiptRows[0];
                        return (
                          <div
                            key={r.id}
                            className={`border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors ${r.isFullyPaid ? 'bg-muted/30 opacity-80' : 'bg-card'}`}
                            onClick={() => setSelectedReceipt(r.receipt)}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
                                Đơn hàng
                              </Badge>
                              {r.isFullyPaid && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800">
                                  Đã trả hết
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(r.date), 'dd/MM/yyyy', { locale: vi })}
                              </span>
                              <span className="text-xs font-mono text-muted-foreground ml-auto">{r.code}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <div className="text-muted-foreground">
                                Tổng: {formatNumber(r.totalAmount)}
                                {r.totalAmount - r.originalDebt > 0 && (
                                  <span className="ml-2">· Trả tại quầy: {formatNumber(r.totalAmount - r.originalDebt)}</span>
                                )}
                              </div>
                              <span className={`font-semibold ${r.isFullyPaid ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                                {formatNumber(r.originalDebt)}
                                {r.isFullyPaid && <span className="text-xs ml-1">✓</span>}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 pt-1 border-t border-dashed">
                              Dư nợ tại thời điểm: <span className="font-semibold text-foreground">{formatNumber((item as any).runningBalance)}</span>
                            </div>
                          </div>
                        );
                      } else if (item.type === 'payment') {
                        const p = item as typeof paymentEntries[0];
                        return (
                          <div
                            key={p.id}
                            className="border border-green-200 rounded-lg p-3 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300">
                                Trả nợ
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(p.date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <div>
                                <p className="truncate text-muted-foreground">{p.description}</p>
                                {p.createdBy && (
                                  <p className="text-xs text-muted-foreground">Người thu: {p.createdBy}</p>
                                )}
                              </div>
                              <span className="font-semibold shrink-0 text-green-600 dark:text-green-400">
                                -{formatNumber(p.amount)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 pt-1 border-t border-dashed">
                              Dư nợ tại thời điểm: <span className="font-semibold text-foreground">{formatNumber((item as any).storedBalance != null ? (item as any).storedBalance : (item as any).runningBalance)}</span>
                            </div>
                          </div>
                        );
                      } else {
                        const a = item as typeof debtAdditions[0];
                        return (
                          <div
                            key={a.id}
                            className={`border rounded-lg p-3 ${a.isFullyPaid ? 'border-muted bg-muted/30 opacity-80' : 'border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/30'}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300">
                                Phiếu thêm nợ
                              </Badge>
                              {a.isFullyPaid && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800">
                                  Đã trả hết
                                </Badge>
                              )}
                              {!a.isFullyPaid && a.allocatedAmount > 0 && (
                                <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800">
                                  Đã trả một phần
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(a.date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <div>
                                <p className="truncate">{a.description}</p>
                                {a.createdBy && (
                                  <p className="text-xs text-muted-foreground">Người tạo: {a.createdBy}</p>
                                )}
                                {a.allocatedAmount > 0 && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Đã trả: <span className="text-green-600 dark:text-green-400">{formatNumber(a.allocatedAmount)}</span>
                                    {!a.isFullyPaid && <span> · Còn: <span className="text-destructive">{formatNumber(a.remainingDebt)}</span></span>}
                                  </p>
                                )}
                              </div>
                              <span className={`font-semibold shrink-0 ${a.isFullyPaid ? 'text-green-600 dark:text-green-400' : 'text-orange-600'}`}>
                                +{formatNumber(a.amount)}
                                {a.isFullyPaid && <span className="text-xs ml-1">✓</span>}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 pt-1 border-t border-dashed">
                              Dư nợ tại thời điểm: <span className="font-semibold text-foreground">{formatNumber((item as any).runningBalance)}</span>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                );
              })()}
            </div>
          </TabsContent>

          {/* Payment History Tab */}
          <TabsContent value="history" className="flex-1 mt-4 min-h-0">
            {/* Filter */}
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={historyFilter} onValueChange={(v) => setHistoryFilter(v as any)}>
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả ({(additionCount + paymentCount)})</SelectItem>
                  <SelectItem value="addition">Lịch sử thêm nợ ({additionCount})</SelectItem>
                  <SelectItem value="payment">Lịch sử trả nợ ({paymentCount})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              {historyLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : enrichedHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {historyFilter === 'all'
                    ? `Chưa có lịch sử ${entityType === 'customer' ? 'thu' : 'trả'} nợ`
                    : historyFilter === 'addition'
                    ? 'Chưa có lịch sử thêm nợ'
                    : 'Chưa có lịch sử trả nợ'}
                </div>
              ) : (
                <div className="space-y-3">
                  {enrichedHistory.map((payment) => {
                    const isAddition = payment.payment_type === 'addition';
                    return (
                      <div
                        key={payment.id}
                        className={`rounded-lg border p-3 ${
                          isAddition
                            ? 'border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/30'
                            : 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="outline"
                                className={`text-xs shrink-0 ${
                                  isAddition
                                    ? 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300'
                                    : 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300'
                                }`}
                              >
                                {isAddition ? 'Cộng nợ' : 'Trả nợ'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                              </span>
                            </div>

                            <p className="text-sm truncate">{payment.description}</p>

                            {payment.profiles?.display_name && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {isAddition ? 'Người tạo' : 'Người thu'}: {payment.profiles.display_name}
                              </p>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <p className={`font-semibold ${isAddition ? 'text-orange-600' : 'text-green-600'}`}>
                              {isAddition ? '+' : '-'}{formatNumber(payment.amount)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Còn nợ: <span className="font-medium text-destructive">{formatNumber(payment.balance_after)}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary */}
            {paymentHistory && paymentHistory.length > 0 && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Tổng nợ</p>
                    <p className="font-semibold">{formatNumber(liveTotal)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Đã {entityType === 'customer' ? 'thu' : 'trả'}
                    </p>
                    <p className="font-semibold text-green-600">{formatNumber(livePaid)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Còn lại</p>
                    <p className="font-semibold text-destructive">{formatNumber(liveRemaining)}</p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
        </div>
      </DialogContent>

      {entityType === 'customer' && (
        <EditCustomerDebtDialog
          open={showEditCustomer}
          onOpenChange={setShowEditCustomer}
          customerId={entityId}
          customerName={entityName}
          customerPhone={entityPhone}
          branchName={branchName}
        />
      )}

      <DebtPaymentDialog
        open={showPayment}
        onOpenChange={setShowPayment}
        entityType={entityType}
        entityId={entityId}
        entityName={entityName}
        remainingAmount={liveRemaining}
        branchId={branchId || undefined}
      />

      <DebtAdditionDialog
        open={showAddition}
        onOpenChange={setShowAddition}
        entityType={entityType}
        entityId={entityId}
        entityName={entityName}
        remainingAmount={liveRemaining}
        branchId={branchId || undefined}
      />

      {/* Receipt Detail Popup */}
      <Dialog open={!!selectedReceipt} onOpenChange={(open) => !open && setSelectedReceipt(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Chi tiết phiếu {selectedReceipt?.code}
            </DialogTitle>
          </DialogHeader>

          <div className="text-sm text-muted-foreground mb-2">
            {selectedReceipt && format(
              new Date(entityType === 'customer' ? selectedReceipt.export_date : selectedReceipt.import_date),
              'dd/MM/yyyy HH:mm',
              { locale: vi }
            )}
            {' · '}Tổng: <span className="font-semibold text-foreground">{formatNumber(selectedReceipt?.total_amount || 0)}</span>
            {selectedReceipt?.debt_amount > 0 && (
              <span> · Nợ: <span className="font-semibold text-destructive">{formatNumber(selectedReceipt.debt_amount)}</span></span>
            )}
          </div>

          <div>
            <div className="space-y-2 pr-2">
              {(() => {
                const items = entityType === 'customer'
                  ? selectedReceipt?.export_receipt_items || []
                  : selectedReceipt?.products || [];

                if (items.length === 0) {
                  return (
                    <div className="text-center py-6 text-muted-foreground">
                      Không có sản phẩm
                    </div>
                  );
                }

                return items.map((item: any, idx: number) => {
                  const name = entityType === 'customer' ? item.product_name : item.name;
                  const price = entityType === 'customer' ? item.sale_price : item.import_price;
                  return (
                    <div key={item.id || idx} className="border rounded-lg p-3 bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{name}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                            {item.sku && (
                              <span className="text-xs text-muted-foreground">SKU: {item.sku}</span>
                            )}
                            {item.imei && (
                              <Badge variant="outline" className="text-xs font-mono">
                                IMEI: {item.imei}
                              </Badge>
                            )}
                          </div>
                          {item.note && (
                            <p className="text-xs text-muted-foreground mt-1 italic">{item.note}</p>
                          )}
                        </div>
                        <p className="font-semibold text-sm shrink-0">
                          {formatNumber(price || 0)}
                        </p>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {selectedReceipt?.note && (
            <div className="mt-2 p-2 bg-muted/50 rounded text-sm text-muted-foreground">
              <span className="font-medium">Ghi chú:</span> {selectedReceipt.note}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
