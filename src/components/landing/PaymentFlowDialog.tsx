import { useState, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Banknote, CreditCard, ArrowLeft, QrCode, CheckCircle2, ExternalLink, Copy, Loader2, ShoppingCart, MapPin, MessageCircle } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { generateVietQRUrl, getBankCode, VIETNAMESE_BANKS } from '@/lib/vietnameseBanks';
import { toast } from 'sonner';

interface PaymentFlowDialogProps {
  open: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    image_url?: string | null;
    sku?: string;
  };
  price: number;
  variant?: string;
  quantity: number;
  primaryColor: string;
  // Payment config from tenant settings
  codEnabled: boolean;
  transferEnabled: boolean;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  confirmZaloUrl?: string | null;
  confirmMessengerUrl?: string | null;
  // Branches
  branches: { id: string; name: string }[];
  // Callbacks
  onPlaceOrder: (data: {
    customer_name: string;
    customer_phone: string;
    customer_address?: string;
    note?: string;
    branch_id: string;
    payment_method: 'cod' | 'transfer';
    transfer_content?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

type Step = 'method' | 'cod_form' | 'transfer_qr';

export function PaymentFlowDialog({
  open, onClose, product, price, variant, quantity, primaryColor,
  codEnabled, transferEnabled, bankName, accountNumber, accountHolder,
  confirmZaloUrl, confirmMessengerUrl,
  branches, onPlaceOrder, isSubmitting,
}: PaymentFlowDialogProps) {
  const [step, setStep] = useState<Step>('method');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'transfer' | null>(null);

  // COD form fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [note, setNote] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(branches.length === 1 ? branches[0].id : '');
  const [attempted, setAttempted] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  // Generate transfer content
  const transferContent = useMemo(() => {
    const productCode = (product.sku || product.name || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 20)
      .toUpperCase() || 'SP';
    const phone = customerPhone.replace(/\s/g, '');
    return `${productCode}-${phone}`;
  }, [product, customerPhone]);

  // VietQR URL
  const qrUrl = useMemo(() => {
    if (!bankName || !accountNumber) return null;
    // bankName is stored as bank code (e.g., 'VCB')
    const bank = VIETNAMESE_BANKS.find(b => b.code === bankName);
    if (!bank) return null;
    return generateVietQRUrl(bank.bin, accountNumber, price * quantity, transferContent, accountHolder || undefined);
  }, [bankName, accountNumber, accountHolder, price, quantity, transferContent]);

  const bankDisplayName = useMemo(() => {
    const bank = VIETNAMESE_BANKS.find(b => b.code === bankName);
    return bank?.name || bankName || '';
  }, [bankName]);

  const handleSelectMethod = (method: 'cod' | 'transfer') => {
    setPaymentMethod(method);
    if (method === 'cod') {
      setStep('cod_form');
    } else {
      setStep('cod_form'); // Still need customer info first
    }
  };

  const handleSubmitCOD = async () => {
    setAttempted(true);
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }
    if (paymentMethod === 'cod' && !customerAddress.trim()) {
      toast.error('Vui lòng nhập địa chỉ giao hàng');
      return;
    }
    const branchId = selectedBranch || (branches.length === 1 ? branches[0].id : '');
    if (!branchId) {
      toast.error('Vui lòng chọn chi nhánh');
      return;
    }

    if (paymentMethod === 'transfer') {
      // Go to QR step
      setStep('transfer_qr');
      return;
    }

    // Place COD order
    try {
      await onPlaceOrder({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim() || undefined,
        note: note.trim() || undefined,
        branch_id: branchId,
        payment_method: 'cod',
      });
      setOrderPlaced(true);
    } catch {
      toast.error('Đặt hàng thất bại, vui lòng thử lại');
    }
  };

  const handlePlaceTransferOrder = async () => {
    const branchId = selectedBranch || (branches.length === 1 ? branches[0].id : '');
    try {
      await onPlaceOrder({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim() || undefined,
        note: note.trim() || undefined,
        branch_id: branchId,
        payment_method: 'transfer',
        transfer_content: transferContent,
      });
      setOrderPlaced(true);
    } catch {
      toast.error('Đặt hàng thất bại, vui lòng thử lại');
    }
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(transferContent);
    toast.success('Đã sao chép nội dung chuyển khoản');
  };

  const getConfirmUrl = () => {
    if (confirmZaloUrl) {
      let url = confirmZaloUrl.trim();
      if (/^\d{8,15}$/.test(url.replace(/\s/g, ''))) {
        url = `https://zalo.me/${url.replace(/\s/g, '')}`;
      } else if (!url.startsWith('http')) {
        url = `https://${url}`;
      }
      return { url, label: 'Xác nhận qua Zalo', icon: '💬' };
    }
    if (confirmMessengerUrl) {
      let url = confirmMessengerUrl.trim();
      if (!url.startsWith('http')) url = `https://${url}`;
      return { url, label: 'Xác nhận qua Messenger', icon: '💬' };
    }
    return null;
  };

  const handleClose = () => {
    setStep('method');
    setPaymentMethod(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setNote('');
    setSelectedBranch(branches.length === 1 ? branches[0].id : '');
    setAttempted(false);
    setOrderPlaced(false);
    onClose();
  };

  // If only one method available, skip selection
  const onlyOneMethod = (codEnabled && !transferEnabled) || (!codEnabled && transferEnabled);

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
          {step !== 'method' && !orderPlaced && (
            <button
              onClick={() => {
                if (step === 'transfer_qr') setStep('cod_form');
                else setStep('method');
              }}
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h2 className="font-semibold text-base flex-1">
            {orderPlaced ? 'Đặt hàng thành công' :
             step === 'method' ? 'Chọn phương thức thanh toán' :
             step === 'cod_form' ? (paymentMethod === 'cod' ? 'Thông tin nhận hàng' : 'Thông tin khách hàng') :
             'Thanh toán chuyển khoản'}
          </h2>
        </div>

        <div className="p-4 space-y-4">
          {/* Product summary */}
          {!orderPlaced && (
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
              {product.image_url && (
                <img src={product.image_url} alt="" className="h-14 w-14 rounded-lg object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-2">{product.name}</p>
                {variant && <Badge variant="outline" className="text-[10px] mt-0.5">{variant}</Badge>}
                <p className="text-sm font-bold mt-1" style={{ color: primaryColor }}>
                  {formatNumber(price * quantity)}đ
                  {quantity > 1 && <span className="text-xs font-normal text-gray-500 ml-1">x{quantity}</span>}
                </p>
              </div>
            </div>
          )}

          {/* Step 1: Method selection */}
          {step === 'method' && !orderPlaced && (
            <div className="space-y-3">
              {codEnabled && (
                <button
                  onClick={() => handleSelectMethod('cod')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-all active:scale-[0.98]"
                >
                  <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                    <Banknote className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm">Thanh toán khi nhận hàng (COD)</p>
                    <p className="text-xs text-muted-foreground">Trả tiền mặt cho shipper</p>
                  </div>
                </button>
              )}

              {transferEnabled && (
                <button
                  onClick={() => handleSelectMethod('transfer')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-all active:scale-[0.98]"
                >
                  <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <CreditCard className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm">Chuyển khoản ngân hàng</p>
                    <p className="text-xs text-muted-foreground">Quét QR hoặc chuyển khoản thủ công</p>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Step 2: Customer info form (for both COD and transfer) */}
          {step === 'cod_form' && !orderPlaced && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Họ tên <span className="text-red-500">*</span></Label>
                <Input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Nhập họ tên"
                  className={`h-11 text-base ${attempted && !customerName.trim() ? 'border-red-400' : ''}`}
                />
              </div>

              <div>
                <Label className="text-sm">Số điện thoại <span className="text-red-500">*</span></Label>
                <Input
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="Nhập số điện thoại"
                  inputMode="tel"
                  className={`h-11 text-base ${attempted && !customerPhone.trim() ? 'border-red-400' : ''}`}
                />
              </div>

              <div>
                <Label className="text-sm flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Địa chỉ giao hàng
                  {paymentMethod === 'cod' && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  value={customerAddress}
                  onChange={e => setCustomerAddress(e.target.value)}
                  placeholder="Nhập địa chỉ giao hàng"
                  className={`h-11 text-base ${attempted && paymentMethod === 'cod' && !customerAddress.trim() ? 'border-red-400' : ''}`}
                />
              </div>

              {branches.length > 1 && (
                <div>
                  <Label className="text-sm">Chi nhánh <span className="text-red-500">*</span></Label>
                  <select
                    value={selectedBranch}
                    onChange={e => setSelectedBranch(e.target.value)}
                    className={`flex h-11 w-full rounded-md border bg-white px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${attempted && !selectedBranch ? 'border-red-400' : 'border-input'}`}
                  >
                    <option value="">Chọn chi nhánh</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <Label className="text-sm">Ghi chú</Label>
                <Textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Ghi chú thêm (không bắt buộc)"
                  rows={2}
                  className="text-base"
                />
              </div>

              <Button
                className="w-full h-12 text-base font-semibold gap-2"
                style={{ backgroundColor: primaryColor }}
                onClick={handleSubmitCOD}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
                {paymentMethod === 'cod' ? 'Đặt hàng COD' : 'Tiếp tục thanh toán'}
              </Button>
            </div>
          )}

          {/* Step 3: Transfer QR */}
          {step === 'transfer_qr' && !orderPlaced && (
            <div className="space-y-4">
              {/* Product & price */}
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">Số tiền cần thanh toán</p>
                <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                  {formatNumber(price * quantity)}đ
                </p>
              </div>

              {/* QR Code */}
              {qrUrl && (
                <div className="flex justify-center">
                  <img
                    src={qrUrl}
                    alt="QR Chuyển khoản"
                    className="w-64 h-auto rounded-lg border shadow-sm"
                    loading="eager"
                  />
                </div>
              )}

              {/* Bank info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ngân hàng:</span>
                  <span className="font-medium">{bankDisplayName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Số tài khoản:</span>
                  <span className="font-medium font-mono">{accountNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chủ tài khoản:</span>
                  <span className="font-medium">{accountHolder}</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-muted-foreground">Nội dung CK:</span>
                  <div className="flex items-center gap-1.5">
                    <code className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono font-bold">
                      {transferContent}
                    </code>
                    <button onClick={handleCopyContent} className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-center text-amber-600 font-medium">
                ⚠️ Vui lòng nhập đúng nội dung chuyển khoản để shop xác nhận nhanh hơn
              </p>

              {/* Confirm button */}
              <Button
                className="w-full h-12 text-base font-semibold gap-2"
                style={{ backgroundColor: primaryColor }}
                onClick={handlePlaceTransferOrder}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                Tôi đã chuyển khoản
              </Button>

              {/* Confirm via Zalo/Messenger */}
              {(() => {
                const confirmLink = getConfirmUrl();
                if (!confirmLink) return null;
                return (
                  <p className="text-xs text-center text-muted-foreground">
                    Sau khi đặt hàng, gửi ảnh xác nhận qua{' '}
                    <a href={confirmLink.url} target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline">
                      {confirmLink.label} <ExternalLink className="h-3 w-3 inline" />
                    </a>
                  </p>
                );
              })()}
            </div>
          )}

          {/* Order success */}
          {orderPlaced && (
            <div className="text-center py-6 space-y-4">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
              <div>
                <p className="font-bold text-lg">Đặt hàng thành công!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {paymentMethod === 'transfer'
                    ? 'Shop sẽ xác nhận sau khi kiểm tra chuyển khoản.'
                    : 'Cửa hàng sẽ liên hệ bạn trong thời gian sớm nhất.'}
                </p>
              </div>

              {/* Show confirm links after transfer order */}
              {paymentMethod === 'transfer' && (() => {
                const confirmLink = getConfirmUrl();
                if (!confirmLink) return null;
                return (
                  <Button variant="outline" className="gap-2" asChild>
                    <a href={confirmLink.url} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4" />
                      Gửi ảnh xác nhận chuyển khoản
                    </a>
                  </Button>
                );
              })()}

              <Button variant="outline" className="w-full h-11" onClick={handleClose}>
                Đóng
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
