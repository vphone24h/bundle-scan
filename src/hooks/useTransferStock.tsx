import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Helper to get current user's tenant_id
async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

interface TransferStockParams {
  productIds: string[];
  fromBranchId: string;
  toBranchId: string;
  fromBranchName: string;
  toBranchName: string;
}

export function useTransferStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productIds, fromBranchId, toBranchId, fromBranchName, toBranchName }: TransferStockParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Verify all products belong to the same branch and are in_stock
      const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id, name, sku, imei, branch_id, status, quantity, import_price, total_import_cost')
        .in('id', productIds)
        .eq('tenant_id', tenantId);

      if (fetchError) throw fetchError;
      if (!products || products.length !== productIds.length) {
        throw new Error('Không tìm thấy một số sản phẩm');
      }

      // Validate all products are in_stock
      const notInStock = products.filter(p => p.status !== 'in_stock');
      if (notInStock.length > 0) {
        throw new Error(`Sản phẩm "${notInStock[0].name}" không ở trạng thái tồn kho`);
      }

      // Validate all products are from the same branch
      const wrongBranch = products.filter(p => p.branch_id !== fromBranchId);
      if (wrongBranch.length > 0) {
        throw new Error(`Sản phẩm "${wrongBranch[0].name}" không thuộc chi nhánh nguồn`);
      }

      // Update branch_id for all selected products
      const { error: updateError } = await supabase
        .from('products')
        .update({ branch_id: toBranchId })
        .in('id', productIds)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;

      // Create audit log
      const productSummary = products.map(p => 
        p.imei ? `${p.name} (IMEI: ${p.imei})` : `${p.name} x${p.quantity}`
      ).join(', ');

      await supabase.from('audit_logs').insert([{
        user_id: user.id,
        action_type: 'TRANSFER_STOCK',
        table_name: 'products',
        record_id: productIds[0],
        branch_id: toBranchId,
        old_data: {
          from_branch_id: fromBranchId,
          from_branch_name: fromBranchName,
          product_ids: productIds,
        },
        new_data: {
          to_branch_id: toBranchId,
          to_branch_name: toBranchName,
          product_count: products.length,
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            imei: p.imei,
            quantity: p.quantity,
          })),
        },
        description: `Chuyển ${products.length} sản phẩm từ "${fromBranchName}" sang "${toBranchName}": ${productSummary.substring(0, 200)}`,
        tenant_id: tenantId,
      }]);

      return { count: products.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['all-products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['import-receipts'] });
    },
  });
}
