import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useOnboardingTour(tourKey: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: isCompleted, isLoading } = useQuery({
    queryKey: ['onboarding-tour', tourKey, user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('onboarding_tours')
        .select('id')
        .eq('user_id', user.id)
        .eq('tour_key', tourKey)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  const completeTour = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      await supabase.from('onboarding_tours').insert({
        user_id: user.id,
        tour_key: tourKey,
        tenant_id: null,
      });
    },
    onSuccess: () => {
      queryClient.setQueryData(['onboarding-tour', tourKey, user?.id], true);
    },
  });

  return {
    isCompleted: isCompleted ?? true, // default true to avoid flash
    isLoading,
    completeTour: completeTour.mutate,
  };
}
