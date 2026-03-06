import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from './usePermissions';
import { useAuth } from './useAuth';

// Helper to get current user's tenant_id
async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export interface DebtSummary {
  entity_id: string;
  entity_name: string;
  entity_phone: string | null;
  branch_id: string | null;
  branch_name: string | null;
  total_amount: number; // Tổng phát sinh
  paid_amount: number; // Đã thu/trả
  remaining_amount: number; // Còn nợ
  first_debt_date: string | null; // Ngày phát sinh đầu tiên
  days_overdue: number;
  merged_entity_ids?: string[]; // For merged supplier debts
}

export interface DebtPayment {
  id: string;
  entity_type: 'customer' | 'supplier';
  entity_id: string;
  payment_type: 'payment' | 'addition';
  amount: number;
  allocated_amount: number;
  payment_source: string | null;
  description: string;
  branch_id: string | null;
  created_by: string | null;
  created_at: string;
  // Joined
  profiles?: { display_name: string } | null;
  branches?: { name: string } | null;
}

// Hook to get customer debt summary
export function useCustomerDebts(showSettled: boolean = false) {
  const { user } = useAuth();
  const { data: permissions } = usePermissions();

  return useQuery({
    queryKey: ['customer-debts', user?.id, showSettled, permissions?.branchId, permissions?.role],
    queryFn: async () => {
      const branchId = (permissions?.role !== 'super_admin' && permissions?.branchId) ? permissions.branchId : null;
      
      const { data, error } = await supabase.rpc('get_customer_debt_summary', {
        _show_settled: showSettled,
        _branch_id: branchId,
      });

      if (error) throw error;

      return ((data || []) as any[]).map((row: any) => ({
        entity_id: row.entity_id,
        entity_name: row.entity_name,
        entity_phone: row.entity_phone,
        branch_id: row.branch_id,
        branch_name: row.branch_name,
        total_amount: Number(row.total_amount) || 0,
        paid_amount: Number(row.paid_amount) || 0,
        remaining_amount: Number(row.remaining_amount) || 0,
        first_debt_date: row.first_debt_date,
        days_overdue: row.days_overdue || 0,
      })) as DebtSummary[];
    },
    enabled: !!permissions,
  });
}

// Hook to get supplier debt summary
export function useSupplierDebts(showSettled: boolean = false) {
  const { user } = useAuth();
  const { data: permissions } = usePermissions();

  return useQuery({
    queryKey: ['supplier-debts', user?.id, showSettled, permissions?.branchId, permissions?.role],
    queryFn: async () => {
      const branchId = (permissions?.role !== 'super_admin' && permissions?.branchId) ? permissions.branchId : null;
      
      const { data, error } = await supabase.rpc('get_supplier_debt_summary', {
        _show_settled: showSettled,
        _branch_id: branchId,
      });

      if (error) throw error;

      return ((data || []) as any[]).map((row: any) => ({
        entity_id: row.entity_id,
        entity_name: row.entity_name,
        entity_phone: row.entity_phone,
        branch_id: row.branch_id,
        branch_name: row.branch_name,
        total_amount: Number(row.total_amount) || 0,
        paid_amount: Number(row.paid_amount) || 0,
        remaining_amount: Number(row.remaining_amount) || 0,
        first_debt_date: row.first_debt_date,
        days_overdue: row.days_overdue || 0,
        merged_entity_ids: row.merged_entity_ids || undefined,
      })) as DebtSummary[];
    },
    enabled: !!permissions,
  });
}

// Hook to get debt detail for an entity (supports merged supplier IDs)
export function useDebtDetail(entityType: 'customer' | 'supplier', entityId: string, mergedEntityIds?: string[]) {
  const entityIds = mergedEntityIds && mergedEntityIds.length > 0 ? mergedEntityIds : [entityId];
  
  return useQuery({
    queryKey: ['debt-detail', entityType, entityId, mergedEntityIds],
    queryFn: async () => {
      if (entityType === 'customer') {
        const { data: receipts, error } = await supabase
          .from('export_receipts')
          .select(`
            id, code, export_date, total_amount, paid_amount, debt_amount, original_debt_amount, note,
            export_receipt_items(id, product_name, sku, imei, sale_price, note, status)
          `)
          .eq('customer_id', entityId)
          .eq('status', 'completed')
          .gte('debt_amount', 0)
          .order('export_date', { ascending: false });
        if (error) throw error;
        return receipts;
      } else {
        const { data: receipts, error } = await supabase
          .from('import_receipts')
          .select(`
            id, code, import_date, total_amount, paid_amount, debt_amount, original_debt_amount, note,
            products(id, name, sku, imei, import_price, note, status)
          `)
          .in('supplier_id', entityIds)
          .eq('status', 'completed')
          .gte('debt_amount', 0)
          .order('import_date', { ascending: false });
        if (error) throw error;
        return receipts;
      }
    },
    enabled: !!entityId,
  });
}

// Hook to get payment history for an entity (supports merged supplier IDs)
export function useDebtPaymentHistory(entityType: 'customer' | 'supplier', entityId: string, mergedEntityIds?: string[]) {
  const entityIds = mergedEntityIds && mergedEntityIds.length > 0 ? mergedEntityIds : [entityId];
  
  return useQuery({
    queryKey: ['debt-payment-history', entityType, entityId, mergedEntityIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debt_payments')
        .select(`*, branches(name)`)
        .eq('entity_type', entityType)
        .in('entity_id', entityIds)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = [...new Set(data?.map(p => p.created_by).filter(Boolean))];
      let profiles: { user_id: string; display_name: string }[] = [];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);
        profiles = profileData || [];
      }

      return data?.map(payment => ({
        ...payment,
        profiles: profiles.find(p => p.user_id === payment.created_by) || null,
      })) as DebtPayment[];
    },
    enabled: !!entityId,
  });
}

// Hook to create debt payment with FIFO allocation
export function useCreateDebtPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: {
      entity_type: 'customer' | 'supplier';
      entity_id: string;
      entity_name: string;
      payment_type: 'payment' | 'addition';
      amount: number;
      remaining_amount: number; // Current remaining debt before this payment
      payment_source?: string;
      description: string;
      branch_id?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get current tenant_id
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');
      
      // Calculate new remaining amount
      const oldDebt = payment.remaining_amount;
      const newDebt = payment.payment_type === 'payment' 
        ? oldDebt - payment.amount 
        : oldDebt + payment.amount;
      
      // Insert debt payment
      const { data, error } = await supabase
        .from('debt_payments')
        .insert([{
          entity_type: payment.entity_type,
          entity_id: payment.entity_id,
          payment_type: payment.payment_type,
          amount: payment.amount,
          payment_source: payment.payment_source,
          description: payment.description,
          branch_id: payment.branch_id,
          created_by: user?.id,
          tenant_id: tenantId,
        }])
        .select()
        .single();

      if (error) throw error;

      // FIFO allocation: Apply payment chronologically across BOTH orders and addition notes
      if (payment.payment_type === 'payment') {
        let remainingPayment = payment.amount;
        
        // Step 1: Get unpaid receipts (orders)
        let orderItems: { id: string; date: number; debt_amount: number; paid_amount: number }[] = [];
        
        if (payment.entity_type === 'customer') {
          const { data: receipts } = await supabase
            .from('export_receipts')
            .select('id, export_date, debt_amount, paid_amount')
            .eq('customer_id', payment.entity_id)
            .eq('status', 'completed')
            .gt('debt_amount', 0)
            .order('export_date', { ascending: true });
          
          if (receipts) {
            orderItems = receipts.map(r => ({
              id: r.id,
              date: new Date(r.export_date).getTime(),
              debt_amount: Number(r.debt_amount),
              paid_amount: Number(r.paid_amount),
            }));
          }
        } else {
          const { data: receipts } = await supabase
            .from('import_receipts')
            .select('id, import_date, debt_amount, paid_amount')
            .eq('supplier_id', payment.entity_id)
            .eq('status', 'completed')
            .gt('debt_amount', 0)
            .order('import_date', { ascending: true });
          
          if (receipts) {
            orderItems = receipts.map(r => ({
              id: r.id,
              date: new Date(r.import_date).getTime(),
              debt_amount: Number(r.debt_amount),
              paid_amount: Number(r.paid_amount),
            }));
          }
        }
        
        // Step 2: Get unpaid addition notes
        const { data: additions } = await supabase
          .from('debt_payments')
          .select('id, amount, allocated_amount, created_at')
          .eq('entity_type', payment.entity_type)
          .eq('entity_id', payment.entity_id)
          .eq('payment_type', 'addition')
          .order('created_at', { ascending: true });
        
        // Step 3: Merge into a single timeline sorted by date (oldest first)
        type DebtItem = { kind: 'order'; id: string; date: number; unpaid: number; paidAmount: number } 
          | { kind: 'addition'; id: string; date: number; unpaid: number; currentAllocated: number };
        const timeline: DebtItem[] = [];
        
        for (const o of orderItems) {
          timeline.push({ kind: 'order', id: o.id, date: o.date, unpaid: o.debt_amount, paidAmount: o.paid_amount });
        }
        
        if (additions) {
          for (const a of additions) {
            const total = Number(a.amount);
            const allocated = Number(a.allocated_amount) || 0;
            const unpaid = total - allocated;
            if (unpaid > 0) {
              timeline.push({ kind: 'addition', id: a.id, date: new Date(a.created_at).getTime(), unpaid, currentAllocated: allocated });
            }
          }
        }
        
        timeline.sort((a, b) => a.date - b.date);
        
        // Step 4: Allocate payment in chronological order
        const receiptTable = payment.entity_type === 'customer' ? 'export_receipts' : 'import_receipts';
        
        for (const item of timeline) {
          if (remainingPayment <= 0) break;
          const payAmount = Math.min(remainingPayment, item.unpaid);
          
          if (item.kind === 'order') {
            const newPaid = item.paidAmount + payAmount;
            const newDebt = item.unpaid - payAmount;
            
            if (payment.entity_type === 'customer') {
              await supabase.from('export_receipts').update({ paid_amount: newPaid, debt_amount: newDebt }).eq('id', item.id);
            } else {
              await supabase.from('import_receipts').update({ paid_amount: newPaid, debt_amount: newDebt }).eq('id', item.id);
            }
          } else {
            const newAllocated = item.currentAllocated + payAmount;
            await supabase.from('debt_payments').update({ allocated_amount: newAllocated }).eq('id', item.id);
          }
          
          remainingPayment -= payAmount;
        }
      }

      // If it's a payment (not addition), also create cash book entry
      // Note: is_business_accounting = false because this is just cash flow from debt collection/payment
      // The actual revenue/expense was already recorded when the original sale/purchase was made
      if (payment.payment_type === 'payment') {
        const cashBookType = payment.entity_type === 'customer' ? 'income' as const : 'expense' as const;
        
        // Fetch staff name for cash book
        const { data: staffProfile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user?.id)
          .maybeSingle();
        const staffName = staffProfile?.display_name || user?.email || null;

        const { error: cashBookError } = await supabase.from('cash_book').insert([{
          type: cashBookType,
          category: payment.entity_type === 'customer' ? 'Thu nợ khách hàng' : 'Trả nợ nhà cung cấp',
          description: payment.description,
          amount: payment.amount,
          payment_source: payment.payment_source || 'cash',
          is_business_accounting: false, // Không tính hạch toán kinh doanh - chỉ là dòng tiền
          branch_id: payment.branch_id || null,
          reference_id: data.id,
          reference_type: 'debt_payment',
          created_by: user?.id,
          tenant_id: tenantId,
          created_by_name: staffName,
          recipient_name: payment.entity_name || null,
        }]);
        
        if (cashBookError) {
          console.error('Lỗi ghi sổ quỹ khi thu/trả nợ:', cashBookError);
        }
      }

      // Audit log with before/after debt info
      const actionDesc = payment.entity_type === 'customer' 
        ? (payment.payment_type === 'payment' ? 'Thu nợ khách hàng' : 'Cộng nợ khách hàng')
        : (payment.payment_type === 'payment' ? 'Trả nợ nhà cung cấp' : 'Cộng nợ nhà cung cấp');
      
      const entityLabel = payment.entity_type === 'customer' ? 'Khách hàng' : 'Nhà cung cấp';
      
      await supabase.from('audit_logs').insert([{
        user_id: user?.id,
        action_type: payment.payment_type === 'payment' ? 'update' : 'create',
        table_name: 'debt_payments',
        record_id: data.id,
        branch_id: payment.branch_id || null,
        tenant_id: tenantId,
        old_data: {
          entity_type: payment.entity_type,
          entity_name: payment.entity_name,
          remaining_amount: oldDebt,
        },
        new_data: {
          entity_type: payment.entity_type,
          entity_name: payment.entity_name,
          payment_type: payment.payment_type,
          amount: payment.amount,
          payment_source: payment.payment_source,
          remaining_amount: newDebt,
        },
        description: `${actionDesc}: ${payment.entity_name} | Số tiền: ${payment.amount.toLocaleString('vi-VN')}đ | Nợ trước: ${oldDebt.toLocaleString('vi-VN')}đ → Nợ sau: ${Math.max(0, newDebt).toLocaleString('vi-VN')}đ | ${payment.description}`,
      }]);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-detail', variables.entity_type, variables.entity_id] });
      queryClient.invalidateQueries({ queryKey: ['debt-payment-history', variables.entity_type, variables.entity_id] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['import-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
    },
  });
}
