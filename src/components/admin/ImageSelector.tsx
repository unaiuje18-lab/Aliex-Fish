import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, X, ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageSelectorProps {
  images: string[];
  onConfirm: (selectedImages: string[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ImageSelector({ images, onConfirm, onCancel, isLoading }: ImageSelectorProps) {
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set(images));
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const toggleImage = (url: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedImages(newSelected);
  };

  const selectAll = () => {
    const validImages = images.filter(img => !failedImages.has(img));
    setSelectedImages(new Set(validImages));
  };

  const selectNone = () => {
    setSelectedImages(new Set());
  };

  const handleImageError = (url: string) => {
    setFailedImages(prev => new Set([...prev, url]));
    // Also remove from selected if it fails
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(url);
      return newSet;
    });
  };

  const validImages = images.filter(img => !failedImages.has(img));
  const selectedCount = Array.from(selectedImages).filter(img => !failedImages.has(img)).length;

  if (images.length === 0) {
    return (
      <div className="text-center py-8">
        <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No se encontraron imágenes</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with selection controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedCount} de {validImages.length} imágenes seleccionadas
          {failedImages.size > 0 && (
            <span className="text-destructive ml-2">
              ({failedImages.size} no disponibles)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Todas
          </Button>
          <Button variant="outline" size="sm" onClick={selectNone}>
            Ninguna
          </Button>
        </div>
      </div>

      {/* Image grid */}
      <ScrollArea className="h-[400px] rounded-md border p-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {images.map((url, index) => {
            const isSelected = selectedImages.has(url);
            const isFailed = failedImages.has(url);
            
            if (isFailed) return null; // Don't show failed images
            
            return (
              <button
                key={`${url}-${index}`}
                onClick={() => toggleImage(url)}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105",
                  isSelected 
                    ? "border-primary ring-2 ring-primary/20" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <img
                  src={url}
                  alt={`Imagen ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => handleImageError(url)}
                />
                
                {/* Selection indicator */}
                <div className={cn(
                  "absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all",
                  isSelected 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-background/80 text-muted-foreground"
                )}>
                  {isSelected ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span className="text-xs">{index + 1}</span>
                  )}
                </div>
                
                {/* First image badge */}
                {index === 0 && isSelected && (
                  <div className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">
                    Principal
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <Button 
          onClick={() => onConfirm(Array.from(selectedImages).filter(img => !failedImages.has(img)))}
          disabled={selectedCount === 0 || isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Usar {selectedCount} {selectedCount === 1 ? 'imagen' : 'imágenes'}
        </Button>
      </div>
    </div>
  );
}
