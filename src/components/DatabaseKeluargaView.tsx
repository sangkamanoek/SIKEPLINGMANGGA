import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
  FileSpreadsheet,
  Printer,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  HeartHandshake,
  Droplets,
  Shield,
  Activity,
  Baby,
  Building2,
  Filter,
  RefreshCw,
  X,
  Save,
  Check,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Download,
  Upload,
  UploadCloud,
  BarChart3,
  ListFilter,
  FileUp,
  AlertCircle,
  Table,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import {
  DataKeluarga,
  AnggotaKeluarga,
  UserAccount,
  HubunganKeluargaType,
  StatusPerkawinanType,
  AgamaType,
  StatusBpjsKesehatanType,
} from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import {
  subscribeDataKeluarga,
  saveDataKeluargaToFirestore,
  deleteDataKeluargaFromFirestore,
  exportDataKeluargaToExcel,
  downloadImportTemplateExcel,
  parseDataKeluargaFile,
  batchSaveDataKeluarga,
  ImportParsedResult,
} from '../lib/dataKeluargaService';
import { printOfficialDocument } from '../utils/printHelper';

interface DatabaseKeluargaViewProps {
  currentUser: UserAccount;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateToWebgis?: (lat?: number, lng?: number) => void;
}

export const DatabaseKeluargaView: React.FC<DatabaseKeluargaViewProps> = ({
  currentUser,
  onShowToast,
  onNavigateToWebgis,
}) => {
  const isKepling = currentUser.role === 'kepling';
  const isAdmin = currentUser.role === 'super_admin' || currentUser.role.startsWith('kasi_');

  // Main state
  const [dataList, setDataList] = useState<DataKeluarga[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterLingkungan, setFilterLingkungan] = useState<string>(
    isKepling ? currentUser.id : 'all'
  );
  const [filterDesil, setFilterDesil] = useState<string>('all');
  const [filterBansos, setFilterBansos] = useState<string>('all');
  const [filterSanitasi, setFilterSanitasi] = useState<string>('all');
  const [filterStunting, setFilterStunting] = useState<string>('all');

  // Modals
  const [selectedDetailKk, setSelectedDetailKk] = useState<DataKeluarga | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingKk, setEditingKk] = useState<DataKeluarga | null>(null);

  // Tab Menu State
  const [activeTab, setActiveTab] = useState<'daftar' | 'statistik' | 'import'>('daftar');

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isParsingImport, setIsParsingImport] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ImportParsedResult | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  // Real-time Firestore subscription
  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeDataKeluarga(
      (list) => {
        setDataList(list);
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Filtered list
  const filteredList = useMemo(() => {
    return dataList.filter((item) => {
      // Lingkungan filter
      if (filterLingkungan !== 'all' && item.lingkunganId !== filterLingkungan) {
        return false;
      }

      // Desil filter
      if (filterDesil !== 'all') {
        const desil = item.desilKesejahteraan || '';
        if (filterDesil === 'DESIL_1_2') {
          if (!desil.includes('Desil 1') && !desil.includes('Desil 2')) return false;
        } else if (filterDesil === 'DESIL_3_5') {
          if (!desil.includes('Desil 3') && !desil.includes('Desil 4') && !desil.includes('Desil 5')) return false;
        } else if (filterDesil === 'DESIL_6_10') {
          if (!desil.includes('Desil 6') && !desil.includes('Mampu') && !desil.includes('Non-Desil')) return false;
        } else if (desil !== filterDesil) {
          return false;
        }
      }

      // Bansos filter
      if (filterBansos !== 'all') {
        const bansosList = item.bantuanDiterima || [];
        if (filterBansos === 'PKH_MEDAN_MAKMUR') {
          if (!bansosList.includes('PKH Medan Makmur')) return false;
        } else if (filterBansos === 'PKH_NASIONAL') {
          if (!bansosList.includes('PKH Nasional')) return false;
        } else if (filterBansos === 'BPNT') {
          if (!bansosList.some((b) => b.toLowerCase().includes('bpnt') || b.toLowerCase().includes('sembako'))) return false;
        } else if (filterBansos === 'BLT') {
          if (!bansosList.some((b) => b.toLowerCase().includes('blt') || b.toLowerCase().includes('dbh'))) return false;
        } else if (filterBansos === 'PBI_JK') {
          if (!bansosList.some((b) => b.toLowerCase().includes('pbi') || b.toLowerCase().includes('bpjs gratis'))) return false;
        } else if (filterBansos === 'PENERIMA') {
          if (!item.penerimaBansos && bansosList.length === 0) return false;
        } else if (filterBansos === 'NON_BANSOS') {
          if (item.penerimaBansos || bansosList.length > 0) return false;
        }
      }

      // Sanitasi filter
      if (filterSanitasi !== 'all') {
        const jamban = item.jambanKeluarga || '';
        const airMinum = item.sumberAirMinum || '';
        const airBersih = item.sumberAirBersih || '';
        if (filterSanitasi === 'JAMBAN_SENDIRI') {
          if (!jamban.includes('Sendiri')) return false;
        } else if (filterSanitasi === 'JAMBAN_KOMUNAL') {
          if (!jamban.includes('Bersama') && !jamban.includes('Komunal')) return false;
        } else if (filterSanitasi === 'BABS') {
          if (!jamban.includes('Tidak Memiliki') && !jamban.includes('BABS')) return false;
        } else if (filterSanitasi === 'AIR_PDAM') {
          if (!airMinum.includes('PDAM') && !airBersih.includes('PDAM')) return false;
        } else if (filterSanitasi === 'AIR_DEPOT') {
          if (!airMinum.includes('Depot') && !airMinum.includes('Kemasan')) return false;
        } else if (filterSanitasi === 'AIR_SUMUR') {
          if (!airMinum.includes('Sumur') && !airBersih.includes('Sumur')) return false;
        }
      }

      // Stunting filter
      if (filterStunting !== 'all') {
        const stunting = item.statusStuntingRentan || '';
        if (filterStunting === 'RESTI_STUNTING') {
          if (!stunting.includes('Stunting') && !stunting.includes('KEK') && !stunting.includes('Resti')) return false;
        } else if (filterStunting === 'BEBAS_STUNTING') {
          if (!stunting.includes('Bebas')) return false;
        }
      }

      // Live search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchKk = item.nomorKk?.toLowerCase().includes(q);
        const matchNama = item.namaKepalaKeluarga?.toLowerCase().includes(q);
        const matchNik = item.nikKepalaKeluarga?.toLowerCase().includes(q);
        const matchJalan = item.namaJalan?.toLowerCase().includes(q);
        const matchTelepon = item.telepon?.toLowerCase().includes(q);
        const matchAnggota = item.anggotaKeluarga?.some((a) =>
          a.nama.toLowerCase().includes(q) || a.nik.toLowerCase().includes(q)
        );
        return matchKk || matchNama || matchNik || matchJalan || matchTelepon || matchAnggota;
      }

      return true;
    });
  }, [
    dataList,
    filterLingkungan,
    filterDesil,
    filterBansos,
    filterSanitasi,
    filterStunting,
    searchQuery,
  ]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    const totalKk = filteredList.length;
    const totalJiwa = filteredList.reduce((s, k) => s + (k.jumlahAnggotaKeluarga || 0), 0);
    const totalLakiLaki = filteredList.reduce((s, k) => s + (k.jumlahLakiLaki || 0), 0);
    const totalPerempuan = filteredList.reduce((s, k) => s + (k.jumlahPerempuan || 0), 0);
    const totalBalita = filteredList.reduce((s, k) => s + (k.jumlahBalita || 0), 0);
    const totalLansia = filteredList.reduce((s, k) => s + (k.jumlahLansia || 0), 0);

    // Kesejahteraan & Bansos
    const countDesil1 = filteredList.filter((k) => k.desilKesejahteraan?.includes('Desil 1')).length;
    const countDesil2 = filteredList.filter((k) => k.desilKesejahteraan?.includes('Desil 2')).length;
    const countDesil3 = filteredList.filter((k) => k.desilKesejahteraan?.includes('Desil 3')).length;
    const countDesil4 = filteredList.filter((k) => k.desilKesejahteraan?.includes('Desil 4')).length;
    const countDesil5 = filteredList.filter((k) => k.desilKesejahteraan?.includes('Desil 5')).length;
    const countDesil6Plus = filteredList.filter((k) => k.desilKesejahteraan?.includes('Desil 6') || k.desilKesejahteraan?.includes('Mampu')).length;

    const countPkhMedanMakmur = filteredList.filter((k) => k.bantuanDiterima?.includes('PKH Medan Makmur')).length;
    const countPkhNasional = filteredList.filter((k) => k.bantuanDiterima?.includes('PKH Nasional')).length;
    const countBpnt = filteredList.filter((k) => k.bantuanDiterima?.some((b) => b.includes('BPNT'))).length;
    const countPbiJk = filteredList.filter((k) => k.bantuanDiterima?.some((b) => b.includes('PBI'))).length;
    const countPenerimaBansos = filteredList.filter((k) => k.penerimaBansos || (k.bantuanDiterima && k.bantuanDiterima.length > 0)).length;

    // Sanitasi
    const countJambanSendiri = filteredList.filter((k) => k.jambanKeluarga?.includes('Sendiri')).length;
    const countJambanKomunal = filteredList.filter((k) => k.jambanKeluarga?.includes('Bersama') || k.jambanKeluarga?.includes('Komunal')).length;
    const countBabs = filteredList.filter((k) => k.jambanKeluarga?.includes('Tidak Memiliki') || k.jambanKeluarga?.includes('BABS')).length;
    const countAirPdam = filteredList.filter((k) => k.sumberAirMinum?.includes('PDAM') || k.sumberAirBersih?.includes('PDAM')).length;
    const countAirDepot = filteredList.filter((k) => k.sumberAirMinum?.includes('Depot') || k.sumberAirMinum?.includes('Kemasan')).length;
    const countAirSumur = filteredList.filter((k) => k.sumberAirMinum?.includes('Sumur') || k.sumberAirBersih?.includes('Sumur')).length;
    const countRestiStunting = filteredList.filter((k) => k.statusStuntingRentan?.includes('Stunting') || k.statusStuntingRentan?.includes('Resti')).length;

    return {
      totalKk,
      totalJiwa,
      totalLakiLaki,
      totalPerempuan,
      totalBalita,
      totalLansia,
      countDesil1,
      countDesil2,
      countDesil3,
      countDesil4,
      countDesil5,
      countDesil6Plus,
      countPkhMedanMakmur,
      countPkhNasional,
      countBpnt,
      countPbiJk,
      countPenerimaBansos,
      countJambanSendiri,
      countJambanKomunal,
      countBabs,
      countAirPdam,
      countAirDepot,
      countAirSumur,
      countRestiStunting,
    };
  }, [filteredList]);

  // Handle Export Excel
  const handleExportExcel = async () => {
    if (filteredList.length === 0) {
      if (onShowToast) onShowToast('Tidak ada data keluarga untuk diekspor.', 'error');
      return;
    }
    setIsExporting(true);
    try {
      const activeLingkunganName =
        filterLingkungan === 'all'
          ? '24 Lingkungan Kelurahan Mangga'
          : KEPLING_ACCOUNTS.find((k) => k.id === filterLingkungan)?.lingkungan || filterLingkungan;

      await exportDataKeluargaToExcel(filteredList, activeLingkunganName, false);
      if (onShowToast) onShowToast('Database Data Keluarga berhasil diunduh dalam format Excel (.xlsx)', 'success');
    } catch (e) {
      console.error(e);
      if (onShowToast) onShowToast('Gagal mengekspor data: ' + e, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Print Buku Register Keluarga
  const handlePrint = () => {
    printOfficialDocument(
      'lembar-cetak-data-keluarga',
      `BUKU_DATABASE_KELUARGA_MANGGA_${new Date().toISOString().split('T')[0]}`
    );
  };

  // Handle Delete
  const handleDelete = async (id: string, namaKk: string) => {
    if (!window.confirm(`Yakin ingin menghapus Data Keluarga "${namaKk}" dari database?`)) {
      return;
    }
    const success = await deleteDataKeluargaFromFirestore(id);
    if (success) {
      if (onShowToast) onShowToast(`Data Keluarga "${namaKk}" berhasil dihapus.`, 'success');
    } else {
      if (onShowToast) onShowToast(`Gagal menghapus data keluarga.`, 'error');
    }
  };

  // Handle Download Excel Import Template
  const handleDownloadTemplate = async () => {
    try {
      await downloadImportTemplateExcel();
      if (onShowToast) onShowToast('Template Excel import berhasil diunduh.', 'success');
    } catch (e) {
      console.error(e);
      if (onShowToast) onShowToast('Gagal mengunduh template Excel: ' + e, 'error');
    }
  };

  // Handle File Select & Parsing
  const handleFileSelect = async (file: File) => {
    setImportFile(file);
    setIsParsingImport(true);
    setParseResult(null);
    try {
      const result = await parseDataKeluargaFile(file);
      setParseResult(result);
      if (onShowToast) {
        if (result.validCount > 0) {
          onShowToast(`Berhasil membaca ${result.validCount} KK dari berkas "${file.name}".`, 'success');
        } else {
          onShowToast('Tidak ada data KK valid yang ditemukan dalam berkas.', 'error');
        }
      }
    } catch (err: any) {
      console.error('Error parsing import file:', err);
      if (onShowToast) onShowToast('Gagal membaca berkas: ' + (err.message || err), 'error');
    } finally {
      setIsParsingImport(false);
    }
  };

  // Handle Batch Import Execution
  const handleExecuteBatchImport = async () => {
    if (!parseResult || parseResult.items.length === 0) return;
    setIsImporting(true);
    setImportProgress({ done: 0, total: parseResult.items.length });
    try {
      const { successCount, failCount } = await batchSaveDataKeluarga(
        parseResult.items,
        (done, total) => {
          setImportProgress({ done, total });
        }
      );
      if (onShowToast) {
        onShowToast(
          `Import selesai! ${successCount} KK berhasil disimpan ke Firestore & lokal.${failCount > 0 ? ` (${failCount} gagal)` : ''}`,
          'success'
        );
      }
      // Reset state & switch tab
      setImportFile(null);
      setParseResult(null);
      setActiveTab('daftar');
    } catch (err: any) {
      console.error('Error executing batch import:', err);
      if (onShowToast) onShowToast('Gagal mengimpor data: ' + err, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div id="lembar-cetak-data-keluarga" className="space-y-6 pb-12">
      {/* Banner Header Database Data Keluarga */}
      <div className="bg-linear-to-r from-blue-950 via-indigo-950 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-800/60 border border-blue-500/40 text-blue-200 text-xs font-bold mb-3">
              <Users className="w-3.5 h-3.5 text-blue-300" />
              <span>Sistem Database Kependudukan & Kesejahteraan • Kelurahan Mangga</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>Database Data Keluarga (Kartu Keluarga)</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/30 text-emerald-300 font-extrabold border border-emerald-400/40">
                24 Lingkungan
              </span>
            </h2>
            <p className="text-blue-100/90 text-sm mt-1 max-w-2xl">
              Basis data terpadu profil keluarga, anggota keluarga (NIK), tingkat kesejahteraan (Desil 1–5), bansos (PKH Medan Makmur), serta sanitasi & kesehatan lingkungan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setEditingKk(null);
                setIsFormOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer border border-emerald-300"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>Tambah Data KK</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-blue-950 font-black text-xs hover:bg-blue-50 shadow-md transition-all cursor-pointer border border-blue-200/60"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>{isExporting ? 'Mengekspor...' : 'Ekspor Excel (.xlsx)'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-900/90 hover:bg-blue-800 text-white font-extrabold text-xs border border-blue-400/50 shadow-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-blue-200" />
              <span className="hidden sm:inline">Cetak Buku Register</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tab Menu */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-wrap items-center gap-1.5 border border-slate-200 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab('daftar')}
          className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs transition-all cursor-pointer ${
            activeTab === 'daftar'
              ? 'bg-white text-blue-950 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Users className="w-4 h-4 text-blue-600" />
          <span>Daftar & Pencarian KK</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold">
            {filteredList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('statistik')}
          className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs transition-all cursor-pointer ${
            activeTab === 'statistik'
              ? 'bg-white text-blue-950 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          <span>Rekap & Grafik Statistik</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('import')}
          className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs transition-all cursor-pointer ${
            activeTab === 'import'
              ? 'bg-white text-blue-950 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <UploadCloud className="w-4 h-4 text-emerald-600" />
          <span>Import Data Keluarga (Excel)</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider">
            Import
          </span>
        </button>
      </div>

      {/* TAB 1: DAFTAR & PENCAARIAN KK */}
      {activeTab === 'daftar' && (
        <>
          {/* KPI Cards Ringkasan Database */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Kartu Keluarga</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{stats.totalKk.toLocaleString('id-ID')} <span className="text-xs font-bold text-blue-700">KK</span></div>
              <div className="text-[10px] text-slate-500 font-medium mt-1">Terdata di 24 Lingkungan</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Jumlah Jiwa</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{stats.totalJiwa.toLocaleString('id-ID')} <span className="text-xs font-bold text-indigo-700">Jiwa</span></div>
              <div className="text-[10px] text-slate-500 font-medium mt-1">L: {stats.totalLakiLaki} | P: {stats.totalPerempuan}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-2xs">
              <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">KK Desil 1–5 (Rentan)</div>
              <div className="text-2xl font-black text-rose-950 mt-1">{stats.countDesil1 + stats.countDesil2 + stats.countDesil3 + stats.countDesil4 + stats.countDesil5} <span className="text-xs font-bold text-rose-700">KK</span></div>
              <div className="text-[10px] text-rose-700 font-medium mt-1">Desil 1: {stats.countDesil1} | Desil 2: {stats.countDesil2}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-purple-200 bg-purple-50/20 shadow-2xs">
              <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">PKH Medan Makmur</div>
              <div className="text-2xl font-black text-purple-950 mt-1">{stats.countPkhMedanMakmur} <span className="text-xs font-bold text-purple-700">KK</span></div>
              <div className="text-[10px] text-purple-700 font-medium mt-1">Bansos Unggulan Pemko</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
              <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Jamban Sehat Mandiri</div>
              <div className="text-2xl font-black text-emerald-950 mt-1">{stats.countJambanSendiri} <span className="text-xs font-bold text-emerald-700">KK</span></div>
              <div className="text-[10px] text-emerald-700 font-medium mt-1">BABS / Tanpa Jamban: {stats.countBabs}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-2xs">
              <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pantauan Stunting</div>
              <div className="text-2xl font-black text-amber-950 mt-1">{stats.countRestiStunting} <span className="text-xs font-bold text-amber-700">Balita</span></div>
              <div className="text-[10px] text-amber-700 font-medium mt-1">Total Balita: {stats.totalBalita} Anak</div>
            </div>
          </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Nomor KK, NIK, Nama Kepala Keluarga, Anggota Keluarga, Nama Jalan/Gang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Lingkungan */}
            <select
              value={filterLingkungan}
              onChange={(e) => setFilterLingkungan(e.target.value)}
              disabled={isKepling}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-70"
            >
              <option value="all">Semua Lingkungan (1 - 24)</option>
              {KEPLING_ACCOUNTS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.lingkungan} ({k.nama})
                </option>
              ))}
            </select>

            {/* Filter Desil */}
            <select
              value={filterDesil}
              onChange={(e) => setFilterDesil(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Semua Tingkat Kesejahteraan</option>
              <option value="DESIL_1_2">Desil 1 &amp; 2</option>
              <option value="DESIL_3_5">Desil 3 – 5</option>
              <option value="DESIL_6_10">Desil 6 – 10</option>
              <option value="Desil 1">Desil 1</option>
              <option value="Desil 2">Desil 2</option>
              <option value="Desil 3">Desil 3</option>
              <option value="Desil 4">Desil 4</option>
              <option value="Desil 5">Desil 5</option>
            </select>

            {/* Filter Bansos */}
            <select
              value={filterBansos}
              onChange={(e) => setFilterBansos(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Semua Status Bansos</option>
              <option value="PKH_MEDAN_MAKMUR">PKH Medan Makmur</option>
              <option value="PKH_NASIONAL">PKH Nasional</option>
              <option value="BPNT">BPNT / Sembako</option>
              <option value="BLT">BLT / DBH</option>
              <option value="PBI_JK">PBI-JK (BPJS Gratis)</option>
              <option value="PENERIMA">Penerima Bansos (Semua Jenis)</option>
              <option value="NON_BANSOS">Bukan Penerima Bansos</option>
            </select>

            {/* Filter Sanitasi */}
            <select
              value={filterSanitasi}
              onChange={(e) => setFilterSanitasi(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Semua Data Sanitasi & Air</option>
              <option value="JAMBAN_SENDIRI">Jamban Sendiri (Septik SNI)</option>
              <option value="JAMBAN_KOMUNAL">Jamban Bersama / Komunal</option>
              <option value="BABS">BABS / Tidak Punya Jamban</option>
              <option value="AIR_PDAM">Sumber Air PDAM Tirtanadi</option>
              <option value="AIR_DEPOT">Air Minum Depot / Kemasan</option>
              <option value="AIR_SUMUR">Air Sumur Bor Listrik</option>
            </select>
          </div>
        </div>

        {/* Active Filter Tags */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600 font-medium">
          <span>Menampilkan <strong className="text-slate-900">{filteredList.length}</strong> KK terdaftar</span>
          {(filterLingkungan !== 'all' || filterDesil !== 'all' || filterBansos !== 'all' || filterSanitasi !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setFilterLingkungan(isKepling ? currentUser.id : 'all');
                setFilterDesil('all');
                setFilterBansos('all');
                setFilterSanitasi('all');
                setFilterStunting('all');
                setSearchQuery('');
              }}
              className="text-rose-600 font-bold hover:underline cursor-pointer ml-2"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      </div>

      {/* Main Table Database Data Keluarga */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4 text-center w-12">No</th>
                <th className="py-3 px-4">Kartu Keluarga (KK)</th>
                <th className="py-3 px-4">Kepala Keluarga</th>
                <th className="py-3 px-4">Wilayah & Alamat</th>
                <th className="py-3 px-4 text-center">Jiwa (L/P)</th>
                <th className="py-3 px-4 text-center bg-rose-50/50 text-rose-950">Tingkat Kesejahteraan</th>
                <th className="py-3 px-4">Bansos Diterima</th>
                <th className="py-3 px-4">Sanitasi & Air</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    <span>Memuat database data keluarga dari Firestore...</span>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                    Belum ada data keluarga yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredList.map((item, index) => {
                  const isDesilRentan =
                    item.desilKesejahteraan?.includes('Desil 1') ||
                    item.desilKesejahteraan?.includes('Desil 2') ||
                    item.desilKesejahteraan?.includes('Desil 3');

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center font-bold text-slate-400">{index + 1}</td>

                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 tracking-tight">{item.nomorKk}</div>
                        <div className="text-[11px] text-slate-500">
                          NIK: <span className="font-mono">{item.nikKepalaKeluarga || '-'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.namaKepalaKeluarga}</div>
                        {item.telepon && (
                          <div className="text-[11px] text-blue-700 font-medium">📞 {item.telepon}</div>
                        )}
                        <div className="text-[10px] text-slate-500 font-medium">
                          {item.pekerjaanUtamaKepalaKeluarga || 'Wiraswasta'}
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-800">{item.lingkunganNama}</div>
                        <div className="text-[11px] text-slate-600 truncate font-medium">{item.namaJalan}</div>
                        <div className="text-[10px] text-slate-400">
                          {item.nomorRumah ? `No. ${item.nomorRumah}` : ''} RT {item.rt || '00'}/RW {item.rw || '00'}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full bg-blue-50 text-blue-900 font-black text-xs border border-blue-200">
                          {item.jumlahAnggotaKeluarga} Jiwa
                        </span>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          L: {item.jumlahLakiLaki} | P: {item.jumlahPerempuan}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center bg-rose-50/30">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black shadow-2xs ${
                            item.desilKesejahteraan?.includes('Desil 1')
                              ? 'bg-rose-600 text-white'
                              : item.desilKesejahteraan?.includes('Desil 2')
                              ? 'bg-rose-500 text-white'
                              : item.desilKesejahteraan?.includes('Desil 3')
                              ? 'bg-amber-500 text-white'
                              : item.desilKesejahteraan?.includes('Desil 4')
                              ? 'bg-amber-400 text-amber-950'
                              : item.desilKesejahteraan?.includes('Desil 5')
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.desilKesejahteraan || 'Belum Terdata'}
                        </span>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        {item.bantuanDiterima && item.bantuanDiterima.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.bantuanDiterima.map((b, bi) => (
                              <span
                                key={bi}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  b === 'PKH Medan Makmur'
                                    ? 'bg-purple-100 text-purple-900 border border-purple-300 font-black'
                                    : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                                }`}
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Bukan Penerima Bansos</span>
                        )}
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="text-[11px] text-slate-700 font-medium">
                          🚽 {item.jambanKeluarga ? item.jambanKeluarga.split('(')[0] : 'Jamban Sendiri'}
                        </div>
                        <div className="text-[10.5px] text-slate-500 font-medium">
                          💧 Minum: {item.sumberAirMinum || 'PDAM'}
                        </div>
                        {item.statusStuntingRentan?.includes('Stunting') && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-black">
                            ⚠️ Pantau Stunting
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailKk(item)}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200"
                            title="Lihat Detail Kartu Keluarga"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingKk(item);
                              setIsFormOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer border border-amber-200"
                            title="Edit Data Keluarga"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id, item.namaKepalaKeluarga)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-800 hover:bg-rose-100 transition-colors cursor-pointer border border-rose-200"
                              title="Hapus Data Keluarga"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* TAB 2: REKAP & GRAFIK STATISTIK */}
      {activeTab === 'statistik' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  <span>Rekapitulasi Analytics & Grafik Statistik Kependudukan</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualisasi distribusi kesejahteraan, bansos, sanitasi, dan risiko stunting 24 Lingkungan Kelurahan Mangga.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 text-indigo-900 text-xs font-extrabold border border-indigo-200">
                <Activity className="w-4 h-4 text-indigo-600" />
                <span>Total Data Terproses: {stats.totalKk} KK ({stats.totalJiwa} Jiwa)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Desil Distribution */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-rose-600" />
                  <span>Tingkat Kesejahteraan (Desil 1 – 10)</span>
                </h4>

                <div className="space-y-3 text-xs font-semibold">
                  <div>
                    <div className="flex justify-between text-rose-900 mb-1">
                      <span>Desil 1</span>
                      <span>{stats.countDesil1} KK ({stats.totalKk ? Math.round((stats.countDesil1 / stats.totalKk) * 100) : 0}%)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-600 rounded-full transition-all duration-500" style={{ width: `${stats.totalKk ? (stats.countDesil1 / stats.totalKk) * 100 : 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-rose-800 mb-1">
                      <span>Desil 2</span>
                      <span>{stats.countDesil2} KK ({stats.totalKk ? Math.round((stats.countDesil2 / stats.totalKk) * 100) : 0}%)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${stats.totalKk ? (stats.countDesil2 / stats.totalKk) * 100 : 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-amber-900 mb-1">
                      <span>Desil 3–5</span>
                      <span>{stats.countDesil3 + stats.countDesil4 + stats.countDesil5} KK ({stats.totalKk ? Math.round(((stats.countDesil3 + stats.countDesil4 + stats.countDesil5) / stats.totalKk) * 100) : 0}%)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${stats.totalKk ? ((stats.countDesil3 + stats.countDesil4 + stats.countDesil5) / stats.totalKk) * 100 : 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-700 mb-1">
                      <span>Desil 6–10</span>
                      <span>{stats.countDesil6Plus} KK ({stats.totalKk ? Math.round((stats.countDesil6Plus / stats.totalKk) * 100) : 0}%)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${stats.totalKk ? (stats.countDesil6Plus / stats.totalKk) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bansos Breakdown */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-purple-600" />
                  <span>Penerima Bantuan Sosial (Bansos)</span>
                </h4>

                <div className="space-y-3 text-xs font-semibold">
                  <div>
                    <div className="flex justify-between text-purple-900 mb-1">
                      <span>PKH Medan Makmur (Unggulan Pemko)</span>
                      <span>{stats.countPkhMedanMakmur} KK</span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 rounded-full transition-all duration-500" style={{ width: `${stats.totalKk ? (stats.countPkhMedanMakmur / stats.totalKk) * 100 : 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-indigo-900 mb-1">
                      <span>PKH Nasional (Kemensos)</span>
                      <span>{stats.countPkhNasional} KK</span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full transition-all duration-500" style={{ width: `${stats.totalKk ? (stats.countPkhNasional / stats.totalKk) * 100 : 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-emerald-900 mb-1">
                      <span>BPNT / Sembako / PBI-JK</span>
                      <span>{stats.countBpnt + stats.countPbiJk} KK</span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full transition-all duration-500" style={{ width: `${stats.totalKk ? ((stats.countBpnt + stats.countPbiJk) / stats.totalKk) * 100 : 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-700 mb-1">
                      <span>Total Seluruh Penerima Bansos</span>
                      <span>{stats.countPenerimaBansos} KK ({stats.totalKk ? Math.round((stats.countPenerimaBansos / stats.totalKk) * 100) : 0}%)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-700 rounded-full transition-all duration-500" style={{ width: `${stats.totalKk ? (stats.countPenerimaBansos / stats.totalKk) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sanitasi & Air Minum */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-600" />
                  <span>Sanitasi & Sumber Air Bersih</span>
                </h4>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500">Jamban Sendiri</div>
                    <div className="text-lg font-black text-emerald-900 mt-0.5">{stats.countJambanSendiri} KK</div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500">Jamban Bersama</div>
                    <div className="text-lg font-black text-amber-900 mt-0.5">{stats.countJambanKomunal} KK</div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500">Air Minum PDAM</div>
                    <div className="text-lg font-black text-blue-900 mt-0.5">{stats.countAirPdam} KK</div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500">Air Minum Depot</div>
                    <div className="text-lg font-black text-indigo-900 mt-0.5">{stats.countAirDepot} KK</div>
                  </div>
                </div>
              </div>

              {/* Stunting & Demografi Jiwa */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Baby className="w-4 h-4 text-amber-600" />
                  <span>Kesehatan Balita & Demografi Jiwa</span>
                </h4>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500">Total Balita (0-5 Th)</div>
                    <div className="text-lg font-black text-slate-900 mt-0.5">{stats.totalBalita} Anak</div>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="text-[10px] font-bold text-amber-800">Resti Stunting</div>
                    <div className="text-lg font-black text-amber-950 mt-0.5">{stats.countRestiStunting} Balita</div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500">Total Lansia (60+ Th)</div>
                    <div className="text-lg font-black text-indigo-900 mt-0.5">{stats.totalLansia} Jiwa</div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500">Rata-rata Jiwa / KK</div>
                    <div className="text-lg font-black text-emerald-900 mt-0.5">
                      {stats.totalKk ? (stats.totalJiwa / stats.totalKk).toFixed(1) : '0'} Jiwa
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: IMPORT DATA KELUARGA (EXCEL / CSV) */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Header Card Import */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-extrabold mb-2">
                  <UploadCloud className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Fitur Import Berkas Terpadu</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
                  <span>Import Data Keluarga dari Berkas Excel / CSV</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                  Unggah berkas spreadsheet Excel (.xlsx / .xls) atau CSV untuk memasukkan atau memperbarui database data keluarga Kelurahan Mangga secara massal.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-900 hover:bg-blue-800 text-white font-black text-xs shadow-md transition-all cursor-pointer border border-blue-700 shrink-0"
              >
                <Download className="w-4 h-4 text-blue-200" />
                <span>Unduh Template Excel (.xlsx)</span>
              </button>
            </div>

            {/* Instruction Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                <div className="font-black text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">1</span>
                  <span>Unduh Format Template</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Gunakan template Excel standar agar nama kolom & struktur data sesuai dengan sistem database Firestore.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                <div className="font-black text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">2</span>
                  <span>Isi & Unggah Berkas</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Lengkapi Nomor KK, NIK, Nama Kepala Keluarga, Lingkungan (1–24), status bansos, dan data sanitasi.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                <div className="font-black text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">3</span>
                  <span>Validasi & Sync Firestore</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Sistem akan memvalidasi baris data & melakukan sinkronisasi otomatis dengan peta WebGIS rumah warga.
                </p>
              </div>
            </div>
          </div>

          {/* File Upload Zone */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/20 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all group"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <FileUp className="w-8 h-8" />
              </div>
              <h4 className="text-base font-black text-slate-900">
                Pilih Berkas Excel / CSV Data Keluarga
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Klik di sini untuk memilih berkas (.xlsx, .xls, .csv) dari komputer Anda
              </p>
              {importFile && (
                <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-100 text-emerald-950 text-xs font-black border border-emerald-300">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>{importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>

            {isParsingImport && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-center text-xs font-bold text-blue-900 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                <span>Membaca dan memvalidasi struktur berkas Excel...</span>
              </div>
            )}
          </div>

          {/* Parsed Result & Validation Summary */}
          {parseResult && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span>Ringkasan Hasil Pembacaan Berkas Import</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hasil pengecekan kelengkapan data sebelum diimpor ke Firestore.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportFile(null);
                      setParseResult(null);
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 cursor-pointer"
                  >
                    Batal / Unggah Berkas Lain
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteBatchImport}
                    disabled={isImporting || parseResult.validCount === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isImporting ? 'Mengimpor...' : `Import ${parseResult.validCount} KK Ke Firestore`}</span>
                  </button>
                </div>
              </div>

              {/* Progress Bar during execution */}
              {isImporting && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                  <div className="flex justify-between text-xs font-black text-emerald-950">
                    <span>Proses Impor Data Ke Firestore & WebGIS...</span>
                    <span>{importProgress.done} / {importProgress.total} KK ({Math.round((importProgress.done / importProgress.total) * 100)}%)</span>
                  </div>
                  <div className="w-full h-3 bg-emerald-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* KPI Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Total Baris Spreadsheet</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{parseResult.totalRows} Baris</div>
                </div>

                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase">Data KK Valid Siap Impor</div>
                  <div className="text-2xl font-black text-emerald-950 mt-1">{parseResult.validCount} KK</div>
                </div>

                <div className={`p-4 rounded-2xl border ${parseResult.invalidCount > 0 ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`text-[11px] font-bold uppercase ${parseResult.invalidCount > 0 ? 'text-rose-800' : 'text-slate-500'}`}>Baris Dilewati / Warning</div>
                  <div className={`text-2xl font-black mt-1 ${parseResult.invalidCount > 0 ? 'text-rose-950' : 'text-slate-900'}`}>{parseResult.invalidCount} Baris</div>
                </div>
              </div>

              {/* Error messages log if any */}
              {parseResult.errors.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                  <div className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Catatan Peringatan Pada Berkas:</span>
                  </div>
                  <ul className="text-[11px] text-amber-800 space-y-1 list-disc pl-5">
                    {parseResult.errors.map((err, idx) => (
                      <li key={idx}>
                        Baris {err.row}: {err.nomorKk ? `[KK: ${err.nomorKk}] ` : ''}{err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Data Preview Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Table className="w-4 h-4 text-slate-500" />
                    <span>Pratinjau Data KK yang Akan Diimpor</span>
                  </h5>
                  <span className="text-[11px] text-slate-500 font-medium">Menampilkan {Math.min(10, parseResult.items.length)} dari {parseResult.items.length} KK</span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-200">
                        <th className="py-2.5 px-3 text-center">No</th>
                        <th className="py-2.5 px-3">Nomor KK</th>
                        <th className="py-2.5 px-3">Kepala Keluarga</th>
                        <th className="py-2.5 px-3">Lingkungan</th>
                        <th className="py-2.5 px-3">Kesejahteraan</th>
                        <th className="py-2.5 px-3">Bansos Diterima</th>
                        <th className="py-2.5 px-3">Sanitasi</th>
                        <th className="py-2.5 px-3">Air Minum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parseResult.items.slice(0, 10).map((kk, index) => (
                        <tr key={index} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center font-bold text-slate-400">{index + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{kk.nomorKk}</td>
                          <td className="py-2 px-3 font-bold text-slate-800">{kk.namaKepalaKeluarga}</td>
                          <td className="py-2 px-3 font-semibold text-slate-700">{kk.lingkunganNama}</td>
                          <td className="py-2 px-3 font-medium text-slate-700">{kk.desilKesejahteraan}</td>
                          <td className="py-2 px-3 text-slate-600 truncate max-w-xs">{kk.bantuanDiterima.join(', ') || 'Bukan Penerima'}</td>
                          <td className="py-2 px-3 text-slate-600 truncate max-w-xs">{kk.jambanKeluarga}</td>
                          <td className="py-2 px-3 text-slate-600 truncate max-w-xs">{kk.sumberAirMinum}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: DETAIL KARTU KELUARGA (OFFICIAL VIEW) */}
      {selectedDetailKk && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-slate-200 relative">
            <button
              type="button"
              onClick={() => setSelectedDetailKk(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Resmi Kartu Keluarga */}
            <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
              <div className="text-xs font-bold tracking-widest text-slate-500 uppercase">
                REPUBLIK INDONESIA • PEMERINTAH KOTA MEDAN
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                KARTU KELUARGA
              </h2>
              <div className="text-base sm:text-lg font-mono font-black text-blue-900 tracking-wider">
                No. {selectedDetailKk.nomorKk}
              </div>
            </div>

            {/* Info Kepala Keluarga & Wilayah */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Nama Kepala Keluarga:</span>
                  <span className="font-bold text-slate-900">{selectedDetailKk.namaKepalaKeluarga}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">NIK Kepala Keluarga:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedDetailKk.nikKepalaKeluarga || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Alamat:</span>
                  <span className="font-semibold text-slate-800 text-right">{selectedDetailKk.namaJalan} {selectedDetailKk.nomorRumah ? `No. ${selectedDetailKk.nomorRumah}` : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">RT / RW:</span>
                  <span className="font-semibold text-slate-800">{selectedDetailKk.rt || '001'} / {selectedDetailKk.rw || '001'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Status Domisili:</span>
                  <span className="font-semibold text-emerald-800">{selectedDetailKk.statusDomisili}</span>
                </div>
              </div>

              <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Lingkungan:</span>
                  <span className="font-bold text-blue-950">{selectedDetailKk.lingkunganNama}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Kelurahan:</span>
                  <span className="font-bold text-slate-900">Kelurahan Mangga</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Kecamatan:</span>
                  <span className="font-bold text-slate-900">Kecamatan Medan Tuntungan</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Kota:</span>
                  <span className="font-bold text-slate-900">Kota Medan - Sumatera Utara</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Kontak Telepon:</span>
                  <span className="font-bold text-blue-700">{selectedDetailKk.telepon || '-'}</span>
                </div>
              </div>
            </div>

            {/* Tabel Daftar Anggota Keluarga */}
            <div className="space-y-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center justify-between">
                <span>Daftar Anggota Keluarga ({selectedDetailKk.jumlahAnggotaKeluarga} Jiwa)</span>
                <span className="text-xs text-slate-500 font-normal">
                  L: {selectedDetailKk.jumlahLakiLaki} | P: {selectedDetailKk.jumlahPerempuan} | Lansia: {selectedDetailKk.jumlahLansia} | Balita: {selectedDetailKk.jumlahBalita}
                </span>
              </h3>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-black text-slate-600 uppercase">
                      <th className="py-2.5 px-3 text-center">No</th>
                      <th className="py-2.5 px-3">Nama Lengkap</th>
                      <th className="py-2.5 px-3">NIK</th>
                      <th className="py-2.5 px-3">Hubungan</th>
                      <th className="py-2.5 px-3 text-center">JK</th>
                      <th className="py-2.5 px-3 text-center">Usia</th>
                      <th className="py-2.5 px-3">Pendidikan</th>
                      <th className="py-2.5 px-3">Pekerjaan</th>
                      <th className="py-2.5 px-3">BPJS Kesehatan</th>
                      <th className="py-2.5 px-3 text-center">KTP/IKD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedDetailKk.anggotaKeluarga && selectedDetailKk.anggotaKeluarga.length > 0 ? (
                      selectedDetailKk.anggotaKeluarga.map((ang, ai) => (
                        <tr key={ang.id || ai} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center font-bold text-slate-400">{ai + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{ang.nama}</td>
                          <td className="py-2 px-3 font-mono text-slate-700">{ang.nik}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{ang.hubunganKeluarga}</td>
                          <td className="py-2 px-3 text-center font-bold text-slate-700">{ang.jenisKelamin}</td>
                          <td className="py-2 px-3 text-center">{ang.usia} Th</td>
                          <td className="py-2 px-3">{ang.pendidikanTerakhir}</td>
                          <td className="py-2 px-3">{ang.pekerjaan}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                              {ang.statusBpjsKesehatan}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {ang.memilikiKtpIkd ? (
                              <span className="text-emerald-700 font-bold">✓ Ada</span>
                            ) : (
                              <span className="text-slate-400">Belum</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} className="py-4 text-center text-slate-400">
                          Rincian anggota keluarga belum ditambahkan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Informasi Kesejahteraan, Bansos & Sanitasi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Box Kesejahteraan & Bansos */}
              <div className="bg-rose-50/40 p-4 rounded-2xl border border-rose-200 space-y-2">
                <div className="font-black text-rose-950 flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-rose-700" />
                  <span>Tingkat Kesejahteraan & Bantuan Sosial</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Tingkat Desil:</span>
                  <span className="font-black px-2 py-0.5 rounded bg-rose-600 text-white text-xs">
                    {selectedDetailKk.desilKesejahteraan || 'Belum Terdata'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 font-medium">Program Bantuan Diterima:</span>
                  {selectedDetailKk.bantuanDiterima && selectedDetailKk.bantuanDiterima.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedDetailKk.bantuanDiterima.map((b, bi) => (
                        <span key={bi} className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-300">
                          {b}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-[11px] mt-0.5">Tidak menerima bantuan sosial</div>
                  )}
                </div>
              </div>

              {/* Box Sanitasi & Kesehatan */}
              <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-200 space-y-2">
                <div className="font-black text-blue-950 flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-blue-700" />
                  <span>Sanitasi & Kesehatan Lingkungan Keluarga</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Jamban Keluarga:</span>
                  <span className="font-bold text-slate-900">{selectedDetailKk.jambanKeluarga}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Sumber Air Minum:</span>
                  <span className="font-bold text-slate-900">{selectedDetailKk.sumberAirMinum}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Sumber Air Bersih:</span>
                  <span className="font-bold text-slate-900">{selectedDetailKk.sumberAirBersih}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Pembuangan Sampah:</span>
                  <span className="font-bold text-slate-900">{selectedDetailKk.pembuanganSampahRumah}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Risiko Stunting:</span>
                  <span className="font-bold text-amber-800">{selectedDetailKk.statusStuntingRentan}</span>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <div className="text-xs text-slate-400">
                Dicatat oleh: <strong className="text-slate-700">{selectedDetailKk.createdByName || 'Petugas'}</strong>
              </div>
              <div className="flex items-center gap-2">
                {selectedDetailKk.titikKoordinat && onNavigateToWebgis && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToWebgis(
                        selectedDetailKk.titikKoordinat?.lat,
                        selectedDetailKk.titikKoordinat?.lng
                      );
                      setSelectedDetailKk(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-900 font-bold text-xs hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Lihat di Peta WebGIS</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDetailKk(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: FORM TAMBAH / EDIT KARTU KELUARGA */}
      {isFormOpen && (
        <FormKeluargaModal
          isOpen={isFormOpen}
          initialData={editingKk}
          currentUser={currentUser}
          onClose={() => {
            setIsFormOpen(false);
            setEditingKk(null);
          }}
          onSave={async (savedData) => {
            setIsSaving(true);
            try {
              const success = await saveDataKeluargaToFirestore(savedData, true);
              if (success) {
                if (onShowToast) onShowToast(`Data Keluarga "${savedData.namaKepalaKeluarga}" berhasil disimpan ke database.`, 'success');
                setIsFormOpen(false);
                setEditingKk(null);
              } else {
                if (onShowToast) onShowToast('Gagal menyimpan data keluarga.', 'error');
              }
            } catch (e) {
              console.error(e);
              if (onShowToast) onShowToast('Terjadi kesalahan: ' + e, 'error');
            } finally {
              setIsSaving(false);
            }
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// SUB-KOMPONEN: FORMULIR TAMBAH/EDIT DATA KELUARGA
// ==========================================

interface FormKeluargaModalProps {
  isOpen: boolean;
  initialData: DataKeluarga | null;
  currentUser: UserAccount;
  onClose: () => void;
  onSave: (data: DataKeluarga) => Promise<void>;
}

const FormKeluargaModal: React.FC<FormKeluargaModalProps> = ({
  isOpen,
  initialData,
  currentUser,
  onClose,
  onSave,
}) => {
  const isKepling = currentUser.role === 'kepling';
  const defaultLingkunganId = isKepling ? currentUser.id : 'kepling_1';
  const defaultKepling = KEPLING_ACCOUNTS.find((k) => k.id === defaultLingkunganId) || KEPLING_ACCOUNTS[0];

  const [activeTab, setActiveTab] = useState<'UTAMA' | 'ANGGOTA' | 'BANSOS' | 'SANITASI'>('UTAMA');

  // Form Fields
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [nomorKk, setNomorKk] = useState<string>(initialData?.nomorKk || '');
  const [nikKk, setNikKk] = useState<string>(initialData?.nikKepalaKeluarga || '');
  const [namaKk, setNamaKk] = useState<string>(initialData?.namaKepalaKeluarga || '');
  const [telepon, setTelepon] = useState<string>(initialData?.telepon || '');
  const [lingkunganId, setLingkunganId] = useState<string>(initialData?.lingkunganId || defaultLingkunganId);
  const [namaJalan, setNamaJalan] = useState<string>(initialData?.namaJalan || '');
  const [nomorRumah, setNomorRumah] = useState<string>(initialData?.nomorRumah || '');
  const [rt, setRt] = useState<string>(initialData?.rt || '001');
  const [rw, setRw] = useState<string>(initialData?.rw || '001');
  const [statusDomisili, setStatusDomisili] = useState<string>(
    initialData?.statusDomisili || 'KK Kelurahan Mangga (KTP/KK Setempat)'
  );
  const [kewarganegaraan, setKewarganegaraan] = useState<string>(initialData?.kewarganegaraan || 'WNI');
  const [negaraAsalWna, setNegaraAsalWna] = useState<string>(initialData?.negaraAsalWna || '');
  const [pekerjaanKk, setPekerjaanKk] = useState<string>(initialData?.pekerjaanUtamaKepalaKeluarga || 'Wiraswasta');

  // Anggota Keluarga List
  const [anggotaList, setAnggotaList] = useState<AnggotaKeluarga[]>(initialData?.anggotaKeluarga || []);

  // Kesejahteraan & Bansos
  const [desil, setDesil] = useState<string>(initialData?.desilKesejahteraan || 'Desil 3 (Hampir Miskin)');
  const [bantuanDiterima, setBantuanDiterima] = useState<string[]>(
    initialData?.bantuanDiterima || ['PKH Medan Makmur', 'BPNT / Sembako']
  );

  // Sanitasi & Kesehatan
  const [jamban, setJamban] = useState<string>(
    initialData?.jambanKeluarga || 'Jamban Sendiri (Leher Angsa / Septik SNI)'
  );
  const [tempatTinja, setTempatTinja] = useState<string>(
    initialData?.tempatAkhirTinja || 'Tangki Septik / SPALD'
  );
  const [airMinum, setAirMinum] = useState<string>(initialData?.sumberAirMinum || 'PDAM / Air Perpipaan');
  const [airBersih, setAirBersih] = useState<string>(initialData?.sumberAirBersih || 'PDAM Tirtanadi');
  const [sampah, setSampah] = useState<string>(initialData?.pembuanganSampahRumah || 'Diangkut Petugas / WRS');
  const [stunting, setStunting] = useState<string>(initialData?.statusStuntingRentan || 'Bebas Risiko Stunting');

  // Temporary State for Adding Anggota
  const [tempAnggotaNama, setTempAnggotaNama] = useState<string>('');
  const [tempAnggotaNik, setTempAnggotaNik] = useState<string>('');
  const [tempAnggotaHub, setTempAnggotaHub] = useState<HubunganKeluargaType>('Anak');
  const [tempAnggotaJk, setTempAnggotaJk] = useState<'L' | 'P'>('L');
  const [tempAnggotaUsia, setTempAnggotaUsia] = useState<number>(10);
  const [tempAnggotaPekerjaan, setTempAnggotaPekerjaan] = useState<string>('Pelajar');

  const addAnggota = () => {
    if (!tempAnggotaNama.trim()) {
      alert('Nama anggota keluarga wajib diisi.');
      return;
    }
    const newAnggota: AnggotaKeluarga = {
      id: `ang_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      nik: tempAnggotaNik.trim() || `127101${String(Date.now()).substring(0, 10)}`,
      nama: tempAnggotaNama.trim(),
      hubunganKeluarga: tempAnggotaHub,
      jenisKelamin: tempAnggotaJk,
      usia: Number(tempAnggotaUsia) || 0,
      agama: 'Islam',
      pendidikanTerakhir: 'SMA/SMK/Sederajat',
      pekerjaan: tempAnggotaPekerjaan.trim() || 'Pelajar',
      statusPerkawinan: tempAnggotaHub === 'Kepala Keluarga' || tempAnggotaHub === 'Istri' ? 'Kawin' : 'Belum Kawin',
      memilikiKtpIkd: tempAnggotaUsia >= 17,
      memilikiAktaKelahiran: true,
      statusBpjsKesehatan: 'PBI-JK (Bansos APBD/APBN)',
      terdaftarBpjsKetenagakerjaan: tempAnggotaUsia >= 18,
    };

    setAnggotaList([...anggotaList, newAnggota]);
    setTempAnggotaNama('');
    setTempAnggotaNik('');
    setTempAnggotaUsia(10);
  };

  const removeAnggota = (id: string) => {
    setAnggotaList(anggotaList.filter((a) => a.id !== id));
  };

  const handleToggleBansos = (program: string) => {
    if (bantuanDiterima.includes(program)) {
      setBantuanDiterima(bantuanDiterima.filter((b) => b !== program));
    } else {
      setBantuanDiterima([...bantuanDiterima, program]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomorKk.trim()) {
      alert('Nomor Kartu Keluarga (KK) wajib diisi.');
      return;
    }
    if (!namaKk.trim()) {
      alert('Nama Kepala Keluarga wajib diisi.');
      return;
    }
    if (!namaJalan.trim()) {
      alert('Nama Jalan / Gang wajib diisi.');
      return;
    }

    const targetKepling = KEPLING_ACCOUNTS.find((k) => k.id === lingkunganId) || defaultKepling;

    // Recalculate demographic totals from anggota
    const totalJiwa = Math.max(1, anggotaList.length);
    const totalL = anggotaList.filter((a) => a.jenisKelamin === 'L').length || 1;
    const totalP = anggotaList.filter((a) => a.jenisKelamin === 'P').length || 0;
    const totalBalita = anggotaList.filter((a) => a.usia <= 5).length;
    const totalLansia = anggotaList.filter((a) => a.usia >= 60).length;
    const totalUsiaSekolah = anggotaList.filter((a) => a.usia >= 6 && a.usia <= 18).length;
    const totalProduktif = anggotaList.filter((a) => a.usia >= 19 && a.usia <= 59).length;

    const newKeluargaData: DataKeluarga = {
      id: initialData?.id || `kk_${nomorKk.replace(/[^0-9]/g, '') || Date.now()}`,
      nomorKk: nomorKk.trim(),
      nikKepalaKeluarga: nikKk.trim(),
      namaKepalaKeluarga: namaKk.trim(),
      telepon: telepon.trim(),
      lingkunganId: targetKepling.id,
      lingkunganNomor: targetKepling.nomorLingkungan || 1,
      lingkunganNama: targetKepling.lingkungan,
      namaJalan: namaJalan.trim(),
      nomorRumah: nomorRumah.trim(),
      rt: rt.trim() || '001',
      rw: rw.trim() || '001',
      alamatLengkap: `${namaJalan.trim()} ${nomorRumah.trim() ? `No. ${nomorRumah.trim()}` : ''}, ${targetKepling.lingkungan}, Kelurahan Mangga`,
      statusDomisili,
      jumlahAnggotaKeluarga: totalJiwa,
      jumlahLakiLaki: totalL,
      jumlahPerempuan: totalP,
      jumlahBalita: totalBalita,
      jumlahUsiaSekolah: totalUsiaSekolah,
      jumlahUsiaProduktif: totalProduktif,
      jumlahLansia: totalLansia,
      pekerjaanUtamaKepalaKeluarga: pekerjaanKk,
      anggotaKeluarga: anggotaList,
      desilKesejahteraan: kewarganegaraan === 'WNA' ? '' : desil,
      penerimaBansos: kewarganegaraan === 'WNA' ? false : (bantuanDiterima.length > 0 || desil.includes('Desil 1') || desil.includes('Desil 2') || desil.includes('Desil 3')),
      bantuanDiterima: kewarganegaraan === 'WNA' ? [] : bantuanDiterima,
      kewarganegaraan,
      negaraAsalWna: kewarganegaraan === 'WNA' ? negaraAsalWna : '',
      jambanKeluarga: jamban,
      tempatAkhirTinja: tempatTinja,
      sumberAirMinum: airMinum,
      sumberAirBersih: airBersih,
      pembuanganSampahRumah: sampah,
      statusStuntingRentan: stunting,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByName: initialData?.createdByName || `${currentUser.nama} (${currentUser.jabatan})`,
    };

    setIsSaving(true);
    try {
      await onSave(newKeluargaData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto border border-slate-200 relative">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-700" />
              <span>{initialData ? 'Perbarui Data Keluarga' : 'Formulir Pendaftaran Data Keluarga (KK)'}</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Kelurahan Mangga, Kecamatan Medan Tuntungan
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('UTAMA')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'UTAMA' ? 'bg-white text-blue-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Data Utama KK
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ANGGOTA')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'ANGGOTA' ? 'bg-white text-blue-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Anggota ({anggotaList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('BANSOS')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'BANSOS' ? 'bg-white text-rose-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Desil & Bansos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SANITASI')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'SANITASI' ? 'bg-white text-emerald-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            4. Sanitasi & Air
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* TAB 1: DATA UTAMA */}
          {activeTab === 'UTAMA' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Nomor Kartu Keluarga (KK 16 Digit) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 1271010101230001"
                    value={nomorKk}
                    onChange={(e) => setNomorKk(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    NIK Kepala Keluarga (16 Digit)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 1271011504780001"
                    value={nikKk}
                    onChange={(e) => setNikKk(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Nama Kepala Keluarga *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nama Lengkap Kepala Keluarga"
                    value={namaKk}
                    onChange={(e) => setNamaKk(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Nomor Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 08126045xxxx"
                    value={telepon}
                    onChange={(e) => setTelepon(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Wilayah Lingkungan *
                  </label>
                  <select
                    value={lingkunganId}
                    onChange={(e) => setLingkunganId(e.target.value)}
                    disabled={isKepling}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {KEPLING_ACCOUNTS.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.lingkungan} ({k.nama})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Status Kartu Keluarga (Domisili) *
                  </label>
                  <select
                    value={statusDomisili}
                    onChange={(e) => setStatusDomisili(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="KK Kelurahan Mangga (KTP/KK Setempat)">
                      KK Kelurahan Mangga (KTP/KK Setempat)
                    </option>
                    <option value="Bukan KK Mangga (Domisili Luar/Kontrak)">
                      Bukan KK Mangga (Domisili Luar/Kontrak)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-purple-950 mb-1">
                    Status Kewarganegaraan *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setKewarganegaraan('WNI');
                        setNegaraAsalWna('');
                      }}
                      className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        kewarganegaraan !== 'WNA'
                          ? 'bg-purple-800 text-white border-purple-800 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50'
                      }`}
                    >
                      <span>🇮🇩 WNI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setKewarganegaraan('WNA');
                        setDesil('');
                        setBantuanDiterima([]);
                      }}
                      className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        kewarganegaraan === 'WNA'
                          ? 'bg-rose-700 text-white border-rose-800 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50'
                      }`}
                    >
                      <span>🌐 WNA</span>
                    </button>
                  </div>
                  {kewarganegaraan === 'WNA' && (
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Negara Asal / Paspor WNA (contoh: Malaysia, China)"
                        value={negaraAsalWna}
                        onChange={(e) => setNegaraAsalWna(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-purple-50 border border-purple-300 text-xs font-bold text-purple-950"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Nama Jalan / Gang *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Jl. Bunga Raya Gg. Melati"
                    value={namaJalan}
                    onChange={(e) => setNamaJalan(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    No. Rumah / Blok
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: No. 12A"
                    value={nomorRumah}
                    onChange={(e) => setNomorRumah(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  Pekerjaan Utama Kepala Keluarga
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Buruh Harian Lepas, Wiraswasta, Karyawan Swasta, Supir"
                  value={pekerjaanKk}
                  onChange={(e) => setPekerjaanKk(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: ANGGOTA KELUARGA */}
          {activeTab === 'ANGGOTA' && (
            <div className="space-y-4">
              {/* List of members */}
              <div className="space-y-2">
                <div className="text-xs font-black text-slate-700">Daftar Anggota Keluarga Terinput:</div>
                {anggotaList.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                    Belum ada anggota keluarga ditambahkan. Silakan gunakan form cepat di bawah.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                    {anggotaList.map((ang, i) => (
                      <div key={ang.id || i} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-bold text-slate-900">
                            {ang.nama} <span className="text-[11px] text-blue-700 font-normal">({ang.hubunganKeluarga})</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            NIK: {ang.nik} • {ang.jenisKelamin === 'L' ? 'Laki-Laki' : 'Perempuan'} • {ang.usia} Tahun • {ang.pekerjaan}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAnggota(ang.id)}
                          className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Input Cepat Anggota */}
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200 space-y-3">
                <div className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-blue-700" />
                  <span>Tambah Anggota Keluarga</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    placeholder="Nama Lengkap Anggota"
                    value={tempAnggotaNama}
                    onChange={(e) => setTempAnggotaNama(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                  />
                  <input
                    type="text"
                    placeholder="NIK (16 Digit)"
                    value={tempAnggotaNik}
                    onChange={(e) => setTempAnggotaNik(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono font-medium"
                  />
                  <select
                    value={tempAnggotaHub}
                    onChange={(e) => setTempAnggotaHub(e.target.value as HubunganKeluargaType)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                  >
                    <option value="Kepala Keluarga">Kepala Keluarga</option>
                    <option value="Istri">Istri</option>
                    <option value="Anak">Anak</option>
                    <option value="Orang Tua">Orang Tua</option>
                    <option value="Mertua">Mertua</option>
                    <option value="Famili Lain">Famili Lain</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <select
                    value={tempAnggotaJk}
                    onChange={(e) => setTempAnggotaJk(e.target.value as 'L' | 'P')}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                  >
                    <option value="L">Laki-Laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Usia (Tahun)"
                    value={tempAnggotaUsia}
                    onChange={(e) => setTempAnggotaUsia(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                  />
                  <input
                    type="text"
                    placeholder="Pekerjaan"
                    value={tempAnggotaPekerjaan}
                    onChange={(e) => setTempAnggotaPekerjaan(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                  />
                </div>

                <button
                  type="button"
                  onClick={addAnggota}
                  className="w-full py-2 bg-blue-700 text-white rounded-xl text-xs font-black hover:bg-blue-800 transition-colors cursor-pointer"
                >
                  + Tambahkan ke Daftar Anggota
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DESIL & BANSOS */}
          {activeTab === 'BANSOS' && (
            <div className="space-y-4">
              {kewarganegaraan === 'WNA' ? (
                <div className="p-4 bg-purple-100/80 rounded-2xl border border-purple-300 space-y-2 text-purple-950">
                  <div className="text-xs font-black flex items-center gap-2">
                    <span className="text-base">🌐</span>
                    <span>Status Kewarganegaraan: WNA (Warga Negara Asing)</span>
                  </div>
                  <p className="text-xs text-purple-800 font-medium">
                    Secara otomatis tidak diminta status Desil Kesejahteraan maupun Program Bantuan Sosial.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-200 space-y-3">
                    <label className="block text-xs font-black text-rose-950">
                      Tingkat Kesejahteraan Keluarga (Pilih Kategori Desil) *
                    </label>
                    <select
                      value={desil}
                      onChange={(e) => setDesil(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-rose-200 text-xs font-black text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="Desil 1">Desil 1</option>
                      <option value="Desil 2">Desil 2</option>
                      <option value="Desil 3">Desil 3</option>
                      <option value="Desil 4">Desil 4</option>
                      <option value="Desil 5">Desil 5</option>
                      <option value="Desil 6-10">Desil 6-10</option>
                    </select>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Sesuai ketentuan, keluarga dengan kategori Desil 1 s/d 5 diprioritaskan menerima program jaminan sosial dan bantuan pemerintah.
                    </p>
                  </div>

                  {/* Bantuan Sosial Multi-Checklist */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-700">
                      Pilihan Bantuan Yang Diterima (Centang Bantuan Yang Aktif):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        'PKH Medan Makmur',
                        'PKH Nasional',
                        'BPNT / Sembako',
                        'BLT / DBH',
                        'PBI-JK (BPJS Gratis)',
                        'Bedah Rumah / RTLH',
                        'PIP / Beasiswa',
                        'Bantuan Disabilitas / Lansia',
                      ].map((program) => {
                        const isChecked = bantuanDiterima.includes(program);
                        return (
                          <button
                            type="button"
                            key={program}
                            onClick={() => handleToggleBansos(program)}
                            className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-left ${
                              isChecked
                                ? program === 'PKH Medan Makmur'
                                  ? 'bg-purple-100 border-purple-400 text-purple-950 shadow-xs'
                                  : 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span>{program}</span>
                            {isChecked && <Check className="w-4 h-4 text-emerald-700" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: SANITASI & AIR */}
          {activeTab === 'SANITASI' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Jamban Keluarga *
                  </label>
                  <select
                    value={jamban}
                    onChange={(e) => setJamban(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Jamban Sendiri (Leher Angsa / Septik SNI)">
                      Jamban Sendiri (Leher Angsa / Septik SNI)
                    </option>
                    <option value="Jamban Bersama / Komunal">Jamban Bersama / Komunal</option>
                    <option value="Jamban Cemplung / Plengsengan">Jamban Cemplung / Plengsengan</option>
                    <option value="Tidak Memiliki Jamban (BABS)">Tidak Memiliki Jamban (BABS)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Tempat Pembuangan Akhir Tinja
                  </label>
                  <select
                    value={tempatTinja}
                    onChange={(e) => setTempatTinja(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Tangki Septik / SPALD">Tangki Septik / SPALD</option>
                    <option value="Saluran Terbuka / Parit">Saluran Terbuka / Parit</option>
                    <option value="Lubang Tanah / Lainnya">Lubang Tanah / Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Sumber Air Minum Utama *
                  </label>
                  <select
                    value={airMinum}
                    onChange={(e) => setAirMinum(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PDAM / Air Perpipaan">PDAM / Air Perpipaan</option>
                    <option value="Depot Isi Ulang">Depot Air Minum Isi Ulang</option>
                    <option value="Air Kemasan Bermerek">Air Kemasan Bermerek</option>
                    <option value="Sumur Bor Terlindungi">Sumur Bor Terlindungi</option>
                    <option value="Sumur Gali">Sumur Gali</option>
                    <option value="Mata Air / Air Hujan">Mata Air / Air Hujan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Sumber Air Bersih (Mandi & Cuci) *
                  </label>
                  <select
                    value={airBersih}
                    onChange={(e) => setAirBersih(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PDAM Tirtanadi">PDAM Tirtanadi</option>
                    <option value="Sumur Bor Listrik">Sumur Bor Listrik</option>
                    <option value="Sumur Gali">Sumur Gali</option>
                    <option value="Sungai / Lainnya">Sungai / Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Pengelolaan Sampah Rumah Tangga
                  </label>
                  <select
                    value={sampah}
                    onChange={(e) => setSampah(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Diangkut Petugas / WRS">Diangkut Petugas / WRS (Wajib Retribusi Sampah)</option>
                    <option value="Bank Sampah / Daur Ulang">Bank Sampah / Daur Ulang Mandiri</option>
                    <option value="Dibakar / Ditimbun Mandiri">Dibakar / Ditimbun Mandiri</option>
                    <option value="Dibuang Sembarangan">Dibuang Sembarangan / ke Lahan Kosong</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Status Risiko Stunting / Balita Rentan
                  </label>
                  <select
                    value={stunting}
                    onChange={(e) => setStunting(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Bebas Risiko Stunting">Bebas Risiko Stunting</option>
                    <option value="Ada Balita / Baduta Berisiko Stunting">
                      Ada Balita / Baduta Berisiko Stunting
                    </option>
                    <option value="Ada Ibu Hamil KEK / Resti">Ada Ibu Hamil KEK / Resti</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan ke Database...' : 'Simpan Data Keluarga'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
