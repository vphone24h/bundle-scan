import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  User, Clock, Calendar, DollarSign, MapPin, Search,
  ChevronRight, ArrowLeft, Check, Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentTenant, usePlatformUser } from '@/hooks/useTenant';
import { useWorkShifts } from '@/hooks/useAttendance';
import { useSalaryTemplates } from '@/hooks/usePayroll';
import { useTenantStaffList } from '@/hooks/useTenantStaffList';
import { StepCreateShift } from './steps/StepCreateShift';
import { StepSchedule } from './steps/StepSchedule';
import { StepSalary } from './steps/StepSalary';
import { StepAttendanceSetup, type AttendanceSetupData } from './steps/StepAttendanceSetup';
import { buildRecurringShiftAssignments } from '@/lib/attendanceSchedule';
import { buildPaidLeaveOverrideRows, getPaidLeaveDaysForMonth, getPaidLeaveMonthKey, mapPaidLeaveOverrideRows } from '@/lib/paidLeaveSchedule';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { toast } from 'sonner';
import type { ScheduleData, SalaryData } from './CreateEmployeeStepper';

const SETUP_STEPS = [
  { key: 'info', label: 'Thông tin', icon: User, desc: 'Tên, SĐT, email, vai trò' },
  { key: 'shift', label: 'Tạo ca', icon: Clock, desc: 'Tạo hoặc chọn ca làm' },
  { key: 'schedule', label: 'Xếp lịch', icon: Calendar, desc: 'Gán lịch làm việc' },
  { key: 'salary', label: 'Bảng lương', icon: DollarSign, desc: 'Gán hoặc tạo bảng lương' },
  { key: 'attendance', label: 'Chấm công', icon: MapPin, desc: 'Thiết lập chấm công' },
] as const;

interface EmployeeSetup {
  userId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  role: string;
  hasShift: boolean;
  hasSchedule: boolean;
  hasSalary: boolean;
  hasAttendance: boolean;
  shiftId?: string;
  salaryConfig?: any;
}

type EmployeeSetupOverride = Partial<Pick<EmployeeSetup, 'hasShift' | 'hasSchedule' | 'hasSalary' | 'hasAttendance' | 'shiftId' | 'salaryConfig'>>;

function calcProgress(emp: EmployeeSetup): number {
  let done = 1; // step 1 (info) always done
  if (emp.hasShift) done++;
  if (emp.hasSchedule) done++;
  if (emp.hasSalary) done++;
  if (emp.hasAttendance) done++;
  return Math.round((done / 5) * 100);
}

function getStepStatus(emp: EmployeeSetup, stepIdx: number): 'completed' | 'current' | 'pending' {
  const steps = [true, emp.hasShift, emp.hasSchedule, emp.hasSalary, emp.hasAttendance];
  if (steps[stepIdx]) return 'completed';
  const firstIncomplete = steps.findIndex(s => !s);
  if (stepIdx === firstIncomplete) return 'current';
  return 'pending';
}

export function EmployeeSetupTab() {
  const { data: currentTenant } = useCurrentTenant();
  const { data: pu } = usePlatformUser();
  const tenantId = currentTenant?.id || pu?.tenant_id;
  const qc = useQueryClient();
  const { data: shifts } = useWorkShifts();
  const { data: salaryTemplates } = useSalaryTemplates();
  const { data: staffList = [], isLoading: staffLoading } = useTenantStaffList();

  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSetup | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [setupOverrides, setSetupOverrides] = useState<Record<string, EmployeeSetupOverride>>({});

  // Step data
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [scheduleData, setScheduleData] = useState<ScheduleData>({ type: 'fixed' });
  const [salaryData, setSalaryData] = useState<SalaryData>({ allowances: [], deductions: [] });
  const [attendanceData, setAttendanceData] = useState<AttendanceSetupData>({
    allowGps: true, allowQr: true, allowPos: false,
    maxDevices: 2, requireDeviceApproval: true,
  });
  const [saving, setSaving] = useState(false);

  const { data: employeeSetupData, isLoading: setupLoading } = useQuery({
    queryKey: ['employee-setup-configs', tenantId],
    queryFn: async () => {
      // IMPORTANT: paginate — shift_assignments can exceed Supabase's 1000-row default
      // limit. Without this, employees whose rows fall past row 1000 appear to have
      // no shift/schedule and their setup progress drops from 100% to 40%.
      const [shiftAssignments, salaryConfigs] = await Promise.all([
        fetchAllRows<{ user_id: string; shift_id: string }>(() =>
          supabase
            .from('shift_assignments')
            .select('user_id, shift_id')
            .eq('tenant_id', tenantId!)
            .eq('is_active', true)
        ),
        fetchAllRows<{ user_id: string; salary_template_id: string | null; custom_base_amount: number | null }>(() =>
          supabase
            .from('employee_salary_configs')
            .select('user_id, salary_template_id, custom_base_amount')
            .eq('tenant_id', tenantId!)
            .eq('is_active', true)
        ),
      ]);

      return { shiftAssignments, salaryConfigs };
    },
    enabled: !!tenantId,
  });

  const employees = useMemo(() => {
    const shiftMap = new Map<string, string>();
    for (const assignment of employeeSetupData?.shiftAssignments || []) {
      if (!shiftMap.has(assignment.user_id)) {
        shiftMap.set(assignment.user_id, assignment.shift_id);
      }
    }

    const salaryMap = new Map((employeeSetupData?.salaryConfigs || []).map((item) => [item.user_id, item]));

    let result: EmployeeSetup[] = staffList.map((staff) => {
      const baseHasShift = shiftMap.has(staff.user_id);
      const baseHasSalary = salaryMap.has(staff.user_id);
      const override = setupOverrides[staff.user_id];
      const shiftId = override?.shiftId ?? shiftMap.get(staff.user_id) ?? undefined;
      const salaryConfig = override?.salaryConfig ?? salaryMap.get(staff.user_id) ?? undefined;

      return {
        userId: staff.user_id,
        displayName: staff.display_name || 'Chưa cập nhật',
        email: staff.email,
        phone: staff.phone,
        role: staff.user_role || 'staff',
        hasShift: override?.hasShift ?? baseHasShift,
        hasSchedule: override?.hasSchedule ?? baseHasShift,
        hasSalary: override?.hasSalary ?? baseHasSalary,
        hasAttendance: override?.hasAttendance ?? (baseHasShift && baseHasSalary),
        shiftId,
        salaryConfig,
      };
    });

    if (search) {
      const keyword = search.toLowerCase();
      result = result.filter((employee) =>
        employee.displayName.toLowerCase().includes(keyword) ||
        employee.email?.toLowerCase().includes(keyword) ||
        employee.phone?.includes(search)
      );
    }

    return result;
  }, [employeeSetupData, search, setupOverrides, staffList]);

  const isLoading = staffLoading || setupLoading;

  const updateEmployeeProgress = (userId: string, patch: EmployeeSetupOverride) => {
    setSetupOverrides((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        ...patch,
      },
    }));
    setSelectedEmployee((prev) => prev && prev.userId === userId ? { ...prev, ...patch } : prev);
  };

  const selectEmployee = async (emp: EmployeeSetup) => {
    setSelectedEmployee(emp);
    setSelectedShiftId(emp.shiftId || '');
    // Load existing shift assignments to restore the correct schedule type
    let restoredSchedule: ScheduleData = { type: 'fixed', fixedShiftId: emp.shiftId };
    if (tenantId) {
      const { data: assignments } = await supabase
        .from('shift_assignments')
        .select('assignment_type, day_of_week, specific_date, shift_id')
        .eq('tenant_id', tenantId)
        .eq('user_id', emp.userId);

      const rows = (assignments || []) as Array<{
        assignment_type: string;
        day_of_week: number | null;
        specific_date: string | null;
        shift_id: string;
      }>;

      const dailyRows = rows.filter(r => r.assignment_type === 'daily' && r.specific_date);
      const fixedRows = rows.filter(r => r.assignment_type === 'fixed' && r.day_of_week !== null);

      if (dailyRows.length > 0) {
        const weeklyDays: Record<string, string> = {};
        dailyRows.forEach(r => { if (r.specific_date) weeklyDays[r.specific_date] = r.shift_id; });
        restoredSchedule = { type: 'weekly', weeklyDays, fixedShiftId: emp.shiftId };
      } else if (fixedRows.length > 0) {
        const uniqueShifts = new Set(fixedRows.map(r => r.shift_id));
        // 7 days same shift = fixed; otherwise custom
        if (fixedRows.length === 7 && uniqueShifts.size === 1) {
          restoredSchedule = { type: 'fixed', fixedShiftId: fixedRows[0].shift_id };
        } else {
          const dayKeys = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
          const customDays: Record<string, string> = {};
          fixedRows.forEach(r => {
            if (r.day_of_week !== null) customDays[dayKeys[r.day_of_week]] = r.shift_id;
          });
          restoredSchedule = { type: 'custom', customDays, fixedShiftId: emp.shiftId };
        }
      }
    }
    setScheduleData(restoredSchedule);
    // Load existing paid leave default dates + monthly overrides
    let existingLeaveDays: number[] = [];
    let paidLeaveOverrides: Record<string, number[]> = {};
    const referenceMonth = getPaidLeaveMonthKey(new Date());
    if (tenantId) {
      const [{ data: defaultLeaveData }, { data: overrideRows }] = await Promise.all([
        supabase
          .from('paid_leave_default_dates')
          .select('days_of_month')
          .eq('tenant_id', tenantId)
          .eq('user_id', emp.userId)
          .maybeSingle(),
        supabase
          .from('paid_leave_overrides')
          .select('year, month, leave_dates')
          .eq('tenant_id', tenantId)
          .eq('user_id', emp.userId),
      ]);
      existingLeaveDays = ((defaultLeaveData as any)?.days_of_month as number[]) || [];
      paidLeaveOverrides = mapPaidLeaveOverrideRows((overrideRows as any) || []);
    }
    setSalaryData({
      allowances: [],
      deductions: [],
      templateId: emp.salaryConfig?.salary_template_id || undefined,
      customBaseAmount: emp.salaryConfig?.custom_base_amount || undefined,
      paidLeaveDaysOfMonth: existingLeaveDays,
      paidLeaveReferenceMonth: referenceMonth,
      paidLeaveOverrides,
    });
    setAttendanceData({ allowGps: true, allowQr: true, allowPos: false, maxDevices: 2, requireDeviceApproval: true });
    const firstIncomplete = [true, emp.hasShift, emp.hasSchedule, emp.hasSalary, emp.hasAttendance].findIndex(s => !s);
    setActiveStep(firstIncomplete === -1 ? 4 : firstIncomplete);
  };

  const handleSaveStep = async () => {
    if (!selectedEmployee || !tenantId) return;

    setSaving(true);
    try {
      if (activeStep === 1) {
        if (!selectedShiftId) {
          throw new Error('Vui lòng chọn hoặc tạo ca làm');
        }

        updateEmployeeProgress(selectedEmployee.userId, {
          hasShift: true,
          shiftId: selectedShiftId,
        });
        toast.success('Đã lưu bước tạo ca!');
      } else if (activeStep === 2) {
        if (scheduleData.type !== 'weekly' && scheduleData.type !== 'flexible' && !selectedShiftId) {
          throw new Error('Vui lòng chọn ca trước khi xếp lịch');
        }

        // Flexible: xóa toàn bộ shift_assignments — nhân viên làm theo giờ tự do
        if (scheduleData.type === 'flexible') {
          const { error: deleteError } = await supabase
            .from('shift_assignments')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('user_id', selectedEmployee.userId);
          if (deleteError) throw deleteError;

          updateEmployeeProgress(selectedEmployee.userId, {
            hasShift: true,
            hasSchedule: true,
            shiftId: undefined,
          });
          toast.success('Đã thiết lập chế độ làm việc theo giờ tự do!');
          await qc.refetchQueries({ queryKey: ['employee-setup-configs', tenantId] });
          if (activeStep < 4) setActiveStep((prev) => prev + 1);
          return;
        }

        const inserts = buildRecurringShiftAssignments({
          tenantId,
          userId: selectedEmployee.userId,
          selectedShiftId,
          scheduleData,
        });

        if (!inserts.length) {
          throw new Error('Vui lòng chọn ít nhất một ca để xếp lịch');
        }

        // For weekly mode, only delete daily assignments (keep fixed ones intact)
        if (scheduleData.type === 'weekly') {
          const { error: deleteError } = await supabase
            .from('shift_assignments')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('user_id', selectedEmployee.userId)
            .eq('assignment_type', 'daily');
          if (deleteError) throw deleteError;
        } else {
          const { error: deleteError } = await supabase
            .from('shift_assignments')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('user_id', selectedEmployee.userId);
          if (deleteError) throw deleteError;
        }

        const { error } = await supabase.from('shift_assignments').insert(inserts as any);
        if (error) throw error;

        updateEmployeeProgress(selectedEmployee.userId, {
          hasShift: true,
          hasSchedule: true,
          shiftId: selectedShiftId,
        });
        toast.success('Đã lưu lịch trình!');
      } else if (activeStep === 3) {
        if (!(salaryData.templateId || salaryData.customBaseAmount || salaryData.allowances.length || salaryData.deductions.length)) {
          throw new Error('Vui lòng chọn mẫu lương hoặc nhập dữ liệu lương');
        }

        // Check if selected template has enable_overtime — require schedule
        if (salaryData.templateId) {
          const selectedTemplate = salaryTemplates?.find((t: any) => t.id === salaryData.templateId);
          if (selectedTemplate?.enable_overtime && !selectedEmployee.hasSchedule) {
            throw new Error('Mẫu lương này có bật tăng ca — vui lòng xếp lịch làm việc trước (bước 2, 3) để hệ thống xác định giờ tăng ca.');
          }
          // Warning: schedule exists but overtime is OFF — schedule will be ignored for payroll
          if (!selectedTemplate?.enable_overtime && selectedEmployee.hasSchedule) {
            toast.warning('Tăng ca đang tắt — lịch làm việc đã xếp sẽ không được dùng để tính lương. Hệ thống chỉ tính theo giờ check-in/check-out thực tế.');
          }

          // Ngày nghỉ có lương là TÙY CHỌN — không bắt buộc.
          // NV xin nghỉ qua "Công của tôi" → hệ thống tự ghi nhận.
          // Nếu đi làm full không nghỉ → số ngày dư tự cộng vào tăng ca theo hệ số.
        }

        const salaryPayload = {
          tenant_id: tenantId,
          user_id: selectedEmployee.userId,
          salary_template_id: salaryData.templateId || null,
          custom_base_amount: salaryData.customBaseAmount || null,
          allowances: salaryData.allowances,
          deductions: salaryData.deductions,
        };

        const { error } = await supabase
          .from('employee_salary_configs')
          .upsert(salaryPayload, { onConflict: 'tenant_id,user_id' });
        if (error) throw error;

        const { error: leaveErr } = await supabase
          .from('paid_leave_default_dates')
          .upsert({
            tenant_id: tenantId,
            user_id: selectedEmployee.userId,
            days_of_month: salaryData.paidLeaveDaysOfMonth || [],
          }, { onConflict: 'tenant_id,user_id' });
        if (leaveErr) throw leaveErr;

        const overrideRows = buildPaidLeaveOverrideRows({
          tenantId,
          userId: selectedEmployee.userId,
          overrides: salaryData.paidLeaveOverrides,
        });

        const { error: deleteOverridesError } = await supabase
          .from('paid_leave_overrides')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('user_id', selectedEmployee.userId);
        if (deleteOverridesError) throw deleteOverridesError;

        if (overrideRows.length > 0) {
          const { error: overrideErr } = await supabase
            .from('paid_leave_overrides')
            .insert(overrideRows as any);
          if (overrideErr) throw overrideErr;
        }

        updateEmployeeProgress(selectedEmployee.userId, {
          hasSalary: true,
          salaryConfig: salaryPayload,
        });
        toast.success('Đã lưu bảng lương!');
      } else if (activeStep === 4) {
        updateEmployeeProgress(selectedEmployee.userId, {
          hasAttendance: true,
        });
        toast.success('Đã lưu thiết lập chấm công!');
      }

      await qc.refetchQueries({ queryKey: ['employee-setup-configs', tenantId] });

      if (activeStep < 4) {
        setActiveStep((prev) => prev + 1);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Employee detail view
  if (selectedEmployee) {
    const emp = selectedEmployee;
    const progress = calcProgress(emp);

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedEmployee(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại danh sách
        </Button>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{emp.displayName}</CardTitle>
                <p className="text-xs text-muted-foreground">{emp.email || emp.phone}</p>
              </div>
              <Badge variant={progress === 100 ? 'default' : 'secondary'}>
                {progress === 100 ? 'Hoàn thành' : `${progress}%`}
              </Badge>
            </div>
            <Progress value={progress} className="h-2 mt-2" />
          </CardHeader>
        </Card>

        {/* Stepper */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {SETUP_STEPS.map((step, idx) => {
            const status = getStepStatus(emp, idx);
            const Icon = step.icon;
            const isActive = idx === activeStep;
            return (
              <div key={step.key} className="flex items-center flex-1 min-w-0">
                <button
                  onClick={() => setActiveStep(idx)}
                  className={cn(
                    'flex flex-col items-center gap-1 min-w-0 transition-colors w-full',
                    isActive && 'text-primary',
                    status === 'completed' && !isActive && 'text-green-600 dark:text-green-400',
                    status === 'pending' && !isActive && 'text-muted-foreground',
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors',
                    isActive && 'border-primary bg-primary/10',
                    status === 'completed' && !isActive && 'border-green-500 bg-green-500 text-white',
                    status === 'pending' && !isActive && 'border-muted-foreground/30',
                  )}>
                    {status === 'completed' && !isActive ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="text-[10px] font-medium truncate max-w-[60px]">{step.label}</span>
                </button>
                {idx < SETUP_STEPS.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 mx-1 rounded',
                    status === 'completed' ? 'bg-green-500' : 'bg-muted',
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <Card>
          <CardContent className="p-4">
            {activeStep === 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm flex items-center gap-2"><User className="h-4 w-4" /> Thông tin nhân viên</h3>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Tên:</span><span className="font-medium">{emp.displayName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Email:</span><span>{emp.email || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">SĐT:</span><span>{emp.phone || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Vai trò:</span><Badge variant="outline">{emp.role}</Badge></div>
                </div>
                <p className="text-xs text-green-600 flex items-center gap-1"><Check className="h-3 w-3" /> Đã hoàn thành (tạo khi đăng ký)</p>
              </div>
            )}

            {activeStep === 1 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Tạo / Chọn ca làm việc</h3>
                <StepCreateShift
                  shifts={shifts || []}
                  selectedShiftId={selectedShiftId}
                  onSelect={setSelectedShiftId}
                />
              </div>
            )}

            {activeStep === 2 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm flex items-center gap-2"><Calendar className="h-4 w-4" /> Xếp lịch làm việc</h3>
                <StepSchedule
                  scheduleData={scheduleData}
                  onChange={setScheduleData}
                  shifts={shifts || []}
                  selectedShiftId={selectedShiftId}
                />
              </div>
            )}

            {activeStep === 3 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Gán bảng lương</h3>
                <StepSalary
                  salaryData={salaryData}
                  onChange={setSalaryData}
                  templates={salaryTemplates || []}
                />
              </div>
            )}

            {activeStep === 4 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> Thiết lập chấm công</h3>
                <StepAttendanceSetup
                  data={attendanceData}
                  onChange={setAttendanceData}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action buttons */}
        {activeStep >= 1 && activeStep <= 4 && (
          <div className="flex gap-2">
            {activeStep > 0 && (
              <Button variant="outline" size="sm" onClick={() => setActiveStep(activeStep - 1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
              </Button>
            )}
            <Button size="sm" className="flex-1" onClick={handleSaveStep} disabled={saving}>
              {saving ? 'Đang lưu...' : activeStep === 4 ? 'Lưu & Hoàn tất' : 'Lưu & Tiếp tục'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Employee list
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Cài đặt nhân viên
          </CardTitle>
          <p className="text-xs text-muted-foreground">Chọn nhân viên để thiết lập ca, lịch, lương, chấm công</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Tìm nhân viên..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>

          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Đang tải...</p>
          ) : (
            <div className="space-y-2">
              {employees?.map(emp => {
                const progress = calcProgress(emp);
                return (
                  <button
                    key={emp.userId}
                    onClick={() => selectEmployee(emp)}
                    className="w-full text-left border rounded-lg p-3 hover:bg-muted/50 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{emp.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{emp.email || emp.phone || '-'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={progress === 100 ? 'default' : 'secondary'} className="text-xs">
                          {progress}%
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                    <div className="flex gap-1">
                      {SETUP_STEPS.map((step, idx) => {
                        const status = getStepStatus(emp, idx);
                        return (
                          <div
                            key={step.key}
                            className={cn(
                              'h-1.5 flex-1 rounded-full',
                              status === 'completed' ? 'bg-green-500' : 'bg-muted',
                            )}
                          />
                        );
                      })}
                    </div>
                  </button>
                );
              })}
              {employees?.length === 0 && (
                <p className="text-center py-8 text-muted-foreground text-sm">Không tìm thấy nhân viên</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
