import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

// Track whether sign-out was user-initiated
let userInitiatedSignOut = false;

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
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (event === 'SIGNED_IN') {
            queryClient.clear();
            
            // Auto-detect CTV user: if user has ctv_tenant_id in metadata,
            // set ctv_store_mode so they stay on the store page (not admin)
            const ctvTenantId = newSession?.user?.user_metadata?.ctv_tenant_id;
            if (ctvTenantId && !localStorage.getItem('ctv_store_mode')) {
              localStorage.setItem('ctv_store_mode', ctvTenantId);
              console.log('[Auth] Auto-set ctv_store_mode for CTV user:', ctvTenantId);
            }
          }
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          // Only honour sign-out if user explicitly requested it.
          // Supabase fires SIGNED_OUT on refresh-token failures too –
          // we don't want those to log the user out.
          if (userInitiatedSignOut) {
            userInitiatedSignOut = false;
            queryClient.clear();
            setSession(null);
            setUser(null);
            setLoading(false);
          } else {
            // Token refresh failed (e.g. multi-device token rotation conflict)
            // Try aggressive recovery: multiple attempts with delays before accepting logout
            console.warn('[Auth] SIGNED_OUT fired without user action – attempting recovery');
            
            const attemptRecovery = async (retries: number, delayMs: number): Promise<boolean> => {
              for (let i = 0; i < retries; i++) {
                try {
                  // Try getSession first (cached)
                  const { data: { session: cached } } = await supabase.auth.getSession();
                  if (cached) {
                    setSession(cached);
                    setUser(cached.user);
                    console.log(`[Auth] Recovery succeeded via getSession (attempt ${i + 1})`);
                    return true;
                  }
                  // Try refreshSession (forces new token from server)
                  const { data: { session: refreshed } } = await supabase.auth.refreshSession();
                  if (refreshed) {
                    setSession(refreshed);
                    setUser(refreshed.user);
                    console.log(`[Auth] Recovery succeeded via refreshSession (attempt ${i + 1})`);
                    return true;
                  }
                } catch {
                  // Network error – keep trying
                }
                if (i < retries - 1) {
                  await new Promise(r => setTimeout(r, delayMs));
                }
              }
              return false;
            };

            const recovered = await attemptRecovery(3, 1500);
            if (!recovered) {
              // Check localStorage directly – another tab may have refreshed
              const storageKey = Object.keys(localStorage).find(k => k.includes('auth-token'));
              if (storageKey && localStorage.getItem(storageKey)) {
                // Token exists in storage — one more try after a longer delay
                await new Promise(r => setTimeout(r, 2000));
                try {
                  const { data: { session: lastChance } } = await supabase.auth.getSession();
                  if (lastChance) {
                    setSession(lastChance);
                    setUser(lastChance.user);
                    console.log('[Auth] Recovery succeeded via localStorage fallback');
                  } else {
                    console.warn('[Auth] All recovery attempts failed – accepting logout');
                    setSession(null);
                    setUser(null);
                    queryClient.clear();
                  }
                } catch {
                  // Keep current state on network error
                }
              } else {
                console.warn('[Auth] No auth token in storage – accepting logout');
                setSession(null);
                setUser(null);
                queryClient.clear();
              }
            }
            setLoading(false);
          }
        } else {
          // INITIAL_SESSION, USER_UPDATED, etc.
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setLoading(false);
        }
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
    userInitiatedSignOut = true;
    queryClient.clear();
    localStorage.removeItem(CURRENT_STORE_ID_KEY);
    localStorage.removeItem('ctv_store_mode');
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
