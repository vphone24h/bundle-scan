import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useWarehouseValue, type BranchValue } from '@/hooks/useWarehouseValue';
import { useBranches } from '@/hooks/useBranches';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { usePermissions } from '@/hooks/usePermissions';
import { useSecurityPasswordStatus, useSecurityUnlock } from '@/hooks/useSecurityPassword';
import { formatNumber } from '@/lib/formatNumber';
import { Package, Wallet, Users, Truck, TrendingUp, Building2, EyeOff, BarChart3, Database } from 'lucide-react';
import { WarehouseValueChart } from './WarehouseValueChart';
import { WarehouseValueHistory } from './WarehouseValueHistory';
import {
  startOfDay, subDays, startOfWeek, startOfMonth, startOfYear,
  endOfDay, endOfWeek, endOfMonth, format
} from 'date-fns';
import { vi } from 'date-fns/locale';

const DATE_FILTERS = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' },
  { value: 'this_week', label: 'Tuần này' },
  { value: 'this_month', label: 'Tháng này' },
  { value: 'this_year', label: 'Năm nay' },
  { value: 'custom', label: 'Tùy chọn' },
];

function getDateRange(filter: string) {
  const now = new Date();
  switch (filter) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case 'this_week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case 'this_month':
      return { from: startOfMonth(now), to: endOfDay(now) };
    case 'this_year':
      return { from: startOfYear(now), to: endOfDay(now) };
    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}

function ValueCard({
  label, value, icon: Icon, color, bg, prefix, hidden,
}: {
  label: string; value: number; icon: React.ElementType;
  color: string; bg: string; prefix?: string; hidden?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 sm:p-3 rounded-lg ${bg}`}>
            {hidden ? (
              <EyeOff className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            ) : (
              <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${color}`} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
            <p className={`text-xs sm:text-base font-bold break-all leading-tight ${hidden ? 'text-muted-foreground' : color}`}>
              {hidden ? '••••••' : `${prefix || ''}${formatNumber(value)} đ`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BranchRow({ branch, hidden }: { branch: BranchValue; hidden: boolean }) {
  return (
    <div className="border rounded-lg p-3 sm:p-4 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm sm:text-base">{branch.branchName}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tồn kho:</span>
          <span className="font-medium">{hidden ? '••••' : `${formatNumber(branch.inventoryValue)} đ`}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Số dư quỹ:</span>
          <span className={`font-medium ${branch.cashBalance < 0 ? 'text-destructive' : ''}`}>
            {hidden ? '••••' : `${formatNumber(branch.cashBalance)} đ`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">CN Khách hàng:</span>
          <span className="font-medium">{hidden ? '••••' : `${formatNumber(branch.customerDebt)} đ`}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">CN Nhà cung cấp:</span>
          <span className="font-medium">{hidden ? '••••' : `${formatNumber(branch.supplierDebt)} đ`}</span>
        </div>
      </div>
      <div className="border-t pt-2 flex justify-between items-center">
        <span className="font-semibold text-xs sm:text-sm">Giá trị chi nhánh:</span>
        <span className={`font-bold text-sm sm:text-base ${branch.totalValue < 0 ? 'text-destructive' : 'text-primary'}`}>
          {hidden ? '••••••' : `${formatNumber(branch.totalValue)} đ`}
        </span>
      </div>
    </div>
  );
}

function DateFilterLabel({ filter, customFrom, customTo }: { filter: string; customFrom?: string; customTo?: string }) {
  if (filter === 'custom' && customFrom && customTo) {
    return <span className="text-xs text-muted-foreground">Từ {customFrom} đến {customTo}</span>;
  }
  const label = DATE_FILTERS.find(f => f.value === filter)?.label || '';
  const range = getDateRange(filter);
  const dateStr = filter === 'today' || filter === 'yesterday'
    ? format(range.from, 'dd/MM/yyyy', { locale: vi })
    : `${format(range.from, 'dd/MM')} - ${format(range.to, 'dd/MM/yyyy')}`;
  return <span className="text-xs text-muted-foreground">{dateStr}</span>;
}

export function WarehouseValueReport() {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const { data: branches } = useBranches();
  const { shouldFilter } = useBranchFilter();
  const { data: permissions } = usePermissions();
  const canViewImportPrice = permissions?.canViewImportPrice ?? false;

  const { data: hasSecurityPassword } = useSecurityPasswordStatus();
  const { unlocked: reportsUnlocked } = useSecurityUnlock('reports_page');
  const valueHidden = hasSecurityPassword && !reportsUnlocked;

  const { data, isLoading } = useWarehouseValue(
    selectedBranch !== 'all' ? selectedBranch : undefined
  );

  if (!canViewImportPrice) {
    return (
      <p className="text-muted-foreground text-sm">Bạn không có quyền xem báo cáo này.</p>
    );
  }

  return (
    <Tabs defaultValue="data" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="data" className="flex items-center gap-1.5 text-xs sm:text-sm">
          <Database className="h-3.5 w-3.5" />
          Số liệu
        </TabsTrigger>
        <TabsTrigger value="chart" className="flex items-center gap-1.5 text-xs sm:text-sm">
          <BarChart3 className="h-3.5 w-3.5" />
          Biểu đồ tăng trưởng
        </TabsTrigger>
      </TabsList>

      {/* DATA TAB */}
      <TabsContent value="data" className="space-y-4">
        {/* Filters row */}
        <div className="flex flex-wrap gap-2">
          {!shouldFilter && (
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="flex-1 min-w-[140px]">
                <SelectValue placeholder="Chọn chi nhánh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toàn bộ kho</SelectItem>
                {branches?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>
        ) : data ? (
          <>
            {/* Total Value - Hero Card */}
            <Card className="border-2 border-primary/30">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 sm:p-4 rounded-xl bg-primary/10">
                    {valueHidden ? (
                      <EyeOff className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                    ) : (
                      <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground">Giá trị toàn kho</p>
                    <p className={`text-lg sm:text-2xl font-bold break-all leading-tight ${valueHidden ? 'text-muted-foreground' : data.totalValue < 0 ? 'text-destructive' : 'text-primary'}`}>
                      {valueHidden ? '••••••••' : `${formatNumber(data.totalValue)} đ`}
                    </p>
                    {!valueHidden && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                        = Tồn kho + Số dư quỹ + CN khách hàng - CN nhà cung cấp
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4 Component Cards */}
            <div className="grid grid-cols-2 gap-3">
              <ValueCard
                label="Giá trị tồn kho"
                value={data.inventoryValue}
                icon={Package}
                color="text-emerald-600"
                bg="bg-emerald-500/10"
                hidden={valueHidden}
              />
              <ValueCard
                label="Tổng số dư sổ quỹ"
                value={data.cashBalance}
                icon={Wallet}
                color={data.cashBalance < 0 ? 'text-destructive' : 'text-blue-600'}
                bg={data.cashBalance < 0 ? 'bg-destructive/10' : 'bg-blue-500/10'}
                hidden={valueHidden}
              />
              <ValueCard
                label="Công nợ khách hàng"
                value={data.customerDebt}
                icon={Users}
                color="text-violet-600"
                bg="bg-violet-500/10"
                prefix="+ "
                hidden={valueHidden}
              />
              <ValueCard
                label="Công nợ NCC"
                value={data.supplierDebt}
                icon={Truck}
                color="text-orange-600"
                bg="bg-orange-500/10"
                prefix="- "
                hidden={valueHidden}
              />
            </div>

            {/* Branch Breakdown */}
            {data.branches.length > 0 && selectedBranch === 'all' && (
              <Card>
                <CardHeader className="p-3 sm:p-4 pb-2">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Chi tiết theo chi nhánh
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0 space-y-3">
                  {data.branches
                    .sort((a, b) => b.totalValue - a.totalValue)
                    .map((branch) => (
                      <BranchRow key={branch.branchId} branch={branch} hidden={valueHidden} />
                    ))}
                </CardContent>
              </Card>
            )}

            {/* Value History */}
            {!valueHidden && (
              <WarehouseValueHistory
                currentData={data}
              />
            )}
          </>
        ) : null}
      </TabsContent>

      {/* CHART TAB */}
      <TabsContent value="chart">
        <WarehouseValueChart />
      </TabsContent>
    </Tabs>
  );
}
