import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useCompletedRepairCount(enabled = true) {
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
    enabled: enabled && !!user,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
  });

  return count;
}
