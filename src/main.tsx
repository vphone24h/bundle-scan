import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

const APP_RUNTIME_VERSION = '2026-04-10-attendance-company-source-v4';
const APP_RUNTIME_VERSION_KEY = 'vkho_app_runtime_version';
const PERSISTED_QUERY_CACHE_KEY = 'vkho_query_cache_v1';
const CACHE_PREFIXES_TO_CLEAR = ['tenant_resolver_cache_v1:', 'company_resolver_cache_v1:'];

async function syncAppRuntimeVersion() {
  if (typeof window === 'undefined') return;

  const previousVersion = window.localStorage.getItem(APP_RUNTIME_VERSION_KEY);
  if (previousVersion === APP_RUNTIME_VERSION) return;

  window.localStorage.setItem(APP_RUNTIME_VERSION_KEY, APP_RUNTIME_VERSION);
  window.localStorage.removeItem(PERSISTED_QUERY_CACHE_KEY);

   for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
    const key = window.localStorage.key(i);
    if (key && CACHE_PREFIXES_TO_CLEAR.some((prefix) => key.startsWith(prefix))) {
      window.localStorage.removeItem(key);
    }
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ('caches' in window) {
    const cacheKeys = await window.caches.keys();
    await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
  }

  if (previousVersion) {
    window.location.reload();
  }
}

// Hide the HTML preloader
// For store pages: StoreLandingPage will call hideAppPreloader() when content is ready
// For admin pages: hide immediately after React paints
function hidePreloader() {
  const el = document.getElementById('app-preloader');
  if (el) {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 100);
  }
}

// Expose globally so StoreLandingPage can call it
(window as any).__hideAppPreloader = hidePreloader;

void syncAppRuntimeVersion();

// PWA service worker registration is handled automatically by vite-plugin-pwa
// with injectRegister: 'auto' in vite.config.ts (production builds only)

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// For non-store pages, hide preloader after first React paint
// For store pages, delay — let StoreLandingPage control it
const prefetch = (window as any).__STORE_PREFETCH__;
if (!prefetch?.storeId) {
  // If user has cached auth, hide preloader immediately — React will render real content
  const hasAuth = !!localStorage.getItem('sb-rodpbhesrwykmpywiiyd-auth-token');
  if (hasAuth) {
    requestAnimationFrame(hidePreloader);
  } else {
    requestAnimationFrame(() => {
      requestAnimationFrame(hidePreloader);
    });
  }
} else {
  // Safety net: hide preloader after 4s max even if store page hasn't signaled
  setTimeout(hidePreloader, 4000);
}
