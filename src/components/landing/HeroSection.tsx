import { Button } from "@/components/ui/button";
import { Play, ShoppingCart, Star, Truck, Shield, RotateCcw } from "lucide-react";

interface HeroSectionProps {
  title: string;
  subtitle?: string;
  price: string;
  originalPrice?: string;
  discount?: string;
  videoUrl?: string;
  imageUrl: string;
  affiliateLink: string;
  rating?: number;
  reviewCount?: number;
}

export const HeroSection = ({
  title,
  subtitle,
  price,
  originalPrice,
  discount,
  videoUrl,
  imageUrl,
  affiliateLink,
  rating = 4.8,
  reviewCount = 1247,
}: HeroSectionProps) => {
  const handleBuyClick = () => {
    window.open(affiliateLink, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="relative min-h-[90vh] gradient-hero overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10 py-8 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Media Section */}
          <div className="order-1 lg:order-1 animate-fade-in">
            <div className="relative rounded-2xl overflow-hidden shadow-card bg-card aspect-square lg:aspect-[4/3]">
              {videoUrl ? (
                <div className="relative w-full h-full">
                  <video
                    src={videoUrl}
                    poster={imageUrl}
                    controls
                    className="w-full h-full object-cover"
                    playsInline
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
                    <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                      <Play className="w-8 h-8 text-primary-foreground ml-1" />
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={imageUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              )}
              
              {/* Discount badge */}
              {discount && (
                <div className="absolute top-4 left-4 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-full text-sm font-bold shadow-lg">
                  -{discount}
                </div>
              )}
            </div>
          </div>

          {/* Content Section */}
          <div className="order-2 lg:order-2 space-y-6 animate-slide-up">
            {/* Rating */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${
                      i < Math.floor(rating)
                        ? "text-warning fill-warning"
                        : "text-muted-foreground"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-medium text-foreground">
                {rating}
              </span>
              <span className="text-sm text-muted-foreground">
                ({reviewCount.toLocaleString()} opiniones)
              </span>
            </div>

            {/* Title */}
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight text-balance">
              {title}
            </h1>

            {subtitle && (
              <p className="text-lg text-muted-foreground leading-relaxed">
                {subtitle}
              </p>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-4xl md:text-5xl font-display font-extrabold text-primary">
                {price}
              </span>
              {originalPrice && (
                <span className="text-xl text-muted-foreground line-through">
                  {originalPrice}
                </span>
              )}
              {discount && (
                <span className="text-sm font-bold text-success bg-success/10 px-2 py-1 rounded-full">
                  Ahorras {discount}
                </span>
              )}
            </div>

            {/* Trust badges inline */}
            <div className="flex flex-wrap gap-4 py-2">
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
            </div>

            {/* CTA Button */}
            <div className="pt-4">
              <Button
                variant="cta"
                size="xl"
                onClick={handleBuyClick}
                className="w-full sm:w-auto min-w-[280px] animate-pulse-soft"
              >
                <ShoppingCart className="w-5 h-5" />
                Comprar Ahora
              </Button>
              <p className="text-xs text-muted-foreground mt-3 text-center sm:text-left">
                🔒 Pago 100% seguro • Envío rápido
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
