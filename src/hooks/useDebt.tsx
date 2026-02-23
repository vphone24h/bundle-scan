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
  const { user } = useAuth();
  const { data: permissions } = usePermissions();

  return useQuery({
    // Keyed by user to prevent cross-tenant cache leakage
    queryKey: ['customer-debts', user?.id, showSettled, permissions?.branchId, permissions?.role],
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
      let paymentsQuery = supabase
        .from('debt_payments')
        .select('*')
        .eq('entity_type', 'customer');

      // Filter by branch if not super_admin
      if (permissions?.role !== 'super_admin' && permissions?.branchId) {
        paymentsQuery = paymentsQuery.eq('branch_id', permissions.branchId);
      }

      const { data: payments, error: paymentsError } = await paymentsQuery;
      if (paymentsError) throw paymentsError;

      // Get unique customer IDs from payments that might not be in receipts
      const paymentCustomerIds = [...new Set(payments?.map(p => p.entity_id) || [])];
      
      // Fetch customer details for these IDs
      let customersFromPayments: { id: string; name: string; phone: string }[] = [];
      if (paymentCustomerIds.length > 0) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('id, name, phone')
          .in('id', paymentCustomerIds);
        customersFromPayments = customerData || [];
      }

      // Build branch name lookup from debt_payments branch_id
      const paymentBranchIds = [...new Set(payments?.map(p => p.branch_id).filter(Boolean) || [])];
      let branchNameMap = new Map<string, string>();
      if (paymentBranchIds.length > 0) {
        const { data: branchData } = await supabase
          .from('branches')
          .select('id, name')
          .in('id', paymentBranchIds);
        branchData?.forEach(b => branchNameMap.set(b.id, b.name));
      }

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

      // First pass: process additions to ensure all customers are in the map
      payments?.forEach(payment => {
        if (payment.payment_type !== 'addition') return;
        const existing = customerMap.get(payment.entity_id);
        if (existing) {
          existing.total_amount += Number(payment.amount);
        } else {
          const customer = customersFromPayments.find(c => c.id === payment.entity_id);
          if (customer) {
            customerMap.set(payment.entity_id, {
              entity_id: payment.entity_id,
              entity_name: customer.name,
              entity_phone: customer.phone,
              branch_id: payment.branch_id,
              branch_name: payment.branch_id ? branchNameMap.get(payment.branch_id) || null : null,
              total_amount: Number(payment.amount),
              paid_amount: 0,
              remaining_amount: 0,
              first_debt_date: payment.created_at,
              days_overdue: 0,
            });
          }
        }
      });

      // Second pass: process payments
      payments?.forEach(payment => {
        if (payment.payment_type !== 'payment') return;
        const existing = customerMap.get(payment.entity_id);
        if (existing) {
          existing.paid_amount += Number(payment.amount);
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
  const { user } = useAuth();
  const { data: permissions } = usePermissions();

  return useQuery({
    // Keyed by user to prevent cross-tenant cache leakage
    queryKey: ['supplier-debts', user?.id, showSettled, permissions?.branchId, permissions?.role],
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
      let paymentsQuery = supabase
        .from('debt_payments')
        .select('*')
        .eq('entity_type', 'supplier');

      // Filter by branch if not super_admin
      if (permissions?.role !== 'super_admin' && permissions?.branchId) {
        paymentsQuery = paymentsQuery.eq('branch_id', permissions.branchId);
      }

      const { data: payments, error: paymentsError } = await paymentsQuery;
      if (paymentsError) throw paymentsError;

      // Get unique supplier IDs from payments that might not be in receipts
      const paymentSupplierIds = [...new Set(payments?.map(p => p.entity_id) || [])];
      
      // Fetch supplier details for these IDs
      let suppliersFromPayments: { id: string; name: string; phone: string | null }[] = [];
      if (paymentSupplierIds.length > 0) {
        const { data: supplierData } = await supabase
          .from('suppliers')
          .select('id, name, phone')
          .in('id', paymentSupplierIds);
        suppliersFromPayments = supplierData || [];
      }

      // Build branch name lookup from debt_payments branch_id
      const paymentBranchIds = [...new Set(payments?.map(p => p.branch_id).filter(Boolean) || [])];
      let branchNameMap = new Map<string, string>();
      if (paymentBranchIds.length > 0) {
        const { data: branchData } = await supabase
          .from('branches')
          .select('id, name')
          .in('id', paymentBranchIds);
        branchData?.forEach(b => branchNameMap.set(b.id, b.name));
      }

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

      // First pass: process additions to ensure all suppliers are in the map
      payments?.forEach(payment => {
        if (payment.payment_type !== 'addition') return;
        const existing = supplierMap.get(payment.entity_id);
        if (existing) {
          existing.total_amount += Number(payment.amount);
        } else {
          const supplier = suppliersFromPayments.find(s => s.id === payment.entity_id);
          if (supplier) {
            supplierMap.set(payment.entity_id, {
              entity_id: payment.entity_id,
              entity_name: supplier.name,
              entity_phone: supplier.phone,
              branch_id: payment.branch_id,
              branch_name: payment.branch_id ? branchNameMap.get(payment.branch_id) || null : null,
              total_amount: Number(payment.amount),
              paid_amount: 0,
              remaining_amount: 0,
              first_debt_date: payment.created_at,
              days_overdue: 0,
            });
          }
        }
      });

      // Second pass: process payments
      payments?.forEach(payment => {
        if (payment.payment_type !== 'payment') return;
        const existing = supplierMap.get(payment.entity_id);
        if (existing) {
          existing.paid_amount += Number(payment.amount);
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

      // FIFO allocation: Apply payment to oldest unpaid receipts first
      if (payment.payment_type === 'payment') {
        let remainingPayment = payment.amount;
        
        if (payment.entity_type === 'customer') {
          // Get unpaid export receipts for this customer, ordered by date (oldest first)
          const { data: receipts } = await supabase
            .from('export_receipts')
            .select('id, code, debt_amount, paid_amount, total_amount')
            .eq('customer_id', payment.entity_id)
            .eq('status', 'completed')
            .gt('debt_amount', 0)
            .order('export_date', { ascending: true });
          
          if (receipts) {
            for (const receipt of receipts) {
              if (remainingPayment <= 0) break;
              
              const debtAmount = Number(receipt.debt_amount);
              const payForThisReceipt = Math.min(remainingPayment, debtAmount);
              
              const newPaidAmount = Number(receipt.paid_amount) + payForThisReceipt;
              const newDebtAmount = debtAmount - payForThisReceipt;
              
              // Update receipt with new paid/debt amounts
              await supabase
                .from('export_receipts')
                .update({
                  paid_amount: newPaidAmount,
                  debt_amount: newDebtAmount,
                })
                .eq('id', receipt.id);
              
              remainingPayment -= payForThisReceipt;
            }
          }
        } else {
          // Get unpaid import receipts for this supplier, ordered by date (oldest first)
          const { data: receipts } = await supabase
            .from('import_receipts')
            .select('id, code, debt_amount, paid_amount, total_amount')
            .eq('supplier_id', payment.entity_id)
            .eq('status', 'completed')
            .gt('debt_amount', 0)
            .order('import_date', { ascending: true });
          
          if (receipts) {
            for (const receipt of receipts) {
              if (remainingPayment <= 0) break;
              
              const debtAmount = Number(receipt.debt_amount);
              const payForThisReceipt = Math.min(remainingPayment, debtAmount);
              
              const newPaidAmount = Number(receipt.paid_amount) + payForThisReceipt;
              const newDebtAmount = debtAmount - payForThisReceipt;
              
              // Update receipt with new paid/debt amounts
              await supabase
                .from('import_receipts')
                .update({
                  paid_amount: newPaidAmount,
                  debt_amount: newDebtAmount,
                })
                .eq('id', receipt.id);
              
              remainingPayment -= payForThisReceipt;
            }
          }
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
