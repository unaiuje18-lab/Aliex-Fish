import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ProductVariant } from '@/types/database';

interface ProductVariantsProps {
  variants: ProductVariant[];
}

export function ProductVariants({ variants }: ProductVariantsProps) {
  const [selectedVariant, setSelectedVariant] = useState<string | null>(
    variants.length > 0 ? variants[0].id : null
  );

  if (variants.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm text-foreground">Variante</h3>
      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const isSelected = selectedVariant === variant.id;
          
          return (
            <button
              key={variant.id}
              onClick={() => setSelectedVariant(variant.id)}
              className={cn(
                "px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                isSelected 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-border hover:border-primary/50"
              )}
            >
              {variant.variant_label}
              {variant.price_modifier && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({variant.price_modifier})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
