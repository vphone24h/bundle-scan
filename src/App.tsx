import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

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

const queryClient = new QueryClient();

// Minimal loading fallback for Suspense
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
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
              
              {/* Protected routes */}
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
              <Route path="/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
              <Route path="/suppliers" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
              <Route path="/import/new" element={<ProtectedRoute><ImportNewPage /></ProtectedRoute>} />
              <Route path="/import/history" element={<ProtectedRoute><ImportHistoryPage /></ProtectedRoute>} />
              <Route path="/export/new" element={<ProtectedRoute><ExportNewPage /></ProtectedRoute>} />
              <Route path="/export/history" element={<ProtectedRoute><ExportHistoryPage /></ProtectedRoute>} />
              <Route path="/export/template" element={<ProtectedRoute><InvoiceTemplatePage /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
              <Route path="/cash-book" element={<ProtectedRoute><CashBookPage /></ProtectedRoute>} />
              <Route path="/branches" element={<ProtectedRoute><BranchesPage /></ProtectedRoute>} />
              <Route path="/returns" element={<ProtectedRoute><ReturnsPage /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute><AuditLogsPage /></ProtectedRoute>} />
              <Route path="/debt" element={<ProtectedRoute><DebtPage /></ProtectedRoute>} />
              <Route path="/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
              <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
              <Route path="/affiliate" element={<ProtectedRoute><AffiliatePage /></ProtectedRoute>} />
              <Route path="/einvoice" element={<ProtectedRoute><EInvoicePage /></ProtectedRoute>} />
              <Route path="/applications" element={<ProtectedRoute><ApplicationsPage /></ProtectedRoute>} />
              <Route path="/advertisements" element={<ProtectedRoute><AdvertisementsAdminPage /></ProtectedRoute>} />
              
              {/* Platform Admin route */}
              <Route path="/platform-admin" element={<ProtectedRoute><PlatformAdminPage /></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
