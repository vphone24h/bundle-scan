import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformUser } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function AttendanceLocksTab() {
  const { user } = useAuth();
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [note, setNote] = useState('');

  const { data: locks, isLoading } = useQuery({
    queryKey: ['attendance-locks', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_locks' as any)
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('period_start', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenantId,
  });

  const createLock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('attendance_locks' as any).insert({
        tenant_id: tenantId,
        period_start: periodStart,
        period_end: periodEnd,
        locked_by: user!.id,
        note: note || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-locks'] });
      toast.success('Đã chốt công thành công');
      setOpen(false);
      setPeriodStart('');
      setPeriodEnd('');
      setNote('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('attendance_locks' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-locks'] });
      toast.success('Đã mở khóa');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Chốt công</h3>
          <p className="text-xs text-muted-foreground">Khóa dữ liệu chấm công theo khoảng thời gian, không cho sửa đổi</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Chốt công</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chốt công mới</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Từ ngày</Label>
                  <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Đến ngày</Label>
                  <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Ghi chú</Label>
                <Input value={note} onChange={e => setNote(e.target.value)} placeholder="VD: Chốt công tháng 3/2026" />
              </div>
              <Button
                className="w-full"
                disabled={!periodStart || !periodEnd || createLock.isPending}
                onClick={() => createLock.mutate()}
              >
                <Lock className="h-4 w-4 mr-1" /> Xác nhận chốt
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-muted-foreground">Đang tải...</div>
      ) : !locks?.length ? (
        <div className="text-center py-6 text-muted-foreground">Chưa có khoảng thời gian nào được chốt</div>
      ) : (
        <div className="space-y-2">
          {locks.map((lock: any) => (
            <Card key={lock.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(lock.period_start), 'dd/MM/yyyy')} - {format(new Date(lock.period_end), 'dd/MM/yyyy')}
                    </p>
                    {lock.note && <p className="text-xs text-muted-foreground">{lock.note}</p>}
                    <p className="text-[10px] text-muted-foreground">
                      Chốt lúc {format(new Date(lock.locked_at), 'HH:mm dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => {
                    if (confirm('Mở khóa khoảng thời gian này?')) deleteLock.mutate(lock.id);
                  }}
                >
                  <Unlock className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
