import { Suspense, lazy, useEffect, type ReactNode } from "react";
import { useAttendanceEnabled } from "@/hooks/useAttendanceEnabled";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompanyResolver";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { TenantGuard } from "@/components/tenant/TenantGuard";
import { SubdomainRouter } from "@/components/routing/SubdomainRouter";
import { AdminRouteRestorer } from "@/components/routing/AdminRouteRestorer";

// Eager-load public entry pages so homepage/auth/register feel instant
import AuthPage from "./pages/AuthPage";
import PlatformAuthPage from "./pages/PlatformAuthPage";
import RegisterPage from "./pages/RegisterPage";
import PublicLandingPage from "./pages/PublicLandingPage";

// Lazy load app pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ForgotStoreIdPage = lazy(() => import("./pages/ForgotStoreIdPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage"));
const SuppliersPage = lazy(() => import("./pages/SuppliersPage"));
const ImportNewPage = lazy(() => import("./pages/ImportNewPage"));
const ImportHistoryPage = lazy(() => import("./pages/ImportHistoryPage"));
const ExportNewPage = lazy(() => import("./pages/ExportNewPage"));
const ExportHistoryPage = lazy(() => import("./pages/ExportHistoryPage"));
const InvoiceTemplatePage = lazy(() => import("./pages/InvoiceTemplatePage"));
const CustomPrintDesignerPage = lazy(() => import("./pages/CustomPrintDesignerPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const CashBookPage = lazy(() => import("./pages/CashBookPage"));
const BranchesPage = lazy(() => import("./pages/BranchesPage"));
const ReturnsPage = lazy(() => import("./pages/ReturnsPage"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const AuditLogsPage = lazy(() => import("./pages/AuditLogsPage"));
const DebtPage = lazy(() => import("./pages/DebtPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const PlatformAdminPage = lazy(() => import("./pages/PlatformAdminPage"));
const SubscriptionPage = lazy(() => import("./pages/SubscriptionPage"));
const AffiliatePage = lazy(() => import("./pages/AffiliatePage"));
const EInvoicePage = lazy(() => import("./pages/EInvoicePage"));
const ApplicationsPage = lazy(() => import("./pages/ApplicationsPage"));
const AdvertisementsAdminPage = lazy(() => import("./pages/AdvertisementsAdminPage"));
const StoreLandingPage = lazy(() => import("./pages/StoreLandingPage"));
const LandingPageAdminPage = lazy(() => import("./pages/LandingPageAdminPage"));
const InstallAppPage = lazy(() => import("./pages/InstallAppPage"));
const TaxPolicyPage = lazy(() => import("./pages/TaxPolicyPage"));
const StockTransferPage = lazy(() => import("./pages/StockTransferPage"));
const PlatformArticlesPage = lazy(() => import("./pages/PlatformArticlesPage"));
const SocialPage = lazy(() => import("./pages/SocialPage"));
const WebsiteEditorPage = lazy(() => import("./pages/WebsiteEditorPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const WarrantyCheckPage = lazy(() => import("./pages/WarrantyCheckPage"));
const RepairNewPage = lazy(() => import("./pages/RepairNewPage"));
const RepairListPage = lazy(() => import("./pages/RepairListPage"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const CheckInPage = lazy(() => import("./pages/CheckInPage"));
const PayrollPage = lazy(() => import("./pages/PayrollPage"));
const MyAttendancePage = lazy(() => import("./pages/MyAttendancePage"));

const ZaloCallbackPage = lazy(() => import("./pages/ZaloCallbackPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

function AttendanceEnabledRoute({ children }: { children: ReactNode }) {
  const { enabled, isLoading } = useAttendanceEnabled();

  if (isLoading) return null;

  return enabled ? <>{children}</> : <Navigate to="/" replace />;
}

// Only preload admin pages when user is logged in (not on store landing / CTV pages)
function preloadAdminPages() {
  // Skip preloading if on a store subdomain and not logged in
  const hostname = window.location.hostname;
  const isMainDomain = hostname === 'localhost' || hostname === 'vkho.vn' || hostname === 'www.vkho.vn' || hostname.includes('lovable');
  const hasAuth = !!localStorage.getItem('sb-rodpbhesrwykmpywiiyd-auth-token');
  const isCTVMode = !!localStorage.getItem('ctv_store_mode');
  
  // Don't preload all pages for store visitors / CTV users
  if (!isMainDomain && !hasAuth) return;
  if (isCTVMode) return;
  if (!hasAuth) return;

  const pages = [
    () => import("./pages/Index"),
    () => import("./pages/ProductsPage"),
    () => import("./pages/ExportNewPage"),
    () => import("./pages/ImportNewPage"),
    () => import("./pages/CustomersPage"),
    () => import("./pages/CashBookPage"),
    () => import("./pages/ReportsPage"),
    () => import("./pages/ExportHistoryPage"),
    () => import("./pages/ImportHistoryPage"),
  ];
  let i = 0;
  function loadNext() {
    if (i < pages.length) {
      pages[i]().catch(() => {});
      i++;
      setTimeout(loadNext, 200);
    }
  }
  loadNext();
}

const NON_PERSISTED_QUERY_ROOTS = new Set(['report-stats', 'dashboard-stats']);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes - reduce refetches
      gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep cache for persistence
      refetchOnWindowFocus: false, // Don't refetch on tab switch
      refetchOnReconnect: false, // Don't refetch when browser/network reconnects (often triggered by tab/minimize)
      refetchOnMount: false, // Don't refetch just because component remounts
      // Keep previous data while refetching so pages don't flash blank + spinner
      placeholderData: keepPreviousData,
      retry: 1, // Only 1 retry on failure
    },
  },
});

// Persist React Query cache to localStorage for instant data on app restart
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'vkho_query_cache_v1',
  // Throttle writes to localStorage to avoid performance issues
  throttleTime: 2000,
  // Serialize/deserialize with error handling
  serialize: (data) => {
    try {
      return JSON.stringify(data);
    } catch {
      return '{}';
    }
  },
  deserialize: (data) => {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  },
});

// Shell-first: show skeleton layout so screen doesn't look blank
const PageLoader = () => (
  <div className="min-h-screen bg-background">
    <div className="h-14 border-b border-border flex items-center px-4 gap-3">
      <div className="h-8 w-8 rounded bg-muted animate-pulse" />
      <div className="h-4 w-32 rounded bg-muted animate-pulse" />
    </div>
    <div className="p-4 sm:p-6 space-y-4">
      <div className="h-6 w-48 rounded bg-muted animate-pulse" />
      <div className="h-4 w-64 rounded bg-muted animate-pulse" />
      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
      </div>
    </div>
  </div>
);

// Helper component to wrap protected routes with TenantGuard
const GuardedRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <TenantGuard>{children}</TenantGuard>
  </ProtectedRoute>
);

// Subscription page allows expired tenants
const SubscriptionRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <TenantGuard allowExpired>{children}</TenantGuard>
  </ProtectedRoute>
);

function AppBootSignal() {
  useEffect(() => {
    // Start global watcher lazily after first paint
    import("@/lib/dialogInteraction").then(m => m.startGlobalInteractionWatcher());

    const prefetch = (window as any).__STORE_PREFETCH__;
    if (prefetch?.storeId) return;

    // Hide preloader immediately when React mounts - content is ready
    (window as any).__hideAppPreloader?.();

    // Preload admin pages well after first paint
    const preloadTimer = window.setTimeout(preloadAdminPages, 3000);

    return () => {
      window.clearTimeout(preloadTimer);
    };
  }, []);

  return null;
}

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: 1000 * 60 * 60 * 24,
      buster: 'v8-report-cache-fix',
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          const rootKey = Array.isArray(query.queryKey) ? query.queryKey[0] : query.queryKey;
          return !NON_PERSISTED_QUERY_ROOTS.has(String(rootKey));
        },
      },
    }}
  >
    <CompanyProvider>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppBootSignal />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <SubdomainRouter landingPage={<StoreLandingPage />} publicLandingPage={<PublicLandingPage />}>
              <AdminRouteRestorer />
              <Routes>
                {/* Public store landing page - path-based */}
                <Route path="/store/:storeId" element={<StoreLandingPage />} />
                
                {/* Public routes */}
                <Route path="/public/guides" element={<PlatformArticlesPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/admin" element={<PlatformAuthPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/forgot-store-id" element={<ForgotStoreIdPage />} />
                <Route path="/warranty-check" element={<WarrantyCheckPage />} />
                <Route path="/zalo-callback" element={<ZaloCallbackPage />} />
                
                {/* Subscription page - accessible even when expired */}
                <Route path="/subscription" element={<SubscriptionRoute><SubscriptionPage /></SubscriptionRoute>} />
                
                {/* Protected routes - blocked when expired/locked */}
                <Route path="/" element={<GuardedRoute><Index /></GuardedRoute>} />
                <Route path="/products" element={<GuardedRoute><ProductsPage /></GuardedRoute>} />
                <Route path="/categories" element={<GuardedRoute><CategoriesPage /></GuardedRoute>} />
                <Route path="/suppliers" element={<GuardedRoute><SuppliersPage /></GuardedRoute>} />
                <Route path="/import/new" element={<GuardedRoute><ImportNewPage /></GuardedRoute>} />
                <Route path="/import/history" element={<GuardedRoute><ImportHistoryPage /></GuardedRoute>} />
                <Route path="/import/transfer" element={<GuardedRoute><StockTransferPage /></GuardedRoute>} />
                <Route path="/export/new" element={<GuardedRoute><ExportNewPage /></GuardedRoute>} />
                <Route path="/export/history" element={<GuardedRoute><ExportHistoryPage /></GuardedRoute>} />
                <Route path="/export/template" element={<GuardedRoute><InvoiceTemplatePage /></GuardedRoute>} />
                <Route path="/export/template/designer/:id" element={<GuardedRoute><CustomPrintDesignerPage /></GuardedRoute>} />
                <Route path="/reports" element={<GuardedRoute><ReportsPage /></GuardedRoute>} />
                <Route path="/cash-book" element={<GuardedRoute><CashBookPage /></GuardedRoute>} />
                <Route path="/branches" element={<GuardedRoute><BranchesPage /></GuardedRoute>} />
                <Route path="/returns" element={<GuardedRoute><ReturnsPage /></GuardedRoute>} />
                <Route path="/inventory" element={<GuardedRoute><InventoryPage /></GuardedRoute>} />
                <Route path="/users" element={<GuardedRoute><UsersPage /></GuardedRoute>} />
                <Route path="/audit-logs" element={<GuardedRoute><AuditLogsPage /></GuardedRoute>} />
                <Route path="/debt" element={<GuardedRoute><DebtPage /></GuardedRoute>} />
                <Route path="/customers" element={<GuardedRoute><CustomersPage /></GuardedRoute>} />
                <Route path="/affiliate" element={<GuardedRoute><AffiliatePage /></GuardedRoute>} />
                <Route path="/einvoice" element={<GuardedRoute><EInvoicePage /></GuardedRoute>} />
                 <Route path="/export/tax-policy" element={<GuardedRoute><TaxPolicyPage /></GuardedRoute>} />
                <Route path="/applications" element={<GuardedRoute><ApplicationsPage /></GuardedRoute>} />
                <Route path="/advertisements" element={<GuardedRoute><AdvertisementsAdminPage /></GuardedRoute>} />
                <Route path="/landing-settings" element={<SubscriptionRoute><LandingPageAdminPage /></SubscriptionRoute>} />
                <Route path="/website-editor" element={<SubscriptionRoute><WebsiteEditorPage /></SubscriptionRoute>} />
                <Route path="/install-app" element={<GuardedRoute><InstallAppPage /></GuardedRoute>} />
                <Route path="/guides" element={<GuardedRoute><PlatformArticlesPage /></GuardedRoute>} />
                
                <Route path="/settings" element={<GuardedRoute><SettingsPage /></GuardedRoute>} />
                <Route path="/repair/new" element={<GuardedRoute><RepairNewPage /></GuardedRoute>} />
                <Route path="/repair/list" element={<GuardedRoute><RepairListPage /></GuardedRoute>} />
                <Route path="/social" element={<GuardedRoute><SocialPage /></GuardedRoute>} />
                <Route path="/attendance" element={<Navigate to="/users" replace />} />
                <Route path="/checkin" element={<ProtectedRoute><AttendanceEnabledRoute><CheckInPage /></AttendanceEnabledRoute></ProtectedRoute>} />
                <Route path="/my-attendance" element={<ProtectedRoute><AttendanceEnabledRoute><MyAttendancePage /></AttendanceEnabledRoute></ProtectedRoute>} />
                <Route path="/payroll" element={<Navigate to="/users" replace />} />
                {/* Platform Admin route - also guarded */}
                <Route path="/platform-admin" element={<GuardedRoute><PlatformAdminPage /></GuardedRoute>} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SubdomainRouter>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </CompanyProvider>
  </PersistQueryClientProvider>
);

export default App;
