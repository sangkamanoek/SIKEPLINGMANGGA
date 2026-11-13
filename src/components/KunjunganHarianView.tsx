import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserAccount } from '../types';
import {
  KunjunganWargaData,
  subscribeKunjunganWarga,
  deleteKunjunganWargaFromFirestore,
  saveKunjunganWargaToFirestore,
} from '../lib/kunjunganService';
import { FormKunjunganWarga } from './FormKunjunganWarga';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import {
  Users,
  Search,
  FileSpreadsheet,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  Share2,
  Calendar,
  Filter,
  Download,
  Printer,
  Archive,
  Send,
  TrendingUp,
  Image as ImageIcon,
  Camera,
  Eye,
  Loader2,
  Upload,
  HeartHandshake,
  Smartphone,
  ShieldCheck,
  Coins,
} from 'lucide-react';
import { compressImageFile } from '../lib/imageCompressor';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { getTodayLocalIso, formatTanggalIndonesia } from '../lib/formatter';
import { printOfficialDocument } from '../utils/printHelper';

interface KunjunganHarianViewProps {
  currentUser?: UserAccount;
  kunjunganList?: any[];
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const ROMAN_NUMERALS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
  'XXI', 'XXII', 'XXIII', 'XXIV'
];

type PeriodFilterType =
  | 'HARI_INI'
  | 'KEMARIN'
  | '7_HARI'
  | '30_HARI'
  | 'BULAN_INI'
  | 'BULAN_LALU'
  | 'CUSTOM'
  | 'SEMUA';

export const KunjunganHarianView: React.FC<KunjunganHarianViewProps> = ({
  currentUser,
  onShowToast,
}) => {
  const isKepling = currentUser?.role === 'kepling';
  const userLingkungan = currentUser?.lingkungan || '';

  const [visits, setVisits] = useState<KunjunganWargaData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLingkungan, setSelectedLingkungan] = useState<string>(isKepling && userLingkungan ? userLingkungan : 'ALL');
  const [selectedKategori, setSelectedKategori] = useState<string>('ALL');
  const [activePeriod, setActivePeriod] = useState<PeriodFilterType>('HARI_INI');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalIso());
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Form Open State (Default open at the top for instant entry)
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [editingVisit, setEditingVisit] = useState<KunjunganWargaData | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  const [selectedRecapLingkungan, setSelectedRecapLingkungan] = useState<number | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeKunjunganWarga((list) => {
      setVisits(list);
    });
    return () => {
      unsub();
    };
  }, []);

  // Normalizer for Lingkungan number (1 - 24)
  const getLingkunganIndex = (lingkunganStr?: string): number => {
    if (!lingkunganStr) return 0;
    const matchNum = lingkunganStr.match(/\d+/);
    if (matchNum) {
      const n = parseInt(matchNum[0], 10);
      if (n >= 1 && n <= 24) return n;
    }
    for (let i = 0; i < ROMAN_NUMERALS.length; i++) {
      const rom = ROMAN_NUMERALS[i];
      const reg = new RegExp(`\\b${rom}\\b`, 'i');
      if (reg.test(lingkunganStr)) return i + 1;
    }
    return 0;
  };

  // Date filtering logic
  const filteredVisits = useMemo(() => {
    const todayIso = getTodayLocalIso();
    const today = new Date();

    return visits.filter((item) => {
      // 1. Role restriction (Strictly locked to Kepling's own inputs/lingkungan)
      if (isKepling) {
        const matchesLingkungan = userLingkungan && item.lingkungan && item.lingkungan.toLowerCase().includes(userLingkungan.toLowerCase());
        const matchesName = currentUser?.nama && item.namaKepling && item.namaKepling.toLowerCase() === currentUser.nama.toLowerCase();
        if (!matchesLingkungan && !matchesName) {
          return false;
        }
      }

      // 2. Environment filter
      if (selectedLingkungan !== 'ALL') {
        const itemIdx = getLingkunganIndex(item.lingkungan);
        const selectedIdx = getLingkunganIndex(selectedLingkungan);
        if (itemIdx !== selectedIdx && item.lingkungan !== selectedLingkungan) {
          return false;
        }
      }

      // 3. Category filter
      if (selectedKategori !== 'ALL' && item.kategoriBansos !== selectedKategori) {
        return false;
      }

      // 4. Period Filter
      const itemDate = item.tanggal ? item.tanggal.slice(0, 10) : '';
      if (activePeriod === 'HARI_INI') {
        if (itemDate !== (selectedDate || todayIso)) return false;
      } else if (activePeriod === 'KEMARIN') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yestIso = getTodayLocalIso(yesterday);
        if (itemDate !== yestIso) return false;
      } else if (activePeriod === '7_HARI') {
        const d7 = new Date(today);
        d7.setDate(d7.getDate() - 7);
        const d7Iso = getTodayLocalIso(d7);
        if (itemDate < d7Iso || itemDate > todayIso) return false;
      } else if (activePeriod === '30_HARI') {
        const d30 = new Date(today);
        d30.setDate(d30.getDate() - 30);
        const d30Iso = getTodayLocalIso(d30);
        if (itemDate < d30Iso || itemDate > todayIso) return false;
      } else if (activePeriod === 'BULAN_INI') {
        const currentMonth = todayIso.slice(0, 7);
        if (!itemDate.startsWith(currentMonth)) return false;
      } else if (activePeriod === 'BULAN_LALU') {
        const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const prevMonthPrefix = getTodayLocalIso(prevMonthDate).slice(0, 7);
        if (!itemDate.startsWith(prevMonthPrefix)) return false;
      } else if (activePeriod === 'CUSTOM') {
        if (customStartDate && itemDate < customStartDate) return false;
        if (customEndDate && itemDate > customEndDate) return false;
      }

      // 5. Search keyword
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        (item.namaWarga || '').toLowerCase().includes(term) ||
        (item.alamat || '').toLowerCase().includes(term) ||
        (item.namaKepling || '').toLowerCase().includes(term) ||
        (item.lingkungan || '').toLowerCase().includes(term) ||
        (item.keterangan || '').toLowerCase().includes(term);

      return matchesSearch;
    });
  }, [
    visits,
    isKepling,
    userLingkungan,
    selectedLingkungan,
    selectedKategori,
    activePeriod,
    selectedDate,
    customStartDate,
    customEndDate,
    searchTerm,
  ]);

  // Cumulative counts (all time for each environment)
  const cumulativeCounts = useMemo(() => {
    const counts: { [key: number]: number } = {};
    for (let i = 1; i <= 24; i++) {
      counts[i] = 0;
    }
    // Always use the full visits list for cumulative totals
    visits.forEach((v) => {
      const idx = getLingkunganIndex(v.lingkungan);
      if (idx >= 1 && idx <= 24) {
        counts[idx] = (counts[idx] || 0) + 1;
      }
    });
    return counts;
  }, [visits]);

  // Photo count
  const fotoCount = useMemo(() => {
    return filteredVisits.filter((v) => !!v.fotoUrl).length;
  }, [filteredVisits]);

  // Rekapitulasi 4 Pilar Kunjungan Warga (Perlinsos, PBB, IKD, dan BPJS)
  const rekapKategoriStats = useMemo(() => {
    const list = filteredVisits;

    let perlinsosSudah = 0;
    let perlinsosBelum = 0;
    let perlinsosMenolak = 0;

    let pbbLunas = 0;
    let pbbBelum = 0;

    let ikdSudah = 0;
    let ikdProses = 0;
    let ikdBelum = 0;

    let bpjsAktif = 0;
    let bpjsBelum = 0;

    list.forEach((v) => {
      // 1. Perlinsos
      const p = (v.perlinsos || '').toLowerCase();
      const sb = (v.statusBansos || '').toLowerCase();
      if (p === 'sudah' || sb === 'sudah' || sb === 'layak') {
        perlinsosSudah++;
      } else if (p === 'menolak' || sb === 'menolak') {
        perlinsosMenolak++;
      } else {
        perlinsosBelum++;
      }

      // 2. PBB
      const pb = (v.pbb || '').toLowerCase();
      if (pb === 'sudah' || pb === 'lunas') {
        pbbLunas++;
      } else {
        pbbBelum++;
      }

      // 3. IKD
      const ik = (v.ikd || '').toLowerCase();
      if (ik === 'sudah') {
        ikdSudah++;
      } else if (ik === 'proses') {
        ikdProses++;
      } else {
        ikdBelum++;
      }

      // 4. BPJS (Ketenagakerjaan / Mandiri / PBI)
      const bp = (v.bpjsTk || '').toLowerCase();
      if (bp.includes('aktif') || bp.includes('perisai') || bp.includes('sudah')) {
        bpjsAktif++;
      } else {
        bpjsBelum++;
      }
    });

    return {
      total: list.length,
      perlinsos: { sudah: perlinsosSudah, belum: perlinsosBelum, menolak: perlinsosMenolak },
      pbb: { lunas: pbbLunas, belum: pbbBelum },
      ikd: { sudah: ikdSudah, proses: ikdProses, belum: ikdBelum },
      bpjs: { aktif: bpjsAktif, belum: bpjsBelum },
    };
  }, [filteredVisits]);

  // Chart data: daily visits over last 14 days
  const dailyChartData = useMemo(() => {
    const daysMap: { [key: string]: number } = {};
    const days: string[] = [];
    const base = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const iso = getTodayLocalIso(d);
      days.push(iso);
      daysMap[iso] = 0;
    }
    visits.forEach((v) => {
      const d = v.tanggal ? v.tanggal.slice(0, 10) : '';
      if (daysMap[d] !== undefined) {
        daysMap[d] += 1;
      }
    });
    return days.map((dateIso) => {
      const dayNum = dateIso.slice(8, 10);
      const monthNum = dateIso.slice(5, 7);
      return {
        tanggal: `${dayNum}/${monthNum}`,
        fullDate: dateIso,
        kunjungan: daysMap[dateIso] || 0,
      };
    });
  }, [visits]);

  const handleDelete = async (id: string) => {
    try {
      await deleteKunjunganWargaFromFirestore(id);
      setDeleteConfirmId(null);
      if (onShowToast) onShowToast('Data kunjungan warga berhasil dihapus.', 'success');
    } catch {
      if (onShowToast) onShowToast('Gagal menghapus data kunjungan.', 'error');
    }
  };

  const handleInlinePhotoUpload = async (visit: KunjunganWargaData, file?: File) => {
    if (!file) return;
    setUploadingPhotoId(visit.id);
    try {
      const comp = await compressImageFile(file, 1024, 0.82);
      let photoDataUrl = comp;
      if (!photoDataUrl) {
        photoDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as string) || '');
          reader.readAsDataURL(file);
        });
      }

      if (!photoDataUrl) {
        throw new Error('Gagal memproses file foto');
      }

      const updated: KunjunganWargaData = {
        ...visit,
        fotoUrl: photoDataUrl,
        updatedAt: new Date().toISOString(),
      };

      await saveKunjunganWargaToFirestore(updated);
      if (onShowToast) {
        onShowToast(`Foto dokumentasi warga ${visit.namaWarga} berhasil disimpan!`, 'success');
      }
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      const errMsg = 'Gagal mengunggah foto: ' + (err.message || err);
      if (onShowToast) {
        onShowToast(errMsg, 'error');
      } else {
        setInlineError(errMsg);
      }
    } finally {
      setUploadingPhotoId(null);
    }
  };

  const handleCopyWa = () => {
    const todayIso = getTodayLocalIso();
    const dateLabel = activePeriod === 'HARI_INI' ? `Hari Ini (${selectedDate || todayIso})` : (selectedDate || todayIso);
    
    let text = `*REKAP KUNJUNGAN HARIAN DOOR-TO-DOOR*\n`;
    text += `*KELURAHAN MANGGA, KEC. MEDAN TUNTUNGAN*\n`;
    text += `Periode / Tanggal: ${dateLabel}\n`;
    text += `Total Kunjungan: ${filteredVisits.length} Rumah\n\n`;
    text += `----------------------------------------\n`;

    // Group filtered visits by Environment for daily details
    const groups: { [key: string]: KunjunganWargaData[] } = {};
    filteredVisits.forEach((v) => {
      const env = v.lingkungan || 'Tanpa Lingkungan';
      if (!groups[env]) groups[env] = [];
      groups[env].push(v);
    });

    // Sort environment keys
    const sortedEnvs = Object.keys(groups).sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
      return numA - numB;
    });

    sortedEnvs.forEach((env) => {
      const list = groups[env];
      text += `*${env}*\n`;
      text += `Total Kunjungan : ${list.length} Warga\n`;
      text += `Rincian :\n`;
      list.forEach((w) => {
        text += `- ${w.namaWarga.toUpperCase()} (${(w.alamat || '-').toUpperCase()})\n`;
      });
      text += `\n`;
    });

    // Cumulative stats
    text += `*TOTAL KUNJUNGAN PER LINGKUNGAN SAMPAI DENGAN HARI INI:*\n`;
    for (let i = 1; i <= 24; i++) {
      const rom = ROMAN_NUMERALS[i - 1];
      const count = cumulativeCounts[i] || 0;
      text += `- Lingkungan ${rom}: ${count} Warga\n`;
    }
    text += `\n*TOTAL SELURUH KUNJUNGAN: ${visits.length} Warga*`;

    navigator.clipboard.writeText(text);
    if (onShowToast) onShowToast('Rekap Kunjungan WA berhasil disalin!', 'success');
  };

  const handleExportExcel = () => {
    try {
      const rows = filteredVisits.map((v, idx) => ({
        No: idx + 1,
        Tanggal: v.tanggal,
        Lingkungan: v.lingkungan,
        'Nama Kepling': v.namaKepling,
        'Nama Warga': v.namaWarga,
        Alamat: v.alamat,
        Perlinsos: v.perlinsos || '-',
        IKD: v.ikd || '-',
        'BPJS TK': v.bpjsTk || '-',
        'Pembayaran PBB': v.pbb || '-',
        'Kategori Program': v.kategoriBansos || '-',
        'Status Penyaluran': v.statusBansos || '-',
        'Foto Dokumentasi': v.fotoUrl ? 'Ada' : 'Tidak Ada',
        Keterangan: v.keterangan || '-',
      }));

      const ws = XLSX.utils.aoa_to_sheet([
        ['PEMERINTAH KOTA MEDAN - KECAMATAN MEDAN TUNTUNGAN'],
        ['KELURAHAN MANGGA'],
        ['BUKU REKAPITULASI KUNJUNGAN HARIAN LAPANGAN (DOOR-TO-DOOR)'],
        [`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`],
        ['#MedanUntukSemua | #SemuaUntukMedan'],
        [],
        [
          'No',
          'Tanggal',
          'Lingkungan',
          'Nama Kepling',
          'Nama Warga',
          'Alamat',
          'Perlinsos',
          'IKD',
          'BPJS TK',
          'Pembayaran PBB',
          'Kategori Program',
          'Status Penyaluran',
          'Foto Dokumentasi',
          'Keterangan',
        ],
        ...rows.map((r, i) => [
          i + 1,
          r.Tanggal,
          r.Lingkungan,
          r['Nama Kepling'],
          r['Nama Warga'],
          r.Alamat,
          r.Perlinsos,
          r.IKD,
          r['BPJS TK'],
          r['Pembayaran PBB'],
          r['Kategori Program'],
          r['Status Penyaluran'],
          r['Foto Dokumentasi'],
          r.Keterangan,
        ]),
      ]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Kunjungan Warga');
      XLSX.writeFile(
        wb,
        `Rekap_Kunjungan_Warga_Kelurahan_Mangga_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      if (onShowToast) onShowToast('File Excel Kunjungan Warga berhasil diunduh!', 'success');
    } catch {
      if (onShowToast) onShowToast('Gagal mengunduh file Excel.', 'error');
    }
  };

  const handleDownloadZip = async () => {
    try {
      if (onShowToast) onShowToast('Menyiapkan paket ZIP berkas dan foto...', 'info');
      const zip = new JSZip();

      // 1. Add Excel file to ZIP
      const rows = filteredVisits.map((v, idx) => ({
        No: idx + 1,
        Tanggal: v.tanggal,
        Lingkungan: v.lingkungan,
        'Nama Kepling': v.namaKepling,
        'Nama Warga': v.namaWarga,
        Alamat: v.alamat,
        Perlinsos: v.perlinsos || '-',
        IKD: v.ikd || '-',
        'Pembayaran PBB': v.pbb || '-',
        'Status Penyaluran': v.statusBansos || '-',
        Keterangan: v.keterangan || '-',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Kunjungan Warga');
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      zip.file('Data_Kunjungan_Warga.xlsx', excelBuffer);

      // 2. Add Photos folder
      const imgFolder = zip.folder('Foto_Dokumentasi');
      let addedPhotos = 0;
      filteredVisits.forEach((v, idx) => {
        const photo = v.fotoUrl || (v as any).foto || (v as any).fotoDokumentasi || (v as any).photoUrl;
        if (photo && photo.startsWith('data:image')) {
          const parts = photo.split(',');
          if (parts[1]) {
            const cleanName = (v.namaWarga || `warga_${idx}`).replace(/[^a-zA-Z0-9]/g, '_');
            const cleanLingk = (v.lingkungan || `lingk_${idx}`).replace(/[^a-zA-Z0-9]/g, '_');
            imgFolder?.file(`${cleanLingk}_${cleanName}_${idx + 1}.jpg`, parts[1], {
              base64: true,
            });
            addedPhotos++;
          }
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Paket_ZIP_Kunjungan_Kelurahan_Mangga_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      if (onShowToast)
        onShowToast(
          `Paket ZIP berhasil diunduh (${addedPhotos} foto + Excel)!`,
          'success'
        );
    } catch {
      if (onShowToast) onShowToast('Gagal membuat paket ZIP.', 'error');
    }
  };

  const handlePrint = () => {
    printOfficialDocument('print-area-kunjungan', `Rekap_Kunjungan_Warga_${selectedDate || getTodayLocalIso()}`);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-7xl mx-auto px-2 sm:px-4">
      {inlineError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs font-bold text-rose-800">
          <span>{inlineError}</span>
          <button
            type="button"
            onClick={() => setInlineError(null)}
            className="p-1 rounded-lg hover:bg-rose-100 text-rose-600 cursor-pointer shrink-0"
            aria-label="Tutup pesan kesalahan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* 1. ATAS: FORM KUNJUNGAN WARGA SECTION (Siap diisi Kepling tanpa perlu scrolling) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-slate-900 text-sm">Pencatatan Sambang Warga Baru (Door-to-Door)</h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              Form Aktif
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            {isFormOpen ? 'Sembunyikan Form' : '+ Buka Form Kunjungan'}
          </button>
        </div>

        {isFormOpen && (
          <FormKunjunganWarga
            currentUser={currentUser}
            editItem={editingVisit}
            onSuccess={() => {
              setEditingVisit(null);
              if (onShowToast) onShowToast('Data kunjungan warga berhasil disimpan!', 'success');
            }}
            onClose={() => {
              setEditingVisit(null);
            }}
          />
        )}
      </div>

      {/* 1.5 ACCUMULATIVE VISITS STATUS BANNER */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-emerald-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black tracking-wide border border-emerald-400/30 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              DATABASE KUNJUNGAN AKTIF
            </span>
            <span className="text-xs text-slate-300 font-medium">
              Total Tercatat: <strong className="text-amber-300 font-black text-sm">{visits.length} Kunjungan Warga</strong>
            </span>
          </div>
          <div className="text-xs text-slate-200">
            {activePeriod === 'HARI_INI' ? (
              filteredVisits.length > 0 ? (
                <span>Menampilkan <strong className="text-emerald-300">{filteredVisits.length} kunjungan</strong> yang tercatat hari ini ({formatTanggalIndonesia(selectedDate || getTodayLocalIso())}).</span>
              ) : (
                <span>Belum ada kunjungan yang diinput untuk hari ini ({formatTanggalIndonesia(selectedDate || getTodayLocalIso())}). Tersimpan <strong className="text-amber-300 font-bold">{visits.length} riwayat kunjungan</strong> pada periode sebelumnya.</span>
              )
            ) : (
              <span>Menampilkan <strong className="text-emerald-300">{filteredVisits.length} kunjungan</strong> dari total {visits.length} kunjungan tersimpan (Filter: {activePeriod === 'SEMUA' ? 'Semua Riwayat' : activePeriod}).</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {activePeriod === 'HARI_INI' && visits.length > 0 && (
            <button
              type="button"
              onClick={() => setActivePeriod('SEMUA')}
              className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md hover:scale-[1.02] transition-all cursor-pointer"
            >
              <Eye className="w-4 h-4 text-slate-950" />
              <span>Lihat Seluruh {visits.length} Kunjungan (Semua Periode)</span>
            </button>
          )}
          {activePeriod !== 'HARI_INI' && (
            <button
              type="button"
              onClick={() => setActivePeriod('HARI_INI')}
              className="px-3.5 py-2 bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 border border-emerald-500/30 transition-all cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-300" />
              <span>Kembali ke Hari Ini</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. TENGAH: FILTER TOOLBAR & ACTION BAR (Exact matching screenshot 2) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3.5">
        {/* Row 1: Filter Periode Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs uppercase tracking-wide mr-1">
            <Filter className="w-3.5 h-3.5 text-emerald-600" />
            <span>FILTER PERIODE:</span>
          </div>

          {[
            { id: 'HARI_INI', label: 'Hari Ini' },
            { id: 'KEMARIN', label: 'Kemarin' },
            { id: '7_HARI', label: '7 Hari Terakhir' },
            { id: '30_HARI', label: '30 Hari Terakhir' },
            { id: 'BULAN_INI', label: 'Bulan Ini' },
            { id: 'BULAN_LALU', label: 'Bulan Lalu' },
            { id: 'CUSTOM', label: 'Rentang Kustom...' },
            { id: 'SEMUA', label: 'Semua Periode' },
          ].map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActivePeriod(tab.id as PeriodFilterType)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activePeriod === tab.id
                  ? 'bg-[#1f5f4b] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Row 2: Date Picker, Environment Dropdown, Search Input, View Mode Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1 border-t border-slate-100">
          {/* Tanggal Tertentu */}
          <div className="sm:col-span-4 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Tanggal Tertentu</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setActivePeriod('HARI_INI');
              }}
              className="bg-transparent text-xs font-medium text-slate-800 outline-none w-full cursor-pointer ml-auto text-right"
            />
          </div>

          {/* Environment dropdown */}
          <div className="sm:col-span-3">
            <select
              value={selectedLingkungan}
              onChange={(e) => setSelectedLingkungan(e.target.value)}
              disabled={isKepling}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-bold outline-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {!isKepling && <option value="ALL">Semua 24 Lingkungan</option>}
              {KEPLING_ACCOUNTS.filter(k => !isKepling || k.lingkungan === userLingkungan).map((k) => (
                <option key={k.id} value={k.lingkungan}>
                  {k.lingkungan} - {k.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div className="sm:col-span-3 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama warga, alamat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* View Mode Toggle: Tabel | Kartu (HP) */}
          <div className="sm:col-span-2 flex items-center justify-end">
            <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tabel
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kartu (HP)
              </button>
            </div>
          </div>
        </div>

        {/* Custom Date Range if active */}
        {activePeriod === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs">
            <span className="font-bold text-emerald-900">Rentang Tanggal:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white"
            />
            <span>s.d.</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white"
            />
          </div>
        )}

        {/* Row 3: Action Buttons (Unduh Semua Foto, Share Excel, ZIP, Salin WA, Cetak) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>
              Dokumentasi: <strong className="text-slate-900">{fotoCount} foto</strong> dari{' '}
              <strong className="text-slate-900">{filteredVisits.length} kunjungan</strong>
            </span>
            <button
              type="button"
              onClick={handleDownloadZip}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 font-bold text-xs cursor-pointer transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Semua Foto</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2e7d5e] hover:bg-[#256a4f] text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Share Excel Bergambar</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs cursor-pointer transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Unduh Excel (.xlsx) + FOTO</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadZip}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs cursor-pointer transition-all"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Paket ZIP (Excel + Semua Foto)</span>
            </button>

            <button
              type="button"
              onClick={handleCopyWa}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Salin WA</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Tabel</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2.5 REKAPITULASI 4 PILAR KUNJUNGAN: PERLINSOS, PBB, IKD, DAN BPJS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Rekapitulasi Kunjungan Warga (Perlinsos, PBB, IKD & BPJS)</span>
            </h3>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              {rekapKategoriStats.total} KK Terdata
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
            Sinkron otomatis dari catatan lapangan
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. REKAP PERLINSOS / BANSOS */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <HeartHandshake className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Pilar 1</div>
                  <div className="text-xs font-black text-slate-900">Rekap Perlinsos</div>
                </div>
              </div>
              <span className="text-xs font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
                {rekapKategoriStats.perlinsos.sudah} KK
              </span>
            </div>
            <div className="space-y-1.5 text-[11px] pt-1 border-t border-slate-100">
              <div className="flex justify-between items-center text-slate-600">
                <span>Sudah Menerima / Terdaftar:</span>
                <strong className="text-emerald-700 font-bold">{rekapKategoriStats.perlinsos.sudah} KK</strong>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Belum Terdaftar Bansos:</span>
                <strong className="text-slate-700 font-bold">{rekapKategoriStats.perlinsos.belum} KK</strong>
              </div>
              {rekapKategoriStats.perlinsos.menolak > 0 && (
                <div className="flex justify-between items-center text-amber-700 font-medium">
                  <span>Warga Menolak:</span>
                  <strong>{rekapKategoriStats.perlinsos.menolak} KK</strong>
                </div>
              )}
            </div>
          </div>

          {/* 2. REKAP PBB-P2 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Pilar 2</div>
                  <div className="text-xs font-black text-slate-900">Rekap PBB-P2</div>
                </div>
              </div>
              <span className="text-xs font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                {rekapKategoriStats.pbb.lunas} Lunas
              </span>
            </div>
            <div className="space-y-1.5 text-[11px] pt-1 border-t border-slate-100">
              <div className="flex justify-between items-center text-slate-600">
                <span>Sudah Bayar / Lunas:</span>
                <strong className="text-emerald-700 font-bold">{rekapKategoriStats.pbb.lunas} WP</strong>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Belum Bayar / Menunggak:</span>
                <strong className="text-rose-600 font-bold">{rekapKategoriStats.pbb.belum} WP</strong>
              </div>
              <div className="flex justify-between items-center text-slate-400 text-[10px]">
                <span>Tingkat Kepatuhan:</span>
                <span className="font-bold text-slate-700">
                  {rekapKategoriStats.total > 0
                    ? `${Math.round((rekapKategoriStats.pbb.lunas / rekapKategoriStats.total) * 100)}%`
                    : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. REKAP IKD (IDENTITAS DIGITAL) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Pilar 3</div>
                  <div className="text-xs font-black text-slate-900">Aktivasi IKD</div>
                </div>
              </div>
              <span className="text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                {rekapKategoriStats.ikd.sudah} Aktif
              </span>
            </div>
            <div className="space-y-1.5 text-[11px] pt-1 border-t border-slate-100">
              <div className="flex justify-between items-center text-slate-600">
                <span>Sudah Aktivasi IKD:</span>
                <strong className="text-blue-700 font-bold">{rekapKategoriStats.ikd.sudah} Orang</strong>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Belum / Belum Aktivasi:</span>
                <strong className="text-slate-700 font-bold">{rekapKategoriStats.ikd.belum} Orang</strong>
              </div>
              {rekapKategoriStats.ikd.proses > 0 && (
                <div className="flex justify-between items-center text-amber-700 font-medium">
                  <span>Dalam Proses:</span>
                  <strong>{rekapKategoriStats.ikd.proses} Orang</strong>
                </div>
              )}
            </div>
          </div>

          {/* 4. REKAP BPJS (KETENAGAKERJAAN / KESEHATAN) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Pilar 4</div>
                  <div className="text-xs font-black text-slate-900">Rekap BPJS</div>
                </div>
              </div>
              <span className="text-xs font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100">
                {rekapKategoriStats.bpjs.aktif} Terdaftar
              </span>
            </div>
            <div className="space-y-1.5 text-[11px] pt-1 border-t border-slate-100">
              <div className="flex justify-between items-center text-slate-600">
                <span>Aktif / Agen Perisai:</span>
                <strong className="text-purple-700 font-bold">{rekapKategoriStats.bpjs.aktif} Jiwa</strong>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Belum Terdaftar:</span>
                <strong className="text-slate-700 font-bold">{rekapKategoriStats.bpjs.belum} Jiwa</strong>
              </div>
              <div className="flex justify-between items-center text-slate-400 text-[10px]">
                <span>Cakupan Perlindungan:</span>
                <span className="font-bold text-slate-700">
                  {rekapKategoriStats.total > 0
                    ? `${Math.round((rekapKategoriStats.bpjs.aktif / rekapKategoriStats.total) * 100)}%`
                    : '0%'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. DAFTAR KUNJUNGAN: TABEL ATAU KARTU */}
      <div id="print-area-kunjungan" ref={printAreaRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredVisits.length === 0 ? (
          <div className="p-10 text-center space-y-3.5">
            <Users className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">
              {activePeriod === 'HARI_INI'
                ? `Belum Ada Kunjungan Warga yang Diinput Hari Ini (${formatTanggalIndonesia(selectedDate || getTodayLocalIso())})`
                : 'Belum ada data kunjungan warga sesuai kriteria filter'}
            </h3>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
              {activePeriod === 'HARI_INI' && visits.length > 0
                ? `Tersimpan total ${visits.length} riwayat kunjungan pada database (periode bulan September–Oktober). Anda dapat melihat seluruh riwayat kunjungan warga sebelumnya dengan mengklik tombol di bawah ini:`
                : 'Gunakan form di atas untuk mencatat sambang warga baru atau sesuaikan kriteria pencarian & filter periode.'}
            </p>
            {activePeriod === 'HARI_INI' && visits.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActivePeriod('SEMUA')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-emerald-200" />
                  <span>Tampilkan Seluruh {visits.length} Riwayat Kunjungan Warga</span>
                </button>
              </div>
            )}
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                  <th className="p-3.5 text-center w-12">No</th>
                  <th className="p-3.5">Tanggal</th>
                  <th className="p-3.5">Lingkungan / Kepling</th>
                  <th className="p-3.5">Nama Warga</th>
                  <th className="p-3.5">Alamat</th>
                  <th className="p-3.5 text-center">Perlinsos</th>
                  <th className="p-3.5 text-center">IKD</th>
                  <th className="p-3.5 text-center">BPJS</th>
                  <th className="p-3.5 text-center">PBB</th>
                  <th className="p-3.5 text-center">Foto</th>
                  <th className="p-3.5">Catatan</th>
                  <th className="p-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredVisits.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-3.5 whitespace-nowrap font-medium text-slate-700">{item.tanggal}</td>
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{item.lingkungan}</div>
                      <div className="text-[10px] text-slate-500">{item.namaKepling}</div>
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">{item.namaWarga}</td>
                    <td className="p-3.5 text-slate-700 max-w-[180px] truncate" title={item.alamat}>
                      {item.alamat}
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.perlinsos === 'Sudah'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.perlinsos === 'Belum'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.perlinsos || '-'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.ikd === 'Sudah'
                            ? 'bg-blue-100 text-blue-800'
                            : item.ikd === 'Proses'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.ikd || '-'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.bpjsTk === 'Aktif' || item.bpjsTk === 'Sudah Daftar (Agen Perisai)'
                            ? 'bg-purple-100 text-purple-800'
                            : item.bpjsTk === 'Non-Aktif'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.bpjsTk || '-'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.pbb === 'Sudah' || item.pbb === 'Lunas'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.pbb || '-'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      {(() => {
                        const photoSrc =
                          item.fotoUrl ||
                          (item as any).foto ||
                          (item as any).fotoDokumentasi ||
                          (item as any).photoUrl;

                        if (photoSrc) {
                          return (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPreviewPhotoUrl(photoSrc)}
                                className="group relative w-12 h-12 rounded-xl overflow-hidden border-2 border-emerald-400/60 shadow-xs hover:shadow-md hover:scale-105 transition-all cursor-pointer bg-slate-100 flex items-center justify-center shrink-0"
                                title="Klik untuk memperbesar foto dokumentasi"
                              >
                                <img
                                  src={photoSrc}
                                  alt={item.namaWarga}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Eye className="w-4 h-4" />
                                </div>
                              </button>
                              <label
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer"
                                title="Ganti / Perbarui Foto"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={uploadingPhotoId === item.id}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleInlinePhotoUpload(item, f);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </div>
                          );
                        }

                        return (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                              Belum Ada Foto
                            </span>
                            <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black shadow-xs cursor-pointer transition-all hover:scale-105">
                              {uploadingPhotoId === item.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Menyimpan...</span>
                                </>
                              ) : (
                                <>
                                  <Camera className="w-3 h-3" />
                                  <span>+ Foto</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingPhotoId === item.id}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleInlinePhotoUpload(item, f);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-3.5 text-slate-600 max-w-[200px] truncate" title={item.keterangan}>
                      {item.keterangan || '-'}
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVisit(item);
                            setIsFormOpen(true);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors cursor-pointer"
                          title="Edit Kunjungan"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                          title="Hapus Kunjungan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Cards View (Mobile Friendly) */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVisits.map((item, idx) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {item.lingkungan}
                    </span>
                    <h4 className="text-sm font-black text-slate-900 mt-1">{item.namaWarga}</h4>
                    <p className="text-[11px] text-slate-500 font-medium">{item.alamat}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                    {item.tanggal}
                  </span>
                </div>

                {(() => {
                  const photoSrc =
                    item.fotoUrl ||
                    (item as any).foto ||
                    (item as any).fotoDokumentasi ||
                    (item as any).photoUrl;

                  if (photoSrc) {
                    return (
                      <div className="relative rounded-xl overflow-hidden h-40 bg-slate-100 group">
                        <img
                          src={photoSrc}
                          alt={item.namaWarga}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => setPreviewPhotoUrl(photoSrc)}
                        />
                        <div
                          onClick={() => setPreviewPhotoUrl(photoSrc)}
                          className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold cursor-pointer gap-1.5"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Klik untuk perbesar</span>
                        </div>
                        <label className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 hover:bg-black/80 backdrop-blur-xs text-white text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer">
                          <Camera className="w-3 h-3" />
                          <span>Ganti Foto</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingPhotoId === item.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleInlinePhotoUpload(item, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    );
                  }

                  return (
                    <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-3.5 flex flex-col items-center justify-center text-center space-y-2">
                      <span className="text-[11px] text-amber-800 font-bold">
                        Foto dokumentasi belum dilampirkan
                      </span>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer transition-colors">
                        {uploadingPhotoId === item.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Menyimpan Foto...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-3.5 h-3.5" />
                            <span>+ Ambil / Unggah Foto</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingPhotoId === item.id}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleInlinePhotoUpload(item, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <div className="text-slate-400 font-medium">Perlinsos</div>
                    <div className="font-bold text-slate-800">{item.perlinsos || '-'}</div>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <div className="text-slate-400 font-medium">IKD</div>
                    <div className="font-bold text-slate-800">{item.ikd || '-'}</div>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <div className="text-slate-400 font-medium">BPJS</div>
                    <div className="font-bold text-purple-800">{item.bpjsTk || '-'}</div>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <div className="text-slate-400 font-medium">PBB</div>
                    <div className="font-bold text-slate-800">{item.pbb || '-'}</div>
                  </div>
                </div>

                {item.keterangan && (
                  <p className="text-[11px] text-slate-600 bg-slate-50/70 p-2 rounded-xl italic">
                    "{item.keterangan}"
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-[10px] text-slate-400">Kepling: {item.namaKepling}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingVisit(item);
                        setIsFormOpen(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. BAWAH: REKAPITULASI KUNJUNGAN PER LINGKUNGAN (Exact matching screenshot 1) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Rekapitulasi Kunjungan Per Lingkungan (Sampai Dengan Hari Ini)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Total akumulasi sambang warga door-to-door se-Kelurahan Mangga (24 Lingkungan)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-[#1f5f4b] text-white px-5 py-2.5 rounded-xl text-center shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                TOTAL KUNJUNGAN {isKepling ? userLingkungan.toUpperCase() : 'SELURUH'}
              </div>
              <div className="text-lg font-black tracking-tight">
                {isKepling ? filteredVisits.length : visits.length} Warga
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyWa}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-emerald-600" />
              <span>Salin WA</span>
            </button>
          </div>
        </div>

        {/* 24 Lingkungan Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 24 }).map((_, idx) => {
            const lingkNum = idx + 1;
            const rom = ROMAN_NUMERALS[idx];
            const count = cumulativeCounts[lingkNum] || 0;
            
            // If Kepling, only show their own neighborhood
            if (isKepling && !userLingkungan.toLowerCase().includes(`lingkungan ${lingkNum}`) && !userLingkungan.toLowerCase().includes(`lk ${lingkNum}`)) {
              return null;
            }

            return (
              <button
                key={lingkNum}
                type="button"
                onClick={() => setSelectedRecapLingkungan(lingkNum)}
                className={`flex flex-col p-3 rounded-2xl border transition-all text-left group hover:scale-[1.02] cursor-pointer ${
                  count > 0 ? 'bg-emerald-50 border-emerald-100 hover:border-emerald-300' : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1 group-hover:text-emerald-600 transition-colors">
                  Lingkungan {rom}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-xl font-black ${count > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {count}
                  </span>{' '}
                  <span className="text-[11px] text-slate-500 font-medium">Warga</span>
                </div>
                <div className="mt-1 text-[9px] font-bold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  <Eye className="w-2.5 h-2.5" />
                  <span>Lihat Nama</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Big Green Banner at Bottom of Rekapitulasi */}
        <div className="bg-[#1e614d] text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-700/60 flex items-center justify-center text-white shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-100">
                TOTAL KUNJUNGAN {isKepling ? userLingkungan.toUpperCase() : 'SELURUH'}
              </div>
              <div className="text-[11px] text-emerald-200 font-semibold">
                AKUMULASI SAMBANG WARGA {isKepling ? userLingkungan.toUpperCase() : '24 LINGKUNGAN'} (HARI INI ({getTodayLocalIso()}))
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black tracking-tight">
              {isKepling ? filteredVisits.length : visits.length}
            </span>
            <span className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-emerald-200">
              WARGA
            </span>
          </div>
        </div>
      </div>


      {/* 5. TREN KUNJUNGAN HARIAN (Chart Section) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Tren Kunjungan Harian (14 Hari Terakhir)</h3>
              <p className="text-[11px] text-slate-500">Aktivitas kunjungan door-to-door se-Kelurahan Mangga</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Volume Kunjungan Harian
            </span>
          </div>
        </div>

        <div className="h-48 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="tanggal" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white text-xs p-2.5 rounded-xl shadow-lg border border-slate-800">
                        <div className="font-bold">{data.fullDate}</div>
                        <div className="text-emerald-400 font-black mt-1">
                          {data.kunjungan} Kunjungan Warga
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="kunjungan" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Photo Preview Modal */}
      {previewPhotoUrl && (
        <div
          onClick={() => setPreviewPhotoUrl(null)}
          className="modal-preview p-4 bg-black/80 backdrop-blur-xs flex items-center justify-center cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-4 max-w-lg w-full shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-sm text-slate-900">Foto Dokumentasi Kunjungan</span>
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-slate-900 max-h-[70vh] flex items-center justify-center">
              <img src={previewPhotoUrl} alt="Preview" className="max-w-full max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-preview p-4 bg-black/60 backdrop-blur-xs flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-slate-900 text-base">Hapus Data Kunjungan?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Data yang dihapus tidak dapat dipulihkan kembali dari basis data.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md cursor-pointer"
              >
                Hapus Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Names List Modal */}
      {selectedRecapLingkungan !== null && (
        <div
          onClick={() => setSelectedRecapLingkungan(null)}
          className="modal-preview p-4 bg-black/60 backdrop-blur-xs flex items-center justify-center cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div>
                <h4 className="font-black text-slate-900 text-lg">
                  Daftar Warga Sambang
                </h4>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                  Lingkungan {ROMAN_NUMERALS[selectedRecapLingkungan - 1]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecapLingkungan(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-2">
              {(isKepling ? filteredVisits : visits)
                .filter((v) => {
                  const idx = getLingkunganIndex(v.lingkungan);
                  return idx === selectedRecapLingkungan;
                })
                .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''))
                .map((v, i) => (
                  <div key={v.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all flex items-center justify-between group">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{v.namaWarga}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{v.alamat}</div>
                      <div className="text-[10px] text-emerald-600 font-bold mt-0.5">{v.tanggal}</div>
                    </div>
                    {v.fotoUrl && (
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200">
                        <img src={v.fotoUrl} className="w-full h-full object-cover" alt="Warga" />
                      </div>
                    )}
                  </div>
                ))}
              {(isKepling ? filteredVisits : visits).filter(v => getLingkunganIndex(v.lingkungan) === selectedRecapLingkungan).length === 0 && (
                <div className="py-12 text-center text-slate-400">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-bold">Belum ada data kunjungan tercatat</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecapLingkungan(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
