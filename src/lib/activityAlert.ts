import { supabase } from '@/integrations/supabase/client';

/**
 * Fire-and-forget: gửi email thông báo đến admin khi có hoạt động mới
 * Không throw error để không ảnh hưởng tới luồng chính
 */
export function sendActivityAlert(
  type: 'export' | 'import' | 'cashbook' | 'stockcount',
  tenantId: string,
  data: Record<string, any>
) {
  // Fire and forget - không await
  supabase.functions.invoke('send-activity-alert', {
    body: { type, tenant_id: tenantId, data },
  }).then(({ error }) => {
    if (error) console.warn('Activity alert failed:', error.message);
  }).catch((err) => {
    console.warn('Activity alert failed:', err);
  });
}
