import { supabase } from '@/integrations/supabase/client';

/**
 * Fire-and-forget: gửi email cảnh báo đăng nhập mới.
 * Không block luồng đăng nhập, không throw.
 */
export function sendLoginAlert(userId: string, email?: string, tenantId?: string | null) {
  try {
    const user_agent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    supabase.functions
      .invoke('send-login-alert', {
        body: { user_id: userId, email, user_agent, tenant_id: tenantId ?? null },
      })
      .then(({ error }) => {
        if (error) console.warn('Login alert failed:', error.message);
      })
      .catch((err) => console.warn('Login alert failed:', err));
  } catch (err) {
    console.warn('Login alert error:', err);
  }
}
