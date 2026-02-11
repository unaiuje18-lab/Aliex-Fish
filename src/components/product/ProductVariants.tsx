import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ProductVariant } from '@/types/database';

interface ProductVariantsProps {
  variants: ProductVariant[];
  selectedId?: string | null;
  onSelect?: (variant: ProductVariant) => void;
}

export function ProductVariants({ variants, selectedId: selectedIdProp, onSelect }: ProductVariantsProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    variants.length > 0 ? variants[0].id : null
  );

  const selectedId = selectedIdProp !== undefined ? selectedIdProp : internalSelectedId;

  const handleSelect = (variant: ProductVariant) => {
    if (onSelect) {
      onSelect(variant);
    }
    if (selectedIdProp === undefined) {
      setInternalSelectedId(variant.id);
    }
  };

  if (variants.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm text-foreground">Variante</h3>
      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const isSelected = selectedId === variant.id;
          
          return (
            <button
              key={variant.id}
              onClick={() => handleSelect(variant)}
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

