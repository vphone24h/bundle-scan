import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

interface AddProductInput {
  name: string;
  sku: string;
  imei?: string | null;
  category_id?: string | null;
  import_price: number;
  sale_price?: number | null;
  quantity: number;
  unit?: string | null;
  variant_1?: string | null;
  variant_2?: string | null;
  variant_3?: string | null;
  note?: string | null;
}

interface AddPaymentInput {
  type: 'cash' | 'bank_card' | 'e_wallet' | 'debt' | string;
  amount: number;
}

export function useAddProductsToReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      products,
      payments = [],
      skipCashBook = false,
    }: {
      receiptId: string;
      products: AddProductInput[];
      payments?: AddPaymentInput[];
      skipCashBook?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Fetch receipt info
      const { data: receipt, error: rErr } = await supabase
        .from('import_receipts')
        .select('id, code, total_amount, paid_amount, debt_amount, supplier_id, branch_id, status')
        .eq('id', receiptId)
        .single();
      if (rErr || !receipt) throw new Error('Không tìm thấy phiếu nhập');
      if (receipt.status !== 'completed') throw new Error('Phiếu nhập đã huỷ, không thể thêm sản phẩm');

      const supplierId = receipt.supplier_id;
      const branchId = receipt.branch_id;

      // Validate IMEIs
      const imeiProducts = products.filter(p => p.imei);
      if (imeiProducts.length > 0) {
        const imeis = imeiProducts.map(p => p.imei!);
        const { data: existing } = await supabase
          .from('products')
          .select('imei, name, status')
          .in('imei', imeis)
          .eq('tenant_id', tenantId)
          .in('status', ['in_stock', 'warranty']);
        if (existing && existing.length > 0) {
          throw new Error(`IMEI "${existing[0].imei}" đã tồn tại trong kho (${existing[0].name})`);
        }
      }

      // Check existing non-IMEI products for merging
      const nonImeiProducts = products.filter(p => !p.imei);
      const nonImeiMap = new Map<string, { id: string; quantity: number; total_import_cost: number }>();

      if (nonImeiProducts.length > 0) {
        const { data: existingNonImei } = await supabase
          .from('products')
          .select('id, name, sku, quantity, total_import_cost')
          .eq('branch_id', branchId || '')
          .eq('status', 'in_stock')
          .is('imei', null)
          .eq('tenant_id', tenantId);

        existingNonImei?.forEach(p => {
          nonImeiMap.set(`${p.name}|||${p.sku}`, {
            id: p.id,
            quantity: p.quantity,
            total_import_cost: Number(p.total_import_cost) || 0,
          });
        });
      }

      // Prepare new products and updates
      const newProducts: any[] = [];
      const productImportsToCreate: any[] = [];
      const updateAccumulator = new Map<string, { id: string; quantity: number; totalCost: number }>();
      let addedAmount = 0;

      for (const p of imeiProducts) {
        addedAmount += p.import_price;
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
          import_receipt_id: receiptId,
          branch_id: branchId,
          tenant_id: tenantId,
          variant_1: p.variant_1 || null,
          variant_2: p.variant_2 || null,
          variant_3: p.variant_3 || null,
          note: p.note || null,
        });
      }

      for (const p of nonImeiProducts) {
        addedAmount += p.import_price * p.quantity;
        const key = `${p.name}|||${p.sku}`;
        const existing = nonImeiMap.get(key);

        if (existing) {
          if (!updateAccumulator.has(key)) {
            updateAccumulator.set(key, {
              id: existing.id,
              quantity: existing.quantity,
              totalCost: existing.total_import_cost,
            });
          }
          const acc = updateAccumulator.get(key)!;
          acc.quantity += p.quantity;
          acc.totalCost += p.import_price * p.quantity;

          productImportsToCreate.push({
            existingProductId: existing.id,
            quantity: p.quantity,
            import_price: p.import_price,
          });
        } else {
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
            import_receipt_id: receiptId,
            branch_id: branchId,
            tenant_id: tenantId,
            variant_1: p.variant_1 || null,
            variant_2: p.variant_2 || null,
            variant_3: p.variant_3 || null,
            note: p.note || null,
          });
        }
      }

      // Insert new products
      let insertedProducts: any[] = [];
      if (newProducts.length > 0) {
        const { data: inserted, error } = await supabase
          .from('products')
          .insert(newProducts)
          .select('id, name, sku, imei, import_price, quantity');
        if (error) throw error;
        insertedProducts = inserted || [];
      }

      // Update existing non-IMEI products
      for (const [, acc] of updateAccumulator) {
        const newAvgPrice = acc.totalCost / acc.quantity;
        await supabase
          .from('products')
          .update({
            quantity: acc.quantity,
            total_import_cost: acc.totalCost,
            import_price: newAvgPrice,
          })
          .eq('id', acc.id);
      }

      // Create product_imports records
      const allProductImports: any[] = [];

      for (const inserted of insertedProducts) {
        allProductImports.push({
          product_id: inserted.id,
          import_receipt_id: receiptId,
          quantity: inserted.quantity,
          import_price: inserted.import_price,
          supplier_id: supplierId,
          created_by: user.id,
        });
      }

      for (const rec of productImportsToCreate) {
        allProductImports.push({
          product_id: rec.existingProductId,
          import_receipt_id: receiptId,
          quantity: rec.quantity,
          import_price: rec.import_price,
          supplier_id: supplierId,
          created_by: user.id,
        });
      }

      if (allProductImports.length > 0) {
        await supabase.from('product_imports').insert(allProductImports);
      }

      // Compute payment totals for the additional amount
      const nonDebtPayments = payments.filter(p => p.type !== 'debt' && p.amount > 0);
      const addedPaid = nonDebtPayments.reduce((s, p) => s + p.amount, 0);
      const addedDebt = Math.max(0, addedAmount - addedPaid);

      // Update receipt totals (total + paid + debt accumulate)
      const newTotal = Number(receipt.total_amount) + addedAmount;
      const newPaid = Number(receipt.paid_amount || 0) + addedPaid;
      const newDebt = Number(receipt.debt_amount || 0) + addedDebt;
      await supabase
        .from('import_receipts')
        .update({ total_amount: newTotal, paid_amount: newPaid, debt_amount: newDebt })
        .eq('id', receiptId);

      // Insert receipt_payments rows for this addition
      if (payments.length > 0) {
        const rows = payments
          .filter(p => p.amount > 0)
          .map(p => ({ receipt_id: receiptId, payment_type: p.type, amount: p.amount }));
        if (rows.length > 0) {
          await supabase.from('receipt_payments').insert(rows);
        }
      }

      // Cash book entries for non-debt payments
      if (nonDebtPayments.length > 0 && !skipCashBook) {
        // Get supplier name for recipient
        let supplierName: string | null = null;
        if (supplierId) {
          const { data: sup } = await supabase
            .from('suppliers').select('name').eq('id', supplierId).maybeSingle();
          supplierName = sup?.name || null;
        }
        // Get staff name
        let staffName: string | null = null;
        const { data: prof } = await supabase
          .from('profiles').select('display_name').eq('id', user.id).maybeSingle();
        staffName = prof?.display_name || null;

        await supabase.from('cash_book').insert(nonDebtPayments.map(p => ({
          type: 'expense' as const,
          category: 'Nhập hàng',
          description: `Thanh toán bổ sung phiếu nhập ${receipt.code}`,
          amount: p.amount,
          payment_source: p.type,
          is_business_accounting: false,
          branch_id: branchId || null,
          reference_id: receiptId,
          reference_type: 'import_receipt',
          created_by: user.id,
          tenant_id: tenantId,
          created_by_name: staffName,
          recipient_name: supplierName,
        })));
      }

      // Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user.id,
        action_type: 'add_products',
        table_name: 'import_receipts',
        record_id: receiptId,
        branch_id: branchId,
        new_data: {
          code: receipt.code,
          added_products: products.length,
          added_amount: addedAmount,
          added_paid: addedPaid,
          added_debt: addedDebt,
          new_total: newTotal,
          new_paid: newPaid,
          new_debt: newDebt,
        },
        description: `Thêm ${products.length} SP vào phiếu nhập ${receipt.code} - Thêm: ${addedAmount.toLocaleString('vi-VN')}đ (TT: ${addedPaid.toLocaleString('vi-VN')}đ, Nợ: ${addedDebt.toLocaleString('vi-VN')}đ)`,
      }]);

      return { code: receipt.code, addedCount: products.length, addedAmount, addedPaid, addedDebt };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['import-receipt'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['all-products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-detail'] });
    },
  });
}
