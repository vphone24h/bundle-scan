import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, User, Phone, Plus, Loader2, Trash2, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  useDepositsByProduct,
  useCreateProductDeposit,
  useRefundProductDeposit,
} from '@/hooks/useProductDeposits';
import { useCustomPaymentSources } from '@/hooks/useCustomPaymentSources';
import { formatNumber } from '@/lib/formatNumber';
import { format } from 'date-fns';

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  productName: string;
  productImei?: string | null;
  branchId?: string | null;
}

const BUILT_IN_SOURCES = [
  { id: 'cash', name: 'Tiền mặt' },
  { id: 'bank_card', name: 'Chuyển khoản' },
  { id: 'e_wallet', name: 'Ví điện tử' },
];

export function ProductDepositDialog({
  open,
  onOpenChange,
  productId,
  productName,
  productImei,
  branchId,
}: Props) {
  const { toast } = useToast();
  const { data: existingDeposits = [] } = useDepositsByProduct(open ? productId : null);
  const { data: customSources = [] } = useCustomPaymentSources();
  const createMut = useCreateProductDeposit();
  const refundMut = useRefundProductDeposit();

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const [amount, setAmount] = useState('');
  const [paymentSource, setPaymentSource] = useState('cash');
  const [note, setNote] = useState('');

  const allSources = useMemo(
    () => [...BUILT_IN_SOURCES, ...customSources.map(s => ({ id: s.id, name: s.name }))],
    [customSources]
  );

  useEffect(() => {
    if (!open) {
      setSearch(''); setResults([]); setSelected(null);
      setShowNewForm(false); setNewName(''); setNewPhone('');
      setAmount(''); setPaymentSource('cash'); setNote('');
    }
  }, [open]);

  // Search customers (debounced)
  useEffect(() => {
    if (!open || search.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const term = search.trim();
      const { data } = await supabase
        .from('customers')
        .select('id, name, phone')
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
        .limit(8);
      setResults((data || []) as Customer[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search, open]);

  const activeDeposits = existingDeposits.filter(d => d.status === 'active');

  const handleSubmit = async () => {
    let customer = selected;

    if (!customer && showNewForm) {
      const name = newName.trim();
      const phone = newPhone.trim();
      if (!name) { toast({ title: 'Thiếu tên khách', variant: 'destructive' }); return; }
      // Try create customer (best-effort)
      try {
        const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
        const { data: existing } = phone
          ? await supabase.from('customers').select('id, name, phone').eq('phone', phone).eq('tenant_id', tenantId as string).maybeSingle()
          : { data: null };
        if (existing) {
          customer = existing as Customer;
        } else {
          const { data: created, error } = await supabase
            .from('customers')
            .insert([{ name, phone: phone || null, tenant_id: tenantId }])
            .select('id, name, phone').single();
          if (error) throw error;
          customer = created as Customer;
        }
      } catch (e: any) {
        // Fall back to anonymous (no customer_id)
        customer = { id: '', name, phone } as Customer;
      }
    }

    if (!customer) {
      toast({ title: 'Vui lòng chọn hoặc thêm khách', variant: 'destructive' });
      return;
    }

    const amt = Number(String(amount).replace(/[^\d]/g, '')) || 0;
    if (amt <= 0) { toast({ title: 'Số tiền cọc không hợp lệ', variant: 'destructive' }); return; }

    try {
      await createMut.mutateAsync({
        product_id: productId,
        branch_id: branchId || null,
        customer_id: customer.id || null,
        customer_name: customer.name,
        customer_phone: customer.phone || null,
        deposit_amount: amt,
        payment_source: paymentSource,
        note: note || null,
      });
      toast({ title: 'Đã tạo cọc', description: `${customer.name} - ${formatNumber(amt)}đ` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Không tạo được cọc', description: e.message, variant: 'destructive' });
    }
  };

  const handleRefund = async (depositId: string) => {
    if (!confirm('Hoàn cọc cho khách? Hệ thống sẽ ghi 1 dòng chi vào sổ quỹ.')) return;
    try {
      await refundMut.mutateAsync({ deposit_id: depositId });
      toast({ title: 'Đã hoàn cọc' });
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Khách cọc sản phẩm</DialogTitle>
          <div className="text-sm text-muted-foreground">
            <div className="font-medium text-foreground">{productName}</div>
            {productImei && <div className="font-mono text-xs">IMEI: {productImei}</div>}
          </div>
        </DialogHeader>

        {/* Existing active deposits */}
        {activeDeposits.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Đang có cọc</Label>
            {activeDeposits.map(d => (
              <div key={d.id} className="flex items-center justify-between gap-2 p-2 rounded border bg-warning/5">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{d.customer_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.customer_phone || '—'} · {format(new Date(d.created_at), 'dd/MM HH:mm')}
                  </div>
                  {d.note && <div className="text-xs italic mt-0.5">"{d.note}"</div>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-warning">{formatNumber(Number(d.deposit_amount))}đ</div>
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive"
                    onClick={() => handleRefund(d.id)} disabled={refundMut.isPending}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Hoàn cọc
                  </Button>
                </div>
              </div>
            ))}
            <Separator />
            <div className="text-xs text-muted-foreground">Thêm cọc mới:</div>
          </div>
        )}

        {/* Customer picker */}
        {!selected && !showNewForm && (
          <div className="space-y-2">
            <Label>Tìm khách hàng</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tên hoặc SĐT..." className="pl-8" />
            </div>
            {searching && <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Đang tìm...</div>}
            {results.length > 0 && (
              <div className="border rounded max-h-48 overflow-y-auto divide-y">
                {results.map(c => (
                  <button key={c.id} type="button" onClick={() => setSelected(c)}
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.phone}</div>
                  </button>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowNewForm(true)} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Thêm khách mới
            </Button>
          </div>
        )}

        {selected && (
          <div className="flex items-center justify-between p-2 border rounded bg-muted/30">
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{selected.name}</div>
                <div className="text-xs text-muted-foreground">{selected.phone}</div>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Đổi</Button>
          </div>
        )}

        {showNewForm && !selected && (
          <div className="space-y-2 p-3 border rounded">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Khách mới</Label>
              <Button size="sm" variant="ghost" onClick={() => setShowNewForm(false)}>Hủy</Button>
            </div>
            <Input placeholder="Tên khách" value={newName} onChange={e => setNewName(e.target.value)} />
            <Input placeholder="Số điện thoại" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
          </div>
        )}

        {/* Amount + source */}
        <div className="space-y-2">
          <Label>Số tiền cọc *</Label>
          <Input
            inputMode="numeric"
            value={amount ? formatNumber(Number(amount)) : ''}
            onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="0"
          />
        </div>

        <div className="space-y-2">
          <Label>Nguồn tiền (vào sổ quỹ)</Label>
          <Select value={paymentSource} onValueChange={setPaymentSource}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allSources.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Ghi chú</Label>
          <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Hẹn hôm nay 5h..." />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button onClick={handleSubmit} disabled={createMut.isPending}>
            {createMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Tạo cọc
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
