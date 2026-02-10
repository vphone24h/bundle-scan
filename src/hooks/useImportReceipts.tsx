import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';

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
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;
  const { branchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  return useQuery({
    // Keyed by tenant AND branch to prevent cross-tenant/branch cache leakage
    queryKey: ['import-receipts', tenant?.id, branchId, isDataHidden],
    queryFn: async () => {
      // Chế độ test: trả về dữ liệu rỗng
      if (isDataHidden) return [] as ImportReceipt[];

      let query = supabase
        .from('import_receipts')
        .select(`
          *,
          suppliers(name),
          branches(name)
        `)
        .order('import_date', { ascending: false });

      // Apply branch filter for non-Super Admin users
      if (shouldFilter && branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ImportReceipt[];
    },
    enabled: !isTenantLoading && !branchLoading,
    refetchOnWindowFocus: false,
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
        sale_price?: number | null;
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

      // =========== OPTIMIZED BATCH PROCESSING ===========
      // Separate IMEI and non-IMEI products
      const imeiProducts = products.filter(p => p.imei);
      const nonImeiProducts = products.filter(p => !p.imei);

      // =========== PHASE 1: Batch validate all IMEIs at once ===========
      if (imeiProducts.length > 0) {
        const imeis = imeiProducts.map(p => p.imei!);
        
        // Single query to check all IMEIs at once
        const { data: existingIMEIs } = await supabase
          .from('products')
          .select('imei, name, sku, status')
          .in('imei', imeis)
          .eq('tenant_id', tenantId)
          .in('status', ['in_stock', 'sold', 'returned']);

        if (existingIMEIs && existingIMEIs.length > 0) {
          const existing = existingIMEIs[0];
          const statusText = existing.status === 'in_stock' ? 'tồn kho' : 
                             existing.status === 'sold' ? 'đã bán' : 'đã trả hàng';
          throw new Error(`IMEI "${existing.imei}" đã tồn tại trong kho (${existing.name} - ${existing.sku}, trạng thái: ${statusText}). Vui lòng kiểm tra lịch sử nhập/bán/trả hàng.`);
        }
      }

      // =========== PHASE 2: Batch check existing non-IMEI products ===========
      const nonImeiExistingMap = new Map<string, { id: string; quantity: number; total_import_cost: number }>();
      
      if (nonImeiProducts.length > 0) {
        // Create unique keys for lookup
        const uniqueNonImeiKeys = [...new Set(nonImeiProducts.map(p => `${p.name}|||${p.sku}`))];
        
        // Query all potential existing products at once
        const { data: existingNonImei } = await supabase
          .from('products')
          .select('id, name, sku, quantity, total_import_cost')
          .eq('branch_id', branchId || '')
          .eq('status', 'in_stock')
          .is('imei', null)
          .eq('tenant_id', tenantId);

        if (existingNonImei) {
          existingNonImei.forEach(p => {
            nonImeiExistingMap.set(`${p.name}|||${p.sku}`, {
              id: p.id,
              quantity: p.quantity,
              total_import_cost: Number(p.total_import_cost) || 0,
            });
          });
        }
      }

      // =========== PHASE 3: Prepare batch data ===========
      const newProducts: any[] = [];
      const updateOperations: { id: string; updates: any }[] = [];
      const productImportsToCreate: any[] = [];

      // Process IMEI products (always new)
      for (const p of imeiProducts) {
        newProducts.push({
          name: p.name,
          sku: p.sku,
          imei: p.imei,
          category_id: p.category_id,
          import_price: p.import_price,
          sale_price: p.sale_price || null,
          quantity: 1,
          total_import_cost: p.import_price,
          supplier_id: supplierId,
          import_receipt_id: receipt.id,
          branch_id: branchId || null,
          tenant_id: tenantId,
          note: p.note,
        });
      }

      // Process non-IMEI products
      const processedNonImeiKeys = new Map<string, { quantity: number; totalCost: number }>();
      
      for (const p of nonImeiProducts) {
        const key = `${p.name}|||${p.sku}`;
        const existing = nonImeiExistingMap.get(key);
        
        if (existing) {
          // Accumulate updates for existing products
          if (!processedNonImeiKeys.has(key)) {
            processedNonImeiKeys.set(key, {
              quantity: existing.quantity,
              totalCost: existing.total_import_cost,
            });
          }
          
          const accumulated = processedNonImeiKeys.get(key)!;
          accumulated.quantity += p.quantity;
          accumulated.totalCost += p.import_price * p.quantity;
          
          // Will create import history record
          productImportsToCreate.push({
            existingProductId: existing.id,
            quantity: p.quantity,
            import_price: p.import_price,
            supplier_id: supplierId,
            note: p.note,
            created_by: user.id,
          });
        } else {
          // New product
          const totalCost = p.import_price * p.quantity;
          newProducts.push({
            name: p.name,
            sku: p.sku,
            imei: null,
            category_id: p.category_id,
            import_price: p.import_price,
            sale_price: p.sale_price || null,
            quantity: p.quantity,
            total_import_cost: totalCost,
            supplier_id: supplierId,
            import_receipt_id: receipt.id,
            branch_id: branchId || null,
            tenant_id: tenantId,
            note: p.note,
          });
          
          // Mark as processed to avoid creating duplicates
          nonImeiExistingMap.set(key, {
            id: 'pending', // Will be filled after insert
            quantity: p.quantity,
            total_import_cost: totalCost,
          });
        }
      }

      // =========== PHASE 4: Execute batch operations ===========
      
      // 4a: Batch insert new products
      let insertedProducts: any[] = [];
      if (newProducts.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from('products')
          .insert(newProducts)
          .select('id, name, sku, imei, import_price, quantity');

        if (insertError) throw insertError;
        insertedProducts = inserted || [];
      }

      // 4b: Batch update existing non-IMEI products
      for (const [key, accumulated] of processedNonImeiKeys) {
        const existing = nonImeiExistingMap.get(key);
        if (existing && existing.id !== 'pending') {
          const newAvgPrice = accumulated.totalCost / accumulated.quantity;
          
          await supabase
            .from('products')
            .update({
              quantity: accumulated.quantity,
              total_import_cost: accumulated.totalCost,
              import_price: newAvgPrice,
              import_receipt_id: receipt.id,
            })
            .eq('id', existing.id);
        }
      }

      // 4c: Create product_imports records in batch
      const allProductImports: any[] = [];
      
      // For newly inserted products
      for (const inserted of insertedProducts) {
        const originalProduct = products.find(p => 
          p.name === inserted.name && 
          p.sku === inserted.sku && 
          (p.imei === inserted.imei || (!p.imei && !inserted.imei))
        );
        
        if (originalProduct) {
          allProductImports.push({
            product_id: inserted.id,
            import_receipt_id: receipt.id,
            quantity: inserted.quantity,
            import_price: inserted.import_price,
            supplier_id: supplierId,
            note: originalProduct.note,
            created_by: user.id,
          });
        }
      }
      
      // For existing products that were updated
      for (const importRecord of productImportsToCreate) {
        allProductImports.push({
          product_id: importRecord.existingProductId,
          import_receipt_id: receipt.id,
          quantity: importRecord.quantity,
          import_price: importRecord.import_price,
          supplier_id: importRecord.supplier_id,
          note: importRecord.note,
          created_by: importRecord.created_by,
        });
      }

      // Batch insert all product_imports
      if (allProductImports.length > 0) {
        const { error: importsError } = await supabase
          .from('product_imports')
          .insert(allProductImports);
        
        if (importsError) console.error('Error creating product_imports:', importsError);
      }

      // Create cash book entries for actual payments (not debt)
      // Fetch staff name and supplier name for cash book
      const { data: staffProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      const staffName = staffProfile?.display_name || user.email || null;

      let supplierName: string | null = null;
      if (supplierId) {
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('name')
          .eq('id', supplierId)
          .maybeSingle();
        supplierName = supplier?.name || null;
      }

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
          created_by_name: staffName,
          recipient_name: supplierName,
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
    onSuccess: async () => {
      // Invalidate với refetchType: 'all' để đảm bảo refetch ngay lập tức
      await queryClient.invalidateQueries({ 
        queryKey: ['import-receipts'],
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['all-products'] });
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

      // Cập nhật nhà cung cấp nếu có thay đổi
      if (newSupplierId !== undefined) {
        // Normalize value coming from UI/Select (can be null/''/'undefined')
        const normalized =
          newSupplierId === 'undefined' || newSupplierId === '' ? null : newSupplierId;

        const { error: receiptError } = await supabase
          .from('import_receipts')
          .update({ supplier_id: normalized })
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
    onSuccess: async () => {
      // Use refetchType: 'all' to ensure immediate data update
      await queryClient.invalidateQueries({ 
        queryKey: ['import-receipts'],
        refetchType: 'all'
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['import-receipt'],
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['all-products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
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
        action_type: 'IMPORT_RETURN',
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
