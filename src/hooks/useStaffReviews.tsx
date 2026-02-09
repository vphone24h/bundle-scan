import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface StaffReview {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  staff_user_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  rating: number;
  content: string | null;
  created_at: string;
  // Joined
  staff_name: string | null;
  branch_name: string | null;
}

interface UseStaffReviewsOptions {
  tenantId: string | null;
  branchId?: string | null;
  staffUserId?: string | null;
  rating?: number | null;
  searchStaffName?: string;
}

export function useStaffReviews({
  tenantId,
  branchId,
  staffUserId,
  rating,
  searchStaffName,
}: UseStaffReviewsOptions) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['staff-reviews', user?.id, tenantId, branchId, staffUserId, rating, searchStaffName],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('staff_reviews' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      if (staffUserId) {
        query = query.eq('staff_user_id', staffUserId);
      }

      if (rating) {
        query = query.eq('rating', rating);
      }

      const { data, error } = await query;
      if (error) throw error;

      const reviews = (data || []) as any[];

      // Fetch staff names and branch names
      const staffIds = [...new Set(reviews.map(r => r.staff_user_id).filter(Boolean))];
      const branchIds = [...new Set(reviews.map(r => r.branch_id).filter(Boolean))];

      const [profilesRes, branchesRes] = await Promise.all([
        staffIds.length > 0
          ? supabase.from('profiles').select('user_id, display_name').in('user_id', staffIds)
          : { data: [] },
        branchIds.length > 0
          ? supabase.from('branches').select('id, name').in('id', branchIds)
          : { data: [] },
      ]);

      const profilesMap = new Map(
        (profilesRes.data || []).map((p: any) => [p.user_id, p.display_name])
      );
      const branchesMap = new Map(
        (branchesRes.data || []).map((b: any) => [b.id, b.name])
      );

      let result: StaffReview[] = reviews.map(r => ({
        ...r,
        staff_name: profilesMap.get(r.staff_user_id) || 'Không rõ',
        branch_name: branchesMap.get(r.branch_id) || null,
      }));

      // Client-side filter by staff name search
      if (searchStaffName?.trim()) {
        const search = searchStaffName.trim().toLowerCase();
        result = result.filter(r =>
          r.staff_name?.toLowerCase().includes(search)
        );
      }

      return result;
    },
    enabled: !!tenantId && !!user,
  });
}
