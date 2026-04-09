import { useState } from 'react';
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
import { useCurrentTenant } from '@/hooks/useTenant';
import { useWorkShifts } from '@/hooks/useAttendance';
import { useSalaryTemplates } from '@/hooks/usePayroll';
import { StepCreateShift } from './steps/StepCreateShift';
import { StepSchedule } from './steps/StepSchedule';
import { StepSalary } from './steps/StepSalary';
import { StepAttendanceSetup, type AttendanceSetupData } from './steps/StepAttendanceSetup';
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
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const { data: shifts } = useWorkShifts();
  const { data: salaryTemplates } = useSalaryTemplates();

  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSetup | null>(null);
  const [activeStep, setActiveStep] = useState(1);

  // Step data
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [scheduleData, setScheduleData] = useState<ScheduleData>({ type: 'fixed' });
  const [salaryData, setSalaryData] = useState<SalaryData>({ allowances: [], deductions: [] });
  const [attendanceData, setAttendanceData] = useState<AttendanceSetupData>({
    allowGps: true, allowQr: true, allowPos: false,
    maxDevices: 2, requireDeviceApproval: true,
  });
  const [saving, setSaving] = useState(false);

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employee-setup', tenantId, search],
    queryFn: async () => {
      let rolesQ = supabase.from('user_roles').select('user_id, user_role').eq('tenant_id', tenantId!);
      const { data: roles } = await rolesQ;
      if (!roles?.length) return [];

      const userIds = roles.map(r => r.user_id);

      const [profilesRes, platformRes, shiftsRes, salaryRes] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, phone').in('user_id', userIds),
        supabase.from('platform_users').select('user_id, email').eq('tenant_id', tenantId!).in('user_id', userIds),
        supabase.from('shift_assignments').select('user_id, shift_id').eq('tenant_id', tenantId!).in('user_id', userIds),
        supabase.from('employee_salary_configs').select('user_id, salary_template_id, custom_base_amount').eq('tenant_id', tenantId!).in('user_id', userIds),
      ]);

      const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);
      const emailMap = new Map(platformRes.data?.map(p => [p.user_id, p.email]) || []);
      const shiftMap = new Map(shiftsRes.data?.map(s => [s.user_id, s.shift_id]) || []);
      const salaryMap = new Map(salaryRes.data?.map(s => [s.user_id, s]) || []);

      let result: EmployeeSetup[] = roles.map(r => {
        const p = profileMap.get(r.user_id);
        const hasShift = shiftMap.has(r.user_id);
        const hasSalary = salaryMap.has(r.user_id);
        return {
          userId: r.user_id,
          displayName: p?.display_name || 'Chưa cập nhật',
          email: emailMap.get(r.user_id) || null,
          phone: p?.phone || null,
          role: r.user_role,
          hasShift,
          hasSchedule: hasShift,
          hasSalary,
          hasAttendance: hasShift && hasSalary, // consider setup done when core config exists
          shiftId: shiftMap.get(r.user_id) || undefined,
          salaryConfig: salaryMap.get(r.user_id) || undefined,
        };
      });

      if (search) {
        const s = search.toLowerCase();
        result = result.filter(e => e.displayName.toLowerCase().includes(s) || e.email?.toLowerCase().includes(s) || e.phone?.includes(s));
      }

      return result;
    },
    enabled: !!tenantId,
  });

  const selectEmployee = (emp: EmployeeSetup) => {
    setSelectedEmployee(emp);
    setSelectedShiftId(emp.shiftId || '');
    setScheduleData({ type: 'fixed', fixedShiftId: emp.shiftId });
    setSalaryData({ allowances: [], deductions: [], templateId: emp.salaryConfig?.salary_template_id || undefined, customBaseAmount: emp.salaryConfig?.custom_base_amount || undefined });
    setAttendanceData({ allowGps: true, allowQr: true, allowPos: false, maxDevices: 2, requireDeviceApproval: true });
    const firstIncomplete = [true, emp.hasShift, emp.hasSchedule, emp.hasSalary, emp.hasAttendance].findIndex(s => !s);
    setActiveStep(firstIncomplete === -1 ? 4 : firstIncomplete);
  };

  const handleSaveStep = async () => {
    if (!selectedEmployee || !tenantId) return;
    setSaving(true);
    try {
      if (activeStep === 1 && selectedShiftId) {
        const { error } = await supabase.from('shift_assignments').upsert({
          tenant_id: tenantId,
          user_id: selectedEmployee.userId,
          shift_id: selectedShiftId,
          assignment_type: scheduleData.type === 'fixed' ? 'fixed' : 'daily',
        }, { onConflict: 'tenant_id,user_id,shift_id' });
        if (error) throw error;
        toast.success('Đã lưu ca làm!');
      } else if (activeStep === 2) {
        if (selectedShiftId) {
          toast.success('Đã lưu lịch trình!');
        }
      } else if (activeStep === 3) {
        if (salaryData.templateId || salaryData.customBaseAmount) {
          const { error } = await supabase.from('employee_salary_configs').upsert({
            tenant_id: tenantId,
            user_id: selectedEmployee.userId,
            salary_template_id: salaryData.templateId || null,
            custom_base_amount: salaryData.customBaseAmount || null,
            allowances: salaryData.allowances,
            deductions: salaryData.deductions,
          }, { onConflict: 'tenant_id,user_id' });
          if (error) throw error;
          toast.success('Đã lưu bảng lương!');
        }
      } else if (activeStep === 4) {
        toast.success('Đã lưu thiết lập chấm công!');
      }
      qc.invalidateQueries({ queryKey: ['employee-setup'] });
      if (activeStep < 4) setActiveStep(activeStep + 1);
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
