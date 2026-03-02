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
import { FileText, History, Phone, Building2, Filter, Pencil, ChevronDown, ChevronRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditCustomerDebtDialog } from './EditCustomerDebtDialog';
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
}: DebtDetailDialogProps) {
  const [historyFilter, setHistoryFilter] = useState<'all' | 'addition' | 'payment'>('all');
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const { data: allReceipts, isLoading: receiptsLoading } = useDebtDetail(entityType, entityId);
  const { data: paymentHistory, isLoading: historyLoading } = useDebtPaymentHistory(entityType, entityId);

  // Filter receipts: only show orders that originally had debt (total_amount - paid_amount > 0)
  const receipts = useMemo(() => {
    if (!allReceipts) return [];
    // Only include receipts that originally had debt
    return allReceipts.filter((r: any) => {
      const originalDebt = (Number(r.total_amount) || 0) - (Number(r.paid_amount) || 0);
      return originalDebt > 0;
    });
  }, [allReceipts]);

  // Calculate total sales amount from all receipts (to derive "paid at checkout")
  const totalSalesAmount = useMemo(() => {
    if (!allReceipts) return 0;
    return allReceipts.reduce((sum: number, r: any) => sum + (Number(r.total_amount) || 0), 0);
  }, [allReceipts]);

  const paidAtCheckout = totalSalesAmount - totalAmount; // total sales - original debt = paid at checkout

  // Filter and enrich payment history with running balance
  // Calculate backwards from current remainingAmount for accuracy
  const enrichedHistory = useMemo(() => {
    if (!paymentHistory) return [];

    // Sort descending (newest first)
    const sorted = [...paymentHistory].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Work backwards from current remaining amount
    let balance = remainingAmount;
    const enriched = sorted.map(payment => {
      const balanceAfterThis = balance;
      // Reverse the effect to get balance before this entry
      if (payment.payment_type === 'addition') {
        balance -= Number(payment.amount); // before this addition, balance was lower
      } else {
        balance += Number(payment.amount); // before this payment, balance was higher
      }
      return {
        ...payment,
        balance_after: balanceAfterThis,
      };
    });

    // Apply filter
    if (historyFilter === 'all') return enriched;
    return enriched.filter(p => p.payment_type === historyFilter);
  }, [paymentHistory, historyFilter, remainingAmount]);

  const additionCount = paymentHistory?.filter(p => p.payment_type === 'addition').length || 0;
  const paymentCount = paymentHistory?.filter(p => p.payment_type === 'payment').length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            <span>Chi tiết công nợ</span>
          </DialogTitle>
        </DialogHeader>

        {/* Header Summary */}
        <Card className="bg-muted/50 relative">
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
                <p className="font-semibold">{formatNumber(totalAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  {entityType === 'customer' ? 'Đã thu nợ' : 'Đã trả nợ'}
                </p>
                <p className="font-semibold text-green-600">{formatNumber(paidAmount)}</p>
              </div>
            </div>

            <div className="flex justify-end mt-1">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Còn lại</p>
                <p className="text-xl font-bold text-destructive">{formatNumber(remainingAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="orders" className="flex-1 flex flex-col min-h-0">
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
            {(() => {
              const totalFromOrders = allReceipts?.reduce((sum: number, r: any) => {
                const debtOnReceipt = Number(r.debt_amount) || 0;
                // Original debt = current debt_amount + what was already paid via FIFO
                // We use total_amount - paid_amount approach or just debt_amount
                return sum + debtOnReceipt;
              }, 0) || 0;

              // Also need to account for original debt from receipts that have been fully paid
              // Use the receipt's original debt: total_amount - (total_amount - debt_amount at creation)
              // Since debt_amount gets reduced by FIFO, we need original value
              // For now: total debt from orders = totalAmount - totalFromAdditions
              const totalFromAdditions = paymentHistory
                ?.filter(p => p.payment_type === 'addition')
                .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

              const totalFromOrdersCalc = totalAmount - totalFromAdditions;

              return (
                <div className="grid grid-cols-3 gap-2 mb-3 p-3 rounded-lg bg-muted/50 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nợ từ đơn hàng</p>
                    <p className="font-semibold">{formatNumber(totalFromOrdersCalc)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Nợ từ phiếu thêm</p>
                    <p className="font-semibold">{formatNumber(totalFromAdditions)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tổng nợ</p>
                    <p className="font-bold">{formatNumber(totalAmount)}</p>
                  </div>
                </div>
              );
            })()}

            {/* No filter checkbox needed - all debt-originating orders always shown */}

            <ScrollArea className="h-[280px]">
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
                    description: p.description,
                    createdBy: p.profiles?.display_name || null,
                  }));

                const receiptRows = (receipts || []).map((r: any) => {
                  const originalDebt = (Number(r.total_amount) || 0) - (Number(r.paid_amount) || 0);
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

                // Merge and sort by date descending
                const allItems = [
                  ...receiptRows.map(r => ({ ...r, sortDate: new Date(r.date).getTime() })),
                  ...debtAdditions.map(a => ({ ...a, sortDate: new Date(a.date).getTime() })),
                ].sort((a, b) => b.sortDate - a.sortDate);

                if (allItems.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      Không có dữ liệu phát sinh công nợ
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {allItems.map((item) => {
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
                              <span className={`font-semibold ${r.isFullyPaid ? 'text-muted-foreground line-through' : 'text-destructive'}`}>
                                {formatNumber(r.originalDebt)}
                              </span>
                            </div>
                          </div>
                        );
                      } else {
                        const a = item as typeof debtAdditions[0];
                        return (
                          <div
                            key={a.id}
                            className="border rounded-lg p-3 border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/30"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300">
                                Phiếu thêm nợ
                              </Badge>
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
                              </div>
                              <span className="font-semibold text-orange-600 shrink-0">
                                +{formatNumber(a.amount)}
                              </span>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                );
              })()}
            </ScrollArea>
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

            <ScrollArea className="h-[300px]">
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
            </ScrollArea>

            {/* Summary */}
            {paymentHistory && paymentHistory.length > 0 && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Tổng nợ</p>
                    <p className="font-semibold">{formatNumber(totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Đã {entityType === 'customer' ? 'thu' : 'trả'}
                    </p>
                    <p className="font-semibold text-green-600">{formatNumber(paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Còn lại</p>
                    <p className="font-semibold text-destructive">{formatNumber(remainingAmount)}</p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
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

      {/* Receipt Detail Popup */}
      <Dialog open={!!selectedReceipt} onOpenChange={(open) => !open && setSelectedReceipt(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
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

          <ScrollArea className="flex-1 max-h-[60vh]">
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
          </ScrollArea>

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
