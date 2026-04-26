import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from './useTenant';

export interface ProductDeposit {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  product_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  deposit_amount: number;
  quantity: number;
  payment_source: string;
  note: string | null;
  status: 'active' | 'applied' | 'cancelled';
  applied_receipt_id: string | null;
  refund_cash_book_id: string | null;
  cash_book_id: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  applied_at: string | null;
  refunded_at: string | null;
}

/**
 * Lấy toàn bộ deposit đang hoạt động (active) của tenant.
 * Dùng để map nhanh product_id -> deposit cho nhiều màn (Lịch sử nhập, Xuất hàng).
 */
export function useActiveDeposits() {
  const { data: tenant } = useCurrentTenant();

  return useQuery({
    queryKey: ['product-deposits', 'active', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [] as ProductDeposit[];
      const { data, error } = await supabase
        .from('product_deposits' as any)
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProductDeposit[];
    },
    enabled: !!tenant?.id,
    staleTime: 30 * 1000,
  });
}

/**
 * Map nhanh productId -> deposit (chỉ deposit active).
 */
export function useDepositMap() {
  const { data: deposits = [], ...rest } = useActiveDeposits();
  const map = new Map<string, ProductDeposit>();
  const byProduct = new Map<string, ProductDeposit[]>();
  const totalQtyByProduct = new Map<string, number>();
  for (const d of deposits) {
    if (!map.has(d.product_id)) map.set(d.product_id, d);
    const arr = byProduct.get(d.product_id) || [];
    arr.push(d);
    byProduct.set(d.product_id, arr);
    totalQtyByProduct.set(
      d.product_id,
      (totalQtyByProduct.get(d.product_id) || 0) + (Number(d.quantity) || 1)
    );
  }
  return { map, byProduct, totalQtyByProduct, deposits, ...rest };
}

/**
 * Tạo cọc cho 1 sản phẩm + tự động ghi vào sổ quỹ (income).
 */
export function useCreateProductDeposit() {
  const qc = useQueryClient();
  const { data: tenant } = useCurrentTenant();

  return useMutation({
    mutationFn: async (input: {
      productId: string;
      productName: string;
      productSku?: string | null;
      branchId?: string | null;
      customerId?: string | null;
      customerName: string;
      customerPhone?: string | null;
      depositAmount: number;
      quantity?: number;
      paymentSource: string; // cash | bank_card | e_wallet | custom-id
      paymentSourceLabel?: string;
      note?: string | null;
    }) => {
      if (!tenant?.id) throw new Error('Không tìm thấy tenant');
      if (input.depositAmount <= 0) throw new Error('Số tiền cọc phải lớn hơn 0');
      const qty = Math.max(1, Number(input.quantity || 1));

      const { data: { user } } = await supabase.auth.getUser();

      // Lấy display_name
      let createdByName: string | null = null;
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle();
        createdByName = profile?.display_name || user.email || null;
      }

      // Kiểm tra: với sản phẩm có IMEI -> chỉ cho 1 deposit active.
      // Với sản phẩm không IMEI -> chặn nếu tổng số lượng cọc vượt tồn kho.
      const { data: prod } = await supabase
        .from('products')
        .select('imei, quantity')
        .eq('id', input.productId)
        .maybeSingle();
      const stockQty = Number((prod as any)?.quantity || 0);
      const hasImei = !!(prod as any)?.imei;

      const { data: activeList } = await supabase
        .from('product_deposits' as any)
        .select('id, quantity')
        .eq('tenant_id', tenant.id)
        .eq('product_id', input.productId)
        .eq('status', 'active');
      const totalDeposited = (activeList || []).reduce(
        (s: number, r: any) => s + (Number(r.quantity) || 1),
        0
      );
      if (hasImei) {
        if ((activeList || []).length > 0) {
          throw new Error('Sản phẩm này đã có khách cọc. Vui lòng hủy cọc cũ trước.');
        }
      } else {
        if (stockQty > 0 && totalDeposited + qty > stockQty) {
          throw new Error(
            `Tồn kho ${stockQty}, đã cọc ${totalDeposited}. Không thể cọc thêm ${qty}.`
          );
        }
      }

      // 1) Ghi sổ quỹ trước (income)
      const skuPart = input.productSku ? ` (${input.productSku})` : '';
      const { data: cashEntry, error: cashErr } = await supabase
        .from('cash_book')
        .insert([{
          type: 'income' as const,
          category: 'Tiền cọc khách hàng',
          description: `Khách ${input.customerName} cọc ${qty > 1 ? `${qty} × ` : ''}sản phẩm: ${input.productName}${skuPart}`,
          amount: input.depositAmount,
          payment_source: input.paymentSource,
          is_business_accounting: false,
          branch_id: input.branchId || null,
          note: input.note || null,
          created_by: user?.id,
          tenant_id: tenant.id,
          created_by_name: createdByName,
          recipient_name: input.customerName,
          recipient_phone: input.customerPhone || null,
        }])
        .select()
        .single();
      if (cashErr) throw cashErr;

      // 2) Tạo deposit liên kết với cashEntry
      const { data: deposit, error: depErr } = await supabase
        .from('product_deposits' as any)
        .insert([{
          tenant_id: tenant.id,
          branch_id: input.branchId || null,
          product_id: input.productId,
          customer_id: input.customerId || null,
          customer_name: input.customerName,
          customer_phone: input.customerPhone || null,
          deposit_amount: input.depositAmount,
          quantity: qty,
          payment_source: input.paymentSource,
          note: input.note || null,
          status: 'active',
          cash_book_id: cashEntry?.id || null,
          created_by: user?.id,
          created_by_name: createdByName,
        }])
        .select()
        .single();
      if (depErr) {
        // rollback dòng tiền nếu tạo deposit lỗi
        if (cashEntry?.id) {
          await supabase.from('cash_book').delete().eq('id', cashEntry.id);
        }
        throw depErr;
      }

      return deposit as unknown as ProductDeposit;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-deposits'] });
      qc.invalidateQueries({ queryKey: ['cash-book'] });
      qc.invalidateQueries({ queryKey: ['cash-book-balances'] });
    },
  });
}

/**
 * Hủy cọc - theo yêu cầu KHÔNG hoàn tiền vào sổ quỹ
 * (coi như khách mất cọc, tiền vẫn ở lại sổ quỹ).
 * Chỉ đổi trạng thái deposit -> 'cancelled'.
 */
export function useCancelProductDeposit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (depositId: string) => {
      const { error } = await supabase
        .from('product_deposits' as any)
        .update({ status: 'cancelled', refunded_at: new Date().toISOString() })
        .eq('id', depositId);
      if (error) throw error;
      return depositId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-deposits'] });
    },
  });
}

/**
 * Đánh dấu các deposit đã được áp dụng vào 1 phiếu xuất.
 * Gọi sau khi tạo phiếu xuất thành công.
 */
export function useApplyProductDeposits() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { depositIds: string[]; receiptId: string }) => {
      if (!input.depositIds.length) return [] as string[];
      const { error } = await supabase
        .from('product_deposits' as any)
        .update({
          status: 'applied',
          applied_receipt_id: input.receiptId,
          applied_at: new Date().toISOString(),
        })
        .in('id', input.depositIds);
      if (error) throw error;
      return input.depositIds;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-deposits'] });
    },
  });
}
