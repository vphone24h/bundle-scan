import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBranchFilter } from './useBranchFilter';
import { useCurrentTenant } from './useTenant';

// Types
export interface ImportReturn {
  id: string;
  code: string;
  return_date: string;
  product_id: string;
  import_receipt_id: string | null;
  supplier_id: string | null;
  branch_id: string | null;
  product_name: string;
  sku: string;
  imei: string | null;
  import_price: number;
  original_import_date: string | null;
  total_refund_amount: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  suppliers?: { name: string } | null;
  branches?: { name: string } | null;
  import_receipts?: { code: string } | null;
  profiles?: { display_name: string } | null;
}

export interface ExportReturn {
  id: string;
  code: string;
  return_date: string;
  product_id: string;
  export_receipt_id: string | null;
  export_receipt_item_id: string | null;
  customer_id: string | null;
  branch_id: string | null;
  product_name: string;
  sku: string;
  imei: string | null;
  import_price: number;
  sale_price: number;
  original_sale_date: string | null;
  fee_type: 'none' | 'percentage' | 'fixed_amount';
  fee_percentage: number;
  fee_amount: number;
  refund_amount: number;
  store_keep_amount: number;
  new_import_receipt_id: string | null;
  is_business_accounting: boolean;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customers?: { name: string; phone: string } | null;
  branches?: { name: string } | null;
  export_receipts?: { code: string } | null;
  profiles?: { display_name: string } | null;
}

export interface ReturnPayment {
  id: string;
  return_id: string;
  return_type: 'import_return' | 'export_return';
  payment_source: string;
  amount: number;
  created_at: string;
}

export function useImportReturns(filters?: {
  startDate?: string;
  endDate?: string;
  supplierId?: string;
  branchId?: string;
  createdBy?: string;
}) {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const { branchId: userBranchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  return useQuery({
    // Keyed by tenant AND branch to prevent cross-tenant/branch cache leakage
    queryKey: ['import-returns', tenant?.id, userBranchId, filters],
    queryFn: async () => {
      let query = supabase
        .from('import_returns')
        .select(`
          *,
          suppliers(name),
          branches(name),
          import_receipts(code)
        `)
        .order('return_date', { ascending: false });

      if (filters?.startDate) {
        query = query.gte('return_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('return_date', filters.endDate + 'T23:59:59');
      }
      if (filters?.supplierId) {
        query = query.eq('supplier_id', filters.supplierId);
      }
      if (filters?.createdBy) {
        query = query.eq('created_by', filters.createdBy);
      }

      // Priority: UI filter > user's assigned branch filter
      if (filters?.branchId) {
        // If user is trying to filter a branch they don't have access to, return empty
        if (shouldFilter && userBranchId && filters.branchId !== userBranchId) {
          return [] as ImportReturn[];
        }
        query = query.eq('branch_id', filters.branchId);
      } else if (shouldFilter && userBranchId) {
        // Apply user's branch filter
        query = query.eq('branch_id', userBranchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ImportReturn[];
    },
    enabled: !isTenantLoading && !branchLoading,
  });
}

export function useExportReturns(filters?: {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  branchId?: string;
  feeType?: 'none' | 'percentage' | 'fixed_amount';
  createdBy?: string;
}) {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const { branchId: userBranchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  return useQuery({
    // Keyed by tenant AND branch to prevent cross-tenant/branch cache leakage
    queryKey: ['export-returns', tenant?.id, userBranchId, filters],
    queryFn: async () => {
      let query = supabase
        .from('export_returns')
        .select(`
          *,
          customers(name, phone),
          branches(name),
          export_receipts!export_returns_export_receipt_id_fkey(code)
        `)
        .order('return_date', { ascending: false });

      if (filters?.startDate) {
        query = query.gte('return_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('return_date', filters.endDate + 'T23:59:59');
      }
      if (filters?.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }
      if (filters?.feeType) {
        query = query.eq('fee_type', filters.feeType);
      }
      if (filters?.createdBy) {
        query = query.eq('created_by', filters.createdBy);
      }

      // Priority: UI filter > user's assigned branch filter
      if (filters?.branchId) {
        // If user is trying to filter a branch they don't have access to, return empty
        if (shouldFilter && userBranchId && filters.branchId !== userBranchId) {
          return [] as ExportReturn[];
        }
        query = query.eq('branch_id', filters.branchId);
      } else if (shouldFilter && userBranchId) {
        // Apply user's branch filter
        query = query.eq('branch_id', userBranchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ExportReturn[];
    },
    enabled: !isTenantLoading && !branchLoading,
  });
}

// Hook to get all profiles (for employee filter)
export function useAllProfiles() {
  const { user } = useAuth();
  return useQuery({
    // Keyed by user to prevent cross-tenant cache leakage
    queryKey: ['all-profiles', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('display_name');

      if (error) throw error;
      return data as { user_id: string; display_name: string }[];
    },
    enabled: !!user?.id,
  });
}

export function useReturnPayments(returnId: string | null, returnType: 'import_return' | 'export_return') {
  return useQuery({
    queryKey: ['return-payments', returnId, returnType],
    queryFn: async () => {
      if (!returnId) return [];
      
      const { data, error } = await supabase
        .from('return_payments')
        .select('*')
        .eq('return_id', returnId)
        .eq('return_type', returnType);

      if (error) throw error;
      return data as ReturnPayment[];
    },
    enabled: !!returnId,
  });
}

export function useCreateImportReturn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      product,
      feeType = 'none',
      feePercentage = 0,
      feeAmount = 0,
      payments,
      recordToCashBook = true,
      note,
    }: {
      product: {
        id: string;
        name: string;
        sku: string;
        imei?: string | null;
        import_price: number;
        import_receipt_id?: string | null;
        supplier_id?: string | null;
        branch_id?: string | null;
        import_date?: string | null;
      };
      feeType?: 'none' | 'percentage' | 'fixed_amount';
      feePercentage?: number;
      feeAmount?: number;
      payments: { source: string; amount: number }[];
      recordToCashBook?: boolean;
      note?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get tenant_id
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const now = new Date();
      const code = `TN${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

      const totalRefund = payments.reduce((sum, p) => sum + p.amount, 0);

      const { data: returnData, error: returnError } = await supabase
        .from('import_returns')
        .insert([{
          code,
          product_id: product.id,
          import_receipt_id: product.import_receipt_id,
          supplier_id: product.supplier_id,
          branch_id: product.branch_id,
          product_name: product.name,
          sku: product.sku,
          imei: product.imei,
          import_price: product.import_price,
          original_import_date: product.import_date,
          total_refund_amount: totalRefund,
          fee_type: feeType,
          fee_percentage: feePercentage,
          fee_amount: feeAmount,
          note,
          created_by: user.id,
          tenant_id: tenantId,
        }])
        .select()
        .single();

      if (returnError) throw returnError;

      if (payments.length > 0) {
        // Get tenant_id for return_payments
        const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
        
        const { error: paymentsError } = await supabase
          .from('return_payments')
          .insert(payments.map(p => ({
            return_id: returnData.id,
            return_type: 'import_return' as const,
            payment_source: p.source,
            amount: p.amount,
            tenant_id: tenantId,
          })));

        if (paymentsError) throw paymentsError;
      }

      const { error: productError } = await supabase
        .from('products')
        .update({ status: 'returned' })
        .eq('id', product.id);

      if (productError) throw productError;

      if (recordToCashBook) {
        for (const payment of payments) {
          if (payment.source !== 'debt') {
            const { error: cashBookError } = await supabase
              .from('cash_book')
              .insert([{
                type: 'income' as const,
                category: 'Tra hang nhap',
                description: `Trả hàng nhập: ${product.name} (${code})`,
                amount: payment.amount,
                payment_source: payment.source,
                is_business_accounting: false,
                branch_id: product.branch_id,
                reference_id: returnData.id,
                reference_type: 'import_return',
                created_by: user.id,
                tenant_id: tenantId,
              }]);

            if (cashBookError) throw cashBookError;
          }
        }
      }

      // Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user.id,
        action_type: 'IMPORT_RETURN',
        table_name: 'import_returns',
        record_id: returnData.id,
        branch_id: product.branch_id || null,
        tenant_id: tenantId,
        new_data: {
          code,
          product_name: product.name,
          sku: product.sku,
          imei: product.imei,
          import_price: product.import_price,
          total_refund: totalRefund,
          supplier_id: product.supplier_id,
        },
        description: `Trả hàng nhập: ${product.name} (${product.sku}) - Hoàn: ${totalRefund.toLocaleString('vi-VN')}đ`,
      }]);

      return returnData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-returns'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useCreateExportReturn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      item,
      feeType,
      feePercentage,
      feeAmount,
      payments,
      isBusinessAccounting,
      recordToCashBook = true,
      note,
    }: {
      item: {
        id: string;
        product_id: string | null;
        export_receipt_id: string;
        export_receipt_item_id: string;
        customer_id?: string | null;
        branch_id?: string | null;
        product_name: string;
        sku: string;
        imei?: string | null;
        import_price: number;
        sale_price: number;
        sale_date?: string | null;
      };
      feeType: 'none' | 'percentage' | 'fixed_amount';
      feePercentage: number;
      feeAmount: number;
      payments: { source: string; amount: number }[];
      isBusinessAccounting: boolean;
      recordToCashBook?: boolean;
      note?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get tenant_id first
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      let storeKeepAmount = 0;
      if (feeType === 'percentage') {
        storeKeepAmount = item.sale_price * (feePercentage / 100);
      } else if (feeType === 'fixed_amount') {
        storeKeepAmount = feeAmount;
      }
      const refundAmount = item.sale_price - storeKeepAmount;

      const now = new Date();
      const code = `TX${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

      let newImportReceiptId: string | null = null;
      let newProductId: string | null = null;

      if (feeType !== 'none' && storeKeepAmount > 0) {
        // TRẢ HÀNG CÓ PHÍ: Tạo phiếu nhập MỚI + sản phẩm MỚI
        // KHÔNG update sản phẩm cũ - sản phẩm cũ vẫn ở trạng thái 'sold'
        const importCode = `PN${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        const newImportPrice = item.sale_price - storeKeepAmount;

        // Tạo phiếu nhập mới
        const { data: newReceipt, error: receiptError } = await supabase
          .from('import_receipts')
          .insert([{
            code: importCode,
            total_amount: newImportPrice,
            paid_amount: newImportPrice,
            debt_amount: 0,
            created_by: user.id,
            note: `Tự động tạo từ phiếu trả hàng ${code}`,
            tenant_id: tenantId,
            branch_id: item.branch_id,
          }])
          .select()
          .single();

        if (receiptError) throw receiptError;
        newImportReceiptId = newReceipt.id;

        // Lấy thông tin sản phẩm gốc để copy
        let originalProduct = null;
        if (item.product_id) {
          const { data: productData } = await supabase
            .from('products')
            .select('name, sku, imei, category_id, supplier_id')
            .eq('id', item.product_id)
            .single();
          originalProduct = productData;
        }

        // Tạo SẢN PHẨM MỚI với cùng IMEI, giá nhập = giá bán - phí
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert([{
            name: originalProduct?.name || item.product_name,
            sku: originalProduct?.sku || item.sku,
            imei: originalProduct?.imei || item.imei,
            import_price: newImportPrice,
            quantity: 1,
            status: 'in_stock',
            category_id: originalProduct?.category_id || null,
            supplier_id: originalProduct?.supplier_id || null,
            branch_id: item.branch_id,
            import_receipt_id: newImportReceiptId,
            import_date: now.toISOString(),
            tenant_id: tenantId,
          }])
          .select()
          .single();

        if (productError) throw productError;
        newProductId = newProduct.id;

        // Ghi lịch sử IMEI nếu có
        if (item.imei) {
          await supabase.from('imei_histories').insert([{
            product_id: newProduct.id,
            imei: item.imei,
            action_type: 'return_with_fee',
            price: newImportPrice,
            note: `Trả hàng có phí từ phiếu ${code}. Sản phẩm mới được tạo với giá nhập = ${newImportPrice.toLocaleString('vi-VN')}đ`,
            created_by: user.id,
          }]);
        }

        if (recordToCashBook) {
          // Phí trả hàng
          const { error: incomeError } = await supabase
            .from('cash_book')
            .insert([{
              type: 'income' as const,
              category: 'Thu nhap khac',
              description: `Phí trả hàng: ${item.product_name} (${code})`,
              amount: storeKeepAmount,
              payment_source: payments[0]?.source || 'cash',
              is_business_accounting: false,
              branch_id: item.branch_id,
              reference_id: null,
              reference_type: 'export_return_fee',
              created_by: user.id,
              tenant_id: tenantId,
            }]);

          if (incomeError) throw incomeError;
        }
      } else {
        // Trả hàng không có phí - hoàn lại kho với giá nhập TB hiện tại
        if (item.product_id) {
          // Lấy thông tin sản phẩm
          const { data: existingProduct } = await supabase
            .from('products')
            .select('imei, quantity, status')
            .eq('id', item.product_id)
            .single();

          if (existingProduct?.imei) {
            // SẢN PHẨM CÓ IMEI: Đánh dấu in_stock
            const { error: updateError } = await supabase
              .from('products')
              .update({ status: 'in_stock' })
              .eq('id', item.product_id);

            if (updateError) throw updateError;
          } else {
            // SẢN PHẨM KHÔNG IMEI: Cộng lại quantity
            const currentQty = existingProduct?.quantity || 0;
            const newStatus = existingProduct?.status === 'sold' ? 'in_stock' : existingProduct?.status;
            
            const { error: updateError } = await supabase
              .from('products')
              .update({ 
                quantity: currentQty + 1,
                status: newStatus,
              })
              .eq('id', item.product_id);

            if (updateError) throw updateError;
          }
        }
      }

      const { data: returnData, error: returnError } = await supabase
        .from('export_returns')
        .insert([{
          code,
          product_id: item.product_id || '',
          export_receipt_id: item.export_receipt_id,
          export_receipt_item_id: item.export_receipt_item_id,
          customer_id: item.customer_id,
          branch_id: item.branch_id,
          product_name: item.product_name,
          sku: item.sku,
          imei: item.imei,
          import_price: item.import_price,
          sale_price: item.sale_price,
          original_sale_date: item.sale_date,
          fee_type: feeType,
          fee_percentage: feePercentage,
          fee_amount: feeAmount,
          refund_amount: refundAmount,
          store_keep_amount: storeKeepAmount,
          new_import_receipt_id: newImportReceiptId,
          is_business_accounting: isBusinessAccounting,
          note,
          created_by: user.id,
          tenant_id: tenantId,
        }])
        .select()
        .single();

      if (returnError) throw returnError;

      if (payments.length > 0) {
        const { error: paymentsError } = await supabase
          .from('return_payments')
          .insert(payments.map(p => ({
            return_id: returnData.id,
            return_type: 'export_return' as const,
            payment_source: p.source,
            amount: p.amount,
            tenant_id: tenantId,
          })));

        if (paymentsError) throw paymentsError;
      }

      const { error: itemError } = await supabase
        .from('export_receipt_items')
        .update({ status: 'returned' })
        .eq('id', item.export_receipt_item_id);

      if (itemError) throw itemError;

      // Update receipt status based on items returned
      if (item.export_receipt_id) {
        // Get all items in this receipt
        const { data: allItems } = await supabase
          .from('export_receipt_items')
          .select('id, status')
          .eq('receipt_id', item.export_receipt_id);

        if (allItems) {
          const totalItems = allItems.length;
          // Count returned items (include the one we just updated)
          const returnedCount = allItems.filter(
            (i) => i.status === 'returned' || i.id === item.export_receipt_item_id
          ).length;

          let newReceiptStatus: string | null = null;
          if (returnedCount >= totalItems) {
            newReceiptStatus = 'full_return';
          } else if (returnedCount > 0) {
            newReceiptStatus = 'partial_return';
          }

          if (newReceiptStatus) {
            const { error: receiptError } = await supabase
              .from('export_receipts')
              .update({ status: newReceiptStatus })
              .eq('id', item.export_receipt_id);

            if (receiptError) throw receiptError;
          }
        }
      }

      // Ghi nhận tiền hoàn trả cho khách
      if (recordToCashBook) {
        for (const payment of payments) {
          if (payment.source !== 'debt') {
            const { error: cashBookError } = await supabase
              .from('cash_book')
              .insert([{
                type: 'expense' as const,
                category: 'Hoan tien khach hang',
                description: `Hoan tien tra hang: ${item.product_name} (${code})`,
                amount: payment.amount,
                payment_source: payment.source,
                is_business_accounting: false,
                branch_id: item.branch_id,
                reference_id: returnData.id,
                reference_type: 'export_return',
                created_by: user.id,
                tenant_id: tenantId,
              }]);

            if (cashBookError) throw cashBookError;
          }
        }
      }

      // Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user.id,
        action_type: 'RETURN',
        table_name: 'export_returns',
        record_id: returnData.id,
        branch_id: item.branch_id || null,
        tenant_id: tenantId,
        new_data: {
          code,
          product_name: item.product_name,
          sku: item.sku,
          imei: item.imei,
          sale_price: item.sale_price,
          refund_amount: refundAmount,
          store_keep_amount: storeKeepAmount,
          fee_type: feeType,
          customer_id: item.customer_id,
        },
        description: `Trả hàng xuất: ${item.product_name} - Hoàn khách: ${refundAmount.toLocaleString('vi-VN')}đ${storeKeepAmount > 0 ? ` - Phí: ${storeKeepAmount.toLocaleString('vi-VN')}đ` : ''}`,
      }]);

      return returnData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-returns'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipt-items'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
    },
  });
}

export function useDeleteImportReturn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (returnItem: ImportReturn) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // 1. Delete return payments
      await supabase
        .from('return_payments')
        .delete()
        .eq('return_id', returnItem.id)
        .eq('return_type', 'import_return');

      // 2. Delete related cash_book entries
      await supabase
        .from('cash_book')
        .delete()
        .eq('reference_id', returnItem.id)
        .eq('reference_type', 'import_return');

      // 3. Restore product status back to in_stock
      if (returnItem.product_id) {
        await supabase
          .from('products')
          .update({ status: 'in_stock' })
          .eq('id', returnItem.product_id);
      }

      // 4. Delete the import return record
      const { error } = await supabase
        .from('import_returns')
        .delete()
        .eq('id', returnItem.id);

      if (error) throw error;

      // 5. Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user.id,
        action_type: 'DELETE_IMPORT_RETURN',
        table_name: 'import_returns',
        record_id: returnItem.id,
        branch_id: returnItem.branch_id || null,
        tenant_id: tenantId,
        old_data: {
          code: returnItem.code,
          product_name: returnItem.product_name,
          sku: returnItem.sku,
          imei: returnItem.imei,
          import_price: returnItem.import_price,
          total_refund_amount: returnItem.total_refund_amount,
          supplier: returnItem.suppliers?.name,
        },
        description: `Xóa phiếu trả hàng nhập: ${returnItem.product_name} (${returnItem.code}) - ${returnItem.total_refund_amount.toLocaleString('vi-VN')}đ`,
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-returns'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useDeleteExportReturn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (returnItem: ExportReturn) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // 1. Delete return payments
      await supabase
        .from('return_payments')
        .delete()
        .eq('return_id', returnItem.id)
        .eq('return_type', 'export_return');

      // 2. Delete related cash_book entries (refund + fee)
      await supabase
        .from('cash_book')
        .delete()
        .eq('reference_id', returnItem.id)
        .in('reference_type', ['export_return', 'export_return_fee']);

      // 3. Restore export_receipt_item status back to 'sold'
      if (returnItem.export_receipt_item_id) {
        await supabase
          .from('export_receipt_items')
          .update({ status: 'sold' })
          .eq('id', returnItem.export_receipt_item_id);
      }

      // 4. If had fee (new product was created), delete new product + import receipt
      if (returnItem.new_import_receipt_id) {
        // Delete products created from this return
        await supabase
          .from('products')
          .delete()
          .eq('import_receipt_id', returnItem.new_import_receipt_id);

        // Delete the auto-created import receipt
        await supabase
          .from('import_receipts')
          .delete()
          .eq('id', returnItem.new_import_receipt_id);
      } else if (returnItem.product_id) {
        // No fee return: product was restored to in_stock, revert to sold
        const { data: prod } = await supabase
          .from('products')
          .select('imei, quantity')
          .eq('id', returnItem.product_id)
          .single();

        if (prod?.imei) {
          await supabase
            .from('products')
            .update({ status: 'sold' })
            .eq('id', returnItem.product_id);
        } else {
          await supabase
            .from('products')
            .update({ quantity: Math.max((prod?.quantity || 1) - 1, 0) })
            .eq('id', returnItem.product_id);
        }
      }

      // 5. Re-evaluate export receipt status
      if (returnItem.export_receipt_id) {
        const { data: allItems } = await supabase
          .from('export_receipt_items')
          .select('id, status')
          .eq('receipt_id', returnItem.export_receipt_id);

        if (allItems) {
          const returnedCount = allItems.filter(i => i.status === 'returned' && i.id !== returnItem.export_receipt_item_id).length;
          const totalItems = allItems.length;
          let newStatus = 'completed';
          if (returnedCount >= totalItems) newStatus = 'full_return';
          else if (returnedCount > 0) newStatus = 'partial_return';

          await supabase
            .from('export_receipts')
            .update({ status: newStatus })
            .eq('id', returnItem.export_receipt_id);
        }
      }

      // 6. Delete the export return record
      const { error } = await supabase
        .from('export_returns')
        .delete()
        .eq('id', returnItem.id);

      if (error) throw error;

      // 7. Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user.id,
        action_type: 'DELETE_EXPORT_RETURN',
        table_name: 'export_returns',
        record_id: returnItem.id,
        branch_id: returnItem.branch_id || null,
        tenant_id: tenantId,
        old_data: {
          code: returnItem.code,
          product_name: returnItem.product_name,
          sku: returnItem.sku,
          imei: returnItem.imei,
          sale_price: returnItem.sale_price,
          refund_amount: returnItem.refund_amount,
          store_keep_amount: returnItem.store_keep_amount,
          fee_type: returnItem.fee_type,
          customer: returnItem.customers?.name,
        },
        description: `Xóa phiếu trả hàng bán: ${returnItem.product_name} (${returnItem.code}) - Hoàn: ${returnItem.refund_amount.toLocaleString('vi-VN')}đ`,
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-returns'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipt-items'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
    },
  });
}
