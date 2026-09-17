/**
 * Utility to download single or multiple images cleanly in browser
 */

export async function downloadImage(
  urlOrBase64: string,
  fileName: string = 'foto_dokumentasi.jpg'
): Promise<boolean> {
  try {
    if (!urlOrBase64) return false;

    // If it's a data URL or blob URL
    if (urlOrBase64.startsWith('data:') || urlOrBase64.startsWith('blob:')) {
      const link = document.createElement('a');
      link.href = urlOrBase64;
      link.download = fileName.endsWith('.jpg') || fileName.endsWith('.png') ? fileName : `${fileName}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }

    // If it's an external or server HTTP URL
    const response = await fetch(urlOrBase64, { mode: 'cors' });
    if (!response.ok) throw new Error('Network response was not ok');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName.endsWith('.jpg') || fileName.endsWith('.png') ? fileName : `${fileName}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return true;
  } catch (error) {
    console.warn('Direct blob download failed, trying standard anchor fallback:', error);
    try {
      const link = document.createElement('a');
      link.href = urlOrBase64;
      link.target = '_blank';
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    } catch (e) {
      console.error('All image download strategies failed:', e);
      return false;
    }
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
      // Wait 350ms between downloads to avoid browser blocking multiple popups
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  return successCount;
}
