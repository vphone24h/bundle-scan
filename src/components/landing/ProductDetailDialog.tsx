import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Package, Phone, ShoppingCart, CheckCircle2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import DOMPurify from 'dompurify';
import { LandingProduct, LandingProductVariant } from '@/hooks/useLandingProducts';
import { usePlaceLandingOrder } from '@/hooks/useLandingOrders';
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
}

export function ProductDetailDialog({ product, open, onOpenChange, tenantId, branches, primaryColor, warrantyHotline }: ProductDetailDialogProps) {
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

  const placeOrder = usePlaceLandingOrder();

  // Parse variants
  const variants: LandingProductVariant[] = useMemo(() => {
    try {
      const v = product?.variants as any;
      if (!Array.isArray(v)) return [];
      return v.map((item: any) => {
        if (typeof item === 'string') return { name: item, price: 0 };
        if (item && typeof item === 'object' && item.name) return { name: item.name, price: item.price || 0, image_url: item.image_url };
        return null;
      }).filter(Boolean) as LandingProductVariant[];
    } catch {}
    return [];
  }, [product?.variants]);

  // Collect all images: product images + variant images
  const allImages = useMemo(() => {
    if (!product) return [];
    const imgs: string[] = [];
    // Product images array
    if (Array.isArray(product.images) && product.images.length > 0) {
      imgs.push(...product.images);
    } else if (product.image_url) {
      imgs.push(product.image_url);
    }
    // Variant images
    variants.forEach(v => {
      if (v.image_url && !imgs.includes(v.image_url)) {
        imgs.push(v.image_url);
      }
    });
    return imgs;
  }, [product, variants]);

  const selectedVariant = selectedVariantIndex !== null ? variants[selectedVariantIndex] : null;

  const displayPrice = selectedVariant && selectedVariant.price > 0
    ? selectedVariant.price
    : (product?.sale_price || product?.price || 0);

  // When variant selected, jump to its image
  const handleSelectVariant = (i: number) => {
    const newIdx = selectedVariantIndex === i ? null : i;
    setSelectedVariantIndex(newIdx);
    if (newIdx !== null) {
      const v = variants[newIdx];
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
    setQuantity(1);
    setCurrentImageIndex(0);
  };

  const handleClose = (val: boolean) => {
    if (!val) resetForm();
    onOpenChange(val);
  };

  const handleSubmitOrder = async () => {
    if (!product || !customerName.trim() || !customerPhone.trim() || !selectedBranch) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    if (variants.length > 0 && selectedVariantIndex === null) {
      toast.error('Vui lòng chọn biến thể sản phẩm');
      return;
    }
    try {
      await placeOrder.mutateAsync({
        tenant_id: tenantId,
        branch_id: selectedBranch,
        product_id: product.id,
        product_name: product.name,
        product_image_url: product.image_url,
        product_price: displayPrice,
        variant: selectedVariant?.name || undefined,
        quantity,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim() || undefined,
        note: note.trim() || undefined,
      });
      setOrderSuccess(true);
    } catch (err) {
      toast.error('Đặt hàng thất bại, vui lòng thử lại');
    }
  };

  if (!product) return null;

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
                <button
                  onClick={() => setCurrentImageIndex(i => (i - 1 + allImages.length) % allImages.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setCurrentImageIndex(i => (i + 1) % allImages.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                {/* Thumbnails */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 px-4">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`h-10 w-10 rounded border-2 overflow-hidden flex-shrink-0 ${
                        currentImageIndex === idx ? 'border-white shadow-lg' : 'border-transparent opacity-70'
                      }`}
                    >
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
          <DialogHeader className="text-left p-0">
            <DialogTitle className="text-lg">{product.name}</DialogTitle>
          </DialogHeader>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold" style={{ color: primaryColor }}>{formatNumber(displayPrice)}đ</span>
            {product.sale_price && !selectedVariant && (
              <span className="text-sm text-muted-foreground line-through">{formatNumber(product.price)}đ</span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="text-sm text-muted-foreground prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }} />
          )}

          {/* Variants */}
          {variants.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Chọn phiên bản <span className="text-destructive">*</span></Label>
              <div className="flex flex-wrap gap-2">
                {variants.map((v, i) => (
                  <Badge
                    key={i}
                    variant={selectedVariantIndex === i ? 'default' : 'outline'}
                    className="cursor-pointer text-sm px-2 py-1.5 flex items-center gap-1.5"
                    style={selectedVariantIndex === i ? { backgroundColor: primaryColor } : {}}
                    onClick={() => handleSelectVariant(i)}
                  >
                    {v.image_url && (
                      <img src={v.image_url} alt="" className="h-6 w-6 rounded object-cover" />
                    )}
                    <div className="flex flex-col items-start gap-0.5">
                      <span>{v.name}</span>
                      {v.price > 0 && <span className="text-[10px] opacity-80">{formatNumber(v.price)}đ</span>}
                    </div>
                  </Badge>
                ))}
              </div>
            </div>
          )}

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
              <Button variant="outline" className="w-full mt-2" onClick={() => handleClose(false)}>Đóng</Button>
            </div>
          ) : !showOrderForm ? (
            <div className="flex gap-2">
              <Button className="flex-1 gap-2" style={{ backgroundColor: primaryColor }} onClick={() => setShowOrderForm(true)}>
                <ShoppingCart className="h-4 w-4" />
                Đặt hàng
              </Button>
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
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nhập họ tên" className="h-10" />
              </div>

              <div>
                <Label className="text-xs">Số điện thoại <span className="text-destructive">*</span></Label>
                <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Nhập SĐT" inputMode="tel" className="h-10" />
              </div>

              <div>
                <Label className="text-xs">Chi nhánh nhận hàng <span className="text-destructive">*</span></Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Chọn chi nhánh" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                {selectedVariant && (
                  <div className="flex justify-between">
                    <span>Phiên bản:</span>
                    <span>{selectedVariant.name}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-1 border-t">
                  <span>Tổng:</span>
                  <span style={{ color: primaryColor }}>{formatNumber(displayPrice)}đ</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowOrderForm(false)}>Quay lại</Button>
                <Button
                  className="flex-1 gap-2"
                  style={{ backgroundColor: primaryColor }}
                  onClick={handleSubmitOrder}
                  disabled={placeOrder.isPending}
                >
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
