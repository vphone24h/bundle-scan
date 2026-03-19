import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ADMIN_LAST_ROUTE_KEY = 'vkho_admin_last_route_v1';

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

  // Restore route on initial mount (only if navigating to "/")
  useEffect(() => {
    if (location.pathname !== '/') return;

    try {
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
    const raw = localStorage.getItem(ADMIN_LAST_ROUTE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved?.pathname || Date.now() - saved.savedAt > 1000 * 60 * 60 * 24 * 14) return null;
    return saved.pathname;
  } catch {
    return null;
  }
}
