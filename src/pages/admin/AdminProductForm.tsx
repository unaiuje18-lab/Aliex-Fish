import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  useProductById, 
  useCreateProduct, 
  useUpdateProduct,
  useUpdateProductBenefits,
  useUpdateProductVideos,
  useUpdateProductReviews,
  useUpdateProductFAQs,
  useUpdateProductImages
} from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Save, Plus, Trash2, GripVertical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MultiImageUpload } from '@/components/admin/MultiImageUpload';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normalizeImageUrl } from '@/lib/imageUrl';

const iconOptions = [
  'Check', 'Zap', 'Shield', 'Battery', 'Headphones', 'Star', 'Heart', 
  'Volume2', 'Wifi', 'Bluetooth', 'Clock', 'Award', 'ThumbsUp', 'Truck'
];

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function parsePrice(raw: string): { mode: 'single' | 'range'; from: string; to: string } {
  const clean = (raw || '').trim();
  if (!clean) return { mode: 'single', from: '', to: '' };

  const rangeMatch = clean.match(/(\d+(?:[.,]\d{1,2})?)\s*[-–]\s*(\d+(?:[.,]\d{1,2})?)/);
  if (rangeMatch) {
    return { mode: 'range', from: rangeMatch[1], to: rangeMatch[2] };
  }

  const singleMatch = clean.match(/(\d+(?:[.,]\d{1,2})?)/);
  if (singleMatch) {
    return { mode: 'single', from: singleMatch[1], to: '' };
  }

  return { mode: 'single', from: clean, to: '' };
}

function buildPriceString(mode: 'single' | 'range', from: string, to: string): string {
  const fromClean = from.trim();
  const toClean = to.trim();
  if (mode === 'range') {
    if (!fromClean || !toClean) return '';
    return `${fromClean}€-${toClean}€`;
  }
  if (!fromClean) return '';
  return `€${fromClean}`;
}

function parsePriceNumber(value: string): number | null {
  const cleaned = value.replace(/[^\d.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return null;
  return num;
}

function calculateDiscountPercent(current: string, original: string): string {
  const currentNum = parsePriceNumber(current);
  const originalNum = parsePriceNumber(original);
  if (!currentNum || !originalNum) return '';
  if (originalNum <= currentNum) return '';
  const discount = Math.round(((originalNum - currentNum) / originalNum) * 100);
  if (discount <= 0 || discount >= 100) return '';
  return `${discount}%`;
}

interface BenefitForm {
  icon: string;
  title: string;
  description: string;
}

interface VideoForm {
  video_url: string;
  thumbnail_url: string;
  title: string;
}

interface ReviewForm {
  name: string;
  rating: number;
  comment: string;
  date_label: string;
  is_verified: boolean;
}

interface FAQForm {
  question: string;
  answer: string;
}

export default function AdminProductForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: existingProduct, isLoading: isLoadingProduct } = useProductById(id || '');
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const updateBenefits = useUpdateProductBenefits();
  const updateVideos = useUpdateProductVideos();
  const updateReviews = useUpdateProductReviews();
  const updateFAQs = useUpdateProductFAQs();
  const updateImages = useUpdateProductImages();

  // Basic info
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceMode, setPriceMode] = useState<'single' | 'range'>('single');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [affiliateLink, setAffiliateLink] = useState('');
  const [aliexpressUrl, setAliexpressUrl] = useState('');
  const [rating, setRating] = useState('4.5');
  const [reviewCount, setReviewCount] = useState('0');
  const [ordersCount, setOrdersCount] = useState('0');
  const [shippingCost, setShippingCost] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [sku, setSku] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [category, setCategory] = useState('otros');

  // Categories
  const { data: categories } = useCategories();

  // Media
  const [productImages, setProductImages] = useState<{ url: string; title: string; price: string }[]>([]);
  const [videoUrl, setVideoUrl] = useState('');

  // Related data
  const [benefits, setBenefits] = useState<BenefitForm[]>([]);
  const [videos, setVideos] = useState<VideoForm[]>([]);
  const [reviews, setReviews] = useState<ReviewForm[]>([]);
  const [faqs, setFAQs] = useState<FAQForm[]>([]);

  // Load existing data
  useEffect(() => {
    if (existingProduct) {
      setTitle(existingProduct.title);
      setSlug(existingProduct.slug);
      setSubtitle(existingProduct.subtitle || '');
      setDescription(existingProduct.description || '');
      const parsedPrice = parsePrice(existingProduct.price);
      setPriceMode(parsedPrice.mode);
      setPriceFrom(parsedPrice.from);
      setPriceTo(parsedPrice.to);
      setOriginalPrice(existingProduct.original_price || '');
      setDiscount(existingProduct.discount || '');
      setAffiliateLink(existingProduct.affiliate_link);
      setAliexpressUrl(existingProduct.aliexpress_url || '');
      setRating(String(existingProduct.rating));
      setReviewCount(String(existingProduct.review_count));
      setOrdersCount(String(existingProduct.orders_count || 0));
      setShippingCost(existingProduct.shipping_cost || '');
      setDeliveryTime(existingProduct.delivery_time || '');
      setSku(existingProduct.sku || '');
      setIsPublished(existingProduct.is_published);
      setVideoUrl(existingProduct.video_url || '');
      setCategory(existingProduct.category || 'otros');
      
      // Load images from product_images table or fallback to main_image_url
      const imagesWithTitles = existingProduct.images?.map(img => ({
        url: normalizeImageUrl(img.image_url),
        title: img.title || '',
        price: img.price || ''
      })) || [];
      if (imagesWithTitles.length === 0 && existingProduct.main_image_url) {
        setProductImages([{ url: normalizeImageUrl(existingProduct.main_image_url), title: '', price: '' }]);
      } else {
        setProductImages(imagesWithTitles);
      }
      
      setBenefits(existingProduct.benefits.map(b => ({
        icon: b.icon,
        title: b.title,
        description: b.description || '',
      })));
      
      setVideos(existingProduct.videos.map(v => ({
        video_url: v.video_url,
        thumbnail_url: v.thumbnail_url || '',
        title: v.title || '',
      })));
      
      setReviews(existingProduct.reviews.map(r => ({
        name: r.name,
        rating: r.rating,
        comment: r.comment,
        date_label: r.date_label,
        is_verified: r.is_verified,
      })));
      
      setFAQs(existingProduct.faqs.map(f => ({
        question: f.question,
        answer: f.answer,
      })));
    }
  }, [existingProduct]);

  // Auto-generate slug from title
  useEffect(() => {
    if (!isEditing && title) {
      setSlug(generateSlug(title));
    }
  }, [title, isEditing]);

  useEffect(() => {
    if (priceMode !== 'single') {
      setDiscount('');
      return;
    }
    setDiscount(calculateDiscountPercent(priceFrom, originalPrice));
  }, [priceMode, priceFrom, originalPrice]);


  const isSaving = createProduct.isPending || updateProduct.isPending || 
    updateBenefits.isPending || updateVideos.isPending || 
    updateReviews.isPending || updateFAQs.isPending || updateImages.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalPrice = buildPriceString(priceMode, priceFrom, priceTo);
    if (!title || !slug || !finalPrice || !affiliateLink) {
      toast({
        variant: 'destructive',
        title: 'Campos requeridos',
        description: 'Por favor completa título, slug, precio y link de afiliado.',
      });
      return;
    }

    try {
      let productId = id;

      const priceMin = parsePriceNumber(priceFrom);
      const priceMax = priceMode === 'range' ? parsePriceNumber(priceTo) : parsePriceNumber(priceFrom);

      const productData = {
        title,
        slug,
        subtitle: subtitle || null,
        description: description || null,
        price: finalPrice,
        price_min: priceMin,
        price_max: priceMax,
        original_price: originalPrice || null,
        discount: discount || null,
        affiliate_link: affiliateLink,
        aliexpress_url: aliexpressUrl || null,
        main_image_url: productImages[0]?.url || null,
        video_url: videoUrl || null,
        rating: parseFloat(rating) || 4.5,
        review_count: parseInt(reviewCount) || 0,
        orders_count: parseInt(ordersCount) || 0,
        shipping_cost: shippingCost || null,
        delivery_time: deliveryTime || null,
        sku: sku || null,
        is_published: isPublished,
        category,
      };

      if (isEditing && id) {
        await updateProduct.mutateAsync({ id, ...productData });
      } else {
        const newProduct = await createProduct.mutateAsync(productData);
        productId = newProduct.id;
      }

      if (productId) {
        // Save related data
        await Promise.all([
          updateImages.mutateAsync({
            productId,
            images: productImages
          }),
          updateBenefits.mutateAsync({ 
            productId, 
            benefits: benefits.map((b, i) => ({ ...b, display_order: i })) 
          }),
          updateVideos.mutateAsync({ 
            productId, 
            videos: videos.map((v, i) => ({ ...v, display_order: i })) 
          }),
          updateReviews.mutateAsync({ 
            productId, 
            reviews: reviews.map(r => ({ ...r, avatar_url: null })) 
          }),
          updateFAQs.mutateAsync({ 
            productId, 
            faqs: faqs.map((f, i) => ({ ...f, display_order: i })) 
          }),
        ]);
      }

      toast({
        title: isEditing ? 'Producto actualizado' : 'Producto creado',
        description: isEditing 
          ? 'Los cambios han sido guardados.'
          : 'El producto ha sido creado correctamente.',
      });

      navigate('/admin/productos');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo guardar el producto.',
      });
    }
  };

  // Add/remove helpers
  const addBenefit = () => setBenefits([...benefits, { icon: 'Check', title: '', description: '' }]);
  const removeBenefit = (index: number) => setBenefits(benefits.filter((_, i) => i !== index));
  
  const addVideo = () => setVideos([...videos, { video_url: '', thumbnail_url: '', title: '' }]);
  const removeVideo = (index: number) => setVideos(videos.filter((_, i) => i !== index));
  
  const addReview = () => setReviews([...reviews, { name: '', rating: 5, comment: '', date_label: 'Hace unos días', is_verified: true }]);
  const removeReview = (index: number) => setReviews(reviews.filter((_, i) => i !== index));
  
  const addFAQ = () => setFAQs([...faqs, { question: '', answer: '' }]);
  const removeFAQ = (index: number) => setFAQs(faqs.filter((_, i) => i !== index));

  if (isEditing && isLoadingProduct) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/admin/productos">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isEditing ? 'Modifica los datos del producto' : 'Crea un nuevo producto para tu catálogo'}
              </p>
            </div>
          </div>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditing ? 'Guardar Cambios' : 'Crear Producto'}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="basic">Básico</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="benefits">Beneficios</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="faqs">FAQs</TabsTrigger>
            <TabsTrigger value="settings">Config</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic">
            <Card>
              <CardHeader>
                <CardTitle>Información Básica</CardTitle>
                <CardDescription>
                  Datos principales del producto
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Auriculares Inalámbricos Pro"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug (URL) *</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">/producto/</span>
                      <Input
                        id="slug"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="auriculares-pro"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subtitle">Subtítulo / Descripción corta</Label>
                  <Textarea
                    id="subtitle"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Sonido premium con cancelación de ruido activa..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción del producto</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detalles completos del producto..."
                    rows={4}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Tipo de precio</Label>
                    <Select value={priceMode} onValueChange={(value) => setPriceMode(value as 'single' | 'range')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Precio �nico</SelectItem>
                        <SelectItem value="range">Rango (desde-hasta)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {priceMode === 'single' ? (
                    <div className="space-y-2">
                      <Label htmlFor="priceFrom">Precio *</Label>
                      <Input
                        id="priceFrom"
                        value={priceFrom}
                        onChange={(e) => setPriceFrom(e.target.value)}
                        placeholder="29.99"
                        required
                      />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="priceFrom">Desde *</Label>
                        <Input
                          id="priceFrom"
                          value={priceFrom}
                          onChange={(e) => setPriceFrom(e.target.value)}
                          placeholder="29.99"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priceTo">Hasta *</Label>
                        <Input
                          id="priceTo"
                          value={priceTo}
                          onChange={(e) => setPriceTo(e.target.value)}
                          placeholder="59.99"
                          required
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="originalPrice">Precio Original</Label>
                    <Input
                      id="originalPrice"
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(e.target.value)}
                      placeholder="79.99"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discount">Descuento</Label>
                    <Input
                      id="discount"
                      value={discount}
                      readOnly
                      placeholder="62%"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="affiliateLink">Link de Afiliado *</Label>
                  <Input
                    id="affiliateLink"
                    value={affiliateLink}
                    onChange={(e) => setAffiliateLink(e.target.value)}
                    placeholder="https://s.click.aliexpress.com/..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aliexpressUrl">URL Original de AliExpress (referencia)</Label>
                  <Input
                    id="aliexpressUrl"
                    value={aliexpressUrl}
                    onChange={(e) => setAliexpressUrl(e.target.value)}
                    placeholder="https://aliexpress.com/item/..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoría</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Media Tab */}
          <TabsContent value="media">
            <Card>
              <CardHeader>
                <CardTitle>Media</CardTitle>
                <CardDescription>
                  Imagen y video principal del producto
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Imágenes del Producto</Label>
                  <MultiImageUpload
                    images={productImages}
                    onChange={setProductImages}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="videoUrl">URL del Video Principal (YouTube, etc.)</Label>
                  <Input
                    id="videoUrl"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/embed/..."
                  />
                </div>

                {/* Video Gallery */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Galería de Videos</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addVideo}>
                      <Plus className="h-4 w-4 mr-2" />
                      Añadir Video
                    </Button>
                  </div>
                  
                  {videos.map((video, index) => (
                    <div key={index} className="flex gap-4 p-4 border rounded-lg">
                      <div className="flex-1 space-y-3">
                        <Input
                          value={video.title}
                          onChange={(e) => {
                            const updated = [...videos];
                            updated[index].title = e.target.value;
                            setVideos(updated);
                          }}
                          placeholder="Título del video"
                        />
                        <Input
                          value={video.video_url}
                          onChange={(e) => {
                            const updated = [...videos];
                            updated[index].video_url = e.target.value;
                            setVideos(updated);
                          }}
                          placeholder="URL del video"
                        />
                        <Input
                          value={video.thumbnail_url}
                          onChange={(e) => {
                            const updated = [...videos];
                            updated[index].thumbnail_url = e.target.value;
                            setVideos(updated);
                          }}
                          placeholder="URL de la miniatura"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeVideo(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Benefits Tab */}
          <TabsContent value="benefits">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Beneficios</CardTitle>
                    <CardDescription>
                      Lista de beneficios del producto (3-5 recomendados)
                    </CardDescription>
                  </div>
                  <Button type="button" variant="outline" onClick={addBenefit}>
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Beneficio
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {benefits.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No hay beneficios. Añade algunos para destacar las ventajas del producto.
                  </p>
                ) : (
                  benefits.map((benefit, index) => (
                    <div key={index} className="flex gap-4 p-4 border rounded-lg">
                      <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-grab" />
                      <div className="flex-1 space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <Select
                            value={benefit.icon}
                            onValueChange={(value) => {
                              const updated = [...benefits];
                              updated[index].icon = value;
                              setBenefits(updated);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Icono" />
                            </SelectTrigger>
                            <SelectContent>
                              {iconOptions.map((icon) => (
                                <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={benefit.title}
                            onChange={(e) => {
                              const updated = [...benefits];
                              updated[index].title = e.target.value;
                              setBenefits(updated);
                            }}
                            placeholder="Título del beneficio"
                          />
                        </div>
                        <Input
                          value={benefit.description}
                          onChange={(e) => {
                            const updated = [...benefits];
                            updated[index].description = e.target.value;
                            setBenefits(updated);
                          }}
                          placeholder="Descripción breve"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBenefit(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Reviews</CardTitle>
                    <CardDescription>
                      Opiniones de clientes (se muestran en la página del producto)
                    </CardDescription>
                  </div>
                  <Button type="button" variant="outline" onClick={addReview}>
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Review
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {reviews.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No hay reviews. Añade algunas para generar confianza.
                  </p>
                ) : (
                  reviews.map((review, index) => (
                    <div key={index} className="flex gap-4 p-4 border rounded-lg">
                      <div className="flex-1 space-y-3">
                        <div className="grid gap-3 md:grid-cols-3">
                          <Input
                            value={review.name}
                            onChange={(e) => {
                              const updated = [...reviews];
                              updated[index].name = e.target.value;
                              setReviews(updated);
                            }}
                            placeholder="Nombre del cliente"
                          />
                          <Select
                            value={String(review.rating)}
                            onValueChange={(value) => {
                              const updated = [...reviews];
                              updated[index].rating = parseInt(value);
                              setReviews(updated);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[5, 4, 3, 2, 1].map((r) => (
                                <SelectItem key={r} value={String(r)}>
                                  {'★'.repeat(r)}{'☆'.repeat(5-r)} ({r})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={review.date_label}
                            onChange={(e) => {
                              const updated = [...reviews];
                              updated[index].date_label = e.target.value;
                              setReviews(updated);
                            }}
                            placeholder="Hace 2 días"
                          />
                        </div>
                        <Textarea
                          value={review.comment}
                          onChange={(e) => {
                            const updated = [...reviews];
                            updated[index].comment = e.target.value;
                            setReviews(updated);
                          }}
                          placeholder="Comentario del cliente..."
                          rows={2}
                        />
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={review.is_verified}
                            onCheckedChange={(checked) => {
                              const updated = [...reviews];
                              updated[index].is_verified = checked;
                              setReviews(updated);
                            }}
                          />
                          <Label>Compra verificada</Label>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeReview(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* FAQs Tab */}
          <TabsContent value="faqs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Preguntas Frecuentes</CardTitle>
                    <CardDescription>
                      FAQs para resolver objeciones de compra
                    </CardDescription>
                  </div>
                  <Button type="button" variant="outline" onClick={addFAQ}>
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir FAQ
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {faqs.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No hay FAQs. Añade preguntas comunes para ayudar a los clientes.
                  </p>
                ) : (
                  faqs.map((faq, index) => (
                    <div key={index} className="flex gap-4 p-4 border rounded-lg">
                      <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-grab" />
                      <div className="flex-1 space-y-3">
                        <Input
                          value={faq.question}
                          onChange={(e) => {
                            const updated = [...faqs];
                            updated[index].question = e.target.value;
                            setFAQs(updated);
                          }}
                          placeholder="Pregunta"
                        />
                        <Textarea
                          value={faq.answer}
                          onChange={(e) => {
                            const updated = [...faqs];
                            updated[index].answer = e.target.value;
                            setFAQs(updated);
                          }}
                          placeholder="Respuesta"
                          rows={2}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFAQ(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Configuración</CardTitle>
                <CardDescription>
                  Estado y metadatos del producto
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Publicado</p>
                    <p className="text-sm text-muted-foreground">
                      Los productos publicados son visibles en la tienda
                    </p>
                  </div>
                  <Switch
                    checked={isPublished}
                    onCheckedChange={setIsPublished}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rating">Rating (1-5)</Label>
                    <Input
                      id="rating"
                      type="number"
                      min="1"
                      max="5"
                      step="0.1"
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reviewCount">Número de Reviews</Label>
                    <Input
                      id="reviewCount"
                      type="number"
                      min="0"
                      value={reviewCount}
                      onChange={(e) => setReviewCount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ordersCount">Numero de pedidos</Label>
                    <Input
                      id="ordersCount"
                      type="number"
                      min="0"
                      value={ordersCount}
                      onChange={(e) => setOrdersCount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="SKU-12345"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="shippingCost">Coste de envio</Label>
                    <Input
                      id="shippingCost"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(e.target.value)}
                      placeholder="EUR0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deliveryTime">Tiempo de entrega</Label>
                    <Input
                      id="deliveryTime"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      placeholder="7-12 dias"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </AdminLayout>
  );
}




