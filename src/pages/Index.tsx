import { HeroSection } from "@/components/landing/HeroSection";
import { BenefitsSection } from "@/components/landing/BenefitsSection";
import { VideoGallery } from "@/components/landing/VideoGallery";
import { ReviewsSection } from "@/components/landing/ReviewsSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { TrustSection } from "@/components/landing/TrustSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { StickyMobileCTA } from "@/components/landing/StickyMobileCTA";
import { Footer } from "@/components/landing/Footer";
import productHero from "@/assets/product-hero.jpg";

// Demo product data - this would come from admin/database in production
const productData = {
  title: "Auriculares Inalámbricos Pro Max",
  subtitle: "Sonido premium con cancelación de ruido activa, batería de 40 horas y diseño ultraligero. La experiencia auditiva definitiva.",
  price: "€29.99",
  originalPrice: "€79.99",
  discount: "62%",
  imageUrl: productHero,
  videoUrl: "",
  affiliateLink: "https://aliexpress.com",
  rating: 4.8,
  reviewCount: 2847,
};

const Index = () => {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <HeroSection
        title={productData.title}
        subtitle={productData.subtitle}
        price={productData.price}
        originalPrice={productData.originalPrice}
        discount={productData.discount}
        imageUrl={productData.imageUrl}
        videoUrl={productData.videoUrl}
        affiliateLink={productData.affiliateLink}
        rating={productData.rating}
        reviewCount={productData.reviewCount}
      />

      {/* Benefits */}
      <BenefitsSection />

      {/* Video Gallery */}
      <VideoGallery />

      {/* Reviews */}
      <ReviewsSection />

      {/* FAQs */}
      <FAQSection />

      {/* Trust Section */}
      <TrustSection />

      {/* Final CTA */}
      <FinalCTA
        title={productData.title}
        price={productData.price}
        originalPrice={productData.originalPrice}
        affiliateLink={productData.affiliateLink}
      />

      {/* Footer */}
      <Footer />

      {/* Sticky Mobile CTA */}
      <StickyMobileCTA
        price={productData.price}
        affiliateLink={productData.affiliateLink}
      />
    </main>
  );
};

export default Index;
