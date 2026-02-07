import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSiteSettings, useUpdateSiteSettings } from '@/hooks/useSiteSettings';
import { useSiteSocialLinks, useUpdateSiteSocialLinks } from '@/hooks/useSiteSocialLinks';
import { SocialIcon } from '@/components/social/SocialIcon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus } from 'lucide-react';
import { Loader2, Save } from 'lucide-react';

export default function AdminSiteSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const { data: socialLinks } = useSiteSocialLinks();
  const updateSocialLinks = useUpdateSiteSocialLinks();

  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [footerText, setFooterText] = useState('');
  const [socials, setSocials] = useState<{ platform: string; url: string; is_enabled: boolean }[]>([]);

  useEffect(() => {
    if (settings) {
      setHeroTitle(settings.hero_title || '');
      setHeroSubtitle(settings.hero_subtitle || '');
      setFooterText(settings.footer_text || '');
    }
  }, [settings]);

  useEffect(() => {
    if (socialLinks) {
      setSocials(
        socialLinks.map((s) => ({
          platform: s.platform,
          url: s.url,
          is_enabled: s.is_enabled,
        }))
      );
    }
  }, [socialLinks]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateSettings.mutateAsync({
        id: 1,
        hero_title: heroTitle.trim(),
        hero_subtitle: heroSubtitle.trim(),
        footer_text: footerText.trim(),
      });

      await updateSocialLinks.mutateAsync(
        socials.map((s) => ({
          platform: s.platform,
          url: s.url,
          is_enabled: s.is_enabled,
          display_order: 0,
        }))
      );

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

            <Button type="submit" disabled={isLoading || updateSettings.isPending || updateSocialLinks.isPending}>
              {updateSettings.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar cambios
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Redes sociales</CardTitle>
            <CardDescription>
              Añade enlaces y activa las redes que quieras mostrar con su logo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {socials.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay redes configuradas.</p>
            ) : (
              socials.map((social, index) => (
                <div key={`${social.platform}-${index}`} className="flex flex-col md:flex-row gap-3 md:items-center">
                  <div className="flex items-center gap-2">
                    <SocialIcon platform={social.platform} className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Select
                    value={social.platform}
                    onValueChange={(value) => {
                      const updated = [...socials];
                      updated[index] = { ...updated[index], platform: value };
                      setSocials(updated);
                    }}
                  >
                    <SelectTrigger className="md:w-52">
                      <SelectValue placeholder="Red" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="twitter">X (Twitter)</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    value={social.url}
                    onChange={(e) => {
                      const updated = [...socials];
                      updated[index] = { ...updated[index], url: e.target.value };
                      setSocials(updated);
                    }}
                    placeholder="https://..."
                    className="flex-1"
                  />

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={social.is_enabled}
                      onCheckedChange={(checked) => {
                        const updated = [...socials];
                        updated[index] = { ...updated[index], is_enabled: checked };
                        setSocials(updated);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSocials(socials.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => setSocials([...socials, { platform: 'instagram', url: '', is_enabled: true }])}
            >
              <Plus className="h-4 w-4 mr-2" />
              Añadir red
            </Button>
          </CardContent>
        </Card>
      </form>
    </AdminLayout>
  );
}
