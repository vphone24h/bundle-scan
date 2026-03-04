import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Helper to get current user's tenant_id
async function getCurrentTenantId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data;
}

export interface StockTransferRequest {
  id: string;
  tenant_id: string;
  from_branch_id: string;
  to_branch_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_by: string;
  approved_by: string | null;
  note: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  from_branch?: { name: string } | null;
  to_branch?: { name: string } | null;
  creator_profile?: { display_name: string } | null;
  approver_profile?: { display_name: string } | null;
  items?: StockTransferItem[];
}

export interface StockTransferItem {
  id: string;
  transfer_request_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  imei: string | null;
  quantity: number;
  import_price: number;
  supplier_id: string | null;
  supplier_name: string | null;
  note: string | null;
  created_at: string;
}

// Fetch all transfer requests for current tenant
export function useStockTransferRequests() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['stock-transfer-requests', user?.id],
    queryFn: async () => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('stock_transfer_requests')
        .select(`
          *,
          from_branch:branches!stock_transfer_requests_from_branch_id_fkey(name),
          to_branch:branches!stock_transfer_requests_to_branch_id_fkey(name)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch creator/approver profiles
      const userIds = new Set<string>();
      (data || []).forEach((r: any) => {
        if (r.created_by) userIds.add(r.created_by);
        if (r.approved_by) userIds.add(r.approved_by);
      });

      let profilesMap: Record<string, string> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', Array.from(userIds));
        
        (profiles || []).forEach((p: any) => {
          profilesMap[p.user_id] = p.display_name;
        });
      }

      return (data || []).map((r: any) => ({
        ...r,
        creator_profile: r.created_by ? { display_name: profilesMap[r.created_by] || 'N/A' } : null,
        approver_profile: r.approved_by ? { display_name: profilesMap[r.approved_by] || 'N/A' } : null,
      })) as StockTransferRequest[];
    },
    enabled: !!user?.id,
  });
}

// Fetch items for a specific transfer request
export function useStockTransferItems(requestId: string | null) {
  return useQuery({
    queryKey: ['stock-transfer-items', requestId],
    queryFn: async () => {
      if (!requestId) return [];

      const { data, error } = await supabase
        .from('stock_transfer_items')
        .select('*')
        .eq('transfer_request_id', requestId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as StockTransferItem[];
    },
    enabled: !!requestId,
  });
}

// Count pending incoming transfers for current user's branch
export function usePendingTransferCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pending-transfer-count', user?.id],
    queryFn: async () => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) return 0;

      // Get user's branch
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('branch_id, user_role')
        .eq('user_id', user!.id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!roleData) return 0;

      // Super admin sees all pending
      if (roleData.user_role === 'super_admin') {
        const { count } = await supabase
          .from('stock_transfer_requests')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'pending');
        return count || 0;
      }

      // Branch admin sees pending for their branch
      if (roleData.user_role === 'branch_admin' && roleData.branch_id) {
        const { count } = await supabase
          .from('stock_transfer_requests')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('to_branch_id', roleData.branch_id)
          .eq('status', 'pending');
        return count || 0;
      }

      return 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30s
  });
}

interface CreateTransferParams {
  productIds: string[];
  fromBranchId: string;
  toBranchId: string;
  fromBranchName: string;
  toBranchName: string;
  note?: string;
  isAutoApprove: boolean;
  transferQuantities?: Record<string, number>; // productId -> qty for non-IMEI partial transfers
}

// Create a stock transfer request
export function useCreateStockTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productIds, fromBranchId, toBranchId, fromBranchName, toBranchName, note, isAutoApprove, transferQuantities = {} }: CreateTransferParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Fetch products with supplier info
      const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id, name, sku, imei, branch_id, status, quantity, import_price, supplier_id, note, category_id, total_import_cost, sale_price')
        .in('id', productIds)
        .eq('tenant_id', tenantId);

      if (fetchError) throw fetchError;
      if (!products || products.length !== productIds.length) {
        throw new Error('Không tìm thấy một số sản phẩm');
      }

      // Validate
      const notInStock = products.filter(p => p.status !== 'in_stock');
      if (notInStock.length > 0) {
        throw new Error(`Sản phẩm "${notInStock[0].name}" không ở trạng thái tồn kho`);
      }

      const wrongBranch = products.filter(p => p.branch_id !== fromBranchId);
      if (wrongBranch.length > 0) {
        throw new Error(`Sản phẩm "${wrongBranch[0].name}" không thuộc chi nhánh nguồn`);
      }

      // Validate transfer quantities for non-IMEI
      for (const p of products) {
        if (!p.imei && transferQuantities[p.id] !== undefined) {
          const tQty = transferQuantities[p.id];
          if (tQty < 1 || tQty > p.quantity) {
            throw new Error(`Số lượng chuyển "${p.name}" không hợp lệ (1-${p.quantity})`);
          }
        }
      }

      const status = isAutoApprove ? 'approved' : 'pending';

      // Create transfer request
      const { data: request, error: reqError } = await supabase
        .from('stock_transfer_requests')
        .insert({
          tenant_id: tenantId,
          from_branch_id: fromBranchId,
          to_branch_id: toBranchId,
          status,
          created_by: user.id,
          approved_by: isAutoApprove ? user.id : null,
          approved_at: isAutoApprove ? new Date().toISOString() : null,
          note: note || null,
        })
        .select()
        .single();

      if (reqError) throw reqError;

      // Fetch supplier names for snapshot
      const supplierIds = [...new Set(products.map(p => p.supplier_id).filter(Boolean))] as string[];
      let supplierMap: Record<string, string> = {};
      if (supplierIds.length > 0) {
        const { data: suppliers } = await supabase
          .from('suppliers')
          .select('id, name')
          .in('id', supplierIds);
        (suppliers || []).forEach((s: any) => { supplierMap[s.id] = s.name; });
      }

      // Insert items with actual transfer quantities
      const items = products.map(p => {
        const transferQty = p.imei ? 1 : (transferQuantities[p.id] ?? p.quantity);
        return {
          transfer_request_id: request.id,
          product_id: p.id,
          product_name: p.name,
          sku: p.sku,
          imei: p.imei || null,
          quantity: transferQty,
          import_price: Number(p.import_price),
          supplier_id: p.supplier_id || null,
          supplier_name: p.supplier_id ? (supplierMap[p.supplier_id] || null) : null,
          note: p.note || null,
        };
      });

      const { error: itemsError } = await supabase
        .from('stock_transfer_items')
        .insert(items);

      if (itemsError) throw itemsError;

      // If auto-approve (super_admin), move products immediately
      if (isAutoApprove) {
        for (const p of products) {
          const transferQty = p.imei ? 1 : (transferQuantities[p.id] ?? p.quantity);
          const isPartial = !p.imei && transferQty < p.quantity;

          if (isPartial) {
            // Partial transfer for non-IMEI: reduce source quantity, create/update at destination
            const remainQty = p.quantity - transferQty;
            const unitCost = p.total_import_cost ? Number(p.total_import_cost) / p.quantity : Number(p.import_price);
            const transferCost = unitCost * transferQty;
            const remainCost = p.total_import_cost ? Number(p.total_import_cost) - transferCost : unitCost * remainQty;

            // Update source product: reduce quantity
            await supabase
              .from('products')
              .update({
                quantity: remainQty,
                total_import_cost: remainCost,
              })
              .eq('id', p.id)
              .eq('tenant_id', tenantId);

            // Check if same product exists at destination branch (by SKU)
            const { data: existingProduct } = await supabase
              .from('products')
              .select('id, quantity, total_import_cost')
              .eq('tenant_id', tenantId)
              .eq('branch_id', toBranchId)
              .eq('sku', p.sku)
              .is('imei', null)
              .eq('status', 'in_stock')
              .maybeSingle();

            if (existingProduct) {
              // Add quantity to existing product
              await supabase
                .from('products')
                .update({
                  quantity: existingProduct.quantity + transferQty,
                  total_import_cost: (Number(existingProduct.total_import_cost) || 0) + transferCost,
                })
                .eq('id', existingProduct.id);
            } else {
              // Create new product at destination branch
              await supabase
                .from('products')
                .insert({
                  tenant_id: tenantId,
                  branch_id: toBranchId,
                  name: p.name,
                  sku: p.sku,
                  imei: null,
                  quantity: transferQty,
                  import_price: Number(p.import_price),
                  total_import_cost: transferCost,
                  supplier_id: p.supplier_id,
                  category_id: p.category_id,
                  sale_price: p.sale_price ? Number(p.sale_price) : null,
                  note: p.note,
                  status: 'in_stock' as const,
                });
            }
          } else {
            // Full transfer (IMEI or full quantity non-IMEI): just move branch
            await supabase
              .from('products')
              .update({ branch_id: toBranchId })
              .eq('id', p.id)
              .eq('tenant_id', tenantId);
          }
        }
      }

      // Audit logs
      const productSummary = products.map(p => {
        const tQty = p.imei ? 1 : (transferQuantities[p.id] ?? p.quantity);
        return p.imei ? `${p.name} (IMEI: ${p.imei})` : `${p.name} x${tQty}`;
      }).join(', ');

      const auditLogs: any[] = [];

      auditLogs.push({
        user_id: user.id,
        action_type: 'TRANSFER_STOCK',
        table_name: 'stock_transfer_requests',
        record_id: request.id,
        branch_id: fromBranchId,
        old_data: { from_branch_id: fromBranchId, from_branch_name: fromBranchName },
        new_data: {
          to_branch_id: toBranchId,
          to_branch_name: toBranchName,
          status,
          product_count: products.length,
        },
        description: `Chuyển hàng${isAutoApprove ? ' (tự duyệt)' : ''}: ${products.length} SP → "${toBranchName}": ${productSummary.substring(0, 300)}`,
        tenant_id: tenantId,
      });

      if (isAutoApprove) {
        auditLogs.push({
          user_id: user.id,
          action_type: 'RECEIVE_STOCK',
          table_name: 'stock_transfer_requests',
          record_id: request.id,
          branch_id: toBranchId,
          old_data: { from_branch_id: fromBranchId, from_branch_name: fromBranchName },
          new_data: {
            to_branch_id: toBranchId,
            to_branch_name: toBranchName,
            status: 'approved',
            product_count: products.length,
          },
          description: `Nhận hàng (tự duyệt): ${products.length} SP từ "${fromBranchName}": ${productSummary.substring(0, 300)}`,
          tenant_id: tenantId,
        });
      }

      await supabase.from('audit_logs').insert(auditLogs);

      return { count: products.length, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['all-products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['import-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transfer-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-transfer-count'] });
    },
  });
}

// Approve a transfer request
export function useApproveTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId }: { requestId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      // Get request + items
      const { data: request, error: reqErr } = await supabase
        .from('stock_transfer_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (reqErr || !request) throw new Error('Không tìm thấy phiếu chuyển hàng');
      if (request.status !== 'pending') throw new Error('Phiếu không ở trạng thái chờ duyệt');

      const { data: items, error: itemsErr } = await supabase
        .from('stock_transfer_items')
        .select('*')
        .eq('transfer_request_id', requestId);

      if (itemsErr) throw itemsErr;

      // Process each item - handle partial quantities for non-IMEI
      const productIds = (items || []).map((i: any) => i.product_id);

      // Fetch current product data
      const { data: currentProducts } = await supabase
        .from('products')
        .select('id, name, sku, imei, quantity, import_price, total_import_cost, supplier_id, category_id, sale_price, note')
        .in('id', productIds)
        .eq('tenant_id', tenantId);

      const productMap = new Map((currentProducts || []).map((p: any) => [p.id, p]));

      for (const item of (items || []) as any[]) {
        const product = productMap.get(item.product_id);
        if (!product) continue;

        const isIMEI = !!item.imei;
        const isPartial = !isIMEI && item.quantity < product.quantity;

        if (isPartial) {
          // Partial transfer: reduce source, create/update at destination
          const remainQty = product.quantity - item.quantity;
          const unitCost = product.total_import_cost ? Number(product.total_import_cost) / product.quantity : Number(product.import_price);
          const transferCost = unitCost * item.quantity;
          const remainCost = product.total_import_cost ? Number(product.total_import_cost) - transferCost : unitCost * remainQty;

          await supabase
            .from('products')
            .update({ quantity: remainQty, total_import_cost: remainCost })
            .eq('id', product.id)
            .eq('tenant_id', tenantId);

          // Check if same SKU exists at destination
          const { data: existingProduct } = await supabase
            .from('products')
            .select('id, quantity, total_import_cost')
            .eq('tenant_id', tenantId)
            .eq('branch_id', request.to_branch_id)
            .eq('sku', product.sku)
            .is('imei', null)
            .eq('status', 'in_stock')
            .maybeSingle();

          if (existingProduct) {
            await supabase
              .from('products')
              .update({
                quantity: existingProduct.quantity + item.quantity,
                total_import_cost: (Number(existingProduct.total_import_cost) || 0) + transferCost,
              })
              .eq('id', existingProduct.id);
          } else {
            await supabase
              .from('products')
              .insert({
                tenant_id: tenantId,
                branch_id: request.to_branch_id,
                name: product.name,
                sku: product.sku,
                imei: null,
                quantity: item.quantity,
                import_price: Number(product.import_price),
                total_import_cost: transferCost,
                supplier_id: product.supplier_id,
                category_id: product.category_id,
                sale_price: product.sale_price ? Number(product.sale_price) : null,
                note: product.note,
                status: 'in_stock' as const,
              });
          }
        } else {
          // Full transfer: just move branch
          await supabase
            .from('products')
            .update({ branch_id: request.to_branch_id })
            .eq('id', product.id)
            .eq('tenant_id', tenantId);
        }
      }

      // Update request status
      const { error: statusError } = await supabase
        .from('stock_transfer_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (statusError) throw statusError;

      // Get branch names & product details for audit log
      const { data: branches } = await supabase
        .from('branches')
        .select('id, name')
        .in('id', [request.from_branch_id, request.to_branch_id]);

      const fromName = branches?.find((b: any) => b.id === request.from_branch_id)?.name || '';
      const toName = branches?.find((b: any) => b.id === request.to_branch_id)?.name || '';

      const productSummary = (items || []).map((i: any) =>
        i.imei ? `${i.product_name} (IMEI: ${i.imei})` : `${i.product_name} x${i.quantity}`
      ).join(', ');

      // Create receiver log for branch B: "Nhận hàng"
      await supabase.from('audit_logs').insert([
        {
          user_id: user.id,
          action_type: 'RECEIVE_STOCK',
          table_name: 'stock_transfer_requests',
          record_id: requestId,
          branch_id: request.to_branch_id,
          old_data: { from_branch_id: request.from_branch_id, from_branch_name: fromName },
          new_data: { status: 'approved', product_count: productIds.length },
          description: `Nhận hàng: ${productIds.length} SP từ "${fromName}": ${productSummary.substring(0, 300)}`,
          tenant_id: tenantId,
        },
        {
          user_id: user.id,
          action_type: 'APPROVE_TRANSFER',
          table_name: 'stock_transfer_requests',
          record_id: requestId,
          branch_id: request.from_branch_id,
          new_data: { status: 'approved', product_count: productIds.length },
          description: `Duyệt phiếu chuyển hàng: ${productIds.length} SP từ "${fromName}" → "${toName}"`,
          tenant_id: tenantId,
        },
      ]);

      return { count: productIds.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['all-products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transfer-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-transfer-count'] });
    },
  });
}

// Reject a transfer request
export function useRejectTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error('Không tìm thấy tenant');

      const { data: request } = await supabase
        .from('stock_transfer_requests')
        .select('*, from_branch:branches!stock_transfer_requests_from_branch_id_fkey(name), to_branch:branches!stock_transfer_requests_to_branch_id_fkey(name)')
        .eq('id', requestId)
        .single();

      if (!request) throw new Error('Không tìm thấy phiếu');
      if (request.status !== 'pending') throw new Error('Phiếu không ở trạng thái chờ duyệt');

      const { error } = await supabase
        .from('stock_transfer_requests')
        .update({
          status: 'rejected',
          approved_by: user.id,
          rejected_at: new Date().toISOString(),
          reject_reason: reason || null,
        })
        .eq('id', requestId);

      if (error) throw error;

      const fromBranchName = (request as any).from_branch?.name || '';
      const toBranchName = (request as any).to_branch?.name || '';

      // Create reject log for both branches
      await supabase.from('audit_logs').insert([
        {
          user_id: user.id,
          action_type: 'REJECT_TRANSFER',
          table_name: 'stock_transfer_requests',
          record_id: requestId,
          branch_id: request.from_branch_id,
          new_data: { status: 'rejected', reason },
          description: `Từ chối phiếu chuyển hàng: từ "${fromBranchName}" → "${toBranchName}"${reason ? `: ${reason}` : ''}`,
          tenant_id: tenantId,
        },
        {
          user_id: user.id,
          action_type: 'REJECT_TRANSFER',
          table_name: 'stock_transfer_requests',
          record_id: requestId,
          branch_id: request.to_branch_id,
          new_data: { status: 'rejected', reason },
          description: `Từ chối nhận hàng: từ "${fromBranchName}" → "${toBranchName}"${reason ? `: ${reason}` : ''}`,
          tenant_id: tenantId,
        },
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfer-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-transfer-count'] });
    },
  });
}
