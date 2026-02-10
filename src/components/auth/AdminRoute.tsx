import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import type { UserPermission } from '@/types/database';

interface AdminRouteProps {
  children: ReactNode;
  required?: PermissionKey;
}

type PermissionKey = keyof Pick<
  UserPermission,
  | 'can_dashboard'
  | 'can_products_view'
  | 'can_products_create'
  | 'can_products_edit'
  | 'can_categories'
  | 'can_content'
  | 'can_analytics'
  | 'can_alerts'
  | 'can_users'
>;

export function AdminRoute({ children, required }: AdminRouteProps) {
  const { user, isLoading, isAdmin, permissions, canAccessAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (isAdmin) {
    return <>{children}</>;
  }

  if (!canAccessAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-destructive mb-2">Acceso Denegado</h1>
          <p className="text-muted-foreground">No tienes permisos de administrador.</p>
        </div>
      </div>
    );
  }

  if (required && !permissions?.[required]) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-destructive mb-2">Acceso Denegado</h1>
          <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}