import { cn } from '@/lib/utils';
import { normalizeImageUrl } from '@/lib/imageUrl';

interface ProductImage {
  id: string;
  image_url: string;
  title?: string | null;
  price?: string | null;
}

interface ProductVariantImagesProps {
  images: ProductImage[];
  selectedId?: string;
  onSelect: (image: ProductImage) => void;
}

export function ProductVariantImages({ 
  images, 
  selectedId, 
  onSelect 
}: ProductVariantImagesProps) {
  // Only show images that have titles
  const titledImages = images.filter(img => img.title);

  if (titledImages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        Color: <span className="font-normal">{titledImages.find(img => img.id === selectedId)?.title || titledImages[0]?.title}</span>
      </h3>
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-1.5">
        {titledImages.map((image) => (
          <button
            key={image.id}
            onClick={() => onSelect(image)}
            className={cn(
              "relative rounded-md overflow-hidden border-2 transition-all hover:border-primary/50",
              image.id === selectedId 
                ? "border-primary ring-2 ring-primary/20" 
                : "border-border"
            )}
          >
            <div className="aspect-square bg-muted">
              <img
                src={normalizeImageUrl(image.image_url)}
                alt={image.title || 'Variante'}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
            {image.title && (
              <span className="absolute bottom-0 left-0 right-0 text-[8px] leading-tight bg-background/90 px-1 py-0.5 truncate text-center">
                {image.title}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
