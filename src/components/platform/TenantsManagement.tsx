import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  useAllTenants, 
  useManageTenant, 
  useTenantEnrichment,
  Tenant,
  calculateRemainingDays 
} from '@/hooks/useTenant';
import { useCompanies } from '@/hooks/useCompanies';
import { 
  Search, 
  Lock, 
  Unlock, 
  CalendarPlus, 
  MoreHorizontal,
  Building2,
  Loader2,
  FileText,
  Package,
  Mail,
  Filter,
  Globe,
  CheckCircle2,
  Pencil,
  Save
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
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { TenantProductsDialog } from './TenantProductsDialog';
import { BulkEmailDialog } from './BulkEmailDialog';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  trial: { label: 'Dùng thử', variant: 'secondary' },
  active: { label: 'Hoạt động', variant: 'default' },
  expired: { label: 'Hết hạn', variant: 'outline' },
  locked: { label: 'Bị khóa', variant: 'destructive' },
};

export function TenantsManagement({ filterByCompanyId }: { filterByCompanyId?: string }) {
  const { data: allTenants, isLoading } = useAllTenants();
  // If company admin, pre-filter tenants by company
  const tenants = filterByCompanyId 
    ? allTenants?.filter((t: any) => t.company_id === filterByCompanyId)
    : allTenants;
  const { data: enrichmentMap } = useTenantEnrichment();
  const manageTenant = useManageTenant();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [actionDialog, setActionDialog] = useState<'lock' | 'unlock' | 'extend' | 'set_days' | 'edit' | null>(null);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('30');
  const [extendMaxBranches, setExtendMaxBranches] = useState('');
  const [extendMaxUsers, setExtendMaxUsers] = useState('');
  const [setDaysValue, setSetDaysValue] = useState('0');
  const [settingDays, setSettingDays] = useState(false);
  const [togglingEinvoice, setTogglingEinvoice] = useState<string | null>(null);
  const [showProductsDialog, setShowProductsDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEmail, setShowBulkEmail] = useState(false);
  const [showBulkExtend, setShowBulkExtend] = useState(false);
  const [bulkExtendDays, setBulkExtendDays] = useState('7');
  const [bulkExtendNote, setBulkExtendNote] = useState('');
  const [bulkExtending, setBulkExtending] = useState(false);
  
  // Edit tenant states
  const [editName, setEditName] = useState('');
  const [editSubdomain, setEditSubdomain] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('_all_');
  const [usageFilter, setUsageFilter] = useState('_all_');
  const [websiteFilter, setWebsiteFilter] = useState('_all_');
  const [einvoiceFilter, setEinvoiceFilter] = useState('_all_');
  const [needFilter, setNeedFilter] = useState('_all_');
  const [companyFilter, setCompanyFilter] = useState('_all_');
  
  const { data: companies } = useCompanies();

  const [togglingInterest, setTogglingInterest] = useState<string | null>(null);
  const handleToggleTenantInterest = async (tenant: Tenant, next: boolean) => {
    setTogglingInterest(tenant.id);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ interest_enabled: next } as any)
        .eq('id', tenant.id);
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['all-tenants'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }),
        queryClient.invalidateQueries({ queryKey: ['current-tenant-combined'] }),
      ]);
      toast({ title: next ? 'Đã bật tính lãi cho shop' : 'Đã tắt tính lãi cho shop' });
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    } finally {
      setTogglingInterest(null);
    }
  };

  const filteredTenants = tenants?.filter(t => {
    // Text search
    const matchSearch = !search || 
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.subdomain.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase());
    
    // Status filter - "expired" also matches tenants with 0 remaining days regardless of DB status
    const matchStatus = statusFilter === '_all_' || 
      (statusFilter === 'expired' ? (t.status === 'expired' || calculateRemainingDays(t) <= 0) : t.status === statusFilter);
    
    // Usage filter (đã mua / chưa mua = has import/export receipts)
    const enrichment = enrichmentMap?.get(t.id);
    const matchUsage = usageFilter === '_all_' || 
      (usageFilter === 'used' && enrichment?.has_usage) ||
      (usageFilter === 'unused' && !enrichment?.has_usage);
    
    // Website filter
    const matchWebsite = websiteFilter === '_all_' ||
      (websiteFilter === 'enabled' && enrichment?.has_landing_enabled) ||
      (websiteFilter === 'disabled' && !enrichment?.has_landing_enabled);
    
    // HĐĐT filter
    const matchEinvoice = einvoiceFilter === '_all_' ||
      (einvoiceFilter === 'on' && t.einvoice_enabled) ||
      (einvoiceFilter === 'off' && !t.einvoice_enabled);
    
    // Business need filter
    const matchNeed = needFilter === '_all_' ||
      (t as any).business_need === needFilter;
    
    // Company filter
    const matchCompany = companyFilter === '_all_' ||
      (t as any).company_id === companyFilter;
    
    return matchSearch && matchStatus && matchUsage && matchWebsite && matchEinvoice && matchNeed && matchCompany;
  });

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, usageFilter, websiteFilter, einvoiceFilter, needFilter, companyFilter, filterByCompanyId]);

  const totalRows = filteredTenants?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedTenants = filteredTenants?.slice(pageStart, pageStart + PAGE_SIZE);

  const handleAction = async () => {
    if (actionDialog === 'set_days') return; // handled separately
    if (!selectedTenant || !actionDialog) return;

    try {
      await manageTenant.mutateAsync({
        action: actionDialog as 'lock' | 'unlock' | 'extend',
        tenantId: selectedTenant.id,
        reason: reason || undefined,
        days: actionDialog === 'extend' ? parseInt(days) : undefined,
        max_branches: actionDialog === 'extend' && extendMaxBranches ? parseInt(extendMaxBranches) : undefined,
        max_users: actionDialog === 'extend' && extendMaxUsers ? parseInt(extendMaxUsers) : undefined,
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
      setExtendMaxBranches('');
      setExtendMaxUsers('');
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSetDays = async () => {
    if (!selectedTenant) return;
    const numDays = parseInt(setDaysValue);
    if (isNaN(numDays) || numDays < 0) return;
    setSettingDays(true);
    try {
      // Tính ngày hết hạn mới dựa trên ngày hiện tại + số ngày còn lại
      let newEndDate: string;
      if (numDays === 0) {
        // Hết hạn ngay (đặt về hôm qua)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        newEndDate = yesterday.toISOString();
      } else {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + numDays);
        newEndDate = futureDate.toISOString();
      }

      const { error } = await supabase
        .from('tenants')
        .update({
          trial_end_date: selectedTenant.status === 'trial' ? newEndDate : selectedTenant.trial_end_date,
          subscription_end_date: selectedTenant.status !== 'trial' ? newEndDate : selectedTenant.subscription_end_date,
        })
        .eq('id', selectedTenant.id);

      if (error) throw error;

      toast({
        title: 'Thành công',
        description: numDays === 0
          ? `Đã đặt ${selectedTenant.name} về hết hạn (0 ngày)`
          : `Đã đặt ${selectedTenant.name} còn ${numDays} ngày`,
      });

      setActionDialog(null);
      setSelectedTenant(null);
      queryClient.invalidateQueries({ queryKey: ['all-tenants'] });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
    setSettingDays(false);
  };

  const handleToggleEinvoice = async (tenant: Tenant) => {
    setTogglingEinvoice(tenant.id);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ einvoice_enabled: !tenant.einvoice_enabled })
        .eq('id', tenant.id);
      
      if (error) throw error;
      
      toast({
        title: 'Thành công',
        description: tenant.einvoice_enabled 
          ? 'Đã tắt tính năng HĐĐT' 
          : 'Đã bật tính năng HĐĐT',
      });
      
      queryClient.invalidateQueries({ queryKey: ['all-tenants'] });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    }
    setTogglingEinvoice(null);
  };

  const handleBulkExtend = async () => {
    if (selectedIds.size === 0 || !bulkExtendDays) return;
    setBulkExtending(true);
    try {
      const response = await supabase.functions.invoke('manage-tenant', {
        body: {
          action: 'bulk_extend',
          tenantIds: Array.from(selectedIds),
          days: parseInt(bulkExtendDays),
          note: bulkExtendNote || `Tặng thêm ${bulkExtendDays} ngày sử dụng`,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      toast({
        title: 'Thành công',
        description: response.data.message,
      });
      setShowBulkExtend(false);
      setBulkExtendDays('7');
      setBulkExtendNote('');
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['all-tenants'] });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    }
    setBulkExtending(false);
  };

  const openEditDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setEditName(tenant.name);
    setEditSubdomain(tenant.subdomain);
    setEditEmail(tenant.email || '');
    setEditPassword('');
    setActionDialog('edit');
  };

  const handleSaveEdit = async () => {
    if (!selectedTenant) return;
    if (!editName.trim() || !editSubdomain.trim()) {
      toast({ title: 'Lỗi', description: 'Tên và ID cửa hàng không được để trống', variant: 'destructive' });
      return;
    }
    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    if (editSubdomain.length < 2 || !subdomainRegex.test(editSubdomain)) {
      toast({ title: 'Lỗi', description: 'ID cửa hàng chỉ chứa chữ thường, số và dấu gạch ngang', variant: 'destructive' });
      return;
    }

    setSavingEdit(true);
    try {
      // Check subdomain uniqueness if changed
      if (editSubdomain !== selectedTenant.subdomain) {
        const { data: isDuplicate } = await supabase.rpc('check_tenant_unique_field', {
          _field: 'subdomain',
          _value: editSubdomain,
          _exclude_tenant_id: selectedTenant.id,
        });
        if (isDuplicate) {
          toast({ title: 'Lỗi', description: 'ID cửa hàng đã tồn tại', variant: 'destructive' });
          setSavingEdit(false);
          return;
        }
      }

      // Check email uniqueness if changed
      if (editEmail.trim() && editEmail.trim() !== (selectedTenant.email || '')) {
        const { data: isDuplicateEmail } = await supabase.rpc('check_tenant_unique_field', {
          _field: 'email',
          _value: editEmail.trim(),
          _exclude_tenant_id: selectedTenant.id,
        });
        if (isDuplicateEmail) {
          toast({ title: 'Lỗi', description: 'Email đã được sử dụng bởi cửa hàng khác', variant: 'destructive' });
          setSavingEdit(false);
          return;
        }
      }

      const { error } = await supabase
        .from('tenants')
        .update({ 
          name: editName.trim(), 
          subdomain: editSubdomain.trim().toLowerCase(),
          email: editEmail.trim() || null,
        })
        .eq('id', selectedTenant.id);

      if (error) throw error;

      const normalizedName = editName.trim();
      const normalizedSubdomain = editSubdomain.trim().toLowerCase();
      const normalizedEmail = editEmail.trim() || null;

      queryClient.setQueriesData({ queryKey: ['all-tenants'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((item: any) =>
          item.id === selectedTenant.id
            ? {
                ...item,
                name: normalizedName,
                subdomain: normalizedSubdomain,
                email: normalizedEmail,
              }
            : item
        );
      });

      queryClient.setQueriesData({ queryKey: ['current-tenant-combined'] }, (old: any) => {
        if (!old || old.id !== selectedTenant.id) return old;
        return {
          ...old,
          name: normalizedName,
          subdomain: normalizedSubdomain,
          email: normalizedEmail,
        };
      });

      // Đổi mật khẩu (nếu có) — đồng bộ với hệ thống đăng nhập
      if (editPassword.trim()) {
        if (editPassword.length < 6) {
          toast({ title: 'Lỗi', description: 'Mật khẩu phải có ít nhất 6 ký tự', variant: 'destructive' });
          setSavingEdit(false);
          return;
        }
        const { data: tenantOwner } = await supabase
          .from('tenants')
          .select('owner_id')
          .eq('id', selectedTenant.id)
          .maybeSingle();
        const ownerId = tenantOwner?.owner_id;
        if (!ownerId) {
          toast({ title: 'Cảnh báo', description: 'Không tìm thấy chủ cửa hàng để đổi mật khẩu', variant: 'destructive' });
        } else {
          const { data: pwResult, error: pwError } = await supabase.functions.invoke('update-user', {
            body: { userId: ownerId, password: editPassword },
          });
          if (pwError) {
            let message = pwError.message || 'Không thể đổi mật khẩu';
            try {
              const body = typeof (pwError as any)?.context?.json === 'function'
                ? await (pwError as any).context.json()
                : null;
              if (body?.error) message = body.error;
            } catch {}
            throw new Error(message);
          }
          if (pwResult?.error) throw new Error(pwResult.error);
        }
      }

      toast({ title: 'Thành công', description: `Đã cập nhật thông tin ${editName}` });
      setActionDialog(null);
      setEditPassword('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['all-tenants'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['current-tenant-combined'], refetchType: 'all' }),
      ]);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
    setSavingEdit(false);
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
      {/* Search & Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <SearchInput
            placeholder="Tìm doanh nghiệp..."
            value={search}
            onChange={setSearch}
            containerClassName="flex-1 max-w-sm"
          />
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{selectedIds.size} đã chọn</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowBulkExtend(true)}
              >
                <CalendarPlus className="h-4 w-4 mr-1.5" />
                Gia hạn
              </Button>
              <Button
                size="sm"
                onClick={() => setShowBulkEmail(true)}
              >
                <Mail className="h-4 w-4 mr-1.5" />
                Gửi email
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Bỏ chọn
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-9 text-xs sm:text-sm">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">Tất cả TT</SelectItem>
              <SelectItem value="trial">Dùng thử</SelectItem>
              <SelectItem value="active">Hoạt động</SelectItem>
              <SelectItem value="expired">Hết hạn</SelectItem>
              <SelectItem value="locked">Bị khóa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={usageFilter} onValueChange={setUsageFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs sm:text-sm">
              <SelectValue placeholder="Sử dụng" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">Tất cả</SelectItem>
              <SelectItem value="used">Đã sử dụng</SelectItem>
              <SelectItem value="unused">Chưa sử dụng</SelectItem>
            </SelectContent>
          </Select>
          <Select value={websiteFilter} onValueChange={setWebsiteFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs sm:text-sm">
              <SelectValue placeholder="Website" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">Tất cả WS</SelectItem>
              <SelectItem value="enabled">Có website</SelectItem>
              <SelectItem value="disabled">Chưa có WS</SelectItem>
            </SelectContent>
          </Select>
          <Select value={einvoiceFilter} onValueChange={setEinvoiceFilter}>
            <SelectTrigger className="w-[120px] h-9 text-xs sm:text-sm">
              <SelectValue placeholder="HĐĐT" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">Tất cả HĐĐT</SelectItem>
              <SelectItem value="on">HĐĐT bật</SelectItem>
              <SelectItem value="off">HĐĐT tắt</SelectItem>
            </SelectContent>
          </Select>
          <Select value={needFilter} onValueChange={setNeedFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs sm:text-sm">
              <SelectValue placeholder="Nhu cầu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">Tất cả NC</SelectItem>
              <SelectItem value="warehouse">Quản lý kho</SelectItem>
              <SelectItem value="website">Website + Email</SelectItem>
              <SelectItem value="both">Cả 2</SelectItem>
            </SelectContent>
          </Select>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs sm:text-sm">
              <SelectValue placeholder="Công ty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">Tất cả CT</SelectItem>
              {companies?.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <div className="overflow-x-auto">
          <Table className="min-w-[1400px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={filteredTenants && filteredTenants.length > 0 && filteredTenants.every(t => selectedIds.has(t.id))}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds(new Set(filteredTenants?.map(t => t.id) || []));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Doanh nghiệp</TableHead>
                <TableHead>Ngành nghề</TableHead>
                <TableHead>Nhu cầu</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Sử dụng</TableHead>
                <TableHead>Gói dịch vụ</TableHead>
                <TableHead>HĐĐT</TableHead>
                <TableHead>Còn lại</TableHead>
                <TableHead>Công ty</TableHead>
                <TableHead>Tính lãi</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTenants?.map((tenant) => {
                const remaining = calculateRemainingDays(tenant);
                const status = statusConfig[tenant.status];
                const enrichment = enrichmentMap?.get(tenant.id);
                
                return (
                  <TableRow 
                    key={tenant.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedTenant(tenant);
                      setShowProductsDialog(true);
                    }}
                    >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(tenant.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedIds);
                          if (checked) next.add(tenant.id);
                          else next.delete(tenant.id);
                          setSelectedIds(next);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{tenant.name}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{(tenant as any).business_type || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {(tenant as any).business_need === 'warehouse' ? '📦 Quản lý kho' :
                         (tenant as any).business_need === 'website' ? '🌐 Website' :
                         (tenant as any).business_need === 'both' ? '🚀 Cả 2' : '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                        {tenant.subdomain}
                      </code>
                    </TableCell>
                    <TableCell>
                      {enrichment?.has_landing_enabled ? (
                        <a 
                          href={`https://${enrichment.landing_domain}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Globe className="h-3 w-3" />
                          {enrichment.landing_domain}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{tenant.email || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{tenant.phone || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {enrichment?.has_usage ? (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Đã sử dụng
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Chưa sử dụng</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {tenant.subscription_plan === 'monthly' && 'Tháng'}
                      {tenant.subscription_plan === 'yearly' && 'Năm'}
                      {tenant.subscription_plan === 'lifetime' && 'Vĩnh viễn'}
                      {!tenant.subscription_plan && '-'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={tenant.einvoice_enabled}
                        onCheckedChange={() => handleToggleEinvoice(tenant)}
                        disabled={togglingEinvoice === tenant.id}
                      />
                    </TableCell>
                    <TableCell>
                      <span className={remaining <= 7 ? 'text-destructive font-medium' : ''}>
                        {remaining > 36500 ? 'Vĩnh viễn' : `${remaining} ngày`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">
                        {companies?.find(c => c.id === (tenant as any).company_id)?.name || '-'}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={!!(tenant as any).interest_enabled}
                        disabled={togglingInterest === tenant.id}
                        onCheckedChange={(v) => handleToggleTenantInterest(tenant, v)}
                      />
                    </TableCell>
                    <TableCell>
                      {format(new Date(tenant.created_at), 'dd/MM/yyyy', { locale: vi })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(tenant)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Sửa thông tin
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedTenant(tenant);
                            setShowProductsDialog(true);
                          }}>
                            <Package className="h-4 w-4 mr-2" />
                            Xem sản phẩm
                          </DropdownMenuItem>
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
                          <DropdownMenuItem onClick={() => {
                            setSelectedTenant(tenant);
                            setSetDaysValue(String(calculateRemainingDays(tenant)));
                            setActionDialog('set_days');
                          }}>
                            <CalendarPlus className="h-4 w-4 mr-2" />
                            Chỉnh ngày còn lại
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </Card>
        {/* Pagination - Desktop */}
        {totalRows > 0 && (
          <div className="flex items-center justify-between mt-3 px-1 text-sm">
            <span className="text-muted-foreground">
              Hiển thị {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, totalRows)} / {totalRows} doanh nghiệp
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                Trước
              </Button>
              <span className="text-muted-foreground">Trang {currentPage}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Checkbox
            checked={filteredTenants && filteredTenants.length > 0 && filteredTenants.every(t => selectedIds.has(t.id))}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedIds(new Set(filteredTenants?.map(t => t.id) || []));
              } else {
                setSelectedIds(new Set());
              }
            }}
          />
          <span className="text-sm text-muted-foreground">Chọn tất cả</span>
        </div>
        {paginatedTenants?.map((tenant) => {
          const remaining = calculateRemainingDays(tenant);
          const status = statusConfig[tenant.status];
          const enrichment = enrichmentMap?.get(tenant.id);
          
          return (
            <Card 
              key={tenant.id} 
              className="cursor-pointer active:bg-muted/50"
              onClick={() => {
                setSelectedTenant(tenant);
                setShowProductsDialog(true);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(tenant.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedIds);
                          if (checked) next.add(tenant.id);
                          else next.delete(tenant.id);
                          setSelectedIds(next);
                        }}
                      />
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      {(tenant as any).business_type && (
                        <p className="text-xs text-muted-foreground">{(tenant as any).business_type}</p>
                      )}
                      {(tenant as any).business_need && (
                        <p className="text-xs text-muted-foreground">
                          {(tenant as any).business_need === 'warehouse' ? '📦 Quản lý kho' :
                           (tenant as any).business_need === 'website' ? '🌐 Website' :
                           (tenant as any).business_need === 'both' ? '🚀 Cả 2' : ''}
                        </p>
                      )}
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {tenant.subdomain}
                      </code>
                    </div>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  {enrichment?.has_landing_enabled && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Globe className="h-3 w-3" /> Website:
                      </span>
                      <a 
                        href={`https://${enrichment.landing_domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {enrichment.landing_domain}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span>{tenant.email || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">SĐT:</span>
                    <span>{tenant.phone || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Còn lại:</span>
                    <span className={remaining <= 7 ? 'text-destructive font-medium' : ''}>
                      {remaining > 36500 ? 'Vĩnh viễn' : `${remaining} ngày`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Trạng thái:</span>
                    {enrichment?.has_usage ? (
                      <Badge variant="default" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Đã sử dụng
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Chưa sử dụng</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" /> HĐĐT:
                    </span>
                    <Switch
                      checked={tenant.einvoice_enabled}
                      onCheckedChange={() => handleToggleEinvoice(tenant)}
                      disabled={togglingEinvoice === tenant.id}
                    />
                  </div>
                </div>
                <div className="mt-3 overflow-x-auto -mx-4 px-4 pb-1" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-2 min-w-max">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="shrink-0 h-9 text-xs px-3"
                      onClick={() => openEditDialog(tenant)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Sửa
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="shrink-0 h-9 text-xs px-3"
                      onClick={() => {
                        setSelectedTenant(tenant);
                        setShowProductsDialog(true);
                      }}
                    >
                      <Package className="h-3.5 w-3.5 mr-1.5" />
                      Sản phẩm
                    </Button>
                    {tenant.status !== 'locked' ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="shrink-0 h-9 text-xs px-3"
                        onClick={() => {
                          setSelectedTenant(tenant);
                          setActionDialog('lock');
                        }}
                      >
                        <Lock className="h-3.5 w-3.5 mr-1.5" />
                        Khóa
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="shrink-0 h-9 text-xs px-3"
                        onClick={() => {
                          setSelectedTenant(tenant);
                          setActionDialog('unlock');
                        }}
                      >
                        <Unlock className="h-3.5 w-3.5 mr-1.5" />
                        Mở khóa
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="shrink-0 h-9 text-xs px-3"
                      onClick={() => {
                        setSelectedTenant(tenant);
                        setActionDialog('extend');
                      }}
                    >
                      <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
                      Gia hạn
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="shrink-0 h-9 text-xs px-3"
                      onClick={() => {
                        setSelectedTenant(tenant);
                        setSetDaysValue(String(calculateRemainingDays(tenant)));
                        setActionDialog('set_days');
                      }}
                    >
                      <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
                      Chỉnh ngày
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {/* Pagination - Mobile */}
        {totalRows > 0 && (
          <div className="flex items-center justify-between pt-2 px-1 text-xs">
            <span className="text-muted-foreground">{pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, totalRows)}/{totalRows}</span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-8 px-2" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trước</Button>
              <span className="text-muted-foreground">{currentPage}/{totalPages}</span>
              <Button variant="outline" size="sm" className="h-8 px-2" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Sau</Button>
            </div>
          </div>
        )}
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
              <>
                <div className="space-y-2">
                  <Label>Số ngày gia hạn</Label>
                  <Input
                    type="number"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    min="1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Số chi nhánh tối đa</Label>
                    <Input
                      type="number"
                      value={extendMaxBranches}
                      onChange={(e) => setExtendMaxBranches(e.target.value)}
                      placeholder={String(selectedTenant?.max_branches || 1)}
                      min="1"
                    />
                    <p className="text-xs text-muted-foreground">Hiện tại: {selectedTenant?.max_branches || 1}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Số thành viên tối đa</Label>
                    <Input
                      type="number"
                      value={extendMaxUsers}
                      onChange={(e) => setExtendMaxUsers(e.target.value)}
                      placeholder={String(selectedTenant?.max_users || 5)}
                      min="1"
                    />
                    <p className="text-xs text-muted-foreground">Hiện tại: {selectedTenant?.max_users || 5}</p>
                  </div>
                </div>
              </>
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

      {/* Set Days Dialog */}
      <Dialog open={actionDialog === 'set_days'} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh ngày còn lại</DialogTitle>
            <DialogDescription>
              Thiết lập số ngày còn lại cho <strong>{selectedTenant?.name}</strong>. Đặt về 0 để test chế độ hết hạn.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Số ngày còn lại</Label>
              <Input
                type="number"
                min="0"
                max="36500"
                value={setDaysValue}
                onChange={(e) => setSetDaysValue(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Nhập 0 để đặt tài khoản về trạng thái hết hạn (để test quảng cáo)
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[0, 1, 7, 14, 30].map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={setDaysValue === String(d) ? 'default' : 'outline'}
                  onClick={() => setSetDaysValue(String(d))}
                >
                  {d === 0 ? 'Hết hạn' : `${d} ngày`}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Hủy</Button>
            <Button onClick={handleSetDays} disabled={settingDays}>
              {settingDays && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tenant Dialog */}
      <Dialog open={actionDialog === 'edit'} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Sửa thông tin cửa hàng
            </DialogTitle>
            <DialogDescription>
              Cập nhật tên, ID và email cho <strong>{selectedTenant?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tên cửa hàng</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nhập tên cửa hàng"
              />
            </div>
            <div className="space-y-2">
              <Label>ID cửa hàng (subdomain)</Label>
              <Input
                value={editSubdomain}
                onChange={(e) => setEditSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="vd: cuahang123"
              />
              <p className="text-xs text-muted-foreground">Chỉ chữ thường, số và dấu gạch ngang. Dùng để đăng nhập và truy cập website.</p>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Mật khẩu mới (tùy chọn)</Label>
              <Input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Để trống nếu không đổi"
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">Tối thiểu 6 ký tự. Khi lưu sẽ đồng bộ với hệ thống đăng nhập.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Hủy</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Products Dialog */}
      <TenantProductsDialog
        open={showProductsDialog}
        onOpenChange={setShowProductsDialog}
        tenantId={selectedTenant?.id || null}
        tenantName={selectedTenant?.name || ''}
      />

      {/* Bulk Email Dialog */}
      <BulkEmailDialog
        open={showBulkEmail}
        onOpenChange={setShowBulkEmail}
        tenants={
          tenants
            ?.filter(t => selectedIds.has(t.id))
            .map(t => ({ name: t.name, email: t.email || '' })) || []
        }
      />

      {/* Bulk Extend Dialog */}
      <Dialog open={showBulkExtend} onOpenChange={setShowBulkExtend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gia hạn hàng loạt</DialogTitle>
            <DialogDescription>
              Tặng thêm ngày sử dụng cho {selectedIds.size} doanh nghiệp đã chọn. Email thông báo sẽ được tự động gửi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Số ngày tặng thêm</Label>
              <Input
                type="number"
                value={bulkExtendDays}
                onChange={(e) => setBulkExtendDays(e.target.value)}
                min="1"
                placeholder="VD: 7"
              />
            </div>
            <div className="space-y-2">
              <Label>Ghi chú (hiển thị trong email)</Label>
              <Textarea
                value={bulkExtendNote}
                onChange={(e) => setBulkExtendNote(e.target.value)}
                placeholder="VD: Chúc mừng năm mới 2026! 🎊"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkExtend(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleBulkExtend}
              disabled={bulkExtending || !bulkExtendDays || parseInt(bulkExtendDays) < 1}
            >
              {bulkExtending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gia hạn {selectedIds.size} DN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}