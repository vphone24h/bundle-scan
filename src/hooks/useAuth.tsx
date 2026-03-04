import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const CURRENT_STORE_ID_KEY = 'current_store_id';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Debounce guard: prevent multiple simultaneous refresh calls across tabs
  const refreshingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Safely refresh session with debounce to prevent refresh-token rotation conflicts
   * when multiple tabs try to refresh simultaneously.
   */
  const debouncedSessionCheck = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;

      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
        } else {
          // No session in memory — try refresh once before giving up
          const { data: { session: refreshed } } = await supabase.auth.refreshSession();
          if (refreshed) {
            setSession(refreshed);
            setUser(refreshed.user);
          }
          // If refresh also fails, DON'T force logout —
          // let onAuthStateChange handle SIGNED_OUT naturally.
          // This prevents logout during temporary token gaps.
        }
      } catch {
        // Network error etc — don't force logout
      } finally {
        refreshingRef.current = false;
      }
    }, 300); // 300ms debounce — prevents storm of refresh calls
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        // Clear cache when user signs out or signs in (to prevent tenant data leakage)
        if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
          queryClient.clear();
        }
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    });

    // Auto-refresh session when app comes back to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        debouncedSessionCheck();
      }
    };

    // Also refresh on window focus (helps with PWA on iOS)
    const handleFocus = () => {
      debouncedSessionCheck();
    };

    /**
     * Cross-tab sync via localStorage 'storage' event.
     * The 'storage' event ONLY fires in OTHER tabs (not the one that wrote).
     *
     * Cases:
     * 1. Tab A logs in → localStorage gets auth token → Tab B detects & picks up session (auto-login)
     * 2. Tab A logs out → localStorage auth token removed → Tab B detects & clears session (auto-logout)
     */
    const handleStorageChange = (e: StorageEvent) => {
      // Supabase stores session under key: sb-<ref>-auth-token
      if (!e.key || !e.key.includes('auth-token')) return;

      if (e.newValue === null || e.newValue === '') {
        // Token was REMOVED → another tab logged out
        setSession(null);
        setUser(null);
        queryClient.clear();
      } else if (e.oldValue === null && e.newValue) {
        // Token was ADDED → another tab logged in
        // Small delay to let Supabase SDK settle
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            if (s) {
              setSession(s);
              setUser(s.user);
              queryClient.clear(); // clear stale data from previous tenant
            }
          });
        }, 200);
      } else if (e.oldValue && e.newValue && e.oldValue !== e.newValue) {
        // Token was UPDATED → token refresh happened in another tab, sync it
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          if (s) {
            setSession(s);
            setUser(s.user);
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [debouncedSessionCheck, queryClient]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName },
      },
    });
    return { error };
  };

  const signOut = async () => {
    queryClient.clear();
    localStorage.removeItem(CURRENT_STORE_ID_KEY);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
