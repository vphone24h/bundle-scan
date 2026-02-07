import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Download, AlertTriangle, CheckCircle2, Info, Building2, FolderTree } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { vi } from 'date-fns/locale';
import { useReportStats, useReportChartData } from '@/hooks/useReportStats';
import { formatCurrency } from '@/lib/mockData';
import { exportToExcel } from '@/lib/exportExcel';
import { useBranches } from '@/hooks/useBranches';
import { useCategories } from '@/hooks/useCategories';
import { usePermissions } from '@/hooks/usePermissions';

// ---- Constants ----
const INDUSTRIES = [
  { value: 'thuong_mai', label: 'Thương mại', gtgt: 1, tncn: 0.5, hint: 'Bán iPhone chọn mục này' },
  { value: 'dich_vu', label: 'Dịch vụ', gtgt: 5, tncn: 2 },
  { value: 'san_xuat', label: 'Sản xuất', gtgt: 3, tncn: 1.5 },
  { value: 'van_tai', label: 'Vận tải – Ăn uống', gtgt: 3, tncn: 1.5 },
  { value: 'cho_thue', label: 'Cho thuê tài sản', gtgt: 5, tncn: 5 },
];

const REVENUE_TIERS = [
  { value: 'under_500m', label: 'Dưới 500 triệu', exempt: true },
  { value: '500m_3b', label: 'Từ 500tr đến dưới 3 tỷ', exempt: false },
  { value: '3b_50b', label: 'Từ 3 tỷ đến dưới 50 tỷ', exempt: false },
  { value: 'over_50b', label: 'Trên 50 tỷ', exempt: false, forceRevenue: true },
];

const TAX_METHODS = [
  { value: 'revenue', label: 'Theo doanh số' },
  { value: 'profit', label: 'Theo lợi nhuận' },
];

function getTimePeriod(preset: string) {
  const now = new Date();
  const year = now.getFullYear();

  switch (preset) {
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now), label: `Tháng ${now.getMonth() + 1}/${year}` };
    case 'q1':
      return { start: new Date(year, 0, 1), end: new Date(year, 2, 31), label: `Quý 1/${year}` };
    case 'q2':
      return { start: new Date(year, 3, 1), end: new Date(year, 5, 30), label: `Quý 2/${year}` };
    case 'q3':
      return { start: new Date(year, 6, 1), end: new Date(year, 8, 30), label: `Quý 3/${year}` };
    case 'q4':
      return { start: new Date(year, 9, 1), end: new Date(year, 11, 31), label: `Quý 4/${year}` };
    case 'this_year':
      return { start: startOfYear(now), end: endOfYear(now), label: `Năm ${year}` };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now), label: `Tháng ${now.getMonth() + 1}/${year}` };
  }
}

export function TaxReport() {
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState('this_month');
  const [industry, setIndustry] = useState<string>('');
  const [revenueTier, setRevenueTier] = useState<string>('');
  const [taxMethod, setTaxMethod] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  const { data: branches } = useBranches();
  const { data: categories } = useCategories();
  const { data: permissions } = usePermissions();

  const period = getTimePeriod(timePeriod);
  const startDate = format(period.start, 'yyyy-MM-dd');
  const endDate = format(period.end, 'yyyy-MM-dd');

  // Branch Admin: chỉ xem được chi nhánh của mình
  const effectiveBranchId = permissions?.role === 'branch_admin'
    ? permissions.branchId || undefined
    : selectedBranchId === 'all' ? undefined : selectedBranchId;
  const effectiveCategoryId = selectedCategoryId === 'all' ? undefined : selectedCategoryId;

  const { data: stats, isLoading: statsLoading } = useReportStats({ startDate, endDate, branchId: effectiveBranchId, categoryId: effectiveCategoryId });
  const { data: chartData, isLoading: chartLoading } = useReportChartData({ startDate, endDate, branchId: effectiveBranchId, groupBy: 'day' });

  // Auto-force tax method when revenue tier is over_50b
  const selectedTier = REVENUE_TIERS.find(t => t.value === revenueTier);
  const effectiveTaxMethod = selectedTier?.forceRevenue ? 'revenue' : taxMethod;

  const selectedIndustry = INDUSTRIES.find(i => i.value === industry);
  const allStepsComplete = !!industry && !!revenueTier && (!!effectiveTaxMethod || selectedTier?.exempt);
  const isExempt = selectedTier?.exempt;

  // Tax calculation
  const taxResult = useMemo(() => {
    if (!allStepsComplete || !stats) return null;
    if (isExempt) return { gtgt: 0, tncn: 0, total: 0, exempt: true };
    if (!selectedIndustry) return null;

    const revenue = stats.netRevenue; // Doanh thu thuần (đã trừ trả hàng)
    const gtgt = revenue * (selectedIndustry.gtgt / 100);

    let tncn = 0;
    if (effectiveTaxMethod === 'revenue') {
      const taxableRevenue = Math.max(0, revenue - 500_000_000);
      tncn = taxableRevenue * (selectedIndustry.tncn / 100);
    } else if (effectiveTaxMethod === 'profit') {
      tncn = Math.max(0, stats.netProfit) * 0.15;
    }

    return { gtgt, tncn, total: gtgt + tncn, exempt: false };
  }, [allStepsComplete, stats, isExempt, selectedIndustry, effectiveTaxMethod]);

  const handleExportExcel = () => {
    if (!chartData || !selectedIndustry) return;

    const dailyData = chartData.map((day, idx) => ({
      stt: idx + 1,
      date: format(new Date(day.date), 'dd/MM/yyyy'),
      description: `Ngành ${selectedIndustry.label} trong ngày`,
      amount: day.revenue,
    }));

    const totalRevenue = dailyData.reduce((sum, d) => sum + d.amount, 0);
    const netRevenue = stats?.netRevenue || totalRevenue;

    // Add summary rows
    const summaryRows = [
      { stt: '', date: '', description: 'Tổng cộng (Doanh thu thuần)', amount: netRevenue },
      { stt: '', date: '', description: `Thuế GTGT (${selectedIndustry.gtgt}%)`, amount: taxResult?.gtgt || 0 },
      { stt: '', date: '', description: `Thuế TNCN`, amount: taxResult?.tncn || 0 },
      { stt: '', date: '', description: 'Tổng số thuế GTGT phải nộp', amount: taxResult?.gtgt || 0 },
      { stt: '', date: '', description: 'Tổng số thuế TNCN phải nộp', amount: taxResult?.tncn || 0 },
    ];

    exportToExcel({
      filename: `BC_Thue_${period.label.replace(/[\/\s]/g, '_')}`,
      sheetName: 'Sổ doanh thu',
      columns: [
        { header: 'Số hiệu (A)', key: 'stt', width: 10 },
        { header: 'Ngày, tháng (B)', key: 'date', width: 15 },
        { header: 'Diễn giải (C)', key: 'description', width: 40 },
        { header: 'Số tiền (1)', key: 'amount', width: 20, isNumeric: true },
      ],
      data: [...dailyData, ...summaryRows],
    });
  };

  return (
    <div className="space-y-4">
      {/* Time Period Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'this_month', label: 'Tháng này' },
              { value: 'q1', label: 'Quý 1' },
              { value: 'q2', label: 'Quý 2' },
              { value: 'q3', label: 'Quý 3' },
              { value: 'q4', label: 'Quý 4' },
              { value: 'this_year', label: 'Năm nay' },
            ].map(p => (
              <Button
                key={p.value}
                variant={timePeriod === p.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimePeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Kỳ báo cáo: <strong>{period.label}</strong> ({format(period.start, 'dd/MM/yyyy')} – {format(period.end, 'dd/MM/yyyy')})
          </p>
        </CardContent>
      </Card>

      {/* Branch & Category Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Branch Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Chi nhánh
              </label>
              <Select
                value={permissions?.role === 'branch_admin' ? (permissions.branchId || 'all') : selectedBranchId}
                onValueChange={setSelectedBranchId}
                disabled={permissions?.role === 'branch_admin'}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tất cả chi nhánh" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Tất cả chi nhánh</SelectItem>
                  {branches?.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FolderTree className="h-3.5 w-3.5" />
                Danh mục
              </label>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tất cả danh mục" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Tất cả danh mục</SelectItem>
                  {categories?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3-Step Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Chọn đủ 3 bước để hiện số thuế phải đóng
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Hệ thống tự động lấy doanh thu hoặc lợi nhuận trong kho để xuất báo cáo
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Step 1: Industry */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={industry ? 'default' : 'outline'} className="text-xs">B1</Badge>
              <span className="font-medium text-sm">Chọn ngành nghề</span>
              {industry && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            </div>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Chọn ngành nghề..." /></SelectTrigger>
              <SelectContent className="bg-popover">
                {INDUSTRIES.map(i => (
                  <SelectItem key={i.value} value={i.value}>
                    <div className="flex items-center gap-2">
                      <span>{i.label}</span>
                      <span className="text-xs text-muted-foreground">(GTGT {i.gtgt}% – TNCN {i.tncn}%)</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Industry rates table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Ngành</TableHead>
                    <TableHead className="text-xs text-center">GTGT</TableHead>
                    <TableHead className="text-xs text-center">TNCN</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {INDUSTRIES.map(i => (
                    <TableRow key={i.value} className={industry === i.value ? 'bg-primary/5' : ''}>
                      <TableCell className="text-xs py-1.5">
                        {i.label}
                        {i.hint && <span className="block text-[10px] text-muted-foreground italic">💡 {i.hint}</span>}
                      </TableCell>
                      <TableCell className="text-xs text-center py-1.5">{i.gtgt}%</TableCell>
                      <TableCell className="text-xs text-center py-1.5">{i.tncn}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Step 2: Revenue Tier */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={revenueTier ? 'default' : 'outline'} className="text-xs">B2</Badge>
              <span className="font-medium text-sm">Ước chừng doanh thu 1 năm</span>
              {revenueTier && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            </div>
            <Select value={revenueTier} onValueChange={(v) => {
              setRevenueTier(v);
              const tier = REVENUE_TIERS.find(t => t.value === v);
              if (tier?.forceRevenue) setTaxMethod('revenue');
            }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Chọn mức doanh thu..." /></SelectTrigger>
              <SelectContent className="bg-popover">
                {REVENUE_TIERS.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}{t.exempt ? ' (Không phải đóng thuế)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 3: Tax Method */}
          {!isExempt && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={effectiveTaxMethod ? 'default' : 'outline'} className="text-xs">B3</Badge>
                <span className="font-medium text-sm">Cách tính thuế TNCN</span>
                {effectiveTaxMethod && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              </div>
              <Select
                value={effectiveTaxMethod}
                onValueChange={setTaxMethod}
                disabled={selectedTier?.forceRevenue}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Chọn cách tính thuế..." /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {TAX_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTier?.forceRevenue && (
                <p className="text-xs text-muted-foreground italic">
                  ⚠️ Doanh thu trên 50 tỷ bắt buộc tính theo doanh số
                </p>
              )}
              <div className="mt-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p>• <strong>Theo doanh số:</strong> TNCN = (Doanh thu − 500.000.000) × Thuế suất TNCN</p>
                <p>• <strong>Theo lợi nhuận:</strong> TNCN = Lợi nhuận thuần × 15% <em>(phải có hóa đơn đầu vào)</em></p>
                <p className="italic pt-1">Cả 2 cách đều hợp lệ, hãy chọn cách nào cho số thuế thấp hơn để tối ưu nhất.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tax Result */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : allStepsComplete && taxResult && (
        <>
          {isExempt ? (
            <Card className="border-2 border-green-500 bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="pt-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                <p className="text-lg font-bold text-green-700 dark:text-green-400">Không phải đóng thuế</p>
                <p className="text-sm text-muted-foreground mt-1">Doanh thu dưới 500 triệu/năm được miễn thuế</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg">Kết quả tính thuế – {period.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground">Thuế GTGT ({selectedIndustry?.gtgt}%)</p>
                      <p className="text-xl font-bold text-primary mt-1">{formatCurrency(taxResult.gtgt)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">= Doanh thu × {selectedIndustry?.gtgt}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground">
                        Thuế TNCN {effectiveTaxMethod === 'revenue' ? `(${selectedIndustry?.tncn}%)` : '(15% LN)'}
                      </p>
                      <p className="text-xl font-bold text-primary mt-1">{formatCurrency(taxResult.tncn)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {effectiveTaxMethod === 'revenue'
                          ? `= (DT - 500tr) × ${selectedIndustry?.tncn}%`
                          : '= Lợi nhuận thuần × 15%'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground font-medium">TỔNG THUẾ PHẢI NỘP</p>
                      <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(taxResult.total)}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Reference info */}
                <div className="text-xs space-y-1 text-muted-foreground bg-muted/30 rounded-lg p-3">
                <p>• Doanh thu thuần kỳ: {formatCurrency(stats?.netRevenue || 0)} <span className="italic">(đã trừ trả hàng: {formatCurrency(stats?.totalReturnRevenue || 0)})</span></p>
                  <p>• Lợi nhuận thuần kỳ: {formatCurrency(stats?.netProfit || 0)}</p>
                  {effectiveTaxMethod === 'revenue' && (
                    <p>• Cách tính TNCN: ({formatCurrency(stats?.netRevenue || 0)} - 500.000.000) × {selectedIndustry?.tncn}%</p>
                  )}
                </div>

                <p className="text-destructive text-xs font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Đây là báo cáo ước tính gần đúng 95-98%, không thể đúng 100%.
                </p>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full sm:w-auto"
                  onClick={() => navigate('/export/tax-policy')}
                >
                  <Info className="h-4 w-4 mr-1" />
                  Chi tiết mức thuế 2026
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Daily Detail Table */}
          {!isExempt && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ</CardTitle>
                <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={chartLoading || !chartData}>
                  <Download className="h-4 w-4 mr-1" />
                  Xuất Excel
                </Button>
              </CardHeader>
              <CardContent>
                {chartLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="max-h-[60vh] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="text-xs w-16">Số hiệu<br /><span className="text-muted-foreground italic">A</span></TableHead>
                          <TableHead className="text-xs w-24">Ngày, tháng<br /><span className="text-muted-foreground italic">B</span></TableHead>
                          <TableHead className="text-xs">Diễn giải<br /><span className="text-muted-foreground italic">C</span></TableHead>
                          <TableHead className="text-xs text-right w-28">Số tiền<br /><span className="text-muted-foreground italic">1</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Industry header row */}
                        <TableRow>
                          <TableCell className="text-xs" colSpan={1}></TableCell>
                          <TableCell className="text-xs" colSpan={2}>
                            <strong>1. Ngành nghề: {selectedIndustry?.label}</strong>
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                        {/* Daily rows */}
                        {chartData?.map((day, idx) => (
                          <TableRow key={day.date}>
                            <TableCell className="text-xs py-2">{idx + 1}</TableCell>
                            <TableCell className="text-xs py-2">{format(new Date(day.date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="text-xs py-2">Ngành {selectedIndustry?.label} trong ngày</TableCell>
                            <TableCell className="text-xs text-right py-2 font-mono">{formatCurrency(day.revenue)}</TableCell>
                          </TableRow>
                        ))}
                        {/* Summary rows */}
                        <TableRow className="border-t-2 font-medium">
                          <TableCell colSpan={3} className="text-xs text-right">Tổng cộng (Doanh thu thuần)</TableCell>
                          <TableCell className="text-xs text-right font-mono font-bold">{formatCurrency(stats?.netRevenue || 0)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={3} className="text-xs text-right">Thuế GTGT ({selectedIndustry?.gtgt}%)</TableCell>
                          <TableCell className="text-xs text-right font-mono">{formatCurrency(taxResult?.gtgt || 0)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={3} className="text-xs text-right">Thuế TNCN</TableCell>
                          <TableCell className="text-xs text-right font-mono">{formatCurrency(taxResult?.tncn || 0)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-primary/5">
                          <TableCell colSpan={3} className="text-xs text-right font-bold">Tổng số thuế GTGT phải nộp</TableCell>
                          <TableCell className="text-xs text-right font-mono font-bold text-primary">{formatCurrency(taxResult?.gtgt || 0)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-primary/5">
                          <TableCell colSpan={3} className="text-xs text-right font-bold">Tổng số thuế TNCN phải nộp</TableCell>
                          <TableCell className="text-xs text-right font-mono font-bold text-primary">{formatCurrency(taxResult?.tncn || 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
