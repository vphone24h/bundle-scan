import { useState } from 'react';
import { useLandingOrders, useUpdateLandingOrder, LandingOrder } from '@/hooks/useLandingOrders';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranches } from '@/hooks/useBranches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Phone, CheckCircle, XCircle, Clock, Search, Package, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatNumber } from '@/lib/formatNumber';
import { toast } from 'sonner';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Chờ duyệt', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Đã duyệt', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export function LandingOrdersTab() {
  const { data: permissions } = usePermissions();
  const { data: branches } = useBranches();
  const isSuperAdmin = permissions?.role === 'super_admin';
  const userBranchId = permissions?.branchId;

  // Super Admin xem tất cả, Branch Admin và Staff chỉ xem đơn chi nhánh mình
  const filterBranchId = isSuperAdmin ? null : userBranchId;
  const { data: orders, isLoading } = useLandingOrders(filterBranchId);
  const updateOrder = useUpdateLandingOrder();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [cancelDialogOrder, setCancelDialogOrder] = useState<LandingOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [detailOrder, setDetailOrder] = useState<LandingOrder | null>(null);

  const branchMap = new Map((branches || []).map(b => [b.id, b.name]));

  const filtered = (orders || []).filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      return o.customer_name.toLowerCase().includes(s) ||
        o.customer_phone.includes(s) ||
        o.product_name.toLowerCase().includes(s);
    }
    return true;
  });

  const handleApprove = async (order: LandingOrder) => {
    try {
      await updateOrder.mutateAsync({ id: order.id, status: 'approved', approved_at: new Date().toISOString() });
      toast.success('Đã duyệt đơn hàng');
    } catch { toast.error('Lỗi khi duyệt đơn'); }
  };

  const handleCancel = async () => {
    if (!cancelDialogOrder) return;
    try {
      await updateOrder.mutateAsync({ id: cancelDialogOrder.id, status: 'cancelled', cancelled_reason: cancelReason || undefined });
      setCancelDialogOrder(null);
      setCancelReason('');
      toast.success('Đã hủy đơn hàng');
    } catch { toast.error('Lỗi khi hủy đơn'); }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2" data-tour="landing-orders-filter">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tìm theo tên, SĐT, sản phẩm..." value={searchText} onChange={e => setSearchText(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="pending">Chờ duyệt</SelectItem>
            <SelectItem value="approved">Đã duyệt</SelectItem>
            <SelectItem value="cancelled">Đã hủy</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {(['pending', 'approved', 'cancelled'] as const).map(s => {
          const count = (orders || []).filter(o => o.status === s).length;
          const info = STATUS_MAP[s];
          const Icon = info.icon;
          return (
            <Card key={s} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(s)}>
              <CardContent className="p-3 flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <div>
                  <p className="text-xs text-muted-foreground">{info.label}</p>
                  <p className="text-lg font-bold">{count}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Orders table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Chưa có đơn đặt hàng nào</p>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead>Chi nhánh</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(order => {
                  const st = STATUS_MAP[order.status] || STATUS_MAP.pending;
                  return (
                    <TableRow key={order.id} className="cursor-pointer" onClick={() => setDetailOrder(order)}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(order.created_at), 'dd/MM/yy HH:mm', { locale: vi })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{order.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm line-clamp-1">{order.product_name}</p>
                          {order.variant && <Badge variant="outline" className="text-[10px] mt-0.5">{order.variant}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{branchMap.get(order.branch_id) || '—'}</TableCell>
                      <TableCell>
                        <Badge className={`${st.color} text-[10px]`} variant="secondary">{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                            <a href={`tel:${order.customer_phone}`}><Phone className="h-3.5 w-3.5" /></a>
                          </Button>
                          {order.status === 'pending' && (
                            <>
                              <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => handleApprove(order)}>
                                Duyệt
                              </Button>
                              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setCancelDialogOrder(order)}>
                                Hủy
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Cancel dialog */}
      <Dialog open={!!cancelDialogOrder} onOpenChange={v => !v && setCancelDialogOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hủy đơn hàng</DialogTitle>
          </DialogHeader>
          <div>
            <p className="text-sm mb-2">Lý do hủy đơn (không bắt buộc):</p>
            <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Nhập lý do..." rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOrder(null)}>Đóng</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={updateOrder.isPending}>
              {updateOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Xác nhận hủy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailOrder} onOpenChange={v => !v && setDetailOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chi tiết đơn đặt hàng</DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-4">
              {/* Product info */}
              <div className="flex gap-3">
                {detailOrder.product_image_url ? (
                  <img src={detailOrder.product_image_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-semibold">{detailOrder.product_name}</p>
                  {detailOrder.variant && <Badge variant="outline" className="mt-1">{detailOrder.variant}</Badge>}
                  <p className="font-bold text-primary mt-1">{formatNumber(detailOrder.product_price)}đ</p>
                </div>
              </div>

              {/* Customer info */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Khách hàng:</span>
                  <span className="font-medium">{detailOrder.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SĐT:</span>
                  <a href={`tel:${detailOrder.customer_phone}`} className="font-medium text-primary">{detailOrder.customer_phone}</a>
                </div>
                {detailOrder.customer_address && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Địa chỉ:</span>
                    <span>{detailOrder.customer_address}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chi nhánh:</span>
                  <span>{branchMap.get(detailOrder.branch_id) || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ngày đặt:</span>
                  <span>{format(new Date(detailOrder.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}</span>
                </div>
                {detailOrder.note && (
                  <div>
                    <span className="text-muted-foreground">Ghi chú:</span>
                    <p className="mt-1 bg-muted/50 rounded p-2 text-sm">{detailOrder.note}</p>
                  </div>
                )}
                {detailOrder.cancelled_reason && (
                  <div>
                    <span className="text-muted-foreground">Lý do hủy:</span>
                    <p className="mt-1 bg-red-50 rounded p-2 text-sm text-red-700">{detailOrder.cancelled_reason}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" className="flex-1 gap-2" asChild>
                  <a href={`tel:${detailOrder.customer_phone}`}><Phone className="h-4 w-4" />Gọi khách</a>
                </Button>
                {detailOrder.status === 'pending' && (
                  <>
                    <Button className="flex-1" onClick={() => { handleApprove(detailOrder); setDetailOrder(null); }}>
                      Duyệt đơn
                    </Button>
                    <Button variant="destructive" onClick={() => { setCancelDialogOrder(detailOrder); setDetailOrder(null); }}>
                      Hủy
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
