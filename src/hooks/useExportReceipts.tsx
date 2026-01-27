import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';

// Helper to get current user's tenant_id
async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}
export interface ExportReceiptItem {
  id?: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  imei: string | null;
  category_id: string | null;
  sale_price: number;
  note?: string | null;
  quantity?: number; // For non-IMEI products
  warranty?: string | null; // Warranty info
  branch_id?: string | null; // Branch of product
}

export interface ExportPayment {
  payment_type: 'cash' | 'bank_card' | 'e_wallet' | 'debt';
  amount: number;
}

export interface ExportReceipt {
  id: string;
  code: string;
  export_date: string;
  customer_id: string | null;
  branch_id: string | null;
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
  points_earned: number;
  points_redeemed: number;
  points_discount: number;
  status: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  customers?: { name: string; phone: string; address: string | null } | null;
  branches?: { name: string } | null;
  export_receipt_items?: ExportReceiptItemDetail[];
  export_receipt_payments?: { payment_type: string; amount: number }[];
}

export interface ExportReceiptItemDetail {
  id: string;
  receipt_id: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  imei: string | null;
  category_id: string | null;
  sale_price: number;
  status: string;
  note: string | null;
  warranty: string | null;
  created_at: string;
  // Joined
  categories?: { name: string } | null;
  products?: { import_price: number } | null;
  export_receipts?: {
    code: string;
    export_date: string;
    branch_id: string | null;
    customer_id: string | null;
    customers?: { name: string; phone: string } | null;
    branches?: { name: string } | null;
  } | null;
}

export function useExportReceipts() {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;

  return useQuery({
    queryKey: ['export-receipts', isDataHidden],
    queryFn: async () => {
      // Chế độ test: trả về dữ liệu rỗng
      if (isDataHidden) return [] as ExportReceipt[];

      const { data, error } = await supabase
        .from('export_receipts')
        .select(`
          *,
          customers(name, phone, address),
          branches(name),
          export_receipt_items(*),
          export_receipt_payments(*)
        `)
        .order('export_date', { ascending: false });

      if (error) throw error;
      return data as ExportReceipt[];
    },
    enabled: !isTenantLoading,
    refetchOnWindowFocus: false,
  });
}

export function useExportReceiptItems() {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;

  return useQuery({
    queryKey: ['export-receipt-items', isDataHidden],
    queryFn: async () => {
      // Chế độ test: trả về dữ liệu rỗng
      if (isDataHidden) return [] as ExportReceiptItemDetail[];

      const { data, error } = await supabase
        .from('export_receipt_items')
        .select(`
          *,
          categories(name),
          products(import_price),
          export_receipts(
            code,
            export_date,
            branch_id,
            customer_id,
            customers(name, phone),
            branches(name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ExportReceiptItemDetail[];
    },
    enabled: !isTenantLoading,
    refetchOnWindowFocus: false,
  });
}

export function useCreateExportReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      items,
      payments,
      note,
      pointsRedeemed = 0,
      pointsDiscount = 0,
      branchId,
    }: {
      customerId: string;
      items: ExportReceiptItem[];
      payments: ExportPayment[];
      note?: string;
      pointsRedeemed?: number;
      pointsDiscount?: number;
      branchId?: string | null;
    }) => {
      // Calculate total amount considering quantity
      const totalAmount = items.reduce((sum, item) => sum + (item.sale_price * (item.quantity || 1)), 0);
      const paidAmount = payments
        .filter((p) => p.payment_type !== 'debt')
        .reduce((sum, p) => sum + p.amount, 0);
      const debtAmount = payments
        .filter((p) => p.payment_type === 'debt')
        .reduce((sum, p) => sum + p.amount, 0);

      // Generate receipt code
      const date = new Date();
      const code = `XH${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Get current tenant_id
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');
      // ============ POINT CALCULATION ============
      // Get point settings
      const { data: pointSettings } = await supabase
        .from('point_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      // Get customer info for tier multiplier
      const { data: customer } = await supabase
        .from('customers')
        .select('current_points, pending_points, total_points_earned, total_points_used, membership_tier, total_spent')
        .eq('id', customerId)
        .single();

      // Get tier multiplier
      let pointsMultiplier = 1;
      if (customer?.membership_tier) {
        const { data: tierSettings } = await supabase
          .from('membership_tier_settings')
          .select('points_multiplier')
          .eq('tier', customer.membership_tier)
          .maybeSingle();
        if (tierSettings) {
          pointsMultiplier = tierSettings.points_multiplier;
        }
      }

      // Calculate points to earn (based on actual payment, not total amount)
      let pointsToEarn = 0;
      if (pointSettings?.is_enabled) {
        // Points are calculated on actual payment amount (excluding points discount)
        const amountForPoints = totalAmount - pointsDiscount;
        const basePoints = Math.floor(amountForPoints / pointSettings.spend_amount) * pointSettings.earn_points;
        pointsToEarn = Math.floor(basePoints * pointsMultiplier);
      }

      // Determine if points are pending or active
      // If customer still has debt, points are pending
      const pointsArePending = pointSettings?.require_full_payment && debtAmount > 0;

      // Get branch_id from first item if not provided
      const effectiveBranchId = branchId || items.find(i => i.branch_id)?.branch_id || null;

      // Create receipt
      const { data: receipt, error: receiptError } = await supabase
        .from('export_receipts')
        .insert([
          {
            code,
            customer_id: customerId,
            branch_id: effectiveBranchId,
            total_amount: totalAmount,
            paid_amount: paidAmount,
            debt_amount: debtAmount,
            points_earned: pointsToEarn,
            points_redeemed: pointsRedeemed,
            points_discount: pointsDiscount,
            note,
            created_by: user?.id,
            tenant_id: tenantId,
          },
        ])
        .select()
        .single();

      if (receiptError) throw receiptError;

      // Insert items - expand quantity for non-IMEI products
      const expandedItems: Array<{
        receipt_id: string;
        product_id: string | null;
        product_name: string;
        sku: string;
        imei: string | null;
        category_id: string | null;
        sale_price: number;
        note: string | null | undefined;
        warranty: string | null | undefined;
      }> = [];
      
      for (const item of items) {
        const qty = item.quantity || 1;
        for (let i = 0; i < qty; i++) {
          expandedItems.push({
            receipt_id: receipt.id,
            product_id: item.product_id,
            product_name: item.product_name,
            sku: item.sku,
            imei: item.imei,
            category_id: item.category_id,
            sale_price: item.sale_price,
            note: item.note,
            warranty: item.warranty,
          });
        }
      }

      const { error: itemsError } = await supabase
        .from('export_receipt_items')
        .insert(expandedItems);

      if (itemsError) throw itemsError;

      // Insert payments
      const paymentsToInsert = payments
        .filter((p) => p.amount > 0)
        .map((p) => ({
          receipt_id: receipt.id,
          payment_type: p.payment_type,
          amount: p.amount,
        }));

      if (paymentsToInsert.length > 0) {
        const { error: paymentsError } = await supabase
          .from('export_receipt_payments')
          .insert(paymentsToInsert);

        if (paymentsError) throw paymentsError;
      }

      // Update product status/quantity for items with product_id
      for (const item of items) {
        if (item.product_id) {
          const qty = item.quantity || 1;
          
          // Lấy thông tin sản phẩm
          const { data: product } = await supabase
            .from('products')
            .select('imei, quantity')
            .eq('id', item.product_id)
            .single();

          if (product?.imei) {
            // SẢN PHẨM CÓ IMEI: Đánh dấu là đã bán
            await supabase
              .from('products')
              .update({ status: 'sold' })
              .eq('id', item.product_id);

            // Record IMEI history
            await supabase.from('imei_histories').insert([
              {
                product_id: item.product_id,
                imei: item.imei,
                action_type: 'export',
                reference_id: receipt.id,
                reference_type: 'export_receipt',
                price: item.sale_price,
                customer_id: customerId,
                created_by: user?.id,
              },
            ]);
          } else {
            // SẢN PHẨM KHÔNG IMEI: Giảm số lượng theo quantity đã bán
            const newQuantity = (product?.quantity || qty) - qty;
            
            if (newQuantity <= 0) {
              // Hết hàng -> đánh dấu sold
              await supabase
                .from('products')
                .update({ status: 'sold', quantity: 0 })
                .eq('id', item.product_id);
            } else {
              // Còn hàng -> giảm quantity
              await supabase
                .from('products')
                .update({ quantity: newQuantity })
                .eq('id', item.product_id);
            }
          }
        }
      }

      // Create cash book entries for actual payments (not debt)
      const cashBookEntries = payments
        .filter((p) => p.payment_type !== 'debt' && p.amount > 0)
        .map((p) => ({
          type: 'income' as const,
          category: 'Bán hàng',
          description: `Thu tiền phiếu xuất ${code}`,
          amount: p.amount,
          payment_source: p.payment_type,
          is_business_accounting: false, // Không tính hạch toán - lợi nhuận đã tính từ giá bán - giá nhập
          reference_id: receipt.id,
          reference_type: 'export_receipt',
          created_by: user?.id,
          tenant_id: tenantId,
        }));

      if (cashBookEntries.length > 0) {
        const { error: cashBookError } = await supabase
          .from('cash_book')
          .insert(cashBookEntries);

        if (cashBookError) throw cashBookError;
      }

      // ============ HANDLE POINTS ============
      if (pointSettings?.is_enabled && customer) {
        // 1. Handle points earned
        if (pointsToEarn > 0) {
          const newBalance = pointsArePending 
            ? customer.current_points 
            : customer.current_points + pointsToEarn;
          
          const newPending = pointsArePending 
            ? (customer.pending_points || 0) + pointsToEarn 
            : customer.pending_points || 0;

          // Create point transaction
          await supabase.from('point_transactions').insert([{
            customer_id: customerId,
            transaction_type: 'earn',
            points: pointsToEarn,
            balance_after: pointsArePending ? customer.current_points : newBalance,
            status: pointsArePending ? 'pending' : 'active',
            reference_type: 'export_receipt',
            reference_id: receipt.id,
            description: `Tích điểm từ đơn hàng ${code}`,
            note: pointsArePending ? 'Điểm treo - chờ thanh toán đủ' : null,
            created_by: user?.id,
          }]);

          // Update customer points
          await supabase.from('customers').update({
            current_points: pointsArePending ? customer.current_points : newBalance,
            pending_points: newPending,
            total_points_earned: customer.total_points_earned + pointsToEarn,
            total_spent: customer.total_spent + totalAmount,
            last_purchase_date: new Date().toISOString(),
          }).eq('id', customerId);
        } else {
          // No points earned, just update total_spent and last_purchase_date
          await supabase.from('customers').update({
            total_spent: customer.total_spent + totalAmount,
            last_purchase_date: new Date().toISOString(),
          }).eq('id', customerId);
        }

        // 2. Handle points redeemed
        if (pointsRedeemed > 0) {
          const newBalance = customer.current_points - pointsRedeemed + (pointsArePending ? 0 : pointsToEarn);

          // Create point transaction for redemption
          await supabase.from('point_transactions').insert([{
            customer_id: customerId,
            transaction_type: 'redeem',
            points: -pointsRedeemed,
            balance_after: newBalance,
            status: 'active',
            reference_type: 'export_receipt',
            reference_id: receipt.id,
            description: `Đổi điểm cho đơn hàng ${code}`,
            note: `Giảm giá ${pointsDiscount.toLocaleString('vi-VN')}đ`,
            created_by: user?.id,
          }]);

          // Update customer used points
          await supabase.from('customers').update({
            current_points: newBalance,
            total_points_used: customer.total_points_used + pointsRedeemed,
          }).eq('id', customerId);
        }
      }

      // Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user?.id,
        action_type: 'create',
        table_name: 'export_receipts',
        record_id: receipt.id,
        new_data: {
          code: receipt.code,
          customer_id: customerId,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          debt_amount: debtAmount,
          items_count: items.length,
          points_earned: pointsToEarn,
          points_redeemed: pointsRedeemed,
        },
        description: `Tạo phiếu xuất ${code} - ${items.length} sản phẩm - Tổng: ${totalAmount.toLocaleString('vi-VN')}đ`,
      }]);

      return { ...receipt, points_earned: pointsToEarn, points_pending: pointsArePending };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipt-items'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers-with-points'] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail'] });
      queryClient.invalidateQueries({ queryKey: ['point-transactions'] });
    },
  });
}

export function useReturnProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      receiptId,
      productId,
      imei,
    }: {
      itemId: string;
      receiptId: string;
      productId: string | null;
      imei: string | null;
    }) => {
      // Update item status
      const { error: itemError } = await supabase
        .from('export_receipt_items')
        .update({ status: 'returned' })
        .eq('id', itemId);

      if (itemError) throw itemError;

      // Update product status back to in_stock
      if (productId) {
        await supabase
          .from('products')
          .update({ status: 'in_stock' })
          .eq('id', productId);

        // Record IMEI history
        if (imei) {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('imei_histories').insert([
            {
              product_id: productId,
              imei: imei,
              action_type: 'return',
              reference_id: receiptId,
              reference_type: 'export_receipt',
              created_by: user?.id,
            },
          ]);
        }
      }

      // Check if all items are returned
      const { data: remainingItems } = await supabase
        .from('export_receipt_items')
        .select('id, status')
        .eq('receipt_id', receiptId);

      const allReturned = remainingItems?.every((i) => i.status === 'returned');
      const someReturned = remainingItems?.some((i) => i.status === 'returned');

      // Update receipt status
      let newStatus = 'completed';
      if (allReturned) {
        newStatus = 'full_return';
      } else if (someReturned) {
        newStatus = 'partial_return';
      }

      await supabase
        .from('export_receipts')
        .update({ status: newStatus })
        .eq('id', receiptId);

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipt-items'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useCheckProductForSale() {
  return useMutation({
    mutationFn: async (imei: string) => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          imei,
          import_price,
          status,
          category_id,
          branch_id,
          categories(name),
          branches(name)
        `)
        .eq('imei', imei)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

export function useSearchProductsByName() {
  return useMutation({
    mutationFn: async (searchTerm: string) => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          imei,
          import_price,
          status,
          category_id,
          branch_id,
          categories(name),
          branches(name)
        `)
        .eq('status', 'in_stock')
        .ilike('name', `%${searchTerm}%`)
        .limit(10);

      if (error) throw error;
      return data;
    },
  });
}
