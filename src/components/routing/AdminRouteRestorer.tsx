import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ADMIN_LAST_ROUTE_KEY = 'vkho_admin_last_route_v1';
const SESSION_OPENED_KEY = 'vkho_session_opened_v1';
const LAST_ACTIVE_AT_KEY = 'vkho_last_active_at_v1';
const DEFAULT_HOME_ROUTE = '/export/new';
// If app was inactive (hidden) longer than this, treat next open as a fresh session
const FRESH_SESSION_IDLE_MS = 1000 * 60 * 30; // 30 minutes

// Routes that should NOT be saved/restored
const EXCLUDED_ROUTES = ['/auth', '/register', '/forgot-password', '/reset-password', '/forgot-store-id', '/admin'];

/**
 * Persists the current admin route to localStorage and restores it on app open.
 * This ensures users return to the exact page they were on when they closed the app.
 */
export function AdminRouteRestorer() {
  const location = useLocation();
  const navigate = useNavigate();

  // Save current route on every navigation
  useEffect(() => {
    const path = location.pathname;
    if (EXCLUDED_ROUTES.some(r => path.startsWith(r))) return;
    if (path.startsWith('/store/')) return;

    try {
      localStorage.setItem(ADMIN_LAST_ROUTE_KEY, JSON.stringify({
        pathname: path,
        search: location.search,
        savedAt: Date.now(),
      }));
    } catch {
      // ignore
    }
  }, [location.pathname, location.search]);

  // Track last-active timestamp so we can detect long idle periods
  // (e.g. app sent to background on mobile) and treat the next open
  // as a fresh session that lands on the sales page.
  useEffect(() => {
    const stamp = () => {
      try { localStorage.setItem(LAST_ACTIVE_AT_KEY, String(Date.now())); } catch {}
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stamp();
      } else if (document.visibilityState === 'visible') {
        try {
          const raw = localStorage.getItem(LAST_ACTIVE_AT_KEY);
          const last = raw ? Number(raw) : 0;
          if (last && Date.now() - last > FRESH_SESSION_IDLE_MS) {
            // Mark next mount as fresh session
            sessionStorage.removeItem(SESSION_OPENED_KEY);
            navigate(DEFAULT_HOME_ROUTE, { replace: true });
            sessionStorage.setItem(SESSION_OPENED_KEY, '1');
          }
        } catch {}
      }
    };
    stamp();
    const interval = setInterval(stamp, 60_000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', stamp);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', stamp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On cold-start (new session), always go to the default sales page.
  // On in-session reloads / SPA navigations, restore the last route as before.
  useEffect(() => {
    if (location.pathname !== '/') return;

    try {
      let isFreshSession = !sessionStorage.getItem(SESSION_OPENED_KEY);
      // Even if sessionStorage survived (iOS PWA background), treat long idle as fresh
      if (!isFreshSession) {
        const raw = localStorage.getItem(LAST_ACTIVE_AT_KEY);
        const last = raw ? Number(raw) : 0;
        if (last && Date.now() - last > FRESH_SESSION_IDLE_MS) {
          isFreshSession = true;
        }
      }
      sessionStorage.setItem(SESSION_OPENED_KEY, '1');

      if (isFreshSession) {
        // Cold start (app re-opened): default to sales page
        navigate(DEFAULT_HOME_ROUTE, { replace: true });
        return;
      }

      const raw = localStorage.getItem(ADMIN_LAST_ROUTE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw);
      if (!saved?.pathname || typeof saved.pathname !== 'string') return;

      // Only restore if saved within 14 days
      if (Date.now() - saved.savedAt > 1000 * 60 * 60 * 24 * 14) return;

      // Don't restore "/" itself
      if (saved.pathname === '/') return;

      navigate(saved.pathname + (saved.search || ''), { replace: true });
    } catch {
      // ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  return null;
}

/**
 * Read the saved admin route synchronously (for preloader skeleton matching).
 */
export function readAdminLastRoute(): string | null {
  try {
    // Cold start → preloader should match the default sales page, not the last route
    if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(SESSION_OPENED_KEY)) {
      return DEFAULT_HOME_ROUTE;
    }
    // Long-idle resume → also treat as default sales page
    try {
      const raw = localStorage.getItem(LAST_ACTIVE_AT_KEY);
      const last = raw ? Number(raw) : 0;
      if (last && Date.now() - last > FRESH_SESSION_IDLE_MS) {
        return DEFAULT_HOME_ROUTE;
      }
    } catch {}
    const raw = localStorage.getItem(ADMIN_LAST_ROUTE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved?.pathname || Date.now() - saved.savedAt > 1000 * 60 * 60 * 24 * 14) return null;
    return saved.pathname;
  } catch {
    return null;
  }
}
