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
import { Checkbox } from '@/components/ui/checkbox';
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
import { FileText, History, Phone, Building2, Filter } from 'lucide-react';
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
  const [showOnlyUnpaid, setShowOnlyUnpaid] = useState(true);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'addition' | 'payment'>('all');
  const { data: receipts, isLoading: receiptsLoading } = useDebtDetail(entityType, entityId);
  const { data: paymentHistory, isLoading: historyLoading } = useDebtPaymentHistory(entityType, entityId);

  // Filter and enrich payment history with running balance
  const enrichedHistory = useMemo(() => {
    if (!paymentHistory) return [];

    // Sort ascending by time to calculate running balance
    const sorted = [...paymentHistory].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let runningTotal = 0;
    let runningPaid = 0;
    const enriched = sorted.map(payment => {
      if (payment.payment_type === 'addition') {
        runningTotal += Number(payment.amount);
      } else {
        runningPaid += Number(payment.amount);
      }
      return {
        ...payment,
        balance_after: runningTotal - runningPaid,
      };
    });

    // Reverse to show newest first
    enriched.reverse();

    // Apply filter
    if (historyFilter === 'all') return enriched;
    return enriched.filter(p => p.payment_type === historyFilter);
  }, [paymentHistory, historyFilter]);

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
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">
                    {entityName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold">{entityName}</p>
                  {entityPhone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {entityPhone}
                    </p>
                  )}
                </div>
              </div>
              
              {branchName && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{branchName}</span>
                </div>
              )}

              <div className="text-center md:text-right">
                <p className="text-sm text-muted-foreground">Tổng nợ</p>
                <p className="font-semibold">{formatNumber(totalAmount)}</p>
              </div>

              <div className="text-center md:text-right">
                <p className="text-sm text-muted-foreground">
                  {entityType === 'customer' ? 'Đã thu' : 'Đã trả'}
                </p>
                <p className="font-semibold text-green-600">{formatNumber(paidAmount)}</p>
              </div>

              <div className="col-span-2 md:col-span-4 flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Còn lại</p>
                  <p className="text-xl font-bold text-destructive">{formatNumber(remainingAmount)}</p>
                </div>
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
            <div className="flex items-center gap-2 mb-3">
              <Checkbox
                id="showOnlyUnpaid"
                checked={showOnlyUnpaid}
                onCheckedChange={(checked) => setShowOnlyUnpaid(checked === true)}
              />
              <Label htmlFor="showOnlyUnpaid" className="text-sm cursor-pointer">
                Chỉ hiển thị các đơn còn công nợ
              </Label>
            </div>

            <ScrollArea className="h-[300px]">
              {receiptsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !receipts || receipts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Không có đơn hàng phát sinh công nợ
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{entityType === 'customer' ? 'Ngày bán' : 'Ngày nhập'}</TableHead>
                      <TableHead>Mã phiếu</TableHead>
                      <TableHead className="hidden md:table-cell">Sản phẩm</TableHead>
                      <TableHead className="text-right">
                        {entityType === 'customer' ? 'Giá bán' : 'Giá nhập'}
                      </TableHead>
                      <TableHead className="text-right">Công nợ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.map((receipt: any) => (
                      <TableRow key={receipt.id}>
                        <TableCell>
                          {format(
                            new Date(entityType === 'customer' ? receipt.export_date : receipt.import_date),
                            'dd/MM/yyyy',
                            { locale: vi }
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{receipt.code}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {entityType === 'customer'
                            ? receipt.export_receipt_items?.map((item: any) => item.product_name).join(', ')
                            : receipt.products?.map((item: any) => item.name).join(', ')}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(receipt.total_amount)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-destructive">
                          {formatNumber(receipt.debt_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
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
    </Dialog>
  );
}
