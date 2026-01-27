import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCreateProduct, useUpdateProductBenefits, useUpdateProductReviews } from '@/hooks/useProducts';
import { ArrowLeft, Loader2, Zap, Link as LinkIcon, Check, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';

const CATEGORIES = [
  { value: 'canas', label: '🎣 Cañas' },
  { value: 'carretes', label: '🔄 Carretes' },
  { value: 'boyas', label: '🔴 Boyas' },
  { value: 'sensuelos', label: '🐟 Señuelos' },
  { value: 'anzuelos', label: '🪝 Anzuelos' },
  { value: 'lineas', label: '🧵 Líneas' },
  { value: 'accesorios', label: '🎒 Accesorios' },
  { value: 'ropa', label: '👕 Ropa' },
  { value: 'otros', label: '📦 Otros' },
];

// Default benefits based on category
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
  price: string;
  originalPrice: string;
  discount: string;
  images: string[];
  rating: number;
  reviewCount: number;
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

  const [aliexpressUrl, setAliexpressUrl] = useState('');
  const [category, setCategory] = useState('otros');
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [error, setError] = useState('');

  const handleScrape = async () => {
    if (!aliexpressUrl.trim()) {
      toast({
        variant: 'destructive',
        title: 'URL requerida',
        description: 'Por favor pega el link de AliExpress',
      });
      return;
    }

    setIsScraping(true);
    setError('');
    setScrapedData(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('scrape-aliexpress', {
        body: { url: aliexpressUrl },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'No se pudo extraer la información');
      }

      setScrapedData(data.data);
      toast({
        title: '¡Datos extraídos!',
        description: 'Revisa la información y haz clic en Crear Producto',
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

  const handleCreateProduct = async () => {
    if (!scrapedData) {
      toast({
        variant: 'destructive',
        title: 'Sin datos',
        description: 'Primero extrae los datos del link de AliExpress',
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
        price: scrapedData.price,
        original_price: scrapedData.originalPrice || null,
        discount: scrapedData.discount || null,
        affiliate_link: scrapedData.affiliateLink,
        aliexpress_url: scrapedData.aliexpressUrl || null,
        main_image_url: scrapedData.images[0] || null,
        video_url: null,
        rating: scrapedData.rating,
        review_count: scrapedData.reviewCount,
        is_published: false,
        category,
      };

      const newProduct = await createProduct.mutateAsync(productData);

      if (newProduct?.id) {
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
        description: 'El producto se ha creado como borrador. Edítalo para publicarlo.',
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
                onClick={handleScrape} 
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
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
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
                {scrapedData.images[0] && (
                  <img
                    src={scrapedData.images[0]}
                    alt="Producto"
                    className="w-24 h-24 object-cover rounded-lg border"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold line-clamp-2">{scrapedData.title}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-primary">{scrapedData.price}</span>
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
                    📁 Categoría: {CATEGORIES.find(c => c.value === category)?.label}
                  </span>
                </div>
              </div>

              <Button 
                onClick={handleCreateProduct} 
                className="w-full" 
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Crear Producto
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                El producto se creará como borrador. Podrás editarlo antes de publicar.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
