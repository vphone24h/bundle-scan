import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Clock, Calendar, DollarSign } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import type { BasicInfoData } from './StepBasicInfo';
import type { ScheduleData, SalaryData } from '../CreateEmployeeStepper';

const ROLE_LABELS: Record<string, string> = {
  branch_admin: 'Admin Chi nhánh', cashier: 'Kế toán', staff: 'Nhân viên',
};
const SALARY_TYPE_LABELS: Record<string, string> = {
  fixed: 'Cố định', hourly: 'Theo giờ', daily: 'Theo ngày', shift: 'Theo ca',
};
const DAY_LABELS: Record<string, string> = {
  monday: 'T2', tuesday: 'T3', wednesday: 'T4', thursday: 'T5', friday: 'T6', saturday: 'T7', sunday: 'CN',
};

interface Shift { id: string; name: string; start_time: string; end_time: string; }
interface Template { id: string; name: string; salary_type: string; base_amount: number; }
interface Branch { id: string; name: string; }

interface Props {
  basicInfo: BasicInfoData;
  selectedShiftId: string;
  shifts: Shift[];
  scheduleData: ScheduleData;
  salaryData: SalaryData;
  templates: Template[];
  branches: Branch[] | undefined;
}

export function StepReview({ basicInfo, selectedShiftId, shifts, scheduleData, salaryData, templates, branches }: Props) {
  const selectedShift = shifts.find(s => s.id === selectedShiftId);
  const branch = branches?.find(b => b.id === basicInfo.branchId);
  const template = templates.find(t => t.id === salaryData.templateId);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Xem lại thông tin trước khi tạo nhân viên.</p>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />Thông tin cơ bản</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 text-sm space-y-1">
          <p><strong>Tên:</strong> {basicInfo.displayName}</p>
          <p><strong>Email:</strong> {basicInfo.email}</p>
          {basicInfo.phone && <p><strong>SĐT:</strong> {basicInfo.phone}</p>}
          <p><strong>Vai trò:</strong> {basicInfo.useCustomRole ? basicInfo.customRoleName : ROLE_LABELS[basicInfo.role] || basicInfo.role}</p>
          <p><strong>Chi nhánh:</strong> {branch?.name || 'Chưa chọn'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" />Ca làm việc</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 text-sm">
          {selectedShift ? (
            <Badge variant="secondary">{selectedShift.name} ({selectedShift.start_time} - {selectedShift.end_time})</Badge>
          ) : (
            <span className="text-muted-foreground">Chưa gán ca</span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" />Lịch trình</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 text-sm">
          {scheduleData.type === 'fixed' ? (
            <p>Cố định - cùng ca mỗi ngày</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {Object.entries(scheduleData.customDays || {}).map(([day, shiftId]) => {
                const s = shifts.find(x => x.id === shiftId);
                return <Badge key={day} variant="outline" className="text-xs">{DAY_LABELS[day]}: {s?.name || '?'}</Badge>;
              })}
              {Object.keys(scheduleData.customDays || {}).length === 0 && <span className="text-muted-foreground">Chưa xếp lịch</span>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />Bảng lương</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 text-sm space-y-1">
          {template ? (
            <p><strong>Mẫu:</strong> {template.name} ({SALARY_TYPE_LABELS[template.salary_type]} - {formatNumber(template.base_amount)}đ)</p>
          ) : (
            <p className="text-muted-foreground">Không dùng mẫu lương</p>
          )}
          {salaryData.customBaseAmount && <p><strong>Lương tùy chỉnh:</strong> {formatNumber(salaryData.customBaseAmount)}đ</p>}
          {salaryData.allowances.length > 0 && (
            <p><strong>Phụ cấp:</strong> {salaryData.allowances.map(a => `${a.name} (${formatNumber(a.amount)}đ)`).join(', ')}</p>
          )}
          {salaryData.deductions.length > 0 && (
            <p><strong>Giảm trừ:</strong> {salaryData.deductions.map(d => `${d.name} (${formatNumber(d.amount)}đ)`).join(', ')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
