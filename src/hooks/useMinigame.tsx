import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrentTenant } from './useTenant';

export interface MinigameCampaign {
  id: string;
  tenant_id: string;
  branch_id?: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'expired';
  background_image?: string;
  wheel_border_image?: string;
  wheel_background_color?: string;
  wheel_border_color?: string;
  spin_button_text?: string;
  spin_button_color?: string;
  max_spins_per_player: number;
  require_phone: boolean;
  require_email: boolean;
  require_name: boolean;
  password?: string;
  no_prize_message?: string;
  no_prize_probability: number;
  sponsor_name?: string;
  sponsor_logo?: string;
  total_views: number;
  total_participants: number;
  total_spins: number;
  start_date: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface MinigamePrize {
  id: string;
  campaign_id: string;
  name: string;
  description?: string;
  image?: string;
  color: string;
  prize_type: string;
  prize_value?: string;
  probability: number;
  total_quantity?: number;
  remaining_quantity?: number;
  max_per_player: number;
  display_order: number;
  is_active: boolean;
  claim_link?: string;
}

// Upload prize image
export async function uploadPrizeImage(file: File, campaignId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${campaignId}/${crypto.randomUUID()}.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from('minigame-assets')
    .upload(fileName, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('minigame-assets')
    .getPublicUrl(fileName);

  return data.publicUrl;
}

export interface MinigameParticipant {
  id: string;
  campaign_id: string;
  name: string;
  phone: string;
  email?: string;
  total_spins: number;
  total_wins: number;
  first_played_at: string;
  last_played_at: string;
}

export interface MinigameSpin {
  id: string;
  campaign_id: string;
  participant_id: string;
  prize_id?: string;
  result_type: 'prize' | 'no_prize';
  prize_name?: string;
  prize_value?: string;
  prize_code?: string;
  is_virtual?: boolean;
  claimed_at?: string;
  claim_info?: Record<string, unknown>;
  ip_address?: string;
  spun_at: string;
  participant?: {
    name: string;
    phone: string;
    email?: string;
  };
  prize?: {
    name: string;
    color: string;
  };
}

export function useMinigameCampaigns() {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;

  return useQuery({
    queryKey: ['minigame-campaigns', isDataHidden],
    queryFn: async () => {
      if (isDataHidden) return [] as MinigameCampaign[];

      const { data, error } = await supabase
        .from('minigame_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MinigameCampaign[];
    },
    enabled: !isTenantLoading,
    refetchOnWindowFocus: false,
  });
}

export function useMinigameCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ['minigame-campaign', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('minigame_campaigns')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as MinigameCampaign;
    },
    enabled: !!id,
    refetchOnWindowFocus: false,
  });
}

export function useMinigamePrizes(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['minigame-prizes', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .from('minigame_prizes')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as MinigamePrize[];
    },
    enabled: !!campaignId,
    refetchOnWindowFocus: false,
  });
}

export function useMinigameParticipants(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['minigame-participants', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .from('minigame_participants')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('last_played_at', { ascending: false });

      if (error) throw error;
      return data as MinigameParticipant[];
    },
    enabled: !!campaignId,
    refetchOnWindowFocus: false,
  });
}

export function useMinigameSpins(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['minigame-spins', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .from('minigame_spins')
        .select(`
          *,
          participant:minigame_participants(name, phone, email),
          prize:minigame_prizes(name, color)
        `)
        .eq('campaign_id', campaignId)
        .order('spun_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as MinigameSpin[];
    },
    enabled: !!campaignId,
    refetchOnWindowFocus: false,
  });
}

export function useCreateMinigameCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: tenant } = useCurrentTenant();

  return useMutation({
    mutationFn: async (campaign: Partial<MinigameCampaign>) => {
      if (!tenant?.id) throw new Error('Không tìm thấy thông tin cửa hàng');

      const insertData = {
        name: campaign.name || 'Untitled',
        tenant_id: tenant.id,
        description: campaign.description,
        status: campaign.status,
        background_image: campaign.background_image,
        wheel_border_image: campaign.wheel_border_image,
        wheel_background_color: campaign.wheel_background_color,
        wheel_border_color: campaign.wheel_border_color,
        spin_button_text: campaign.spin_button_text,
        spin_button_color: campaign.spin_button_color,
        max_spins_per_player: campaign.max_spins_per_player,
        require_phone: campaign.require_phone,
        require_email: campaign.require_email,
        require_name: campaign.require_name,
        password: campaign.password,
        no_prize_message: campaign.no_prize_message,
        no_prize_probability: campaign.no_prize_probability,
        sponsor_name: campaign.sponsor_name,
        sponsor_logo: campaign.sponsor_logo,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
      };

      const { data, error } = await supabase
        .from('minigame_campaigns')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data as MinigameCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minigame-campaigns'] });
      toast({
        title: 'Thành công',
        description: 'Đã tạo chiến dịch Mini Game mới',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateMinigameCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MinigameCampaign> & { id: string }) => {
      const { data, error } = await supabase
        .from('minigame_campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['minigame-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['minigame-campaign', data.id] });
      toast({
        title: 'Thành công',
        description: 'Đã cập nhật chiến dịch',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteMinigameCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('minigame_campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minigame-campaigns'] });
      toast({
        title: 'Thành công',
        description: 'Đã xóa chiến dịch',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Prize mutations
export function useCreateMinigamePrize() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (prize: Partial<MinigamePrize> & { campaign_id: string; name: string }) => {
      const insertData = {
        campaign_id: prize.campaign_id,
        name: prize.name,
        description: prize.description,
        image: prize.image,
        color: prize.color,
        prize_type: prize.prize_type,
        prize_value: prize.prize_value,
        probability: prize.probability,
        total_quantity: prize.total_quantity,
        remaining_quantity: prize.remaining_quantity,
        max_per_player: prize.max_per_player,
        display_order: prize.display_order,
        is_active: prize.is_active,
      };

      const { data, error } = await supabase
        .from('minigame_prizes')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['minigame-prizes', data.campaign_id] });
      toast({
        title: 'Thành công',
        description: 'Đã thêm giải thưởng',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateMinigamePrize() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MinigamePrize> & { id: string }) => {
      const { data, error } = await supabase
        .from('minigame_prizes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['minigame-prizes', data.campaign_id] });
      toast({
        title: 'Thành công',
        description: 'Đã cập nhật giải thưởng',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteMinigamePrize() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, campaignId }: { id: string; campaignId: string }) => {
      const { error } = await supabase
        .from('minigame_prizes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { campaignId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['minigame-prizes', data.campaignId] });
      toast({
        title: 'Thành công',
        description: 'Đã xóa giải thưởng',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Stats for dashboard
export function useMinigameStats() {
  const { data: tenant, isLoading: isTenantLoading } = useCurrentTenant();
  const isDataHidden = tenant?.is_data_hidden ?? false;

  return useQuery({
    queryKey: ['minigame-stats', isDataHidden],
    queryFn: async () => {
      if (isDataHidden) {
        return {
          totalCampaigns: 0,
          activeCampaigns: 0,
          totalParticipants: 0,
          totalSpins: 0,
          todaySpins: 0,
        };
      }

      const { data: campaigns } = await supabase
        .from('minigame_campaigns')
        .select('id, status, total_participants, total_spins');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: todaySpinsCount } = await supabase
        .from('minigame_spins')
        .select('*', { count: 'exact', head: true })
        .gte('spun_at', today.toISOString());

      const totalCampaigns = campaigns?.length || 0;
      const activeCampaigns = campaigns?.filter(c => c.status === 'active').length || 0;
      const totalParticipants = campaigns?.reduce((sum, c) => sum + (c.total_participants || 0), 0) || 0;
      const totalSpins = campaigns?.reduce((sum, c) => sum + (c.total_spins || 0), 0) || 0;

      return {
        totalCampaigns,
        activeCampaigns,
        totalParticipants,
        totalSpins,
        todaySpins: todaySpinsCount || 0,
      };
    },
    enabled: !isTenantLoading,
    refetchOnWindowFocus: false,
  });
}
