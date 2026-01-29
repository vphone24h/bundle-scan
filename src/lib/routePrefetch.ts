// Prefetch lazy-loaded route chunks to make tab switching feel instant.
// This does NOT change business logic; it only warms the browser cache.

type RoutePrefetcher = () => Promise<unknown>;

// Keep these import paths stable. They should match the modules used by the router.
const prefetchers: Record<string, RoutePrefetcher> = {
  '/': () => import('@/pages/Index'),
  '/products': () => import('@/pages/ProductsPage'),
  '/inventory': () => import('@/pages/InventoryPage'),
  '/categories': () => import('@/pages/CategoriesPage'),
  '/import/new': () => import('@/pages/ImportNewPage'),
  '/import/history': () => import('@/pages/ImportHistoryPage'),
  '/export/new': () => import('@/pages/ExportNewPage'),
  '/export/history': () => import('@/pages/ExportHistoryPage'),
  '/export/template': () => import('@/pages/InvoiceTemplatePage'),
  '/einvoice': () => import('@/pages/EInvoicePage'),
  '/returns': () => import('@/pages/ReturnsPage'),
  '/suppliers': () => import('@/pages/SuppliersPage'),
  '/customers': () => import('@/pages/CustomersPage'),
  '/debt': () => import('@/pages/DebtPage'),
  '/reports': () => import('@/pages/ReportsPage'),
  '/cash-book': () => import('@/pages/CashBookPage'),
  '/branches': () => import('@/pages/BranchesPage'),
  '/users': () => import('@/pages/UsersPage'),
  '/audit-logs': () => import('@/pages/AuditLogsPage'),
  '/applications': () => import('@/pages/ApplicationsPage'),
  '/affiliate': () => import('@/pages/AffiliatePage'),
  '/advertisements': () => import('@/pages/AdvertisementsAdminPage'),
  '/subscription': () => import('@/pages/SubscriptionPage'),
  '/platform-admin': () => import('@/pages/PlatformAdminPage'),
};

// Normalize to known routes (some menu items are parent groups like /import).
function normalizeHref(href: string): string {
  // If it’s an exact match, use it.
  if (prefetchers[href]) return href;
  // Otherwise try to match the best known prefix.
  const match = Object.keys(prefetchers)
    .filter((k) => k !== '/' && href.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match || href;
}

export function prefetchRoute(href: string) {
  const key = normalizeHref(href);
  const fn = prefetchers[key];
  if (!fn) return;
  // Fire-and-forget; avoid awaiting to keep UI responsive.
  void fn().catch(() => {
    // Ignore prefetch failures; navigation can still load the chunk normally.
  });
}
