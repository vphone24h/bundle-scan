import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import PlatformAuthPage from "./pages/PlatformAuthPage";
import RegisterPage from "./pages/RegisterPage";
import ProductsPage from "./pages/ProductsPage";
import CategoriesPage from "./pages/CategoriesPage";
import SuppliersPage from "./pages/SuppliersPage";
import ImportNewPage from "./pages/ImportNewPage";
import ImportHistoryPage from "./pages/ImportHistoryPage";
import ExportNewPage from "./pages/ExportNewPage";
import ExportHistoryPage from "./pages/ExportHistoryPage";
import InvoiceTemplatePage from "./pages/InvoiceTemplatePage";
import ReportsPage from "./pages/ReportsPage";
import CashBookPage from "./pages/CashBookPage";
import BranchesPage from "./pages/BranchesPage";
import ReturnsPage from "./pages/ReturnsPage";
import InventoryPage from "./pages/InventoryPage";
import UsersPage from "./pages/UsersPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import DebtPage from "./pages/DebtPage";
import CustomersPage from "./pages/CustomersPage";
import PlatformAdminPage from "./pages/PlatformAdminPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/admin" element={<PlatformAuthPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
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
            
            {/* Platform Admin route */}
            <Route path="/platform-admin" element={<ProtectedRoute><PlatformAdminPage /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;