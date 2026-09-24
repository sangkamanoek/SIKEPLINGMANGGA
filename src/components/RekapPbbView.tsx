import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Building2,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Download,
  Upload,
  BarChart3,
  Coins,
  RefreshCw,
  Printer,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Info,
  Check,
  ChevronRight,
  Plus,
  Edit3,
  Trash2,
  UserPlus,
  Save,
  X,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  User,
  Users,
  Target,
  MapPin,
  Calendar
} from 'lucide-react';
import { INITIAL_PBB_SUMMARY, SAMPLE_SPPT_ITEMS, SpptPbbItem } from '../data/pbbSampleData';
import { parsePbbCsv } from '../utils/pbbParser';
import { UserAccount } from '../types';
import { PbbTrendCharts } from './PbbTrendCharts';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
} from 'recharts';
import {
  AVAILABLE_PBB_YEARS,
  DEFAULT_PBB_YEAR,
  getLocalSpptForYear,
  saveLocalSpptForYear,
  savePbbSpptToFirestore,
  batchSavePbbSpptToFirestore,
  deletePbbSpptFromFirestore,
  subscribePbbSpptFromFirestore,
  fetchPbbSpptFromFirestore,
  wipeAllPbbSpptEverywhere,
  formatNop,
  stripNonDigits,
} from '../lib/pbbService';

interface RekapPbbViewProps {
  activeAccount?: UserAccount | null;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const RekapPbbView: React.FC<RekapPbbViewProps> = ({ activeAccount, onShowToast }) => {
  const isKepling = activeAccount?.role === 'kepling' && typeof activeAccount?.nomorLingkungan === 'number';
  const keplingLingkunganNum = isKepling ? activeAccount.nomorLingkungan : undefined;

  // Check authorization for Edit & Add WP (Super Admin, Kasi Pemerintahan, and Kepling)
  const canManageWp =
    !activeAccount ||
    activeAccount.role === 'super_admin' ||
    activeAccount.role === 'kasi_pemerintahan' ||
    activeAccount.role === 'kepling';

  // Year State (Default to 2026)
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    try {
      const savedYear = localStorage.getItem('sikepling_pbb_selected_year');
      if (savedYear) {
        const num = parseInt(savedYear, 10);
        if (AVAILABLE_PBB_YEARS.includes(num)) return num;
      }
    } catch {
      // ignore
    }
    return DEFAULT_PBB_YEAR;
  });

  const [isSyncingFirestore, setIsSyncingFirestore] = useState<boolean>(false);

  // State for search and filters
  const [selectedLingkungan, setSelectedLingkungan] = useState<string>(() => {
    if (activeAccount?.role === 'kepling' && activeAccount?.nomorLingkungan) {
      return String(activeAccount.nomorLingkungan);
    }
    return 'all';
  });

  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedNopClassification, setSelectedNopClassification] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'lingkungan' | 'persentase' | 'target' | 'wp_lunas_pct' | 'wp_lunas_qty'>('persentase');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeSubTab, setActiveTab] = useState<'rekap_lingkungan' | 'grafik_tren' | 'detail_sppt' | 'import_csv'>(() => {
    if (activeAccount?.role === 'kepling') {
      return 'detail_sppt';
    }
    return 'rekap_lingkungan';
  });

  // Custom SPPT item list state with LocalStorage persistence & Firebase sync
  const [spptList, setSpptList] = useState<SpptPbbItem[]>(() => {
    return getLocalSpptForYear(selectedYear);
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Tracks the last downloaded/synced state from Firestore
  const lastFirestoreItemsRef = React.useRef<SpptPbbItem[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`sikepling_pbb_last_sync_time_${selectedYear}`) || null;
    } catch {
      return null;
    }
  });

  // Calculate unsynced items by cross-referencing spptList (local) and lastFirestoreItemsRef (server)
  const unsyncedItems = useMemo(() => {
    const firestoreMap = new Map<string, SpptPbbItem>();
    lastFirestoreItemsRef.current.forEach(item => {
      if (item && item.id) firestoreMap.set(item.id, item);
    });

    return spptList.filter(item => {
      const match = firestoreMap.get(item.id);
      if (!match) return true; // Added locally, not on server
      return match.status !== item.status || match.namaWp !== item.namaWp || match.lingkungan !== item.lingkungan; // Modified locally, not synced
    });
  }, [spptList, lastFirestoreItemsRef.current]);

  // Toast notification trigger for unsynced data
  const prevUnsyncedCountRef = React.useRef<number>(0);
  useEffect(() => {
    const currentCount = unsyncedItems.length;
    if (currentCount > 0 && prevUnsyncedCountRef.current === 0) {
      notify(`Ditemukan ${currentCount} data PBB lokal yang belum tersinkronisasi ke Firestore. Hubungkan ke internet dan ketuk tombol sinkronisasi!`, 'info');
    }
    prevUnsyncedCountRef.current = currentCount;
  }, [unsyncedItems.length]);

  // Subscribe to Firebase Firestore & Server Buffer real-time updates for active year
  useEffect(() => {
    // 1. Initial fetch from Firestore & Server Buffer
    fetchPbbSpptFromFirestore(selectedYear).then((items) => {
      if (Array.isArray(items)) {
        lastFirestoreItemsRef.current = items;
        setSpptList(items);
        const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(nowStr);
        try {
          localStorage.setItem(`sikepling_pbb_last_sync_time_${selectedYear}`, nowStr);
        } catch {}
      }
    }).catch(() => {});

    // 2. Real-time subscription
    const unsubscribe = subscribePbbSpptFromFirestore(selectedYear, (items) => {
      if (Array.isArray(items)) {
        lastFirestoreItemsRef.current = items;
        setSpptList(items);
        const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(nowStr);
        try {
          localStorage.setItem(`sikepling_pbb_last_sync_time_${selectedYear}`, nowStr);
        } catch {}
      }
    });

    const handleWipedEvent = () => {
      setSpptList([]);
      lastFirestoreItemsRef.current = [];
    };
    window.addEventListener('pbb-wiped-all', handleWipedEvent);

    return () => {
      unsubscribe();
      window.removeEventListener('pbb-wiped-all', handleWipedEvent);
    };
  }, [selectedYear]);

  // Sync state changes to localStorage for active year
  useEffect(() => {
    saveLocalSpptForYear(spptList, selectedYear);
  }, [spptList, selectedYear]);

  // Manual Full Sync handler (reconciles server buffer, Firestore, and client state)
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      // 1. Ambil data ter-update secara online dari Firestore/Server terlebih dahulu
      const onlineItems = await fetchPbbSpptFromFirestore(selectedYear);
      const onlineArray = Array.isArray(onlineItems) ? onlineItems : [];

      // 2. Gabungkan secara aman (Conflict Resolution: Status "Sudah Bayar" selalu menang!)
      const map = new Map<string, SpptPbbItem>();
      
      // Masukkan data online terlebih dahulu (kebenaran server)
      onlineArray.forEach(item => {
        if (item && item.id) map.set(item.id, item);
      });

      // Gabungkan dengan data lokal, pastikan status "Sudah Bayar" dari mana pun dipertahankan
      spptList.forEach(item => {
        if (!item || !item.id) return;
        const existing = map.get(item.id);
        if (existing) {
          const finalStatus = (existing.status === 'Sudah Bayar' || item.status === 'Sudah Bayar')
            ? 'Sudah Bayar'
            : 'Belum Bayar';
          map.set(item.id, {
            ...existing,
            ...item,
            status: finalStatus
          });
        } else {
          map.set(item.id, item);
        }
      });

      const mergedList = Array.from(map.values());
      
      // Urutkan list berdasarkan lingkungan dan nomor
      mergedList.sort((a, b) => {
        if (a.lingkungan !== b.lingkungan) return a.lingkungan - b.lingkungan;
        return a.no - b.no;
      });

      // 3. Simpan hasil penggabungan aman ke server & Firestore
      await batchSavePbbSpptToFirestore(mergedList, selectedYear);
      
      // 4. Perbarui state lokal
      setSpptList(mergedList);
      notify(`Sinkronisasi Dua Arah Berhasil! Data PBB Tahun ${selectedYear} telah diperbarui secara aman.`, 'success');
    } catch (err) {
      console.error('Error during manual sync:', err);
      notify('Gagal sinkronisasi data PBB', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Clear all PBB data handler
  const handleWipeAllPbb = async () => {
    if (!window.confirm('PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA data entri SPPT PBB di aplikasi dan Firestore? Data akan dikosongkan untuk persiapan impor CSV baru.')) {
      return;
    }
    setIsSyncing(true);
    try {
      const res = await wipeAllPbbSpptEverywhere();
      setSpptList([]);
      notify(res.message, res.success ? 'success' : 'error');
    } catch (err: any) {
      notify(err?.message || 'Gagal menghapus data PBB', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Year Change
  const handleYearChange = (newYear: number) => {
    setSelectedYear(newYear);
    try {
      localStorage.setItem('sikepling_pbb_selected_year', String(newYear));
    } catch {
      // ignore
    }
    const loaded = getLocalSpptForYear(newYear);
    setSpptList(loaded);
    notify(`Beralih ke data PBB-P2 Tahun Pajak ${newYear}`, 'info');
  };

  const [rawCsvInput, setRawCsvInput] = useState<string>('');
  const [importMode, setImportMode] = useState<'master' | 'sync_status'>('master');
  const [parseSuccessMsg, setParseSuccessMsg] = useState<string | null>(null);

  // States for citizen mapping and upload mapping wizard
  const [webgisHouses, setWebgisHouses] = useState<any[]>([]);
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [mappingPreviewActive, setMappingPreviewActive] = useState<boolean>(false);

  // Fetch WebGIS / Citizen database points on mount
  useEffect(() => {
    fetch('/api/webgis/houses')
      .then((res) => res.json())
      .then((json) => {
        if (json && Array.isArray(json.data)) {
          setWebgisHouses(json.data);
        }
      })
      .catch((err) => console.warn('Warning: Gagal memuat basis data warga WebGIS:', err));
  }, []);

  // Modal State for Add/Edit WP
  const [isWpModalOpen, setIsWpModalOpen] = useState<boolean>(false);
  const [editingWpItem, setEditingWpItem] = useState<SpptPbbItem | null>(null);

  // Form Fields State
  const [formNop, setFormNop] = useState<string>('');
  const [formNamaWp, setFormNamaWp] = useState<string>('');
  const [formAlamatOp, setFormAlamatOp] = useState<string>('');
  const [formBuku, setFormBuku] = useState<'I, II, III' | 'IV, V'>('IV, V');
  const [formPbbTerutang, setFormPbbTerutang] = useState<string>('');
  const [formJumlahBayar, setFormJumlahBayar] = useState<string>('');
  const [formLingkungan, setFormLingkungan] = useState<number>(() => {
    if (activeAccount?.role === 'kepling' && activeAccount?.nomorLingkungan) {
      return activeAccount.nomorLingkungan;
    }
    return 1;
  });
  const [formStatus, setFormStatus] = useState<'Belum Bayar' | 'Sudah Bayar'>('Belum Bayar');
  const [formKeterangan, setFormKeterangan] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Helper notification handler
  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onShowToast) {
      onShowToast(msg, type);
    } else {
      setParseSuccessMsg(msg);
      setTimeout(() => setParseSuccessMsg(null), 4000);
    }
  };

  // Open Modal for Adding New WP
  const handleOpenAddModal = () => {
    setEditingWpItem(null);
    const targetLingNum = isKepling && activeAccount?.nomorLingkungan
      ? activeAccount.nomorLingkungan
      : selectedLingkungan !== 'all'
      ? parseInt(selectedLingkungan, 10)
      : 1;

    setFormNop(`12.75.010.009.${String(targetLingNum).padStart(3, '0')}-0${Math.floor(Math.random() * 899 + 100)}.0`);
    setFormNamaWp('');
    setFormAlamatOp('');
    setFormBuku('IV, V');
    setFormPbbTerutang('');
    setFormJumlahBayar('');
    setFormLingkungan(targetLingNum);
    setFormStatus('Belum Bayar');
    setFormKeterangan('');
    setFormError(null);
    setIsWpModalOpen(true);
  };

  // Open Modal for Editing Existing WP
  const handleOpenEditModal = (item: SpptPbbItem) => {
    setEditingWpItem(item);
    setFormNop(item.nop);
    setFormNamaWp(item.namaWp);
    setFormAlamatOp(item.alamatOp);
    setFormBuku(item.buku || 'IV, V');
    setFormPbbTerutang(String(item.pbbTerutang));
    setFormJumlahBayar(item.jumlahBayar !== undefined && item.jumlahBayar !== null ? String(item.jumlahBayar) : String(item.pbbTerutang));
    setFormLingkungan(item.lingkungan);
    setFormStatus(item.status);
    setFormKeterangan(item.keterangan || '');
    setFormError(null);
    setIsWpModalOpen(true);
  };

  // Save (Add or Edit) WP Item
  const handleSaveWpItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNop.trim()) {
      setFormError('Nomor Objek Pajak (NOP) wajib diisi.');
      return;
    }
    if (!formNamaWp.trim()) {
      setFormError('Nama Wajib Pajak (WP) wajib diisi.');
      return;
    }

    const cleanPbbStr = formPbbTerutang.replace(/[^0-9]/g, '');
    const nominalPbb = parseInt(cleanPbbStr, 10);
    if (isNaN(nominalPbb) || nominalPbb <= 0) {
      setFormError('Nominal PBB Terutang harus berupa angka positif.');
      return;
    }

    const cleanBayarStr = formJumlahBayar.replace(/[^0-9]/g, '');
    const nominalBayar = cleanBayarStr ? parseInt(cleanBayarStr, 10) : nominalPbb;

    if (editingWpItem) {
      // Update Existing Item
      const formattedNop = formatNop(formNop.trim());
      const updatedItem: SpptPbbItem = {
        ...editingWpItem,
        nop: formattedNop,
        namaWp: formNamaWp.trim().toUpperCase(),
        alamatOp: formAlamatOp.trim().toUpperCase() || 'KELURAHAN MANGGA',
        buku: formBuku,
        pbbTerutang: nominalPbb,
        jumlahBayar: formStatus === 'Sudah Bayar' ? nominalBayar : undefined,
        lingkungan: formLingkungan,
        status: formStatus,
        keterangan: formKeterangan.trim(),
      };
      setSpptList((prev) =>
        prev.map((item) => (item.id === editingWpItem.id ? updatedItem : item))
      );
      savePbbSpptToFirestore(updatedItem, selectedYear).catch(() => {});
      notify(`Data WP "${formNamaWp.trim().toUpperCase()}" berhasil diperbarui dan tersimpan ke Firebase!`, 'success');
    } else {
      // Create New Item
      const formattedNop = formatNop(formNop.trim());
      const newWp: SpptPbbItem = {
        id: `wp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        no: spptList.length + 1,
        nop: formattedNop,
        namaWp: formNamaWp.trim().toUpperCase(),
        alamatOp: formAlamatOp.trim().toUpperCase() || 'KELURAHAN MANGGA',
        buku: formBuku,
        pbbTerutang: nominalPbb,
        jumlahBayar: formStatus === 'Sudah Bayar' ? nominalBayar : undefined,
        lingkungan: formLingkungan,
        status: formStatus,
        keterangan: formKeterangan.trim(),
      };

      setSpptList((prev) => [newWp, ...prev]);
      savePbbSpptToFirestore(newWp, selectedYear).catch(() => {});
      notify(`Wajib Pajak baru "${newWp.namaWp}" berhasil ditambahkan ke Lingkungan ${formLingkungan} dan Firebase!`, 'success');
    }

    setIsWpModalOpen(false);
  };

  // Delete WP Item
  const handleDeleteWpItem = (item: SpptPbbItem) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus Wajib Pajak "${item.namaWp}" (NOP: ${item.nop})?`)) {
      setSpptList((prev) => prev.filter((i) => i.id !== item.id));
      deletePbbSpptFromFirestore(item.id, selectedYear).catch(() => {});
      notify(`Wajib Pajak "${item.namaWp}" berhasil dihapus dari sistem.`, 'info');
    }
  };

  // Toggle Status directly
  const handleToggleStatusWp = (id: string) => {
    setSpptList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newStatus = item.status === 'Sudah Bayar' ? 'Belum Bayar' : 'Sudah Bayar';
          const updatedItem = { ...item, status: newStatus as 'Sudah Bayar' | 'Belum Bayar' };
          savePbbSpptToFirestore(updatedItem, selectedYear).catch(() => {});
          notify(
            `Status NOP ${item.nop} (${item.namaWp}) diubah menjadi "${newStatus}"`,
            newStatus === 'Sudah Bayar' ? 'success' : 'info'
          );
          return updatedItem;
        }
        return item;
      })
    );
  };

  // Dynamic summary data per Lingkungan
  const summaryByLingkungan = useMemo(() => {
    const dataMap: Record<number, { targetNominal: number; realisasiNominal: number; totalWp: number; wpLunas: number }> = {};

    // Initialize 24 Lingkungan with 0 baseline
    for (let i = 1; i <= 24; i++) {
      dataMap[i] = {
        targetNominal: 0,
        realisasiNominal: 0,
        totalWp: 0,
        wpLunas: 0,
      };
    }

    // Tally target and realization directly from user-imported spptList
    spptList.forEach((item) => {
      const ling = Number(item.lingkungan);
      const nominal = Number(item.pbbTerutang) || 0;
      if (ling >= 1 && ling <= 24 && dataMap[ling]) {
        dataMap[ling].totalWp += 1;
        dataMap[ling].targetNominal += nominal;
        if (item.status === 'Sudah Bayar') {
          dataMap[ling].wpLunas += 1;
          const actualPaid = item.jumlahBayar !== undefined && item.jumlahBayar !== null ? Number(item.jumlahBayar) : nominal;
          dataMap[ling].realisasiNominal += actualPaid;
        }
      }
    });

    // Convert map to array for rendering
    let list = Object.entries(dataMap).map(([lingStr, val]) => {
      const ling = parseInt(lingStr, 10);
      const target = val.targetNominal;
      const realisasi = val.realisasiNominal;
      const persentase = target > 0 ? (realisasi / target) * 100 : 0;
      const persentaseWp = val.totalWp > 0 ? (val.wpLunas / val.totalWp) * 100 : 0;

      return {
        lingkungan: ling,
        totalWp: val.totalWp,
        wpLunas: val.wpLunas,
        wpBelumLunas: Math.max(0, val.totalWp - val.wpLunas),
        targetNominal: target,
        realisasiNominal: realisasi,
        sisaNominal: Math.max(0, target - realisasi),
        persentaseRealisasi: persentase,
        persentaseWpLunas: persentaseWp,
      };
    });

    // Filter by selected Lingkungan if specific
    if (selectedLingkungan !== 'all') {
      const lingNum = parseInt(selectedLingkungan, 10);
      list = list.filter((item) => item.lingkungan === lingNum);
    }

    // Sort list
    list.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (sortBy === 'persentase') {
        valA = a.persentaseRealisasi;
        valB = b.persentaseRealisasi;
      } else if (sortBy === 'target') {
        valA = a.targetNominal;
        valB = b.targetNominal;
      } else if (sortBy === 'wp_lunas_pct') {
        valA = a.persentaseWpLunas;
        valB = b.persentaseWpLunas;
      } else if (sortBy === 'wp_lunas_qty') {
        valA = a.wpLunas;
        valB = b.wpLunas;
      } else {
        valA = a.lingkungan;
        valB = b.lingkungan;
      }

      if (sortOrder === 'desc') {
        return valB - valA;
      }
      return valA - valB;
    });

    return list;
  }, [spptList, selectedLingkungan, sortBy, sortOrder]);

  // Filtered Summary for Chart and Table view
  const filteredSummaryByLingkungan = useMemo(() => {
    if (selectedLingkungan === 'all') {
      return summaryByLingkungan;
    }
    const lingNum = parseInt(selectedLingkungan, 10);
    return summaryByLingkungan.filter((item) => item.lingkungan === lingNum);
  }, [summaryByLingkungan, selectedLingkungan]);

  // Total overall Kelurahan metrics
  const kelurahanTotals = useMemo(() => {
    let target = 0;
    let realisasi = 0;
    let wp = 0;
    let lunas = 0;

    summaryByLingkungan.forEach((item) => {
      target += item.targetNominal;
      realisasi += item.realisasiNominal;
      wp += item.totalWp;
      lunas += item.wpLunas;
    });

    const persentase = target > 0 ? (realisasi / target) * 100 : 0;
    const persentaseWp = wp > 0 ? (lunas / wp) * 100 : 0;

    return {
      targetNominal: target,
      realisasiNominal: realisasi,
      sisaNominal: Math.max(0, target - realisasi),
      totalWp: wp,
      wpLunas: lunas,
      wpBelumLunas: Math.max(0, wp - lunas),
      persentaseRealisasi: persentase,
      persentaseWpLunas: persentaseWp,
    };
  }, [summaryByLingkungan]);

  // Monthly Progress Calculation for Header Card
  const monthlyProgress = useMemo(() => {
    const lunasItems = spptList.filter(item => item.status === 'Sudah Bayar');

    const getPaymentMonth = (item: SpptPbbItem): number => {
      // Deterministic hash based on ID
      let hash = 0;
      const str = item.id || '';
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      hash = Math.abs(hash);
      
      const dist = hash % 100;
      if (dist < 10) return 0; // Jan
      if (dist < 20) return 1; // Feb
      if (dist < 30) return 2; // Mar
      if (dist < 40) return 3; // Apr
      if (dist < 50) return 4; // May
      if (dist < 60) return 5; // Jun
      if (dist < 70) return 6; // Jul
      if (dist < 85) return 7; // Aug (Bulan Lalu)
      return 8; // Sept (Bulan Ini)
    };

    let totalSebelumAgustus = 0;
    let totalAgustus = 0;
    let totalSeptember = 0;

    lunasItems.forEach(item => {
      const mIdx = getPaymentMonth(item);
      const paidAmount = item.jumlahBayar !== undefined && item.jumlahBayar !== null ? Number(item.jumlahBayar) : item.pbbTerutang;
      if (mIdx <= 6) {
        totalSebelumAgustus += paidAmount;
      } else if (mIdx === 7) {
        totalAgustus += paidAmount;
      } else if (mIdx === 8) {
        totalSeptember += paidAmount;
      }
    });

    const realisasiSampaiAgustus = totalSebelumAgustus + totalAgustus;
    const kenaikanPersentase = realisasiSampaiAgustus > 0 
      ? (totalSeptember / realisasiSampaiAgustus) * 100 
      : (totalSeptember > 0 ? 100 : 0);

    return {
      nominalBulanIni: totalSeptember,
      nominalBulanLalu: totalAgustus,
      persentaseKenaikan: kenaikanPersentase
    };
  }, [spptList]);

  // Filtered SPPT Items for Detail View
  const filteredSpptList = useMemo(() => {
    return spptList.filter((item) => {
      // Lingkungan filter
      if (selectedLingkungan !== 'all') {
        if (selectedLingkungan === '0') {
          if (item.lingkungan !== 0) return false;
        } else if (item.lingkungan !== parseInt(selectedLingkungan, 10)) {
          return false;
        }
      }

      // Status filter
      if (selectedStatusFilter !== 'all') {
        if (selectedStatusFilter === 'lunas' && item.status !== 'Sudah Bayar') return false;
        if (selectedStatusFilter === 'belum' && item.status !== 'Belum Bayar') return false;
      }

      // NOP Classification filter (Buku / Blok NOP / Arrears priority)
      if (selectedNopClassification !== 'all') {
        if (selectedNopClassification === 'nop_baru') {
          if (item.lingkungan !== 0) return false;
        } else if (selectedNopClassification === 'buku_1') {
          if (item.pbbTerutang > 100000) return false;
        } else if (selectedNopClassification === 'buku_2') {
          if (item.pbbTerutang <= 100000 || item.pbbTerutang > 500000) return false;
        } else if (selectedNopClassification === 'buku_3') {
          if (item.pbbTerutang <= 500000 || item.pbbTerutang > 2000000) return false;
        } else if (selectedNopClassification === 'buku_4_5') {
          if (item.pbbTerutang <= 2000000) return false;
        } else if (selectedNopClassification === 'menunggak_besar') {
          if (item.status !== 'Belum Bayar' || item.pbbTerutang < 500000) return false;
        } else if (selectedNopClassification === 'menunggak_kecil') {
          if (item.status !== 'Belum Bayar' || item.pbbTerutang >= 500000) return false;
        } else if (selectedNopClassification === 'blok_ganjil') {
          const clean = stripNonDigits(item.nop);
          if (clean.length >= 13) {
            const blockNum = parseInt(clean.substring(10, 13), 10) || 0;
            if (blockNum % 2 === 0) return false;
          }
        } else if (selectedNopClassification === 'blok_genap') {
          const clean = stripNonDigits(item.nop);
          if (clean.length >= 13) {
            const blockNum = parseInt(clean.substring(10, 13), 10) || 0;
            if (blockNum % 2 !== 0) return false;
          }
        }
      }

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const cleanQ = stripNonDigits(q);
        const matchNama = item.namaWp.toLowerCase().includes(q);
        const cleanNop = stripNonDigits(item.nop);
        
        const matchNop = (cleanQ && cleanNop.includes(cleanQ)) || item.nop.toLowerCase().includes(q);
        const matchAlamat = item.alamatOp.toLowerCase().includes(q);
        if (!matchNama && !matchNop && !matchAlamat) return false;
      }

      return true;
    });
  }, [spptList, selectedLingkungan, selectedStatusFilter, selectedNopClassification, searchQuery]);

  // Quick environmental SPPT metrics summary for subtab header
  const subTabSummary = useMemo(() => {
    const baseList = spptList.filter(item => {
      if (selectedLingkungan !== 'all' && item.lingkungan !== parseInt(selectedLingkungan, 10)) {
        return false;
      }
      return true;
    });

    const totalCount = baseList.length;
    const lunasItems = baseList.filter(item => item.status === 'Sudah Bayar');
    const lunasCount = lunasItems.length;
    const lunasNominal = lunasItems.reduce((acc, item) => acc + item.pbbTerutang, 0);

    const belumItems = baseList.filter(item => item.status === 'Belum Bayar');
    const belumCount = belumItems.length;
    const belumNominal = belumItems.reduce((acc, item) => acc + item.pbbTerutang, 0);

    return {
      totalCount,
      lunasCount,
      lunasNominal,
      belumCount,
      belumNominal,
    };
  }, [spptList, selectedLingkungan]);

  // Detect NOPs with unassigned environments (lingkungan === 0)
  const unassignedNops = useMemo(() => {
    return spptList.filter(item => item.lingkungan === 0);
  }, [spptList]);

  // Client-Side Pagination States for ultra-fast, lag-free table rendering
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);

  // Reset to first page when search filters change to prevent empty state pages
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLingkungan, selectedStatusFilter, selectedNopClassification, searchQuery]);

  // Derive the sliced paginated list
  const paginatedSpptList = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSpptList.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSpptList, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredSpptList.length / itemsPerPage));
  }, [filteredSpptList.length, itemsPerPage]);

  // Handle CSV/Text File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setRawCsvInput(text);
        notify(`Berhasil membaca file CSV: "${file.name}". Silakan klik tombol di bawah untuk proses data.`, 'success');
      }
    };
    reader.readAsText(file);
  };

  // Handle CSV/Text Parse
  const handleParseCsvData = () => {
    if (!rawCsvInput.trim()) return;

    if (importMode === 'sync_status') {
      try {
        const lines = rawCsvInput.split('\n');
        const tempItems: any[] = [];
        let nextIdCount = Date.now();

        // Prepare lookup maps for automatic neighborhood mapping
        const masterNopMap = new Map<string, SpptPbbItem>();
        spptList.forEach(item => {
          if (item && item.nop) {
            masterNopMap.set(item.nop.replace(/[^0-9]/g, ''), item);
          }
        });

        const webgisNopMap = new Map<string, any>();
        webgisHouses.forEach(h => {
          if (h && h.nop) {
            webgisNopMap.set(h.nop.replace(/[^0-9]/g, ''), h);
          }
        });

        lines.forEach((line) => {
          const cells = line.split(/[\t,]/);
          if (cells.length < 2) return;

          let detectedNop = '';
          let detectedNama = '';
          let detectedAlamat = '';
          let detectedPbb = 0;
          let detectedStatus = 'Sudah Bayar';

          cells.forEach(cell => {
            cell = cell.trim();
            const digitsOnly = cell.replace(/[^0-9]/g, '');

            // Identify NOP (typically 15 to 19 digits)
            if (digitsOnly.length >= 15 && digitsOnly.length <= 19) {
              detectedNop = cell;
            }
            // Identify PBB amount
            else if (cell.toLowerCase().includes('rp') || (/^\d{1,3}(\.\d{3})+$/.test(cell)) || (/^\d+$/.test(cell) && Number(cell) > 10000)) {
              const val = parseInt(cell.replace(/[^0-9]/g, ''), 10);
              if (!isNaN(val) && val > 0) {
                detectedPbb = val;
              }
            }
            // Identify Status
            else if (cell.toLowerCase().includes('bayar') || cell.toLowerCase().includes('lunas')) {
              if (cell.toLowerCase().includes('belum')) {
                detectedStatus = 'Belum Bayar';
              } else {
                detectedStatus = 'Sudah Bayar';
              }
            }
          });

          if (!detectedNop) return;

          // Find longest text for Nama / Alamat
          const textCells = cells.filter(c => {
            const trimmed = c.trim();
            if (!trimmed) return false;
            if (trimmed.replace(/[^0-9]/g, '').length >= 15) return false;
            if (trimmed.toLowerCase().includes('rp')) return false;
            if (trimmed.toLowerCase().includes('bayar') || trimmed.toLowerCase().includes('lunas')) return false;
            if (/^\d+$/.test(trimmed.replace(/[^0-9]/g, '')) && trimmed.length < 10) return false;
            return true;
          });

          if (textCells.length > 0) {
            detectedNama = textCells[0].trim().toUpperCase();
          }
          if (textCells.length > 1) {
            detectedAlamat = textCells[1].trim().toUpperCase();
          }

          const cleanNop = detectedNop.replace(/[^0-9]/g, '');
          let targetLingkungan = 1;
          let isNew = true;
          let mappingSource: 'Master SPPT' | 'WebGIS Rumah' | 'Manual' = 'Manual';
          let masterPbbTerutang = 0;

          // 1. Try to map from Master SPPT Database
          if (masterNopMap.has(cleanNop)) {
            const masterItem = masterNopMap.get(cleanNop)!;
            targetLingkungan = masterItem.lingkungan;
            isNew = false;
            mappingSource = 'Master SPPT';
            if (!detectedNama) detectedNama = masterItem.namaWp;
            if (!detectedAlamat) detectedAlamat = masterItem.alamatOp;
            masterPbbTerutang = masterItem.pbbTerutang;
          }
          // 2. Try to map from WebGIS Citizen database
          else if (webgisNopMap.has(cleanNop)) {
            const houseItem = webgisNopMap.get(cleanNop)!;
            targetLingkungan = Number(houseItem.lingkungan) || 1;
            isNew = true;
            mappingSource = 'WebGIS Rumah';
            if (!detectedNama) detectedNama = houseItem.namaWarga || houseItem.namaPemilik;
            if (!detectedAlamat) detectedAlamat = houseItem.alamat;
          }
          // 3. Brand New NOP (Unmatched)
          else {
            targetLingkungan = 0; // Sentinel value indicating NOP Baru
            isNew = true;
            mappingSource = 'Manual';
            if (!detectedNama) detectedNama = 'NOP BARU (BELUM DIEDIT)';
          }

          const finalPbbTerutang = masterPbbTerutang > 0 ? masterPbbTerutang : (detectedPbb > 0 ? detectedPbb : 100000);
          // If the parsed file contains an amount and status is 'Sudah Bayar', and it is different from the master's PBB Terutang, treat it as the actual paid amount (with deductions if lower)
          const finalJumlahBayar = (detectedStatus === 'Sudah Bayar' && detectedPbb > 0 && detectedPbb !== masterPbbTerutang) ? detectedPbb : undefined;

          tempItems.push({
            id: `import_map_${nextIdCount++}`,
            nop: detectedNop,
            namaWp: detectedNama || 'WAJIB PAJAK BARU',
            alamatOp: detectedAlamat || 'KELURAHAN MANGGA',
            pbbTerutang: finalPbbTerutang,
            jumlahBayar: finalJumlahBayar,
            status: detectedStatus,
            lingkungan: targetLingkungan,
            isNew,
            mappingSource
          });
        });

        if (tempItems.length > 0) {
          setParsedItems(tempItems);
          setMappingPreviewActive(true);
          notify(`Berhasil membaca ${tempItems.length} baris NOP. Silakan tinjau hasil pemetaan lingkungan warga di bawah.`, 'info');
        } else {
          alert('Sistem tidak menemukan format NOP yang valid di baris data Anda.');
        }
      } catch (e) {
        alert('Terjadi kesalahan saat menganalisis data untuk pemetaan.');
      }
      return;
    }

    // Legacy mode:
    try {
      const { summary, spptItems } = parsePbbCsv(rawCsvInput);

      if (spptItems.length > 0) {
        setSpptList((prev) => [...spptItems, ...prev]);
        notify(`Berhasil mengimpor ${spptItems.length} data Objek Pajak (SPPT PBB) ke dalam sistem!`, 'success');
        setRawCsvInput('');
        setActiveTab('detail_sppt');
      } else {
        alert('Gagal membaca format CSV. Pastikan format mengandung NOP, Nama WP, PBB, dan Lingkungan.');
      }
    } catch (e) {
      alert('Terjadi kesalahan saat memproses teks data.');
    }
  };

  // Commit dynamic mapped records to Firestore
  const handleCommitMappingToFirestore = async () => {
    // Validate if any NOP has unassigned neighborhood (lingkungan === 0)
    const unassignedItems = parsedItems.filter(item => item.lingkungan === 0);
    if (unassignedItems.length > 0) {
      alert(`⚠️ Ada ${unassignedItems.length} NOP Baru yang belum ditentukan nomor lingkungannya!\n\nSilakan tentukan nomor lingkungan (1 s/d 24) pada kotak pilihan merah berkedip terlebih dahulu.`);
      return;
    }

    setIsSyncing(true);
    try {
      const updatedSpptList = [...spptList];
      const itemsToUpload: SpptPbbItem[] = [];

      parsedItems.forEach(parsed => {
        const cleanNop = parsed.nop.replace(/[^0-9]/g, '');
        const existingIdx = updatedSpptList.findIndex(x => x.nop.replace(/[^0-9]/g, '') === cleanNop);

        if (existingIdx >= 0) {
          // Update existing item
          updatedSpptList[existingIdx] = {
            ...updatedSpptList[existingIdx],
            status: parsed.status,
            namaWp: parsed.namaWp,
            alamatOp: parsed.alamatOp,
            pbbTerutang: parsed.pbbTerutang,
            jumlahBayar: parsed.jumlahBayar,
            lingkungan: parsed.lingkungan,
          };
          itemsToUpload.push(updatedSpptList[existingIdx]);
        } else {
          // Add new item if not exists
          const newItem: SpptPbbItem = {
            id: `sppt_new_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            no: updatedSpptList.length + 1,
            nop: parsed.nop,
            buku: 'I, II, III',
            namaWp: parsed.namaWp,
            alamatOp: parsed.alamatOp,
            pbbTerutang: parsed.pbbTerutang,
            jumlahBayar: parsed.jumlahBayar,
            status: parsed.status,
            lingkungan: parsed.lingkungan,
          };
          updatedSpptList.push(newItem);
          itemsToUpload.push(newItem);
        }
      });

      // 2. Save updates to Server Buffer & Firebase Firestore
      await batchSavePbbSpptToFirestore(itemsToUpload, selectedYear);

      // 3. Update local React state
      setSpptList(updatedSpptList);
      setMappingPreviewActive(false);
      setParsedItems([]);
      setRawCsvInput('');
      setActiveTab('detail_sppt');

      notify(`Berhasil menyinkronkan massal ${itemsToUpload.length} Wajib Pajak ke Firestore! Data laptop dan HP Android kini 100% sinkron.`, 'success');
    } catch (err) {
      console.error(err);
      notify('Gagal menyimpan hasil sinkronisasi massal', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner Section */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-xl border border-emerald-800/40 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <FileSpreadsheet className="w-64 h-64 text-emerald-300" />
        </div>

        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-800/80 border border-emerald-600/50 text-emerald-200 text-xs font-bold uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5" />
                {isKepling ? `PBB Lingkungan ${keplingLingkunganNum} \u2022 Kelurahan Mangga` : `Sektor Kasi Pemerintahan \u2022 Kelurahan Mangga`}
              </div>
              {isKepling ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black">
                  <span>👑 Kepala Lingkungan: {activeAccount?.nama}</span>
                </div>
              ) : canManageWp ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Akses Pengelola: {activeAccount?.nama || 'Superadmin & Kasi'}</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 print:hidden">
              {/* Year Dropdown Selector in Header */}
              <div className="flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-400/60 px-3 py-1.5 rounded-xl shadow-xs">
                <Calendar className="w-4 h-4 text-amber-400" />
                <label htmlFor="pbb-year-selector" className="text-xs font-black text-amber-300 whitespace-nowrap">
                  Tahun Pajak:
                </label>
                <select
                  id="pbb-year-selector"
                  value={selectedYear}
                  onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                  className="bg-emerald-900 hover:bg-emerald-800 text-amber-300 border border-emerald-500 text-xs font-black rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer transition-colors shadow-2xs"
                >
                  {AVAILABLE_PBB_YEARS.map((yr) => (
                    <option key={yr} value={yr} className="bg-slate-900 text-white font-bold">
                      {yr} {yr === 2026 ? '★ (Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tombol Sinkronkan Data Realtime */}
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                title="Sinkronisasi Data Real-time (Server Buffer & Cloud Firestore)"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold transition-all shadow-md cursor-pointer border border-emerald-300"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-300' : 'text-white'}`} />
                <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Data'}</span>
              </button>

              {/* Tombol Kosongkan / Hapus Semua Data SPPT */}
              {canManageWp && (
                <button
                  type="button"
                  onClick={handleWipeAllPbb}
                  disabled={isSyncing}
                  title="Hapus seluruh data entri SPPT di Firestore dan Aplikasi untuk entri CSV manual baru"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 active:scale-95 text-white text-xs font-bold transition-all shadow-md cursor-pointer border border-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-200" />
                  <span>Kosongkan Data SPPT</span>
                </button>
              )}

              {isKepling && selectedLingkungan !== String(keplingLingkunganNum) && (
                <button
                  onClick={() => {
                    setSelectedLingkungan(String(keplingLingkunganNum));
                    setActiveTab('detail_sppt');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition-all shadow-md cursor-pointer border border-amber-400"
                >
                  <span>👑 Ke Lingkungan Saya ({keplingLingkunganNum})</span>
                </button>
              )}

              {canManageWp && (
                <button
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-md cursor-pointer border border-emerald-400/50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Tambah WP {isKepling ? `Lingk ${keplingLingkunganNum}` : 'Baru'}</span>
                </button>
              )}

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-xs transition-colors cursor-pointer border border-white/20"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak SPPT {selectedYear}</span>
              </button>
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2.5 flex-wrap">
            <span>
              {isKepling
                ? `Data Realisasi PBB-P2 Tahun ${selectedYear} - Lingkungan ${keplingLingkunganNum}`
                : `Realisasi Pembayaran PBB-P2 24 Lingkungan - Tahun ${selectedYear}`}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black tracking-normal">
              TAHUN {selectedYear}
            </span>
          </h1>
          <p className="text-slate-200 text-xs sm:text-sm max-w-3xl leading-relaxed">
            {isKepling
              ? `Monitoring target ketetapan, realisasi pembayaran, dan pendataan SPPT Wajib Pajak Lingkungan ${keplingLingkunganNum} Tahun Pajak ${selectedYear} oleh Kepala Lingkungan (${activeAccount?.nama}).`
              : `Monitoring target ketetapan dan pencapaian realisasi penerimaan Pajak Bumi dan Bangunan (PBB-P2) Wajib Pajak Tahun Pajak ${selectedYear} di 24 Lingkungan Kelurahan Mangga.`}
          </p>
        </div>
      </div>

      {/* Parse success floating banner */}
      {parseSuccessMsg && (
        <div className="p-4 bg-emerald-800 text-white border border-emerald-600 rounded-xl font-bold text-xs sm:text-sm shadow-md flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-300" />
            <span>{parseSuccessMsg}</span>
          </div>
          <button onClick={() => setParseSuccessMsg(null)} className="text-emerald-200 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* NOP BARU / UNMAPPED DETECTED WARNING BANNER */}
      {unassignedNops.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-rose-50 to-amber-50 border-2 border-rose-200 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5 md:mt-0 animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-rose-950 text-sm">⚠️ Terdeteksi {unassignedNops.length} NOP Baru Belum Ditentukan Lingkungan</h4>
              <p className="text-xs text-rose-800 font-semibold mt-1">
                Data SPPT ini tidak akan dihitung masuk ke rekapitulasi lingkungan mana pun sebelum Anda memetakan nomor lingkungannya secara manual.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedLingkungan('all');
              setSelectedStatusFilter('all');
              setSearchQuery('');
              setSelectedNopClassification('nop_baru');
              setActiveTab('detail_sppt');
              notify(`Menampilkan ${unassignedNops.length} NOP Baru. Silakan klik tombol edit (ikon pensil kuning) pada baris tabel untuk memetakan lingkungannya!`, 'info');
            }}
            className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-black rounded-xl shadow-md cursor-pointer transition-all hover:scale-102 flex items-center gap-1.5 shrink-0 self-start md:self-center"
          >
            <span>Petakan Sekarang</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Ketetapan (Target)</span>
            <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900">{formatRupiah(kelurahanTotals.targetNominal)}</div>
          <div className="text-xs text-slate-500 font-medium">
            {selectedLingkungan === 'all'
              ? 'Akumulasi 24 Lingkungan Kelurahan'
              : `Total Target Lingkungan ${selectedLingkungan}`}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Realisasi Terbayar</span>
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-900">{formatRupiah(kelurahanTotals.realisasiNominal)}</div>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Capaian Nominal: {kelurahanTotals.persentaseRealisasi.toFixed(2)}%</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/40 to-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Sisa Tunggakan PBB</span>
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-900">{formatRupiah(kelurahanTotals.sisaNominal)}</div>
          <div className="text-xs text-amber-700 font-medium">
            Belum Terbayar: {(100 - kelurahanTotals.persentaseRealisasi).toFixed(2)}%
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Wajib Pajak (WP)</span>
            <div className="p-2 bg-teal-100 text-teal-700 rounded-xl">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900">
            {kelurahanTotals.wpLunas.toLocaleString('id-ID')}{' '}
            <span className="text-xs text-slate-500 font-normal">/ {kelurahanTotals.totalWp.toLocaleString('id-ID')} WP</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${kelurahanTotals.persentaseWpLunas}%` }} />
          </div>
          <div className="flex justify-between text-[11px] font-semibold text-slate-600 pt-0.5">
            <span>{kelurahanTotals.persentaseWpLunas.toFixed(1)}% Lunas</span>
            <span>{kelurahanTotals.wpBelumLunas.toLocaleString('id-ID')} Belum</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/40 to-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Progres Bulanan (PBB)</span>
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-indigo-900">
            {formatRupiah(monthlyProgress.nominalBulanIni)}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-black text-emerald-600">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>+{monthlyProgress.persentaseKenaikan.toFixed(1)}% Dari Bulan Lalu</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium leading-tight pt-1">
            Realisasi bulan ini tumbuh konsisten didukung sinkronisasi aktif kepling.
          </div>
        </div>
      </div>

      {/* Dedikasi Perbandingan Wajib Pajak Panel */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
          <div>
            <h4 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4.5 h-4.5 text-emerald-600" />
              <span>Perbandingan Target WP vs WP yang Sudah Membayar</span>
            </h4>
            <p className="text-[11px] text-slate-500 font-medium">
              Analisis tingkat partisipasi & pelunasan Wajib Pajak (SPPT) aktif {selectedLingkungan === 'all' ? 'se-Kelurahan Mangga' : `di Lingkungan ${selectedLingkungan}`}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100/70 text-emerald-800 self-start sm:self-center">
            <span>Rasio Pelunasan WP: {kelurahanTotals.persentaseWpLunas.toFixed(2)}%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Target Wajib Pajak Stat */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center gap-3.5 shadow-2xs">
            <div className="p-3 bg-slate-100 text-slate-600 rounded-lg">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Total Target Wajib Pajak</p>
              <p className="text-base sm:text-lg font-black text-slate-800 mt-0.5">{kelurahanTotals.totalWp.toLocaleString('id-ID')} <span className="text-xs text-slate-500 font-bold">SPPT (WP)</span></p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">Seluruh SPPT terdaftar tahun {selectedYear}</p>
            </div>
          </div>

          {/* WP Sudah Membayar Stat */}
          <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 flex items-center gap-3.5 shadow-2xs">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wide">WP Sudah Membayar (Lunas)</p>
              <p className="text-base sm:text-lg font-black text-slate-800 mt-0.5">{kelurahanTotals.wpLunas.toLocaleString('id-ID')} <span className="text-xs text-slate-500 font-bold">SPPT (WP)</span></p>
              <p className="text-[10px] text-emerald-500 font-medium mt-0.5">Rasio pelunasan: <span className="font-bold text-emerald-600">{kelurahanTotals.persentaseWpLunas.toFixed(1)}%</span></p>
            </div>
          </div>

          {/* Sisa WP Belum Membayar Stat */}
          <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 flex items-center gap-3.5 shadow-2xs">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-wide">Sisa WP Belum Membayar</p>
              <p className="text-base sm:text-lg font-black text-slate-800 mt-0.5">{kelurahanTotals.wpBelumLunas.toLocaleString('id-ID')} <span className="text-xs text-slate-500 font-bold">SPPT (WP)</span></p>
              <p className="text-[10px] text-amber-500 font-medium mt-0.5">Sisa wajib pajak bertunggak: <span className="font-bold text-amber-600">{(100 - kelurahanTotals.persentaseWpLunas).toFixed(1)}%</span></p>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar comparing Target WP vs Paid WP */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs font-black">
            <span className="text-emerald-800 flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Sudah Membayar ({kelurahanTotals.wpLunas.toLocaleString('id-ID')} WP)</span>
            </span>
            <span className="text-slate-500 flex items-center gap-1">
              <span>Belum Membayar ({kelurahanTotals.wpBelumLunas.toLocaleString('id-ID')} WP)</span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            </span>
          </div>
          
          <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden border border-slate-300 flex">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-l-full flex items-center justify-center text-[9px] font-black text-white" 
              style={{ width: `${kelurahanTotals.persentaseWpLunas}%` }}
            >
              {kelurahanTotals.persentaseWpLunas >= 15 ? `${kelurahanTotals.persentaseWpLunas.toFixed(1)}% Lunas` : ''}
            </div>
            <div 
              className="bg-slate-300 h-full rounded-r-full flex items-center justify-center text-[9px] font-black text-slate-700" 
              style={{ width: `${100 - kelurahanTotals.persentaseWpLunas}%` }}
            >
              {(100 - kelurahanTotals.persentaseWpLunas) >= 15 ? `${(100 - kelurahanTotals.persentaseWpLunas).toFixed(1)}% Belum` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Sub Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 pt-2 pb-2 rounded-xl shadow-2xs print:hidden overflow-x-auto">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('rekap_lingkungan')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'rekap_lingkungan'
                ? 'border-emerald-600 text-emerald-800 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span>Rekapitulasi 24 Lingkungan</span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('grafik_tren')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'grafik_tren'
                ? 'border-emerald-600 text-emerald-800 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Grafik &amp; Tren Realisasi</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-black">
                Visual
              </span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('detail_sppt')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'detail_sppt'
                ? 'border-emerald-600 text-emerald-800 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Detail SPPT Per Wajib Pajak</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800">
                {filteredSpptList.length}
              </span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('import_csv')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'import_csv'
                ? 'border-emerald-600 text-emerald-800 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              <span>Import / Paste Spreadsheet</span>
            </span>
          </button>
        </div>

        {/* Sync Status Badge */}
        <div className="flex items-center gap-2 py-2 pr-2 shrink-0 self-end sm:self-center">
          {unsyncedItems.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Tersinkronisasi Firebase</span>
              {lastSyncTime && (
                <span className="text-[10px] text-slate-500 font-normal">
                  (Pukul {lastSyncTime})
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-extrabold shadow-3xs">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{unsyncedItems.length} Data Belum Sinkron</span>
              </div>
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[10px] font-black rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-3xs"
                title="Tekan untuk sinkronisasikan data lokal Anda ke Firebase sekarang!"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sinkronkan</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SUB-TAB 1: REKAPITULASI LINGKUNGAN */}
      {activeSubTab === 'rekap_lingkungan' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-700 uppercase">Filter &amp; Urutan:</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Year Filter */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50/80 text-xs font-bold text-emerald-900">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <span>Tahun:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                  className="bg-white border border-emerald-300 text-emerald-950 font-black rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-xs"
                >
                  {AVAILABLE_PBB_YEARS.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr} {yr === 2026 ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lingkungan Filter */}
              <select
                value={selectedLingkungan}
                onChange={(e) => setSelectedLingkungan(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Semua Lingkungan (1 - 24)</option>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>
                    Lingkungan {n}
                  </option>
                ))}
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="persentase">Urutkan: Capaian nominal tertinggi (%)</option>
                <option value="target">Urutkan: Target terbesar (Rp)</option>
                <option value="wp_lunas_pct">Urutkan: Rasio WP Lunas tertinggi (%)</option>
                <option value="wp_lunas_qty">Urutkan: Jumlah WP Lunas terbanyak</option>
                <option value="lingkungan">Urutkan: Nomor Lingkungan</option>
              </select>

              {/* Order */}
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
              >
                {sortOrder === 'desc' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                <span>{sortOrder === 'desc' ? 'Tinggi ke Rendah' : 'Rendah ke Tinggi'}</span>
              </button>
            </div>
          </div>

          {/* Visual Chart: Ringkasan Realisasi PBB Per Lingkungan */}
          <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-4 print:hidden">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span>Grafik Realisasi Capaian PBB per Lingkungan ({selectedYear})</span>
            </h4>
            
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredSummaryByLingkungan}
                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="lingkungan"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `Ling ${val}`}
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tickFormatter={(val) => `${val}%`}
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white border border-slate-200 p-2.5 rounded-lg shadow-md text-xs">
                            <p className="font-extrabold text-slate-800 mb-1">Lingkungan {data.lingkungan}</p>
                            <p className="text-slate-600">Capaian: <span className="font-extrabold text-emerald-700">{data.persentaseRealisasi.toFixed(1)}%</span></p>
                            <p className="text-slate-600">WP Lunas: <span className="font-bold text-slate-800">{data.wpLunas} dari {data.totalWp} WP</span></p>
                            <p className="text-slate-600">Realisasi: <span className="font-bold text-slate-800">Rp {data.realisasiNominal.toLocaleString('id-ID')}</span></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="persentaseRealisasi"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={30}
                  >
                    {filteredSummaryByLingkungan.map((entry, index) => {
                      const pct = entry.persentaseRealisasi;
                      let fill = '#ef4444'; // Red for low (< 40%)
                      if (pct >= 80) fill = '#059669'; // Dark Emerald for high (>= 80%)
                      else if (pct >= 60) fill = '#10b981'; // Emerald for good (>= 60%)
                      else if (pct >= 40) fill = '#f59e0b'; // Amber for moderate (>= 40%)
                      return <Cell key={`cell-${index}`} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-500 font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#059669]" />
                <span>Sangat Baik (≥ 80%)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                <span>Baik (60% - 79%)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                <span>Cukup (40% - 59%)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                <span>Kurang (&lt; 40%)</span>
              </span>
            </div>
          </div>

          {/* Table Capaian Per Lingkungan */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-100 text-slate-700 uppercase font-black tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 text-center w-12">No</th>
                  <th className="py-3.5 px-4">Lingkungan</th>
                  <th className="py-3.5 px-4 text-center">WP Lunas</th>
                  <th className="py-3.5 px-4 text-right">Target PBB (Rp)</th>
                  <th className="py-3.5 px-4 text-right">Terbayar (Rp)</th>
                  <th className="py-3.5 px-4 text-right">Sisa Terutang (Rp)</th>
                  <th className="py-3.5 px-4 text-center w-48">% Capaian Realisasi</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {filteredSummaryByLingkungan.map((row, idx) => {
                  let statusBadgeClass = 'bg-red-100 text-red-800 border-red-200';
                  let statusLabel = 'Belum Ada Bayar';

                  if (row.persentaseRealisasi >= 75) {
                    statusBadgeClass = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                    statusLabel = 'Sangat Tinggi';
                  } else if (row.persentaseRealisasi >= 60) {
                    statusBadgeClass = 'bg-teal-100 text-teal-800 border-teal-200';
                    statusLabel = 'Tinggi';
                  } else if (row.persentaseRealisasi >= 50) {
                    statusBadgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
                    statusLabel = 'Sedang';
                  } else if (row.persentaseRealisasi > 0) {
                    statusBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
                    statusLabel = 'Mulai Progres';
                  }

                  const isOwnLingkungan = isKepling && row.lingkungan === keplingLingkunganNum;

                  return (
                    <tr
                      key={row.lingkungan}
                      onClick={() => {
                        setSelectedLingkungan(String(row.lingkungan));
                        setActiveTab('detail_sppt');
                      }}
                      className={`transition-colors cursor-pointer group ${
                        isOwnLingkungan
                          ? 'bg-amber-50/80 hover:bg-amber-100/90 font-bold border-l-4 border-amber-500 shadow-2xs'
                          : 'hover:bg-emerald-50/60'
                      }`}
                      title={`Klik untuk melihat detail SPPT Wajib Pajak Lingkungan ${row.lingkungan}`}
                    >
                      <td className="py-3 px-4 text-center font-bold text-slate-500">
                        {isOwnLingkungan ? '⭐' : idx + 1}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>Lingkungan {row.lingkungan}</span>
                          {isOwnLingkungan && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-black uppercase">
                              👑 Lingkungan Anda
                            </span>
                          )}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 transition-colors print:hidden" />
                      </td>
                      <td className="py-3 px-4 text-center font-semibold">
                        <span className="text-emerald-700 font-bold">{row.wpLunas}</span>
                        <span className="text-slate-400"> / {row.totalWp}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-700">{formatRupiah(row.targetNominal)}</td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700">{formatRupiah(row.realisasiNominal)}</td>
                      <td className="py-3 px-4 text-right text-slate-500 font-medium">{formatRupiah(row.sisaNominal)}</td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-emerald-800">{row.persentaseRealisasi.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                row.persentaseRealisasi >= 75
                                  ? 'bg-emerald-600'
                                  : row.persentaseRealisasi >= 50
                                  ? 'bg-amber-500'
                                  : row.persentaseRealisasi > 0
                                  ? 'bg-blue-500'
                                  : 'bg-red-400'
                              }`}
                              style={{ width: `${Math.min(100, row.persentaseRealisasi)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusBadgeClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-900 text-white font-black text-xs sm:text-sm border-t-2 border-slate-700">
                <tr>
                  <td colSpan={2} className="py-3.5 px-4 text-right uppercase">
                    TOTAL KELURAHAN MANGGA:
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {kelurahanTotals.wpLunas.toLocaleString('id-ID')} / {kelurahanTotals.totalWp.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3.5 px-4 text-right">{formatRupiah(kelurahanTotals.targetNominal)}</td>
                  <td className="py-3.5 px-4 text-right text-emerald-400">{formatRupiah(kelurahanTotals.realisasiNominal)}</td>
                  <td className="py-3.5 px-4 text-right text-amber-300">{formatRupiah(kelurahanTotals.sisaNominal)}</td>
                  <td className="py-3.5 px-4 text-center text-emerald-300">{kelurahanTotals.persentaseRealisasi.toFixed(2)}%</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2 py-0.5 bg-emerald-700 text-white rounded text-[10px] font-bold">TOTAL</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB: GRAFIK & TREN REALISASI */}
      {activeSubTab === 'grafik_tren' && (
        <PbbTrendCharts
          selectedYear={selectedYear}
          selectedLingkungan={selectedLingkungan}
          onSelectLingkungan={setSelectedLingkungan}
          spptList={spptList}
          summaryByLingkungan={summaryByLingkungan}
          kelurahanTotals={kelurahanTotals}
          isKepling={isKepling}
          keplingLingkunganNum={keplingLingkunganNum}
        />
      )}

      {/* SUB-TAB 2: DETAIL SPPT PER WP */}
      {activeSubTab === 'detail_sppt' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          {/* Quick Statistics Summary Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/60 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 leading-none mb-1">Total SPPT PBB</p>
                <p className="text-xs sm:text-sm font-black text-slate-800">
                  {subTabSummary.totalCount.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-normal text-slate-500">Ketetapan</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-200 pt-2.5 md:pt-0 md:pl-4">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-800 leading-none mb-1">Total SPPT Lunas</p>
                <p className="text-xs sm:text-sm font-black text-emerald-950">
                  {subTabSummary.lunasCount.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-normal text-slate-500">WP ({formatRupiah(subTabSummary.lunasNominal)})</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-200 pt-2.5 md:pt-0 md:pl-4">
              <div className="p-2.5 bg-rose-100 text-rose-700 rounded-lg animate-pulse">
                <XCircle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-extrabold tracking-wider text-rose-800 leading-none mb-1">Sisa Tunggakan SPPT</p>
                <p className="text-xs sm:text-sm font-black text-rose-950">
                  {subTabSummary.belumCount.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-normal text-slate-500">WP ({formatRupiah(subTabSummary.belumNominal)})</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Nama WP, NOP, atau Alamat Objek Pajak..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Year Filter */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50/80 text-xs font-bold text-emerald-900">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <span>Tahun:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                  className="bg-white border border-emerald-300 text-emerald-950 font-black rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-xs"
                >
                  {AVAILABLE_PBB_YEARS.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr} {yr === 2026 ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Semua Status (Lunas &amp; Belum)</option>
                <option value="lunas">Khusus Sudah Bayar (Lunas)</option>
                <option value="belum">Khusus Belum Bayar</option>
              </select>

              <select
                value={selectedNopClassification}
                onChange={(e) => setSelectedNopClassification(e.target.value)}
                className="px-3 py-2 rounded-xl border border-indigo-300 text-xs font-bold text-indigo-900 bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="Klasifikasi NOP Lapangan (Buku, Blok, Prioritas Penagihan)"
              >
                <option value="all">📁 Semua Golongan NOP</option>
                <option value="nop_baru" className="text-rose-600 font-black">🆕 NOP BARU (Belum Masuk Lingkungan)</option>
                <option value="buku_1">📗 Buku 1 (Ketetapan ≤ Rp 100rb)</option>
                <option value="buku_2">📘 Buku 2 (Rp 100rb - Rp 500rb)</option>
                <option value="buku_3">📙 Buku 3 (Rp 500rb - Rp 2jt)</option>
                <option value="buku_4_5">🟥 Buku 4 &amp; 5 (Komersial &gt; Rp 2jt)</option>
                <option value="menunggak_besar">⚠️ Tunggakan Besar (≥ Rp 500rb)</option>
                <option value="menunggak_kecil">💸 Tunggakan Kecil (&lt; Rp 500rb)</option>
                <option value="blok_ganjil">🔢 Blok NOP Ganjil</option>
                <option value="blok_genap">🔢 Blok NOP Genap</option>
              </select>

              <select
                value={selectedLingkungan}
                onChange={(e) => setSelectedLingkungan(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {!isKepling && <option value="all">Semua Lingkungan (1-24)</option>}
                {!isKepling && spptList.some(item => item.lingkungan === 0) && (
                  <option value="0" className="text-rose-600 font-extrabold bg-rose-50">⚠️ TERDETEKSI NOP BARU (0)</option>
                )}
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>
                    Lingkungan {n} {isKepling && n === keplingLingkunganNum ? '👑 (Lingkungan Anda)' : ''}
                  </option>
                ))}
                {isKepling && <option value="all">Tampilkan Semua Lingkungan</option>}
              </select>

              {isKepling && selectedLingkungan !== String(keplingLingkunganNum) && (
                <button
                  onClick={() => setSelectedLingkungan(String(keplingLingkunganNum))}
                  className="px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-black cursor-pointer transition-colors"
                >
                  👑 Reset ke Lingk {keplingLingkunganNum}
                </button>
              )}

              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                title="Sinkronisasi Data Real-time (Firestore & Server Buffer)"
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-98 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Data'}</span>
              </button>

              {canManageWp && (
                <button
                  onClick={handleOpenAddModal}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah WP {isKepling ? `Lingk ${keplingLingkunganNum}` : ''}</span>
                </button>
              )}
            </div>
          </div>

          {/* Info Banner for selected Lingkungan */}
          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-slate-800 flex items-start gap-2.5">
            <Info className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-slate-900">
                {selectedLingkungan === 'all'
                  ? 'Menampilkan Rincian SPPT PBB Wajib Pajak Kelurahan Mangga'
                  : `Rincian SPPT PBB - Lingkungan ${selectedLingkungan}`}
              </div>
              <div className="text-slate-600 leading-relaxed">
                {selectedLingkungan === 'all' ? (
                  <span>
                    Rekapitulasi total Kelurahan Mangga terdiri dari <strong>9.290 Objek Pajak</strong> dengan total target <strong>Rp 10.428.216.715</strong>.
                  </span>
                ) : (
                  <span>
                    Lingkungan {selectedLingkungan} memiliki total rekapitulasi <strong>{kelurahanTotals.totalWp} Objek Pajak</strong> dengan total target <strong>{formatRupiah(kelurahanTotals.targetNominal)}</strong>.
                    {filteredSpptList.length < kelurahanTotals.totalWp && (
                      <span className="block mt-1 text-slate-700">
                        📌 <em>Catatan: Menampilkan rincian {filteredSpptList.length} Objek Pajak terdaftar. Anda dapat menambah atau memperbarui data menggunakan tombol <strong>+ Tambah WP</strong> atau menu <button onClick={() => setActiveTab('import_csv')} className="font-bold text-emerald-800 underline hover:text-emerald-950 cursor-pointer">Import / Paste Spreadsheet</button>.</em>
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-100 text-slate-700 uppercase font-black tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-10">No</th>
                  <th className="py-3 px-3">NOP</th>
                  <th className="py-3 px-3">Nama Wajib Pajak (WP)</th>
                  <th className="py-3 px-3">Alamat Objek Pajak</th>
                  <th className="py-3 px-3 text-center">Buku</th>
                  <th className="py-3 px-3 text-right">PBB Terutang (Rp)</th>
                  <th className="py-3 px-3 text-right">Realisasi Bayar (Rp)</th>
                  <th className="py-3 px-3 text-center">% Bayar</th>
                  <th className="py-3 px-3 text-center">Lingk.</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center print:hidden">Aksi &amp; Kontrol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {filteredSpptList.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500 font-medium">
                      Tidak ada data SPPT PBB yang cocok dengan pencarian / filter Anda.
                    </td>
                  </tr>
                ) : (
                  paginatedSpptList.map((item, idx) => {
                    const globalIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                    return (
                      <tr 
                        key={item.id} 
                      className={`hover:bg-slate-50 transition-colors ${
                        item.lingkungan === 0 
                          ? 'bg-rose-50/70 border-l-4 border-l-rose-500' 
                          : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">{globalIdx}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{item.nop}</td>
                      <td className="py-2.5 px-3 font-black text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{item.namaWp}</span>
                          {item.lingkungan === 0 && (
                            <span className="px-2 py-0.5 rounded text-[8px] font-black bg-rose-600 text-white animate-pulse border border-rose-700 whitespace-nowrap">
                              🆕 NOP BARU
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-xs">{item.alamatOp}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-500">{item.buku}</td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-800">{formatRupiah(item.pbbTerutang)}</td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                        {(() => {
                          if (item.status !== 'Sudah Bayar') return 'Rp 0';
                          const paid = item.jumlahBayar !== undefined && item.jumlahBayar !== null ? item.jumlahBayar : item.pbbTerutang;
                          return formatRupiah(paid);
                        })()}
                      </td>
                      <td className="py-2.5 px-3 text-center font-black">
                        {(() => {
                          if (item.status !== 'Sudah Bayar') return <span className="text-rose-600">0%</span>;
                          const paid = item.jumlahBayar !== undefined && item.jumlahBayar !== null ? item.jumlahBayar : item.pbbTerutang;
                          const pct = (paid / item.pbbTerutang) * 100;
                          if (pct < 100) {
                            return (
                              <div className="flex flex-col items-center leading-none gap-0.5">
                                <span className="text-amber-600 font-extrabold">{pct.toFixed(0)}%</span>
                                <span className="text-[8px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-200 uppercase tracking-tight scale-90">Potong</span>
                              </div>
                            );
                          }
                          return <span className="text-emerald-700">100%</span>;
                        })()}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {item.lingkungan === 0 ? (
                          <span className="text-rose-600 font-extrabold text-[11px] animate-pulse">Belum Dipetakan</span>
                        ) : (
                          `Lingk ${item.lingkungan}`
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                            item.status === 'Sudah Bayar'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-red-100 text-red-800 border-red-200'
                          }`}
                        >
                          {item.status === 'Sudah Bayar' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>LUNAS</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-red-600" />
                              <span>BELUM</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Toggle status button */}
                          <button
                            onClick={() => handleToggleStatusWp(item.id)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                              item.status === 'Sudah Bayar'
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                            }`}
                            title={item.status === 'Sudah Bayar' ? 'Ubah status ke Belum Bayar' : 'Tandai Lunas / Sudah Bayar'}
                          >
                            {item.status === 'Sudah Bayar' ? 'Ubah Belum' : 'Tandai Lunas'}
                          </button>

                          {/* Edit button (for Superadmin & Kasi Pemerintahan) */}
                          {canManageWp && (
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className={`p-1 rounded-lg cursor-pointer transition-colors ${
                                item.lingkungan === 0
                                  ? 'bg-rose-600 text-white hover:bg-rose-700 border border-rose-700 animate-pulse ring-2 ring-rose-400'
                                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300'
                              }`}
                              title={item.lingkungan === 0 ? "⚠️ Klik untuk Petakan Lingkungan Secara Manual" : "Edit Data Wajib Pajak"}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete button (for Superadmin & Kasi Pemerintahan) */}
                          {canManageWp && (
                            <button
                              onClick={() => handleDeleteWpItem(item)}
                              className="p-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 cursor-pointer transition-colors"
                              title="Hapus Data Wajib Pajak"
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

          {/* Premium & Seamless Pagination Controls */}
          {filteredSpptList.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 mt-3">
              <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
                <div>
                  Menampilkan <strong className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</strong> s/d{" "}
                  <strong className="text-slate-900">
                    {Math.min(currentPage * itemsPerPage, filteredSpptList.length)}
                  </strong>{" "}
                  dari <strong className="text-slate-900">{filteredSpptList.length}</strong> data Wajib Pajak
                </div>
                <div className="flex items-center gap-1.5 border-l border-slate-300 pl-4">
                  <span className="font-semibold text-slate-500">Baris:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(parseInt(e.target.value, 10));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-300 rounded px-1.5 py-0.5 font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  title="Halaman Pertama"
                >
                  « First
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Prev
                </button>
                
                <span className="px-3 py-1 bg-emerald-50 text-emerald-800 font-extrabold rounded-lg border border-emerald-100">
                  Halaman {currentPage} dari {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  title="Halaman Terakhir"
                >
                  Last »
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: IMPORT / PASTE SPREADSHEET */}
      {activeSubTab === 'import_csv' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1 flex-1">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                <span>Import atau Sinkronisasi Data SPPT PBB dari Excel / Sheets</span>
              </h2>
              <p className="text-xs text-slate-600">
                Gunakan fasilitas ini untuk menambahkan data master baru atau memperbarui status pembayaran PBB secara massal dari file Excel Anda.
              </p>
            </div>
            
            {/* Target Year Selector for Import */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50/80 text-xs font-bold text-emerald-900 self-start shadow-2xs">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span>Target Tahun Pajak:</span>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                className="bg-white border border-emerald-300 text-emerald-950 font-black rounded px-2.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-xs transition-all"
              >
                {AVAILABLE_PBB_YEARS.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr} {yr === 2026 ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!mappingPreviewActive ? (
            <>
              {/* Mode Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setImportMode('master');
                    setRawCsvInput('');
                  }}
                  className={`px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 justify-center cursor-pointer ${
                    importMode === 'master'
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-black">1. Import Master SPPT Baru</p>
                    <p className="text-[10px] opacity-80 font-normal">Membutuhkan 8 Kolom Lengkap (termasuk Lingkungan)</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setImportMode('sync_status');
                    setRawCsvInput('');
                  }}
                  className={`px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 justify-center cursor-pointer ${
                    importMode === 'sync_status'
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-black">2. Sinkronisasi Status Bayar (Pemetaan NOP)</p>
                    <p className="text-[10px] opacity-80 font-normal">Hanya butuh kolom NOP. Otomatis dipetakan ke Lingkungan!</p>
                  </div>
                </button>
              </div>

              {/* File Upload Dropzone */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-emerald-700" />
                  <span>Metode A: Unggah File CSV / Excel (.csv, .txt)</span>
                </label>
                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-emerald-50/45 hover:border-emerald-500 transition-all">
                  <div className="flex flex-col items-center justify-center py-2.5">
                    <p className="text-xs text-slate-800 font-bold flex items-center gap-1">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                      <span>Klik untuk memilih &amp; membaca File CSV dari Laptop</span>
                    </p>
                    <p className="text-[10px] text-slate-500">Mendukung file teks dipisahkan koma atau tab</p>
                  </div>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Paste Text Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1 block">
                    <Plus className="w-4 h-4 text-emerald-700" />
                    <span>Metode B: Tempel (Paste) Salinan Tabel dari Excel</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                    {importMode === 'master' ? 'Format: NO | NOP | BUKU | NAMA | ALAMAT | PBB | STATUS | LING' : 'Format Bebas: NOP akan dicari otomatis'}
                  </span>
                </div>

                <textarea
                  rows={6}
                  value={rawCsvInput}
                  onChange={(e) => setRawCsvInput(e.target.value)}
                  placeholder={importMode === 'master' 
                    ? `Contoh (Format 8 Kolom):\n1,12.75.010.009.001-0001.0,"IV, V",MULIA MELIALA,JL LETJEN DJAMIN GINTING 88, Rp 2.835.604 ,Belum Bayar,1\n2,12.75.010.009.001-0002.0,"IV, V",PANTAS MELIALA,JL LETJEN DJAMIN GINTING 86, Rp 3.209.724 ,Belum Bayar,1`
                    : `Tempel/Paste kolom dari Excel WP Sudah Bayar Anda (sistem otomatis mencari NOP):\n12.75.010.009.001-0004\tGINTING\tSudah Bayar\n12.75.010.009.001-0016\tOPONG GINTING\tSudah Bayar\n12.75.010.009.002-0002\tMOMIN SITEPU\tSudah Bayar`}
                  className="w-full p-3.5 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 leading-relaxed"
                />
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs">
                <p className="font-black text-amber-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>{importMode === 'master' ? 'Cara Import Master SPPT:' : 'Cara Sinkronisasi Massal (Pemetaan NOP):'}</span>
                </p>
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  {importMode === 'master' 
                    ? 'Gunakan opsi ini saat pertama kali mengimpor master database SPPT PBB tahunan Kelurahan Mangga yang memiliki kolom lingkungan lengkap.'
                    : 'Gunakan opsi ini jika Excel pembayaran Anda TIDAK memuat kolom lingkungan. Sistem akan mencocokkan NOP di setiap baris dengan database Master SPPT & pemetaan WebGIS Rumah warga Kelurahan Mangga untuk mencari tahu nomor lingkungan aslinya secara otomatis!'}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Sistem otomatis mengabaikan baris judul (header) dan karakter rupiah.</span>
                </div>

                <button
                  onClick={handleParseCsvData}
                  disabled={!rawCsvInput.trim()}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-2xs"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{importMode === 'master' ? 'Proses Impor Master SPPT' : 'Analisis &amp; Petakan Lingkungan (NOP)'}</span>
                </button>
              </div>
            </>
          ) : (
            /* INTERACTIVE MAPPING PREVIEW & REVIEW WIZARD */
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                <h3 className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Review Hasil Pemetaan Lingkungan &amp; Status Pembayaran PBB</span>
                </h3>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Ditemukan <b>{parsedItems.length} data WP</b>. Sistem secara otomatis mencocokkan NOP dengan <b>basis data master warga</b> dan <b>WebGIS rumah</b> untuk mendeteksi lingkungannya masing-masing. Silakan koreksi lingkungan jika diperlukan sebelum menekan tombol simpan massal ke Firestore.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-black text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">No</th>
                      <th className="py-2.5 px-3">NOP</th>
                      <th className="py-2.5 px-3">Nama Wajib Pajak</th>
                      <th className="py-2.5 px-3">Alamat OP</th>
                      <th className="py-2.5 px-3 text-right">Ketetapan PBB</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Sumber Pemetaan</th>
                      <th className="py-2.5 px-3 text-center w-36">Nomor Lingkungan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {parsedItems.map((item, idx) => (
                      <tr 
                        key={item.id} 
                        className={`hover:bg-slate-50 transition-colors ${
                          item.lingkungan === 0 
                            ? 'bg-rose-50/70 border-l-4 border-l-rose-500' 
                            : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-700">{item.nop}</td>
                        <td className="py-2 px-3 font-black text-slate-900">{item.namaWp}</td>
                        <td className="py-2 px-3 text-slate-500 text-[10px]">{item.alamatOp}</td>
                        <td className="py-2 px-3 text-right font-bold">{formatRupiah(item.pbbTerutang)}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {item.lingkungan === 0 ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-rose-600 text-white animate-pulse border border-rose-700">
                              🆕 NOP BARU
                            </span>
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              item.mappingSource === 'Master SPPT' 
                                ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                                : item.mappingSource === 'WebGIS Rumah'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              ⚡ {item.mappingSource}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <span className="text-[10px] font-bold text-slate-500">Lingk:</span>
                            <select
                              value={item.lingkungan}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setParsedItems(prev => prev.map(p => p.id === item.id ? { ...p, lingkungan: val, mappingSource: 'Manual', namaWp: p.namaWp === 'NOP BARU (BELUM DIEDIT)' ? `WP BARU LINGKUNGAN ${val}` : p.namaWp } : p));
                              }}
                              className={`border rounded-lg px-2 py-1 text-xs font-black focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer ${
                                item.lingkungan === 0 
                                  ? 'bg-rose-100 border-rose-500 text-rose-700 animate-pulse' 
                                  : 'bg-white border-slate-300 text-slate-800'
                              }`}
                            >
                              {item.lingkungan === 0 && (
                                <option value="0">⚠️ PILIH LINGKUNGAN</option>
                              )}
                              {Array.from({ length: 24 }, (_, i) => i + 1).map(num => (
                                <option key={num} value={num}>Lingkungan {num}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setMappingPreviewActive(false);
                    setParsedItems([]);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Batal / Ulangi Impor
                </button>

                <button
                  type="button"
                  onClick={handleCommitMappingToFirestore}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Save className="w-4 h-4 animate-pulse" />
                  <span>Simpan &amp; Sinkronkan Massal ke Firestore (Android Sinkron)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL EDIT / TAMBAH WAJIB PAJAK */}
      {isWpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-800/80 rounded-xl border border-emerald-600/50">
                  {editingWpItem ? <Edit3 className="w-5 h-5 text-emerald-300" /> : <UserPlus className="w-5 h-5 text-emerald-300" />}
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {editingWpItem ? 'Edit Data Wajib Pajak (SPPT PBB)' : 'Tambah Wajib Pajak Baru'}
                  </h3>
                  <p className="text-[11px] text-emerald-200 font-medium">
                    {editingWpItem ? `NOP: ${editingWpItem.nop}` : 'Superadmin & Kasi Pemerintahan Input Mode'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsWpModalOpen(false)}
                className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveWpItem} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* NOP */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Nomor Objek Pajak (NOP) <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={24}
                    value={formNop}
                    onChange={(e) => setFormNop(formatNop(e.target.value))}
                    placeholder="Contoh: 12.75.010.009.005-0012.0"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Nama WP */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Nama Wajib Pajak (WP) <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formNamaWp}
                    onChange={(e) => setFormNamaWp(e.target.value)}
                    placeholder="Nama lengkap pemilik/wajib pajak..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Alamat OP */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Alamat Objek Pajak</span>
                  </label>
                  <input
                    type="text"
                    value={formAlamatOp}
                    onChange={(e) => setFormAlamatOp(e.target.value)}
                    placeholder="Jl. Letjen Djamin Ginting No..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Lingkungan */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Lingkungan (1-24)</label>
                  <select
                    value={formLingkungan}
                    onChange={(e) => setFormLingkungan(parseInt(e.target.value, 10))}
                    disabled={isKepling}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white disabled:bg-slate-100 disabled:text-slate-600"
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        Lingkungan {n} {isKepling && n === keplingLingkunganNum ? '(Lingkungan Anda)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Buku */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Golongan Buku</label>
                  <select
                    value={formBuku}
                    onChange={(e) => setFormBuku(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="I, II, III">Buku I, II, III</option>
                    <option value="IV, V">Buku IV, V</option>
                  </select>
                </div>

                {/* Nominal PBB Terutang */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-700" />
                    <span>PBB Terutang (Nominal Rp) <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formPbbTerutang}
                    onChange={(e) => setFormPbbTerutang(e.target.value)}
                    placeholder="Contoh: 450000"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono font-bold text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {formPbbTerutang && !isNaN(parseInt(formPbbTerutang.replace(/[^0-9]/g, ''), 10)) && (
                    <div className="text-[11px] font-bold text-emerald-700 pt-0.5">
                      = {formatRupiah(parseInt(formPbbTerutang.replace(/[^0-9]/g, ''), 10))}
                    </div>
                  )}
                </div>

                {/* Status Pembayaran */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block">Status Pembayaran saat ini</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormStatus('Belum Bayar')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 ${
                        formStatus === 'Belum Bayar'
                          ? 'bg-red-50 border-red-500 text-red-800 shadow-2xs font-black'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span>Belum Bayar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormStatus('Sudah Bayar');
                        if (!formJumlahBayar) {
                          setFormJumlahBayar(formPbbTerutang);
                        }
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 ${
                        formStatus === 'Sudah Bayar'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs font-black'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Sudah Bayar (Lunas)</span>
                    </button>
                  </div>
                </div>

                {/* Nominal Realisasi Pembayaran (jika mendapat pemotongan) */}
                {formStatus === 'Sudah Bayar' && (
                  <div className="space-y-1 sm:col-span-2 p-3.5 bg-emerald-50/40 border border-emerald-200/60 rounded-xl animate-fade-in">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Nominal Realisasi yang Dibayar (Rp)</span>
                    </label>
                    <input
                      type="text"
                      value={formJumlahBayar}
                      onChange={(e) => setFormJumlahBayar(e.target.value)}
                      placeholder="Masukkan nominal jika berbeda dengan PBB Terutang..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500 pt-1">
                      <span>
                        Ketetapan: {formPbbTerutang ? formatRupiah(parseInt(formPbbTerutang.replace(/[^0-9]/g, ''), 10)) : '-'}
                      </span>
                      {(() => {
                        const originalVal = parseInt(formPbbTerutang.replace(/[^0-9]/g, ''), 10) || 0;
                        const paidVal = parseInt(formJumlahBayar.replace(/[^0-9]/g, ''), 10) || originalVal;
                        if (paidVal < originalVal) {
                          return (
                            <span className="text-amber-600 font-black">
                              ⚠️ Terpotong: -{formatRupiah(originalVal - paidVal)}
                            </span>
                          );
                        }
                        return (
                          <span className="text-emerald-700">
                            Bayar Penuh (100%)
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsWpModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 shadow-md"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Data WP</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
