import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { printOfficialDocument } from '../utils/printHelper';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  Layers,
  FileText,
  Trash2,
  Edit3,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  Camera,
  RefreshCw,
  TrendingUp,
  Tag,
  Receipt,
  User,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { TransaksiKeuanganPkk, JenisTransaksiPkk, PosAnggaranPkk, UserAccount } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import {
  getLocalTransaksiPkk,
  saveTransaksiPkk,
  deleteTransaksiPkk,
  subscribeTransaksiPkk,
  clearPkkKeuanganData,
  exportPkkKeuanganToExcel,
  POS_ANGGARAN_LABELS,
} from '../lib/pkkKeuanganService';
import { getTodayLocalIso, formatTanggalIndonesia } from '../lib/formatter';
import { KopSuratPkk } from './KopSuratPkk';
import { compressImageFile } from '../lib/imageCompressor';

interface LaporanKeuanganPkkViewProps {
  currentUser: UserAccount;
}

export const LaporanKeuanganPkkView: React.FC<LaporanKeuanganPkkViewProps> = ({ currentUser }) => {
  const [transactions, setTransactions] = useState<TransaksiKeuanganPkk[]>(() => getLocalTransaksiPkk());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJenis, setSelectedJenis] = useState<'ALL' | JenisTransaksiPkk>('ALL');
  const [selectedPos, setSelectedPos] = useState<'ALL' | PosAnggaranPkk>('ALL');
  const [selectedLingkungan, setSelectedLingkungan] = useState<string>('ALL');
  const [periodFilter, setPeriodFilter] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'ALL' | 'CUSTOM'>('THIS_MONTH');
  
  const todayStr = useMemo(() => getTodayLocalIso(), []);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return getTodayLocalIso(d);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formTanggal, setFormTanggal] = useState(todayStr);
  const [formJenis, setFormJenis] = useState<JenisTransaksiPkk>('PENGELUARAN');
  const [formPos, setFormPos] = useState<PosAnggaranPkk>('POKJA_IV');
  const [formNomorBukti, setFormNomorBukti] = useState('');
  const [formUraian, setFormUraian] = useState('');
  const [formJumlah, setFormJumlah] = useState<string>('');
  const [formSumberDana, setFormSumberDana] = useState('');
  const [formPenerimaPenyetor, setFormPenerimaPenyetor] = useState('');
  const [formLingkunganNomor, setFormLingkunganNomor] = useState<number>(0);
  const [formBuktiFotoUrl, setFormBuktiFotoUrl] = useState('');
  const [formCatatan, setFormCatatan] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Lightbox & Print Preview State
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const t = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(t);
  }, []);

  // Real-time synchronization subscription
  useEffect(() => {
    const unsub = subscribeTransaksiPkk((newList) => {
      setTransactions(newList);
    });
    return () => unsub();
  }, []);

  // Generate Suggested Nomor Bukti
  const generateNomorBukti = useCallback((jenis: JenisTransaksiPkk) => {
    const prefix = jenis === 'PENERIMAAN' ? 'BKM' : 'BKK';
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const count = transactions.filter((t) => t.jenis === jenis).length + 1;
    const seq = String(count).padStart(2, '0');
    return `${prefix}-${seq}/PKK/${month}/${year}`;
  }, [transactions]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormTanggal(todayStr);
    setFormJenis('PENGELUARAN');
    setFormPos('POKJA_IV');
    setFormNomorBukti(generateNomorBukti('PENGELUARAN'));
    setFormUraian('');
    setFormJumlah('');
    setFormSumberDana('Kas PKK');
    setFormPenerimaPenyetor('');
    setFormLingkunganNomor(currentUser.nomorLingkungan || 0);
    setFormBuktiFotoUrl('');
    setFormCatatan('');
    setFormError('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (tx: TransaksiKeuanganPkk) => {
    setIsEditing(true);
    setEditingId(tx.id);
    setFormTanggal(tx.tanggal);
    setFormJenis(tx.jenis);
    setFormPos(tx.posAnggaran);
    setFormNomorBukti(tx.nomorBukti || '');
    setFormUraian(tx.uraian);
    setFormJumlah(String(tx.jumlah));
    setFormSumberDana(tx.sumberDana || '');
    setFormPenerimaPenyetor(tx.penerimaPenyetor || '');
    setFormLingkunganNomor(tx.lingkunganNomor || 0);
    setFormBuktiFotoUrl(tx.buktiFotoUrl || '');
    setFormCatatan(tx.catatan || '');
    setFormError('');
    setIsModalOpen(true);
  };

  // Compress & attach receipt photo with high efficiency for low-end phones
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, 720, 0.45);
      if (compressed) {
        setFormBuktiFotoUrl(compressed);
      }
    } catch (err) {
      console.warn('Gagal kompresi bukti kas:', err);
    }
    e.target.value = '';
  };

  // Handle Form Submit
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanUraian = formUraian.trim();
    if (!cleanUraian) {
      setFormError('Uraian transaksi wajib diisi.');
      return;
    }

    const cleanJumlah = Number(formJumlah.replace(/[^0-9]/g, ''));
    if (!cleanJumlah || cleanJumlah <= 0) {
      setFormError('Nominal transaksi harus lebih dari 0.');
      return;
    }

    setIsSaving(true);
    try {
      const id = isEditing && editingId ? editingId : `pkk_tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const nowIso = new Date().toISOString();

      const lingkunganNama =
        formLingkunganNomor > 0 ? `Lingkungan ${formLingkunganNomor}` : 'TP PKK Kelurahan Mangga';

      const payload: TransaksiKeuanganPkk = {
        id,
        tanggal: formTanggal || todayStr,
        nomorBukti: formNomorBukti.trim() || undefined,
        jenis: formJenis,
        posAnggaran: formPos,
        uraian: cleanUraian,
        jumlah: cleanJumlah,
        sumberDana: formSumberDana.trim() || undefined,
        penerimaPenyetor: formPenerimaPenyetor.trim() || undefined,
        lingkunganNomor: formLingkunganNomor,
        lingkunganNama,
        buktiFotoUrl: formBuktiFotoUrl || undefined,
        catatan: formCatatan.trim() || undefined,
        dibuatOlehNama: currentUser.nama,
        dibuatOlehRole: currentUser.role,
        createdAt: isEditing ? (transactions.find((x) => x.id === id)?.createdAt || nowIso) : nowIso,
        updatedAt: nowIso,
      };

      await saveTransaksiPkk(payload);
      showToast(isEditing ? 'Transaksi PKK berhasil diperbarui!' : 'Transaksi PKK baru berhasil ditambahkan!');
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(`Gagal menyimpan: ${err?.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string, uraian: string) => {
    if (!window.confirm(`Hapus catatan transaksi: "${uraian}"?`)) return;
    try {
      await deleteTransaksiPkk(id);
      showToast('Transaksi berhasil dihapus dari Buku Kas.');
    } catch (err) {
      alert('Gagal menghapus: ' + err);
    }
  };

  // Date Boundaries Calculation based on periodFilter
  const periodBounds = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    if (periodFilter === 'THIS_MONTH') {
      const start = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(curYear, curMonth + 1, 0).getDate();
      const end = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { start, end, label: `Bulan ${new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(now)}` };
    }
    if (periodFilter === 'LAST_MONTH') {
      const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
      const prevYear = curMonth === 0 ? curYear - 1 : curYear;
      const start = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
      const end = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const dPrev = new Date(prevYear, prevMonth, 1);
      return { start, end, label: `Bulan ${new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(dPrev)}` };
    }
    if (periodFilter === 'THIS_YEAR') {
      return { start: `${curYear}-01-01`, end: `${curYear}-12-31`, label: `Tahun Anggaran ${curYear}` };
    }
    if (periodFilter === 'CUSTOM') {
      return { start: startDate, end: endDate, label: `${startDate} s/d ${endDate}` };
    }
    return { start: '', end: '', label: 'Semua Periode (Keseluruhan)' };
  }, [periodFilter, startDate, endDate]);

  // Filtered & Chronologically Sorted Transactions (with Running Saldo)
  const filteredChronologicalTransactions = useMemo(() => {
    const qLower = searchQuery.toLowerCase().trim();

    // 1. Sort all transactions chronologically (oldest to newest) to calculate cumulative running balance
    const sortedAll = [...transactions].sort((a, b) => {
      const dateA = (a.tanggal || '') + (a.createdAt || '');
      const dateB = (b.tanggal || '') + (b.createdAt || '');
      return dateA.localeCompare(dateB);
    });

    let runningSaldo = 0;
    const withRunningSaldo = sortedAll.map((tx) => {
      const masuk = tx.jenis === 'PENERIMAAN' ? tx.jumlah : 0;
      const keluar = tx.jenis === 'PENGELUARAN' ? tx.jumlah : 0;
      runningSaldo += masuk - keluar;
      return { ...tx, saldoBerjalan: runningSaldo, masuk, keluar };
    });

    // 2. Apply UI Filters
    return withRunningSaldo.filter((tx) => {
      // Date filter
      if (periodBounds.start && periodBounds.end) {
        if (tx.tanggal < periodBounds.start || tx.tanggal > periodBounds.end) return false;
      }

      // Jenis filter
      if (selectedJenis !== 'ALL' && tx.jenis !== selectedJenis) return false;

      // Pos filter
      if (selectedPos !== 'ALL' && tx.posAnggaran !== selectedPos) return false;

      // Lingkungan filter
      if (selectedLingkungan !== 'ALL') {
        const targetNomor = Number(selectedLingkungan);
        if (tx.lingkunganNomor !== targetNomor) return false;
      }

      // Search Query
      if (qLower) {
        const matchUraian = (tx.uraian || '').toLowerCase().includes(qLower);
        const matchBukti = (tx.nomorBukti || '').toLowerCase().includes(qLower);
        const matchPihak = (tx.penerimaPenyetor || '').toLowerCase().includes(qLower);
        const matchPos = (POS_ANGGARAN_LABELS[tx.posAnggaran] || '').toLowerCase().includes(qLower);
        const matchLingk = (tx.lingkunganNama || '').toLowerCase().includes(qLower);
        if (!matchUraian && !matchBukti && !matchPihak && !matchPos && !matchLingk) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, periodBounds, selectedJenis, selectedPos, selectedLingkungan, searchQuery]);

  // Reverse list for default latest-first table view
  const displayTransactions = useMemo(() => {
    return [...filteredChronologicalTransactions].reverse();
  }, [filteredChronologicalTransactions]);

  // Overall Financial Totals
  const totals = useMemo(() => {
    let totalPenerimaan = 0;
    let totalPengeluaran = 0;

    filteredChronologicalTransactions.forEach((tx) => {
      if (tx.jenis === 'PENERIMAAN') totalPenerimaan += tx.jumlah;
      if (tx.jenis === 'PENGELUARAN') totalPengeluaran += tx.jumlah;
    });

    const saldoAkhir = totalPenerimaan - totalPengeluaran;

    // Breakdown per Pokja
    const pokjaStats: Record<string, { masuk: number; keluar: number }> = {
      SEKRETARIAT: { masuk: 0, keluar: 0 },
      POKJA_I: { masuk: 0, keluar: 0 },
      POKJA_II: { masuk: 0, keluar: 0 },
      POKJA_III: { masuk: 0, keluar: 0 },
      POKJA_IV: { masuk: 0, keluar: 0 },
      UP2K: { masuk: 0, keluar: 0 },
    };

    filteredChronologicalTransactions.forEach((tx) => {
      if (pokjaStats[tx.posAnggaran]) {
        if (tx.jenis === 'PENERIMAAN') pokjaStats[tx.posAnggaran].masuk += tx.jumlah;
        else pokjaStats[tx.posAnggaran].keluar += tx.jumlah;
      }
    });

    return { totalPenerimaan, totalPengeluaran, saldoAkhir, pokjaStats };
  }, [filteredChronologicalTransactions]);

  // Trigger Excel Export
  // Handle Reset Data
  const handleResetData = async () => {
    if (!window.confirm('PERINGATAN: Seluruh data keuangan PKK akan di-RESET ke NOL (Dihapus Permanen). Apakah Anda yakin?')) return;
    try {
      setIsSaving(true);
      await clearPkkKeuanganData();
      showToast('Seluruh data keuangan PKK telah berhasil di-NOL-kan.');
    } catch (err) {
      alert('Gagal meriset data: ' + err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = () => {
    exportPkkKeuanganToExcel(filteredChronologicalTransactions, periodBounds.label);
    showToast('Buku Kas Umum PKK berhasil diekspor ke Excel!');
  };

  // Trigger Print Document
  const handlePrint = () => {
    printOfficialDocument('lembar-cetak-keuangan-pkk', 'Laporan_Kas_PKK_A4');
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-tosca-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-tosca-500/50 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-tosca-400 shrink-0" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner Tim Penggerak PKK */}
      <div className="bg-gradient-to-r from-tosca-900 via-tosca-900 to-tosca-950 text-white p-5 sm:p-7 rounded-3xl shadow-xl border border-tosca-700/50 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-tosca-500/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start gap-3.5 flex-1 min-w-0">
            <div className="p-3 bg-gradient-to-br from-tosca-500 to-tosca-600 rounded-2xl shadow-lg border border-tosca-300/30 text-white shrink-0">
              <Wallet className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-tosca-400/20 text-tosca-200 border border-tosca-400/30">
                  Buku Administrasi III PKK
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-tosca-500/20 text-tosca-200 border border-tosca-400/30">
                  Permendagri &amp; TP PKK Kota Medan
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white leading-tight">
                Buku Kas Umum (BKU) Tim Penggerak PKK
              </h1>
              <p className="text-xs sm:text-sm text-tosca-200/90 mt-1 max-w-2xl leading-relaxed">
                Pencatatan transparan seluruh arus penerimaan &amp; pengeluaran kas keuangan PKK Kelurahan Mangga,
                bantuan operasional, iuran pengurus, usaha UP2K, dan realisasi program Pokja I - IV.
              </p>
            </div>
          </div>

          {/* Action Header Buttons */}
          <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t border-tosca-800/80 lg:border-t-0">
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap"
              title="Cetak Buku Kas Format Resmi PKK"
            >
              <Printer className="w-3.5 h-3.5 text-tosca-300" />
              <span>Cetak BKU</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-tosca-600 hover:bg-tosca-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95 whitespace-nowrap"
              title="Ekspor ke Excel .xlsx"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Excel</span>
            </button>

            <button
              onClick={handleResetData}
              className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 hover:text-white font-bold text-xs rounded-xl border border-rose-400/40 transition-all cursor-pointer active:scale-95 shadow-xs whitespace-nowrap"
              title="Reset Semua Data Keuangan ke NOL"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-300" />
              <span>Reset Kas</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs rounded-xl shadow-lg shadow-tosca-950/40 transition-all cursor-pointer active:scale-95 border border-emerald-300/30 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>+ Catat Transaksi Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Financial Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Penerimaan Kas */}
        <div className="bg-white p-5 rounded-2xl border border-tosca-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Penerimaan</span>
            <div className="p-2.5 bg-tosca-50 text-tosca-600 rounded-xl group-hover:scale-110 transition-transform">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-tosca-600 tracking-tight">
              Rp {totals.totalPenerimaan.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 font-medium">
            <span className="text-tosca-600 font-bold">●</span>
            <span>Kas Masuk & Bantuan Periode Ini</span>
          </div>
        </div>

        {/* Card 2: Pengeluaran Kas */}
        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Pengeluaran</span>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 transition-transform">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-600 tracking-tight">
              Rp {totals.totalPengeluaran.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 font-medium">
            <span className="text-rose-500 font-bold">●</span>
            <span>Belanja Operasional & Kegiatan Pokja</span>
          </div>
        </div>

        {/* Card 3: Saldo Kas Berjalan */}
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white p-5 rounded-2xl border border-indigo-700/50 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Saldo Kas Berjalan</span>
            <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/20">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-black tracking-tight ${totals.saldoAkhir >= 0 ? 'text-indigo-200' : 'text-rose-400'}`}>
              Rp {totals.saldoAkhir.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="mt-2 text-xs text-indigo-300/80 font-medium">
            {totals.saldoAkhir >= 0 ? '✓ Saldo Kas Sehat & Terverifikasi' : '⚠️ Saldo Mengalami Defisit Kas'}
          </div>
        </div>

        {/* Card 4: Alokasi Pokja & Transaksi */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jumlah Kegiatan</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {filteredChronologicalTransactions.length} Transaksi
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            {periodBounds.label}
          </div>
        </div>
      </div>

      {/* Filter Bar & Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Top Controls: Period Buttons */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex-wrap text-xs font-bold">
            <button
              onClick={() => setPeriodFilter('THIS_MONTH')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                periodFilter === 'THIS_MONTH' ? 'bg-tosca-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📅 Bulan Ini (Oktober)
            </button>
            <button
              onClick={() => setPeriodFilter('LAST_MONTH')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                periodFilter === 'LAST_MONTH' ? 'bg-tosca-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🗓️ Bulan Lalu (September)
            </button>
            <button
              onClick={() => setPeriodFilter('THIS_YEAR')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                periodFilter === 'THIS_YEAR' ? 'bg-tosca-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🏆 Tahun 2026
            </button>
            <button
              onClick={() => setPeriodFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                periodFilter === 'ALL' ? 'bg-tosca-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Periode
            </button>
            <button
              onClick={() => setPeriodFilter('CUSTOM')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                periodFilter === 'CUSTOM' ? 'bg-tosca-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rentang Tanggal...
            </button>
          </div>

          {/* Active Period Indicator */}
          <div className="text-xs text-slate-500 font-semibold flex items-center gap-2">
            <span>Filter Aktif:</span>
            <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {periodBounds.label}
            </span>
          </div>
        </div>

        {/* Custom Range Date Pickers (if CUSTOM) */}
        {periodFilter === 'CUSTOM' && (
          <div className="flex items-center gap-3 p-3 bg-tosca-50/60 rounded-xl border border-tosca-200/70 text-xs">
            <span className="font-bold text-tosca-950">Mulai Tanggal:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="p-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-800"
            />
            <span className="font-bold text-tosca-950">s/d Tanggal:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="p-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-800"
            />
          </div>
        )}

        {/* Second Row: Search, Jenis Filter, Pos/Pokja Filter, Lingkungan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Query */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari uraian, no kuitansi, penerima..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-tosca-500 focus:outline-hidden transition-all"
            />
          </div>

          {/* Jenis Arus Kas */}
          <div>
            <select
              value={selectedJenis}
              onChange={(e) => setSelectedJenis(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-tosca-500 focus:outline-hidden transition-all font-medium text-slate-700"
            >
              <option value="ALL">Semua Jenis (Masuk & Keluar)</option>
              <option value="PENERIMAAN">🟢 Hanya Penerimaan (Kas Masuk)</option>
              <option value="PENGELUARAN">🔴 Hanya Pengeluaran (Kas Keluar)</option>
            </select>
          </div>

          {/* Pos Anggaran / Pokja */}
          <div>
            <select
              value={selectedPos}
              onChange={(e) => setSelectedPos(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-tosca-500 focus:outline-hidden transition-all font-medium text-slate-700"
            >
              <option value="ALL">Semua Pos / Pokja PKK</option>
              {Object.entries(POS_ANGGARAN_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Lingkungan */}
          <div>
            <select
              value={selectedLingkungan}
              onChange={(e) => setSelectedLingkungan(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-tosca-500 focus:outline-hidden transition-all font-medium text-slate-700"
            >
              <option value="ALL">Semua Lingkungan (Kelurahan & Lk I-XXIV)</option>
              <option value="0">TP PKK Kelurahan Mangga</option>
              {KEPLING_ACCOUNTS.map((k) => (
                <option key={k.id} value={k.nomorLingkungan}>
                  {k.lingkungan} ({k.nama})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table: Buku Kas Umum PKK */}
      <div id="lembar-cetak-keuangan-pkk" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-tosca-50 text-tosca-700 rounded-xl border border-tosca-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                Tabel Buku Kas Umum (BKU) Tim Penggerak PKK
              </h2>
              <p className="text-xs text-slate-500">
                Menampilkan {displayTransactions.length} dari {transactions.length} total transaksi tercatat
              </p>
            </div>
          </div>

          {/* Quick Refresh */}
          <button
            onClick={() => {
              const local = getLocalTransaksiPkk();
              setTransactions(local);
              showToast('Tampilan Buku Kas Umum disegarkan.');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Segarkan Data</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 uppercase font-black tracking-wider text-[10px] border-b border-slate-200">
                <th className="py-3 px-3.5 w-12 text-center">No</th>
                <th className="py-3 px-3 w-28">Tanggal</th>
                <th className="py-3 px-3 w-36">No. Bukti</th>
                <th className="py-3 px-4 min-w-[220px]">Uraian Transaksi</th>
                <th className="py-3 px-3 min-w-[150px]">Pos / Pokja</th>
                <th className="py-3 px-3 min-w-[140px]">Lingkungan / Pihak</th>
                <th className="py-3 px-3 text-right w-32 text-tosca-700">Penerimaan (Rp)</th>
                <th className="py-3 px-3 text-right w-32 text-rose-700">Pengeluaran (Rp)</th>
                <th className="py-3 px-3 text-right w-36 text-indigo-900">Saldo Kas (Rp)</th>
                <th className="py-3 px-2 text-center w-16">Bukti</th>
                <th className="py-3 px-3 text-center w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayTransactions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <Wallet className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-600 text-sm">Tidak ada transaksi ditemukan</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Coba sesuaikan filter periode, pos anggaran, atau buat transaksi kas baru.
                    </p>
                  </td>
                </tr>
              ) : (
                displayTransactions.map((tx, idx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3.5 text-center font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      {tx.tanggal}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {tx.nomorBukti || '-'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div>{tx.uraian}</div>
                      {tx.catatan && (
                        <div className="text-[10px] text-slate-400 font-normal italic mt-0.5">
                          Ket: {tx.catatan}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {POS_ANGGARAN_LABELS[tx.posAnggaran] || tx.posAnggaran}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <div className="font-semibold text-slate-800 text-[11px]">
                        {tx.lingkunganNama || 'Kelurahan'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {tx.penerimaPenyetor || tx.sumberDana || '-'}
                      </div>
                    </td>
                    {/* Penerimaan */}
                    <td className="py-3 px-3 text-right font-bold text-tosca-600 whitespace-nowrap">
                      {tx.jenis === 'PENERIMAAN' ? (
                        <span>+{tx.jumlah.toLocaleString('id-ID')}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    {/* Pengeluaran */}
                    <td className="py-3 px-3 text-right font-bold text-rose-600 whitespace-nowrap">
                      {tx.jenis === 'PENGELUARAN' ? (
                        <span>-{tx.jumlah.toLocaleString('id-ID')}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    {/* Saldo Berjalan */}
                    <td className="py-3 px-3 text-right font-black text-slate-900 whitespace-nowrap bg-slate-50/50">
                      Rp {tx.saldoBerjalan.toLocaleString('id-ID')}
                    </td>
                    {/* Lampiran Foto Nota */}
                    <td className="py-3 px-2 text-center">
                      {tx.buktiFotoUrl ? (
                        <button
                          onClick={() => setPreviewPhoto(tx.buktiFotoUrl!)}
                          className="p-1.5 hover:bg-tosca-50 text-tosca-700 rounded-lg transition-all cursor-pointer"
                          title="Lihat Nota / Bukti Kuitansi"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">-</span>
                      )}
                    </td>
                    {/* Aksi */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(tx)}
                          className="p-1.5 text-slate-500 hover:text-tosca-700 hover:bg-tosca-50 rounded-lg transition-all cursor-pointer"
                          title="Edit Transaksi"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id, tx.uraian)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="Hapus Transaksi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer with Summary */}
            {filteredChronologicalTransactions.length > 0 && (
              <tfoot className="bg-slate-100/80 font-black text-slate-800 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={6} className="py-3.5 px-4 text-right uppercase tracking-wider text-[11px]">
                    Total Akumulasi Periode Terpilih ({periodBounds.label}):
                  </td>
                  <td className="py-3.5 px-3 text-right text-tosca-700 whitespace-nowrap">
                    Rp {totals.totalPenerimaan.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3.5 px-3 text-right text-rose-700 whitespace-nowrap">
                    Rp {totals.totalPengeluaran.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3.5 px-3 text-right text-indigo-950 font-black whitespace-nowrap bg-slate-200/60">
                    Rp {totals.saldoAkhir.toLocaleString('id-ID')}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal: Tambah / Edit Transaksi Kas PKK */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-7 relative my-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="p-3 bg-tosca-50 text-tosca-700 rounded-2xl border border-tosca-200">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {isEditing ? 'Edit Transaksi Kas PKK' : 'Catat Transaksi Kas PKK Baru'}
                </h3>
                <p className="text-xs text-slate-500">
                  Buku Kas Umum Tim Penggerak PKK Kelurahan Mangga
                </p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
              {/* Jenis Transaksi: Penerimaan vs Pengeluaran */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Jenis Arus Kas <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormJenis('PENERIMAAN');
                      if (!formNomorBukti || formNomorBukti.startsWith('BKK')) {
                        setFormNomorBukti(generateNomorBukti('PENERIMAAN'));
                      }
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                      formJenis === 'PENERIMAAN'
                        ? 'bg-tosca-600 text-white border-tosca-700 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    <span>Penerimaan (Kas Masuk)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormJenis('PENGELUARAN');
                      if (!formNomorBukti || formNomorBukti.startsWith('BKM')) {
                        setFormNomorBukti(generateNomorBukti('PENGELUARAN'));
                      }
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                      formJenis === 'PENGELUARAN'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Pengeluaran (Kas Keluar)</span>
                  </button>
                </div>
              </div>

              {/* Tanggal & No. Bukti */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tanggal Transaksi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-tosca-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nomor Bukti / Kuitansi
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: BKK-01/PKK/X/2026"
                    value={formNomorBukti}
                    onChange={(e) => setFormNomorBukti(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-tosca-500 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Pos Anggaran / Pokja */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pos Anggaran / Alokasi Pokja <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formPos}
                  onChange={(e) => setFormPos(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-tosca-500 font-medium text-slate-800"
                >
                  {Object.entries(POS_ANGGARAN_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Uraian Transaksi */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Uraian Lengkap Transaksi <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Contoh: Pembelian bahan makanan tambahan (PMT) Posyandu Balita atau Pembelian ATK..."
                  value={formUraian}
                  onChange={(e) => setFormUraian(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-tosca-500"
                />
              </div>

              {/* Nominal Jumlah (Rp) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nominal Transaksi (Rp) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="0"
                    value={formJumlah}
                    onChange={(e) => setFormJumlah(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-tosca-500 font-black text-slate-900 text-sm"
                  />
                </div>
              </div>

              {/* Sumber Dana & Penyetor / Penerima */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Sumber Dana / Kas
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Kas Operasional, Iuran, APBD..."
                    value={formSumberDana}
                    onChange={(e) => setFormSumberDana(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-tosca-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {formJenis === 'PENERIMAAN' ? 'Penyetor / Dari Pihak' : 'Penerima / Toko / Kader'}
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Toko ATK Bersama / Kader..."
                    value={formPenerimaPenyetor}
                    onChange={(e) => setFormPenerimaPenyetor(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-tosca-500"
                  />
                </div>
              </div>

              {/* Alokasi Lingkungan */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alokasi Lingkungan Terkait
                </label>
                <select
                  value={formLingkunganNomor}
                  onChange={(e) => setFormLingkunganNomor(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-tosca-500 font-medium"
                >
                  <option value={0}>TP PKK Kelurahan Mangga (Tingkat Kelurahan)</option>
                  {KEPLING_ACCOUNTS.map((k) => (
                    <option key={k.id} value={k.nomorLingkungan}>
                      {k.lingkungan} ({k.nama})
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload Foto Nota / Bukti Kuitansi */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Lampiran Foto Nota / Kuitansi / Bukti Pembayaran
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition-all border border-slate-200">
                    <Camera className="w-4 h-4 text-tosca-600" />
                    <span>{formBuktiFotoUrl ? 'Ganti Foto Bukti' : 'Lampirkan Foto Nota'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>

                  {formBuktiFotoUrl && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewPhoto(formBuktiFotoUrl)}
                        className="text-tosca-700 hover:underline font-bold"
                      >
                        Lihat Foto
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormBuktiFotoUrl('')}
                        className="text-rose-600 hover:underline"
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-tosca-700 hover:bg-tosca-600 text-white font-black shadow-md cursor-pointer transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Catat ke Buku Kas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Preview Foto Nota */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-4">
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-4 right-4 p-2 bg-slate-900/60 text-white rounded-full hover:bg-slate-900 transition-all cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewPhoto}
              alt="Bukti Kuitansi / Nota Transaksi"
              className="max-h-[80vh] w-auto mx-auto rounded-lg object-contain"
            />
            <div className="text-center mt-3 text-xs text-slate-500 font-bold">
              Bukti Kuitansi / Nota Pembelanjaan PKK
            </div>
          </div>
        </div>
      )}

      {/* Print Document Modal (Format Buku Kas Umum TP PKK) */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full p-4 sm:p-10 shadow-2xl my-4 sm:my-8 relative overflow-hidden max-w-[calc(100vw-1rem)] print:m-0 print:p-0 print:border-none print:shadow-none">
            {/* Modal Header for on-screen controls */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-tosca-700" />
                <h3 className="font-black text-slate-900 text-sm">
                  Pratinjau Cetak Format Resmi Buku Kas Umum PKK
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-tosca-700 hover:bg-tosca-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Simpan PDF</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Document Content */}
            <div className="printable-document space-y-4 text-black font-sans overflow-x-auto w-full">
              <KopSuratPkk />

              <div className="text-center space-y-1 mb-6">
                <h2 className="text-base font-black uppercase tracking-wider underline">
                  BUKU KAS UMUM (BKU)
                </h2>
                <h3 className="text-sm font-bold uppercase">
                  TIM PENGGERAK PKK KELURAHAN MANGGA
                </h3>
                <p className="text-xs font-semibold">
                  Periode: {periodBounds.label}
                </p>
              </div>

              {/* Official BKU Table */}
              <div className="overflow-x-auto w-full">
                <table className="w-full text-[10pt] border-collapse border border-black min-w-[600px] sm:min-w-full">
                <thead>
                  <tr className="bg-gray-100 text-center font-bold">
                    <th className="border border-black p-1.5 w-8">No</th>
                    <th className="border border-black p-1.5 w-24">Tanggal</th>
                    <th className="border border-black p-1.5 w-28">No. Bukti</th>
                    <th className="border border-black p-1.5">Uraian Transaksi</th>
                    <th className="border border-black p-1.5 w-28">Pos / Pokja</th>
                    <th className="border border-black p-1.5 text-right w-28">Penerimaan (Rp)</th>
                    <th className="border border-black p-1.5 text-right w-28">Pengeluaran (Rp)</th>
                    <th className="border border-black p-1.5 text-right w-28">Saldo Kas (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChronologicalTransactions.map((tx, idx) => (
                    <tr key={tx.id}>
                      <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                      <td className="border border-black p-1.5 text-center whitespace-nowrap">{tx.tanggal}</td>
                      <td className="border border-black p-1.5 text-center font-mono text-[9pt]">{tx.nomorBukti || '-'}</td>
                      <td className="border border-black p-1.5 font-medium">{tx.uraian}</td>
                      <td className="border border-black p-1.5 text-center text-[9pt]">
                        {POS_ANGGARAN_LABELS[tx.posAnggaran] || tx.posAnggaran}
                      </td>
                      <td className="border border-black p-1.5 text-right">
                        {tx.masuk > 0 ? tx.masuk.toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="border border-black p-1.5 text-right">
                        {tx.keluar > 0 ? tx.keluar.toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="border border-black p-1.5 text-right font-bold">
                        {tx.saldoBerjalan.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={5} className="border border-black p-2 text-right uppercase">
                      Jumlah Akumulasi:
                    </td>
                    <td className="border border-black p-2 text-right">
                      Rp {totals.totalPenerimaan.toLocaleString('id-ID')}
                    </td>
                    <td className="border border-black p-2 text-right">
                      Rp {totals.totalPengeluaran.toLocaleString('id-ID')}
                    </td>
                    <td className="border border-black p-2 text-right">
                      Rp {totals.saldoAkhir.toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>

              {/* Official Signatures */}
              <div className="pt-8 grid grid-cols-2 text-center text-xs font-semibold gap-6 break-inside-avoid">
                <div>
                  <p>Mengetahui,</p>
                  <p className="font-bold">Ketua Tim Penggerak PKK</p>
                  <p>Kelurahan Mangga</p>
                  <div className="h-20" />
                  <p className="font-bold underline uppercase">( ............................................ )</p>
                </div>

                <div>
                  <p>Medan, {formatTanggalIndonesia(new Date())}</p>
                  <p className="font-bold">Bendahara Tim Penggerak PKK</p>
                  <p>Kelurahan Mangga</p>
                  <div className="h-20" />
                  <p className="font-bold underline uppercase">( ............................................ )</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
