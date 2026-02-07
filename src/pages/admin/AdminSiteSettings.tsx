import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSiteSettings, useUpdateSiteSettings } from '@/hooks/useSiteSettings';
import { Loader2, Save } from 'lucide-react';

export default function AdminSiteSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();

  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [footerText, setFooterText] = useState('');

  useEffect(() => {
    if (settings) {
      setHeroTitle(settings.hero_title || '');
      setHeroSubtitle(settings.hero_subtitle || '');
      setFooterText(settings.footer_text || '');
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateSettings.mutateAsync({
        id: 1,
        hero_title: heroTitle.trim(),
        hero_subtitle: heroSubtitle.trim(),
        footer_text: footerText.trim(),
      });

      toast({
        title: 'Configuración guardada',
        description: 'Los textos se han actualizado correctamente.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    }
  };

  return (
    <AdminLayout>
      <form onSubmit={handleSave} className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Textos de la tienda</CardTitle>
            <CardDescription>
              Cambia la frase principal del inicio y el texto informativo del final.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="heroTitle">Frase principal (inicio)</Label>
              <Input
                id="heroTitle"
                value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)}
                placeholder="Los mejores productos de pesca..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="heroSubtitle">Texto de apoyo (inicio)</Label>
              <Textarea
                id="heroSubtitle"
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                placeholder="Encuentra los mejores precios..."
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="footerText">Información final (footer)</Label>
              <Textarea
                id="footerText"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="© 2026 MiTienda. Todos los derechos reservados."
                rows={2}
                required
              />
            </div>

            <Button type="submit" disabled={isLoading || updateSettings.isPending}>
              {updateSettings.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar cambios
            </Button>
          </CardContent>
        </Card>
      </form>
    </AdminLayout>
  );
}
