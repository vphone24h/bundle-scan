import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { TenantGuard } from "@/components/tenant/TenantGuard";
import { SubdomainRouter } from "@/components/routing/SubdomainRouter";

// Lazy load all pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const PlatformAuthPage = lazy(() => import("./pages/PlatformAuthPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
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
const PublicLandingPage = lazy(() => import("./pages/PublicLandingPage"));
const LandingPageAdminPage = lazy(() => import("./pages/LandingPageAdminPage"));
const InstallAppPage = lazy(() => import("./pages/InstallAppPage"));
const TaxPolicyPage = lazy(() => import("./pages/TaxPolicyPage"));
const StockTransferPage = lazy(() => import("./pages/StockTransferPage"));
const PlatformArticlesPage = lazy(() => import("./pages/PlatformArticlesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes - reduce refetches
      gcTime: 1000 * 60 * 10, // 10 minutes cache
      refetchOnWindowFocus: false, // Don't refetch on tab switch
      refetchOnReconnect: false, // Don't refetch when browser/network reconnects (often triggered by tab/minimize)
      refetchOnMount: false, // Don't refetch just because component remounts
      // Keep previous data while refetching so pages don't flash blank + spinner
      placeholderData: keepPreviousData,
      retry: 1, // Only 1 retry on failure
    },
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <SubdomainRouter landingPage={<StoreLandingPage />} publicLandingPage={<PublicLandingPage />}>
              <Routes>
                {/* Public store landing page - path-based */}
                <Route path="/store/:storeId" element={<StoreLandingPage />} />
                
                {/* Public routes */}
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/admin" element={<PlatformAuthPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/forgot-store-id" element={<ForgotStoreIdPage />} />
                
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
                <Route path="/install-app" element={<GuardedRoute><InstallAppPage /></GuardedRoute>} />
                <Route path="/guides" element={<GuardedRoute><PlatformArticlesPage /></GuardedRoute>} />
                {/* Platform Admin route - also guarded */}
                <Route path="/platform-admin" element={<GuardedRoute><PlatformAdminPage /></GuardedRoute>} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SubdomainRouter>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
