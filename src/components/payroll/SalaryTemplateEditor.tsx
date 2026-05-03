import { useState, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Plus, Trash2, Save, Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useSalaryTemplates, useCreateSalaryTemplate, useUpdateSalaryTemplate, useTemplateBonuses, useTemplateCommissions, useTemplateAllowances, useTemplateHolidays, useTemplatePenalties, useTemplateOvertimes, useSaveTemplateConfigs } from '@/hooks/usePayroll';
import { useCategories } from '@/hooks/useCategories';
import { toast } from 'sonner';
import { formatNumber, formatInputNumber, parseFormattedNumber } from '@/lib/formatNumber';

// Number input that displays digits grouped by spaces (e.g. 1 000 000)
// Internally still produces a numeric value via onChangeNumber.
function NumberInput({
  value,
  onChangeNumber,
  className,
  placeholder,
  min,
  max,
}: {
  value: number | string | undefined | null;
  onChangeNumber: (n: number) => void;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  const display = value === '' || value === null || value === undefined
    ? ''
    : formatInputNumber(String(value));
  return (
    <Input
      type="text"
      inputMode="numeric"
      className={className}
      placeholder={placeholder}
      value={display}
      onChange={(e) => {
        let n = parseFormattedNumber(e.target.value);
        if (typeof min === 'number' && n < min) n = min;
        if (typeof max === 'number' && n > max) n = max;
        onChangeNumber(n);
      }}
    />
  );
}

const SALARY_TYPES = [
  { value: 'fixed', label: 'Lương cố định theo tháng' },
  { value: 'hourly', label: 'Lương theo giờ' },
  { value: 'daily', label: 'Lương theo ngày' },
  { value: 'shift', label: 'Lương theo ca' },
];

const BONUS_TYPES = [
  { value: 'fixed', label: 'Thưởng cố định' },
  { value: 'kpi_personal', label: 'KPI doanh thu cá nhân' },
  { value: 'branch_revenue', label: 'Doanh thu chi nhánh' },
  { value: 'gross_profit', label: 'Lợi nhuận gộp' },
];

const OVERTIME_TYPES = [
  { value: 'full_day', label: 'Tăng ca nguyên ngày' },
  { value: 'hourly', label: 'Tăng ca theo giờ' },
];

const COMMISSION_TYPES = [
  { value: 'product', label: 'Sản phẩm' },
  { value: 'service', label: 'Dịch vụ' },
  { value: 'category', label: 'Danh mục' },
  { value: 'revenue', label: 'Tổng doanh thu cá nhân' },
];

const PENALTY_TYPES = [
  { value: 'late', label: 'Đi trễ' },
  { value: 'early_leave', label: 'Về sớm' },
  { value: 'absent_no_permission', label: 'Nghỉ không phép' },
  { value: 'violation', label: 'Vi phạm nội quy' },
  { value: 'kpi_not_met', label: 'Không đạt KPI doanh thu' },
];

const VN_HOLIDAYS = [
  { date: '01-01', name: 'Tết Dương lịch' },
  { date: '04-30', name: 'Ngày Giải phóng' },
  { date: '05-01', name: 'Quốc tế Lao động' },
  { date: '09-02', name: 'Quốc khánh' },
  { date: 'tet', name: 'Tết Nguyên đán' },
  { date: '03-10', name: 'Giỗ Tổ Hùng Vương' },
];

const ALLOWANCE_PRESETS = [
  { type: 'fuel', name: 'Xăng xe' },
  { type: 'lunch', name: 'Ăn trưa' },
  { type: 'phone', name: 'Điện thoại' },
  { type: 'responsibility', name: 'Trách nhiệm' },
];

interface BonusTier { percent_over: number; calc_type: 'fixed_amount' | 'percentage'; value: number; }
interface BonusRow { bonus_type: string; name: string; calc_type: string; value: number; threshold: number; tiers: BonusTier[]; }
interface CommissionRow { target_type: string; target_id: string; target_name: string; calc_type: string; value: number; only_self_sold?: boolean; count_in_revenue_kpi?: boolean; }
interface AllowanceRow { allowance_type: string; name: string; amount: number; is_fixed: boolean; max_absent_days: number; }
interface HolidayRow { holiday_name: string; holiday_date: string; multiplier_percent: number; }
interface PenaltyTier { percent_achieved: number; penalty_amount: number; }
interface PenaltyRow { penalty_type: string; name: string; amount: number; description: string; threshold_minutes: number; full_day_absence_minutes: number; kpi_target: number; tiers: PenaltyTier[]; linked_bonus_key?: string; }
interface OvertimeRow { overtime_type: string; name: string; calc_type: string; value: number; description: string; }

interface Props {
  templateId: string | null;
  tenantId?: string;
  onClose: () => void;
  onSaved?: (templateId: string) => void;
}

function ProductPicker({ value, onChange, tenantId, placeholder }: { value: string; onChange: (v: string) => void; tenantId?: string; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: items, isLoading } = useQuery({
    queryKey: ['salary-product-picker', tenantId],
    enabled: !!tenantId && open,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('name, sku')
        .eq('tenant_id', tenantId!)
        .order('name', { ascending: true })
        .limit(2000);
      if (error) throw error;
      const seen = new Set<string>();
      const result: { name: string; sku: string | null }[] = [];
      for (const r of (data || [])) {
        const key = `${r.name}__${r.sku || ''}`;
        if (!seen.has(key)) { seen.add(key); result.push(r as any); }
      }
      return result;
    },
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-8 text-xs justify-between font-normal w-full">
          <span className={cn('truncate', !value && 'text-muted-foreground')}>{value || placeholder}</span>
          <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput placeholder="Tìm hoặc nhập tên..." value={search} onValueChange={setSearch} className="h-9 text-xs" />
          <CommandList className="max-h-60">
            {isLoading && <div className="py-4 text-center text-xs text-muted-foreground">Đang tải...</div>}
            <CommandEmpty>
              {search ? (
                <button
                  className="w-full text-left px-2 py-2 text-xs hover:bg-accent"
                  onClick={() => { onChange(search); setOpen(false); setSearch(''); }}
                >
                  Dùng tên tự nhập: <strong>"{search}"</strong>
                </button>
              ) : (
                <div className="py-4 text-center text-xs text-muted-foreground">Không có dữ liệu</div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {items?.map((p, idx) => (
                <CommandItem
                  key={`${p.name}-${idx}`}
                  value={`${p.name} ${p.sku || ''}`}
                  onSelect={() => { onChange(p.name); setOpen(false); setSearch(''); }}
                  className="text-xs"
                >
                  <Check className={cn('h-3 w-3 mr-2', value === p.name ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col">
                    <span>{p.name}</span>
                    {p.sku && <span className="text-[10px] text-muted-foreground">SKU: {p.sku}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function SalaryTemplateEditor({ templateId, tenantId, onClose, onSaved }: Props) {
  const { data: templates } = useSalaryTemplates();
  const createTemplate = useCreateSalaryTemplate();
  const updateTemplate = useUpdateSalaryTemplate();
  const saveConfigs = useSaveTemplateConfigs();
  const { data: categories } = useCategories();
  const qc = useQueryClient();

  const existing = templates?.find(t => t.id === templateId);

  const [name, setName] = useState('');
  const [salaryType, setSalaryType] = useState('fixed');
  const [baseAmount, setBaseAmount] = useState('');
  const [paidLeaveDays, setPaidLeaveDays] = useState('0');
  const [description, setDescription] = useState('');

  const [bonusEnabled, setBonusEnabled] = useState(false);
  const [commissionEnabled, setCommissionEnabled] = useState(false);
  const [allowanceEnabled, setAllowanceEnabled] = useState(false);
  const [holidayEnabled, setHolidayEnabled] = useState(false);
  const [penaltyEnabled, setPenaltyEnabled] = useState(false);
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [enableOvertime, setEnableOvertime] = useState(false);

  const [bonuses, setBonuses] = useState<BonusRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [allowances, setAllowances] = useState<AllowanceRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [penalties, setPenalties] = useState<PenaltyRow[]>([]);
  const [overtimes, setOvertimes] = useState<OvertimeRow[]>([]);

  const { data: exBonuses } = useTemplateBonuses(templateId || undefined);
  const { data: exCommissions } = useTemplateCommissions(templateId || undefined);
  const { data: exAllowances } = useTemplateAllowances(templateId || undefined);
  const { data: exHolidays } = useTemplateHolidays(templateId || undefined);
  const { data: exPenalties } = useTemplatePenalties(templateId || undefined);
  const { data: exOvertimes } = useTemplateOvertimes(templateId || undefined);

  // ============ Ngưỡng "net" bù trừ trong ngày (thuộc cấu hình tenant, không thuộc template) ============
  const { data: tenantCompSettings, refetch: refetchCompSettings } = useQuery({
    queryKey: ['tenant-comp-threshold-editor', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('tenants').select('compensation_threshold_minutes').eq('id', tenantId!).maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });
  const [compThreshold, setCompThreshold] = useState<string>('');
  useEffect(() => {
    const v = (tenantCompSettings as any)?.compensation_threshold_minutes;
    setCompThreshold(v == null ? '' : String(v));
  }, [tenantCompSettings]);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const handleSaveThreshold = async () => {
    if (!tenantId) return;
    setSavingThreshold(true);
    try {
      const trimmed = compThreshold.trim();
      const newVal = trimmed === '' ? null : Math.max(0, Number(trimmed) || 0);
      const { error } = await supabase.from('tenants').update({ compensation_threshold_minutes: newVal }).eq('id', tenantId);
      if (error) throw error;
      toast.success(newVal == null ? 'Đã tắt bù trừ trong ngày' : `Đã đặt ngưỡng net = ${newVal} phút`);
      await refetchCompSettings();
    } catch (e: any) {
      toast.error(e.message || 'Không lưu được ngưỡng');
    } finally {
      setSavingThreshold(false);
    }
  };

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setSalaryType(existing.salary_type);
      setBaseAmount(String(existing.base_amount));
      setDescription(existing.description || '');
      setPaidLeaveDays(String((existing as any).paid_leave_days_per_month || 0));
      setBonusEnabled((existing as any).bonus_enabled || false);
      setCommissionEnabled((existing as any).commission_enabled || false);
      setAllowanceEnabled((existing as any).allowance_enabled || false);
      setHolidayEnabled((existing as any).holiday_enabled || false);
      setPenaltyEnabled((existing as any).penalty_enabled || false);
      setOvertimeEnabled((existing as any).overtime_enabled || false);
      setEnableOvertime((existing as any).enable_overtime || false);
    }
  }, [existing]);

  useEffect(() => { if (exBonuses?.length) setBonuses(exBonuses.map(b => ({ bonus_type: b.bonus_type, name: b.name, calc_type: b.calc_type, value: Number(b.value), threshold: Number(b.threshold || 0), tiers: Array.isArray((b as any).tiers) ? (b as any).tiers : [] }))); }, [exBonuses]);
  useEffect(() => { if (exCommissions?.length) setCommissions(exCommissions.map((c: any) => ({ target_type: c.target_type, target_id: c.target_id || '', target_name: c.target_name, calc_type: c.calc_type, value: Number(c.value), only_self_sold: !!c.only_self_sold, count_in_revenue_kpi: c.count_in_revenue_kpi !== false }))); }, [exCommissions]);
  useEffect(() => { if (exAllowances?.length) setAllowances(exAllowances.map(a => ({ allowance_type: a.allowance_type, name: a.name, amount: Number(a.amount), is_fixed: a.is_fixed, max_absent_days: Number((a as any).max_absent_days || 0) }))); }, [exAllowances]);
  useEffect(() => { if (exHolidays?.length) setHolidays(exHolidays.map(h => ({ holiday_name: h.holiday_name, holiday_date: h.holiday_date, multiplier_percent: Number(h.multiplier_percent) }))); }, [exHolidays]);
  useEffect(() => {
    if (exPenalties?.length) setPenalties(exPenalties.map(p => {
      const rawDesc = p.description || '';
      const m = rawDesc.match(/^\[bonus:([^\]]+)\]\s*/);
      return {
        penalty_type: p.penalty_type,
        name: p.name,
        amount: Number(p.amount),
        description: m ? rawDesc.replace(m[0], '') : rawDesc,
        threshold_minutes: (p as any).threshold_minutes || 0,
        full_day_absence_minutes: (p as any).full_day_absence_minutes || 0,
        kpi_target: Number((p as any).kpi_target || 0),
        tiers: Array.isArray((p as any).tiers) ? (p as any).tiers : [],
        linked_bonus_key: m ? m[1] : undefined,
      };
    }));
  }, [exPenalties]);
  useEffect(() => { if (exOvertimes?.length) setOvertimes(exOvertimes.map(o => ({ overtime_type: o.overtime_type, name: o.name, calc_type: o.calc_type, value: Number(o.value), description: o.description || '' }))); }, [exOvertimes]);

  const handleSave = async () => {
    if (!name || !tenantId) return;
    const payload: any = {
      name,
      salary_type: salaryType,
      base_amount: Number(baseAmount) || 0,
      paid_leave_days_per_month: Number(paidLeaveDays) || 0,
      description: description || null,
      bonus_enabled: bonusEnabled,
      commission_enabled: commissionEnabled,
      allowance_enabled: allowanceEnabled,
      holiday_enabled: holidayEnabled,
      penalty_enabled: penaltyEnabled,
      overtime_enabled: overtimeEnabled,
      enable_overtime: enableOvertime,
    };

    try {
      let id = templateId;
      if (templateId) {
        const updated = await updateTemplate.mutateAsync({ id: templateId, ...payload });
        id = updated.id;
      } else {
        const created = await createTemplate.mutateAsync({ tenant_id: tenantId, ...payload });
        id = created.id;
      }

      if (id) {
        await saveConfigs.mutateAsync({
          templateId: id,
          tenantId,
          bonuses: bonusEnabled ? bonuses : [],
          commissions: commissionEnabled ? commissions : [],
          allowances: allowanceEnabled ? allowances : [],
          holidays: holidayEnabled ? holidays : [],
          penalties: penaltyEnabled ? penalties.map(p => {
            const { linked_bonus_key, description, ...rest } = p;
            const desc = linked_bonus_key ? `[bonus:${linked_bonus_key}] ${description || ''}`.trim() : description;
            return { ...rest, description: desc };
          }) : [],
          overtimes: overtimeEnabled ? overtimes : [],
        });

        onSaved?.(id);
      }

      // Wait for cache to fully refresh before closing
      await qc.refetchQueries({ queryKey: ['salary-templates'] });

      toast.success('Lưu mẫu lương thành công');
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending || saveConfigs.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft className="h-4 w-4 mr-1" />Quay lại</Button>
        <h3 className="font-semibold">{templateId ? 'Sửa mẫu lương' : 'Tạo mẫu lương'}</h3>
      </div>

      {/* 1. LƯƠNG CHÍNH */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">1. Lương chính</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tên mẫu <span className="text-destructive">*</span></Label>
            <Input placeholder="VD: Lương nhân viên bán hàng" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Loại lương</Label>
              <Select value={salaryType} onValueChange={setSalaryType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SALARY_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mức lương (VNĐ)</Label>
              <NumberInput placeholder="0" value={baseAmount} onChangeNumber={n => setBaseAmount(String(n))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {salaryType === 'fixed' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Số ngày nghỉ có lương / tháng</Label>
                <NumberInput min={0} max={30} placeholder="0" value={paidLeaveDays} onChangeNumber={n => setPaidLeaveDays(String(n))} />
                <p className="text-[10px] text-muted-foreground">Số ngày NV được nghỉ mà vẫn hưởng lương</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Mô tả</Label>
              <Input placeholder="Ghi chú" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
          <div className="border rounded-lg p-3 bg-muted/30 space-y-1">
            <div className="flex items-center gap-2">
              <Switch checked={enableOvertime} onCheckedChange={setEnableOvertime} />
              <Label className="text-xs font-medium">Cho phép tính tăng ca</Label>
            </div>
            <p className="text-[10px] text-muted-foreground pl-9">
              {enableOvertime
                ? '✅ NV phải được xếp lịch làm việc. Ngoài giờ quy định sẽ được tính tăng ca (cần admin phê duyệt).'
                : '⏸️ Tắt: NV chỉ cần check-in/out, hệ thống ghi nhận giờ làm và trả lương theo thực tế. Không cần xếp lịch, không tính tăng ca.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 2. THƯỞNG */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">2. Thưởng (Bonus)</CardTitle>
            <Switch checked={bonusEnabled} onCheckedChange={setBonusEnabled} />
          </div>
        </CardHeader>
        {bonusEnabled && (
          <CardContent className="space-y-3">
            {bonuses.map((b, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex justify-between items-start">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <div className="space-y-1">
                      <Label className="text-xs">Loại thưởng</Label>
                      <Select value={b.bonus_type} onValueChange={v => { const n = [...bonuses]; n[i].bonus_type = v; n[i].name = BONUS_TYPES.find(t => t.value === v)?.label || ''; setBonuses(n); }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{BONUS_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Hình thức</Label>
                      <Select value={b.calc_type} onValueChange={v => { const n = [...bonuses]; n[i].calc_type = v; setBonuses(n); }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed_amount">Số tiền cố định</SelectItem>
                          <SelectItem value="percentage">Phần trăm (%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(b.bonus_type === 'kpi_personal' || b.bonus_type === 'branch_revenue' || b.bonus_type === 'branch_revenue' || b.bonus_type === 'gross_profit') && (
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {b.bonus_type === 'kpi_personal' ? 'Doanh số cá nhân đạt (VNĐ)'
                            : b.bonus_type === 'branch_revenue' ? 'Doanh thu chi nhánh đạt (VNĐ)'
                            : b.bonus_type === 'gross_profit' ? 'Lợi nhuận gộp đạt (VNĐ)'
                            : 'Mức tối thiểu (VNĐ)'}
                        </Label>
                        <NumberInput className="h-8 text-xs" value={b.threshold} onChangeNumber={v => { const n = [...bonuses]; n[i].threshold = v; setBonuses(n); }} />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">{b.calc_type === 'percentage' ? 'Tỷ lệ (%)' : 'Số tiền (VNĐ)'}</Label>
                      <NumberInput className="h-8 text-xs" value={b.value} onChangeNumber={v => { const n = [...bonuses]; n[i].value = v; setBonuses(n); }} />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-1" onClick={() => setBonuses(bonuses.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {(b.bonus_type === 'kpi_personal' || b.bonus_type === 'branch_revenue' || b.bonus_type === 'gross_profit') && (
                  <div className="border-t pt-2 mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">
                        {b.bonus_type === 'gross_profit' ? 'Mức thưởng vượt LN gộp' : 'Mức thưởng vượt KPI'}
                      </Label>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { const n = [...bonuses]; n[i].tiers = [...(n[i].tiers || []), { percent_over: 10, calc_type: 'fixed_amount', value: 0 }]; setBonuses(n); }}>
                        <Plus className="h-3 w-3 mr-1" />Thêm mức vượt
                      </Button>
                    </div>
                    {(b.tiers || []).map((t, ti) => (
                      <div key={ti} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-3 space-y-1">
                          <Label className="text-[10px]">
                            {b.bonus_type === 'gross_profit' ? 'Vượt LN (%)' : 'Vượt KPI (%)'}
                          </Label>
                          <NumberInput className="h-8 text-xs" value={t.percent_over} onChangeNumber={v => { const n = [...bonuses]; n[i].tiers[ti].percent_over = v; setBonuses(n); }} />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-[10px]">Hình thức</Label>
                          <Select value={t.calc_type} onValueChange={v => { const n = [...bonuses]; n[i].tiers[ti].calc_type = v as any; setBonuses(n); }}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed_amount">Số tiền</SelectItem>
                              <SelectItem value="percentage">
                                {b.bonus_type === 'gross_profit' ? '% LN gộp' : '% doanh thu'}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-5 space-y-1">
                          <Label className="text-[10px]">{t.calc_type === 'percentage' ? 'Tỷ lệ (%)' : 'Thưởng thêm (VNĐ)'}</Label>
                          <NumberInput className="h-8 text-xs" value={t.value} onChangeNumber={v => { const n = [...bonuses]; n[i].tiers[ti].value = v; setBonuses(n); }} />
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive col-span-1" onClick={() => { const n = [...bonuses]; n[i].tiers = n[i].tiers.filter((_, j) => j !== ti); setBonuses(n); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    {(b.tiers || []).length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        💡 <strong>Vượt (%)</strong> = % vượt thêm so với mức cơ bản. VD: mục tiêu 50tr, "Vượt 100%" nghĩa là đạt 100tr (vượt thêm 50tr = 100% mục tiêu).<br/>
                        <strong>CỘNG DỒN</strong>: Tổng thưởng = Thưởng cơ bản (khi đạt mục tiêu) <strong>+</strong> "Thưởng thêm" của mức vượt cao nhất đạt được.<br/>
                        {b.bonus_type === 'branch_revenue' && <>📍 Doanh thu chi nhánh tính theo chi nhánh nhân viên đó đang làm việc.<br/></>}
                        {b.bonus_type === 'gross_profit' && <>📍 Lợi nhuận gộp = (Giá bán - Giá nhập) × SL của các đơn nhân viên đó bán.<br/></>}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setBonuses([...bonuses, { bonus_type: 'fixed', name: 'Thưởng cố định', calc_type: 'fixed_amount', value: 0, threshold: 0, tiers: [] }])}>
              <Plus className="h-3.5 w-3.5 mr-1" />Thêm mức thưởng
            </Button>
          </CardContent>
        )}
      </Card>

      {/* 2.5 TĂNG CA */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">2.5. Tăng ca (Overtime)</CardTitle>
            <Switch checked={overtimeEnabled} onCheckedChange={setOvertimeEnabled} />
          </div>
        </CardHeader>
        {overtimeEnabled && (
          <CardContent className="space-y-3">
            {overtimes.map((o, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex justify-between items-start">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <div className="space-y-1">
                      <Label className="text-xs">Loại tăng ca</Label>
                      <Select value={o.overtime_type} onValueChange={v => { const n = [...overtimes]; n[i].overtime_type = v; n[i].name = OVERTIME_TYPES.find(t => t.value === v)?.label || ''; n[i].calc_type = v === 'full_day' ? 'multiplier' : 'fixed_amount'; n[i].value = v === 'full_day' ? 150 : 0; setOvertimes(n); }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{OVERTIME_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    {o.overtime_type === 'full_day' && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Hệ số lương (%)</Label>
                          <NumberInput className="h-8 text-xs" value={o.value} onChangeNumber={v => { const n = [...overtimes]; n[i].value = v; setOvertimes(n); }} />
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">
                            💡 Ngày nghỉ theo lịch nhưng nhân viên vẫn chấm công đi làm → lương ngày đó = <strong>{o.value}%</strong> mức lương chính.
                            <br />Hệ thống tự xác định dựa vào lịch xếp ca (ngày vắng) + dữ liệu chấm công (vẫn đi làm).
                          </p>
                        </div>
                      </>
                    )}

                    {o.overtime_type === 'hourly' && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Số tiền mỗi giờ OT (VNĐ)</Label>
                          <NumberInput className="h-8 text-xs" value={o.value} onChangeNumber={v => { const n = [...overtimes]; n[i].value = v; setOvertimes(n); }} />
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">
                            💡 Mỗi giờ tăng ca = <strong>{formatNumber(o.value)}đ</strong>. Số giờ OT được tính từ dữ liệu chấm công.
                          </p>
                        </div>
                      </>
                    )}

                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Ghi chú</Label>
                      <Input className="h-8 text-xs" placeholder="VD: Áp dụng cho ngày CN" value={o.description} onChange={e => { const n = [...overtimes]; n[i].description = e.target.value; setOvertimes(n); }} />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-1" onClick={() => setOvertimes(overtimes.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setOvertimes([...overtimes, { overtime_type: 'full_day', name: 'Tăng ca nguyên ngày', calc_type: 'multiplier', value: 150, description: '' }])}>
              <Plus className="h-3.5 w-3.5 mr-1" />Thêm loại tăng ca
            </Button>
          </CardContent>
        )}
      </Card>

      {/* 3. HOA HỒNG */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">3. Hoa hồng (Commission)</CardTitle>
            <Switch checked={commissionEnabled} onCheckedChange={setCommissionEnabled} />
          </div>
        </CardHeader>
        {commissionEnabled && (
          <CardContent className="space-y-3">
            {commissions.map((c, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex justify-between items-start">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <div className="space-y-1">
                      <Label className="text-xs">Theo</Label>
                      <Select value={c.target_type} onValueChange={v => { const n = [...commissions]; n[i].target_type = v; n[i].target_name = ''; n[i].target_id = ''; setCommissions(n); }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{COMMISSION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {c.target_type === 'category' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Danh mục</Label>
                        <Select value={c.target_id} onValueChange={v => { const n = [...commissions]; n[i].target_id = v; n[i].target_name = categories?.find(cat => cat.id === v)?.name || ''; setCommissions(n); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Chọn..." /></SelectTrigger>
                          <SelectContent>{categories?.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    {(c.target_type === 'product' || c.target_type === 'service') && (
                      <div className="space-y-1">
                        <Label className="text-xs">Tên {c.target_type === 'product' ? 'sản phẩm' : 'dịch vụ'}</Label>
                        <ProductPicker
                          tenantId={tenantId}
                          value={c.target_name}
                          placeholder={`Chọn ${c.target_type === 'product' ? 'sản phẩm' : 'dịch vụ'}...`}
                          onChange={(v) => { const n = [...commissions]; n[i].target_name = v; n[i].target_id = ''; setCommissions(n); }}
                        />
                      </div>
                    )}
                     <div className="space-y-1">
                       <Label className="text-xs">Hình thức</Label>
                       <Select value={c.calc_type} onValueChange={v => { const n = [...commissions]; n[i].calc_type = v; setCommissions(n); }}>
                         <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                         <SelectContent>
                           <SelectItem value="percentage">% giá bán</SelectItem>
                           <SelectItem value="fixed_amount">Số tiền cố định / 1 sản phẩm bán ra</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                     <div className="space-y-1">
                       <Label className="text-xs">
                         {c.calc_type === 'percentage'
                           ? (c.target_type === 'revenue'
                               ? 'Tỷ lệ (%) trên tổng doanh thu cá nhân'
                               : 'Tỷ lệ (%) / mỗi đơn')
                           : (c.target_type === 'revenue'
                               ? 'Số tiền VNĐ cố định / kỳ (khi có doanh thu)'
                               : 'Số tiền VNĐ / 1 sản phẩm bán ra')}
                       </Label>
                       <NumberInput className="h-8 text-xs" value={c.value} onChangeNumber={v => { const n = [...commissions]; n[i].value = v; setCommissions(n); }} />
                       {c.calc_type === 'fixed_amount' && (
                         <p className="text-[10px] text-muted-foreground">
                           💡 {c.target_type === 'revenue'
                                 ? 'Cộng cố định 1 lần trong kỳ khi nhân viên có doanh thu.'
                                 : `Nhân với số lượng sản phẩm thuộc ${c.target_type === 'category' ? 'danh mục' : c.target_type === 'service' ? 'dịch vụ' : 'sản phẩm'} này NV bán được trong kỳ.`}
                         </p>
                       )}
                     </div>
                     <div className="col-span-2 flex items-start gap-2 rounded-md border border-dashed border-orange-300 bg-orange-50/60 p-2">
                         <Switch
                           id={`only-self-sold-${i}`}
                           checked={!!c.only_self_sold}
                           onCheckedChange={(v) => { const n = [...commissions]; n[i].only_self_sold = v; setCommissions(n); }}
                         />
                         <div className="space-y-0.5">
                           <Label htmlFor={`only-self-sold-${i}`} className="text-xs font-medium cursor-pointer">
                             Chỉ áp dụng cho đơn của nhân viên
                           </Label>
                           <p className="text-[10px] text-muted-foreground">
                             Khi bật: hoa hồng này CHỈ tính cho đơn mà nhân viên đã tick "Đơn này khách của nhân viên" lúc xuất hàng. Khi tắt: tính cho TẤT CẢ đơn nhân viên bán.
                           </p>
                         </div>
                     </div>
                      {c.only_self_sold && (
                        <div className="col-span-2 flex items-start gap-2 rounded-md border border-dashed border-blue-300 bg-blue-50/60 p-2">
                          <Switch
                            id={`count-kpi-${i}`}
                            checked={c.count_in_revenue_kpi !== false}
                            onCheckedChange={(v) => { const n = [...commissions]; n[i].count_in_revenue_kpi = v; setCommissions(n); }}
                          />
                          <div className="space-y-0.5">
                            <Label htmlFor={`count-kpi-${i}`} className="text-xs font-medium cursor-pointer">
                              Tính đơn tự bán (doanh số KPI + hoa hồng)
                            </Label>
                            <p className="text-[10px] text-muted-foreground">
                              Khi BẬT (mặc định): các đơn tự bán VẪN được cộng vào doanh số xét KPI thưởng VÀ vẫn được tính hoa hồng theo rule này. Khi TẮT: bỏ qua hoàn toàn — KHÔNG cộng KPI, KHÔNG tính hoa hồng cho các đơn tự bán đó.
                            </p>
                          </div>
                        </div>
                      )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-1" onClick={() => setCommissions(commissions.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setCommissions([...commissions, { target_type: 'product', target_id: '', target_name: '', calc_type: 'percentage', value: 0, only_self_sold: false, count_in_revenue_kpi: true }])}>
              <Plus className="h-3.5 w-3.5 mr-1" />Thêm hoa hồng
            </Button>
          </CardContent>
        )}
      </Card>

      {/* 4. PHỤ CẤP */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">4. Phụ cấp (Allowance)</CardTitle>
            <Switch checked={allowanceEnabled} onCheckedChange={setAllowanceEnabled} />
          </div>
        </CardHeader>
        {allowanceEnabled && (
          <CardContent className="space-y-3">
            {allowances.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {ALLOWANCE_PRESETS.map(p => (
                  <Button key={p.type} variant="outline" size="sm" className="text-xs" onClick={() => setAllowances([...allowances, { allowance_type: p.type, name: p.name, amount: 0, is_fixed: true, max_absent_days: 0 }])}>
                    <Plus className="h-3 w-3 mr-1" />{p.name}
                  </Button>
                ))}
              </div>
            )}
            {allowances.map((a, i) => (
              <div key={i} className="space-y-1 border rounded p-2">
                <div className="flex items-center gap-2">
                  <Input className="h-8 text-xs flex-1" placeholder="Tên phụ cấp" value={a.name} onChange={e => { const n = [...allowances]; n[i].name = e.target.value; setAllowances(n); }} />
                  <NumberInput className="h-8 text-xs w-28" placeholder="Số tiền" value={a.amount} onChangeNumber={v => { const n = [...allowances]; n[i].amount = v; setAllowances(n); }} />
                  <Select value={a.is_fixed ? 'fixed' : 'manual'} onValueChange={v => { const n = [...allowances]; n[i].is_fixed = v === 'fixed'; setAllowances(n); }}>
                    <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Cố định</SelectItem>
                      <SelectItem value="manual">Nhập tay</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setAllowances(allowances.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 pl-1">
                  <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Vắng quá (ngày) → mất phụ cấp:</Label>
                  <NumberInput min={0} className="h-7 text-xs w-20" placeholder="0 = không áp dụng" value={a.max_absent_days || ''} onChangeNumber={v => { const n = [...allowances]; n[i].max_absent_days = v; setAllowances(n); }} />
                  <span className="text-[10px] text-muted-foreground">{a.max_absent_days > 0 ? `Phải đi đủ ≥ (số ngày tháng − ${a.max_absent_days}) ngày mới nhận phụ cấp này` : 'Luôn nhận phụ cấp'}</span>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setAllowances([...allowances, { allowance_type: 'custom', name: '', amount: 0, is_fixed: true, max_absent_days: 0 }])}>
              <Plus className="h-3.5 w-3.5 mr-1" />Thêm phụ cấp
            </Button>
          </CardContent>
        )}
      </Card>

      {/* 5. NGÀY LỄ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">5. Tăng lương ngày lễ</CardTitle>
            <Switch checked={holidayEnabled} onCheckedChange={v => {
              setHolidayEnabled(v);
              if (v && holidays.length === 0) {
                setHolidays(VN_HOLIDAYS.map(h => ({ holiday_name: h.name, holiday_date: h.date, multiplier_percent: h.date === 'tet' ? 400 : 200 })));
              }
            }} />
          </div>
        </CardHeader>
        {holidayEnabled && (
          <CardContent className="space-y-3">
            {holidays.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input className="h-8 text-xs flex-1" placeholder="Tên ngày lễ" value={h.holiday_name} onChange={e => { const n = [...holidays]; n[i].holiday_name = e.target.value; setHolidays(n); }} />
                <Input className="h-8 text-xs w-20" placeholder="MM-DD" value={h.holiday_date} onChange={e => { const n = [...holidays]; n[i].holiday_date = e.target.value; setHolidays(n); }} />
                <div className="flex items-center gap-1">
                  <NumberInput className="h-8 text-xs w-20" value={h.multiplier_percent} onChangeNumber={v => { const n = [...holidays]; n[i].multiplier_percent = v; setHolidays(n); }} />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setHolidays(holidays.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setHolidays([...holidays, { holiday_name: '', holiday_date: '', multiplier_percent: 200 }])}>
              <Plus className="h-3.5 w-3.5 mr-1" />Thêm ngày lễ
            </Button>
          </CardContent>
        )}
      </Card>

      {/* 6. PHẠT */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">6. Phạt (Penalty)</CardTitle>
            <Switch checked={penaltyEnabled} onCheckedChange={setPenaltyEnabled} />
          </div>
        </CardHeader>
        {penaltyEnabled && (
          <CardContent className="space-y-3">
            {/* === Cấu hình ngưỡng "net" bù trừ trong ngày === */}
            <div className="border-2 border-blue-300 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                  ⏱️ Ngưỡng bù trừ trong ngày (net)
                </Label>
                <div className="flex items-center gap-2">
                  <NumberInput
                    className="h-8 text-xs w-20"
                    placeholder="Trống = tắt"
                    value={compThreshold}
                    onChangeNumber={(v) => setCompThreshold(v ? String(v) : '')}
                  />
                  <span className="text-[11px] text-muted-foreground">phút</span>
                  <Button size="sm" className="h-8 text-xs" onClick={handleSaveThreshold} disabled={savingThreshold}>
                    {savingThreshold ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Lưu ngưỡng'}
                  </Button>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
                <p>
                  <strong className="text-foreground">Cách hoạt động:</strong> Hệ thống tự đối chiếu giờ <em>check-in/out</em> với ca làm để tính <em>net = (vào sớm + về trễ) − (vào trễ + về sớm)</em>.
                </p>
                <p>
                  • <strong>net &gt; 0</strong> (làm dư): Nếu vượt ngưỡng → tự tạo <strong>phiếu tăng ca chờ duyệt</strong> (admin có duyệt mới được thưởng theo đơn giá OT).
                </p>
                <p>
                  • <strong>net &lt; 0</strong> (làm thiếu): Nếu vượt ngưỡng → tự tạo <strong>phiếu xin đi trễ/về sớm chờ duyệt</strong>, admin chọn 1 trong 3:
                </p>
                <ul className="ml-5 list-disc space-y-0.5">
                  <li><strong className="text-green-700 dark:text-green-400">❌ Không trừ lương</strong> (miễn phạt — vd đi giao hàng cho shop)</li>
                  <li><strong className="text-amber-700 dark:text-amber-400">💰 Trừ theo đơn giá tăng ca</strong> (lý do việc riêng — nhẹ hơn phạt)</li>
                  <li><strong className="text-red-700 dark:text-red-400">⚠️ Phạt theo cấu hình bên dưới</strong> (lý do không chính đáng — nặng nhất)</li>
                </ul>
                <p className="pt-1 italic">
                  💡 Để <strong>trống</strong> = tắt bù trừ, mọi chênh lệch dù 1 phút cũng phải xin phép/tăng ca. Đặt VD <strong>15p</strong> = chênh trong 15 phút coi như đủ công.
                </p>
                <p className="text-[10px]">
                  Khi admin <strong>sửa giờ check-in/out</strong> trong tab "Sửa công" mà NV còn trễ/về sớm, hệ thống cũng hiện 3 nút trên để bạn chọn cách xử lý.
                </p>
              </div>
            </div>

            {penalties.map((p, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex justify-between items-start">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <div className="space-y-1">
                      <Label className="text-xs">Loại</Label>
                      <Select value={p.penalty_type} onValueChange={v => { const n = [...penalties]; n[i].penalty_type = v; n[i].name = PENALTY_TYPES.find(t => t.value === v)?.label || ''; setPenalties(n); }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{PENALTY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {p.penalty_type !== 'kpi_not_met' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Số tiền phạt (VNĐ)</Label>
                        <NumberInput className="h-8 text-xs" value={p.amount} onChangeNumber={v => { const n = [...penalties]; n[i].amount = v; setPenalties(n); }} />
                      </div>
                    )}
                    {(p.penalty_type === 'late' || p.penalty_type === 'early_leave') && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">{p.penalty_type === 'late' ? 'Trễ từ (phút)' : 'Về sớm từ (phút)'}</Label>
                          <NumberInput className="h-8 text-xs" placeholder="0 = phạt ngay" value={p.threshold_minutes || ''} onChangeNumber={v => { const n = [...penalties]; n[i].threshold_minutes = v; setPenalties(n); }} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{p.penalty_type === 'late' ? 'Trễ ≥ (phút) = nghỉ ngày' : 'Sớm ≥ (phút) = nghỉ ngày'}</Label>
                          <NumberInput className="h-8 text-xs" placeholder="0 = không áp dụng" value={p.full_day_absence_minutes || ''} onChangeNumber={v => { const n = [...penalties]; n[i].full_day_absence_minutes = v; setPenalties(n); }} />
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">
                            💡 {p.penalty_type === 'late' ? 'Đi trễ' : 'Về sớm'} từ <strong>{p.threshold_minutes || 0} phút</strong> → phạt <strong>{formatNumber(p.amount)}đ</strong>/lần.
                            {p.full_day_absence_minutes > 0 && (
                              <> {p.penalty_type === 'late' ? ' Trễ' : ' Sớm'} ≥ <strong>{p.full_day_absence_minutes} phút</strong> → tính nghỉ nguyên ngày (không tính công).</>
                            )}
                          </p>
                        </div>
                      </>
                    )}
                    {p.penalty_type === 'violation' && (
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Mô tả nội quy</Label>
                        <Input className="h-8 text-xs" placeholder="VD: Không mặc đồng phục" value={p.description} onChange={e => { const n = [...penalties]; n[i].description = e.target.value; setPenalties(n); }} />
                      </div>
                    )}
                    {p.penalty_type === 'kpi_not_met' && (
                      <>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs">Liên kết KPI từ mục Thưởng</Label>
                          {(() => {
                            const kpiBonuses = bonuses
                              .map((b, idx) => ({ b, idx }))
                              .filter(({ b }) => ['kpi_personal', 'branch_revenue', 'gross_profit'].includes(b.bonus_type));
                            const usedKeys = new Set(
                              penalties
                                .filter((pp, j) => j !== i && pp.penalty_type === 'kpi_not_met' && pp.linked_bonus_key)
                                .map(pp => pp.linked_bonus_key!)
                            );
                            if (!bonusEnabled || kpiBonuses.length === 0) {
                              return (
                                <>
                                  <p className="text-[10px] text-amber-600 border border-amber-300 bg-amber-50 rounded p-2">
                                    ⚠️ Chưa có KPI nào ở mục <strong>2. Thưởng</strong>. Vui lòng bật & cấu hình KPI cá nhân / chi nhánh / lợi nhuận gộp ở trên trước.
                                  </p>
                                  <NumberInput className="h-8 text-xs mt-2" placeholder="Hoặc nhập KPI thủ công (VNĐ)" value={p.kpi_target} onChangeNumber={v => { const n = [...penalties]; n[i].kpi_target = v; setPenalties(n); }} />
                                </>
                              );
                            }
                            return (
                              <Select
                                value={p.linked_bonus_key || ''}
                                onValueChange={(v) => {
                                  const n = [...penalties];
                                  const picked = kpiBonuses.find(({ b, idx }) => `${b.bonus_type}:${idx}` === v);
                                  n[i].linked_bonus_key = v;
                                  if (picked) n[i].kpi_target = Number(picked.b.threshold || 0);
                                  setPenalties(n);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Chọn KPI cấu hình ở mục Thưởng..." /></SelectTrigger>
                                <SelectContent>
                                  {kpiBonuses.map(({ b, idx }) => {
                                    const key = `${b.bonus_type}:${idx}`;
                                    const disabled = usedKeys.has(key) && key !== p.linked_bonus_key;
                                    const typeLabel = BONUS_TYPES.find(t => t.value === b.bonus_type)?.label || b.bonus_type;
                                    return (
                                      <SelectItem key={key} value={key} disabled={disabled}>
                                        {typeLabel} – Mục tiêu: {formatNumber(b.threshold || 0)}đ {disabled && '(đã chọn)'}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            );
                          })()}
                          {p.linked_bonus_key && (
                            <p className="text-[10px] text-muted-foreground">
                              💡 KPI mục tiêu đã đồng bộ: <strong>{formatNumber(p.kpi_target)}đ</strong>. Không đạt 100% sẽ bị phạt theo các mức bên dưới.
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-1" onClick={() => setPenalties(penalties.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {p.penalty_type === 'kpi_not_met' && (
                  <div className="border-t pt-2 mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Mức phạt theo % KPI đạt được</Label>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { const n = [...penalties]; n[i].tiers = [...(n[i].tiers || []), { percent_achieved: 50, penalty_amount: 0 }]; setPenalties(n); }}>
                        <Plus className="h-3 w-3 mr-1" />Thêm mức phạt
                      </Button>
                    </div>
                    {(p.tiers || []).map((t, ti) => (
                      <div key={ti} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5 space-y-1">
                          <Label className="text-[10px]">Đạt ≤ (% KPI)</Label>
                          <NumberInput className="h-8 text-xs" value={t.percent_achieved} onChangeNumber={v => { const n = [...penalties]; n[i].tiers[ti].percent_achieved = v; setPenalties(n); }} />
                        </div>
                        <div className="col-span-6 space-y-1">
                          <Label className="text-[10px]">Phạt (VNĐ)</Label>
                          <NumberInput className="h-8 text-xs" value={t.penalty_amount} onChangeNumber={v => { const n = [...penalties]; n[i].tiers[ti].penalty_amount = v; setPenalties(n); }} />
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive col-span-1" onClick={() => { const n = [...penalties]; n[i].tiers = n[i].tiers.filter((_, j) => j !== ti); setPenalties(n); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    {(p.tiers || []).length > 0 && (
                      <p className="text-[10px] text-muted-foreground">💡 Chỉ áp dụng <strong>1 mức phạt duy nhất</strong> – mức gần nhất ≥ % KPI đạt được (KHÔNG cộng dồn). VD: đạt 45% → chỉ phạt theo mức "Đạt ≤ 50%".</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setPenalties([...penalties, { penalty_type: 'late', name: 'Đi trễ', amount: 0, description: '', threshold_minutes: 0, full_day_absence_minutes: 0, kpi_target: 0, tiers: [] }])}>
              <Plus className="h-3.5 w-3.5 mr-1" />Thêm phạt
            </Button>
          </CardContent>
        )}
      </Card>

      {/* SAVE */}
      <div className="sticky bottom-0 bg-background border-t py-3 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Hủy</Button>
        <Button onClick={handleSave} disabled={isPending || !name}>
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Lưu mẫu lương
        </Button>
      </div>
    </div>
  );
}
