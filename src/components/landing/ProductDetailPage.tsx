import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Package, Phone, ShoppingCart, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Gift, Star, Ticket, Link2, CreditCard, Shield, ArrowLeft } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import DOMPurify from 'dompurify';
import { LandingProduct, LandingProductVariant, VariantPriceEntry } from '@/hooks/useLandingProducts';
import { usePlaceLandingOrder } from '@/hooks/useLandingOrders';
import { usePublicCustomerVouchers } from '@/hooks/useVouchers';
import { useCustomerPointsPublic } from '@/hooks/useTenantLanding';
import { toast } from 'sonner';
import StoreReviewsSection from '@/components/landing/StoreReviewsSection';

interface BranchOption {
  id: string;
  name: string;
}

interface ProductDetailSectionConfig {
  id: string;
  enabled: boolean;
}

interface ProductDetailPageProps {
  product: LandingProduct;
  onBack: () => void;
  tenantId: string;
  branches: BranchOption[];
  primaryColor: string;
  warrantyHotline?: string | null;
  onShare?: () => void;
  onInstallment?: () => void;
  showInstallmentButton?: boolean; // deprecated, use detailSections
  detailSections?: ProductDetailSectionConfig[] | null;
  relatedProducts?: LandingProduct[];
  recentlyViewedProducts?: LandingProduct[];
  onProductClick?: (p: LandingProduct) => void;
  storeInfo?: { name?: string; phone?: string; address?: string; email?: string } | null;
}

export function ProductDetailPage({
  product, onBack, tenantId, branches, primaryColor,
  warrantyHotline, onShare, onInstallment,
  showInstallmentButton = true,
  detailSections,
  relatedProducts = [],
  recentlyViewedProducts = [],
  onProductClick,
  storeInfo,
}: ProductDetailPageProps) {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [note, setNote] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [attempted, setAttempted] = useState(false);

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

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data: customerVouchers } = usePublicCustomerVouchers(debouncedPhone, tenantId || null);
  const { data: customerPoints } = useCustomerPointsPublic(debouncedPhone, tenantId || null);

  const unusedVouchers = useMemo(() =>
    (customerVouchers || []).filter((v: any) => v.status === 'unused'),
    [customerVouchers]
  );

  const variantOptions1: Array<{ name: string; image_url?: string }> = useMemo(() => {
    const opts = product.variant_options_1;
    return Array.isArray(opts) ? opts.filter(o => o.name) : [];
  }, [product]);

  const variantOptions2: Array<{ name: string; image_url?: string }> = useMemo(() => {
    const opts = product.variant_options_2;
    return Array.isArray(opts) ? opts.filter(o => o.name) : [];
  }, [product]);

  const variantPrices: VariantPriceEntry[] = useMemo(() => {
    return Array.isArray(product.variant_prices) ? product.variant_prices : [];
  }, [product]);

  const uses2LevelVariants = variantOptions1.length > 0;

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

  const matchedVariantPrice = useMemo(() => {
    if (!uses2LevelVariants || !selectedOption1) return null;
    return variantPrices.find(vp =>
      vp.option1 === selectedOption1 && (variantOptions2.length === 0 || vp.option2 === selectedOption2)
    ) || null;
  }, [uses2LevelVariants, selectedOption1, selectedOption2, variantPrices, variantOptions2]);

  const allImages = useMemo(() => {
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

  const getVariantLabel = () => {
    if (uses2LevelVariants) {
      const parts = [selectedOption1, selectedOption2].filter(Boolean);
      return parts.join(' / ') || undefined;
    }
    return selectedLegacyVariant?.name;
  };

  const handleSubmitOrder = async () => {
    setAttempted(true);
    if (!customerName.trim() || !customerPhone.trim() || !selectedBranch) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
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

      await placeOrder.mutateAsync({
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
    } catch (err) {
      toast.error('Đặt hàng thất bại, vui lòng thử lại');
    }
  };

  const promotionTitle = product.promotion_title || 'KHUYẾN MÃI';
  const warrantyTitle = product.warranty_title || 'BẢO HÀNH';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Sticky header with back button */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b safe-area-top">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button
            onClick={onBack}
            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-medium truncate flex-1">{product.name}</h1>
          {onShare && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs shrink-0" onClick={onShare}>
              <Link2 className="h-3.5 w-3.5" /> Chia sẻ
            </Button>
          )}
        </div>
      </header>

      {/* Main scrollable content */}
      <main className="flex-1 pb-20">
        {/* Image gallery */}
        {allImages.length > 0 ? (
          <div className="relative bg-gray-50">
            <img
              src={allImages[currentImageIndex]}
              alt={product.name}
              className="w-full aspect-square object-contain"
            />
            {allImages.length > 1 && (
              <>
                <button onClick={() => setCurrentImageIndex(i => (i - 1 + allImages.length) % allImages.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 text-white flex items-center justify-center active:bg-black/50">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={() => setCurrentImageIndex(i => (i + 1) % allImages.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 text-white flex items-center justify-center active:bg-black/50">
                  <ChevronRight className="h-5 w-5" />
                </button>
                {/* Dot indicators */}
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                  {allImages.map((_, idx) => (
                    <button key={idx} onClick={() => setCurrentImageIndex(idx)}
                      className={`h-2 w-2 rounded-full transition-all ${currentImageIndex === idx ? 'bg-white w-4' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
                {/* Thumbnail strip */}
                <div className="flex gap-1.5 px-3 py-2 overflow-x-auto">
                  {allImages.map((img, idx) => (
                    <button key={idx} onClick={() => setCurrentImageIndex(idx)}
                      className={`h-12 w-12 rounded-md border-2 overflow-hidden flex-shrink-0 ${currentImageIndex === idx ? 'border-gray-800' : 'border-transparent opacity-60'}`}>
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="w-full aspect-square bg-gray-50 flex items-center justify-center">
            <Package className="h-16 w-16 text-gray-300" />
          </div>
        )}

        <div className="px-4 py-4 space-y-4">
          {/* Title */}
          <h2 className="text-xl font-bold leading-tight">{product.name}</h2>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold" style={{ color: primaryColor }}>{formatNumber(displayPrice)}đ</span>
            {totalDiscount > 0 && (
              <span className="text-base text-gray-400 line-through">{formatNumber(basePrice)}đ</span>
            )}
            {!totalDiscount && originalPrice > 0 && (
              <span className="text-base text-gray-400 line-through">{formatNumber(originalPrice)}đ</span>
            )}
          </div>

          {/* ===== 2-LEVEL VARIANTS ===== */}
          {uses2LevelVariants && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {product.variant_group_1_name || 'Biến thể 1'} <span className="text-red-500">*</span>
                </Label>
                <div className={`flex flex-wrap gap-2 ${attempted && !selectedOption1 ? 'p-2 rounded-md border-2 border-red-400' : ''}`}>
                  {variantOptions1.map((opt, i) => (
                    <Badge
                      key={i}
                      variant={selectedOption1 === opt.name ? 'default' : 'outline'}
                      className="cursor-pointer text-sm px-3 py-2 active:scale-95 transition-transform"
                      style={selectedOption1 === opt.name ? { backgroundColor: primaryColor } : {}}
                      onClick={() => setSelectedOption1(selectedOption1 === opt.name ? null : opt.name)}
                    >
                      {opt.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {variantOptions2.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    {product.variant_group_2_name || 'Biến thể 2'} <span className="text-red-500">*</span>
                  </Label>
                  <div className={`flex flex-wrap gap-2 ${attempted && !selectedOption2 ? 'p-2 rounded-md border-2 border-red-400' : ''}`}>
                    {variantOptions2.map((opt, i) => (
                      <Badge
                        key={i}
                        variant={selectedOption2 === opt.name ? 'default' : 'outline'}
                        className="cursor-pointer text-sm px-3 py-2 active:scale-95 transition-transform"
                        style={selectedOption2 === opt.name ? { backgroundColor: primaryColor } : {}}
                        onClick={() => setSelectedOption2(selectedOption2 === opt.name ? null : opt.name)}
                      >
                        {opt.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {matchedVariantPrice && matchedVariantPrice.stock !== undefined && matchedVariantPrice.stock > 0 && (
                <p className="text-xs text-gray-500">Còn {matchedVariantPrice.stock} sản phẩm</p>
              )}
            </div>
          )}

          {/* ===== LEGACY VARIANTS ===== */}
          {!uses2LevelVariants && legacyVariants.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Chọn phiên bản <span className="text-red-500">*</span></Label>
              <div className={`flex flex-wrap gap-2 ${attempted && selectedVariantIndex === null ? 'p-2 rounded-md border-2 border-red-400' : ''}`}>
                {legacyVariants.map((v, i) => (
                  <Badge key={i} variant={selectedVariantIndex === i ? 'default' : 'outline'}
                    className="cursor-pointer text-sm px-3 py-2 flex items-center gap-1.5 active:scale-95 transition-transform"
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

          {/* ===== DYNAMIC SECTIONS ===== */}
          {(() => {
            const defaultSections = [
              { id: 'installment', enabled: true },
              { id: 'compare', enabled: false },
              { id: 'tradeIn', enabled: false },
              { id: 'promotion', enabled: true },
              { id: 'warranty', enabled: true },
              { id: 'description', enabled: true },
              { id: 'relatedProducts', enabled: true },
              { id: 'reviews', enabled: false },
              { id: 'recentlyViewed', enabled: false },
              { id: 'storeInfo', enabled: false },
            ];
            const sections = (detailSections || defaultSections).filter(s => s.enabled);

            return sections.map(section => {
              switch (section.id) {
                case 'promotion':
                  if (!product.promotion_content) return null;
                  return (
                    <div key="promotion" className="border rounded-lg overflow-hidden">
                      <div className="px-3 py-2.5 font-semibold text-sm flex items-center gap-1.5" style={{ backgroundColor: primaryColor, color: 'white' }}>
                        🎁 {promotionTitle}
                      </div>
                      <div className="p-3 text-sm prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.promotion_content) }} />
                    </div>
                  );
                case 'warranty':
                  if (!product.warranty_content) return null;
                  return (
                    <div key="warranty" className="border rounded-lg overflow-hidden">
                      <div className="px-3 py-2.5 font-semibold text-sm flex items-center gap-1.5 bg-gray-100">
                        <Shield className="h-4 w-4" /> {warrantyTitle}
                      </div>
                      <div className="p-3 text-sm prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.warranty_content) }} />
                    </div>
                  );
                case 'description':
                  if (!product.description) return null;
                  return (
                    <div key="description" className="border rounded-lg overflow-hidden">
                      <div className="px-3 py-2.5 font-semibold text-sm bg-gray-100">
                        📝 MÔ TẢ SẢN PHẨM
                      </div>
                      <div className="p-3 text-sm prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }} />
                    </div>
                  );
                case 'relatedProducts':
                  if (relatedProducts.length === 0) return null;
                  return (
                    <div key="relatedProducts">
                      <h3 className="font-bold text-base mb-3">📦 Sản phẩm liên quan</h3>
                      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
                        {relatedProducts.slice(0, 10).map(rp => (
                          <button key={rp.id} onClick={() => onProductClick?.(rp)}
                            className="min-w-[140px] max-w-[160px] shrink-0 rounded-xl border overflow-hidden text-left hover:shadow-md transition-shadow bg-white">
                            {rp.image_url ? (
                              <img src={rp.image_url} alt={rp.name} className="w-full aspect-square object-cover" />
                            ) : (
                              <div className="w-full aspect-square bg-gray-50 flex items-center justify-center">
                                <Package className="h-8 w-8 text-gray-300" />
                              </div>
                            )}
                            <div className="p-2">
                              <p className="text-xs font-medium line-clamp-2 leading-tight">{rp.name}</p>
                              <p className="text-xs font-bold mt-1" style={{ color: primaryColor }}>
                                {formatNumber(rp.sale_price || rp.price)}đ
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                case 'reviews':
                  if (!tenantId) return null;
                  return (
                    <div key="reviews">
                      <StoreReviewsSection tenantId={tenantId} primaryColor={primaryColor} />
                    </div>
                  );
                case 'recentlyViewed':
                  if (recentlyViewedProducts.length === 0) return null;
                  return (
                    <div key="recentlyViewed">
                      <h3 className="font-bold text-base mb-3">👁️ Đã xem gần đây</h3>
                      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
                        {recentlyViewedProducts.slice(0, 10).map(rp => (
                          <button key={rp.id} onClick={() => onProductClick?.(rp)}
                            className="min-w-[140px] max-w-[160px] shrink-0 rounded-xl border overflow-hidden text-left hover:shadow-md transition-shadow bg-white">
                            {rp.image_url ? (
                              <img src={rp.image_url} alt={rp.name} className="w-full aspect-square object-cover" />
                            ) : (
                              <div className="w-full aspect-square bg-gray-50 flex items-center justify-center">
                                <Package className="h-8 w-8 text-gray-300" />
                              </div>
                            )}
                            <div className="p-2">
                              <p className="text-xs font-medium line-clamp-2 leading-tight">{rp.name}</p>
                              <p className="text-xs font-bold mt-1" style={{ color: primaryColor }}>
                                {formatNumber(rp.sale_price || rp.price)}đ
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                case 'storeInfo':
                  if (!storeInfo) return null;
                  return (
                    <div key="storeInfo" className="border rounded-lg p-3 bg-gray-50 space-y-2">
                      <h3 className="font-bold text-sm flex items-center gap-1.5">📞 Thông tin cửa hàng</h3>
                      {storeInfo.name && <p className="text-sm font-medium">{storeInfo.name}</p>}
                      {storeInfo.address && <p className="text-xs text-gray-500">{storeInfo.address}</p>}
                      {storeInfo.phone && (
                        <a href={`tel:${storeInfo.phone}`} className="text-xs font-medium flex items-center gap-1" style={{ color: primaryColor }}>
                          <Phone className="h-3 w-3" /> {storeInfo.phone}
                        </a>
                      )}
                    </div>
                  );
                default:
                  // Layout sections handled at page level
                  return null;
              }
            });
          })()}

          {/* ===== ORDER FORM (shown when user taps Đặt mua) ===== */}
          {showOrderForm && !orderSuccess && (
            <div className="space-y-3 border-t pt-4" id="order-form">
              <h3 className="font-semibold text-base">Thông tin đặt hàng</h3>

              <div>
                <Label className="text-sm">Họ tên <span className="text-red-500">*</span></Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nhập họ tên" className={`h-11 text-base ${attempted && !customerName.trim() ? 'border-red-400 ring-red-400' : ''}`} />
              </div>

              <div>
                <Label className="text-sm">Số điện thoại <span className="text-red-500">*</span></Label>
                <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Nhập SĐT" inputMode="tel" className={`h-11 text-base ${attempted && !customerPhone.trim() ? 'border-red-400 ring-red-400' : ''}`} />
              </div>

              <div>
                <Label className="text-sm">Chi nhánh nhận hàng <span className="text-red-500">*</span></Label>
                <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
                  className={`flex h-11 w-full rounded-md border bg-white px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${attempted && !selectedBranch ? 'border-red-400 ring-red-400' : 'border-input'}`}>
                  <option value="">Chọn chi nhánh</option>
                  {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
              </div>

              {/* Voucher & Points */}
              {debouncedPhone && (unusedVouchers.length > 0 || (customerPoints?.is_points_enabled && customerPoints.current_points > 0)) && (
                <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
                  <p className="text-xs font-medium flex items-center gap-1.5">
                    <Gift className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                    Ưu đãi của bạn
                  </p>
                  {unusedVouchers.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><Ticket className="h-3 w-3" /> Voucher ({unusedVouchers.length})</Label>
                      <select value={selectedVoucherId || ''} onChange={e => { setSelectedVoucherId(e.target.value || null); if (e.target.value) setUsePoints(false); }}
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
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
                </div>
              )}

              <div>
                <Label className="text-sm">Địa chỉ</Label>
                <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Nhập địa chỉ (không bắt buộc)" className="h-11 text-base" />
              </div>

              <div>
                <Label className="text-sm">Ghi chú</Label>
                <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..." rows={2} className="text-base" />
              </div>

              {/* Order summary */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Sản phẩm:</span>
                  <span className="font-medium text-right max-w-[60%] truncate">{product.name}</span>
                </div>
                {getVariantLabel() && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phiên bản:</span>
                    <span>{getVariantLabel()}</span>
                  </div>
                )}
                {totalDiscount > 0 && (
                  <>
                    <div className="flex justify-between text-gray-400">
                      <span>Giá gốc:</span>
                      <span>{formatNumber(basePrice)}đ</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>{selectedVoucher ? `Voucher (${selectedVoucher.code})` : 'Điểm tích lũy'}:</span>
                      <span>-{formatNumber(totalDiscount)}đ</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold pt-1.5 border-t">
                  <span>Tổng:</span>
                  <span style={{ color: primaryColor }}>{formatNumber(displayPrice)}đ</span>
                </div>
              </div>

              <div className="flex gap-2 pb-2">
                <Button variant="outline" className="flex-1 h-11" onClick={() => setShowOrderForm(false)}>Quay lại</Button>
                <Button className="flex-1 gap-2 h-11" style={{ backgroundColor: primaryColor }} onClick={handleSubmitOrder} disabled={placeOrder.isPending}>
                  {placeOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                  Xác nhận đặt
                </Button>
              </div>
            </div>
          )}

          {/* Order success */}
          {orderSuccess && (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="h-14 w-14 mx-auto text-green-500" />
              <p className="font-semibold text-lg">Đặt hàng thành công!</p>
              <p className="text-sm text-gray-500">Cửa hàng sẽ liên hệ bạn trong thời gian sớm nhất.</p>
              {warrantyHotline && (
                <a href={`tel:${warrantyHotline}`} className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: primaryColor }}>
                  <Phone className="h-4 w-4" />
                  Gọi ngay: {warrantyHotline}
                </a>
              )}
              <Button variant="outline" className="w-full mt-2 h-11" onClick={onBack}>Quay lại</Button>
            </div>
          )}
        </div>
      </main>

      {/* Sticky bottom action bar - only show when not in order form */}
      {!showOrderForm && !orderSuccess && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t safe-area-bottom">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <Button
              className="flex-1 gap-2 h-11 text-base font-semibold"
              style={{ backgroundColor: primaryColor }}
              onClick={() => {
                setShowOrderForm(true);
                setTimeout(() => {
                  document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
            >
              <ShoppingCart className="h-5 w-5" />
              Đặt mua
            </Button>
            {(() => {
              const secs = detailSections || [{ id: 'installment', enabled: true }];
              const installmentEnabled = secs.find(s => s.id === 'installment')?.enabled !== false;
              if (!installmentEnabled || !onInstallment) return null;
              return (
                <Button variant="outline" className="flex-1 gap-2 h-11 text-base" onClick={onInstallment}>
                  <CreditCard className="h-5 w-5" />
                  Trả góp
                </Button>
              );
            })()}
            {warrantyHotline && (
              <Button variant="outline" className="h-11 px-4" asChild>
                <a href={`tel:${warrantyHotline}`} className="gap-2">
                  <Phone className="h-5 w-5" />
                  Gọi
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
