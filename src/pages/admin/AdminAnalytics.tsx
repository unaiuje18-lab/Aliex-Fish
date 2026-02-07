import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

type Metrics = {
  totalVisits: number;
  last7DaysVisits: number;
  productClicks: number;
  last7DaysClicks: number;
  productPageViews: number;
};

const defaultMetrics: Metrics = {
  totalVisits: 0,
  last7DaysVisits: 0,
  productClicks: 0,
  last7DaysClicks: 0,
  productPageViews: 0,
};

export default function AdminAnalytics() {
  const [metrics, setMetrics] = useState<Metrics>(defaultMetrics);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [totalVisits, last7DaysVisits, productClicks, last7DaysClicks, productPageViews] = await Promise.all([
        supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view'),
        supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', since),
        supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'affiliate_click'),
        supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'affiliate_click').gte('created_at', since),
        supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'product_view'),
      ]);

      setMetrics({
        totalVisits: totalVisits.count || 0,
        last7DaysVisits: last7DaysVisits.count || 0,
        productClicks: productClicks.count || 0,
        last7DaysClicks: last7DaysClicks.count || 0,
        productPageViews: productPageViews.count || 0,
      });

      setIsLoading(false);
    };

    load();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analítica</h1>
          <p className="text-muted-foreground">Resumen básico de visitas y clics</p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando métricas...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Visitas totales</CardTitle>
                <CardDescription>Todos los accesos a la web</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics.totalVisits}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Últimos 7 días: {metrics.last7DaysVisits}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vistas de producto</CardTitle>
                <CardDescription>Entradas a páginas de producto</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics.productPageViews}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Clics en AliExpress</CardTitle>
                <CardDescription>Interacciones con el link afiliado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics.productClicks}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Últimos 7 días: {metrics.last7DaysClicks}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
