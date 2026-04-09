import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePlatformUser } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Plus, CheckCircle2, XCircle, Clock, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

function formatMoney(n: number) {
  return n.toLocaleString('vi-VN') + 'đ';
}

interface SalaryAdvancesTabProps {
  mode: 'employee' | 'admin';
}

export function SalaryAdvancesTab({ mode }: SalaryAdvancesTabProps) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const { data: advances, isLoading } = useQuery({
    queryKey: ['salary-advances', tenantId, mode, user?.id],
    queryFn: async () => {
      let q = supabase.from('salary_advances' as any).select('*').eq('tenant_id', tenantId!);
      if (mode === 'employee') q = q.eq('user_id', user!.id);
      q = q.order('created_at', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenantId && !!user?.id,
  });

  const createAdvance = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('salary_advances' as any).insert({
        tenant_id: tenantId,
        user_id: user!.id,
        user_name: profile?.display_name || user!.email,
        amount: Number(amount),
        reason,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-advances'] });
      toast.success('Đã gửi yêu cầu tạm ứng');
      setOpen(false);
      setAmount('');
      setReason('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, reject_reason }: { id: string; status: string; reject_reason?: string }) => {
      const updates: any = { status };
      if (status === 'approved') { updates.approved_by = user!.id; updates.approved_at = new Date().toISOString(); }
      if (status === 'rejected') { updates.rejected_by = user!.id; updates.rejected_at = new Date().toISOString(); updates.reject_reason = reject_reason; }
      if (status === 'paid') { updates.paid_by = user!.id; updates.paid_at = new Date().toISOString(); }
      const { error } = await supabase.from('salary_advances' as any).update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-advances'] });
      toast.success('Đã cập nhật');
      setRejectingId(null);
      setRejectReason('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'Chờ duyệt', variant: 'secondary' },
      approved: { label: 'Đã duyệt', variant: 'outline' },
      rejected: { label: 'Từ chối', variant: 'destructive' },
      paid: { label: 'Đã chi', variant: 'default' },
    };
    const s = map[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Tạm ứng lương</h3>
          <p className="text-xs text-muted-foreground">
            {mode === 'employee' ? 'Gửi yêu cầu và theo dõi trạng thái' : 'Duyệt và quản lý yêu cầu tạm ứng'}
          </p>
        </div>
        {mode === 'employee' && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Tạm ứng</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yêu cầu tạm ứng</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Số tiền</Label>
                  <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="VD: 2000000" />
                </div>
                <div>
                  <Label className="text-xs">Lý do</Label>
                  <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Nêu lý do tạm ứng..." rows={3} />
                </div>
                <Button
                  className="w-full"
                  disabled={!amount || Number(amount) <= 0 || createAdvance.isPending}
                  onClick={() => createAdvance.mutate()}
                >
                  <DollarSign className="h-4 w-4 mr-1" /> Gửi yêu cầu
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-muted-foreground">Đang tải...</div>
      ) : !advances?.length ? (
        <div className="text-center py-6 text-muted-foreground">Chưa có yêu cầu tạm ứng</div>
      ) : (
        <div className="space-y-2">
          {advances.map((adv: any) => (
            <Card key={adv.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-primary">{formatMoney(Number(adv.amount))}</span>
                  </div>
                  {statusBadge(adv.status)}
                </div>
                {mode === 'admin' && adv.user_name && (
                  <p className="text-xs font-medium mb-1">{adv.user_name}</p>
                )}
                {adv.reason && <p className="text-xs text-muted-foreground">{adv.reason}</p>}
                {adv.reject_reason && <p className="text-xs text-destructive mt-1">Lý do từ chối: {adv.reject_reason}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {format(new Date(adv.requested_at), 'HH:mm dd/MM/yyyy')}
                </p>

                {/* Admin actions */}
                {mode === 'admin' && adv.status === 'pending' && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => updateStatus.mutate({ id: adv.id, status: 'approved' })}
                    >
                      <CheckCircle2 className="h-3 w-3" /> Duyệt
                    </Button>
                    {rejectingId === adv.id ? (
                      <div className="flex-1 flex gap-1">
                        <Input
                          className="h-7 text-xs"
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          placeholder="Lý do từ chối"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          onClick={() => updateStatus.mutate({ id: adv.id, status: 'rejected', reject_reason: rejectReason })}
                        >
                          Xác nhận
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1 text-destructive"
                        onClick={() => setRejectingId(adv.id)}
                      >
                        <XCircle className="h-3 w-3" /> Từ chối
                      </Button>
                    )}
                  </div>
                )}
                {mode === 'admin' && adv.status === 'approved' && (
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 mt-2"
                    onClick={() => updateStatus.mutate({ id: adv.id, status: 'paid' })}
                  >
                    <Banknote className="h-3 w-3" /> Đánh dấu đã chi
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
