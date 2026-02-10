import { useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

interface AlertProduct {
  id: string;
  title: string;
  slug: string;
  price: string;
  price_min: number | null;
  price_max: number | null;
  main_image_url: string | null;
  category: string | null;
  orders_count: number | null;
}

export default function AdminAlerts() {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-alerts-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id,title,slug,price,price_min,price_max,main_image_url,category,orders_count')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AlertProduct[];
    },
  });

  const alerts = useMemo(() => {
    const noPrice = products.filter((p) => {
      const hasRange = p.price_min !== null || p.price_max !== null;
      const hasPrice = Boolean(p.price && p.price.trim().length > 0);
      return !hasPrice && !hasRange;
    });

    const noImage = products.filter((p) => !p.main_image_url);
    const noCategory = products.filter((p) => !p.category || p.category.trim().length === 0);
    const noStock = products.filter((p) => !p.orders_count || p.orders_count === 0);

    return {
      noPrice,
      noImage,
      noCategory,
      noStock,
    };
  }, [products]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Alertas</h1>
          <p className="text-muted-foreground">Revisión rápida de productos incompletos.</p>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-6 text-muted-foreground">Cargando...</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sin precio ({alerts.noPrice.length})</CardTitle>
                <CardDescription>Productos sin precio o rango.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.noPrice.length === 0 ? (
                  <p className="text-muted-foreground">Todo OK.</p>
                ) : (
                  alerts.noPrice.map((p) => (
                    <Link key={p.id} to={`/admin/productos/${p.id}`} className="block text-sm text-primary">
                      {p.title}
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sin imagen ({alerts.noImage.length})</CardTitle>
                <CardDescription>Productos sin imagen principal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.noImage.length === 0 ? (
                  <p className="text-muted-foreground">Todo OK.</p>
                ) : (
                  alerts.noImage.map((p) => (
                    <Link key={p.id} to={`/admin/productos/${p.id}`} className="block text-sm text-primary">
                      {p.title}
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sin stock ({alerts.noStock.length})</CardTitle>
                <CardDescription>Productos con pedidos en 0.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.noStock.length === 0 ? (
                  <p className="text-muted-foreground">Todo OK.</p>
                ) : (
                  alerts.noStock.map((p) => (
                    <Link key={p.id} to={`/admin/productos/${p.id}`} className="block text-sm text-primary">
                      {p.title}
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sin categoría ({alerts.noCategory.length})</CardTitle>
                <CardDescription>Productos sin categoría asignada.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.noCategory.length === 0 ? (
                  <p className="text-muted-foreground">Todo OK.</p>
                ) : (
                  alerts.noCategory.map((p) => (
                    <Link key={p.id} to={`/admin/productos/${p.id}`} className="block text-sm text-primary">
                      {p.title}
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
