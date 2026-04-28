import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Package, Phone, ShoppingCart, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Gift, Star, Ticket, Link2, CreditCard, Shield, ArrowLeft, Mail, ExternalLink, Search } from 'lucide-react';
import { PaymentFlowDialog } from '@/components/landing/PaymentFlowDialog';
import { CTAButtonItem, getDefaultCTAButtons } from '@/components/admin/ProductDetailSectionManager';
import { formatNumber } from '@/lib/formatNumber';
import DOMPurify from 'dompurify';
import { sanitizeRichHtml } from '@/lib/sanitizeRichHtml';
import { LandingProduct, LandingProductVariant, VariantPriceEntry, getVariantGroups, findVariantPrice } from '@/hooks/useLandingProducts';
import { usePublicProductPackages, usePublicProductPackageGroups, LandingProductPackage, PackageGroupWithItems } from '@/hooks/useLandingProducts';
import { usePlaceLandingOrder } from '@/hooks/useLandingOrders';
import { usePublicCustomerVouchers } from '@/hooks/useVouchers';
import { useCustomerPointsPublic } from '@/hooks/useTenantLanding';
import { useLandingCart } from '@/hooks/useLandingCart';
import { ContactFormDialog, BookingDialog, HotelBookingDialog, TrackOrderDialog, CheckWarrantyDialog, WriteReviewDialog, SupportDialog, CartDialog, PromotionInfoDialog, JoinMemberDialog } from '@/components/landing/CTAActionDialogs';
import { toast } from 'sonner';
import StoreReviewsSection from '@/components/landing/StoreReviewsSection';
import { ProductReviewsSection } from '@/components/landing/ProductReviewsSection';
import { usePublicProductReviews } from '@/hooks/useLandingProductReviews';
import { ProductBadges, LayoutProductCard, getProductGridClass } from '@/components/website-templates/layouts/ProductCardVariants';
import type { LayoutStyle } from '@/lib/industryConfig';
import { ImageLightbox } from '@/components/ui/ImageLightbox';

interface BranchOption {
  id: string;
  name: string;
}

interface ProductDetailSectionConfig {
  id: string;
  enabled: boolean;
}

interface PaymentConfig {
  codEnabled: boolean;
  transferEnabled: boolean;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  confirmZaloUrl?: string | null;
  confirmMessengerUrl?: string | null;
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
  showInstallmentButton?: boolean;
  detailSections?: ProductDetailSectionConfig[] | null;
  ctaButtons?: CTAButtonItem[] | null;
  websiteTemplate?: string | null;
  layoutStyle?: LayoutStyle;
  relatedProducts?: LandingProduct[];
  recentlyViewedProducts?: LandingProduct[];
  onProductClick?: (p: LandingProduct) => void;
  storeInfo?: { name?: string; phone?: string; address?: string; email?: string } | null;
  storeBranches?: { name: string; address?: string | null; phone?: string | null }[];
  zaloUrl?: string | null;
  facebookUrl?: string | null;
  paymentConfig?: PaymentConfig | null;
  onNavigateOrderLookup?: () => void;
}

export function ProductDetailPage({
  product, onBack, tenantId, branches, primaryColor,
  warrantyHotline, onShare, onInstallment,
  showInstallmentButton = true,
  detailSections,
  ctaButtons,
  websiteTemplate,
  layoutStyle,
  relatedProducts = [],
  recentlyViewedProducts = [],
  onProductClick,
  storeInfo,
  storeBranches = [],
  zaloUrl,
  facebookUrl,
  paymentConfig,
  onNavigateOrderLookup,
}: ProductDetailPageProps) {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showPaymentFlow, setShowPaymentFlow] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [note, setNote] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);
  const [variantAttempted, setVariantAttempted] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<string>>(new Set());
  const [packageQuantities, setPackageQuantities] = useState<Record<string, number>>({});

  // CTA Dialog states
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [showCartDialog, setShowCartDialog] = useState(false);
  const [showConsultDialog, setShowConsultDialog] = useState(false);
  const cart = useLandingCart();

  const [selectedOptions, setSelectedOptions] = useState<(string | null)[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const placeOrder = usePlaceLandingOrder();

  // Khi đổi sang sản phẩm khác (vd: bấm vào sản phẩm gợi ý), cuộn lên đầu trang
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [product?.id]);

  // Fetch service packages (grouped). Falls back gracefully to legacy flat list.
  const { data: packageGroups } = usePublicProductPackageGroups(product?.id || null);
  const { data: productPackages } = usePublicProductPackages(product?.id || null);
  const { data: productReviews = [] } = usePublicProductReviews(product?.id || null);
  const ratingAvg = productReviews.length
    ? productReviews.reduce((s, r) => s + (r.rating || 0), 0) / productReviews.length
    : 0;

  // Flatten groups → all items with attached groupName for easy lookup
  const allPackageItems = useMemo(() => {
    const list: Array<LandingProductPackage & { _groupName: string; _groupId: string }> = [];
    (packageGroups || []).forEach(g => {
      g.items.forEach(it => list.push({ ...it, _groupName: g.name, _groupId: g.id }));
    });
    return list;
  }, [packageGroups]);

  // Auto-select default packages
  useEffect(() => {
    if (allPackageItems.length > 0) {
      const defaults = new Set(allPackageItems.filter(p => p.is_default).map(p => p.id));
      setSelectedPackageIds(defaults);
      const qtys: Record<string, number> = {};
      allPackageItems.forEach(it => { if (it.allow_quantity) qtys[it.id] = 1; });
      setPackageQuantities(qtys);
    } else {
      setSelectedPackageIds(new Set());
      setPackageQuantities({});
    }
  }, [allPackageItems]);

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

  // Multi-level variant groups (1-5 levels, with legacy fallback)
  const variantGroups = useMemo(() => getVariantGroups(product), [product]);

  const variantPrices: VariantPriceEntry[] = useMemo(() => {
    return Array.isArray(product.variant_prices) ? product.variant_prices : [];
  }, [product]);

  const usesMultiVariants = variantGroups.length > 0;

  const legacyVariants: LandingProductVariant[] = useMemo(() => {
    if (usesMultiVariants) return [];
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
  }, [product?.variants, usesMultiVariants]);

  const allLevelsSelected = usesMultiVariants && variantGroups.every((_, i) => !!selectedOptions[i]);
  const matchedVariantPrice = useMemo(() => {
    if (!usesMultiVariants || !allLevelsSelected) return null;
    return findVariantPrice(variantPrices, selectedOptions.slice(0, variantGroups.length));
  }, [usesMultiVariants, allLevelsSelected, variantPrices, selectedOptions, variantGroups.length]);

  const allImages = useMemo(() => {
    const imgs: string[] = [];

    if (Array.isArray(product.images) && product.images.length > 0) {
      imgs.push(...product.images);
    } else if (product.image_url) {
      imgs.push(product.image_url);
    }

    if (usesMultiVariants) {
      variantPrices.forEach(vp => {
        if (vp.image_url && !imgs.includes(vp.image_url)) imgs.push(vp.image_url);
      });
    } else {
      legacyVariants.forEach(v => {
        if (v.image_url && !imgs.includes(v.image_url)) imgs.push(v.image_url);
      });
    }

    return imgs;
  }, [product, legacyVariants, usesMultiVariants, variantPrices]);

  const selectedLegacyVariant = selectedVariantIndex !== null ? legacyVariants[selectedVariantIndex] : null;

  const basePrice = useMemo(() => {
    if (usesMultiVariants && matchedVariantPrice) {
      return matchedVariantPrice.sale_price || matchedVariantPrice.price;
    }
    if (selectedLegacyVariant && selectedLegacyVariant.price > 0) {
      return selectedLegacyVariant.price;
    }
    return product?.sale_price || product?.price || 0;
  }, [usesMultiVariants, matchedVariantPrice, selectedLegacyVariant, product]);

  const originalPrice = useMemo(() => {
    if (usesMultiVariants && matchedVariantPrice && matchedVariantPrice.sale_price) {
      return matchedVariantPrice.price;
    }
    if (!usesMultiVariants && !selectedLegacyVariant && product?.sale_price) {
      return product.price;
    }
    return 0;
  }, [usesMultiVariants, matchedVariantPrice, selectedLegacyVariant, product]);

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

  // Calculate packages total — supports per-item quantity & group attribution
  const selectedPackages = useMemo(() => {
    return allPackageItems
      .filter(p => selectedPackageIds.has(p.id))
      .map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        groupName: p._groupName,
        quantity: p.allow_quantity ? Math.max(1, packageQuantities[p.id] || 1) : 1,
      }));
  }, [allPackageItems, selectedPackageIds, packageQuantities]);

  const packagesTotal = useMemo(
    () => selectedPackages.reduce((sum, p) => sum + p.price * p.quantity, 0),
    [selectedPackages]
  );

  // Group selected packages by groupName for bill display
  const selectedPackagesByGroup = useMemo(() => {
    const map = new Map<string, typeof selectedPackages>();
    selectedPackages.forEach(p => {
      const arr = map.get(p.groupName) || [];
      arr.push(p);
      map.set(p.groupName, arr);
    });
    return Array.from(map.entries());
  }, [selectedPackages]);

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

  useEffect(() => {
    if (!usesMultiVariants || !matchedVariantPrice?.image_url) return;
    const imgIdx = allImages.indexOf(matchedVariantPrice.image_url);
    if (imgIdx >= 0) setCurrentImageIndex(imgIdx);
  }, [usesMultiVariants, matchedVariantPrice?.image_url, allImages]);

  const getVariantLabel = () => {
    if (usesMultiVariants) {
      const parts = selectedOptions.slice(0, variantGroups.length).filter(Boolean);
      return parts.length > 0 ? parts.join(' / ') : undefined;
    }
    return selectedLegacyVariant?.name;
  };

  const handleSubmitOrder = async () => {
    setAttempted(true);
    if (!customerName.trim() || !customerPhone.trim() || !selectedBranch) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    if (usesMultiVariants) {
      for (let i = 0; i < variantGroups.length; i++) {
        if (!selectedOptions[i]) {
          toast.error(`Vui lòng chọn ${variantGroups[i].name || `Biến thể ${i + 1}`}`);
          return;
        }
      }
    }
    if (!usesMultiVariants && legacyVariants.length > 0 && selectedVariantIndex === null) {
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
      // Build packages note
      const selectedPkgs = selectedPackages;
      const packagesNote = selectedPkgs.length > 0
        ? selectedPackagesByGroup
            .map(([gName, pkgs]) =>
              `[${gName}: ${pkgs.map(p => `${p.name}${p.quantity > 1 ? ` ×${p.quantity}` : ''} (+${formatNumber(p.price * p.quantity)}đ)`).join(', ')}]`
            )
            .join(' ')
        : '';
      const finalNote = [fullNote, packagesNote].filter(Boolean).join(' ');
      const orderPrice = displayPrice + packagesTotal;
      const selectedPackagesData = selectedPkgs.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        groupName: p.groupName,
        quantity: p.quantity,
      }));

      const result = await placeOrder.mutateAsync({
        tenant_id: tenantId,
        branch_id: selectedBranch,
        product_id: product.id,
        product_name: product.name,
        product_image_url: product.image_url,
        product_price: orderPrice,
        variant: getVariantLabel(),
        quantity,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || undefined,
        customer_address: customerAddress.trim() || undefined,
        note: finalNote || undefined,
        selected_packages: selectedPackagesData,
      });
      setOrderSuccess(true);

      // Fire-and-forget: send order confirmation email
      if (customerEmail.trim()) {
        import('@/integrations/supabase/client').then(({ supabase }) => {
          supabase.functions.invoke('send-order-email', {
            body: {
              tenant_id: tenantId,
              order_id: (result as any)?.id || 'unknown',
              customer_name: customerName.trim(),
              customer_email: customerEmail.trim(),
              customer_phone: customerPhone.trim(),
              product_name: product.name,
              product_price: displayPrice,
              order_code: (result as any)?.order_code || '',
              variant: getVariantLabel(),
              quantity,
              branch_id: selectedBranch,
              email_type: 'order_confirmation',
            },
          }).catch(err => console.warn('Order email failed:', err));
        });
      }

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

  const promotionTitle = product.promotion_title || 'KHUYẾN MÃI';
  const warrantyTitle = product.warranty_title || 'BẢO HÀNH';

  const openOrderFlowFn = () => {
    const hasPaymentOptions = paymentConfig?.transferEnabled;
    if (hasPaymentOptions) {
      setShowPaymentFlow(true);
    } else {
      setShowOrderForm(true);
      setTimeout(() => { document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth' }); }, 100);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Sticky header with back button */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b safe-area-top">
        <div className="flex items-center gap-3 px-3 py-2.5 lg:max-w-7xl lg:mx-auto lg:px-6 w-full">
          <button
            onClick={onBack}
            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-medium truncate flex-1">{product.name}</h1>
          <div className="flex items-center gap-1.5 shrink-0">
            {cart.totalItems > 0 && (
              <button onClick={() => setShowCartDialog(true)} className="relative h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute -top-0.5 -right-0.5 h-4.5 min-w-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                  {cart.totalItems}
                </span>
              </button>
            )}
            {onShare && (
              <Button variant="ghost" size="sm" className="gap-1 text-xs shrink-0" onClick={onShare}>
                <Link2 className="h-3.5 w-3.5" /> Chia sẻ
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main scrollable content */}
      <main className="flex-1 pb-20">
        {/* Desktop 2-column wrapper: image left, info right */}
        <div className="lg:max-w-7xl lg:mx-auto lg:px-6 lg:pt-6 lg:grid lg:grid-cols-2 lg:gap-8">
          {/* ===== LEFT: Image gallery ===== */}
          <div className="lg:sticky lg:top-20 lg:self-start">
        {allImages.length > 0 ? (
          <div className="relative bg-gray-50 lg:rounded-xl lg:overflow-hidden lg:border">
            {currentImageIndex === 0 && (
              <ProductBadges badges={(product as any).badges} style={(product as any).badge_style} />
            )}
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
                <div className="flex gap-1.5 px-3 py-2 overflow-x-auto lg:flex-wrap lg:overflow-visible lg:px-0 lg:pt-3">
                  {allImages.map((img, idx) => (
                    <button key={idx} onClick={() => setCurrentImageIndex(idx)}
                      className={`h-12 w-12 lg:h-16 lg:w-16 rounded-md border-2 overflow-hidden flex-shrink-0 ${currentImageIndex === idx ? 'border-gray-800' : 'border-transparent opacity-60'}`}>
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="w-full aspect-square bg-gray-50 flex items-center justify-center lg:rounded-xl lg:border">
            <Package className="h-16 w-16 text-gray-300" />
          </div>
        )}
          </div>

          {/* ===== RIGHT: Product info, variants, price, warranty, promotion ===== */}
          <div className="lg:min-w-0">

        <div className="px-4 py-4 space-y-4 lg:px-0 lg:pt-0">
          {/* Title */}
          <h2 className="text-xl font-bold leading-tight">{product.name}</h2>
          {product.is_sold_out && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-red-600 font-bold text-sm">🚫 Tạm hết</span>
            </div>
          )}

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
          {(productReviews.length > 0 || ((product as any).show_sold_count !== false && Number((product as any).sold_count ?? 0) > 0)) && (
            <div className="flex items-center gap-2 text-xs text-gray-500 -mt-2 flex-wrap">
              {productReviews.length > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold text-gray-800">{ratingAvg.toFixed(1)}</span>
                  <span>({formatNumber(productReviews.length)})</span>
                </span>
              )}
              {productReviews.length > 0 && (product as any).show_sold_count !== false && Number((product as any).sold_count ?? 0) > 0 && (
                <span className="text-gray-300">·</span>
              )}
              {(product as any).show_sold_count !== false && Number((product as any).sold_count ?? 0) > 0 && (
                <span>🔥 Đã bán <span className="font-semibold text-orange-600">{formatNumber(Number((product as any).sold_count))}</span></span>
              )}
            </div>
          )}

          {/* ===== MULTI-LEVEL VARIANTS (1-5) ===== */}
          {usesMultiVariants && (
            <div className="space-y-3">
              {variantGroups.map((group, gIdx) => {
                const sel = selectedOptions[gIdx] || null;
                const groupLabel = group.name || `Biến thể ${gIdx + 1}`;
                return (
                  <div key={gIdx}>
                    <Label className="text-sm font-medium mb-2 block">
                      {groupLabel} <span className="text-red-500">*</span>
                    </Label>
                    <div className={`flex flex-wrap gap-2 ${(attempted || variantAttempted) && !sel ? 'p-2 rounded-md border-2 border-red-400' : ''}`}>
                      {group.options.map((opt, i) => (
                        <Badge
                          key={i}
                          variant={sel === opt.name ? 'default' : 'outline'}
                          className="cursor-pointer text-sm px-3 py-2 active:scale-95 transition-transform"
                          style={sel === opt.name ? { backgroundColor: primaryColor } : {}}
                          onClick={() => {
                            setSelectedOptions(prev => {
                              const next = [...prev];
                              while (next.length <= gIdx) next.push(null);
                              next[gIdx] = next[gIdx] === opt.name ? null : opt.name;
                              return next;
                            });
                            setVariantAttempted(false);
                          }}
                        >
                          {opt.name}
                        </Badge>
                      ))}
                    </div>
                    {(attempted || variantAttempted) && !sel && (
                      <p className="text-xs text-red-500 font-medium mt-1">⚠ Vui lòng chọn {groupLabel}</p>
                    )}
                  </div>
                );
              })}

              {matchedVariantPrice && matchedVariantPrice.is_sold_out && (
                <p className="text-sm font-medium text-red-600">🚫 Đã hết</p>
              )}
              {matchedVariantPrice && !matchedVariantPrice.is_sold_out && matchedVariantPrice.stock !== undefined && matchedVariantPrice.stock > 0 && (
                <p className="text-xs text-gray-500">Còn {matchedVariantPrice.stock} sản phẩm</p>
              )}
            </div>
          )}

          {/* ===== LEGACY VARIANTS ===== */}
          {!usesMultiVariants && legacyVariants.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Chọn phiên bản <span className="text-red-500">*</span></Label>
              <div className={`flex flex-wrap gap-2 ${(attempted || variantAttempted) && selectedVariantIndex === null ? 'p-2 rounded-md border-2 border-red-400' : ''}`}>
                {legacyVariants.map((v, i) => (
                  <Badge key={i} variant={selectedVariantIndex === i ? 'default' : 'outline'}
                    className="cursor-pointer text-sm px-3 py-2 flex items-center gap-1.5 active:scale-95 transition-transform"
                    style={selectedVariantIndex === i ? { backgroundColor: primaryColor } : {}}
                    onClick={() => { handleSelectLegacyVariant(i); setVariantAttempted(false); }}>
                    {v.image_url && <img src={v.image_url} alt="" className="h-6 w-6 rounded object-cover" />}
                    <div className="flex flex-col items-start gap-0.5">
                      <span>{v.name}</span>
                      {v.price > 0 && <span className="text-[10px] opacity-80">{formatNumber(v.price)}đ</span>}
                    </div>
                  </Badge>
                ))}
              </div>
              {(attempted || variantAttempted) && selectedVariantIndex === null && (
                <p className="text-xs text-red-500 font-medium mt-1">⚠ Vui lòng chọn phiên bản sản phẩm</p>
              )}
            </div>
          )}

          {/* ===== DYNAMIC SECTIONS (split: right-column vs full-width) ===== */}
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
            const allSections = (detailSections || defaultSections).filter(s => s.enabled);
            const rightSideIds = new Set(['promotion', 'warranty', 'storeInfo']);
            const rightSections = allSections.filter(s => rightSideIds.has(s.id)).map(section => {
              switch (section.id) {
                case 'promotion':
                  if (!product.promotion_content) return null;
                  return (
                    <div key="promotion" className="border rounded-lg overflow-hidden">
                      <div className="px-3 py-2.5 font-semibold text-sm flex items-center gap-1.5" style={{ backgroundColor: primaryColor, color: 'white' }}>
                        🎁 {promotionTitle}
                      </div>
                      <div className="p-3 text-sm prose prose-sm max-w-none rte-content"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.promotion_content) }} />
                    </div>
                  );
                case 'warranty':
                  if (!product.warranty_content) return null;
                  return (
                    <div key="warranty" className="border rounded-lg overflow-hidden">
                      <div className="px-3 py-2.5 font-semibold text-sm flex items-center gap-1.5 bg-gray-100">
                        <Shield className="h-4 w-4" /> {warrantyTitle}
                      </div>
                      <div className="p-3 text-sm prose prose-sm max-w-none rte-content"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.warranty_content) }} />
                    </div>
                  );
                case 'storeInfo':
                  if (!storeInfo && storeBranches.length === 0) return null;
                  return (
                    <div key="storeInfo" className="border rounded-lg p-3 bg-gray-50 space-y-2">
                      <h3 className="font-bold text-sm flex items-center gap-1.5">📞 Thông tin cửa hàng</h3>
                      {storeInfo?.name && <p className="text-sm font-medium">{storeInfo.name}</p>}
                      {/* Khi không có chi nhánh, mới hiển thị địa chỉ/SĐT từ cấu hình chung để tránh trùng lặp */}
                      {storeBranches.length === 0 && storeInfo?.address && (
                        <p className="text-xs text-gray-500">{storeInfo.address}</p>
                      )}
                      {storeBranches.length === 0 && storeInfo?.phone && (
                        <a href={`tel:${storeInfo.phone}`} className="text-xs font-medium flex items-center gap-1" style={{ color: primaryColor }}>
                          <Phone className="h-3 w-3" /> {storeInfo.phone}
                        </a>
                      )}
                      {storeBranches.length > 0 && (
                        <div className="space-y-2">
                          {storeBranches.map((b, i) => (
                            <div key={i} className="space-y-0.5">
                              <p className="text-xs font-semibold">{b.name}</p>
                              {b.address && <p className="text-xs text-gray-500">{b.address}</p>}
                              {b.phone && (
                                <a href={`tel:${b.phone}`} className="text-xs font-medium flex items-center gap-1" style={{ color: primaryColor }}>
                                  <Phone className="h-3 w-3" /> {b.phone}
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                default:
                  return null;
              }
            });
            // Prepend service package GROUPS (each group rendered independently)
            const groupsToRender = (packageGroups && packageGroups.length > 0)
              ? packageGroups
              : ((productPackages && productPackages.length > 0)
                  ? [{
                      id: '_legacy_',
                      name: 'Gói dịch vụ kèm theo',
                      selection_mode: (product.package_selection_mode === 'single' ? 'single' : 'multiple') as 'single' | 'multiple',
                      display_order: 0,
                      items: productPackages,
                      isLegacy: true,
                    } as PackageGroupWithItems]
                  : []);

            const packageGroupSections = groupsToRender.map(group => {
              const isSingle = group.selection_mode === 'single';
              return (
                <div key={`pkg-group-${group.id}`} className="border rounded-lg overflow-hidden">
                  <div className="px-3 py-2.5 font-semibold text-sm flex items-center gap-1.5" style={{ backgroundColor: primaryColor, color: 'white' }}>
                    📦 {group.name}
                    {isSingle && <span className="text-[10px] font-normal opacity-80 ml-1">(chọn 1)</span>}
                  </div>
                  <div className="p-3 space-y-2">
                    {group.items.map(pkg => {
                      const isChecked = selectedPackageIds.has(pkg.id);
                      const itemQty = packageQuantities[pkg.id] || 1;
                      return (
                        <label key={pkg.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                          <input
                            type={isSingle ? 'radio' : 'checkbox'}
                            name={isSingle ? `pkg_select_${group.id}` : undefined}
                            checked={isChecked}
                            onChange={() => {
                              if (isSingle) {
                                // Deselect previous in same group, then select this
                                setSelectedPackageIds(prev => {
                                  const next = new Set(prev);
                                  group.items.forEach(it => next.delete(it.id));
                                  if (!isChecked) next.add(pkg.id);
                                  return next;
                                });
                              } else {
                                setSelectedPackageIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(pkg.id)) next.delete(pkg.id);
                                  else next.add(pkg.id);
                                  return next;
                                });
                              }
                            }}
                            className="rounded border-input h-4 w-4 mt-0.5"
                          />
                          {pkg.image_url && (
                            <img src={pkg.image_url} alt={pkg.name} className="h-10 w-10 rounded object-cover shrink-0 border" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{pkg.name}</p>
                            {pkg.description && <p className="text-xs text-muted-foreground">{pkg.description}</p>}
                            {pkg.allow_quantity && isChecked && (
                              <div className="flex items-center gap-1.5 mt-1.5" onClick={e => e.preventDefault()}>
                                <button type="button" className="h-7 w-7 rounded border text-sm hover:bg-muted"
                                  onClick={() => setPackageQuantities(prev => ({ ...prev, [pkg.id]: Math.max(1, (prev[pkg.id] || 1) - 1) }))}>−</button>
                                <span className="text-sm font-medium min-w-[24px] text-center">{itemQty}</span>
                                <button type="button" className="h-7 w-7 rounded border text-sm hover:bg-muted"
                                  onClick={() => setPackageQuantities(prev => ({ ...prev, [pkg.id]: (prev[pkg.id] || 1) + 1 }))}>+</button>
                              </div>
                            )}
                          </div>
                          <span className="text-sm font-semibold shrink-0" style={{ color: primaryColor }}>
                            {pkg.price > 0 ? `+${formatNumber(pkg.price)}đ` : 'Miễn phí'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            });
            return [...packageGroupSections, ...rightSections];
          })()}
          </div>{/* /px-4 wrapper */}
          </div>{/* /Right column (desktop) */}
        </div>{/* /Desktop 2-column grid wrapper */}

        {/* ===== FULL-WIDTH SECTIONS ===== */}
        <div className="px-4 py-4 space-y-4 lg:max-w-7xl lg:mx-auto lg:px-6 lg:py-6">
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
            const allSections = (detailSections || defaultSections).filter(s => s.enabled);
            const fullWidthIds = new Set(['description', 'relatedProducts', 'reviews', 'recentlyViewed']);
            return allSections.filter(s => fullWidthIds.has(s.id)).map(section => {
              switch (section.id) {
                case 'description':
                  if (!product.description) return null;
                  return (
                    <div key="description" id="product-description" data-section="description" className="border rounded-lg overflow-hidden">
                      <div className="px-3 py-2.5 font-semibold text-sm bg-gray-100">
                        📝 MÔ TẢ SẢN PHẨM
                      </div>
                      <div className="p-3 text-sm prose prose-sm max-w-none lg:prose-base lg:p-5 rte-content"
                        onClick={(e) => {
                          const t = e.target as HTMLElement;
                          if (t.tagName === 'IMG') {
                            const src = (t as HTMLImageElement).src;
                            if (src) setLightboxSrc(src);
                          }
                        }}
                        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.description) }} />
                    </div>
                  );
                case 'relatedProducts':
                  if (relatedProducts.length === 0) return null;
                  if (layoutStyle) {
                    return (
                      <div key="relatedProducts" id="related-products" data-section="relatedProducts">
                        <h3 className="font-bold text-base mb-3 lg:text-xl">📦 Sản phẩm liên quan</h3>
                        <div className="lg:hidden flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
                          {relatedProducts.slice(0, 10).map(rp => (
                            <div key={rp.id} className="min-w-[160px] max-w-[180px] shrink-0">
                              <LayoutProductCard layoutStyle={layoutStyle} product={rp} onClick={() => onProductClick?.(rp)} accentColor={primaryColor} />
                            </div>
                          ))}
                        </div>
                        <div className={`hidden lg:block`}>
                          <div className={getProductGridClass(layoutStyle)}>
                          {relatedProducts.slice(0, 10).map(rp => (
                            <LayoutProductCard key={rp.id} layoutStyle={layoutStyle} product={rp} onClick={() => onProductClick?.(rp)} accentColor={primaryColor} />
                          ))}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key="relatedProducts" id="related-products" data-section="relatedProducts">
                      <h3 className="font-bold text-base mb-3 lg:text-xl">📦 Sản phẩm liên quan</h3>
                      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible">
                        {relatedProducts.slice(0, 10).map(rp => (
                          <button key={rp.id} onClick={() => onProductClick?.(rp)}
                            className="min-w-[140px] max-w-[160px] lg:min-w-0 lg:max-w-none shrink-0 lg:shrink rounded-xl border overflow-hidden text-left hover:shadow-md transition-shadow bg-white">
                            {rp.image_url ? (
                              <img src={rp.image_url} alt={rp.name} className="w-full aspect-square object-cover" />
                            ) : (
                              <div className="w-full aspect-square bg-gray-50 flex items-center justify-center">
                                <Package className="h-8 w-8 text-gray-300" />
                              </div>
                            )}
                            <div className="p-2">
                              <p className="text-xs font-medium line-clamp-2 leading-tight lg:text-sm">{rp.name}</p>
                              <p className="text-xs font-bold mt-1 lg:text-sm" style={{ color: primaryColor }}>
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
                    <div key="reviews" className="space-y-4">
                      <ProductReviewsSection
                        productId={product.id}
                        tenantId={tenantId}
                        primaryColor={primaryColor}
                      />
                      <StoreReviewsSection tenantId={tenantId} primaryColor={primaryColor} />
                    </div>
                  );
                case 'recentlyViewed':
                  if (recentlyViewedProducts.length === 0) return null;
                  if (layoutStyle) {
                    return (
                      <div key="recentlyViewed">
                        <h3 className="font-bold text-base mb-3 lg:text-xl">👁️ Đã xem gần đây</h3>
                        <div className="lg:hidden flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
                          {recentlyViewedProducts.slice(0, 10).map(rp => (
                            <div key={rp.id} className="min-w-[160px] max-w-[180px] shrink-0">
                              <LayoutProductCard layoutStyle={layoutStyle} product={rp} onClick={() => onProductClick?.(rp)} accentColor={primaryColor} />
                            </div>
                          ))}
                        </div>
                        <div className={`hidden lg:block`}>
                          <div className={getProductGridClass(layoutStyle)}>
                          {recentlyViewedProducts.slice(0, 10).map(rp => (
                            <LayoutProductCard key={rp.id} layoutStyle={layoutStyle} product={rp} onClick={() => onProductClick?.(rp)} accentColor={primaryColor} />
                          ))}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key="recentlyViewed">
                      <h3 className="font-bold text-base mb-3 lg:text-xl">👁️ Đã xem gần đây</h3>
                      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible">
                        {recentlyViewedProducts.slice(0, 10).map(rp => (
                          <button key={rp.id} onClick={() => onProductClick?.(rp)}
                            className="min-w-[140px] max-w-[160px] lg:min-w-0 lg:max-w-none shrink-0 lg:shrink rounded-xl border overflow-hidden text-left hover:shadow-md transition-shadow bg-white">
                            {rp.image_url ? (
                              <img src={rp.image_url} alt={rp.name} className="w-full aspect-square object-cover" />
                            ) : (
                              <div className="w-full aspect-square bg-gray-50 flex items-center justify-center">
                                <Package className="h-8 w-8 text-gray-300" />
                              </div>
                            )}
                            <div className="p-2">
                              <p className="text-xs font-medium line-clamp-2 leading-tight lg:text-sm">{rp.name}</p>
                              <p className="text-xs font-bold mt-1 lg:text-sm" style={{ color: primaryColor }}>
                                {formatNumber(rp.sale_price || rp.price)}đ
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                default:
                  return null;
              }
            });
          })()}
        </div>

        {/* ===== ORDER FORM / SUCCESS (centered on desktop) ===== */}
        <div className="px-4 space-y-4 lg:max-w-3xl lg:mx-auto lg:px-6">

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
                <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Nhập số điện thoại" inputMode="tel" className={`h-11 text-base ${attempted && !customerPhone.trim() ? 'border-red-400 ring-red-400' : ''}`} />
                <p className="text-xs font-medium mt-1" style={{ color: primaryColor }}>Nhập SĐT đã từng mua hàng để được ưu đãi</p>
              </div>

              <div>
                <Label className="text-sm flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Email</Label>
                <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="Nhập email" inputMode="email" type="email" className="h-11 text-base" />
                <p className="text-xs text-muted-foreground mt-1">Nhập đúng mail để nhận thông tin đơn hàng và bảo hành</p>
              </div>

              <div>
                <Label className="text-sm">Chi nhánh nhận hàng <span className="text-red-500">*</span></Label>
                <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
                  className={`flex h-11 w-full rounded-md border bg-white px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${attempted && !selectedBranch ? 'border-red-400 ring-red-400' : 'border-input'}`}>
                  <option value="">Chọn chi nhánh</option>
                  {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <Label className="text-sm">Số lượng</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11 text-lg"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>−</Button>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-11 text-base text-center w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11 text-lg"
                    onClick={() => setQuantity(quantity + 1)}>+</Button>
                </div>
              </div>

              <div>
                <Label className="text-sm">Địa chỉ</Label>
                <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Nhập địa chỉ (không bắt buộc)" className="h-11 text-base" />
              </div>

              <div>
                <Label className="text-sm">Ghi chú</Label>
                <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..." rows={2} className="text-base" />
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
                    </>
                  )}
                </div>
              )}

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
                <div className="flex justify-between">
                  <span className="text-gray-500">Số lượng:</span>
                  <span>{quantity}</span>
                </div>
                {quantity > 1 && (
                  <div className="flex justify-between text-gray-400">
                    <span>Đơn giá:</span>
                    <span>{formatNumber(displayPrice)}đ</span>
                  </div>
                )}
                {totalDiscount > 0 && (
                  <>
                    <div className="flex justify-between text-gray-400">
                      <span>Giá gốc:</span>
                      <span>{formatNumber(basePrice * quantity)}đ</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>{selectedVoucher ? `Voucher (${selectedVoucher.code})` : 'Điểm tích lũy'}:</span>
                      <span>-{formatNumber(totalDiscount)}đ</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-t pt-1.5">
                  <span className="text-gray-500">Tiền máy:</span>
                  <span className="font-medium">{formatNumber(displayPrice * quantity)}đ</span>
                </div>
                {selectedPackagesByGroup.length > 0 && (
                  <div className="space-y-2 pt-1.5 border-t border-dashed">
                    {selectedPackagesByGroup.map(([groupName, pkgs]) => {
                      const groupSubtotal = pkgs.reduce((s, p) => s + p.price * p.quantity, 0);
                      return (
                        <div key={groupName} className="space-y-1">
                          <span className="text-xs font-semibold text-muted-foreground">{groupName}:</span>
                          {pkgs.map(pkg => (
                            <div key={pkg.id} className="flex justify-between text-sm">
                              <span className="text-gray-600">• {pkg.name}{pkg.quantity > 1 ? ` × ${pkg.quantity}` : ''}</span>
                              <span className="font-medium">{pkg.price > 0 ? `+${formatNumber(pkg.price * pkg.quantity * quantity)}đ` : 'Miễn phí'}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Tổng {groupName}:</span>
                            <span>{groupSubtotal > 0 ? `+${formatNumber(groupSubtotal * quantity)}đ` : '0đ'}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex justify-between text-sm font-semibold border-t pt-1">
                      <span>Tổng dịch vụ kèm theo:</span>
                      <span>{packagesTotal > 0 ? `+${formatNumber(packagesTotal * quantity)}đ` : '0đ'}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-1.5 border-t">
                  <span>Tổng thanh toán:</span>
                  <span style={{ color: primaryColor }}>{formatNumber((displayPrice + packagesTotal) * quantity)}đ</span>
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
              <p className="font-semibold text-lg">Chúc mừng bạn đã đặt hàng thành công!</p>
              <p className="text-sm text-gray-500">Cửa hàng sẽ liên hệ bạn trong thời gian sớm nhất.</p>
              {warrantyHotline && (
                <a href={`tel:${warrantyHotline}`} className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: primaryColor }}>
                  <Phone className="h-4 w-4" />
                  Gọi ngay: {warrantyHotline}
                </a>
              )}
              {onNavigateOrderLookup && (
                <>
                  <p className="text-xs text-muted-foreground">Nhấn vào link tra cứu đơn đặt hàng để kiểm tra trạng thái.</p>
                  <Button
                    variant="outline"
                    className="w-full h-11 mt-2"
                    onClick={onNavigateOrderLookup}
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    <Search className="h-4 w-4 mr-1.5" /> Kiểm tra trạng thái đặt hàng
                  </Button>
                </>
              )}
              <Button variant="outline" className="w-full mt-2 h-11" onClick={onBack}>Quay lại</Button>
            </div>
          )}
        </div>
      </main>

      {/* Sticky bottom action bar - only show when not in order form */}
      {!showOrderForm && !orderSuccess && (() => {
        const buttons = (ctaButtons || getDefaultCTAButtons(websiteTemplate || undefined)).filter(b => b.enabled);
        if (buttons.length === 0) return null;

        const openOrderFlow = () => {
          const hasPaymentOptions = paymentConfig?.transferEnabled;
          if (hasPaymentOptions) {
            setShowPaymentFlow(true);
          } else {
            setShowOrderForm(true);
            setTimeout(() => { document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth' }); }, 100);
          }
        };

        const renderButton = (btn: CTAButtonItem) => {
          switch (btn.action) {
            case 'order':
              return (
                <Button key={btn.id} className="shrink-0 gap-2 h-11 text-sm font-semibold px-4 whitespace-nowrap" style={{ backgroundColor: primaryColor }}
                  onClick={openOrderFlow}>
                  {btn.icon} {btn.label}
                </Button>
              );

            case 'add_to_cart':
              return (
                <Button key={btn.id} className="shrink-0 gap-2 h-11 text-sm font-semibold px-4" style={{ backgroundColor: primaryColor }}
                  onClick={() => {
                    const hasVariants = usesMultiVariants
                      ? variantGroups.length > 0
                      : legacyVariants.length > 0;
                    if (hasVariants) {
                      const missing: string[] = [];
                      if (usesMultiVariants) {
                        variantGroups.forEach((g, i) => {
                          if (!selectedOptions[i]) missing.push(g.name || `Biến thể ${i + 1}`);
                        });
                      } else if (legacyVariants.length > 0 && selectedVariantIndex === null) {
                        missing.push('phiên bản');
                      }
                      if (missing.length > 0) {
                        setVariantAttempted(true);
                        toast.error(`Vui lòng chọn: ${missing.join(', ')}`, { position: 'top-center' });
                        return;
                      }
                    }
                    cart.addItem({
                      productId: product.id,
                      productName: product.name,
                      productImageUrl: product.image_url,
                      basePrice: displayPrice,
                      price: displayPrice + packagesTotal,
                      variant: getVariantLabel(),
                      selectedPackages: selectedPackages.map(pkg => ({
                        id: pkg.id,
                        name: pkg.name,
                        price: pkg.price,
                        groupName: pkg.groupName,
                        quantity: pkg.quantity,
                      })),
                      packagesTotal,
                    });
                    setVariantAttempted(false);
                    toast.success('Đã thêm vào giỏ hàng', { position: 'top-center' });
                  }}>
                  {btn.icon} {btn.label}
                </Button>
              );

            case 'installment': {
              const secs = detailSections || [{ id: 'installment', enabled: true }];
              const installmentEnabled = secs.find(s => s.id === 'installment')?.enabled !== false;
              if (!installmentEnabled || !onInstallment) return null;
              return (
                <Button key={btn.id} variant="outline" className="shrink-0 gap-2 h-11 text-sm px-4" onClick={onInstallment}>
                  {btn.icon} {btn.label}
                </Button>
              );
            }
            case 'installment_0':
              if (!onInstallment) return null;
              return (
                <Button key={btn.id} variant="outline" className="shrink-0 gap-2 h-11 text-sm px-4" onClick={onInstallment}>
                  {btn.icon} {btn.label}
                </Button>
              );

            case 'call':
              if (!warrantyHotline) return null;
              return (
                <Button key={btn.id} variant="outline" className="h-11 px-4 shrink-0" asChild>
                  <a href={`tel:${warrantyHotline}`} className="gap-2">{btn.icon} {btn.label}</a>
                </Button>
              );

            case 'zalo': {
              const rawUrl = btn.customUrl || zaloUrl;
              if (!rawUrl) return null;
              let zaloDeepLink = rawUrl.trim();
              if (zaloDeepLink.match(/zalo\.me\/(\d+)/)) {
                zaloDeepLink = `https://zalo.me/${zaloDeepLink.match(/zalo\.me\/(\d+)/)?.[1]}`;
              } else if (/^\d{8,15}$/.test(zaloDeepLink.replace(/\s/g, ''))) {
                zaloDeepLink = `https://zalo.me/${zaloDeepLink.replace(/\s/g, '')}`;
              } else if (!zaloDeepLink.startsWith('http')) {
                zaloDeepLink = `https://${zaloDeepLink}`;
              }
              return (
                <Button key={btn.id} variant="outline" className="h-11 px-4 shrink-0" asChild>
                  <a href={zaloDeepLink} target="_blank" rel="noopener noreferrer" className="gap-2">{btn.icon} {btn.label}</a>
                </Button>
              );
            }

            case 'facebook': {
              const url = btn.customUrl || facebookUrl;
              if (!url) return null;
              return (
                <Button key={btn.id} variant="outline" className="h-11 px-4 shrink-0" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="gap-2">{btn.icon} {btn.label}</a>
                </Button>
              );
            }

            case 'consult_now': {
              return (
                <Button key={btn.id} variant="outline" className="shrink-0 gap-2 h-11 text-sm px-4"
                  onClick={() => setShowConsultDialog(true)}>
                  {btn.icon} {btn.label}
                </Button>
              );
            }

            // Booking actions -> dedicated booking dialog with date/time
            case 'booking':
            case 'booking_consult':
            case 'booking_repair':
            case 'booking_beauty':
            case 'booking_clinic':
            case 'booking_store':
            case 'book_table':
            case 'book_party':
              return (
                <Button key={btn.id} className="shrink-0 min-w-[100px] gap-2 h-11 text-sm font-semibold" style={{ backgroundColor: primaryColor }}
                  onClick={() => setActiveDialog(btn.action)}>
                  {btn.icon} {btn.label}
                </Button>
              );

            // Order-like actions -> use existing order flow
            case 'order_food':
            case 'delivery':
              return (
                <Button key={btn.id} className="shrink-0 min-w-[100px] gap-2 h-11 text-sm font-semibold" style={{ backgroundColor: primaryColor }}
                  onClick={openOrderFlow}>
                  {btn.icon} {btn.label}
                </Button>
              );

            // Contact form actions -> dedicated dialog
            case 'pre_order':
            case 'notify_stock':
            case 'get_quote':
            case 'send_request':
            case 'best_price':
            case 'get_coupon':
              return (
                <Button key={btn.id} variant="outline" className="shrink-0 gap-2 h-11 text-sm px-4"
                  onClick={() => setActiveDialog(btn.action)}>
                  {btn.icon} {btn.label}
                </Button>
              );

            // Voucher/offer -> use existing voucher claim system
            case 'get_offer':
              return (
                <Button key={btn.id} variant="outline" className="shrink-0 gap-2 h-11 text-sm px-4"
                  onClick={() => setActiveDialog('get_offer')}>
                  {btn.icon} {btn.label}
                </Button>
              );

            case 'join_member': {
              if (!btn.customUrl) return null;
              return (
                <Button key={btn.id} variant="outline" className="h-11 px-4 shrink-0 gap-2"
                  onClick={() => setActiveDialog('join_member')}>
                  {btn.icon} {btn.label}
                </Button>
              );
            }

            // Review actions
            case 'view_reviews':
              return (
                <Button key={btn.id} variant="outline" className="h-11 px-4 shrink-0 gap-2"
                  onClick={() => { document.getElementById('section-reviews')?.scrollIntoView({ behavior: 'smooth' }); }}>
                  {btn.icon} {btn.label}
                </Button>
              );
            case 'write_review':
              return (
                <Button key={btn.id} variant="outline" className="h-11 px-4 shrink-0 gap-2"
                  onClick={() => setActiveDialog('write_review')}>
                  {btn.icon} {btn.label}
                </Button>
              );

            // System lookups
            case 'check_warranty':
              return (
                <Button key={btn.id} variant="outline" className="h-11 px-4 shrink-0 gap-2"
                  onClick={() => setActiveDialog('check_warranty')}>
                  {btn.icon} {btn.label}
                </Button>
              );
            case 'track_order':
              return (
                <Button key={btn.id} variant="outline" className="h-11 px-4 shrink-0 gap-2"
                  onClick={() => setActiveDialog('track_order')}>
                  {btn.icon} {btn.label}
                </Button>
              );

            case 'support':
              return (
                <Button key={btn.id} variant="outline" className="h-11 px-4 shrink-0 gap-2"
                  onClick={() => setActiveDialog('support')}>
                  {btn.icon} {btn.label}
                </Button>
              );

            case 'compare':
              return (
                <Button key={btn.id} variant="outline" className="h-11 px-4 shrink-0 gap-2"
                  style={{ backgroundColor: primaryColor, color: '#fff', borderColor: primaryColor }}
                  onClick={() => {
                    if (btn.customUrl) { window.open(btn.customUrl, '_blank'); return; }
                    // Scroll to related products section for comparison
                    const el = document.getElementById('related-products') || document.querySelector('[data-section="relatedProducts"]');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    else window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                  }}>
                  {btn.icon} {btn.label}
                </Button>
              );

            case 'view_detail':
              return (
                <Button key={btn.id} variant="outline" className="h-11 px-4 shrink-0 gap-2"
                  onClick={() => {
                    if (btn.customUrl) { window.open(btn.customUrl, '_blank'); return; }
                    // Scroll to description/specs section
                    const el = document.getElementById('product-description') || document.querySelector('[data-section="description"]');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    else window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}>
                  {btn.icon} {btn.label}
                </Button>
              );

            case 'view_menu':
              return (
                <Button key={btn.id} variant="outline" className="h-11 px-4 shrink-0 gap-2"
                  onClick={() => { if (btn.customUrl) window.open(btn.customUrl, '_blank'); else onBack(); }}>
                  {btn.icon} {btn.label}
                </Button>
              );

            // Promotion info dialogs
            case 'today_offer':
            case 'today_gift':
            case 'hot_deal':
              return (
                <Button key={btn.id} variant="outline" className="h-11 px-4 shrink-0 gap-2"
                  onClick={() => { if (btn.customUrl) window.open(btn.customUrl, '_blank'); else setActiveDialog(btn.action); }}>
                  {btn.icon} {btn.label}
                </Button>
              );

            case 'custom_link':
              if (!btn.customUrl) return null;
              return (
                <Button key={btn.id} variant="outline" className="h-11 px-4 shrink-0" asChild>
                  <a href={btn.customUrl} target="_blank" rel="noopener noreferrer" className="gap-2">{btn.icon} {btn.label}</a>
                </Button>
              );

            default:
              return (
                <Button key={btn.id} variant="outline" className="h-11 px-4 shrink-0 gap-2"
                  onClick={() => { if (btn.customUrl) window.open(btn.customUrl, '_blank'); else setActiveDialog(btn.action); }}>
                  {btn.icon} {btn.label}
                </Button>
              );
          }
        };

        return (
          <div className="fixed bottom-4 left-0 right-0 z-30 flex justify-center px-4 lg:px-6">
           <div className="w-full lg:max-w-7xl">
            <div className="bg-white border rounded-2xl shadow-lg flex items-center gap-2 px-3 py-2.5 overflow-x-auto scrollbar-hide">
              {buttons.map(renderButton)}
            </div>
           </div>
          </div>
        );
      })()}

      {/* Payment Flow Dialog */}
      <PaymentFlowDialog
        open={showPaymentFlow}
        onClose={() => setShowPaymentFlow(false)}
        product={{ id: product.id, name: product.name, image_url: product.image_url, sku: (product as any).sku }}
        price={displayPrice}
        variant={getVariantLabel()}
        quantity={quantity}
        primaryColor={primaryColor}
        tenantId={tenantId}
        codEnabled={paymentConfig?.codEnabled !== false}
        transferEnabled={!!paymentConfig?.transferEnabled}
        bankName={paymentConfig?.bankName}
        accountNumber={paymentConfig?.accountNumber}
        accountHolder={paymentConfig?.accountHolder}
        confirmZaloUrl={paymentConfig?.confirmZaloUrl}
        confirmMessengerUrl={paymentConfig?.confirmMessengerUrl}
        branches={branches}
        isSubmitting={placeOrder.isPending}
        onNavigateOrderLookup={onNavigateOrderLookup}
        onPlaceOrder={async (data) => {
          if (usesMultiVariants) {
            for (let i = 0; i < variantGroups.length; i++) {
              if (!selectedOptions[i]) {
                toast.error(`Vui lòng chọn ${variantGroups[i].name || `Biến thể ${i + 1}`}`);
                throw new Error('missing variant');
              }
            }
          }
          await placeOrder.mutateAsync({
            tenant_id: tenantId,
            branch_id: data.branch_id,
            product_id: product.id,
            product_name: product.name,
            product_image_url: product.image_url,
            product_price: data.final_price ?? displayPrice,
            variant: getVariantLabel(),
            quantity,
            customer_name: data.customer_name,
            customer_phone: data.customer_phone,
            customer_email: data.customer_email,
            customer_address: data.customer_address,
            note: data.note,
            payment_method: data.payment_method,
            transfer_content: data.transfer_content,
          });
        }}
      />

      {/* ===== CTA ACTION DIALOGS ===== */}
      {/* Contact form dialogs */}
      <ContactFormDialog
        open={activeDialog === 'pre_order'}
        onClose={() => setActiveDialog(null)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
        productName={product.name} productId={product.id} productImageUrl={product.image_url} productPrice={displayPrice}
        title="📋 Đặt trước sản phẩm" description="Đặt trước để nhận thông báo khi hàng về"
        actionLabel="Đặt trước" requireEmail={true} notePrefix="[Đặt trước]" actionType="pre_order"
        onNavigateOrderLookup={onNavigateOrderLookup}
      />
      <ContactFormDialog
        open={activeDialog === 'notify_stock'}
        onClose={() => setActiveDialog(null)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
        productName={product.name} productId={product.id} productImageUrl={product.image_url} productPrice={0}
        title="🔔 Báo khi có hàng" description="Nhập thông tin để nhận thông báo khi sản phẩm có lại"
        actionLabel="Đăng ký nhận thông báo" requireEmail={true} showMessage={false} notePrefix="[Báo khi có hàng]" actionType="notify_stock"
        onNavigateOrderLookup={onNavigateOrderLookup}
      />
      <ContactFormDialog
        open={activeDialog === 'get_quote'}
        onClose={() => setActiveDialog(null)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
        productName={product.name} productId={product.id} productImageUrl={product.image_url} productPrice={displayPrice}
        title="📄 Nhận báo giá" description="Nhập thông tin để nhận báo giá chi tiết"
        actionLabel="Gửi yêu cầu báo giá" requireEmail={false} notePrefix="[Yêu cầu báo giá]" actionType="get_quote"
      />
      <ContactFormDialog
        open={activeDialog === 'send_request'}
        onClose={() => setActiveDialog(null)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
        productName={product.name} productId={product.id} productImageUrl={product.image_url} productPrice={0}
        title="📩 Gửi yêu cầu" description="Gửi yêu cầu hoặc câu hỏi đến cửa hàng"
        actionLabel="Gửi yêu cầu" requireEmail={false} notePrefix="[Yêu cầu chung]" actionType="send_request"
      />
      <ContactFormDialog
        open={activeDialog === 'best_price'}
        onClose={() => setActiveDialog(null)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
        productName={product.name} productId={product.id} productImageUrl={product.image_url} productPrice={displayPrice}
        title="💰 Xem giá tốt nhất" description="Liên hệ để nhận giá ưu đãi đặc biệt"
        actionLabel="Nhận giá tốt nhất" requireEmail={false} notePrefix="[Yêu cầu giá tốt nhất]" actionType="best_price"
      />
      <ContactFormDialog
        open={activeDialog === 'get_coupon'}
        onClose={() => setActiveDialog(null)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
        productName={product.name} productId={product.id} productImageUrl={product.image_url} productPrice={0}
        title="🎫 Nhận mã giảm giá" description="Đăng ký để nhận mã khuyến mãi"
        actionLabel="Nhận mã giảm giá" requireEmail={true} showMessage={false} notePrefix="[Nhận mã giảm giá]" actionType="get_coupon"
      />
      <ContactFormDialog
        open={activeDialog === 'get_offer'}
        onClose={() => setActiveDialog(null)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
        productName={product.name} productId={product.id} productImageUrl={product.image_url} productPrice={0}
        title="🎁 Nhận ưu đãi" description="Đăng ký để nhận ưu đãi đặc biệt"
        actionLabel="Nhận ưu đãi" requireEmail={true} showMessage={false} notePrefix="[Nhận ưu đãi]" actionType="get_offer"
      />

      {/* Hotel booking dialog (date range) - for hotel_store template */}
      {websiteTemplate === 'hotel_store' && (
        <HotelBookingDialog
          open={activeDialog === 'booking'}
          onClose={() => setActiveDialog(null)}
          tenantId={tenantId} primaryColor={primaryColor} branches={branches}
          productName={product.name} productId={product.id} productImageUrl={product.image_url} productPrice={displayPrice}
          title="🏨 Đặt phòng"
          onNavigateOrderLookup={onNavigateOrderLookup}
        />
      )}

      {/* Regular booking dialogs (single date) - for non-hotel templates */}
      <BookingDialog
        open={
          (websiteTemplate === 'hotel_store'
            ? ['booking_consult', 'booking_repair', 'booking_beauty', 'booking_clinic', 'booking_store'].includes(activeDialog || '')
            : ['booking', 'booking_consult', 'booking_repair', 'booking_beauty', 'booking_clinic', 'booking_store'].includes(activeDialog || '')
          )
        }
        onClose={() => setActiveDialog(null)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
        productName={product.name} productId={product.id} productImageUrl={product.image_url} productPrice={displayPrice}
        title={
          activeDialog === 'booking' ? '📅 Đặt lịch ngay' :
          activeDialog === 'booking_consult' ? '📅 Đặt lịch tư vấn' :
          activeDialog === 'booking_repair' ? '🔧 Đặt lịch sửa chữa' :
          activeDialog === 'booking_beauty' ? '💅 Đặt lịch làm đẹp' :
          activeDialog === 'booking_clinic' ? '🏥 Đặt lịch khám' :
          activeDialog === 'booking_store' ? '🏪 Đặt lịch tại cửa hàng' : 'Đặt lịch'
        }
        requireTime={true}
        onNavigateOrderLookup={onNavigateOrderLookup}
      />
      <BookingDialog
        open={activeDialog === 'book_table'}
        onClose={() => setActiveDialog(null)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
        productName={product.name} productId={product.id} productImageUrl={product.image_url} productPrice={0}
        title="🪑 Đặt bàn" requireTime={true}
        onNavigateOrderLookup={onNavigateOrderLookup}
      />
      <BookingDialog
        open={activeDialog === 'book_party'}
        onClose={() => setActiveDialog(null)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
        productName={product.name} productId={product.id} productImageUrl={product.image_url} productPrice={0}
        title="🎉 Đặt tiệc" requireTime={false}
        onNavigateOrderLookup={onNavigateOrderLookup}
      />

      {/* System dialogs */}
      <TrackOrderDialog
        open={activeDialog === 'track_order'}
        onClose={() => setActiveDialog(null)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
      />
      <CheckWarrantyDialog
        open={activeDialog === 'check_warranty'}
        onClose={() => setActiveDialog(null)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
      />
      <WriteReviewDialog
        open={activeDialog === 'write_review'}
        onClose={() => setActiveDialog(null)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
        productName={product.name} productId={product.id}
      />
      <SupportDialog
        open={activeDialog === 'support'}
        onClose={() => setActiveDialog(null)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
        storePhone={storeInfo?.phone || warrantyHotline}
        zaloUrl={zaloUrl}
        facebookUrl={facebookUrl}
      />
      <CartDialog
        open={showCartDialog}
        onClose={() => setShowCartDialog(false)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
        onCheckout={openOrderFlowFn}
      />
      <PromotionInfoDialog
        open={['today_offer', 'today_gift', 'hot_deal'].includes(activeDialog || '')}
        onClose={() => setActiveDialog(null)}
        title={activeDialog === 'today_offer' ? '🔥 Ưu đãi hôm nay' : activeDialog === 'today_gift' ? '🎁 Quà tặng hôm nay' : '⚡ Deal hot'}
        productName={product.name}
      />
      <JoinMemberDialog
        open={activeDialog === 'join_member'}
        onClose={() => setActiveDialog(null)}
        tenantId={tenantId} primaryColor={primaryColor} branches={branches}
        productName={product.name}
        groupUrl={(ctaButtons || []).find(b => b.action === 'join_member')?.customUrl || ''}
      />

      {/* Consult Contact Dialog */}
      {showConsultDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setShowConsultDialog(false)}>
          <div className="w-full max-w-sm bg-background rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:pb-5 space-y-4 animate-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">💬 Liên hệ tư vấn</h3>
              <button onClick={() => setShowConsultDialog(false)} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">✕</button>
            </div>
            <p className="text-sm text-muted-foreground">Chọn kênh liên hệ phù hợp với bạn:</p>
            <div className="space-y-2.5">
              {storeInfo?.phone && (
                <a href={`tel:${storeInfo.phone}`} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors">
                  <span className="h-10 w-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: `${primaryColor}15` }}>📞</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Gọi điện thoại</p>
                    <p className="text-xs text-muted-foreground">{storeInfo.phone}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </a>
              )}
              {warrantyHotline && warrantyHotline !== storeInfo?.phone && (
                <a href={`tel:${warrantyHotline}`} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors">
                  <span className="h-10 w-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: `${primaryColor}15` }}>📱</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Hotline</p>
                    <p className="text-xs text-muted-foreground">{warrantyHotline}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </a>
              )}
              {zaloUrl && (() => {
                const raw = zaloUrl.trim();
                const link = raw.startsWith('http') ? raw : `https://zalo.me/${raw.replace(/\s/g, '')}`;
                return (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors">
                    <span className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-lg">💬</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">Zalo</p>
                      <p className="text-xs text-muted-foreground">Nhắn tin qua Zalo</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </a>
                );
              })()}
              {facebookUrl && (
                <a href={facebookUrl.startsWith('http') ? facebookUrl : `https://${facebookUrl}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors">
                  <span className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-lg">💬</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Facebook Messenger</p>
                    <p className="text-xs text-muted-foreground">Chat qua Facebook</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </a>
              )}
              {storeInfo?.email && (
                <a href={`mailto:${storeInfo.email}`} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors">
                  <span className="h-10 w-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: `${primaryColor}15` }}>📧</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Email</p>
                    <p className="text-xs text-muted-foreground">{storeInfo.email}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </a>
              )}
              {!storeInfo?.phone && !warrantyHotline && !zaloUrl && !facebookUrl && !storeInfo?.email && (
                <p className="text-sm text-muted-foreground text-center py-4">Chưa có thông tin liên hệ</p>
              )}
            </div>
          </div>
        </div>
      )}
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
