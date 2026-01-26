import { useParams, Link } from 'react-router-dom';
import { useProduct } from '@/hooks/useProducts';
import { HeroSection } from '@/components/landing/HeroSection';
import { BenefitsSection } from '@/components/landing/BenefitsSection';
import { VideoGallery } from '@/components/landing/VideoGallery';
import { ReviewsSection } from '@/components/landing/ReviewsSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { TrustSection } from '@/components/landing/TrustSection';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { StickyMobileCTA } from '@/components/landing/StickyMobileCTA';
import { Footer } from '@/components/landing/Footer';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Package } from 'lucide-react';

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, error } = useProduct(slug || '');

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-16">
          <Skeleton className="h-[400px] w-full rounded-xl mb-8" />
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <div className="grid gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
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
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al inicio
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <HeroSection
        title={product.title}
        subtitle={product.subtitle || ''}
        price={product.price}
        originalPrice={product.original_price || ''}
        discount={product.discount || ''}
        imageUrl={product.main_image_url || ''}
        videoUrl={product.video_url || ''}
        affiliateLink={product.affiliate_link}
        rating={product.rating}
        reviewCount={product.review_count}
      />

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
