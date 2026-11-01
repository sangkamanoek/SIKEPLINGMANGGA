/**
 * High-Performance Image Compression Utility for SI-MANGGA
 * Optimized specifically for low-end mobile devices (Android GO, older RAM-constrained phones, laptops).
 * Resizes 4K/12MP photos (5MB - 15MB) down to 720px / ~35KB - 60KB.
 * Processes sequentially to avoid allocating hundreds of MBs in memory at once.
 * Releases canvas and bitmap memory immediately after compression.
 */

export interface CompressedPhotoResult {
  id: string;
  url: string;
  name: string;
  timestamp: string;
  kategori?: string;
}

/**
 * Compress a single File into a lightweight Base64 data URL with automatic GPU memory cleanup
 * @param file The image File from input or camera
 * @param maxDim Maximum width or height (default: 720px for perfect document readability)
 * @param quality JPEG compression quality (default: 0.45 for ~40KB file size)
 */
export function compressImageFile(
  file: File,
  maxDim = 720,
  quality = 0.48
): Promise<string> {
  return new Promise((resolve) => {
    if (!file) {
      resolve('');
      return;
    }

    const isImage =
      (file.type && file.type.startsWith('image/')) ||
      /\.(jpe?g|png|webp|bmp|gif|heic)$/i.test(file.name || '');

    if (!isImage) {
      resolve('');
      return;
    }

    // Modern browsers & Android WebViews: check createImageBitmap for background thread decoding
    if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
      createImageBitmap(file)
        .then((bitmap) => {
          let width = bitmap.width;
          let height = bitmap.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { alpha: false });

          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bitmap, 0, 0, width, height);

            const compressed = canvas.toDataURL('image/jpeg', quality);

            // Clean up resources immediately to free GPU memory
            canvas.width = 0;
            canvas.height = 0;
            if (typeof bitmap.close === 'function') {
              bitmap.close();
            }

            resolve(compressed);
          } else {
            if (typeof bitmap.close === 'function') bitmap.close();
            fallbackFileReader(file, maxDim, quality).then(resolve);
          }
        })
        .catch(() => {
          fallbackFileReader(file, maxDim, quality).then(resolve);
        });
      return;
    }

    fallbackFileReader(file, maxDim, quality).then(resolve);
  });
}

function fallbackFileReader(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const srcUrl = event.target?.result as string;
      if (!srcUrl) {
        resolve('');
        return;
      }

      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { alpha: false });

          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            const compressed = canvas.toDataURL('image/jpeg', quality);

            // Explicitly release canvas & image bitmap to free RAM on older phones
            canvas.width = 0;
            canvas.height = 0;
            img.src = '';

            resolve(compressed);
          } else {
            img.src = '';
            resolve(srcUrl);
          }
        } catch (canvasErr) {
          console.warn('[ImageCompressor] Canvas export fallback:', canvasErr);
          img.src = '';
          resolve(srcUrl);
        }
      };

      img.onerror = () => {
        img.src = '';
        resolve(srcUrl);
      };

      img.src = srcUrl;
    };

    reader.onerror = () => {
      resolve('');
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Sequential compression for multiple files:
 * Processes one image at a time to prevent allocating massive memory concurrently on older phones.
 */
export async function compressMultipleFiles(
  files: FileList | File[],
  maxDim = 720,
  quality = 0.48,
  kategori?: string,
  onProgress?: (current: number, total: number) => void
): Promise<CompressedPhotoResult[]> {
  const fileArray = Array.from(files);
  if (fileArray.length === 0) return [];

  const results: CompressedPhotoResult[] = [];

  for (let idx = 0; idx < fileArray.length; idx++) {
    const file = fileArray[idx];
    if (onProgress) {
      onProgress(idx + 1, fileArray.length);
    }

    try {
      const compressedUrl = await compressImageFile(file, maxDim, quality);
      if (compressedUrl) {
        results.push({
          id: 'foto_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) + '_' + idx,
          url: compressedUrl,
          name: file.name || `Foto ${idx + 1}`,
          timestamp: new Date().toISOString(),
          kategori: kategori || 'umum',
        });
      }
    } catch (err) {
      console.warn(`[ImageCompressor] Error compressing file ${file.name}:`, err);
    }
  }

  return results;
}
