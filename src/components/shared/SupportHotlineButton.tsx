import { useQuery } from '@tanstack/react-query';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenant } from '@/hooks/useTenant';
import { useCompanySettings } from '@/hooks/useCompanySettings';

/**
 * Nút Hotline hỗ trợ — đọc số điện thoại từ payment_config (key='hotline')
 * theo công ty hiện tại, fallback sang công ty mặc định (company_id IS NULL)
 * và cuối cùng là số điện thoại cấu hình ở company_settings.
 */
export function SupportHotlineButton() {
  const { data: tenant } = useCurrentTenant();
  const { data: companySettings } = useCompanySettings();

  const { data: hotline } = useQuery({
    queryKey: ['support-hotline', tenant?.company_id ?? 'platform'],
    queryFn: async () => {
      // Ưu tiên config theo công ty
      if (tenant?.company_id) {
        const { data } = await supabase
          .from('payment_config')
          .select('config_value')
          .eq('company_id', tenant.company_id)
          .eq('config_key', 'hotline')
          .maybeSingle();
        if (data?.config_value) return data.config_value as string;
      }
      // Fallback: hotline mặc định của platform
      const { data: platformHotline } = await supabase
        .from('payment_config')
        .select('config_value')
        .is('company_id', null)
        .eq('config_key', 'hotline')
        .maybeSingle();
      return (platformHotline?.config_value as string | undefined) || '';
    },
    enabled: !!tenant,
    staleTime: 5 * 60 * 1000,
  });

  const phone = hotline || companySettings?.phone || '';
  if (!phone) return null;

  const telHref = `tel:${phone.replace(/\s/g, '')}`;

  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className="h-8 text-xs sm:text-sm border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
      title="Gọi hotline hỗ trợ"
    >
      <a href={telHref}>
        <Phone className="mr-1.5 h-4 w-4" />
        <span className="font-semibold tracking-wide">{phone}</span>
      </a>
    </Button>
  );
}
