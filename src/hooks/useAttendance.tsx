import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { usePlatformUser } from './useTenant';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type WorkShiftInsert = Database['public']['Tables']['work_shifts']['Insert'];
type AttendanceLocationInsert = Database['public']['Tables']['attendance_locations']['Insert'];
type ShiftAssignmentInsert = Database['public']['Tables']['shift_assignments']['Insert'];

// ============ Work Shifts ============
export function useWorkShifts() {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;

  return useQuery({
    queryKey: ['work-shifts', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_shifts')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}

export function useCreateWorkShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shift: WorkShiftInsert) => {
      const { data, error } = await supabase.from('work_shifts').insert([shift]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-shifts'] });
      toast.success('Tạo ca làm việc thành công');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateWorkShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<WorkShiftInsert>) => {
      const { error } = await supabase.from('work_shifts').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-shifts'] });
      toast.success('Cập nhật ca thành công');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteWorkShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('work_shifts').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-shifts'] });
      toast.success('Xóa ca thành công');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ Attendance Locations ============
export function useAttendanceLocations() {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;

  return useQuery({
    queryKey: ['attendance-locations', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_locations')
        .select('*, branches(name)')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}

export function useCreateAttendanceLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (loc: AttendanceLocationInsert) => {
      const { data, error } = await supabase.from('attendance_locations').insert([loc]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-locations'] });
      toast.success('Tạo điểm chấm công thành công');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAttendanceLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<AttendanceLocationInsert>) => {
      const { error } = await supabase.from('attendance_locations').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-locations'] });
      toast.success('Cập nhật thành công');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ Trusted Devices ============
export function useTrustedDevices() {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;

  return useQuery({
    queryKey: ['trusted-devices', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trusted_devices')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}

export function useApproveDevice() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trusted_devices').update({
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trusted-devices'] });
      toast.success('Đã duyệt thiết bị');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRejectDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trusted_devices').update({ status: 'rejected' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trusted-devices'] });
      toast.success('Đã từ chối thiết bị');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============ Attendance Records ============
export function useAttendanceRecords(filters?: { date?: string; userId?: string; locationId?: string }) {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;

  return useQuery({
    queryKey: ['attendance-records', tenantId, filters],
    queryFn: async () => {
      let q = supabase
        .from('attendance_records')
        .select('*, work_shifts(name, start_time, end_time), attendance_locations(name)')
        .eq('tenant_id', tenantId!)
        .order('date', { ascending: false })
        .order('check_in_time', { ascending: false })
        .limit(200);

      if (filters?.date) q = q.eq('date', filters.date);
      if (filters?.userId) q = q.eq('user_id', filters.userId);
      if (filters?.locationId) q = q.eq('location_id', filters.locationId);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}

export function useTodayAttendanceSummary() {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['attendance-summary-today', tenantId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('status, user_id')
        .eq('tenant_id', tenantId!)
        .eq('date', today);
      if (error) throw error;

      const total = data?.length || 0;
      const onTime = data?.filter(r => r.status === 'on_time').length || 0;
      const late = data?.filter(r => r.status === 'late').length || 0;
      const absent = data?.filter(r => r.status === 'absent').length || 0;
      const pending = data?.filter(r => r.status === 'pending').length || 0;

      return { total, onTime, late, absent, pending };
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });
}

// ============ Shift Assignments ============
export function useShiftAssignments(filters?: { userId?: string; date?: string }) {
  const { data: pu } = usePlatformUser();
  const tenantId = pu?.tenant_id;

  return useQuery({
    queryKey: ['shift-assignments', tenantId, filters],
    queryFn: async () => {
      let q = supabase
        .from('shift_assignments')
        .select('*, work_shifts(name, start_time, end_time, color)')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true);

      if (filters?.userId) q = q.eq('user_id', filters.userId);
      if (filters?.date) q = q.eq('specific_date', filters.date);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}

export function useCreateShiftAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignment: ShiftAssignmentInsert) => {
      const { data, error } = await supabase.from('shift_assignments').insert([assignment]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-assignments'] });
      toast.success('Xếp ca thành công');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteShiftAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shift_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-assignments'] });
      toast.success('Xóa lịch ca thành công');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
