import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ExportReceiptItem {
  id?: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  imei: string | null;
  category_id: string | null;
  sale_price: number;
  note?: string | null;
}

export interface ExportPayment {
  payment_type: 'cash' | 'bank_card' | 'e_wallet' | 'debt';
  amount: number;
}

export interface ExportReceipt {
  id: string;
  code: string;
  export_date: string;
  customer_id: string | null;
  branch_id: string | null;
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
  status: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  customers?: { name: string; phone: string; address: string | null } | null;
  branches?: { name: string } | null;
  export_receipt_items?: ExportReceiptItemDetail[];
  export_receipt_payments?: { payment_type: string; amount: number }[];
}

export interface ExportReceiptItemDetail {
  id: string;
  receipt_id: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  imei: string | null;
  category_id: string | null;
  sale_price: number;
  status: string;
  note: string | null;
  created_at: string;
  // Joined
  categories?: { name: string } | null;
  products?: { import_price: number } | null;
  export_receipts?: {
    code: string;
    export_date: string;
    branch_id: string | null;
    customer_id: string | null;
    customers?: { name: string; phone: string } | null;
    branches?: { name: string } | null;
  } | null;
}

export function useExportReceipts() {
  return useQuery({
    queryKey: ['export-receipts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('export_receipts')
        .select(`
          *,
          customers(name, phone, address),
          branches(name),
          export_receipt_items(*),
          export_receipt_payments(*)
        `)
        .order('export_date', { ascending: false });

      if (error) throw error;
      return data as ExportReceipt[];
    },
  });
}

export function useExportReceiptItems() {
  return useQuery({
    queryKey: ['export-receipt-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('export_receipt_items')
        .select(`
          *,
          categories(name),
          products(import_price),
          export_receipts(
            code,
            export_date,
            branch_id,
            customer_id,
            customers(name, phone),
            branches(name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ExportReceiptItemDetail[];
    },
  });
}

export function useCreateExportReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      items,
      payments,
      note,
    }: {
      customerId: string;
      items: ExportReceiptItem[];
      payments: ExportPayment[];
      note?: string;
    }) => {
      const totalAmount = items.reduce((sum, item) => sum + item.sale_price, 0);
      const paidAmount = payments
        .filter((p) => p.payment_type !== 'debt')
        .reduce((sum, p) => sum + p.amount, 0);
      const debtAmount = payments
        .filter((p) => p.payment_type === 'debt')
        .reduce((sum, p) => sum + p.amount, 0);

      // Generate receipt code
      const date = new Date();
      const code = `XH${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Create receipt
      const { data: receipt, error: receiptError } = await supabase
        .from('export_receipts')
        .insert([
          {
            code,
            customer_id: customerId,
            total_amount: totalAmount,
            paid_amount: paidAmount,
            debt_amount: debtAmount,
            note,
            created_by: user?.id,
          },
        ])
        .select()
        .single();

      if (receiptError) throw receiptError;

      // Insert items
      const itemsToInsert = items.map((item) => ({
        receipt_id: receipt.id,
        product_id: item.product_id,
        product_name: item.product_name,
        sku: item.sku,
        imei: item.imei,
        category_id: item.category_id,
        sale_price: item.sale_price,
        note: item.note,
      }));

      const { error: itemsError } = await supabase
        .from('export_receipt_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Insert payments
      const paymentsToInsert = payments
        .filter((p) => p.amount > 0)
        .map((p) => ({
          receipt_id: receipt.id,
          payment_type: p.payment_type,
          amount: p.amount,
        }));

      if (paymentsToInsert.length > 0) {
        const { error: paymentsError } = await supabase
          .from('export_receipt_payments')
          .insert(paymentsToInsert);

        if (paymentsError) throw paymentsError;
      }

      // Update product status to 'sold' for items with product_id
      for (const item of items) {
        if (item.product_id) {
          await supabase
            .from('products')
            .update({ status: 'sold' })
            .eq('id', item.product_id);

          // Record IMEI history if applicable
          if (item.imei) {
            await supabase.from('imei_histories').insert([
              {
                product_id: item.product_id,
                imei: item.imei,
                action_type: 'export',
                reference_id: receipt.id,
                reference_type: 'export_receipt',
                price: item.sale_price,
                customer_id: customerId,
                created_by: user?.id,
              },
            ]);
          }
        }
      }

      return receipt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipt-items'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useReturnProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      receiptId,
      productId,
      imei,
    }: {
      itemId: string;
      receiptId: string;
      productId: string | null;
      imei: string | null;
    }) => {
      // Update item status
      const { error: itemError } = await supabase
        .from('export_receipt_items')
        .update({ status: 'returned' })
        .eq('id', itemId);

      if (itemError) throw itemError;

      // Update product status back to in_stock
      if (productId) {
        await supabase
          .from('products')
          .update({ status: 'in_stock' })
          .eq('id', productId);

        // Record IMEI history
        if (imei) {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('imei_histories').insert([
            {
              product_id: productId,
              imei: imei,
              action_type: 'return',
              reference_id: receiptId,
              reference_type: 'export_receipt',
              created_by: user?.id,
            },
          ]);
        }
      }

      // Check if all items are returned
      const { data: remainingItems } = await supabase
        .from('export_receipt_items')
        .select('id, status')
        .eq('receipt_id', receiptId);

      const allReturned = remainingItems?.every((i) => i.status === 'returned');
      const someReturned = remainingItems?.some((i) => i.status === 'returned');

      // Update receipt status
      let newStatus = 'completed';
      if (allReturned) {
        newStatus = 'full_return';
      } else if (someReturned) {
        newStatus = 'partial_return';
      }

      await supabase
        .from('export_receipts')
        .update({ status: newStatus })
        .eq('id', receiptId);

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['export-receipt-items'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useCheckProductForSale() {
  return useMutation({
    mutationFn: async (imei: string) => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          imei,
          import_price,
          status,
          category_id,
          categories(name)
        `)
        .eq('imei', imei)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

export function useSearchProductsByName() {
  return useMutation({
    mutationFn: async (searchTerm: string) => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          imei,
          import_price,
          status,
          category_id,
          categories(name)
        `)
        .eq('status', 'in_stock')
        .ilike('name', `%${searchTerm}%`)
        .limit(10);

      if (error) throw error;
      return data;
    },
  });
}
