import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Search, ArrowLeft, Phone, Package, MapPin, Clock, CheckCircle2,
  XCircle, Truck, MessageCircle, Loader2, ShoppingBag, AlertCircle, HeadphonesIcon,
  PackageCheck, Star,
} from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';


interface LandingOrderResult {
  id: string;
  order_code: string | null;
  product_name: string;
  product_image_url: string | null;
  product_price: number;
  variant: string | null;
  quantity: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_address: string | null;
  note: string | null;
  status: string;
  delivery_status: string | null;
  payment_method: string | null;
  shipping_carrier: string | null;
  tracking_number: string | null;
  action_type: string | null;
  action_date: string | null;
  action_time: string | null;
  created_at: string;
}

const DELIVERY_STEPS = [
  { key: 'pending', label: 'Chờ xác nhận', icon: Clock },
  { key: 'confirmed', label: 'Đã xác nhận', icon: CheckCircle2 },
  { key: 'preparing', label: 'Đang chuẩn bị', icon: Package },
  { key: 'shipped', label: 'Đã giao ĐVVC', icon: Truck },
  { key: 'delivering', label: 'Đang giao', icon: Truck },
  { key: 'delivered', label: 'Giao thành công', icon: CheckCircle2 },
  { key: 'cancelled', label: 'Đã hủy', icon: XCircle },
];

function getStepIndex(status: string, deliveryStatus: string | null): number {
  if (status === 'cancelled') return 6;
  if (status === 'approved' || status === 'confirmed') {
    if (!deliveryStatus || deliveryStatus === 'pending') return 1;
    const map: Record<string, number> = { preparing: 2, shipped: 3, delivering: 4, delivered: 5 };
    return map[deliveryStatus] ?? 1;
  }
  return 0; // pending
}

function canCancel(status: string, deliveryStatus: string | null): boolean {
  if (status === 'cancelled') return false;
  if (status === 'pending') return true;
  if ((status === 'approved' || status === 'confirmed') && (!deliveryStatus || deliveryStatus === 'pending' || deliveryStatus === 'confirmed')) return true;
  return false;
}

interface OrderLookupPageProps {
  tenantId: string;
  accentColor: string;
  storePhone?: string;
  zaloUrl?: string;
  facebookUrl?: string;
  onBack: () => void;
}

export function OrderLookupPage({ tenantId, accentColor, storePhone, zaloUrl, facebookUrl, onBack }: OrderLookupPageProps) {
  const [searchInput, setSearchInput] = useState('');
  const [orders, setOrders] = useState<LandingOrderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<LandingOrderResult | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [confirmDeliveryTarget, setConfirmDeliveryTarget] = useState<LandingOrderResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState<{ pointsEarned: number; order: LandingOrderResult } | null>(null);

  const handleSearch = async () => {
    const q = searchInput.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      let query = supabase
        .from('landing_orders' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      // Detect email vs phone
      if (q.includes('@')) {
        query = query.eq('customer_email', q);
      } else {
        query = query.eq('customer_phone', q);
      }
      const { data, error } = await query;
      if (error) throw error;
      const now = Date.now();
      const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
      const results = ((data || []) as unknown as LandingOrderResult[]).map(o => {
        if ((o.status === 'approved') && o.delivery_status === 'shipped' && o.created_at && now - new Date(o.created_at).getTime() > TWO_DAYS) {
          return { ...o, delivery_status: 'delivering' };
        }
        return o;
      });
      setOrders(results);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await supabase
        .from('landing_orders' as any)
        .update({
          status: 'cancelled',
          cancelled_reason: cancelReason || 'Khách hàng tự hủy',
        })
        .eq('id', cancelTarget.id);
      setOrders(prev => prev.map(o => o.id === cancelTarget.id ? { ...o, status: 'cancelled', cancelled_reason: cancelReason || 'Khách hàng tự hủy' } : o));
    } finally {
      setCancelling(false);
      setCancelTarget(null);
      setCancelReason('');
    }
  };

  const handleConfirmDelivery = async () => {
    if (!confirmDeliveryTarget) return;
    setConfirming(true);
    try {
      // Update order to delivered
      await supabase
        .from('landing_orders' as any)
        .update({ delivery_status: 'delivered' })
        .eq('id', confirmDeliveryTarget.id);

      // Try to award points based on order value
      let pointsEarned = 0;
      try {
        // Get point settings for this tenant
        const { data: ps } = await supabase
          .from('point_settings')
          .select('is_enabled, earn_points, spend_amount')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (ps?.is_enabled && ps.spend_amount > 0 && ps.earn_points > 0) {
          const orderValue = confirmDeliveryTarget.product_price * confirmDeliveryTarget.quantity;
          pointsEarned = Math.floor(orderValue / ps.spend_amount) * ps.earn_points;

          if (pointsEarned > 0) {
            // Find customer by phone
            const { data: customer } = await supabase
              .from('customers')
              .select('id, current_points, total_points_earned')
              .eq('tenant_id', tenantId)
              .eq('phone', confirmDeliveryTarget.customer_phone)
              .maybeSingle();

            if (customer) {
              const newBalance = (customer.current_points || 0) + pointsEarned;
              // Add point transaction
              await supabase.from('point_transactions').insert({
                customer_id: customer.id,
                transaction_type: 'earn',
                points: pointsEarned,
                balance_after: newBalance,
                status: 'active',
                description: `Xác nhận nhận hàng đơn ${confirmDeliveryTarget.order_code || ''}`,
                reference_type: 'landing_order',
                reference_id: confirmDeliveryTarget.id,
              });
              // Update customer points
              await supabase.from('customers')
                .update({
                  current_points: newBalance,
                  total_points_earned: (customer.total_points_earned || 0) + pointsEarned,
                })
                .eq('id', customer.id);
            }
          }
        }
      } catch (e) {
        console.warn('Points award failed:', e);
      }

      // Update local state
      setOrders(prev => prev.map(o => o.id === confirmDeliveryTarget.id ? { ...o, delivery_status: 'delivered' } : o));
      setDeliveryResult({ pointsEarned, order: confirmDeliveryTarget });
    } catch {
      toast.error('Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setConfirming(false);
      setConfirmDeliveryTarget(null);
    }
  };

  const paymentLabel = (m: string | null) => {
    if (m === 'cod') return 'Thanh toán khi nhận hàng';
    if (m === 'transfer') return 'Chuyển khoản';
    return 'Chưa xác định';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold text-lg">Tra cứu đơn hàng</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Search box */}
        <Card className="border-0 shadow-md">
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm text-gray-500">Nhập số điện thoại hoặc email đã đặt hàng</p>
            <div className="flex gap-2">
              <Input
                placeholder="Số điện thoại / Email"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button
                onClick={handleSearch}
                disabled={loading || !searchInput.trim()}
                style={{ backgroundColor: accentColor }}
                className="text-white shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-1.5 hidden sm:inline">Kiểm tra</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && !loading && orders.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <ShoppingBag className="h-12 w-12 mx-auto text-gray-300" />
            <p className="text-gray-500 font-medium">Không tìm thấy đơn hàng</p>
            <p className="text-sm text-gray-400">Vui lòng kiểm tra lại thông tin</p>
          </div>
        )}

        {orders.map(order => {
          const stepIdx = getStepIndex(order.status, order.delivery_status);
          const isCancelled = order.status === 'cancelled';
          const activeSteps = isCancelled
            ? DELIVERY_STEPS.filter(s => s.key === 'cancelled')
            : DELIVERY_STEPS.filter(s => s.key !== 'cancelled');

          return (
            <Card key={order.id} className="border-0 shadow-md overflow-hidden">
              <CardContent className="pt-5 space-y-4">
                {/* Order header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm" style={{ color: accentColor }}>
                      {order.order_code || order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    isCancelled ? 'bg-red-100 text-red-600' :
                    stepIdx >= 5 ? 'bg-green-100 text-green-600' :
                    'bg-amber-100 text-amber-600'
                  }`}>
                    {isCancelled ? 'Đã hủy' : activeSteps[Math.min(stepIdx, activeSteps.length - 1)]?.label}
                  </span>
                </div>

                {/* Status timeline */}
                {!isCancelled && (
                  <div className="flex items-center gap-0 overflow-x-auto pb-2">
                    {activeSteps.map((step, i) => {
                      const active = i <= stepIdx;
                      const StepIcon = step.icon;
                      return (
                        <div key={step.key} className="flex items-center shrink-0">
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                                active ? 'text-white' : 'bg-gray-100 text-gray-300'
                              }`}
                              style={active ? { backgroundColor: accentColor } : {}}
                            >
                              <StepIcon className="h-3.5 w-3.5" />
                            </div>
                            <span className={`text-[10px] mt-1 text-center w-16 leading-tight ${active ? 'font-semibold text-gray-700' : 'text-gray-400'}`}>
                              {step.label}
                            </span>
                          </div>
                          {i < activeSteps.length - 1 && (
                            <div className={`w-6 h-0.5 mt-[-14px] ${i < stepIdx ? '' : 'bg-gray-200'}`}
                              style={i < stepIdx ? { backgroundColor: accentColor } : {}}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Product info */}
                <div className="flex gap-3 bg-gray-50 rounded-xl p-3">
                  {order.product_image_url ? (
                    <img src={order.product_image_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                      <Package className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{order.product_name}</p>
                    {order.variant && <p className="text-xs text-gray-500">{order.variant}</p>}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400">x{order.quantity}</span>
                      <span className="font-bold text-sm" style={{ color: accentColor }}>
                        {formatNumber(order.product_price * order.quantity)}₫
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delivery info */}
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">{order.customer_name} · {order.customer_phone}</p>
                      {order.customer_address && <p className="text-gray-500 text-xs">{order.customer_address}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Package className="h-3.5 w-3.5 shrink-0" />
                    {paymentLabel(order.payment_method)}
                  </div>
                  {order.shipping_carrier && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Truck className="h-3.5 w-3.5 shrink-0" />
                      {order.shipping_carrier}{order.tracking_number ? ` · ${order.tracking_number}` : ''}
                    </div>
                  )}
                  {order.action_type && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {order.action_type}{order.action_date ? ` · ${order.action_date}` : ''}{order.action_time ? ` ${order.action_time}` : ''}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-1 flex-wrap">
                  {/* Confirm delivery button - show when delivering or shipped */}
                  {!isCancelled && stepIdx >= 3 && stepIdx < 5 && order.delivery_status !== 'delivered' && (
                    <Button
                      size="sm"
                      className="flex-1 text-white gap-1"
                      style={{ backgroundColor: '#22c55e' }}
                      onClick={() => setConfirmDeliveryTarget(order)}
                    >
                      <PackageCheck className="h-3.5 w-3.5" /> Tôi đã nhận hàng
                    </Button>
                  )}
                  {canCancel(order.status, order.delivery_status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-red-500 border-red-200 hover:bg-red-50"
                      onClick={() => setCancelTarget(order)}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Hủy đơn
                    </Button>
                  )}
                  {order.tracking_number && (stepIdx >= 3) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(`https://tracking.ghn.dev/?order_code=${order.tracking_number}`, '_blank')}
                    >
                      <Truck className="h-3.5 w-3.5 mr-1" /> Theo dõi vận chuyển
                    </Button>
                  )}
                  {(storePhone || zaloUrl || facebookUrl) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setShowContactDialog(true)}
                    >
                      <HeadphonesIcon className="h-3.5 w-3.5 mr-1" /> Liên hệ
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Bottom action */}
        {searched && (
          <div className="flex justify-center pt-2">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium bg-white shadow border hover:bg-gray-50 transition-colors"
            >
              <ShoppingBag className="h-4 w-4" style={{ color: accentColor }} /> Tiếp tục mua sắm
            </button>
          </div>
        )}
      </div>

      {/* Cancel dialog */}
      {/* Contact dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base">🛟 Liên hệ hỗ trợ</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            {storePhone && (
              <a href={`tel:${storePhone}`}
                className="flex items-center gap-3 p-3 rounded-xl border hover:bg-gray-50 transition-colors"
                onClick={() => setShowContactDialog(false)}
              >
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <Phone className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Gọi hotline</p>
                  <p className="text-xs text-gray-500">{storePhone}</p>
                </div>
              </a>
            )}
            {zaloUrl && (
              <a href={zaloUrl.startsWith('http') ? zaloUrl : `https://zalo.me/${zaloUrl.replace(/\s/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border hover:bg-gray-50 transition-colors"
                onClick={() => setShowContactDialog(false)}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <MessageCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Chat Zalo</p>
                  <p className="text-xs text-gray-500">Nhắn tin trực tiếp</p>
                </div>
              </a>
            )}
            {facebookUrl && (
              <a href={facebookUrl.startsWith('http') ? facebookUrl : `https://${facebookUrl}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border hover:bg-gray-50 transition-colors"
                onClick={() => setShowContactDialog(false)}
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <MessageCircle className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Facebook Messenger</p>
                  <p className="text-xs text-gray-500">Nhắn tin qua Facebook</p>
                </div>
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={open => { if (!open) { setCancelTarget(null); setCancelReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" /> Xác nhận hủy đơn hàng
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn hủy đơn hàng <strong>{cancelTarget?.order_code}</strong>? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Lý do hủy (tùy chọn)"
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Quay lại</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Xác nhận hủy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delivery dialog */}
      <AlertDialog open={!!confirmDeliveryTarget} onOpenChange={open => { if (!open) setConfirmDeliveryTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-green-500" /> Xác nhận đã nhận hàng
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn xác nhận đã nhận được đơn hàng <strong>{confirmDeliveryTarget?.order_code}</strong> — {confirmDeliveryTarget?.product_name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>Quay lại</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelivery}
              disabled={confirming}
              className="text-white"
              style={{ backgroundColor: '#22c55e' }}
            >
              {confirming ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <PackageCheck className="h-4 w-4 mr-1" />}
              Xác nhận nhận hàng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delivery success + points dialog */}
      <Dialog open={!!deliveryResult} onOpenChange={v => { if (!v) setDeliveryResult(null); }}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-lg">Cảm ơn bạn!</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-500">
              Đơn hàng <strong>{deliveryResult?.order.order_code}</strong> đã được xác nhận giao thành công.
            </p>
            {deliveryResult && deliveryResult.pointsEarned > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 w-full">
                <div className="flex items-center justify-center gap-2 text-amber-600 font-semibold">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  +{formatNumber(deliveryResult.pointsEarned)} điểm tích lũy
                </div>
                <p className="text-xs text-amber-500 mt-1">Điểm đã được cộng vào tài khoản của bạn</p>
              </div>
            )}
            <Button
              className="w-full mt-2 text-white"
              style={{ backgroundColor: accentColor }}
              onClick={() => setDeliveryResult(null)}
            >
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
