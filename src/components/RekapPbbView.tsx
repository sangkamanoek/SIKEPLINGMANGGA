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
  CreditCard,
  User,
  MapPin,
  Calendar
} from 'lucide-react';
import { INITIAL_PBB_SUMMARY, SAMPLE_SPPT_ITEMS, SpptPbbItem } from '../data/pbbSampleData';
import { parsePbbCsv } from '../utils/pbbParser';
import { UserAccount } from '../types';
import {
  AVAILABLE_PBB_YEARS,
  DEFAULT_PBB_YEAR,
  getLocalSpptForYear,
  saveLocalSpptForYear,
  savePbbSpptToFirestore,
  batchSavePbbSpptToFirestore,
  subscribePbbSpptFromFirestore,
  fetchPbbSpptFromFirestore,
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'lingkungan' | 'persentase' | 'target'>('persentase');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeSubTab, setActiveTab] = useState<'rekap_lingkungan' | 'detail_sppt' | 'import_csv'>(() => {
    if (activeAccount?.role === 'kepling') {
      return 'detail_sppt';
    }
    return 'rekap_lingkungan';
  });

  // Custom SPPT item list state with LocalStorage persistence & Firebase sync
  const [spptList, setSpptList] = useState<SpptPbbItem[]>(() => {
    return getLocalSpptForYear(selectedYear);
  });

  // Subscribe to Firebase Firestore real-time updates for active year
  useEffect(() => {
    // 1. Initial fetch from Firestore
    fetchPbbSpptFromFirestore(selectedYear).then((items) => {
      if (items && items.length > 0) {
        setSpptList(items);
      }
    });

    // 2. Real-time subscription
    const unsubscribe = subscribePbbSpptFromFirestore(selectedYear, (items) => {
      if (items && items.length > 0) {
        setSpptList(items);
      }
    });

    return () => unsubscribe();
  }, [selectedYear]);

  // Sync state changes to localStorage for active year
  useEffect(() => {
    saveLocalSpptForYear(spptList, selectedYear);
  }, [spptList, selectedYear]);

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
  const [parseSuccessMsg, setParseSuccessMsg] = useState<string | null>(null);

  // Modal State for Add/Edit WP
  const [isWpModalOpen, setIsWpModalOpen] = useState<boolean>(false);
  const [editingWpItem, setEditingWpItem] = useState<SpptPbbItem | null>(null);

  // Form Fields State
  const [formNop, setFormNop] = useState<string>('');
  const [formNamaWp, setFormNamaWp] = useState<string>('');
  const [formAlamatOp, setFormAlamatOp] = useState<string>('');
  const [formBuku, setFormBuku] = useState<'I, II, III' | 'IV, V'>('IV, V');
  const [formPbbTerutang, setFormPbbTerutang] = useState<string>('');
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

    if (editingWpItem) {
      // Update Existing Item
      const updatedItem: SpptPbbItem = {
        ...editingWpItem,
        nop: formNop.trim(),
        namaWp: formNamaWp.trim().toUpperCase(),
        alamatOp: formAlamatOp.trim().toUpperCase() || 'KELURAHAN MANGGA',
        buku: formBuku,
        pbbTerutang: nominalPbb,
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
      const newWp: SpptPbbItem = {
        id: `wp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        no: spptList.length + 1,
        nop: formNop.trim(),
        namaWp: formNamaWp.trim().toUpperCase(),
        alamatOp: formAlamatOp.trim().toUpperCase() || 'KELURAHAN MANGGA',
        buku: formBuku,
        pbbTerutang: nominalPbb,
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
      notify(`Wajib Pajak "${item.namaWp}" berhasil dihapus.`, 'info');
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

    // Initialize 24 Lingkungan
    for (let i = 1; i <= 24; i++) {
      const init = INITIAL_PBB_SUMMARY[i] || { targetNominal: 300000000, totalWp: 300 };
      dataMap[i] = {
        targetNominal: init.targetNominal,
        realisasiNominal: 0,
        totalWp: init.totalWp,
        wpLunas: 0,
      };
    }

    // Tally values directly from spptList
    spptList.forEach((item) => {
      const ling = item.lingkungan;
      if (ling >= 1 && ling <= 24 && dataMap[ling]) {
        if (item.status === 'Sudah Bayar') {
          dataMap[ling].wpLunas += 1;
          dataMap[ling].realisasiNominal += item.pbbTerutang;
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

  // Filtered SPPT Items for Detail View
  const filteredSpptList = useMemo(() => {
    return spptList.filter((item) => {
      // Lingkungan filter
      if (selectedLingkungan !== 'all' && item.lingkungan !== parseInt(selectedLingkungan, 10)) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'all') {
        if (selectedStatusFilter === 'lunas' && item.status !== 'Sudah Bayar') return false;
        if (selectedStatusFilter === 'belum' && item.status !== 'Belum Bayar') return false;
      }

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchNama = item.namaWp.toLowerCase().includes(q);
        const matchNop = item.nop.toLowerCase().includes(q);
        const matchAlamat = item.alamatOp.toLowerCase().includes(q);
        if (!matchNama && !matchNop && !matchAlamat) return false;
      }

      return true;
    });
  }, [spptList, selectedLingkungan, selectedStatusFilter, searchQuery]);

  // Handle CSV/Text Parse
  const handleParseCsvData = () => {
    if (!rawCsvInput.trim()) return;

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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
      </div>

      {/* Sub Tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pt-2 rounded-xl shadow-2xs print:hidden">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('rekap_lingkungan')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
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
            onClick={() => setActiveTab('detail_sppt')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
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
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
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
                <option value="persentase">Urutkan: Capaian tertinggi (%)</option>
                <option value="target">Urutkan: Target terbesar (Rp)</option>
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
                {summaryByLingkungan.map((row, idx) => {
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

      {/* SUB-TAB 2: DETAIL SPPT PER WP */}
      {activeSubTab === 'detail_sppt' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
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
                value={selectedLingkungan}
                onChange={(e) => setSelectedLingkungan(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {!isKepling && <option value="all">Semua Lingkungan (1-24)</option>}
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
                  <th className="py-3 px-3 text-center">Lingk.</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center print:hidden">Aksi &amp; Kontrol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {filteredSpptList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500 font-medium">
                      Tidak ada data SPPT PBB yang cocok dengan pencarian / filter Anda.
                    </td>
                  </tr>
                ) : (
                  filteredSpptList.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{item.nop}</td>
                      <td className="py-2.5 px-3 font-black text-slate-900">{item.namaWp}</td>
                      <td className="py-2.5 px-3 text-slate-600 text-xs">{item.alamatOp}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-500">{item.buku}</td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-800">{formatRupiah(item.pbbTerutang)}</td>
                      <td className="py-2.5 px-3 text-center font-bold">Lingk {item.lingkungan}</td>
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
                              className="p-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 cursor-pointer transition-colors"
                              title="Edit Data Wajib Pajak"
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: IMPORT / PASTE SPREADSHEET */}
      {activeSubTab === 'import_csv' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" />
              <span>Import atau Paste Data SPPT PBB dari Google Sheets / Excel</span>
            </h2>
            <p className="text-xs text-slate-600">
              Copy seluruh baris dari Google Sheets Anda (Kolom A s.d. H: NO, NOP, BUKU, Nama WP, Alamat OP, PBB, Status, LING) dan paste ke dalam kotak di bawah ini untuk memperbarui rekapitulasi realisasi.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">Paste Data CSV / Tab Separated Values (Kolom A-H):</label>
            <textarea
              rows={8}
              value={rawCsvInput}
              onChange={(e) => setRawCsvInput(e.target.value)}
              placeholder={`Contoh:\n1,12.75.010.009.001-0001.0,"IV, V",MULIA MELIALA,JL LETJEN DJAMIN GINTING 88, Rp 2.835.604 ,Belum Bayar,1\n2,12.75.010.009.001-0002.0,"IV, V",PANTAS MELIALA,JL LETJEN DJAMIN GINTING 86, Rp 3.209.724 ,Belum Bayar,1`}
              className="w-full p-3.5 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Info className="w-4 h-4 text-slate-400" />
              <span>Sistem secara otomatis membersihkan format "Rp", spasi, dan koma.</span>
            </div>

            <button
              onClick={handleParseCsvData}
              disabled={!rawCsvInput.trim()}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-2xs"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Proses Data SPPT</span>
            </button>
          </div>
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
                    value={formNop}
                    onChange={(e) => setFormNop(e.target.value)}
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
                      onClick={() => setFormStatus('Sudah Bayar')}
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
