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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Download, AlertTriangle, CheckCircle2, Info, Building2, FolderTree, Settings2, BookOpen, Plus, Calculator } from 'lucide-react';
import { useTaxGuideUrl } from '@/hooks/useAppConfig';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useReportStats, useReportChartData } from '@/hooks/useReportStats';
import { formatCurrency } from '@/lib/mockData';
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
  { value: 'under_500m', label: 'Dưới 1 tỷ', exempt: true, note: '' },
  { value: '500m_3b', label: 'Từ 1 tỷ đến dưới 3 tỷ', exempt: false, note: 'TNCN 15%' },
  { value: '3b_50b', label: 'Từ 3 tỷ đến dưới 50 tỷ', exempt: false, note: 'TNCN 17%' },
  { value: 'over_50b', label: 'Trên 50 tỷ', exempt: false, note: 'TNCN 20%' },
];

const TAX_METHODS = [
  { value: 'revenue', label: 'Theo doanh số' },
  { value: 'profit', label: 'Theo lợi nhuận' },
];

const QUARTERS = [
  { value: 'q1', label: 'Quý 1 (Tháng 1-3)' },
  { value: 'q2', label: 'Quý 2 (Tháng 4-6)' },
  { value: 'q3', label: 'Quý 3 (Tháng 7-9)' },
  { value: 'q4', label: 'Quý 4 (Tháng 10-12)' },
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

// ---- Shared: Industry Select + Table ----
function IndustrySelector({ industry, setIndustry }: { industry: string; setIndustry: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={industry ? 'default' : 'outline'} className="text-xs">B1</Badge>
        <span className="font-medium text-sm">Chọn ngành nghề</span>
        {industry && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
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
  );
}

// ---- Shared: Revenue Tier Select ----
function RevenueTierSelector({ revenueTier, setRevenueTier }: { revenueTier: string; setRevenueTier: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={revenueTier ? 'default' : 'outline'} className="text-xs">B2</Badge>
        <span className="font-medium text-sm">Ước chừng doanh thu 1 năm</span>
        {revenueTier && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
      </div>
      <Select value={revenueTier} onValueChange={setRevenueTier}>
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
  );
}

// ---- Shared: Tax Method Select ----
function TaxMethodSelector({ taxMethod, setTaxMethod, mustUseProfit, revenueTier, isExempt }: {
  taxMethod: string; setTaxMethod: (v: string) => void; mustUseProfit: boolean; revenueTier: string; isExempt?: boolean;
}) {
  if (isExempt) return null;
  const effectiveMethod = mustUseProfit ? 'profit' : taxMethod;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={effectiveMethod ? 'default' : 'outline'} className="text-xs">B3</Badge>
        <span className="font-medium text-sm">Cách tính thuế TNCN</span>
        {effectiveMethod && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
      </div>
      <Select value={effectiveMethod} onValueChange={setTaxMethod} disabled={mustUseProfit}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Chọn cách tính thuế..." /></SelectTrigger>
        <SelectContent className="bg-popover">
          {TAX_METHODS.map(m => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {mustUseProfit && (
        <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-700 dark:text-amber-400">
          <p className="font-semibold">⚠️ Doanh thu từ 3 tỷ trở lên bắt buộc đóng thuế TNCN theo lợi nhuận.</p>
        </div>
      )}
      <div className="mt-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
        <p>• <strong>Theo doanh số:</strong> TNCN = (Doanh thu − 500.000.000) × Thuế suất TNCN theo ngành</p>
        <p>• <strong>Theo lợi nhuận:</strong> TNCN = Lợi nhuận thuần × Thuế suất TNCN ({revenueTier === 'over_50b' ? '20%' : revenueTier === '3b_50b' ? '17%' : '15%'}) <em>(phải có hóa đơn đầu vào)</em></p>
        <p className="italic pt-1 font-medium text-amber-600 dark:text-amber-400">Lưu ý: Doanh thu từ 3-50 tỷ bắt buộc đóng thuế TNCN 17%, trên 50 tỷ bắt buộc 20% theo lợi nhuận.</p>
        {!mustUseProfit && <p className="italic">Doanh thu dưới 3 tỷ: cả 2 cách đều hợp lệ, hãy chọn cách nào cho số thuế thấp hơn.</p>}
      </div>
    </div>
  );
}

// ---- Shared: Tax Result Display ----
function TaxResultDisplay({ taxResult, selectedIndustry, effectiveTaxMethod, revenueTier, periodLabel, netRevenue, netProfit, totalReturnRevenue, isExempt }: {
  taxResult: { gtgt: number; tncn: number; total: number; exempt?: boolean } | null;
  selectedIndustry: typeof INDUSTRIES[0] | undefined;
  effectiveTaxMethod: string;
  revenueTier: string;
  periodLabel: string;
  netRevenue: number;
  netProfit: number;
  totalReturnRevenue?: number;
  isExempt?: boolean;
}) {
  const navigate = useNavigate();
  if (!taxResult) return null;

  if (isExempt) {
    return (
      <Card className="border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="pt-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">Không phải đóng thuế</p>
          <p className="text-sm text-muted-foreground mt-1">Doanh thu dưới 1 tỷ/năm được miễn thuế</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/30">
      <CardHeader>
        <CardTitle className="text-lg">Kết quả tính thuế – {periodLabel}</CardTitle>
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
                Thuế TNCN {effectiveTaxMethod === 'revenue' ? `(${selectedIndustry?.tncn}%)` : `(${revenueTier === 'over_50b' ? '20' : revenueTier === '3b_50b' ? '17' : '15'}% LN)`}
              </p>
              <p className="text-xl font-bold text-primary mt-1">{formatCurrency(taxResult.tncn)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {effectiveTaxMethod === 'revenue'
                  ? `= (DT - 500tr) × ${selectedIndustry?.tncn}%`
                  : `= Lợi nhuận thuần × ${revenueTier === 'over_50b' ? '20' : revenueTier === '3b_50b' ? '17' : '15'}%`}
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

        <div className="text-xs space-y-1 text-muted-foreground bg-muted/30 rounded-lg p-3">
          <p>• Doanh thu thuần kỳ: {formatCurrency(netRevenue)} {totalReturnRevenue !== undefined && <span className="italic">(đã trừ trả hàng: {formatCurrency(totalReturnRevenue)})</span>}</p>
          <p>• Lợi nhuận thuần kỳ: {formatCurrency(netProfit)}</p>
          {effectiveTaxMethod === 'revenue' && (
            <p>• Cách tính TNCN: ({formatCurrency(netRevenue)} - 500.000.000) × {selectedIndustry?.tncn}%</p>
          )}
        </div>

        <p className="text-destructive text-xs font-medium flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          Đây là báo cáo ước tính gần đúng 95-98%, không thể đúng 100%.
        </p>

        <Button variant="outline" size="sm" className="mt-3 w-full sm:w-auto" onClick={() => navigate('/export/tax-policy')}>
          <Info className="h-4 w-4 mr-1" />
          Chi tiết mức thuế 2026
        </Button>
      </CardContent>
    </Card>
  );
}

// ---- Shared: Business Info Dialog ----
function BusinessInfoDialog({ businessName, setBusinessName, taxCode, setTaxCode, businessAddress, setBusinessAddress, open, setOpen }: {
  businessName: string; setBusinessName: (v: string) => void;
  taxCode: string; setTaxCode: (v: string) => void;
  businessAddress: string; setBusinessAddress: (v: string) => void;
  open: boolean; setOpen: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            <Input placeholder="VD: Hộ kinh doanh Nguyễn Văn A" value={businessName} onChange={e => setBusinessName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Mã số thuế</Label>
            <Input placeholder="VD: 0123456789" value={taxCode} onChange={e => setTaxCode(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Địa chỉ kinh doanh</Label>
            <Input placeholder="VD: 123 Nguyễn Trãi, P.1, Q.1, TP.HCM" value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} />
          </div>
          <Button className="w-full" onClick={() => setOpen(false)}>Lưu thông tin</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Shared: Excel Export Helper ----
function buildExcelExport(opts: {
  businessName: string; taxCode: string; businessAddress: string;
  periodStart: Date; periodEnd: Date; periodLabel: string;
  selectedIndustry: typeof INDUSTRIES[0];
  dailyData: { date: string; revenue: number }[];
  netRevenue: number; taxGtgt: number; taxTncn: number;
}) {
  const { businessName, taxCode, businessAddress, periodStart, periodEnd, periodLabel, selectedIndustry, dailyData, netRevenue, taxGtgt, taxTncn } = opts;
  const wb = XLSX.utils.book_new();
  const wsData: any[][] = [];

  wsData.push([`HỘ, CÁ NHÂN KINH DOANH: ${businessName || '......'}`, '', '', `Mẫu số S2a-HKD`]);
  wsData.push([`Mã số thuế: ${taxCode || '........................................'}`, '', '', `(Kèm theo Thông tư số 152/2025/TT-BTC ngày`]);
  wsData.push([`Địa chỉ: ${businessAddress || '.............................................'}`, '', '', `31 tháng 12 năm 2025 của Bộ trưởng Bộ Tài chính)`]);
  wsData.push([]);

  const periodStr = `Từ ngày ${format(periodStart, 'dd/MM/yyyy')} đến ngày ${format(periodEnd, 'dd/MM/yyyy')}`;
  wsData.push(['', '', 'SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ', '']);
  wsData.push(['', '', `Địa điểm kinh doanh: ${businessAddress || '...........................'}`, '']);
  wsData.push(['', '', `Kỳ kê khai: ${periodStr}`, '']);
  wsData.push([]);

  wsData.push(['Chứng từ', '', 'Diễn giải', 'Số tiền']);
  wsData.push(['Số hiệu', 'Ngày, tháng', '', '']);
  wsData.push(['A', 'B', 'C', '1']);
  wsData.push(['', '', `1. Ngành nghề: ${selectedIndustry.label}`, '']);

  dailyData.forEach((day, idx) => {
    wsData.push([idx + 1, format(new Date(day.date), 'dd/MM/yyyy'), `Ngành ${selectedIndustry.label} trong ngày`, day.revenue]);
  });

  wsData.push(['', '', 'Tổng cộng (3)', netRevenue]);
  wsData.push(['', '', `Thuế GTGT (${selectedIndustry.gtgt}%)`, taxGtgt]);
  wsData.push(['', '', 'Thuế TNCN', taxTncn]);
  wsData.push(['', '', 'Tổng số thuế GTGT phải nộp', taxGtgt]);
  wsData.push(['', '', 'Tổng số thuế TNCN phải nộp', taxTncn]);
  wsData.push([]);
  wsData.push(['', '', '', 'Ngày ... tháng ... năm ...']);
  wsData.push(['', '', '', 'NGƯỜI ĐẠI DIỆN HỘ KINH DOANH/']);
  wsData.push(['', '', '', 'CÁ NHÂN KINH DOANH']);
  wsData.push(['', '', '', '(Ký, họ tên, đóng dấu)']);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 25 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
    { s: { r: 8, c: 0 }, e: { r: 8, c: 1 } },
    { s: { r: 8, c: 2 }, e: { r: 9, c: 2 } },
    { s: { r: 8, c: 3 }, e: { r: 9, c: 3 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'S2a');
  XLSX.writeFile(wb, `BC_Thue_S2a_${periodLabel.replace(/[\/\s]/g, '_')}.xlsx`);
}

// ---- Shared: Daily Detail Table ----
function DailyDetailTable({ selectedIndustry, dailyData, netRevenue, taxResult, chartLoading, businessName, taxCode, businessAddress, showBusinessDialog, setShowBusinessDialog, setBusinessName, setTaxCode, setBusinessAddress, onExport }: {
  selectedIndustry: typeof INDUSTRIES[0] | undefined;
  dailyData: { date: string; revenue: number }[] | undefined;
  netRevenue: number;
  taxResult: { gtgt: number; tncn: number } | null;
  chartLoading: boolean;
  businessName: string; taxCode: string; businessAddress: string;
  showBusinessDialog: boolean; setShowBusinessDialog: (v: boolean) => void;
  setBusinessName: (v: string) => void; setTaxCode: (v: string) => void; setBusinessAddress: (v: string) => void;
  onExport: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base sm:text-lg">SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ</CardTitle>
          <div className="flex items-center gap-2">
            <BusinessInfoDialog
              businessName={businessName} setBusinessName={setBusinessName}
              taxCode={taxCode} setTaxCode={setTaxCode}
              businessAddress={businessAddress} setBusinessAddress={setBusinessAddress}
              open={showBusinessDialog} setOpen={setShowBusinessDialog}
            />
            <Button variant="outline" size="sm" onClick={onExport} disabled={chartLoading || !dailyData}>
              <Download className="h-4 w-4 mr-1" />
              Xuất Excel
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
                <TableRow>
                  <TableCell className="text-xs" colSpan={1}></TableCell>
                  <TableCell className="text-xs" colSpan={2}>
                    <strong>1. Ngành nghề: {selectedIndustry?.label}</strong>
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
                {dailyData?.map((day, idx) => (
                  <TableRow key={day.date}>
                    <TableCell className="text-xs py-2">{idx + 1}</TableCell>
                    <TableCell className="text-xs py-2">{format(new Date(day.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-xs py-2">Ngành {selectedIndustry?.label} trong ngày</TableCell>
                    <TableCell className="text-xs text-right py-2 font-mono">{formatCurrency(day.revenue)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-medium">
                  <TableCell colSpan={3} className="text-xs text-right">Tổng cộng (Doanh thu thuần)</TableCell>
                  <TableCell className="text-xs text-right font-mono font-bold">{formatCurrency(netRevenue)}</TableCell>
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
  );
}

// ---- Shared: Calculate Tax ----
function calculateTax(revenue: number, profit: number, selectedIndustry: typeof INDUSTRIES[0] | undefined, effectiveTaxMethod: string, revenueTier: string, isExempt: boolean) {
  if (isExempt) return { gtgt: 0, tncn: 0, total: 0, exempt: true };
  if (!selectedIndustry) return null;

  const gtgt = revenue * (selectedIndustry.gtgt / 100);
  let tncn = 0;
  const profitTncnRate = revenueTier === 'over_50b' ? 0.20 : (revenueTier === '3b_50b' ? 0.17 : 0.15);
  if (effectiveTaxMethod === 'revenue') {
    const taxableRevenue = Math.max(0, revenue - 500_000_000);
    tncn = taxableRevenue * (selectedIndustry.tncn / 100);
  } else if (effectiveTaxMethod === 'profit') {
    tncn = Math.max(0, profit) * profitTncnRate;
  }
  return { gtgt, tncn, total: gtgt + tncn, exempt: false };
}

// ============================================
// TAB 1: Lấy doanh thu từ VKho
// ============================================
function TaxReportFromVKho() {
  const taxGuideUrl = useTaxGuideUrl();
  const [timePeriod, setTimePeriod] = useState('this_month');
  const [industry, setIndustry] = useState('');
  const [revenueTier, setRevenueTier] = useState('');
  const [taxMethod, setTaxMethod] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [businessName, setBusinessName] = useState(() => localStorage.getItem('tax_business_name') || '');
  const [taxCode, setTaxCode] = useState(() => localStorage.getItem('tax_code') || '');
  const [businessAddress, setBusinessAddress] = useState(() => localStorage.getItem('tax_business_address') || '');
  const [showBusinessDialog, setShowBusinessDialog] = useState(false);

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

  const isSuperAdmin = permissions?.canViewAllBranches === true;
  const effectiveBranchId = !isSuperAdmin ? permissions?.branchId || undefined : selectedBranchId === 'all' ? undefined : selectedBranchId;
  const effectiveCategoryId = selectedCategoryId === 'all' ? undefined : selectedCategoryId;

  const { data: stats, isLoading: statsLoading } = useReportStats({ startDate, endDate, branchId: effectiveBranchId, categoryId: effectiveCategoryId });
  const { data: chartData, isLoading: chartLoading } = useReportChartData({ startDate, endDate, branchId: effectiveBranchId, groupBy: 'day' });

  const selectedTier = REVENUE_TIERS.find(t => t.value === revenueTier);
  const mustUseProfit = revenueTier === '3b_50b' || revenueTier === 'over_50b';
  const effectiveTaxMethod = mustUseProfit ? 'profit' : taxMethod;
  const isExempt = !!selectedTier?.exempt;

  useEffect(() => {
    if (mustUseProfit && taxMethod !== 'profit') setTaxMethod('profit');
  }, [mustUseProfit, taxMethod]);

  const selectedIndustry = INDUSTRIES.find(i => i.value === industry);
  const allStepsComplete = !!industry && !!revenueTier && (!!effectiveTaxMethod || isExempt);

  const taxResult = useMemo(() => {
    if (!allStepsComplete || !stats) return null;
    return calculateTax(stats.netRevenue, stats.netProfit, selectedIndustry, effectiveTaxMethod, revenueTier, isExempt);
  }, [allStepsComplete, stats, selectedIndustry, effectiveTaxMethod, revenueTier, isExempt]);

  const handleExportExcel = () => {
    if (!chartData || !selectedIndustry) return;
    buildExcelExport({
      businessName, taxCode, businessAddress,
      periodStart: period.start, periodEnd: period.end, periodLabel: period.label,
      selectedIndustry, dailyData: chartData, netRevenue: stats?.netRevenue || 0,
      taxGtgt: taxResult?.gtgt || 0, taxTncn: taxResult?.tncn || 0,
    });
  };

  return (
    <div className="space-y-4">
      {taxGuideUrl && (
        <Button variant="outline" size="sm" asChild>
          <a href={taxGuideUrl} target="_blank" rel="noopener noreferrer">
            <BookOpen className="mr-2 h-4 w-4" />
            Hướng dẫn báo cáo thuế
          </a>
        </Button>
      )}

      {/* Time Period */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2" data-tour="tax-report-period">
            {[
              { value: 'this_month', label: 'Tháng này' },
              { value: 'q1', label: 'Quý 1' }, { value: 'q2', label: 'Quý 2' },
              { value: 'q3', label: 'Quý 3' }, { value: 'q4', label: 'Quý 4' },
              { value: 'this_year', label: 'Năm nay' },
            ].map(p => (
              <Button key={p.value} variant={timePeriod === p.value ? 'default' : 'outline'} size="sm" onClick={() => setTimePeriod(p.value)}>
                {p.label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Kỳ báo cáo: <strong>{period.label}</strong> ({format(period.start, 'dd/MM/yyyy')} – {format(period.end, 'dd/MM/yyyy')})
          </p>
        </CardContent>
      </Card>

      {/* Branch & Category */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isSuperAdmin && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Chi nhánh
                </label>
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Tất cả chi nhánh" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Tất cả chi nhánh</SelectItem>
                    {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FolderTree className="h-3.5 w-3.5" /> Danh mục
              </label>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Tất cả danh mục" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Tất cả danh mục</SelectItem>
                  {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
          <IndustrySelector industry={industry} setIndustry={setIndustry} />
          <RevenueTierSelector revenueTier={revenueTier} setRevenueTier={setRevenueTier} />
          <TaxMethodSelector taxMethod={taxMethod} setTaxMethod={setTaxMethod} mustUseProfit={mustUseProfit} revenueTier={revenueTier} isExempt={isExempt} />
        </CardContent>
      </Card>

      {/* Result */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : allStepsComplete && taxResult && (
        <>
          <TaxResultDisplay
            taxResult={taxResult} selectedIndustry={selectedIndustry}
            effectiveTaxMethod={effectiveTaxMethod} revenueTier={revenueTier}
            periodLabel={period.label} netRevenue={stats?.netRevenue || 0}
            netProfit={stats?.netProfit || 0} totalReturnRevenue={stats?.totalReturnRevenue || 0}
            isExempt={isExempt}
          />
          {!isExempt && (
            <DailyDetailTable
              selectedIndustry={selectedIndustry} dailyData={chartData} netRevenue={stats?.netRevenue || 0}
              taxResult={taxResult} chartLoading={chartLoading}
              businessName={businessName} taxCode={taxCode} businessAddress={businessAddress}
              showBusinessDialog={showBusinessDialog} setShowBusinessDialog={setShowBusinessDialog}
              setBusinessName={setBusinessName} setTaxCode={setTaxCode} setBusinessAddress={setBusinessAddress}
              onExport={handleExportExcel}
            />
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// TAB 2: Tự điền doanh thu
// ============================================
function TaxReportManual() {
  const [manualRevenue, setManualRevenue] = useState('');
  const [manualProfit, setManualProfit] = useState('');
  const [quarter, setQuarter] = useState('');
  const [industry, setIndustry] = useState('');
  const [revenueTier, setRevenueTier] = useState('');
  const [taxMethod, setTaxMethod] = useState('');
  const [businessName, setBusinessName] = useState(() => localStorage.getItem('tax_business_name') || '');
  const [taxCode, setTaxCode] = useState(() => localStorage.getItem('tax_code') || '');
  const [businessAddress, setBusinessAddress] = useState(() => localStorage.getItem('tax_business_address') || '');
  const [showBusinessDialog, setShowBusinessDialog] = useState(false);

  useEffect(() => {
    localStorage.setItem('tax_business_name', businessName);
    localStorage.setItem('tax_code', taxCode);
    localStorage.setItem('tax_business_address', businessAddress);
  }, [businessName, taxCode, businessAddress]);

  const formatInputNumber = (val: string) => {
    const num = val.replace(/[^\d]/g, '');
    if (!num) return '';
    return parseInt(num).toLocaleString('vi-VN');
  };

  const revenueNum = parseFloat(manualRevenue.replace(/[,.]/g, '')) || 0;
  const profitNum = parseFloat(manualProfit.replace(/[,.]/g, '')) || 0;

  const selectedTier = REVENUE_TIERS.find(t => t.value === revenueTier);
  const mustUseProfit = revenueNum >= 3_000_000_000 || revenueTier === '3b_50b' || revenueTier === 'over_50b';
  const effectiveTaxMethod = mustUseProfit ? 'profit' : taxMethod;
  const isExempt = !!selectedTier?.exempt;

  useEffect(() => {
    if (mustUseProfit && taxMethod !== 'profit') setTaxMethod('profit');
  }, [mustUseProfit, taxMethod]);

  // Auto-detect revenue tier from manual input
  useEffect(() => {
    if (revenueNum <= 0) return;
    // Estimate annual revenue (quarter * 4)
    const annualEstimate = revenueNum * 4;
    if (annualEstimate < 1_000_000_000) setRevenueTier('under_500m');
    else if (annualEstimate < 3_000_000_000) setRevenueTier('500m_3b');
    else if (annualEstimate < 50_000_000_000) setRevenueTier('3b_50b');
    else setRevenueTier('over_50b');
  }, [revenueNum]);

  const selectedIndustry = INDUSTRIES.find(i => i.value === industry);
  const hasRevenueData = revenueNum > 0 && !!quarter;
  const allStepsComplete = hasRevenueData && !!industry && !!revenueTier && (!!effectiveTaxMethod || isExempt);

  const taxResult = useMemo(() => {
    if (!allStepsComplete) return null;
    return calculateTax(revenueNum, profitNum, selectedIndustry, effectiveTaxMethod, revenueTier, isExempt);
  }, [allStepsComplete, revenueNum, profitNum, selectedIndustry, effectiveTaxMethod, revenueTier, isExempt]);

  // Build period from quarter
  const period = quarter ? getTimePeriod(quarter) : getTimePeriod('q1');
  const quarterLabel = QUARTERS.find(q => q.value === quarter)?.label || '';

  // Generate fake daily data for Excel (spread revenue evenly across quarter days)
  const generateDailyData = () => {
    if (!quarter) return [];
    const p = getTimePeriod(quarter);
    const days: { date: string; revenue: number }[] = [];
    const current = new Date(p.start);
    while (current <= p.end) {
      days.push({ date: format(current, 'yyyy-MM-dd'), revenue: 0 });
      current.setDate(current.getDate() + 1);
    }
    // Put total revenue as single entry on last day (or spread evenly)
    if (days.length > 0) {
      const dailyRevenue = Math.round(revenueNum / days.length);
      const remainder = revenueNum - dailyRevenue * days.length;
      days.forEach((d, i) => {
        d.revenue = dailyRevenue + (i === days.length - 1 ? remainder : 0);
      });
    }
    return days;
  };

  const handleExportExcel = () => {
    if (!selectedIndustry || !quarter) return;
    const dailyData = generateDailyData();
    const p = getTimePeriod(quarter);
    buildExcelExport({
      businessName, taxCode, businessAddress,
      periodStart: p.start, periodEnd: p.end, periodLabel: p.label,
      selectedIndustry, dailyData, netRevenue: revenueNum,
      taxGtgt: taxResult?.gtgt || 0, taxTncn: taxResult?.tncn || 0,
    });
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <Card className="border-dashed border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Calculator className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Tự điền doanh thu & lợi nhuận</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dành cho cửa hàng mới chưa có dữ liệu trên VKho. Nhập doanh thu theo quý để tính thuế.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Manual Revenue Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Nhập doanh thu & lợi nhuận
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Chọn quý kê khai <span className="text-destructive">*</span></Label>
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Chọn quý..." /></SelectTrigger>
              <SelectContent className="bg-popover">
                {QUARTERS.map(q => (
                  <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Doanh thu trong quý (VNĐ) <span className="text-destructive">*</span></Label>
            <Input
              placeholder="VD: 500.000.000"
              value={manualRevenue}
              onChange={e => setManualRevenue(formatInputNumber(e.target.value))}
              inputMode="numeric"
            />
            {revenueNum > 0 && (
              <p className="text-xs text-muted-foreground">= {formatCurrency(revenueNum)}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Lợi nhuận trong quý (VNĐ)</Label>
            <Input
              placeholder="VD: 100.000.000"
              value={manualProfit}
              onChange={e => setManualProfit(formatInputNumber(e.target.value))}
              inputMode="numeric"
            />
            {profitNum > 0 && (
              <p className="text-xs text-muted-foreground">= {formatCurrency(profitNum)}</p>
            )}
            <p className="text-[10px] text-muted-foreground italic">
              Lợi nhuận = Doanh thu - Chi phí. Cần nhập nếu kê khai theo lợi nhuận.
            </p>
          </div>

          {revenueNum >= 3_000_000_000 && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-700 dark:text-amber-400">
              <p className="font-semibold">⚠️ Doanh thu từ 3 tỷ/quý → bắt buộc kê khai theo lợi nhuận. Vui lòng nhập lợi nhuận.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2 & 3: Industry + Tax Method (only show when revenue entered) */}
      {hasRevenueData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Chọn ngành nghề & hình thức kê khai
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <IndustrySelector industry={industry} setIndustry={setIndustry} />
            <TaxMethodSelector taxMethod={taxMethod} setTaxMethod={setTaxMethod} mustUseProfit={mustUseProfit} revenueTier={revenueTier} isExempt={isExempt} />
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {allStepsComplete && taxResult && (
        <>
          <TaxResultDisplay
            taxResult={taxResult} selectedIndustry={selectedIndustry}
            effectiveTaxMethod={effectiveTaxMethod} revenueTier={revenueTier}
            periodLabel={quarterLabel} netRevenue={revenueNum}
            netProfit={profitNum} isExempt={isExempt}
          />
          {!isExempt && (
            <DailyDetailTable
              selectedIndustry={selectedIndustry} dailyData={generateDailyData()} netRevenue={revenueNum}
              taxResult={taxResult} chartLoading={false}
              businessName={businessName} taxCode={taxCode} businessAddress={businessAddress}
              showBusinessDialog={showBusinessDialog} setShowBusinessDialog={setShowBusinessDialog}
              setBusinessName={setBusinessName} setTaxCode={setTaxCode} setBusinessAddress={setBusinessAddress}
              onExport={handleExportExcel}
            />
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// MAIN: TaxReport with 2 Tabs
// ============================================
export function TaxReport() {
  return (
    <Tabs defaultValue="vkho" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="vkho" className="text-xs sm:text-sm">
          📊 Lấy từ VKho
        </TabsTrigger>
        <TabsTrigger value="manual" className="text-xs sm:text-sm">
          ✏️ Tự điền doanh thu
        </TabsTrigger>
      </TabsList>

      <TabsContent value="vkho" className="mt-4">
        <TaxReportFromVKho />
      </TabsContent>

      <TabsContent value="manual" className="mt-4">
        <TaxReportManual />
      </TabsContent>
    </Tabs>
  );
}
