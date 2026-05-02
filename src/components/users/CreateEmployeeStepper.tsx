import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, ArrowRight, ArrowLeft, Check, Crown, User, Clock, Calendar, DollarSign, CheckCircle2 } from 'lucide-react';
import { UserRole } from '@/hooks/usePermissions';
import { PermissionMap, getDefaultPermissionsForRole } from '@/config/permissionDefinitions';
import { useSaveCustomPermissions } from '@/hooks/useCustomPermissions';
import { useCurrentTenant, usePlatformUser } from '@/hooks/useTenant';
import { useAuditLog } from '@/hooks/usePermissions';
import { useWorkShifts } from '@/hooks/useAttendance';
import { useSalaryTemplates } from '@/hooks/usePayroll';
import { StepBasicInfo, type BasicInfoData } from './steps/StepBasicInfo';
import { StepCreateShift } from './steps/StepCreateShift';
import { StepSchedule } from './steps/StepSchedule';
import { StepSalary } from './steps/StepSalary';
import { StepAttendanceSetup, type AttendanceSetupData } from './steps/StepAttendanceSetup';
import { cn } from '@/lib/utils';
import { buildRecurringShiftAssignments } from '@/lib/attendanceSchedule';
import { buildPaidLeaveOverrideRows, getPaidLeaveDaysForMonth } from '@/lib/paidLeaveSchedule';

interface Branch { id: string; name: string; }

interface CreateEmployeeStepperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[] | undefined;
}

const STEPS = [
  { key: 'info', label: 'Thông tin', icon: User },
  { key: 'shift', label: 'Tạo ca', icon: Clock },
  { key: 'schedule', label: 'Xếp lịch', icon: Calendar },
  { key: 'salary', label: 'Bảng lương', icon: DollarSign },
  { key: 'attendance', label: 'Chấm công', icon: CheckCircle2 },
] as const;

export interface ScheduleData {
  type: 'fixed' | 'custom' | 'weekly' | 'flexible';
  fixedShiftId?: string;
  customDays?: Record<string, string>; // day -> shiftId
  weeklyDays?: Record<string, string>; // date (yyyy-MM-dd) -> shiftId
}

export interface SalaryData {
  templateId?: string;
  customBaseAmount?: number;
  allowances: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
  paidLeaveDaysOfMonth?: number[];
  paidLeaveReferenceMonth?: string;
  paidLeaveOverrides?: Record<string, number[]>;
}

export function CreateEmployeeStepper({ open, onOpenChange, branches }: CreateEmployeeStepperProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentTenant } = useCurrentTenant();
  const { data: platformUser } = usePlatformUser();
  const tenantId = currentTenant?.id || platformUser?.tenant_id;
  const savePermissions = useSaveCustomPermissions();
  const { logAction } = useAuditLog();
  const { data: shifts } = useWorkShifts();
  const { data: salaryTemplates } = useSalaryTemplates();

  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1 data
  const [basicInfo, setBasicInfo] = useState<BasicInfoData>({
    email: '', password: '', displayName: '', phone: '',
    role: 'staff', customRoleName: '', useCustomRole: false, branchId: '',
  });
  const [permissions, setPermissions] = useState<PermissionMap>(() => getDefaultPermissionsForRole('staff'));

  // Step 2 data
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');

  // Step 3 data
  const [scheduleData, setScheduleData] = useState<ScheduleData>({ type: 'fixed' });

  // Step 4 data
  const [salaryData, setSalaryData] = useState<SalaryData>({
    allowances: [], deductions: [],
  });

  // Step 5 data
  const [attendanceData, setAttendanceData] = useState<AttendanceSetupData>({
    allowGps: true, allowQr: true, allowPos: false, maxDevices: 2, requireDeviceApproval: true,
  });

  const [memberLimitError, setMemberLimitError] = useState<{
    currentCount: number; maxUsers: number; message: string;
  } | null>(null);

  const resetForm = () => {
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setBasicInfo({ email: '', password: '', displayName: '', phone: '', role: 'staff', customRoleName: '', useCustomRole: false, branchId: '' });
    setPermissions(getDefaultPermissionsForRole('staff'));
    setSelectedShiftId('');
    setScheduleData({ type: 'fixed' });
    setSalaryData({ allowances: [], deductions: [] });
    setMemberLimitError(null);
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        if (!basicInfo.email || !basicInfo.password || !basicInfo.displayName) {
          toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
          return false;
        }
        if (basicInfo.password.length < 6) {
          toast.error('Mật khẩu phải có ít nhất 6 ký tự');
          return false;
        }
        if (!basicInfo.branchId) {
          toast.error('Vui lòng chọn chi nhánh');
          return false;
        }
        return true;
      case 1: return true; // optional
      case 2: return true; // optional
      case 3: {
        // Ngày nghỉ có lương là TÙY CHỌN — không bắt buộc chọn trước.
        // Hệ thống tự ghi nhận khi NV xin nghỉ; ngày dư tự cộng vào tăng ca.
        return true;
      }
      default: return true;
    }
  };

  const goNext = () => {
    if (!validateStep(currentStep)) return;
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const goBack = () => setCurrentStep(prev => Math.max(prev - 1, 0));
  const goToStep = (step: number) => {
    if (step < currentStep || completedSteps.has(step) || step === currentStep + 1) {
      if (step > currentStep && !validateStep(currentStep)) return;
      if (step > currentStep) setCompletedSteps(prev => new Set([...prev, currentStep]));
      setCurrentStep(step);
    }
  };

  const createEmployee = useMutation({
    mutationFn: async () => {
      // Step 1: Create user account
      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: basicInfo.email,
          password: basicInfo.password,
          displayName: basicInfo.displayName,
          phone: basicInfo.phone,
          role: basicInfo.useCustomRole ? 'staff' : basicInfo.role,
          branchId: basicInfo.branchId || null,
        },
      });

      if (response.data?.errorCode) {
        const err = new Error(response.data.error) as any;
        err.errorCode = response.data.errorCode;
        err.maxUsers = response.data.maxUsers;
        err.currentCount = response.data.currentCount;
        throw err;
      }
      if (response.data?.ok === false || response.data?.error) throw new Error(response.data.error || 'Lỗi không xác định');
      if (response.error) throw new Error(response.error.message);

      const userId = response.data?.userId;
      if (!userId || !tenantId) return response.data;

      // Save permissions
      await savePermissions.mutateAsync({ userId, tenantId, permissions });

      // Step 2: Assign shift
      const scheduleAssignments = buildRecurringShiftAssignments({
        tenantId,
        userId,
        selectedShiftId,
        scheduleData,
      });

      if (scheduleAssignments.length) {
        const { error } = await supabase.from('shift_assignments').insert(scheduleAssignments as any);
        if (error) throw error;
      }

      // Step 4: Save salary config
      if (salaryData.templateId || salaryData.customBaseAmount) {
        const { error } = await supabase.from('employee_salary_configs').insert({
          tenant_id: tenantId,
          user_id: userId,
          salary_template_id: salaryData.templateId || null,
          custom_base_amount: salaryData.customBaseAmount || null,
          allowances: salaryData.allowances,
          deductions: salaryData.deductions,
        });
        if (error) throw error;
      }

      // Lưu ngày nghỉ có lương mặc định + theo từng tháng đã chọn
      const defaultLeaveDays = salaryData.paidLeaveDaysOfMonth || [];
      const { error: defaultLeaveError } = await supabase.from('paid_leave_default_dates').upsert({
        tenant_id: tenantId,
        user_id: userId,
        days_of_month: defaultLeaveDays,
      }, { onConflict: 'tenant_id,user_id' });
      if (defaultLeaveError) throw defaultLeaveError;

      const overrideRows = buildPaidLeaveOverrideRows({
        tenantId,
        userId,
        overrides: salaryData.paidLeaveOverrides,
      });

      const { error: deleteOverrideError } = await supabase
        .from('paid_leave_overrides')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('user_id', userId);
      if (deleteOverrideError) throw deleteOverrideError;

      if (overrideRows.length > 0) {
        const { error: overrideError } = await supabase
          .from('paid_leave_overrides')
          .insert(overrideRows);
        if (overrideError) throw overrideError;
      }

      await logAction({
        actionType: 'create',
        tableName: 'user_custom_permissions',
        recordId: userId,
        newData: { permissions, role: basicInfo.useCustomRole ? basicInfo.customRoleName : basicInfo.role },
        description: `Tạo nhân viên ${basicInfo.displayName} (5 bước)`,
      });

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('Tạo nhân viên thành công!');
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      if (error.errorCode === 'MEMBER_LIMIT_REACHED') {
        setMemberLimitError({ currentCount: error.currentCount || 0, maxUsers: error.maxUsers || 0, message: error.message });
      } else {
        toast.error('Lỗi: ' + error.message);
      }
    },
  });

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) resetForm();
  };

  const getStepStatus = (idx: number) => {
    if (completedSteps.has(idx)) return 'completed';
    if (idx === currentStep) return 'current';
    return 'pending';
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Tạo nhân viên mới</DialogTitle>
          <DialogDescription>Quy trình {STEPS.length} bước</DialogDescription>
        </DialogHeader>

        {memberLimitError ? (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="rounded-full bg-amber-100 p-3"><Crown className="h-8 w-8 text-amber-600" /></div>
              <h3 className="text-lg font-semibold text-amber-600">Đã đạt giới hạn thành viên</h3>
              <p className="text-sm text-muted-foreground">
                Cửa hàng đã có <strong className="text-foreground">{memberLimitError.currentCount}</strong> / <strong className="text-foreground">{memberLimitError.maxUsers}</strong> thành viên.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white" onClick={() => { handleOpenChange(false); navigate('/subscription'); }}>
                <Crown className="h-4 w-4 mr-2" />Nâng cấp ngay
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setMemberLimitError(null)}>Quay lại</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Stepper Progress */}
            <div className="flex items-center gap-1 px-2 py-3 overflow-x-auto">
              {STEPS.map((step, idx) => {
                const status = getStepStatus(idx);
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex items-center flex-1 min-w-0">
                    <button
                      onClick={() => goToStep(idx)}
                      className={cn(
                        'flex flex-col items-center gap-1 min-w-0 transition-colors',
                        status === 'current' && 'text-primary',
                        status === 'completed' && 'text-green-600 dark:text-green-400 cursor-pointer',
                        status === 'pending' && 'text-muted-foreground',
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors',
                        status === 'current' && 'border-primary bg-primary/10',
                        status === 'completed' && 'border-green-500 bg-green-500 text-white',
                        status === 'pending' && 'border-muted-foreground/30',
                      )}>
                        {status === 'completed' ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <span className="text-[10px] font-medium truncate max-w-[60px]">{step.label}</span>
                    </button>
                    {idx < STEPS.length - 1 && (
                      <div className={cn(
                        'flex-1 h-0.5 mx-1 rounded',
                        completedSteps.has(idx) ? 'bg-green-500' : 'bg-muted',
                      )} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step Content */}
            <div className="flex-1 overflow-y-auto min-h-0 px-1">
              {currentStep === 0 && (
                <StepBasicInfo
                  data={basicInfo}
                  onChange={setBasicInfo}
                  branches={branches}
                  permissions={permissions}
                  onPermissionsChange={setPermissions}
                />
              )}
              {currentStep === 1 && (
                <StepCreateShift
                  shifts={shifts || []}
                  selectedShiftId={selectedShiftId}
                  onSelect={setSelectedShiftId}
                />
              )}
              {currentStep === 2 && (
                <StepSchedule
                  scheduleData={scheduleData}
                  onChange={setScheduleData}
                  shifts={shifts || []}
                  selectedShiftId={selectedShiftId}
                />
              )}
              {currentStep === 3 && (
                <StepSalary
                  salaryData={salaryData}
                  onChange={setSalaryData}
                  templates={salaryTemplates || []}
                />
              )}
              {currentStep === 4 && (
                <StepAttendanceSetup
                  data={attendanceData}
                  onChange={setAttendanceData}
                />
              )}
            </div>
          </>
        )}

        {!memberLimitError && (
          <DialogFooter className="gap-2 flex-row justify-between">
            <div>
              {currentStep > 0 && (
                <Button variant="outline" size="sm" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" />Quay lại
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Hủy</Button>
              {currentStep < 4 ? (
                <Button size="sm" onClick={goNext}>
                  {currentStep === 0 ? 'Tiếp tục' : 'Bỏ qua / Tiếp'}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={() => createEmployee.mutate()} disabled={createEmployee.isPending}>
                  {createEmployee.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Xác nhận tạo
                </Button>
              )}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
