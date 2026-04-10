import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
import { getLocalDateString, getLocalDateRangeISO } from '@/lib/vietnamTime';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { doesReturnAffectRevenue } from '@/lib/reportReturnRules';
import type { SaleDetailItem, ReturnDetailItem, CashBookDetailItem } from '@/components/reports/ReportStatDetailDialog';

/**
 * Lazy-load detail data for report stat popups.
 * Only fetches when `enabled` is true (i.e., when user opens a detail popup).
 * This keeps the main report stats loading fast.
 */
export function useReportDetails(filters?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  categoryId?: string;
}, enabled = false) {
  const { data: tenant } = useCurrentTenant();
  const { branchId: userBranchId, shouldFilter } = useBranchFilter();
  const effectiveBranchId = filters?.branchId || (shouldFilter ? userBranchId : undefined);

  return useQuery({
    queryKey: ['report-details', 'return-rule-v3', tenant?.id, effectiveBranchId, filters],
    queryFn: async () => {
      const normalizeFeeType = (value: unknown) => String(value ?? '').trim().toLowerCase();
      const now = new Date();
      const startDate = filters?.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = filters?.endDate || getLocalDateString(now);
      const { startISO, endISO } = getLocalDateRangeISO(startDate, endDate);

      const buildSalesDetailQuery = () => {
        let q = supabase
          .from('export_receipt_items')
          .select(`
            product_name, sku, sale_price, quantity, status, product_id, category_id,
            categories(name),
            export_receipts!inner(id, export_date, branch_id, status, total_amount),
            products(import_price)
          `)
          .in('status', ['sold', 'returned'])
          .neq('export_receipts.status', 'cancelled')
          .gte('export_receipts.export_date', startISO)
          .lte('export_receipts.export_date', endISO)
          .order('created_at', { ascending: false });
        if (effectiveBranchId) q = q.eq('export_receipts.branch_id', effectiveBranchId);
        if (filters?.categoryId) q = q.eq('category_id', filters.categoryId);
        return q;
      };

      // Also fetch receipts to find ones without items (services, repairs, etc.)
      const buildReceiptsQuery = () => {
        let q = supabase
          .from('export_receipts')
          .select('id, code, total_amount, export_date, branch_id, is_repair')
          .neq('status', 'cancelled')
          .gte('export_date', startISO)
          .lte('export_date', endISO)
          .order('export_date', { ascending: false });
        if (effectiveBranchId) q = q.eq('branch_id', effectiveBranchId);
        return q;
      };

      const buildReturnDetailQuery = () => {
        let q = supabase
          .from('export_returns')
          .select('product_name, imei, import_price, sale_price, quantity, return_date, branch_id, refund_amount, fee_type, product_id, new_import_receipt_id, products(import_price)')
          .gte('return_date', startISO)
          .lte('return_date', endISO)
          .order('return_date', { ascending: false });
        if (effectiveBranchId) q = q.eq('branch_id', effectiveBranchId);
        return q;
      };

      const buildCashDetailQuery = () => {
        let q = supabase
          .from('cash_book')
          .select('transaction_date, description, category, amount, payment_source, type')
          .eq('is_business_accounting', true)
          .gte('transaction_date', startISO)
          .lte('transaction_date', endISO)
          .order('transaction_date', { ascending: false });
        if (effectiveBranchId) q = q.eq('branch_id', effectiveBranchId);
        return q;
      };

      const [salesRaw, returnsRaw, cashRaw] = await Promise.all([
        fetchAllRows<any>(() => buildSalesDetailQuery()),
        fetchAllRows<any>(() => buildReturnDetailQuery()),
        fetchAllRows<any>(() => buildCashDetailQuery()),
      ]);

      // Build sales details from items
      const salesDetails: SaleDetailItem[] = (salesRaw || []).map((item: any) => {
        const qty = Number(item.quantity ?? 1) || 1;
        const salePrice = Number(item.sale_price) * qty;
        const importPrice = Number(item.products?.import_price || 0) * qty;
        return {
          date: item.export_receipts?.export_date || '',
          productName: item.product_name || 'SP',
          sku: item.sku || '',
          salePrice,
          importPrice,
          profit: salePrice - importPrice,
          branchName: '',
          categoryName: item.categories?.name || 'Chưa phân loại',
        };
      });

      // Removed: phantom "Phí dịch vụ khác" generation - it caused inflated profit from receipts with missing items

      const returnDetails: ReturnDetailItem[] = (returnsRaw || [])
        .filter((item: any) => {
          const feeType = normalizeFeeType(item.fee_type);

          if (feeType && feeType !== 'none') {
            return false;
          }

          return doesReturnAffectRevenue({
            feeType: feeType || null,
            refundAmount: item.refund_amount,
            salePrice: item.sale_price,
            quantity: item.quantity,
            hasNewImportReceipt: !!item.new_import_receipt_id,
          });
        })
        .map((item: any) => {
          const qty = Number(item.quantity ?? 1) || 1;
          const refundAmount = Number(item.refund_amount || 0);
          const salePrice = refundAmount > 0 ? refundAmount : Number(item.sale_price) * qty;
          const importPrice = Number(item.products?.import_price || item.import_price || 0) * qty;
          return {
            date: item.return_date,
            productName: item.product_name || 'Sản phẩm',
            imei: item.imei || null,
            salePrice,
            importPrice,
            profit: salePrice - importPrice,
            branchName: '',
          };
        });

      const expenseDetails: CashBookDetailItem[] = [];
      const incomeDetails: CashBookDetailItem[] = [];
      (cashRaw || []).forEach((entry: any) => {
        const detail: CashBookDetailItem = {
          date: entry.transaction_date,
          description: entry.description,
          category: entry.category,
          amount: Number(entry.amount),
          paymentSource: entry.payment_source,
          branchName: '',
        };
        if (entry.type === 'expense') expenseDetails.push(detail);
        else if (entry.type === 'income') incomeDetails.push(detail);
      });

      return { salesDetails, returnDetails, expenseDetails, incomeDetails };
    },
    enabled: enabled && !!tenant?.id,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
  });
}
