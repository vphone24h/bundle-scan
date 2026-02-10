import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Loader2, Download, AlertTriangle, CheckCircle2, Info, Building2, FolderTree, Settings2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { vi } from 'date-fns/locale';
import { useReportStats, useReportChartData } from '@/hooks/useReportStats';
import { formatCurrency } from '@/lib/mockData';
import { exportToExcel } from '@/lib/exportExcel';
import * as XLSX from 'xlsx';
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
  { value: 'under_500m', label: 'Dưới 500 triệu', exempt: true, note: '' },
  { value: '500m_3b', label: 'Từ 500tr đến dưới 3 tỷ', exempt: false, note: 'TNCN 15%' },
  { value: '3b_50b', label: 'Từ 3 tỷ đến dưới 50 tỷ', exempt: false, note: 'TNCN 15%' },
  { value: 'over_50b', label: 'Trên 50 tỷ', exempt: false, note: 'TNCN 17%' },
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

  const [businessName, setBusinessName] = useState(() => localStorage.getItem('tax_business_name') || '');
  const [taxCode, setTaxCode] = useState(() => localStorage.getItem('tax_code') || '');
  const [businessAddress, setBusinessAddress] = useState(() => localStorage.getItem('tax_business_address') || '');
  const [showBusinessDialog, setShowBusinessDialog] = useState(false);

  // Persist business info
  useEffect(() => {
    localStorage.setItem('tax_business_name', businessName);
    localStorage.setItem('tax_code', taxCode);
    localStorage.setItem('tax_business_address', businessAddress);
  }, [businessName, taxCode, businessAddress]);

  const { data: branches } = useBranches();
  const { data: categories } = useCategories();
  const { data: permissions } = usePermissions();

  const period = getTimePeriod(timePeriod);
  const startDate = format(period.start, 'yyyy-MM-dd');
  const endDate = format(period.end, 'yyyy-MM-dd');

  // Branch Admin / staff / cashier: chỉ xem chi nhánh của mình
  const isSuperAdmin = permissions?.canViewAllBranches === true;
  const effectiveBranchId = !isSuperAdmin
    ? permissions?.branchId || undefined
    : selectedBranchId === 'all' ? undefined : selectedBranchId;
  const effectiveCategoryId = selectedCategoryId === 'all' ? undefined : selectedCategoryId;

  const { data: stats, isLoading: statsLoading } = useReportStats({ startDate, endDate, branchId: effectiveBranchId, categoryId: effectiveCategoryId });
  const { data: chartData, isLoading: chartLoading } = useReportChartData({ startDate, endDate, branchId: effectiveBranchId, groupBy: 'day' });

  const selectedTier = REVENUE_TIERS.find(t => t.value === revenueTier);
  const effectiveTaxMethod = taxMethod;

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
    const profitTncnRate = revenueTier === 'over_50b' ? 0.17 : 0.15;
    if (effectiveTaxMethod === 'revenue') {
      // Theo doanh số: luôn trừ 500 triệu miễn thuế
      const taxableRevenue = Math.max(0, revenue - 500_000_000);
      tncn = taxableRevenue * (selectedIndustry.tncn / 100);
    } else if (effectiveTaxMethod === 'profit') {
      tncn = Math.max(0, stats.netProfit) * profitTncnRate;
    }

    return { gtgt, tncn, total: gtgt + tncn, exempt: false };
  }, [allStepsComplete, stats, isExempt, selectedIndustry, effectiveTaxMethod, revenueTier]);

  const handleExportExcel = () => {
    if (!chartData || !selectedIndustry) return;

    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [];

    // Row 0: Business name (left) + Mẫu số (right)
    wsData.push([`HỘ, CÁ NHÂN KINH DOANH: ${businessName || '......'}`, '', '', `Mẫu số S2a-HKD`]);
    // Row 1: Tax code + right reference
    wsData.push([`Mã số thuế: ${taxCode || '........................................'}`, '', '', `(Kèm theo Thông tư số 152/2025/TT-BTC ngày`]);
    // Row 2: Address + right reference cont.
    wsData.push([`Địa chỉ: ${businessAddress || '.............................................'}`, '', '', `31 tháng 12 năm 2025 của Bộ trưởng Bộ Tài chính)`]);
    // Row 3: blank
    wsData.push([]);

    // Row 4: Title (center, merged across all cols)
    const periodStr = `Từ ngày ${format(period.start, 'dd/MM/yyyy')} đến ngày ${format(period.end, 'dd/MM/yyyy')}`;
    wsData.push(['SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ']);
    // Row 5: Địa điểm
    wsData.push([`Địa điểm kinh doanh: ${businessAddress || '...........................'}`]);
    // Row 6: Kỳ kê khai
    wsData.push([`Kỳ kê khai: ${periodStr}`]);
    // Row 7: blank
    wsData.push([]);

    // Row 8: Table header row 1 - "Chứng từ" spans col 0-1
    wsData.push(['Chứng từ', '', 'Diễn giải', 'Số tiền']);
    // Row 9: Table header row 2
    wsData.push(['Số hiệu', 'Ngày, tháng', '', '']);
    // Row 10: Column reference letters
    wsData.push(['A', 'B', 'C', '1']);

    // Row 11: Industry header
    wsData.push(['', '', `1. Ngành nghề: ${selectedIndustry.label}`, '']);

    // Data rows
    chartData.forEach((day, idx) => {
      wsData.push([
        idx + 1,
        format(new Date(day.date), 'dd/MM/yyyy'),
        `Ngành ${selectedIndustry.label} trong ngày`,
        day.revenue,
      ]);
    });

    const netRevenue = stats?.netRevenue || 0;

    // Summary rows
    wsData.push(['', '', 'Tổng cộng (3)', netRevenue]);
    wsData.push(['', '', `Thuế GTGT (${selectedIndustry.gtgt}%)`, taxResult?.gtgt || 0]);
    wsData.push(['', '', 'Thuế TNCN', taxResult?.tncn || 0]);
    wsData.push(['', '', 'Tổng số thuế GTGT phải nộp', taxResult?.gtgt || 0]);
    wsData.push(['', '', 'Tổng số thuế TNCN phải nộp', taxResult?.tncn || 0]);

    // Blank row
    wsData.push([]);

    // Signature section (right side - column 3)
    wsData.push(['', '', '', 'Ngày ... tháng ... năm ...']);
    wsData.push(['', '', '', 'NGƯỜI ĐẠI DIỆN HỘ KINH DOANH/']);
    wsData.push(['', '', '', 'CÁ NHÂN KINH DOANH']);
    wsData.push(['', '', '', '(Ký, họ tên, đóng dấu)']);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths (4 columns matching template)
    ws['!cols'] = [
      { wch: 15 }, // A - Số hiệu
      { wch: 15 }, // B - Ngày, tháng
      { wch: 40 }, // C - Diễn giải
      { wch: 25 }, // D - Số tiền
    ];

    // Merge cells
    ws['!merges'] = [
      // Header: left side business info spans cols 0-2
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
      // Title rows span all 4 cols
      { s: { r: 4, c: 0 }, e: { r: 4, c: 3 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: 3 } },
      { s: { r: 6, c: 0 }, e: { r: 6, c: 3 } },
      // Table header: "Chứng từ" spans cols 0-1
      { s: { r: 8, c: 0 }, e: { r: 8, c: 1 } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'S2a');
    XLSX.writeFile(wb, `BC_Thue_S2a_${period.label.replace(/[\/\s]/g, '_')}.xlsx`);
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
            {/* Branch Filter - only for Super Admin */}
            {isSuperAdmin && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Chi nhánh
                </label>
                <Select
                  value={selectedBranchId}
                  onValueChange={setSelectedBranchId}
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
            )}

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
            }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Chọn mức doanh thu..." /></SelectTrigger>
              <SelectContent className="bg-popover">
                {REVENUE_TIERS.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <div>
                      <span>{t.label}{t.exempt ? ' (Không phải đóng thuế)' : ''}</span>
                      {t.note && <span className="block text-[10px] text-muted-foreground">{t.note}</span>}
                    </div>
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
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Chọn cách tính thuế..." /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {TAX_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p>• <strong>Theo doanh số:</strong> TNCN = (Doanh thu − 500.000.000) × Thuế suất TNCN</p>
                <p>• <strong>Theo lợi nhuận:</strong> TNCN = Lợi nhuận thuần × % mức thuế theo mốc doanh thu ở B2 ({revenueTier === 'over_50b' ? '17%' : '15%'}) <em>(phải có hóa đơn đầu vào)</em></p>
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
                        Thuế TNCN {effectiveTaxMethod === 'revenue' ? `(${selectedIndustry?.tncn}%)` : `(${revenueTier === 'over_50b' ? '17' : '15'}% LN)`}
                      </p>
                      <p className="text-xl font-bold text-primary mt-1">{formatCurrency(taxResult.tncn)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {effectiveTaxMethod === 'revenue'
                          ? `= (DT - 500tr) × ${selectedIndustry?.tncn}%`
                          : `= Lợi nhuận thuần × ${revenueTier === 'over_50b' ? '17' : '15'}%`}
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
              <CardHeader className="flex flex-col gap-3">
                <div className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ</CardTitle>
                  <div className="flex items-center gap-2">
                    <Dialog open={showBusinessDialog} onOpenChange={setShowBusinessDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Settings2 className="h-4 w-4 mr-1" />
                          Thông tin HKD
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Thông tin Hộ Kinh Doanh</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                          <div className="space-y-2">
                            <Label>Tên hộ kinh doanh / Cá nhân kinh doanh</Label>
                            <Input
                              placeholder="VD: Hộ kinh doanh Nguyễn Văn A"
                              value={businessName}
                              onChange={e => setBusinessName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Mã số thuế</Label>
                            <Input
                              placeholder="VD: 0123456789"
                              value={taxCode}
                              onChange={e => setTaxCode(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Địa chỉ kinh doanh</Label>
                            <Input
                              placeholder="VD: 123 Nguyễn Trãi, P.1, Q.1, TP.HCM"
                              value={businessAddress}
                              onChange={e => setBusinessAddress(e.target.value)}
                            />
                          </div>
                          <Button className="w-full" onClick={() => setShowBusinessDialog(false)}>
                            Lưu thông tin
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={chartLoading || !chartData}>
                      <Download className="h-4 w-4 mr-1" />
                      Xuất Excel (S2a-HKD)
                    </Button>
                  </div>
                </div>
                {businessName && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p><strong>HKD:</strong> {businessName} | <strong>MST:</strong> {taxCode || 'Chưa có'} | <strong>Địa chỉ:</strong> {businessAddress || 'Chưa có'}</p>
                  </div>
                )}
                <span className="text-[10px] text-muted-foreground italic">Xuất excel nộp cơ quan thuế (Mẫu S2a-HKD theo TT 152/2025/TT-BTC)</span>
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
