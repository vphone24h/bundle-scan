import { supabase } from '@/integrations/supabase/client';

/**
 * Send a push notification to all users in the same tenant (except the current user).
 * Fire-and-forget: errors are silently caught so business logic is never blocked.
 */
export async function sendBusinessPush({
  title,
  message,
  url = '/',
  tenantId,
  excludeUserId,
}: {
  title: string;
  message: string;
  url?: string;
  tenantId: string;
  excludeUserId?: string;
}) {
  try {
    await supabase.functions.invoke('send-push', {
      body: {
        title,
        message,
        url,
        tenant_id: tenantId,
        exclude_user_id: excludeUserId,
      },
    });
  } catch {
    // Silent - push is best-effort, don't break business flows
  }
}

/** Format VND currency */
export function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + 'đ';
}
