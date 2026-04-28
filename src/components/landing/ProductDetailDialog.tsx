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
import { sanitizeRichHtml } from '@/lib/sanitizeRichHtml';
import { LandingProduct, LandingProductVariant, VariantPriceEntry, getVariantGroups, findVariantPrice } from '@/hooks/useLandingProducts';
import { usePublicProductPackages, LandingProductPackage } from '@/hooks/useLandingProducts';
import { usePlaceLandingOrder } from '@/hooks/useLandingOrders';
import { usePublicCustomerVouchers } from '@/hooks/useVouchers';
import { useCustomerPointsPublic } from '@/hooks/useTenantLanding';
import { toast } from 'sonner';
import { ProductReviewsSection } from './ProductReviewsSection';
import { usePublicProductReviews } from '@/hooks/useLandingProductReviews';

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
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<string>>(new Set());

  // Multi-level variant selections (up to 5)
  const [selectedOptions, setSelectedOptions] = useState<(string | null)[]>([]);

  const placeOrder = usePlaceLandingOrder();

  // Fetch service packages for this product
  const { data: productPackages } = usePublicProductPackages(product?.id || null);

  // Fetch reviews for rating summary
  const { data: productReviews = [] } = usePublicProductReviews(product?.id || null);
  const ratingAvg = productReviews.length
    ? productReviews.reduce((s, r) => s + (r.rating || 0), 0) / productReviews.length
    : 0;

  // Auto-select default packages when product changes
  useEffect(() => {
    if (productPackages && productPackages.length > 0) {
      const defaults = new Set(productPackages.filter(p => p.is_default).map(p => p.id));
      setSelectedPackageIds(defaults);
    } else {
      setSelectedPackageIds(new Set());
    }
  }, [productPackages]);

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

  // Variant groups (up to 5 levels)
  const variantGroups = useMemo(() => (product ? getVariantGroups(product) : []), [product]);

  const variantPrices: VariantPriceEntry[] = useMemo(() => {
    if (!product) return [];
    return Array.isArray(product.variant_prices) ? product.variant_prices : [];
  }, [product]);

  const usesMultiVariants = variantGroups.length > 0;

  // Legacy single-level variants
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

  // Find the matching variant price entry across N levels
  const allLevelsSelected = usesMultiVariants && variantGroups.every((_, i) => !!selectedOptions[i]);
  const matchedVariantPrice = useMemo(() => {
    if (!usesMultiVariants || !allLevelsSelected) return null;
    return findVariantPrice(variantPrices, selectedOptions.slice(0, variantGroups.length));
  }, [usesMultiVariants, allLevelsSelected, variantPrices, selectedOptions, variantGroups.length]);

  // All images
  const allImages = useMemo(() => {
    if (!product) return [];

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

  // Calculate price
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

  // Calculate packages total
  const selectedPackages = useMemo(() => {
    return (productPackages || []).filter(p => selectedPackageIds.has(p.id));
  }, [productPackages, selectedPackageIds]);

  const packagesTotal = useMemo(() => {
    if (!productPackages) return 0;
    return productPackages.filter(p => selectedPackageIds.has(p.id)).reduce((sum, p) => sum + p.price, 0);
  }, [productPackages, selectedPackageIds]);

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

  const resetForm = () => {
    setShowOrderForm(false);
    setOrderSuccess(false);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setNote('');
    setSelectedBranch('');
    setSelectedVariantIndex(null);
    setSelectedOptions([]);
    setQuantity(1);
    setCurrentImageIndex(0);
    setSelectedVoucherId(null);
    setUsePoints(false);
    setDebouncedPhone('');
    setAttempted(false);
    setSelectedPackageIds(new Set());
  };

  const handleClose = (val: boolean) => {
    if (!val) resetForm();
    onOpenChange(val);
  };

  const getVariantLabel = () => {
    if (usesMultiVariants) {
      const parts = selectedOptions.slice(0, variantGroups.length).filter(Boolean);
      return parts.length > 0 ? parts.join(' / ') : undefined;
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
      // Build packages note
      const selectedPkgs = selectedPackages;
      const packagesNote = selectedPkgs.length > 0
        ? `[Gói DV: ${selectedPkgs.map(p => `${p.name} (+${formatNumber(p.price)}đ)`).join(', ')}]`
        : '';
      const fullNote = [discountNote, packagesNote, note.trim()].filter(Boolean).join(' ');

      // Build selected_packages JSON
      const selectedPackagesData = selectedPkgs.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
      }));

      const orderPrice = displayPrice + packagesTotal;

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
        customer_address: customerAddress.trim() || undefined,
        note: fullNote || undefined,
        selected_packages: selectedPackagesData,
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

          {product.is_sold_out && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="text-red-600 font-bold text-sm">🚫 Tạm hết</span>
            </div>
          )}

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
          {/* Đã bán */}
          {(productReviews.length > 0 || ((product as any).show_sold_count !== false && Number((product as any).sold_count ?? 0) > 0)) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground -mt-1 flex-wrap">
              {productReviews.length > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold text-foreground">{ratingAvg.toFixed(1)}</span>
                  <span>({formatNumber(productReviews.length)})</span>
                </span>
              )}
              {productReviews.length > 0 && (product as any).show_sold_count !== false && Number((product as any).sold_count ?? 0) > 0 && (
                <span className="text-muted-foreground/50">·</span>
              )}
              {(product as any).show_sold_count !== false && Number((product as any).sold_count ?? 0) > 0 && (
                <span>🔥 Đã bán <span className="font-semibold text-orange-600">{formatNumber(Number((product as any).sold_count))}</span></span>
              )}
            </div>
          )}

          {/* ===== MULTI-LEVEL VARIANTS (up to 5) ===== */}
          {usesMultiVariants && (
            <div className="space-y-3">
              {variantGroups.map((group, gIdx) => {
                const sel = selectedOptions[gIdx] || null;
                return (
                  <div key={gIdx}>
                    <Label className="text-sm font-medium mb-2 block">
                      {group.name || `Biến thể ${gIdx + 1}`} <span className="text-destructive">*</span>
                    </Label>
                    <div className={`flex flex-wrap gap-2 p-2 rounded-md ${attempted && !sel ? 'border-2 border-destructive' : ''}`}>
                      {group.options.map((opt, i) => (
                        <Badge
                          key={i}
                          variant={sel === opt.name ? 'default' : 'outline'}
                          className="cursor-pointer text-sm px-3 py-1.5"
                          style={sel === opt.name ? { backgroundColor: primaryColor } : {}}
                          onClick={() => {
                            setSelectedOptions(prev => {
                              const next = [...prev];
                              while (next.length <= gIdx) next.push(null);
                              next[gIdx] = next[gIdx] === opt.name ? null : opt.name;
                              return next;
                            });
                          }}
                        >
                          {opt.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Stock / sold-out info */}
              {matchedVariantPrice && matchedVariantPrice.is_sold_out && (
                <p className="text-sm font-medium text-red-600">🚫 Đã hết</p>
              )}
              {matchedVariantPrice && !matchedVariantPrice.is_sold_out && matchedVariantPrice.stock !== undefined && matchedVariantPrice.stock > 0 && (
                <p className="text-xs text-muted-foreground">Còn {matchedVariantPrice.stock} sản phẩm</p>
              )}
            </div>
          )}

          {/* ===== LEGACY VARIANTS ===== */}
          {!usesMultiVariants && legacyVariants.length > 0 && (
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
          {/* ===== SERVICE PACKAGES ===== */}
          {productPackages && productPackages.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 font-semibold text-sm flex items-center gap-1.5" style={{ backgroundColor: primaryColor, color: 'white' }}>
                📦 Gói dịch vụ kèm theo
              </div>
              <div className="p-3 space-y-2">
                {(() => {
                  const isSingle = product?.package_selection_mode === 'single';
                  return productPackages.map(pkg => (
                    <label key={pkg.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                      <input
                        type={isSingle ? 'radio' : 'checkbox'}
                        name={isSingle ? 'pkg_select' : undefined}
                        checked={selectedPackageIds.has(pkg.id)}
                        onChange={() => {
                          if (isSingle) {
                            setSelectedPackageIds(selectedPackageIds.has(pkg.id) ? new Set() : new Set([pkg.id]));
                          } else {
                            setSelectedPackageIds(prev => {
                              const next = new Set(prev);
                              if (next.has(pkg.id)) next.delete(pkg.id);
                              else next.add(pkg.id);
                              return next;
                            });
                          }
                        }}
                        className="rounded border-input h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{pkg.name}</p>
                        {pkg.description && <p className="text-xs text-muted-foreground">{pkg.description}</p>}
                      </div>
                      <span className="text-sm font-semibold shrink-0" style={{ color: primaryColor }}>
                        {pkg.price > 0 ? `+${formatNumber(pkg.price)}đ` : 'Miễn phí'}
                      </span>
                    </label>
                  ));
                })()}
              </div>
            </div>
          )}

          {showPromotionSection && product.promotion_content && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 font-semibold text-sm flex items-center gap-1.5" style={{ backgroundColor: primaryColor, color: 'white' }}>
                🎁 {promotionTitle}
              </div>
              <div className="p-3 text-sm prose prose-sm max-w-none rte-content"
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.promotion_content) }} />
            </div>
          )}

          {/* ===== WARRANTY SECTION ===== */}
          {showWarrantySection && product.warranty_content && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 font-semibold text-sm flex items-center gap-1.5 bg-muted">
                <Shield className="h-4 w-4" /> {warrantyTitle}
              </div>
              <div className="p-3 text-sm prose prose-sm max-w-none rte-content"
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.warranty_content) }} />
            </div>
          )}

          {/* ===== DESCRIPTION ===== */}
          {product.description && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 font-semibold text-sm bg-muted">
                📝 MÔ TẢ SẢN PHẨM
              </div>
              <div className="p-3 text-sm prose prose-sm max-w-none rte-content"
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.description) }} />
            </div>
          )}

          {/* ===== REVIEWS ===== */}
          {product.id && product.tenant_id && (
            <ProductReviewsSection
              productId={product.id}
              tenantId={product.tenant_id}
              primaryColor={primaryColor}
            />
          )}

          {/* ===== ORDER / INSTALLMENT BUTTONS ===== */}
          {orderSuccess ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <p className="font-semibold text-lg">Chúc mừng bạn đã đặt hàng thành công!</p>
              <p className="text-sm text-muted-foreground">Cửa hàng sẽ liên hệ bạn trong thời gian sớm nhất.</p>
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
                    className="w-full h-11 mt-1"
                    onClick={() => { handleClose(false); onNavigateOrderLookup(); }}
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    <Search className="h-4 w-4 mr-1.5" /> Kiểm tra trạng thái đặt hàng
                  </Button>
                </>
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

              {/* Quantity selector for purchase actions */}
              <div>
                <Label className="text-xs">Số lượng</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0"
                    onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}>
                    <span className="text-lg font-bold">−</span>
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={e => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 1) setQuantity(v);
                    }}
                    className="h-10 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    inputMode="numeric"
                  />
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0"
                    onClick={() => setQuantity(q => q + 1)}>
                    <span className="text-lg font-bold">+</span>
                  </Button>
                </div>
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
                {quantity > 1 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Đơn giá × Số lượng:</span>
                    <span>{formatNumber(displayPrice)}đ × {quantity}</span>
                  </div>
                )}
                {totalDiscount > 0 && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Giá gốc:</span>
                      <span>{formatNumber(basePrice * quantity)}đ</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>{selectedVoucher ? `Voucher (${selectedVoucher.code})` : 'Điểm tích lũy'}:</span>
                      <span>-{formatNumber(totalDiscount)}đ</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-t pt-1">
                  <span className="text-muted-foreground">Tiền máy:</span>
                  <span className="font-medium">{formatNumber(displayPrice * quantity)}đ</span>
                </div>
                {selectedPackages.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-dashed">
                    <span className="text-xs font-medium text-muted-foreground">Gói dịch vụ kèm theo:</span>
                    {selectedPackages.map(pkg => (
                      <div key={pkg.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">• {pkg.name}</span>
                        <span className="font-medium">{pkg.price > 0 ? `+${formatNumber(pkg.price * quantity)}đ` : 'Miễn phí'}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-medium">
                      <span>Tổng gói DV:</span>
                      <span>{packagesTotal > 0 ? `+${formatNumber(packagesTotal * quantity)}đ` : '0đ'}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-1 border-t">
                  <span>Tổng thanh toán:</span>
                  <span style={{ color: primaryColor }}>{formatNumber((displayPrice + packagesTotal) * quantity)}đ</span>
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
