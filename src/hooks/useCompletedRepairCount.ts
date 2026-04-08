import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useCompletedRepairCount() {
  const { user } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ['completed-repair-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('repair_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return count;
}
