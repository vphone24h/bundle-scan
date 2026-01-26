import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  return useQuery({
    queryKey: ['import-returns', filters],
    queryFn: async () => {
      let query = supabase
        .from('import_returns')
        .select(`
          *,
          suppliers(name),
          branches(name)
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
      if (filters?.branchId) {
        query = query.eq('branch_id', filters.branchId);
      }
      if (filters?.createdBy) {
        query = query.eq('created_by', filters.createdBy);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ImportReturn[];
    },
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
  return useQuery({
    queryKey: ['export-returns', filters],
    queryFn: async () => {
      let query = supabase
        .from('export_returns')
        .select(`
          *,
          customers(name, phone),
          branches(name)
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
      if (filters?.branchId) {
        query = query.eq('branch_id', filters.branchId);
      }
      if (filters?.feeType) {
        query = query.eq('fee_type', filters.feeType);
      }
      if (filters?.createdBy) {
        query = query.eq('created_by', filters.createdBy);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ExportReturn[];
    },
  });
}

// Hook to get all profiles (for employee filter)
export function useAllProfiles() {
  return useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('display_name');

      if (error) throw error;
      return data as { user_id: string; display_name: string }[];
    },
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
      payments,
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
      payments: { source: string; amount: number }[];
      note?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

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
          note,
          created_by: user.id,
        }])
        .select()
        .single();

      if (returnError) throw returnError;

      if (payments.length > 0) {
        const { error: paymentsError } = await supabase
          .from('return_payments')
          .insert(payments.map(p => ({
            return_id: returnData.id,
            return_type: 'import_return' as const,
            payment_source: p.source,
            amount: p.amount,
          })));

        if (paymentsError) throw paymentsError;
      }

      const { error: productError } = await supabase
        .from('products')
        .update({ status: 'returned' })
        .eq('id', product.id);

      if (productError) throw productError;

      for (const payment of payments) {
        if (payment.source !== 'debt') {
          const { error: cashBookError } = await supabase
            .from('cash_book')
            .insert([{
              type: 'income' as const,
              category: 'Tra hang nhap',
              description: `Tra hang nhap: ${product.name} (${code})`,
              amount: payment.amount,
              payment_source: payment.source,
              is_business_accounting: false,
              branch_id: product.branch_id,
              reference_id: returnData.id,
              reference_type: 'import_return',
              created_by: user.id,
            }]);

          if (cashBookError) throw cashBookError;
        }
      }

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
      note?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

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

      if (feeType !== 'none' && storeKeepAmount > 0) {
        const importCode = `PN${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        const newImportPrice = item.sale_price - storeKeepAmount;

        const { data: newReceipt, error: receiptError } = await supabase
          .from('import_receipts')
          .insert([{
            code: importCode,
            total_amount: newImportPrice,
            paid_amount: newImportPrice,
            debt_amount: 0,
            created_by: user.id,
            note: `Tu dong tao tu phieu tra hang ${code}`,
          }])
          .select()
          .single();

        if (receiptError) throw receiptError;
        newImportReceiptId = newReceipt.id;

        if (item.product_id) {
          const { error: updateError } = await supabase
            .from('products')
            .update({
              status: 'in_stock',
              import_price: newImportPrice,
              import_receipt_id: newImportReceiptId,
              import_date: now.toISOString(),
            })
            .eq('id', item.product_id);

          if (updateError) throw updateError;
        }

        const { error: incomeError } = await supabase
          .from('cash_book')
          .insert([{
            type: 'income' as const,
            category: 'Thu nhap khac',
            description: `Phi tra hang: ${item.product_name} (${code})`,
            amount: storeKeepAmount,
            payment_source: payments[0]?.source || 'cash',
            is_business_accounting: isBusinessAccounting,
            branch_id: item.branch_id,
            reference_id: null,
            reference_type: 'export_return_fee',
            created_by: user.id,
          }]);

        if (incomeError) throw incomeError;
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
          })));

        if (paymentsError) throw paymentsError;
      }

      const { error: itemError } = await supabase
        .from('export_receipt_items')
        .update({ status: 'returned' })
        .eq('id', item.export_receipt_item_id);

      if (itemError) throw itemError;

      // Ghi nhận tiền hoàn trả cho khách - KHÔNG tính vào hạch toán kinh doanh
      // (Chỉ là đảo dòng tiền, không phải hoạt động kinh doanh mới)
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
              is_business_accounting: false, // KHÔNG tính vào hạch toán - chỉ đảo dòng tiền
              branch_id: item.branch_id,
              reference_id: returnData.id,
              reference_type: 'export_return',
              created_by: user.id,
            }]);

          if (cashBookError) throw cashBookError;
        }
      }

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
