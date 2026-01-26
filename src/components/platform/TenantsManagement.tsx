import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  useAllTenants, 
  useManageTenant, 
  Tenant,
  calculateRemainingDays 
} from '@/hooks/useTenant';
import { 
  Search, 
  Lock, 
  Unlock, 
  CalendarPlus, 
  MoreHorizontal,
  Building2,
  Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  trial: { label: 'Dùng thử', variant: 'secondary' },
  active: { label: 'Hoạt động', variant: 'default' },
  expired: { label: 'Hết hạn', variant: 'outline' },
  locked: { label: 'Bị khóa', variant: 'destructive' },
};

export function TenantsManagement() {
  const { data: tenants, isLoading } = useAllTenants();
  const manageTenant = useManageTenant();
  
  const [search, setSearch] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [actionDialog, setActionDialog] = useState<'lock' | 'unlock' | 'extend' | null>(null);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('30');

  const filteredTenants = tenants?.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.subdomain.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAction = async () => {
    if (!selectedTenant || !actionDialog) return;

    try {
      await manageTenant.mutateAsync({
        action: actionDialog,
        tenantId: selectedTenant.id,
        reason: reason || undefined,
        days: actionDialog === 'extend' ? parseInt(days) : undefined,
      });

      toast({
        title: 'Thành công',
        description: actionDialog === 'lock' 
          ? 'Đã khóa doanh nghiệp'
          : actionDialog === 'unlock'
          ? 'Đã mở khóa doanh nghiệp'
          : `Đã gia hạn ${days} ngày`,
      });

      setActionDialog(null);
      setSelectedTenant(null);
      setReason('');
      setDays('30');
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm doanh nghiệp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doanh nghiệp</TableHead>
                <TableHead>Subdomain</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Gói dịch vụ</TableHead>
                <TableHead>Còn lại</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants?.map((tenant) => {
                const remaining = calculateRemainingDays(tenant);
                const status = statusConfig[tenant.status];
                
                return (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-sm text-muted-foreground">{tenant.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {tenant.subdomain}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {tenant.subscription_plan === 'monthly' && 'Tháng'}
                      {tenant.subscription_plan === 'yearly' && 'Năm'}
                      {tenant.subscription_plan === 'lifetime' && 'Vĩnh viễn'}
                      {!tenant.subscription_plan && '-'}
                    </TableCell>
                    <TableCell>
                      <span className={remaining <= 7 ? 'text-destructive font-medium' : ''}>
                        {remaining > 36500 ? 'Vĩnh viễn' : `${remaining} ngày`}
                      </span>
                    </TableCell>
                    <TableCell>
                      {format(new Date(tenant.created_at), 'dd/MM/yyyy', { locale: vi })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {tenant.status !== 'locked' ? (
                            <DropdownMenuItem onClick={() => {
                              setSelectedTenant(tenant);
                              setActionDialog('lock');
                            }}>
                              <Lock className="h-4 w-4 mr-2" />
                              Khóa
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => {
                              setSelectedTenant(tenant);
                              setActionDialog('unlock');
                            }}>
                              <Unlock className="h-4 w-4 mr-2" />
                              Mở khóa
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => {
                            setSelectedTenant(tenant);
                            setActionDialog('extend');
                          }}>
                            <CalendarPlus className="h-4 w-4 mr-2" />
                            Gia hạn
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredTenants?.map((tenant) => {
          const remaining = calculateRemainingDays(tenant);
          const status = statusConfig[tenant.status];
          
          return (
            <Card key={tenant.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      <p className="text-sm text-muted-foreground">{tenant.subdomain}</p>
                    </div>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Còn lại:</span>
                  <span className={remaining <= 7 ? 'text-destructive font-medium' : ''}>
                    {remaining > 36500 ? 'Vĩnh viễn' : `${remaining} ngày`}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  {tenant.status !== 'locked' ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setSelectedTenant(tenant);
                        setActionDialog('lock');
                      }}
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Khóa
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setSelectedTenant(tenant);
                        setActionDialog('unlock');
                      }}
                    >
                      <Unlock className="h-4 w-4 mr-2" />
                      Mở khóa
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => {
                      setSelectedTenant(tenant);
                      setActionDialog('extend');
                    }}
                  >
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Gia hạn
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Action Dialogs */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === 'lock' && 'Khóa doanh nghiệp'}
              {actionDialog === 'unlock' && 'Mở khóa doanh nghiệp'}
              {actionDialog === 'extend' && 'Gia hạn doanh nghiệp'}
            </DialogTitle>
            <DialogDescription>
              {selectedTenant?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {actionDialog === 'extend' && (
              <div className="space-y-2">
                <Label>Số ngày gia hạn</Label>
                <Input
                  type="number"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  min="1"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label>{actionDialog === 'lock' ? 'Lý do khóa' : 'Ghi chú'}</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={actionDialog === 'lock' ? 'Nhập lý do khóa...' : 'Nhập ghi chú...'}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Hủy
            </Button>
            <Button 
              onClick={handleAction}
              disabled={manageTenant.isPending}
              variant={actionDialog === 'lock' ? 'destructive' : 'default'}
            >
              {manageTenant.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actionDialog === 'lock' && 'Khóa'}
              {actionDialog === 'unlock' && 'Mở khóa'}
              {actionDialog === 'extend' && 'Gia hạn'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}