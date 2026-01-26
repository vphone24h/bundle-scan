import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type ReceiptStatus = Database['public']['Enums']['receipt_status'];
type PaymentType = Database['public']['Enums']['payment_type'];

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
  return useQuery({
    queryKey: ['import-receipts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_receipts')
        .select(`
          *,
          suppliers(name),
          branches(name)
        `)
        .order('import_date', { ascending: false });

      if (error) throw error;
      return data as ImportReceipt[];
    },
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

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          categories(name),
          suppliers(name)
        `)
        .eq('import_receipt_id', receiptId);

      if (productsError) throw productsError;

      return {
        receipt,
        payments: payments as ReceiptPayment[],
        products,
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

      // Create products - for non-IMEI products with quantity > 1, create multiple rows
      const productRows: {
        name: string;
        sku: string;
        imei?: string | null;
        category_id?: string | null;
        import_price: number;
        supplier_id?: string | null;
        import_receipt_id: string;
        branch_id?: string | null;
        note?: string | null;
      }[] = [];

      for (const p of products) {
        if (p.imei) {
          // IMEI product: always 1 row
          productRows.push({
            name: p.name,
            sku: p.sku,
            imei: p.imei,
            category_id: p.category_id,
            import_price: p.import_price,
            supplier_id: supplierId,
            import_receipt_id: receipt.id,
            branch_id: branchId || null,
            note: p.note,
          });
        } else {
          // Non-IMEI product: create `quantity` rows
          for (let i = 0; i < p.quantity; i++) {
            productRows.push({
              name: p.name,
              sku: p.sku,
              imei: null,
              category_id: p.category_id,
              import_price: p.import_price,
              supplier_id: supplierId,
              import_receipt_id: receipt.id,
              branch_id: branchId || null,
              note: p.note,
            });
          }
        }
      }

      const { error: productsError } = await supabase
        .from('products')
        .insert(productRows);

      if (productsError) throw productsError;

      // Create cash book entries for actual payments (not debt)
      // payment_source must match constraint: 'cash', 'bank_card', 'e_wallet'
      const cashBookEntries = payments
        .filter(p => p.type !== 'debt' && p.amount > 0)
        .map(p => ({
          type: 'expense' as const,
          category: 'Nhập hàng',
          description: `Thanh toán phiếu nhập ${code}`,
          amount: p.amount,
          payment_source: p.type, // Use the original payment type directly
          is_business_accounting: false, // Không hạch toán vì chi phí đã tính trong lợi nhuận (giá bán - giá nhập)
          branch_id: branchId || null,
          reference_id: receipt.id,
          reference_type: 'import_receipt',
          created_by: user.id,
        }));

      if (cashBookEntries.length > 0) {
        const { error: cashBookError } = await supabase
          .from('cash_book')
          .insert(cashBookEntries);

        if (cashBookError) throw cashBookError;
      }

      return receipt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
    },
  });
}
