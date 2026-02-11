import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Package, Phone, ShoppingCart, CheckCircle2, Loader2 } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
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

  const placeOrder = usePlaceLandingOrder();

  // Parse variants - support both old string[] and new {name, price}[] format
  const variants: LandingProductVariant[] = (() => {
    try {
      const v = product?.variants as any;
      if (!Array.isArray(v)) return [];
      return v.map((item: any) => {
        if (typeof item === 'string') return { name: item, price: 0 };
        if (item && typeof item === 'object' && item.name) return { name: item.name, price: item.price || 0 };
        return null;
      }).filter(Boolean) as LandingProductVariant[];
    } catch {}
    return [];
  })();

  const selectedVariant = selectedVariantIndex !== null ? variants[selectedVariantIndex] : null;

  // Display price: use variant price if selected and > 0, otherwise product price
  const displayPrice = selectedVariant && selectedVariant.price > 0
    ? selectedVariant.price
    : (product?.sale_price || product?.price || 0);

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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
        {/* Product image */}
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full aspect-square object-cover rounded-t-lg" />
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

          {/* Description (rich text) */}
          {product.description && (
            <div className="text-sm text-muted-foreground prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: product.description }} />
          )}

          {/* Variants selection */}
          {variants.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Chọn phiên bản <span className="text-destructive">*</span></Label>
              <div className="flex flex-wrap gap-2">
                {variants.map((v, i) => (
                  <Badge
                    key={i}
                    variant={selectedVariantIndex === i ? 'default' : 'outline'}
                    className="cursor-pointer text-sm px-3 py-1.5 flex-col items-start gap-0.5"
                    style={selectedVariantIndex === i ? { backgroundColor: primaryColor } : {}}
                    onClick={() => setSelectedVariantIndex(selectedVariantIndex === i ? null : i)}
                  >
                    <span>{v.name}</span>
                    {v.price > 0 && <span className="text-[10px] opacity-80">{formatNumber(v.price)}đ</span>}
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
                  <SelectContent>
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
