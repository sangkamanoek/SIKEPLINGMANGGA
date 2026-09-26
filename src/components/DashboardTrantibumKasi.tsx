import React, { useState, useMemo } from 'react';
import { printOfficialDocument } from '../utils/printHelper';
import {
  ShieldAlert,
  ShieldCheck,
  Building2,
  Calendar,
  Search,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  MapPin,
  Eye,
  ChevronRight,
  TrendingUp,
  Activity,
  FileText,
  Handshake,
  Sparkles,
  Trash2,
  ListChecks,
  Flag,
  Wrench,
  Radio,
  ExternalLink,
  Award,
  Camera,
  X,
  Download,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { LaporanHarianItem, UserAccount } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { isReportMatchingKepling } from '../lib/formatter';

interface DashboardTrantibumKasiProps {
  reports: LaporanHarianItem[];
  currentUser: UserAccount;
  onSelectKeplingRiwayat?: (namaKepling: string) => void;
}

type PeriodFilter = 'all' | 'today' | '7days' | 'month';

type TrantibSubView =
  | 'ringkasan'
  | 'poskamling'
  | 'infrastruktur'
  | 'mediasi'
  | 'posko_trantibum'
  | 'posko_bersemi'
  | 'kebersihan'
  | 'faktor74';

export const DashboardTrantibumKasi: React.FC<DashboardTrantibumKasiProps> = ({
  reports,
  currentUser,
  onSelectKeplingRiwayat,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [subView, setSubView] = useState<TrantibSubView>('poskamling');
  const [searchQuery, setSearchQuery] = useState('');
  const [poskamlingDisplayMode, setPoskamlingDisplayMode] = useState<'gallery' | 'table' | 'unduh_mingguan'>('gallery');
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
    date?: string;
    kepling?: string;
    status?: string;
    location?: string;
    notes?: string;
  } | null>(null);

  // 1. Filter reports based on period
  const filteredReports = useMemo(() => {
    if (period === 'all') return reports;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return reports.filter((r) => {
      if (!r.tanggal) return false;
      const reportDate = r.tanggal.split('T')[0];

      if (period === 'today') {
        return reportDate === todayStr;
      }

      if (period === '7days') {
        const diffTime = now.getTime() - new Date(reportDate).getTime();
        const diffDays = diffTime / (1000 * 3600 * 24);
        return diffDays >= 0 && diffDays <= 7;
      }

      if (period === 'month') {
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return reportDate.startsWith(currentMonth);
      }

      return true;
    });
  }, [reports, period]);

  // 1b. Collect all Poskamling photos from last 7 days for direct download
  const lastWeekPoskamlingPhotos = useMemo(() => {
    const now = new Date();
    const photos: {
      url: string;
      date: string;
      name: string;
      keplingNama: string;
      lingkungan: string;
      notes: string;
    }[] = [];

    reports.forEach((r) => {
      if (!r.tanggal) return;
      const reportDate = r.tanggal.split('T')[0];
      const diffTime = now.getTime() - new Date(reportDate).getTime();
      const diffDays = diffTime / (1000 * 3600 * 24);

      if (diffDays >= 0 && diffDays <= 7) {
        if (r.fotoDokumentasi && r.fotoDokumentasi.length > 0) {
          const posPhotos = r.fotoDokumentasi.filter((p) => p.kategori === 'poskamling');
          const hasPoskamlingGiat = Boolean(
            r.kinerja?.poskamlingAdaGiat ||
            (r.kinerja?.poskamlingStatus && r.kinerja.poskamlingStatus !== 'Tidak Ada Giat')
          );
          const targetPhotos = posPhotos.length > 0 ? posPhotos : (hasPoskamlingGiat ? r.fotoDokumentasi : []);

          targetPhotos.forEach((p) => {
            if (p.url) {
              photos.push({
                url: p.url,
                date: r.tanggal,
                name: p.name || `Dokumentasi Poskamling ${r.namaKepling}`,
                keplingNama: r.namaKepling,
                lingkungan: r.jabatan || 'Kepala Lingkungan',
                notes: r.kinerja?.poskamlingKeterangan || r.uraianTugas || 'Situasi aman dan kondusif',
              });
            }
          });
        }
      }
    });

    return photos.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [reports]);

  const handleDownloadImage = async (url: string, filename: string) => {
    try {
      if (url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
      
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // 2. Aggregate All 7 Trantibum Dimensions per Kepling
  const keplingTrantibData = useMemo(() => {
    return KEPLING_ACCOUNTS.map((kepling) => {
      const keplingReports = filteredReports.filter((r) => isReportMatchingKepling(r, kepling));

      // Helper text merger
      const allText = keplingReports
        .map(
          (r) =>
            `${r.uraianTugas || ''} ${r.kinerja?.kegiatanLainnya || ''} ${r.kinerja?.poskamlingKeterangan || ''} ${r.kinerja?.infrastrukturSubjek || ''} ${r.kinerja?.infrastrukturLokasi || ''}`
        )
        .join(' ')
        .toLowerCase();

      // --- 1. Poskamling ---
      const poskamlingReports = keplingReports.filter((r) => {
        const k = r.kinerja;
        const status = k?.poskamlingStatus || (r as any).poskamlingStatus;
        const adaGiat = k?.poskamlingAdaGiat || (r as any).poskamlingAdaGiat;
        const lokasi = k?.poskamlingLokasi || (r as any).poskamlingLokasi;
        return Boolean(adaGiat || (status && status !== 'Tidak Ada Giat') || lokasi);
      });

      const latestPosReport = poskamlingReports[0] || keplingReports[0];
      const pkKinerj = latestPosReport?.kinerja;
      const poskamlingStatus =
        pkKinerj?.poskamlingStatus ||
        (poskamlingReports.length > 0 ? 'Aktif Ronda' : 'Terpantau Kondusif');
      const poskamlingLokasi = pkKinerj?.poskamlingLokasi || `Pos Ronde ${kepling.lingkungan}`;
      const poskamlingPetugas = pkKinerj?.poskamlingPetugas || `${kepling.nama} & Warga`;
      const poskamlingNote =
        pkKinerj?.poskamlingKeterangan ||
        latestPosReport?.uraianTugas ||
        'Situasi pos ronda terpantau aman dan kondusif';

      // Collect all Poskamling photos across reports for this Kepling
      const poskamlingPhotos: { url: string; date: string; title: string; category?: string }[] = [];
      const sourceReportsForPhotos = poskamlingReports.length > 0 ? poskamlingReports : keplingReports;
      sourceReportsForPhotos.forEach((r) => {
        const dateStr = r.tanggal || 'Hari Ini';
        if (r.fotoDokumentasi && r.fotoDokumentasi.length > 0) {
          const posPhotos = r.fotoDokumentasi.filter((p) => p.kategori === 'poskamling');
          const targetPhotos = posPhotos.length > 0 ? posPhotos : r.fotoDokumentasi;
          targetPhotos.forEach((p) => {
            if (p.url) {
              poskamlingPhotos.push({
                url: p.url,
                date: dateStr,
                title: p.name || p.description || `Dokumentasi Siskamling ${kepling.lingkungan}`,
                category: p.kategori || 'poskamling',
              });
            }
          });
        }
      });

      // --- 2. Pemantauan Infrastruktur Wilayah ---
      const infraReports = keplingReports.filter((r) => {
        const k = r.kinerja;
        return Boolean(k?.infrastrukturAdaGiat || k?.infrastrukturSubjek || k?.infrastrukturLokasi);
      });
      const latestInfra = infraReports[0] || keplingReports[0];
      const infraSubjek = latestInfra?.kinerja?.infrastrukturSubjek || (allText.includes('drainase') ? 'Pemantauan Drainase' : allText.includes('jalan') ? 'Pemantauan Jalan' : 'Pemantauan Fasum Lingkungan');
      const infraLokasi = latestInfra?.kinerja?.infrastrukturLokasi || `Kawasan ${kepling.lingkungan}`;
      const infraMapsLink = latestInfra?.kinerja?.infrastrukturTitikKoordinat || '';
      const infraNote = latestInfra?.uraianTugas || 'Kondisi fisik infrastruktur wilayah terpantau baik';

      // --- 3. Mediasi Warga ---
      const mediasiReports = keplingReports.filter((r) => {
        const t = (r.uraianTugas || '').toLowerCase();
        return t.includes('mediasi') || t.includes('sengketa') || t.includes('konflik') || t.includes('perselisihan') || t.includes('damai');
      });
      const mediasiCount = mediasiReports.length;
      const latestMediasi = mediasiReports[0];
      const mediasiStatus = mediasiCount > 0 ? 'Terkondisi Damai' : 'Kondusif / Nihil Konflik';
      const mediasiNote = latestMediasi?.uraianTugas || 'Tidak ada potensi perselisihan warga, lingkungan harmonis';

      // --- 4. Posko Trantibum ---
      const poskoTrantibReports = keplingReports.filter((r) => {
        const t = (r.uraianTugas || '').toLowerCase();
        return t.includes('posko trantib') || t.includes('posko pengamanan') || t.includes('posko');
      });
      const poskoTrantibStatus = poskoTrantibReports.length > 0 ? 'Posko Siaga Full' : 'Patroli Wilayah Siaga';
      const poskoTrantibNote = poskoTrantibReports[0]?.uraianTugas || 'Posko Trantibum siaga mengawal ketertiban umum';

      // --- 5. Posko Bersemi ---
      const poskoBersemiReports = keplingReports.filter((r) => {
        const t = (r.uraianTugas || '').toLowerCase();
        return t.includes('bersemi') || t.includes('taman') || t.includes('asri');
      });
      const poskoBersemiStatus = poskoBersemiReports.length > 0 ? 'Posko Bersemi Aktif' : 'Lingkungan Asri & Bersih';
      const poskoBersemiNote = poskoBersemiReports[0]?.uraianTugas || 'Pemeliharaan Posko Bersemi dan penataan kawasan hijau';

      // --- 6. Pemantauan Kebersihan ---
      const kebersihanReports = keplingReports.filter((r) => {
        const t = (r.uraianTugas || '').toLowerCase();
        return t.includes('bersih') || t.includes('sampah') || t.includes('gotong royong') || t.includes('drainase');
      });
      const kebersihanCount = kebersihanReports.length;
      const kebersihanStatus = kebersihanCount > 0 ? 'Giat Kebersihan Terlaksana' : 'Terpantau Bersih';
      const kebersihanNote = kebersihanReports[0]?.uraianTugas || 'Pemantauan sampah harian dan kebersihan lingkungan rutin';

      // --- 7. Pemantauan Faktor 74 ---
      const faktor74Reports = keplingReports.filter((r) => {
        const t = (r.uraianTugas || '').toLowerCase();
        return t.includes('74') || t.includes('faktor') || t.includes('inspeksi') || t.includes('trantib');
      });
      const faktor74Status = faktor74Reports.length > 0 ? '74 Indikator Terpenuhi' : 'Kepatuhan Trantib Terjaga';
      const faktor74Note = faktor74Reports[0]?.uraianTugas || 'Evaluasi 74 aspek keamanan dan ketentraman wilayah berjalan baik';

      return {
        kepling,
        reportCount: keplingReports.length,
        poskamlingStatus,
        poskamlingLokasi,
        poskamlingPetugas,
        poskamlingNote,
        poskamlingCount: poskamlingReports.length,
        poskamlingPhotos,
        latestPoskamlingPhoto: poskamlingPhotos[0] || null,
        infraSubjek,
        infraLokasi,
        infraMapsLink,
        infraNote,
        infraCount: infraReports.length,
        mediasiStatus,
        mediasiNote,
        mediasiCount,
        poskoTrantibStatus,
        poskoTrantibNote,
        poskoBersemiStatus,
        poskoBersemiNote,
        kebersihanStatus,
        kebersihanNote,
        kebersihanCount,
        faktor74Status,
        faktor74Note,
        latestDate: keplingReports[0]?.tanggal || '-',
      };
    });
  }, [filteredReports]);

  // 3. Overall KPI Metrics
  const kpiMetrics = useMemo(() => {
    const totalPoskamlingActive = keplingTrantibData.filter(
      (k) => k.poskamlingStatus.toLowerCase().includes('aktif') || k.poskamlingCount > 0
    ).length;
    const totalInfraReports = keplingTrantibData.reduce((sum, k) => sum + k.infraCount, 0);
    const totalMediasiGiat = keplingTrantibData.reduce((sum, k) => sum + k.mediasiCount, 0);
    const totalKebersihanGiat = keplingTrantibData.reduce((sum, k) => sum + k.kebersihanCount, 0);

    return {
      totalPoskamlingActive,
      totalInfraReports,
      totalMediasiGiat,
      totalKebersihanGiat,
      totalLingkungan: 24,
    };
  }, [keplingTrantibData]);

  // 4. Filtered List by Search Query
  const displayedData = useMemo(() => {
    if (!searchQuery.trim()) return keplingTrantibData;
    const q = searchQuery.toLowerCase();
    return keplingTrantibData.filter(
      (item) =>
        item.kepling.nama.toLowerCase().includes(q) ||
        item.kepling.lingkungan.toLowerCase().includes(q) ||
        item.poskamlingStatus.toLowerCase().includes(q) ||
        item.infraSubjek.toLowerCase().includes(q) ||
        item.mediasiNote.toLowerCase().includes(q) ||
        item.kebersihanNote.toLowerCase().includes(q)
    );
  }, [keplingTrantibData, searchQuery]);

  // 5. Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const excelData = keplingTrantibData.map((item, idx) => ({
      'No': idx + 1,
      'Lingkungan': item.kepling.lingkungan,
      'Nama Kepala Lingkungan': item.kepling.nama,
      '1. Status Poskamling': item.poskamlingStatus,
      '   Lokasi Pos Ronda': item.poskamlingLokasi,
      '2. Pemantauan Infrastruktur': item.infraSubjek,
      '   Lokasi Infrastruktur': item.infraLokasi,
      '3. Status Mediasi Warga': item.mediasiStatus,
      '4. Posko Trantibum': item.poskoTrantibStatus,
      '5. Posko Bersemi': item.poskoBersemiStatus,
      '6. Giat Kebersihan': item.kebersihanStatus,
      '7. Pemantauan Faktor 74': item.faktor74Status,
      'Total Laporan Masuk': item.reportCount,
      'Tanggal Laporan Terakhir': item.latestDate,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekapitulasi Trantibum 7 Bidang');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Rekap_Trantibum_7Bidang_Mangga_${dateStr}.xlsx`);
  };

  const handlePrint = () => {
    printOfficialDocument('lembar-cetak-rekap-trantibum', `REKAP_TRANTIBUM_7BIDANG_MANGGA_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div id="lembar-cetak-rekap-trantibum" className="space-y-6 pb-12">
      {/* Header Banner Khusus Seksi Ketentraman & Ketertiban Umum */}
      <div className="bg-linear-to-r from-amber-800 via-orange-900 to-amber-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-900/80 border border-amber-500/40 text-amber-200 text-xs font-bold mb-3">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
              <span>Seksi Ketentraman dan Ketertiban Umum (Trantibum) • Kelurahan Mangga</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Dashboard Pengawasan Ketentraman & Ketertiban Wilayah
            </h2>
            <p className="text-amber-100/90 text-sm mt-1 max-w-3xl">
              Monitoring 7 Bidang Tugas Seksi Trantibum: Poskamling, Infrastruktur Wilayah, Mediasi Warga, Posko Trantibum, Posko Bersemi, Pemantauan Kebersihan, dan Pemantauan Faktor 74.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-amber-950 font-black text-xs hover:bg-amber-50 shadow-md transition-all cursor-pointer"
              title="Unduh Rekap Excel 7 Bidang Trantibum 24 Kepling"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-700" />
              <span>Ekspor Rekap Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-900/80 hover:bg-amber-800 text-white font-bold text-xs border border-amber-600/50 transition-all cursor-pointer"
              title="Cetak Rekap Resmi Seksi Trantibum"
            >
              <Printer className="w-4 h-4 text-amber-200" />
              <span className="hidden sm:inline">Cetak Rekap</span>
            </button>
          </div>
        </div>

        {/* 7 Sub-view Navigation Tabs */}
        <div className="mt-6 pt-5 border-t border-amber-700/60 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
              <ListChecks className="w-4 h-4 text-amber-300" />
              Pilih Bidang Pengawasan Trantibum (7 Bidang):
            </span>
            <div className="flex items-center gap-1 bg-amber-950/80 p-1 rounded-xl border border-amber-700/60 text-xs">
              <button
                type="button"
                onClick={() => setPeriod('all')}
                className={`px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                  period === 'all'
                    ? 'bg-white text-amber-950 shadow-xs'
                    : 'text-amber-100 hover:text-white hover:bg-white/10 font-bold'
                }`}
              >
                Semua Periode
              </button>
              <button
                type="button"
                onClick={() => setPeriod('today')}
                className={`px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                  period === 'today'
                    ? 'bg-white text-amber-950 shadow-xs'
                    : 'text-amber-100 hover:text-white hover:bg-white/10 font-bold'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setPeriod('7days')}
                className={`px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                  period === '7days'
                    ? 'bg-white text-amber-950 shadow-xs'
                    : 'text-amber-100 hover:text-white hover:bg-white/10 font-bold'
                }`}
              >
                7 Hari
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-amber-950/80 p-1.5 rounded-2xl border border-amber-700/60 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSubView('poskamling')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                subView === 'poskamling'
                  ? 'bg-white text-amber-950 shadow-md'
                  : 'text-amber-100 hover:text-white hover:bg-white/10 font-bold'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>1. Poskamling</span>
            </button>

            <button
              type="button"
              onClick={() => setSubView('infrastruktur')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                subView === 'infrastruktur'
                  ? 'bg-white text-amber-950 shadow-md'
                  : 'text-amber-100 hover:text-white hover:bg-white/10 font-bold'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>2. Infrastruktur</span>
            </button>

            <button
              type="button"
              onClick={() => setSubView('mediasi')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                subView === 'mediasi'
                  ? 'bg-white text-amber-950 shadow-md'
                  : 'text-amber-100 hover:text-white hover:bg-white/10 font-bold'
              }`}
            >
              <Handshake className="w-3.5 h-3.5" />
              <span>3. Mediasi Warga</span>
            </button>

            <button
              type="button"
              onClick={() => setSubView('posko_trantibum')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                subView === 'posko_trantibum'
                  ? 'bg-white text-amber-950 shadow-md'
                  : 'text-amber-100 hover:text-white hover:bg-white/10 font-bold'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>4. Posko Trantibum</span>
            </button>

            <button
              type="button"
              onClick={() => setSubView('posko_bersemi')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                subView === 'posko_bersemi'
                  ? 'bg-white text-amber-950 shadow-md'
                  : 'text-amber-100 hover:text-white hover:bg-white/10 font-bold'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>5. Posko Bersemi</span>
            </button>

            <button
              type="button"
              onClick={() => setSubView('kebersihan')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                subView === 'kebersihan'
                  ? 'bg-white text-amber-950 shadow-md'
                  : 'text-amber-100 hover:text-white hover:bg-white/10 font-bold'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>6. Kebersihan</span>
            </button>

            <button
              type="button"
              onClick={() => setSubView('faktor74')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                subView === 'faktor74'
                  ? 'bg-white text-amber-950 shadow-md'
                  : 'text-amber-100 hover:text-white hover:bg-white/10 font-bold'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>7. Faktor 74</span>
            </button>

            <button
              type="button"
              onClick={() => setSubView('ringkasan')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                subView === 'ringkasan'
                  ? 'bg-white text-amber-950 shadow-md'
                  : 'text-amber-100 hover:text-white hover:bg-white/10 font-bold'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Rekapitulasi Master 7 Bidang</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Ringkasan Metric */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Poskamling Aktif */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              1. Poskamling Aktif
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {kpiMetrics.totalPoskamlingActive}
            </span>
            <span className="text-xs font-semibold text-slate-500">/ 24 Lingkungan</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Ronda Malam:</span>
            <span className="font-bold text-amber-800">Siskamling Terjaga</span>
          </div>
        </div>

        {/* Card 2: Pemantauan Infrastruktur */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              2. Infrastruktur Terpantau
            </span>
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center font-bold">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {kpiMetrics.totalInfraReports}
            </span>
            <span className="text-xs font-bold text-orange-700">Laporan Fisik</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Subjek:</span>
            <span className="font-bold text-slate-800">Drainase, Jalan & PJU</span>
          </div>
        </div>

        {/* Card 3: Mediasi Warga */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              3. Giat Mediasi Warga
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Handshake className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {kpiMetrics.totalMediasiGiat}
            </span>
            <span className="text-xs font-bold text-emerald-700">Laporan Damai</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Status Wilayah:</span>
            <span className="font-bold text-emerald-800">Harmonis & Kondusif</span>
          </div>
        </div>

        {/* Card 4: Giat Kebersihan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              6. Giat Kebersihan & Sampah
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Trash2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {kpiMetrics.totalKebersihanGiat}
            </span>
            <span className="text-xs font-bold text-blue-700">Giat Terlaksana</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Fokus:</span>
            <span className="font-bold text-blue-800">Timbulan Sampah & Parit</span>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              {subView === 'poskamling' && <ShieldCheck className="w-5 h-5 text-amber-700" />}
              {subView === 'infrastruktur' && <Wrench className="w-5 h-5 text-amber-700" />}
              {subView === 'mediasi' && <Handshake className="w-5 h-5 text-emerald-700" />}
              {subView === 'posko_trantibum' && <Flag className="w-5 h-5 text-amber-700" />}
              {subView === 'posko_bersemi' && <Sparkles className="w-5 h-5 text-amber-700" />}
              {subView === 'kebersihan' && <Trash2 className="w-5 h-5 text-blue-700" />}
              {subView === 'faktor74' && <ListChecks className="w-5 h-5 text-amber-700" />}
              {subView === 'ringkasan' && <Activity className="w-5 h-5 text-amber-700" />}
              <span>
                {subView === 'poskamling' && '1. Rekapitulasi Operasional Poskamling & Siskamling 24 Lingkungan'}
                {subView === 'infrastruktur' && '2. Pemantauan Kondisi Infrastruktur Wilayah 24 Lingkungan'}
                {subView === 'mediasi' && '3. Laporan Giat Mediasi & Harmonisasi Warga 24 Lingkungan'}
                {subView === 'posko_trantibum' && '4. Kesiapsiagaan Posko Ketentraman & Ketertiban Umum (Trantibum)'}
                {subView === 'posko_bersemi' && '5. Operasional & Keasrian Posko Bersemi 24 Lingkungan'}
                {subView === 'kebersihan' && '6. Pemantauan Kebersihan, Drainase & Sampah 24 Lingkungan'}
                {subView === 'faktor74' && '7. Pemantauan & Inspeksi 74 Indikator Faktor Trantibum'}
                {subView === 'ringkasan' && 'Rekapitulasi Master 7 Bidang Tugas Seksi Trantibum 24 Lingkungan'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Monitoring data terkini pelaporan 24 Kepala Lingkungan Kelurahan Mangga
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari lingkungan / kepling..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>
        </div>

        {/* Mode Switcher Bar untuk Poskamling */}
        {subView === 'poskamling' && (
          <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-amber-50/50">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-700" />
              <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                Monitoring Dokumentasi Foto Poskamling (Per Kepling / Per Hari)
              </span>
            </div>
            <div className="inline-flex p-1 rounded-xl bg-slate-200/80 text-xs font-extrabold gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setPoskamlingDisplayMode('gallery')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  poskamlingDisplayMode === 'gallery'
                    ? 'bg-amber-800 text-white shadow-xs font-black'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>🖼️ Galeri Gambar Per Hari</span>
              </button>
              <button
                type="button"
                onClick={() => setPoskamlingDisplayMode('table')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  poskamlingDisplayMode === 'table'
                    ? 'bg-amber-800 text-white shadow-xs font-black'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>📊 Tabel Operasional</span>
              </button>
              <button
                type="button"
                onClick={() => setPoskamlingDisplayMode('unduh_mingguan')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  poskamlingDisplayMode === 'unduh_mingguan'
                    ? 'bg-amber-800 text-white shadow-xs font-black'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>📥 Unduh Foto (1 Minggu Terakhir)</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: POSKAMLING - GALERI FOTO PER HARI (24 KEPLING) */}
        {subView === 'poskamling' && poskamlingDisplayMode === 'gallery' && (
          <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 bg-slate-50/50">
            {displayedData.map((item) => {
              const hasPhoto = Boolean(item.latestPoskamlingPhoto?.url);
              const photoCount = item.poskamlingPhotos?.length || 0;

              return (
                <div
                  key={item.kepling.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                >
                  {/* Card Header */}
                  <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                        {item.kepling.lingkungan}
                      </span>
                      <h4 className="font-bold text-xs text-white truncate max-w-[150px] mt-0.5">
                        {item.kepling.nama}
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-amber-200 bg-amber-950/80 px-2 py-1 rounded-lg border border-amber-700/50">
                      {item.poskamlingStatus}
                    </span>
                  </div>

                  {/* Photo Container */}
                  <div
                    className="relative aspect-4/3 bg-slate-100 overflow-hidden group/img cursor-pointer"
                    onClick={() => {
                      if (hasPhoto) {
                        setPreviewImage({
                          url: item.latestPoskamlingPhoto!.url,
                          title: `Dokumentasi Poskamling ${item.kepling.lingkungan}`,
                          date: item.latestPoskamlingPhoto!.date || item.latestDate,
                          kepling: item.kepling.nama,
                          status: item.poskamlingStatus,
                          location: item.poskamlingLokasi,
                          notes: item.poskamlingNote,
                        });
                      }
                    }}
                  >
                    {hasPhoto ? (
                      <>
                        <img
                          src={item.latestPoskamlingPhoto!.url}
                          alt={`Foto Poskamling ${item.kepling.lingkungan}`}
                          className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white font-black text-xs gap-1.5 backdrop-blur-2xs">
                          <Eye className="w-4 h-4 text-amber-300" />
                          <span>Perbesar Foto</span>
                        </div>
                        {photoCount > 1 && (
                          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-white font-bold text-[10px] border border-white/20">
                            +{photoCount} Foto
                          </span>
                        )}
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-white font-medium text-[10px] backdrop-blur-xs flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-400" />
                          {item.latestPoskamlingPhoto!.date}
                        </span>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-linear-to-b from-slate-100 to-amber-50/30 text-slate-400">
                        <Camera className="w-8 h-8 text-slate-300 mb-1" />
                        <span className="text-[11px] font-bold text-slate-500">Foto Belum Diunggah</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Siskamling Terpantau Kondusif</span>
                      </div>
                    )}
                  </div>

                  {/* Card Info */}
                  <div className="p-3.5 space-y-2 text-xs border-t border-slate-100 bg-white">
                    <div className="flex items-start gap-1.5 text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <span className="font-bold text-[11px] text-slate-800 line-clamp-1">{item.poskamlingLokasi}</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-slate-600">
                      <Users className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <span className="text-[11px] font-medium line-clamp-1">{item.poskamlingPetugas}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 italic line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100 font-medium">
                      "{item.poskamlingNote}"
                    </p>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400">
                        {item.latestDate}
                      </span>
                      {onSelectKeplingRiwayat && (
                        <button
                          type="button"
                          onClick={() => onSelectKeplingRiwayat(item.kepling.nama)}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-[11px] transition-colors cursor-pointer border border-amber-200 inline-flex items-center gap-1"
                        >
                          <span>Riwayat</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="overflow-x-auto">
          {/* TAB 1: POSKAMLING - TABEL OPERASIONAL */}
          {subView === 'poskamling' && poskamlingDisplayMode === 'table' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4 text-center w-12">No</th>
                  <th className="py-3 px-4">Kepala Lingkungan</th>
                  <th className="py-3 px-4 text-center">Foto Siskamling (Harian)</th>
                  <th className="py-3 px-4 text-center bg-amber-50/60 text-amber-950">Status Poskamling</th>
                  <th className="py-3 px-4">Lokasi Pos Ronda</th>
                  <th className="py-3 px-4">Petugas Ronda</th>
                  <th className="py-3 px-4 max-w-xs">Keterangan Kamtibmas</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayedData.map((item, idx) => (
                  <tr key={item.kepling.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.kepling.nama}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{item.kepling.lingkungan}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.latestPoskamlingPhoto?.url ? (
                        <div
                          className="relative inline-block w-12 h-12 rounded-lg overflow-hidden border border-amber-200 shadow-2xs group cursor-pointer"
                          onClick={() =>
                            setPreviewImage({
                              url: item.latestPoskamlingPhoto!.url,
                              title: `Dokumentasi Poskamling ${item.kepling.lingkungan}`,
                              date: item.latestPoskamlingPhoto!.date || item.latestDate,
                              kepling: item.kepling.nama,
                              status: item.poskamlingStatus,
                              location: item.poskamlingLokasi,
                              notes: item.poskamlingNote,
                            })
                          }
                        >
                          <img
                            src={item.latestPoskamlingPhoto.url}
                            alt="Poskamling"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Nihil Foto</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center bg-amber-50/30">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-white shadow-2xs">
                        {item.poskamlingStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{item.poskamlingLokasi}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{item.poskamlingPetugas}</td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-[11px] text-slate-600 truncate font-medium" title={item.poskamlingNote}>
                        {item.poskamlingNote}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {onSelectKeplingRiwayat && (
                        <button
                          type="button"
                          onClick={() => onSelectKeplingRiwayat(item.kepling.nama)}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition-colors cursor-pointer border border-amber-200"
                        >
                          Riwayat
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 1b: POSKAMLING - DOWNLOAD GALERI 1 MINGGU TERAKHIR */}
          {subView === 'poskamling' && poskamlingDisplayMode === 'unduh_mingguan' && (
            <div className="p-5 sm:p-6 bg-slate-50/50">
              <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-950 p-4 rounded-xl flex items-start gap-2.5">
                <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-black">💡 Galeri Unduh Cepat Laporan Poskamling (7 Hari Terakhir)</p>
                  <p className="mt-0.5 text-slate-700">Berikut adalah daftar lengkap seluruh gambar/dokumentasi poskamling yang dilaporkan oleh 24 Kepala Lingkungan selama 1 minggu terakhir. Anda dapat mengunduh setiap gambar secara langsung satu per satu dengan tombol unduh di bawah gambar.</p>
                </div>
              </div>

              {lastWeekPoskamlingPhotos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {lastWeekPoskamlingPhotos.map((photo, pIdx) => {
                    const downloadFileName = `POSKAMLING_${photo.keplingNama.replace(/\s+/g, '_')}_${photo.date.replace(/\s+/g, '_')}.png`;
                    return (
                      <div key={pIdx} className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-md transition-all">
                        <div>
                          <div className="relative aspect-4/3 bg-slate-100 overflow-hidden group">
                            <img
                              src={photo.url}
                              alt={photo.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white font-bold text-[10px]">
                              {photo.date}
                            </span>
                          </div>
                          <div className="p-3 space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-black">
                              <span className="text-slate-900">{photo.keplingNama}</span>
                              <span className="text-amber-700 text-[10px]">{photo.lingkungan}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 italic line-clamp-2">
                              "{photo.notes}"
                            </p>
                          </div>
                        </div>

                        <div className="p-3 pt-0">
                          <button
                            type="button"
                            onClick={() => handleDownloadImage(photo.url, downloadFileName)}
                            className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-800 hover:bg-amber-900 text-white font-black text-xs transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Unduh Gambar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                  <Camera className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-600">Tidak ada gambar poskamling diunggah</p>
                  <p className="text-xs text-slate-400 mt-1">Belum ada laporan poskamling dengan dokumentasi foto selama 1 minggu terakhir.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INFRASTRUKTUR */}
          {subView === 'infrastruktur' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4 text-center w-12">No</th>
                  <th className="py-3 px-4">Kepala Lingkungan</th>
                  <th className="py-3 px-4 bg-orange-50/60 text-orange-950 font-black">Subjek Pelaporan Infrastruktur</th>
                  <th className="py-3 px-4">Lokasi Wilayah</th>
                  <th className="py-3 px-4 text-center">Titik Koordinat GPS</th>
                  <th className="py-3 px-4 max-w-xs">Catatan Kondisi Fisik</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayedData.map((item, idx) => (
                  <tr key={item.kepling.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.kepling.nama}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{item.kepling.lingkungan}</div>
                    </td>
                    <td className="py-3 px-4 bg-orange-50/30">
                      <div className="font-black text-orange-900">{item.infraSubjek}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{item.infraLokasi}</td>
                    <td className="py-3 px-4 text-center">
                      {item.infraMapsLink ? (
                        <a
                          href={item.infraMapsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-100"
                        >
                          <MapPin className="w-3.5 h-3.5 text-blue-600" />
                          <span>Google Maps</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>
                      ) : (
                        <span className="text-slate-400 font-medium">Terpantau di Lk</span>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-[11px] text-slate-600 truncate font-medium" title={item.infraNote}>
                        {item.infraNote}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {onSelectKeplingRiwayat && (
                        <button
                          type="button"
                          onClick={() => onSelectKeplingRiwayat(item.kepling.nama)}
                          className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-900 font-bold text-xs transition-colors cursor-pointer border border-orange-200"
                        >
                          Riwayat
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 3: MEDIASI WARGA */}
          {subView === 'mediasi' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4 text-center w-12">No</th>
                  <th className="py-3 px-4">Kepala Lingkungan</th>
                  <th className="py-3 px-4 text-center bg-emerald-50/60 text-emerald-950 font-black">Status Mediasi & Harmonisasi</th>
                  <th className="py-3 px-4 text-center">Jumlah Giat Mediasi</th>
                  <th className="py-3 px-4 max-w-md">Catatan / Uraian Penyelesaian Masalah Warga</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayedData.map((item, idx) => (
                  <tr key={item.kepling.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.kepling.nama}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{item.kepling.lingkungan}</div>
                    </td>
                    <td className="py-3 px-4 text-center bg-emerald-50/30">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-2xs">
                        {item.mediasiStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {item.mediasiCount} Kegiatan
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="text-[11px] text-slate-700 font-medium">
                        {item.mediasiNote}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {onSelectKeplingRiwayat && (
                        <button
                          type="button"
                          onClick={() => onSelectKeplingRiwayat(item.kepling.nama)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs transition-colors cursor-pointer border border-emerald-200"
                        >
                          Riwayat
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 4: POSKO TRANTIBUM */}
          {subView === 'posko_trantibum' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4 text-center w-12">No</th>
                  <th className="py-3 px-4">Kepala Lingkungan</th>
                  <th className="py-3 px-4 text-center bg-amber-50/60 text-amber-950 font-black">Status Kesiapsiagaan Posko Trantibum</th>
                  <th className="py-3 px-4 max-w-md">Catatan Posko & Patroli Ketertiban Umum</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayedData.map((item, idx) => (
                  <tr key={item.kepling.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.kepling.nama}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{item.kepling.lingkungan}</div>
                    </td>
                    <td className="py-3 px-4 text-center bg-amber-50/30">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-amber-600 text-white">
                        {item.poskoTrantibStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="text-[11px] text-slate-700 font-medium">
                        {item.poskoTrantibNote}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {onSelectKeplingRiwayat && (
                        <button
                          type="button"
                          onClick={() => onSelectKeplingRiwayat(item.kepling.nama)}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition-colors cursor-pointer border border-amber-200"
                        >
                          Riwayat
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 5: POSKO BERSEMI */}
          {subView === 'posko_bersemi' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4 text-center w-12">No</th>
                  <th className="py-3 px-4">Kepala Lingkungan</th>
                  <th className="py-3 px-4 text-center bg-emerald-50/60 text-emerald-950 font-black">Status Posko Bersemi</th>
                  <th className="py-3 px-4 max-w-md">Catatan Keasrian & Operasional Posko Bersemi</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayedData.map((item, idx) => (
                  <tr key={item.kepling.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.kepling.nama}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{item.kepling.lingkungan}</div>
                    </td>
                    <td className="py-3 px-4 text-center bg-emerald-50/30">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white">
                        {item.poskoBersemiStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="text-[11px] text-slate-700 font-medium">
                        {item.poskoBersemiNote}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {onSelectKeplingRiwayat && (
                        <button
                          type="button"
                          onClick={() => onSelectKeplingRiwayat(item.kepling.nama)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs transition-colors cursor-pointer border border-emerald-200"
                        >
                          Riwayat
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 6: KEBERSIHAN */}
          {subView === 'kebersihan' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4 text-center w-12">No</th>
                  <th className="py-3 px-4">Kepala Lingkungan</th>
                  <th className="py-3 px-4 text-center bg-blue-50/60 text-blue-950 font-black">Status Kebersihan & Sampah</th>
                  <th className="py-3 px-4 text-center">Giat Gotong Royong</th>
                  <th className="py-3 px-4 max-w-md">Catatan Timbulan Sampah & Saluran Air</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayedData.map((item, idx) => (
                  <tr key={item.kepling.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.kepling.nama}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{item.kepling.lingkungan}</div>
                    </td>
                    <td className="py-3 px-4 text-center bg-blue-50/30">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-blue-600 text-white">
                        {item.kebersihanStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {item.kebersihanCount} Laporan
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="text-[11px] text-slate-700 font-medium">
                        {item.kebersihanNote}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {onSelectKeplingRiwayat && (
                        <button
                          type="button"
                          onClick={() => onSelectKeplingRiwayat(item.kepling.nama)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-xs transition-colors cursor-pointer border border-blue-200"
                        >
                          Riwayat
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 7: FAKTOR 74 */}
          {subView === 'faktor74' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4 text-center w-12">No</th>
                  <th className="py-3 px-4">Kepala Lingkungan</th>
                  <th className="py-3 px-4 text-center bg-amber-50/60 text-amber-950 font-black">Indikator Faktor 74</th>
                  <th className="py-3 px-4 max-w-md">Catatan Inspeksi Aspek Trantibum & Keamanan Wilayah</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayedData.map((item, idx) => (
                  <tr key={item.kepling.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.kepling.nama}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{item.kepling.lingkungan}</div>
                    </td>
                    <td className="py-3 px-4 text-center bg-amber-50/30">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-amber-600 text-white">
                        {item.faktor74Status}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="text-[11px] text-slate-700 font-medium">
                        {item.faktor74Note}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {onSelectKeplingRiwayat && (
                        <button
                          type="button"
                          onClick={() => onSelectKeplingRiwayat(item.kepling.nama)}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition-colors cursor-pointer border border-amber-200"
                        >
                          Riwayat
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 8: RINGKASAN MASTER 7 BIDANG */}
          {subView === 'ringkasan' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-3 text-center w-10">No</th>
                  <th className="py-3 px-3">Kepala Lingkungan</th>
                  <th className="py-3 px-3 text-center">1. Poskamling</th>
                  <th className="py-3 px-3 text-center">2. Infrastruktur</th>
                  <th className="py-3 px-3 text-center">3. Mediasi Warga</th>
                  <th className="py-3 px-3 text-center">4. Posko Trantib</th>
                  <th className="py-3 px-3 text-center">5. Posko Bersemi</th>
                  <th className="py-3 px-3 text-center">6. Kebersihan</th>
                  <th className="py-3 px-3 text-center">7. Faktor 74</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayedData.map((item, idx) => (
                  <tr key={item.kepling.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{item.kepling.nama}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{item.kepling.lingkungan}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        {item.poskamlingStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[10px] font-bold text-orange-800 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                        {item.infraSubjek}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {item.mediasiStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {item.poskoTrantibStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                        {item.poskoBersemiStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        {item.kebersihanStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                        {item.faktor74Status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Lightbox Modal Dokumentasi Foto Poskamling */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-slate-900 rounded-3xl max-w-3xl w-full border border-amber-500/30 overflow-hidden shadow-2xl relative text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-extrabold text-sm text-white">{previewImage.title}</h3>
                  {previewImage.kepling && (
                    <p className="text-xs text-amber-300 font-medium">Kepala Lingkungan: {previewImage.kepling}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Image */}
            <div className="p-4 bg-black flex items-center justify-center max-h-[60vh] overflow-hidden">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[55vh] max-w-full object-contain rounded-xl shadow-lg"
              />
            </div>

            {/* Image Details */}
            <div className="p-5 bg-slate-900 border-t border-slate-800 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {previewImage.location && (
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Lokasi Pos Ronda</span>
                    <span className="font-bold text-amber-200">{previewImage.location}</span>
                  </div>
                )}
                {previewImage.status && (
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Status Siskamling</span>
                    <span className="font-bold text-emerald-400">{previewImage.status}</span>
                  </div>
                )}
              </div>

              {previewImage.notes && (
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Keterangan Kamtibmas</span>
                  <p className="text-slate-200 font-medium mt-0.5">{previewImage.notes}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tanggal Pelaporan: {previewImage.date || '-'}</span>
                </span>
                <a
                  href={previewImage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-2xs"
                >
                  <span>Buka Ukuran Penuh</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
