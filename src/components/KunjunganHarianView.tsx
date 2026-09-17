import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  Search,
  Printer,
  Trash2,
  CheckCircle2,
  Camera,
  Share2,
  Plus,
  Download,
  FileSpreadsheet,
  ExternalLink,
  Eye,
  X,
  Layers,
  MapPin,
  Clock,
  Check,
  Send,
} from 'lucide-react';
import { UserAccount, isKelurahanAdmin } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { FormKunjunganWarga, KunjunganWargaData } from './FormKunjunganWarga';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { downloadImage, downloadMultipleImages } from '../lib/imageDownloader';
import { exportKunjunganWargaToExcel } from '../lib/excelExport';

interface KunjunganHarianViewProps {
  currentUser: UserAccount;
  onNavigateToForm?: () => void;
}

export const KunjunganHarianView: React.FC<KunjunganHarianViewProps> = ({
  currentUser,
}) => {
  const isAdmin = isKelurahanAdmin(currentUser.role);
  const isSuperAdmin = currentUser.role === 'super_admin';
  const todayStr = new Date().toISOString().split('T')[0];

  const [records, setRecords] = useState<KunjunganWargaData[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedLingkungan, setSelectedLingkungan] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(true);
  const [copiedWA, setCopiedWA] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isSharingExcel, setIsSharingExcel] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // View mode for mobile (cards vs table)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  // Photo Lightbox Modal
  const [previewPhotoItem, setPreviewPhotoItem] = useState<KunjunganWargaData | null>(null);
  const [isBatchDownloading, setIsBatchDownloading] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Real-time listener dari Firestore collection 'kunjungan_warga'
  useEffect(() => {
    // 1. Load initial dari cache lokal
    try {
      const localRaw = localStorage.getItem('sikepling_kunjungan_harian_list_v1');
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (Array.isArray(parsed)) {
          const map = new Map<string, KunjunganWargaData>();
          parsed.forEach((item: KunjunganWargaData) => {
            if (item && item.id && !map.has(item.id)) {
              map.set(item.id, item);
            }
          });
          setRecords(Array.from(map.values()));
        }
      }
    } catch {}

    // 2. Realtime listener Firestore
    if (!db) return;
    try {
      const q = query(collection(db, 'kunjungan_warga'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const map = new Map<string, KunjunganWargaData>();
          snapshot.forEach((d) => {
            const data = d.data() as KunjunganWargaData;
            if (data && data.id && !map.has(data.id)) {
              map.set(data.id, data);
            }
          });
          const list = Array.from(map.values());
          setRecords(list);
          localStorage.setItem('sikepling_kunjungan_harian_list_v1', JSON.stringify(list));
        },
        (err) => {
          console.warn('Firestore snapshot error:', err);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn('Error subscribing to kunjungan_warga:', e);
    }
  }, []);

  const handleDelete = async (id: string, namaWarga: string) => {
    if (!window.confirm(`Hapus catatan kunjungan ke ${namaWarga}?`)) return;
    try {
      if (db) {
        await deleteDoc(doc(db, 'kunjungan_warga', id));
      }
      setRecords((prev) => {
        const updated = prev.filter((r) => r.id !== id);
        localStorage.setItem('sikepling_kunjungan_harian_list_v1', JSON.stringify(updated));
        return updated;
      });
      showToast(`Catatan kunjungan ke ${namaWarga} berhasil dihapus.`);
    } catch (e) {
      alert('Gagal menghapus: ' + e);
    }
  };

  // Filter records
  const filtered = records.filter((r) => {
    const isDate = !selectedDate || r.tanggal === selectedDate;
    const isLingkungan =
      selectedLingkungan === 'ALL' ||
      r.lingkunganNomor === Number(selectedLingkungan) ||
      r.keplingId === selectedLingkungan;
    const isRole = isAdmin || r.keplingId === currentUser.id;
    const isSearch =
      !searchQuery.trim() ||
      r.namaWarga.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.alamat.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.lingkungan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.namaKepling.toLowerCase().includes(searchQuery.toLowerCase());
    return isDate && isLingkungan && isRole && isSearch;
  });

  const photosCount = filtered.filter((r) => Boolean(r.fotoDokumentasi)).length;

  const handleCopyWA = () => {
    let text = `*REKAP KUNJUNGAN HARIAN DOOR-TO-DOOR*\n`;
    text += `*KELURAHAN MANGGA, KEC. MEDAN TUNTUNGAN*\n`;
    text += `Hari/Tanggal: ${selectedDate || 'Semua Tanggal'}\n`;
    text += `Total Kunjungan: ${filtered.length} Rumah\n\n`;
    text += `----------------------------------------\n`;

    filtered.forEach((item, index) => {
      text += `${index + 1}. *${item.namaWarga}*\n`;
      text += `   - Alamat: ${item.alamat} (${item.lingkungan})\n`;
      text += `   - Kepling: ${item.namaKepling}\n`;
      text += `   - Keterangan: ${item.keterangan}\n\n`;
    });

    navigator.clipboard.writeText(text);
    setCopiedWA(true);
    showToast('Teks rekapitulasi kunjungan berhasil disalin ke WhatsApp!');
    setTimeout(() => setCopiedWA(false), 2500);
  };

  // Download Single Photo Handler
  const handleDownloadPhoto = async (item: KunjunganWargaData) => {
    if (!item.fotoDokumentasi) return;
    const safeName = item.namaWarga.replace(/[^a-zA-Z0-9]/g, '_');
    const safeLingk = item.lingkungan.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Kunjungan_${safeName}_${safeLingk}_${item.tanggal}.jpg`;

    const ok = await downloadImage(item.fotoDokumentasi, fileName);
    if (ok) {
      showToast(`Foto kunjungan ${item.namaWarga} berhasil diunduh.`);
    } else {
      showToast(`Gagal mengunduh foto ${item.namaWarga}.`);
    }
  };

  // Batch Download All Photos for Admin
  const handleBatchDownloadPhotos = async () => {
    const itemsWithPhotos = filtered.filter((r) => Boolean(r.fotoDokumentasi));
    if (itemsWithPhotos.length === 0) {
      alert('Tidak ada foto dokumentasi untuk diunduh pada filter ini.');
      return;
    }

    if (
      !window.confirm(
        `Unduh seluruh ${itemsWithPhotos.length} foto kunjungan warga pada tanggal ${selectedDate}?`
      )
    ) {
      return;
    }

    setIsBatchDownloading(true);
    setBatchProgress({ current: 0, total: itemsWithPhotos.length });

    const photoList = itemsWithPhotos.map((item, idx) => {
      const safeName = item.namaWarga.replace(/[^a-zA-Z0-9]/g, '_');
      const safeLingk = item.lingkungan.replace(/[^a-zA-Z0-9]/g, '_');
      return {
        url: item.fotoDokumentasi!,
        fileName: `${idx + 1}_Kunjungan_${safeLingk}_${safeName}_${item.tanggal}.jpg`,
      };
    });

    const successCount = await downloadMultipleImages(photoList, (curr, tot) => {
      setBatchProgress({ current: curr, total: tot });
    });

    setIsBatchDownloading(false);
    setBatchProgress(null);
    showToast(`Berhasil mengunduh ${successCount} dari ${photoList.length} foto kunjungan.`);
  };

  // Excel Export Handler (Download)
  const handleExportExcel = async () => {
    if (filtered.length === 0) {
      alert('Tidak ada data untuk diexport ke Excel.');
      return;
    }
    setIsExportingExcel(true);
    try {
      await exportKunjunganWargaToExcel(filtered, selectedDate, false);
      showToast('File Excel kunjungan warga berhasil diunduh.');
    } catch (e) {
      console.error(e);
      alert('Gagal membuat file Excel: ' + e);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Excel Share Handler (Web Share API to WhatsApp/Telegram/Email)
  const handleShareExcel = async () => {
    if (filtered.length === 0) {
      alert('Tidak ada data untuk dibagikan.');
      return;
    }
    setIsSharingExcel(true);
    try {
      const result = await exportKunjunganWargaToExcel(filtered, selectedDate, true);
      if (result.method === 'share' && result.success) {
        showToast('Berhasil membuka menu share ke WhatsApp / Aplikasi HP!');
      } else {
        showToast('File Excel siap diunduh & teks rekapitulasi tersalin.');
      }
    } catch (e) {
      console.error(e);
      alert('Gagal membagikan Excel: ' + e);
    } finally {
      setIsSharingExcel(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner Halaman - Mobile Proportional */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 sm:p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-700 shrink-0">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Buku Kunjungan Harian Lapangan (Door-to-Door)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase">
                {filtered.length} Kunjungan
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Pencatatan langsung sambang warga Kelurahan Mangga tersimpan ke Firestore koleksi: <code>kunjungan_warga</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? 'Tutup Form Input' : '+ Input Kunjungan'}</span>
          </button>
        </div>
      </div>

      {/* Komponen Form Kunjungan Warga */}
      {showAddForm && (
        <FormKunjunganWarga
          currentUser={currentUser}
          tanggalLaporan={selectedDate}
          onSuccess={() => {
            showToast('Catatan kunjungan baru berhasil disimpan!');
          }}
        />
      )}

      {/* Filter & Action Controls - Responsive & Proportional for HP */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-xs space-y-3">
        {/* Row 1: Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Tanggal Picker */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 flex-1 sm:flex-initial">
              <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer w-full sm:w-auto text-xs"
              />
            </div>

            {/* Filter Lingkungan (Super Admin & Kasi) */}
            {isAdmin && (
              <select
                value={selectedLingkungan}
                onChange={(e) => setSelectedLingkungan(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 focus:outline-none flex-1 sm:flex-initial"
              >
                <option value="ALL">Semua 24 Lingkungan</option>
                {KEPLING_ACCOUNTS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.lingkungan} - {k.nama}
                  </option>
                ))}
              </select>
            )}

            {/* Search Input */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs w-full sm:w-48 lg:w-60">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Cari nama warga, alamat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent focus:outline-none w-full text-slate-800 placeholder:text-slate-400 text-xs font-medium"
              />
            </div>
          </div>

          {/* View Mode Toggle (Mobile / Tablet) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tabel
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Kartu (HP)
            </button>
          </div>
        </div>

        {/* Row 2: Action Buttons (Excel, Share, Download Photos, WA, Print) */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          {/* Photos summary & batch download for Admin */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">
              Dokumentasi: <strong className="text-slate-800">{photosCount} foto</strong> dari {filtered.length} kunjungan
            </span>
            {isAdmin && photosCount > 0 && (
              <button
                type="button"
                onClick={handleBatchDownloadPhotos}
                disabled={isBatchDownloading}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                title="Download seluruh foto dokumentasi kunjungan hari ini sekaligus"
              >
                <Download className="w-3 h-3 text-teal-700" />
                <span>
                  {isBatchDownloading
                    ? `Mengunduh (${batchProgress?.current}/${batchProgress?.total})...`
                    : 'Unduh Semua Foto'}
                </span>
              </button>
            )}
          </div>

          {/* Export & Sharing Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-end">
            {/* Share / Bagikan Excel ke WA / HP */}
            <button
              type="button"
              onClick={handleShareExcel}
              disabled={isSharingExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer flex-1 sm:flex-initial justify-center"
              title="Bagikan file Excel langsung ke WhatsApp / HP"
            >
              <Send className="w-3.5 h-3.5 text-emerald-200" />
              <span>{isSharingExcel ? 'Menyiapkan...' : 'Share Excel'}</span>
            </button>

            {/* Unduh File Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl font-bold text-xs shadow-2xs transition-all cursor-pointer flex-1 sm:flex-initial justify-center"
              title="Unduh tabel kunjungan ke format Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isExportingExcel ? 'Exporting...' : 'Unduh .xlsx'}</span>
            </button>

            {/* Salin Format Teks WA */}
            <button
              type="button"
              onClick={handleCopyWA}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs shadow-2xs cursor-pointer"
              title="Salin ringkasan teks untuk dikirim ke grup WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-600" />
              <span>{copiedWA ? 'Tersalin!' : 'Salin WA'}</span>
            </button>

            {/* Cetak Tabel */}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
              title="Cetak tabel kunjungan ke PDF atau printer fisik"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cetak Tabel</span>
              <span className="sm:hidden">Cetak</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: MOBILE CARDS VIEW (PROPORTIONAL FOR HP KEPLING) */}
      {viewMode === 'cards' ? (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 font-medium">
              Belum ada catatan kunjungan pada tanggal {selectedDate}. Gunakan formulir di atas untuk menambahkan.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filtered.map((item, index) => (
                <div
                  key={`${item.id}_card_${index}`}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {index + 1}
                      </span>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm leading-tight">
                          {item.namaWarga}
                        </h4>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          {item.lingkungan} • {item.namaKepling}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[10.5px] uppercase shrink-0 ${
                        item.keterangan === 'Sudah'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : item.keterangan === 'Belum'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : item.keterangan === 'Menolak'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {item.keterangan}
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-slate-700 flex items-start gap-2 border border-slate-100">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed font-medium">{item.alamat}</span>
                  </div>

                  {/* Foto & Actions row */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div>
                      {item.fotoDokumentasi ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoItem(item)}
                            className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shadow-2xs hover:scale-105 transition-transform cursor-pointer shrink-0"
                            title="Klik untuk melihat foto lebih besar"
                          >
                            <img
                              src={item.fotoDokumentasi}
                              alt={item.namaWarga}
                              className="w-full h-full object-cover"
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadPhoto(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-colors cursor-pointer"
                            title="Unduh foto dokumentasi ini"
                          >
                            <Download className="w-3.5 h-3.5 text-teal-700" />
                            <span>Unduh Foto</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Tanpa Dokumentasi Foto</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.namaWarga)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                      title="Hapus Kunjungan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* VIEW MODE 2: TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 font-extrabold text-slate-700">
                  <th className="py-3 px-3 w-10 text-center">NO</th>
                  <th className="py-3 px-3">NAMA WARGA</th>
                  <th className="py-3 px-3">ALAMAT LENGKAP</th>
                  <th className="py-3 px-3 text-center">LINGKUNGAN</th>
                  <th className="py-3 px-3 text-center">KETERANGAN</th>
                  <th className="py-3 px-3 text-center">DOKUMENTASI FOTO</th>
                  <th className="py-3 px-3 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 font-medium">
                      Belum ada catatan kunjungan pada tanggal {selectedDate}. Gunakan formulir di atas untuk menambahkan.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, index) => (
                    <tr key={`${item.id}_${index}`} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 text-center font-bold text-slate-500">{index + 1}</td>
                      <td className="py-3 px-3 font-extrabold text-slate-900 whitespace-nowrap">
                        {item.namaWarga}
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium max-w-xs">
                        {item.alamat}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800 whitespace-nowrap">
                        {item.lingkungan}
                        <div className="text-[10px] text-slate-400 font-normal">{item.namaKepling}</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase whitespace-nowrap ${
                            item.keterangan === 'Sudah'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : item.keterangan === 'Belum'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : item.keterangan === 'Menolak'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {item.keterangan}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {item.fotoDokumentasi ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewPhotoItem(item)}
                              className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-2xs hover:scale-105 transition-transform cursor-pointer shrink-0"
                              title="Lihat foto preview"
                            >
                              <img
                                src={item.fotoDokumentasi}
                                alt="Dokumentasi"
                                className="w-full h-full object-cover"
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadPhoto(item)}
                              className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-colors cursor-pointer"
                              title="Download Foto Langsung"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Tanpa Foto</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {item.fotoDokumentasi && (
                            <button
                              type="button"
                              onClick={() => handleDownloadPhoto(item)}
                              className="p-1.5 text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                              title="Unduh Foto (.jpg)"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.namaWarga)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Kunjungan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slogan Banner */}
      <div className="flex items-center justify-center gap-3 pt-2">
        <span className="px-3 py-1 rounded-lg bg-[#991B1B] text-white text-[11px] font-black tracking-wider uppercase shadow-2xs">
          #MEDANUNTUKSEMUA
        </span>
        <span className="px-3 py-1 rounded-lg bg-[#1E3A8A] text-white text-[11px] font-black tracking-wider uppercase shadow-2xs">
          #SEMUAUNTUKMEDAN
        </span>
      </div>

      {/* LIGHTBOX PHOTO MODAL (WITH DIRECT DOWNLOAD) */}
      {previewPhotoItem && previewPhotoItem.fotoDokumentasi && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 space-y-0 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base">
                  Foto Kunjungan: {previewPhotoItem.namaWarga}
                </h3>
                <p className="text-xs text-slate-300">
                  {previewPhotoItem.lingkungan} • {previewPhotoItem.tanggal}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhotoItem(null)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo Preview */}
            <div className="bg-slate-950 flex items-center justify-center max-h-[60vh] overflow-hidden">
              <img
                src={previewPhotoItem.fotoDokumentasi}
                alt={previewPhotoItem.namaWarga}
                className="max-h-[60vh] w-auto object-contain"
              />
            </div>

            {/* Modal Info & Download Action */}
            <div className="p-4 sm:p-5 bg-white space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama Warga:</span>
                  <span className="font-bold text-slate-900">{previewPhotoItem.namaWarga}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Alamat:</span>
                  <span className="font-bold text-slate-900 text-right">{previewPhotoItem.alamat}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kepala Lingkungan:</span>
                  <span className="font-bold text-slate-900">{previewPhotoItem.namaKepling}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Kunjungan:</span>
                  <span className="font-bold text-emerald-700">{previewPhotoItem.keterangan}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadPhoto(previewPhotoItem);
                    setPreviewPhotoItem(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-extrabold text-xs shadow-md transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Foto (.JPG)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPhotoItem(null)}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
