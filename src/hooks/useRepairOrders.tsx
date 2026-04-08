
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type RepairStatus = 'received' | 'pending_check' | 'repairing' | 'waiting_parts' | 'completed' | 'returned' | 'cancelled';

export interface RepairOrder {
  id: string;
  code: string;
  tenant_id: string;
  branch_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  device_name: string;
  device_imei: string | null;
  device_model: string | null;
  device_password: string | null;
  device_condition: string | null;
  device_images: string[];
  quantity: number;
  request_type_id: string | null;
  request_type_name: string;
  status: RepairStatus;
  estimated_price: number;
  due_date: string | null;
  received_by: string | null;
  received_by_name: string | null;
  technician_id: string | null;
  technician_name: string | null;
  total_service_price: number;
  total_parts_price: number;
  total_parts_cost: number;
  total_amount: number;
  export_receipt_id: string | null;
  note: string | null;
  send_email: boolean;
  ticket_password_enabled: boolean;
  ticket_password: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepairOrderItem {
  id: string;
  repair_order_id: string;
  tenant_id: string | null;
  item_type: 'service' | 'part';
  product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  product_imei: string | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  cost_price: number;
  total_price: number;
  import_receipt_id: string | null;
  created_at: string;
}

export interface RepairRequestType {
  id: string;
  name: string;
  tenant_id: string | null;
  display_order: number;
  is_default: boolean;
  created_at: string;
}

export const REPAIR_STATUS_MAP: Record<RepairStatus, { label: string; color: string }> = {
  received: { label: 'Tiếp nhận', color: 'bg-blue-100 text-blue-800' },
  pending_check: { label: 'Chờ kiểm tra', color: 'bg-yellow-100 text-yellow-800' },
  repairing: { label: 'Đang sửa', color: 'bg-orange-100 text-orange-800' },
  waiting_parts: { label: 'Chờ linh kiện', color: 'bg-purple-100 text-purple-800' },
  completed: { label: 'Hoàn thành', color: 'bg-red-100 text-red-800' },
  returned: { label: 'Đã trả khách', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Đã hủy', color: 'bg-red-200 text-red-900' },
};

export interface RepairOrdersFilters {
  statusFilter?: RepairStatus | 'all';
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useRepairOrders(filters: RepairOrdersFilters = {}) {
  const { user } = useAuth();
  const { statusFilter = 'all', search, page = 1, pageSize = 20 } = filters;

  return useQuery({
    queryKey: ['repair-orders', statusFilter, search, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('repair_orders')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (search && search.trim().length >= 2) {
        const s = search.trim();
        query = query.or(
          `code.ilike.%${s}%,device_name.ilike.%${s}%,device_imei.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%`
        );
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return {
        items: (data || []) as unknown as RepairOrder[],
        totalCount: count || 0,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });
}

export function useRepairOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['repair-order', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('repair_orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as RepairOrder | null;
    },
    enabled: !!id,
  });
}

export function useRepairOrderItems(repairOrderId: string | undefined) {
  return useQuery({
    queryKey: ['repair-order-items', repairOrderId],
    queryFn: async () => {
      if (!repairOrderId) return [];
      const { data, error } = await supabase
        .from('repair_order_items')
        .select('*')
        .eq('repair_order_id', repairOrderId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as RepairOrderItem[];
    },
    enabled: !!repairOrderId,
  });
}

export function useRepairRequestTypes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['repair-request-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('repair_request_types')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as RepairRequestType[];
    },
    enabled: !!user,
  });
}

export function useCreateRepairOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (order: Partial<RepairOrder>) => {
      const { data, error } = await supabase
        .from('repair_orders')
        .insert(order as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RepairOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-orders'] });
      toast.success('Tạo phiếu sửa chữa thành công');
    },
    onError: (err: any) => {
      toast.error('Lỗi tạo phiếu: ' + err.message);
    },
  });
}

export function useUpdateRepairOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RepairOrder> & { id: string }) => {
      const { data, error } = await supabase
        .from('repair_orders')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RepairOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['repair-orders'] });
      queryClient.invalidateQueries({ queryKey: ['repair-order', data.id] });
    },
    onError: (err: any) => {
      toast.error('Lỗi cập nhật: ' + err.message);
    },
  });
}

export function useAddRepairItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<RepairOrderItem>) => {
      const { data, error } = await supabase
        .from('repair_order_items')
        .insert(item as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RepairOrderItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['repair-order-items', data.repair_order_id] });
      queryClient.invalidateQueries({ queryKey: ['repair-orders'] });
    },
    onError: (err: any) => {
      toast.error('Lỗi thêm dịch vụ: ' + err.message);
    },
  });
}

export function useDeleteRepairItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, repairOrderId }: { id: string; repairOrderId: string }) => {
      const { error } = await supabase
        .from('repair_order_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { repairOrderId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['repair-order-items', data.repairOrderId] });
      queryClient.invalidateQueries({ queryKey: ['repair-orders'] });
    },
  });
}

export function useCreateRepairRequestType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (type: { name: string; tenant_id: string }) => {
      const { data, error } = await supabase
        .from('repair_request_types')
        .insert(type as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-request-types'] });
      toast.success('Đã thêm loại yêu cầu');
    },
  });
}

export function useDeleteRepairRequestType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('repair_request_types')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-request-types'] });
      toast.success('Đã xóa loại yêu cầu');
    },
  });
}

export function useRepairStatusHistory(repairOrderId: string | undefined) {
  return useQuery({
    queryKey: ['repair-status-history', repairOrderId],
    queryFn: async () => {
      if (!repairOrderId) return [];
      const { data, error } = await supabase
        .from('repair_status_history')
        .select('*')
        .eq('repair_order_id', repairOrderId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!repairOrderId,
  });
}

/** Realtime subscription for repair_orders - auto-invalidates queries on any change */
export function useRepairOrdersRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('repair-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'repair_orders' },
        (payload) => {
          // Invalidate list and specific order queries
          queryClient.invalidateQueries({ queryKey: ['repair-orders'] });
          const id = (payload.new as any)?.id || (payload.old as any)?.id;
          if (id) {
            queryClient.invalidateQueries({ queryKey: ['repair-order', id] });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'repair_order_items' },
        (payload) => {
          const repairOrderId = (payload.new as any)?.repair_order_id || (payload.old as any)?.repair_order_id;
          if (repairOrderId) {
            queryClient.invalidateQueries({ queryKey: ['repair-order-items', repairOrderId] });
            queryClient.invalidateQueries({ queryKey: ['repair-orders'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
