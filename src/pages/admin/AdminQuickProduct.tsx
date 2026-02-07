import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCreateProduct, useUpdateProductBenefits, useUpdateProductReviews, useUpdateProductImages, useUpdateProductOptions } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { ArrowLeft, Loader2, Zap, Link as LinkIcon, Check, AlertCircle, ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ImageSelector } from '@/components/admin/ImageSelector';

// Default benefits based on category slug
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

// Generate fake reviews
function generateReviews(productTitle: string): { name: string; rating: number; comment: string; date_label: string; is_verified: boolean }[] {
  const names = ['Carlos M.', 'Antonio L.', 'María P.', 'José R.', 'Pedro S.', 'Ana G.', 'Luis F.', 'Carmen D.'];
  const comments = [
    `Excelente ${productTitle.split(' ').slice(0, 2).join(' ').toLowerCase()}, mejor de lo esperado. Muy recomendable.`,
    'Llegó rápido y bien empaquetado. La calidad es increíble para el precio.',
    'Ya lo he probado varias veces y funciona perfecto. Muy satisfecho con la compra.',
    'Relación calidad-precio inmejorable. Volveré a comprar sin duda.',
    'Superó mis expectativas. El material se siente muy resistente.',
  ];
  const dates = ['Hace 2 días', 'Hace 1 semana', 'Hace 2 semanas', 'Hace 3 días', 'Hace 5 días'];

  const numReviews = Math.floor(Math.random() * 3) + 3; // 3-5 reviews
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

  // Categories from database
  const { data: categories } = useCategories();

  const [aliexpressUrl, setAliexpressUrl] = useState('');
  const [category, setCategory] = useState('otros');
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [error, setError] = useState('');
  const scrapeTimer = useRef<number | null>(null);
  
  // Image selection state
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  const handleScrape = async (requestedUrl?: string) => {
    const targetUrl = (requestedUrl || aliexpressUrl).trim();
    if (!targetUrl) {
      toast({
        variant: 'destructive',
        title: 'URL requerida',
        description: 'Por favor pega el link de AliExpress',
      });
      return;
    }

    if (targetUrl === aliexpressUrl.trim() && isScraping) {
      return;
    }

    setIsScraping(true);
    setError('');
    setScrapedData(null);
    setSelectedImages([]);

    try {
      let data: any;
      let fnError: any;

      try {
        const res = await supabase.functions.invoke('import-product', {
          body: { url: targetUrl },
        });
        data = res.data;
        fnError = res.error;
      } catch (err: any) {
        fnError = err;
      }

      if (fnError && String(fnError.message || fnError).includes('Failed to send a request')) {
        // Fallback to legacy scraper if new function isn't reachable
        const fallback = await supabase.functions.invoke('scrape-aliexpress', {
          body: { url: targetUrl },
        });
        data = fallback.data;
        fnError = fallback.error;
        if (!fnError) {
          toast({
            title: 'Usando modo compatible',
            description: 'No se pudo contactar import-product. Despliega la función para el modo completo.',
          });
        }
      }

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'No se pudo extraer la información');
      }

      setScrapedData(data.data);
      
      // If there are multiple images, show selector
      if (data.data.images && data.data.images.length > 1) {
        setSelectedImages(data.data.images);
        setShowImageSelector(true);
      } else {
        setSelectedImages(data.data.images || []);
      }
      
      toast({
        title: '¡Datos extraídos!',
        description: `Se encontraron ${data.data.images?.length || 0} imágenes`,
      });
    } catch (err: any) {
      console.error('Scrape error:', err);
      setError(err.message || 'Error al extraer datos. Intenta de nuevo.');
      toast({
        variant: 'destructive',
        title: 'Error al extraer',
        description: err.message || 'No se pudo obtener la información del producto',
      });
    } finally {
      setIsScraping(false);
    }
  };

  useEffect(() => {
    if (scrapeTimer.current) {
      window.clearTimeout(scrapeTimer.current);
    }

    const targetUrl = aliexpressUrl.trim();
    if (!targetUrl) return;

    scrapeTimer.current = window.setTimeout(() => {
      handleScrape(targetUrl);
    }, 700);

    return () => {
      if (scrapeTimer.current) {
        window.clearTimeout(scrapeTimer.current);
      }
    };
  }, [aliexpressUrl]);

  const handleImageSelection = (images: string[]) => {
    setSelectedImages(images);
    setShowImageSelector(false);
    toast({
      title: 'Imágenes seleccionadas',
      description: `${images.length} imágenes listas para importar`,
    });
  };

  const handleCreateProduct = async () => {
    if (!scrapedData) {
      toast({
        variant: 'destructive',
        title: 'Sin datos',
        description: 'Primero extrae los datos del link de AliExpress',
      });
      return;
    }

    if (selectedImages.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Sin imágenes',
        description: 'Selecciona al menos una imagen para el producto',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Create the product
      const productData = {
        title: scrapedData.title,
        slug: scrapedData.slug,
        subtitle: scrapedData.subtitle || null,
        description: scrapedData.description || null,
        price: scrapedData.price,
        original_price: scrapedData.originalPrice || null,
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
        // Save all selected images
        await updateImages.mutateAsync({
          productId: newProduct.id,
          images: selectedImages.map(url => ({ url, title: '', price: '' })),
        });

        if (scrapedData.variants?.length) {
          const flatOptions = scrapedData.variants.flatMap(group =>
            group.options.map(opt => ({
              group: group.group,
              label: opt.label,
              imageUrl: opt.imageUrl
            }))
          );
          await updateOptions.mutateAsync({
            productId: newProduct.id,
            options: flatOptions,
          });
        }
        
        // Add default benefits based on category
        const benefitsData = DEFAULT_BENEFITS[category] || DEFAULT_BENEFITS.default;
        await updateBenefits.mutateAsync({
          productId: newProduct.id,
          benefits: benefitsData.map((b, i) => ({ ...b, display_order: i })),
        });

        // Add generated reviews
        const reviewsData = generateReviews(scrapedData.title);
        await updateReviews.mutateAsync({
          productId: newProduct.id,
          reviews: reviewsData.map(r => ({ ...r, avatar_url: null })),
        });
      }

      toast({
        title: '¡Producto creado!',
        description: `Con ${selectedImages.length} imágenes. Edítalo para publicarlo.`,
      });

      navigate(`/admin/productos/${newProduct?.id}`);
    } catch (err: any) {
      console.error('Create error:', err);
      toast({
        variant: 'destructive',
        title: 'Error al crear',
        description: err.message || 'No se pudo crear el producto',
      });
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
            <Link to="/admin/productos">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              Producto Rápido
            </h1>
            <p className="text-sm text-muted-foreground">
              Pega un link de AliExpress y creamos el producto automáticamente
            </p>
          </div>
        </div>

        {/* Step 1: URL Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
              Pega el Link de AliExpress
            </CardTitle>
            <CardDescription>
              Copia el link del producto desde AliExpress
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={aliexpressUrl}
                  onChange={(e) => setAliexpressUrl(e.target.value)}
                  placeholder="https://es.aliexpress.com/item/..."
                  className="w-full"
                />
              </div>
              <Button 
                onClick={() => handleScrape()} 
                disabled={isScraping || !aliexpressUrl.trim()}
              >
                {isScraping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Extraer</span>
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Category Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
              Selecciona la Categoría
            </CardTitle>
            <CardDescription>
              Esto añadirá beneficios predefinidos según el tipo de producto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.slug}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Step 3: Preview & Create */}
        {scrapedData && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
                Vista Previa
              </CardTitle>
              <CardDescription>
                Revisa los datos extraídos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                {selectedImages[0] && (
                  <img
                    src={selectedImages[0]}
                    alt="Producto"
                    className="w-24 h-24 object-cover rounded-lg border"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold line-clamp-2">{scrapedData.title}</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    {scrapedData.priceRange ? (
                      <span className="text-xl font-bold text-primary">{scrapedData.priceRange}</span>
                    ) : (
                      <span className="text-xl font-bold text-primary">{scrapedData.price}</span>
                    )}
                    {scrapedData.originalPrice && (
                      <span className="text-sm text-muted-foreground line-through">
                        {scrapedData.originalPrice}
                      </span>
                    )}
                    {scrapedData.discount && (
                      <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded">
                        {scrapedData.discount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>⭐ {scrapedData.rating.toFixed(1)}</span>
                    <span>•</span>
                    <span>{scrapedData.reviewCount} ventas</span>
                  </div>
                </div>
              </div>

              {/* Image count and selector button */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <strong>{selectedImages.length}</strong> imágenes seleccionadas
                    {scrapedData.images.length > selectedImages.length && (
                      <span className="text-muted-foreground">
                        {' '}de {scrapedData.images.length} disponibles
                      </span>
                    )}
                  </span>
                </div>
                {scrapedData.images.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowImageSelector(true)}
                  >
                    Editar selección
                  </Button>
                )}
              </div>

              <div className="pt-4 border-t">
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Se añadirán automáticamente:
                </Label>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-secondary px-2 py-1 rounded">
                    ✅ {(DEFAULT_BENEFITS[category] || DEFAULT_BENEFITS.default).length} beneficios
                  </span>
                  <span className="text-xs bg-secondary px-2 py-1 rounded">
                    ⭐ 3-5 reseñas
                  </span>
                  <span className="text-xs bg-secondary px-2 py-1 rounded">
                    📁 Categoría: {categories?.find(c => c.slug === category)?.icon} {categories?.find(c => c.slug === category)?.name}
                  </span>
                </div>
              </div>

              <Button 
                onClick={handleCreateProduct} 
                className="w-full" 
                size="lg"
                disabled={isLoading || selectedImages.length === 0}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Crear Producto con {selectedImages.length} imágenes
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                El producto se creará como borrador. Podrás editarlo antes de publicar.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Image Selection Dialog */}
      <Dialog open={showImageSelector} onOpenChange={setShowImageSelector}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Seleccionar imágenes a importar</DialogTitle>
            <DialogDescription>
              Elige qué imágenes quieres usar para este producto. La primera será la imagen principal.
            </DialogDescription>
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
