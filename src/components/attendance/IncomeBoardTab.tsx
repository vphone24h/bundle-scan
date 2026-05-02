import { useMemo, useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformUser } from '@/hooks/useTenant';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { HelpTip } from '@/components/ui/help-tip';
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
  ArrowDown,
  Zap,
  Star,
  TrendingDown,
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

  // Cho phép card "Tiến độ KPI" ở MyAttendancePage mở Boost dialog
  useEffect(() => {
    const handler = () => setShowBoost(true);
    window.addEventListener('open-boost-salary', handler);
    return () => window.removeEventListener('open-boost-salary', handler);
  }, []);

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

  // Ẩn phạt KPI trước ngày 25 — đồng bộ với popup chi tiết và tab "Tăng thêm lương"
  const isAfterDay25 = new Date().getDate() >= 25;
  const hiddenKpiPenalty = (r.penalty_details || [])
    .filter((p: any) => {
      const isKpi = p.type === 'kpi_not_met' || /kpi/i.test(String(p.name || ''));
      return isKpi && !isAfterDay25;
    })
    .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const visiblePenalty = (r.total_penalty || 0) - hiddenKpiPenalty;
  const visibleNetSalary = (r.net_salary || 0) + hiddenKpiPenalty;

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
                {fmt(visibleNetSalary)}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Thực nhận tạm tính (chạm xem chi tiết)
              {hiddenKpiPenalty > 0 && <span className="block text-[10px] italic">Chưa tính phạt KPI – chốt sau ngày 25</span>}
            </p>
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
            <Stat label="Khấu trừ" value={fmt(visiblePenalty + (r.advance_deduction || 0))} negative />
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
  const dailyRate = Number(cs.daily_rate || 0);
  const paidLeaveUsed = Number(cs.paid_leave_used || 0);
  const paidLeaveQuota = Number(cs.paid_leave_quota || 0);
  const workDays = Number(record.total_work_days || 0);
  const isAfterDay25 = new Date().getDate() >= 25;
  const visiblePenalties = (record.penalty_details || []).filter((p: any) => {
    const isKpi = p.type === 'kpi_not_met' || /kpi/i.test(String(p.name || ''));
    return !(isKpi && !isAfterDay25);
  });
  const hiddenKpiPenaltyAmount = (record.penalty_details || [])
    .filter((p: any) => {
      const isKpi = p.type === 'kpi_not_met' || /kpi/i.test(String(p.name || ''));
      return isKpi && !isAfterDay25;
    })
    .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const visiblePenaltyTotal = (record.total_penalty || 0) - hiddenKpiPenaltyAmount;
  const visibleNetSalary = (record.net_salary || 0) + hiddenKpiPenaltyAmount;
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
          <Section title="1. Lương cơ bản" amount={record.base_salary}>
            {cs.salary_type === 'fixed' && dailyRate > 0 && (
              <div className="text-[11px] text-muted-foreground space-y-0.5 pl-2 border-l-2 border-emerald-300">
                <p>• Đi làm: <span className="font-medium text-foreground">{workDays} ngày</span> × {fmt(dailyRate)} = {fmt(workDays * dailyRate)}</p>
                {paidLeaveUsed > 0 && (
                  <p>• Phép có lương đã dùng: <span className="font-medium text-foreground">{paidLeaveUsed}/{paidLeaveQuota} ngày</span> × {fmt(dailyRate)} = {fmt(paidLeaveUsed * dailyRate)}</p>
                )}
                <p className="italic">Công thức: ({workDays} công + {paidLeaveUsed} phép) / {cs.expected_work_days} công chuẩn × {fmt(cs.base_amount)}</p>
              </div>
            )}
            {cs.salary_type === 'daily' && dailyRate > 0 && (
              <p className="text-[11px] text-muted-foreground pl-2">{workDays} ngày × {fmt(dailyRate)}</p>
            )}
          </Section>

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
            {(() => {
              // Hợp nhất: ưu tiên commissions_all (đầy đủ rules từ template), fallback commission_details
              const allComms: any[] = (cs.commissions_all && cs.commissions_all.length > 0)
                ? cs.commissions_all.map((c: any) => ({
                    name: c.name,
                    target_type: c.target_type,
                    calc_type: c.calc_type,
                    rate: Number(c.value || 0),
                    qty: Number(c.current_qty || 0),
                    revenue: Number(c.current_revenue || 0),
                    amount: Number(c.earned || 0),
                    only_self_sold: !!c.only_self_sold,
                  }))
                : (record.commission_details || []);
              if (allComms.length === 0) return <Empty />;
              return allComms.map((c: any, i: number) => {
                const isPct = c.calc_type === 'percentage';
                const earned = Number(c.amount || 0);
                const unitLabel = c.target_type === 'self_sale' ? 'đơn tự bán'
                  : c.target_type === 'revenue' ? 'kỳ'
                  : c.target_type === 'category' ? 'sản phẩm danh mục'
                  : 'sản phẩm';
                return (
                  <div key={i} className="border-l-2 border-blue-400 pl-2 py-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{c.name}{c.only_self_sold ? ' (chỉ đơn tự bán)' : ''}</span>
                      <span className={earned > 0 ? 'text-green-600 font-semibold' : 'text-muted-foreground'}>
                        {earned > 0 ? `+${fmt(earned)}` : '0đ'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {isPct
                        ? `${c.rate}% × ${fmtShort(c.revenue || 0)}`
                        : `${fmt(c.rate || 0)}/${unitLabel} × ${c.qty || 0}`}
                    </p>
                  </div>
                );
              });
            })()}
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
                <div key={i} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span>{h.holiday} × {h.days} ngày ({h.multiplier}%)</span>
                    <span className="text-green-600 font-semibold">+{fmt(h.extra)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground italic">
                    Thưởng THÊM ngoài lương ngày ({h.multiplier}% − 100%)
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Penalty */}
          <Section title="7. Khấu trừ & Phạt" amount={-visiblePenaltyTotal} negative>
            {visiblePenalties.length === 0 ? (
              <Empty text="Không có vi phạm 🎉" />
            ) : (
              visiblePenalties.map((p: any, i: number) => (
                <div key={i} className="border-l-2 border-destructive pl-2 py-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-destructive font-semibold">-{fmt(p.amount)}</span>
                  </div>
                  {p.detail && <p className="text-[10px] text-muted-foreground">{p.detail}</p>}
                </div>
              ))
            )}
            {hiddenKpiPenaltyAmount > 0 && (
              <p className="text-[10px] text-muted-foreground italic pl-2 mt-1">
                💡 Phạt KPI sẽ chốt sau ngày 25. Bạn vẫn còn cơ hội chạy doanh số!
              </p>
            )}
          </Section>

          {(record.advance_deduction || 0) > 0 && (
            <Section title="8. Tạm ứng đã nhận" amount={-record.advance_deduction} negative />
          )}

          <Separator />
          <div className="flex justify-between items-baseline">
            <span className="font-semibold">Thực nhận tạm tính</span>
            <span className="text-xl font-bold text-primary tabular-nums">{fmt(visibleNetSalary)}</span>
          </div>
          {hiddenKpiPenaltyAmount > 0 && (
            <p className="text-[10px] text-muted-foreground text-right">
              (chưa tính phạt KPI {fmt(hiddenKpiPenaltyAmount)} – sẽ chốt sau ngày 25)
            </p>
          )}
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
  const detailsRef = useRef<HTMLDivElement>(null);
  const scrollToDetails = () => {
    detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" /> Tăng thêm lương
          </DialogTitle>
        </DialogHeader>

        <div className="px-1 py-2">
          <p className="text-lg font-bold leading-snug text-foreground">
            Thu nhập của bạn phụ thuộc vào năng lực của bạn…
          </p>
          <p className="text-base font-semibold leading-snug text-orange-600 dark:text-orange-400 mt-1 uppercase">
            Đạt KPI và hoa hồng càng nhiều thì thu nhập càng nhiều….
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={scrollToDetails}
            className="mt-3 w-full border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/40"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Xem chi tiết KPI & hoa hồng
            <ArrowDown className="h-4 w-4 ml-2" />
          </Button>
        </div>

        <div ref={detailsRef} className="space-y-2 mt-2 scroll-mt-4">
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
  earned?: number; // tiền thực nhận (khi done=true thì ưu tiên hiển thị)
  tierLines?: string[]; // chi tiết các mức vượt KPI, mỗi dòng 1 mức
  showKpiTips?: boolean; // hiển thị nút "Cách đạt KPI"
  headline?: string; // tiêu đề ngắn hấp dẫn (override title hiển thị trên card)
  detailDescription?: string; // mô tả chi tiết cho popup khi nhấn vào card
};

function SuggestionCard({ suggestion: s }: { suggestion: Suggestion }) {
  const toneClass =
    s.tone === 'bad' ? 'border-destructive/30 bg-destructive/5'
      : s.tone === 'warn' ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800'
      : 'border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/10 dark:border-emerald-800';
  const amountClass = s.tone === 'bad' ? 'text-destructive' : 'text-green-600 dark:text-green-400';
  const [showTips, setShowTips] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const hasDetail = !!s.detailDescription;
  const displayTitle = s.headline || s.title;

  return (
    <Card className={`${toneClass} ${hasDetail ? 'cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]' : ''}`}
      onClick={hasDetail ? () => setShowDetail(true) : undefined}
      role={hasDetail ? 'button' : undefined}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 shrink-0">{s.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-snug">{displayTitle}</p>
              <span className={`text-sm font-bold tabular-nums ${amountClass}`}>
                {s.tone === 'bad' ? '-' : '+'}{fmt(s.potential)}
              </span>
            </div>
            {hasDetail ? (
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">Nhấn để xem chi tiết</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm">
                  Nhận ngay <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.description}</p>
            )}
            {s.tierLines && s.tierLines.length > 0 && (
              <div className="mt-1.5 rounded bg-background/60 border border-border/50 p-2">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">Các mức vượt KPI:</p>
                <ul className="space-y-0.5">
                  {s.tierLines.map((line, idx) => (
                    <li key={idx} className="text-[11px] flex items-start gap-1.5">
                      <span className="text-emerald-600 mt-0.5">▸</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {s.progress != null && (
              <div className="mt-2">
                {s.showKpiTips ? (
                  <div className="rounded-lg bg-background/70 border border-amber-300 dark:border-amber-700 p-2.5">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        Tiến độ KPI
                        <HelpTip
                          iconSize="h-3 w-3"
                          content={`Công thức: % hoàn thành = (Hiện tại ÷ Mục tiêu) × 100. Hiện tại: ${s.current ?? '0'}. Mục tiêu: ${s.target ?? '0'}. Khi đạt 100% bạn nhận đủ tiền thưởng KPI; vượt mốc còn được cộng thêm theo các mức "vượt KPI" (nếu có).`}
                        />
                        {(() => {
                          const p = s.progress ?? 0;
                          if (p >= 100) {
                            return <Badge className="ml-1 h-4 px-1.5 text-[9px] gap-0.5 bg-emerald-500 hover:bg-emerald-500 text-white border-0"><Star className="h-2.5 w-2.5" /> Xuất sắc</Badge>;
                          }
                          if (p >= 80) {
                            return <Badge className="ml-1 h-4 px-1.5 text-[9px] gap-0.5 bg-amber-500 hover:bg-amber-500 text-white border-0"><Flame className="h-2.5 w-2.5" /> Sắp đạt</Badge>;
                          }
                          if (p >= 50) {
                            return <Badge className="ml-1 h-4 px-1.5 text-[9px] gap-0.5 bg-amber-400 hover:bg-amber-400 text-white border-0"><CheckCircle2 className="h-2.5 w-2.5" /> Đạt nửa chặng</Badge>;
                          }
                          return <Badge className="ml-1 h-4 px-1.5 text-[9px] gap-0.5 bg-orange-500 hover:bg-orange-500 text-white border-0"><TrendingDown className="h-2.5 w-2.5" /> Cần cải thiện</Badge>;
                        })()}
                      </span>
                      <span className={`text-2xl font-extrabold tabular-nums ${
                        s.progress >= 100 ? 'text-emerald-600 dark:text-emerald-400'
                        : s.progress >= 50 ? 'text-amber-600 dark:text-amber-400'
                        : 'text-orange-600 dark:text-orange-400'
                      }`}>
                        {Math.min(100, Math.round(s.progress))}%
                      </span>
                    </div>
                    <Progress
                      value={Math.min(100, s.progress)}
                      className={`h-3 ${s.progress >= 100 ? '[&>div]:bg-emerald-500' : s.progress >= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-orange-500'}`}
                    />
                    <div className="flex justify-between text-[11px] font-medium mt-1">
                      <span className="text-foreground">{s.current}</span>
                      <span className="text-muted-foreground">Mục tiêu: <span className="font-semibold text-foreground">{s.target}</span></span>
                    </div>
                    {(() => {
                      const p = s.progress ?? 0;
                      if (p >= 100) {
                        return (
                          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-2 py-1.5">
                            <Trophy className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">🎉 Đã đạt 100% KPI! Tiếp tục vượt mốc để nhận thêm thưởng.</span>
                          </div>
                        );
                      }
                      if (p >= 90) {
                        return (
                          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-2 py-1.5">
                            <Zap className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">⚡ Chỉ còn {100 - Math.round(p)}% là chạm mốc 100% — cố lên!</span>
                          </div>
                        );
                      }
                      if (p >= 40 && p < 50) {
                        return (
                          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-1.5">
                            <Flame className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">🔥 Sắp chạm mốc 50% — đẩy mạnh để qua nửa chặng!</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ) : (
                  <>
                    <Progress value={s.progress} className="h-1.5" />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                      <span>{s.current}</span>
                      <span>{s.target}</span>
                    </div>
                  </>
                )}
              </div>
            )}
            {s.showKpiTips && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-[11px] w-full text-primary hover:text-primary"
                onClick={() => setShowTips(true)}
              >
                <Sparkles className="h-3 w-3" /> Làm ngay
              </Button>
            )}
            {s.done && (
              <Badge variant="outline" className="mt-1 h-4 text-[9px] gap-0.5"><CheckCircle2 className="h-2.5 w-2.5 text-green-600" /> Hoàn thành</Badge>
            )}
          </div>
        </div>
      </CardContent>
      <KpiTipsDialog open={showTips} onOpenChange={setShowTips} kpiName={s.title} />
      {hasDetail && (
        <Dialog open={showDetail} onOpenChange={setShowDetail}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-8">
                {s.icon}
                <span className="flex-1">{s.title}</span>
                <span className={`text-base font-bold tabular-nums ${amountClass}`}>
                  {s.tone === 'bad' ? '-' : '+'}{fmt(s.potential)}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm leading-relaxed whitespace-pre-line">{s.detailDescription}</p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

/** Popup hướng dẫn cách đạt KPI */
function KpiTipsDialog({ open, onOpenChange, kpiName }: { open: boolean; onOpenChange: (b: boolean) => void; kpiName: string }) {
  const tips = [
    'Check tin nhắn liên tục của shop để không bỏ lỡ khách',
    'Đăng bài bán hàng trên TikTok và Facebook mỗi ngày ít nhất 2-3 bài',
    'Nhắn tin hỏi thăm khách cũ để chăm sóc tái tiêu dùng',
    'Theo dõi bám sát những khách có ý định mua hàng',
    'Tư vấn nhiệt tình, am hiểu sản phẩm để tăng tỷ lệ chốt đơn',
    'Up-sell / cross-sell phụ kiện kèm theo mỗi đơn',
    'Xin đánh giá 5 sao + giới thiệu bạn bè sau khi bán',
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" /> Cách đạt KPI
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Để hoàn thành <span className="font-medium text-foreground">{kpiName}</span>, bạn nên:</p>
          <ul className="space-y-2 mt-2">
            {tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <p className="text-[11px] text-amber-800 dark:text-amber-200">
              💡 Càng vượt KPI nhiều, mức thưởng tier càng cao. Cố gắng lên nhé!
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
        description: `Mỗi ngày công = ${fmt(dailyRate)}. Còn thiếu ${remainingDays} công để đạt ${expected} công chuẩn của tháng này.`,
        progress: Math.round((workDays / expected) * 100),
        current: `${workDays}/${expected} công`,
        target: `${expected} công chuẩn`,
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

  // 2. ALL BONUSES — hiển thị tất cả thưởng được cấu hình + điều kiện đạt
  // Ưu tiên bonuses_all (đầy đủ); fallback kpi_bonuses_all (chỉ KPI revenue)
  const bonusesAll: any[] = (cs.bonuses_all && cs.bonuses_all.length > 0)
    ? cs.bonuses_all
    : (cs.kpi_bonuses_all && cs.kpi_bonuses_all.length > 0)
      ? (cs.kpi_bonuses_all as any[]).map((k: any) => ({ ...k, is_revenue_based: true, achieved: Number(k.current || 0) >= Number(k.threshold || 0) }))
      : (record.bonus_details || []).map((b: any) => ({
          name: b.name, type: b.type,
          calc_type: b.calc_type, value: Number(b.value || 0),
          threshold: Number(b.threshold || 0),
          current: Number(b.revenue || 0),
          reach_reward: b.calc_type === 'percentage'
            ? Math.round(Number(b.threshold || 0) * Number(b.value || 0) / 100)
            : Number(b.value || 0),
          is_revenue_based: ['kpi_personal','kpi_branch','branch_revenue','gross_profit'].includes(b.type),
          achieved: Number(b.amount || 0) > 0,
          tiers: b.tiers || [],
        }));

  for (const k of bonusesAll) {
    const type = k.type;
    const isRev = !!k.is_revenue_based;
    const tiers = (k.tiers || []) as any[];
    const tierDescs = tiers
      .filter((t: any) => Number(t.percent_over) > 0)
      .map((t: any) => {
        const tierAmt = t.calc_type === 'percentage' ? `${t.value}% doanh số` : fmt(t.value);
        return `Vượt +${t.percent_over}%: +${tierAmt}`;
      });

    if (isRev) {
      // KPI / doanh thu / lợi nhuận
      const target = Number(k.threshold || 0);
      const current = Number(k.current || 0);
      if (target <= 0) continue;
      const pct = Math.min(100, Math.round((current / target) * 100));
      const remain = Math.max(0, target - current);
      const isBranch = type === 'kpi_branch' || type === 'branch_revenue';
      const isGP = type === 'gross_profit';
      const labelType = isBranch ? 'KPI chi nhánh' : isGP ? 'Lợi nhuận gộp' : 'KPI cá nhân';
      const metric = isBranch ? 'doanh thu chi nhánh' : isGP ? 'lợi nhuận gộp' : 'doanh thu cá nhân';
      const reachReward = Number(k.reach_reward || 0);

      if (current >= target) {
        out.push({
          icon: <Trophy className="h-4 w-4 text-amber-500" />,
          tone: 'good',
          title: `Đã đạt ${k.name}`,
          description: `Điều kiện: ${metric} ≥ ${fmtShort(target)} (hiện ${fmtShort(current)}). Bạn đã nhận ${fmt(reachReward)}.`,
          tierLines: tierDescs.length > 0 ? ['Các mức vượt KPI:', ...tierDescs] : [],
          progress: 100,
          current: fmtShort(current),
          target: fmtShort(target),
          potential: 0,
          done: true,
          earned: reachReward,
          showKpiTips: true,
        });
      } else {
        out.push({
          icon: <Target className="h-4 w-4 text-blue-600" />,
          tone: 'warn',
          title: `${labelType}: ${k.name}`,
          description: `Bạn sẽ nhận thêm ${fmt(reachReward)} khi đạt KPI ${fmtShort(target)} (còn thiếu ${fmtShort(remain)}). Điều kiện: ${metric} ≥ ${fmtShort(target)}.`,
          tierLines: tierDescs.length > 0 ? ['Các mức vượt KPI:', ...tierDescs] : [],
          progress: pct,
          current: fmtShort(current),
          target: fmtShort(target),
          potential: reachReward,
          showKpiTips: true,
        });
      }
    } else if (type === 'fixed') {
      // Thưởng cố định — đủ điều kiện ngay khi có lương cơ bản
      const amt = k.calc_type === 'percentage'
        ? `${k.value}% lương cơ bản`
        : fmt(Number(k.value || 0));
      out.push({
        icon: <Gift className="h-4 w-4 text-emerald-600" />,
        tone: 'good',
        title: `Thưởng cố định: ${k.name}`,
        description: `Bạn sẽ nhận ${amt} mỗi tháng. Điều kiện: có lương cơ bản trong tháng.`,
        potential: k.calc_type === 'percentage' ? 0 : Number(k.value || 0),
        done: true,
      });
    } else if (type === 'overtime') {
      // Thưởng theo giờ tăng ca
      const amt = k.calc_type === 'percentage'
        ? `${k.value}% lương giờ × số giờ tăng ca`
        : `${fmt(Number(k.value || 0))} × số giờ tăng ca`;
      out.push({
        icon: <Clock className="h-4 w-4 text-orange-600" />,
        tone: 'good',
        title: `Thưởng tăng ca: ${k.name}`,
        description: `Mỗi giờ tăng ca = ${amt}. Điều kiện: có giờ tăng ca được duyệt.`,
        potential: Number(k.value || 0),
      });
    }
  }

  // 3. COMMISSIONS — liệt kê TẤT CẢ hoa hồng admin đã cấu hình + điều kiện
  const commissionsAll: any[] = (cs.commissions_all && cs.commissions_all.length > 0)
    ? cs.commissions_all
    : (record.commission_details || []).map((c: any) => ({
        name: c.name,
        target_type: c.target_type,
        calc_type: c.calc_type,
        value: Number(c.rate || 0),
        current_qty: Number(c.qty || 0),
        current_revenue: Number(c.revenue || 0),
        earned: Number(c.amount || 0),
        achieved: Number(c.amount || 0) > 0,
      }));

  for (const c of commissionsAll) {
    const isPct = c.calc_type === 'percentage';
    const targetLabel = c.target_type === 'product' ? 'sản phẩm'
      : c.target_type === 'service' ? 'dịch vụ'
      : c.target_type === 'category' ? 'danh mục'
      : c.target_type === 'self_sale' ? 'đơn tự bán'
      : 'doanh thu';
    const rateDesc = isPct
      ? `${c.value}% doanh số`
      : c.target_type === 'revenue'
        ? `${fmt(c.value)}/kỳ`
        : c.target_type === 'self_sale'
          ? `${fmt(c.value)}/đơn tự bán`
        : `${fmt(c.value)}/sản phẩm bán ra`;
    const titlePrefix = c.target_type === 'revenue'
      ? 'Hoa hồng doanh thu'
      : c.target_type === 'category'
        ? `Hoa hồng danh mục`
        : c.target_type === 'self_sale'
          ? `Hoa hồng tự bán`
        : `Hoa hồng ${targetLabel}`;

    // Headline ngắn gọn, hấp dẫn để hiển thị trên card
    const perUnitAmt = !isPct ? fmt(c.value) : `${c.value}%`;
    // Đối tượng khách: tick "đơn tự bán" / "only_self_sold" → khách nhân viên tự tìm; ngược lại → khách của cửa hàng
    const isSelfFound = c.target_type === 'self_sale' || !!c.only_self_sold;
    const customerSrc = isSelfFound ? 'khách nhân viên tự tìm' : 'khách của cửa hàng';
    // Nhãn nhóm để mô tả: danh mục / sản phẩm / dịch vụ / doanh thu
    const groupLabel = c.target_type === 'category' ? 'danh mục'
      : c.target_type === 'product' ? 'sản phẩm'
      : c.target_type === 'service' ? 'dịch vụ'
      : c.target_type === 'self_sale' ? 'đơn'
      : 'doanh thu';

    // Headline ngắn gọn ngoài card — chi tiết để dành cho popup
    const headline = c.target_type === 'revenue'
      ? `Đạt doanh thu nhận ngay ${perUnitAmt}`
      : isSelfFound
        ? `Bán 1 đơn hàng nhận ngay ${perUnitAmt}`
        : `Chốt 1 đơn hàng nhận ngay ${perUnitAmt}`;

    // Mô tả chi tiết theo format mới yêu cầu
    const rateLine = isPct
      ? `Mức hoa hồng: ${c.value}% doanh số (${customerSrc})`
      : c.target_type === 'revenue'
        ? `Mức hoa hồng: ${fmt(c.value)}/kỳ (${customerSrc})`
        : `Mức hoa hồng: ${fmt(c.value)}/sản phẩm bán ra (${customerSrc})`;

    if (c.achieved && Number(c.earned) > 0) {
      const progress = c.target_type === 'revenue'
        ? `Doanh thu hiện tại: ${fmt(c.current_revenue)}`
        : c.target_type === 'category'
          ? `Đã bán được: ${c.current_qty} sản phẩm thuộc danh mục ${c.name}`
          : c.target_type === 'product'
            ? `Đã bán được: ${c.current_qty} sản phẩm ${c.name}`
            : c.target_type === 'service'
              ? `Đã bán được: ${c.current_qty} dịch vụ ${c.name}`
              : `Đã bán được: ${c.current_qty} sản phẩm bán ra`;
      const fullDesc = `${rateLine}.\n${progress}.\nĐang nhận: ${fmt(c.earned)}.\nBán thêm để tăng hoa hồng.`;
      out.push({
        icon: <PiggyBank className="h-4 w-4 text-pink-600" />,
        tone: 'good',
        title: `${titlePrefix}: ${c.name}`,
        description: fullDesc,
        headline,
        detailDescription: fullDesc,
        potential: isPct ? 0 : Number(c.value || 0),
        done: true,
      });
    } else {
      const condition = isSelfFound
        ? `Nhận ${fmt(c.value)} đối với khách hàng nhân viên tự tìm cho 1 sản phẩm bán ra thuộc ${groupLabel} ${c.name} (${customerSrc}).`
        : c.target_type === 'revenue'
          ? 'Điều kiện: có doanh thu cho cửa hàng trong kỳ.'
          : `Chốt 1 đơn hàng cho khách của cửa hàng thuộc ${groupLabel} ${c.name} sẽ nhận ${fmt(c.value)}.`;
      const fullDesc = `${rateLine}.\n${condition}`;
      out.push({
        icon: <PiggyBank className="h-4 w-4 text-pink-600" />,
        tone: 'warn',
        title: `${titlePrefix}: ${c.name}`,
        description: fullDesc,
        headline,
        detailDescription: fullDesc,
        potential: isPct ? 0 : Number(c.value || 0),
      });
    }
  }

  // 4. OVERTIME — hiển thị chi tiết từng loại tăng ca admin đã cấu hình
  // Lấy rules đã cấu hình (không phải records đã làm)
  const otRules = (cs.overtime_rules || []) as any[];
  const dailyRateForOT = cs.salary_type === 'fixed' && expected > 0 ? baseAmount / expected : baseAmount;
  const hourlyBaseRate = dailyRateForOT > 0 ? dailyRateForOT / 8 : 0;

  const buildOTDescription = (rule: any): { desc: string; sample: number } => {
    const ruleType = rule.type || rule.ot_type; // 'hourly' | 'full_day'
    const calcType = rule.calc_type || 'percentage';
    const value = Number(rule.value || rule.rate || 0);
    const isPct = calcType === 'percentage' || calcType === 'multiplier';
    if (ruleType === 'full_day') {
      const perDay = isPct
        ? Math.round(dailyRateForOT * value / 100)
        : value;
      return {
        desc: `Mỗi ngày tăng ca = ${fmt(perDay)} (${isPct ? `${value}% lương ngày` : 'cố định'}).`,
        sample: perDay,
      };
    }
    // hourly
    const perHour = isPct
      ? Math.round(hourlyBaseRate * value / 100)
      : value;
    return {
      desc: `Mỗi giờ tăng ca = ${fmt(perHour)} (${isPct ? `${value}% lương giờ` : 'cố định'}). Tăng ca 10h ≈ +${fmt(perHour * 10)}.`,
      sample: perHour * 10,
    };
  };

  if (otRules.length > 0) {
    for (const rule of otRules) {
      const { desc, sample } = buildOTDescription(rule);
      const ruleType = rule.type || rule.ot_type;
      out.push({
        icon: <Clock className="h-4 w-4 text-orange-600" />,
        tone: 'good',
        title: ruleType === 'full_day' ? `Tăng ca cả ngày: ${rule.name || 'OT'}` : `Tăng ca theo giờ: ${rule.name || 'OT'}`,
        description: desc,
        potential: Math.round(sample),
      });
    }
  } else if (hourlyBaseRate > 0) {
    // Fallback nếu admin chưa cấu hình rule cụ thể
    const fallbackHourly = hourlyBaseRate * 1.5;
    out.push({
      icon: <Clock className="h-4 w-4 text-orange-600" />,
      tone: 'good',
      title: 'Tăng ca thêm',
      description: `Mỗi giờ tăng ca ≈ ${fmt(fallbackHourly)} (ước tính 150% lương giờ). Tăng ca 10h ≈ +${fmt(fallbackHourly * 10)}.`,
      potential: Math.round(fallbackHourly * 10),
    });
  }

  // 5. ALLOWANCE — liệt kê TẤT CẢ phụ cấp với số tiền cấu hình + điều kiện
  const allAllowances = (record.allowance_details_v2 || []) as any[];
  for (const a of allAllowances) {
    const configured = Number(a.configured_amount || 0);
    const maxAbsent = Number(a.max_absent_days || 0);
    const standardDays = Number(a.standard_days || 0);
    const requiredWorkDays = Number(a.required_work_days || Math.max(0, standardDays - maxAbsent));
    const actualWorkDays = Number(a.actual_work_days ?? a.days ?? 0);
    const isPerDay = a.type === 'per_day';
    const isLost = !!a.skipped_reason;
    const isReceiving = Number(a.amount || 0) > 0;

    // Mô tả số tiền cấu hình
    let amountDesc = '';
    if (configured > 0) {
      amountDesc = isPerDay
        ? `Phụ cấp ${fmt(configured)}/ngày công`
        : `Phụ cấp cố định ${fmt(configured)}/tháng`;
    } else {
      amountDesc = `Phụ cấp: ${a.name}`;
    }

    // Mô tả điều kiện
    let conditionDesc = '';
    if (maxAbsent > 0) {
      conditionDesc = standardDays > 0
        ? ` · Điều kiện: đi đủ ≥ ${requiredWorkDays}/${standardDays} ngày (đã đi ${actualWorkDays}).`
        : ` · Điều kiện: vắng tối đa ${maxAbsent} ngày/tháng.`;
    } else if (maxAbsent === 0) {
      conditionDesc = ` · Không giới hạn ngày nghỉ.`;
    }

    if (isLost) {
      // Đã mất phụ cấp do vắng quá giới hạn → vẫn hiển thị dạng action "Nhận phụ cấp"
      const reqDaysText = requiredWorkDays > 0 ? `${requiredWorkDays} ngày công` : 'đủ ngày công';
      const headline = `Nhận phụ cấp ${fmt(configured)} khi làm ${reqDaysText}`;
      const detail =
        `Phụ cấp chuyên cần: ${a.name}\n\n` +
        `Bạn sẽ được nhận thêm ${fmt(configured)} nếu làm đủ ${reqDaysText}` +
        (standardDays > 0 && maxAbsent > 0
          ? ` (= ${standardDays} công chuẩn − ${maxAbsent} ngày được phép vắng).`
          : '.') +
        `\n\nHiện tại: đã đi ${actualWorkDays} ngày.\n⚠ ${a.skipped_reason}`;
      out.push({
        icon: <Gift className="h-4 w-4 text-purple-600" />,
        tone: 'warn',
        title: headline,
        description: 'Nhấn để xem chi tiết',
        detailDescription: detail,
        potential: configured,
      });
    } else if (isReceiving) {
      // Đang nhận đủ
      const reminder = maxAbsent > 0
        ? ` Giữ đi làm ≥ ${requiredWorkDays} ngày để không mất phụ cấp này.`
        : '';
      out.push({
        icon: <Gift className="h-4 w-4 text-purple-600" />,
        tone: 'good',
        title: `Đang nhận phụ cấp: ${a.name}`,
        description: `${amountDesc}${conditionDesc}${reminder}`,
        potential: 0,
        done: true,
      });
    } else {
      // Chưa nhận (per_day với 0 ngày công)
      const targetDesc = isPerDay
        ? ` Đi làm thêm ngày công để tích luỹ phụ cấp này.`
        : '';
      out.push({
        icon: <Gift className="h-4 w-4 text-purple-600" />,
        tone: 'warn',
        title: `Phụ cấp: ${a.name}`,
        description: `${amountDesc}${conditionDesc}${targetDesc}`,
        potential: configured,
      });
    }
  }

  // 6. PENALTY — cảnh báo phạt đang có
  // Quy tắc: phạt KPI (chưa đạt) chỉ hiện sau ngày 25 để nhân viên còn cơ hội chạy
  const todayDate = today ? new Date(today) : new Date();
  const dayOfMonth = todayDate.getDate();
  const isAfterDay25 = dayOfMonth >= 25;

  const penalties = (record.penalty_details || []) as any[];
  for (const p of penalties) {
    if (p.amount > 0) {
      const isKpiPenalty = p.type === 'kpi_not_met' || p.type === 'kpi_penalty' || p.type === 'kpi_miss' ||
        /kpi/i.test(String(p.name || '')) || /không đạt kpi/i.test(String(p.detail || ''));
      // Ẩn phạt KPI trước ngày 25 để nhân viên còn cơ hội đạt
      if (isKpiPenalty && !isAfterDay25) continue;

      out.push({
        icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
        tone: 'bad',
        title: `Đang bị phạt: ${p.name}`,
        description: p.detail || `${p.count} lần × ${fmt(p.per_amount)}`,
        potential: p.amount,
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