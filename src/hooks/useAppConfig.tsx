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

export function useImportGuideUrl() {
  const { data: configs } = useAppConfig();
  return configs?.find(c => c.config_key === 'import_guide_url')?.config_value || null;
}

export function useCustomDomainArticle() {
  const { data: configs } = useAppConfig();
  return configs?.find(c => c.config_key === 'custom_domain_article')?.config_value || null;
}

export function useTaxGuideUrl() {
  const { data: configs } = useAppConfig();
  return configs?.find(c => c.config_key === 'tax_guide_url')?.config_value || null;
}

export function useLandingGuideUrl() {
  const { data: configs } = useAppConfig();
  return configs?.find(c => c.config_key === 'landing_guide_url')?.config_value || null;
}

export function useUsersGuideUrl() {
  const { data: configs } = useAppConfig();
  return configs?.find(c => c.config_key === 'users_guide_url')?.config_value || null;
}

export function useStockCountGuideUrl() {
  const { data: configs } = useAppConfig();
  return configs?.find(c => c.config_key === 'stock_count_guide_url')?.config_value || null;
}

// Public version - no auth required, fetches specific key
export function useCustomDomainArticlePublic() {
  return useQuery({
    queryKey: ['custom-domain-article-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_config')
        .select('config_value')
        .eq('config_key', 'custom_domain_article')
        .maybeSingle();
      if (error) return null;
      return data?.config_value || null;
    },
    staleTime: 5 * 60 * 1000, // cache 5 min
  });
}
