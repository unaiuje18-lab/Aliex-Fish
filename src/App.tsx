import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminRoute } from "@/components/auth/AdminRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ProductPage from "./pages/ProductPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminProductForm from "./pages/admin/AdminProductForm";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminSiteSettings from "./pages/admin/AdminSiteSettings";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAlerts from "./pages/admin/AdminAlerts";
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
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/producto/:slug" element={<ProductPage />} />
            
            {/* Admin routes */}
            <Route path="/admin" element={
              <AdminRoute required="can_dashboard">
                <AdminDashboard />
              </AdminRoute>
            } />
            <Route path="/admin/productos" element={
              <AdminRoute required="can_products_view">
                <AdminProducts />
              </AdminRoute>
            } />
            <Route path="/admin/productos/nuevo" element={
              <AdminRoute required="can_products_create">
                <AdminProductForm />
              </AdminRoute>
            } />
            <Route path="/admin/productos/:id" element={
              <AdminRoute required="can_products_edit">
                <AdminProductForm />
              </AdminRoute>
            } />
            <Route path="/admin/productos/:id/editar" element={
              <AdminRoute required="can_products_edit">
                <AdminProductForm />
              </AdminRoute>
            } />
            <Route path="/admin/categorias" element={
              <AdminRoute required="can_categories">
                <AdminCategories />
              </AdminRoute>
            } />
            <Route path="/admin/textos" element={
              <AdminRoute required="can_content">
                <AdminSiteSettings />
              </AdminRoute>
            } />
            <Route path="/admin/analitica" element={
              <AdminRoute required="can_analytics">
                <AdminAnalytics />
              </AdminRoute>
            } />
            <Route path="/admin/usuarios" element={
              <AdminRoute required="can_users">
                <AdminUsers />
              </AdminRoute>
            } />
            <Route path="/admin/alertas" element={
              <AdminRoute required="can_alerts">
                <AdminAlerts />
              </AdminRoute>
            } />
            <Route path="/admin/ajustes" element={
              <AdminRoute required="can_content">
                <AdminSiteSettings />
              </AdminRoute>
            } />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;