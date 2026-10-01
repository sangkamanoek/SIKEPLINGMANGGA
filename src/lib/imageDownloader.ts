import JSZip from 'jszip';

/**
 * Utility to optimize URL for highest resolution download
 */
export function getHighResImageUrl(url: string): string {
  if (!url) return '';
  if (url.includes('images.unsplash.com')) {
    // Replace width/quality params with max quality
    try {
      const u = new URL(url);
      u.searchParams.set('w', '2400');
      u.searchParams.set('q', '95');
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fit', 'max');
      return u.toString();
    } catch {
      return url.replace(/w=\d+/, 'w=2400').replace(/q=\d+/, 'q=95');
    }
  }
  return url;
}

/**
 * Utility to download single image cleanly in browser in high resolution
 */
export async function downloadImage(
  urlOrBase64: string,
  fileName: string = 'foto_dokumentasi_hd.jpg'
): Promise<boolean> {
  try {
    if (!urlOrBase64) return false;

    const finalFileName = fileName.endsWith('.jpg') || fileName.endsWith('.png') || fileName.endsWith('.jpeg')
      ? fileName
      : `${fileName}.jpg`;

    // If it's a data URL or blob URL
    if (urlOrBase64.startsWith('data:') || urlOrBase64.startsWith('blob:')) {
      const link = document.createElement('a');
      link.href = urlOrBase64;
      link.download = finalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }

    const highResUrl = getHighResImageUrl(urlOrBase64);

    // Try fetch blob
    try {
      const response = await fetch(highResUrl, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = finalFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
        return true;
      }
    } catch {
      // CORS or network error, fallback to image-to-canvas rendering
    }

    // Fallback: load image object and draw to high-res canvas
    const loadedBlob = await new Promise<Blob | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = highResUrl;
    });

    if (loadedBlob) {
      const objectUrl = URL.createObjectURL(loadedBlob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = finalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
      return true;
    }

    // Direct anchor fallback
    const link = document.createElement('a');
    link.href = highResUrl;
    link.target = '_blank';
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error('Download image failed:', error);
    return false;
  }
}

/**
 * Batch download multiple images with small interval
 */
export async function downloadMultipleImages(
  items: { url: string; fileName: string }[],
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  let successCount = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.url) {
      const ok = await downloadImage(item.url, item.fileName);
      if (ok) successCount++;
      if (onProgress) onProgress(i + 1, items.length);
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  return successCount;
}

/**
 * Fetch image as arraybuffer or blob for ZIP packing
 */
async function fetchImageBlob(url: string): Promise<Blob | null> {
  try {
    const highRes = getHighResImageUrl(url);
    if (highRes.startsWith('data:')) {
      const res = await fetch(highRes);
      return await res.blob();
    }
    const res = await fetch(highRes, { mode: 'cors' });
    if (res.ok) {
      return await res.blob();
    }
  } catch {
    // fallback
  }

  return new Promise<Blob | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1200;
        canvas.height = img.naturalHeight || 800;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = getHighResImageUrl(url);
  });
}

/**
 * Download a structured ZIP file containing all photos organized by project and stage (Sebelum 0%, Proses 50%, Sesudah 100%)
 */
export async function downloadProjectPhotosAsZip(
  projects: Array<{
    id: string;
    lingkunganNomor: number;
    namaProyek: string;
    fotoSebelumList?: string[];
    fotoSebelumUrl?: string;
    fotoProsesList?: string[];
    fotoProsesUrl?: string;
    fotoSesudahList?: string[];
    fotoSesudahUrl?: string;
  }>,
  zipFileName: string = 'Dokumentasi_Infrastruktur_HD.zip',
  onProgress?: (statusText: string) => void
): Promise<boolean> {
  try {
    const zip = new JSZip();

    for (let pIdx = 0; pIdx < projects.length; pIdx++) {
      const p = projects[pIdx];
      const safeProjectName = `Lk_${p.lingkunganNomor}_${p.namaProyek.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`;
      const folder = zip.folder(safeProjectName);
      if (!folder) continue;

      if (onProgress) {
        onProgress(`Menyiapkan foto proyek ${pIdx + 1}/${projects.length}: ${p.namaProyek}`);
      }

      // 1. Tahap Sebelum (0%)
      const sebelumPhotos = Array.from(new Set([
        ...(p.fotoSebelumList || []),
        ...(p.fotoSebelumUrl ? [p.fotoSebelumUrl] : [])
      ])).filter(Boolean);

      for (let sIdx = 0; sIdx < sebelumPhotos.length; sIdx++) {
        const url = sebelumPhotos[sIdx];
        const blob = await fetchImageBlob(url);
        if (blob) {
          folder.file(`01_Sebelum_0persen_Foto_${sIdx + 1}.jpg`, blob);
        }
      }

      // 2. Tahap Proses (50%)
      const prosesPhotos = Array.from(new Set([
        ...(p.fotoProsesList || []),
        ...(p.fotoProsesUrl ? [p.fotoProsesUrl] : [])
      ])).filter(Boolean);

      for (let prIdx = 0; prIdx < prosesPhotos.length; prIdx++) {
        const url = prosesPhotos[prIdx];
        const blob = await fetchImageBlob(url);
        if (blob) {
          folder.file(`02_Proses_50persen_Foto_${prIdx + 1}.jpg`, blob);
        }
      }

      // 3. Tahap Sesudah (100%)
      const sesudahPhotos = Array.from(new Set([
        ...(p.fotoSesudahList || []),
        ...(p.fotoSesudahUrl ? [p.fotoSesudahUrl] : [])
      ])).filter(Boolean);

      for (let aIdx = 0; aIdx < sesudahPhotos.length; aIdx++) {
        const url = sesudahPhotos[aIdx];
        const blob = await fetchImageBlob(url);
        if (blob) {
          folder.file(`03_Selesai_100persen_Foto_${aIdx + 1}.jpg`, blob);
        }
      }
    }

    if (onProgress) {
      onProgress('Membuat berkas ZIP kualitas tinggi...');
    }

    const zipContent = await zip.generateAsync({ type: 'blob' });
    const objectUrl = URL.createObjectURL(zipContent);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = zipFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);

    return true;
  } catch (error) {
    console.error('Error generating ZIP:', error);
    return false;
  }
}
