import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AppConfig {
  config_key: string;
  config_value: string | null;
}

export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_config')
        .select('config_key, config_value');
      if (error) throw error;
      return data as AppConfig[];
    },
  });
}

export function useUserGuideUrl() {
  const { data: configs } = useAppConfig();
  return configs?.find(c => c.config_key === 'user_guide_url')?.config_value || null;
}

export function useCashBookGuideUrl() {
  const { data: configs } = useAppConfig();
  return configs?.find(c => c.config_key === 'cash_book_guide_url')?.config_value || null;
}

export function useReportsGuideUrl() {
  const { data: configs } = useAppConfig();
  return configs?.find(c => c.config_key === 'reports_guide_url')?.config_value || null;
}

export function useBarcodePrintGuideUrl() {
  const { data: configs } = useAppConfig();
  return configs?.find(c => c.config_key === 'barcode_print_guide_url')?.config_value || null;
}
