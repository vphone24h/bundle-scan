import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, MapPin, Smartphone, Download, Loader2 } from 'lucide-react';
import { useAttendanceRecords, useAttendanceLocations } from '@/hooks/useAttendance';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const statusConfig: Record<string, { label: string; class: string }> = {
  on_time: { label: 'Đúng giờ', class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  late: { label: 'Đi trễ', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  early_leave: { label: 'Về sớm', class: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  absent: { label: 'Vắng', class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  pending: { label: 'Đang làm', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  day_off: { label: 'Nghỉ', class: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
};

export function AttendanceHistoryTab() {
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [userFilter, setUserFilter] = useState('_all');
  const [locationFilter, setLocationFilter] = useState('_all');
  const [exporting, setExporting] = useState(false);

  const { data: records, isLoading } = useAttendanceRecords({
    date: dateFilter || undefined,
    userId: userFilter !== '_all' ? userFilter : undefined,
    locationId: locationFilter !== '_all' ? locationFilter : undefined,
  });
  const { data: locations } = useAttendanceLocations();

  // Fetch profiles for user names
  const userIds = [...new Set(records?.map(r => r.user_id) || [])];
  const { data: profiles } = useQuery({
    queryKey: ['profiles-batch', userIds],
    queryFn: async () => {
      if (!userIds.length) return {};
      const { data } = await supabase.from('profiles').select('user_id, display_name, phone').in('user_id', userIds);
      return Object.fromEntries((data || []).map(p => [p.user_id, { name: p.display_name, phone: p.phone }]));
    },
    enabled: userIds.length > 0,
  });

  // Get unique users for filter
  const { data: allProfiles } = useQuery({
    queryKey: ['all-tenant-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, display_name').limit(200);
      return data || [];
    },
  });

  const handleExport = useCallback(async () => {
    if (!records?.length) { toast.error('Không có dữ liệu để xuất'); return; }
    setExporting(true);
    try {
      const rows = records.map((r: any) => ({
        'Nhân viên': profiles?.[r.user_id]?.name || r.user_id,
        'Ngày': r.date,
        'Trạng thái': statusConfig[r.status]?.label || r.status,
        'Check-in': r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm:ss') : '',
        'Check-out': r.check_out_time ? format(new Date(r.check_out_time), 'HH:mm:ss') : '',
        'Giờ làm (phút)': r.total_work_minutes || 0,
        'Trễ (phút)': r.late_minutes || 0,
        'Về sớm (phút)': r.early_leave_minutes || 0,
        'Tăng ca (phút)': r.overtime_minutes || 0,
        'Phương thức': r.check_in_method || '',
        'Địa điểm': (r.attendance_locations as any)?.name || '',
        'Ca': (r.work_shifts as any)?.name || '',
        'Ghi chú': r.note || '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Chấm công');

      // Auto column width
      const maxWidths = Object.keys(rows[0]).map(key => Math.max(key.length, ...rows.map(r => String((r as any)[key]).length)));
      ws['!cols'] = maxWidths.map(w => ({ wch: Math.min(w + 2, 30) }));

      XLSX.writeFile(wb, `cham-cong-${dateFilter || 'all'}.xlsx`);
      toast.success('Xuất Excel thành công');
    } catch (err: any) {
      toast.error('Lỗi xuất: ' + err.message);
    } finally {
      setExporting(false);
    }
  }, [records, profiles, dateFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h2 className="text-lg font-semibold">Lịch sử chấm công</h2>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting || !records?.length}>
          {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          Xuất Excel
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" />
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tất cả NV" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tất cả nhân viên</SelectItem>
            {allProfiles?.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tất cả điểm" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tất cả địa điểm</SelectItem>
            {locations?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : !records?.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Chưa có bản ghi chấm công</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{records.length} bản ghi</p>

          {/* Desktop Table */}
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nhân viên</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Giờ làm</TableHead>
                    <TableHead>Trễ</TableHead>
                    <TableHead>Địa điểm</TableHead>
                    <TableHead>PP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r: any) => {
                    const st = statusConfig[r.status] || statusConfig.pending;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{profiles?.[r.user_id]?.name || r.user_id.slice(0, 8)}</TableCell>
                        <TableCell><Badge className={`text-[10px] ${st.class}`}>{st.label}</Badge></TableCell>
                        <TableCell className="text-sm">{r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm') : '--:--'}</TableCell>
                        <TableCell className="text-sm">{r.check_out_time ? format(new Date(r.check_out_time), 'HH:mm') : '--:--'}</TableCell>
                        <TableCell className="text-sm">
                          {r.total_work_minutes > 0 ? `${Math.floor(r.total_work_minutes / 60)}h${r.total_work_minutes % 60}p` : '-'}
                        </TableCell>
                        <TableCell>{r.late_minutes > 0 ? <span className="text-yellow-600 text-sm">{r.late_minutes}p</span> : '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{r.attendance_locations?.name || '-'}</TableCell>
                        <TableCell className="uppercase text-xs text-muted-foreground">{r.check_in_method || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2">
            {records.map((r: any) => {
              const st = statusConfig[r.status] || statusConfig.pending;
              return (
                <Card key={r.id}>
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{profiles?.[r.user_id]?.name || r.user_id.slice(0, 8)}</span>
                      <Badge className={`text-[10px] ${st.class}`}>{st.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm') : '--:--'} → {r.check_out_time ? format(new Date(r.check_out_time), 'HH:mm') : '--:--'}
                      </span>
                      {r.total_work_minutes > 0 && <span className="font-medium text-foreground">{Math.floor(r.total_work_minutes / 60)}h{r.total_work_minutes % 60}p</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      {r.late_minutes > 0 && <span className="text-yellow-600">Trễ {r.late_minutes}p</span>}
                      {r.attendance_locations?.name && <span className="flex items-center gap-0.5 text-muted-foreground"><MapPin className="h-3 w-3" />{r.attendance_locations.name}</span>}
                      {r.check_in_method && <span className="flex items-center gap-0.5 text-muted-foreground uppercase"><Smartphone className="h-3 w-3" />{r.check_in_method}</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
