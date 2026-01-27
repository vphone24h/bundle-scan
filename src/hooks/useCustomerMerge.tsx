import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DuplicateCustomerGroup {
  key: string; // name_phone
  name: string;
  phone: string;
  customers: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    total_spent: number;
    current_points: number;
    pending_points: number;
    total_points_earned: number;
    total_points_used: number;
    created_at: string;
    last_purchase_date: string | null;
  }[];
  totalSpent: number;
  totalPoints: number;
}

// Hook: Tìm khách hàng trùng lặp (cùng tên + cùng SĐT)
export function useDuplicateCustomers() {
  return useQuery({
    queryKey: ['duplicate-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, email, total_spent, current_points, pending_points, total_points_earned, total_points_used, created_at, last_purchase_date')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by normalized name + phone
      const groups: Record<string, DuplicateCustomerGroup> = {};
      
      (data || []).forEach((customer) => {
        const normalizedName = customer.name.trim().toLowerCase();
        const normalizedPhone = customer.phone.replace(/\s+/g, '').trim();
        const key = `${normalizedName}_${normalizedPhone}`;

        if (!groups[key]) {
          groups[key] = {
            key,
            name: customer.name,
            phone: customer.phone,
            customers: [],
            totalSpent: 0,
            totalPoints: 0,
          };
        }

        groups[key].customers.push(customer);
        groups[key].totalSpent += customer.total_spent || 0;
        groups[key].totalPoints += customer.current_points || 0;
      });

      // Filter only groups with duplicates (more than 1 customer)
      return Object.values(groups).filter(g => g.customers.length > 1);
    },
  });
}

// Hook: Gộp khách hàng
export function useMergeCustomers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      primaryCustomerId, 
      duplicateCustomerIds 
    }: { 
      primaryCustomerId: string; 
      duplicateCustomerIds: string[];
    }) => {
      // Get all customer details
      const { data: customers, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .in('id', [primaryCustomerId, ...duplicateCustomerIds]);

      if (fetchError) throw fetchError;
      if (!customers || customers.length === 0) throw new Error('Không tìm thấy khách hàng');

      const primary = customers.find(c => c.id === primaryCustomerId);
      if (!primary) throw new Error('Không tìm thấy khách hàng chính');

      const duplicates = customers.filter(c => duplicateCustomerIds.includes(c.id));

      // Calculate merged totals
      const mergedPoints = duplicates.reduce((sum, c) => sum + (c.current_points || 0), primary.current_points || 0);
      const mergedPendingPoints = duplicates.reduce((sum, c) => sum + (c.pending_points || 0), primary.pending_points || 0);
      const mergedTotalEarned = duplicates.reduce((sum, c) => sum + (c.total_points_earned || 0), primary.total_points_earned || 0);
      const mergedTotalUsed = duplicates.reduce((sum, c) => sum + (c.total_points_used || 0), primary.total_points_used || 0);
      const mergedTotalSpent = duplicates.reduce((sum, c) => sum + (c.total_spent || 0), primary.total_spent || 0);

      // Find latest purchase date
      const allPurchaseDates = customers
        .map(c => c.last_purchase_date)
        .filter(Boolean)
        .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime());
      const latestPurchaseDate = allPurchaseDates[0] || null;

      // Step 1: Update all export_receipts to point to primary customer
      for (const dupId of duplicateCustomerIds) {
        const { error: updateReceiptsError } = await supabase
          .from('export_receipts')
          .update({ customer_id: primaryCustomerId })
          .eq('customer_id', dupId);

        if (updateReceiptsError) throw updateReceiptsError;

        // Update export_returns
        const { error: updateReturnsError } = await supabase
          .from('export_returns')
          .update({ customer_id: primaryCustomerId })
          .eq('customer_id', dupId);

        if (updateReturnsError) throw updateReturnsError;

        // Update point_transactions
        const { error: updatePointsError } = await supabase
          .from('point_transactions')
          .update({ customer_id: primaryCustomerId })
          .eq('customer_id', dupId);

        if (updatePointsError) throw updatePointsError;

        // Update debt_payments
        const { error: updateDebtError } = await supabase
          .from('debt_payments')
          .update({ entity_id: primaryCustomerId })
          .eq('entity_id', dupId)
          .eq('entity_type', 'customer');

        if (updateDebtError) throw updateDebtError;

        // Update imei_histories
        const { error: updateImeiError } = await supabase
          .from('imei_histories')
          .update({ customer_id: primaryCustomerId })
          .eq('customer_id', dupId);

        if (updateImeiError) throw updateImeiError;
      }

      // Step 2: Update primary customer with merged data
      const { error: updatePrimaryError } = await supabase
        .from('customers')
        .update({
          current_points: mergedPoints,
          pending_points: mergedPendingPoints,
          total_points_earned: mergedTotalEarned,
          total_points_used: mergedTotalUsed,
          total_spent: mergedTotalSpent,
          last_purchase_date: latestPurchaseDate,
          // Keep primary's other info (email, address, etc.)
        })
        .eq('id', primaryCustomerId);

      if (updatePrimaryError) throw updatePrimaryError;

      // Step 3: Delete duplicate customers
      const { error: deleteError } = await supabase
        .from('customers')
        .delete()
        .in('id', duplicateCustomerIds);

      if (deleteError) throw deleteError;

      return { 
        mergedCount: duplicateCustomerIds.length + 1,
        primaryId: primaryCustomerId,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-with-points'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail'] });
      queryClient.invalidateQueries({ queryKey: ['customer-purchase-history'] });
      toast.success(`Đã gộp ${result.mergedCount} khách hàng thành công`);
    },
    onError: (error) => {
      toast.error('Lỗi khi gộp khách hàng: ' + (error as Error).message);
    },
  });
}
