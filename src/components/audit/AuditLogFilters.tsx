import { useState } from 'react';
import { Search, Filter, Calendar, Users, Building2, Wallet, Download, Upload, CreditCard, ClipboardList, Settings, List, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranches } from '@/hooks/useBranches';
import { useAuditLogUsers, AuditLogFilters } from '@/hooks/useAuditLogs';
import { ActionGroup, ACTION_LABELS, TIME_FILTER_LABELS, TimeFilter } from '@/types/auditLog';

const ACTION_GROUP_ICONS: Record<ActionGroup, React.ReactNode> = {
  all: <List className="h-4 w-4" />,
  cashbook: <Wallet className="h-4 w-4" />,
  import: <Download className="h-4 w-4" />,
  export: <Upload className="h-4 w-4" />,
  debt: <CreditCard className="h-4 w-4" />,
  stock_count: <ClipboardList className="h-4 w-4" />,
  system: <Settings className="h-4 w-4" />,
};

const ACTION_GROUP_LABELS: Record<ActionGroup, string> = {
  all: 'Tất cả',
  cashbook: 'Sổ quỹ',
  import: 'Nhập hàng',
  export: 'Xuất hàng',
  debt: 'Công nợ',
  stock_count: 'Kiểm kho',
  system: 'Hệ thống',
};

interface AuditLogFiltersProps {
  filters: AuditLogFilters;
  onFiltersChange: (filters: AuditLogFilters) => void;
}

export function AuditLogFiltersComponent({ filters, onFiltersChange }: AuditLogFiltersProps) {
  const { data: permissions } = usePermissions();
  const { data: branches } = useBranches();
  const { data: users } = useAuditLogUsers();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = <K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleActionType = (actionType: string) => {
    const current = filters.actionTypes;
    if (actionType === 'all') {
      updateFilter('actionTypes', []);
    } else if (current.includes(actionType)) {
      updateFilter('actionTypes', current.filter(t => t !== actionType));
    } else {
      updateFilter('actionTypes', [...current, actionType]);
    }
  };

  const toggleUser = (userId: string) => {
    const current = filters.userIds;
    if (current.includes(userId)) {
      updateFilter('userIds', current.filter(id => id !== userId));
    } else {
      updateFilter('userIds', [...current, userId]);
    }
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      actionTypes: [],
      actionGroup: 'all',
      branchId: 'all',
      userIds: [],
      timeFilter: 'all',
    });
  };

  const hasActiveFilters = 
    filters.search ||
    filters.actionTypes.length > 0 ||
    filters.actionGroup !== 'all' ||
    filters.branchId !== 'all' ||
    filters.userIds.length > 0 ||
    filters.timeFilter !== 'all';

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã thao tác, IMEI, tên sản phẩm, mã phiếu, nội dung..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Quick filters row */}
        <div className="flex flex-wrap gap-2">
          {/* Time filter */}
          <Select value={filters.timeFilter} onValueChange={(v) => updateFilter('timeFilter', v as TimeFilter)}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {Object.entries(TIME_FILTER_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Action group filter */}
          <Select value={filters.actionGroup} onValueChange={(v) => updateFilter('actionGroup', v as ActionGroup)}>
            <SelectTrigger className="w-[140px]">
              {ACTION_GROUP_ICONS[filters.actionGroup]}
              <SelectValue className="ml-2" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {Object.entries(ACTION_GROUP_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    {ACTION_GROUP_ICONS[key as ActionGroup]}
                    {label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Branch filter - only for super_admin */}
          {permissions?.role === 'super_admin' && (
            <Select value={filters.branchId} onValueChange={(v) => updateFilter('branchId', v)}>
              <SelectTrigger className="w-[160px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Chi nhánh" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Tất cả chi nhánh</SelectItem>
                {branches?.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Toggle advanced filters */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="ml-auto"
          >
            <Filter className="h-4 w-4 mr-2" />
            Lọc nâng cao
            {showAdvanced ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Xóa bộ lọc
            </Button>
          )}
        </div>

        {/* Custom date range */}
        {filters.timeFilter === 'custom' && (
          <div className="flex flex-wrap gap-2 items-center">
            <Label className="text-sm text-muted-foreground">Từ:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  {filters.customStartDate 
                    ? format(filters.customStartDate, 'dd/MM/yyyy', { locale: vi })
                    : 'Chọn ngày'
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover" align="start">
                <CalendarComponent
                  mode="single"
                  selected={filters.customStartDate}
                  onSelect={(date) => updateFilter('customStartDate', date)}
                  locale={vi}
                />
              </PopoverContent>
            </Popover>
            <Label className="text-sm text-muted-foreground">Đến:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  {filters.customEndDate 
                    ? format(filters.customEndDate, 'dd/MM/yyyy', { locale: vi })
                    : 'Chọn ngày'
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover" align="start">
                <CalendarComponent
                  mode="single"
                  selected={filters.customEndDate}
                  onSelect={(date) => updateFilter('customEndDate', date)}
                  locale={vi}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Advanced filters */}
        <Collapsible open={showAdvanced}>
          <CollapsibleContent className="space-y-4 pt-2 border-t">
            {/* Action types */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Loại thao tác</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ACTION_LABELS).map(([key, { label, color }]) => (
                  <Badge
                    key={key}
                    variant={filters.actionTypes.includes(key) ? 'default' : 'outline'}
                    className={`cursor-pointer transition-all ${
                      filters.actionTypes.includes(key) ? `${color} text-white` : ''
                    }`}
                    onClick={() => toggleActionType(key)}
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* User filter */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                <Users className="h-4 w-4 inline mr-2" />
                Nhân viên
              </Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {users?.map(user => (
                  <Badge
                    key={user.user_id}
                    variant={filters.userIds.includes(user.user_id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleUser(user.user_id)}
                  >
                    {user.display_name}
                    <span className="ml-1 text-xs opacity-70">
                      ({user.user_role === 'super_admin' ? 'Admin' : 
                        user.user_role === 'branch_admin' ? 'QL' : 
                        user.user_role === 'cashier' ? 'TN' : 'NV'})
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Active filters summary */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-1 pt-2 border-t">
            <span className="text-xs text-muted-foreground mr-2">Đang lọc:</span>
            {filters.search && (
              <Badge variant="secondary" className="text-xs">
                Tìm: "{filters.search}"
              </Badge>
            )}
            {filters.timeFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {TIME_FILTER_LABELS[filters.timeFilter]}
              </Badge>
            )}
            {filters.actionGroup !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {ACTION_GROUP_LABELS[filters.actionGroup]}
              </Badge>
            )}
            {filters.branchId !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {branches?.find(b => b.id === filters.branchId)?.name}
              </Badge>
            )}
            {filters.actionTypes.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filters.actionTypes.length} loại thao tác
              </Badge>
            )}
            {filters.userIds.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filters.userIds.length} nhân viên
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
