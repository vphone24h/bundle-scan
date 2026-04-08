import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PriceInput } from '@/components/ui/price-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CreditCard, Banknote, CheckCircle, Printer, Wallet, Mail, Loader2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePlatformUser } from '@/hooks/useTenant';
import { useQueryClient } from '@tanstack/react-query';
import { RepairOrder, RepairOrderItem, useUpdateRepairOrder, REPAIR_STATUS_MAP } from '@/hooks/useRepairOrders';
import { formatNumber } from '@/lib/formatNumber';
import { AutoEmailToggle } from '@/components/shared/AutoEmailToggle';
import { useStaffList } from '@/hooks/useCRM';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: RepairOrder;
  items: RepairOrderItem[];
}

type PaymentMethod = 'cash' | 'bank_card' | 'e_wallet' | 'debt';

export function RepairCheckoutDialog({ open, onOpenChange, order, items }: Props) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: platformUser } = usePlatformUser();
  const tenantId = platformUser?.tenant_id || '';
  const queryClient = useQueryClient();
  const updateOrder = useUpdateRepairOrder();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmount, setPaidAmount] = useState(order.total_amount);
  const [note, setNote] = useState(order.note || '');
  const [warranty, setWarranty] = useState('1 Tháng');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [createdReceiptCode, setCreatedReceiptCode] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [autoEmailEnabled, setAutoEmailEnabled] = useState(true);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [handoverStaffId, setHandoverStaffId] = useState<string>('');
  const { data: staffList } = useStaffList();

  // Fetch customer email on mount
  React.useEffect(() => {
    if (order.customer_id) {
      supabase.from('customers').select('email').eq('id', order.customer_id).maybeSingle()
        .then(({ data }) => setCustomerEmail(data?.email || null));
    }
  }, [order.customer_id]);

  const totalAmount = order.total_amount;
  const debtAmount = paymentMethod === 'debt' ? totalAmount : Math.max(0, totalAmount - paidAmount);

  // Calculate profit
  // Service items: 100% profit (no cost)
  // Part items: sale_price - cost_price
  const serviceProfit = items
    .filter(i => i.item_type === 'service')
    .reduce((s, i) => s + i.total_price, 0);
  const partsProfit = items
    .filter(i => i.item_type === 'part')
    .reduce((s, i) => s + (i.unit_price - i.cost_price) * i.quantity, 0);
  const totalProfit = serviceProfit + partsProfit;

  const handleCheckout = async () => {
    if (!totalAmount || totalAmount <= 0) {
      toast.error('Tổng tiền phải lớn hơn 0');
      return;
    }
    if (!handoverStaffId) {
      toast.error('Vui lòng chọn nhân viên bàn giao');
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate receipt code
      const date = new Date();
      const code = `SC-XH${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;

      // Create export receipt linked to repair order
      const actualPaid = paymentMethod === 'debt' ? 0 : paidAmount;
      const actualDebt = paymentMethod === 'debt' ? totalAmount : debtAmount;

      const { data: receipt, error: receiptError } = await supabase
        .from('export_receipts')
        .insert({
          code,
          customer_id: order.customer_id,
          branch_id: order.branch_id,
          total_amount: totalAmount,
          paid_amount: actualPaid,
          debt_amount: actualDebt,
          original_debt_amount: actualDebt,
          status: 'completed',
          note: `Phiếu sửa chữa ${order.code}${note ? ` - ${note}` : ''}`,
          created_by: user?.id,
          sales_staff_id: user?.id,
          tenant_id: tenantId,
          repair_order_id: order.id,
          is_repair: true,
        } as any)
        .select()
        .single();

      if (receiptError) throw receiptError;

      // Insert export receipt items (from repair items)
      // Use per-item warranty if set, otherwise fallback to global warranty
      const receiptItems = items.map(item => ({
        receipt_id: receipt.id,
        product_id: item.product_id,
        product_name: item.product_name || item.description || 'Dịch vụ sửa chữa',
        sku: item.product_sku || order.code,
        imei: item.product_imei || null,
        category_id: null,
        sale_price: item.unit_price,
        quantity: item.quantity,
        unit: 'cái',
        note: item.note || (item.item_type === 'service' ? `DV: ${item.description || ''}` : `LK: ${item.product_name || ''}`),
        warranty: item.warranty || (item.item_type === 'part' ? warranty : null),
      }));

      const { error: itemsError } = await supabase
        .from('export_receipt_items')
        .insert(receiptItems);
      if (itemsError) throw itemsError;

      // === Trừ tồn kho cho linh kiện ===
      const partItems = items.filter(i => i.item_type === 'part' && i.product_id);
      for (const item of partItems) {
        // Lấy thông tin sản phẩm hiện tại
        const { data: prod } = await supabase
          .from('products')
          .select('id, imei, quantity, status')
          .eq('id', item.product_id!)
          .single();

        if (prod) {
          if (prod.imei) {
            // Hàng IMEI: đổi trạng thái sang sold
            await supabase.from('products').update({
              status: 'sold',
              quantity: 0,
            }).eq('id', prod.id);
          } else {
            // Hàng không IMEI: trừ số lượng
            const newQty = Math.max(0, (prod.quantity || 0) - (item.quantity || 1));
            await supabase.from('products').update({
              quantity: newQty,
              total_import_cost: newQty > 0
                ? Math.round(((prod as any).total_import_cost || 0) * newQty / Math.max(1, prod.quantity || 1))
                : 0,
            }).eq('id', prod.id);
          }
        }
      }

      // Insert payment record
      if (actualPaid > 0) {
        await supabase.from('export_receipt_payments').insert({
          receipt_id: receipt.id,
          payment_type: paymentMethod,
          amount: actualPaid,
        });
      }
      if (actualDebt > 0) {
        await supabase.from('export_receipt_payments').insert({
          receipt_id: receipt.id,
          payment_type: 'debt',
          amount: actualDebt,
        });

        // Create debt record
        if (order.customer_id) {
          await supabase.from('debt_payments').insert({
            entity_id: order.customer_id,
            entity_type: 'customer',
            payment_type: 'new_debt',
            amount: actualDebt,
            description: `Nợ từ sửa chữa ${order.code}`,
            tenant_id: tenantId,
            created_by: user?.id,
            branch_id: order.branch_id,
          } as any);
        }
      }

      // Record in cash book (only paid amount, not debt)
      if (actualPaid > 0) {
        await supabase.from('cash_book').insert({
          type: 'income',
          amount: actualPaid,
          category: 'Sửa chữa',
          description: `Thu tiền sửa chữa ${order.code} - ${order.device_name}`,
          payment_source: paymentMethod === 'cash' ? 'cash' : paymentMethod === 'bank_card' ? 'bank' : 'e_wallet',
          tenant_id: tenantId,
          branch_id: order.branch_id,
          created_by: user?.id,
          created_by_name: profile?.display_name,
          reference_id: receipt.id,
          reference_type: 'repair',
          is_business_accounting: false,
        } as any);
      }

      // Update repair order status to returned
      await updateOrder.mutateAsync({
        id: order.id,
        status: 'returned',
        export_receipt_id: receipt.id,
      } as any);

      // Log status change
      await supabase.from('repair_status_history').insert({
        repair_order_id: order.id,
        tenant_id: tenantId,
        old_status: order.status,
        new_status: 'returned',
        changed_by: user?.id,
        changed_by_name: profile?.display_name,
        note: `Trả khách & Thanh toán - ${code}`,
      } as any);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['repair-orders'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      queryClient.removeQueries({ queryKey: ['cash-book'] });
      queryClient.removeQueries({ queryKey: ['cash-book-balances'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['all-products'] });

      // Auto send email (like sales module) - only if toggle enabled
      if (autoEmailEnabled && order.customer_id && customerEmail) {
        supabase.functions.invoke('send-export-email', {
          body: {
            tenant_id: tenantId,
            order_id: receipt.id,
            customer_name: order.customer_name || 'Khách lẻ',
            customer_email: customerEmail,
            customer_phone: order.customer_phone || '',
            items: items.map(item => ({
              product_name: item.product_name || item.description || 'Dịch vụ',
              imei: item.product_imei,
              sale_price: item.unit_price,
              quantity: item.quantity,
              warranty: item.warranty || warranty,
            })),
            total_amount: totalAmount,
            receipt_code: code,
            branch_id: order.branch_id,
            export_date: new Date().toISOString(),
            sales_staff_id: user?.id,
          },
        }).then(({ error }) => {
          if (error) console.warn('Repair email failed:', error.message);
        }).catch(() => {});
      }

      setCreatedReceiptCode(code);
      setIsDone(true);
      toast.success('Thanh toán thành công!');
    } catch (err: any) {
      toast.error('Lỗi thanh toán: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!order.customer_id) return;
    setSendingEmail(true);
    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('email')
        .eq('id', order.customer_id)
        .maybeSingle();

      if (!customer?.email) {
        toast.error('Khách hàng chưa có email');
        return;
      }

      const { error } = await supabase.functions.invoke('send-export-email', {
        body: {
          tenant_id: tenantId,
          customer_name: order.customer_name || 'Khách lẻ',
          customer_email: customer.email,
          customer_phone: order.customer_phone || '',
          items: items.map(item => ({
            product_name: item.product_name || item.description || 'Dịch vụ',
            imei: item.product_imei,
            sale_price: item.unit_price,
            quantity: item.quantity,
            warranty: item.warranty || warranty,
          })),
          total_amount: totalAmount,
          receipt_code: createdReceiptCode,
          branch_id: order.branch_id,
          export_date: new Date().toISOString(),
          sales_staff_id: user?.id,
        },
      });

      if (error) throw error;
      toast.success('Đã gửi email cho khách hàng!');
    } catch (err: any) {
      toast.error('Gửi email thất bại: ' + err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const handlePrint = () => {
    const printContent = `
      <html><head><title>Hóa đơn ${createdReceiptCode}</title>
      <style>body{font-family:Arial;padding:20px;max-width:300px;margin:0 auto;font-size:13px}
      h2{text-align:center;margin-bottom:5px}
      .line{border-top:1px dashed #000;margin:8px 0}
      .row{display:flex;justify-content:space-between;margin:3px 0}
      .label{color:#666}.bold{font-weight:bold}
      .item{padding:4px 0;border-bottom:1px dotted #ccc}
      </style></head><body>
      <h2>HÓA ĐƠN SỬA CHỮA</h2>
      <p style="text-align:center">${createdReceiptCode}</p>
      <div class="line"></div>
      <div class="row"><span class="label">Khách:</span><span>${order.customer_name || 'Khách lẻ'}</span></div>
      <div class="row"><span class="label">SĐT:</span><span>${order.customer_phone || '-'}</span></div>
      <div class="row"><span class="label">Thiết bị:</span><span>${order.device_name}</span></div>
      <div class="row"><span class="label">IMEI:</span><span>${order.device_imei || '-'}</span></div>
      <div class="line"></div>
      ${items.map(i => `<div class="item"><div class="bold">${i.product_name || i.description || 'Dịch vụ'}</div><div class="row"><span>${i.quantity} x ${formatNumber(i.unit_price)}đ</span><span class="bold">${formatNumber(i.total_price)}đ</span></div>${(i.warranty || (i.item_type === 'part' ? warranty : null)) ? `<div style="font-size:11px;color:#666">BH: ${i.warranty || warranty}</div>` : ''}</div>`).join('')}
      <div class="line"></div>
      <div class="row bold"><span>TỔNG:</span><span>${formatNumber(totalAmount)}đ</span></div>
      <div class="row"><span>Thanh toán:</span><span>${formatNumber(paidAmount)}đ</span></div>
      ${debtAmount > 0 ? `<div class="row"><span>Còn nợ:</span><span>${formatNumber(debtAmount)}đ</span></div>` : ''}
      <div class="row"><span class="label">Bảo hành:</span><span>${warranty}</span></div>
      <div class="line"></div>
      <p style="text-align:center;font-size:11px;color:#999">${new Date().toLocaleString('vi')}</p>
      </body></html>
    `;
    const w = window.open('', '_blank');
    if (w) { w.document.write(printContent); w.document.close(); w.print(); }
  };

  if (isDone) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="text-center space-y-4 py-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h3 className="text-xl font-bold">Thanh toán thành công!</h3>
            <p className="text-muted-foreground">Mã hóa đơn: <span className="font-mono font-bold">{createdReceiptCode}</span></p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" /> In hóa đơn
              </Button>
              <Button variant="outline" onClick={handleSendEmail} disabled={sendingEmail || !order.customer_id}>
                {sendingEmail ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
                Gửi mail
              </Button>
              <Button onClick={() => onOpenChange(false)}>Đóng</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Trả khách & Thanh toán - {order.code}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order summary */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="font-medium">{order.device_name}</div>
            <div className="text-muted-foreground">Khách: {order.customer_name || 'Khách lẻ'} {order.customer_phone && `- ${order.customer_phone}`}</div>
          </div>

          {/* Items breakdown */}
          <div className="space-y-1 text-sm">
            {items.map(item => (
              <div key={item.id} className="flex justify-between">
                <span>
                  <Badge variant={item.item_type === 'part' ? 'outline' : 'secondary'} className="text-[10px] h-4 mr-1">
                    {item.item_type === 'part' ? 'LK' : 'DV'}
                  </Badge>
                  {item.product_name || item.description}
                </span>
                <span className="font-medium">{formatNumber(item.total_price)}đ</span>
              </div>
            ))}
            <div className="border-t pt-1 font-bold flex justify-between">
              <span>Tổng cộng:</span>
              <span>{formatNumber(totalAmount)}đ</span>
            </div>
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Lợi nhuận dự kiến:</span>
              <span className="text-green-600">{formatNumber(totalProfit)}đ</span>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <Label>Phương thức thanh toán</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[
                { key: 'cash' as const, label: 'Tiền mặt', icon: Banknote },
                { key: 'bank_card' as const, label: 'Chuyển khoản', icon: CreditCard },
                { key: 'e_wallet' as const, label: 'Ví điện tử', icon: Wallet },
                { key: 'debt' as const, label: 'Ghi nợ', icon: CreditCard },
              ].map(m => (
                <Button
                  key={m.key}
                  variant={paymentMethod === m.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPaymentMethod(m.key)}
                  className="justify-start"
                >
                  <m.icon className="h-4 w-4 mr-1" />
                  {m.label}
                </Button>
              ))}
            </div>
          </div>

          {paymentMethod !== 'debt' && (
            <div>
              <Label>Số tiền khách trả</Label>
              <PriceInput value={paidAmount} onChange={setPaidAmount} />
              {debtAmount > 0 && (
                <p className="text-xs text-orange-600 mt-1">Còn nợ: {formatNumber(debtAmount)}đ</p>
              )}
            </div>
          )}

          {/* Warranty */}
          <div>
            <Label>Bảo hành sau sửa</Label>
            <Select value={warranty} onValueChange={setWarranty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Không BH">Không bảo hành</SelectItem>
                <SelectItem value="1 Tháng">1 Tháng</SelectItem>
                <SelectItem value="3 Tháng">3 Tháng</SelectItem>
                <SelectItem value="6 Tháng">6 Tháng</SelectItem>
                <SelectItem value="12 Tháng">12 Tháng</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Auto email toggle */}
          <AutoEmailToggle
            id="auto-email-repair"
            checked={autoEmailEnabled}
            onCheckedChange={setAutoEmailEnabled}
            hasCustomerEmail={!!customerEmail}
          />

          <div>
            <Label>Ghi chú</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Ghi chú thêm..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleCheckout} disabled={isSubmitting}>
            {isSubmitting ? 'Đang xử lý...' : `Thanh toán ${formatNumber(totalAmount)}đ`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
