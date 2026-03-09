import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Package, Phone, ShoppingCart, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Gift, Star, Ticket, Link2, CreditCard, Shield, Search } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import DOMPurify from 'dompurify';
import { LandingProduct, LandingProductVariant, VariantPriceEntry } from '@/hooks/useLandingProducts';
import { usePlaceLandingOrder } from '@/hooks/useLandingOrders';
import { usePublicCustomerVouchers } from '@/hooks/useVouchers';
import { useCustomerPointsPublic } from '@/hooks/useTenantLanding';
import { toast } from 'sonner';

interface BranchOption {
  id: string;
  name: string;
}

interface ProductDetailDialogProps {
  product: LandingProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  branches: BranchOption[];
  primaryColor: string;
  warrantyHotline?: string | null;
  onShare?: () => void;
  onInstallment?: () => void;
  onNavigateOrderLookup?: () => void;
  showPromotionSection?: boolean;
  showWarrantySection?: boolean;
  showInstallmentButton?: boolean;
}

export function ProductDetailDialog({
  product, open, onOpenChange, tenantId, branches, primaryColor,
  warrantyHotline, onShare, onInstallment, onNavigateOrderLookup,
  showPromotionSection = true,
  showWarrantySection = true,
  showInstallmentButton = true,
}: ProductDetailDialogProps) {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [note, setNote] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [attempted, setAttempted] = useState(false);

  // 2-level variant selections
  const [selectedOption1, setSelectedOption1] = useState<string | null>(null);
  const [selectedOption2, setSelectedOption2] = useState<string | null>(null);

  const placeOrder = usePlaceLandingOrder();

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

  const { data: customerVouchers } = usePublicCustomerVouchers(debouncedPhone, tenantId || null);
  const { data: customerPoints } = useCustomerPointsPublic(debouncedPhone, tenantId || null);

  const unusedVouchers = useMemo(() =>
    (customerVouchers || []).filter((v: any) => v.status === 'unused'),
    [customerVouchers]
  );

  // Check if product uses 2-level variant system
  const variantOptions1: Array<{ name: string; image_url?: string }> = useMemo(() => {
    if (!product) return [];
    const opts = product.variant_options_1;
    return Array.isArray(opts) ? opts.filter(o => o.name) : [];
  }, [product]);

  const variantOptions2: Array<{ name: string; image_url?: string }> = useMemo(() => {
    if (!product) return [];
    const opts = product.variant_options_2;
    return Array.isArray(opts) ? opts.filter(o => o.name) : [];
  }, [product]);

  const variantPrices: VariantPriceEntry[] = useMemo(() => {
    if (!product) return [];
    return Array.isArray(product.variant_prices) ? product.variant_prices : [];
  }, [product]);

  const uses2LevelVariants = variantOptions1.length > 0;

  // Legacy single-level variants
  const legacyVariants: LandingProductVariant[] = useMemo(() => {
    if (uses2LevelVariants) return [];
    try {
      const v = product?.variants as any;
      if (!Array.isArray(v)) return [];
      return v.map((item: any) => {
        if (typeof item === 'string') return { name: item, price: 0 };
        if (item && typeof item === 'object' && item.name) return { name: item.name, price: item.price || 0, image_url: item.image_url };
        return null;
      }).filter(Boolean) as LandingProductVariant[];
    } catch { }
    return [];
  }, [product?.variants, uses2LevelVariants]);

  // Find the matching variant price entry
  const matchedVariantPrice = useMemo(() => {
    if (!uses2LevelVariants || !selectedOption1) return null;
    return variantPrices.find(vp =>
      vp.option1 === selectedOption1 && (variantOptions2.length === 0 || vp.option2 === selectedOption2)
    ) || null;
  }, [uses2LevelVariants, selectedOption1, selectedOption2, variantPrices, variantOptions2]);

  // All images
  const allImages = useMemo(() => {
    if (!product) return [];
    const imgs: string[] = [];
    if (Array.isArray(product.images) && product.images.length > 0) {
      imgs.push(...product.images);
    } else if (product.image_url) {
      imgs.push(product.image_url);
    }
    if (!uses2LevelVariants) {
      legacyVariants.forEach(v => {
        if (v.image_url && !imgs.includes(v.image_url)) imgs.push(v.image_url);
      });
    }
    return imgs;
  }, [product, legacyVariants, uses2LevelVariants]);

  const selectedLegacyVariant = selectedVariantIndex !== null ? legacyVariants[selectedVariantIndex] : null;

  // Calculate price
  const basePrice = useMemo(() => {
    if (uses2LevelVariants && matchedVariantPrice) {
      return matchedVariantPrice.sale_price || matchedVariantPrice.price;
    }
    if (selectedLegacyVariant && selectedLegacyVariant.price > 0) {
      return selectedLegacyVariant.price;
    }
    return product?.sale_price || product?.price || 0;
  }, [uses2LevelVariants, matchedVariantPrice, selectedLegacyVariant, product]);

  const originalPrice = useMemo(() => {
    if (uses2LevelVariants && matchedVariantPrice && matchedVariantPrice.sale_price) {
      return matchedVariantPrice.price;
    }
    if (!uses2LevelVariants && !selectedLegacyVariant && product?.sale_price) {
      return product.price;
    }
    return 0;
  }, [uses2LevelVariants, matchedVariantPrice, selectedLegacyVariant, product]);

  // Voucher/points discount
  const selectedVoucher = useMemo(() => {
    if (!selectedVoucherId) return null;
    return unusedVouchers.find((v: any) => v.id === selectedVoucherId) || null;
  }, [selectedVoucherId, unusedVouchers]);

  const voucherDiscount = useMemo(() => {
    if (!selectedVoucher) return 0;
    if (selectedVoucher.discount_type === 'percentage') {
      return Math.floor(basePrice * selectedVoucher.discount_value / 100);
    }
    return Math.min(selectedVoucher.discount_value, basePrice);
  }, [selectedVoucher, basePrice]);

  const pointsDiscount = useMemo(() => {
    if (!usePoints || !customerPoints || !customerPoints.is_points_enabled) return 0;
    if (customerPoints.current_points <= 0 || customerPoints.redeem_points <= 0 || customerPoints.point_value <= 0) return 0;
    const rawDiscount = Math.floor(customerPoints.current_points / customerPoints.redeem_points) * customerPoints.point_value;
    const hasMaxLimit = customerPoints.max_redemption_enabled && customerPoints.max_redemption_amount > 0;
    const cappedDiscount = hasMaxLimit ? Math.min(rawDiscount, customerPoints.max_redemption_amount) : rawDiscount;
    return Math.min(cappedDiscount, basePrice);
  }, [usePoints, customerPoints, basePrice]);

  const totalDiscount = selectedVoucherId ? voucherDiscount : (usePoints ? pointsDiscount : 0);
  const displayPrice = Math.max(0, basePrice - totalDiscount);

  const handleSelectLegacyVariant = (i: number) => {
    const newIdx = selectedVariantIndex === i ? null : i;
    setSelectedVariantIndex(newIdx);
    if (newIdx !== null) {
      const v = legacyVariants[newIdx];
      if (v.image_url) {
        const imgIdx = allImages.indexOf(v.image_url);
        if (imgIdx >= 0) setCurrentImageIndex(imgIdx);
      }
    }
  };

  const resetForm = () => {
    setShowOrderForm(false);
    setOrderSuccess(false);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setNote('');
    setSelectedBranch('');
    setSelectedVariantIndex(null);
    setSelectedOption1(null);
    setSelectedOption2(null);
    setQuantity(1);
    setCurrentImageIndex(0);
    setSelectedVoucherId(null);
    setUsePoints(false);
    setDebouncedPhone('');
    setAttempted(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) resetForm();
    onOpenChange(val);
  };

  const getVariantLabel = () => {
    if (uses2LevelVariants) {
      const parts = [selectedOption1, selectedOption2].filter(Boolean);
      return parts.join(' / ') || undefined;
    }
    return selectedLegacyVariant?.name;
  };

  const handleSubmitOrder = async () => {
    setAttempted(true);
    if (!product || !customerName.trim() || !customerPhone.trim() || !selectedBranch) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    // Validate variant selection
    if (uses2LevelVariants && variantOptions1.length > 0 && !selectedOption1) {
      toast.error(`Vui lòng chọn ${product.variant_group_1_name || 'biến thể cấp 1'}`);
      return;
    }
    if (uses2LevelVariants && variantOptions2.length > 0 && !selectedOption2) {
      toast.error(`Vui lòng chọn ${product.variant_group_2_name || 'biến thể cấp 2'}`);
      return;
    }
    if (!uses2LevelVariants && legacyVariants.length > 0 && selectedVariantIndex === null) {
      toast.error('Vui lòng chọn biến thể sản phẩm');
      return;
    }
    try {
      const discountNote = selectedVoucher
        ? `[Voucher: ${selectedVoucher.code} - Giảm ${formatNumber(voucherDiscount)}đ]`
        : usePoints && pointsDiscount > 0
          ? `[Điểm tích lũy: Giảm ${formatNumber(pointsDiscount)}đ]`
          : '';
      const fullNote = [discountNote, note.trim()].filter(Boolean).join(' ');

      const result = await placeOrder.mutateAsync({
        tenant_id: tenantId,
        branch_id: selectedBranch,
        product_id: product.id,
        product_name: product.name,
        product_image_url: product.image_url,
        product_price: displayPrice,
        variant: getVariantLabel(),
        quantity,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim() || undefined,
        note: fullNote || undefined,
      });
      setOrderSuccess(true);

      // Fire-and-forget: send Zalo OA message
      import('@/integrations/supabase/client').then(({ supabase }) => {
        supabase.functions.invoke('send-zalo-message', {
          body: {
            tenant_id: tenantId,
            customer_name: customerName.trim(),
            customer_phone: customerPhone.trim(),
            message_type: 'order_confirmation',
            order_code: (result as any)?.order_code || '',
            product_name: product.name,
            product_price: displayPrice,
            branch_id: selectedBranch,
          },
        }).catch(err => console.warn('Zalo message failed:', err));
      });
    } catch (err: any) {
      console.error('Order placement failed:', err?.message || err, JSON.stringify(err));
      toast.error('Đặt hàng thất bại, vui lòng thử lại');
    }
  };

  if (!product) return null;

  const promotionTitle = product.promotion_title || 'KHUYẾN MÃI';
  const warrantyTitle = product.warranty_title || 'BẢO HÀNH';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 [&>button:last-child]:bg-black/60 [&>button:last-child]:text-white [&>button:last-child]:opacity-100 [&>button:last-child]:rounded-full [&>button:last-child]:h-8 [&>button:last-child]:w-8 [&>button:last-child]:top-2 [&>button:last-child]:right-2 [&>button:last-child>svg]:h-5 [&>button:last-child>svg]:w-5">
        {/* Image gallery */}
        {allImages.length > 0 ? (
          <div className="relative">
            <img
              src={allImages[currentImageIndex]}
              alt={product.name}
              className="w-full aspect-square object-cover rounded-t-lg"
            />
            {allImages.length > 1 && (
              <>
                <button onClick={() => setCurrentImageIndex(i => (i - 1 + allImages.length) % allImages.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={() => setCurrentImageIndex(i => (i + 1) % allImages.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 px-4">
                  {allImages.map((img, idx) => (
                    <button key={idx} onClick={() => setCurrentImageIndex(idx)}
                      className={`h-10 w-10 rounded border-2 overflow-hidden flex-shrink-0 ${currentImageIndex === idx ? 'border-white shadow-lg' : 'border-transparent opacity-70'}`}>
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="w-full aspect-square bg-muted flex items-center justify-center rounded-t-lg">
            <Package className="h-16 w-16 text-muted-foreground" />
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* Title + Share */}
          <DialogHeader className="text-left p-0">
            <div className="flex items-start justify-between gap-2">
              <DialogTitle className="text-lg">{product.name}</DialogTitle>
              {onShare && (
                <Button variant="outline" size="sm" className="gap-1 text-xs shrink-0" onClick={onShare}>
                  <Link2 className="h-3.5 w-3.5" /> Chia sẻ
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold" style={{ color: primaryColor }}>{formatNumber(displayPrice)}đ</span>
            {totalDiscount > 0 && (
              <span className="text-sm text-muted-foreground line-through">{formatNumber(basePrice)}đ</span>
            )}
            {!totalDiscount && originalPrice > 0 && (
              <span className="text-sm text-muted-foreground line-through">{formatNumber(originalPrice)}đ</span>
            )}
          </div>

          {/* ===== 2-LEVEL VARIANTS ===== */}
          {uses2LevelVariants && (
            <div className="space-y-3">
              {/* Level 1 */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {product.variant_group_1_name || 'Biến thể 1'} <span className="text-destructive">*</span>
                </Label>
                <div className={`flex flex-wrap gap-2 p-2 rounded-md ${attempted && !selectedOption1 ? 'border-2 border-destructive' : ''}`}>
                  {variantOptions1.map((opt, i) => (
                    <Badge
                      key={i}
                      variant={selectedOption1 === opt.name ? 'default' : 'outline'}
                      className="cursor-pointer text-sm px-3 py-1.5"
                      style={selectedOption1 === opt.name ? { backgroundColor: primaryColor } : {}}
                      onClick={() => setSelectedOption1(selectedOption1 === opt.name ? null : opt.name)}
                    >
                      {opt.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Level 2 */}
              {variantOptions2.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    {product.variant_group_2_name || 'Biến thể 2'} <span className="text-destructive">*</span>
                  </Label>
                  <div className={`flex flex-wrap gap-2 p-2 rounded-md ${attempted && !selectedOption2 ? 'border-2 border-destructive' : ''}`}>
                    {variantOptions2.map((opt, i) => (
                      <Badge
                        key={i}
                        variant={selectedOption2 === opt.name ? 'default' : 'outline'}
                        className="cursor-pointer text-sm px-3 py-1.5"
                        style={selectedOption2 === opt.name ? { backgroundColor: primaryColor } : {}}
                        onClick={() => setSelectedOption2(selectedOption2 === opt.name ? null : opt.name)}
                      >
                        {opt.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Stock info */}
              {matchedVariantPrice && matchedVariantPrice.stock !== undefined && matchedVariantPrice.stock > 0 && (
                <p className="text-xs text-muted-foreground">Còn {matchedVariantPrice.stock} sản phẩm</p>
              )}
            </div>
          )}

          {/* ===== LEGACY VARIANTS ===== */}
          {!uses2LevelVariants && legacyVariants.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Chọn phiên bản <span className="text-destructive">*</span></Label>
              <div className={`flex flex-wrap gap-2 p-2 rounded-md ${attempted && selectedVariantIndex === null ? 'border-2 border-destructive' : ''}`}>
                {legacyVariants.map((v, i) => (
                  <Badge key={i} variant={selectedVariantIndex === i ? 'default' : 'outline'}
                    className="cursor-pointer text-sm px-2 py-1.5 flex items-center gap-1.5"
                    style={selectedVariantIndex === i ? { backgroundColor: primaryColor } : {}}
                    onClick={() => handleSelectLegacyVariant(i)}>
                    {v.image_url && <img src={v.image_url} alt="" className="h-6 w-6 rounded object-cover" />}
                    <div className="flex flex-col items-start gap-0.5">
                      <span>{v.name}</span>
                      {v.price > 0 && <span className="text-[10px] opacity-80">{formatNumber(v.price)}đ</span>}
                    </div>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* ===== PROMOTION SECTION ===== */}
          {showPromotionSection && product.promotion_content && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 font-semibold text-sm flex items-center gap-1.5" style={{ backgroundColor: primaryColor, color: 'white' }}>
                🎁 {promotionTitle}
              </div>
              <div className="p-3 text-sm prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.promotion_content) }} />
            </div>
          )}

          {/* ===== WARRANTY SECTION ===== */}
          {showWarrantySection && product.warranty_content && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 font-semibold text-sm flex items-center gap-1.5 bg-muted">
                <Shield className="h-4 w-4" /> {warrantyTitle}
              </div>
              <div className="p-3 text-sm prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.warranty_content) }} />
            </div>
          )}

          {/* ===== DESCRIPTION ===== */}
          {product.description && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 font-semibold text-sm bg-muted">
                📝 MÔ TẢ SẢN PHẨM
              </div>
              <div className="p-3 text-sm prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }} />
            </div>
          )}

          {/* ===== ORDER / INSTALLMENT BUTTONS ===== */}
          {orderSuccess ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <p className="font-semibold text-lg">Đặt hàng thành công!</p>
              <p className="text-sm text-muted-foreground">Cửa hàng sẽ liên hệ bạn trong thời gian sớm nhất.</p>
              {warrantyHotline && (
                <a href={`tel:${warrantyHotline}`} className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: primaryColor }}>
                  <Phone className="h-4 w-4" />
                  Gọi ngay: {warrantyHotline}
                </a>
              )}
              {onNavigateOrderLookup && (
                <Button
                  variant="outline"
                  className="w-full h-11 mt-1"
                  onClick={() => { handleClose(false); onNavigateOrderLookup(); }}
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  <Search className="h-4 w-4 mr-1.5" /> Kiểm tra đơn hàng
                </Button>
              )}
              <Button variant="outline" className="w-full mt-2" onClick={() => handleClose(false)}>Đóng</Button>
            </div>
          ) : !showOrderForm ? (
            <div className="flex gap-2">
              <Button className="flex-1 gap-2" style={{ backgroundColor: primaryColor }} onClick={() => setShowOrderForm(true)}>
                <ShoppingCart className="h-4 w-4" />
                Đặt mua
              </Button>
              {showInstallmentButton && onInstallment && (
                <Button variant="outline" className="flex-1 gap-2" onClick={onInstallment}>
                  <CreditCard className="h-4 w-4" />
                  Trả góp
                </Button>
              )}
              {warrantyHotline && (
                <Button variant="outline" asChild>
                  <a href={`tel:${warrantyHotline}`} className="gap-2">
                    <Phone className="h-4 w-4" />
                    Gọi
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-semibold text-sm">Thông tin đặt hàng</h3>

              <div>
                <Label className="text-xs">Họ tên <span className="text-destructive">*</span></Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nhập họ tên" className={`h-10 ${attempted && !customerName.trim() ? 'border-destructive ring-destructive' : ''}`} />
              </div>

              <div>
                <Label className="text-xs">Số điện thoại <span className="text-destructive">*</span></Label>
                <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Nhập SĐT đã từng mua để được giảm giá" inputMode="tel" className={`h-10 ${attempted && !customerPhone.trim() ? 'border-destructive ring-destructive' : ''}`} />
              </div>

              <div>
                <Label className="text-xs">Chi nhánh nhận hàng <span className="text-destructive">*</span></Label>
                <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
                  className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${attempted && !selectedBranch ? 'border-destructive ring-destructive' : 'border-input'}`}>
                  <option value="">Chọn chi nhánh</option>
                  {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
              </div>

              {/* Voucher & Points */}
              {debouncedPhone && (unusedVouchers.length > 0 || (customerPoints?.is_points_enabled && customerPoints.current_points > 0)) && (
                <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                  <p className="text-xs font-medium flex items-center gap-1.5">
                    <Gift className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                    Ưu đãi của bạn
                  </p>
                  {unusedVouchers.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><Ticket className="h-3 w-3" /> Voucher ({unusedVouchers.length})</Label>
                      <select value={selectedVoucherId || ''} onChange={e => { setSelectedVoucherId(e.target.value || null); if (e.target.value) setUsePoints(false); }}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
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
                          Dùng {formatNumber(customerPoints.current_points)} điểm tích lũy
                          {pointsDiscount > 0 && !selectedVoucherId && (
                            <span className="text-green-600 font-medium">(Giảm {formatNumber(pointsDiscount)}đ)</span>
                          )}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label className="text-xs">Địa chỉ</Label>
                <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Nhập địa chỉ (không bắt buộc)" className="h-10" />
              </div>

              <div>
                <Label className="text-xs">Ghi chú</Label>
                <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..." rows={2} />
              </div>

              {/* Order summary */}
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Sản phẩm:</span>
                  <span className="font-medium">{product.name}</span>
                </div>
                {getVariantLabel() && (
                  <div className="flex justify-between">
                    <span>Phiên bản:</span>
                    <span>{getVariantLabel()}</span>
                  </div>
                )}
                {totalDiscount > 0 && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Giá gốc:</span>
                      <span>{formatNumber(basePrice)}đ</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>{selectedVoucher ? `Voucher (${selectedVoucher.code})` : 'Điểm tích lũy'}:</span>
                      <span>-{formatNumber(totalDiscount)}đ</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold pt-1 border-t">
                  <span>Tổng:</span>
                  <span style={{ color: primaryColor }}>{formatNumber(displayPrice)}đ</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowOrderForm(false)}>Quay lại</Button>
                <Button className="flex-1 gap-2" style={{ backgroundColor: primaryColor }} onClick={handleSubmitOrder} disabled={placeOrder.isPending}>
                  {placeOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                  Xác nhận đặt
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
