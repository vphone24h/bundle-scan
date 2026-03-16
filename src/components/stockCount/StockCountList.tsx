import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Plus, Eye, Edit, X, PlayCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBranches } from '@/hooks/useBranches';
import { useStockCounts, StockCount, StockCountStatus } from '@/hooks/useStockCounts';

interface StockCountListProps {
  onCreateNew: () => void;
  onView: (stockCount: StockCount) => void;
  onEdit: (stockCount: StockCount) => void;
}

export function StockCountList({ onCreateNew, onView, onEdit }: StockCountListProps) {
  const { t } = useTranslation();
  const { data: branches } = useBranches();
  const [branchId, setBranchId] = useState<string>('');
  const [status, setStatus] = useState<StockCountStatus | ''>('');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });

  const { data: stockCounts, isLoading } = useStockCounts({
    branchId: branchId || undefined, status: status || undefined,
    startDate: dateRange.from?.toISOString(), endDate: dateRange.to?.toISOString(), search: search || undefined,
  });

  const clearFilters = () => { setBranchId(''); setStatus(''); setSearch(''); setDateRange({ from: undefined, to: undefined }); };
  const hasFilters = branchId || status || search || dateRange.from || dateRange.to;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button onClick={onCreateNew} className="gap-2"><Plus className="h-4 w-4" />{t('stockCount.createBtn')}</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-lg border">
        <div className="flex-1 min-w-[200px]">
          <SearchInput placeholder={t('stockCount.searchPlaceholder')} value={search} onChange={setSearch} />
        </div>
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={t('tours.inventory.branchLabel')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('stockCount.allBranches')}</SelectItem>
            {branches?.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as StockCountStatus | '')}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('stockCount.allStatus')}</SelectItem>
            <SelectItem value="draft">{t('stockCount.draft')}</SelectItem>
            <SelectItem value="confirmed">{t('stockCount.confirmed')}</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {dateRange.from ? (dateRange.to ? (<>{format(dateRange.from, 'dd/MM')} - {format(dateRange.to, 'dd/MM')}</>) : format(dateRange.from, 'dd/MM/yyyy')) : t('stockCount.dateRange')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar initialFocus mode="range" defaultMonth={dateRange.from} selected={{ from: dateRange.from, to: dateRange.to }} onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })} numberOfMonths={2} className="pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1"><X className="h-4 w-4" />{t('stockCount.clearFilters')}</Button>}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">{t('stockCount.receiptCode')}</TableHead>
              <TableHead>{t('stockCount.branchCol')}</TableHead>
              <TableHead>{t('stockCount.countDate')}</TableHead>
              <TableHead>{t('stockCount.countStaff')}</TableHead>
              <TableHead className="text-center">{t('stockCount.systemQty')}</TableHead>
              <TableHead className="text-center">{t('stockCount.actualQty')}</TableHead>
              <TableHead className="text-center">{t('stockCount.varianceQty')}</TableHead>
              <TableHead>{t('stockCount.statusCol')}</TableHead>
              <TableHead className="text-right">{t('stockCount.actionsCol')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="h-24 text-center"><div className="flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div></TableCell></TableRow>
            ) : stockCounts?.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="h-24 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 opacity-50" />
                  <p>{t('stockCount.noStockCounts')}</p>
                  <Button variant="outline" size="sm" onClick={onCreateNew}>{t('stockCount.createFirst')}</Button>
                </div>
              </TableCell></TableRow>
            ) : (
              stockCounts?.map((sc) => (
                <TableRow key={sc.id}>
                  <TableCell className="font-medium">{sc.code}</TableCell>
                  <TableCell>{sc.branchName || <span className="text-muted-foreground">{t('stockCount.allBranchLabel')}</span>}</TableCell>
                  <TableCell>{format(new Date(sc.countDate), 'dd/MM/yyyy', { locale: vi })}</TableCell>
                  <TableCell>{sc.createdByName || '-'}</TableCell>
                  <TableCell className="text-center"><Badge variant="outline">{sc.totalSystemQuantity}</Badge></TableCell>
                  <TableCell className="text-center"><Badge variant="secondary">{sc.totalActualQuantity}</Badge></TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn(sc.totalVariance < 0 ? 'bg-destructive text-destructive-foreground' : sc.totalVariance > 0 ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground')}>
                      {sc.totalVariance > 0 ? '+' : ''}{sc.totalVariance}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {sc.status === 'draft' ? (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">{t('stockCount.draftStatus')}</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{t('stockCount.confirmedStatus')}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onView(sc)} title={t('stockCount.viewDetail')}><Eye className="h-4 w-4" /></Button>
                      {sc.status === 'draft' && <Button variant="ghost" size="icon" onClick={() => onEdit(sc)} title={t('stockCount.editBtn')}><Edit className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}