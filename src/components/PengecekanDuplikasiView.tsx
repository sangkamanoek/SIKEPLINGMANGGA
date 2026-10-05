import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Download,
  Filter,
  Users,
  CreditCard,
  Building,
  MapPin,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Info,
  ArrowRight,
  Database,
  Eye,
  CheckCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { UserAccount, DataKeluarga } from '../types';
import { SpptPbbItem } from '../data/pbbSampleData';
import {
  runFullDuplicateAudit,
  searchUniversalNikNop,
  FullAuditSummary,
  AuditDuplicateItem,
  formatNopDisplay,
  cleanNik,
  cleanNop,
  LiveUniversalSearchResult,
} from '../lib/duplicateCheckService';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { autoCleanDuplicateDataKeluarga } from '../lib/dataKeluargaService';

interface PengecekanDuplikasiViewProps {
  currentUser: UserAccount;
  dataKeluarga: DataKeluarga[];
  spptList: SpptPbbItem[];
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenKkDetail?: (kk: DataKeluarga) => void;
  onOpenEditKk?: (kk: DataKeluarga) => void;
  onOpenEditSppt?: (sppt: SpptPbbItem) => void;
}

export const PengecekanDuplikasiView: React.FC<PengecekanDuplikasiViewProps> = ({
  currentUser,
  dataKeluarga,
  spptList,
  onShowToast,
  onOpenKkDetail,
  onOpenEditKk,
  onOpenEditSppt,
}) => {
  const isKepling = currentUser.role === 'kepling';

  // Search state with debounce
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Filter state
  const [activeTab, setActiveTab] = useState<'all' | 'nik_ganda' | 'nop_ganda' | 'kk_ganda' | 'nop_cross_kk' | 'nop_lingkungan_beda'>('all');
  const [filterLingkungan, setFilterLingkungan] = useState<string>(isKepling ? currentUser.id : 'all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Pagination state for ultra-smooth UI performance
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Cleanup duplicates state
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [confirmCleanModal, setConfirmCleanModal] = useState<boolean>(false);

  // Debounced search handler (200ms for instant feel)
  useEffect(() => {
    setIsSearching(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setIsSearching(false);
    }, 200);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchInput]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterLingkungan, debouncedQuery]);

  // Run full audit in-memory (instant <10ms)
  const auditSummary: FullAuditSummary = useMemo(() => {
    return runFullDuplicateAudit(dataKeluarga, spptList);
  }, [dataKeluarga, spptList]);

  // Live search result when user types in search box
  const liveSearchResult: LiveUniversalSearchResult = useMemo(() => {
    if (!debouncedQuery) {
      return { query: '', nikMatches: [], spptMatches: [], kkMatches: [], duplicateCount: 0 };
    }
    return searchUniversalNikNop(debouncedQuery, dataKeluarga, spptList);
  }, [debouncedQuery, dataKeluarga, spptList]);

  // Filtered audit duplicate list
  const filteredDuplicates = useMemo(() => {
    let list = auditSummary.duplicateItems;

    // Filter by issue type
    if (activeTab !== 'all') {
      list = list.filter((item) => item.type === activeTab);
    }

    // Filter by lingkungan
    if (filterLingkungan !== 'all') {
      const targetLk = KEPLING_ACCOUNTS.find((k) => k.id === filterLingkungan)?.nomorLingkungan;
      if (targetLk) {
        list = list.filter((item) => item.lingkunganList.includes(targetLk));
      }
    }

    // Filter by query if user is typing
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      const qDigits = debouncedQuery.replace(/[^0-9]/g, '');
      list = list.filter(
        (item) =>
          item.key.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (qDigits && item.key.replace(/[^0-9]/g, '').includes(qDigits)) ||
          item.details.some((d) => d.nama.toLowerCase().includes(q) || d.alamat.toLowerCase().includes(q))
      );
    }

    return list;
  }, [auditSummary, activeTab, filterLingkungan, debouncedQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredDuplicates.length / pageSize));
  const paginatedDuplicates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDuplicates.slice(start, start + pageSize);
  }, [filteredDuplicates, currentPage]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    if (onShowToast) onShowToast(`"${text}" disalin ke clipboard!`, 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const executeAutoClean = async () => {
    setIsCleaning(true);
    try {
      const res = await autoCleanDuplicateDataKeluarga();
      setConfirmCleanModal(false);
      if (onShowToast) onShowToast(res.message, res.deletedCount > 0 ? 'success' : 'info');
    } catch (err: any) {
      console.error(err);
      if (onShowToast) onShowToast('Gagal membersihkan duplikasi: ' + err.message, 'error');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleExportAuditExcel = () => {
    if (filteredDuplicates.length === 0) {
      if (onShowToast) onShowToast('Tidak ada data duplikasi untuk diekspor.', 'info');
      return;
    }

    try {
      const headers = ['No', 'Tipe Masalah', 'Kunci ID (NIK/NOP/KK)', 'Tingkat Urgensi', 'Jumlah Rekor', 'Daftar Lingkungan', 'Rincian Entri'];
      const rows = filteredDuplicates.map((item, idx) => [
        idx + 1,
        item.title,
        item.key,
        item.severity.toUpperCase(),
        item.occurrences,
        item.lingkunganList.map((l) => `Lingkungan ${l}`).join(', '),
        item.details.map((d) => `[${d.label}] ${d.nama} (${d.lingkungan} - ${d.alamat})`).join(' | '),
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,\uFEFF' +
        [headers.join(','), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Audit_Duplikasi_NIK_NOP_Kelurahan_Mangga_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (onShowToast) onShowToast('Laporan audit duplikasi berhasil diunduh dalam format CSV/Excel!', 'success');
    } catch (e) {
      if (onShowToast) onShowToast('Gagal mengunduh laporan audit.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-6 sm:p-8 shadow-xl border border-indigo-800/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Sistem Verifikasi & Integritas Data Instan</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Pengecekan Duplikasi NOP & NIK Instan
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Pencarian cepat berkecepatan tinggi (debounced fast search) untuk mendeteksi ganda NIK kependudukan,
              nomor Kartu Keluarga, dan Nomor Objek Pajak (NOP) PBB-P2 di 24 Lingkungan Kelurahan Mangga.
            </p>
          </div>

          <div className="flex flex-row sm:flex-col items-start sm:items-end gap-3 shrink-0">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-right min-w-[160px]">
              <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Skor Integritas Data</div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-0.5">
                {auditSummary.integrityScore}%
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                {auditSummary.duplicateItems.length === 0 ? '✓ Bersih Tanpa Duplikasi' : `${auditSummary.duplicateItems.length} Potensi Duplikasi`}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmCleanModal(true)}
                disabled={isCleaning}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-2 transition-all shadow-lg hover:shadow-rose-500/25 cursor-pointer active:scale-95"
                title="Otomatis bersihkan data KK duplikat, mempertahankan yang memiliki lingkungan"
              >
                <ShieldAlert className="w-4 h-4 text-rose-200" />
                <span>{isCleaning ? 'Membersihkan...' : 'Bersihkan Duplikasi Otomatis'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportAuditExcel}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-indigo-500/25 cursor-pointer active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Ekspor Hasil Audit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* NIK Ganda */}
        <div
          onClick={() => setActiveTab(activeTab === 'nik_ganda' ? 'all' : 'nik_ganda')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'nik_ganda'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400 shadow-md'
              : 'bg-white border-slate-200 hover:border-rose-200 hover:bg-rose-50/40 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <div className="p-2 rounded-xl bg-rose-100">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
              Kependudukan
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900">{auditSummary.totalNikDuplicates}</div>
          <div className="text-xs font-bold text-slate-600 mt-0.5">NIK Terindikasi Ganda</div>
          <p className="text-[10px] text-slate-400 mt-1">Ditemukan di &gt;1 Kepala/Anggota KK</p>
        </div>

        {/* NOP SPPT Ganda */}
        <div
          onClick={() => setActiveTab(activeTab === 'nop_ganda' ? 'all' : 'nop_ganda')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'nop_ganda'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400 shadow-md'
              : 'bg-white border-slate-200 hover:border-amber-200 hover:bg-amber-50/40 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <div className="p-2 rounded-xl bg-amber-100">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              PBB-P2
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900">{auditSummary.totalNopDuplicates}</div>
          <div className="text-xs font-bold text-slate-600 mt-0.5">NOP Terdaftar Ganda</div>
          <p className="text-[10px] text-slate-400 mt-1">SPPT dengan NOP yang sama</p>
        </div>

        {/* Nomor KK Ganda */}
        <div
          onClick={() => setActiveTab(activeTab === 'kk_ganda' ? 'all' : 'kk_ganda')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'kk_ganda'
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400 shadow-md'
              : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-blue-50/40 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <div className="p-2 rounded-xl bg-blue-100">
              <Database className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Kartu Keluarga
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900">{auditSummary.totalKkDuplicates}</div>
          <div className="text-xs font-bold text-slate-600 mt-0.5">Nomor KK Ganda</div>
          <p className="text-[10px] text-slate-400 mt-1">Nomor KK dipakai &gt;1 Kepala Keluarga</p>
        </div>

        {/* NOP Selisih Lingkungan */}
        <div
          onClick={() => setActiveTab(activeTab === 'nop_lingkungan_beda' ? 'all' : 'nop_lingkungan_beda')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'nop_lingkungan_beda'
              ? 'bg-teal-50 border-teal-300 ring-2 ring-teal-400 shadow-md'
              : 'bg-white border-slate-200 hover:border-teal-200 hover:bg-teal-50/40 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-teal-600 mb-2">
            <div className="p-2 rounded-xl bg-teal-100">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
              Sinkronisasi
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900">{auditSummary.totalMismatchedLingkungan}</div>
          <div className="text-xs font-bold text-slate-600 mt-0.5">Selisih Wilayah NOP</div>
          <p className="text-[10px] text-slate-400 mt-1">Lingkungan KK ≠ Lingkungan SPPT</p>
        </div>
      </div>

      {/* Fast Debounced Search Bar */}
      <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Ketik NIK 16 digit, NOP PBB, Nomor KK, nama warga, atau nama jalan untuk uji instan..."
              className="w-full pl-12 pr-10 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/60 transition-all font-mono"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {/* Lingkungan Selector */}
            <select
              value={filterLingkungan}
              onChange={(e) => setFilterLingkungan(e.target.value)}
              disabled={isKepling}
              className="px-4 py-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Semua Lingkungan (I - XXIV)</option>
              {KEPLING_ACCOUNTS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.lingkungan}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Badges / Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {[
            { id: 'all', label: `Semua Temuan (${auditSummary.duplicateItems.length})` },
            { id: 'nik_ganda', label: `NIK Ganda (${auditSummary.totalNikDuplicates})` },
            { id: 'nop_ganda', label: `NOP SPPT Ganda (${auditSummary.totalNopDuplicates})` },
            { id: 'kk_ganda', label: `No. KK Ganda (${auditSummary.totalKkDuplicates})` },
            { id: 'nop_cross_kk', label: `NOP Digunakan Banyak KK` },
            { id: 'nop_lingkungan_beda', label: `Selisih Wilayah (${auditSummary.totalMismatchedLingkungan})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Fast Search Results Preview (If User is Searching) */}
      {debouncedQuery && (
        <div className="p-5 bg-gradient-to-br from-indigo-50/70 to-blue-50/70 rounded-3xl border border-indigo-200 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <Search className="w-4 h-4 text-indigo-600" />
              <span>Hasil Pencarian Instan: "{debouncedQuery}"</span>
            </div>
            <div className="text-xs font-semibold text-indigo-700">
              {liveSearchResult.nikMatches.length} NIK | {liveSearchResult.spptMatches.length} SPPT | {liveSearchResult.kkMatches.length} KK
            </div>
          </div>

          {liveSearchResult.nikMatches.length === 0 &&
          liveSearchResult.spptMatches.length === 0 &&
          liveSearchResult.kkMatches.length === 0 ? (
            <div className="p-4 bg-white/80 rounded-2xl text-center text-xs font-medium text-slate-500">
              Tidak ditemukan rekor yang cocok dengan kata kunci tersebut.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* NIK Matches */}
              {liveSearchResult.nikMatches.slice(0, 6).map((m, idx) => (
                <div key={idx} className="p-3 bg-white rounded-2xl border border-indigo-100 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                      NIK: {m.nik}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{m.lingkunganNama}</span>
                  </div>
                  <div className="font-black text-xs text-slate-900 truncate">{m.nama}</div>
                  <div className="text-[11px] text-slate-500 truncate">{m.role} • {m.namaJalan}</div>
                </div>
              ))}

              {/* SPPT Matches */}
              {liveSearchResult.spptMatches.slice(0, 6).map((s, idx) => (
                <div key={idx} className="p-3 bg-white rounded-2xl border border-teal-100 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-md">
                      NOP: {formatNopDisplay(s.nop)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Lingkungan {s.lingkungan}</span>
                  </div>
                  <div className="font-black text-xs text-slate-900 truncate">{s.namaWp}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    PBB: Rp {(s.pbbTerutang || 0).toLocaleString('id-ID')} • {s.status || 'Belum Bayar'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Duplicate Findings List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>Daftar Temuan Duplikasi Data ({filteredDuplicates.length})</span>
          </div>
          <span className="text-xs text-slate-400">
            Total dipindai: {auditSummary.totalKkScanned} KK, {auditSummary.totalAnggotaScanned} Anggota, {auditSummary.totalSpptScanned} SPPT
          </span>
        </div>

        {filteredDuplicates.length === 0 ? (
          <div className="p-12 bg-white rounded-3xl border border-dashed border-slate-200 text-center space-y-3 max-w-xl mx-auto shadow-2xs">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Database Bersih & Valid!</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Tidak ditemukan duplikasi data NIK, NOP PBB, maupun Nomor KK untuk kriteria filter yang dipilih.
              Seluruh data terverifikasi unik dan konsisten.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {paginatedDuplicates.map((item) => {
                const isCritical = item.severity === 'critical';
                const isHigh = item.severity === 'high';

                const badgeColor = isCritical
                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                  : isHigh
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-blue-100 text-blue-800 border-blue-200';

                return (
                  <div
                    key={item.id}
                    className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-4"
                  >
                    {/* Item Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${isCritical ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                            <span>{item.title}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                              {item.occurrences} Entri Bertabrakan
                            </span>
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleCopy(item.key, item.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Salin NIK/NOP"
                        >
                          {copiedKey === item.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === item.id ? 'Tersalin' : 'Salin ID'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Conflicting Entries Comparison Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {item.details.map((entry, eIdx) => (
                        <div
                          key={eIdx}
                          className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2 relative group hover:bg-slate-100/80 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {entry.label}
                            </span>
                            <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700">
                              {entry.lingkungan}
                            </span>
                          </div>

                          <div>
                            <div className="font-black text-xs text-slate-900 truncate">{entry.nama}</div>
                            <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{entry.alamat}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-1 truncate">{entry.source}</div>
                          </div>

                          {/* Action buttons */}
                          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-end gap-1">
                            {onOpenEditKk && entry.id.startsWith('kk_') && (
                              <button
                                type="button"
                                onClick={() => {
                                  const target = dataKeluarga.find((k) => k.id === entry.id);
                                  if (target) onOpenEditKk(target);
                                }}
                                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-lg cursor-pointer"
                              >
                                <span>Edit Data KK</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                            {onOpenEditSppt && !entry.id.startsWith('kk_') && (
                              <button
                                type="button"
                                onClick={() => {
                                  const target = spptList.find((s) => s.id === entry.id);
                                  if (target) onOpenEditSppt(target);
                                }}
                                className="text-[10px] font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 px-2 py-1 bg-teal-50 rounded-lg cursor-pointer"
                              >
                                <span>Edit SPPT PBB</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
                <div className="text-xs text-slate-500 font-medium">
                  Menampilkan <strong className="text-slate-900">{((currentPage - 1) * pageSize) + 1}</strong> – <strong className="text-slate-900">{Math.min(currentPage * pageSize, filteredDuplicates.length)}</strong> dari <strong className="text-slate-900">{filteredDuplicates.length}</strong> temuan
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pNum = i + 1;
                      if (totalPages > 5 && currentPage > 3) {
                        pNum = currentPage - 2 + i;
                        if (pNum > totalPages) pNum = totalPages - (4 - i);
                      }
                      return (
                        <button
                          key={pNum}
                          type="button"
                          onClick={() => setCurrentPage(pNum)}
                          className={`w-8 h-8 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                            currentPage === pNum
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {pNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: KONFIRMASI BERSIHKAN DUPLIKASI OTOMATIS */}
      {confirmCleanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Bersihkan Data KK Duplikat Otomatis?</h3>
                <p className="text-xs text-slate-500 font-medium">Sistem akan memindai &amp; menyeleksi seluruh Nomor KK dan NIK yang ganda.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Aturan Pembersihan Sesuai Permintaan Anda:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 text-[11px]">
                <li><strong>Prioritas Lingkungan:</strong> KK yang memiliki Lingkungan (1–24) akan <strong>dipertahankan</strong>.</li>
                <li><strong>Hapus Duplikat Tanpa Lingkungan:</strong> Data ganda yang tidak memiliki lingkungan akan <strong>dihapus otomatis</strong>.</li>
                <li><strong>Gabungkan Anggota Keluarga:</strong> Seluruh anggota keluarga dari data duplikat akan <strong>disatukan ke data utama</strong> agar tidak ada data warga yang hilang.</li>
                <li><strong>Jaminan Unik:</strong> Jika sama-sama tidak memiliki lingkungan, 1 data disimpan dan data duplikat lainnya dibersihkan sehingga Nomor KK benar-benar unik.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmCleanModal(false)}
                disabled={isCleaning}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeAutoClean}
                disabled={isCleaning}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                {isCleaning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Ya, Jalankan Pembersihan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
