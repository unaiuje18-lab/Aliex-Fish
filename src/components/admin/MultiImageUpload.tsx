import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, X, Loader2, Image as ImageIcon, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { compressImage } from '@/lib/imageCompression';
import { normalizeImageUrl } from '@/lib/imageUrl';

interface ImageWithTitle {
  url: string;
  title: string;
  price: string;
}

interface MultiImageUploadProps {
  images: ImageWithTitle[];
  onChange: (images: ImageWithTitle[]) => void;
  maxImages?: number;
}

export function MultiImageUpload({ images, onChange, maxImages = 99 }: MultiImageUploadProps) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [urlInputValue, setUrlInputValue] = useState('');
  const { toast } = useToast();

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Archivo inválido',
        description: 'Por favor selecciona una imagen.',
      });
      return;
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Archivo muy grande',
        description: 'El tamaño máximo es 10MB.',
      });
      return;
    }

    const targetIndex = index ?? images.length;
    setUploadingIndex(targetIndex);

    try {
      // Compress image before upload
      const compressedFile = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85,
        format: 'image/webp',
      });

      const originalSize = file.size;
      const compressedSize = compressedFile.size;
      const wasCompressed = compressedSize < originalSize;

      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, compressedFile, {
          contentType: compressedFile.type,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      const newImages = [...images];
      if (index !== undefined) {
        newImages[index] = { ...newImages[index], url: publicUrl };
      } else {
        newImages.push({ url: publicUrl, title: '', price: '' });
      }
      onChange(newImages);

      // Show compression stats in toast
      if (wasCompressed) {
        const reduction = Math.round((1 - compressedSize / originalSize) * 100);
        toast({
          title: 'Imagen optimizada',
          description: `${(originalSize / 1024).toFixed(0)}KB → ${(compressedSize / 1024).toFixed(0)}KB (-${reduction}%)`,
        });
      } else {
        toast({
          title: 'Imagen subida',
          description: 'La imagen se ha subido correctamente.',
        });
      }
    } catch (error: unknown) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'No se pudo subir la imagen.';
      toast({
        variant: 'destructive',
        title: 'Error al subir',
        description: errorMessage,
      });
    } finally {
      setUploadingIndex(null);
    }
  }, [images, onChange, toast]);

  const handleRemove = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };

  const handleTitleChange = (index: number, title: string) => {
    const newImages = [...images];
    newImages[index] = { ...newImages[index], title };
    onChange(newImages);
  };

  const handlePriceChange = (index: number, price: string) => {
    const newImages = [...images];
    newImages[index] = { ...newImages[index], price };
    onChange(newImages);
  };

  const handleAddUrl = () => {
    if (urlInputValue.trim() && images.length < maxImages) {
      const normalizedUrl = normalizeImageUrl(urlInputValue.trim());
      onChange([...images, { url: normalizedUrl, title: '', price: '' }]);
      setUrlInputValue('');
    }
  };

  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-4">
      {/* Current images grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((image, index) => (
          <div key={index} className="relative group space-y-2">
            <div className="relative">
              <img
                src={normalizeImageUrl(image.url)}
                alt={image.title || `Imagen ${index + 1}`}
                className="w-full aspect-square object-cover rounded-lg border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemove(index)}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {index === 0 ? 'Principal' : `Imagen ${index + 1}`}
              </div>
            </div>
            <Input
              value={image.title}
              onChange={(e) => handleTitleChange(index, e.target.value)}
              placeholder="Título (ej: Coche Rojo)"
              className="text-sm"
            />
            <Input
              value={image.price}
              onChange={(e) => handlePriceChange(index, e.target.value)}
              placeholder="Precio (ej: 49,99€)"
              className="text-sm"
            />
          </div>
        ))}

        {/* Add new image slot */}
        {canAddMore && (
          <div className="border-2 border-dashed rounded-lg aspect-square flex flex-col items-center justify-center p-4 text-center">
            {uploadingIndex === images.length ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground mb-2">
                  {images.length === 0 ? 'Imagen principal' : `Imagen ${images.length + 1}`}
                </p>
                <label className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="pointer-events-none"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Subir
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e)}
                    className="hidden"
                  />
                </label>
              </>
            )}
          </div>
        )}
      </div>

      {/* URL input */}
      {canAddMore && (
        <div className="flex gap-2">
          <Input
            value={urlInputValue}
            onChange={(e) => setUrlInputValue(e.target.value)}
            placeholder="O pega una URL de imagen..."
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddUrl();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAddUrl}
            disabled={!urlInputValue.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Imagen + Título + Precio. El precio de cada imagen se mostrará automáticamente al seleccionarla.
      </p>
    </div>
  );
}
