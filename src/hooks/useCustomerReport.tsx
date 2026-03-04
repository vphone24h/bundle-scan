import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
import { fetchAllRows } from '@/lib/fetchAllRows';

export interface CustomerReportItem {
  customerId: string;
  customerName: string;
  phone: string;
  totalSpent: number;
  orderCount: number;
  debtAmount: number;
  lastPurchaseDate: string | null;
  membershipTier: string;
  currentPoints: number;
}

export function useCustomerReport(filters?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  sort?: 'top_spent' | 'top_orders' | 'top_debt' | 'newest';
}) {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;
  const { branchId: userBranchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();
  const effectiveBranchId = filters?.branchId || (shouldFilter ? userBranchId : undefined);

  return useQuery({
    queryKey: ['customer-report', tenant?.id, effectiveBranchId, filters, isDataHidden],
    queryFn: async () => {
      if (isDataHidden) return { items: [] as CustomerReportItem[], summary: { totalCustomers: 0, totalRevenue: 0, totalDebt: 0, newCustomers: 0 } };

      const now = new Date();
      const startDate = filters?.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = filters?.endDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const startISO = new Date(startDate + 'T00:00:00').toISOString();
      const endISO = new Date(endDate + 'T23:59:59.999').toISOString();

      // Get export receipts with customer info in date range
      let query = supabase
        .from('export_receipts')
        .select('id, customer_id, total_amount, debt_amount, export_date, branch_id, status, customers(id, name, phone, total_spent, membership_tier, current_points, last_purchase_date, created_at)')
        .neq('status', 'cancelled')
        .gte('export_date', startISO)
        .lte('export_date', endISO);

      if (effectiveBranchId) {
        query = query.eq('branch_id', effectiveBranchId);
      }

      const { data: receipts, error } = await query;
      if (error) throw error;

      // Aggregate by customer
      const customerMap: Record<string, CustomerReportItem> = {};
      let walkInTotal = 0;
      let walkInOrders = 0;

      receipts?.forEach(r => {
        const customer = r.customers as any;
        if (!customer) {
          walkInTotal += Number(r.total_amount);
          walkInOrders++;
          return;
        }

        const id = customer.id;
        if (!customerMap[id]) {
          customerMap[id] = {
            customerId: id,
            customerName: customer.name,
            phone: customer.phone || '',
            totalSpent: 0,
            orderCount: 0,
            debtAmount: 0,
            lastPurchaseDate: customer.last_purchase_date,
            membershipTier: customer.membership_tier || 'standard',
            currentPoints: customer.current_points || 0,
          };
        }
        customerMap[id].totalSpent += Number(r.total_amount);
        customerMap[id].orderCount += 1;
        customerMap[id].debtAmount += Number(r.debt_amount || 0);
      });

      // Add walk-in customer
      if (walkInOrders > 0) {
        customerMap['walk-in'] = {
          customerId: 'walk-in',
          customerName: 'Khách lẻ',
          phone: '',
          totalSpent: walkInTotal,
          orderCount: walkInOrders,
          debtAmount: 0,
          lastPurchaseDate: null,
          membershipTier: 'standard',
          currentPoints: 0,
        };
      }

      let items = Object.values(customerMap);

      // Sort
      switch (filters?.sort) {
        case 'top_orders': items.sort((a, b) => b.orderCount - a.orderCount); break;
        case 'top_debt': items.sort((a, b) => b.debtAmount - a.debtAmount); break;
        case 'newest': items.sort((a, b) => {
          if (!a.lastPurchaseDate) return 1;
          if (!b.lastPurchaseDate) return -1;
          return new Date(b.lastPurchaseDate).getTime() - new Date(a.lastPurchaseDate).getTime();
        }); break;
        case 'top_spent':
        default: items.sort((a, b) => b.totalSpent - a.totalSpent); break;
      }

      const summary = {
        totalCustomers: items.filter(i => i.customerId !== 'walk-in').length,
        totalRevenue: items.reduce((s, i) => s + i.totalSpent, 0),
        totalDebt: items.reduce((s, i) => s + i.debtAmount, 0),
        newCustomers: receipts?.filter(r => {
          const c = r.customers as any;
          if (!c) return false;
          return new Date(c.created_at) >= new Date(startISO) && new Date(c.created_at) <= new Date(endISO);
        }).length || 0,
      };

      return { items, summary };
    },
    enabled: !isTenantLoading && !branchLoading && !!tenant?.id,
    refetchOnWindowFocus: false,
  });
}
