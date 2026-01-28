import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { TenantGuard } from "@/components/tenant/TenantGuard";

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
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes - reduce refetches
      gcTime: 1000 * 60 * 10, // 10 minutes cache
      refetchOnWindowFocus: false, // Don't refetch on tab switch
      retry: 1, // Only 1 retry on failure
    },
  },
});

// Minimal loading fallback for Suspense
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
            <Routes>
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
              <Route path="/applications" element={<GuardedRoute><ApplicationsPage /></GuardedRoute>} />
              <Route path="/advertisements" element={<GuardedRoute><AdvertisementsAdminPage /></GuardedRoute>} />
              
              {/* Platform Admin route - also guarded */}
              <Route path="/platform-admin" element={<GuardedRoute><PlatformAdminPage /></GuardedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
