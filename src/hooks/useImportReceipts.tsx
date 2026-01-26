import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type ReceiptStatus = Database['public']['Enums']['receipt_status'];
type PaymentType = Database['public']['Enums']['payment_type'];

// Helper to get current user's tenant_id
async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export interface ImportReceipt {
  id: string;
  code: string;
  import_date: string;
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
  supplier_id: string | null;
  branch_id: string | null;
  created_by: string | null;
  note: string | null;
  status: ReceiptStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  suppliers?: { name: string } | null;
  branches?: { name: string } | null;
  profiles?: { display_name: string } | null;
}

export interface ReceiptPayment {
  id: string;
  receipt_id: string;
  payment_type: PaymentType;
  amount: number;
  created_at: string;
}

export function useImportReceipts() {
  return useQuery({
    queryKey: ['import-receipts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_receipts')
        .select(`
          *,
          suppliers(name),
          branches(name)
        `)
        .order('import_date', { ascending: false });

      if (error) throw error;
      return data as ImportReceipt[];
    },
  });
}

export function useImportReceiptDetails(receiptId: string | null) {
  return useQuery({
    queryKey: ['import-receipt', receiptId],
    queryFn: async () => {
      if (!receiptId) return null;

      const { data: receipt, error: receiptError } = await supabase
        .from('import_receipts')
        .select(`
          *,
          suppliers(name),
          branches(name)
        `)
        .eq('id', receiptId)
        .single();

      if (receiptError) throw receiptError;

      const { data: payments, error: paymentsError } = await supabase
        .from('receipt_payments')
        .select('*')
        .eq('receipt_id', receiptId);

      if (paymentsError) throw paymentsError;

      // Lấy sản phẩm trực tiếp từ bảng products (có import_receipt_id)
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          imei,
          import_price,
          quantity,
          status,
          category_id,
          categories(name)
        `)
        .eq('import_receipt_id', receiptId);

      if (productsError) throw productsError;

      // Chuyển đổi thành định dạng tương thích với UI
      const productItems = (products || []).map(p => ({
        id: p.id,
        import_price: p.import_price,
        quantity: p.quantity,
        products: {
          id: p.id,
          name: p.name,
          sku: p.sku,
          imei: p.imei,
          status: p.status,
          categories: p.categories
        }
      }));

      return {
        receipt,
        payments: payments as ReceiptPayment[],
        productImports: productItems,
      };
    },
    enabled: !!receiptId,
  });
}

export function useCreateImportReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      products,
      payments,
      supplierId,
      branchId,
      note,
    }: {
      products: {
        name: string;
        sku: string;
        imei?: string | null;
        category_id?: string | null;
        import_price: number;
        quantity: number;
        supplier_id?: string | null;
        note?: string | null;
      }[];
      payments: { type: PaymentType; amount: number }[];
      supplierId: string | null;
      branchId?: string | null;
      note?: string | null;
    }) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current tenant_id
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Generate receipt code
      const now = new Date();
      const code = `PN${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

      // Calculate total considering quantity
      const totalAmount = products.reduce((sum, p) => sum + p.import_price * p.quantity, 0);
      const paidAmount = payments.filter(p => p.type !== 'debt').reduce((sum, p) => sum + p.amount, 0);
      const debtAmount = payments.filter(p => p.type === 'debt').reduce((sum, p) => sum + p.amount, 0);

      // Create receipt
      const { data: receipt, error: receiptError } = await supabase
        .from('import_receipts')
        .insert([{
          code,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          debt_amount: debtAmount,
          supplier_id: supplierId,
          branch_id: branchId || null,
          created_by: user.id,
          tenant_id: tenantId,
          note,
        }])
        .select()
        .single();

      if (receiptError) throw receiptError;

      // Create payments
      if (payments.length > 0) {
        const { error: paymentsError } = await supabase
          .from('receipt_payments')
          .insert(payments.map(p => ({
            receipt_id: receipt.id,
            payment_type: p.type,
            amount: p.amount,
          })));

        if (paymentsError) throw paymentsError;
      }

      // Process products - LOGIC MỚI CHO SẢN PHẨM KHÔNG IMEI
      for (const p of products) {
        if (p.imei) {
          // SẢN PHẨM CÓ IMEI: Kiểm tra trùng IMEI trước
          const { data: existingIMEI } = await supabase
            .from('products')
            .select('id, name, sku, status')
            .eq('imei', p.imei)
            .eq('status', 'in_stock')
            .maybeSingle();

          if (existingIMEI) {
            throw new Error(`IMEI "${p.imei}" đã tồn tại trong kho (${existingIMEI.name} - ${existingIMEI.sku}). Không thể nhập trùng IMEI.`);
          }

          // Tạo bản ghi riêng lẻ (quantity luôn = 1)
          const { data: newProduct, error: productError } = await supabase
            .from('products')
            .insert([{
              name: p.name,
              sku: p.sku,
              imei: p.imei,
              category_id: p.category_id,
              import_price: p.import_price,
              quantity: 1,
              total_import_cost: p.import_price,
              supplier_id: supplierId,
              import_receipt_id: receipt.id,
              branch_id: branchId || null,
              tenant_id: tenantId,
              note: p.note,
            }])
            .select()
            .single();

          if (productError) throw productError;

          // Tạo bản ghi lịch sử nhập hàng
          await supabase.from('product_imports').insert([{
            product_id: newProduct.id,
            import_receipt_id: receipt.id,
            quantity: 1,
            import_price: p.import_price,
            supplier_id: supplierId,
            note: p.note,
            created_by: user.id,
          }]);

        } else {
          // SẢN PHẨM KHÔNG IMEI: Tìm sản phẩm có cùng name + sku + branch + in_stock
          const { data: existingProduct } = await supabase
            .from('products')
            .select('id, quantity, import_price, total_import_cost')
            .eq('name', p.name)
            .eq('sku', p.sku)
            .eq('branch_id', branchId || '')
            .eq('status', 'in_stock')
            .is('imei', null)
            .maybeSingle();

          if (existingProduct) {
            // CẬP NHẬT SẢN PHẨM ĐÃ TỒN TẠI
            const newQuantity = existingProduct.quantity + p.quantity;
            const newTotalCost = existingProduct.total_import_cost + (p.import_price * p.quantity);
            const newAvgPrice = newTotalCost / newQuantity;

            await supabase
              .from('products')
              .update({
                quantity: newQuantity,
                total_import_cost: newTotalCost,
                import_price: newAvgPrice, // Cập nhật giá nhập TB
                import_receipt_id: receipt.id, // Cập nhật phiếu nhập gần nhất
              })
              .eq('id', existingProduct.id);

            // Tạo bản ghi lịch sử nhập hàng
            await supabase.from('product_imports').insert([{
              product_id: existingProduct.id,
              import_receipt_id: receipt.id,
              quantity: p.quantity,
              import_price: p.import_price,
              supplier_id: supplierId,
              note: p.note,
              created_by: user.id,
            }]);

          } else {
            // TẠO SẢN PHẨM MỚI với quantity
            const totalCost = p.import_price * p.quantity;
            
            const { data: newProduct, error: productError } = await supabase
              .from('products')
              .insert([{
                name: p.name,
                sku: p.sku,
                imei: null,
                category_id: p.category_id,
                import_price: p.import_price,
                quantity: p.quantity,
                total_import_cost: totalCost,
                supplier_id: supplierId,
                import_receipt_id: receipt.id,
                branch_id: branchId || null,
                tenant_id: tenantId,
                note: p.note,
              }])
              .select()
              .single();

            if (productError) throw productError;

            // Tạo bản ghi lịch sử nhập hàng
            await supabase.from('product_imports').insert([{
              product_id: newProduct.id,
              import_receipt_id: receipt.id,
              quantity: p.quantity,
              import_price: p.import_price,
              supplier_id: supplierId,
              note: p.note,
              created_by: user.id,
            }]);
          }
        }
      }

      // Create cash book entries for actual payments (not debt)
      const cashBookEntries = payments
        .filter(p => p.type !== 'debt' && p.amount > 0)
        .map(p => ({
          type: 'expense' as const,
          category: 'Nhập hàng',
          description: `Thanh toán phiếu nhập ${code}`,
          amount: p.amount,
          payment_source: p.type,
          is_business_accounting: false,
          branch_id: branchId || null,
          reference_id: receipt.id,
          reference_type: 'import_receipt',
          created_by: user.id,
          tenant_id: tenantId,
        }));

      if (cashBookEntries.length > 0) {
        const { error: cashBookError } = await supabase
          .from('cash_book')
          .insert(cashBookEntries);

        if (cashBookError) throw cashBookError;
      }

      // Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user.id,
        action_type: 'create',
        table_name: 'import_receipts',
        record_id: receipt.id,
        branch_id: branchId || null,
        new_data: {
          code: receipt.code,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          debt_amount: debtAmount,
          supplier_id: supplierId,
          products_count: products.length,
        },
        description: `Tạo phiếu nhập ${code} - ${products.length} sản phẩm - Tổng: ${totalAmount.toLocaleString('vi-VN')}đ`,
      }]);

      return receipt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
    },
  });
}

// Hook chỉnh sửa phiếu nhập (tên SP, danh mục, NCC, giá)
export function useUpdateImportReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      productUpdates,
      newSupplierId,
    }: {
      receiptId: string;
      productUpdates: {
        productId: string;
        name?: string;
        category_id?: string | null;
        import_price?: number;
        oldImportPrice?: number;
      }[];
      newSupplierId?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Cập nhật nhà cung cấp nếu có
      if (newSupplierId !== undefined) {
        const { error: receiptError } = await supabase
          .from('import_receipts')
          .update({ supplier_id: newSupplierId })
          .eq('id', receiptId);
        
        if (receiptError) throw receiptError;
      }

      // Cập nhật từng sản phẩm
      let totalPriceDiff = 0;
      for (const update of productUpdates) {
        const updateData: Record<string, any> = {};
        
        if (update.name) updateData.name = update.name;
        if (update.category_id !== undefined) updateData.category_id = update.category_id;
        if (update.import_price !== undefined) {
          updateData.import_price = update.import_price;
          updateData.total_import_cost = update.import_price;
          totalPriceDiff += update.import_price - (update.oldImportPrice || 0);
        }

        if (Object.keys(updateData).length > 0) {
          const { error } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', update.productId);
          
          if (error) throw error;

          // Cập nhật product_imports nếu có thay đổi giá
          if (update.import_price !== undefined) {
            await supabase
              .from('product_imports')
              .update({ import_price: update.import_price })
              .eq('product_id', update.productId)
              .eq('import_receipt_id', receiptId);
          }
        }
      }

      // Cập nhật tổng tiền phiếu nhập nếu giá thay đổi
      if (totalPriceDiff !== 0) {
        const { data: receipt } = await supabase
          .from('import_receipts')
          .select('total_amount, paid_amount')
          .eq('id', receiptId)
          .single();

        if (receipt) {
          const newTotalAmount = Number(receipt.total_amount) + totalPriceDiff;
          const paidAmount = Number(receipt.paid_amount);
          const newDebtAmount = Math.max(0, newTotalAmount - paidAmount);

          await supabase
            .from('import_receipts')
            .update({
              total_amount: newTotalAmount,
              debt_amount: newDebtAmount,
            })
            .eq('id', receiptId);

          // Cập nhật sổ quỹ nếu giá thay đổi
          if (totalPriceDiff !== 0) {
            const { data: existingEntry } = await supabase
              .from('cash_book')
              .select('id, amount')
              .eq('reference_id', receiptId)
              .eq('reference_type', 'import_receipt')
              .maybeSingle();

            if (existingEntry) {
              // Cập nhật entry sổ quỹ hiện có
              await supabase
                .from('cash_book')
                .update({ amount: Number(existingEntry.amount) + totalPriceDiff })
                .eq('id', existingEntry.id);
            }
          }
        }
      }

      // Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user.id,
        action_type: 'update',
        table_name: 'import_receipts',
        record_id: receiptId,
        old_data: { product_updates_count: productUpdates.length },
        new_data: {
          supplier_id: newSupplierId,
          price_difference: totalPriceDiff,
          products_updated: productUpdates.map(u => ({
            productId: u.productId,
            old_price: u.oldImportPrice,
            new_price: u.import_price,
          })),
        },
        description: `Sửa phiếu nhập - Thay đổi giá: ${totalPriceDiff.toLocaleString('vi-VN')}đ`,
      }]);

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['import-receipt'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
    },
  });
}

// Hook trả hàng toàn bộ phiếu nhập
export function useReturnImportReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      payments,
      note,
    }: {
      receiptId: string;
      payments: { source: string; amount: number }[];
      note?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Lấy thông tin phiếu nhập và sản phẩm
      const { data: receipt, error: receiptError } = await supabase
        .from('import_receipts')
        .select('*, suppliers(name), branches(name)')
        .eq('id', receiptId)
        .single();

      if (receiptError) throw receiptError;

      // Lấy tất cả sản phẩm của phiếu nhập còn tồn kho
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('import_receipt_id', receiptId)
        .eq('status', 'in_stock');

      if (productsError) throw productsError;

      if (!products || products.length === 0) {
        throw new Error('Không còn sản phẩm nào trong kho để trả');
      }

      const now = new Date();
      const baseCode = `TN${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

      const returnIds: string[] = [];

      // Tạo phiếu trả hàng cho từng sản phẩm
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const code = products.length === 1 ? baseCode : `${baseCode}_${i + 1}`;

        const { data: returnData, error: returnError } = await supabase
          .from('import_returns')
          .insert([{
            code,
            product_id: product.id,
            import_receipt_id: receiptId,
            supplier_id: receipt.supplier_id,
            branch_id: receipt.branch_id,
            product_name: product.name,
            sku: product.sku,
            imei: product.imei,
            import_price: product.import_price,
            original_import_date: product.import_date,
            total_refund_amount: product.import_price,
            note: note || `Trả toàn bộ phiếu ${receipt.code}`,
            created_by: user.id,
          }])
          .select()
          .single();

        if (returnError) throw returnError;
        returnIds.push(returnData.id);

        // Cập nhật trạng thái sản phẩm
        await supabase
          .from('products')
          .update({ status: 'returned' })
          .eq('id', product.id);
      }

      // Tạo thanh toán và sổ quỹ
      const totalRefund = payments.reduce((sum, p) => sum + p.amount, 0);

      for (const payment of payments) {
        // Lưu thanh toán cho phiếu trả hàng đầu tiên
        if (returnIds[0]) {
          await supabase
            .from('return_payments')
            .insert([{
              return_id: returnIds[0],
              return_type: 'import_return',
              payment_source: payment.source,
              amount: payment.amount,
            }]);
        }

        // Ghi sổ quỹ (thu tiền từ NCC)
        if (payment.source !== 'debt') {
          await supabase
            .from('cash_book')
            .insert([{
              type: 'income' as const,
              category: 'Tra hang nhap',
              description: `Tra toan bo phieu nhap ${receipt.code}`,
              amount: payment.amount,
              payment_source: payment.source,
              is_business_accounting: false,
              branch_id: receipt.branch_id,
              reference_id: returnIds[0],
              reference_type: 'import_return',
              created_by: user.id,
            }]);
        }
      }

      // Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user.id,
        action_type: 'create',
        table_name: 'import_returns',
        record_id: returnIds[0] || null,
        branch_id: receipt.branch_id,
        new_data: {
          receipt_code: receipt.code,
          products_returned: products.length,
          total_refund: payments.reduce((sum, p) => sum + p.amount, 0),
          products: products.map(p => ({ name: p.name, sku: p.sku, imei: p.imei })),
        },
        description: `Trả hàng nhập phiếu ${receipt.code} - ${products.length} sản phẩm`,
      }]);

      return { returnIds, productsReturned: products.length, totalRefund };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['import-receipt'] });
      queryClient.invalidateQueries({ queryKey: ['import-returns'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}
