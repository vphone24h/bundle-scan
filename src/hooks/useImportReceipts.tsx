import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useCurrentTenant } from './useTenant';
import { useBranchFilter } from './useBranchFilter';
import { sendBusinessPush, formatVND } from '@/lib/pushNotify';
import { sendActivityAlert } from '@/lib/activityAlert';

// fetchAllRows removed - using server-side pagination

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

export function useImportReceipts(filters?: {
  search?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
}) {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;
  const { branchId, shouldFilter, isLoading: branchLoading } = useBranchFilter();

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 500;

  const result = useQuery({
    queryKey: ['import-receipts', tenant?.id, branchId, isDataHidden, filters],
    queryFn: async () => {
      if (isDataHidden) return { items: [] as ImportReceipt[], totalCount: 0 };

      const effectiveBranchId = filters?.branchId && filters.branchId !== '_all_'
        ? filters.branchId
        : (shouldFilter && branchId ? branchId : null);

      const { data, error } = await supabase.rpc('search_import_receipts', {
        _search: filters?.search?.trim() || null,
        _supplier_id: (filters?.supplierId && filters.supplierId !== '_all_') ? filters.supplierId : null,
        _date_from: filters?.dateFrom || null,
        _date_to: filters?.dateTo || null,
        _branch_id: effectiveBranchId || null,
        _page: page,
        _page_size: pageSize,
      });

      if (error) {
        console.error('Import receipts RPC error:', error);
        throw error;
      }

      const rows = (data || []) as any[];
      const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
      const items: ImportReceipt[] = rows.map((r: any) => ({
        ...r,
        suppliers: r.supplier_name ? { name: r.supplier_name } : null,
        branches: r.branch_name ? { name: r.branch_name } : null,
      }));

      return { items, totalCount };
    },
    enabled: !isTenantLoading && !branchLoading,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });

  return {
    ...result,
    data: result.data?.items || [],
    totalCount: result.data?.totalCount || 0,
  };
}

export function useImportReceiptDetails(receiptId: string | null) {
  return useQuery({
    queryKey: ['import-receipt', receiptId],
    queryFn: async () => {
      if (!receiptId) return null;

      // Run all queries in parallel for maximum speed
      const [receiptRes, paymentsRes, piRes, productsRes] = await Promise.all([
        supabase
          .from('import_receipts')
          .select(`*, suppliers(name), branches(name)`)
          .eq('id', receiptId)
          .single(),
        supabase
          .from('receipt_payments')
          .select('*')
          .eq('receipt_id', receiptId),
        supabase
          .from('product_imports')
          .select('id, product_id, import_price, quantity')
          .eq('import_receipt_id', receiptId),
        supabase
          .from('products')
          .select(`id, name, sku, imei, import_price, quantity, unit, status, category_id, categories(name)`)
          .eq('import_receipt_id', receiptId),
      ]);

      if (receiptRes.error) throw receiptRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (piRes.error) throw piRes.error;
      if (productsRes.error) throw productsRes.error;

      const receipt = receiptRes.data;
      const payments = paymentsRes.data;
      const piData = piRes.data;
      const products = productsRes.data;

      // Build map: product_id -> original imported quantity from product_imports
      const piMap = new Map<string, { quantity: number; import_price: number }>();
      (piData || []).forEach(pi => {
        const existing = piMap.get(pi.product_id);
        if (existing) {
          existing.quantity += pi.quantity;
        } else {
          piMap.set(pi.product_id, { quantity: pi.quantity, import_price: pi.import_price });
        }
      });

      // Products directly linked via products.import_receipt_id
      const directProductIds = new Set((products || []).map(p => p.id));

      // Find non-IMEI products referenced in product_imports but NOT in direct products list
      const missingProductIds = [...piMap.keys()].filter(pid => !directProductIds.has(pid));

      let extraProducts: typeof products = [];
      if (missingProductIds.length > 0) {
        const { data: extra } = await supabase
          .from('products')
          .select('id, name, sku, imei, import_price, quantity, unit, status, category_id, categories(name)')
          .in('id', missingProductIds);
        extraProducts = extra || [];
      }

      const allProducts = [...(products || []), ...extraProducts];

      const productItems = allProducts.map(p => {
        const piInfo = piMap.get(p.id);
        const originalQty = p.imei ? p.quantity : (piInfo?.quantity ?? p.quantity);
        return {
          id: p.id,
          import_price: (!p.imei && piInfo) ? piInfo.import_price : p.import_price,
          quantity: originalQty,
          original_import_quantity: originalQty,
          unit: p.unit,
          products: {
            id: p.id,
            name: p.name,
            sku: p.sku,
            imei: p.imei,
            status: p.status,
            category_id: p.category_id,
            categories: p.categories
          }
        };
      });

      return {
        receipt,
        payments: payments as ReceiptPayment[],
        productImports: productItems,
      };
    },
    enabled: !!receiptId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
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
      skipCashBook,
    }: {
      products: {
        name: string;
        sku: string;
        imei?: string | null;
        category_id?: string | null;
        import_price: number;
        sale_price?: number | null;
        quantity: number;
        unit?: string | null;
        supplier_id?: string | null;
        note?: string | null;
        group_id?: string | null;
        variant_1?: string | null;
        variant_2?: string | null;
        variant_3?: string | null;
      }[];
      payments: { type: PaymentType; amount: number }[];
      supplierId: string | null;
      branchId?: string | null;
      note?: string | null;
      skipCashBook?: boolean;
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
          original_debt_amount: debtAmount,
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
          .in('status', ['in_stock', 'warranty']);

        if (existingIMEIs && existingIMEIs.length > 0) {
          const existing = existingIMEIs[0];
          const statusText = existing.status === 'in_stock' ? 'tồn kho' : 'đang bảo hành';
          throw new Error(`IMEI "${existing.imei}" đã tồn tại trong kho (${existing.name} - ${existing.sku}, trạng thái: ${statusText}). Không thể nhập trùng.`);
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

      // =========== PHASE 2.5: Auto-create product_groups for variant products ===========
      const variantGroupMap = new Map<string, string>(); // baseName -> group_id
      const variantProducts = products.filter(p => p.variant_1 || p.variant_2 || p.variant_3);
      
      if (variantProducts.length > 0) {
        // Group by base name (product name without variant parts)
        const baseNames = new Set<string>();
        for (const p of variantProducts) {
          let baseName = p.name;
          if (p.variant_1) baseName = baseName.replace(p.variant_1, '').trim();
          if (p.variant_2) baseName = baseName.replace(p.variant_2, '').trim();
          if (p.variant_3) baseName = baseName.replace(p.variant_3, '').trim();
          baseNames.add(baseName);
        }

        for (const baseName of baseNames) {
          // Check if product_group already exists
          const { data: existingGroup } = await supabase
            .from('product_groups')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('name', baseName)
            .maybeSingle();

          if (existingGroup) {
            variantGroupMap.set(baseName, existingGroup.id);
          } else {
            // Collect all variant values for this base name
            const relatedProducts = variantProducts.filter(p => {
              let bn = p.name;
              if (p.variant_1) bn = bn.replace(p.variant_1, '').trim();
              if (p.variant_2) bn = bn.replace(p.variant_2, '').trim();
              if (p.variant_3) bn = bn.replace(p.variant_3, '').trim();
              return bn === baseName;
            });

            const v1Values = [...new Set(relatedProducts.map(p => p.variant_1).filter(Boolean))] as string[];
            const v2Values = [...new Set(relatedProducts.map(p => p.variant_2).filter(Boolean))] as string[];
            const v3Values = [...new Set(relatedProducts.map(p => p.variant_3).filter(Boolean))] as string[];

            const { data: newGroup, error: groupError } = await supabase
              .from('product_groups')
              .insert([{
                tenant_id: tenantId,
                name: baseName,
                variant_1_values: v1Values,
                variant_2_values: v2Values,
                variant_3_values: v3Values,
              } as any])
              .select('id')
              .single();

            if (groupError) {
              console.error('Failed to create product group:', groupError);
            } else if (newGroup) {
              variantGroupMap.set(baseName, newGroup.id);
            }
          }
        }

        // Assign group_id to variant products
        for (const p of products) {
          if (p.variant_1 || p.variant_2 || p.variant_3) {
            let baseName = p.name;
            if (p.variant_1) baseName = baseName.replace(p.variant_1, '').trim();
            if (p.variant_2) baseName = baseName.replace(p.variant_2, '').trim();
            if (p.variant_3) baseName = baseName.replace(p.variant_3, '').trim();
            const groupId = variantGroupMap.get(baseName);
            if (groupId) {
              (p as any).group_id = groupId;
            }
          }
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
          unit: 'cái',
          total_import_cost: p.import_price,
          supplier_id: supplierId,
          import_receipt_id: receipt.id,
          branch_id: branchId || null,
          tenant_id: tenantId,
          note: p.note,
          group_id: p.group_id || null,
          variant_1: p.variant_1 || null,
          variant_2: p.variant_2 || null,
          variant_3: p.variant_3 || null,
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
            unit: p.unit || 'cái',
            total_import_cost: totalCost,
            supplier_id: supplierId,
            import_receipt_id: receipt.id,
            branch_id: branchId || null,
            tenant_id: tenantId,
            note: p.note,
            group_id: p.group_id || null,
            variant_1: p.variant_1 || null,
            variant_2: p.variant_2 || null,
            variant_3: p.variant_3 || null,
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
              // NOT overwriting import_receipt_id - it stays linked to the original receipt.
              // All import history is tracked via product_imports table.
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

      if (cashBookEntries.length > 0 && !skipCashBook) {
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

      // Send push notification to other staff (fire-and-forget)
      const prodNames = products.slice(0, 3).map(p => p.name).join(', ');
      const moreText = products.length > 3 ? ` và ${products.length - 3} SP khác` : '';
      sendBusinessPush({
        title: `📦 Nhập hàng: ${code}`,
        message: `${prodNames}${moreText} - Tổng: ${formatVND(totalAmount)}`,
        url: '/import-history',
        tenantId,
        excludeUserId: user.id,
      });

      // Send email alert to admin (fire-and-forget)
      sendActivityAlert('import', tenantId, {
        code,
        supplierName: supplierName || 'Không xác định',
        items: products.map(p => ({ name: p.name, imei: p.imei || undefined, price: p.import_price, qty: p.quantity })),
        totalAmount,
        paidAmount,
        debtAmount,
      });

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
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-detail'] });
    },
  });
}

// Hook chỉnh sửa phiếu nhập (tên SP, danh mục, NCC, giá, ngày nhập)
export function useUpdateImportReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      productUpdates,
      newSupplierId,
      importDate,
    }: {
      receiptId: string;
      productUpdates: {
        productId: string;
        name?: string;
        category_id?: string | null;
        import_price?: number;
        oldImportPrice?: number;
        unit?: string;
        quantity?: number;
        hasImei?: boolean;
      }[];
      newSupplierId?: string | null;
      importDate?: string; // New ISO date string for import date change
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

      // Cập nhật ngày nhập nếu có thay đổi
      let oldImportDate: string | null = null;
      if (importDate) {
        // Get old date for audit log
        const { data: oldReceipt } = await supabase
          .from('import_receipts')
          .select('import_date')
          .eq('id', receiptId)
          .single();
        oldImportDate = oldReceipt?.import_date || null;

        // Update receipt date
        const { error: dateError } = await supabase
          .from('import_receipts')
          .update({ import_date: importDate, import_date_modified: true })
          .eq('id', receiptId);
        if (dateError) throw dateError;

        // Sync all products in this receipt
        const { error: productsDateError } = await supabase
          .from('products')
          .update({ import_date: importDate, import_date_modified: true })
          .eq('import_receipt_id', receiptId);
        if (productsDateError) throw productsDateError;

        // ★ Đồng bộ ngày vào sổ quỹ (cash_book)
        await supabase
          .from('cash_book')
          .update({ transaction_date: importDate })
          .eq('reference_id', receiptId)
          .eq('reference_type', 'import_receipt');

      }

      // Cập nhật từng sản phẩm
      let totalPriceDiff = 0;
      for (const update of productUpdates) {
        const updateData: Record<string, any> = {};
        
        if (update.name) updateData.name = update.name;
        if (update.category_id !== undefined) updateData.category_id = update.category_id;
        if (update.unit) updateData.unit = update.unit;
        if (update.import_price !== undefined) {
          const qty = update.quantity || 1;
          updateData.import_price = update.import_price;
          // For IMEI products, total_import_cost = import_price; for non-IMEI = import_price * quantity
          updateData.total_import_cost = update.hasImei ? update.import_price : update.import_price * qty;
          totalPriceDiff += (update.import_price - (update.oldImportPrice || 0)) * qty;
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
      const description = importDate && oldImportDate
        ? `Sửa phiếu nhập — Ngày nhập: ${oldImportDate.substring(0, 16).replace('T', ' ')} → ${importDate.substring(0, 16).replace('T', ' ')}${totalPriceDiff !== 0 ? `, Thay đổi giá: ${totalPriceDiff.toLocaleString('vi-VN')}đ` : ''}`
        : `Sửa phiếu nhập - Thay đổi giá: ${totalPriceDiff.toLocaleString('vi-VN')}đ`;

      await supabase.from('audit_logs').insert([{
        user_id: user.id,
        action_type: importDate ? 'UPDATE_IMPORT_DATE' : 'update',
        table_name: 'import_receipts',
        record_id: receiptId,
        old_data: { 
          product_updates_count: productUpdates.length,
          import_date: oldImportDate,
        },
        new_data: {
          supplier_id: newSupplierId,
          price_difference: totalPriceDiff,
          import_date: importDate || undefined,
          products_updated: productUpdates.map(u => ({
            productId: u.productId,
            old_price: u.oldImportPrice,
            new_price: u.import_price,
          })),
        },
        description,
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
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-detail'] });
      queryClient.invalidateQueries({ queryKey: ['detailed-profit-report'] });
      queryClient.invalidateQueries({ queryKey: ['product-report'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['daily-stats'] });
    },
  });
}

// Hook trả hàng toàn bộ phiếu nhập
export function useReturnImportReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      feeType = 'none',
      feePercentage = 0,
      feeAmount = 0,
      payments,
      recordToCashBook = true,
      note,
      returnQuantities,
    }: {
      receiptId: string;
      feeType?: 'none' | 'percentage' | 'fixed_amount';
      feePercentage?: number;
      feeAmount?: number;
      payments: { source: string; amount: number }[];
      recordToCashBook?: boolean;
      note?: string | null;
      returnQuantities?: Record<string, number>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');

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

      // Tạo phiếu trả hàng cho từng sản phẩm (tính theo quantity)
      // Sử dụng returnQuantities nếu có (cho phép trả một phần)
      // Tính tổng giá trị nhập thực tế
      const totalImportAll = products.reduce((s: number, p: any) => {
        const qty = p.imei ? 1 : (returnQuantities?.[p.id] ?? (Number(p.quantity) || 1));
        return s + Number(p.import_price) * qty;
      }, 0);

      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const qty = product.imei ? 1 : (returnQuantities?.[product.id] ?? (Number(product.quantity) || 1));
        const productTotalCost = Number(product.import_price) * qty;
        const code = products.length === 1 ? baseCode : `${baseCode}_${i + 1}`;

        // Calculate per-product refund based on fee
        const productRatio = totalImportAll > 0 ? productTotalCost / totalImportAll : 0;
        let productRefund = productTotalCost;
        let productFeeAmount = 0;
        if (feeType === 'percentage') {
          productFeeAmount = productTotalCost * feePercentage / 100;
          productRefund = productTotalCost - productFeeAmount;
        } else if (feeType === 'fixed_amount') {
          productFeeAmount = feeAmount * productRatio;
          productRefund = productTotalCost - productFeeAmount;
        }

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
            quantity: qty,
            original_import_date: product.import_date,
            total_refund_amount: productRefund,
            fee_type: feeType,
            fee_percentage: feePercentage,
            fee_amount: productFeeAmount,
            note: note || `Trả hàng phiếu ${receipt.code}`,
            created_by: user.id,
            tenant_id: tenantId,
          }])
          .select()
          .single();

        if (returnError) throw returnError;
        returnIds.push(returnData.id);

        // Cập nhật trạng thái sản phẩm
        if (product.imei) {
          await supabase
            .from('products')
            .update({ status: 'returned' })
            .eq('id', product.id);
        } else {
          // Non-IMEI: trừ số lượng trả, nếu hết thì chuyển returned
          const currentQty = Number(product.quantity) || 0;
          const newQty = Math.max(0, currentQty - qty);
          const newStatus = newQty <= 0 ? 'returned' : 'in_stock';
          await supabase
            .from('products')
            .update({ status: newStatus, quantity: newQty })
            .eq('id', product.id);
        }
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
              tenant_id: tenantId,
            }]);
        }

        if (payment.source === 'debt') {
          if (!receipt.supplier_id) {
            throw new Error('Không xác định được nhà cung cấp để giảm công nợ');
          }

          // Get current supplier debt
          const { data: debtReceipts } = await supabase
            .from('import_receipts')
            .select('debt_amount')
            .eq('supplier_id', receipt.supplier_id)
            .eq('status', 'completed')
            .gt('debt_amount', 0);

          const { data: debtAdditions } = await supabase
            .from('debt_payments')
            .select('amount, allocated_amount')
            .eq('entity_type', 'supplier')
            .eq('entity_id', receipt.supplier_id)
            .eq('payment_type', 'addition');

          const totalReceiptDebt = (debtReceipts || []).reduce((s, r) => s + Number(r.debt_amount), 0);
          const totalAdditionDebt = (debtAdditions || []).reduce((s, a) => s + Number(a.amount) - (Number(a.allocated_amount) || 0), 0);
          const currentDebt = totalReceiptDebt + totalAdditionDebt;
          const newDebt = Math.max(0, currentDebt - payment.amount);

          const { error: debtPaymentError } = await supabase
            .from('debt_payments')
            .insert([{
              entity_type: 'supplier',
              entity_id: receipt.supplier_id,
              payment_type: 'payment',
              amount: payment.amount,
              payment_source: 'debt',
              description: `Giảm công nợ - Trả hàng nhập phiếu: ${receipt.code}`,
              branch_id: receipt.branch_id,
              created_by: user.id,
              tenant_id: tenantId,
              balance_after: newDebt,
            }]);

          if (debtPaymentError) throw debtPaymentError;

          // FIFO allocation on supplier debt
          let remainingPayment = payment.amount;

          const { data: unpaidReceipts } = await supabase
            .from('import_receipts')
            .select('id, import_date, debt_amount, paid_amount')
            .eq('supplier_id', receipt.supplier_id)
            .eq('status', 'completed')
            .gt('debt_amount', 0)
            .order('import_date', { ascending: true });

          const { data: unpaidAdditions } = await supabase
            .from('debt_payments')
            .select('id, amount, allocated_amount, created_at')
            .eq('entity_type', 'supplier')
            .eq('entity_id', receipt.supplier_id)
            .eq('payment_type', 'addition')
            .order('created_at', { ascending: true });

          type DebtItem = { kind: 'order'; id: string; date: number; unpaid: number; paidAmount: number }
            | { kind: 'addition'; id: string; date: number; unpaid: number; currentAllocated: number };
          const timeline: DebtItem[] = [];

          for (const o of (unpaidReceipts || [])) {
            timeline.push({ kind: 'order', id: o.id, date: new Date(o.import_date).getTime(), unpaid: Number(o.debt_amount), paidAmount: Number(o.paid_amount) });
          }
          for (const a of (unpaidAdditions || [])) {
            const total = Number(a.amount);
            const allocated = Number(a.allocated_amount) || 0;
            const unpaid = total - allocated;
            if (unpaid > 0) {
              timeline.push({ kind: 'addition', id: a.id, date: new Date(a.created_at).getTime(), unpaid, currentAllocated: allocated });
            }
          }
          timeline.sort((a, b) => a.date - b.date);

          for (const dItem of timeline) {
            if (remainingPayment <= 0) break;
            const payAmount = Math.min(remainingPayment, dItem.unpaid);
            if (dItem.kind === 'order') {
              await supabase
                .from('import_receipts')
                .update({ paid_amount: dItem.paidAmount + payAmount, debt_amount: dItem.unpaid - payAmount })
                .eq('id', dItem.id);
            } else {
              await supabase
                .from('debt_payments')
                .update({ allocated_amount: dItem.currentAllocated + payAmount })
                .eq('id', dItem.id);
            }
            remainingPayment -= payAmount;
          }
        }

        // Ghi sổ quỹ (thu tiền từ NCC) - 1 dòng gom cho cả phiếu
        if (recordToCashBook && payment.source !== 'debt') {
          const productDetails = products.map(p => 
            `${p.name}${p.imei ? ` (IMEI: ${p.imei})` : ''}: ${Number(p.import_price).toLocaleString('vi-VN')}đ`
          ).join('\n');

          await supabase
            .from('cash_book')
            .insert([{
              type: 'income' as const,
              category: 'Tra hang nhap',
              description: `Trả hàng phiếu nhập ${receipt.code} (${products.length} SP)`,
              amount: payment.amount,
              payment_source: payment.source,
              is_business_accounting: false,
              branch_id: receipt.branch_id,
              reference_id: receiptId,
              reference_type: 'import_return',
              created_by: user.id,
              note: productDetails,
              tenant_id: tenantId,
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
        tenant_id: tenantId,
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
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-detail'] });
    },
  });
}

// Hook xóa toàn bộ phiếu nhập (receipt + products + cash_book + product_imports + debt_payments)
export function useDeleteImportReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ receiptId, deleteCashBook = true, deleteDebt = true }: { receiptId: string; deleteCashBook?: boolean; deleteDebt?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy doanh nghiệp');

      // 1. Fetch receipt info for audit log
      const { data: receipt, error: receiptError } = await supabase
        .from('import_receipts')
        .select('*, suppliers(name), branches(name)')
        .eq('id', receiptId)
        .single();
      if (receiptError || !receipt) throw new Error('Không tìm thấy phiếu nhập');

      // 2. Fetch products in this receipt
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku, imei, import_price, quantity, status')
        .eq('import_receipt_id', receiptId);

      const productIds = (products || []).map(p => p.id);
      const oldData = {
        code: receipt.code,
        import_date: receipt.import_date,
        total_amount: receipt.total_amount,
        paid_amount: receipt.paid_amount,
        debt_amount: receipt.debt_amount,
        supplier: (receipt.suppliers as any)?.name || null,
        branch: (receipt.branches as any)?.name || null,
        products_count: productIds.length,
        delete_cash_book: deleteCashBook,
        delete_debt: deleteDebt,
        products: (products || []).map(p => ({
          name: p.name, sku: p.sku, imei: p.imei,
          price: p.import_price, qty: p.quantity, status: p.status,
        })),
      };

      // 3. Delete related records in correct order
      if (productIds.length > 0) {
        // Delete all FK-dependent records first (batch 200)
        for (let i = 0; i < productIds.length; i += 200) {
          const chunk = productIds.slice(i, i + 200);
          await supabase.from('export_receipt_items').delete().in('product_id', chunk);
          await supabase.from('export_returns').delete().in('product_id', chunk);
          await supabase.from('import_returns').delete().in('product_id', chunk);
          await supabase.from('imei_histories').delete().in('product_id', chunk);
          await supabase.from('stock_count_items').delete().in('product_id', chunk);
          await supabase.from('stock_transfer_items').delete().in('product_id', chunk);
          // product_imports has ON DELETE CASCADE, but delete explicitly to be safe
          await supabase.from('product_imports').delete().in('product_id', chunk);
        }
      }

      // cash_book entries linked to this receipt (optional)
      if (deleteCashBook) {
        await supabase.from('cash_book').delete()
          .eq('reference_id', receiptId)
          .eq('reference_type', 'import_receipt');
      }

      // debt_payments linked to this receipt (optional)
      if (deleteDebt && receipt.supplier_id) {
        await (supabase.from('debt_payments').delete() as any)
          .eq('entity_id', receipt.supplier_id)
          .eq('entity_type', 'supplier')
          .eq('description', `Thanh toán phiếu nhập ${receipt.code}`);
      }

      // products - now safe to delete after all references removed
      if (productIds.length > 0) {
        for (let i = 0; i < productIds.length; i += 200) {
          const chunk = productIds.slice(i, i + 200);
          const { error: delErr } = await supabase.from('products').delete().in('id', chunk);
          if (delErr) console.error('Error deleting products chunk:', delErr);
        }
      }

      // import_receipt itself
      const { error: deleteError } = await supabase
        .from('import_receipts')
        .delete()
        .eq('id', receiptId);
      if (deleteError) throw deleteError;

      // 4. Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user.id,
        action_type: 'DELETE_IMPORT_RECEIPT',
        table_name: 'import_receipts',
        record_id: receiptId,
        branch_id: receipt.branch_id,
        tenant_id: tenantId,
        old_data: oldData,
        description: `Xóa phiếu nhập ${receipt.code} - ${productIds.length} sản phẩm - Tổng: ${Number(receipt.total_amount).toLocaleString('vi-VN')}đ`,
      }]);

      return { code: receipt.code, productsDeleted: productIds.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['all-products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-detail'] });
    },
  });
}
