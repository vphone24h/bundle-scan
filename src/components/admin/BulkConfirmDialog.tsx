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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

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

export function BulkConfirmDialog({ open, onOpenChange, orders, staffList, onSuccess }: BulkConfirmDialogProps) {
  const updateOrder = useUpdateLandingOrder();
  const queryClient = useQueryClient();

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());

  const pendingOrders = orders.filter(o => o.status === 'pending');

  // Auto-select all pending on open
  const initSelection = () => {
    setSelectedOrderIds(new Set(pendingOrders.map(o => o.id)));
    setProcessedIds(new Set());
  };

  const toggleAll = () => {
    if (selectedOrderIds.size === pendingOrders.length && pendingOrders.length > 0) {
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
      toast.error('Không có đơn nào được chọn');
      return;
    }
    if (!selectedStaffId) {
      toast.error('Vui lòng chọn nhân viên');
      return;
    }

    const staff = staffList.find(s => s.id === selectedStaffId);
    setProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const order of toProcess) {
      try {
        await updateOrder.mutateAsync({
          id: order.id,
          status: 'approved',
          delivery_status: 'confirmed',
          approved_at: new Date().toISOString(),
          assigned_staff_id: selectedStaffId,
          assigned_staff_name: staff?.display_name || null,
        } as any);

        setProcessedIds(prev => new Set([...prev, order.id]));
        successCount++;

        // Send confirmation email if available
        if (order.customer_email) {
          supabase.functions.invoke('send-order-email', {
            body: {
              tenant_id: order.tenant_id,
              order_id: order.id,
              customer_name: order.customer_name,
              customer_email: order.customer_email,
              customer_phone: order.customer_phone,
              product_name: order.product_name,
              product_price: order.product_price,
              order_code: (order as any).order_code || '',
              variant: order.variant,
              quantity: order.quantity,
              branch_id: order.branch_id,
              email_type: 'order_confirmed',
            },
          }).catch(err => console.warn('Order confirmed email failed:', err));
        }
      } catch (err: any) {
        console.error(`Failed to confirm order ${order.id}:`, err);
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Đã xác nhận ${successCount} đơn${failCount > 0 ? `, ${failCount} đơn lỗi` : ''}`);
      queryClient.invalidateQueries({ queryKey: ['landing-orders'] });
      queryClient.invalidateQueries({ queryKey: ['landing-orders-pending-count'] });
    }
    if (failCount > 0 && successCount === 0) {
      toast.error('Không thể xử lý đơn hàng');
    }

    setProcessing(false);
    if (successCount > 0) {
      onSuccess();
      onOpenChange(false);
    }
  };

  const totalValue = pendingOrders
    .filter(o => selectedOrderIds.has(o.id))
    .reduce((sum, o) => sum + o.product_price * o.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={v => {
      if (!v && !processing) onOpenChange(false);
      if (v) initSelection();
    }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Xác nhận hàng loạt ({pendingOrders.length} đơn chờ duyệt)
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Chọn đơn → chọn nhân viên → xác nhận. Nhân viên sẽ tự xử lý xuất hàng sau.
          </p>
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
                <TableHead className="text-center">SL</TableHead>
                <TableHead className="text-right">Thành tiền</TableHead>
                <TableHead className="w-16 text-center">TT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingOrders.map(order => {
                const isDone = processedIds.has(order.id);
                return (
                  <TableRow key={order.id} className={isDone ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedOrderIds.has(order.id)}
                        onCheckedChange={() => toggleOrder(order.id)}
                        disabled={processing || isDone}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono">{(order as any).order_code || '—'}</span>
                    </TableCell>
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
                    <TableCell className="text-center text-sm">{order.quantity}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatNumber(order.product_price * order.quantity)}đ
                    </TableCell>
                    <TableCell className="text-center">
                      {isDone ? (
                        <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Chờ</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {pendingOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Không có đơn hàng chờ duyệt
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Staff selection */}
        <div className="space-y-1.5 pt-2">
          <label className="text-sm font-medium">Nhân viên phụ trách <span className="text-destructive">*</span></label>
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

        {/* Summary */}
        <div className="bg-muted/30 rounded-lg p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Đã chọn:</span>
            <span className="font-bold">{selectedOrderIds.size}/{pendingOrders.length}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-muted-foreground">Tổng giá trị:</span>
            <span className="font-bold text-primary">{formatNumber(totalValue)}đ</span>
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
