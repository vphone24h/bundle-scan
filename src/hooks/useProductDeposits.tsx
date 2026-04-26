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
  for (const d of deposits) {
    if (!map.has(d.product_id)) map.set(d.product_id, d);
  }
  return { map, deposits, ...rest };
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
      paymentSource: string; // cash | bank_card | e_wallet | custom-id
      paymentSourceLabel?: string;
      note?: string | null;
    }) => {
      if (!tenant?.id) throw new Error('Không tìm thấy tenant');
      if (input.depositAmount <= 0) throw new Error('Số tiền cọc phải lớn hơn 0');

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

      // Kiểm tra đã có deposit active cho sản phẩm chưa
      const { data: existing } = await supabase
        .from('product_deposits' as any)
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('product_id', input.productId)
        .eq('status', 'active')
        .maybeSingle();
      if (existing) throw new Error('Sản phẩm này đã có khách cọc. Vui lòng hủy cọc cũ trước.');

      // 1) Ghi sổ quỹ trước (income)
      const skuPart = input.productSku ? ` (${input.productSku})` : '';
      const { data: cashEntry, error: cashErr } = await supabase
        .from('cash_book')
        .insert([{
          type: 'income' as const,
          category: 'Tiền cọc khách hàng',
          description: `Khách ${input.customerName} cọc sản phẩm: ${input.productName}${skuPart}`,
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
