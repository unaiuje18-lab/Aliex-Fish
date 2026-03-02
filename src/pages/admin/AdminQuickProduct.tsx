import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCreateProduct, useUpdateProductBenefits, useUpdateProductReviews, useUpdateProductImages, useUpdateProductOptions } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { ArrowLeft, Loader2, Zap, Link as LinkIcon, Check, AlertCircle, ImageIcon, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ImageSelector } from '@/components/admin/ImageSelector';

const DEFAULT_BENEFITS: Record<string, { icon: string; title: string; description: string }[]> = {
  canas: [
    { icon: 'Zap', title: 'Alta Sensibilidad', description: 'Detecta hasta el pique más suave' },
    { icon: 'Shield', title: 'Material Resistente', description: 'Carbono de alta densidad' },
    { icon: 'Award', title: 'Diseño Ergonómico', description: 'Agarre cómodo durante horas' },
  ],
  carretes: [
    { icon: 'Zap', title: 'Bobinado Suave', description: 'Sistema de rodamientos premium' },
    { icon: 'Shield', title: 'Anti-Corrosión', description: 'Ideal para agua salada' },
    { icon: 'Battery', title: 'Alta Capacidad', description: 'Mayor cantidad de línea' },
  ],
  boyas: [
    { icon: 'Check', title: 'Alta Visibilidad', description: 'Fácil de ver en cualquier condición' },
    { icon: 'Zap', title: 'Sensibilidad Extrema', description: 'Detecta piques sutiles' },
    { icon: 'Shield', title: 'Durable', description: 'Resistente a golpes y UV' },
  ],
  sensuelos: [
    { icon: 'Zap', title: 'Movimiento Realista', description: 'Atrae más peces' },
    { icon: 'Award', title: 'Colores Vibrantes', description: 'Diseño irresistible' },
    { icon: 'Shield', title: 'Anzuelos Premium', description: 'Afilados y resistentes' },
  ],
  anzuelos: [
    { icon: 'Zap', title: 'Ultra Afilados', description: 'Penetración instantánea' },
    { icon: 'Shield', title: 'Acero de Alta Calidad', description: 'No se doblan ni oxidan' },
    { icon: 'Check', title: 'Variedad de Tamaños', description: 'Para cualquier especie' },
  ],
  default: [
    { icon: 'Check', title: 'Calidad Premium', description: 'Materiales de primera' },
    { icon: 'Truck', title: 'Envío Rápido', description: 'Recíbelo en días' },
    { icon: 'Shield', title: 'Garantía', description: 'Compra protegida' },
  ],
};

function generateReviews(productTitle: string) {
  const names = ['Carlos M.', 'Antonio L.', 'María P.', 'José R.', 'Pedro S.', 'Ana G.', 'Luis F.', 'Carmen D.'];
  const comments = [
    `Excelente ${productTitle.split(' ').slice(0, 2).join(' ').toLowerCase()}, mejor de lo esperado. Muy recomendable.`,
    'Llegó rápido y bien empaquetado. La calidad es increíble para el precio.',
    'Ya lo he probado varias veces y funciona perfecto. Muy satisfecho con la compra.',
    'Relación calidad-precio inmejorable. Volveré a comprar sin duda.',
    'Superó mis expectativas. El material se siente muy resistente.',
  ];
  const dates = ['Hace 2 días', 'Hace 1 semana', 'Hace 2 semanas', 'Hace 3 días', 'Hace 5 días'];
  const numReviews = Math.floor(Math.random() * 3) + 3;
  const reviews = [];
  for (let i = 0; i < numReviews; i++) {
    reviews.push({
      name: names[Math.floor(Math.random() * names.length)],
      rating: Math.random() > 0.2 ? 5 : 4,
      comment: comments[i % comments.length],
      date_label: dates[Math.floor(Math.random() * dates.length)],
      is_verified: Math.random() > 0.2,
    });
  }
  return reviews;
}

interface ScrapedData {
  title: string;
  subtitle: string;
  description: string;
  price: string;
  originalPrice: string;
  priceRange: string;
  discount: string;
  images: string[];
  rating: number;
  reviewCount: number;
  ordersCount: number;
  shippingCost: string;
  deliveryTime: string;
  sku: string;
  variants: { group: string; options: { label: string; imageUrl?: string }[] }[];
  slug: string;
  affiliateLink: string;
  aliexpressUrl: string;
}

export default function AdminQuickProduct() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createProduct = useCreateProduct();
  const updateBenefits = useUpdateProductBenefits();
  const updateReviews = useUpdateProductReviews();
  const updateImages = useUpdateProductImages();
  const updateOptions = useUpdateProductOptions();
  const { data: categories } = useCategories();

  const [aliexpressUrl, setAliexpressUrl] = useState('');
  const [category, setCategory] = useState('otros');
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [error, setError] = useState('');
  const scrapeTimer = useRef<number | null>(null);

  // Editable fields
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editOriginalPrice, setEditOriginalPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Image selection
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  const handleScrape = async (requestedUrl?: string) => {
    const targetUrl = (requestedUrl || aliexpressUrl).trim();
    if (!targetUrl) {
      toast({ variant: 'destructive', title: 'URL requerida', description: 'Por favor pega el link de AliExpress' });
      return;
    }
    if (targetUrl === aliexpressUrl.trim() && isScraping) return;

    setIsScraping(true);
    setError('');
    setScrapedData(null);
    setSelectedImages([]);

    try {
      let data: any;
      let fnError: any;

      try {
        const res = await supabase.functions.invoke('import-product', { body: { url: targetUrl } });
        data = res.data;
        fnError = res.error;
      } catch (err: any) {
        fnError = err;
      }

      if (fnError) throw new Error(fnError.message);
      if (!data.success) throw new Error(data.error || 'No se pudo extraer la información');

      const scraped = data.data as ScrapedData;
      setScrapedData(scraped);

      // Populate editable fields
      setEditTitle(scraped.title || '');
      setEditPrice(scraped.price || '');
      setEditOriginalPrice(scraped.originalPrice || '');
      setEditDescription(scraped.description || '');

      if (scraped.images?.length > 1) {
        setSelectedImages(scraped.images);
        setShowImageSelector(true);
      } else {
        setSelectedImages(scraped.images || []);
      }

      toast({ title: '¡Datos extraídos!', description: `${scraped.images?.length || 0} imágenes encontradas` });
    } catch (err: any) {
      console.error('Scrape error:', err);
      setError(err.message || 'Error al extraer datos');
      toast({ variant: 'destructive', title: 'Error al extraer', description: err.message });
    } finally {
      setIsScraping(false);
    }
  };

  useEffect(() => {
    if (scrapeTimer.current) window.clearTimeout(scrapeTimer.current);
    const targetUrl = aliexpressUrl.trim();
    if (!targetUrl) return;
    scrapeTimer.current = window.setTimeout(() => handleScrape(targetUrl), 700);
    return () => { if (scrapeTimer.current) window.clearTimeout(scrapeTimer.current); };
  }, [aliexpressUrl]);

  const handleImageSelection = (images: string[]) => {
    setSelectedImages(images);
    setShowImageSelector(false);
    toast({ title: 'Imágenes seleccionadas', description: `${images.length} imágenes listas` });
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
      .replace(/[^a-z0-9\\s-]/g, '')
      .replace(/\\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 80) || `producto-${Date.now()}`;
  };

  const handleCreateProduct = async () => {
    if (!scrapedData) return;
    if (selectedImages.length === 0) {
      toast({ variant: 'destructive', title: 'Sin imágenes', description: 'Selecciona al menos una imagen' });
      return;
    }

    setIsLoading(true);
    try {
      const productData = {
        title: editTitle || scrapedData.title,
        slug: generateSlug(editTitle || scrapedData.title),
        subtitle: scrapedData.subtitle || null,
        description: editDescription || scrapedData.description || null,
        price: editPrice || scrapedData.price,
        original_price: editOriginalPrice || scrapedData.originalPrice || null,
        discount: scrapedData.discount || null,
        affiliate_link: scrapedData.affiliateLink,
        aliexpress_url: scrapedData.aliexpressUrl || null,
        main_image_url: selectedImages[0] || null,
        video_url: null,
        rating: scrapedData.rating,
        review_count: scrapedData.reviewCount,
        orders_count: scrapedData.ordersCount || 0,
        shipping_cost: scrapedData.shippingCost || null,
        delivery_time: scrapedData.deliveryTime || null,
        sku: scrapedData.sku || null,
        is_published: false,
        category,
        price_min: null,
        price_max: null,
      };

      const newProduct = await createProduct.mutateAsync(productData);

      if (newProduct?.id) {
        await updateImages.mutateAsync({
          productId: newProduct.id,
          images: selectedImages.map(url => ({ url, title: '', price: '' })),
        });

        if (scrapedData.variants?.length) {
          const flatOptions = scrapedData.variants.flatMap(group =>
            group.options.map(opt => ({ group: group.group, label: opt.label, imageUrl: opt.imageUrl }))
          );
          await updateOptions.mutateAsync({ productId: newProduct.id, options: flatOptions });
        }

        const benefitsData = DEFAULT_BENEFITS[category] || DEFAULT_BENEFITS.default;
        await updateBenefits.mutateAsync({
          productId: newProduct.id,
          benefits: benefitsData.map((b, i) => ({ ...b, display_order: i })),
        });

        const reviewsData = generateReviews(editTitle || scrapedData.title);
        await updateReviews.mutateAsync({
          productId: newProduct.id,
          reviews: reviewsData.map(r => ({ ...r, avatar_url: null })),
        });
      }

      toast({ title: '¡Producto creado!', description: `Con ${selectedImages.length} imágenes. Edítalo para publicarlo.` });
      navigate(`/admin/productos/${newProduct?.id}`);
    } catch (err: any) {
      console.error('Create error:', err);
      toast({ variant: 'destructive', title: 'Error al crear', description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/productos"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              Importar Producto
            </h1>
            <p className="text-sm text-muted-foreground">
              Pega un link de AliExpress y edita los datos antes de crear
            </p>
          </div>
        </div>

        {/* Step 1: URL Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
              Pega el Link
            </CardTitle>
            <CardDescription>Link de producto o de afiliado de AliExpress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={aliexpressUrl}
                onChange={(e) => setAliexpressUrl(e.target.value)}
                placeholder="https://es.aliexpress.com/item/... o link de afiliado"
                className="flex-1"
              />
              <Button onClick={() => handleScrape()} disabled={isScraping || !aliexpressUrl.trim()}>
                {isScraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">Extraer</span>
              </Button>
            </div>
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Editable Preview */}
        {scrapedData && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                <Pencil className="h-4 w-4" />
                Edita los datos
              </CardTitle>
              <CardDescription>Modifica título, precio y descripción antes de crear</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Main image preview */}
              <div className="flex gap-4">
                {selectedImages[0] && (
                  <img
                    src={selectedImages[0]}
                    alt="Producto"
                    className="w-28 h-28 object-cover rounded-lg border flex-shrink-0"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <div className="flex-1 space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Título</Label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Título del producto"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Precio</Label>
                      <Input
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        placeholder="€12.99"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Precio original</Label>
                      <Input
                        value={editOriginalPrice}
                        onChange={(e) => setEditOriginalPrice(e.target.value)}
                        placeholder="€24.99 (opcional)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="text-xs text-muted-foreground">Descripción</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Descripción del producto (opcional)"
                  rows={3}
                />
              </div>

              {/* Category */}
              <div>
                <Label className="text-xs text-muted-foreground">Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.slug}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))
                  }</SelectContent>
                </Select>
              </div>

              {/* Image count */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <strong>{selectedImages.length}</strong> imágenes seleccionadas
                    {scrapedData.images.length > selectedImages.length && (
                      <span className="text-muted-foreground"> de {scrapedData.images.length} disponibles</span>
                    )}
                  </span>
                </div>
                {scrapedData.images.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setShowImageSelector(true)}>
                    Editar selección
                  </Button>
                )}
              </div>

              {/* Auto-added info */}
              <div className="pt-3 border-t">
                <Label className="text-xs text-muted-foreground mb-2 block">Se añadirán automáticamente:</Label>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-secondary px-2 py-1 rounded">
                    ✅ {(DEFAULT_BENEFITS[category] || DEFAULT_BENEFITS.default).length} beneficios
                  </span>
                  <span className="text-xs bg-secondary px-2 py-1 rounded">⭐ 3-5 reseñas</span>
                </div>
              </div>

              <Button
                onClick={handleCreateProduct}
                className="w-full"
                size="lg"
                disabled={isLoading || selectedImages.length === 0}
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Crear Producto
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Se creará como borrador. Podrás editarlo antes de publicar.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Image Selection Dialog */}
      <Dialog open={showImageSelector} onOpenChange={setShowImageSelector}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Seleccionar imágenes</DialogTitle>
            <DialogDescription>Elige las imágenes para este producto. La primera será la principal.</DialogDescription>
          </DialogHeader>
          {scrapedData && (
            <ImageSelector
              images={scrapedData.images}
              onConfirm={handleImageSelection}
              onCancel={() => setShowImageSelector(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
