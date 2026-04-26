import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface PreorderItem {
  id?: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  imei?: string | null;
  category_id?: string | null;
  sale_price: number;
  quantity: number;
  unit?: string | null;
  warranty?: string | null;
  note?: string | null;
}

export interface CreatePreorderInput {
  customer_id: string | null;
  customer_name?: string;
  branch_id: string | null;
  sales_staff_id?: string | null;
  total_amount: number;
  deposit_amount: number;
  deposit_payment_source?: string | null; // 'cash' | 'bank' | 'e_wallet' | 'debt' | null
  note?: string | null;
  items: PreorderItem[];
  // If true, also record cash book entry for deposit (only when payment_source != 'debt')
  record_cash_book?: boolean;
}

async function getTenantId(): Promise<string> {
  const { data, error } = await supabase.rpc('get_user_tenant_id_secure');
  if (error || !data) throw new Error('Không tìm thấy tenant');
  return data as string;
}

async function generatePreorderCode(): Promise<string> {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PO${ts}${rand}`;
}

/**
 * Đảm bảo có 1 nhà cung cấp tương ứng với khách hàng (cùng phone trong cùng tenant).
 * Nếu chưa có thì tự tạo NCC mới với name+phone của KH.
 * Trả về supplier_id, hoặc null nếu không xác định được.
 */
async function ensureSupplierForCustomer(customerId: string, tenantId: string): Promise<string | null> {
  const { data: cust } = await supabase
    .from('customers')
    .select('name, phone')
    .eq('id', customerId)
    .maybeSingle();
  if (!cust) return null;
  const name = (cust as any).name || 'Khách đặt cọc';
  const phone = (cust as any).phone || '';

  // Tìm theo phone trong tenant (nếu có phone)
  if (phone) {
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .limit(1)
      .maybeSingle();
    if (existing && (existing as any).id) return (existing as any).id;
  } else {
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('name', name)
      .limit(1)
      .maybeSingle();
    if (existing && (existing as any).id) return (existing as any).id;
  }

  // Tạo mới
  const { data: created, error } = await supabase
    .from('suppliers')
    .insert([{ name, phone: phone || '', tenant_id: tenantId, note: 'Tự tạo từ phiếu cọc khách hàng' } as any])
    .select('id')
    .single();
  if (error || !created) return null;
  return (created as any).id;
}

/**
 * Lấy danh sách phiếu cọc
 */
export function usePreorders(filters?: { status?: string; search?: string }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['preorders', user?.id, filters],
    queryFn: async () => {
      let query = supabase
        .from('preorder_receipts' as any)
        .select('*')
        .order('preorder_date', { ascending: false })
        .limit(500);

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user?.id,
  });
}

/**
 * Lấy chi tiết phiếu cọc + items
 */
export function usePreorderDetail(id: string | null) {
  return useQuery({
    queryKey: ['preorder-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const [{ data: receipt, error: e1 }, { data: items, error: e2 }] = await Promise.all([
        supabase.from('preorder_receipts' as any).select('*').eq('id', id).maybeSingle(),
        supabase.from('preorder_receipt_items' as any).select('*').eq('preorder_id', id),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { receipt, items: items || [] } as any;
    },
    enabled: !!id,
  });
}

/**
 * Lấy danh sách IMEI đang được giữ chỗ trong tenant hiện tại
 */
export function useReservedImeis() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['preorder-reserved-imeis', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preorder_imei_reservations' as any)
        .select('imei, preorder_id, product_id');
      if (error) throw error;
      return new Set((data || []).map((r: any) => r.imei).filter(Boolean));
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

/**
 * Tạo phiếu cọc mới + reserve IMEI + ghi sổ quỹ + tạo công nợ
 */
export function useCreatePreorder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePreorderInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');
      const tenantId = await getTenantId();

      const code = await generatePreorderCode();
      const remaining = Math.max(0, input.total_amount - input.deposit_amount);

      // 1. Tạo phiếu cọc
      const { data: receipt, error: e1 } = await supabase
        .from('preorder_receipts' as any)
        .insert([{
          code,
          customer_id: input.customer_id,
          branch_id: input.branch_id,
          sales_staff_id: input.sales_staff_id || null,
          tenant_id: tenantId,
          total_amount: input.total_amount,
          deposit_amount: input.deposit_amount,
          remaining_amount: remaining,
          deposit_payment_source: input.deposit_payment_source || null,
          status: 'pending',
          note: input.note || null,
          created_by: user.id,
        }])
        .select()
        .single();
      if (e1) throw e1;
      const preorderId = (receipt as any).id;

      // 2. Insert items
      if (input.items.length > 0) {
        const itemsPayload = input.items.map(it => ({
          preorder_id: preorderId,
          product_id: it.product_id,
          product_name: it.product_name,
          sku: it.sku,
          imei: it.imei || null,
          category_id: it.category_id || null,
          sale_price: it.sale_price,
          quantity: it.quantity || 1,
          unit: it.unit || null,
          warranty: it.warranty || null,
          note: it.note || null,
        }));
        const { error: e2 } = await supabase
          .from('preorder_receipt_items' as any)
          .insert(itemsPayload);
        if (e2) throw e2;
      }

      // 3. Reserve IMEIs (chỉ items có IMEI)
      const imeiItems = input.items.filter(it => it.imei);
      if (imeiItems.length > 0) {
        const reservations = imeiItems.map(it => ({
          preorder_id: preorderId,
          product_id: it.product_id,
          imei: it.imei,
          branch_id: input.branch_id,
          tenant_id: tenantId,
        }));
        const { error: e3 } = await supabase
          .from('preorder_imei_reservations' as any)
          .insert(reservations);
        if (e3) {
          // Rollback nếu IMEI đã bị reserve
          await supabase.from('preorder_receipts' as any).delete().eq('id', preorderId);
          throw new Error('Một hoặc nhiều IMEI đã được giữ chỗ trong phiếu cọc khác. Vui lòng kiểm tra lại.');
        }
      }

      // 4. Ghi nhận công nợ khi nhận cọc - vào TAB NHÀ CUNG CẤP
      // Bản chất: nhận cọc = mình ĐANG NỢ khách (giống nợ NCC tới khi giao hàng).
      // Map khách hàng sang 1 NCC tương ứng (tự tạo nếu chưa có).
      // - Nguồn cash/bank/ví: tạo 1 lệnh "addition" tăng nợ NCC = deposit (mình nợ NCC tăng).
      // - Nguồn 'debt' (KH có nợ cũ - mình đối trừ): tạo 2 lệnh đối ứng tại tab NCC:
      //     (1) payment +deposit -> "NCC dùng tiền nợ để cọc" (giảm nợ NCC)
      //     (2) addition +deposit -> "Mình nhận cọc -> nợ lại NCC" (tăng nợ NCC)
      //   Ròng = 0 nhưng lịch sử thấy rõ 2 dòng.
      let supplierIdForDeposit: string | null = null;
      if (input.customer_id && input.deposit_amount > 0) {
        supplierIdForDeposit = await ensureSupplierForCustomer(input.customer_id, tenantId);
        if (supplierIdForDeposit) {
          const isDebtSource = input.deposit_payment_source === 'debt';
          if (isDebtSource) {
            // Lệnh 1: NCC dùng tiền nợ để cọc -> giảm nợ NCC
            await supabase.from('debt_payments').insert([{
              entity_type: 'supplier',
              entity_id: supplierIdForDeposit,
              payment_type: 'payment',
              amount: input.deposit_amount,
              payment_source: 'preorder_deposit_offset',
              description: `Cọc phiếu ${code} - NCC dùng tiền nợ để đặt cọc`,
              branch_id: input.branch_id,
              created_by: user.id,
              tenant_id: tenantId,
            } as any]);
          }
          // Lệnh chính: nhận cọc -> mình nợ NCC (tăng nợ NCC)
          await supabase.from('debt_payments').insert([{
            entity_type: 'supplier',
            entity_id: supplierIdForDeposit,
            payment_type: 'addition',
            amount: input.deposit_amount,
            payment_source: input.deposit_payment_source || 'preorder_deposit',
            description: `Nhận cọc phiếu ${code} - Cửa hàng nợ lại NCC số tiền cọc`,
            branch_id: input.branch_id,
            created_by: user.id,
            tenant_id: tenantId,
          } as any]);
        }
      }

      // 5. Ghi sổ quỹ (nếu có nguồn tiền cụ thể, không phải 'debt')
      if (
        input.deposit_amount > 0 &&
        input.deposit_payment_source &&
        input.deposit_payment_source !== 'debt' &&
        input.record_cash_book !== false
      ) {
        await supabase.from('cash_book').insert([{
          type: 'income',
          amount: input.deposit_amount,
          category: 'Đặt cọc',
          description: `Nhận cọc đặt hàng ${code}${input.customer_name ? ' - ' + input.customer_name : ''}`,
          payment_source: input.deposit_payment_source,
          tenant_id: tenantId,
          branch_id: input.branch_id,
          created_by: user.id,
          reference_id: preorderId,
          reference_type: 'preorder_deposit',
          is_business_accounting: false, // KHÔNG hạch toán doanh thu/lợi nhuận
        } as any]);
      }

      return receipt as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preorders'] });
      queryClient.invalidateQueries({ queryKey: ['preorder-reserved-imeis'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      toast({ title: 'Đã tạo phiếu cọc', description: 'Phiếu cọc đã được lưu thành công' });
    },
    onError: (err: any) => {
      toast({ title: 'Lỗi', description: err.message || 'Không thể tạo phiếu cọc', variant: 'destructive' });
    },
  });
}

/**
 * Hủy phiếu cọc với 3 trường hợp:
 *  - full_refund: trả 100% cọc (cần payment_source)
 *  - partial_refund: trả 1 phần, giữ kept_amount (cần refund_payment_source nếu refund_amount>0)
 *  - keep_all: giữ toàn bộ cọc
 */
export function useCancelPreorder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      preorderId: string;
      mode: 'full_refund' | 'partial_refund' | 'keep_all';
      refund_payment_source?: string | null;
      kept_amount?: number;
      reason?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');
      const tenantId = await getTenantId();

      // Lấy phiếu cọc
      const { data: receipt, error: e0 } = await supabase
        .from('preorder_receipts' as any)
        .select('*')
        .eq('id', params.preorderId)
        .maybeSingle();
      if (e0 || !receipt) throw new Error('Không tìm thấy phiếu cọc');
      const r: any = receipt;
      if (r.status !== 'pending') throw new Error('Phiếu cọc đã được xử lý, không thể hủy');

      const deposit = Number(r.deposit_amount) || 0;
      let refundAmount = 0;
      let keptAmount = 0;
      let newStatus = '';

      if (params.mode === 'full_refund') {
        refundAmount = deposit;
        keptAmount = 0;
        newStatus = 'cancelled_full_refund';
      } else if (params.mode === 'partial_refund') {
        keptAmount = Math.max(0, Math.min(deposit, params.kept_amount || 0));
        refundAmount = deposit - keptAmount;
        newStatus = 'cancelled_partial_refund';
      } else {
        keptAmount = deposit;
        refundAmount = 0;
        newStatus = 'cancelled_keep_all';
      }

      // 1. Cập nhật phiếu
      await supabase.from('preorder_receipts' as any).update({
        status: newStatus,
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancel_reason: params.reason || null,
        refund_amount: refundAmount,
        kept_amount: keptAmount,
        refund_payment_source: params.refund_payment_source || null,
      }).eq('id', params.preorderId);

      // 2. Xóa reservation IMEI -> mở khóa kho
      await supabase.from('preorder_imei_reservations' as any)
        .delete().eq('preorder_id', params.preorderId);

      // 3. Bù trừ công nợ khách (đảo lại lệnh đã tạo khi cọc)
      // Lúc cọc: payment -deposit (mình nợ KH).
      // Khi hủy: addition +deposit để cân bằng dư có. Ròng phần cọc = 0.
      // (Nếu lúc cọc dùng nguồn 'debt' đã có thêm 1 dòng addition +deposit "KH dùng nợ" -
      //  dòng đó được trả lại bằng dòng payment -deposit "trả lại nợ cho KH" dưới đây nếu refund>0,
      //  hoặc giữ nguyên nếu kept_amount>0 vì KH coi như mất nợ.)
      if (r.customer_id && deposit > 0) {
        await supabase.from('debt_payments').insert([{
          entity_type: 'customer',
          entity_id: r.customer_id,
          payment_type: 'addition',
          amount: deposit,
          payment_source: 'preorder_cancel',
          description: `Hủy phiếu cọc ${r.code} - Bù trừ tiền cọc đã nhận`,
          branch_id: r.branch_id,
          created_by: user.id,
          tenant_id: tenantId,
        } as any]);

        // Nếu lúc cọc dùng nguồn 'debt' (đã tạo addition +deposit) và bây giờ hoàn trả tiền cho KH:
        // tạo thêm payment -refundAmount để trả lại đúng phần đã trừ vào nợ cũ.
        if (r.deposit_payment_source === 'debt' && refundAmount > 0) {
          await supabase.from('debt_payments').insert([{
            entity_type: 'customer',
            entity_id: r.customer_id,
            payment_type: 'payment',
            amount: refundAmount,
            payment_source: 'preorder_cancel_debt_refund',
            description: `Hủy phiếu cọc ${r.code} - Trả lại công nợ đã trừ khi cọc`,
            branch_id: r.branch_id,
            created_by: user.id,
            tenant_id: tenantId,
          } as any]);
        }
      }

      // 4. Ghi sổ quỹ - chi tiền hoàn cọc (nếu có)
      if (refundAmount > 0 && params.refund_payment_source) {
        await supabase.from('cash_book').insert([{
          type: 'expense',
          amount: refundAmount,
          category: 'Hoàn cọc',
          description: `Hoàn cọc phiếu ${r.code}${params.reason ? ' - ' + params.reason : ''}`,
          payment_source: params.refund_payment_source,
          tenant_id: tenantId,
          branch_id: r.branch_id,
          created_by: user.id,
          reference_id: params.preorderId,
          reference_type: 'preorder_refund',
          is_business_accounting: false,
        } as any]);
      }

      // 5. Ghi sổ quỹ - thu nhập khác từ tiền giữ lại (nếu có)
      // Đây là thu nhập "khác" (lợi nhuận ngoài), is_business_accounting=true để vào báo cáo
      if (keptAmount > 0) {
        await supabase.from('cash_book').insert([{
          type: 'income',
          amount: keptAmount,
          category: 'Thu nhập khác - Phạt cọc',
          description: `Giữ cọc từ phiếu ${r.code}${params.reason ? ' - ' + params.reason : ''}`,
          payment_source: r.deposit_payment_source || 'cash',
          tenant_id: tenantId,
          branch_id: r.branch_id,
          created_by: user.id,
          reference_id: params.preorderId,
          reference_type: 'preorder_forfeit',
          is_business_accounting: true,
        } as any]);
      }

      return { refundAmount, keptAmount, newStatus };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preorders'] });
      queryClient.invalidateQueries({ queryKey: ['preorder-reserved-imeis'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      toast({ title: 'Đã hủy phiếu cọc', description: 'Phiếu cọc đã được hủy thành công' });
    },
    onError: (err: any) => {
      toast({ title: 'Lỗi', description: err.message || 'Không thể hủy phiếu cọc', variant: 'destructive' });
    },
  });
}

/**
 * Hoàn thành phiếu cọc: tạo export_receipt thực sự, tính doanh thu/lợi nhuận
 */
export function useCompletePreorder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      preorderId: string;
      additional_payment: number; // Số tiền khách trả thêm (phần còn lại)
      payment_source: string; // 'cash' | 'bank' | 'e_wallet' | 'debt'
      note?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');
      const tenantId = await getTenantId();

      // Lấy phiếu cọc + items
      const [{ data: receipt, error: e0 }, { data: items, error: e1 }] = await Promise.all([
        supabase.from('preorder_receipts' as any).select('*').eq('id', params.preorderId).maybeSingle(),
        supabase.from('preorder_receipt_items' as any).select('*').eq('preorder_id', params.preorderId),
      ]);
      if (e0 || !receipt) throw new Error('Không tìm thấy phiếu cọc');
      if (e1) throw e1;
      const r: any = receipt;
      if (r.status !== 'pending') throw new Error('Phiếu cọc không ở trạng thái chờ');

      const totalAmount = Number(r.total_amount) || 0;
      const deposit = Number(r.deposit_amount) || 0;
      const additional = params.additional_payment;
      const isDebtSource = params.payment_source === 'debt';
      // Nếu chọn 'debt': phần additional được hạch toán là KH trả nợ (cấn vào nợ cũ),
      // coi như đã thanh toán đủ -> debt_amount của export_receipt = 0.
      // Nếu nguồn tiền cụ thể (cash/bank/...): phần thiếu so với tổng đơn ghi vào công nợ.
      const totalPaid = deposit + additional;
      const debtAmount = isDebtSource ? 0 : Math.max(0, totalAmount - totalPaid);

      // 1. Tạo export_receipt với tổng tiền đầy đủ
      const exportCode = `XH${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
      const { data: exportReceipt, error: ex1 } = await supabase
        .from('export_receipts')
        .insert([{
          code: exportCode,
          customer_id: r.customer_id,
          branch_id: r.branch_id,
          sales_staff_id: r.sales_staff_id,
          tenant_id: tenantId,
          total_amount: totalAmount,
          paid_amount: totalPaid,
          debt_amount: debtAmount,
          status: 'completed',
          note: `Hoàn thành từ phiếu cọc ${r.code}${params.note ? ' - ' + params.note : ''}`,
          created_by: user.id,
        } as any])
        .select()
        .single();
      if (ex1) throw ex1;
      const exportReceiptId = (exportReceipt as any).id;

      // 2. Insert export_receipt_items
      if (items && items.length > 0) {
        const itemsPayload = (items as any[]).map(it => ({
          receipt_id: exportReceiptId,
          product_id: it.product_id,
          product_name: it.product_name,
          sku: it.sku,
          imei: it.imei,
          category_id: it.category_id,
          sale_price: Number(it.sale_price),
          quantity: Number(it.quantity) || 1,
          unit: it.unit,
          warranty: it.warranty,
          status: 'sold',
        }));
        const { error: ex2 } = await supabase
          .from('export_receipt_items')
          .insert(itemsPayload);
        if (ex2) throw ex2;
      }

      // 3. Cập nhật phiếu cọc -> completed
      await supabase.from('preorder_receipts' as any).update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        export_receipt_id: exportReceiptId,
      }).eq('id', params.preorderId);

      // 4. Xóa reservation IMEI (đã chuyển sang export_receipt rồi)
      await supabase.from('preorder_imei_reservations' as any)
        .delete().eq('preorder_id', params.preorderId);

      // 5. Đảo lại công nợ ghi khi cọc (mình hết nợ khách vì đã giao hàng)
      // Lúc cọc đã tạo: payment -deposit (mình nợ khách)
      // Giờ giao hàng: tạo addition +deposit để cân bằng (khách "trả" lại bằng hàng)
      if (r.customer_id && deposit > 0) {
        await supabase.from('debt_payments').insert([{
          entity_type: 'customer',
          entity_id: r.customer_id,
          payment_type: 'addition',
          amount: deposit,
          payment_source: 'preorder_complete',
          description: `Hoàn thành phiếu cọc ${r.code} - Cấn trừ tiền cọc vào đơn ${exportCode}`,
          branch_id: r.branch_id,
          created_by: user.id,
          tenant_id: tenantId,
        } as any]);
      }

      // 6. Ghi sổ quỹ phần thanh toán thêm (nếu có nguồn tiền cụ thể)
      if (additional > 0 && params.payment_source && params.payment_source !== 'debt') {
        await supabase.from('cash_book').insert([{
          type: 'income',
          amount: additional,
          category: 'Bán hàng',
          description: `Thanh toán nốt phiếu cọc ${r.code} - Đơn ${exportCode}`,
          payment_source: params.payment_source,
          tenant_id: tenantId,
          branch_id: r.branch_id,
          created_by: user.id,
          reference_id: exportReceiptId,
          reference_type: 'export_receipt',
          is_business_accounting: true,
        } as any]);
      }

      // 7. Xử lý phần thanh toán thêm khi chọn nguồn 'debt' (trừ vào công nợ KH)
      // - Nếu additional > 0: KH "trả nợ" bằng cách dùng giá trị hàng -> payment +additional (giảm nợ KH)
      // - Nếu phần còn thiếu (totalAmount - deposit - additional) > 0: ghi tăng nợ KH
      if (isDebtSource && r.customer_id) {
        if (additional > 0) {
          await supabase.from('debt_payments').insert([{
            entity_type: 'customer',
            entity_id: r.customer_id,
            payment_type: 'payment',
            amount: additional,
            payment_source: 'preorder_complete_debt_offset',
            description: `Hoàn thành phiếu cọc ${r.code} - Trừ ${additional.toLocaleString('vi-VN')}đ vào công nợ KH (đơn ${exportCode})`,
            branch_id: r.branch_id,
            created_by: user.id,
            tenant_id: tenantId,
          } as any]);
        }
        const stillOwed = Math.max(0, totalAmount - deposit - additional);
        if (stillOwed > 0) {
          await supabase.from('debt_payments').insert([{
            entity_type: 'customer',
            entity_id: r.customer_id,
            payment_type: 'addition',
            amount: stillOwed,
            payment_source: 'export_receipt',
            description: `Công nợ phát sinh từ đơn ${exportCode} (hoàn thành cọc)`,
            branch_id: r.branch_id,
            created_by: user.id,
            tenant_id: tenantId,
          } as any]);
        }
      }

      return { exportReceiptId, exportCode };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preorders'] });
      queryClient.invalidateQueries({ queryKey: ['preorder-reserved-imeis'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      toast({ title: 'Đã hoàn thành đơn cọc', description: 'Đã tạo phiếu xuất hàng và ghi nhận doanh thu' });
    },
    onError: (err: any) => {
      toast({ title: 'Lỗi', description: err.message || 'Không thể hoàn thành phiếu cọc', variant: 'destructive' });
    },
  });
}
