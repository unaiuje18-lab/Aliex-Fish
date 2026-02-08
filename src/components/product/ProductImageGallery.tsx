import { useState, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeImageUrl } from '@/lib/imageUrl';

interface ProductImage {
  id: string;
  image_url: string;
  title?: string | null;
  price?: string | null;
}

interface ProductImageGalleryProps {
  images: ProductImage[];
  mainImage?: string;
  productTitle: string;
  selectedImageId?: string | null;
  onImageSelect?: (image: ProductImage | null) => void;
}

export function ProductImageGallery({ 
  images, 
  mainImage, 
  productTitle,
  selectedImageId,
  onImageSelect 
}: ProductImageGalleryProps) {
  // Use images directly - no need to add main image separately as it should be part of images array
  const allImages: ProductImage[] = images.length > 0 
    ? images 
    : mainImage 
      ? [{ id: 'main', image_url: mainImage, title: null, price: null }]
      : [];
  
  // Find the index of the selected image by ID, or default to 0
  const selectedByIdIndex = selectedImageId 
    ? allImages.findIndex(img => img.id === selectedImageId)
    : -1;
  
  const [internalSelectedIndex, setInternalSelectedIndex] = useState(0);
  const selectedIndex = selectedByIdIndex >= 0 ? selectedByIdIndex : internalSelectedIndex;
  const selectedImage = allImages[selectedIndex];
  const [thumbScrollPos, setThumbScrollPos] = useState(0);
  const visibleThumbs = 5;

  const handleSelect = (index: number) => {
    setInternalSelectedIndex(index);
    onImageSelect?.(allImages[index] || null);
  };

  const handleScrollUp = () => {
    setThumbScrollPos(prev => Math.max(0, prev - 1));
  };

  const handleScrollDown = () => {
    setThumbScrollPos(prev => Math.min(allImages.length - visibleThumbs, prev + 1));
  };

  if (allImages.length === 0) {
    return (
      <div className="aspect-square bg-muted rounded-xl flex items-center justify-center">
        <span className="text-muted-foreground">Sin imágenes</span>
      </div>
    );
  }

  const showScrollButtons = allImages.length > visibleThumbs;
  const visibleImages = allImages.slice(thumbScrollPos, thumbScrollPos + visibleThumbs);

  return (
    <div className="flex gap-3 md:gap-4">
      {/* Thumbnails - Vertical on left */}
      {allImages.length > 1 && (
        <div className="flex flex-col items-center gap-2 w-[60px] md:w-[72px] flex-shrink-0">
          {/* Scroll up button */}
          {showScrollButtons && (
            <button
              onClick={handleScrollUp}
              disabled={thumbScrollPos === 0}
              className={cn(
                "w-full h-6 rounded-md flex items-center justify-center transition-all",
                thumbScrollPos === 0 
                  ? "text-muted-foreground/30 cursor-not-allowed" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              aria-label="Ver imágenes anteriores"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          )}

          {/* Thumbnail list */}
          <div className="flex flex-col gap-2">
            {visibleImages.map((image, visibleIndex) => {
              const actualIndex = thumbScrollPos + visibleIndex;
              return (
                <button
                  key={image.id}
                  onClick={() => handleSelect(actualIndex)}
                  className={cn(
                    "flex-shrink-0 w-[60px] md:w-[72px] rounded-lg overflow-hidden border-2 transition-all flex flex-col",
                    actualIndex === selectedIndex 
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="aspect-square bg-muted">
                    <img
                      src={normalizeImageUrl(image.image_url)}
                      alt={image.title || `${productTitle} - ${actualIndex + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Scroll down button */}
          {showScrollButtons && (
            <button
              onClick={handleScrollDown}
              disabled={thumbScrollPos >= allImages.length - visibleThumbs}
              className={cn(
                "w-full h-6 rounded-md flex items-center justify-center transition-all",
                thumbScrollPos >= allImages.length - visibleThumbs 
                  ? "text-muted-foreground/30 cursor-not-allowed" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              aria-label="Ver más imágenes"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}

          {/* Image counter */}
          <span className="text-xs text-muted-foreground">
            {selectedIndex + 1} / {allImages.length}
          </span>
        </div>
      )}

      {/* Main Image */}
      <div className="flex-1 flex flex-col gap-2">
        <div className="relative aspect-square rounded-xl overflow-hidden bg-muted/50">
          <img
            src={normalizeImageUrl(selectedImage?.image_url || '')}
            alt={selectedImage?.title || productTitle}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="w-full h-full object-contain"
            style={{ imageRendering: 'auto' }}
          />
        </div>

        {/* Title below main image if selected image has one */}
        {selectedImage?.title && (
          <p className="text-sm md:text-base font-medium text-foreground text-center bg-muted/50 rounded-lg py-2 px-3">
            {selectedImage.title}
          </p>
        )}
      </div>
    </div>
  );
}
