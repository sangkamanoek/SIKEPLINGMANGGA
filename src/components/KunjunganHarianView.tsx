import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { printOfficialDocument } from '../utils/printHelper';
import { KopSuratResmi } from './KopSuratResmi';
import {
  Users,
  Calendar,
  Search,
  Printer,
  Trash2,
  CheckCircle2,
  Share2,
  Plus,
  Download,
  FileSpreadsheet,
  X,
  MapPin,
  Send,
  Archive,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import { UserAccount, isKelurahanAdmin, LaporanHarianItem } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { FormKunjunganWarga, KunjunganWargaData } from './FormKunjunganWarga';
import { downloadImage, downloadMultipleImages } from '../lib/imageDownloader';
import { exportKunjunganWargaToExcel, exportKunjunganWargaZipPackage } from '../lib/excelExport';
import { safeGetLocalStorage, safeSetLocalStorage } from '../lib/safeStorage';
import { getReportIsoDate, isReportMatchingDate, getTodayLocalIso, extractNomorLingkungan, toRoman } from '../lib/formatter';
import {
  subscribeKunjunganWarga,
  deleteKunjunganWarga,
  consolidateKunjunganWithReports,
  isKunjunganOnDate,
  getKunjunganIsoDate,
  KUNJUNGAN_STORAGE_KEY,
} from '../lib/kunjunganService';

interface KunjunganHarianViewProps {
  currentUser: UserAccount;
  reports?: LaporanHarianItem[];
  onNavigateToForm?: () => void;
}

export const KunjunganHarianView: React.FC<KunjunganHarianViewProps> = ({
  currentUser,
  reports = [],
}) => {
  const isAdmin = isKelurahanAdmin(currentUser.role);
  const todayStr = useMemo(() => getTodayLocalIso(), []);

  // 1. Instant 0ms Load from Local Cache
  const [records, setRecords] = useState<KunjunganWargaData[]>(() => {
    return safeGetLocalStorage<KunjunganWargaData[]>(KUNJUNGAN_STORAGE_KEY, []);
  });
  const [dateFilterMode, setDateFilterMode] = useState<'SINGLE' | 'RANGE' | 'ALL'>('SINGLE');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return getTodayLocalIso(d);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedLingkungan, setSelectedLingkungan] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(true);
  const [editingItem, setEditingItem] = useState<KunjunganWargaData | null>(null);
  const [copiedWA, setCopiedWA] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isSharingExcel, setIsSharingExcel] = useState<boolean>(false);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Label tampilan tanggal/periode terpilih untuk Laporan/WA/Print/Excel
  const dateDisplayLabel = useMemo(() => {
    if (dateFilterMode === 'SINGLE') {
      return selectedDate ? selectedDate : 'Semua Tanggal';
    } else if (dateFilterMode === 'RANGE') {
      if (startDate && endDate) {
        return `${startDate} s/d ${endDate}`;
      } else if (startDate) {
        return `Mulai ${startDate}`;
      } else if (endDate) {
        return `Sampai ${endDate}`;
      }
      return 'Sebagian Tanggal';
    } else {
      return 'Semua Tanggal (Keseluruhan)';
    }
  }, [dateFilterMode, selectedDate, startDate, endDate]);

  // View mode for mobile (cards vs table)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  // Photo Lightbox Modal
  const [previewPhotoItem, setPreviewPhotoItem] = useState<KunjunganWargaData | null>(null);
  const [isBatchDownloading, setIsBatchDownloading] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, []);

  // Online Fetch from Server Buffer & Real-time listener dari Firestore & Cross-tab Broadcast
  useEffect(() => {
    const unsubscribe = subscribeKunjunganWarga((newList) => {
      setRecords(newList);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const refreshKunjunganData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/kunjungan?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' },
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.data)) {
          setRecords((prev) => {
            const map = new Map<string, KunjunganWargaData>();
            json.data.forEach((k: KunjunganWargaData) => map.set(k.id, k));
            prev.forEach((k) => {
              if (!map.has(k.id)) map.set(k.id, k);
            });
            const merged = Array.from(map.values());
            safeSetLocalStorage(KUNJUNGAN_STORAGE_KEY, JSON.stringify(merged));
            return merged;
          });
          showToast('Data kunjungan warga berhasil diperbarui.');
        }
      }
    } catch (err) {
      console.warn('Notice refreshing kunjungan:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [showToast]);

  const handleDelete = async (id: string, namaWarga: string) => {
    if (!window.confirm(`Hapus catatan kunjungan ke ${namaWarga}?`)) return;
    try {
      await deleteKunjunganWarga(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      showToast(`Catatan kunjungan ke ${namaWarga} berhasil dihapus.`);
    } catch (e) {
      alert('Gagal menghapus: ' + e);
    }
  };

  // 🛡️ Gabungkan data kunjungan mandiri dengan data kunjungan yang diinput melalui Laporan Kinerja
  const combinedRecords = useMemo(() => {
    return consolidateKunjunganWithReports(records, reports);
  }, [records, reports]);

  // Filter records
  const filtered = useMemo(() => {
    const qLower = searchQuery.toLowerCase().trim();
    return combinedRecords.filter((r) => {
      let isDate = true;
      const rIso = getKunjunganIsoDate(r);

      if (dateFilterMode === 'SINGLE') {
        if (selectedDate) {
          isDate = isKunjunganOnDate(r, selectedDate);
        } else {
          isDate = true;
        }
      } else if (dateFilterMode === 'RANGE') {
        if (startDate && endDate) {
          isDate = (rIso >= startDate && rIso <= endDate) || (r.tanggal >= startDate && r.tanggal <= endDate);
        } else if (startDate) {
          isDate = rIso >= startDate || r.tanggal >= startDate;
        } else if (endDate) {
          isDate = rIso <= endDate || r.tanggal <= endDate;
        }
      } else if (dateFilterMode === 'ALL') {
        isDate = true;
      }

      const rLingkunganNum =
        r.lingkunganNomor ||
        extractNomorLingkungan(r.lingkungan) ||
        extractNomorLingkungan(r.keplingId);

      const isLingkungan =
        selectedLingkungan === 'ALL' ||
        (rLingkunganNum !== null && Number(selectedLingkungan) === rLingkunganNum) ||
        r.lingkunganNomor === Number(selectedLingkungan) ||
        r.keplingId === selectedLingkungan ||
        r.keplingId === `kepling_${selectedLingkungan}` ||
        (r.lingkungan && (r.lingkungan.toLowerCase().includes(selectedLingkungan.toLowerCase()) || r.lingkungan.includes(String(selectedLingkungan))));

      const isRole =
        isAdmin ||
        r.keplingId === currentUser.id ||
        (rLingkunganNum !== null && currentUser.nomorLingkungan && rLingkunganNum === currentUser.nomorLingkungan) ||
        r.lingkunganNomor === currentUser.nomorLingkungan ||
        (r.namaKepling && currentUser.nama && r.namaKepling.trim().toLowerCase() === currentUser.nama.trim().toLowerCase());

      const isSearch =
        !qLower ||
        (r.namaWarga && r.namaWarga.toLowerCase().includes(qLower)) ||
        (r.alamat && r.alamat.toLowerCase().includes(qLower)) ||
        (r.lingkungan && r.lingkungan.toLowerCase().includes(qLower)) ||
        (r.namaKepling && r.namaKepling.toLowerCase().includes(qLower)) ||
        (r.keterangan && r.keterangan.toLowerCase().includes(qLower));

      return isDate && isLingkungan && isRole && isSearch;
    });
  }, [
    combinedRecords,
    dateFilterMode,
    selectedDate,
    startDate,
    endDate,
    selectedLingkungan,
    searchQuery,
    isAdmin,
    currentUser.id,
    currentUser.nomorLingkungan,
    currentUser.nama,
  ]);

  const photosCount = useMemo(
    () => filtered.filter((r) => Boolean(r.fotoDokumentasi)).length,
    [filtered]
  );

  // Rekapitulasi Kumulatif Kunjungan 24 Lingkungan (Sampai Dengan Hari Ini / Tanggal Terpilih)
  const { cumulativeCounts, totalSeluruhKunjungan } = useMemo(() => {
    const recordsToCount =
      dateFilterMode === 'SINGLE' && selectedDate && selectedDate < todayStr
        ? combinedRecords.filter((r) => {
            const rIso = getKunjunganIsoDate(r);
            return !rIso || rIso <= selectedDate;
          })
        : dateFilterMode === 'RANGE' && endDate && endDate < todayStr
        ? combinedRecords.filter((r) => {
            const rIso = getKunjunganIsoDate(r);
            return !rIso || rIso <= endDate;
          })
        : combinedRecords;

    const counts: Record<number, number> = {};
    for (let i = 1; i <= 24; i++) {
      counts[i] = 0;
    }

    recordsToCount.forEach((r) => {
      let num: number | null = null;
      if (r.lingkunganNomor !== undefined && r.lingkunganNomor !== null && String(r.lingkunganNomor) !== '') {
        const n = Number(r.lingkunganNomor);
        if (n >= 1 && n <= 24) num = n;
      }
      if (num === null) {
        num =
          extractNomorLingkungan(r.lingkungan) ||
          extractNomorLingkungan((r as any).lingkunganNama) ||
          extractNomorLingkungan(r.keplingId);
      }
      if (num === null && r.namaKepling) {
        const kMatch = KEPLING_ACCOUNTS.find(
          (k) => k.nama.trim().toLowerCase() === String(r.namaKepling).trim().toLowerCase()
        );
        if (kMatch && kMatch.nomorLingkungan) num = kMatch.nomorLingkungan;
      }

      if (num && num >= 1 && num <= 24) {
        counts[num] = (counts[num] || 0) + 1;
      }
    });

    const sumCounts = Object.values(counts).reduce((a, b) => a + b, 0);
    const totalAll = Math.max(recordsToCount.length, sumCounts);

    return {
      cumulativeCounts: counts,
      totalSeluruhKunjungan: totalAll,
    };
  }, [combinedRecords, dateFilterMode, selectedDate, endDate, todayStr]);

  const handleCopyWA = () => {
    let text = `*REKAP KUNJUNGAN HARIAN DOOR-TO-DOOR*\n`;
    text += `*KELURAHAN MANGGA, KEC. MEDAN TUNTUNGAN*\n`;
    text += `Periode / Tanggal: ${dateDisplayLabel}\n`;
    text += `Total Kunjungan: ${filtered.length} Rumah\n\n`;
    text += `----------------------------------------\n`;

    // 1. Group records by lingkungan for the current filtered view
    const grouped = filtered.reduce((acc, item) => {
      const key = item.lingkungan || 'Tanpa Lingkungan';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, KunjunganWargaData[]>);

    // Sort lingkungan groups in Part 1 by nomor lingkungan
    const sortedGroupKeys = Object.keys(grouped).sort((a, b) => {
      const numA = extractNomorLingkungan(a) || 999;
      const numB = extractNomorLingkungan(b) || 999;
      return numA - numB;
    });

    if (sortedGroupKeys.length === 0) {
      text += `_(Nihil / Belum ada kunjungan pada periode ini)_\n\n`;
    } else {
      sortedGroupKeys.forEach((lingkungan) => {
        const items = grouped[lingkungan];
        text += `*${lingkungan}*\n`;
        text += `Total Kunjungan : ${items.length} Warga\n`;
        text += `Rincian :\n`;
        items.forEach((item) => {
          text += `- ${item.namaWarga} (${item.alamat || '-'})\n`;
        });
        text += `\n`;
      });
    }

    // 2. TOTAL KUNJUNGAN PER LINGKUNGAN SAMPAI DENGAN HARI INI
    text += `*TOTAL KUNJUNGAN PER LINGKUNGAN SAMPAI DENGAN HARI INI:*\n`;
    for (let i = 1; i <= 24; i++) {
      const count = cumulativeCounts[i] || 0;
      text += `- Lingkungan ${toRoman(i)}: ${count} Warga\n`;
    }

    text += `\n*TOTAL SELURUH KUNJUNGAN: ${totalSeluruhKunjungan} Warga*\n`;

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
        `Unduh seluruh ${itemsWithPhotos.length} foto kunjungan warga (${dateDisplayLabel})?`
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
      await exportKunjunganWargaToExcel(filtered, dateDisplayLabel, false);
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
      const result = await exportKunjunganWargaToExcel(filtered, dateDisplayLabel, true);
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

  // ZIP Package Export Handler (Excel + Seluruh File Foto Asli Resolusi Penuh)
  const handleExportZip = async () => {
    if (filtered.length === 0) {
      alert('Tidak ada data kunjungan untuk diekspor ke paket ZIP.');
      return;
    }
    const photosToPack = filtered.filter((r) => Boolean(r.fotoDokumentasi)).length;
    setIsExportingZip(true);
    setZipProgress({ current: 0, total: photosToPack });
    try {
      await exportKunjunganWargaZipPackage(filtered, dateDisplayLabel, (curr, tot) => {
        setZipProgress({ current: curr, total: tot });
      });
      showToast('Paket ZIP lengkap (Excel + Folder Foto Asli) berhasil diunduh!');
    } catch (e) {
      console.error('Gagal mengemas paket ZIP:', e);
      alert('Gagal membuat paket ZIP: ' + e);
    } finally {
      setIsExportingZip(false);
      setZipProgress(null);
    }
  };

  return (
    <div id="lembar-cetak-kunjungan-harian" className="space-y-5">
      {/* Kop Surat Resmi Pemko Medan (Gambar 1 - Hanya Tampak Saat Cetak PDF/Printer) */}
      <div className="hidden print:block mb-4">
        <KopSuratResmi />
        <div className="mt-1 pt-1 text-center">
          <h4 className="font-black text-sm uppercase tracking-wider text-slate-900">
            BUKU REKAPITULASI KUNJUNGAN HARIAN LAPANGAN (DOOR-TO-DOOR)
          </h4>
          <p className="text-xs font-bold text-slate-700">
            Periode / Tanggal: {dateDisplayLabel} • Total: {filtered.length} Kunjungan
          </p>
        </div>
      </div>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner Halaman */}
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
          {editingItem && (
            <button
              type="button"
              onClick={() => setEditingItem(null)}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs transition-all cursor-pointer"
              title="Batalkan mode koreksi"
            >
              <X className="w-4 h-4" />
              <span>Batal Koreksi</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (showAddForm && editingItem) {
                setEditingItem(null);
              } else {
                setShowAddForm(!showAddForm);
              }
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>
              {showAddForm
                ? editingItem
                  ? 'Batal Edit & Tutup'
                  : 'Tutup Form Input'
                : '+ Input Kunjungan'}
            </span>
          </button>
        </div>
      </div>

      {/* Komponen Form Kunjungan Warga (Tambah / Edit) */}
      {showAddForm && (
        <div id="form-kunjungan-container" className="scroll-mt-6">
          <FormKunjunganWarga
            currentUser={currentUser}
            tanggalLaporan={selectedDate}
            initialData={editingItem}
            onSuccess={(saved) => {
              showToast(
                editingItem
                  ? `Perubahan data "${saved.namaWarga}" berhasil disimpan!`
                  : 'Catatan kunjungan baru berhasil disimpan!'
              );
              setEditingItem(null);
            }}
            onCancel={() => {
              setEditingItem(null);
            }}
          />
        </div>
      )}

      {/* Filter & Action Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-xs space-y-3">
        {/* Row 1: Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Opsi Filter Tanggal */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 flex-1 sm:flex-initial">
              <div className="flex items-center gap-1 px-1.5 py-0.5">
                <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                <select
                  value={dateFilterMode}
                  onChange={(e) => setDateFilterMode(e.target.value as 'SINGLE' | 'RANGE' | 'ALL')}
                  className="bg-transparent font-extrabold text-slate-800 focus:outline-none cursor-pointer text-xs pr-1"
                >
                  <option value="SINGLE">Tanggal Tertentu</option>
                  <option value="RANGE">Rentang / Sebagian Tanggal</option>
                  <option value="ALL">Semua Tanggal</option>
                </select>
              </div>

              {/* Dynamic Inputs Based on Date Mode */}
              {dateFilterMode === 'SINGLE' && (
                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent font-extrabold text-slate-800 focus:outline-none cursor-pointer text-xs"
                  />
                </div>
              )}

              {dateFilterMode === 'RANGE' && (
                <div className="flex flex-wrap items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-semibold">Dari:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
                  />
                  <span className="text-[10px] text-slate-400 font-extrabold">s/d</span>
                  <span className="text-[10px] text-slate-500 font-semibold">Sampai:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
                  />
                </div>
              )}

              {dateFilterMode === 'ALL' && (
                <div className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg text-[11px] font-extrabold">
                  Semua Data
                </div>
              )}
            </div>

            {/* Filter Lingkungan (Super Admin & Kasi) */}
            {isAdmin && (
              <select
                value={selectedLingkungan}
                onChange={(e) => setSelectedLingkungan(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none flex-1 sm:flex-initial"
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
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 text-xs w-full sm:w-48 lg:w-56">
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

          {/* View Mode Toggle */}
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

        {/* Row 2: Action Buttons */}
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
            {/* Share / Bagikan Excel Bergambar ke WA / HP */}
            <button
              type="button"
              onClick={handleShareExcel}
              disabled={isSharingExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer flex-1 sm:flex-initial justify-center"
              title="Bagikan file Excel dengan FOTO ASLI langsung tertanam di dalam sel ke WhatsApp / HP"
            >
              <Send className="w-3.5 h-3.5 text-emerald-200" />
              <span>{isSharingExcel ? 'Menyematkan Foto...' : 'Share Excel Bergambar'}</span>
            </button>

            {/* Unduh File Excel Bergambar */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-400 text-emerald-950 rounded-xl font-bold text-xs shadow-2xs transition-all cursor-pointer flex-1 sm:flex-initial justify-center"
              title="Unduh tabel Excel (.xlsx) dengan foto dokumentasi langsung tertanam di dalam sel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span className="flex items-center gap-1">
                <span>{isExportingExcel ? 'Menyematkan Foto...' : 'Unduh Excel (.xlsx)'}</span>
                <span className="hidden md:inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-200 text-emerald-900">
                  + FOTO
                </span>
              </span>
            </button>

            {/* Unduh Paket Lengkap ZIP: Excel + Folder Foto Asli */}
            {photosCount > 0 && (
              <button
                type="button"
                onClick={handleExportZip}
                disabled={isExportingZip}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 rounded-xl font-bold text-xs shadow-2xs transition-all cursor-pointer flex-1 sm:flex-initial justify-center"
                title="Unduh satu paket arsip ZIP berisi file Excel + folder seluruh file foto asli resolusi tinggi"
              >
                <Archive className="w-3.5 h-3.5 text-amber-700" />
                <span>
                  {isExportingZip
                    ? `Packing ZIP (${zipProgress?.current}/${zipProgress?.total})...`
                    : 'Paket ZIP (Excel + Semua Foto)'}
                </span>
              </button>
            )}

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
              onClick={() => printOfficialDocument('lembar-cetak-kunjungan-harian', `REKAP_KUNJUNGAN_HARIAN_${dateDisplayLabel.replace(/[/\\?%*:|"<> ]/g, '_')}`)}
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

      {/* VIEW MODE 1: MOBILE CARDS VIEW */}
      {viewMode === 'cards' ? (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 font-medium">
              Belum ada catatan kunjungan pada {dateDisplayLabel}. Gunakan formulir di atas untuk menambahkan.
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
                        <span className="text-[11px] text-slate-500 font-semibold block">
                          {item.lingkungan} • {item.namaKepling}
                        </span>
                        <span className="text-[10px] text-slate-400 font-black block mt-1 bg-slate-100 px-1.5 py-0.5 rounded w-max">
                          📅 {item.tanggal || '-'}
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

                  {/* Badges: Perlinsos, IKD, PBB */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap ${
                        item.perlinsos === 'Sudah'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : item.perlinsos === 'Menolak'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300 font-extrabold'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      Perlinsos: {item.perlinsos || 'Belum'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap ${
                        item.ikd === 'Sudah'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      IKD: {item.ikd || 'Belum'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap ${
                        item.pbb === 'Sudah'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      PBB: {item.pbb || 'Belum'}
                    </span>
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

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(item);
                          setShowAddForm(true);
                          setTimeout(() => {
                            const el = document.getElementById('form-kunjungan-container');
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 50);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-colors cursor-pointer"
                        title="Edit / Koreksi Data Kunjungan"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                        <span>Edit</span>
                      </button>
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
                  <th className="py-3 px-3">TANGGAL KUNJUNGAN</th>
                  <th className="py-3 px-3">NAMA WARGA</th>
                  <th className="py-3 px-3">ALAMAT LENGKAP</th>
                  <th className="py-3 px-3 text-center">LINGKUNGAN</th>
                  <th className="py-3 px-3 text-center">PERLINSOS</th>
                  <th className="py-3 px-3 text-center">IKD</th>
                  <th className="py-3 px-3 text-center">PBB</th>
                  <th className="py-3 px-3 text-center">DOKUMENTASI FOTO</th>
                  <th className="py-3 px-3 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-slate-400 font-medium">
                      Belum ada catatan kunjungan pada {dateDisplayLabel}. Gunakan formulir di atas untuk menambahkan.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, index) => (
                    <tr key={`${item.id}_${index}`} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 text-center font-bold text-slate-500">{index + 1}</td>
                      <td className="py-3 px-3 font-bold text-slate-700 whitespace-nowrap">
                        {item.tanggal || '-'}
                      </td>
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
                            item.perlinsos === 'Sudah'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : item.perlinsos === 'Menolak'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300 font-extrabold'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {item.perlinsos || 'Belum'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase whitespace-nowrap ${item.ikd === 'Sudah' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {item.ikd}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase whitespace-nowrap ${item.pbb === 'Sudah' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {item.pbb}
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
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setShowAddForm(true);
                              setTimeout(() => {
                                const el = document.getElementById('form-kunjungan-container');
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }, 50);
                            }}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit / Koreksi Data Kunjungan"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
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

      {/* REKAPITULASI TOTAL KUNJUNGAN PER LINGKUNGAN & TOTAL SELURUH KUNJUNGAN */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Rekapitulasi Kunjungan Per Lingkungan (Sampai Dengan Hari Ini)
              </h3>
              <p className="text-xs text-slate-500">
                Total akumulasi sambang warga door-to-door se-Kelurahan Mangga (24 Lingkungan)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white px-4 py-2 rounded-xl text-center shadow-xs">
              <span className="text-[10px] uppercase font-bold tracking-wider block text-emerald-100">
                Total Seluruh Kunjungan
              </span>
              <span className="text-base sm:text-lg font-black tracking-tight">
                {totalSeluruhKunjungan} Warga
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyWA}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs shadow-2xs transition-all cursor-pointer"
              title="Salin rekapitulasi lengkap ke WhatsApp"
            >
              <Share2 className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">{copiedWA ? 'Tersalin!' : 'Salin WA'}</span>
            </button>
          </div>
        </div>

        {/* 24 Lingkungan Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2.5">
          {Array.from({ length: 24 }, (_, i) => i + 1).map((lingNum) => {
            const count = cumulativeCounts[lingNum] || 0;
            return (
              <div
                key={`ui_ling_${lingNum}`}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  count > 0
                    ? 'bg-emerald-50/70 border-emerald-200 text-slate-900 shadow-2xs'
                    : 'bg-slate-50/80 border-slate-200/80 text-slate-400'
                }`}
              >
                <span className="text-[11px] font-bold block text-slate-600">
                  Lingkungan {toRoman(lingNum)}
                </span>
                <span className={`text-sm sm:text-base font-black block mt-0.5 ${count > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {count} <span className="text-[10px] font-semibold text-slate-500">Warga</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* REKAPITULASI TOTAL SELURUH KUNJUNGAN */}
        <div className="mt-5 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-emerald-500/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shrink-0">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-black uppercase tracking-wider">TOTAL SELURUH KUNJUNGAN</h4>
              <p className="text-[10px] sm:text-xs text-emerald-100 font-bold opacity-90 uppercase">
                AKUMULASI SAMBANG WARGA 24 LINGKUNGAN ({dateDisplayLabel})
              </p>
            </div>
          </div>
          <div className="text-center sm:text-right">
            <span className="text-3xl sm:text-4xl font-black tracking-tighter drop-shadow-md">
              {totalSeluruhKunjungan} <span className="text-sm sm:text-lg font-bold text-emerald-100/80 uppercase">Warga</span>
            </span>
          </div>
        </div>
      </div>

      {/* LIGHTBOX PHOTO MODAL */}
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
                  <span className="text-slate-500">Perlinsos:</span>
                  <span className={`font-bold ${previewPhotoItem.perlinsos === 'Sudah' ? 'text-emerald-700' : 'text-rose-700'}`}>{previewPhotoItem.perlinsos}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">IKD:</span>
                  <span className={`font-bold ${previewPhotoItem.ikd === 'Sudah' ? 'text-emerald-700' : 'text-rose-700'}`}>{previewPhotoItem.ikd}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">PBB:</span>
                  <span className={`font-bold ${previewPhotoItem.pbb === 'Sudah' ? 'text-emerald-700' : 'text-rose-700'}`}>{previewPhotoItem.pbb}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const itemToEdit = previewPhotoItem;
                    setPreviewPhotoItem(null);
                    setEditingItem(itemToEdit);
                    setShowAddForm(true);
                    setTimeout(() => {
                      const el = document.getElementById('form-kunjungan-container');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                  }}
                  className="flex items-center justify-center gap-1.5 py-3 px-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                  title="Koreksi / Edit data kunjungan ini"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Data</span>
                </button>
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
