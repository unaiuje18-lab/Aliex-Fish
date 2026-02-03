/**
 * Image compression utility
 * Compresses images before upload to reduce file size while maintaining quality
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1, where 1 is maximum quality
  format?: 'image/jpeg' | 'image/webp' | 'image/png';
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.85,
  format: 'image/webp', // WebP offers best compression with good quality
};

/**
 * Compresses an image file using canvas
 * @param file - The original image file
 * @param options - Compression options
 * @returns A promise that resolves to the compressed file
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Skip compression for very small files (< 100KB) or non-image files
  if (file.size < 100 * 1024 || !file.type.startsWith('image/')) {
    return file;
  }

  // Skip compression for GIFs (to preserve animation)
  if (file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      const maxWidth = opts.maxWidth!;
      const maxHeight = opts.maxHeight!;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Enable image smoothing for better quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw image on canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not compress image'));
            return;
          }

          // Determine file extension based on format
          const extension = opts.format === 'image/webp' ? 'webp' : 
                           opts.format === 'image/png' ? 'png' : 'jpg';
          
          // Create new filename
          const originalName = file.name.replace(/\.[^/.]+$/, '');
          const newFileName = `${originalName}.${extension}`;

          // Create new file
          const compressedFile = new File([blob], newFileName, {
            type: opts.format!,
            lastModified: Date.now(),
          });

          // Only use compressed version if it's actually smaller
          if (compressedFile.size < file.size) {
            console.log(
              `Image compressed: ${formatFileSize(file.size)} → ${formatFileSize(compressedFile.size)} (${Math.round((1 - compressedFile.size / file.size) * 100)}% reduction)`
            );
            resolve(compressedFile);
          } else {
            console.log('Compressed file is larger, using original');
            resolve(file);
          }
        },
        opts.format,
        opts.quality
      );
    };

    img.onerror = () => {
      reject(new Error('Could not load image'));
    };

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Could not read file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Get compression info for display
 */
export function getCompressionStats(originalSize: number, compressedSize: number): {
  originalSize: string;
  compressedSize: string;
  reduction: number;
} {
  return {
    originalSize: formatFileSize(originalSize),
    compressedSize: formatFileSize(compressedSize),
    reduction: Math.round((1 - compressedSize / originalSize) * 100),
  };
}
