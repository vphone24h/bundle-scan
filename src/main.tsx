import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

const APP_RUNTIME_VERSION = __APP_BUILD_ID__;
const APP_RUNTIME_VERSION_KEY = 'vkho_app_runtime_version';
const PERSISTED_QUERY_CACHE_KEY = 'vkho_query_cache_v1';
const CACHE_PREFIXES_TO_CLEAR = ['tenant_resolver_cache_v1:', 'company_resolver_cache_v1:'];
const APP_VERSION_ENDPOINT = '/version.json';
const APP_UPDATE_SEARCH_PARAM = '__app_update';
const APP_VERSION_SYNC_INTERVAL_MS = 60000;
const APP_VERSION_SYNC_THROTTLE_MS = 10000;

let appVersionSyncInFlight: Promise<void> | null = null;
let lastAppVersionSyncAt = 0;

function getServiceWorkerScriptUrl(registration: ServiceWorkerRegistration) {
  return registration.active?.scriptURL
    ?? registration.waiting?.scriptURL
    ?? registration.installing?.scriptURL
    ?? '';
}

function isPushServiceWorker(registration: ServiceWorkerRegistration) {
  return getServiceWorkerScriptUrl(registration).includes('/sw-push.js');
}

async function fetchRemoteBuildVersion() {
  if (typeof window === 'undefined') return null;

  try {
    const versionUrl = new URL(APP_VERSION_ENDPOINT, window.location.origin);
    versionUrl.searchParams.set('ts', `${Date.now()}`);

    const response = await window.fetch(versionUrl.toString(), {
      cache: 'no-store',
      headers: {
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      },
    });

    if (!response.ok) return null;

    const payload = await response.json();
    return typeof payload?.buildId === 'string' ? payload.buildId : null;
  } catch {
    return null;
  }
}

async function clearRuntimeCaches() {
  window.localStorage.removeItem(PERSISTED_QUERY_CACHE_KEY);

  for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
    const key = window.localStorage.key(i);
    if (key && CACHE_PREFIXES_TO_CLEAR.some((prefix) => key.startsWith(prefix))) {
      window.localStorage.removeItem(key);
    }
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => !isPushServiceWorker(registration))
        .map(async (registration) => {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        await registration.unregister();
        })
    );
  }

  if ('caches' in window) {
    const cacheKeys = await window.caches.keys();
    await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
  }
}

async function requestServiceWorkerUpdateCheck() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  const appRegistrations = registrations.filter((registration) => !isPushServiceWorker(registration));

  await Promise.all(appRegistrations.map((registration) => registration.update().catch(() => undefined)));

  appRegistrations.forEach((registration) => {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  });
}

function cleanupAppUpdateSearchParam() {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const appliedVersion = url.searchParams.get(APP_UPDATE_SEARCH_PARAM);

  if (!appliedVersion || appliedVersion !== APP_RUNTIME_VERSION) return;

  url.searchParams.delete(APP_UPDATE_SEARCH_PARAM);
  window.history.replaceState({}, document.title, url.toString());
}

function buildRefreshUrl(version: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(APP_UPDATE_SEARCH_PARAM, version);
  return url.toString();
}

async function syncAppRuntimeVersion() {
  if (typeof window === 'undefined') return;

  await requestServiceWorkerUpdateCheck();

  const remoteVersion = await fetchRemoteBuildVersion();
  const targetVersion = remoteVersion ?? APP_RUNTIME_VERSION;
  const previousVersion = window.localStorage.getItem(APP_RUNTIME_VERSION_KEY);
  const isRunningStaleBundle = !!remoteVersion && remoteVersion !== APP_RUNTIME_VERSION;
  const shouldRefresh = isRunningStaleBundle || (previousVersion !== null && previousVersion !== targetVersion);

  if (previousVersion === targetVersion && !isRunningStaleBundle) {
    cleanupAppUpdateSearchParam();
    return;
  }

  window.localStorage.setItem(APP_RUNTIME_VERSION_KEY, targetVersion);

  if (previousVersion === null && !isRunningStaleBundle) {
    cleanupAppUpdateSearchParam();
    return;
  }

  await clearRuntimeCaches();

  if (shouldRefresh) {
    window.location.replace(buildRefreshUrl(targetVersion));
    return;
  }

  cleanupAppUpdateSearchParam();
}

async function scheduleAppRuntimeVersionSync(force = false) {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  if (!force) {
    if (appVersionSyncInFlight) return appVersionSyncInFlight;
    if (now - lastAppVersionSyncAt < APP_VERSION_SYNC_THROTTLE_MS) return;
  }

  lastAppVersionSyncAt = now;
  appVersionSyncInFlight = syncAppRuntimeVersion();

  try {
    await appVersionSyncInFlight;
  } finally {
    appVersionSyncInFlight = null;
  }
}

function registerAppRuntimeSyncTriggers() {
  if (typeof window === 'undefined') return;

  const runtimeWindow = window as Window & typeof globalThis & {
    __vkhoAppVersionSyncRegistered__?: boolean;
    __vkhoAppVersionSyncIntervalId__?: number;
    __vkhoAppControllerChangeHandled__?: boolean;
  };

  if (runtimeWindow.__vkhoAppVersionSyncRegistered__) return;
  runtimeWindow.__vkhoAppVersionSyncRegistered__ = true;

  const triggerSync = () => {
    void scheduleAppRuntimeVersionSync();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      triggerSync();
    }
  };

  window.addEventListener('focus', triggerSync);
  window.addEventListener('online', triggerSync);
  window.addEventListener('pageshow', triggerSync);
  document.addEventListener('visibilitychange', onVisibilityChange);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (runtimeWindow.__vkhoAppControllerChangeHandled__) return;
      runtimeWindow.__vkhoAppControllerChangeHandled__ = true;
      window.location.replace(buildRefreshUrl(window.localStorage.getItem(APP_RUNTIME_VERSION_KEY) ?? APP_RUNTIME_VERSION));
    });
  }

  runtimeWindow.__vkhoAppVersionSyncIntervalId__ = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      void scheduleAppRuntimeVersionSync();
    }
  }, APP_VERSION_SYNC_INTERVAL_MS);
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

registerAppRuntimeSyncTriggers();
void scheduleAppRuntimeVersionSync(true);

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
