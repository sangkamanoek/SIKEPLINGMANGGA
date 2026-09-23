/**
 * Client-Side Image Compression Utility
 * Compresses images using HTML5 Canvas to dramatically reduce Base64 string size
 * (e.g. from 5MB down to ~150KB - 300KB) before saving to Firestore.
 */

export function compressImageBase64(base64Str: string, maxWidth = 1024, maxHeight = 1024, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    // If it's not a valid base64 image or a tiny SVG, skip compression
    if (!base64Str || !base64Str.startsWith('data:image') || base64Str.includes('image/svg+xml')) {
      return resolve(base64Str);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = base64Str;

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Keep aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve(base64Str); // Fallback to original
      }

      // Draw and resize
      ctx.drawImage(img, 0, 0, width, height);

      // Export as jpeg with high-quality compression
      const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      
      // Only return compressed if it actually made it smaller, else keep original
      if (compressedBase64.length < base64Str.length) {
        resolve(compressedBase64);
      } else {
        resolve(base64Str);
      }
    };

    img.onerror = () => {
      resolve(base64Str); // Fallback on error
    };
  });
}

/**
 * Reads a File object and returns a compressed base64 string
 */
export function fileToCompressedBase64(file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const originalBase64 = reader.result as string;
        const compressed = await compressImageBase64(originalBase64, maxWidth, maxHeight, quality);
        resolve(compressed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
  });
}
