import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Gift, Loader2, Copy, CheckCircle2, Ticket, X } from 'lucide-react';
import { toast } from 'sonner';
import { useClaimWebsiteVoucher } from '@/hooks/useVouchers';
import { formatNumber } from '@/lib/formatNumber';

interface VoucherClaimFormProps {
  tenantId: string;
  branches: { id: string; name: string }[];
  primaryColor: string;
}

export function VoucherClaimForm({ tenantId, branches, primaryColor }: VoucherClaimFormProps) {
  const [dialogOpen, setDialogOpen] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [branchId, setBranchId] = useState('');
  const [result, setResult] = useState<{
    code: string;
    voucher_name: string;
    discount_type: string;
    discount_value: number;
    already_claimed: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const claim = useClaimWebsiteVoucher();

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !email.trim()) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    const phoneClean = phone.replace(/\s/g, '');
    if (!/^0\d{9,10}$/.test(phoneClean)) {
      toast.error('Số điện thoại không hợp lệ');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Email không hợp lệ');
      return;
    }

    try {
      const data = await claim.mutateAsync({
        tenant_id: tenantId,
        customer_name: name.trim(),
        customer_phone: phoneClean,
        customer_email: email.trim(),
        branch_id: branchId || undefined,
      });
      setResult(data);
      if (data.already_claimed) {
        toast.info('Mỗi số điện thoại chỉ được nhận 1 lần!');
      } else {
        toast.success('Nhận voucher thành công!');
      }
    } catch (err: any) {
      toast.error('Không thể nhận voucher. Vui lòng thử lại.');
    }
  };

  const handleCopy = () => {
    if (result?.code) {
      navigator.clipboard.writeText(result.code);
      setCopied(true);
      toast.success('Đã copy mã voucher');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {/* Dialog - auto open */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          {result ? (
            <div className="text-center space-y-4 py-2">
              <div className="p-3 rounded-full inline-flex" style={{ backgroundColor: `${primaryColor}15` }}>
                <CheckCircle2 className="h-10 w-10" style={{ color: primaryColor }} />
              </div>
              <div>
                <h3 className="font-bold text-lg">
                  {result.already_claimed ? 'Voucher của bạn' : '🎉 Chúc mừng!'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{result.voucher_name}</p>
                {result.already_claimed && (
                  <p className="text-xs text-orange-600 mt-1">Mỗi SĐT chỉ được nhận 1 lần</p>
                )}
              </div>
              <div className="bg-muted rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Mã voucher</p>
                <p className="text-2xl font-mono font-bold tracking-widest" style={{ color: primaryColor }}>{result.code}</p>
                <p className="text-sm font-semibold mt-2">
                  Giảm {result.discount_type === 'percentage' ? `${result.discount_value}%` : `${formatNumber(result.discount_value)}đ`}
                </p>
              </div>
              <Button onClick={handleCopy} className="gap-2 w-full" style={{ backgroundColor: primaryColor }}>
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Đã copy!' : 'Copy mã voucher'}
              </Button>
              <p className="text-xs text-muted-foreground">
                📸 Hãy copy hoặc chụp lại mã để sử dụng khi mua hàng
              </p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${primaryColor}15` }}>
                    <Gift className="h-4 w-4" style={{ color: primaryColor }} />
                  </div>
                  Nhận Voucher miễn phí
                </DialogTitle>
                <DialogDescription>
                  Điền thông tin để nhận voucher ưu đãi. Mỗi số điện thoại chỉ nhận được 1 lần.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs">Họ tên <span className="text-destructive">*</span></Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nhập họ tên" className="h-10" />
                </div>
                <div>
                  <Label className="text-xs">Số điện thoại <span className="text-destructive">*</span></Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Nhập SĐT" inputMode="tel" className="h-10" />
                </div>
                <div>
                  <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
                  <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Nhập email" inputMode="email" type="email" className="h-10" />
                </div>
                {branches.length > 1 && (
                  <div>
                    <Label className="text-xs">Chi nhánh</Label>
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Chọn chi nhánh" /></SelectTrigger>
                      <SelectContent>
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button
                  className="w-full gap-2 h-11"
                  style={{ backgroundColor: primaryColor }}
                  onClick={handleSubmit}
                  disabled={claim.isPending}
                >
                  {claim.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                  Nhận Voucher ngay
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
