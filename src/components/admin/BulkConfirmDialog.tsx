import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle, Package } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { LandingOrder, useUpdateLandingOrder } from '@/hooks/useLandingOrders';
import { useCustomPaymentSources } from '@/hooks/useCustomPaymentSources';
import { toast } from 'sonner';

interface StaffItem {
  id: string;
  display_name: string;
  user_role: string;
}

interface BulkConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: LandingOrder[];
  staffList: StaffItem[];
  onSuccess: () => void;
}

const DEFAULT_PAYMENT_SOURCES = [
  { id: 'cash', name: 'Tiền mặt' },
  { id: 'bank_card', name: 'Ngân hàng' },
  { id: 'e_wallet', name: 'Ví điện tử' },
];

export function BulkConfirmDialog({ open, onOpenChange, orders, staffList, onSuccess }: BulkConfirmDialogProps) {
  const updateOrder = useUpdateLandingOrder();
  const { data: customSources } = useCustomPaymentSources();

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set(orders.map(o => o.id)));
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedPaymentSource, setSelectedPaymentSource] = useState('cash');
  const [processing, setProcessing] = useState(false);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());

  // Reset state when orders change
  const pendingOrders = orders.filter(o => o.status === 'pending');

  const allPaymentSources = [
    ...DEFAULT_PAYMENT_SOURCES,
    ...(customSources || []).map(s => ({ id: s.id, name: s.name })),
  ];

  const toggleAll = () => {
    if (selectedOrderIds.size === pendingOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(pendingOrders.map(o => o.id)));
    }
  };

  const toggleOrder = (id: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmAll = async () => {
    const toProcess = pendingOrders.filter(o => selectedOrderIds.has(o.id));
    if (toProcess.length === 0) {
      toast.error('Chưa chọn đơn nào');
      return;
    }

    if (!selectedStaffId) {
      toast.error('Vui lòng chọn nhân viên');
      return;
    }

    const staff = staffList.find(s => s.id === selectedStaffId);
    setProcessing(true);
    const newProcessed = new Set<string>();

    try {
      // Process each order sequentially to avoid race conditions
      for (const order of toProcess) {
        try {
          await updateOrder.mutateAsync({
            id: order.id,
            status: 'approved',
            delivery_status: 'preparing',
            approved_at: new Date().toISOString(),
            assigned_staff_id: selectedStaffId,
            assigned_staff_name: staff?.display_name || null,
            payment_method: selectedPaymentSource as any,
          } as any);
          newProcessed.add(order.id);
          setProcessedIds(prev => new Set([...prev, order.id]));
        } catch (err) {
          console.error(`Failed to process order ${order.id}:`, err);
        }
      }

      const successCount = newProcessed.size;
      const failCount = toProcess.length - successCount;

      if (successCount > 0) {
        toast.success(`Đã xác nhận ${successCount} đơn hàng thành công${failCount > 0 ? `, ${failCount} đơn lỗi` : ''}`);
      }
      if (failCount > 0 && successCount === 0) {
        toast.error('Không thể xác nhận đơn hàng');
      }

      onSuccess();
      onOpenChange(false);
    } finally {
      setProcessing(false);
      setProcessedIds(new Set());
      setSelectedOrderIds(new Set());
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !processing) { onOpenChange(false); setProcessedIds(new Set()); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Xác nhận hàng loạt ({pendingOrders.length} đơn chờ duyệt)
          </DialogTitle>
        </DialogHeader>

        {/* Order list */}
        <div className="flex-1 overflow-y-auto min-h-0 border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={pendingOrders.length > 0 && selectedOrderIds.size === pendingOrders.length}
                    onCheckedChange={toggleAll}
                    disabled={processing}
                  />
                </TableHead>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Sản phẩm</TableHead>
                <TableHead className="text-right">Giá</TableHead>
                <TableHead className="text-center">SL</TableHead>
                <TableHead className="w-16">TT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingOrders.map(order => (
                <TableRow key={order.id} className={processedIds.has(order.id) ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={selectedOrderIds.has(order.id)}
                      onCheckedChange={() => toggleOrder(order.id)}
                      disabled={processing || processedIds.has(order.id)}
                    />
                  </TableCell>
                  <TableCell className="text-xs font-mono">{order.order_code || '—'}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{order.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {order.product_image_url ? (
                        <img src={order.product_image_url} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm truncate max-w-[180px]">{order.product_name}</p>
                        {order.variant && <Badge variant="outline" className="text-[10px]">{order.variant}</Badge>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatNumber(order.product_price)}đ</TableCell>
                  <TableCell className="text-center text-sm">{order.quantity}</TableCell>
                  <TableCell>
                    {processedIds.has(order.id) ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {pendingOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Không có đơn hàng chờ duyệt nào được chọn
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Staff + Payment selection */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nhân viên xử lý <span className="text-destructive">*</span></label>
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId} disabled={processing}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn nhân viên..." />
              </SelectTrigger>
              <SelectContent>
                {staffList.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Dòng tiền</label>
            <Select value={selectedPaymentSource} onValueChange={setSelectedPaymentSource} disabled={processing}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn dòng tiền..." />
              </SelectTrigger>
              <SelectContent>
                {allPaymentSources.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-muted/30 rounded-lg p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Số đơn sẽ xác nhận:</span>
            <span className="font-bold">{selectedOrderIds.size}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-muted-foreground">Tổng giá trị:</span>
            <span className="font-bold text-primary">
              {formatNumber(pendingOrders.filter(o => selectedOrderIds.has(o.id)).reduce((sum, o) => sum + o.product_price * o.quantity, 0))}đ
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>Đóng</Button>
          <Button
            onClick={handleConfirmAll}
            disabled={processing || selectedOrderIds.size === 0 || !selectedStaffId}
            className="gap-1"
          >
            {processing && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận {selectedOrderIds.size} đơn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
