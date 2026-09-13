import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  ExternalLink,
  Printer,
  CheckCircle,
  Copy,
  Check,
  Edit3,
  Save,
  Trash2,
  AlertTriangle,
  Shield,
  Download,
  Eye,
  FileText,
} from 'lucide-react';
import { LaporanHarianItem, SheetMetadata } from '../types';
import { formatTanggalIndonesia } from '../lib/formatter';

interface DetailLaporanModalProps {
  item: LaporanHarianItem | null;
  isOpen: boolean;
  onClose: () => void;
  sheetMeta: SheetMetadata | null;
  hasGoogleAuth: boolean;
  isAdmin?: boolean;
  onUpdateReport?: (updatedItem: LaporanHarianItem) => Promise<void>;
  onDeleteReport?: (id: string) => Promise<void>;
}

export const DetailLaporanModal: React.FC<DetailLaporanModalProps> = ({
  item,
  isOpen,
  onClose,
  sheetMeta,
  hasGoogleAuth,
  isAdmin = true,
  onUpdateReport,
  onDeleteReport,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; name: string } | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfStatusMsg, setPdfStatusMsg] = useState('');
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Helper download photo
  const handleDownloadPhoto = (url: string, filename: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const link = document.createElement('a');
    link.href = url;
    const cleanName = filename.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/)
      ? filename
      : `${filename}.jpg`;
    link.download = cleanName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllPhotos = () => {
    if (!item?.dokumentasiFoto || item.dokumentasiFoto.length === 0) return;
    setIsDownloadingAll(true);
    item.dokumentasiFoto.forEach((foto, idx) => {
      setTimeout(() => {
        const safeName = `${item.lingkungan || 'Kepling'}_${item.tanggal}_foto_${idx + 1}.jpg`;
        handleDownloadPhoto(foto.url, foto.name || safeName);
        if (idx === (item.dokumentasiFoto?.length || 1) - 1) {
          setTimeout(() => setIsDownloadingAll(false), 1000);
        }
      }, idx * 400);
    });
  };

  // Editable Form States
  const [editHari, setEditHari] = useState('');
  const [editTanggal, setEditTanggal] = useState('');
  const [editNamaKepling, setEditNamaKepling] = useState('');
  const [editJabatan, setEditJabatan] = useState('');
  const [editOpsirPbbWp, setEditOpsirPbbWp] = useState('');
  const [editOpsirPbbKet, setEditOpsirPbbKet] = useState('');
  const [editPerlinsosKk, setEditPerlinsosKk] = useState('');
  const [editPerlinsosKet, setEditPerlinsosKet] = useState('');
  const [editPerlinsosMenolakKk, setEditPerlinsosMenolakKk] = useState('');
  const [editPerlinsosMenolakRincian, setEditPerlinsosMenolakRincian] = useState('');
  const [editPerlinsosTidakDiTempatKk, setEditPerlinsosTidakDiTempatKk] = useState('');
  const [editPerlinsosTidakDiTempatRincian, setEditPerlinsosTidakDiTempatRincian] = useState('');
  const [editIkdOrang, setEditIkdOrang] = useState('');
  const [editIkdKet, setEditIkdKet] = useState('');
  const [editBpjsOrang, setEditBpjsOrang] = useState('');
  const [editBpjsKet, setEditBpjsKet] = useState('');
  const [editPoskamlingStatus, setEditPoskamlingStatus] = useState('');
  const [editPoskamlingLokasi, setEditPoskamlingLokasi] = useState('');
  const [editPoskamlingPetugas, setEditPoskamlingPetugas] = useState('');
  const [editPoskamlingKet, setEditPoskamlingKet] = useState('');
  const [editKegiatanLainnya, setEditKegiatanLainnya] = useState('');

  // Populate form fields whenever active item changes
  useEffect(() => {
    if (item) {
      setEditHari(item.hari || '');
      setEditTanggal(item.tanggal || '');
      setEditNamaKepling(item.namaKepling || '');
      setEditJabatan(item.jabatan || '');
      setEditOpsirPbbWp(item.kinerja?.opsirPbbWp || '0');
      setEditOpsirPbbKet(item.kinerja?.opsirPbbKeterangan || '');
      setEditPerlinsosKk(item.kinerja?.perlinsosKk || '0');
      setEditPerlinsosKet(item.kinerja?.perlinsosKeterangan || '');
      setEditPerlinsosMenolakKk(item.kinerja?.perlinsosMenolakKk ? String(item.kinerja.perlinsosMenolakKk) : '0');
      setEditPerlinsosMenolakRincian(item.kinerja?.perlinsosMenolakRincian || '');
      setEditPerlinsosTidakDiTempatKk(item.kinerja?.perlinsosTidakDiTempatKk ? String(item.kinerja.perlinsosTidakDiTempatKk) : '0');
      setEditPerlinsosTidakDiTempatRincian(item.kinerja?.perlinsosTidakDiTempatRincian || '');
      setEditIkdOrang(item.kinerja?.ikdOrang || '0');
      setEditIkdKet(item.kinerja?.ikdKeterangan || '');
      setEditBpjsOrang(item.kinerja?.bpjsKetenagakerjaanOrang || '0');
      setEditBpjsKet(item.kinerja?.bpjsKetenagakerjaanKeterangan || '');
      setEditPoskamlingStatus(item.kinerja?.poskamlingStatus || '');
      setEditPoskamlingLokasi(item.kinerja?.poskamlingLokasi || '');
      setEditPoskamlingPetugas(item.kinerja?.poskamlingPetugas || '');
      setEditPoskamlingKet(item.kinerja?.poskamlingKeterangan || '');
      setEditKegiatanLainnya(item.kinerja?.kegiatanLainnya || '');
      setIsEditing(false);
      setShowDeleteConfirm(false);
      setShowPrintPreview(false);
      setPdfStatusMsg('');
      setSaveSuccessMsg('');
    }
  }, [item]);

  const displayTanggal = React.useMemo(() => {
    if (!item?.tanggal) return '';
    if (item.tanggal.includes('-')) {
      const parts = item.tanggal.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (!isNaN(d.getTime())) {
          return formatTanggalIndonesia(d);
        }
      }
    }
    return item.tanggal;
  }, [item?.tanggal]);

  const getProperFotoLabel = (foto: { name?: string }, idx: number) => {
    if (!foto?.name) return `Dokumentasi Lapangan ${idx + 1}`;
    const raw = foto.name.trim();
    const lower = raw.toLowerCase();
    if (lower.includes('poskamling') || lower.includes('ronda') || lower.includes('siskamling')) {
      return 'Dokumentasi Pos Ronda / Siskamling';
    }
    if (lower.includes('pbb') || lower.includes('pajak')) {
      return 'Dokumentasi Penagihan PBB';
    }
    if (lower.includes('perlinsos') || lower.includes('bansos') || lower.includes('bantuan')) {
      return 'Dokumentasi Verifikasi Perlinsos';
    }
    if (lower.includes('ikd') || lower.includes('ktp') || lower.includes('kependudukan')) {
      return 'Dokumentasi Aktivasi IKD';
    }
    if (lower.includes('bpjs') || lower.includes('rentan') || lower.includes('ketenagakerjaan')) {
      return 'Dokumentasi BPJS Ketenagakerjaan';
    }
    if (lower.includes('bersih') || lower.includes('gotong') || lower.includes('drainase')) {
      return 'Dokumentasi Kebersihan Lingkungan';
    }
    if (lower.includes('whatsapp') || lower.startsWith('img_') || lower.startsWith('image')) {
      return `Dokumentasi Lapangan ${idx + 1}`;
    }
    const clean = raw.replace(/\.[^/.]+$/, '').replace(/^[\[\(].*?[\]\)]\s*/, '').trim();
    return clean.length > 28 ? `Dokumentasi Lapangan ${idx + 1}` : clean;
  };

  const groupPhotosByActivity = (photos: Array<{ id?: string; url: string; name?: string; kategori?: string }> = []) => {
    const groups: Record<string, Array<{ id?: string; url: string; name?: string; kategori?: string }>> = {
      pbb: [],
      perlinsos: [],
      ikd: [],
      bpjs: [],
      poskamling: [],
      lainnya: [],
    };

    photos.forEach((foto) => {
      const cat = (foto.kategori || '').toLowerCase();
      const name = (foto.name || '').toLowerCase();

      if (cat === 'pbb' || name.includes('[pbb]') || name.includes('pbb') || name.includes('pajak')) {
        groups.pbb.push(foto);
      } else if (cat === 'perlinsos' || name.includes('[perlinsos]') || name.includes('perlinsos') || name.includes('bansos')) {
        groups.perlinsos.push(foto);
      } else if (cat === 'ikd' || name.includes('[ikd]') || name.includes('ikd') || name.includes('dukcapil') || name.includes('kependudukan')) {
        groups.ikd.push(foto);
      } else if (cat === 'bpjs' || name.includes('[bpjs]') || name.includes('bpjs') || name.includes('rentan')) {
        groups.bpjs.push(foto);
      } else if (cat === 'poskamling' || name.includes('[poskamling]') || name.includes('poskamling') || name.includes('ronda') || name.includes('siskamling')) {
        groups.poskamling.push(foto);
      } else {
        groups.lainnya.push(foto);
      }
    });

    const metaList = [
      { key: 'pbb', title: '1. Dokumentasi Opsir PBB (Pajak Bumi & Bangunan)', badgeBg: 'bg-blue-100', textClr: 'text-blue-900', borderClr: 'border-blue-300' },
      { key: 'perlinsos', title: '2. Dokumentasi PERLINSOS (Perlindungan Sosial)', badgeBg: 'bg-emerald-100', textClr: 'text-emerald-900', borderClr: 'border-emerald-300' },
      { key: 'ikd', title: '3. Dokumentasi Aktivasi IKD Dukcapil', badgeBg: 'bg-purple-100', textClr: 'text-purple-900', borderClr: 'border-purple-300' },
      { key: 'bpjs', title: '4. Dokumentasi BPJS Ketenagakerjaan', badgeBg: 'bg-indigo-100', textClr: 'text-indigo-900', borderClr: 'border-indigo-300' },
      { key: 'poskamling', title: '5. Dokumentasi Pos Ronda / SISKAMLING', badgeBg: 'bg-amber-100', textClr: 'text-amber-950', borderClr: 'border-amber-300' },
      { key: 'lainnya', title: '6. Dokumentasi Kebersihan & Kegiatan Lainnya', badgeBg: 'bg-slate-100', textClr: 'text-slate-900', borderClr: 'border-slate-300' },
    ];

    return metaList
      .map((meta) => ({
        ...meta,
        photos: groups[meta.key] || [],
      }))
      .filter((g) => g.photos.length > 0);
  };

  const openPrintableWindow = () => {
    if (!item) return;
    const element = document.getElementById('lembar-cetak-laporan-kepling');
    const contentHtml = element ? element.innerHTML : '';
    const safeJabatan = (item.jabatan || 'Kepling').replace(/[^a-zA-Z0-9]/g, '_');
    const safeTanggal = (displayTanggal || item.tanggal || 'Laporan').replace(/[^a-zA-Z0-9]/g, '_');
    const titleStr = `Laporan_${safeJabatan}_${safeTanggal}`;

    try {
      const printWin = window.open('', '_blank');
      if (!printWin) {
        // Jika popup diblokir browser, cetak langsung halaman saat ini
        window.print();
        return;
      }

      printWin.document.write(`
        <!DOCTYPE html>
        <html lang="id">
          <head>
            <title>${titleStr}</title>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              @media print {
                .no-print { display: none !important; }
                body { background: white !important; margin: 0 !important; padding: 0 !important; }
                @page { size: A4 portrait; margin: 6mm 8mm 6mm 8mm; }
              }
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #000; padding: 12px; margin: 0; }
              .print-table { border-collapse: collapse; width: 100%; }
              .print-table th, .print-table td { border: 1px solid #000; padding: 3px 6px; font-size: 8pt; }
              .avoid-break { page-break-inside: avoid; break-inside: avoid; }
            </style>
          </head>
          <body>
            <div class="no-print" style="position: sticky; top: 0; background: #064e3b; color: white; padding: 10px; border-radius: 8px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 9999;">
              <span style="font-weight: bold; font-size: 13px;">📄 Lembar Cetak Resmi Laporan Kepling (A4)</span>
              <div style="display: flex; gap: 8px;">
                <button onclick="window.print()" style="background: #f59e0b; color: #000; font-weight: bold; padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px;">🖨️ Cetak / Simpan PDF</button>
                <button onclick="window.close()" style="background: rgba(255,255,255,0.2); color: white; font-weight: bold; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px;">Tutup</button>
              </div>
            </div>
            <div style="background: white; max-width: 195mm; margin: 0 auto; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              ${contentHtml}
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  try { window.print(); } catch (e) {}
                }, 400);
              };
            </script>
          </body>
        </html>
      `);
      printWin.document.close();
    } catch (e) {
      window.print();
    }
  };

  const handleDownloadPDF = async () => {
    if (!item) return;
    setIsExportingPDF(true);
    setPdfStatusMsg('Menyiapkan file PDF A4...');

    const element = document.getElementById('lembar-cetak-laporan-kepling');
    if (!element) {
      handlePrint();
      setIsExportingPDF(false);
      setPdfStatusMsg('');
      return;
    }

    // Buat klon elemen dengan dimensi A4 standar yang tidak tertekan oleh resolusi layar HP
    const tempContainer = document.createElement('div');
    tempContainer.id = 'temp-pdf-export-clone';
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = '794px';
    tempContainer.style.maxWidth = '794px';
    tempContainer.style.backgroundColor = '#ffffff';
    tempContainer.style.color = '#000000';
    tempContainer.style.padding = '14px 18px 12px 18px';
    tempContainer.style.zIndex = '-999';
    tempContainer.style.boxSizing = 'border-box';
    tempContainer.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    tempContainer.style.visibility = 'visible';
    tempContainer.innerHTML = element.innerHTML;

    // Pastikan gambar di klon menggunakan crossOrigin anonymous
    const imgs = tempContainer.querySelectorAll('img');
    imgs.forEach((img) => {
      img.crossOrigin = 'anonymous';
      img.loading = 'eager';
    });

    document.body.appendChild(tempContainer);

    // Tunggu browser mendecode layout gambar
    await new Promise((r) => setTimeout(r, 400));

    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdfFunc = (html2pdfModule as any).default || html2pdfModule;

      const safeJabatan = (item.jabatan || 'Kepling').replace(/[^a-zA-Z0-9]/g, '_');
      const safeTanggal = (displayTanggal || item.tanggal || 'Laporan').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Laporan_${safeJabatan}_${safeTanggal}.pdf`;

      const opt = {
        margin: [5, 6, 5, 6],
        filename: filename,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          letterRendering: true,
          scrollY: 0,
          scrollX: 0,
          windowWidth: 794,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };

      setPdfStatusMsg('Mengunduh dokumen PDF...');
      await html2pdfFunc().set(opt).from(tempContainer).save();
    } catch (err) {
      console.warn('PDF direct export notice, fallback to print:', err);
      handlePrint();
    } finally {
      if (document.body.contains(tempContainer)) {
        document.body.removeChild(tempContainer);
      }
      setIsExportingPDF(false);
      setPdfStatusMsg('');
    }
  };

  const handlePrint = () => {
    if (!item) return;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

    if (isMobile) {
      // Di Android & iOS: browser memblokir window.open popup.
      // Panggil window.print() langsung pada halaman aktif untuk memicu Android Print Spooler bawaan
      try {
        window.print();
      } catch (e) {
        console.warn('Print direct error:', e);
      }
      return;
    }

    // Di Desktop: buka tab/window khusus yang rapi
    openPrintableWindow();
  };

  const handleCopyText = () => {
    const activeItem = isEditing
      ? {
          jabatan: editJabatan,
          kelurahan: item?.kelurahan || '',
          kecamatan: item?.kecamatan || '',
          hari: editHari,
          tanggal: editTanggal,
          namaKepling: editNamaKepling,
          kinerja: {
            opsirPbbWp: editOpsirPbbWp,
            opsirPbbKeterangan: editOpsirPbbKet,
            perlinsosKk: editPerlinsosKk,
            perlinsosKeterangan: editPerlinsosKet,
            perlinsosMenolakKk: editPerlinsosMenolakKk,
            perlinsosMenolakRincian: editPerlinsosMenolakRincian,
            perlinsosTidakDiTempatKk: editPerlinsosTidakDiTempatKk,
            perlinsosTidakDiTempatRincian: editPerlinsosTidakDiTempatRincian,
            ikdOrang: editIkdOrang,
            ikdKeterangan: editIkdKet,
            bpjsKetenagakerjaanOrang: editBpjsOrang,
            bpjsKetenagakerjaanKeterangan: editBpjsKet,
            poskamlingStatus: editPoskamlingStatus,
            poskamlingLokasi: editPoskamlingLokasi,
            poskamlingPetugas: editPoskamlingPetugas,
            poskamlingKeterangan: editPoskamlingKet,
            kegiatanLainnya: editKegiatanLainnya,
          },
          jumlahDokumentasi: item?.jumlahDokumentasi || 0,
        }
      : item;

    const kin = activeItem?.kinerja || {};

    const text = [
      `*🟩 LAPORAN KEGIATAN HARIAN*`,
      `*${(activeItem?.jabatan || '').toUpperCase()}*`,
      `*${(activeItem?.kelurahan || 'Kelurahan Mangga').toUpperCase()}*`,
      `*${(activeItem?.kecamatan || 'Medan Tuntungan').toUpperCase()}*`,
      `----------------------------------------`,
      `Hari     : ${activeItem?.hari || ''}`,
      `Tanggal  : ${activeItem?.tanggal || ''}`,
      `Nama     : ${activeItem?.namaKepling || ''}`,
      `Jabatan  : ${activeItem?.jabatan || ''}`,
      `----------------------------------------`,
      `KINERJA HARIAN:`,
      `1. OPSIR PBB : ${kin.opsirPbbWp || '0'} WP ${kin.opsirPbbKeterangan ? `(${kin.opsirPbbKeterangan})` : ''}`,
      `2. PERLINSOS : ${kin.perlinsosKk || '0'} KK ${kin.perlinsosKeterangan ? `(${kin.perlinsosKeterangan})` : ''}` +
        (kin.perlinsosMenolakKk && String(kin.perlinsosMenolakKk) !== '0'
          ? `\n   - ⚠️ Menolak: ${kin.perlinsosMenolakKk} KK${kin.perlinsosMenolakRincian ? ` (Nama & Alamat: ${kin.perlinsosMenolakRincian.replace(/\n/g, ', ')})` : ''}`
          : '') +
        (kin.perlinsosTidakDiTempatKk && String(kin.perlinsosTidakDiTempatKk) !== '0'
          ? `\n   - 🏠 Tidak Di Tempat: ${kin.perlinsosTidakDiTempatKk} KK${kin.perlinsosTidakDiTempatRincian ? ` (Nama & Alamat: ${kin.perlinsosTidakDiTempatRincian.replace(/\n/g, ', ')})` : ''}`
          : ''),
      `3. IDENTITAS KEPENDUDUKAN DIGITAL : ${kin.ikdOrang || '0'} ORANG ${kin.ikdKeterangan ? `(${kin.ikdKeterangan})` : ''}`,
      `4. BPJS KETENAGAKERJAAN : ${kin.bpjsKetenagakerjaanOrang || '0'} ORANG ${kin.bpjsKetenagakerjaanKeterangan ? `(${kin.bpjsKetenagakerjaanKeterangan})` : ''}`,
      kin.poskamlingStatus && kin.poskamlingStatus !== 'Tidak Ada Giat'
        ? `5. POSKAMLING / SISKAMLING : ${kin.poskamlingStatus}${kin.poskamlingLokasi ? ` (${kin.poskamlingLokasi})` : ''}${kin.poskamlingPetugas ? ` - Petugas: ${kin.poskamlingPetugas}` : ''}${kin.poskamlingKeterangan ? ` [${kin.poskamlingKeterangan}]` : ''}`
        : '',
      kin.kegiatanLainnya ? `6. KEGIATAN LAINNYA : ${kin.kegiatanLainnya}` : '',
      `----------------------------------------`,
      `Dokumentasi : ${activeItem?.jumlahDokumentasi || (activeItem?.dokumentasiFoto ? activeItem.dokumentasiFoto.length : 0)} Foto Terlampir`,
      `#MedanUntukSemua #SemuaUntukMedan`,
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = async () => {
    if (!onUpdateReport) return;
    setIsSavingEdit(true);
    try {
      const updatedReport: LaporanHarianItem = {
        ...item,
        hari: editHari,
        tanggal: editTanggal,
        namaKepling: editNamaKepling,
        jabatan: editJabatan,
        kinerja: {
          opsirPbbWp: editOpsirPbbWp,
          opsirPbbKeterangan: editOpsirPbbKet,
          perlinsosKk: editPerlinsosKk,
          perlinsosKeterangan: editPerlinsosKet,
          perlinsosMenolakKk: editPerlinsosMenolakKk,
          perlinsosMenolakRincian: editPerlinsosMenolakRincian,
          perlinsosTidakDiTempatKk: editPerlinsosTidakDiTempatKk,
          perlinsosTidakDiTempatRincian: editPerlinsosTidakDiTempatRincian,
          ikdOrang: editIkdOrang,
          ikdKeterangan: editIkdKet,
          bpjsKetenagakerjaanOrang: editBpjsOrang,
          bpjsKetenagakerjaanKeterangan: editBpjsKet,
          poskamlingAdaGiat: Boolean(editPoskamlingStatus && editPoskamlingStatus !== 'Tidak Ada Giat'),
          poskamlingStatus: editPoskamlingStatus,
          poskamlingLokasi: editPoskamlingLokasi,
          poskamlingPetugas: editPoskamlingPetugas,
          poskamlingKeterangan: editPoskamlingKet,
          kegiatanLainnya: editKegiatanLainnya,
        },
      };

      await onUpdateReport(updatedReport);
      setSaveSuccessMsg('Perubahan laporan berhasil disimpan ke database!');
      setIsEditing(false);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Save edit error:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!onDeleteReport || !item) return;
    setIsDeleting(true);
    try {
      await onDeleteReport(item.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:m-0 print:bg-white print:static print:inset-auto print:overflow-visible print:block">
      {/* 1. TAMPILAN INTERAKTIF MODAL (HANYA DITAMPILKAN DI LAYAR, DISEMBUNYIKAN SAAT CETAK) */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 print:hidden">
        {/* Header Modal */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-xl">{isEditing ? '✏️' : '📋'}</span>
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>{isEditing ? 'Koreksi / Edit Laporan Kepling' : 'Rincian Laporan Kinerja Harian'}</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-700 text-white font-semibold">
                  {item.hari}
                </span>
                {isEditing && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold uppercase">
                    Mode Edit Admin
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {item.tanggal} • {item.namaKepling} ({item.jabatan})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {!isEditing && (
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isExportingPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="Unduh file PDF laporan ini (Format A4 Pemko Medan)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExportingPDF ? 'Mengunduh...' : 'Unduh PDF'}</span>
              </button>
            )}
            {isAdmin && !isEditing && onDeleteReport && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                title="Hapus laporan ini dari database (Admin)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hapus</span>
              </button>
            )}
            {!isEditing && onUpdateReport && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(true);
                  setShowPrintPreview(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 text-xs font-bold transition-colors cursor-pointer shadow-xs"
                title="Edit / koreksi isi laporan ini (Kepala Lingkungan & Admin)"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Laporan</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigasi: Form Detail vs Pratinjau Lembar A4 */}
        {!isEditing && (
          <div className="bg-slate-100 px-4 sm:px-6 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowPrintPreview(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  !showPrintPreview
                    ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Form & Foto</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPrintPreview(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  showPrintPreview
                    ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pratinjau Lembar Cetak A4</span>
              </button>
            </div>

            {showPrintPreview && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 hidden sm:inline-block">
                Standar Kertas A4 Pemko Medan
              </span>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {showPrintPreview && !isEditing ? (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">📄</span>
                  <span>
                    Pratinjau format resmi kertas A4 kedinasan. Klik <strong>Unduh PDF</strong> atau <strong>Cetak Dokumen</strong> untuk menyimpan.
                  </span>
                </div>
              </div>

              {/* Tampilan Visual Lembar A4 di dalam Modal */}
              <div className="bg-slate-200 p-2 sm:p-4 rounded-xl overflow-x-auto flex flex-col items-center gap-4">
                <div className="bg-white text-slate-900 w-[190mm] min-w-[190mm] p-6 font-serif text-[8.5pt] leading-tight shadow-md rounded border border-slate-300">
                  {/* Kop Surat Pemko Medan */}
                  <div className="flex items-center gap-3.5 pt-1 pb-2 border-b-[3px] border-black mb-2.5">
                    <img
                      src="/logo_pemko_medan.png"
                      alt="Logo Pemko Medan"
                      crossOrigin="anonymous"
                      className="shrink-0 ml-1"
                      style={{
                        width: '74px',
                        height: '89px',
                        minWidth: '74px',
                        maxWidth: '74px',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                    <div className="text-center flex-1 pr-[74px]">
                      <div className="text-[12.5pt] uppercase font-sans text-black leading-tight font-bold tracking-[0.04em] mb-0.5">
                        PEMERINTAH KOTA MEDAN
                      </div>
                      <div className="text-[12.5pt] uppercase font-sans text-black leading-tight font-bold tracking-[0.04em] mb-1">
                        KECAMATAN MEDAN TUNTUNGAN
                      </div>
                      <div className="text-[16.5pt] font-black uppercase font-sans text-black leading-tight tracking-[0.05em] mb-1">
                        KELURAHAN MANGGA
                      </div>
                      <div className="text-[8.5pt] text-black font-sans leading-snug mb-0.5">
                        Jalan Tembakau Raya No. 35 A P. Simalingkar - Medan
                      </div>
                      <div className="text-[8pt] text-slate-800 font-sans leading-snug">
                        Laman kel.mangga@pemkomedan.go.id
                      </div>
                    </div>
                  </div>

                  {/* Judul Laporan */}
                  <div className="text-center my-2.5">
                    <h1 className="text-[11.5pt] font-black uppercase tracking-[0.04em] underline font-serif">
                      LAPORAN KEGIATAN HARIAN KEPALA LINGKUNGAN
                    </h1>
                    <div className="text-[8.5pt] font-serif mt-1 text-slate-900">
                      <span className="font-bold">Hari:</span> {(item.hari || '').toUpperCase()} &nbsp;&nbsp;|&nbsp;&nbsp; <span className="font-bold">Tanggal:</span> {displayTanggal.toUpperCase()}
                    </div>
                  </div>

                  {/* Identitas Petugas */}
                  <div className="mb-2 text-[8.5pt] font-sans bg-white p-2 rounded-lg border border-slate-300">
                    <table className="w-full text-left">
                      <tbody>
                        <tr>
                          <td className="w-32 font-bold py-0.5 text-slate-800">Nama Petugas</td>
                          <td className="w-4 font-bold">:</td>
                          <td className="font-bold uppercase text-slate-900">{item.namaKepling || ''}</td>
                          <td className="w-24 font-bold py-0.5 text-slate-800">Kelurahan</td>
                          <td className="w-4 font-bold">:</td>
                          <td className="text-slate-900">{item.kelurahan || 'Kelurahan Mangga'}</td>
                        </tr>
                        <tr>
                          <td className="font-bold py-0.5 text-slate-800">Jabatan / Wilayah</td>
                          <td className="font-bold">:</td>
                          <td className="font-bold text-slate-900">{item.jabatan || ''}</td>
                          <td className="font-bold py-0.5 text-slate-800">Kecamatan</td>
                          <td className="font-bold">:</td>
                          <td className="text-slate-900">{item.kecamatan || 'Kecamatan Medan Tuntungan'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Rekapitulasi Tugas */}
                  <div className="mb-2">
                    <div className="text-[8.5pt] font-bold font-sans uppercase tracking-wider mb-1 text-slate-900">
                      A. REKAPITULASI CAPAIAN & KEGIATAN HARIAN:
                    </div>
                    <table className="print-table w-full text-left text-[8pt] font-sans border-[1.5px] border-black border-collapse">
                      <thead>
                        <tr className="bg-white text-slate-900 font-bold border-b border-black">
                          <th className="w-8 text-center py-1 border border-black">NO</th>
                          <th className="w-56 py-1 px-1.5 border border-black">URAIAN KEGIATAN KINERJA</th>
                          <th className="w-28 text-center py-1 border border-black">REALISASI</th>
                          <th className="py-1 px-1.5 border border-black">KETERANGAN / RINCIAN LAPANGAN</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="text-center font-bold border border-black py-1">1</td>
                          <td className="font-bold border border-black px-1.5 py-1">Opsir Pajak Bumi & Bangunan (PBB)</td>
                          <td className="text-center font-bold border border-black py-1">{item.kinerja?.opsirPbbWp || 0} WP</td>
                          <td className="border border-black px-1.5 py-1">{item.kinerja?.opsirPbbKeterangan || 'Pembayaran PBB'}</td>
                        </tr>
                        <tr>
                          <td className="text-center font-bold border border-black py-1">2</td>
                          <td className="font-bold border border-black px-1.5 py-1">Perlindungan Sosial (PERLINSOS)</td>
                          <td className="text-center font-bold border border-black py-1">{item.kinerja?.perlinsosKk || 0} KK</td>
                          <td className="border border-black px-1.5 py-1">
                            <div>{item.kinerja?.perlinsosKeterangan || 'Pendataan Perlinsos'}</div>
                            {item.kinerja?.perlinsosMenolakKk && String(item.kinerja.perlinsosMenolakKk) !== '0' && (
                              <div className="mt-0.5 text-[7.5pt] text-rose-900 font-sans leading-tight">
                                <strong>• Menolak ({item.kinerja.perlinsosMenolakKk} KK):</strong> {item.kinerja.perlinsosMenolakRincian || '-'}
                              </div>
                            )}
                            {item.kinerja?.perlinsosTidakDiTempatKk && String(item.kinerja.perlinsosTidakDiTempatKk) !== '0' && (
                              <div className="mt-0.5 text-[7.5pt] text-slate-800 font-sans leading-tight">
                                <strong>• Tidak Di Tempat ({item.kinerja.perlinsosTidakDiTempatKk} KK):</strong> {item.kinerja.perlinsosTidakDiTempatRincian || '-'}
                              </div>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-center font-bold border border-black py-1">3</td>
                          <td className="font-bold border border-black px-1.5 py-1">Identitas Kependudukan Digital (IKD)</td>
                          <td className="text-center font-bold border border-black py-1">{item.kinerja?.ikdOrang || 0} Orang</td>
                          <td className="border border-black px-1.5 py-1">{item.kinerja?.ikdKeterangan || 'Aktivasi aplikasi IKD Dukcapil'}</td>
                        </tr>
                        <tr>
                          <td className="text-center font-bold border border-black py-1">4</td>
                          <td className="font-bold border border-black px-1.5 py-1">BPJS Ketenagakerjaan (Pekerja Rentan)</td>
                          <td className="text-center font-bold border border-black py-1">{item.kinerja?.bpjsKetenagakerjaanOrang || 0} Orang</td>
                          <td className="border border-black px-1.5 py-1">{item.kinerja?.bpjsKetenagakerjaanKeterangan || 'Sosialisasi pekerja rentan'}</td>
                        </tr>
                        <tr>
                          <td className="text-center font-bold border border-black py-1">5</td>
                          <td className="font-bold border border-black px-1.5 py-1">Pos Ronda / SISKAMLING</td>
                          <td className="text-center font-bold border border-black py-1">{item.kinerja?.poskamlingStatus || 'Aktif Ronda Malam'}</td>
                          <td className="border border-black px-1.5 py-1">
                            {item.kinerja?.poskamlingLokasi ? `Lokasi: ${item.kinerja.poskamlingLokasi}. ` : ''}
                            {item.kinerja?.poskamlingPetugas ? `Petugas: ${item.kinerja.poskamlingPetugas}. ` : ''}
                            {item.kinerja?.poskamlingKeterangan || 'Patroli siskamling lingkungan kondusif dan aman'}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-center font-bold border border-black py-1">6</td>
                          <td className="font-bold border border-black px-1.5 py-1">Kegiatan Kebersihan & Lainnya</td>
                          <td className="text-center font-bold border border-black py-1">Terlaksana</td>
                          <td className="border border-black px-1.5 py-1">{item.kinerja?.kegiatanLainnya || 'Pemantauan kebersihan lingkungan dan drainase warga'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Foto Dokumentasi - Terkelompok Per Kegiatan & Adaptif Kedinasan */}
                  {item.dokumentasiFoto && item.dokumentasiFoto.length > 0 && (
                    item.dokumentasiFoto.length <= 3 ? (
                      <div className="mb-2">
                        <div className="text-[8.5pt] font-bold font-sans uppercase tracking-wider mb-1.5 text-slate-900 flex items-center justify-between">
                          <span>B. DOKUMENTASI LAPANGAN TERLAMPIR ({item.dokumentasiFoto.length} FOTO):</span>
                          <span className="text-[7pt] text-slate-500 font-normal normal-case">Format Album Resmi Kedinasan</span>
                        </div>
                        <div className="space-y-2">
                          {groupPhotosByActivity(item.dokumentasiFoto).map((group) => (
                            <div key={group.key}>
                              <div className="text-[7.5pt] font-bold font-sans text-slate-800 uppercase mb-1 flex items-center justify-between border-b border-slate-200 pb-0.5">
                                <span>• {group.title} ({group.photos.length} Foto)</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2.5">
                                {group.photos.map((foto, idx) => (
                                  <div
                                    key={foto.id || idx}
                                    className="rounded-lg border border-slate-300 p-1.5 bg-white flex flex-col items-center shadow-xs"
                                  >
                                    <div className="w-full h-[185px] rounded-md overflow-hidden bg-slate-100 flex items-center justify-center p-0.5">
                                      <img
                                        src={foto.url}
                                        alt={getProperFotoLabel(foto, idx)}
                                        crossOrigin="anonymous"
                                        className="w-full h-full object-contain object-center"
                                      />
                                    </div>
                                    <div
                                      className="text-[7.5pt] font-bold text-slate-800 mt-1 truncate w-full text-center font-sans"
                                      title={getProperFotoLabel(foto, idx)}
                                    >
                                      {getProperFotoLabel(foto, idx)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[8pt] text-slate-700 font-sans flex items-center justify-between">
                        <div>
                          <strong>B. DOKUMENTASI LAPANGAN TERLAMPIR:</strong> Sebanyak <strong>{item.dokumentasiFoto.length} Foto Dokumentasi</strong> dicantumkan secara lengkap dan terkelompok per kegiatan pada <strong>Lembar Lampiran (Halaman 2)</strong>.
                        </div>
                        <span className="text-[7pt] bg-slate-200 px-2 py-0.5 rounded font-semibold text-slate-700 shrink-0 ml-2">2 Halaman Dokumen</span>
                      </div>
                    )
                  )}

                  {/* Pengesahan Tanda Tangan */}
                  <div className="mt-4 pt-1 text-[8.5pt] font-sans">
                    <div className="flex justify-end pr-4">
                      <div className="text-center flex flex-col items-center min-w-[200px]">
                        <div>Medan, {displayTanggal.toUpperCase()}</div>
                        <div className="mt-0.5">Yang Melaporkan,</div>
                        <div className="font-bold uppercase whitespace-nowrap">{(item.jabatan || '').toUpperCase()}</div>
                        <div className="h-12" />
                        <div className="font-bold underline uppercase whitespace-nowrap">( {item.namaKepling || ''} )</div>
                        <div className="text-[7.5pt] text-slate-700 mt-0.5">Kepala Lingkungan</div>
                      </div>
                    </div>
                  </div>

                  {/* Footer lembar */}
                  <div className="mt-3 pt-1 border-t border-slate-300 flex items-center justify-between text-[6.5pt] text-slate-500 italic font-sans">
                    <span>SISTEM KINERJA KEPALA LINGKUNGAN KELURAHAN MANGGA • Sistem Informasi Pelaporan Kinerja Harian Kepling</span>
                    <span>Dokumen Resmi {item.dokumentasiFoto && item.dokumentasiFoto.length > 3 ? 'Halaman 1 dari 2' : '1 Lembar'} • Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>

                {/* TAMPILAN HALAMAN 2 JIKA FOTO > 3 DI MODAL PREVIEW */}
                {item.dokumentasiFoto && item.dokumentasiFoto.length > 3 && (
                  <div className="bg-white text-slate-900 w-[190mm] min-w-[190mm] p-6 font-serif text-[8.5pt] leading-tight shadow-md rounded border border-slate-300 mt-4">
                    {/* Header Lampiran */}
                    <div className="text-center pb-2 border-b-[2px] border-black mb-3">
                      <h2 className="text-[11.5pt] font-black uppercase tracking-[0.04em] font-serif">
                        LAMPIRAN DOKUMENTASI KEGIATAN LAPANGAN
                      </h2>
                      <div className="text-[8.5pt] font-serif text-slate-800 mt-0.5">
                        KEPALA LINGKUNGAN KELURAHAN MANGGA KECAMATAN MEDAN TUNTUNGAN
                      </div>
                      <div className="text-[8pt] text-slate-600 mt-1">
                        <strong>Hari:</strong> {(item.hari || '').toUpperCase()} &nbsp;|&nbsp; <strong>Tanggal:</strong> {displayTanggal.toUpperCase()} &nbsp;|&nbsp; <strong>Petugas:</strong> {item.namaKepling || ''} ({(item.jabatan || '').toUpperCase()})
                      </div>
                    </div>

                    {/* Grid Foto Lampiran Terkelompok Per Kegiatan */}
                    <div className="space-y-4 mb-4">
                      {groupPhotosByActivity(item.dokumentasiFoto).map((group) => (
                        <div key={group.key} className="space-y-1.5">
                          <div className="text-[8.5pt] font-bold font-sans text-slate-900 uppercase border-b border-slate-300 pb-1 flex items-center justify-between">
                            <span>• {group.title} ({group.photos.length} Foto)</span>
                            <span className={`text-[7pt] px-2 py-0.5 rounded font-bold ${group.badgeBg} ${group.textClr}`}>
                              {group.key.toUpperCase()}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {group.photos.map((foto, idx) => (
                              <div
                                key={foto.id || idx}
                                className="rounded-lg border border-slate-300 p-2 bg-white flex flex-col items-center shadow-xs"
                              >
                                <div className="w-full h-[180px] rounded-md overflow-hidden bg-slate-100 flex items-center justify-center p-1">
                                  <img
                                    src={foto.url}
                                    alt={getProperFotoLabel(foto, idx)}
                                    crossOrigin="anonymous"
                                    className="w-full h-full object-contain object-center"
                                  />
                                </div>
                                <div
                                  className="text-[8pt] font-bold text-slate-800 mt-1.5 truncate w-full text-center font-sans"
                                  title={getProperFotoLabel(foto, idx)}
                                >
                                  {getProperFotoLabel(foto, idx)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tanda Tangan Pengesahan Lampiran */}
                    <div className="mt-3 pt-2 text-[8.5pt] font-sans">
                      <div className="flex justify-end pr-4">
                        <div className="text-center flex flex-col items-center min-w-[200px]">
                          <div>Medan, {displayTanggal.toUpperCase()}</div>
                          <div className="mt-0.5">Kepala Lingkungan Pelapor,</div>
                          <div className="font-bold uppercase whitespace-nowrap">{(item.jabatan || '').toUpperCase()}</div>
                          <div className="h-10" />
                          <div className="font-bold underline uppercase whitespace-nowrap">( {item.namaKepling || ''} )</div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Halaman 2 */}
                    <div className="mt-3 pt-1 border-t border-slate-300 flex items-center justify-between text-[6.5pt] text-slate-500 italic font-sans">
                      <span>LAMPIRAN RESMI DOKUMENTASI KEGIATAN KEPALA LINGKUNGAN</span>
                      <span>Halaman 2 dari 2 • Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl flex items-center gap-2 text-xs font-semibold">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Identity Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Hari Pelaporan
                  </label>
                  <input
                    type="text"
                    value={editHari}
                    onChange={(e) => setEditHari(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Tanggal Pelaporan
                  </label>
                  <input
                    type="text"
                    value={editTanggal}
                    onChange={(e) => setEditTanggal(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Nama Petugas Kepling
                  </label>
                  <input
                    type="text"
                    value={editNamaKepling}
                    onChange={(e) => setEditNamaKepling(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Jabatan Kepling
                  </label>
                  <input
                    type="text"
                    value={editJabatan}
                    onChange={(e) => setEditJabatan(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-emerald-500"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Hari / Tanggal</span>
                  <span className="font-bold text-slate-800">{item.hari}, {item.tanggal}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Petugas Kepling</span>
                  <span className="font-bold text-slate-800">{item.namaKepling}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Jabatan</span>
                  <span className="font-medium text-slate-700">{item.jabatan}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Wilayah</span>
                  <span className="font-medium text-slate-700">{item.kelurahan}</span>
                </div>
              </div>
            )}
          </div>

          {/* Capaian Kinerja Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Capaian Kinerja Harian
              </h3>
              {isEditing && (
                <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Silakan edit angka atau keterangan jika ada kekeliruan
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. Opsir PBB */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">1. OPSIR PBB</span>
                {isEditing ? (
                  <div className="space-y-2 mt-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={editOpsirPbbWp}
                        onChange={(e) => setEditOpsirPbbWp(e.target.value.replace(/^0+(?=\d)/, ''))}
                        className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-sm text-slate-900"
                      />
                      <span className="text-xs font-semibold text-slate-600">WP</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Keterangan pembayaran..."
                      value={editOpsirPbbKet}
                      onChange={(e) => setEditOpsirPbbKet(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-700"
                    />
                  </div>
                ) : (
                  <>
                    <div className="text-lg font-black text-slate-800 my-1">
                      {item.kinerja?.opsirPbbWp ? String(item.kinerja.opsirPbbWp).replace(/^0+(?=\d)/, '') : '0'} <span className="text-xs font-semibold text-slate-500">WP</span>
                    </div>
                    {item.kinerja?.opsirPbbKeterangan && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-1.5 rounded">
                        {item.kinerja.opsirPbbKeterangan}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* 2. Perlinsos */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">2. PERLINSOS</span>
                {isEditing ? (
                  <div className="space-y-2 mt-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={editPerlinsosKk}
                        onChange={(e) => setEditPerlinsosKk(e.target.value.replace(/^0+(?=\d)/, ''))}
                        className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-sm text-slate-900"
                      />
                      <span className="text-xs font-semibold text-slate-600">KK</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Keterangan perlinsos..."
                      value={editPerlinsosKet}
                      onChange={(e) => setEditPerlinsosKet(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-700"
                    />

                    {/* Sub-form Edit Menolak & Tidak Di Tempat */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="p-2 rounded-lg border border-rose-200 bg-rose-50/50 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1">
                            <span>⚠️</span> Menolak Pendataan:
                          </span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={editPerlinsosMenolakKk}
                              onChange={(e) => setEditPerlinsosMenolakKk(e.target.value.replace(/^0+(?=\d)/, ''))}
                              placeholder="0"
                              className="w-14 px-1.5 py-0.5 text-xs border border-rose-300 rounded bg-white font-bold text-rose-900 text-center"
                            />
                            <span className="text-[10px] font-bold text-rose-700">KK</span>
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          value={editPerlinsosMenolakRincian}
                          onChange={(e) => setEditPerlinsosMenolakRincian(e.target.value)}
                          placeholder="Nama & Alamat warga menolak..."
                          className="w-full px-2 py-1 text-[11px] border border-rose-200 rounded bg-white text-slate-800"
                        />
                      </div>

                      <div className="p-2 rounded-lg border border-amber-200 bg-amber-50/50 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                            <span>🏠</span> Tidak Di Tempat:
                          </span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={editPerlinsosTidakDiTempatKk}
                              onChange={(e) => setEditPerlinsosTidakDiTempatKk(e.target.value.replace(/^0+(?=\d)/, ''))}
                              placeholder="0"
                              className="w-14 px-1.5 py-0.5 text-xs border border-amber-300 rounded bg-white font-bold text-amber-900 text-center"
                            />
                            <span className="text-[10px] font-bold text-amber-800">KK</span>
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          value={editPerlinsosTidakDiTempatRincian}
                          onChange={(e) => setEditPerlinsosTidakDiTempatRincian(e.target.value)}
                          placeholder="Nama & Alamat warga tidak di tempat..."
                          className="w-full px-2 py-1 text-[11px] border border-amber-200 rounded bg-white text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-lg font-black text-slate-800 my-1">
                      {item.kinerja?.perlinsosKk ? String(item.kinerja.perlinsosKk).replace(/^0+(?=\d)/, '') : '0'} <span className="text-xs font-semibold text-slate-500">KK</span>
                    </div>
                    {item.kinerja?.perlinsosKeterangan && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-1.5 rounded">
                        {item.kinerja.perlinsosKeterangan}
                      </p>
                    )}
                    {/* Info Rincian Warga Menolak */}
                    {item.kinerja?.perlinsosMenolakKk && String(item.kinerja.perlinsosMenolakKk) !== '0' && (
                      <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-0.5">
                        <div className="font-bold text-rose-800 flex items-center gap-1">
                          <span>⚠️</span>
                          <span>Menolak: {item.kinerja.perlinsosMenolakKk} KK</span>
                        </div>
                        {item.kinerja?.perlinsosMenolakRincian && (
                          <div className="text-rose-900 whitespace-pre-line text-[11px] font-medium pl-4">
                            {item.kinerja.perlinsosMenolakRincian}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Info Rincian Warga Tidak Di Tempat */}
                    {item.kinerja?.perlinsosTidakDiTempatKk && String(item.kinerja.perlinsosTidakDiTempatKk) !== '0' && (
                      <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-0.5">
                        <div className="font-bold text-amber-900 flex items-center gap-1">
                          <span>🏠</span>
                          <span>Tidak Di Tempat: {item.kinerja.perlinsosTidakDiTempatKk} KK</span>
                        </div>
                        {item.kinerja?.perlinsosTidakDiTempatRincian && (
                          <div className="text-amber-950 whitespace-pre-line text-[11px] font-medium pl-4">
                            {item.kinerja.perlinsosTidakDiTempatRincian}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 3. IKD */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">3. IDENTITAS KEPENDUDUKAN DIGITAL</span>
                {isEditing ? (
                  <div className="space-y-2 mt-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={editIkdOrang}
                        onChange={(e) => setEditIkdOrang(e.target.value.replace(/^0+(?=\d)/, ''))}
                        className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-sm text-slate-900"
                      />
                      <span className="text-xs font-semibold text-slate-600">ORANG</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Keterangan aktivasi IKD..."
                      value={editIkdKet}
                      onChange={(e) => setEditIkdKet(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-700"
                    />
                  </div>
                ) : (
                  <>
                    <div className="text-lg font-black text-slate-800 my-1">
                      {item.kinerja?.ikdOrang ? String(item.kinerja.ikdOrang).replace(/^0+(?=\d)/, '') : '0'} <span className="text-xs font-semibold text-slate-500">ORANG</span>
                    </div>
                    {item.kinerja?.ikdKeterangan && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-1.5 rounded">
                        {item.kinerja.ikdKeterangan}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* 4. BPJS Ketenagakerjaan */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">4. BPJS KETENAGAKERJAAN</span>
                {isEditing ? (
                  <div className="space-y-2 mt-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={editBpjsOrang}
                        onChange={(e) => setEditBpjsOrang(e.target.value.replace(/^0+(?=\d)/, ''))}
                        className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-sm text-slate-900"
                      />
                      <span className="text-xs font-semibold text-slate-600">ORANG</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Keterangan BPJS TK..."
                      value={editBpjsKet}
                      onChange={(e) => setEditBpjsKet(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-700"
                    />
                  </div>
                ) : (
                  <>
                    <div className="text-lg font-black text-slate-800 my-1">
                      {item.kinerja?.bpjsKetenagakerjaanOrang ? String(item.kinerja.bpjsKetenagakerjaanOrang).replace(/^0+(?=\d)/, '') : '0'} <span className="text-xs font-semibold text-slate-500">ORANG</span>
                    </div>
                    {item.kinerja?.bpjsKetenagakerjaanKeterangan && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-1.5 rounded">
                        {item.kinerja.bpjsKetenagakerjaanKeterangan}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 5. POSKAMLING / SISKAMLING */}
            <div className="mt-3 p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 flex items-center gap-1.5 uppercase text-[11px]">
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                  5. TUGAS TAMBAHAN: POSKAMLING / SISKAMLING
                </span>
                {item.kinerja?.poskamlingStatus && (
                  <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">
                    {item.kinerja.poskamlingStatus}
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                        Status Poskamling
                      </label>
                      <input
                        type="text"
                        value={editPoskamlingStatus}
                        onChange={(e) => setEditPoskamlingStatus(e.target.value)}
                        placeholder="Misal: Aktif Ronda Malam"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                        Lokasi Pos Ronda
                      </label>
                      <input
                        type="text"
                        value={editPoskamlingLokasi}
                        onChange={(e) => setEditPoskamlingLokasi(e.target.value)}
                        placeholder="Misal: Pos Ronda Jl. Bunga Rinte"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                        Petugas / Warga Jaga
                      </label>
                      <input
                        type="text"
                        value={editPoskamlingPetugas}
                        onChange={(e) => setEditPoskamlingPetugas(e.target.value)}
                        placeholder="Misal: Kepling & 3 Warga"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                        Catatan Situasi Kamtibmas
                      </label>
                      <input
                        type="text"
                        value={editPoskamlingKet}
                        onChange={(e) => setEditPoskamlingKet(e.target.value)}
                        placeholder="Misal: Lingkungan aman dan kondusif"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-slate-700">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {item.kinerja?.poskamlingLokasi && (
                      <p>
                        📍 <strong>Lokasi:</strong> {item.kinerja.poskamlingLokasi}
                      </p>
                    )}
                    {item.kinerja?.poskamlingPetugas && (
                      <p>
                        👮 <strong>Petugas/Warga:</strong> {item.kinerja.poskamlingPetugas}
                      </p>
                    )}
                  </div>
                  <p className="text-slate-600">
                    📝 <strong>Situasi:</strong>{' '}
                    {item.kinerja?.poskamlingKeterangan || 'Situasi lingkungan aman dan kondusif.'}
                  </p>
                </div>
              )}
            </div>

            {/* 6. Kegiatan Lapangan Lainnya */}
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <span className="font-bold text-slate-700 block mb-1">6. Kegiatan Lapangan Lainnya / Catatan:</span>
              {isEditing ? (
                <textarea
                  rows={3}
                  value={editKegiatanLainnya}
                  onChange={(e) => setEditKegiatanLainnya(e.target.value)}
                  placeholder="Pemantauan kebersihan lingkungan, penanganan drainase, dll..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-emerald-500"
                />
              ) : (
                <p className="text-slate-600">{item.kinerja?.kegiatanLainnya || 'Tidak ada kegiatan tambahan.'}</p>
              )}
            </div>
          </div>

          {/* Attached photos */}
          {item.dokumentasiFoto && item.dokumentasiFoto.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  📷 <span>Dokumentasi Lapangan Terlampir ({item.dokumentasiFoto.length} foto)</span>
                </span>
                <button
                  type="button"
                  onClick={handleDownloadAllPhotos}
                  disabled={isDownloadingAll}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  title="Unduh seluruh file foto ke komputer / HP"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{isDownloadingAll ? 'Mengunduh...' : `Unduh Semua Foto (${item.dokumentasiFoto.length})`}</span>
                </button>
              </div>

              <div className="space-y-4">
                {groupPhotosByActivity(item.dokumentasiFoto).map((group) => (
                  <div key={group.key} className="space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${group.badgeBg} ${group.textClr} border ${group.borderClr}`}>
                          {group.title}
                        </span>
                      </h4>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {group.photos.length} Foto
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {group.photos.map((foto, idx) => (
                        <div
                          key={foto.id || idx}
                          className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs group relative cursor-pointer flex items-center justify-center p-1"
                          onClick={() => setPreviewPhoto({ url: foto.url, name: foto.name || `Foto ${idx + 1}` })}
                        >
                          <img
                            src={foto.url}
                            alt={foto.name}
                            className="w-full h-full object-contain object-center group-hover:scale-105 transition-transform"
                          />

                          {/* Hover Overlay with Action Buttons */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2 z-10">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewPhoto({ url: foto.url, name: foto.name || `Foto ${idx + 1}` });
                              }}
                              className="p-1.5 bg-white/90 hover:bg-white text-slate-900 rounded-lg shadow-sm hover:scale-110 transition-transform cursor-pointer"
                              title="Lihat foto penuh"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDownloadPhoto(foto.url, foto.name || `Foto_${idx + 1}.jpg`, e)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm hover:scale-110 transition-transform cursor-pointer"
                              title="Download file foto ini"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>

                          <span className="absolute bottom-0 inset-x-0 bg-black/75 text-white text-[9px] px-1.5 py-0.5 truncate text-center pointer-events-none">
                            {foto.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {showDeleteConfirm ? (
          <div className="p-4 bg-rose-50 border-t border-rose-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs w-full animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5 text-rose-900 font-medium">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>
                Yakin ingin menghapus laporan <strong>{item.namaKepling}</strong> ({item.jabatan}) tanggal <strong>{displayTanggal || item.tanggal}</strong>? Data akan terhapus permanen dari sistem & database.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md shadow-rose-200 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Sekarang'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            {isEditing ? (
              <div className="flex items-center justify-between w-full">
                {onDeleteReport && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    title="Hapus laporan ini dari database"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>{isDeleting ? 'Menghapus...' : 'Hapus Laporan'}</span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {isAdmin && onDeleteReport && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                      title="Hapus laporan ini dari sistem dan database"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Hapus Laporan</span>
                    </button>
                  )}

                  {sheetMeta?.spreadsheetUrl && (
                    <a
                      href={sheetMeta.spreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-emerald-800 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Google Sheets</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  {pdfStatusMsg && (
                    <div className="w-full sm:w-auto px-3 py-1.5 bg-emerald-100/80 border border-emerald-300 text-emerald-900 rounded-lg flex items-center gap-2 text-xs font-bold animate-pulse">
                      <div className="w-3 h-3 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>{pdfStatusMsg}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    disabled={isExportingPDF}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    title="Unduh file PDF secara langsung ke memori HP / Komputer"
                  >
                    <Download className="w-3.5 h-3.5 text-white" />
                    <span>{isExportingPDF ? 'Mengunduh PDF...' : 'Unduh File PDF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    title="Cetak Dokumen Resmi Kedinasan 1 Lembar A4 / Simpan PDF Browser"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Cetak / Simpan PDF</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {onUpdateReport && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(true);
                        setShowPrintPreview(false);
                      }}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      title="Edit / perbarui rincian laporan ini"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Laporan</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="flex-1 sm:flex-none px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div
        id="lembar-cetak-laporan-kepling"
        className="hidden print:block bg-white text-slate-900 w-[190mm] mx-auto font-serif text-[8pt] leading-tight"
        style={{ paddingTop: '8px', paddingLeft: '4px', paddingRight: '4px' }}
      >
        {/* ================= HALAMAN 1 : LAPORAN UTAMA ================= */}
        <div className="page-print-single" style={{ minHeight: '265mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {/* KOP SURAT RESMI PEMERINTAH KOTA MEDAN */}
            <div
              className="flex items-center gap-3.5 pb-2 border-b-[3px] border-black mb-2.5"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                borderBottom: '3px solid #000000',
                paddingTop: '2px',
                paddingBottom: '8px',
                marginBottom: '10px',
              }}
            >
              <img
                src="/logo_pemko_medan.png"
                alt="Logo Pemko Medan"
                crossOrigin="anonymous"
                className="shrink-0"
                style={{
                  width: '74px',
                  height: '89px',
                  minWidth: '74px',
                  maxWidth: '74px',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
              <div className="text-center flex-1" style={{ flex: 1, textAlign: 'center', paddingRight: '74px' }}>
                <div
                  className="text-[12.5pt] uppercase font-sans text-black font-bold tracking-[0.04em]"
                  style={{ fontSize: '12.5pt', fontWeight: 'bold', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.25', marginBottom: '2px' }}
                >
                  PEMERINTAH KOTA MEDAN
                </div>
                <div
                  className="text-[12.5pt] uppercase font-sans text-black font-bold tracking-[0.04em]"
                  style={{ fontSize: '12.5pt', fontWeight: 'bold', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.25', marginBottom: '3px' }}
                >
                  KECAMATAN MEDAN TUNTUNGAN
                </div>
                <div
                  className="text-[16.5pt] font-black uppercase font-sans text-black tracking-[0.05em]"
                  style={{ fontSize: '16.5pt', fontWeight: '900', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.2', marginBottom: '4px' }}
                >
                  KELURAHAN MANGGA
                </div>
                <div
                  className="text-[8.5pt] text-black font-sans"
                  style={{ fontSize: '8.5pt', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.35', marginBottom: '1.5px' }}
                >
                  Jalan Tembakau Raya No. 35 A P. Simalingkar - Medan
                </div>
                <div
                  className="text-[8pt] text-slate-800 font-sans"
                  style={{ fontSize: '8pt', fontFamily: 'sans-serif', color: '#1e293b', lineHeight: '1.35' }}
                >
                  Laman kel.mangga@pemkomedan.go.id
                </div>
              </div>
            </div>

            {/* JUDUL LAPORAN */}
            <div className="text-center my-2.5" style={{ textAlign: 'center', margin: '8px 0' }}>
              <h1
                className="text-[11.5pt] font-black uppercase tracking-[0.04em] underline font-serif"
                style={{ fontSize: '11.5pt', fontWeight: 'bold', textDecoration: 'underline', textTransform: 'uppercase', fontFamily: "'Times New Roman', Times, serif" }}
              >
                LAPORAN KEGIATAN HARIAN KEPALA LINGKUNGAN
              </h1>
              <div
                className="text-[8.5pt] font-serif mt-1"
                style={{ fontSize: '8.5pt', fontFamily: "'Times New Roman', Times, serif", marginTop: '3px' }}
              >
                <span style={{ fontWeight: 'bold' }}>Hari:</span> {(item?.hari || '').toUpperCase()} &nbsp;&nbsp;|&nbsp;&nbsp; <span style={{ fontWeight: 'bold' }}>Tanggal:</span> {displayTanggal.toUpperCase()}
              </div>
            </div>

            {/* DATA IDENTITAS PETUGAS */}
            <div
              className="mb-2 text-[8.5pt] font-sans bg-white p-2 rounded-lg border border-slate-300"
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '6px 12px',
                marginBottom: '8px',
                fontFamily: 'sans-serif',
                fontSize: '8.5pt',
                backgroundColor: '#ffffff',
              }}
            >
              <table className="w-full text-left" style={{ width: '100%', textAlign: 'left' }}>
                <tbody>
                  <tr>
                    <td className="w-32 font-bold py-0.5 text-slate-800" style={{ width: '125px', fontWeight: 'bold', padding: '2px 0', color: '#1e293b' }}>Nama Petugas</td>
                    <td className="w-4 font-bold" style={{ width: '14px', fontWeight: 'bold' }}>:</td>
                    <td className="font-bold uppercase text-slate-900" style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a' }}>{item?.namaKepling || ''}</td>
                    <td className="w-24 font-bold py-0.5 text-slate-800" style={{ width: '90px', fontWeight: 'bold', padding: '2px 0', color: '#1e293b' }}>Kelurahan</td>
                    <td className="w-4 font-bold" style={{ width: '14px', fontWeight: 'bold' }}>:</td>
                    <td className="text-slate-900" style={{ color: '#0f172a' }}>{item?.kelurahan || 'Kelurahan Mangga'}</td>
                  </tr>
                  <tr>
                    <td className="font-bold py-0.5 text-slate-800" style={{ fontWeight: 'bold', padding: '2px 0', color: '#1e293b' }}>Jabatan / Wilayah</td>
                    <td className="font-bold" style={{ fontWeight: 'bold' }}>:</td>
                    <td className="font-bold text-slate-900" style={{ fontWeight: 'bold', color: '#0f172a' }}>{item?.jabatan || ''}</td>
                    <td className="font-bold py-0.5 text-slate-800" style={{ fontWeight: 'bold', padding: '2px 0', color: '#1e293b' }}>Kecamatan</td>
                    <td className="font-bold" style={{ fontWeight: 'bold' }}>:</td>
                    <td className="text-slate-900" style={{ color: '#0f172a' }}>{item?.kecamatan || 'Kecamatan Medan Tuntungan'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* TABEL REKAPITULASI KINERJA & TUGAS HARIAN */}
            <div className="mb-2" style={{ marginBottom: '8px' }}>
              <div
                className="text-[8.5pt] font-bold font-sans uppercase tracking-wider mb-1 text-slate-900"
                style={{ fontSize: '8.5pt', fontWeight: 'bold', fontFamily: 'sans-serif', textTransform: 'uppercase', marginBottom: '4px', color: '#0f172a' }}
              >
                A. REKAPITULASI CAPAIAN & KEGIATAN HARIAN:
              </div>
              <table
                className="print-table w-full text-left text-[8pt] font-sans border-[1.5px] border-black"
                style={{ width: '100%', textAlign: 'left', fontSize: '8pt', fontFamily: 'sans-serif', borderCollapse: 'collapse', border: '1.5px solid #000000' }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#ffffff', color: '#000000', fontWeight: 'bold' }}>
                    <th style={{ border: '1px solid #000000', width: '32px', textAlign: 'center', padding: '4px 2px' }}>NO</th>
                    <th style={{ border: '1px solid #000000', width: '210px', padding: '4px 6px' }}>URAIAN KEGIATAN KINERJA</th>
                    <th style={{ border: '1px solid #000000', width: '105px', textAlign: 'center', padding: '4px 2px' }}>REALISASI</th>
                    <th style={{ border: '1px solid #000000', padding: '4px 6px' }}>KETERANGAN / RINCIAN LAPANGAN</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', fontWeight: 'bold', padding: '3px 2px' }}>1</td>
                    <td style={{ border: '1px solid #000000', fontWeight: 'bold', padding: '3px 6px' }}>Opsir Pajak Bumi & Bangunan (PBB)</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', fontWeight: 'bold', padding: '3px 2px' }}>
                      {item.kinerja?.opsirPbbWp || 0} WP
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '3px 6px' }}>{item.kinerja?.opsirPbbKeterangan || 'Pembayaran PBB'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', fontWeight: 'bold', padding: '3px 2px' }}>2</td>
                    <td style={{ border: '1px solid #000000', fontWeight: 'bold', padding: '3px 6px' }}>Perlindungan Sosial (PERLINSOS)</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', fontWeight: 'bold', padding: '3px 2px' }}>
                      {item.kinerja?.perlinsosKk || 0} KK
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '3px 6px' }}>
                      <div>{item.kinerja?.perlinsosKeterangan || 'Pendataan Perlinsos'}</div>
                      {item.kinerja?.perlinsosMenolakKk && String(item.kinerja.perlinsosMenolakKk) !== '0' && (
                        <div style={{ marginTop: '2px', fontSize: '7.5pt', color: '#9f1239', fontFamily: 'sans-serif', lineHeight: '1.2' }}>
                          <strong>• Menolak ({item.kinerja.perlinsosMenolakKk} KK):</strong> {item.kinerja.perlinsosMenolakRincian || '-'}
                        </div>
                      )}
                      {item.kinerja?.perlinsosTidakDiTempatKk && String(item.kinerja.perlinsosTidakDiTempatKk) !== '0' && (
                        <div style={{ marginTop: '2px', fontSize: '7.5pt', color: '#1e293b', fontFamily: 'sans-serif', lineHeight: '1.2' }}>
                          <strong>• Tidak Di Tempat ({item.kinerja.perlinsosTidakDiTempatKk} KK):</strong> {item.kinerja.perlinsosTidakDiTempatRincian || '-'}
                        </div>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', fontWeight: 'bold', padding: '3px 2px' }}>3</td>
                    <td style={{ border: '1px solid #000000', fontWeight: 'bold', padding: '3px 6px' }}>Identitas Kependudukan Digital (IKD)</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', fontWeight: 'bold', padding: '3px 2px' }}>
                      {item.kinerja?.ikdOrang || 0} Orang
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '3px 6px' }}>{item.kinerja?.ikdKeterangan || 'Aktivasi aplikasi IKD Dukcapil'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', fontWeight: 'bold', padding: '3px 2px' }}>4</td>
                    <td style={{ border: '1px solid #000000', fontWeight: 'bold', padding: '3px 6px' }}>BPJS Ketenagakerjaan (Pekerja Rentan)</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', fontWeight: 'bold', padding: '3px 2px' }}>
                      {item.kinerja?.bpjsKetenagakerjaanOrang || 0} Orang
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '3px 6px' }}>{item.kinerja?.bpjsKetenagakerjaanKeterangan || 'Sosialisasi pekerja rentan'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', fontWeight: 'bold', padding: '3px 2px' }}>5</td>
                    <td style={{ border: '1px solid #000000', fontWeight: 'bold', padding: '3px 6px' }}>Pos Ronda / SISKAMLING</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', fontWeight: 'bold', padding: '3px 2px' }}>
                      {item.kinerja?.poskamlingStatus || 'Aktif Ronda Malam'}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '3px 6px' }}>
                      {item.kinerja?.poskamlingLokasi ? `Lokasi: ${item.kinerja.poskamlingLokasi}. ` : ''}
                      {item.kinerja?.poskamlingPetugas ? `Petugas: ${item.kinerja.poskamlingPetugas}. ` : ''}
                      {item.kinerja?.poskamlingKeterangan || 'Patroli siskamling lingkungan kondusif dan aman'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', fontWeight: 'bold', padding: '3px 2px' }}>6</td>
                    <td style={{ border: '1px solid #000000', fontWeight: 'bold', padding: '3px 6px' }}>Kegiatan Kebersihan & Lainnya</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', fontWeight: 'bold', padding: '3px 2px' }}>Terlaksana</td>
                    <td style={{ border: '1px solid #000000', padding: '3px 6px' }}>{item.kinerja?.kegiatanLainnya || 'Pemantauan kebersihan lingkungan dan drainase warga'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* DOKUMENTASI FOTO KEGIATAN - JIKA FOTO <= 3 (TAMPIL BESAR DI HALAMAN 1) */}
            {item.dokumentasiFoto && item.dokumentasiFoto.length > 0 && item.dokumentasiFoto.length <= 3 && (
              <div className="mb-2 avoid-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid', marginBottom: '10px' }}>
                <div
                  className="text-[8.5pt] font-bold font-sans uppercase tracking-wider mb-1 text-slate-900"
                  style={{ fontSize: '8.5pt', fontWeight: 'bold', fontFamily: 'sans-serif', textTransform: 'uppercase', marginBottom: '6px', color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>B. DOKUMENTASI LAPANGAN TERLAMPIR ({item.dokumentasiFoto.length} FOTO):</span>
                  <span style={{ fontSize: '7pt', color: '#64748b', fontWeight: 'normal', textTransform: 'none' }}>Format Album Resmi Kedinasan</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {groupPhotosByActivity(item.dokumentasiFoto).map((group) => (
                    <div key={group.key}>
                      <div style={{ fontSize: '7.5pt', fontWeight: 'bold', fontFamily: 'sans-serif', textTransform: 'uppercase', marginBottom: '4px', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px' }}>
                        • {group.title} ({group.photos.length} Foto)
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          columnGap: '10px',
                          rowGap: '8px',
                        }}
                      >
                        {group.photos.map((foto, idx) => (
                          <div
                            key={foto.id || idx}
                            className="rounded border border-slate-300 p-1.5 bg-white flex flex-col items-center avoid-break"
                            style={{
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '5px',
                              backgroundColor: '#ffffff',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              pageBreakInside: 'avoid',
                              breakInside: 'avoid',
                            }}
                          >
                            <div
                              className="w-full rounded overflow-hidden bg-slate-100 flex items-center justify-center"
                              style={{
                                width: '100%',
                                height: '185px',
                                borderRadius: '4px',
                                overflow: 'hidden',
                                backgroundColor: '#f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '2px',
                              }}
                            >
                              <img
                                src={foto.url}
                                alt={getProperFotoLabel(foto, idx)}
                                crossOrigin="anonymous"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'contain',
                                  objectPosition: 'center',
                                  display: 'block',
                                }}
                              />
                            </div>
                            <div
                              className="text-[7.5pt] text-slate-800 font-bold mt-1.5 truncate w-full text-center font-sans"
                              style={{
                                fontSize: '7.5pt',
                                fontWeight: 'bold',
                                color: '#1e293b',
                                marginTop: '4px',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                width: '100%',
                                textAlign: 'center',
                                fontFamily: 'sans-serif',
                              }}
                              title={getProperFotoLabel(foto, idx)}
                            >
                              {getProperFotoLabel(foto, idx)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* JIKA FOTO > 3: KETERANGAN LAMPIRAN DI HALAMAN 1 */}
            {item.dokumentasiFoto && item.dokumentasiFoto.length > 3 && (
              <div
                className="mb-3 avoid-break"
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  backgroundColor: '#f8fafc',
                  fontSize: '8pt',
                  fontFamily: 'sans-serif',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <strong>B. DOKUMENTASI LAPANGAN TERLAMPIR:</strong> Sebanyak <strong>{item.dokumentasiFoto.length} Foto Dokumentasi</strong> dicantumkan lengkap pada <strong>Lembar Lampiran (Halaman 2)</strong>.
                </div>
                <span style={{ fontSize: '7pt', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>2 Halaman Dokumen</span>
              </div>
            )}
          </div>

          <div>
            {/* TANDA TANGAN RESMI PENGESAHAN DOKUMEN */}
            <div
              className="mt-3 pt-1 avoid-break text-[8.5pt] font-sans"
              style={{
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
                marginTop: '12px',
                paddingTop: '2px',
                fontFamily: 'sans-serif',
                fontSize: '8.5pt',
              }}
            >
              <div
                className="flex justify-end pr-4"
                style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '16px' }}
              >
                <div
                  className="text-center flex flex-col items-center min-w-[220px]"
                  style={{
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: '220px',
                  }}
                >
                  <div>Medan, {displayTanggal.toUpperCase()}</div>
                  <div className="mt-0.5">Yang Melaporkan,</div>
                  <div className="font-bold uppercase whitespace-nowrap" style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {(item?.jabatan || '').toUpperCase()}
                  </div>
                  <div style={{ height: '42px' }} />
                  <div className="font-bold underline uppercase whitespace-nowrap" style={{ fontWeight: 'bold', textDecoration: 'underline', textTransform: 'uppercase' }}>
                    ( {item?.namaKepling || ''} )
                  </div>
                  <div className="text-[7.5pt] text-slate-700 mt-0.5" style={{ fontSize: '7.5pt', color: '#334155' }}>Kepala Lingkungan</div>
                </div>
              </div>
            </div>

            {/* FOOTER RESMI DOKUMEN HALAMAN 1 */}
            <div
              className="mt-3 pt-1 border-t border-slate-300 flex items-center justify-between text-[6.5pt] text-slate-500 italic avoid-break font-sans"
              style={{
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
                borderTop: '1px solid #cbd5e1',
                marginTop: '10px',
                paddingTop: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '6.5pt',
                color: '#64748b',
                fontStyle: 'italic',
                fontFamily: 'sans-serif',
              }}
            >
              <span>SISTEM KINERJA KEPALA LINGKUNGAN KELURAHAN MANGGA • Sistem Informasi Pelaporan Kinerja Harian Kepling</span>
              <span>Dokumen Resmi {item.dokumentasiFoto && item.dokumentasiFoto.length > 3 ? 'Halaman 1 dari 2' : '1 Lembar'} • Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* ================= HALAMAN 2 : LEMBAR LAMPIRAN FOTO (JIKA FOTO > 3) ================= */}
        {item.dokumentasiFoto && item.dokumentasiFoto.length > 3 && (
          <div
            className="page-print-single"
            style={{
              pageBreakBefore: 'always',
              breakBefore: 'page',
              minHeight: '265mm',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              paddingTop: '14px',
            }}
          >
            <div>
              {/* HEADER KOP LAMPIRAN RESMI */}
              <div
                style={{
                  textAlign: 'center',
                  borderBottom: '2px solid #000000',
                  paddingBottom: '8px',
                  marginBottom: '12px',
                }}
              >
                <h2
                  style={{
                    fontSize: '11.5pt',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontFamily: 'serif',
                    margin: 0,
                  }}
                >
                  LAMPIRAN DOKUMENTASI KEGIATAN LAPANGAN
                </h2>
                <div style={{ fontSize: '8.5pt', fontFamily: 'serif', color: '#1e293b', marginTop: '2px' }}>
                  KEPALA LINGKUNGAN KELURAHAN MANGGA KECAMATAN MEDAN TUNTUNGAN
                </div>
                <div style={{ fontSize: '8pt', fontFamily: 'sans-serif', color: '#475569', marginTop: '4px' }}>
                  <strong>Hari:</strong> {(item.hari || '').toUpperCase()} &nbsp;|&nbsp; <strong>Tanggal:</strong> {displayTanggal.toUpperCase()} &nbsp;|&nbsp; <strong>Petugas:</strong> {item.namaKepling || ''} ({(item.jabatan || '').toUpperCase()})
                </div>
              </div>

              {/* GRID FOTO LAMPIRAN TERKELOMPOK PER KEGIATAN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
                {groupPhotosByActivity(item.dokumentasiFoto).map((group) => (
                  <div key={group.key} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <div style={{ fontSize: '8.5pt', fontWeight: 'bold', fontFamily: 'sans-serif', textTransform: 'uppercase', marginBottom: '6px', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
                      • {group.title} ({group.photos.length} Foto)
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        columnGap: '12px',
                        rowGap: '10px',
                      }}
                    >
                      {group.photos.map((foto, idx) => (
                        <div
                          key={foto.id || idx}
                          style={{
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px',
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            pageBreakInside: 'avoid',
                            breakInside: 'avoid',
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: '185px',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              backgroundColor: '#f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '2px',
                            }}
                          >
                            <img
                              src={foto.url}
                              alt={getProperFotoLabel(foto, idx)}
                              crossOrigin="anonymous"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                objectPosition: 'center',
                                display: 'block',
                              }}
                            />
                          </div>
                          <div
                            style={{
                              fontSize: '8pt',
                              fontWeight: 'bold',
                              color: '#1e293b',
                              marginTop: '5px',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              width: '100%',
                              textAlign: 'center',
                              fontFamily: 'sans-serif',
                            }}
                            title={getProperFotoLabel(foto, idx)}
                          >
                            {getProperFotoLabel(foto, idx)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              {/* TANDA TANGAN PENGESAHAN LAMPIRAN */}
              <div
                style={{
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                  marginTop: '10px',
                  fontFamily: 'sans-serif',
                  fontSize: '8.5pt',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '16px' }}>
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '220px' }}>
                    <div>Medan, {displayTanggal.toUpperCase()}</div>
                    <div style={{ marginTop: '2px' }}>Kepala Lingkungan Pelapor,</div>
                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{(item?.jabatan || '').toUpperCase()}</div>
                    <div style={{ height: '36px' }} />
                    <div style={{ fontWeight: 'bold', textDecoration: 'underline', textTransform: 'uppercase' }}>
                      ( {item?.namaKepling || ''} )
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER HALAMAN 2 */}
              <div
                style={{
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                  borderTop: '1px solid #cbd5e1',
                  marginTop: '10px',
                  paddingTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '6.5pt',
                  color: '#64748b',
                  fontStyle: 'italic',
                  fontFamily: 'sans-serif',
                }}
              >
                <span>LAMPIRAN RESMI DOKUMENTASI KEGIATAN KEPALA LINGKUNGAN</span>
                <span>Halaman 2 dari 2 • Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox / Pratinjau & Download Foto Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 print:hidden"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white">
              <span className="font-bold text-xs truncate max-w-[70%]">{previewPhoto.name}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPhoto(previewPhoto.url, previewPhoto.name)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Gambar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPhoto(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-3 max-h-[75vh] flex items-center justify-center bg-black/90 overflow-auto">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.name}
                className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
