import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CustomerDebtTable } from '@/components/debt/CustomerDebtTable';
import { SupplierDebtTable } from '@/components/debt/SupplierDebtTable';
import { DebtTagManager } from '@/components/debt/DebtTagManager';
import { DebtSettingsDialog } from '@/components/debt/DebtSettingsDialog';
import { DebtOffsetScanDialog } from '@/components/debt/DebtOffsetScanDialog';
import { DebtDueListDialog } from '@/components/debt/DebtDueListDialog';
import { useCustomerDebts, useSupplierDebts } from '@/hooks/useDebt';
import { useDebtTags } from '@/hooks/useDebtTags';
import { useDebtSettings } from '@/hooks/useDebtSettings';
import { useBranches } from '@/hooks/useBranches';
import { usePermissions } from '@/hooks/usePermissions';
import { formatNumber } from '@/lib/formatNumber';
import { Users, Truck, TrendingUp, TrendingDown, Building2, Hash, Settings, AlertTriangle, CalendarClock, UserCheck, Settings2, ArrowLeftRight } from 'lucide-react';

type QuickFilter = 'all' | 'due_today' | 'overdue' | 'hard_collect';

export default function DebtPage() {
  const { t } = useTranslation();
  const [showSettled, setShowSettled] = useState(false);
  const [branchFilter, setBranchFilter] = useState('_all_');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [showTagManager, setShowTagManager] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDueToday, setShowDueToday] = useState(false);
  const [showOverdue, setShowOverdue] = useState(false);
  const [showOffsetScan, setShowOffsetScan] = useState(false);
  
  const { data: permissions } = usePermissions();
  const { data: branches } = useBranches();
  const { data: tags } = useDebtTags();
  const { data: debtSettings } = useDebtSettings();
  const isSuperAdmin = permissions?.canViewAllBranches === true;
  const overdueDays = debtSettings?.overdue_days ?? 15;
  
  useEffect(() => {
    if (!isSuperAdmin && permissions?.branchId) {
      setBranchFilter(permissions.branchId);
    }
  }, [isSuperAdmin, permissions?.branchId]);
  
  const { data: customerDebts } = useCustomerDebts(false);
  const { data: supplierDebts } = useSupplierDebts(false);
  
  const filteredCustomerDebts = useMemo(() => {
    if (!customerDebts) return [];
    if (branchFilter === '_all_') return customerDebts;
    return customerDebts.filter(d => d.branch_id === branchFilter);
  }, [customerDebts, branchFilter]);

  const filteredSupplierDebts = useMemo(() => {
    if (!supplierDebts) return [];
    if (branchFilter === '_all_') return supplierDebts;
    return supplierDebts.filter(d => d.branch_id === branchFilter);
  }, [supplierDebts, branchFilter]);

  // Derived stats
  const totalCustomerDebt = filteredCustomerDebts.reduce((sum, d) => sum + d.remaining_amount, 0);
  const totalSupplierDebt = filteredSupplierDebts.reduce((sum, d) => sum + d.remaining_amount, 0);
  const activeCustomerDebtors = filteredCustomerDebts.filter(d => d.remaining_amount > 0).length;
  
  const dueTodayDebts = useMemo(() => {
    return filteredCustomerDebts.filter(d => {
      if (d.remaining_amount <= 0) return false;
      return d.days_overdue === overdueDays || d.days_overdue === overdueDays - 1;
    });
  }, [filteredCustomerDebts, overdueDays]);

  const overdueDebts = useMemo(() => {
    return filteredCustomerDebts.filter(d => {
      if (d.remaining_amount <= 0) return false;
      return d.days_overdue >= overdueDays;
    });
  }, [filteredCustomerDebts, overdueDays]);

  const dueTodayAmount = dueTodayDebts.reduce((sum, d) => sum + d.remaining_amount, 0);
  const overdueAmount = overdueDebts.reduce((sum, d) => sum + d.remaining_amount, 0);

  // Quick filter tags for the debt tables
  const effectiveTagFilter = tagFilter;
  const effectiveQuickFilter = quickFilter;

  return (
    <MainLayout>
      <PageHeader
        title={t('pages.debt.title')}
        description={t('pages.debt.description')}
        helpText={t('pages.debt.helpText')}
      />

      <div className="space-y-4">
        {/* Summary Cards - Row 1 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-green-200 bg-green-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => {}}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-7 w-7 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                </div>
                <span className="text-xs text-muted-foreground">{t('pages.debt.customerOwes')}</span>
              </div>
              <p className="text-base sm:text-xl font-bold text-green-600">
                {formatNumber(totalCustomerDebt)}đ
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                <UserCheck className="h-3 w-3 inline mr-0.5" />
                {activeCustomerDebtors} {t('pages.debt.customersOwing')}
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center">
                  <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                </div>
                <span className="text-xs text-muted-foreground">{t('pages.debt.weOweSupplier')}</span>
              </div>
              <p className="text-base sm:text-xl font-bold text-destructive">
                {formatNumber(totalSupplierDebt)}đ
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {filteredSupplierDebts.filter(d => d.remaining_amount > 0).length} {t('pages.debt.suppliers')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Summary Cards - Row 2: Due Today & Overdue */}
        <div className="grid grid-cols-2 gap-3">
          <Card
            className="border-orange-200 bg-orange-50/50 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setShowDueToday(true)}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-7 w-7 rounded-full bg-orange-100 flex items-center justify-center">
                  <CalendarClock className="h-3.5 w-3.5 text-orange-600" />
                </div>
                <span className="text-xs text-muted-foreground">{t('pages.debt.dueToday')}</span>
              </div>
              <p className="text-base sm:text-xl font-bold text-orange-600">
                {formatNumber(dueTodayAmount)}đ
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {dueTodayDebts.length} {t('pages.debt.items')}
              </p>
            </CardContent>
          </Card>
          
          <Card
            className={`cursor-pointer hover:shadow-md transition-shadow ${overdueDebts.length > 0 ? 'border-red-300 bg-red-50/70' : 'border-muted bg-muted/30'}`}
            onClick={() => setShowOverdue(true)}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center ${overdueDebts.length > 0 ? 'bg-red-100' : 'bg-muted'}`}>
                  <AlertTriangle className={`h-3.5 w-3.5 ${overdueDebts.length > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
                </div>
                <span className="text-xs text-muted-foreground">{t('pages.debt.overdue')}</span>
              </div>
              <p className={`text-base sm:text-xl font-bold ${overdueDebts.length > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {formatNumber(overdueAmount)}đ
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {overdueDebts.length > 0 ? t('pages.debt.itemsOverDays', { count: overdueDebts.length, days: overdueDays }) : t('pages.debt.none')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-muted/50 p-2 sm:p-3 rounded-lg">
          {isSuperAdmin && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[130px] sm:w-[180px] h-8 sm:h-9 text-xs sm:text-sm">
                <Building2 className="h-3.5 w-3.5 mr-1 shrink-0" />
                <SelectValue placeholder="Chi nhánh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">{t('pages.debt.allBranches')}</SelectItem>
                {branches?.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-1.5">
            <Checkbox
              id="showSettled"
              checked={showSettled}
              onCheckedChange={(checked) => setShowSettled(checked === true)}
            />
            <Label htmlFor="showSettled" className="text-xs sm:text-sm cursor-pointer">
              <span className="hidden sm:inline">{t('pages.debt.showSettled')}</span>
              <span className="sm:hidden">{t('pages.debt.settledShort')}</span>
            </Label>
          </div>
          <div className="flex gap-1 ml-auto">
            <Button variant="outline" size="sm" className="h-8 sm:h-9 gap-1 text-xs sm:text-sm" onClick={() => setShowSettings(true)}>
              <Settings2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('pages.debt.settings')}</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 sm:h-9 gap-1 text-xs sm:text-sm" onClick={() => setShowTagManager(true)}>
              <Settings className="h-3.5 w-3.5" />
              Hashtag
            </Button>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {([
            { key: 'all' as QuickFilter, label: t('pages.debt.all'), color: '' },
            { key: 'due_today' as QuickFilter, label: `${t('pages.debt.today')} (${dueTodayDebts.length})`, color: 'bg-orange-500' },
            { key: 'overdue' as QuickFilter, label: `${t('pages.debt.overdue')} (${overdueDebts.length})`, color: 'bg-red-500' },
            { key: 'hard_collect' as QuickFilter, label: t('pages.debt.hardCollect'), color: 'bg-gray-500' },
          ]).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setQuickFilter(quickFilter === f.key ? 'all' : f.key)}
              className="focus:outline-none shrink-0"
            >
              <Badge
                variant="outline"
                className={`cursor-pointer transition-all whitespace-nowrap ${
                  quickFilter === f.key
                    ? f.color ? `text-white border-0 ${f.color}` : 'bg-foreground text-background'
                    : 'hover:bg-muted'
                }`}
              >
                {f.label}
              </Badge>
            </button>
          ))}
        </div>

        {/* Tag filter */}
        {tags && tags.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
            <button
              type="button"
              onClick={() => setTagFilter(null)}
              className="focus:outline-none shrink-0"
            >
              <Badge
                variant="outline"
                className={`cursor-pointer transition-all whitespace-nowrap ${!tagFilter ? 'bg-foreground text-background' : 'hover:bg-muted'}`}
              >
                {t('pages.debt.all')}
              </Badge>
            </button>
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}
                className="focus:outline-none shrink-0"
              >
                <Badge
                  variant="outline"
                  className={`cursor-pointer transition-all text-white border-0 whitespace-nowrap ${tagFilter === tag.id ? 'ring-2 ring-offset-1 ring-foreground/30 scale-105' : 'opacity-70 hover:opacity-100'}`}
                  style={{ backgroundColor: tag.color }}
                >
                  #{tag.name}
                </Badge>
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="customer" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="customer" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">{t('pages.debt.customersTab')}</span>
              <span className="sm:hidden">{t('pages.debt.customersTabShort')}</span>
            </TabsTrigger>
            <TabsTrigger value="supplier" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">{t('pages.debt.suppliersTab')}</span>
              <span className="sm:hidden">{t('pages.debt.suppliersTabShort')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customer" className="mt-4">
            <CustomerDebtTable
              showSettled={showSettled}
              branchFilter={branchFilter}
              tagFilter={tagFilter}
              quickFilter={effectiveQuickFilter}
              overdueDays={overdueDays}
            />
          </TabsContent>

          <TabsContent value="supplier" className="mt-4">
            <SupplierDebtTable
              showSettled={showSettled}
              branchFilter={branchFilter}
              tagFilter={tagFilter}
              quickFilter={effectiveQuickFilter}
              overdueDays={overdueDays}
            />
          </TabsContent>
        </Tabs>
      </div>

      <DebtTagManager open={showTagManager} onOpenChange={setShowTagManager} />
      <DebtSettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      <DebtDueListDialog
        open={showDueToday}
        onOpenChange={setShowDueToday}
        title={t('pages.debt.dueTodayTitle')}
        debts={dueTodayDebts}
        overdueDays={overdueDays}
      />
      <DebtDueListDialog
        open={showOverdue}
        onOpenChange={setShowOverdue}
        title={t('pages.debt.overdueTitle')}
        debts={overdueDebts}
        overdueDays={overdueDays}
      />
    </MainLayout>
  );
}
