import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { useMemo } from "react";

interface StickyMobileCTAProps {
  price: string;
  affiliateLink: string;
}

export const StickyMobileCTA = ({ price, affiliateLink }: StickyMobileCTAProps) => {
  const displayPrice = useMemo(() => {
    return (price || "").replace(/^Desde\s*/i, "");
  }, [price]);

  const handleBuyClick = () => {
    window.open(affiliateLink, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      <div className="bg-card/95 backdrop-blur-lg border-t border-border shadow-xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Precio especial</p>
            <p className="text-xl font-display font-bold text-primary">{displayPrice}</p>
          </div>
          <Button
            variant="cta"
            size="lg"
            onClick={handleBuyClick}
            className="flex-1 max-w-[200px]"
          >
            <ShoppingCart className="w-5 h-5" />
            Comprar
          </Button>
        </div>
      </div>
    </div>
  );
};
