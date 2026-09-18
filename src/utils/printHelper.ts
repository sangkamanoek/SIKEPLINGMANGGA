/**
 * printHelper.ts
 * Utility sentral untuk pencetakan dokumen resmi kedinasan.
 * Menjamin 100% isolasi cetak: elemen background aplikasi, navbar, modal overlay,
 * dan dashboard utama TIDAK PERNAH ikut tercetak.
 */

export const printOfficialDocument = (
  elementId: string,
  documentTitle: string = 'Dokumen_Resmi_Kelurahan_Mangga'
) => {
  const sourceEl = document.getElementById(elementId);
  if (!sourceEl) {
    console.error(`[PrintHelper] Elemen cetak dengan ID "${elementId}" tidak ditemukan.`);
    window.print();
    return;
  }

  const originalTitle = document.title;
  // Bersihkan karakter yang tidak valid untuk nama file PDF
  const safeTitle = documentTitle.replace(/[/\\?%*:|"<>]/g, '_');
  document.title = safeTitle;

  // Pastikan print portal root container sudah ada tepat di bawah document.body (di luar #root)
  let printPortal = document.getElementById('print-portal-container');
  if (!printPortal) {
    printPortal = document.createElement('div');
    printPortal.id = 'print-portal-container';
    document.body.appendChild(printPortal);
  }

  // Kloning konten elemen target ke dalam print portal
  printPortal.innerHTML = sourceEl.innerHTML;

  // Aktifkan mode cetak pada body
  document.body.setAttribute('data-print-mode', 'true');

  // Bersihkan dan kembalikan state setelah dialog cetak selesai
  let isCleanedUp = false;
  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    document.body.removeAttribute('data-print-mode');
    if (printPortal) {
      printPortal.innerHTML = '';
    }
    document.title = originalTitle;
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);

  // Berikan jeda kecil agar rendering gambar SVG dan font browser selesai sebelum dialog cetak muncul
  setTimeout(() => {
    try {
      window.print();
    } catch (err) {
      console.error('[PrintHelper] Gagal memicu window.print():', err);
    }
    // Fallback cleanup jika event afterprint tidak dipicu oleh browser tertentu (misal mobile webview)
    setTimeout(cleanup, 2500);
  }, 120);
};
