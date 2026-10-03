import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  UserCheck,
  Globe,
  Search,
  Plus,
  FileSpreadsheet,
  Printer,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
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
  ChevronLeft,
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
  Sparkles,
  CheckSquare,
  Square,
  SlidersHorizontal,
  ArrowLeftRight,
  Shuffle,
  Zap,
  CheckCheck,
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
  parseDataKeluargaText,
  batchSaveDataKeluarga,
  batchUpdateLingkunganDataKeluarga,
  normalizeStreetName,
  maskNik,
  ImportParsedResult,
} from '../lib/dataKeluargaService';
import { subscribePbbSpptFromFirestore, DEFAULT_PBB_YEAR } from '../lib/pbbService';
import { SpptPbbItem } from '../data/pbbSampleData';
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
  const [spptList, setSpptList] = useState<SpptPbbItem[]>([]);
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
  const [showFullNik, setShowFullNik] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingKk, setEditingKk] = useState<DataKeluarga | null>(null);
  const [deletingKk, setDeletingKk] = useState<{
    id: string;
    namaKk: string;
    nomorKk?: string;
    lingkunganNama?: string;
    alamat?: string;
  } | null>(null);
  const [isDeletingKk, setIsDeletingKk] = useState<boolean>(false);

  // Tab Menu State
  const [activeTab, setActiveTab] = useState<'daftar' | 'statistik' | 'import' | 'pindah_lingkungan'>('daftar');

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'file' | 'paste'>('file');
  const [rawPasteText, setRawPasteText] = useState<string>('');
  const [isParsingImport, setIsParsingImport] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ImportParsedResult | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  // Tab 1: Multi-Select Table State
  const [selectedTableKkIds, setSelectedTableKkIds] = useState<Set<string>>(new Set());
  const [tableTargetLkId, setTableTargetLkId] = useState<string>('kepling_23');

  // Tab 4: Sub-Mode & Comprehensive Move State
  const [moveSubMode, setMoveSubMode] = useState<'by_pbb_sync' | 'by_source_lk' | 'by_street' | 'by_paste_list'>('by_pbb_sync');

  // Mode 1: By Street / Keyword
  const [streetSearchKeyword, setStreetSearchKeyword] = useState<string>('');
  const [streetSourceLkFilter, setStreetSourceLkFilter] = useState<string>('all');
  const [streetTargetLkId, setStreetTargetLkId] = useState<string>('kepling_23');
  const [selectedStreetKkIds, setSelectedStreetKkIds] = useState<Set<string>>(new Set());

  // Mode 2: By Source Lingkungan
  const [sourceLkId, setSourceLkId] = useState<string>('kepling_1');
  const [sourceLkStreetFilter, setSourceLkStreetFilter] = useState<string>('');
  const [sourceTargetLkId, setSourceTargetLkId] = useState<string>('kepling_23');
  const [selectedSourceKkIds, setSelectedSourceKkIds] = useState<Set<string>>(new Set());

  // Mode 3: By PBB Auto-Sync
  const [selectedPbbSyncIds, setSelectedPbbSyncIds] = useState<Set<string>>(new Set());

  // Mode 4: By Paste List (Adopted from PBB)
  const [pasteTargetLkId, setPasteTargetLkId] = useState<string>('kepling_1');
  const [rawPasteListInput, setRawPasteListInput] = useState<string>('');
  const [pasteAnalysisResult, setPasteAnalysisResult] = useState<{
    matched: { kk: DataKeluarga; matchedBy: string; identifier: string }[];
    unmatched: string[];
  } | null>(null);

  // Common Bulk Execution State
  const [isBulkExecuting, setIsBulkExecuting] = useState<boolean>(false);
  const [bulkExecuteProgress, setBulkExecuteProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [bulkExecuteMessage, setBulkExecuteMessage] = useState<string | null>(null);

  // Real-time Firestore subscription
  useEffect(() => {
    setIsLoading(true);
    const unsubKeluarga = subscribeDataKeluarga(
      (list) => {
        setDataList(list);
        if (spptList.length > 0) setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      }
    );

    const unsubPbb = subscribePbbSpptFromFirestore(DEFAULT_PBB_YEAR, (list) => {
      setSpptList(list);
      setIsLoading(false);
    });

    return () => {
      unsubKeluarga();
      unsubPbb();
    };
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

  // Pagination State for high performance rendering
  const [pageKk, setPageKk] = useState<number>(1);
  const [pageSizeKk, setPageSizeKk] = useState<number>(25);

  // Reset to page 1 on filter/search change
  useEffect(() => {
    setPageKk(1);
  }, [filterLingkungan, filterDesil, filterBansos, filterSanitasi, filterStunting, searchQuery, pageSizeKk]);

  const totalKkPages = Math.max(1, Math.ceil(filteredList.length / (pageSizeKk === -1 ? filteredList.length || 1 : pageSizeKk)));
  const paginatedKkList = useMemo(() => {
    if (pageSizeKk === -1) return filteredList;
    const start = (pageKk - 1) * pageSizeKk;
    return filteredList.slice(start, start + pageSizeKk);
  }, [filteredList, pageKk, pageSizeKk]);

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

  // Handle Delete Confirmation Modal (Accessible by Kepling & Admin)
  const confirmDeleteKk = (item: DataKeluarga) => {
    setDeletingKk({
      id: item.id,
      namaKk: item.namaKepalaKeluarga,
      nomorKk: item.nomorKk,
      lingkunganNama: item.lingkunganNama,
      alamat: `${item.namaJalan || ''} ${item.nomorRumah ? `No. ${item.nomorRumah}` : ''}`.trim(),
    });
  };

  const executeDeleteKk = async () => {
    if (!deletingKk) return;
    setIsDeletingKk(true);
    try {
      const success = await deleteDataKeluargaFromFirestore(deletingKk.id);
      if (success) {
        if (onShowToast) {
          onShowToast(`Data Keluarga "${deletingKk.namaKk}" berhasil dihapus dari database.`, 'success');
        }
        if (selectedDetailKk?.id === deletingKk.id) {
          setSelectedDetailKk(null);
        }
        setDeletingKk(null);
      } else {
        if (onShowToast) {
          onShowToast('Gagal menghapus data keluarga dari server.', 'error');
        }
      }
    } catch (e: any) {
      console.error(e);
      if (onShowToast) {
        onShowToast('Terjadi kesalahan saat menghapus: ' + (e?.message || e), 'error');
      }
    } finally {
      setIsDeletingKk(false);
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

  // Handle Text Paste Parsing
  const handleTextParse = async () => {
    if (!rawPasteText.trim()) {
      if (onShowToast) onShowToast('Silakan tempelkan data teks terlebih dahulu.', 'error');
      return;
    }
    setIsParsingImport(true);
    setParseResult(null);
    try {
      const result = await parseDataKeluargaText(rawPasteText);
      setParseResult(result);
      if (onShowToast) {
        if (result.validCount > 0) {
          onShowToast(`Berhasil membaca ${result.validCount} KK dari teks yang ditempel.`, 'success');
        } else {
          onShowToast('Tidak ada data KK valid yang terdeteksi dari teks.', 'error');
        }
      }
    } catch (err: any) {
      console.error('Error parsing paste text:', err);
      if (onShowToast) onShowToast('Gagal membaca teks: ' + (err.message || err), 'error');
    } finally {
      setIsParsingImport(false);
    }
  };

  // Handle Batch Import Execution
  const handleExecuteBatchImport = async () => {
    if (!parseResult || parseResult.items.length === 0) return;

    // Collect ALL existing NIKs and Nomor KK from the entire database (Heads and Members)
    // to ensure absolute uniqueness as requested by user.
    const existingNiks = new Set<string>();
    dataList.forEach(item => {
      if (item.nikKepalaKeluarga) existingNiks.add(item.nikKepalaKeluarga.trim());
      if (item.nomorKk) existingNiks.add(item.nomorKk.trim());
      if (item.anggotaKeluarga && Array.isArray(item.anggotaKeluarga)) {
        item.anggotaKeluarga.forEach(m => {
          if (m.nik) existingNiks.add(m.nik.trim());
        });
      }
    });

    // Filter items to import: Skip if the NIK or Nomor KK already exists anywhere in the DB
    const itemsToImport = parseResult.items.filter(item => {
      const nikKk = (item.nikKepalaKeluarga || '').trim();
      const noKk = (item.nomorKk || '').trim();
      
      // If either NIK or No KK exists, skip it
      if (nikKk && existingNiks.has(nikKk)) return false;
      if (noKk && existingNiks.has(noKk)) return false;
      
      return true;
    }).map(item => {
      // Otomatisasi pengelompokan lingkungan sesuai NOP PBB atau Alamat
      const autoLk = getAutoLingkungan(item);
      if (autoLk) {
        return {
          ...item,
          ...autoLk,
          // Pastikan alamat kapital (uppercase) sesuai permintaan sebelumnya
          namaJalan: item.namaJalan?.toUpperCase() || '',
          alamatLengkap: item.alamatLengkap?.toUpperCase() || ''
        };
      }
      return {
        ...item,
        namaJalan: item.namaJalan?.toUpperCase() || '',
        alamatLengkap: item.alamatLengkap?.toUpperCase() || ''
      };
    });

    const duplicateCount = parseResult.items.length - itemsToImport.length;
    
    if (itemsToImport.length === 0) {
      if (onShowToast) onShowToast(`Seluruh data (${duplicateCount} KK) sudah ada dalam database (NIK/No. KK ganda). Import diabaikan sesuai permintaan sistem.`, 'warning');
      setParseResult(null);
      return;
    }

    setIsImporting(true);
    setImportProgress({ done: 0, total: itemsToImport.length });
    try {
      const { successCount, failCount } = await batchSaveDataKeluarga(
        itemsToImport,
        (done, total) => {
          setImportProgress({ done, total });
        }
      );
      if (onShowToast) {
        let msg = `Import selesai! ${successCount} KK berhasil disimpan.`;
        if (duplicateCount > 0) msg += ` (${duplicateCount} data dilewati karena NIK sudah ada).`;
        if (failCount > 0) msg += ` ${failCount} gagal.`;
        onShowToast(msg, failCount > 0 ? 'warning' : 'success');
      }
      // Reset state & switch tab
      setImportFile(null);
      setParseResult(null);
      setActiveTab('daftar');
    } catch (err: any) {
      console.error('Error executing batch import:', err);
      if (onShowToast) onShowToast('Gagal mengimpor data: ' + (err.message || err), 'error');
    } finally {
      setIsImporting(false);
    }
  };

  // Mismatch & Smart Recommendations Engine
  const mismatchedList = useMemo(() => {
    const result: Array<{
      kk: DataKeluarga;
      currentLkNomor: number;
      currentLkNama: string;
      recommendedLkId: string;
      recommendedLkNomor: number;
      recommendedLkNama: string;
      reason: 'NOP_PBB' | 'STREET_CLUSTER';
      detail: string;
    }> = [];

    // Map of clean NOP to SPPT
    const nopMap = new Map<string, SpptPbbItem>();
    spptList.forEach((s) => {
      if (s.nop) {
        const clean = s.nop.replace(/[^0-9]/g, '');
        if (clean) nopMap.set(clean, s);
      }
    });

    // Calculate street consensus from dataList and spptList
    const streetToLkCount: Record<string, Record<number, number>> = {};
    
    // From spptList
    spptList.forEach((s) => {
      if (s.alamatOp && s.lingkungan) {
        const norm = normalizeStreetName(s.alamatOp);
        if (norm) {
          if (!streetToLkCount[norm]) streetToLkCount[norm] = {};
          streetToLkCount[norm][s.lingkungan] = (streetToLkCount[norm][s.lingkungan] || 0) + 1;
        }
      }
    });

    // From dataList
    dataList.forEach((k) => {
      if (k.namaJalan && k.lingkunganNomor) {
        const norm = normalizeStreetName(k.namaJalan);
        if (norm) {
          if (!streetToLkCount[norm]) streetToLkCount[norm] = {};
          streetToLkCount[norm][k.lingkunganNomor] = (streetToLkCount[norm][k.lingkunganNomor] || 0) + 1;
        }
      }
    });

    const streetConsensusMap = new Map<string, { lkNomor: number; count: number }>();
    Object.entries(streetToLkCount).forEach(([street, counts]) => {
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0 && sorted[0][1] >= 2) {
        streetConsensusMap.set(street, { lkNomor: Number(sorted[0][0]), count: sorted[0][1] });
      }
    });

    for (const kk of dataList) {
      const currentLkNomor = kk.lingkunganNomor || 0;

      // 1. Check NOP PBB Match
      if (kk.nopPbb) {
        const clean = kk.nopPbb.replace(/[^0-9]/g, '');
        const match = nopMap.get(clean);
        if (match && match.lingkungan && match.lingkungan !== currentLkNomor) {
          const targetAccount = KEPLING_ACCOUNTS.find((a) => a.nomorLingkungan === match.lingkungan);
          if (targetAccount) {
            result.push({
              kk,
              currentLkNomor,
              currentLkNama: kk.lingkunganNama || `Lingkungan ${currentLkNomor}`,
              recommendedLkId: targetAccount.id,
              recommendedLkNomor: match.lingkungan,
              recommendedLkNama: targetAccount.lingkungan,
              reason: 'NOP_PBB',
              detail: `NOP PBB: ${kk.nopPbb} terdata di ${targetAccount.lingkungan}`,
            });
            continue;
          }
        }
      }

      // 2. Check Street Consensus Match
      if (kk.namaJalan) {
        const norm = normalizeStreetName(kk.namaJalan);
        const consensus = streetConsensusMap.get(norm);
        if (consensus && consensus.lkNomor !== currentLkNomor) {
          const targetAccount = KEPLING_ACCOUNTS.find((a) => a.nomorLingkungan === consensus.lkNomor);
          if (targetAccount) {
            result.push({
              kk,
              currentLkNomor,
              currentLkNama: kk.lingkunganNama || `Lingkungan ${currentLkNomor}`,
              recommendedLkId: targetAccount.id,
              recommendedLkNomor: consensus.lkNomor,
              recommendedLkNama: targetAccount.lingkungan,
              reason: 'STREET_CLUSTER',
              detail: `${norm} mayoritas berada di ${targetAccount.lingkungan} (${consensus.count} data)`,
            });
          }
        }
      }
    }

    return result;
  }, [dataList, spptList]);

  // Fast lookup map of KK ID to Mismatch recommendation
  const mismatchMap = useMemo(() => {
    const map = new Map<string, typeof mismatchedList[0]>();
    mismatchedList.forEach((m) => map.set(m.kk.id, m));
    return map;
  }, [mismatchedList]);

  // Execute Batch Move
  const executeBatchMove = async (
    itemsToMove: { id: string; targetLkId: string }[],
    actionLabel: string
  ) => {
    if (itemsToMove.length === 0) {
      if (onShowToast) onShowToast('Tidak ada data yang dipilih untuk dipindahkan.', 'info');
      return;
    }

    setIsBulkExecuting(true);
    setBulkExecuteProgress({ done: 0, total: itemsToMove.length });
    setBulkExecuteMessage(`Memindahkan ${itemsToMove.length} data keluarga...`);

    try {
      const payload = itemsToMove.map((item) => {
        const targetAcc = KEPLING_ACCOUNTS.find((a) => a.id === item.targetLkId);
        return {
          id: item.id,
          lingkunganId: item.targetLkId,
          lingkunganNomor: targetAcc?.nomorLingkungan || 0,
          lingkunganNama: targetAcc?.lingkungan || '',
        };
      });

      const result = await batchUpdateLingkunganDataKeluarga(payload, (saved, total) => {
        setBulkExecuteProgress({ done: saved, total });
      });

      if (onShowToast) {
        onShowToast(
          `Berhasil memindahkan ${result.successCount} Kartu Keluarga!`,
          'success'
        );
      }
      setBulkExecuteMessage(`Selesai! ${result.successCount} KK berhasil dipindahkan.`);
      // Clear selection
      setSelectedTableKkIds(new Set());
      setSelectedSourceKkIds(new Set());
      setSelectedPbbSyncIds(new Set());
      setSelectedStreetKkIds(new Set());
    } catch (err: any) {
      console.error('Error executing batch move:', err);
      if (onShowToast) onShowToast('Gagal memindahkan data: ' + err.message, 'error');
    } finally {
      setIsBulkExecuting(false);
    }
  };

  // Quick single-item fix
  const handleQuickFixSingle = async (kkId: string, targetLkId: string) => {
    await executeBatchMove([{ id: kkId, targetLkId }], 'Koreksi 1 KK');
  };

  // Batch update neighborhood for all currently filtered items (Adopted directly from PBB Koreksi Massal)
  const handleBatchUpdateFilteredLingkungan = async (targetLingkungan: number) => {
    if (!isAdmin || filteredList.length === 0) return;
    const targetAcc = KEPLING_ACCOUNTS.find((a) => a.nomorLingkungan === targetLingkungan);
    if (!targetAcc) return;

    const count = filteredList.length;
    const msg =
      count > 100
        ? `PERINGATAN: Anda akan memindahkan ${count.toLocaleString('id-ID')} data Kartu Keluarga yang sedang terfilter ke ${targetAcc.lingkungan}. Lanjutkan?`
        : `Pindahkan ${count} data Kartu Keluarga yang sedang terfilter ke ${targetAcc.lingkungan}?`;

    if (!window.confirm(msg)) return;

    const items = filteredList.map((k) => ({
      id: k.id,
      targetLkId: targetAcc.id,
    }));

    await executeBatchMove(items, `Pindah ${count} KK ke ${targetAcc.lingkungan}`);
  };

  // Analyze Pasted Identifiers (NOP, No. KK, NIK) - Adopted from PBB Mode 3 Pindah Lingkungan Massal
  const handleAnalyzePasteList = () => {
    if (!rawPasteListInput.trim()) {
      if (onShowToast) onShowToast('Silakan tempel daftar NOP, No. KK, atau NIK terlebih dahulu.', 'error');
      return;
    }

    const lines = rawPasteListInput
      .split(/[\r\n,;|\t]+/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      if (onShowToast) onShowToast('Tidak ada data yang valid dalam teks yang ditempel.', 'error');
      return;
    }

    // Lookup caches for fast matching
    const nopMap = new Map<string, DataKeluarga>();
    const kkMap = new Map<string, DataKeluarga>();
    const nikMap = new Map<string, DataKeluarga>();

    dataList.forEach((k) => {
      if (k.nopPbb) {
        const clean = k.nopPbb.replace(/[^0-9]/g, '');
        if (clean) nopMap.set(clean, k);
      }
      if (k.nomorKk) {
        const clean = k.nomorKk.replace(/[^0-9]/g, '');
        if (clean) kkMap.set(clean, k);
      }
      if (k.nikKepalaKeluarga) {
        const clean = k.nikKepalaKeluarga.replace(/[^0-9]/g, '');
        if (clean) nikMap.set(clean, k);
      }
      if (k.anggotaKeluarga) {
        k.anggotaKeluarga.forEach((ang) => {
          if (ang.nik) {
            const clean = ang.nik.replace(/[^0-9]/g, '');
            if (clean) nikMap.set(clean, k);
          }
        });
      }
    });

    const matchedList: { kk: DataKeluarga; matchedBy: string; identifier: string }[] = [];
    const unmatchedList: string[] = [];
    const matchedKkIds = new Set<string>();

    for (const token of lines) {
      const cleanDigits = token.replace(/[^0-9]/g, '');
      let found: DataKeluarga | undefined;
      let matchedBy = '';

      if (cleanDigits.length === 18 && nopMap.has(cleanDigits)) {
        found = nopMap.get(cleanDigits);
        matchedBy = 'NOP PBB';
      } else if (cleanDigits.length === 16 && (kkMap.has(cleanDigits) || nikMap.has(cleanDigits))) {
        found = kkMap.get(cleanDigits) || nikMap.get(cleanDigits);
        matchedBy = kkMap.has(cleanDigits) ? 'Nomor KK' : 'NIK';
      } else if (nopMap.has(cleanDigits)) {
        found = nopMap.get(cleanDigits);
        matchedBy = 'NOP PBB';
      } else if (kkMap.has(cleanDigits)) {
        found = kkMap.get(cleanDigits);
        matchedBy = 'Nomor KK';
      } else if (nikMap.has(cleanDigits)) {
        found = nikMap.get(cleanDigits);
        matchedBy = 'NIK';
      }

      if (found && !matchedKkIds.has(found.id)) {
        matchedKkIds.add(found.id);
        matchedList.push({ kk: found, matchedBy, identifier: token });
      } else if (!found) {
        unmatchedList.push(token);
      }
    }

    setPasteAnalysisResult({ matched: matchedList, unmatched: unmatchedList });
    if (onShowToast) {
      onShowToast(
        `Analisis selesai: Ditemukan ${matchedList.length} KK di database (${unmatchedList.length} tidak ditemukan).`,
        matchedList.length > 0 ? 'success' : 'info'
      );
    }
  };

  // Execute Pasted List Move
  const handleExecutePasteMove = async () => {
    if (!pasteAnalysisResult || pasteAnalysisResult.matched.length === 0) return;
    const targetAcc = KEPLING_ACCOUNTS.find((a) => a.id === pasteTargetLkId);
    if (!targetAcc) return;

    if (
      !window.confirm(
        `Pindahkan ${pasteAnalysisResult.matched.length} Kartu Keluarga hasil tempel list ke ${targetAcc.lingkungan}?`
      )
    )
      return;

    const items = pasteAnalysisResult.matched.map((m) => ({
      id: m.kk.id,
      targetLkId: pasteTargetLkId,
    }));

    await executeBatchMove(items, `Pindah ${items.length} KK via Tempel List`);
    setPasteAnalysisResult(null);
    setRawPasteListInput('');
  };

  // Automated Lingkungan Assignment based on PBB or Street
  const getAutoLingkungan = (item: Partial<DataKeluarga>) => {
    // 1. Try NOP PBB Match
    if (item.nopPbb && spptList.length > 0) {
      const cleanNop = item.nopPbb.replace(/[^0-9]/g, '');
      const match = spptList.find(s => s.nop.replace(/[^0-9]/g, '') === cleanNop);
      if (match) {
        const lkAccount = KEPLING_ACCOUNTS.find(a => a.nomorLingkungan === match.lingkungan);
        if (lkAccount) {
          return {
            lingkunganId: lkAccount.id,
            lingkunganNomor: match.lingkungan,
            lingkunganNama: lkAccount.lingkungan
          };
        }
      }
    }

    // 2. Try Street Match (heuristic)
    if (item.namaJalan) {
      const street = item.namaJalan.toUpperCase();
      // Look at existing families on the same street and see where they belong
      const sameStreet = dataList.filter(k => k.namaJalan?.toUpperCase() === street && k.lingkunganNomor);
      if (sameStreet.length > 0) {
        // Find most frequent lingkungan for this street
        const lkCounts: Record<number, number> = {};
        sameStreet.forEach(k => {
          lkCounts[k.lingkunganNomor] = (lkCounts[k.lingkunganNomor] || 0) + 1;
        });
        const mostFreqLk = Object.entries(lkCounts).sort((a, b) => b[1] - a[1])[0][0];
        const numLk = Number(mostFreqLk);
        const lkAccount = KEPLING_ACCOUNTS.find(a => a.nomorLingkungan === numLk);
        if (lkAccount) {
          return {
            lingkunganId: lkAccount.id,
            lingkunganNomor: numLk,
            lingkunganNama: lkAccount.lingkungan
          };
        }
      }
    }

    return null;
  };

  // Unique streets for bulk move dropdown
  const uniqueStreets = useMemo(() => {
    const streets = new Set<string>();
    dataList.forEach(k => {
      if (k.namaJalan) streets.add(k.namaJalan.toUpperCase());
    });
    return Array.from(streets).sort();
  }, [dataList]);

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

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('pindah_lingkungan')}
            className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'pindah_lingkungan'
                ? 'bg-white text-blue-950 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <MapPin className="w-4 h-4 text-rose-600" />
            <span>Pindah Lingkungan Masal</span>
          </button>
        )}
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

        {/* Active Filter Tags & Koreksi Massal Dropdown (Adopted from PBB) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-[11px] text-slate-600 font-medium">
          <div className="flex flex-wrap items-center gap-2">
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
                className="text-rose-600 font-bold hover:underline cursor-pointer ml-1"
              >
                Reset Semua Filter
              </button>
            )}
          </div>

          {/* Quick Koreksi Massal for all filtered items (Directly from PBB Module) */}
          {isAdmin && filteredList.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl shadow-2xs ml-auto">
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span className="text-[10px] font-black text-amber-900 uppercase tracking-tight whitespace-nowrap">
                Koreksi Massal ({filteredList.length} KK):
              </span>
              <select
                onChange={(e) => {
                  const targetLkNum = parseInt(e.target.value, 10);
                  if (targetLkNum > 0) {
                    handleBatchUpdateFilteredLingkungan(targetLkNum);
                    e.target.value = "0"; // reset dropdown
                  }
                }}
                defaultValue="0"
                className="bg-white border border-amber-300 text-amber-950 font-black rounded-lg px-2 py-1 text-xs cursor-pointer focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="0">Pindah Ke Lingk...</option>
                {KEPLING_ACCOUNTS.map((acc) => (
                  <option key={acc.id} value={acc.nomorLingkungan}>
                    {acc.lingkungan} ({acc.nama})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Table Database Data Keluarga */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                {isAdmin && (
                  <th className="py-3 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={
                        paginatedKkList.length > 0 &&
                        paginatedKkList.every((k) => selectedTableKkIds.has(k.id))
                      }
                      onChange={(e) => {
                        const newSet = new Set(selectedTableKkIds);
                        if (e.target.checked) {
                          paginatedKkList.forEach((k) => newSet.add(k.id));
                        } else {
                          paginatedKkList.forEach((k) => newSet.delete(k.id));
                        }
                        setSelectedTableKkIds(newSet);
                      }}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      title="Pilih Semua di Halaman Ini"
                    />
                  </th>
                )}
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
                  <td colSpan={isAdmin ? 10 : 9} className="py-12 text-center text-slate-400 font-medium">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    <span>Memuat database data keluarga dari Firestore...</span>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="py-12 text-center text-slate-400 font-medium">
                    Belum ada data keluarga yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                paginatedKkList.map((item, index) => {
                  const itemIndex = pageSizeKk === -1 ? index + 1 : (pageKk - 1) * pageSizeKk + index + 1;
                  const isDesilRentan =
                    item.desilKesejahteraan?.includes('Desil 1') ||
                    item.desilKesejahteraan?.includes('Desil 2') ||
                    item.desilKesejahteraan?.includes('Desil 3');
                  const mismatch = mismatchMap.get(item.id);
                  const isSelected = selectedTableKkIds.has(item.id);

                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-rose-50/40' : ''}`}>
                      {isAdmin && (
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const newSet = new Set(selectedTableKkIds);
                              if (e.target.checked) newSet.add(item.id);
                              else newSet.delete(item.id);
                              setSelectedTableKkIds(newSet);
                            }}
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-3 px-4 text-center font-bold text-slate-400">{itemIndex}</td>

                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 tracking-tight">
                          NIK: {maskNik(item.nikKepalaKeluarga || item.nomorKk)}
                        </div>
                        {item.nopPbb && (
                          <div className="text-[10px] font-mono text-emerald-700 font-semibold mt-0.5">
                            NOP: {item.nopPbb}
                          </div>
                        )}
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{item.lingkunganNama}</span>
                          {mismatch && isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleQuickFixSingle(item.id, mismatch.recommendedLkId)}
                              title={`Klik untuk pindahkan ke ${mismatch.recommendedLkNama} (${mismatch.detail})`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-[9px] font-black border border-amber-300 transition-colors cursor-pointer animate-pulse"
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-700" />
                              <span>Pindah ➔ {mismatch.recommendedLkNama}</span>
                            </button>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 truncate font-medium mt-0.5">📍 {item.namaJalan} {item.nomorRumah ? `No. ${item.nomorRumah}` : ''}</div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          Agama: <span className="font-bold text-slate-700">{item.agama || item.anggotaKeluarga?.[0]?.agama || 'Islam'}</span>
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
                          🚽 {item.jambanKeluarga ? item.jambanKeluarga.split('(')[0] : 'Belum Terdata'}
                        </div>
                        <div className="text-[10.5px] text-slate-500 font-medium">
                          💧 Minum: {item.sumberAirMinum || 'Belum Terdata'}
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
                            title="Edit / Koreksi Data Keluarga"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => confirmDeleteKk(item)}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-800 hover:bg-rose-100 transition-colors cursor-pointer border border-rose-200"
                            title="Hapus Data Keluarga (Data Tidak Valid / Kadaluarsa)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls Bar */}
        {totalKkPages > 1 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <span>Menampilkan halaman <strong className="text-blue-700 font-bold">{pageKk}</strong> dari <strong>{totalKkPages}</strong></span>
              <span className="text-slate-300">•</span>
              <span>(Total {filteredList.length} KK)</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 mr-2 text-slate-500">
                <span className="text-[11px]">Baris:</span>
                <select
                  value={pageSizeKk}
                  onChange={(e) => setPageSizeKk(Number(e.target.value))}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={-1}>Semua</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setPageKk((p) => Math.max(1, p - 1))}
                disabled={pageKk === 1}
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalKkPages) }, (_, i) => {
                  let pNum = i + 1;
                  if (totalKkPages > 5 && pageKk > 3) {
                    pNum = pageKk - 2 + i;
                    if (pNum > totalKkPages) pNum = totalKkPages - (4 - i);
                  }
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setPageKk(pNum)}
                      className={`w-8 h-8 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                        pageKk === pNum
                          ? 'bg-blue-700 text-white shadow-2xs'
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
                onClick={() => setPageKk((p) => Math.min(totalKkPages, p + 1))}
                disabled={pageKk === totalKkPages}
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Sticky Bulk Move Action Toolbar */}
      {isAdmin && selectedTableKkIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white backdrop-blur-md px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex flex-wrap items-center gap-4 animate-in slide-in-from-bottom-5 duration-300 max-w-[95vw]">
          <div className="flex items-center gap-2 font-black text-xs text-rose-400">
            <CheckSquare className="w-4 h-4" />
            <span>{selectedTableKkIds.size} KK Terpilih</span>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-300 text-[11px] font-bold">Pindah Ke:</span>
            <select
              value={tableTargetLkId}
              onChange={(e) => setTableTargetLkId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-white font-bold text-xs border border-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
            >
              {KEPLING_ACCOUNTS.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.lingkungan} ({acc.nama})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              const targetAcc = KEPLING_ACCOUNTS.find((a) => a.id === tableTargetLkId);
              if (!targetAcc) return;
              if (
                !window.confirm(
                  `Pindahkan ${selectedTableKkIds.size} Kartu Keluarga terpilih ke ${targetAcc.lingkungan}?`
                )
              )
                return;
              const items: { id: string; targetLkId: string }[] = Array.from(selectedTableKkIds).map((id) => ({
                id: String(id),
                targetLkId: tableTargetLkId,
              }));
              executeBatchMove(items, `Pindah ${items.length} KK`);
            }}
            disabled={isBulkExecuting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {isBulkExecuting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
            <span>Pindahkan Terpilih</span>
          </button>

          {/* Quick Auto-fix according to NOP for selected items */}
          {Array.from(selectedTableKkIds).some((id) => mismatchMap.has(id)) && (
            <button
              type="button"
              onClick={() => {
                const fixItems: { id: string; targetLkId: string }[] = [];
                selectedTableKkIds.forEach((id) => {
                  const m = mismatchMap.get(id);
                  if (m) fixItems.push({ id, targetLkId: m.recommendedLkId });
                });
                if (fixItems.length === 0) return;
                if (
                  !window.confirm(
                    `Perbaiki ${fixItems.length} KK yang memiliki rekomendasi NOP PBB / Jalan ke lingkungan sebenarnya?`
                  )
                )
                  return;
                executeBatchMove(fixItems, `Auto-Fix ${fixItems.length} KK`);
              }}
              disabled={isBulkExecuting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 text-slate-950" />
              <span>⚡ Auto-Koreksi NOP</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSelectedTableKkIds(new Set())}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors cursor-pointer"
            title="Batalkan Pilihan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
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

          {/* Mode Selector: File Upload vs Text Paste */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setImportMode('file');
                setParseResult(null);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                importMode === 'file'
                  ? 'bg-white text-emerald-900 shadow-sm border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Unggah Berkas Excel / CSV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setImportMode('paste');
                setParseResult(null);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                importMode === 'paste'
                  ? 'bg-white text-emerald-900 shadow-sm border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileUp className="w-4 h-4 text-emerald-600" />
              <span>Salin-Tempel Teks (Paste Data KK)</span>
            </button>
          </div>

          {/* Import Content Area */}
          {importMode === 'file' ? (
            /* File Upload Zone */
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
          ) : (
            /* Text Paste Zone */
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Susun Otomatis Data Keluarga (Salin-Tempel Bebas)</span>
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRawPasteText(
                          `JON MARIHOT SINAGA 1271190811740002 .JL. COKLAT X PERUM COKLAT PERMAI BLOK C-2 LINGKUNGAN 24`
                        );
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors border border-amber-200 cursor-pointer"
                    >
                      👤 Format 1 (Nama, NIK, Alamat, LK)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRawPasteText(
                          `DAMENI MENDROFA 1201030605090043 1201035908730001 KEPALA KELUARGA JL. TEMBAKAU RAYA NO.35\nROSMAWATI ZEBUA 1201030605090043 1201036009750002 ISTRI JL. TEMBAKAU RAYA NO.35\nJOSUA MENDROFA 1201030605090043 1201030101050003 ANAK JL. TEMBAKAU RAYA NO.35`
                        );
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 text-indigo-900 hover:bg-indigo-100 transition-colors border border-indigo-200 cursor-pointer"
                    >
                      👥 Format 2 (Nama, No KK, NIK, Hubungan, Alamat)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRawPasteText(
                          `DATA BASE KELUARGA\nKELURAHAN MANGGA\n\nNIK: 1271190811740002\nNama Kepala Keluarga: BASMI KABAN\nLingkungan: 2\nAlamat: GG. BERAS MUNTE NO.22\nAgama: Islam`
                        );
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors border border-blue-200 cursor-pointer"
                    >
                      💡 Format Dokumen
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Sistem otomatis mendeteksi: <strong>16 angka pertama = No. Kartu Keluarga (KK)</strong>, <strong>16 angka kedua = NIK Anggota</strong>, Status Hubungan (Kepala Keluarga, Istri, Anak), Lingkungan (Kota Medan tanpa RT/RW), dan Agama. Jika Anda sebelumnya sudah mengimpor data Kepala Keluarga, mengimpor data lengkap ini akan <strong>otomatis menggabungkan dan melengkapi anggota ke dalam keluarga yang sama</strong> tanpa membuat data ganda!
                </p>
              </div>

              <textarea
                rows={7}
                value={rawPasteText}
                onChange={(e) => setRawPasteText(e.target.value)}
                placeholder={`Contoh Format Lengkap (Nama - No. KK - NIK - Hubungan - Alamat):\nDAMENI MENDROFA\t1201030605090043\t1201035908730001\tKEPALA KELUARGA\tJL. TEMBAKAU RAYA NO.35\nROSMAWATI ZEBUA\t1201030605090043\t1201036009750002\tISTRI\tJL. TEMBAKAU RAYA NO.35\nJOSUA MENDROFA\t1201030605090043\t1201030101050003\tANAK\tJL. TEMBAKAU RAYA NO.35`}
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Otomatis mendeteksi: NIK 16 digit, Lingkungan 1–24 Kota Medan, Info Agama, & Alamat</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRawPasteText('')}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    Bersihkan Teks
                  </button>
                  <button
                    type="button"
                    onClick={handleTextParse}
                    disabled={isParsingImport || !rawPasteText.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isParsingImport ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    <span>⚡ Susun Langsung Otomatis & Validasi</span>
                  </button>
                </div>
              </div>
            </div>
          )}

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
                        <th className="py-2.5 px-3">NIK Kepala Keluarga</th>
                        <th className="py-2.5 px-3">Nama Kepala Keluarga</th>
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
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{maskNik(kk.nikKepalaKeluarga || kk.nomorKk)}</td>
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

      {/* TAB 4: PINDAH LINGKUNGAN MASAL (SMART NOP PBB AUTO-CORRECTION & BATCH MOVE) */}
      {isAdmin && activeTab === 'pindah_lingkungan' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Header Banner */}
          <div className="bg-linear-to-r from-rose-950 via-slate-900 to-indigo-950 p-6 sm:p-8 rounded-[2.5rem] border border-rose-900/40 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 text-xs font-bold">
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Pusat Tata Kelola &amp; Rekonsiliasi Wilayah Lingkungan</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
                  Pusat Pemindahan &amp; Auto-Koreksi Lingkungan
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
                  Perbaiki dan pindahkan seluruh Kartu Keluarga (KK) yang tercatat di lingkungan yang salah ke lingkungan sebenarnya secara otomatis menggunakan integrasi <strong>NOP SPPT PBB</strong> atau pemindahan masal multi-filter.
                </p>
              </div>

              {/* Quick Summary Cards */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-center min-w-[110px]">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total KK</div>
                  <div className="text-xl font-black text-white">{dataList.length}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-center min-w-[110px]">
                  <div className="text-[10px] uppercase font-bold text-slate-400">SPPT PBB Terdata</div>
                  <div className="text-xl font-black text-emerald-400">{spptList.length}</div>
                </div>
                <div className={`backdrop-blur-md px-4 py-3 rounded-2xl border text-center min-w-[120px] ${
                  mismatchedList.length > 0
                    ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                    : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                }`}>
                  <div className="text-[10px] uppercase font-bold">Perlu Dikoreksi</div>
                  <div className="text-xl font-black">
                    {mismatchedList.length > 0 ? `${mismatchedList.length} KK` : '0 (Sempurna)'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Mode Navigation Buttons */}
          <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMoveSubMode('by_pbb_sync')}
              className={`flex-1 min-w-[200px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs transition-all cursor-pointer ${
                moveSubMode === 'by_pbb_sync'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>1. ⚡ Auto-Koreksi Cerdas NOP PBB</span>
              {mismatchedList.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[10px] font-black">
                  {mismatchedList.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMoveSubMode('by_source_lk')}
              className={`flex-1 min-w-[200px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs transition-all cursor-pointer ${
                moveSubMode === 'by_source_lk'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>2. 🔄 Pindah Antar Lingkungan (Asal ➔ Tujuan)</span>
            </button>

            <button
              type="button"
              onClick={() => setMoveSubMode('by_street')}
              className={`flex-1 min-w-[200px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs transition-all cursor-pointer ${
                moveSubMode === 'by_street'
                  ? 'bg-blue-700 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>3. 📍 Pindah Berdasarkan Nama Jalan</span>
            </button>

            <button
              type="button"
              onClick={() => setMoveSubMode('by_paste_list')}
              className={`flex-1 min-w-[200px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs transition-all cursor-pointer ${
                moveSubMode === 'by_paste_list'
                  ? 'bg-purple-700 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileUp className="w-4 h-4" />
              <span>4. 📋 Tempel List (NOP / KK / NIK)</span>
            </button>
          </div>

          {/* SUB-MODE 1: AUTO-KOREKSI NOP PBB (SMART RECONCILIATION) */}
          {moveSubMode === 'by_pbb_sync' && (
            <div className="space-y-6">
              {mismatchedList.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-sm">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                    <CheckCircle className="w-9 h-9" />
                  </div>
                  <h4 className="text-xl font-black text-emerald-950">
                    Semua Data Keluarga Sudah Sesuai Lingkungan!
                  </h4>
                  <p className="text-emerald-800 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
                    Sistem telah memindai seluruh {dataList.length} Kartu Keluarga terhadap {spptList.length} data SPPT PBB dan klaster jalan. Tidak ditemukan adanya data yang salah lingkungan.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6">
                  {/* Warning & 1-Click Fix All Action Card */}
                  <div className="bg-linear-to-r from-amber-500 via-amber-600 to-orange-600 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-slate-950 font-black text-xs uppercase tracking-wider bg-amber-300 px-2.5 py-0.5 rounded-full w-fit">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Deteksi Ketidaksesuaian Otomatis</span>
                      </div>
                      <h4 className="text-xl sm:text-2xl font-black">
                        Ditemukan {mismatchedList.length} KK di Lingkungan yang Salah!
                      </h4>
                      <p className="text-amber-100 text-xs leading-relaxed max-w-xl">
                        Berdasarkan pencocokan Nomor NOP SPPT PBB dan konsensus alamat jalan, keluarga-keluarga di bawah ini tercatat di lingkungan yang berbeda dengan lokasi aslinya.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Yakin ingin memperbaiki dan memindahkan seluruh ${mismatchedList.length} KK sekaligus ke lingkungan yang sebenarnya sesuai NOP PBB?`
                          )
                        )
                          return;
                        const items = mismatchedList.map((m) => ({
                          id: m.kk.id,
                          targetLkId: m.recommendedLkId,
                        }));
                        executeBatchMove(items, `Koreksi Masal ${items.length} KK`);
                      }}
                      disabled={isBulkExecuting}
                      className="inline-flex items-center gap-2.5 px-6 py-4 rounded-2xl bg-slate-950 hover:bg-slate-900 text-amber-300 font-black text-sm shadow-xl transition-all cursor-pointer whitespace-nowrap border border-amber-400/40 disabled:opacity-50"
                    >
                      {isBulkExecuting ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Zap className="w-5 h-5 text-amber-400" />
                      )}
                      <span>⚡ Koreksi Semua ({mismatchedList.length} KK) Sekaligus</span>
                    </button>
                  </div>

                  {/* Filter & Selection in Mismatch List */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className="text-xs font-black text-slate-800 flex items-center gap-2">
                      <Table className="w-4 h-4 text-slate-500" />
                      <span>Daftar KK yang Perlu Dipindahkan ({mismatchedList.length})</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedPbbSyncIds.size === mismatchedList.length) {
                            setSelectedPbbSyncIds(new Set());
                          } else {
                            setSelectedPbbSyncIds(new Set(mismatchedList.map((m) => m.kk.id)));
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer border border-slate-200"
                      >
                        {selectedPbbSyncIds.size === mismatchedList.length
                          ? 'Batal Pilih Semua'
                          : 'Pilih Semua'}
                      </button>

                      {selectedPbbSyncIds.size > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const itemsToFix = mismatchedList
                              .filter((m) => selectedPbbSyncIds.has(m.kk.id))
                              .map((m) => ({ id: m.kk.id, targetLkId: m.recommendedLkId }));
                            if (
                              !window.confirm(
                                `Pindahkan ${itemsToFix.length} KK yang dipilih ke lingkungan sebenarnya?`
                              )
                            )
                              return;
                            executeBatchMove(itemsToFix, `Koreksi ${itemsToFix.length} KK`);
                          }}
                          disabled={isBulkExecuting}
                          className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer shadow-sm"
                        >
                          Pindahkan {selectedPbbSyncIds.size} KK Terpilih
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Table of Mismatched KKs */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-200">
                          <th className="py-3 px-3 text-center w-10">
                            <input
                              type="checkbox"
                              checked={
                                mismatchedList.length > 0 &&
                                selectedPbbSyncIds.size === mismatchedList.length
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPbbSyncIds(new Set(mismatchedList.map((m) => m.kk.id)));
                                } else {
                                  setSelectedPbbSyncIds(new Set());
                                }
                              }}
                              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                          </th>
                          <th className="py-3 px-4">Nama Kepala Keluarga / NIK</th>
                          <th className="py-3 px-4">Alamat / Jalan</th>
                          <th className="py-3 px-4">NOP PBB</th>
                          <th className="py-3 px-4 text-center">Lingkungan Sekarang</th>
                          <th className="py-3 px-4 text-center">➔ Rekomendasi Sebenarnya</th>
                          <th className="py-3 px-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {mismatchedList.map((item) => {
                          const isChecked = selectedPbbSyncIds.has(item.kk.id);
                          return (
                            <tr
                              key={item.kk.id}
                              className={`hover:bg-slate-50 transition-colors ${
                                isChecked ? 'bg-amber-50/60' : ''
                              }`}
                            >
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const next = new Set(selectedPbbSyncIds);
                                    if (e.target.checked) next.add(item.kk.id);
                                    else next.delete(item.kk.id);
                                    setSelectedPbbSyncIds(next);
                                  }}
                                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">{item.kk.namaKepalaKeluarga}</div>
                                <div className="text-[10px] font-mono text-slate-500">
                                  {maskNik(item.kk.nikKepalaKeluarga || item.kk.nomorKk)}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-800">{item.kk.namaJalan}</div>
                                <div className="text-[10px] text-slate-400">
                                  {item.kk.nomorRumah ? `No. ${item.kk.nomorRumah}` : ''}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px] font-semibold text-emerald-800">
                                {item.kk.nopPbb || '-'}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-block px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 font-extrabold text-[11px] border border-rose-200">
                                  {item.currentLkNama}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-950 font-black text-[11px] border border-emerald-300 shadow-2xs">
                                  ✓ {item.recommendedLkNama}
                                </span>
                                <div className="text-[9.5px] text-slate-500 font-medium mt-0.5">
                                  {item.detail}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleQuickFixSingle(item.kk.id, item.recommendedLkId)}
                                  disabled={isBulkExecuting}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-sm transition-colors cursor-pointer"
                                >
                                  <span>Pindahkan</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-MODE 2: PEMINDAHAN ANTAR LINGKUNGAN (ASAL -> TUJUAN + FILTER JALAN) */}
          {moveSubMode === 'by_source_lk' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center border border-rose-200 shadow-sm text-rose-600">
                  <ArrowLeftRight className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900">
                    Pemindahan Antar Lingkungan (Lingkungan Asal ➔ Lingkungan Tujuan)
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Pilih lingkungan asal untuk melihat daftar KK di dalamnya, saring berdasarkan jalan atau kata kunci, lalu pindahkan ke lingkungan tujuan.
                  </p>
                </div>
              </div>

              {/* Selection Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-slate-50 rounded-3xl border border-slate-200">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    1. Lingkungan Asal (Sumber Data):
                  </label>
                  <select
                    value={sourceLkId}
                    onChange={(e) => {
                      setSourceLkId(e.target.value);
                      setSelectedSourceKkIds(new Set());
                    }}
                    className="w-full p-3.5 rounded-2xl bg-white border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none shadow-sm"
                  >
                    {KEPLING_ACCOUNTS.map((acc) => {
                      const count = dataList.filter((k) => k.lingkunganId === acc.id).length;
                      return (
                        <option key={acc.id} value={acc.id}>
                          {acc.lingkungan} ({count} KK) - Kepling {acc.nama}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    2. Filter Jalan / Pencarian (Opsional):
                  </label>
                  <input
                    type="text"
                    placeholder="Semua jalan (atau ketik nama jalan / NIK)..."
                    value={sourceLkStreetFilter}
                    onChange={(e) => setSourceLkStreetFilter(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-white border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    3. Pindah Ke Lingkungan Tujuan:
                  </label>
                  <select
                    value={sourceTargetLkId}
                    onChange={(e) => setSourceTargetLkId(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-white border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none shadow-sm"
                  >
                    {KEPLING_ACCOUNTS.map((acc) => (
                      <option key={acc.id} value={acc.id} disabled={acc.id === sourceLkId}>
                        {acc.lingkungan} ({acc.nama}) {acc.id === sourceLkId ? '(Sama)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Source Families List */}
              {(() => {
                const sourceFamilies = dataList.filter((k) => {
                  if (k.lingkunganId !== sourceLkId) return false;
                  if (sourceLkStreetFilter.trim()) {
                    const q = sourceLkStreetFilter.toLowerCase().trim();
                    const street = (k.namaJalan || '').toLowerCase();
                    const name = (k.namaKepalaKeluarga || '').toLowerCase();
                    const nik = (k.nikKepalaKeluarga || k.nomorKk || '').toLowerCase();
                    if (!street.includes(q) && !name.includes(q) && !nik.includes(q)) return false;
                  }
                  return true;
                });

                const targetAcc = KEPLING_ACCOUNTS.find((a) => a.id === sourceTargetLkId);

                return (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                      <div className="text-xs font-bold text-slate-700">
                        Menemukan <strong className="text-slate-950 font-black">{sourceFamilies.length}</strong> KK di Lingkungan Asal
                        {selectedSourceKkIds.size > 0 && (
                          <span className="ml-2 text-rose-600 font-black">
                            ({selectedSourceKkIds.size} dipilih)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedSourceKkIds.size === sourceFamilies.length) {
                              setSelectedSourceKkIds(new Set());
                            } else {
                              setSelectedSourceKkIds(new Set(sourceFamilies.map((k) => k.id)));
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer border border-slate-200"
                        >
                          {selectedSourceKkIds.size === sourceFamilies.length
                            ? 'Batal Pilih Semua'
                            : `Pilih Semua (${sourceFamilies.length} KK)`}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (selectedSourceKkIds.size === 0) {
                              if (onShowToast) onShowToast('Centang minimal 1 KK untuk dipindahkan.', 'error');
                              return;
                            }
                            if (!targetAcc) return;
                            if (
                              !window.confirm(
                                `Pindahkan ${selectedSourceKkIds.size} KK terpilih ke ${targetAcc.lingkungan}?`
                              )
                            )
                              return;
                            const items: { id: string; targetLkId: string }[] = Array.from(selectedSourceKkIds).map((id) => ({
                              id: String(id),
                              targetLkId: sourceTargetLkId,
                            }));
                            executeBatchMove(items, `Pindah ${items.length} KK`);
                          }}
                          disabled={isBulkExecuting || selectedSourceKkIds.size === 0}
                          className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isBulkExecuting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ArrowRight className="w-3.5 h-3.5" />
                          )}
                          <span>
                            Pindahkan {selectedSourceKkIds.size} KK ke {targetAcc?.lingkungan}
                          </span>
                        </button>
                      </div>
                    </div>

                    {sourceFamilies.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 text-xs">
                        Tidak ada data keluarga di lingkungan asal ini yang sesuai dengan filter.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-[500px]">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="sticky top-0 bg-slate-100 z-10 shadow-2xs">
                            <tr className="text-[10px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-200">
                              <th className="py-2.5 px-3 text-center w-10">
                                <input
                                  type="checkbox"
                                  checked={
                                    sourceFamilies.length > 0 &&
                                    selectedSourceKkIds.size === sourceFamilies.length
                                  }
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSourceKkIds(new Set(sourceFamilies.map((k) => k.id)));
                                    } else {
                                      setSelectedSourceKkIds(new Set());
                                    }
                                  }}
                                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                                />
                              </th>
                              <th className="py-2.5 px-3">No</th>
                              <th className="py-2.5 px-4">Nama Kepala Keluarga / NIK</th>
                              <th className="py-2.5 px-4">Alamat Jalan / Gang</th>
                              <th className="py-2.5 px-4">NOP PBB</th>
                              <th className="py-2.5 px-4 text-center">Jiwa</th>
                              <th className="py-2.5 px-4 text-right">Aksi Cepat</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sourceFamilies.map((item, idx) => {
                              const isChecked = selectedSourceKkIds.has(item.id);
                              return (
                                <tr
                                  key={item.id}
                                  className={`hover:bg-slate-50 transition-colors ${
                                    isChecked ? 'bg-rose-50/50' : ''
                                  }`}
                                >
                                  <td className="py-2.5 px-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const next = new Set(selectedSourceKkIds);
                                        if (e.target.checked) next.add(item.id);
                                        else next.delete(item.id);
                                        setSelectedSourceKkIds(next);
                                      }}
                                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                  <td className="py-2.5 px-4">
                                    <div className="font-bold text-slate-900">{item.namaKepalaKeluarga}</div>
                                    <div className="text-[10px] font-mono text-slate-500">
                                      {maskNik(item.nikKepalaKeluarga || item.nomorKk)}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-4 font-medium text-slate-700">
                                    📍 {item.namaJalan} {item.nomorRumah ? `No. ${item.nomorRumah}` : ''}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono text-[11px] text-emerald-800">
                                    {item.nopPbb || '-'}
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 font-black text-[10px]">
                                      {item.jumlahAnggotaKeluarga}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleQuickFixSingle(item.id, sourceTargetLkId)}
                                      disabled={isBulkExecuting}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold text-[11px] transition-colors cursor-pointer"
                                    >
                                      <span>Pindah</span>
                                      <ArrowRight className="w-2.5 h-2.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* SUB-MODE 3: PEMINDAHAN BERDASARKAN JALAN */}
          {moveSubMode === 'by_street' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center border border-blue-200 shadow-sm text-blue-700">
                  <MapPin className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900">
                    Pemindahan Berdasarkan Nama Jalan
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Pindahkan seluruh keluarga di suatu nama jalan/gang ke lingkungan yang baru sekaligus.
                  </p>
                </div>
              </div>

              {/* Form Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-200">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider ml-1">
                    1. Pilih Nama Jalan / Gang:
                  </label>
                  <select
                    value={streetSearchKeyword}
                    onChange={(e) => setStreetSearchKeyword(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-white border border-slate-300 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
                  >
                    <option value="">-- Pilih Jalan ({uniqueStreets.length} Jalan Terdaftar) --</option>
                    {uniqueStreets.map((street) => {
                      const count = dataList.filter((k) => k.namaJalan?.toUpperCase() === street).length;
                      return (
                        <option key={street} value={street}>
                          {street} ({count} KK)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider ml-1">
                    2. Pindah Ke Lingkungan Tujuan:
                  </label>
                  <select
                    value={streetTargetLkId}
                    onChange={(e) => setStreetTargetLkId(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-white border border-slate-300 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
                  >
                    {KEPLING_ACCOUNTS.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.lingkungan} ({acc.nama})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Street Summary & Action */}
              {streetSearchKeyword && (() => {
                const matchingKks = dataList.filter(
                  (k) => k.namaJalan?.toUpperCase() === streetSearchKeyword.toUpperCase()
                );
                const targetAccount = KEPLING_ACCOUNTS.find((a) => a.id === streetTargetLkId);
                const needsMoveCount = matchingKks.filter((k) => k.lingkunganId !== streetTargetLkId).length;

                // Group breakdown by current Lingkungan
                const lkBreakdown: Record<string, number> = {};
                matchingKks.forEach((k) => {
                  lkBreakdown[k.lingkunganNama || 'Tidak Diketahui'] =
                    (lkBreakdown[k.lingkunganNama || 'Tidak Diketahui'] || 0) + 1;
                });

                return (
                  <div className="p-6 bg-blue-50/50 border border-blue-200 rounded-3xl space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-black text-blue-950">
                          Ringkasan Data di {streetSearchKeyword}:
                        </div>
                        <div className="text-xs text-blue-800 mt-1 flex flex-wrap gap-2">
                          <span>Total: <strong>{matchingKks.length} KK</strong></span>
                          <span>•</span>
                          <span>Sebaran saat ini: {Object.entries(lkBreakdown).map(([lk, cnt]) => `${lk}: ${cnt} KK`).join(', ')}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (needsMoveCount === 0) {
                            if (onShowToast) onShowToast(`Seluruh keluarga di ${streetSearchKeyword} sudah berada di ${targetAccount?.lingkungan}.`, 'info');
                            return;
                          }
                          if (!targetAccount) return;
                          if (
                            !window.confirm(
                              `Pindahkan ${needsMoveCount} KK di ${streetSearchKeyword} ke ${targetAccount.lingkungan}?`
                            )
                          )
                            return;
                          const items = matchingKks
                            .filter((k) => k.lingkunganId !== streetTargetLkId)
                            .map((k) => ({ id: k.id, targetLkId: streetTargetLkId }));
                          executeBatchMove(items, `Pindah ${items.length} KK`);
                        }}
                        disabled={isBulkExecuting || needsMoveCount === 0}
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-700 hover:bg-blue-600 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isBulkExecuting ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4" />
                        )}
                        <span>
                          Pindahkan {needsMoveCount} KK ke {targetAccount?.lingkungan}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* SUB-MODE 4: TEMPEL / PASTE LIST NOP / NO KK / NIK (DIRECTLY ADOPTED FROM PBB MODULE) */}
          {moveSubMode === 'by_paste_list' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center border border-purple-200 shadow-sm text-purple-700">
                  <FileUp className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900">
                    Pemindahan Massal via Tempel List (NOP / No. KK / NIK)
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Sistem akan memindai daftar NOP PBB, No. KK, atau NIK yang Anda tempel dan langsung memindahkannya ke lingkungan tujuan.
                  </p>
                </div>
              </div>

              {/* Target Lingkungan Selector */}
              <div className="p-6 bg-purple-50/50 rounded-3xl border border-purple-200 space-y-3">
                <label className="text-xs font-black text-purple-950 uppercase tracking-wider block">
                  1. Pilih Lingkungan Tujuan Pemindahan:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {KEPLING_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setPasteTargetLkId(acc.id)}
                      className={`p-3 rounded-2xl text-left border font-bold text-xs transition-all cursor-pointer flex items-center justify-between ${
                        pasteTargetLkId === acc.id
                          ? 'bg-purple-700 text-white border-purple-800 shadow-md ring-2 ring-purple-400'
                          : 'bg-white text-slate-800 border-purple-100 hover:border-purple-300'
                      }`}
                    >
                      <div>
                        <div className="font-black">{acc.lingkungan}</div>
                        <div className={`text-[10px] ${pasteTargetLkId === acc.id ? 'text-purple-200' : 'text-slate-500'}`}>
                          Kepling: {acc.nama}
                        </div>
                      </div>
                      {pasteTargetLkId === acc.id && <Check className="w-4 h-4 text-purple-200" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paste Textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    2. Tempel / Paste Daftar NOP, Nomor KK, atau NIK:
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Pisahkan dengan enter, koma, spasi, atau copy langsung dari kolom Excel
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={rawPasteListInput}
                  onChange={(e) => setRawPasteListInput(e.target.value)}
                  placeholder={`Contoh tempel NOP atau NIK atau No KK:\n12.71.190.008.001-0023.0\n12.71.190.008.001-0045.0\n1271190811740002\n1271190811750003`}
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-300 font-mono text-xs text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none focus:bg-white shadow-inner"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
                <button
                  type="button"
                  onClick={handleAnalyzePasteList}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-purple-700 hover:bg-purple-600 text-white font-black text-xs shadow-md transition-all cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  <span>Analisis &amp; Cari Data di Database</span>
                </button>

                {pasteAnalysisResult && pasteAnalysisResult.matched.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExecutePasteMove}
                    disabled={isBulkExecuting}
                    className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-200 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isBulkExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    <span>
                      Eksekusi Pindah {pasteAnalysisResult.matched.length} KK ke{' '}
                      {KEPLING_ACCOUNTS.find((a) => a.id === pasteTargetLkId)?.lingkungan}
                    </span>
                  </button>
                )}
              </div>

              {/* Analysis Result Preview */}
              {pasteAnalysisResult && (
                <div className="space-y-4 pt-4 border-t border-slate-200 animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-emerald-800 font-bold uppercase">Ditemukan di Database</div>
                        <div className="text-xl font-black text-emerald-950">
                          {pasteAnalysisResult.matched.length} Kartu Keluarga
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 font-bold uppercase">Tidak Ditemukan</div>
                        <div className="text-xl font-black text-slate-800">
                          {pasteAnalysisResult.unmatched.length} Nomor / Baris
                        </div>
                      </div>
                    </div>
                  </div>

                  {pasteAnalysisResult.matched.length > 0 && (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-[350px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-slate-100 z-10 shadow-2xs">
                          <tr className="text-[10px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-200">
                            <th className="py-2.5 px-3 text-center">No</th>
                            <th className="py-2.5 px-4">Nama Kepala Keluarga</th>
                            <th className="py-2.5 px-4">Dicocokkan Berdasarkan</th>
                            <th className="py-2.5 px-4">Lingkungan Asal</th>
                            <th className="py-2.5 px-4 text-emerald-700 font-black">➔ Lingkungan Tujuan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pasteAnalysisResult.matched.map((item, idx) => (
                            <tr key={item.kk.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-2 px-4">
                                <div className="font-bold text-slate-900">{item.kk.namaKepalaKeluarga}</div>
                                <div className="text-[10px] text-slate-400">
                                  {maskNik(item.kk.nikKepalaKeluarga || item.kk.nomorKk)}
                                </div>
                              </td>
                              <td className="py-2 px-4 font-mono text-[11px] text-purple-900 font-semibold">
                                {item.matchedBy}: {item.identifier}
                              </td>
                              <td className="py-2 px-4 font-medium text-slate-700">
                                {item.kk.lingkunganNama}
                              </td>
                              <td className="py-2 px-4 font-black text-emerald-900 bg-emerald-50/50">
                                ✓ {KEPLING_ACCOUNTS.find((a) => a.id === pasteTargetLkId)?.lingkungan}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {pasteAnalysisResult.unmatched.length > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1 text-xs">
                      <div className="font-bold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-700" />
                        <span>Daftar {pasteAnalysisResult.unmatched.length} nomor/baris yang belum ada di database keluarga:</span>
                      </div>
                      <div className="font-mono text-[11px] text-amber-800 break-all">
                        {pasteAnalysisResult.unmatched.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Execution Progress Overlay / Banner */}
          {isBulkExecuting && (
            <div className="p-6 bg-slate-900 text-white rounded-3xl border border-slate-700 shadow-2xl flex items-center gap-4 animate-in fade-in">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="text-sm font-black">{bulkExecuteMessage || 'Sedang memproses pemindahan data...'}</div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div
                    className="bg-linear-to-r from-amber-400 to-rose-500 h-full transition-all duration-300"
                    style={{
                      width: `${bulkExecuteProgress.total > 0 ? (bulkExecuteProgress.done / bulkExecuteProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="text-[11px] text-slate-400">
                  {bulkExecuteProgress.done} dari {bulkExecuteProgress.total} KK berhasil diperbarui ke Firestore &amp; Database Lokal
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

            {/* Header Resmi Database Keluarga */}
            <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
              <div className="text-xs font-bold tracking-widest text-slate-500 uppercase">
                DATABASE KELUARGA KELURAHAN MANGGA
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                KARTU KELUARGA
              </h2>
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="text-base sm:text-lg font-mono font-black text-blue-900 tracking-wider">
                  No. {showFullNik
                    ? (selectedDetailKk.nomorKk || selectedDetailKk.nikKepalaKeluarga)
                    : maskNik(selectedDetailKk.nomorKk || selectedDetailKk.nikKepalaKeluarga)}
                </span>
                <button
                  type="button"
                  onClick={() => setShowFullNik(!showFullNik)}
                  title={showFullNik ? 'Samarkan Nomor (5 digit akhir *****)' : 'Tampilkan Nomor Lengkap'}
                  className="p-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 transition-colors cursor-pointer border border-blue-200"
                >
                  {showFullNik ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
                  <span className="font-mono font-bold text-slate-900">{maskNik(selectedDetailKk.nikKepalaKeluarga)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Alamat:</span>
                  <span className="font-semibold text-slate-800 text-right">{selectedDetailKk.namaJalan} {selectedDetailKk.nomorRumah ? `No. ${selectedDetailKk.nomorRumah}` : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Agama:</span>
                  <span className="font-bold text-slate-900">{selectedDetailKk.agama || selectedDetailKk.anggotaKeluarga?.[0]?.agama || 'Islam'}</span>
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
                      <th className="py-2.5 px-3">Agama</th>
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
                          <td className="py-2 px-3 font-mono text-slate-700">{maskNik(ang.nik)}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{ang.hubunganKeluarga}</td>
                          <td className="py-2 px-3 text-center font-bold text-slate-700">{ang.jenisKelamin}</td>
                          <td className="py-2 px-3 text-center">{ang.usia} Th</td>
                          <td className="py-2 px-3 text-slate-800 font-medium">{ang.agama || selectedDetailKk.agama || 'Islam'}</td>
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
                  <span className="font-bold text-slate-900">{selectedDetailKk.jambanKeluarga || 'Belum Terdata (Perlu Verifikasi Kepling)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Sumber Air Minum:</span>
                  <span className="font-bold text-slate-900">{selectedDetailKk.sumberAirMinum || 'Belum Terdata'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Sumber Air Bersih:</span>
                  <span className="font-bold text-slate-900">{selectedDetailKk.sumberAirBersih || 'Belum Terdata'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Pembuangan Sampah:</span>
                  <span className="font-bold text-slate-900">{selectedDetailKk.pembuanganSampahRumah || 'Belum Terdata'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Risiko Stunting:</span>
                  <span className="font-bold text-amber-800">{selectedDetailKk.statusStuntingRentan || 'Belum Terdata'}</span>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <div className="text-xs text-slate-400">
                Dicatat oleh: <strong className="text-slate-700">{selectedDetailKk.createdByName || 'Petugas'}</strong>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                  onClick={() => {
                    const itemToEdit = selectedDetailKk;
                    setSelectedDetailKk(null);
                    setEditingKk(itemToEdit);
                    setIsFormOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 text-amber-900 font-bold text-xs hover:bg-amber-100 transition-colors cursor-pointer border border-amber-300 shadow-2xs"
                  title="Koreksi dan perbarui data keluarga"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                  <span>Edit Data</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    confirmDeleteKk(selectedDetailKk);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 text-rose-900 font-bold text-xs hover:bg-rose-100 transition-colors cursor-pointer border border-rose-300 shadow-2xs"
                  title="Hapus data keluarga yang tidak valid lagi"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                  <span>Hapus Data</span>
                </button>

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

      {/* MODAL: KONFIRMASI HAPUS DATA KELUARGA (KEPLING & ADMIN) */}
      {deletingKk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Konfirmasi Hapus Data Keluarga</h3>
                <p className="text-xs text-slate-500 font-medium">Hapus data yang tidak valid / kadaluarsa</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/70 rounded-2xl border border-rose-200/80 text-xs text-rose-950 space-y-1.5">
              <p className="font-bold text-slate-800">
                Kepala Keluarga: <span className="text-rose-900 font-black">{deletingKk.namaKk}</span>
              </p>
              {deletingKk.nomorKk && (
                <p className="text-slate-600 font-medium">
                  No. KK: <span className="font-mono font-bold text-slate-800">{deletingKk.nomorKk}</span>
                </p>
              )}
              {deletingKk.lingkunganNama && (
                <p className="text-slate-600 font-medium">
                  Wilayah: <span className="font-bold text-slate-800">{deletingKk.lingkunganNama}</span>
                </p>
              )}
              {deletingKk.alamat && (
                <p className="text-slate-600 font-medium">
                  Alamat: <span className="text-slate-700">{deletingKk.alamat}</span>
                </p>
              )}
              <div className="pt-2 border-t border-rose-200/60 text-[11px] text-rose-800 font-semibold leading-relaxed">
                ⚠️ Data Kartu Keluarga dan seluruh anggota keluarga yang terdaftar akan dihapus secara permanen dari database kependudukan & WebGIS.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingKk(null)}
                disabled={isDeletingKk}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDeleteKk}
                disabled={isDeletingKk}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingKk ? 'Menghapus...' : 'Ya, Hapus Data Keluarga'}</span>
              </button>
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
          spptList={spptList}
          dataList={dataList}
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
  spptList: SpptPbbItem[];
  dataList: DataKeluarga[];
}

const FormKeluargaModal: React.FC<FormKeluargaModalProps> = ({
  isOpen,
  initialData,
  currentUser,
  onClose,
  onSave,
  spptList,
  dataList,
}) => {
  const isKepling = currentUser.role === 'kepling';
  const defaultLingkunganId = isKepling ? currentUser.id : 'kepling_1';
  const defaultKepling = KEPLING_ACCOUNTS.find((k) => k.id === defaultLingkunganId) || KEPLING_ACCOUNTS[0];

  const [activeTab, setActiveTab] = useState<'UTAMA' | 'ANGGOTA' | 'BANSOS' | 'SANITASI'>('UTAMA');
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [nomorKk, setNomorKk] = useState<string>(initialData?.nomorKk || '');
  const [nikKk, setNikKk] = useState<string>(initialData?.nikKepalaKeluarga || '');
  const [namaKk, setNamaKk] = useState<string>(initialData?.namaKepalaKeluarga || '');
  const [telepon, setTelepon] = useState<string>(initialData?.telepon || '');
  const [lingkunganId, setLingkunganId] = useState<string>(initialData?.lingkunganId || defaultLingkunganId);
  const [namaJalan, setNamaJalan] = useState<string>(initialData?.namaJalan || '');
  const [nomorRumah, setNomorRumah] = useState<string>(initialData?.nomorRumah || '');
  const [agama, setAgama] = useState<string>(initialData?.agama || initialData?.anggotaKeluarga?.[0]?.agama || 'Islam');
  const [statusDomisili, setStatusDomisili] = useState<string>(
    initialData?.statusDomisili || 'KK Kelurahan Mangga (KTP/KK Setempat)'
  );
  const [kewarganegaraan, setKewarganegaraan] = useState<string>(initialData?.kewarganegaraan || 'WNI');
  const [negaraAsalWna, setNegaraAsalWna] = useState<string>(initialData?.negaraAsalWna || '');
  const [pekerjaanKk, setPekerjaanKk] = useState<string>(initialData?.pekerjaanUtamaKepalaKeluarga || '');
  const [nopPbb, setNopPbb] = useState<string>(initialData?.nopPbb || '');

  // Anggota Keluarga List
  const [anggotaList, setAnggotaList] = useState<AnggotaKeluarga[]>(initialData?.anggotaKeluarga || []);

  // Kesejahteraan & Bansos
  const [desil, setDesil] = useState<string>(initialData?.desilKesejahteraan || '');
  const [bantuanDiterima, setBantuanDiterima] = useState<string[]>(
    initialData?.bantuanDiterima || []
  );

  // Sanitasi & Kesehatan
  const [jamban, setJamban] = useState<string>(initialData?.jambanKeluarga || '');
  const [tempatTinja, setTempatTinja] = useState<string>(initialData?.tempatAkhirTinja || '');
  const [airMinum, setAirMinum] = useState<string>(initialData?.sumberAirMinum || '');
  const [airBersih, setAirBersih] = useState<string>(initialData?.sumberAirBersih || '');
  const [sampah, setSampah] = useState<string>(initialData?.pembuanganSampahRumah || '');
  const [stunting, setStunting] = useState<string>(initialData?.statusStuntingRentan || '');

  // Temporary State for Adding Anggota
  const [tempAnggotaNama, setTempAnggotaNama] = useState<string>('');
  const [tempAnggotaNik, setTempAnggotaNik] = useState<string>('');
  const [tempAnggotaHub, setTempAnggotaHub] = useState<HubunganKeluargaType>('Anak');
  const [tempAnggotaJk, setTempAnggotaJk] = useState<'L' | 'P'>('L');
  const [tempAnggotaUsia, setTempAnggotaUsia] = useState<number>(10);
  const [tempAnggotaAgama, setTempAnggotaAgama] = useState<AgamaType>('Islam');
  const [tempAnggotaPekerjaan, setTempAnggotaPekerjaan] = useState<string>('Pelajar');

  // Auto-assign Lingkungan based on NOP or Street
  useEffect(() => {
    if (!initialData && (nopPbb || namaJalan)) {
      // 1. Try NOP PBB Match
      if (nopPbb && spptList.length > 0) {
        const cleanNop = nopPbb.replace(/[^0-9]/g, '');
        const match = spptList.find(s => s.nop.replace(/[^0-9]/g, '') === cleanNop);
        if (match) {
          const lkAccount = KEPLING_ACCOUNTS.find(a => a.nomorLingkungan === match.lingkungan);
          if (lkAccount) {
            setLingkunganId(lkAccount.id);
            // Optionally auto-fill street if empty
            if (!namaJalan && match.alamatOp) setNamaJalan(match.alamatOp.toUpperCase());
            return;
          }
        }
      }

      // 2. Try Street Match
      if (namaJalan && dataList.length > 0) {
        const street = namaJalan.toUpperCase();
        const sameStreet = dataList.filter(k => k.namaJalan?.toUpperCase() === street && k.lingkunganNomor);
        if (sameStreet.length > 0) {
          const lkCounts: Record<number, number> = {};
          sameStreet.forEach(k => {
            lkCounts[k.lingkunganNomor] = (lkCounts[k.lingkunganNomor] || 0) + 1;
          });
          const mostFreqLk = Object.entries(lkCounts).sort((a, b) => b[1] - a[1])[0][0];
          const numLk = Number(mostFreqLk);
          const lkAccount = KEPLING_ACCOUNTS.find(a => a.nomorLingkungan === numLk);
          if (lkAccount) {
            setLingkunganId(lkAccount.id);
          }
        }
      }
    }
  }, [nopPbb, namaJalan, spptList, dataList, initialData]);

  const addAnggota = () => {
    setFormError(null);
    if (!tempAnggotaNama.trim()) {
      setFormError('Nama anggota keluarga wajib diisi.');
      return;
    }
    const newAnggota: AnggotaKeluarga = {
      id: `ang_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      nik: tempAnggotaNik.trim() || `127101${String(Date.now()).substring(0, 10)}`,
      nama: tempAnggotaNama.trim().toUpperCase(),
      hubunganKeluarga: tempAnggotaHub,
      jenisKelamin: tempAnggotaJk,
      usia: Number(tempAnggotaUsia) || 0,
      agama: tempAnggotaAgama || (agama as AgamaType) || 'Islam',
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
    setFormError(null);
    const primaryNik = (nikKk || nomorKk).trim();
    if (!primaryNik) {
      setFormError('NIK Kepala Keluarga (16 Digit) wajib diisi.');
      setActiveTab('UTAMA');
      return;
    }
    if (!namaKk.trim()) {
      setFormError('Nama Kepala Keluarga wajib diisi.');
      setActiveTab('UTAMA');
      return;
    }
    if (!namaJalan.trim()) {
      setFormError('Nama Jalan / Gang wajib diisi.');
      setActiveTab('UTAMA');
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
      id: initialData?.id || `kk_${primaryNik.replace(/[^0-9]/g, '') || Date.now()}`,
      nomorKk: (nomorKk || primaryNik).trim(),
      nikKepalaKeluarga: primaryNik,
      namaKepalaKeluarga: namaKk.trim().toUpperCase(),
      telepon: telepon.trim(),
      lingkunganId: targetKepling.id,
      lingkunganNomor: targetKepling.nomorLingkungan || 1,
      lingkunganNama: targetKepling.lingkungan,
      namaJalan: namaJalan.trim().toUpperCase(),
      nomorRumah: nomorRumah.trim().toUpperCase(),
      agama: agama,
      alamatLengkap: `${namaJalan.trim().toUpperCase()} ${nomorRumah.trim() ? `NO. ${nomorRumah.trim().toUpperCase()}` : ''}, ${targetKepling.lingkungan.toUpperCase()}, KELURAHAN MANGGA`,
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
      nopPbb: nopPbb.trim(),
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
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-[2rem] max-w-4xl w-full p-0 shadow-2xl flex flex-col max-h-[95vh] border border-slate-200 relative animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0 bg-slate-50/50 rounded-t-[2rem]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-inner">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">
                {initialData ? 'Perbarui Data Keluarga' : 'Daftarkan Keluarga Baru'}
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                <MapPin className="w-3 h-3" />
                <span>Kelurahan Mangga • Kec. Medan Tuntungan</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all border border-slate-200 shadow-xs cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector - More Modern */}
        <div className="px-6 pt-4 pb-2 shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner w-full sm:w-max">
            {[
              { id: 'UTAMA', label: '1. Profil Keluarga', icon: UserCheck, color: 'blue' },
              { id: 'ANGGOTA', label: `2. Anggota (${anggotaList.length})`, icon: Users, color: 'indigo' },
              { id: 'BANSOS', label: '3. Ekonomi & Bansos', icon: HeartHandshake, color: 'rose' },
              { id: 'SANITASI', label: '4. Sanitasi & Lingkungan', icon: Droplets, color: 'emerald' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? `bg-white text-${tab.color}-900 shadow-sm border border-${tab.color}-100`
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? (tab.id === 'UTAMA' ? 'text-blue-600' : tab.id === 'ANGGOTA' ? 'text-indigo-600' : tab.id === 'BANSOS' ? 'text-rose-600' : 'text-emerald-600') : ''}`} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Modal Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Inline Error Alert */}
          {formError && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs font-black text-rose-900">Ada kendala pada pengisian formulir:</div>
                <p className="text-[11px] text-rose-700 font-medium mt-0.5 leading-relaxed">{formError}</p>
              </div>
              <button type="button" onClick={() => setFormError(null)} className="text-rose-400 hover:text-rose-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="pb-4">
            <form onSubmit={handleSubmit} className="space-y-5">
          {/* TAB 1: DATA UTAMA */}
          {activeTab === 'UTAMA' && (
            <div className="space-y-6">
              {/* Identitas Dasar */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Identitas Utama Kepala Keluarga</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      NIK Kepala Keluarga (16 Digit) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 1271190811740002"
                      value={nikKk || nomorKk}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNikKk(val);
                        if (!nomorKk || nomorKk === nikKk) {
                          setNomorKk(val);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      Nomor Kartu Keluarga (KK / Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 1271010101230001"
                      value={nomorKk}
                      onChange={(e) => setNomorKk(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-indigo-700 mb-1">
                      Nomor Objek Pajak (NOP PBB)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 12.71.010.001.001-0001.0"
                      value={nopPbb}
                      onChange={(e) => setNopPbb(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <p className="text-[10px] text-indigo-500 mt-1 font-medium italic">
                      *Jika diisi, sistem akan otomatis mencocokkan Lingkungan berdasarkan data PBB.
                    </p>
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
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      Agama Kepala Keluarga *
                    </label>
                    <select
                      value={agama}
                      onChange={(e) => setAgama(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Islam">Islam</option>
                      <option value="Kristen Protestan">Kristen Protestan</option>
                      <option value="Katolik">Katolik</option>
                      <option value="Hindu">Hindu</option>
                      <option value="Buddha">Buddha</option>
                      <option value="Konghucu">Konghucu</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      Pekerjaan Utama
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Wiraswasta, Buruh, dsb."
                      value={pekerjaanKk}
                      onChange={(e) => setPekerjaanKk(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Alamat & Wilayah */}
              <div className="space-y-4 p-4 bg-blue-50/30 rounded-2xl border border-blue-100">
                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Informasi Domisili & Wilayah</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      Wilayah Lingkungan *
                    </label>
                    <select
                      value={lingkunganId}
                      onChange={(e) => setLingkunganId(e.target.value)}
                      disabled={isKepling}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      Status Kartu Keluarga *
                    </label>
                    <select
                      value={statusDomisili}
                      onChange={(e) => setStatusDomisili(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="KK Kelurahan Mangga (KTP/KK Setempat)">
                        KK Kelurahan Mangga (KTP/KK Setempat)
                      </option>
                      <option value="Bukan KK Mangga (Domisili Luar/Kontrak)">
                        Bukan KK Mangga (Domisili Luar/Kontrak)
                      </option>
                    </select>
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
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      No. Rumah
                    </label>
                    <input
                      type="text"
                      placeholder="No. 12A"
                      value={nomorRumah}
                      onChange={(e) => setNomorRumah(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-purple-950 mb-1">
                    Kewarganegaraan *
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
                        placeholder="Negara Asal / Paspor WNA"
                        value={negaraAsalWna}
                        onChange={(e) => setNegaraAsalWna(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-purple-50 border border-purple-300 text-xs font-bold text-purple-950"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ANGGOTA KELUARGA */}
          {activeTab === 'ANGGOTA' && (
            <div className="space-y-6">
              {/* List of members */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-700 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span>Daftar Anggota Keluarga Terdaftar</span>
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200">
                    {anggotaList.length} Orang
                  </span>
                </div>

                {anggotaList.length === 0 ? (
                  <div className="p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-300">
                      <Users className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-slate-400 font-medium">
                      Belum ada anggota keluarga ditambahkan.<br/>Gunakan formulir di bawah untuk menambah anggota.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {anggotaList.map((ang, i) => (
                      <div key={ang.id || i} className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-4 shadow-2xs group hover:border-blue-300 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs shrink-0">
                            {ang.jenisKelamin === 'L' ? 'L' : 'P'}
                          </div>
                          <div>
                            <div className="font-black text-slate-900 text-xs">
                              {ang.nama} <span className="ml-1 text-[10px] font-bold text-blue-600 uppercase tracking-tighter bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100">{ang.hubunganKeluarga}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              NIK: {maskNik(ang.nik)} • {ang.usia} Thn • {ang.pekerjaan}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAnggota(ang.id)}
                          className="p-2 rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                          title="Hapus Anggota"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Input Cepat Anggota */}
              <div className="p-5 bg-blue-900 rounded-2xl border border-blue-800 shadow-lg space-y-4">
                <div className="text-xs font-black text-blue-100 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>FORM TAMBAH ANGGOTA KELUARGA CEPAT</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-blue-300 uppercase">Nama Lengkap Anggota *</label>
                    <input
                      type="text"
                      placeholder="Masukkan Nama Sesuai KK"
                      value={tempAnggotaNama}
                      onChange={(e) => setTempAnggotaNama(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-blue-950/50 border border-blue-700 text-xs font-bold text-white placeholder:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-blue-300 uppercase">NIK Anggota (16 Digit)</label>
                    <input
                      type="text"
                      placeholder="1271xxxxxxxxxxxx"
                      value={tempAnggotaNik}
                      onChange={(e) => setTempAnggotaNik(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-blue-950/50 border border-blue-700 text-xs font-mono font-bold text-white placeholder:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-blue-300 uppercase">Hubungan</label>
                    <select
                      value={tempAnggotaHub}
                      onChange={(e) => setTempAnggotaHub(e.target.value as HubunganKeluargaType)}
                      className="w-full px-3 py-2.5 rounded-xl bg-blue-950/50 border border-blue-700 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="Kepala Keluarga">Kepala Keluarga</option>
                      <option value="Istri">Istri</option>
                      <option value="Anak">Anak</option>
                      <option value="Orang Tua">Orang Tua</option>
                      <option value="Mertua">Mertua</option>
                      <option value="Famili Lain">Famili Lain</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-blue-300 uppercase">J. Kelamin</label>
                    <select
                      value={tempAnggotaJk}
                      onChange={(e) => setTempAnggotaJk(e.target.value as 'L' | 'P')}
                      className="w-full px-3 py-2.5 rounded-xl bg-blue-950/50 border border-blue-700 text-xs font-bold text-white"
                    >
                      <option value="L">Laki-Laki</option>
                      <option value="P">Perempuan</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-blue-300 uppercase">Usia (Thn)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={tempAnggotaUsia}
                      onChange={(e) => setTempAnggotaUsia(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2.5 rounded-xl bg-blue-950/50 border border-blue-700 text-xs font-bold text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-blue-300 uppercase">Pekerjaan</label>
                    <input
                      type="text"
                      placeholder="Contoh: Pelajar"
                      value={tempAnggotaPekerjaan}
                      onChange={(e) => setTempAnggotaPekerjaan(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-blue-950/50 border border-blue-700 text-xs font-bold text-white placeholder:text-blue-400"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addAnggota}
                  className="w-full py-3 bg-white text-blue-900 rounded-xl text-xs font-black hover:bg-blue-50 transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambahkan Anggota Ke Dalam Daftar</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DESIL & BANSOS */}
          {activeTab === 'BANSOS' && (
            <div className="space-y-6">
              {kewarganegaraan === 'WNA' ? (
                <div className="p-6 bg-purple-50 rounded-2xl border border-purple-200 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-white border border-purple-200 flex items-center justify-center mx-auto text-purple-600">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-purple-900">Status Warga Negara Asing (WNA)</h4>
                    <p className="text-xs text-purple-600 font-medium max-w-xs mx-auto">
                      Data Desil Kesejahteraan dan Program Bantuan Sosial tidak berlaku untuk WNA.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-5 bg-rose-50/50 rounded-2xl border border-rose-200 space-y-4">
                    <div className="flex items-center gap-2 text-rose-900">
                      <BarChart3 className="w-4 h-4" />
                      <label className="block text-xs font-black uppercase tracking-wider">
                        Tingkat Kesejahteraan (Desil) *
                      </label>
                    </div>
                    <select
                      value={desil}
                      onChange={(e) => setDesil(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-rose-200 text-xs font-black text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-2xs"
                    >
                      <option value="">-- Pilih Kategori Desil --</option>
                      <option value="Desil 1">Desil 1 (Sangat Miskin)</option>
                      <option value="Desil 2">Desil 2 (Miskin)</option>
                      <option value="Desil 3">Desil 3 (Hampir Miskin)</option>
                      <option value="Desil 4">Desil 4 (Rentan Miskin)</option>
                      <option value="Desil 5">Desil 5 (Menengah Bawah)</option>
                      <option value="Desil 6-10">Desil 6-10 (Mampu / Non-Desil)</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-700">
                      <HeartHandshake className="w-4 h-4 text-rose-500" />
                      <label className="block text-xs font-black uppercase tracking-wider">
                        Program Bantuan Sosial Aktif
                      </label>
                    </div>
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
                            className={`flex items-center justify-between p-3.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer text-left ${
                              isChecked
                                ? program === 'PKH Medan Makmur'
                                  ? 'bg-purple-600 border-purple-600 text-white shadow-md scale-[1.02]'
                                  : 'bg-emerald-600 border-emerald-600 text-white shadow-md scale-[1.02]'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-rose-200 hover:bg-rose-50/30'
                            }`}
                          >
                            <span>{program}</span>
                            {isChecked ? (
                              <CheckCircle className="w-4 h-4 text-white" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-300" />
                            )}
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
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900 font-black text-xs uppercase tracking-wider">
                    <Droplets className="w-4 h-4" />
                    <span>Sanitasi & Jamban</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase">Kepemilikan Jamban *</label>
                      <select
                        value={jamban}
                        onChange={(e) => setJamban(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-emerald-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">-- Pilih Status --</option>
                        <option value="Jamban Sendiri (Leher Angsa / Septik SNI)">Jamban Sendiri (Septik SNI)</option>
                        <option value="Jamban Bersama / Komunal">Jamban Bersama / Komunal</option>
                        <option value="Jamban Cemplung / Plengsengan">Jamban Cemplung</option>
                        <option value="Tidak Memiliki Jamban (BABS)">Tidak Memiliki (BABS)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase">Pembuangan Akhir Tinja</label>
                      <select
                        value={tempatTinja}
                        onChange={(e) => setTempatTinja(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-emerald-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">-- Pilih Status --</option>
                        <option value="Tangki Septik / SPALD">Tangki Septik / SPALD</option>
                        <option value="Saluran Terbuka / Parit">Saluran Terbuka / Parit</option>
                        <option value="Lubang Tanah / Lainnya">Lubang Tanah / Lainnya</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3">
                  <div className="flex items-center gap-2 text-blue-900 font-black text-xs uppercase tracking-wider">
                    <Droplets className="w-4 h-4 text-blue-500" />
                    <span>Sumber Air Utama</span>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-blue-700 uppercase">Air Minum Utama *</label>
                      <select
                        value={airMinum}
                        onChange={(e) => setAirMinum(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-blue-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Pilih Status --</option>
                        <option value="PDAM / Air Perpipaan">PDAM / Air Perpipaan</option>
                        <option value="Depot Isi Ulang">Depot Air Isi Ulang</option>
                        <option value="Air Kemasan Bermerek">Air Kemasan Bermerek</option>
                        <option value="Sumur Bor Terlindungi">Sumur Bor Terlindungi</option>
                        <option value="Sumur Gali">Sumur Gali</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-blue-700 uppercase">Air Bersih (Cuci/Mandi)</label>
                      <select
                        value={airBersih}
                        onChange={(e) => setAirBersih(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-blue-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Pilih Status --</option>
                        <option value="PDAM Tirtanadi">PDAM Tirtanadi</option>
                        <option value="Sumur Bor Listrik">Sumur Bor Listrik</option>
                        <option value="Sumur Gali">Sumur Gali</option>
                        <option value="Sungai / Lainnya">Sungai / Lainnya</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-tight flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Pengelolaan Sampah</span>
                  </label>
                  <select
                    value={sampah}
                    onChange={(e) => setSampah(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Cara Pengelolaan --</option>
                    <option value="Diangkut Petugas / WRS">Diangkut Petugas / WRS</option>
                    <option value="Bank Sampah / Daur Ulang">Bank Sampah Mandiri</option>
                    <option value="Dibakar / Ditimbun Mandiri">Dibakar / Ditimbun</option>
                    <option value="Dibuang Sembarangan">Dibuang Sembarangan</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-amber-700 uppercase tracking-tight flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Status Kesehatan (Stunting)</span>
                  </label>
                  <select
                    value={stunting}
                    onChange={(e) => setStunting(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-black text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Status Kesehatan --</option>
                    <option value="Bebas Risiko Stunting">Bebas Risiko Stunting</option>
                    <option value="Ada Balita / Baduta Berisiko Stunting">Ada Balita Berisiko Stunting</option>
                    <option value="Ada Ibu Hamil KEK / Resti">Ada Ibu Hamil KEK / Resti</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>

        {/* Modal Footer */}
        <div className="px-6 py-5 border-t border-slate-100 shrink-0 bg-slate-50/50 rounded-b-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>Data akan disimpan aman di server terenkripsi</span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-6 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-600 font-black text-xs transition-all border border-slate-200 cursor-pointer shadow-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              onClick={handleSubmit}
              className="flex-1 sm:flex-none px-8 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-xs shadow-lg shadow-slate-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer border border-black group"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span>{initialData ? 'Simpan Perubahan' : 'Daftarkan Keluarga'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
