import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { DebtSummary, useCustomerDebts, useSupplierDebts } from './useDebt';
import { useMemo } from 'react';

export interface DebtOffsetMatch {
  customerDebt: DebtSummary;
  supplierDebt: DebtSummary;
  matchedEntityCode: string;
}

/**
 * Detects 2-way debt matches between customers and suppliers by entity_code.
 * Only matches entities with remaining_amount > 0 on both sides.
 */
export function useDebtOffsetMatches() {
  const { data: customerDebts } = useCustomerDebts(false);
  const { data: supplierDebts } = useSupplierDebts(false);

  return useMemo(() => {
    if (!customerDebts || !supplierDebts) return [];

    const matches: DebtOffsetMatch[] = [];

    // Build entity_code -> supplier map
    const supplierByCode = new Map<string, DebtSummary>();
    for (const sd of supplierDebts) {
      if (sd.entity_code && sd.remaining_amount > 0) {
        supplierByCode.set(sd.entity_code.trim(), sd);
      }
    }

    // Find customers with matching entity_code
    for (const cd of customerDebts) {
      if (cd.entity_code && cd.remaining_amount > 0) {
        const code = cd.entity_code.trim();
        const matchedSupplier = supplierByCode.get(code);
        if (matchedSupplier) {
          matches.push({
            customerDebt: cd,
            supplierDebt: matchedSupplier,
            matchedEntityCode: code,
          });
        }
      }
    }

    return matches;
  }, [customerDebts, supplierDebts]);
}

/**
 * Check if a specific entity (customer or supplier) has a 2-way debt match.
 */
export function useEntityOffsetMatch(entityType: 'customer' | 'supplier', entityCode: string | null) {
  const matches = useDebtOffsetMatches();
  
  return useMemo(() => {
    if (!entityCode || matches.length === 0) return null;
    const code = entityCode.trim();
    return matches.find(m => m.matchedEntityCode === code) || null;
  }, [matches, entityCode]);
}

/**
 * Execute a debt offset between a customer and supplier.
 */
export function useExecuteDebtOffset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      customerEntityId: string;
      supplierEntityId: string;
      customerName: string;
      supplierName: string;
      customerDebtBefore: number;
      supplierDebtBefore: number;
      offsetAmount: number;
      customerBranchId: string | null;
      supplierBranchId: string | null;
      supplierMergedEntityIds?: string[];
      note?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Get staff name
      const { data: staffProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user?.id)
        .maybeSingle();
      const staffName = staffProfile?.display_name || user?.email || null;

      const customerDebtAfter = params.customerDebtBefore - params.offsetAmount;
      const supplierDebtAfter = params.supplierDebtBefore - params.offsetAmount;

      // 1. Record the offset
      const { error: offsetError } = await supabase
        .from('debt_offsets')
        .insert([{
          tenant_id: tenantId,
          customer_entity_id: params.customerEntityId,
          supplier_entity_id: params.supplierEntityId,
          customer_name: params.customerName,
          supplier_name: params.supplierName,
          customer_debt_before: params.customerDebtBefore,
          supplier_debt_before: params.supplierDebtBefore,
          offset_amount: params.offsetAmount,
          customer_debt_after: customerDebtAfter,
          supplier_debt_after: supplierDebtAfter,
          note: params.note || `Bù trừ công nợ 2 chiều: ${params.customerName} ↔ ${params.supplierName}`,
          created_by: user?.id,
        }]);
      if (offsetError) throw offsetError;

      // 2. Create customer debt payment (thu nợ khách)
      const { data: customerPayment, error: cpError } = await supabase
        .from('debt_payments')
        .insert([{
          entity_type: 'customer',
          entity_id: params.customerEntityId,
          payment_type: 'payment',
          amount: params.offsetAmount,
          payment_source: 'debt_offset',
          description: `Bù trừ công nợ với NCC ${params.supplierName}`,
          branch_id: params.customerBranchId,
          created_by: user?.id,
          tenant_id: tenantId,
        }])
        .select()
        .single();
      if (cpError) throw cpError;

      // 3. Create supplier debt payment (trả nợ NCC)
      const supplierEntityIds = (params.supplierMergedEntityIds && params.supplierMergedEntityIds.length > 0)
        ? params.supplierMergedEntityIds
        : [params.supplierEntityId];
      
      const { data: supplierPayment, error: spError } = await supabase
        .from('debt_payments')
        .insert([{
          entity_type: 'supplier',
          entity_id: params.supplierEntityId,
          payment_type: 'payment',
          amount: params.offsetAmount,
          payment_source: 'debt_offset',
          description: `Bù trừ công nợ với KH ${params.customerName}`,
          branch_id: params.supplierBranchId,
          created_by: user?.id,
          tenant_id: tenantId,
        }])
        .select()
        .single();
      if (spError) throw spError;

      // 4. FIFO allocation for customer side
      {
        let remaining = params.offsetAmount;
        const { data: receipts } = await supabase
          .from('export_receipts')
          .select('id, export_date, debt_amount, paid_amount')
          .eq('customer_id', params.customerEntityId)
          .eq('status', 'completed')
          .gt('debt_amount', 0)
          .order('export_date', { ascending: true });

        const { data: additions } = await supabase
          .from('debt_payments')
          .select('id, amount, allocated_amount, created_at')
          .eq('entity_type', 'customer')
          .eq('entity_id', params.customerEntityId)
          .eq('payment_type', 'addition')
          .order('created_at', { ascending: true });

        type Item = { kind: 'order'; id: string; date: number; unpaid: number; paidAmount: number }
          | { kind: 'addition'; id: string; date: number; unpaid: number; currentAllocated: number };
        const timeline: Item[] = [];

        if (receipts) {
          for (const r of receipts) {
            timeline.push({ kind: 'order', id: r.id, date: new Date(r.export_date).getTime(), unpaid: Number(r.debt_amount), paidAmount: Number(r.paid_amount) });
          }
        }
        if (additions) {
          for (const a of additions) {
            const allocated = Number(a.allocated_amount) || 0;
            const unpaid = Number(a.amount) - allocated;
            if (unpaid > 0) {
              timeline.push({ kind: 'addition', id: a.id, date: new Date(a.created_at).getTime(), unpaid, currentAllocated: allocated });
            }
          }
        }
        timeline.sort((a, b) => a.date - b.date);

        for (const item of timeline) {
          if (remaining <= 0) break;
          const pay = Math.min(remaining, item.unpaid);
          if (item.kind === 'order') {
            await supabase.from('export_receipts').update({ paid_amount: item.paidAmount + pay, debt_amount: item.unpaid - pay }).eq('id', item.id);
          } else {
            await supabase.from('debt_payments').update({ allocated_amount: item.currentAllocated + pay }).eq('id', item.id);
          }
          remaining -= pay;
        }
      }

      // 5. FIFO allocation for supplier side
      {
        let remaining = params.offsetAmount;
        const { data: receipts } = await supabase
          .from('import_receipts')
          .select('id, import_date, debt_amount, paid_amount')
          .in('supplier_id', supplierEntityIds)
          .eq('status', 'completed')
          .gt('debt_amount', 0)
          .order('import_date', { ascending: true });

        const { data: additions } = await supabase
          .from('debt_payments')
          .select('id, amount, allocated_amount, created_at')
          .eq('entity_type', 'supplier')
          .in('entity_id', supplierEntityIds)
          .eq('payment_type', 'addition')
          .order('created_at', { ascending: true });

        type Item = { kind: 'order'; id: string; date: number; unpaid: number; paidAmount: number }
          | { kind: 'addition'; id: string; date: number; unpaid: number; currentAllocated: number };
        const timeline: Item[] = [];

        if (receipts) {
          for (const r of receipts) {
            timeline.push({ kind: 'order', id: r.id, date: new Date(r.import_date).getTime(), unpaid: Number(r.debt_amount), paidAmount: Number(r.paid_amount) });
          }
        }
        if (additions) {
          for (const a of additions) {
            const allocated = Number(a.allocated_amount) || 0;
            const unpaid = Number(a.amount) - allocated;
            if (unpaid > 0) {
              timeline.push({ kind: 'addition', id: a.id, date: new Date(a.created_at).getTime(), unpaid, currentAllocated: allocated });
            }
          }
        }
        timeline.sort((a, b) => a.date - b.date);

        for (const item of timeline) {
          if (remaining <= 0) break;
          const pay = Math.min(remaining, item.unpaid);
          if (item.kind === 'order') {
            await supabase.from('import_receipts').update({ paid_amount: item.paidAmount + pay, debt_amount: item.unpaid - pay }).eq('id', item.id);
          } else {
            await supabase.from('debt_payments').update({ allocated_amount: item.currentAllocated + pay }).eq('id', item.id);
          }
          remaining -= pay;
        }
      }

      // 6. Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user?.id,
        action_type: 'debt_offset',
        table_name: 'debt_offsets',
        tenant_id: tenantId,
        description: `Bù trừ công nợ: KH ${params.customerName} (${params.customerDebtBefore.toLocaleString('vi-VN')}đ) ↔ NCC ${params.supplierName} (${params.supplierDebtBefore.toLocaleString('vi-VN')}đ) | Số tiền bù trừ: ${params.offsetAmount.toLocaleString('vi-VN')}đ`,
        new_data: {
          customer_entity_id: params.customerEntityId,
          supplier_entity_id: params.supplierEntityId,
          offset_amount: params.offsetAmount,
          customer_debt_after: customerDebtAfter,
          supplier_debt_after: supplierDebtAfter,
        },
      }]);

      return { customerDebtAfter, supplierDebtAfter };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-detail'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payment-history'] });
      queryClient.invalidateQueries({ queryKey: ['import-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

/**
 * Fetch offset history
 */
export function useDebtOffsetHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['debt-offsets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debt_offsets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}
