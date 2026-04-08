
import React, { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { PriceInput } from '@/components/ui/price-input';
import { SearchInput } from '@/components/ui/search-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Wrench, Plus, Trash2, Search, Play, CheckCircle, Package, ArrowRight, Printer, Eye, Lock } from 'lucide-react';
import { useStaffList } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePlatformUser } from '@/hooks/useTenant';
import {
  useRepairOrders,
  useRepairOrder,
  useRepairOrderItems,
  useUpdateRepairOrder,
  useAddRepairItem,
  useDeleteRepairItem,
  useRepairStatusHistory,
  useRepairOrdersRealtime,
  REPAIR_STATUS_MAP,
  RepairStatus,
  RepairOrder,
  RepairOrderItem,
} from '@/hooks/useRepairOrders';
import { supabase } from '@/integrations/supabase/client';
import { formatNumber } from '@/lib/formatNumber';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { useNavigate } from 'react-router-dom';
import { RepairCheckoutDialog } from '@/components/repair/RepairCheckoutDialog';

const STATUS_TABS: { key: RepairStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'received', label: 'Tiếp nhận' },
  { key: 'pending_check', label: 'Chờ kiểm tra' },
  { key: 'repairing', label: 'Đang sửa' },
  { key: 'waiting_parts', label: 'Chờ linh kiện' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'returned', label: 'Đã trả khách' },
];

export default function RepairListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: platformUser } = usePlatformUser();
  const tenantId = platformUser?.tenant_id || '';

  const { data: staffList } = useStaffList();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const { data: orders, isLoading } = useRepairOrders(activeTab as any);
  useRepairOrdersRealtime();
  const updateOrder = useUpdateRepairOrder();

  // Detail sheet
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { data: selectedOrder } = useRepairOrder(selectedOrderId || undefined);
  const { data: orderItems } = useRepairOrderItems(selectedOrderId || undefined);
  const { data: statusHistory } = useRepairStatusHistory(selectedOrderId || undefined);

  // Add service/part dialog
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemType, setItemType] = useState<'service' | 'part'>('service');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState(0);
  const [itemQty, setItemQty] = useState(1);
  const [itemCostPrice, setItemCostPrice] = useState(0);
  const [partSearch, setPartSearch] = useState('');
  const [partResults, setPartResults] = useState<any[]>([]);
  const [selectedPart, setSelectedPart] = useState<any>(null);
  

  const addItem = useAddRepairItem();
  const deleteItem = useDeleteRepairItem();

  // Checkout dialog
  const [showCheckout, setShowCheckout] = useState(false);

  // Ticket password verification
  const [showTicketPwDialog, setShowTicketPwDialog] = useState(false);
  const [ticketPwInput, setTicketPwInput] = useState('');
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const handleOpenOrder = (order: any) => {
    if (order.ticket_password_enabled && order.ticket_password) {
      setPendingOrderId(order.id);
      setTicketPwInput('');
      setShowTicketPwDialog(true);
    } else {
      setSelectedOrderId(order.id);
    }
  };

  const handleVerifyTicketPassword = () => {
    const order = orders?.find(o => o.id === pendingOrderId);
    if (order && ticketPwInput === order.ticket_password) {
      setSelectedOrderId(pendingOrderId);
      setShowTicketPwDialog(false);
      setPendingOrderId(null);
      setTicketPwInput('');
    } else {
      toast.error('Mật khẩu phiếu không đúng');
    }
  };

  // Filter orders by search
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (!search) return orders;
    const s = search.toLowerCase();
    return orders.filter(o =>
      o.code.toLowerCase().includes(s) ||
      o.device_name.toLowerCase().includes(s) ||
      (o.device_imei || '').toLowerCase().includes(s) ||
      (o.customer_name || '').toLowerCase().includes(s) ||
      (o.customer_phone || '').toLowerCase().includes(s)
    );
  }, [orders, search]);

  const pagination = usePagination(filteredOrders, { defaultPageSize: 20 });
  const pagedOrders = pagination.paginatedData;

  // Pre-fetch reserved items (cached, not per-keystroke)
  const reservedRef = React.useRef<{ ids: Set<string>; qtyMap: Map<string, number> }>({ ids: new Set(), qtyMap: new Map() });
  const reservedLoaded = React.useRef(false);

  React.useEffect(() => {
    if (!orders || reservedLoaded.current) return;
    const activeOrderIds = new Set(
      orders.filter(o => o.status !== 'returned').map(o => o.id)
    );
    if (activeOrderIds.size === 0) { reservedLoaded.current = true; return; }

    supabase
      .from('repair_order_items')
      .select('product_id, quantity, repair_order_id')
      .not('product_id', 'is', null)
      .eq('item_type', 'part')
      .then(({ data }) => {
        const ids = new Set<string>();
        const qtyMap = new Map<string, number>();
        (data || []).forEach(item => {
          if (item.product_id && activeOrderIds.has(item.repair_order_id)) {
            ids.add(item.product_id);
            qtyMap.set(item.product_id, (qtyMap.get(item.product_id) || 0) + (item.quantity || 1));
          }
        });
        reservedRef.current = { ids, qtyMap };
        reservedLoaded.current = true;
      });
  }, [orders]);

  // Invalidate reserved cache when items change
  const invalidateReserved = () => { reservedLoaded.current = false; };

  // Search parts using fast RPC (same as sales page)
  const searchParts = async (term: string) => {
    if (!term || term.length < 2) { setPartResults([]); return; }

    const { data, error } = await supabase.rpc('search_products_for_sale' as any, {
      p_search: term.trim(),
      p_limit: 20,
    });
    if (error) { setPartResults([]); return; }

    const { ids: reservedIds, qtyMap } = reservedRef.current;
    const filtered = (data || []).filter((p: any) => {
      if (p.imei) {
        return !reservedIds.has(p.id);
      } else {
        const reserved = qtyMap.get(p.id) || 0;
        const available = (p.quantity || 0) - reserved;
        if (available <= 0) return false;
        (p as any).available_quantity = available;
        return true;
      }
    });
    setPartResults(filtered);
  };

  React.useEffect(() => {
    const t = setTimeout(() => searchParts(partSearch), 150);
    return () => clearTimeout(t);
  }, [partSearch]);

  const handleAddItem = async () => {
    if (!selectedOrderId) return;
    
    const payload: any = {
      repair_order_id: selectedOrderId,
      tenant_id: tenantId,
      item_type: itemType,
      quantity: itemQty,
      unit_price: itemPrice,
    };

    if (itemType === 'part' && selectedPart) {
      payload.product_id = selectedPart.id;
      payload.product_name = selectedPart.name;
      payload.product_sku = selectedPart.sku;
      payload.product_imei = selectedPart.imei;
      payload.cost_price = selectedPart.import_price || 0;
    } else {
      payload.description = itemDesc;
      payload.cost_price = itemCostPrice;
    }

    await addItem.mutateAsync(payload);

    // Recalculate totals
    const allItems = [...(orderItems || []), payload];
    const totalService = allItems.filter(i => i.item_type === 'service').reduce((s, i) => s + (i.quantity || 1) * (i.unit_price || 0), 0);
    const totalParts = allItems.filter(i => i.item_type === 'part').reduce((s, i) => s + (i.quantity || 1) * (i.unit_price || 0), 0);
    const totalPartsCost = allItems.filter(i => i.item_type === 'part').reduce((s, i) => s + (i.quantity || 1) * (i.cost_price || 0), 0);

    await updateOrder.mutateAsync({
      id: selectedOrderId,
      total_service_price: totalService,
      total_parts_price: totalParts,
      total_parts_cost: totalPartsCost,
      total_amount: totalService + totalParts,
    } as any);

    setShowAddItem(false);
    resetItemForm();
    invalidateReserved();
    toast.success('Đã thêm dịch vụ/linh kiện');
  };

  const resetItemForm = () => {
    setItemDesc('');
    setItemPrice(0);
    setItemQty(1);
    setItemCostPrice(0);
    setPartSearch('');
    setSelectedPart(null);
    setItemType('service');
  };


  const handleStatusChange = async (orderId: string, newStatus: RepairStatus) => {
    // Log status change
    const order = orders?.find(o => o.id === orderId);
    if (order) {
      await supabase.from('repair_status_history').insert({
        repair_order_id: orderId,
        tenant_id: tenantId,
        old_status: order.status,
        new_status: newStatus,
        changed_by: user?.id,
        changed_by_name: profile?.display_name,
      } as any);
    }

    await updateOrder.mutateAsync({ id: orderId, status: newStatus } as any);
    toast.success(`Đã chuyển trạng thái: ${REPAIR_STATUS_MAP[newStatus].label}`);
  };

  const completedCount = orders?.filter(o => o.status === 'completed').length || 0;

  return (
    <MainLayout>
      <PageHeader
        title="Danh sách sửa chữa"
        description={`${filteredOrders.length} phiếu`}
        actions={
          <Button onClick={() => navigate('/repair/new')} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Tạo phiếu mới
          </Button>
        }
      />

      {completedCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-sm text-red-700 font-medium">
          ⚠️ Có {completedCount} phiếu đã hoàn thành, chờ trả khách
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Tìm mã phiếu, thiết bị, IMEI, khách hàng..."
              containerClassName="flex-1"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto">
              {STATUS_TABS.map(t => (
                <TabsTrigger key={t.key} value={t.key} className="text-xs">
                  {t.label}
                  {t.key === 'completed' && completedCount > 0 && (
                    <Badge variant="destructive" className="ml-1 h-4 text-[10px] px-1">{completedCount}</Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="overflow-auto mt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Mã phiếu</TableHead>
                  <TableHead>Thiết bị</TableHead>
                  <TableHead className="hidden sm:table-cell">IMEI</TableHead>
                  <TableHead className="hidden md:table-cell">Khách hàng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Giá DK</TableHead>
                  <TableHead className="hidden lg:table-cell">Ngày nhận</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Đang tải...</TableCell></TableRow>
                ) : pagedOrders.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chưa có phiếu sửa chữa nào</TableCell></TableRow>
                ) : pagedOrders.map(order => {
                  const st = REPAIR_STATUS_MAP[order.status];
                  const isCompleted = order.status === 'completed';
                  return (
                    <TableRow key={order.id} className={isCompleted ? 'bg-red-50/50' : ''}>
                      <TableCell className="font-mono text-xs">{order.code}</TableCell>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate">{order.device_name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{order.device_imei || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {order.customer_name || '-'}
                        {order.customer_phone && <div className="text-xs text-muted-foreground">{order.customer_phone}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${st.color} text-[11px]`}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right text-sm">{formatNumber(order.estimated_price)}đ</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {format(new Date(order.created_at), 'dd/MM/yy HH:mm')}
                      </TableCell>
                      <TableCell className="flex items-center gap-1">
                        {order.ticket_password_enabled && <Lock className="h-3 w-3 text-amber-500" />}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenOrder(order)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filteredOrders.length > 20 && <TablePagination 
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />}
          </div>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selectedOrderId} onOpenChange={open => { if (!open) setSelectedOrderId(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Phiếu {selectedOrder?.code}
            </SheetTitle>
          </SheetHeader>

          {selectedOrder && (
            <div className="space-y-4 mt-4">
              {/* Device info */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="font-medium text-base">{selectedOrder.device_name}</div>
                {selectedOrder.device_imei && <div><span className="text-muted-foreground">IMEI:</span> {selectedOrder.device_imei}</div>}
                {selectedOrder.device_model && <div><span className="text-muted-foreground">Model:</span> {selectedOrder.device_model}</div>}
                {selectedOrder.device_condition && <div><span className="text-muted-foreground">Tình trạng:</span> {selectedOrder.device_condition}</div>}
                {selectedOrder.device_password && <div><span className="text-muted-foreground">Mật khẩu:</span> {selectedOrder.device_password}</div>}
              </div>

              {/* Customer */}
              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground">Khách:</span> {selectedOrder.customer_name || 'Khách lẻ'} {selectedOrder.customer_phone && `- ${selectedOrder.customer_phone}`}</div>
                <div><span className="text-muted-foreground">NV tiếp nhận:</span> {selectedOrder.received_by_name || '-'}</div>
                <div><span className="text-muted-foreground">Kỹ thuật viên:</span> {selectedOrder.technician_name || 'Chưa phân công'}</div>
                <div><span className="text-muted-foreground">Giá dự kiến:</span> {formatNumber(selectedOrder.estimated_price)}đ</div>
                {selectedOrder.due_date && <div><span className="text-muted-foreground">Hẹn trả:</span> {format(new Date(selectedOrder.due_date), 'dd/MM/yyyy HH:mm')}</div>}
                {selectedOrder.note && <div><span className="text-muted-foreground">Ghi chú:</span> {selectedOrder.note}</div>}
              </div>

              {/* Status control */}
              <div className="flex items-center gap-2 flex-wrap">
                <Label className="text-xs">Trạng thái:</Label>
                <Select value={selectedOrder.status} onValueChange={v => handleStatusChange(selectedOrder.id, v as RepairStatus)}>
                  <SelectTrigger className="w-auto h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REPAIR_STATUS_MAP).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Technician - Staff Selector */}
              <div>
                <Label className="text-xs">Kỹ thuật viên</Label>
                <Select
                  value={selectedOrder.technician_id || '_none_'}
                  onValueChange={(v) => {
                    const staffId = v === '_none_' ? null : v;
                    const staff = staffList?.find(s => s.user_id === staffId);
                    updateOrder.mutate({
                      id: selectedOrder.id,
                      technician_id: staffId,
                      technician_name: staff?.display_name || null,
                    } as any);
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Chọn kỹ thuật viên..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Chưa phân công</SelectItem>
                    {staffList?.map((staff) => (
                      <SelectItem key={staff.user_id} value={staff.user_id}>
                        {staff.display_name || 'Nhân viên'}
                        {staff.user_role === 'super_admin' && ' (Admin)'}
                        {staff.user_role === 'branch_admin' && ' (QL)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Services & Parts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm">Dịch vụ & Linh kiện</h4>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { resetItemForm(); setShowAddItem(true); }}>
                    <Plus className="h-3 w-3 mr-1" /> Thêm
                  </Button>
                </div>
                
                {orderItems && orderItems.length > 0 ? (
                  <div className="space-y-2">
                    {orderItems.map(item => (
                      <div key={item.id} className="flex items-start justify-between p-2 border rounded text-sm">
                        <div>
                          <div className="flex items-center gap-1">
                            {item.item_type === 'part' ? (
                              <Badge variant="outline" className="text-[10px] h-4">LK</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] h-4">DV</Badge>
                            )}
                            <span className="font-medium">{item.product_name || item.description || 'Dịch vụ'}</span>
                          </div>
                          <div className="text-muted-foreground text-xs mt-0.5">
                            {item.quantity} x {formatNumber(item.unit_price)}đ = {formatNumber(item.total_price)}đ
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => deleteItem.mutate({ id: item.id, repairOrderId: selectedOrder.id })}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <div className="border-t pt-2 text-sm font-medium text-right">
                      Tổng: {formatNumber(selectedOrder.total_amount)}đ
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">Chưa có dịch vụ/linh kiện</p>
                )}
              </div>

              {/* Status History */}
              {statusHistory && statusHistory.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Lịch sử trạng thái</h4>
                  <div className="space-y-1">
                    {statusHistory.map((h: any) => (
                      <div key={h.id} className="text-xs flex items-center gap-2">
                        <span className="text-muted-foreground">{format(new Date(h.created_at), 'dd/MM HH:mm')}</span>
                        <ArrowRight className="h-3 w-3" />
                        <Badge className={`${REPAIR_STATUS_MAP[h.new_status as RepairStatus]?.color || ''} text-[10px]`}>
                          {REPAIR_STATUS_MAP[h.new_status as RepairStatus]?.label || h.new_status}
                        </Badge>
                        <span className="text-muted-foreground">{h.changed_by_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                {selectedOrder.status === 'completed' && (
                  <Button className="flex-1" onClick={() => setShowCheckout(true)}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Trả khách & Thanh toán
                  </Button>
                )}
                {(selectedOrder.status === 'received' || selectedOrder.status === 'pending_check') && (
                  <Button variant="outline" className="flex-1" onClick={() => handleStatusChange(selectedOrder.id, 'repairing')}>
                    <Play className="h-4 w-4 mr-1" /> Bắt đầu sửa
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Item Dialog */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent>
          <DialogHeader><DialogTitle>Thêm dịch vụ / linh kiện</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Loại</Label>
              <Select value={itemType} onValueChange={v => { setItemType(v as any); setSelectedPart(null); setPartSearch(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Chỉ sửa (dịch vụ)</SelectItem>
                  <SelectItem value="part">Thay linh kiện (từ kho)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {itemType === 'part' ? (
              <div className="space-y-2">
                <Label>Tìm linh kiện trong kho</Label>
                <SearchInput value={partSearch} onChange={v => setPartSearch(v)} placeholder="Tên, IMEI, SKU..." />
                {partResults.length > 0 && !selectedPart && (
                  <div className="border rounded max-h-40 overflow-auto">
                    {partResults.map(p => (
                      <button key={p.id} onClick={() => {
                        setSelectedPart(p);
                        setItemPrice(p.sale_price || p.import_price || 0);
                        setItemCostPrice(p.import_price || 0);
                        setPartResults([]);
                      }} className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.imei && `IMEI: ${p.imei} • `}Giá nhập: {formatNumber(p.import_price || 0)}đ
                          {!p.imei && (p as any).available_quantity != null && ` • Còn: ${(p as any).available_quantity}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedPart && (
                  <div className="bg-muted/50 rounded p-2 text-sm">
                    <div className="font-medium">{selectedPart.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Giá nhập: {formatNumber(selectedPart.import_price || 0)}đ
                    </div>
                    <Button variant="ghost" size="sm" className="h-5 text-xs mt-1" onClick={() => setSelectedPart(null)}>Chọn lại</Button>
                  </div>
                )}
                {/* Button to open import popup */}
                <div className="border-t pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setShowAddItem(false);
                      navigate(`/import/new?repairOrderId=${selectedOrderId}`);
                    }}
                  >
                    <Package className="h-3 w-3 mr-1" /> Nhập linh kiện mới (chưa có trong kho)
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Label>Nội dung sửa</Label>
                <Input value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="VD: Sửa main, thay keo..." />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Số lượng</Label>
                <Input type="number" min={1} value={itemQty} onChange={e => setItemQty(Number(e.target.value))} />
              </div>
              <div>
                <Label>Đơn giá</Label>
                <PriceInput value={itemPrice} onChange={setItemPrice} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItem(false)}>Hủy</Button>
            <Button onClick={handleAddItem} disabled={addItem.isPending}>
              {addItem.isPending ? 'Đang thêm...' : 'Thêm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Checkout Dialog */}
      {selectedOrder && orderItems && showCheckout && (
        <RepairCheckoutDialog
          open={showCheckout}
          onOpenChange={(open) => {
            setShowCheckout(open);
            if (!open) setSelectedOrderId(null);
          }}
          order={selectedOrder}
          items={orderItems}
        />
      )}

      {/* Ticket Password Dialog */}
      <Dialog open={showTicketPwDialog} onOpenChange={setShowTicketPwDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> Nhập mật khẩu phiếu
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Phiếu này được bảo vệ bằng mật khẩu. Vui lòng nhập mật khẩu để mở.</p>
            <Input
              type="password"
              value={ticketPwInput}
              onChange={e => setTicketPwInput(e.target.value)}
              placeholder="Mật khẩu..."
              onKeyDown={e => e.key === 'Enter' && handleVerifyTicketPassword()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTicketPwDialog(false)}>Hủy</Button>
            <Button onClick={handleVerifyTicketPassword}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
