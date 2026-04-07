import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCompanies, useCreateCompany, useUpdateCompany, useDeleteCompany, useAssignTenantToCompany } from '@/hooks/useCompanies';
import { useAllTenants } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Plus, Trash2, Pencil, Globe, Loader2, Building2, Store, CheckCircle, XCircle, Clock, UserCog, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Hoạt động', variant: 'default' },
  pending: { label: 'Chờ kích hoạt', variant: 'outline' },
  inactive: { label: 'Ngừng', variant: 'destructive' },
};

export function CompaniesManagement() {
  const { data: companies, isLoading } = useCompanies();
  const { data: tenants } = useAllTenants();
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();
  const assignTenant = useAssignTenantToCompany();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [showTenantsDialog, setShowTenantsDialog] = useState<any>(null);

  // Add/Edit form
  const [formDomain, setFormDomain] = useState('');
  const [formName, setFormName] = useState('');
  const [formStatus, setFormStatus] = useState('active');

  // Company Admin states
  const [showAdminDialog, setShowAdminDialog] = useState<any>(null); // company object
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [showDeleteAdminDialog, setShowDeleteAdminDialog] = useState<any>(null);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');

  // Fetch company admins
  const { data: companyAdmins } = useQuery({
    queryKey: ['company-admins'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-company-admin', {
        body: { action: 'list' },
      });
      if (error) throw error;
      return data?.admins || [];
    },
  });

  const getAdminForCompany = (companyId: string) => {
    return companyAdmins?.find((a: any) => a.company_id === companyId);
  };

  const filtered = useMemo(() => {
    if (!companies) return [];
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter(c => c.domain.includes(q) || c.name.toLowerCase().includes(q));
  }, [companies, search]);

  const companyTenants = useMemo(() => {
    if (!showTenantsDialog || !tenants) return [];
    return tenants.filter((t: any) => t.company_id === showTenantsDialog.id);
  }, [showTenantsDialog, tenants]);

  const unassignedTenants = useMemo(() => {
    if (!showTenantsDialog || !tenants) return [];
    return tenants.filter((t: any) => t.company_id !== showTenantsDialog.id);
  }, [showTenantsDialog, tenants]);

  const handleCreateAdmin = async () => {
    if (!showAdminDialog || !adminEmail || !adminPassword) {
      toast({ title: 'Vui lòng nhập đủ email và mật khẩu', variant: 'destructive' });
      return;
    }
    setAdminLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-company-admin', {
        body: {
          action: 'create',
          email: adminEmail,
          password: adminPassword,
          company_id: showAdminDialog.id,
          display_name: adminDisplayName || adminEmail.split('@')[0],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: data.message || 'Đã tạo Company Admin' });
      setShowAdminDialog(null);
      setAdminEmail('');
      setAdminPassword('');
      setAdminDisplayName('');
      queryClient.invalidateQueries({ queryKey: ['company-admins'] });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    } finally {
      setAdminLoading(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!showDeleteAdminDialog) return;
    setAdminLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-company-admin', {
        body: { action: 'delete', user_id: showDeleteAdminDialog.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Đã xóa Company Admin' });
      setShowDeleteAdminDialog(null);
      queryClient.invalidateQueries({ queryKey: ['company-admins'] });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    } finally {
      setAdminLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!showChangePasswordDialog || !newPassword) return;
    setAdminLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-company-admin', {
        body: { action: 'update_password', user_id: showChangePasswordDialog.user_id, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Đã cập nhật mật khẩu' });
      setShowChangePasswordDialog(null);
      setNewPassword('');
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    } finally {
      setAdminLoading(false);
    }
  };

  const openAdd = () => {
    setFormDomain('');
    setFormName('');
    setFormStatus('active');
    setShowAddDialog(true);
  };

  const openEdit = (c: any) => {
    setFormDomain(c.domain);
    setFormName(c.name);
    setFormStatus(c.status);
    setEditingCompany(c);
  };

  const handleSave = async () => {
    if (!formDomain.trim() || !formName.trim()) {
      toast({ title: 'Vui lòng nhập đủ thông tin', variant: 'destructive' });
      return;
    }
    try {
      if (editingCompany) {
        await updateCompany.mutateAsync({ id: editingCompany.id, domain: formDomain, name: formName, status: formStatus });
        toast({ title: 'Đã cập nhật công ty' });
        setEditingCompany(null);
      } else {
        await createCompany.mutateAsync({ domain: formDomain, name: formName });
        toast({ title: 'Đã thêm công ty mới' });
        setShowAddDialog(false);
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCompany.mutateAsync(id);
      toast({ title: 'Đã xóa công ty, các shop được chuyển về mặc định' });
      setShowDeleteDialog(null);
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const handleAssign = async (tenantId: string, companyId: string) => {
    try {
      await assignTenant.mutateAsync({ tenantId, companyId });
      toast({ title: 'Đã gán shop vào công ty' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const handleUnassign = async (tenantId: string) => {
    // Move to default company
    const defaultCompany = companies?.find(c => c.domain === 'vkho.vn');
    if (defaultCompany) {
      await handleAssign(tenantId, defaultCompany.id);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const renderStatusBadge = (status: string) => {
    const cfg = statusConfig[status] || statusConfig.pending;
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <SearchInput placeholder="Tìm domain hoặc tên..." value={search} onChange={setSearch} containerClassName="flex-1 max-w-sm" />
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1.5" />Thêm công ty</Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Tên công ty</TableHead>
                <TableHead>Số shop</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="w-[180px]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Chưa có công ty nào</TableCell></TableRow>
              )}
              {filtered.map(c => {
                const admin = getAdminForCompany(c.id);
                return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{c.domain}</span>
                    </div>
                  </TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => setShowTenantsDialog(c)}>
                      <Store className="h-3.5 w-3.5" />
                      {c.tenant_count || 0} shop
                    </Button>
                  </TableCell>
                  <TableCell>
                    {admin ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium">{admin.email}</p>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-6 text-xs p-1" onClick={() => { setShowChangePasswordDialog(admin); setNewPassword(''); }}>
                            <Key className="h-3 w-3 mr-0.5" />Đổi MK
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 text-xs p-1 text-destructive" onClick={() => setShowDeleteAdminDialog(admin)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => { setShowAdminDialog(c); setAdminEmail(''); setAdminPassword(''); setAdminDisplayName(''); }}>
                        <UserCog className="h-3.5 w-3.5" />Tạo admin
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>{renderStatusBadge(c.status)}</TableCell>
                  <TableCell>{format(new Date(c.created_at), 'dd/MM/yyyy', { locale: vi })}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      {c.domain !== 'vkho.vn' && (
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setShowDeleteDialog(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
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
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">Chưa có công ty nào</p>}
        {filtered.map(c => {
          const admin = getAdminForCompany(c.id);
          return (
          <Card key={c.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <span className="font-medium">{c.domain}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  {c.domain !== 'vkho.vn' && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setShowDeleteDialog(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Tên:</span><span>{c.name}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Shops:</span>
                  <Button variant="ghost" size="sm" className="h-6 gap-1" onClick={() => setShowTenantsDialog(c)}>
                    <Store className="h-3 w-3" /> {c.tenant_count || 0}
                  </Button>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Admin:</span>
                  {admin ? (
                    <span className="text-xs">{admin.email}</span>
                  ) : (
                    <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={() => { setShowAdminDialog(c); setAdminEmail(''); setAdminPassword(''); setAdminDisplayName(''); }}>
                      <UserCog className="h-3 w-3" />Tạo
                    </Button>
                  )}
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Trạng thái:</span>{renderStatusBadge(c.status)}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog || !!editingCompany} onOpenChange={(open) => { if (!open) { setShowAddDialog(false); setEditingCompany(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCompany ? 'Sửa công ty' : 'Thêm công ty mới'}</DialogTitle>
            <DialogDescription>
              {editingCompany ? 'Cập nhật thông tin domain và tên công ty.' : 'Thêm domain mới để tạo tenant cấp 1.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tên miền (domain)</Label>
              <Input placeholder="vd: mycompany.vn" value={formDomain} onChange={e => setFormDomain(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Tự động bỏ www. và chuyển thường</p>
            </div>
            <div>
              <Label>Tên công ty</Label>
              <Input placeholder="vd: Công ty ABC" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            {editingCompany && (
              <div>
                <Label>Trạng thái</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Hoạt động</SelectItem>
                    <SelectItem value="pending">Chờ kích hoạt</SelectItem>
                    <SelectItem value="inactive">Ngừng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditingCompany(null); }}>Hủy</Button>
            <Button onClick={handleSave} disabled={createCompany.isPending || updateCompany.isPending}>
              {(createCompany.isPending || updateCompany.isPending) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editingCompany ? 'Cập nhật' : 'Thêm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa công ty</DialogTitle>
            <DialogDescription>Các shop thuộc công ty này sẽ được chuyển về domain mặc định (vkho.vn). Bạn có chắc?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>Hủy</Button>
            <Button variant="destructive" onClick={() => showDeleteDialog && handleDelete(showDeleteDialog)} disabled={deleteCompany.isPending}>
              {deleteCompany.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tenants of Company Dialog */}
      <Dialog open={!!showTenantsDialog} onOpenChange={() => setShowTenantsDialog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Shops thuộc {showTenantsDialog?.name}
            </DialogTitle>
            <DialogDescription>Domain: {showTenantsDialog?.domain}</DialogDescription>
          </DialogHeader>
          
          {companyTenants.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Chưa có shop nào</p>
          ) : (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Shops hiện tại ({companyTenants.length})</h4>
              {companyTenants.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded-md border">
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.subdomain}</p>
                  </div>
                  {showTenantsDialog?.domain !== 'vkho.vn' && (
                    <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => handleUnassign(t.id)}>
                      Bỏ gán
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {showTenantsDialog && unassignedTenants.length > 0 && (
            <div className="space-y-2 mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium">Gán thêm shop</h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {unassignedTenants.slice(0, 20).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent">
                    <div>
                      <p className="text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.subdomain}</p>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => handleAssign(t.id, showTenantsDialog.id)}>
                      Gán
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
