import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Calendar, MapPin, Smartphone, BarChart3, Lock, FileText, FileEdit, Monitor } from 'lucide-react';
import { usePendingApprovals } from '@/hooks/usePendingApprovals';
import { PendingBadge } from '@/components/ui/pending-badge';
import { WorkShiftsTab } from '@/components/attendance/WorkShiftsTab';
import { ShiftScheduleTab } from '@/components/attendance/ShiftScheduleTab';
import { AttendanceHistoryTab } from '@/components/attendance/AttendanceHistoryTab';
import { AttendanceLocationsTab } from '@/components/attendance/AttendanceLocationsTab';
import { TrustedDevicesTab } from '@/components/attendance/TrustedDevicesTab';
import { AttendanceDashboardTab } from '@/components/attendance/AttendanceDashboardTab';
import { AttendanceLocksTab } from '@/components/attendance/AttendanceLocksTab';
import { AttendanceReportTab } from '@/components/attendance/AttendanceReportTab';
import { CorrectionRequestsTab } from '@/components/attendance/CorrectionRequestsTab';
import { PosCheckInTab } from '@/components/attendance/PosCheckInTab';

export default function AttendancePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="pl-14 lg:pl-0">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Chấm công & Ca làm</h1>
        <p className="text-sm text-muted-foreground mt-1">Quản lý ca làm việc, xếp ca, chấm công và thiết bị</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 h-auto p-1 gap-1">
            <TabsTrigger value="dashboard" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tổng quan</span>
              <span className="sm:hidden">TQ</span>
            </TabsTrigger>
            <TabsTrigger value="shifts" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ca làm</span>
              <span className="sm:hidden">Ca</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Xếp ca</span>
              <span className="sm:hidden">Lịch</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lịch sử</span>
              <span className="sm:hidden">LS</span>
            </TabsTrigger>
            <TabsTrigger value="corrections" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
              <FileEdit className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sửa công</span>
              <span className="sm:hidden">SC</span>
            </TabsTrigger>
            <TabsTrigger value="report" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Báo cáo</span>
              <span className="sm:hidden">BC</span>
            </TabsTrigger>
            <TabsTrigger value="locations" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
              <MapPin className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Điểm CC</span>
              <span className="sm:hidden">Địa</span>
            </TabsTrigger>
            <TabsTrigger value="devices" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Thiết bị</span>
              <span className="sm:hidden">TB</span>
            </TabsTrigger>
            <TabsTrigger value="locks" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Chốt công</span>
              <span className="sm:hidden">Khóa</span>
            </TabsTrigger>
            <TabsTrigger value="pos" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
              <Monitor className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">POS</span>
              <span className="sm:hidden">POS</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="mt-4"><AttendanceDashboardTab /></TabsContent>
        <TabsContent value="shifts" className="mt-4"><WorkShiftsTab /></TabsContent>
        <TabsContent value="schedule" className="mt-4"><ShiftScheduleTab /></TabsContent>
        <TabsContent value="history" className="mt-4"><AttendanceHistoryTab /></TabsContent>
        <TabsContent value="corrections" className="mt-4"><CorrectionRequestsTab /></TabsContent>
        <TabsContent value="report" className="mt-4"><AttendanceReportTab /></TabsContent>
        <TabsContent value="locations" className="mt-4"><AttendanceLocationsTab /></TabsContent>
        <TabsContent value="devices" className="mt-4"><TrustedDevicesTab /></TabsContent>
        <TabsContent value="locks" className="mt-4"><AttendanceLocksTab /></TabsContent>
        <TabsContent value="pos" className="mt-4"><PosCheckInTab /></TabsContent>
      </Tabs>
    </div>
  );
}
