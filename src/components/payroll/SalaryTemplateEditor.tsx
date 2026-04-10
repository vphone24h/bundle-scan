import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Plus, Trash2, Save } from 'lucide-react';
import { useSalaryTemplates, useCreateSalaryTemplate, useUpdateSalaryTemplate, useTemplateBonuses, useTemplateCommissions, useTemplateAllowances, useTemplateHolidays, useTemplatePenalties, useSaveTemplateConfigs } from '@/hooks/usePayroll';
import { useCategories } from '@/hooks/useCategories';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/formatNumber';

const SALARY_TYPES = [
  { value: 'fixed', label: 'Lương cố định' },
  { value: 'hourly', label: 'Lương theo giờ' },
  { value: 'daily', label: 'Lương theo ngày' },
  { value: 'shift', label: 'Lương theo ca' },
];

const BONUS_TYPES = [
  { value: 'fixed', label: 'Thưởng cố định' },
  { value: 'kpi_personal', label: 'KPI doanh thu cá nhân' },
  { value: 'branch_revenue', label: 'Doanh thu chi nhánh' },
  { value: 'overtime', label: 'Tăng ca' },
  { value: 'gross_profit', label: 'Lợi nhuận gộp' },
];

const COMMISSION_TYPES = [
  { value: 'product', label: 'Sản phẩm' },
  { value: 'service', label: 'Dịch vụ' },
  { value: 'category', label: 'Danh mục' },
];

const PENALTY_TYPES = [
  { value: 'late', label: 'Đi trễ' },
  { value: 'early_leave', label: 'Về sớm' },
  { value: 'absent_no_permission', label: 'Nghỉ không phép' },
  { value: 'violation', label: 'Vi phạm nội quy' },
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

interface BonusRow { bonus_type: string; name: string; calc_type: string; value: number; threshold: number; }
interface CommissionRow { target_type: string; target_id: string; target_name: string; calc_type: string; value: number; }
interface AllowanceRow { allowance_type: string; name: string; amount: number; is_fixed: boolean; }
interface HolidayRow { holiday_name: string; holiday_date: string; multiplier_percent: number; }
interface PenaltyRow { penalty_type: string; name: string; amount: number; description: string; }

interface Props {
  templateId: string | null;
  tenantId?: string;
  onClose: () => void;
  onSaved?: (templateId: string) => void;
}

export function SalaryTemplateEditor({ templateId, tenantId, onClose, onSaved }: Props) {
  const { data: templates } = useSalaryTemplates();
  const createTemplate = useCreateSalaryTemplate();
  const updateTemplate = useUpdateSalaryTemplate();
  const saveConfigs = useSaveTemplateConfigs();
  const { data: categories } = useCategories();

  const existing = templates?.find(t => t.id === templateId);

  const [name, setName] = useState('');
  const [salaryType, setSalaryType] = useState('fixed');
  const [baseAmount, setBaseAmount] = useState('');
  const [description, setDescription] = useState('');

  const [bonusEnabled, setBonusEnabled] = useState(false);
  const [commissionEnabled, setCommissionEnabled] = useState(false);
  const [allowanceEnabled, setAllowanceEnabled] = useState(false);
  const [holidayEnabled, setHolidayEnabled] = useState(false);
  const [penaltyEnabled, setPenaltyEnabled] = useState(false);

  const [bonuses, setBonuses] = useState<BonusRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [allowances, setAllowances] = useState<AllowanceRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [penalties, setPenalties] = useState<PenaltyRow[]>([]);

  const { data: exBonuses } = useTemplateBonuses(templateId || undefined);
  const { data: exCommissions } = useTemplateCommissions(templateId || undefined);
  const { data: exAllowances } = useTemplateAllowances(templateId || undefined);
  const { data: exHolidays } = useTemplateHolidays(templateId || undefined);
  const { data: exPenalties } = useTemplatePenalties(templateId || undefined);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setSalaryType(existing.salary_type);
      setBaseAmount(String(existing.base_amount));
      setDescription(existing.description || '');
      setBonusEnabled((existing as any).bonus_enabled || false);
      setCommissionEnabled((existing as any).commission_enabled || false);
      setAllowanceEnabled((existing as any).allowance_enabled || false);
      setHolidayEnabled((existing as any).holiday_enabled || false);
      setPenaltyEnabled((existing as any).penalty_enabled || false);
    }
  }, [existing]);

  useEffect(() => { if (exBonuses?.length) setBonuses(exBonuses.map(b => ({ bonus_type: b.bonus_type, name: b.name, calc_type: b.calc_type, value: Number(b.value), threshold: Number(b.threshold || 0) }))); }, [exBonuses]);
  useEffect(() => { if (exCommissions?.length) setCommissions(exCommissions.map(c => ({ target_type: c.target_type, target_id: c.target_id || '', target_name: c.target_name, calc_type: c.calc_type, value: Number(c.value) }))); }, [exCommissions]);
  useEffect(() => { if (exAllowances?.length) setAllowances(exAllowances.map(a => ({ allowance_type: a.allowance_type, name: a.name, amount: Number(a.amount), is_fixed: a.is_fixed }))); }, [exAllowances]);
  useEffect(() => { if (exHolidays?.length) setHolidays(exHolidays.map(h => ({ holiday_name: h.holiday_name, holiday_date: h.holiday_date, multiplier_percent: Number(h.multiplier_percent) }))); }, [exHolidays]);
  useEffect(() => { if (exPenalties?.length) setPenalties(exPenalties.map(p => ({ penalty_type: p.penalty_type, name: p.name, amount: Number(p.amount), description: p.description || '' }))); }, [exPenalties]);

  const handleSave = async () => {
    if (!name || !tenantId) return;
    const payload: any = {
      name,
      salary_type: salaryType,
      base_amount: Number(baseAmount) || 0,
      description: description || null,
      bonus_enabled: bonusEnabled,
      commission_enabled: commissionEnabled,
      allowance_enabled: allowanceEnabled,
      holiday_enabled: holidayEnabled,
      penalty_enabled: penaltyEnabled,
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
          penalties: penaltyEnabled ? penalties : [],
        });

        onSaved?.(id);
      }

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
              <Input type="number" placeholder="0" value={baseAmount} onChange={e => setBaseAmount(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mô tả</Label>
            <Input placeholder="Ghi chú" value={description} onChange={e => setDescription(e.target.value)} />
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
                    {(b.bonus_type === 'kpi_personal' || b.bonus_type === 'branch_revenue' || b.bonus_type === 'gross_profit') && (
                      <div className="space-y-1">
                        <Label className="text-xs">Mức tối thiểu (VNĐ)</Label>
                        <Input type="number" className="h-8 text-xs" value={b.threshold} onChange={e => { const n = [...bonuses]; n[i].threshold = Number(e.target.value); setBonuses(n); }} />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">{b.calc_type === 'percentage' ? 'Tỷ lệ (%)' : 'Số tiền (VNĐ)'}</Label>
                      <Input type="number" className="h-8 text-xs" value={b.value} onChange={e => { const n = [...bonuses]; n[i].value = Number(e.target.value); setBonuses(n); }} />
                    </div>
                    {b.bonus_type === 'overtime' && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">💡 Tăng ca tính theo giờ: mỗi giờ OT = {b.calc_type === 'percentage' ? `${b.value}% lương/giờ` : `${formatNumber(b.value)}đ`}</p>
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-1" onClick={() => setBonuses(bonuses.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setBonuses([...bonuses, { bonus_type: 'fixed', name: 'Thưởng cố định', calc_type: 'fixed_amount', value: 0, threshold: 0 }])}>
              <Plus className="h-3.5 w-3.5 mr-1" />Thêm mức thưởng
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
                        <Input className="h-8 text-xs" placeholder="Nhập tên..." value={c.target_name} onChange={e => { const n = [...commissions]; n[i].target_name = e.target.value; setCommissions(n); }} />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Hình thức</Label>
                      <Select value={c.calc_type} onValueChange={v => { const n = [...commissions]; n[i].calc_type = v; setCommissions(n); }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">% giá bán</SelectItem>
                          <SelectItem value="fixed_amount">Số tiền cố định</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{c.calc_type === 'percentage' ? 'Tỷ lệ (%)' : 'Số tiền (VNĐ)'}</Label>
                      <Input type="number" className="h-8 text-xs" value={c.value} onChange={e => { const n = [...commissions]; n[i].value = Number(e.target.value); setCommissions(n); }} />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-1" onClick={() => setCommissions(commissions.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setCommissions([...commissions, { target_type: 'product', target_id: '', target_name: '', calc_type: 'percentage', value: 0 }])}>
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
                  <Button key={p.type} variant="outline" size="sm" className="text-xs" onClick={() => setAllowances([...allowances, { allowance_type: p.type, name: p.name, amount: 0, is_fixed: true }])}>
                    <Plus className="h-3 w-3 mr-1" />{p.name}
                  </Button>
                ))}
              </div>
            )}
            {allowances.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input className="h-8 text-xs flex-1" placeholder="Tên phụ cấp" value={a.name} onChange={e => { const n = [...allowances]; n[i].name = e.target.value; setAllowances(n); }} />
                <Input type="number" className="h-8 text-xs w-28" placeholder="Số tiền" value={a.amount} onChange={e => { const n = [...allowances]; n[i].amount = Number(e.target.value); setAllowances(n); }} />
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
            ))}
            <Button variant="outline" size="sm" onClick={() => setAllowances([...allowances, { allowance_type: 'custom', name: '', amount: 0, is_fixed: true }])}>
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
                  <Input type="number" className="h-8 text-xs w-20" value={h.multiplier_percent} onChange={e => { const n = [...holidays]; n[i].multiplier_percent = Number(e.target.value); setHolidays(n); }} />
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
                    <div className="space-y-1">
                      <Label className="text-xs">Số tiền phạt (VNĐ)</Label>
                      <Input type="number" className="h-8 text-xs" value={p.amount} onChange={e => { const n = [...penalties]; n[i].amount = Number(e.target.value); setPenalties(n); }} />
                    </div>
                    {p.penalty_type === 'violation' && (
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Mô tả nội quy</Label>
                        <Input className="h-8 text-xs" placeholder="VD: Không mặc đồng phục" value={p.description} onChange={e => { const n = [...penalties]; n[i].description = e.target.value; setPenalties(n); }} />
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-1" onClick={() => setPenalties(penalties.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setPenalties([...penalties, { penalty_type: 'late', name: 'Đi trễ', amount: 0, description: '' }])}>
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
