import { Button } from "@/components/ui/button";
import { ShoppingCart, Timer, Package } from "lucide-react";

interface FinalCTAProps {
  title: string;
  price: string;
  originalPrice?: string;
  affiliateLink: string;
  urgencyText?: string;
  stockText?: string;
}

export const FinalCTA = ({
  title,
  price,
  originalPrice,
  affiliateLink,
  urgencyText = "¡Oferta por tiempo limitado!",
  stockText = "Solo quedan 23 unidades",
}: FinalCTAProps) => {
  const handleBuyClick = () => {
    window.open(affiliateLink, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="py-16 lg:py-24 gradient-primary relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-primary-foreground/5 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10 text-center">
        <div className="max-w-2xl mx-auto">
          {/* Urgency */}
          <div className="inline-flex items-center gap-2 bg-primary-foreground/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
            <Timer className="w-4 h-4 text-primary-foreground" />
            <span className="text-sm font-medium text-primary-foreground">
              {urgencyText}
            </span>
          </div>

          {/* Title */}
          <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-primary-foreground mb-4">
            ¿Listo para conseguir tu {title}?
          </h2>

          {/* Price */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className="text-4xl md:text-5xl font-display font-extrabold text-primary-foreground">
              {price}
            </span>
            {originalPrice && (
              <span className="text-xl text-primary-foreground/60 line-through">
                {originalPrice}
              </span>
            )}
          </div>

          {/* Stock indicator */}
          <div className="flex items-center justify-center gap-2 mb-8 text-primary-foreground/80">
            <Package className="w-4 h-4" />
            <span className="text-sm font-medium">{stockText}</span>
          </div>

          {/* CTA Button */}
          <Button
            variant="ctaLarge"
            size="xl"
            onClick={handleBuyClick}
            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-xl min-w-[300px]"
          >
            <ShoppingCart className="w-6 h-6" />
            ¡Comprar Ahora!
          </Button>

          <p className="text-primary-foreground/70 text-sm mt-4">
            🔒 Pago 100% seguro • Envío a todo el mundo • Garantía de 30 días
          </p>
        </div>
      </div>
    </section>
  );
};
