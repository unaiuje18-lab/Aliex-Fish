import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
}

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Archivo muy grande',
        description: 'El tamaño máximo es 5MB.',
      });
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      onChange(publicUrl);

      toast({
        title: 'Imagen subida',
        description: 'La imagen se ha subido correctamente.',
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Error al subir',
        description: error.message || 'No se pudo subir la imagen.',
      });
    } finally {
      setIsUploading(false);
    }
  }, [onChange, toast]);

  const handleRemove = () => {
    onChange('');
  };

  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative w-full max-w-xs">
          <img
            src={value}
            alt="Preview"
            className="w-full aspect-square object-cover rounded-lg border"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-8 w-8"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-8 text-center max-w-xs">
          <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            Arrastra una imagen o haz clic para seleccionar
          </p>
          <label className="cursor-pointer">
            <Button
              type="button"
              variant="outline"
              disabled={isUploading}
              className="pointer-events-none"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Seleccionar imagen
                </>
              )}
            </Button>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />
          </label>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        O pega una URL de imagen:
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
        className="max-w-md"
      />
    </div>
  );
}
