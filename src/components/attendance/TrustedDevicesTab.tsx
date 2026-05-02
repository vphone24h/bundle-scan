import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Check, X, Clock } from 'lucide-react';
import { useTrustedDevices, useApproveDevice, useRejectDevice } from '@/hooks/useAttendance';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Chờ duyệt', variant: 'secondary' },
  approved: { label: 'Đã duyệt', variant: 'default' },
  rejected: { label: 'Từ chối', variant: 'destructive' },
  revoked: { label: 'Thu hồi', variant: 'outline' },
};

export function TrustedDevicesTab() {
  const { data: devices, isLoading } = useTrustedDevices();
  const approve = useApproveDevice();
  const reject = useRejectDevice();

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Thiết bị tin cậy ({devices?.length || 0})</h2>

      {!devices?.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Smartphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Chưa có thiết bị nào đăng ký. Thiết bị sẽ tự động đăng ký khi nhân viên chấm công lần đầu.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {devices.map((d: any) => {
            const st = statusMap[d.status] || statusMap.pending;
            return (
              <Card key={d.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-muted shrink-0">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{d.device_name || 'Thiết bị không tên'}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.device_type || d.user_agent?.slice(0, 50)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(d.created_at), 'dd/MM/yyyy HH:mm')}
                          {d.last_used_at && ` · Dùng lần cuối: ${format(new Date(d.last_used_at), 'dd/MM HH:mm')}`}
                        </p>
                      </div>
                    </div>
                     <div className="flex items-center gap-2 shrink-0">
                       <Badge variant={st.variant}>{st.label}</Badge>
                       {d.status === 'pending' && (
                         <div className="flex gap-1">
                           <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => approve.mutate(d.id)} title="Duyệt">
                             <Check className="h-4 w-4" />
                           </Button>
                           <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => reject.mutate(d.id)} title="Từ chối">
                             <X className="h-4 w-4" />
                           </Button>
                         </div>
                       )}
                       {(d.status === 'rejected' || d.status === 'revoked') && (
                         <Button
                           size="sm"
                           variant="outline"
                           className="h-8 text-green-600 border-green-600/40 hover:bg-green-50"
                           onClick={() => approve.mutate(d.id)}
                           disabled={approve.isPending}
                         >
                           <Check className="h-3.5 w-3.5 mr-1" />
                           Duyệt lại
                         </Button>
                       )}
                       {d.status === 'approved' && (
                         <Button
                           size="icon"
                           variant="ghost"
                           className="h-8 w-8 text-destructive"
                           onClick={() => reject.mutate(d.id)}
                           title="Thu hồi / Từ chối"
                           disabled={reject.isPending}
                         >
                           <X className="h-4 w-4" />
                         </Button>
                       )}
                     </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
