import { useState } from 'react';
import { useLandingOrders, useUpdateLandingOrder, LandingOrder } from '@/hooks/useLandingOrders';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranches } from '@/hooks/useBranches';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Phone, CheckCircle, XCircle, Clock, Search, Package, Loader2, PhoneCall, PhoneOff, UserPlus, CalendarDays, Tag, Truck, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatNumber } from '@/lib/formatNumber';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Chờ duyệt', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Đã duyệt', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const DELIVERY_STEPS = [
  { key: 'pending', label: 'Chờ xác nhận' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'preparing', label: 'Đang chuẩn bị' },
  { key: 'shipped', label: 'Đã giao ĐVVC' },
  { key: 'delivering', label: 'Đang giao' },
  { key: 'delivered', label: 'Giao thành công' },
];

function getDeliveryStepIndex(status: string, deliveryStatus: string | null): number {
  if (status === 'cancelled') return -1;
  if (status === 'pending') return 0;
  if (status === 'approved' || status === 'confirmed') {
    if (!deliveryStatus || deliveryStatus === 'pending') return 1;
    const map: Record<string, number> = { confirmed: 1, preparing: 2, shipped: 3, delivering: 4, delivered: 5 };
    return map[deliveryStatus] ?? 1;
  }
  return 0;
}

function getNextDeliveryAction(status: string, deliveryStatus: string | null): { label: string; nextStatus?: string; nextDelivery?: string } | null {
  if (status === 'cancelled') return null;
  if (status === 'pending') return { label: 'Xác nhận', nextStatus: 'approved', nextDelivery: 'preparing' };
  const step = getDeliveryStepIndex(status, deliveryStatus);
  if (step >= 5) return null; // delivered
  const nextMap: Record<number, { label: string; nextDelivery: string }> = {
    1: { label: 'Xác nhận', nextDelivery: 'preparing' },
    2: { label: 'Giao ĐVVC', nextDelivery: 'shipped' },
    3: { label: 'Đang giao', nextDelivery: 'delivering' },
    4: { label: 'Đã giao', nextDelivery: 'delivered' },
  };
  return nextMap[step] || null;
}

const CALL_STATUS_MAP: Record<string, { label: string; color: string }> = {
  none: { label: 'Chưa gọi', color: 'bg-muted text-muted-foreground' },
  called: { label: 'Đã gọi', color: 'bg-green-100 text-green-700' },
  unreachable: { label: 'Không liên hệ được', color: 'bg-red-100 text-red-700' },
};

const ACTION_TYPE_MAP: Record<string, { label: string; icon: string }> = {
  // Mua sắm
  order: { label: 'Đặt hàng', icon: '🛒' },
  add_to_cart: { label: 'Thêm giỏ hàng', icon: '🛒' },
  pre_order: { label: 'Đặt trước', icon: '📋' },
  notify_stock: { label: 'Báo khi có hàng', icon: '🔔' },
  best_price: { label: 'Xem giá tốt nhất', icon: '💰' },
  get_quote: { label: 'Yêu cầu báo giá', icon: '📄' },
  compare: { label: 'So sánh sản phẩm', icon: '⚖️' },
  track_order: { label: 'Tra cứu đơn hàng', icon: '📦' },
  // Tài chính
  installment: { label: 'Trả góp', icon: '💳' },
  installment_0: { label: 'Trả góp 0%', icon: '💳' },
  // Tư vấn & Liên hệ
  consult_now: { label: 'Tư vấn ngay', icon: '💬' },
  send_request: { label: 'Gửi yêu cầu', icon: '📩' },
  support: { label: 'Yêu cầu hỗ trợ', icon: '🛟' },
  // Đặt lịch
  booking: { label: 'Đặt lịch hẹn', icon: '📅' },
  booking_consult: { label: 'Đặt lịch tư vấn', icon: '📅' },
  booking_repair: { label: 'Đặt lịch sửa chữa', icon: '🔧' },
  booking_beauty: { label: 'Đặt lịch làm đẹp', icon: '💅' },
  booking_clinic: { label: 'Đặt lịch khám', icon: '🏥' },
  booking_store: { label: 'Đặt lịch tại CH', icon: '🏪' },
  // Ẩm thực
  order_food: { label: 'Đặt món', icon: '🍽️' },
  book_table: { label: 'Đặt bàn', icon: '🪑' },
  delivery: { label: 'Giao tận nơi', icon: '🚚' },
  book_party: { label: 'Đặt tiệc', icon: '🎉' },
  // Ưu đãi
  get_offer: { label: 'Nhận ưu đãi', icon: '🎁' },
  get_coupon: { label: 'Nhận mã giảm giá', icon: '🎫' },
  today_offer: { label: 'Ưu đãi hôm nay', icon: '🔥' },
  today_gift: { label: 'Quà tặng hôm nay', icon: '🎁' },
  hot_deal: { label: 'Deal hot', icon: '⚡' },
  join_member: { label: 'Đăng ký thành viên', icon: '👤' },
  // Đánh giá
  write_review: { label: 'Viết đánh giá', icon: '✍️' },
  check_warranty: { label: 'Kiểm tra bảo hành', icon: '🛡️' },
  // Khác
  custom_link: { label: 'Liên kết tùy chỉnh', icon: '🔗' },
};

function useStaffList(branchId?: string | null, isSuperAdmin?: boolean) {
  return useQuery({
    queryKey: ['staff-list-for-orders', branchId, isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from('user_roles')
        .select('user_id, user_role, branch_id');

      // Branch admin: only see staff in their branch
      if (!isSuperAdmin && branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.display_name]));

      return data.map(r => ({
        id: r.user_id,
        display_name: profileMap.get(r.user_id) || 'Không tên',
        user_role: r.user_role,
      })).sort((a, b) => a.display_name.localeCompare(b.display_name));
    },
  });
}

export function LandingOrdersTab() {
  const { data: permissions } = usePermissions();
  const { data: branches } = useBranches();
  const isSuperAdmin = permissions?.role === 'super_admin';
  const userBranchId = permissions?.branchId;
  const { data: staffList } = useStaffList(userBranchId, isSuperAdmin);

  const filterBranchId = isSuperAdmin ? null : userBranchId;
  const { data: orders, isLoading } = useLandingOrders(filterBranchId);
  const updateOrder = useUpdateLandingOrder();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [callStatusFilter, setCallStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [cancelDialogOrder, setCancelDialogOrder] = useState<LandingOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [detailOrder, setDetailOrder] = useState<LandingOrder | null>(null);
  const [assignDialogOrder, setAssignDialogOrder] = useState<LandingOrder | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignStaffId, setBulkAssignStaffId] = useState<string>('');

  const branchMap = new Map((branches || []).map(b => [b.id, b.name]));

  const filtered = (orders || []).filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (callStatusFilter !== 'all' && o.call_status !== callStatusFilter) return false;
    if (sourceFilter !== 'all' && (o as any).order_source !== sourceFilter) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      return o.customer_name.toLowerCase().includes(s) ||
        o.customer_phone.includes(s) ||
        o.product_name.toLowerCase().includes(s) ||
        ((o as any).ctv_name || '').toLowerCase().includes(s);
    }
    return true;
  });

  const handleApprove = async (order: LandingOrder) => {
    try {
      await updateOrder.mutateAsync({ id: order.id, status: 'approved', delivery_status: 'confirmed', approved_at: new Date().toISOString() } as any);
      toast.success('Đã xác nhận đơn hàng');
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
    } catch { toast.error('Lỗi khi xác nhận đơn'); }
  };

  const handleNextDeliveryStep = async (order: LandingOrder) => {
    const action = getNextDeliveryAction(order.status, order.delivery_status);
    if (!action) return;
    try {
      const updates: any = { id: order.id };
      if (action.nextStatus) updates.status = action.nextStatus;
      if (action.nextDelivery) updates.delivery_status = action.nextDelivery;
      await updateOrder.mutateAsync(updates);
      toast.success(`Đã chuyển: ${action.label}`);
    } catch { toast.error('Lỗi cập nhật trạng thái'); }
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

  // Single toggle: chưa gọi (red) → đã gọi (green) + auto confirm order
  const handleToggleCallStatus = async (e: React.MouseEvent, order: LandingOrder) => {
    e.stopPropagation();
    const isCalled = order.call_status === 'called';
    try {
      if (isCalled) {
        // Toggle back to "chưa gọi"
        await updateOrder.mutateAsync({ id: order.id, call_status: 'none' } as any);
        toast.success('Đã bỏ đánh dấu gọi');
      } else {
        // Mark as "đã gọi" + auto confirm (delivery_status = confirmed)
        const updates: any = { id: order.id, call_status: 'called' };
        if (order.status === 'pending') {
          updates.status = 'approved';
          updates.delivery_status = 'confirmed';
          updates.approved_at = new Date().toISOString();
        }
        await updateOrder.mutateAsync(updates);
        toast.success(order.status === 'pending' ? 'Đã gọi & xác nhận đơn hàng' : 'Đã đánh dấu: Đã gọi');
      }
    } catch { toast.error('Lỗi cập nhật'); }
  };

  // Bulk ship to carrier
  const handleBulkShipToCarrier = async () => {
    const eligibleOrders = filtered.filter(o =>
      selectedIds.has(o.id) &&
      o.status !== 'cancelled' &&
      (getDeliveryStepIndex(o.status, o.delivery_status) >= 1 && getDeliveryStepIndex(o.status, o.delivery_status) < 3)
    );
    if (eligibleOrders.length === 0) {
      toast.error('Không có đơn nào đủ điều kiện giao ĐVVC');
      return;
    }
    try {
      await Promise.all(
        eligibleOrders.map(o =>
          updateOrder.mutateAsync({ id: o.id, delivery_status: 'shipped' } as any)
        )
      );
      toast.success(`Đã giao ${eligibleOrders.length} đơn cho ĐVVC`);
      setSelectedIds(new Set());
    } catch { toast.error('Lỗi cập nhật hàng loạt'); }
  };

  const toggleSelectAll = () => {
    const eligibleIds = filtered
      .filter(o => o.status !== 'cancelled')
      .map(o => o.id);
    if (selectedIds.size === eligibleIds.length && eligibleIds.every(id => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleIds));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssignStaff = async () => {
    if (!assignDialogOrder) return;
    const staff = staffList?.find(s => s.id === selectedStaffId);
    try {
      await updateOrder.mutateAsync({
        id: assignDialogOrder.id,
        assigned_staff_id: selectedStaffId || null,
        assigned_staff_name: staff?.display_name || null,
      } as any);
      setAssignDialogOrder(null);
      setSelectedStaffId('');
      toast.success('Đã phân công nhân viên');
    } catch { toast.error('Lỗi phân công'); }
  };

  const handleBulkAssignStaff = async () => {
    const staff = staffList?.find(s => s.id === bulkAssignStaffId);
    const targetOrders = filtered.filter(o => selectedIds.has(o.id) && o.status !== 'cancelled');
    if (targetOrders.length === 0) {
      toast.error('Không có đơn nào được chọn');
      return;
    }
    try {
      await Promise.all(
        targetOrders.map(o =>
          updateOrder.mutateAsync({
            id: o.id,
            assigned_staff_id: bulkAssignStaffId === 'unassign' ? null : (bulkAssignStaffId || null),
            assigned_staff_name: bulkAssignStaffId === 'unassign' ? null : (staff?.display_name || null),
          } as any)
        )
      );
      toast.success(`Đã phân công ${targetOrders.length} đơn`);
      setBulkAssignOpen(false);
      setBulkAssignStaffId('');
      setSelectedIds(new Set());
    } catch { toast.error('Lỗi phân công hàng loạt'); }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2" data-tour="landing-orders-filter">
        <SearchInput placeholder="Tìm theo tên, SĐT, sản phẩm..." value={searchText} onChange={setSearchText} containerClassName="flex-1" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="pending">Chờ duyệt</SelectItem>
            <SelectItem value="approved">Đã duyệt</SelectItem>
            <SelectItem value="cancelled">Đã hủy</SelectItem>
          </SelectContent>
        </Select>
        <Select value={callStatusFilter} onValueChange={setCallStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Trạng thái gọi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả (gọi)</SelectItem>
            <SelectItem value="none">Chưa gọi</SelectItem>
            <SelectItem value="called">Đã gọi</SelectItem>
            <SelectItem value="unreachable">Không liên hệ được</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Nguồn" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả nguồn</SelectItem>
            <SelectItem value="web">🌐 Khách lẻ</SelectItem>
            <SelectItem value="ctv_direct">👤 CTV đặt</SelectItem>
            <SelectItem value="ctv_referral">🔗 Khách CTV</SelectItem>
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
        <>
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <span className="text-sm font-medium">Đã chọn {selectedIds.size} đơn</span>
              <Button size="sm" className="gap-1" onClick={handleBulkShipToCarrier} disabled={updateOrder.isPending}>
                {updateOrder.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                <Truck className="h-3.5 w-3.5" />
                Giao ĐVVC
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Bỏ chọn</Button>
            </div>
          )}

          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filtered.filter(o => o.status !== 'cancelled').length > 0 && filtered.filter(o => o.status !== 'cancelled').every(o => selectedIds.has(o.id))}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Hành động</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead>Thanh toán</TableHead>
                    <TableHead>Nguồn</TableHead>
                    <TableHead>Chi nhánh</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Liên hệ</TableHead>
                    <TableHead>Phân công</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(order => {
                    const st = STATUS_MAP[order.status] || STATUS_MAP.pending;
                    return (
                      <TableRow key={order.id} className="cursor-pointer" onClick={() => setDetailOrder(order)}>
                        <TableCell onClick={e => e.stopPropagation()}>
                          {order.status !== 'cancelled' && (
                            <Checkbox
                              checked={selectedIds.has(order.id)}
                              onCheckedChange={() => toggleSelect(order.id)}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(order.created_at), 'dd/MM/yy HH:mm', { locale: vi })}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const actionInfo = ACTION_TYPE_MAP[order.action_type || 'order'] || ACTION_TYPE_MAP.order;
                            return (
                              <div>
                                <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                                  {actionInfo.icon} {actionInfo.label}
                                </Badge>
                                {order.action_date && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-0.5">
                                    <CalendarDays className="h-2.5 w-2.5" />
                                    {order.action_date}{order.action_time ? ` ${order.action_time}` : ''}
                                  </p>
                                )}
                              </div>
                            );
                          })()}
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
                        <TableCell>
                          <Badge variant="secondary" className={`text-[10px] ${(order as any).payment_method === 'transfer' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                            {(order as any).payment_method === 'transfer' ? 'Chuyển khoản' : 'COD'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const src = (order as any).order_source || 'web';
                            const srcMap: Record<string, { label: string; icon: string; cls: string }> = {
                              web: { label: 'Khách lẻ', icon: '🌐', cls: 'bg-muted text-muted-foreground' },
                              ctv_direct: { label: 'CTV đặt', icon: '👤', cls: 'bg-blue-100 text-blue-700' },
                              ctv_referral: { label: 'Khách CTV', icon: '🔗', cls: 'bg-purple-100 text-purple-700' },
                            };
                            const info = srcMap[src] || srcMap.web;
                            return (
                              <div>
                                <Badge variant="outline" className={`text-[10px] ${info.cls}`}>
                                  {info.icon} {info.label}
                                </Badge>
                                {(order as any).ctv_name && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{(order as any).ctv_name}</p>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-xs">{branchMap.get(order.branch_id) || '—'}</TableCell>
                        <TableCell>
                          {order.status === 'cancelled' ? (
                            <Badge className="bg-destructive/10 text-destructive text-[10px]" variant="secondary">Đã hủy</Badge>
                          ) : (
                            <div>
                              <Badge className={`${st.color} text-[10px]`} variant="secondary">
                                {DELIVERY_STEPS[getDeliveryStepIndex(order.status, order.delivery_status)]?.label || st.label}
                              </Badge>
                              <div className="flex items-center gap-0.5 mt-1">
                                {DELIVERY_STEPS.map((_, i) => (
                                  <div key={i} className={`h-1 flex-1 rounded-full ${i <= getDeliveryStepIndex(order.status, order.delivery_status) ? 'bg-primary' : 'bg-muted'}`} />
                                ))}
                              </div>
                            </div>
                          )}
                        </TableCell>
                        {/* Single call toggle button */}
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-7 text-xs gap-1 ${
                              order.call_status === 'called'
                                ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                                : 'border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10'
                            }`}
                            title={order.call_status === 'called' ? 'Nhấn để bỏ đánh dấu' : 'Nhấn để đánh dấu đã gọi'}
                            onClick={e => handleToggleCallStatus(e, order)}
                          >
                            <PhoneCall className="h-3 w-3" />
                            {order.call_status === 'called' ? 'Đã gọi' : 'Chưa gọi'}
                          </Button>
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={() => { setAssignDialogOrder(order); setSelectedStaffId(order.assigned_staff_id || ''); }}
                          >
                            <UserPlus className="h-3 w-3" />
                            <span className="max-w-[60px] truncate">
                              {order.assigned_staff_name || 'Phân công'}
                            </span>
                          </Button>
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                              <a href={`tel:${order.customer_phone}`}><Phone className="h-3.5 w-3.5" /></a>
                            </Button>
                            {order.status !== 'cancelled' && (() => {
                              const action = getNextDeliveryAction(order.status, order.delivery_status);
                              if (!action) return null;
                              return (
                                <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => handleNextDeliveryStep(order)}>
                                  {action.label}
                                  <ChevronRight className="h-3 w-3" />
                                </Button>
                              );
                            })()}
                            {order.status !== 'cancelled' && getDeliveryStepIndex(order.status, order.delivery_status) < 3 && (
                              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setCancelDialogOrder(order)}>
                                Hủy
                              </Button>
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
        </>
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

      {/* Assign staff dialog */}
      <Dialog open={!!assignDialogOrder} onOpenChange={v => { if (!v) { setAssignDialogOrder(null); setSelectedStaffId(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Phân công nhân viên</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Đơn hàng: <span className="font-medium text-foreground">{assignDialogOrder?.customer_name}</span> — {assignDialogOrder?.product_name}
            </p>
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn nhân viên..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassign">— Bỏ phân công —</SelectItem>
                {(staffList || []).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.display_name || s.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignDialogOrder(null); setSelectedStaffId(''); }}>Đóng</Button>
            <Button onClick={() => {
              if (selectedStaffId === 'unassign') {
                setSelectedStaffId('');
              }
              handleAssignStaff();
            }} disabled={updateOrder.isPending}>
              {updateOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Xác nhận
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
              {/* Delivery status timeline */}
              {detailOrder.status !== 'cancelled' && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Tiến trình đơn hàng</p>
                  <div className="flex items-center gap-0">
                    {DELIVERY_STEPS.map((step, i) => {
                      const currentIdx = getDeliveryStepIndex(detailOrder.status, detailOrder.delivery_status);
                      const active = i <= currentIdx;
                      return (
                        <div key={step.key} className="flex items-center flex-1">
                          <div className="flex flex-col items-center flex-1">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                              {i + 1}
                            </div>
                            <span className={`text-[9px] mt-1 text-center leading-tight ${active ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                              {step.label}
                            </span>
                          </div>
                          {i < DELIVERY_STEPS.length - 1 && (
                            <div className={`h-0.5 w-full mt-[-14px] ${i < currentIdx ? 'bg-primary' : 'bg-muted'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {detailOrder.status === 'cancelled' && (
                <div className="bg-destructive/10 rounded-lg p-3 text-center">
                  <Badge variant="destructive">Đơn hàng đã bị hủy</Badge>
                </div>
              )}

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
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Loại yêu cầu:</span>
                  <Badge variant="outline" className="text-xs">
                    {(ACTION_TYPE_MAP[detailOrder.action_type || 'order'] || ACTION_TYPE_MAP.order).icon}{' '}
                    {(ACTION_TYPE_MAP[detailOrder.action_type || 'order'] || ACTION_TYPE_MAP.order).label}
                  </Badge>
                </div>
                {detailOrder.action_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Ngày hẹn:</span>
                    <span className="font-medium flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      {detailOrder.action_date}{detailOrder.action_time ? ` lúc ${detailOrder.action_time}` : ''}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Nguồn:</span>
                  {(() => {
                    const src = (detailOrder as any).order_source || 'web';
                    const srcMap: Record<string, string> = {
                      web: '🌐 Khách lẻ (web)',
                      ctv_direct: '👤 CTV đặt hộ',
                      ctv_referral: '🔗 Khách của CTV',
                    };
                    return <span className="font-medium">{srcMap[src] || src}</span>;
                  })()}
                </div>
                {(detailOrder as any).ctv_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CTV:</span>
                    <span className="font-medium">{(detailOrder as any).ctv_name} {(detailOrder as any).ctv_code ? `(${(detailOrder as any).ctv_code})` : ''}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Liên hệ:</span>
                  <Badge className={`${CALL_STATUS_MAP[detailOrder.call_status]?.color} text-[10px]`} variant="secondary">
                    {CALL_STATUS_MAP[detailOrder.call_status]?.label}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phân công:</span>
                  <span className="font-medium">{detailOrder.assigned_staff_name || '—'}</span>
                </div>
                {detailOrder.note && (
                  <div>
                    <span className="text-muted-foreground">Ghi chú:</span>
                    <p className="mt-1 bg-muted/50 rounded p-2 text-sm">{detailOrder.note}</p>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Thanh toán:</span>
                  <Badge variant="secondary" className={`text-xs ${(detailOrder as any).payment_method === 'transfer' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {(detailOrder as any).payment_method === 'transfer' ? 'Chuyển khoản ngân hàng' : 'COD (Thu tiền khi nhận hàng)'}
                  </Badge>
                </div>
                {(detailOrder as any).payment_method === 'transfer' && (detailOrder as any).transfer_content && (
                  <div>
                    <span className="text-muted-foreground">Nội dung CK:</span>
                    <p className="mt-1 bg-blue-50 rounded p-2 text-sm font-mono font-bold text-blue-700">
                      {(detailOrder as any).transfer_content}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Đối chiếu với lịch sử giao dịch ngân hàng để xác nhận thanh toán
                    </p>
                  </div>
                )}
                {detailOrder.cancelled_reason && (
                  <div>
                    <span className="text-muted-foreground">Lý do hủy:</span>
                    <p className="mt-1 bg-destructive/10 rounded p-2 text-sm text-destructive">{detailOrder.cancelled_reason}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" className="flex-1 gap-2" asChild>
                  <a href={`tel:${detailOrder.customer_phone}`}><Phone className="h-4 w-4" />Gọi khách</a>
                </Button>
                {detailOrder.status !== 'cancelled' && (() => {
                  const action = getNextDeliveryAction(detailOrder.status, detailOrder.delivery_status);
                  if (!action) return null;
                  return (
                    <Button className="flex-1 gap-1" onClick={() => { handleNextDeliveryStep(detailOrder); setDetailOrder(null); }}>
                      {action.label}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  );
                })()}
                {detailOrder.status !== 'cancelled' && getDeliveryStepIndex(detailOrder.status, detailOrder.delivery_status) < 3 && (
                  <Button variant="destructive" onClick={() => { setCancelDialogOrder(detailOrder); setDetailOrder(null); }}>
                    Hủy
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
