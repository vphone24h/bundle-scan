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

// Try to read cached session synchronously from localStorage for instant startup
function getCachedSession(): { user: User; session: Session } | null {
  try {
    const key = `sb-rodpbhesrwykmpywiiyd-auth-token`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Supabase stores { access_token, refresh_token, user, ... } or wrapped in currentSession
    const sess = parsed?.currentSession || parsed;
    if (sess?.access_token && sess?.user?.id) {
      return { user: sess.user as User, session: sess as Session };
    }
  } catch {}
  return null;
}

const cachedAuth = getCachedSession();

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start with cached session so UI renders instantly without waiting for async getSession()
  const [user, setUser] = useState<User | null>(cachedAuth?.user ?? null);
  const [session, setSession] = useState<Session | null>(cachedAuth?.session ?? null);
  const [loading, setLoading] = useState(!cachedAuth); // Skip loading if we have cached session
  const queryClient = useQueryClient();

  // Debounce guard: prevent multiple simultaneous refresh calls across tabs
  const refreshingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const applySession = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  }, []);

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
          applySession(currentSession);
        } else if (userInitiatedSignOut) {
          userInitiatedSignOut = false;
          applySession(null);
        } else {
          // No session in memory — try refresh once before giving up
          const { data: { session: refreshed } } = await supabase.auth.refreshSession();
          if (refreshed) {
            applySession(refreshed);
          }
          // If refresh also fails, DON'T force logout —
          // let onAuthStateChange handle SIGNED_OUT naturally.
          // This prevents logout during temporary token gaps.
        }
      } catch {
        // Network error etc — don't force logout
      } finally {
        setLoading(false);
        refreshingRef.current = false;
      }
    }, 300); // 300ms debounce — prevents storm of refresh calls
  }, [applySession]);

  useEffect(() => {
    let isMounted = true;

    const scheduleSessionRecovery = () => {
      window.setTimeout(() => {
        if (isMounted) {
          debouncedSessionCheck();
        }
      }, 0);
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (event === 'SIGNED_IN') {
            // Only clear cache if switching users — same-user re-login keeps cache for faster startup
            const previousUserId = user?.id;
            const newUserId = newSession?.user?.id;
            if (previousUserId && previousUserId !== newUserId) {
              queryClient.clear();
            } else {
              // Same user or first login — invalidate instead of clear to trigger background refetch
              queryClient.invalidateQueries();
            }
            
            // Auto-detect CTV user: if user has ctv_tenant_id in metadata,
            // set ctv_store_mode so they stay on the store page (not admin)
            // But skip if user just explicitly logged out as CTV
            const ctvTenantId = newSession?.user?.user_metadata?.ctv_tenant_id;
            const justLoggedOut = localStorage.getItem('ctv_just_logged_out');
            if (ctvTenantId && !localStorage.getItem('ctv_store_mode') && !justLoggedOut) {
              localStorage.setItem('ctv_store_mode', ctvTenantId);
              console.log('[Auth] Auto-set ctv_store_mode for CTV user:', ctvTenantId);
            }
            // Clear the flag after checking
            if (justLoggedOut) {
              localStorage.removeItem('ctv_just_logged_out');
            }
          }
          if (newSession) {
            applySession(newSession);
          } else {
            // Safety: avoid clearing valid in-memory state on transient null session
            scheduleSessionRecovery();
          }
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          // ONLY log out if user explicitly clicked the logout button.
          // NEVER auto-logout due to token rotation, multi-device conflicts, 
          // or any other automatic SIGNED_OUT events from Supabase.
          if (userInitiatedSignOut) {
            userInitiatedSignOut = false;
            queryClient.clear();
            applySession(null);
            setLoading(false);
          } else {
            // Supabase fired SIGNED_OUT without user action (token rotation, multi-device, etc.)
            // IGNORE it completely — keep the current session state.
            // The user explicitly wants to stay logged in forever until they press logout.
            console.warn('[Auth] SIGNED_OUT fired without user action – IGNORING (persistent session mode)');

            // Recover outside the auth callback to avoid auth deadlocks.
            scheduleSessionRecovery();
            setLoading(false);
          }
        } else {
          // INITIAL_SESSION, USER_UPDATED, etc.
          if (newSession) {
            applySession(newSession);
          } else if (userInitiatedSignOut) {
            userInitiatedSignOut = false;
            applySession(null);
          } else if (event !== 'INITIAL_SESSION') {
            // Do not clear the current user on transient null sessions
            scheduleSessionRecovery();
          }
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession()
      .then(({ data: { session: existingSession } }) => {
        if (!isMounted) return;

        if (existingSession) {
          applySession(existingSession);
        } else if (userInitiatedSignOut) {
          userInitiatedSignOut = false;
          applySession(null);
        }

        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
        }
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
        // Token was REMOVED → only logout if it was user-initiated
        // (userInitiatedSignOut flag would already be handled by onAuthStateChange)
        // For cross-tab: only clear if the current user actually signed out
        if (userInitiatedSignOut) {
          setSession(null);
          setUser(null);
          queryClient.clear();
        }
        // Otherwise IGNORE — don't auto-logout this tab
      } else if (e.oldValue === null && e.newValue) {
        // Token was ADDED → another tab logged in
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            if (s) {
              setSession(s);
              setUser(s.user);
              queryClient.clear();
            }
          });
        }, 200);
      } else if (e.oldValue && e.newValue && e.oldValue !== e.newValue) {
        // Token was UPDATED → sync it
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
      isMounted = false;
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
    await supabase.auth.signOut({ scope: 'local' });
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
