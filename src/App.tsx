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
import AdminQuickProduct from "./pages/admin/AdminQuickProduct";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminSiteSettings from "./pages/admin/AdminSiteSettings";
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
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } />
            <Route path="/admin/productos" element={
              <AdminRoute>
                <AdminProducts />
              </AdminRoute>
            } />
            <Route path="/admin/productos/nuevo" element={
              <AdminRoute>
                <AdminProductForm />
              </AdminRoute>
            } />
            <Route path="/admin/productos/rapido" element={
              <AdminRoute>
                <AdminQuickProduct />
              </AdminRoute>
            } />
            <Route path="/admin/productos/:id" element={
              <AdminRoute>
                <AdminProductForm />
              </AdminRoute>
            } />
            <Route path="/admin/productos/:id/editar" element={
              <AdminRoute>
                <AdminProductForm />
              </AdminRoute>
            } />
            <Route path="/admin/categorias" element={
              <AdminRoute>
                <AdminCategories />
              </AdminRoute>
            } />
            <Route path="/admin/textos" element={
              <AdminRoute>
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
