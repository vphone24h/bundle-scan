import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShoppingCart, CheckCircle2, ArrowLeft, Mail, Gift, Ticket, Star, Search, X, Trash2, Plus, Minus } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { toast } from 'sonner';
import { useLandingCart, CartItem } from '@/hooks/useLandingCart';
import { usePlaceLandingOrder } from '@/hooks/useLandingOrders';
import { usePublicCustomerVouchers } from '@/hooks/useVouchers';
import { useCustomerPointsPublic } from '@/hooks/useTenantLanding';

interface CartCheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  primaryColor: string;
  branches: { id: string; name: string }[];
  onNavigateOrderLookup?: () => void;
}

export function CartCheckoutDialog({
  open, onClose, tenantId, primaryColor, branches, onNavigateOrderLookup,
}: CartCheckoutDialogProps) {
  const cart = useLandingCart();
  const placeOrder = usePlaceLandingOrder();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [note, setNote] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(branches.length === 1 ? branches[0].id : '');
  const [attempted, setAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Voucher & Points
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [debouncedPhone, setDebouncedPhone] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      if (customerPhone.replace(/\s/g, '').length >= 10) {
        setDebouncedPhone(customerPhone.trim());
      } else {
        setDebouncedPhone('');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [customerPhone]);

  const { data: customerVouchers } = usePublicCustomerVouchers(debouncedPhone, tenantId);
  const { data: customerPoints } = useCustomerPointsPublic(debouncedPhone, tenantId);

  const unusedVouchers = useMemo(() =>
    (customerVouchers || []).filter((v: any) => v.status === 'unused'),
    [customerVouchers]
  );

  const totalCartPrice = cart.totalPrice;

  const selectedVoucher = useMemo(() => {
    if (!selectedVoucherId) return null;
    return unusedVouchers.find((v: any) => v.id === selectedVoucherId) || null;
  }, [selectedVoucherId, unusedVouchers]);

  const voucherDiscount = useMemo(() => {
    if (!selectedVoucher) return 0;
    if (selectedVoucher.discount_type === 'percentage') {
      return Math.floor(totalCartPrice * selectedVoucher.discount_value / 100);
    }
    return Math.min(selectedVoucher.discount_value, totalCartPrice);
  }, [selectedVoucher, totalCartPrice]);

  const pointsDiscount = useMemo(() => {
    if (!usePoints || !customerPoints || !customerPoints.is_points_enabled) return 0;
    if (customerPoints.current_points <= 0 || customerPoints.redeem_points <= 0 || customerPoints.point_value <= 0) return 0;
    const rawDiscount = Math.floor(customerPoints.current_points / customerPoints.redeem_points) * customerPoints.point_value;
    const hasMaxLimit = customerPoints.max_redemption_amount && customerPoints.max_redemption_amount > 0;
    const cappedDiscount = hasMaxLimit ? Math.min(rawDiscount, customerPoints.max_redemption_amount) : rawDiscount;
    return Math.min(cappedDiscount, totalCartPrice);
  }, [usePoints, customerPoints, totalCartPrice]);

  const totalDiscount = selectedVoucherId ? voucherDiscount : (usePoints ? pointsDiscount : 0);
  const finalPrice = Math.max(0, totalCartPrice - totalDiscount);

  const handleSubmit = async () => {
    setAttempted(true);
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    const branchId = selectedBranch || (branches.length === 1 ? branches[0].id : '');
    if (!branchId) {
      toast.error('Vui lòng chọn chi nhánh');
      return;
    }
    if (cart.items.length === 0) {
      toast.error('Giỏ hàng trống');
      return;
    }

    setIsSubmitting(true);
    try {
      const discountNote = selectedVoucher
        ? `[Voucher: ${selectedVoucher.code} - Giảm ${formatNumber(voucherDiscount)}đ]`
        : usePoints && pointsDiscount > 0
          ? `[Điểm tích lũy: Giảm ${formatNumber(pointsDiscount)}đ]`
          : '';

      // Generate a shared order code prefix for grouping
      const groupId = `CART-${Date.now()}`;
      const fullNote = [
        cart.items.length > 1 ? `[Đơn nhóm: ${cart.items.length} SP]` : '',
        discountNote,
        note.trim(),
      ].filter(Boolean).join(' ');

      // Place each cart item as a separate order with same note grouping
      for (const item of cart.items) {
        const itemPackagesNote = item.selectedPackages && item.selectedPackages.length > 0
          ? `[Gói DV: ${item.selectedPackages.map(pkg => `${pkg.name} (+${formatNumber(pkg.price)}đ)`).join(', ')}]`
          : '';

        await placeOrder.mutateAsync({
          tenant_id: tenantId,
          branch_id: branchId,
          product_id: item.productId,
          product_name: item.productName,
          product_image_url: item.productImageUrl,
          product_price: item.price,
          variant: item.variant,
          quantity: item.quantity,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_email: customerEmail.trim() || undefined,
          customer_address: customerAddress.trim() || undefined,
          note: [fullNote, itemPackagesNote].filter(Boolean).join(' ') || undefined,
          selected_packages: item.selectedPackages || undefined,
        });
      }

      setOrderSuccess(true);
      cart.clearCart();
    } catch (err: any) {
      console.error('Cart order failed:', err);
      toast.error('Đặt hàng thất bại, vui lòng thử lại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!orderSuccess) {
      onClose();
      return;
    }
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setCustomerAddress('');
    setNote('');
    setSelectedBranch(branches.length === 1 ? branches[0].id : '');
    setAttempted(false);
    setOrderSuccess(false);
    setSelectedVoucherId(null);
    setUsePoints(false);
    setDebouncedPhone('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
          <ShoppingCart className="h-5 w-5" style={{ color: primaryColor }} />
          <h2 className="font-semibold text-base flex-1">Đặt hàng ({cart.items.length} sản phẩm)</h2>
          <button onClick={handleClose} className="p-1 rounded-full hover:bg-muted transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {orderSuccess ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="h-14 w-14 mx-auto text-green-500" />
              <p className="font-semibold text-lg">Chúc mừng bạn đã đặt hàng thành công!</p>
              <p className="text-sm text-muted-foreground">Cửa hàng sẽ liên hệ bạn trong thời gian sớm nhất.</p>
              {onNavigateOrderLookup && (
                <>
                  <p className="text-xs text-muted-foreground">Nhấn vào link tra cứu đơn đặt hàng để kiểm tra trạng thái.</p>
                  <Button variant="outline" className="w-full h-11" onClick={() => { handleClose(); onNavigateOrderLookup(); }}
                    style={{ borderColor: primaryColor, color: primaryColor }}>
                    <Search className="h-4 w-4 mr-1.5" /> Kiểm tra trạng thái đặt hàng
                  </Button>
                </>
              )}
              <Button variant="outline" className="w-full h-11" onClick={handleClose}>Đóng</Button>
            </div>
          ) : (
            <>
              {/* Cart items summary */}
              <div className="space-y-2">
                {cart.items.map((item, i) => (
                  <div key={`${item.productId}-${item.variant || ''}-${i}`} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                    {item.productImageUrl && (
                      <img src={item.productImageUrl} alt="" className="h-12 w-12 rounded-md object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{item.productName}</p>
                      {item.variant && <p className="text-[10px] text-muted-foreground">{item.variant}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center border rounded-md bg-white">
                          <button onClick={() => cart.updateQuantity(item.itemKey, item.quantity - 1)}
                            className="p-1 hover:bg-muted transition-colors rounded-l-md">
                            <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <span className="px-2.5 text-sm font-medium min-w-[28px] text-center">{item.quantity}</span>
                          <button onClick={() => cart.updateQuantity(item.itemKey, item.quantity + 1)}
                            className="p-1 hover:bg-muted transition-colors rounded-r-md">
                            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <span className="text-xs text-muted-foreground">×</span>
                        <span className="text-xs font-medium" style={{ color: primaryColor }}>{formatNumber(item.price)}đ</span>
                      </div>
                      {item.selectedPackages && item.selectedPackages.length > 0 && (() => {
                        const groupMap = new Map<string, typeof item.selectedPackages>();
                        item.selectedPackages.forEach(pkg => {
                          const gName = pkg.groupName || 'Gói dịch vụ kèm theo';
                          const arr = groupMap.get(gName) || [];
                          arr.push(pkg);
                          groupMap.set(gName, arr);
                        });
                        const groups = Array.from(groupMap.entries());
                        return (
                          <div className="mt-1.5 space-y-1.5 rounded-md border border-dashed bg-background/70 p-2">
                            {groups.map(([gName, pkgs]) => (
                              <div key={gName} className="space-y-0.5">
                                <p className="text-[11px] font-semibold text-muted-foreground">{gName}</p>
                                {pkgs.map(pkg => {
                                  const pq = pkg.quantity || 1;
                                  return (
                                    <div key={pkg.id} className="flex justify-between text-[11px]">
                                      <span className="text-muted-foreground">• {pkg.name}{pq > 1 ? ` × ${pq}` : ''}</span>
                                      <span className="font-medium">{pkg.price > 0 ? `+${formatNumber(pkg.price * pq)}đ` : 'Miễn phí'}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                            <div className="flex justify-between border-t pt-1 text-[11px] font-medium">
                              <span>Tổng dịch vụ kèm theo</span>
                              <span>{item.packagesTotal && item.packagesTotal > 0 ? `+${formatNumber(item.packagesTotal * item.quantity)}đ` : '0đ'}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <button onClick={() => cart.removeItem(item.itemKey)}
                        className="p-1 rounded-full hover:bg-red-50 transition-colors">
                        <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                      </button>
                      <div className="text-right space-y-0.5">
                        <p className="text-[11px] text-muted-foreground">Tiền máy: {formatNumber(item.basePrice * item.quantity)}đ</p>
                        <p className="text-sm font-bold" style={{ color: primaryColor }}>
                          {formatNumber(item.price * item.quantity)}đ
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Customer info */}
              <div className="border-t pt-3 space-y-3">
                <h3 className="font-semibold text-sm">Thông tin nhận hàng</h3>
                <div>
                  <Label className="text-sm">Họ tên <span className="text-destructive">*</span></Label>
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nhập họ tên"
                    className={`h-11 text-base ${attempted && !customerName.trim() ? 'border-red-400' : ''}`} />
                </div>
                <div>
                  <Label className="text-sm">Số điện thoại <span className="text-destructive">*</span></Label>
                  <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Nhập số điện thoại" inputMode="tel"
                    className={`h-11 text-base ${attempted && !customerPhone.trim() ? 'border-red-400' : ''}`} />
                  <p className="text-xs font-medium mt-1" style={{ color: primaryColor }}>Nhập SĐT đã từng mua hàng để được ưu đãi</p>
                </div>
                <div>
                  <Label className="text-sm flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Email</Label>
                  <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="Nhập email" type="email" inputMode="email"
                    className="h-11 text-base" />
                  <p className="text-xs text-muted-foreground mt-1">Nhập đúng mail để nhận thông tin đơn hàng và bảo hành</p>
                </div>
                <div>
                  <Label className="text-sm">Chi nhánh nhận hàng <span className="text-destructive">*</span></Label>
                  <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
                    className={`flex h-11 w-full rounded-md border bg-white px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${attempted && !selectedBranch && branches.length > 1 ? 'border-red-400' : 'border-input'}`}>
                    <option value="">Chọn chi nhánh</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-sm">Địa chỉ</Label>
                  <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Nhập địa chỉ (không bắt buộc)" className="h-11 text-base" />
                </div>
                <div>
                  <Label className="text-sm">Ghi chú</Label>
                  <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..." rows={2} className="text-base" />
                </div>
              </div>

              {/* Voucher & Points */}
              {debouncedPhone && (
                <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
                  <p className="text-xs font-medium flex items-center gap-1.5">
                    <Gift className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                    Ưu đãi của bạn
                  </p>
                  {unusedVouchers.length === 0 && !(customerPoints?.is_points_enabled && customerPoints.current_points > 0) ? (
                    <p className="text-xs text-muted-foreground italic">Chưa có ưu đãi giảm giá</p>
                  ) : (
                    <>
                      {unusedVouchers.length > 0 && (
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1"><Ticket className="h-3 w-3" /> Voucher ({unusedVouchers.length})</Label>
                          <select value={selectedVoucherId || ''} onChange={e => { setSelectedVoucherId(e.target.value || null); if (e.target.value) setUsePoints(false); }}
                            className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-1 text-sm">
                            <option value="">Không sử dụng voucher</option>
                            {unusedVouchers.map((v: any) => (
                              <option key={v.id} value={v.id}>
                                {v.voucher_name} - {v.discount_type === 'percentage' ? `${v.discount_value}%` : `${formatNumber(v.discount_value)}đ`} ({v.code})
                              </option>
                            ))}
                          </select>
                          {selectedVoucher && voucherDiscount > 0 && (
                            <p className="text-xs text-green-600 font-medium">Giảm: {formatNumber(voucherDiscount)}đ</p>
                          )}
                        </div>
                      )}
                      {customerPoints?.is_points_enabled && customerPoints.current_points > 0 && customerPoints.redeem_points > 0 && (
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={usePoints} onChange={e => { setUsePoints(e.target.checked); if (e.target.checked) setSelectedVoucherId(null); }}
                              className="rounded border-input" disabled={!!selectedVoucherId} />
                            <span className="text-xs flex items-center gap-1">
                              <Star className="h-3 w-3 text-amber-500" />
                              Dùng {formatNumber(customerPoints.current_points)} điểm
                              {pointsDiscount > 0 && !selectedVoucherId && (
                                <span className="text-green-600 font-medium">(Giảm {formatNumber(pointsDiscount)}đ)</span>
                              )}
                            </span>
                          </label>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Order summary */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1.5">
                {cart.items.map((item, i) => (
                  <div key={i} className="space-y-1 border-b border-dashed pb-2 last:border-0 last:pb-0">
                    <div className="flex justify-between text-muted-foreground">
                      <span className="truncate max-w-[55%]">{item.productName} x{item.quantity}</span>
                      <span>{formatNumber(item.price * item.quantity)}đ</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Tiền máy</span>
                      <span>{formatNumber(item.basePrice * item.quantity)}đ</span>
                    </div>
                    {item.selectedPackages && item.selectedPackages.length > 0 && (
                      <>
                        {item.selectedPackages.map(pkg => (
                          <div key={pkg.id} className="flex justify-between text-xs text-muted-foreground">
                            <span>• {pkg.name}</span>
                            <span>{pkg.price > 0 ? `+${formatNumber(pkg.price * item.quantity)}đ` : 'Miễn phí'}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs font-medium">
                          <span>Tổng gói DV</span>
                          <span>{item.packagesTotal && item.packagesTotal > 0 ? `+${formatNumber(item.packagesTotal * item.quantity)}đ` : '0đ'}</span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {totalDiscount > 0 && (
                  <>
                    <div className="flex justify-between text-muted-foreground pt-1 border-t">
                      <span>Tạm tính:</span>
                      <span>{formatNumber(totalCartPrice)}đ</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>{selectedVoucher ? `Voucher (${selectedVoucher.code})` : 'Điểm tích lũy'}:</span>
                      <span>-{formatNumber(totalDiscount)}đ</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold pt-1.5 border-t">
                  <span>Tổng thanh toán:</span>
                  <span className="text-lg" style={{ color: primaryColor }}>{formatNumber(finalPrice)}đ</span>
                </div>
              </div>

              <Button className="w-full h-12 text-base font-semibold gap-2" style={{ backgroundColor: primaryColor }}
                onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
                Xác nhận đặt hàng
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
