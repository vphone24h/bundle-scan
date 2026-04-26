import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  status: 'active' | 'applied' | 'refunded';
  applied_receipt_id: string | null;
  cash_book_id: string | null;
  refund_cash_book_id: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  applied_at: string | null;
  refunded_at: string | null;
}

async function getTenantId() {
  const { data } = await supabase.rpc('get_user_tenant_id_secure');
  return data as string | null;
}

/** Lookup active deposits for a list of product ids */
export function useActiveDepositsByProducts(productIds: string[]) {
  return useQuery({
    queryKey: ['product-deposits', 'active', [...productIds].sort()],
    queryFn: async () => {
      if (!productIds.length) return [] as ProductDeposit[];
      const { data, error } = await supabase
        .from('product_deposits')
        .select('*')
        .in('product_id', productIds)
        .eq('status', 'active');
      if (error) throw error;
      return (data || []) as ProductDeposit[];
    },
    enabled: productIds.length > 0,
  });
}

export function useDepositsByProduct(productId: string | null) {
  return useQuery({
    queryKey: ['product-deposits', 'by-product', productId],
    queryFn: async () => {
      if (!productId) return [] as ProductDeposit[];
      const { data, error } = await supabase
        .from('product_deposits')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ProductDeposit[];
    },
    enabled: !!productId,
  });
}

export function useCreateProductDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      product_id: string;
      branch_id?: string | null;
      customer_id?: string | null;
      customer_name: string;
      customer_phone?: string | null;
      deposit_amount: number;
      payment_source: string;
      note?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');
      const tenant_id = await getTenantId();
      if (!tenant_id) throw new Error('Không tìm thấy doanh nghiệp');

      // staff name
      let staffName: string | null = null;
      const { data: prof } = await supabase
        .from('profiles').select('display_name').eq('id', user.id).maybeSingle();
      staffName = prof?.display_name || null;

      // Insert deposit
      const { data: dep, error: depErr } = await supabase
        .from('product_deposits')
        .insert([{
          tenant_id,
          branch_id: input.branch_id || null,
          product_id: input.product_id,
          customer_id: input.customer_id || null,
          customer_name: input.customer_name,
          customer_phone: input.customer_phone || null,
          deposit_amount: input.deposit_amount,
          payment_source: input.payment_source,
          note: input.note || null,
          status: 'active',
          created_by: user.id,
          created_by_name: staffName,
        }])
        .select()
        .single();
      if (depErr) throw depErr;

      // Cash book entry (income)
      const { data: cb, error: cbErr } = await supabase
        .from('cash_book')
        .insert([{
          type: 'income',
          category: 'Cọc khách',
          description: `Khách cọc: ${input.customer_name}${input.customer_phone ? ` (${input.customer_phone})` : ''}`,
          amount: input.deposit_amount,
          payment_source: input.payment_source,
          is_business_accounting: false,
          branch_id: input.branch_id || null,
          reference_id: dep.id,
          reference_type: 'product_deposit',
          created_by: user.id,
          tenant_id,
          created_by_name: staffName,
          recipient_name: input.customer_name,
        }])
        .select('id')
        .single();
      if (cbErr) throw cbErr;

      // Link cash_book_id back
      await supabase.from('product_deposits')
        .update({ cash_book_id: cb.id })
        .eq('id', dep.id);

      return dep;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-deposits'] });
      qc.invalidateQueries({ queryKey: ['cash-book'] });
      qc.invalidateQueries({ queryKey: ['cash-book-summary'] });
    },
  });
}

/** Refund deposit -> create expense in cash book */
export function useRefundProductDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ deposit_id, payment_source }: { deposit_id: string; payment_source?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');
      const tenant_id = await getTenantId();
      if (!tenant_id) throw new Error('Không tìm thấy doanh nghiệp');

      const { data: dep, error: dErr } = await supabase
        .from('product_deposits').select('*').eq('id', deposit_id).single();
      if (dErr || !dep) throw new Error('Không tìm thấy phiếu cọc');
      if (dep.status !== 'active') throw new Error('Phiếu cọc đã được xử lý');

      let staffName: string | null = null;
      const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
      staffName = prof?.display_name || null;

      const source = payment_source || dep.payment_source;
      const { data: cb, error: cbErr } = await supabase
        .from('cash_book')
        .insert([{
          type: 'expense',
          category: 'Hoàn cọc khách',
          description: `Hoàn cọc: ${dep.customer_name}${dep.customer_phone ? ` (${dep.customer_phone})` : ''}`,
          amount: dep.deposit_amount,
          payment_source: source,
          is_business_accounting: false,
          branch_id: dep.branch_id,
          reference_id: dep.id,
          reference_type: 'product_deposit_refund',
          created_by: user.id,
          tenant_id,
          created_by_name: staffName,
          recipient_name: dep.customer_name,
        }])
        .select('id').single();
      if (cbErr) throw cbErr;

      await supabase.from('product_deposits')
        .update({ status: 'refunded', refunded_at: new Date().toISOString(), refund_cash_book_id: cb.id })
        .eq('id', deposit_id);

      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-deposits'] });
      qc.invalidateQueries({ queryKey: ['cash-book'] });
      qc.invalidateQueries({ queryKey: ['cash-book-summary'] });
    },
  });
}

/** Mark deposits as applied to an export receipt */
export function useApplyDepositsToReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ deposit_ids, receipt_id }: { deposit_ids: string[]; receipt_id: string }) => {
      if (!deposit_ids.length) return;
      await supabase.from('product_deposits')
        .update({ status: 'applied', applied_at: new Date().toISOString(), applied_receipt_id: receipt_id })
        .in('id', deposit_ids);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-deposits'] });
    },
  });
}
