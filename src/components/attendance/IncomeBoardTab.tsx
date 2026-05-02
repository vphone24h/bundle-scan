import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformUser } from '@/hooks/useTenant';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sparkles,
  Wallet,
  TrendingUp,
  Target,
  CalendarCheck,
  AlertTriangle,
  Trophy,
  ChevronRight,
  Loader2,
  RefreshCw,
  Flame,
  PiggyBank,
  Clock,
  CheckCircle2,
  XCircle,
  Gift,
} from 'lucide-react';

function fmt(n: number | undefined | null) {
  return Math.round(Number(n || 0)).toLocaleString('vi-VN') + 'đ';
}
function fmtShort(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'tỷ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'tr';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k';
  return String(n);
}

export function IncomeBoardTab() {
  const { user } = useAuth();
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;
  const [showDetail, setShowDetail] = useState(false);
  const [showBoost, setShowBoost] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['preview-payroll', user?.id, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('preview-payroll', {
        body: { tenant_id: tenantId, user_id: user!.id },
      });
      if (error) throw error;
      if (data?.error || !data?.success) throw new Error(data?.error || 'Không tải được');
      return data as {
        success: true;
        record: any;
        period_start: string;
        period_end: string;
        today: string;
      };
    },
    enabled: !!user?.id && !!tenantId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const r = data?.record;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!r) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          <Wallet className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>Chưa có cấu hình lương cho bạn.</p>
          <p className="text-xs mt-1">Liên hệ quản lý để được gắn mẫu lương.</p>
        </CardContent>
      </Card>
    );
  }

  const cs = r.config_snapshot || {};
  const isReady = cs.is_payroll_ready !== false;

  return (
    <div className="space-y-3">
      {/* HEADER: Lương tạm tính realtime */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Bảng thu nhập realtime
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                Kỳ {data?.period_start.slice(8, 10)}/{data?.period_start.slice(5, 7)} – hôm nay
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setShowDetail(true)}
            className="w-full text-left group"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary tabular-nums">
                {fmt(r.net_salary)}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Thực nhận tạm tính (chạm xem chi tiết)</p>
          </button>

          {!isReady && (
            <div className="mt-2 p-2 rounded bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 text-[11px] text-yellow-800 dark:text-yellow-200 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Chưa đủ cấu hình ({(cs.missing_setup_reasons || []).join(', ')}). Lương = 0 cho đến khi quản lý hoàn tất.</span>
            </div>
          )}

          <Separator className="my-3" />

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <Stat label="Lương cơ bản" value={fmt(r.base_salary)} icon={<Wallet className="h-3 w-3" />} />
            <Stat label="Hoa hồng" value={fmt(r.total_commission)} positive />
            <Stat label="Thưởng" value={fmt(r.total_bonus + (r.holiday_bonus || 0))} positive />
            <Stat label="Phụ cấp" value={fmt(r.total_allowance)} positive />
            <Stat label="Tăng ca" value={fmt(r.overtime_pay)} positive />
            <Stat label="Khấu trừ" value={fmt(r.total_penalty + (r.advance_deduction || 0))} negative />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => setShowDetail(true)}
            >
              <Target className="h-3.5 w-3.5" /> Cấu trúc lương
            </Button>
            <Button
              size="sm"
              className="text-xs h-8 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
              onClick={() => setShowBoost(true)}
            >
              <Flame className="h-3.5 w-3.5" /> Tăng thêm lương
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mini KPI tracker */}
      <KpiTrackers record={r} />

      {/* Detail Dialog */}
      <SalaryDetailDialog open={showDetail} onOpenChange={setShowDetail} record={r} />

      {/* Boost (gamification) Dialog */}
      <BoostSalaryDialog open={showBoost} onOpenChange={setShowBoost} record={r} today={data?.today} periodEnd={data?.period_end} />
    </div>
  );
}

function Stat({ label, value, positive, negative, icon }: { label: string; value: string; positive?: boolean; negative?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="bg-background/60 rounded p-2">
      <p className="text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className={`font-semibold tabular-nums ${positive ? 'text-green-600 dark:text-green-400' : negative ? 'text-destructive' : ''}`}>
        {positive && value !== '0đ' ? '+' : negative && value !== '0đ' ? '-' : ''}{value}
      </p>
    </div>
  );
}

/** Hiển thị progress KPI nhanh ngay dưới card chính */
function KpiTrackers({ record }: { record: any }) {
  const cs = record.config_snapshot || {};
  const bonuses = (record.bonus_details || []) as any[];
  const kpiPersonal = bonuses.find(b => b.type === 'kpi_personal');
  const kpiBranch = bonuses.find(b => b.type === 'kpi_branch' || b.type === 'branch_revenue');
  const userRevenue = Number(cs.user_revenue || 0);
  const branchRevenue = Number(cs.branch_revenue || 0);

  if (!kpiPersonal && !kpiBranch) return null;

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <p className="text-xs font-semibold flex items-center gap-1">
          <Trophy className="h-3.5 w-3.5 text-amber-500" /> Tiến độ KPI
        </p>
        {kpiPersonal && kpiPersonal.threshold > 0 && (
          <ProgressRow
            label="KPI cá nhân"
            current={userRevenue}
            target={Number(kpiPersonal.threshold)}
            reward={kpiPersonal.amount}
          />
        )}
        {kpiBranch && kpiBranch.threshold > 0 && (
          <ProgressRow
            label="KPI chi nhánh"
            current={branchRevenue}
            target={Number(kpiBranch.threshold)}
            reward={kpiBranch.amount}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ProgressRow({ label, current, target, reward }: { label: string; current: number; target: number; reward: number }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  const remaining = Math.max(0, target - current);
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {fmtShort(current)} / {fmtShort(target)} ({pct}%)
        </span>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="flex items-center justify-between mt-1 text-[10px]">
        <span className="text-muted-foreground">
          {remaining > 0 ? `Còn ${fmtShort(remaining)} để đạt` : '🎉 Đã đạt!'}
        </span>
        {reward > 0 && (
          <span className="text-green-600 dark:text-green-400 font-medium">+{fmt(reward)}</span>
        )}
      </div>
    </div>
  );
}

/* ===================== DETAIL DIALOG ===================== */
function SalaryDetailDialog({ open, onOpenChange, record }: { open: boolean; onOpenChange: (b: boolean) => void; record: any }) {
  const cs = record.config_snapshot || {};
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Chi tiết cấu trúc lương
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {/* Template info */}
          <Card>
            <CardContent className="p-3 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Mẫu lương</span><span className="font-medium">{cs.template_name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Loại</span><span className="font-medium">{salaryTypeLabel(cs.salary_type)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Mức cơ sở</span><span className="font-medium">{fmt(cs.base_amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Công chuẩn</span><span className="font-medium">{cs.expected_work_days || '—'} ngày</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Đã đi</span><span className="font-medium">{record.total_work_days} ngày · {Math.floor((record.total_work_hours || 0))}h</span></div>
            </CardContent>
          </Card>

          {/* Base */}
          <Section title="1. Lương cơ bản" amount={record.base_salary} />

          {/* Bonus */}
          <Section title="2. Thưởng & KPI" amount={record.total_bonus}>
            {(record.bonus_details || []).length === 0 ? (
              <Empty />
            ) : (
              (record.bonus_details || []).map((b: any, i: number) => (
                <div key={i} className="border-l-2 border-green-400 pl-2 py-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-green-600 font-semibold">+{fmt(b.amount)}</span>
                  </div>
                  {b.threshold && (
                    <p className="text-[10px] text-muted-foreground">
                      Đạt {fmtShort(b.revenue || 0)} / mốc {fmtShort(b.threshold)} · {b.calc_type === 'percentage' ? `${b.value}%` : 'cố định'}
                    </p>
                  )}
                  {b.matched_tier && (
                    <p className="text-[10px] text-emerald-600">+ Mức vượt {b.matched_tier.percent_over}%: {b.matched_tier.calc_type === 'percentage' ? `${b.matched_tier.value}%` : fmt(b.matched_tier.value)}</p>
                  )}
                </div>
              ))
            )}
          </Section>

          {/* Commission */}
          <Section title="3. Hoa hồng theo doanh số" amount={record.total_commission}>
            {(record.commission_details || []).length === 0 ? (
              <Empty />
            ) : (
              (record.commission_details || []).map((c: any, i: number) => (
                <div key={i} className="border-l-2 border-blue-400 pl-2 py-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-green-600 font-semibold">+{fmt(c.amount)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {c.calc_type === 'percentage' ? `${c.value}% × ${fmtShort(c.revenue || 0)}` : `${fmt(c.value || c.rate)}/đơn × ${c.qty || 0}`}
                  </p>
                </div>
              ))
            )}
          </Section>

          {/* Allowance */}
          <Section title="4. Phụ cấp" amount={record.total_allowance}>
            {(record.allowance_details_v2 || []).length === 0 ? (
              <Empty />
            ) : (
              (record.allowance_details_v2 || []).map((a: any, i: number) => (
                <div key={i} className="border-l-2 border-purple-400 pl-2 py-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{a.name}</span>
                    <span className={a.amount > 0 ? 'text-green-600 font-semibold' : 'text-muted-foreground line-through'}>
                      {a.amount > 0 ? `+${fmt(a.amount)}` : '0đ'}
                    </span>
                  </div>
                  {a.skipped_reason && (
                    <p className="text-[10px] text-destructive">⚠ {a.skipped_reason}</p>
                  )}
                  {!a.skipped_reason && a.type === 'per_day' && (
                    <p className="text-[10px] text-muted-foreground">{a.days} ngày công</p>
                  )}
                </div>
              ))
            )}
          </Section>

          {/* Overtime */}
          <Section title="5. Tăng ca" amount={record.overtime_pay}>
            {(cs.overtime_details || []).length === 0 ? (
              <Empty text="Chưa có tăng ca" />
            ) : (
              (cs.overtime_details || []).map((o: any, i: number) => (
                <div key={i} className="flex justify-between text-xs border-l-2 border-orange-400 pl-2 py-1">
                  <span>{o.name} ({o.type === 'full_day' ? `${o.count} ngày` : `${o.hours}h`})</span>
                  <span className="text-green-600 font-semibold">+{fmt(o.amount)}</span>
                </div>
              ))
            )}
          </Section>

          {/* Holiday */}
          {(record.holiday_bonus || 0) > 0 && (
            <Section title="6. Lễ tết" amount={record.holiday_bonus}>
              {(record.holiday_details || []).map((h: any, i: number) => (
                <div key={i} className="flex justify-between text-xs">
                  <span>{h.holiday} × {h.days} ngày ({h.multiplier}%)</span>
                  <span className="text-green-600 font-semibold">+{fmt(h.extra)}</span>
                </div>
              ))}
            </Section>
          )}

          {/* Penalty */}
          <Section title="7. Khấu trừ & Phạt" amount={-record.total_penalty} negative>
            {(record.penalty_details || []).length === 0 ? (
              <Empty text="Không có vi phạm 🎉" />
            ) : (
              (record.penalty_details || []).map((p: any, i: number) => (
                <div key={i} className="border-l-2 border-destructive pl-2 py-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-destructive font-semibold">-{fmt(p.amount)}</span>
                  </div>
                  {p.detail && <p className="text-[10px] text-muted-foreground">{p.detail}</p>}
                </div>
              ))
            )}
          </Section>

          {(record.advance_deduction || 0) > 0 && (
            <Section title="8. Tạm ứng đã nhận" amount={-record.advance_deduction} negative />
          )}

          <Separator />
          <div className="flex justify-between items-baseline">
            <span className="font-semibold">Thực nhận tạm tính</span>
            <span className="text-xl font-bold text-primary tabular-nums">{fmt(record.net_salary)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, amount, negative, children }: { title: string; amount: number; negative?: boolean; children?: React.ReactNode }) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <p className="text-xs font-semibold">{title}</p>
        <span className={`text-xs font-bold tabular-nums ${negative ? 'text-destructive' : amount > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
          {negative ? '-' : amount > 0 ? '+' : ''}{fmt(Math.abs(amount))}
        </span>
      </div>
      {children && <div className="space-y-1">{children}</div>}
    </div>
  );
}

function Empty({ text = 'Chưa có' }: { text?: string }) {
  return <p className="text-[11px] text-muted-foreground italic pl-2">{text}</p>;
}

function salaryTypeLabel(t?: string) {
  switch (t) {
    case 'fixed': return 'Lương cố định tháng';
    case 'daily': return 'Lương theo ngày';
    case 'hourly': return 'Lương theo giờ';
    case 'shift': return 'Lương theo ca';
    default: return t || '—';
  }
}

/* ===================== BOOST DIALOG (Gamification) ===================== */
function BoostSalaryDialog({ open, onOpenChange, record, today, periodEnd }: { open: boolean; onOpenChange: (b: boolean) => void; record: any; today?: string; periodEnd?: string }) {
  const suggestions = useMemo(() => buildSuggestions(record, today, periodEnd), [record, today, periodEnd]);
  const totalPotential = suggestions.reduce((s, x) => s + (x.potential || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" /> Tăng thêm lương
          </DialogTitle>
        </DialogHeader>

        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 dark:border-orange-800">
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Bạn có thể tăng thêm tối đa</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 tabular-nums">+{fmt(totalPotential)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Hoàn thành các nhiệm vụ dưới đây để mở khoá</p>
          </CardContent>
        </Card>

        <div className="space-y-2 mt-2">
          {suggestions.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Trophy className="h-10 w-10 mx-auto text-amber-500 mb-2" />
                <p className="text-sm font-medium">Bạn đang làm rất tốt!</p>
                <p className="text-xs text-muted-foreground mt-1">Không còn gợi ý nào — tiếp tục giữ phong độ 🔥</p>
              </CardContent>
            </Card>
          ) : (
            suggestions.map((s, i) => <SuggestionCard key={i} suggestion={s} />)
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Suggestion = {
  icon: React.ReactNode;
  tone: 'good' | 'warn' | 'bad';
  title: string;
  description: string;
  progress?: number; // 0-100
  current?: string;
  target?: string;
  potential: number; // tiền có thể tăng
  done?: boolean;
};

function SuggestionCard({ suggestion: s }: { suggestion: Suggestion }) {
  const toneClass =
    s.tone === 'bad' ? 'border-destructive/30 bg-destructive/5'
      : s.tone === 'warn' ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800'
      : 'border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/10 dark:border-emerald-800';
  const amountClass = s.tone === 'bad' ? 'text-destructive' : 'text-green-600 dark:text-green-400';

  return (
    <Card className={toneClass}>
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 shrink-0">{s.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{s.title}</p>
              <span className={`text-sm font-bold tabular-nums ${amountClass}`}>
                {s.tone === 'bad' ? '-' : '+'}{fmt(s.potential)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.description}</p>
            {s.progress != null && (
              <div className="mt-2">
                <Progress value={s.progress} className="h-1.5" />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>{s.current}</span>
                  <span>{s.target}</span>
                </div>
              </div>
            )}
            {s.done && (
              <Badge variant="outline" className="mt-1 h-4 text-[9px] gap-0.5"><CheckCircle2 className="h-2.5 w-2.5 text-green-600" /> Hoàn thành</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Sinh danh sách gợi ý gamification từ record */
function buildSuggestions(record: any, today?: string, periodEnd?: string): Suggestion[] {
  const out: Suggestion[] = [];
  const cs = record.config_snapshot || {};
  const baseAmount = Number(cs.base_amount || 0);
  const expected = Number(cs.expected_work_days || 22);
  const workDays = Number(record.total_work_days || 0);
  const userRevenue = Number(cs.user_revenue || 0);
  const saleCount = Number(cs.sale_count || 0);

  // Days remaining in period
  let daysRemaining = 0;
  if (today && periodEnd) {
    const t = new Date(today);
    const e = new Date(periodEnd);
    daysRemaining = Math.max(0, Math.ceil((e.getTime() - t.getTime()) / 86400000));
  }

  // 1. ATTENDANCE — đi làm đủ ngày
  if (cs.salary_type === 'fixed' && expected > 0) {
    const dailyRate = baseAmount / expected;
    const remainingDays = Math.max(0, expected - workDays);
    if (remainingDays > 0) {
      out.push({
        icon: <CalendarCheck className="h-4 w-4 text-emerald-600" />,
        tone: 'good',
        title: `Đi làm đủ công`,
        description: `Mỗi ngày công = ${fmt(dailyRate)}. Còn ${remainingDays} ngày để đạt ${expected} công chuẩn.`,
        progress: Math.round((workDays / expected) * 100),
        current: `${workDays} công`,
        target: `${expected} công`,
        potential: Math.round(dailyRate * Math.min(remainingDays, daysRemaining || remainingDays)),
      });
    } else {
      out.push({
        icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
        tone: 'good',
        title: 'Đã đủ ngày công',
        description: `Bạn đã đi đủ ${expected} công tháng này.`,
        potential: 0,
        done: true,
      });
    }
  } else if ((cs.salary_type === 'daily' || cs.salary_type === 'hourly' || cs.salary_type === 'shift') && baseAmount > 0) {
    out.push({
      icon: <CalendarCheck className="h-4 w-4 text-emerald-600" />,
      tone: 'good',
      title: `Đi làm thêm ${cs.salary_type === 'hourly' ? 'mỗi giờ' : cs.salary_type === 'shift' ? 'mỗi ca' : 'mỗi ngày'}`,
      description: `Mỗi ${cs.salary_type === 'hourly' ? 'giờ' : cs.salary_type === 'shift' ? 'ca' : 'ngày'} thêm = ${fmt(baseAmount)}.`,
      potential: baseAmount,
    });
  }

  // 2. KPI BONUSES — còn thiếu để đạt
  const bonuses = (record.bonus_details || []) as any[];
  for (const b of bonuses) {
    if (b.type === 'kpi_personal' || b.type === 'gross_profit' || b.type === 'kpi_branch' || b.type === 'branch_revenue') {
      const target = Number(b.threshold || 0);
      const current = Number(b.revenue || 0);
      if (target <= 0) continue;

      const pct = Math.min(100, Math.round((current / target) * 100));
      const remain = Math.max(0, target - current);
      const isBranch = b.type === 'kpi_branch' || b.type === 'branch_revenue';
      const reachReward = b.calc_type === 'percentage' ? Math.round(target * Number(b.value) / 100) : Number(b.value || 0);

      if (current >= target) {
        // đã đạt → còn tier vượt?
        out.push({
          icon: <Trophy className="h-4 w-4 text-amber-500" />,
          tone: 'good',
          title: `Đã đạt ${b.name}`,
          description: `Vượt thêm doanh số sẽ mở các mức thưởng tier cao hơn.`,
          progress: Math.min(100, Math.round((current / target) * 100)),
          current: fmtShort(current),
          target: fmtShort(target),
          potential: 0,
          done: true,
        });
      } else {
        out.push({
          icon: <Target className="h-4 w-4 text-blue-600" />,
          tone: 'warn',
          title: `${isBranch ? 'KPI chi nhánh' : 'KPI cá nhân'}: ${b.name}`,
          description: `Còn thiếu ${fmtShort(remain)} để đạt mốc ${fmtShort(target)} → nhận ${fmt(reachReward)} thưởng.`,
          progress: pct,
          current: fmtShort(current),
          target: fmtShort(target),
          potential: reachReward - Number(b.amount || 0),
        });
      }
    }
  }

  // 3. COMMISSIONS — bán thêm mỗi đơn được + bao nhiêu
  const comms = (record.commission_details || []) as any[];
  if (comms.length > 0 && saleCount > 0) {
    // Average commission per sale
    const totalComm = Number(record.total_commission || 0);
    const perSale = totalComm / saleCount;
    if (perSale > 0) {
      out.push({
        icon: <PiggyBank className="h-4 w-4 text-pink-600" />,
        tone: 'good',
        title: 'Bán thêm mỗi đơn',
        description: `Trung bình mỗi đơn của bạn đem về ${fmt(perSale)} hoa hồng. Bán thêm 1 đơn ≈ +${fmt(perSale)}.`,
        potential: Math.round(perSale),
      });
    }
  } else if (comms.length === 0) {
    // Has rules but no sales yet? Pull rule rates if exist
    const firstRevRule = (record.commission_details || []).find((c: any) => c.target_type === 'revenue');
    if (firstRevRule) {
      out.push({
        icon: <PiggyBank className="h-4 w-4 text-pink-600" />,
        tone: 'warn',
        title: 'Bắt đầu bán hàng',
        description: `${firstRevRule.calc_type === 'percentage' ? `${firstRevRule.value}% doanh số` : `${fmt(firstRevRule.value)}/đơn`} sẽ vào hoa hồng.`,
        potential: 0,
      });
    }
  }

  // 4. OVERTIME — tăng ca thêm bao nhiêu giờ = bao nhiêu tiền
  const otDetails = (cs.overtime_details || []) as any[];
  const hourlyOTRate = (() => {
    if (otDetails.length === 0) {
      // fallback 150%
      const dailyRate = cs.salary_type === 'fixed' ? baseAmount / expected : baseAmount;
      return (dailyRate / 8) * 1.5;
    }
    const hourlyOT = otDetails.find((o: any) => o.type === 'hourly');
    if (hourlyOT && hourlyOT.hours > 0) return hourlyOT.amount / hourlyOT.hours;
    const fullDay = otDetails.find((o: any) => o.type === 'full_day');
    if (fullDay && fullDay.count > 0) return (fullDay.amount / fullDay.count) / 8;
    return 0;
  })();
  if (hourlyOTRate > 0) {
    out.push({
      icon: <Clock className="h-4 w-4 text-orange-600" />,
      tone: 'good',
      title: 'Tăng ca thêm',
      description: `Mỗi giờ tăng ca = ${fmt(hourlyOTRate)}. Tăng ca 10h ≈ +${fmt(hourlyOTRate * 10)}.`,
      potential: Math.round(hourlyOTRate * 10),
    });
  }

  // 5. ALLOWANCE — đang bị mất phụ cấp nào không?
  const skippedAllow = (record.allowance_details_v2 || []).filter((a: any) => a.skipped_reason);
  for (const a of skippedAllow) {
    out.push({
      icon: <Gift className="h-4 w-4 text-purple-600" />,
      tone: 'bad',
      title: `Mất phụ cấp: ${a.name}`,
      description: a.skipped_reason,
      potential: 0, // already lost; show 0 to keep total accurate
    });
  }

  // 6. PENALTY — cảnh báo phạt đang có
  const penalties = (record.penalty_details || []) as any[];
  for (const p of penalties) {
    if (p.amount > 0) {
      out.push({
        icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
        tone: 'bad',
        title: `Đang bị phạt: ${p.name}`,
        description: p.detail || `${p.count} lần × ${fmt(p.per_amount)}`,
        potential: p.amount, // số tiền bị mất
      });
    }
  }

  // Sort: warn/good first (positive potential), then bad (warnings)
  out.sort((a, b) => {
    const order = { good: 0, warn: 1, bad: 2 };
    return order[a.tone] - order[b.tone];
  });

  return out;
}