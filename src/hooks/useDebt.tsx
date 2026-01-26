import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from './usePermissions';

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
}

export interface DebtPayment {
  id: string;
  entity_type: 'customer' | 'supplier';
  entity_id: string;
  payment_type: 'payment' | 'addition';
  amount: number;
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
  const { data: permissions } = usePermissions();

  return useQuery({
    queryKey: ['customer-debts', showSettled, permissions?.branchId, permissions?.role],
    queryFn: async () => {
      // Get all export receipts with debt
      let query = supabase
        .from('export_receipts')
        .select(`
          id,
          customer_id,
          total_amount,
          paid_amount,
          debt_amount,
          export_date,
          branch_id,
          customers(id, name, phone),
          branches(name)
        `)
        .gt('debt_amount', 0)
        .eq('status', 'completed');

      // Filter by branch if not super_admin
      if (permissions?.role !== 'super_admin' && permissions?.branchId) {
        query = query.eq('branch_id', permissions.branchId);
      }

      const { data: receipts, error: receiptsError } = await query;
      if (receiptsError) throw receiptsError;

      // Get debt payments for customers
      const { data: payments, error: paymentsError } = await supabase
        .from('debt_payments')
        .select('*')
        .eq('entity_type', 'customer');
      if (paymentsError) throw paymentsError;

      // Group by customer
      const customerMap = new Map<string, DebtSummary>();

      receipts?.forEach(receipt => {
        if (!receipt.customer_id || !receipt.customers) return;
        
        const customer = receipt.customers as { id: string; name: string; phone: string | null };
        const existing = customerMap.get(customer.id);
        
        if (existing) {
          existing.total_amount += Number(receipt.debt_amount);
          if (!existing.first_debt_date || receipt.export_date < existing.first_debt_date) {
            existing.first_debt_date = receipt.export_date;
          }
        } else {
          customerMap.set(customer.id, {
            entity_id: customer.id,
            entity_name: customer.name,
            entity_phone: customer.phone,
            branch_id: receipt.branch_id,
            branch_name: (receipt.branches as { name: string } | null)?.name || null,
            total_amount: Number(receipt.debt_amount),
            paid_amount: 0,
            remaining_amount: 0,
            first_debt_date: receipt.export_date,
            days_overdue: 0,
          });
        }
      });

      // Add payments and additions
      payments?.forEach(payment => {
        const existing = customerMap.get(payment.entity_id);
        if (existing) {
          if (payment.payment_type === 'payment') {
            existing.paid_amount += Number(payment.amount);
          } else if (payment.payment_type === 'addition') {
            existing.total_amount += Number(payment.amount);
          }
        }
      });

      // Calculate remaining and days overdue
      const now = new Date();
      const result: DebtSummary[] = [];
      
      customerMap.forEach(summary => {
        summary.remaining_amount = summary.total_amount - summary.paid_amount;
        if (summary.first_debt_date) {
          const firstDate = new Date(summary.first_debt_date);
          summary.days_overdue = Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
        }
        
        // Filter based on showSettled
        if (showSettled || summary.remaining_amount > 0) {
          result.push(summary);
        }
      });

      return result.sort((a, b) => b.remaining_amount - a.remaining_amount);
    },
    enabled: !!permissions,
  });
}

// Hook to get supplier debt summary
export function useSupplierDebts(showSettled: boolean = false) {
  const { data: permissions } = usePermissions();

  return useQuery({
    queryKey: ['supplier-debts', showSettled, permissions?.branchId, permissions?.role],
    queryFn: async () => {
      // Get all import receipts with debt
      let query = supabase
        .from('import_receipts')
        .select(`
          id,
          supplier_id,
          total_amount,
          paid_amount,
          debt_amount,
          import_date,
          branch_id,
          suppliers(id, name, phone),
          branches(name)
        `)
        .gt('debt_amount', 0)
        .eq('status', 'completed');

      // Filter by branch if not super_admin
      if (permissions?.role !== 'super_admin' && permissions?.branchId) {
        query = query.eq('branch_id', permissions.branchId);
      }

      const { data: receipts, error: receiptsError } = await query;
      if (receiptsError) throw receiptsError;

      // Get debt payments for suppliers
      const { data: payments, error: paymentsError } = await supabase
        .from('debt_payments')
        .select('*')
        .eq('entity_type', 'supplier');
      if (paymentsError) throw paymentsError;

      // Group by supplier
      const supplierMap = new Map<string, DebtSummary>();

      receipts?.forEach(receipt => {
        if (!receipt.supplier_id || !receipt.suppliers) return;
        
        const supplier = receipt.suppliers as { id: string; name: string; phone: string | null };
        const existing = supplierMap.get(supplier.id);
        
        if (existing) {
          existing.total_amount += Number(receipt.debt_amount);
          if (!existing.first_debt_date || receipt.import_date < existing.first_debt_date) {
            existing.first_debt_date = receipt.import_date;
          }
        } else {
          supplierMap.set(supplier.id, {
            entity_id: supplier.id,
            entity_name: supplier.name,
            entity_phone: supplier.phone,
            branch_id: receipt.branch_id,
            branch_name: (receipt.branches as { name: string } | null)?.name || null,
            total_amount: Number(receipt.debt_amount),
            paid_amount: 0,
            remaining_amount: 0,
            first_debt_date: receipt.import_date,
            days_overdue: 0,
          });
        }
      });

      // Add payments and additions
      payments?.forEach(payment => {
        const existing = supplierMap.get(payment.entity_id);
        if (existing) {
          if (payment.payment_type === 'payment') {
            existing.paid_amount += Number(payment.amount);
          } else if (payment.payment_type === 'addition') {
            existing.total_amount += Number(payment.amount);
          }
        }
      });

      // Calculate remaining and days overdue
      const now = new Date();
      const result: DebtSummary[] = [];
      
      supplierMap.forEach(summary => {
        summary.remaining_amount = summary.total_amount - summary.paid_amount;
        if (summary.first_debt_date) {
          const firstDate = new Date(summary.first_debt_date);
          summary.days_overdue = Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
        }
        
        // Filter based on showSettled
        if (showSettled || summary.remaining_amount > 0) {
          result.push(summary);
        }
      });

      return result.sort((a, b) => b.remaining_amount - a.remaining_amount);
    },
    enabled: !!permissions,
  });
}

// Hook to get debt detail for an entity
export function useDebtDetail(entityType: 'customer' | 'supplier', entityId: string) {
  return useQuery({
    queryKey: ['debt-detail', entityType, entityId],
    queryFn: async () => {
      if (entityType === 'customer') {
        // Get export receipts with debt
        const { data: receipts, error } = await supabase
          .from('export_receipts')
          .select(`
            id,
            code,
            export_date,
            total_amount,
            paid_amount,
            debt_amount,
            note,
            export_receipt_items(
              id,
              product_name,
              sku,
              imei,
              sale_price,
              note,
              status
            )
          `)
          .eq('customer_id', entityId)
          .gt('debt_amount', 0)
          .order('export_date', { ascending: false });

        if (error) throw error;
        return receipts;
      } else {
        // Get import receipts with debt
        const { data: receipts, error } = await supabase
          .from('import_receipts')
          .select(`
            id,
            code,
            import_date,
            total_amount,
            paid_amount,
            debt_amount,
            note,
            products(
              id,
              name,
              sku,
              imei,
              import_price,
              note,
              status
            )
          `)
          .eq('supplier_id', entityId)
          .gt('debt_amount', 0)
          .order('import_date', { ascending: false });

        if (error) throw error;
        return receipts;
      }
    },
    enabled: !!entityId,
  });
}

// Hook to get payment history for an entity
export function useDebtPaymentHistory(entityType: 'customer' | 'supplier', entityId: string) {
  return useQuery({
    queryKey: ['debt-payment-history', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debt_payments')
        .select(`
          *,
          branches(name)
        `)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get profile names for created_by
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

// Hook to create debt payment
export function useCreateDebtPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: {
      entity_type: 'customer' | 'supplier';
      entity_id: string;
      payment_type: 'payment' | 'addition';
      amount: number;
      payment_source?: string;
      description: string;
      branch_id?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Insert debt payment
      const { data, error } = await supabase
        .from('debt_payments')
        .insert([{
          ...payment,
          created_by: user?.id,
        }])
        .select()
        .single();

      if (error) throw error;

      // If it's a payment (not addition), also create cash book entry
      if (payment.payment_type === 'payment' && payment.payment_source) {
        const cashBookType = payment.entity_type === 'customer' ? 'income' as const : 'expense' as const;
        
        await supabase.from('cash_book').insert([{
          type: cashBookType,
          category: payment.entity_type === 'customer' ? 'Thu nợ khách hàng' : 'Trả nợ nhà cung cấp',
          description: payment.description,
          amount: payment.amount,
          payment_source: payment.payment_source,
          is_business_accounting: true,
          branch_id: payment.branch_id || null,
          reference_id: data.id,
          reference_type: 'debt_payment',
          created_by: user?.id,
        }]);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payment-history', variables.entity_type, variables.entity_id] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
    },
  });
}
