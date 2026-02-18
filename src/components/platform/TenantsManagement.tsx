import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  CheckCircle2
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

export function TenantsManagement() {
  const { data: tenants, isLoading } = useAllTenants();
  const { data: enrichmentMap } = useTenantEnrichment();
  const manageTenant = useManageTenant();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [actionDialog, setActionDialog] = useState<'lock' | 'unlock' | 'extend' | 'set_days' | null>(null);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('30');
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
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('_all_');
  const [usageFilter, setUsageFilter] = useState('_all_');
  const [websiteFilter, setWebsiteFilter] = useState('_all_');
  const [einvoiceFilter, setEinvoiceFilter] = useState('_all_');

  const filteredTenants = tenants?.filter(t => {
    // Text search
    const matchSearch = !search || 
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.subdomain.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase());
    
    // Status filter
    const matchStatus = statusFilter === '_all_' || t.status === statusFilter;
    
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
    
    return matchSearch && matchStatus && matchUsage && matchWebsite && matchEinvoice;
  });

  const handleAction = async () => {
    if (actionDialog === 'set_days') return; // handled separately
    if (!selectedTenant || !actionDialog) return;

    try {
      await manageTenant.mutateAsync({
        action: actionDialog as 'lock' | 'unlock' | 'extend',
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
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm doanh nghiệp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
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
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <Table>
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
                <TableHead>Store ID</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Sử dụng</TableHead>
                <TableHead>Gói dịch vụ</TableHead>
                <TableHead>HĐĐT</TableHead>
                <TableHead>Còn lại</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants?.map((tenant) => {
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
        </Card>
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
        {filteredTenants?.map((tenant) => {
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
                <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => {
                      setSelectedTenant(tenant);
                      setShowProductsDialog(true);
                    }}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Sản phẩm
                  </Button>
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => {
                      setSelectedTenant(tenant);
                      setSetDaysValue(String(calculateRemainingDays(tenant)));
                      setActionDialog('set_days');
                    }}
                  >
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Chỉnh ngày
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