import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Star, Loader2, CheckCircle2, Phone, ShoppingCart, Trash2, Plus, Minus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePlaceLandingOrder } from '@/hooks/useLandingOrders';
import { useLandingCart, CartItem } from '@/hooks/useLandingCart';
import { formatNumber } from '@/lib/formatNumber';
import { toast } from 'sonner';
import { usePublicBlockedDates, useBulkAddBlockedDates, checkTimeConflict } from '@/hooks/useBlockedDates';
import { format, eachDayOfInterval, parseISO } from 'date-fns';

interface BranchOption { id: string; name: string; }

interface CTADialogProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  primaryColor: string;
  branches: BranchOption[];
  productName?: string;
  productId?: string;
  productImageUrl?: string | null;
  productPrice?: number;
  storePhone?: string | null;
  zaloUrl?: string | null;
  facebookUrl?: string | null;
}

// ===== CONTACT FORM DIALOG (used by: pre_order, notify_stock, get_quote, send_request, best_price, get_coupon) =====
interface ContactFormDialogProps extends CTADialogProps {
  title: string;
  description: string;
  actionLabel: string;
  requireEmail?: boolean;
  showMessage?: boolean;
  notePrefix?: string;
  actionType?: string;
  onNavigateOrderLookup?: () => void;
}

export function ContactFormDialog({
  open, onClose, tenantId, primaryColor, branches,
  productName, productId, productImageUrl, productPrice,
  title, description, actionLabel, requireEmail = true, showMessage = true, notePrefix = '', actionType = 'order',
  onNavigateOrderLookup,
}: ContactFormDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [branch, setBranch] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const placeOrder = usePlaceLandingOrder();

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) { toast.error('Vui lòng nhập họ tên và số điện thoại'); return; }
    if (requireEmail && !email.trim()) { toast.error('Vui lòng nhập email'); return; }
    if (!branch) { toast.error('Vui lòng chọn chi nhánh'); return; }
    try {
      await placeOrder.mutateAsync({
        tenant_id: tenantId,
        branch_id: branch,
        product_id: productId || 'general',
        product_name: productName || 'Yêu cầu',
        product_image_url: productImageUrl,
        product_price: productPrice || 0,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim() || undefined,
        note: [notePrefix, message.trim()].filter(Boolean).join(' - ') || undefined,
        action_type: actionType,
      });
      setSubmitted(true);
    } catch { toast.error('Gửi thất bại, vui lòng thử lại'); }
  };

  const handleClose = () => { onClose(); setTimeout(() => { setName(''); setPhone(''); setEmail(''); setMessage(''); setBranch(''); setSubmitted(false); }, 300); };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-sm">{description}</DialogDescription>
        </DialogHeader>
        {submitted ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <p className="font-semibold">Gửi thành công!</p>
            <p className="text-sm text-muted-foreground">Chúng tôi sẽ liên hệ bạn sớm nhất.</p>
            {onNavigateOrderLookup && (
              <Button
                variant="outline"
                className="w-full h-11"
                onClick={() => { handleClose(); onNavigateOrderLookup(); }}
                style={{ borderColor: primaryColor, color: primaryColor }}
              >
                <Search className="h-4 w-4 mr-1.5" /> Kiểm tra đơn hàng
              </Button>
            )}
            <Button variant="outline" onClick={handleClose} className="h-11">Đóng</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {productName && (
              <div className="text-sm bg-muted/50 rounded-lg p-2.5 font-medium">{productName}</div>
            )}
            <div>
              <Label className="text-sm">Họ tên <span className="text-destructive">*</span></Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nhập họ tên" className="h-11 text-base" />
            </div>
            <div>
              <Label className="text-sm">Số điện thoại <span className="text-destructive">*</span></Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Nhập số điện thoại" inputMode="tel" className="h-11 text-base" />
              <p className="text-xs text-muted-foreground mt-1">Nhập SĐT đã từng mua hàng để được ưu đãi</p>
            </div>
            <div>
              <Label className="text-sm">Email {requireEmail && <span className="text-destructive">*</span>}</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Nhập email" type="email" inputMode="email" className="h-11 text-base" />
              <p className="text-xs text-muted-foreground mt-1">Nhập đúng mail để nhận thông tin đơn hàng và bảo hành</p>
            </div>
            <div>
              <Label className="text-sm">Chi nhánh <span className="text-destructive">*</span></Label>
              <select value={branch} onChange={e => setBranch(e.target.value)}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base">
                <option value="">Chọn chi nhánh</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            {showMessage && (
              <div>
                <Label className="text-sm">Ghi chú</Label>
                <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Nhập nội dung..." rows={2} className="text-base" />
              </div>
            )}
            <Button className="w-full h-11 font-semibold" style={{ backgroundColor: primaryColor }} onClick={handleSubmit} disabled={placeOrder.isPending}>
              {placeOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {actionLabel}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ===== BOOKING DIALOG (with date/time) =====
interface BookingDialogProps extends CTADialogProps {
  title: string;
  requireTime?: boolean;
}

export function BookingDialog({
  open, onClose, tenantId, primaryColor, branches,
  productName, productId, productImageUrl, productPrice,
  title, requireTime = true,
}: BookingDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [branch, setBranch] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const placeOrder = usePlaceLandingOrder();
  const { data: blockedDates = [] } = usePublicBlockedDates(tenantId, productId || null);
  const blockedDateStrings = useMemo(() => new Set(blockedDates.map(b => b.blocked_date)), [blockedDates]);

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) { toast.error('Vui lòng nhập họ tên và số điện thoại'); return; }
    if (!date) { toast.error('Vui lòng chọn ngày'); return; }
    if (blockedDateStrings.has(date)) { toast.error('Ngày này đã hết chỗ, vui lòng chọn ngày khác'); return; }
    if (requireTime && !time) { toast.error('Vui lòng chọn giờ'); return; }
    if (!branch) { toast.error('Vui lòng chọn chi nhánh'); return; }
    try {
      const bookingNote = `[${title}] Ngày: ${date}${time ? ` - Giờ: ${time}` : ''}${note.trim() ? ` - ${note.trim()}` : ''}`;
      await placeOrder.mutateAsync({
        tenant_id: tenantId,
        branch_id: branch,
        product_id: productId || 'booking',
        product_name: productName || title,
        product_image_url: productImageUrl,
        product_price: productPrice || 0,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim() || undefined,
        note: bookingNote,
        action_type: 'booking',
        action_date: date,
        action_time: time || undefined,
      });
      setSubmitted(true);
    } catch { toast.error('Đặt lịch thất bại, vui lòng thử lại'); }
  };

  const handleClose = () => { onClose(); setTimeout(() => { setName(''); setPhone(''); setEmail(''); setDate(''); setTime(''); setNote(''); setBranch(''); setSubmitted(false); }, 300); };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-sm">Chọn ngày giờ phù hợp để đặt lịch</DialogDescription>
        </DialogHeader>
        {submitted ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <p className="font-semibold">Đặt lịch thành công!</p>
            <p className="text-sm text-muted-foreground">Chúng tôi sẽ xác nhận với bạn sớm nhất.</p>
            <Button variant="outline" onClick={handleClose} className="h-11">Đóng</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {productName && <div className="text-sm bg-muted/50 rounded-lg p-2.5 font-medium">{productName}</div>}
            <div>
              <Label className="text-sm">Họ tên <span className="text-destructive">*</span></Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nhập họ tên" className="h-11 text-base" />
            </div>
            <div>
              <Label className="text-sm">Số điện thoại <span className="text-destructive">*</span></Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Nhập số điện thoại" inputMode="tel" className="h-11 text-base" />
              <p className="text-xs text-muted-foreground mt-1">Nhập SĐT đã từng mua hàng để được ưu đãi</p>
            </div>
            <div>
              <Label className="text-sm">Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Nhập email" type="email" className="h-11 text-base" />
              <p className="text-xs text-muted-foreground mt-1">Nhập đúng mail để nhận thông tin đơn hàng và bảo hành</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm">Ngày <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={date}
                  onChange={e => {
                    const v = e.target.value;
                    if (blockedDateStrings.has(v)) {
                      toast.error('Ngày này đã hết chỗ');
                      return;
                    }
                    setDate(v);
                  }}
                  className={`h-11 text-base ${date && blockedDateStrings.has(date) ? 'border-destructive' : ''}`}
                  min={new Date().toISOString().split('T')[0]}
                />
                {blockedDates.length > 0 && (
                  <p className="text-xs text-destructive mt-1">
                    Các ngày đã hết: {blockedDates.slice(0, 5).map(d => {
                      const parts = d.blocked_date.split('-');
                      return `${parts[2]}/${parts[1]}`;
                    }).join(', ')}{blockedDates.length > 5 ? '...' : ''}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-sm">Giờ {requireTime && <span className="text-destructive">*</span>}</Label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} className="h-11 text-base" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Chi nhánh <span className="text-destructive">*</span></Label>
              <select value={branch} onChange={e => setBranch(e.target.value)}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base">
                <option value="">Chọn chi nhánh</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-sm">Ghi chú</Label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..." rows={2} className="text-base" />
            </div>
            <Button className="w-full h-11 font-semibold" style={{ backgroundColor: primaryColor }} onClick={handleSubmit} disabled={placeOrder.isPending}>
              {placeOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Xác nhận đặt lịch
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ===== HOTEL BOOKING DIALOG (date range + check-in/out times) =====
interface HotelBookingDialogProps extends CTADialogProps {
  title?: string;
}

export function HotelBookingDialog({
  open, onClose, tenantId, primaryColor, branches,
  productName, productId, productImageUrl, productPrice,
  title = '🏨 Đặt phòng',
}: HotelBookingDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [note, setNote] = useState('');
  const [branch, setBranch] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const placeOrder = usePlaceLandingOrder();
  const bulkBlock = useBulkAddBlockedDates();
  const { data: blockedDates = [] } = usePublicBlockedDates(tenantId, productId || null);

  // Calculate nights
  const nights = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 0;
    const diff = (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.round(diff));
  }, [checkInDate, checkOutDate]);

  // Check time-based conflicts for each date in range (with 2h cleaning buffer)
  const rangeConflictInfo = useMemo(() => {
    if (!checkInDate || !checkOutDate || nights <= 0) return { hasConflict: false, message: '' };
    try {
      const days = eachDayOfInterval({ start: parseISO(checkInDate), end: parseISO(checkOutDate) });
      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const isFirstDay = dateStr === checkInDate;
        const isLastDay = dateStr === checkOutDate;
        // On check-in day, use the check-in time; on check-out day use checkout time; middle days are full
        const dayCheckIn = isFirstDay ? checkInTime : '00:00';
        const dayCheckOut = isLastDay ? checkOutTime : '23:59';
        const result = checkTimeConflict(blockedDates, dateStr, dayCheckIn, dayCheckOut);
        if (result.hasConflict) {
          return { hasConflict: true, message: `📅 Ngày ${dateStr.split('-').reverse().slice(0,2).join('/')}: ${result.message}` };
        }
      }
    } catch { return { hasConflict: false, message: '' }; }
    return { hasConflict: false, message: '' };
  }, [checkInDate, checkOutDate, checkInTime, checkOutTime, nights, blockedDates]);

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) { toast.error('Vui lòng nhập họ tên và số điện thoại'); return; }
    if (!checkInDate || !checkOutDate) { toast.error('Vui lòng chọn ngày nhận & trả phòng'); return; }
    if (nights <= 0) { toast.error('Ngày trả phòng phải sau ngày nhận phòng'); return; }
    if (rangeConflict) { toast.error('Khoảng thời gian này có ngày đã được đặt, vui lòng chọn ngày khác'); return; }
    if (!branch) { toast.error('Vui lòng chọn chi nhánh'); return; }
    try {
      const bookingNote = `[${title}] Check-in: ${checkInDate} ${checkInTime} | Check-out: ${checkOutDate} ${checkOutTime} | ${nights} đêm${note.trim() ? ` | Ghi chú: ${note.trim()}` : ''}`;
      await placeOrder.mutateAsync({
        tenant_id: tenantId,
        branch_id: branch,
        product_id: productId || 'booking',
        product_name: productName || title,
        product_image_url: productImageUrl,
        product_price: productPrice || 0,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim() || undefined,
        note: bookingNote,
        action_type: 'booking',
        action_date: checkInDate,
        action_time: checkInTime,
      });

      // Auto-block the date range
      if (productId) {
        try {
          const days = eachDayOfInterval({ start: parseISO(checkInDate), end: parseISO(checkOutDate) });
          const dateStrings = days.map(d => format(d, 'yyyy-MM-dd'));
          await bulkBlock.mutateAsync({
            tenantId,
            productId,
            dates: dateStrings,
            note: `Đặt bởi ${name.trim()} - ${phone.trim()}`,
          });
        } catch (e) {
          console.warn('Auto-block dates failed:', e);
        }
      }

      setSubmitted(true);
    } catch { toast.error('Đặt phòng thất bại, vui lòng thử lại'); }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setName(''); setPhone(''); setEmail('');
      setCheckInDate(''); setCheckOutDate('');
      setCheckInTime('14:00'); setCheckOutTime('12:00');
      setNote(''); setBranch(''); setSubmitted(false);
    }, 300);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-sm">Chọn ngày nhận phòng và trả phòng</DialogDescription>
        </DialogHeader>
        {submitted ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <p className="font-semibold">Đặt phòng thành công!</p>
            <p className="text-sm text-muted-foreground">Chúng tôi sẽ xác nhận với bạn sớm nhất.</p>
            <Button variant="outline" onClick={handleClose} className="h-11">Đóng</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {productName && <div className="text-sm bg-muted/50 rounded-lg p-2.5 font-medium">{productName}</div>}
            <div>
              <Label className="text-sm">Họ tên <span className="text-destructive">*</span></Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nhập họ tên" className="h-11 text-base" />
            </div>
            <div>
              <Label className="text-sm">Số điện thoại <span className="text-destructive">*</span></Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Nhập số điện thoại" inputMode="tel" className="h-11 text-base" />
            </div>
            <div>
              <Label className="text-sm">Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Nhập email" type="email" className="h-11 text-base" />
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm">Ngày nhận phòng <span className="text-destructive">*</span></Label>
                <Input
                  type="date" value={checkInDate}
                  onChange={e => {
                    const v = e.target.value;
                    if (blockedDateSet.has(v)) { toast.error('Ngày này đã có khách đặt'); return; }
                    setCheckInDate(v);
                    if (checkOutDate && v >= checkOutDate) setCheckOutDate('');
                  }}
                  min={today}
                  className="h-11 text-base"
                />
              </div>
              <div>
                <Label className="text-sm">Ngày trả phòng <span className="text-destructive">*</span></Label>
                <Input
                  type="date" value={checkOutDate}
                  onChange={e => {
                    const v = e.target.value;
                    if (blockedDateSet.has(v)) { toast.error('Ngày này đã có khách đặt'); return; }
                    setCheckOutDate(v);
                  }}
                  min={checkInDate || today}
                  className="h-11 text-base"
                />
              </div>
            </div>

            {/* Blocked dates warning */}
            {blockedDates.length > 0 && (
              <p className="text-xs text-destructive">
                📅 Ngày đã có khách: {blockedDates.slice(0, 6).map(d => {
                  const p = d.split('-');
                  return `${p[2]}/${p[1]}`;
                }).join(', ')}{blockedDates.length > 6 ? '...' : ''}
              </p>
            )}

            {/* Range conflict warning */}
            {rangeConflict && (
              <div className="text-xs text-destructive bg-destructive/10 rounded-md p-2 font-medium">
                ⚠️ Khoảng ngày bạn chọn có ngày đã được đặt. Vui lòng chọn ngày khác.
              </div>
            )}

            {/* Nights info */}
            {nights > 0 && !rangeConflict && (
              <div className="text-sm bg-muted/50 rounded-md p-2 font-medium text-center">
                🌙 {nights} đêm {productPrice ? `· Tổng: ${(productPrice * nights).toLocaleString('vi-VN')}₫` : ''}
              </div>
            )}

            {/* Check-in / Check-out times */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm">Giờ nhận phòng</Label>
                <Input type="time" value={checkInTime} onChange={e => setCheckInTime(e.target.value)} className="h-11 text-base" />
              </div>
              <div>
                <Label className="text-sm">Giờ trả phòng</Label>
                <Input type="time" value={checkOutTime} onChange={e => setCheckOutTime(e.target.value)} className="h-11 text-base" />
              </div>
            </div>

            <div>
              <Label className="text-sm">Chi nhánh <span className="text-destructive">*</span></Label>
              <select value={branch} onChange={e => setBranch(e.target.value)}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base">
                <option value="">Chọn chi nhánh</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-sm">Ghi chú</Label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Yêu cầu đặc biệt..." rows={2} className="text-base" />
            </div>
            <Button className="w-full h-11 font-semibold" style={{ backgroundColor: primaryColor }} onClick={handleSubmit} disabled={placeOrder.isPending || rangeConflict}>
              {placeOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Xác nhận đặt phòng {nights > 0 ? `(${nights} đêm)` : ''}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ===== TRACK ORDER DIALOG =====
export function TrackOrderDialog({ open, onClose, tenantId, primaryColor }: CTADialogProps) {
  const [orderCode, setOrderCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async () => {
    if (!orderCode.trim()) { toast.error('Vui lòng nhập mã đơn hàng'); return; }
    setLoading(true); setNotFound(false); setResult(null);
    try {
      const { data, error } = await supabase
        .from('landing_orders')
        .select('order_code, product_name, product_price, status, customer_name, created_at, variant, quantity')
        .eq('tenant_id', tenantId)
        .eq('order_code', orderCode.trim().toUpperCase().startsWith('#') ? orderCode.trim().toUpperCase() : `#${orderCode.trim().toUpperCase()}`)
        .maybeSingle();
      if (error) throw error;
      if (data) setResult(data); else setNotFound(true);
    } catch { toast.error('Lỗi tra cứu'); }
    setLoading(false);
  };

  const statusMap: Record<string, string> = { pending: '⏳ Chờ xử lý', approved: '✅ Đã duyệt', cancelled: '❌ Đã hủy' };
  const handleClose = () => { onClose(); setTimeout(() => { setOrderCode(''); setResult(null); setNotFound(false); }, 300); };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-base">📦 Tra cứu đơn hàng</DialogTitle>
          <DialogDescription className="text-sm">Nhập mã đơn hàng để kiểm tra trạng thái</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={orderCode} onChange={e => setOrderCode(e.target.value)} placeholder="Nhập mã đơn (VD: #000001)" className="h-11 text-base flex-1"
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            <Button className="h-11 px-4" style={{ backgroundColor: primaryColor }} onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tra cứu'}
            </Button>
          </div>
          {notFound && <p className="text-sm text-destructive text-center py-4">Không tìm thấy đơn hàng với mã này.</p>}
          {result && (
            <div className="border rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Mã đơn:</span><span className="font-semibold">{result.order_code}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sản phẩm:</span><span className="font-medium text-right max-w-[60%] truncate">{result.product_name}</span></div>
              {result.variant && <div className="flex justify-between"><span className="text-muted-foreground">Phiên bản:</span><span>{result.variant}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Giá:</span><span className="font-semibold" style={{ color: primaryColor }}>{formatNumber(result.product_price)}đ</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Trạng thái:</span><span className="font-medium">{statusMap[result.status] || result.status}</span></div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== CHECK WARRANTY DIALOG =====
export function CheckWarrantyDialog({ open, onClose, tenantId, primaryColor }: CTADialogProps) {
  const [imei, setImei] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!imei.trim()) { toast.error('Vui lòng nhập IMEI hoặc mã sản phẩm'); return; }
    setLoading(true); setResults([]); setSearched(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('name, imei, status, warranty_months, import_date, branch_id')
        .eq('tenant_id', tenantId)
        .eq('imei', imei.trim());
      if (error) throw error;
      setResults(data || []);
    } catch { toast.error('Lỗi tra cứu'); }
    setLoading(false);
  };

  const handleClose = () => { onClose(); setTimeout(() => { setImei(''); setResults([]); setSearched(false); }, 300); };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-base">🛡️ Kiểm tra bảo hành</DialogTitle>
          <DialogDescription className="text-sm">Nhập IMEI hoặc mã sản phẩm</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={imei} onChange={e => setImei(e.target.value)} placeholder="Nhập số IMEI / mã SP" className="h-11 text-base flex-1"
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            <Button className="h-11 px-4" style={{ backgroundColor: primaryColor }} onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tra cứu'}
            </Button>
          </div>
          {searched && results.length === 0 && !loading && (
            <p className="text-sm text-destructive text-center py-4">Không tìm thấy sản phẩm với mã này.</p>
          )}
          {results.map((p, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Sản phẩm:</span><span className="font-medium text-right max-w-[60%] truncate">{p.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">IMEI:</span><span className="font-mono text-xs">{p.imei}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Trạng thái:</span><span className="font-medium">{p.status === 'in_stock' ? '📦 Trong kho' : p.status === 'sold' ? '✅ Đã bán' : p.status === 'warranty' ? '🔧 Bảo hành' : p.status}</span></div>
              {p.warranty_months && <div className="flex justify-between"><span className="text-muted-foreground">Bảo hành:</span><span>{p.warranty_months} tháng</span></div>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== WRITE REVIEW DIALOG =====
export function WriteReviewDialog({ open, onClose, tenantId, primaryColor, productName, productId }: CTADialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) { toast.error('Vui lòng nhập họ tên và số điện thoại'); return; }
    if (!email.trim()) { toast.error('Vui lòng nhập email'); return; }
    setLoading(true);
    try {
      // Create/find customer first, then create review via landing_orders as a review-type entry
      const { error } = await supabase
        .from('landing_orders')
        .insert({
          tenant_id: tenantId,
          product_id: productId || 'review',
          product_name: productName || 'Đánh giá',
          product_price: 0,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_email: email.trim(),
          note: `[Đánh giá ${rating}⭐] ${content.trim()}`,
          status: 'pending',
          branch_id: null as any, // will use default
        });
      if (error) throw error;
      setSubmitted(true);
      toast.success('Cảm ơn bạn đã đánh giá!');
    } catch { toast.error('Gửi đánh giá thất bại'); }
    setLoading(false);
  };

  const handleClose = () => { onClose(); setTimeout(() => { setName(''); setPhone(''); setEmail(''); setRating(5); setContent(''); setSubmitted(false); }, 300); };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">✍️ Đánh giá sản phẩm</DialogTitle>
          <DialogDescription className="text-sm">{productName}</DialogDescription>
        </DialogHeader>
        {submitted ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <p className="font-semibold">Cảm ơn bạn!</p>
            <p className="text-sm text-muted-foreground">Đánh giá của bạn đã được ghi nhận.</p>
            <Button variant="outline" onClick={handleClose} className="h-11">Đóng</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-1 justify-center py-2">
              {[1, 2, 3, 4, 5].map(i => (
                <button key={i} onClick={() => setRating(i)} className="p-1 transition-transform active:scale-110">
                  <Star className={`h-8 w-8 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                </button>
              ))}
            </div>
            <div>
              <Label className="text-sm">Họ tên <span className="text-destructive">*</span></Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nhập họ tên" className="h-11 text-base" />
            </div>
            <div>
              <Label className="text-sm">Số điện thoại <span className="text-destructive">*</span></Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Nhập số điện thoại" inputMode="tel" className="h-11 text-base" />
              <p className="text-xs text-muted-foreground mt-1">Nhập SĐT đã từng mua hàng để được ưu đãi</p>
            </div>
            <div>
              <Label className="text-sm">Email <span className="text-destructive">*</span></Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Nhập email" type="email" className="h-11 text-base" />
              <p className="text-xs text-muted-foreground mt-1">Nhập đúng mail để nhận thông tin đơn hàng và bảo hành</p>
            </div>
            <div>
              <Label className="text-sm">Nội dung đánh giá</Label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Chia sẻ trải nghiệm của bạn..." rows={3} className="text-base" />
            </div>
            <Button className="w-full h-11 font-semibold" style={{ backgroundColor: primaryColor }} onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gửi đánh giá'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ===== SUPPORT DIALOG (shows contact options) =====
export function SupportDialog({ open, onClose, primaryColor, storePhone, zaloUrl, facebookUrl }: CTADialogProps) {
  const contactOptions = [
    storePhone && { icon: '📞', label: 'Gọi điện', description: storePhone, href: `tel:${storePhone}` },
    zaloUrl && { icon: '💬', label: 'Nhắn Zalo', description: 'Chat trực tiếp', href: zaloUrl.startsWith('http') ? zaloUrl : `https://${zaloUrl}` },
    facebookUrl && { icon: '💬', label: 'Facebook Messenger', description: 'Nhắn tin', href: facebookUrl.startsWith('http') ? facebookUrl : `https://${facebookUrl}` },
  ].filter(Boolean) as { icon: string; label: string; description: string; href: string }[];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-base">🛟 Yêu cầu hỗ trợ</DialogTitle>
          <DialogDescription className="text-sm">Chọn kênh liên hệ phù hợp</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {contactOptions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Chưa cấu hình kênh liên hệ.</p>}
          {contactOptions.map((opt, i) => (
            <a key={i} href={opt.href} target={opt.href.startsWith('tel:') ? undefined : '_blank'} rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
              <span className="text-xl">{opt.icon}</span>
              <div>
                <p className="font-medium text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </a>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== CART DRAWER DIALOG =====
interface CartDialogProps extends CTADialogProps {
  onCheckout: () => void;
}

export function CartDialog({ open, onClose, primaryColor, onCheckout }: CartDialogProps) {
  const cart = useLandingCart();

  if (cart.items.length === 0) {
    return (
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base">🛒 Giỏ hàng</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Giỏ hàng trống</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">🛒 Giỏ hàng ({cart.totalItems})</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {cart.items.map((item, i) => (
            <div key={`${item.productId}-${item.variant || ''}-${i}`} className="flex gap-3 border rounded-lg p-2.5">
              {item.productImageUrl && <img src={item.productImageUrl} alt="" className="h-16 w-16 rounded-md object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-2">{item.productName}</p>
                {item.variant && <p className="text-xs text-muted-foreground">{item.variant}</p>}
                <p className="text-sm font-bold mt-1" style={{ color: primaryColor }}>{formatNumber(item.price)}đ</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <button onClick={() => cart.updateQuantity(item.productId, item.variant, item.quantity - 1)} className="h-7 w-7 rounded-md border flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                  <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                  <button onClick={() => cart.updateQuantity(item.productId, item.variant, item.quantity + 1)} className="h-7 w-7 rounded-md border flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                  <button onClick={() => cart.removeItem(item.productId, item.variant)} className="ml-auto h-7 w-7 rounded-md text-destructive flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-semibold">Tổng cộng:</span>
            <span className="text-lg font-bold" style={{ color: primaryColor }}>{formatNumber(cart.totalPrice)}đ</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-11" onClick={() => cart.clearCart()}>Xóa tất cả</Button>
            <Button className="flex-1 h-11 font-semibold" style={{ backgroundColor: primaryColor }} onClick={() => { onClose(); onCheckout(); }}>
              Thanh toán ({cart.totalItems})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== PROMOTION INFO DIALOG (for today_offer, today_gift, hot_deal) =====
export function PromotionInfoDialog({ open, onClose, title, productName }: { open: boolean; onClose: () => void; title: string; productName?: string }) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">
            {productName ? `Thông tin ưu đãi cho "${productName}" sẽ được cập nhật.` : 'Hiện chưa có chương trình ưu đãi nào.'}
          </p>
          <p className="text-xs text-muted-foreground mt-2">Vui lòng liên hệ cửa hàng để biết thêm chi tiết.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== JOIN MEMBER DIALOG =====
interface JoinMemberDialogProps extends CTADialogProps {
  groupUrl: string; // required: Zalo or Facebook group link
}

export function JoinMemberDialog({
  open, onClose, tenantId, primaryColor, branches,
  productName, groupUrl,
}: JoinMemberDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [branch, setBranch] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const placeOrder = usePlaceLandingOrder();

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) { toast.error('Vui lòng nhập họ tên và số điện thoại'); return; }
    if (!email.trim()) { toast.error('Vui lòng nhập email'); return; }
    if (!branch && branches.length > 0) { toast.error('Vui lòng chọn chi nhánh'); return; }
    try {
      await placeOrder.mutateAsync({
        tenant_id: tenantId,
        branch_id: branch || branches[0]?.id || '',
        product_id: 'join_member',
        product_name: 'Đăng ký thành viên',
        product_image_url: null,
        product_price: 0,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim(),
        note: `Đăng ký thành viên${productName ? ` - SP: ${productName}` : ''}`,
        action_type: 'join_member',
      });
      setSubmitted(true);
    } catch { toast.error('Gửi thất bại, vui lòng thử lại'); }
  };

  const handleClose = () => { onClose(); setTimeout(() => { setName(''); setPhone(''); setEmail(''); setBranch(''); setSubmitted(false); }, 300); };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">👤 Tham gia thành viên</DialogTitle>
          <DialogDescription className="text-sm">Đăng ký để nhận ưu đãi dành riêng cho thành viên</DialogDescription>
        </DialogHeader>
        {submitted ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <p className="font-semibold">Đăng ký thành công!</p>
            <p className="text-sm text-muted-foreground">Tham gia nhóm để nhận thông tin ưu đãi mới nhất:</p>
            <Button className="w-full h-11 font-semibold gap-2" style={{ backgroundColor: primaryColor }} asChild>
              <a href={groupUrl} target="_blank" rel="noopener noreferrer">
                {groupUrl.includes('zalo') ? '💬 Tham gia nhóm Zalo' : groupUrl.includes('facebook') || groupUrl.includes('fb.') ? '👥 Tham gia nhóm Facebook' : '🔗 Tham gia nhóm'}
              </a>
            </Button>
            <Button variant="outline" onClick={handleClose} className="h-9 text-sm">Đóng</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Họ tên <span className="text-destructive">*</span></Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nhập họ tên" className="h-11 text-base" />
            </div>
            <div>
              <Label className="text-sm">Số điện thoại <span className="text-destructive">*</span></Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Nhập số điện thoại" inputMode="tel" className="h-11 text-base" />
              <p className="text-xs text-muted-foreground mt-1">Nhập SĐT đã từng mua hàng để được ưu đãi</p>
            </div>
            <div>
              <Label className="text-sm">Email <span className="text-destructive">*</span></Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Nhập email" type="email" inputMode="email" className="h-11 text-base" />
              <p className="text-xs text-muted-foreground mt-1">Nhập đúng mail để nhận thông tin đơn hàng và bảo hành</p>
            </div>
            {branches.length > 1 && (
              <div>
                <Label className="text-sm">Chi nhánh</Label>
                <select value={branch} onChange={e => setBranch(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base">
                  <option value="">Chọn chi nhánh</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <Button className="w-full h-11 font-semibold" style={{ backgroundColor: primaryColor }} onClick={handleSubmit} disabled={placeOrder.isPending}>
              {placeOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Đăng ký thành viên
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
