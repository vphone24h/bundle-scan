import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// Get VAPID public key from DB
export function useVapidPublicKey() {
  return useQuery({
    queryKey: ['vapid-public-key'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_vapid_public_key');
      if (error) throw error;
      return (data as string) || null;
    },
  });
}

// Check if current user has a push subscription
export function usePushSubscriptionStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['push-subscription-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { count, error } = await supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (error) throw error;
      return (count || 0) > 0;
    },
    enabled: !!user?.id,
  });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Subscribe to push notifications
export function useSubscribePush() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (vapidPublicKey: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push notifications không được hỗ trợ trên trình duyệt này');
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw-push.js');
      await navigator.serviceWorker.ready;

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Bạn cần cho phép thông báo để nhận push notification');
      }

      // Subscribe
      const pm = (registration as any).pushManager;
      const subscription = await pm.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const p256dh = arrayBufferToBase64Url(subscription.getKey('p256dh')!);
      const auth = arrayBufferToBase64Url(subscription.getKey('auth')!);

      // Get tenant_id
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_secure');

      // Save to DB
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh,
          auth_key: auth,
          tenant_id: tenantId || null,
        }, { onConflict: 'user_id,endpoint' });

      if (error) throw error;
      return subscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-subscription-status'] });
      toast.success('Đã bật thông báo đẩy');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Unsubscribe from push
export function useUnsubscribePush() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const registration = await navigator.serviceWorker.getRegistration('/sw-push.js');
      if (registration) {
        const pm = (registration as any).pushManager;
        const subscription = await pm?.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint);
        }
      }

      // Also remove all subscriptions for this user
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-subscription-status'] });
      toast.success('Đã tắt thông báo đẩy');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Generate VAPID keys (admin only)
export function useGenerateVapidKeys() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-vapid-keys');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vapid-public-key'] });
    },
  });
}
