import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Loader2, CheckCircle, Package, AlertTriangle, XCircle } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { LandingOrder, useUpdateLandingOrder } from '@/hooks/useLandingOrders';
import { useCreateExportReceipt, type ExportReceiptItem, type ExportPayment } from '@/hooks/useExportReceipts';
import { useCustomPaymentSources } from '@/hooks/useCustomPaymentSources';
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

interface MatchedOrder {
  order: LandingOrder;
  product: {
    id: string;
    name: string;
    sku: string;
    imei: string | null;
    import_price: number;
    sale_price: number;
    quantity: number;
    category_id: string | null;
    branch_id: string | null;
  } | null;
  customer: { id: string; name: string; phone: string } | null;
  status: 'matching' | 'matched' | 'no_product' | 'no_stock' | 'processed' | 'error';
  errorMsg?: string;
}

const DEFAULT_PAYMENT_SOURCES = [
  { id: 'cash', name: 'Tiền mặt' },
  { id: 'bank_card', name: 'Ngân hàng' },
  { id: 'e_wallet', name: 'Ví điện tử' },
];

// Helper to get current user's tenant_id
async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export function BulkConfirmDialog({ open, onOpenChange, orders, staffList, onSuccess }: BulkConfirmDialogProps) {
  const updateOrder = useUpdateLandingOrder();
  const createExportReceipt = useCreateExportReceipt();
  const { data: customSources } = useCustomPaymentSources();
  const queryClient = useQueryClient();

  const [matchedOrders, setMatchedOrders] = useState<MatchedOrder[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedPaymentSource, setSelectedPaymentSource] = useState('cash');
  const [recordCashBook, setRecordCashBook] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  const [matching, setMatching] = useState(false);

  const pendingOrders = orders.filter(o => o.status === 'pending');

  const allPaymentSources = [
    ...DEFAULT_PAYMENT_SOURCES,
    ...(customSources || []).map(s => ({ id: s.id, name: s.name })),
  ];

  // Auto-match products and customers when dialog opens
  useEffect(() => {
    if (!open || pendingOrders.length === 0) return;
    
    let cancelled = false;
    setMatching(true);
    setProcessedIds(new Set());

    (async () => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId || cancelled) return;

      const results: MatchedOrder[] = [];

      for (const order of pendingOrders) {
        if (cancelled) break;

        let product = null;
        let customer = null;

        // 1. Find product by name (non-IMEI, in_stock)
        try {
          const { data: products } = await supabase
            .from('products')
            .select('id, name, sku, imei, import_price, sale_price, quantity, category_id, branch_id')
            .eq('status', 'in_stock')
            .eq('tenant_id', tenantId)
            .is('imei', null) // non-IMEI only
            .ilike('name', `%${order.product_name}%`)
            .gt('quantity', 0)
            .limit(1);

          if (products && products.length > 0) {
            const p = products[0];
            // Check enough stock
            if ((p.quantity || 0) >= order.quantity) {
              product = p;
            } else {
              results.push({ order, product: null, customer: null, status: 'no_stock', errorMsg: `Tồn kho: ${p.quantity}, cần: ${order.quantity}` });
              continue;
            }
          } else {
            // Try exact name match with branch filter
            const { data: products2 } = await supabase
              .from('products')
              .select('id, name, sku, imei, import_price, sale_price, quantity, category_id, branch_id')
              .eq('status', 'in_stock')
              .eq('tenant_id', tenantId)
              .is('imei', null)
              .eq('name', order.product_name)
              .gt('quantity', 0)
              .limit(1);
            
            if (products2 && products2.length > 0 && (products2[0].quantity || 0) >= order.quantity) {
              product = products2[0];
            }
          }
        } catch (err) {
          console.error('Product search error:', err);
        }

        // 2. Find or create customer by phone
        try {
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id, name, phone')
            .eq('phone', order.customer_phone)
            .eq('tenant_id', tenantId)
            .maybeSingle();

          if (existingCustomer) {
            customer = existingCustomer;
          } else {
            // Create new customer
            const { data: newCustomer, error } = await supabase
              .from('customers')
              .insert([{
                name: order.customer_name,
                phone: order.customer_phone,
                email: order.customer_email || null,
                address: order.customer_address || null,
                tenant_id: tenantId,
                source: 'Web',
              }])
              .select('id, name, phone')
              .single();
            
            if (!error && newCustomer) {
              customer = newCustomer;
            }
          }
        } catch (err) {
          console.error('Customer search/create error:', err);
        }

        results.push({
          order,
          product,
          customer,
          status: product ? 'matched' : 'no_product',
          errorMsg: !product ? 'Không tìm thấy sản phẩm phù hợp trong kho' : undefined,
        });
      }

      if (!cancelled) {
        setMatchedOrders(results);
        // Auto-select all matched orders
        const matchedIds = new Set(results.filter(r => r.status === 'matched' && r.customer).map(r => r.order.id));
        setSelectedOrderIds(matchedIds);
        setMatching(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, pendingOrders.length]);

  const toggleAll = () => {
    const eligible = matchedOrders.filter(m => m.status === 'matched' && m.customer);
    if (selectedOrderIds.size === eligible.length && eligible.length > 0) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(eligible.map(m => m.order.id)));
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

  const eligibleCount = matchedOrders.filter(m => m.status === 'matched' && m.customer).length;

  const handleConfirmAll = async () => {
    const toProcess = matchedOrders.filter(m => selectedOrderIds.has(m.order.id) && m.status === 'matched' && m.product && m.customer);
    if (toProcess.length === 0) {
      toast.error('Không có đơn nào đủ điều kiện xử lý');
      return;
    }
    if (!selectedStaffId) {
      toast.error('Vui lòng chọn nhân viên');
      return;
    }

    const staff = staffList.find(s => s.id === selectedStaffId);
    setProcessing(true);
    const newProcessed = new Set<string>();
    let successCount = 0;
    let failCount = 0;

    for (const matched of toProcess) {
      const { order, product, customer } = matched;
      if (!product || !customer) continue;

      try {
        // Build export receipt items
        const items: ExportReceiptItem[] = [{
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          imei: null, // non-IMEI
          category_id: product.category_id,
          sale_price: order.product_price,
          quantity: order.quantity,
          branch_id: product.branch_id,
        }];

        // Build payments
        const totalAmount = order.product_price * order.quantity;
        const payments: ExportPayment[] = [{
          payment_type: selectedPaymentSource as any,
          amount: totalAmount,
        }];

        // Create actual export receipt (same as normal sale)
        await createExportReceipt.mutateAsync({
          customerId: customer.id,
          items,
          payments,
          note: `Từ đơn web ${order.order_code || ''}`.trim(),
          branchId: product.branch_id,
          salesStaffId: selectedStaffId,
          skipCashBook: !recordCashBook,
        });

        // Update landing order status
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
        successCount++;
      } catch (err: any) {
        console.error(`Failed to process order ${order.id}:`, err);
        // Update matched order status
        setMatchedOrders(prev => prev.map(m =>
          m.order.id === order.id ? { ...m, status: 'error' as const, errorMsg: err.message || 'Lỗi xử lý' } : m
        ));
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Đã xuất hàng ${successCount} đơn thành công${failCount > 0 ? `, ${failCount} đơn lỗi` : ''}`);
      // Invalidate all relevant queries
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

  const totalValue = matchedOrders
    .filter(m => selectedOrderIds.has(m.order.id))
    .reduce((sum, m) => sum + m.order.product_price * m.order.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !processing) { onOpenChange(false); } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Xác nhận & Xuất hàng loạt ({pendingOrders.length} đơn chờ duyệt)
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Hệ thống tự động tìm sản phẩm trong kho, tạo khách hàng và xuất hàng giống quy trình bán hàng thông thường.
          </p>
        </DialogHeader>

        {/* Order list */}
        <div className="flex-1 overflow-y-auto min-h-0 border rounded-lg">
          {matching ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Đang tìm sản phẩm và khách hàng...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={eligibleCount > 0 && selectedOrderIds.size === eligibleCount}
                      onCheckedChange={toggleAll}
                      disabled={processing}
                    />
                  </TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Sản phẩm (đơn)</TableHead>
                  <TableHead>SP trong kho</TableHead>
                  <TableHead className="text-right">Thành tiền</TableHead>
                  <TableHead className="w-20 text-center">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matchedOrders.map(matched => {
                  const isEligible = matched.status === 'matched' && matched.customer;
                  const isDone = processedIds.has(matched.order.id);
                  return (
                    <TableRow key={matched.order.id} className={isDone ? 'bg-green-50 dark:bg-green-950/20' : matched.status === 'error' ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedOrderIds.has(matched.order.id)}
                          onCheckedChange={() => toggleOrder(matched.order.id)}
                          disabled={processing || isDone || !isEligible}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{matched.order.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{matched.order.customer_phone}</p>
                          {matched.customer && (
                            <Badge variant="outline" className="text-[10px] mt-0.5">
                              {matched.customer.id ? 'Đã có' : 'Mới'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {matched.order.product_image_url ? (
                            <img src={matched.order.product_image_url} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm truncate max-w-[150px]">{matched.order.product_name}</p>
                            {matched.order.variant && <Badge variant="outline" className="text-[10px]">{matched.order.variant}</Badge>}
                            <p className="text-xs text-muted-foreground">SL: {matched.order.quantity}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {matched.product ? (
                          <div>
                            <p className="text-sm font-medium text-green-700 dark:text-green-400">{matched.product.name}</p>
                            <p className="text-xs text-muted-foreground">SKU: {matched.product.sku}</p>
                            <p className="text-xs text-muted-foreground">Tồn: {matched.product.quantity}</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span className="text-xs">{matched.errorMsg || 'Không tìm thấy'}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatNumber(matched.order.product_price * matched.order.quantity)}đ
                      </TableCell>
                      <TableCell className="text-center">
                        {isDone ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                        ) : matched.status === 'error' ? (
                          <XCircle className="h-4 w-4 text-destructive mx-auto" />
                        ) : matched.status === 'matched' ? (
                          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">OK</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200">Thiếu</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {matchedOrders.length === 0 && !matching && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Không có đơn hàng chờ duyệt
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Staff + Payment selection */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nhân viên bán hàng <span className="text-destructive">*</span></label>
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

        {/* Cash book toggle */}
        <div className="flex items-center justify-between px-1">
          <label className="text-sm text-muted-foreground">Ghi dòng tiền vào sổ quỹ</label>
          <Switch checked={recordCashBook} onCheckedChange={setRecordCashBook} disabled={processing} />
        </div>

        {/* Summary */}
        <div className="bg-muted/30 rounded-lg p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Đơn đủ điều kiện xuất:</span>
            <span className="font-bold">{eligibleCount}/{matchedOrders.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Đã chọn:</span>
            <span className="font-bold">{selectedOrderIds.size}</span>
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
            disabled={processing || matching || selectedOrderIds.size === 0 || !selectedStaffId}
            className="gap-1"
          >
            {processing && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận & Xuất {selectedOrderIds.size} đơn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
