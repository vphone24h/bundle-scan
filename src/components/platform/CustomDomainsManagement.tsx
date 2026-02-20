import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAllCustomDomains, useUpdateDomainStatus, useDeleteCustomDomain } from '@/hooks/useCustomDomains';
import { useAllTenants } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Search, Plus, Trash2, CheckCircle, XCircle, Clock, Globe, Loader2, Shield, Copy, Info } from 'lucide-react';

const sslStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  pending: { label: 'Chờ SSL', variant: 'outline', icon: Clock },
  active: { label: 'SSL Active', variant: 'default', icon: Shield },
  failed: { label: 'SSL Lỗi', variant: 'destructive', icon: XCircle },
};

export function CustomDomainsManagement() {
  const { data: domains, isLoading } = useAllCustomDomains();
  const { data: tenants } = useAllTenants();
  const updateStatus = useUpdateDomainStatus();
  const deleteDomain = useDeleteCustomDomain();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [showDnsDialog, setShowDnsDialog] = useState<any>(null);
  const [newDomain, setNewDomain] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [adding, setAdding] = useState(false);

  const filteredDomains = domains?.filter((d: any) =>
    d.domain.toLowerCase().includes(search.toLowerCase()) ||
    d.tenants?.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.tenants?.subdomain?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!newDomain.trim() || !selectedTenantId) {
      toast({ title: 'Vui lòng nhập domain và chọn doanh nghiệp', variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      const { data: token } = await supabase.rpc('generate_domain_verification_token');
      const { error } = await supabase.from('custom_domains').insert([{
        tenant_id: selectedTenantId,
        domain: newDomain.toLowerCase().trim(),
        verification_token: token,
        is_verified: true,
        verified_at: new Date().toISOString(),
        ssl_status: 'pending',
      }]);
      if (error) throw error;
      toast({ title: 'Đã thêm domain thành công' });
      queryClient.invalidateQueries({ queryKey: ['all-custom-domains'] });
      setShowAddDialog(false);
      setNewDomain('');
      setSelectedTenantId('');
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDomain.mutateAsync(id);
      toast({ title: 'Đã xóa domain' });
      queryClient.invalidateQueries({ queryKey: ['all-custom-domains'] });
      setShowDeleteDialog(null);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const handleToggleVerified = async (id: string, currentVerified: boolean) => {
    try {
      await updateStatus.mutateAsync({ id, is_verified: !currentVerified });
      toast({ title: currentVerified ? 'Đã hủy xác thực' : 'Đã xác thực domain' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const handleUpdateSSL = async (id: string, ssl_status: string) => {
    try {
      await updateStatus.mutateAsync({ id, ssl_status });
      toast({ title: `Đã cập nhật SSL: ${ssl_status}` });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm domain hoặc tên DN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 search-input-highlight"
          />
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Gắn domain
        </Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Doanh nghiệp</TableHead>
                <TableHead>Store ID</TableHead>
                <TableHead>Xác thực</TableHead>
                <TableHead>SSL</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="w-[120px]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDomains?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Chưa có domain nào
                  </TableCell>
                </TableRow>
              )}
              {filteredDomains?.map((d: any) => {
                const ssl = sslStatusConfig[d.ssl_status || 'pending'] || sslStatusConfig.pending;
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <button
                          className="font-medium text-primary hover:underline cursor-pointer"
                          onClick={() => setShowDnsDialog(d)}
                        >
                          {d.domain}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>{d.tenants?.name || '-'}</TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                        {d.tenants?.subdomain || '-'}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleVerified(d.id, d.is_verified)}
                      >
                        {d.is_verified ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" /> Đã xác thực
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <XCircle className="h-3 w-3" /> Chưa
                          </Badge>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={d.ssl_status || 'pending'}
                        onValueChange={(val) => handleUpdateSSL(d.id, val)}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Chờ SSL</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="failed">Lỗi</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {format(new Date(d.created_at), 'dd/MM/yyyy', { locale: vi })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setShowDeleteDialog(d.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
        {filteredDomains?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Chưa có domain nào</p>
        )}
        {filteredDomains?.map((d: any) => (
          <Card key={d.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <span className="font-medium">{d.domain}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive h-8 w-8"
                  onClick={() => setShowDeleteDialog(d.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Doanh nghiệp:</span>
                  <span>{d.tenants?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Store ID:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{d.tenants?.subdomain || '-'}</code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Xác thực:</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => handleToggleVerified(d.id, d.is_verified)}>
                    {d.is_verified ? (
                      <Badge variant="default" className="gap-1 text-xs"><CheckCircle className="h-3 w-3" /> Đã xác thực</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs"><XCircle className="h-3 w-3" /> Chưa</Badge>
                    )}
                  </Button>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">SSL:</span>
                  <Select value={d.ssl_status || 'pending'} onValueChange={(val) => handleUpdateSSL(d.id, val)}>
                    <SelectTrigger className="w-[120px] h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Chờ SSL</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="failed">Lỗi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Domain Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gắn domain cho doanh nghiệp</DialogTitle>
            <DialogDescription>
              Thêm tên miền riêng và liên kết với một cửa hàng. Domain sẽ được đánh dấu đã xác thực.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tên miền</Label>
              <Input
                placeholder="vd: hoangmobile.vn"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
              />
            </div>
            <div>
              <Label>Doanh nghiệp</Label>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn doanh nghiệp..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants?.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.subdomain})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Hủy</Button>
            <Button onClick={handleAdd} disabled={adding}>
              {adding && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Thêm domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa domain</DialogTitle>
            <DialogDescription>
              Domain sẽ bị xóa và không thể truy cập bằng tên miền này nữa. Bạn có chắc chắn?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>Hủy</Button>
            <Button variant="destructive" onClick={() => showDeleteDialog && handleDelete(showDeleteDialog)}>
              Xóa domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DNS Info Dialog */}
      <Dialog open={!!showDnsDialog} onOpenChange={() => setShowDnsDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Cấu hình DNS cho {showDnsDialog?.domain}
            </DialogTitle>
            <DialogDescription>
              Hướng dẫn cấu hình DNS tại nhà cung cấp tên miền
            </DialogDescription>
          </DialogHeader>
          {showDnsDialog && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <h4 className="font-semibold text-sm">1. Bản ghi A (bắt buộc)</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tên:</span>
                    <p className="font-mono">{showDnsDialog.domain}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Loại:</span>
                    <p className="font-mono">A</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Giá trị:</span>
                    <div className="flex items-center gap-1">
                      <p className="font-mono">185.158.133.1</p>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                        navigator.clipboard.writeText('185.158.133.1');
                        toast({ title: 'Đã copy IP' });
                      }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <h4 className="font-semibold text-sm pt-2">2. Bản ghi A cho www (khuyến nghị)</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tên:</span>
                    <p className="font-mono">www.{showDnsDialog.domain}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Loại:</span>
                    <p className="font-mono">A</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Giá trị:</span>
                    <p className="font-mono">185.158.133.1</p>
                  </div>
                </div>

                <h4 className="font-semibold text-sm pt-2">3. Bản ghi TXT xác thực</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tên:</span>
                    <p className="font-mono">_lovable.{showDnsDialog.domain.split('.').slice(0, -1).join('.') || showDnsDialog.domain}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Loại:</span>
                    <p className="font-mono">TXT</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Giá trị:</span>
                    <div className="flex items-center gap-1">
                      <p className="font-mono text-xs break-all">{showDnsDialog.verification_token || 'N/A'}</p>
                      {showDnsDialog.verification_token && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => {
                          navigator.clipboard.writeText(showDnsDialog.verification_token);
                          toast({ title: 'Đã copy token xác thực' });
                        }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                DNS có thể mất 5-30 phút (tối đa 72 giờ) để cập nhật. Sau khi cấu hình xong, quay lại đây nhấn xác thực.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDnsDialog(null)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
