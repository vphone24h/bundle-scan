import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useState, useCallback } from 'react';

// Client-side SHA-256 hash matching edge function logic
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "vkho_security_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export function useSecurityPasswordStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['security-password-status', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_tenant_has_security_password' as any);
      if (error) throw error;
      return !!data;
    },
    enabled: !!user?.id,
  });
}

export function useSetSecurityPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ password, oldPassword }: { password: string; oldPassword?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('security-password', {
        body: { action: 'set_password', password, old_password: oldPassword },
      });
      if (res.error) throw new Error(res.error.message || 'Error');
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-password-status'] });
    },
  });
}

export function useRemoveSecurityPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (password: string) => {
      const res = await supabase.functions.invoke('security-password', {
        body: { action: 'remove_password', password },
      });
      if (res.error) throw new Error(res.error.message || 'Error');
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-password-status'] });
    },
  });
}

export function useVerifySecurityPassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const hashed = await hashPassword(password);
      const { data, error } = await supabase.rpc('verify_security_password_hash' as any, { p_hash: hashed });
      if (error) throw error;
      return { valid: !!data };
    },
  });
}

export function useRequestResetOTP() {
  return useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('security-password', {
        body: { action: 'request_reset_otp' },
      });
      if (res.error) throw new Error(res.error.message || 'Error');
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
  });
}

export function useVerifyResetOTP() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ otp, newPassword }: { otp: string; newPassword: string }) => {
      const res = await supabase.functions.invoke('security-password', {
        body: { action: 'verify_reset_otp', otp, new_password: newPassword },
      });
      if (res.error) throw new Error(res.error.message || 'Error');
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-password-status'] });
    },
  });
}

// Session-level unlock state (lost on page refresh)
let unlockedSessions: Record<string, boolean> = {};

export function useSecurityUnlock(key: string) {
  const [unlocked, setUnlocked] = useState(() => unlockedSessions[key] || false);

  const unlock = useCallback(() => {
    unlockedSessions[key] = true;
    setUnlocked(true);
  }, [key]);

  const lock = useCallback(() => {
    unlockedSessions[key] = false;
    setUnlocked(false);
  }, [key]);

  return { unlocked, unlock, lock };
}
