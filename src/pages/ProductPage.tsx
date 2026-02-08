import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProduct } from '@/hooks/useProducts';
import { ProductImageGallery } from '@/components/product/ProductImageGallery';
import { ProductVariantImages } from '@/components/product/ProductVariantImages';
import { ProductOptions } from '@/components/product/ProductOptions';
import { ProductVariants } from '@/components/product/ProductVariants';
import { BenefitsSection } from '@/components/landing/BenefitsSection';
import { VideoGallery } from '@/components/landing/VideoGallery';
import { ReviewsSection } from '@/components/landing/ReviewsSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { TrustSection } from '@/components/landing/TrustSection';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { StickyMobileCTA } from '@/components/landing/StickyMobileCTA';
import { Footer } from '@/components/landing/Footer';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, Package, ShoppingCart, Star, Truck, Shield, RotateCcw } from 'lucide-react';

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading, error } = useProduct(slug || '');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedImageTitle, setSelectedImageTitle] = useState<string | null>(null);
  const [selectedImagePrice, setSelectedImagePrice] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    supabase.from('analytics_events').insert({
      event_type: 'product_view',
      path: `/producto/${product.slug}`,
      product_id: product.id,
    });
  }, [product]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container max-w-6xl mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-12 w-1/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Producto no encontrado</h1>
          <p className="text-muted-foreground mb-6">
            El producto que buscas no existe o no está disponible.
          </p>
          <Button asChild>
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Volver al inicio
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  const handleBuyClick = () => {
    supabase.from('analytics_events').insert({
      event_type: 'affiliate_click',
      path: `/producto/${product.slug}`,
      product_id: product.id,
    });
    window.open(product.affiliate_link, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Navigation buttons */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="gap-2"
            >
              <Link to="/">
                <Home className="h-4 w-4" />
                Inicio
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Product Section - AliExpress Style */}
      <section className="py-8">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Left - Image Gallery */}
            <div>
              <ProductImageGallery
                images={product.images || []}
                mainImage={product.main_image_url || undefined}
                productTitle={product.title}
                selectedImageId={selectedImageId}
                onImageSelect={(img) => {
                  setSelectedImageId(img?.id || null);
                  setSelectedImageTitle(img?.title || null);
                  setSelectedImagePrice(img?.price || null);
                }}
              />
            </div>

            {/* Right - Product Info */}
            <div className="space-y-6">
              {/* Rating */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.floor(product.rating || 4.5)
                          ? "text-warning fill-warning"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium">{product.rating || 4.5}</span>
                <span className="text-sm text-muted-foreground">
                  ({(product.review_count || 0).toLocaleString()} opiniones)
                </span>
              </div>

              {/* Title */}
              <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight">
                {product.title}
              </h1>

              {product.subtitle && (
                <p className="text-muted-foreground">{product.subtitle}</p>
              )}

              {/* Price */}
              <div className="bg-muted/50 p-4 rounded-xl space-y-2">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl md:text-4xl font-bold text-foreground">
                    {selectedImagePrice || product.price}
                  </span>
                  {!selectedImagePrice && product.original_price && (
                    <span className="text-lg text-muted-foreground line-through">
                      {product.original_price}
                    </span>
                  )}
                  {!selectedImagePrice && product.discount && (
                    <span className="text-sm font-medium text-success bg-success/10 px-2 py-1 rounded">
                      Ahorra {product.discount}
                    </span>
                  )}
                </div>
                {/* Selected image title */}
                {selectedImageTitle && (
                  <p className="text-sm font-medium text-foreground border-t border-border pt-2">
                    {selectedImageTitle}
                  </p>
                )}
              </div>

              {/* CTA Button - Under Price */}
              <div className="space-y-3 rounded-xl border bg-background/95 p-4 shadow-sm">
                <Button
                  variant="cta"
                  size="xl"
                  onClick={handleBuyClick}
                  className="w-full h-12 text-base shadow-lg"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Comprar en AliExpress
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Pago 100% seguro - Envio rapido
                </p>
              </div>
              {/* Image Variants Grid (if images have titles) */}
              {product.images && product.images.some(img => img.title) && (
                <ProductVariantImages
                  images={product.images}
                  selectedId={selectedImageId || product.images[0]?.id}
                  onSelect={(img) => {
                    setSelectedImageId(img.id);
                    setSelectedImageTitle(img.title || null);
                    setSelectedImagePrice(img.price || null);
                  }}
                />
              )}

              {/* Options */}
              {product.options && product.options.length > 0 && (
                <ProductOptions options={product.options} />
              )}

              {/* Variants */}
              {product.variants && product.variants.length > 0 && (
                <ProductVariants variants={product.variants} />
              )}

              {/* Trust badges */}
              <div className="flex flex-wrap gap-4 py-2 border-y">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Truck className="w-4 h-4 text-success" />
                  <span>Envío a todo el mundo</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4 text-trust" />
                  <span>Compra segura</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RotateCcw className="w-4 h-4 text-primary" />
                  <span>Garantía incluida</span>
                </div>
              </div></div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      {product.benefits && product.benefits.length > 0 && (
        <BenefitsSection benefits={product.benefits.map(b => ({
          icon: b.icon,
          title: b.title,
          description: b.description,
        }))} />
      )}

      {/* Video Gallery */}
      {product.videos && product.videos.length > 0 && (
        <VideoGallery videos={product.videos.map(v => ({
          id: v.id,
          thumbnail_url: v.thumbnail_url,
          video_url: v.video_url,
          title: v.title,
        }))} />
      )}

      {/* Reviews */}
      {product.reviews && product.reviews.length > 0 && (
        <ReviewsSection reviews={product.reviews.map(r => ({
          id: r.id,
          name: r.name,
          rating: r.rating,
          comment: r.comment,
          date_label: r.date_label,
          is_verified: r.is_verified,
          avatar_url: r.avatar_url,
        }))} />
      )}

      {/* FAQs */}
      {product.faqs && product.faqs.length > 0 && (
        <FAQSection faqs={product.faqs} />
      )}

      {/* Trust Section */}
      <TrustSection />

      {/* Final CTA */}
      <FinalCTA
        title={product.title}
        price={product.price}
        originalPrice={product.original_price || ''}
        affiliateLink={product.affiliate_link}
      />

      {/* Footer */}
      <Footer />

      {/* Sticky Mobile CTA */}
      <StickyMobileCTA
        price={product.price}
        affiliateLink={product.affiliate_link}
      />
    </main>
  );
}





