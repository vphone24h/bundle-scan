import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: Error | null }>;
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

  useEffect(() => {
    // Check if session should be cleared (user didn't select "remember me" and browser was restarted)
    const wasTempSession = sessionStorage.getItem('session_temp') === null && 
                           localStorage.getItem('auth_remember_me') === 'false';
    
    if (wasTempSession) {
      // Browser was closed and user didn't want to stay logged in - clear session
      supabase.auth.signOut().then(() => {
        setLoading(false);
      });
      return;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Clear cache when user signs out or signs in (to prevent tenant data leakage)
        if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
          queryClient.clear();
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string, rememberMe: boolean = true) => {
    // If not remembering, we'll handle session cleanup on browser close via the storage key
    // Supabase uses localStorage by default which persists
    // When rememberMe is false, we store a flag to clear session on next visit if browser was closed
    if (!rememberMe) {
      sessionStorage.setItem('session_temp', 'true');
    } else {
      sessionStorage.removeItem('session_temp');
    }
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: displayName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    // Clear all React Query cache to prevent data leakage between tenants
    queryClient.clear();
    localStorage.removeItem('auth_remember_me');
    localStorage.removeItem(CURRENT_STORE_ID_KEY);
    sessionStorage.removeItem('session_temp');
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
