import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type StockCountStatus = 'draft' | 'confirmed';
export type StockCountScope = 'all' | 'category' | 'product';
export type StockCountItemStatus = 'ok' | 'missing' | 'surplus' | 'pending';

export interface StockCount {
  id: string;
  code: string;
  branchId: string | null;
  branchName: string | null;
  countDate: string;
  createdBy: string;
  createdByName: string | null;
  confirmedBy: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  scope: StockCountScope;
  scopeCategoryId: string | null;
  status: StockCountStatus;
  note: string | null;
  totalSystemQuantity: number;
  totalActualQuantity: number;
  totalVariance: number;
  adjustmentImportReceiptId: string | null;
  adjustmentExportReceiptId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockCountItem {
  id: string;
  stockCountId: string;
  productId: string | null;
  productName: string;
  sku: string;
  imei: string | null;
  hasImei: boolean;
  systemQuantity: number;
  actualQuantity: number;
  variance: number;
  status: StockCountItemStatus;
  isChecked: boolean;
  importPrice: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStockCountData {
  branchId: string | null;
  countDate: string;
  scope: StockCountScope;
  scopeCategoryId?: string | null;
  scopeProductIds?: string[];
  note?: string;
}

export function useStockCounts(filters?: {
  branchId?: string;
  status?: StockCountStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  const { user } = useAuth();
  return useQuery({
    // Keyed by user to prevent cross-tenant cache leakage
    queryKey: ['stock-counts', user?.id, filters],
    queryFn: async () => {
      let query = supabase
        .from('stock_counts')
        .select(`
          *,
          branches(name)
        `)
        .order('created_at', { ascending: false });

      if (filters?.branchId) {
        query = query.eq('branch_id', filters.branchId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.startDate) {
        query = query.gte('count_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('count_date', filters.endDate);
      }
      if (filters?.search) {
        query = query.or(`code.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch profile names for creators and confirmers
      const userIds = new Set<string>();
      data?.forEach((item) => {
        if (item.created_by) userIds.add(item.created_by);
        if (item.confirmed_by) userIds.add(item.confirmed_by);
      });

      let profilesMap: Record<string, string> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', Array.from(userIds));
        
        if (profiles) {
          profilesMap = Object.fromEntries(
            profiles.map((p) => [p.user_id, p.display_name])
          );
        }
      }

      return data?.map((item) => ({
        id: item.id,
        code: item.code,
        branchId: item.branch_id,
        branchName: item.branches?.name || null,
        countDate: item.count_date,
        createdBy: item.created_by,
        createdByName: profilesMap[item.created_by] || null,
        confirmedBy: item.confirmed_by,
        confirmedByName: item.confirmed_by ? profilesMap[item.confirmed_by] || null : null,
        confirmedAt: item.confirmed_at,
        scope: item.scope as StockCountScope,
        scopeCategoryId: item.scope_category_id,
        status: item.status as StockCountStatus,
        note: item.note,
        totalSystemQuantity: item.total_system_quantity,
        totalActualQuantity: item.total_actual_quantity,
        totalVariance: item.total_variance,
        adjustmentImportReceiptId: item.adjustment_import_receipt_id,
        adjustmentExportReceiptId: item.adjustment_export_receipt_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })) as StockCount[];
    },
  });
}

export function useStockCountDetail(id: string | null) {
  return useQuery({
    queryKey: ['stock-count', id],
    queryFn: async () => {
      if (!id) return null;

      const { data: stockCount, error } = await supabase
        .from('stock_counts')
        .select(`
          *,
          branches(name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!stockCount) return null;

      // Fetch profile names
      const userIds = [stockCount.created_by];
      if (stockCount.confirmed_by) userIds.push(stockCount.confirmed_by);
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);
      
      const profilesMap: Record<string, string> = {};
      profiles?.forEach((p) => {
        profilesMap[p.user_id] = p.display_name;
      });

      const { data: items, error: itemsError } = await supabase
        .from('stock_count_items')
        .select('*')
        .eq('stock_count_id', id)
        .order('product_name', { ascending: true });

      if (itemsError) throw itemsError;

      return {
        stockCount: {
          id: stockCount.id,
          code: stockCount.code,
          branchId: stockCount.branch_id,
          branchName: stockCount.branches?.name || null,
          countDate: stockCount.count_date,
          createdBy: stockCount.created_by,
          createdByName: profilesMap[stockCount.created_by] || null,
          confirmedBy: stockCount.confirmed_by,
          confirmedByName: stockCount.confirmed_by ? profilesMap[stockCount.confirmed_by] || null : null,
          confirmedAt: stockCount.confirmed_at,
          scope: stockCount.scope as StockCountScope,
          scopeCategoryId: stockCount.scope_category_id,
          status: stockCount.status as StockCountStatus,
          note: stockCount.note,
          totalSystemQuantity: stockCount.total_system_quantity,
          totalActualQuantity: stockCount.total_actual_quantity,
          totalVariance: stockCount.total_variance,
          adjustmentImportReceiptId: stockCount.adjustment_import_receipt_id,
          adjustmentExportReceiptId: stockCount.adjustment_export_receipt_id,
          createdAt: stockCount.created_at,
          updatedAt: stockCount.updated_at,
        } as StockCount,
        items: items?.map((item) => ({
          id: item.id,
          stockCountId: item.stock_count_id,
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
          imei: item.imei,
          hasImei: item.has_imei,
          systemQuantity: item.system_quantity,
          actualQuantity: item.actual_quantity,
          variance: item.variance,
          status: item.status as StockCountItemStatus,
          isChecked: item.is_checked,
          importPrice: item.import_price,
          note: item.note,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })) as StockCountItem[],
      };
    },
    enabled: !!id,
  });
}

export function useCreateStockCount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateStockCountData) => {
      if (!user) throw new Error('User not authenticated');

      // Get tenant_id
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Generate unique code
      const code = `KK${Date.now().toString().slice(-8)}`;

      // Create stock count
      const { data: stockCount, error } = await supabase
        .from('stock_counts')
        .insert({
          code,
          tenant_id: tenantId,
          branch_id: data.branchId || null,
          count_date: data.countDate,
          created_by: user.id,
          scope: data.scope,
          scope_category_id: data.scopeCategoryId || null,
          note: data.note || null,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;

      // Load products based on scope
      let productsQuery = supabase
        .from('products')
        .select('*')
        .eq('status', 'in_stock');

      if (data.branchId) {
        productsQuery = productsQuery.eq('branch_id', data.branchId);
      }

      if (data.scope === 'category' && data.scopeCategoryId) {
        productsQuery = productsQuery.eq('category_id', data.scopeCategoryId);
      }

      if (data.scope === 'product' && data.scopeProductIds?.length) {
        // For product scope, we need to match by name+sku combination
        // This is handled differently - we'll filter by product IDs
        productsQuery = productsQuery.in('id', data.scopeProductIds);
      }

      const { data: products, error: productsError } = await productsQuery;

      if (productsError) throw productsError;

      // Group products for non-IMEI items
      const itemsMap = new Map<string, {
        productId: string | null;
        productName: string;
        sku: string;
        hasImei: boolean;
        importPrice: number;
        imeis: string[];
      }>();

      products?.forEach((product) => {
        if (product.imei) {
          // IMEI product - each is a separate item
          const key = `imei:${product.imei}`;
          itemsMap.set(key, {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            hasImei: true,
            importPrice: product.import_price,
            imeis: [product.imei],
          });
        } else {
          // Non-IMEI product - group by name+sku
          const key = `noImei:${product.name}:${product.sku}`;
          const existing = itemsMap.get(key);
          if (existing) {
            existing.imeis.push(product.id); // Use as count
          } else {
            itemsMap.set(key, {
              productId: null,
              productName: product.name,
              sku: product.sku,
              hasImei: false,
              importPrice: product.import_price,
              imeis: [product.id],
            });
          }
        }
      });

      // Insert stock count items
      const stockCountItems = Array.from(itemsMap.entries()).map(([key, item]) => ({
        stock_count_id: stockCount.id,
        product_id: item.productId,
        product_name: item.productName,
        sku: item.sku,
        imei: item.hasImei ? item.imeis[0] : null,
        has_imei: item.hasImei,
        system_quantity: item.hasImei ? 1 : item.imeis.length,
        actual_quantity: 0,
        variance: item.hasImei ? -1 : -item.imeis.length,
        status: 'pending' as const,
        is_checked: false,
        import_price: item.importPrice,
      }));

      if (stockCountItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('stock_count_items')
          .insert(stockCountItems);

        if (itemsError) throw itemsError;
      }

      // Update totals
      const totalSystem = stockCountItems.reduce((sum, item) => sum + item.system_quantity, 0);
      const totalActual = 0;
      const totalVariance = -totalSystem;

      await supabase
        .from('stock_counts')
        .update({
          total_system_quantity: totalSystem,
          total_actual_quantity: totalActual,
          total_variance: totalVariance,
        })
        .eq('id', stockCount.id);

      // Audit log
      await supabase.from('audit_logs').insert([{
        user_id: user.id,
        action_type: 'create',
        table_name: 'stock_counts',
        record_id: stockCount.id,
        branch_id: data.branchId || null,
        new_data: {
          code: stockCount.code,
          scope: data.scope,
          items_count: stockCountItems.length,
          total_system_quantity: totalSystem,
        },
        description: `Tạo phiếu kiểm kho ${stockCount.code} - ${stockCountItems.length} sản phẩm`,
      }]);

      return stockCount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
      toast({
        title: 'Tạo phiếu thành công',
        description: 'Phiếu kiểm kho đã được tạo',
      });
    },
    onError: (error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateStockCountItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      actualQuantity,
      isChecked,
      stockCountId,
      note,
    }: {
      itemId: string;
      actualQuantity?: number;
      isChecked?: boolean;
      stockCountId?: string;
      note?: string;
    }) => {
      // If only updating note, do a simple update
      if (note !== undefined && actualQuantity === undefined && isChecked === undefined) {
        const { data: item } = await supabase
          .from('stock_count_items')
          .select('stock_count_id')
          .eq('id', itemId)
          .single();
        
        await supabase
          .from('stock_count_items')
          .update({ note })
          .eq('id', itemId);
        
        return stockCountId || item?.stock_count_id;
      }
      // Get current item to compute status
      const { data: item, error: fetchError } = await supabase
        .from('stock_count_items')
        .select('system_quantity, has_imei, is_checked, stock_count_id')
        .eq('id', itemId)
        .single();

      if (fetchError) throw fetchError;

      const newActual = actualQuantity !== undefined ? actualQuantity : (isChecked ? 1 : 0);
      const variance = newActual - item.system_quantity;
      
      let status: StockCountItemStatus = 'pending';
      if (item.has_imei) {
        status = isChecked ? 'ok' : 'missing';
      } else {
        if (variance === 0) status = 'ok';
        else if (variance < 0) status = 'missing';
        else status = 'surplus';
      }

      // Update item and recalculate totals in parallel
      const scId = stockCountId || item.stock_count_id;

      const updateItemPromise = supabase
        .from('stock_count_items')
        .update({
          actual_quantity: newActual,
          variance,
          status,
          is_checked: isChecked ?? item.is_checked,
          ...(note !== undefined ? { note } : {}),
        })
        .eq('id', itemId);

      const fetchTotalsPromise = supabase
        .from('stock_count_items')
        .select('system_quantity, actual_quantity, variance, id')
        .eq('stock_count_id', scId);

      const [updateResult, totalsResult] = await Promise.all([updateItemPromise, fetchTotalsPromise]);
      if (updateResult.error) throw updateResult.error;

      if (totalsResult.data) {
        // Apply current change to the fetched data (it may not reflect our update yet)
        const totals = totalsResult.data.reduce(
          (acc, i) => {
            const qty = i.id === itemId ? newActual : i.actual_quantity;
            const v = i.id === itemId ? variance : i.variance;
            return {
              system: acc.system + i.system_quantity,
              actual: acc.actual + qty,
              variance: acc.variance + v,
            };
          },
          { system: 0, actual: 0, variance: 0 }
        );

        await supabase
          .from('stock_counts')
          .update({
            total_system_quantity: totals.system,
            total_actual_quantity: totals.actual,
            total_variance: totals.variance,
          })
          .eq('id', scId);
      }

      return scId;
    },
    onMutate: async ({ itemId, actualQuantity, isChecked, note }) => {
      // Optimistic update - update UI immediately
      const queries = queryClient.getQueriesData<{ stockCount: StockCount; items: StockCountItem[] }>({ queryKey: ['stock-count'] });
      
      for (const [queryKey, data] of queries) {
        if (!data?.items) continue;
        const itemIndex = data.items.findIndex(i => i.id === itemId);
        if (itemIndex === -1) continue;

        await queryClient.cancelQueries({ queryKey });
        const previousData = data;

        const updatedItems = [...data.items];
        const item = { ...updatedItems[itemIndex] };
        if (note !== undefined) {
          item.note = note;
        }
        if (actualQuantity !== undefined || isChecked !== undefined) {
          const newActual = actualQuantity !== undefined ? actualQuantity : (isChecked ? 1 : 0);
          item.actualQuantity = newActual;
          item.variance = newActual - item.systemQuantity;
          item.isChecked = isChecked ?? item.isChecked;
          if (item.hasImei) {
            item.status = isChecked ? 'ok' : 'missing';
          } else {
            item.status = item.variance === 0 ? 'ok' : item.variance < 0 ? 'missing' : 'surplus';
          }
        }
        updatedItems[itemIndex] = item;

        const totalActual = updatedItems.reduce((s, i) => s + i.actualQuantity, 0);
        const totalVariance = updatedItems.reduce((s, i) => s + i.variance, 0);

        queryClient.setQueryData(queryKey, {
          stockCount: {
            ...data.stockCount,
            totalActualQuantity: totalActual,
            totalVariance: totalVariance,
          },
          items: updatedItems,
        });

        return { previousData, queryKey };
      }
    },
    onError: (_err, _vars, context: any) => {
      // Rollback on error
      if (context?.previousData && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },
    onSettled: (_data, _err, _vars, context: any) => {
      // Background refetch to sync with server
      if (context?.queryKey) {
        queryClient.invalidateQueries({ queryKey: context.queryKey });
      }
      queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
    },
  });
}

export function useAddSurplusImei() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      stockCountId,
      imei,
      productName,
      sku,
    }: {
      stockCountId: string;
      imei: string;
      productName: string;
      sku: string;
    }) => {
      // Check if IMEI already exists in this stock count
      const { data: existing } = await supabase
        .from('stock_count_items')
        .select('id')
        .eq('stock_count_id', stockCountId)
        .eq('imei', imei)
        .maybeSingle();

      if (existing) {
        throw new Error('IMEI này đã có trong phiếu kiểm kho');
      }

      // Add as surplus item
      const { error } = await supabase
        .from('stock_count_items')
        .insert({
          stock_count_id: stockCountId,
          product_id: null,
          product_name: productName,
          sku,
          imei,
          has_imei: true,
          system_quantity: 0,
          actual_quantity: 1,
          variance: 1,
          status: 'surplus',
          is_checked: true,
          import_price: 0,
        });

      if (error) throw error;

      // Update totals
      const { data: allItems } = await supabase
        .from('stock_count_items')
        .select('system_quantity, actual_quantity, variance')
        .eq('stock_count_id', stockCountId);

      if (allItems) {
        const totals = allItems.reduce(
          (acc, i) => ({
            system: acc.system + i.system_quantity,
            actual: acc.actual + i.actual_quantity,
            variance: acc.variance + i.variance,
          }),
          { system: 0, actual: 0, variance: 0 }
        );

        await supabase
          .from('stock_counts')
          .update({
            total_system_quantity: totals.system,
            total_actual_quantity: totals.actual,
            total_variance: totals.variance,
          })
          .eq('id', stockCountId);
      }

      return stockCountId;
    },
    onSuccess: (stockCountId) => {
      queryClient.invalidateQueries({ queryKey: ['stock-count', stockCountId] });
      queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
      toast({
        title: 'Đã thêm IMEI dư',
        description: 'IMEI được đánh dấu là hàng dư',
      });
    },
    onError: (error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useConfirmStockCount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (stockCountId: string) => {
      if (!user) throw new Error('User not authenticated');

      // Get stock count and items
      const { data: stockCount, error: scError } = await supabase
        .from('stock_counts')
        .select('*')
        .eq('id', stockCountId)
        .single();

      if (scError) throw scError;

      const { data: items, error: itemsError } = await supabase
        .from('stock_count_items')
        .select('*')
        .eq('stock_count_id', stockCountId);

      if (itemsError) throw itemsError;

      // Separate missing and surplus items
      const missingItems = items?.filter((item) => item.variance < 0) || [];
      const surplusItems = items?.filter((item) => item.variance > 0) || [];

      let adjustmentExportReceiptId: string | null = null;
      let adjustmentImportReceiptId: string | null = null;

      // Create export adjustment for missing items
      if (missingItems.length > 0) {
        const exportCode = `XDC${Date.now().toString().slice(-8)}`;
        const { data: exportReceipt, error: exportError } = await supabase
          .from('export_receipts')
          .insert({
            code: exportCode,
            branch_id: stockCount.branch_id,
            export_date: new Date().toISOString(),
            created_by: user.id,
            customer_id: null,
            total_amount: 0,
            paid_amount: 0,
            debt_amount: 0,
            status: 'completed',
            note: `Điều chỉnh kho - Hao hụt từ phiếu kiểm kho ${stockCount.code}`,
          })
          .select()
          .single();

        if (exportError) throw exportError;
        adjustmentExportReceiptId = exportReceipt.id;

        // Create export items and update product status
        for (const item of missingItems) {
          const missingQty = Math.abs(item.variance);

          if (item.has_imei && item.product_id) {
            // Update specific IMEI product to sold (missing)
            await supabase
              .from('products')
              .update({ status: 'sold' })
              .eq('id', item.product_id);

            await supabase.from('export_receipt_items').insert({
              receipt_id: exportReceipt.id,
              product_id: item.product_id,
              product_name: item.product_name,
              sku: item.sku,
              imei: item.imei,
              sale_price: 0,
              status: 'sold',
              note: 'Hao hụt - Kiểm kho',
            });
          } else {
            // For non-IMEI, update N products to sold
            const { data: productsToUpdate } = await supabase
              .from('products')
              .select('id')
              .eq('name', item.product_name)
              .eq('sku', item.sku)
              .eq('status', 'in_stock')
              .is('imei', null)
              .eq('branch_id', stockCount.branch_id)
              .limit(missingQty);

            if (productsToUpdate) {
              for (const prod of productsToUpdate) {
                await supabase
                  .from('products')
                  .update({ status: 'sold' })
                  .eq('id', prod.id);
              }
            }

            await supabase.from('export_receipt_items').insert({
              receipt_id: exportReceipt.id,
              product_id: null,
              product_name: item.product_name,
              sku: item.sku,
              imei: null,
              sale_price: 0,
              status: 'sold',
              note: `Hao hụt ${missingQty} sản phẩm - Kiểm kho`,
            });
          }
        }
      }

      // Create import adjustment for surplus items
      if (surplusItems.length > 0) {
        const importCode = `NDC${Date.now().toString().slice(-8)}`;
        const { data: importReceipt, error: importError } = await supabase
          .from('import_receipts')
          .insert({
            code: importCode,
            branch_id: stockCount.branch_id,
            import_date: new Date().toISOString(),
            created_by: user.id,
            supplier_id: null,
            total_amount: 0,
            paid_amount: 0,
            debt_amount: 0,
            status: 'completed',
            note: `Điều chỉnh kho - Bổ sung từ phiếu kiểm kho ${stockCount.code}`,
          })
          .select()
          .single();

        if (importError) throw importError;
        adjustmentImportReceiptId = importReceipt.id;

        // Create new products for surplus
        for (const item of surplusItems) {
          const surplusQty = item.variance;

          if (item.has_imei && item.imei) {
            // Create new IMEI product
            await supabase.from('products').insert({
              name: item.product_name,
              sku: item.sku,
              imei: item.imei,
              import_price: item.import_price || 0,
              import_date: new Date().toISOString(),
              import_receipt_id: importReceipt.id,
              branch_id: stockCount.branch_id,
              status: 'in_stock',
              note: `Bổ sung từ kiểm kho ${stockCount.code}`,
            });
          } else {
            // Create N products for non-IMEI surplus
            for (let i = 0; i < surplusQty; i++) {
              await supabase.from('products').insert({
                name: item.product_name,
                sku: item.sku,
                imei: null,
                import_price: item.import_price || 0,
                import_date: new Date().toISOString(),
                import_receipt_id: importReceipt.id,
                branch_id: stockCount.branch_id,
                status: 'in_stock',
                note: `Bổ sung từ kiểm kho ${stockCount.code}`,
              });
            }
          }
        }
      }

      // Update stock count to confirmed
      const { error: updateError } = await supabase
        .from('stock_counts')
        .update({
          status: 'confirmed',
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
          adjustment_import_receipt_id: adjustmentImportReceiptId,
          adjustment_export_receipt_id: adjustmentExportReceiptId,
        })
        .eq('id', stockCountId);

      if (updateError) throw updateError;

      // Log to audit
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action_type: 'CONFIRM_STOCK_COUNT',
        table_name: 'stock_counts',
        record_id: stockCountId,
        branch_id: stockCount.branch_id,
        description: `Xác nhận phiếu kiểm kho ${stockCount.code}`,
        new_data: {
          totalVariance: stockCount.total_variance,
          missingCount: missingItems.length,
          surplusCount: surplusItems.length,
        },
      });

      return { stockCountId, adjustmentImportReceiptId, adjustmentExportReceiptId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast({
        title: 'Xác nhận thành công',
        description: 'Phiếu kiểm kho đã được xác nhận và tồn kho đã cập nhật',
      });
    },
    onError: (error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
