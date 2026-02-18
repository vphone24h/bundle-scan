import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useOnboardingTour(tourKey: string, options?: { reshowAfterDays?: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: isCompleted, isLoading } = useQuery({
    queryKey: ['onboarding-tour', tourKey, user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('onboarding_tours')
        .select('id, completed_at')
        .eq('user_id', user.id)
        .eq('tour_key', tourKey)
        .maybeSingle();

      if (!data) return false;

      // If reshowAfterDays is set, check if user hasn't logged in for N days
      // by comparing last_sign_in_at with completed_at
      if (options?.reshowAfterDays && user.last_sign_in_at) {
        const completedAt = new Date(data.completed_at).getTime();
        const lastSignIn = new Date(user.last_sign_in_at).getTime();
        const daysSinceComplete = (lastSignIn - completedAt) / (1000 * 60 * 60 * 24);

        if (daysSinceComplete >= options.reshowAfterDays) {
          // Delete old record so tour shows again, then re-save after completion
          await supabase.from('onboarding_tours').delete().eq('id', data.id);
          return false;
        }
      }

      return true;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  const completeTour = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      // Use upsert to save in a single round-trip
      await supabase.from('onboarding_tours').upsert({
        user_id: user.id,
        tour_key: tourKey,
        tenant_id: null,
      }, { onConflict: 'user_id,tour_key' });
    },
    onMutate: () => {
      // Optimistic update: mark as done immediately so UI closes instantly
      queryClient.setQueryData(['onboarding-tour', tourKey, user?.id], true);
    },
  });

  return {
    isCompleted: isCompleted ?? true,
    isLoading,
    completeTour: completeTour.mutate,
  };
}
