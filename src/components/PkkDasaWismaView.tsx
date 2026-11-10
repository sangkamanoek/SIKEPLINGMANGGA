import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Share2,
  Trash2,
  Edit3,
  CheckCircle2,
  Baby,
  Heart,
  Home,
  Check,
  ChevronRight,
  ShieldCheck,
  Building,
  RefreshCw,
  X,
  Phone,
  Sparkles,
  Info,
} from 'lucide-react';
import { UserAccount, PkkDasaWismaItem, isPkkRole } from '../types';
import {
  subscribeDasaWisma,
  saveDasaWisma,
  deleteDasaWisma,
  getLocalDasaWismaList,
} from '../lib/pkkDasaWismaService';
import { PKK_LOGO_BASE64 } from '../assets/logoPkkBase64';

interface PkkDasaWismaViewProps {
  currentUser: UserAccount;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PkkDasaWismaView: React.FC<PkkDasaWismaViewProps> = ({
  currentUser,
  onShowToast,
}) => {
  const isSuperAdmin = currentUser.role === 'super_admin';
  const isPkkKelurahan =
    currentUser.role === 'ketua_pkk_kelurahan' ||
    currentUser.role === 'sekretaris_pkk' ||
    currentUser.role === 'ketua_pokja';
  const isLingkunganRestricted = !isSuperAdmin && !isPkkKelurahan;

  // Selected Lingkungan Filter:
  // If user is restricted to a specific lingkungan, lock to it; otherwise default to 'all' or user's lingkungan
  const defaultLingkungan = isLingkunganRestricted
    ? String(currentUser.nomorLingkungan || 1)
    : currentUser.nomorLingkungan
    ? String(currentUser.nomorLingkungan)
    : 'all';

  const [selectedLingkungan, setSelectedLingkungan] = useState<string>(defaultLingkungan);
  const [items, setItems] = useState<PkkDasaWismaItem[]>(() => getLocalDasaWismaList());
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PkkDasaWismaItem | null>(null);
  const [copiedWa, setCopiedWa] = useState(false);

  // Form State
  const [formNamaKelompok, setFormNamaKelompok] = useState('');
  const [formLingkungan, setFormLingkungan] = useState<number>(
    currentUser.nomorLingkungan || 1
  );
  const [formNamaKetua, setFormNamaKetua] = useState('');
  const [formTelepon, setFormTelepon] = useState('');
  const [formRtRw, setFormRtRw] = useState('');
  const [formJumlahKk, setFormJumlahKk] = useState<string>('10');
  const [formJumlahJiwa, setFormJumlahJiwa] = useState<string>('35');
  const [formJumlahBumil, setFormJumlahBumil] = useState<string>('0');
  const [formJumlahBalita, setFormJumlahBalita] = useState<string>('2');
  const [formJumlahLansia, setFormJumlahLansia] = useState<string>('3');
  const [formJumlahJamban, setFormJumlahJamban] = useState<string>('10');
  const [formKegiatanUtama, setFormKegiatanUtama] = useState('');
  const [formCatatan, setFormCatatan] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsub = subscribeDasaWisma((liveItems) => {
      setItems(liveItems);
    });
    return () => unsub();
  }, []);

  // Filtered Items (strictly separated by lingkungan or all for Superadmin)
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Lingkungan filter
      if (selectedLingkungan !== 'all') {
        const targetNum = Number(selectedLingkungan);
        if (item.lingkunganNomor !== targetNum) return false;
      }
      // 2. Search query filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchNama = (item.namaKelompok || '').toLowerCase().includes(q);
        const matchKetua = (item.namaKetua || '').toLowerCase().includes(q);
        const matchRt = (item.rtRw || '').toLowerCase().includes(q);
        if (!matchNama && !matchKetua && !matchRt) return false;
      }
      return true;
    });
  }, [items, selectedLingkungan, searchTerm]);

  // Aggregate KPI metrics (calculated directly in memory without heavy joins)
  const kpiStats = useMemo(() => {
    let totalKk = 0;
    let totalJiwa = 0;
    let totalBumil = 0;
    let totalBalita = 0;
    let totalLansia = 0;
    let totalJamban = 0;

    filteredItems.forEach((it) => {
      totalKk += Number(it.jumlahKk) || 0;
      totalJiwa += Number(it.jumlahJiwa) || 0;
      totalBumil += Number(it.jumlahIbuHamil) || 0;
      totalBalita += Number(it.jumlahBalita) || 0;
      totalLansia += Number(it.jumlahLansia) || 0;
      totalJamban += Number(it.jumlahJambanSehat) || 0;
    });

    return {
      totalKelompok: filteredItems.length,
      totalKk,
      totalJiwa,
      totalBumil,
      totalBalita,
      totalLansia,
      totalJamban,
    };
  }, [filteredItems]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormNamaKelompok('');
    setFormLingkungan(
      selectedLingkungan !== 'all'
        ? Number(selectedLingkungan)
        : currentUser.nomorLingkungan || 1
    );
    setFormNamaKetua('');
    setFormTelepon('');
    setFormRtRw('');
    setFormJumlahKk('10');
    setFormJumlahJiwa('35');
    setFormJumlahBumil('0');
    setFormJumlahBalita('2');
    setFormJumlahLansia('3');
    setFormJumlahJamban('10');
    setFormKegiatanUtama('Pemeriksaan jentik berkala, Posyandu, & pemilahan sampah');
    setFormCatatan('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (it: PkkDasaWismaItem) => {
    setEditingItem(it);
    setFormNamaKelompok(it.namaKelompok || '');
    setFormLingkungan(it.lingkunganNomor || 1);
    setFormNamaKetua(it.namaKetua || '');
    setFormTelepon(it.teleponKetua || '');
    setFormRtRw(it.rtRw || '');
    setFormJumlahKk(String(it.jumlahKk ?? 10));
    setFormJumlahJiwa(String(it.jumlahJiwa ?? 35));
    setFormJumlahBumil(String(it.jumlahIbuHamil ?? 0));
    setFormJumlahBalita(String(it.jumlahBalita ?? 0));
    setFormJumlahLansia(String(it.jumlahLansia ?? 0));
    setFormJumlahJamban(String(it.jumlahJambanSehat ?? 0));
    setFormKegiatanUtama(it.kegiatanUtama || '');
    setFormCatatan(it.catatan || '');
    setIsModalOpen(true);
  };

  // Save Modal
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNamaKelompok.trim()) {
      onShowToast?.('Nama Kelompok Dasa Wisma wajib diisi', 'error');
      return;
    }
    if (!formNamaKetua.trim()) {
      onShowToast?.('Nama Ketua Dasa Wisma wajib diisi', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const payload: PkkDasaWismaItem = {
        id: editingItem ? editingItem.id : `dawis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        namaKelompok: formNamaKelompok.trim(),
        lingkunganNomor: Number(formLingkungan),
        namaKetua: formNamaKetua.trim(),
        teleponKetua: formTelepon.trim() || undefined,
        rtRw: formRtRw.trim() || undefined,
        jumlahAnggota: Number(formJumlahKk) || 10,
        jumlahKk: Number(formJumlahKk) || 0,
        jumlahJiwa: Number(formJumlahJiwa) || 0,
        jumlahIbuHamil: Number(formJumlahBumil) || 0,
        jumlahBalita: Number(formJumlahBalita) || 0,
        jumlahLansia: Number(formJumlahLansia) || 0,
        jumlahJambanSehat: Number(formJumlahJamban) || 0,
        kegiatanUtama: formKegiatanUtama.trim() || undefined,
        catatan: formCatatan.trim() || undefined,
        createdAt: editingItem?.createdAt || now,
        updatedAt: now,
      };

      await saveDasaWisma(payload);
      setIsModalOpen(false);
      onShowToast?.(
        editingItem ? 'Data Dasa Wisma berhasil diperbarui!' : 'Kelompok Dasa Wisma baru berhasil ditambahkan!',
        'success'
      );
    } catch (err) {
      console.error(err);
      onShowToast?.('Gagal menyimpan data Dasa Wisma', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Action
  const handleDelete = async (id: string, nama: string) => {
    if (window.confirm(`Yakin ingin menghapus kelompok "${nama}"?`)) {
      try {
        await deleteDasaWisma(id);
        onShowToast?.(`Kelompok "${nama}" berhasil dihapus`, 'info');
      } catch (err) {
        console.error(err);
        onShowToast?.('Gagal menghapus data', 'error');
      }
    }
  };

  // Copy WhatsApp Summary
  const handleCopyWa = useCallback(() => {
    const lingkLabel =
      selectedLingkungan === 'all'
        ? 'Se-Kelurahan Mangga (24 Lingkungan)'
        : `Lingkungan ${selectedLingkungan}`;

    let text = `*REKAPITULASI DASA WISMA TP-PKK KELURAHAN MANGGA*\n`;
    text += `Wilayah: ${lingkLabel}\n`;
    text += `Waktu Cetak: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}\n\n`;
    text += `*RINGKASAN INDIKATOR UTAMA:*\n`;
    text += `• Total Kelompok Dasa Wisma: ${kpiStats.totalKelompok} Kelompok\n`;
    text += `• Total KK / Rumah Binaan: ${kpiStats.totalKk} KK\n`;
    text += `• Total Jiwa Binaan: ${kpiStats.totalJiwa} Jiwa\n`;
    text += `• Total Ibu Hamil: ${kpiStats.totalBumil} Orang\n`;
    text += `• Total Balita: ${kpiStats.totalBalita} Anak\n`;
    text += `• Total Lansia: ${kpiStats.totalLansia} Jiwa\n`;
    text += `• Jamban Sehat: ${kpiStats.totalJamban} Rumah\n\n`;

    text += `*DAFTAR KELOMPOK:*\n`;
    filteredItems.forEach((it, idx) => {
      text += `${idx + 1}. *${it.namaKelompok}* (Lingk. ${it.lingkunganNomor})\n`;
      text += `   - Ketua: ${it.namaKetua}${it.teleponKetua ? ` (${it.teleponKetua})` : ''}\n`;
      text += `   - KK: ${it.jumlahKk || 0} | Jiwa: ${it.jumlahJiwa || 0} | Balita: ${it.jumlahBalita || 0} | Bumil: ${it.jumlahIbuHamil || 0}\n`;
      if (it.kegiatanUtama) text += `   - Kegiatan: ${it.kegiatanUtama}\n`;
    });

    text += `\n#PKKKELURAHANMANGGA #DASAWISMA`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedWa(true);
      setTimeout(() => setCopiedWa(false), 3000);
      onShowToast?.('Rangkuman WhatsApp berhasil disalin ke clipboard!', 'success');
    });
  }, [selectedLingkungan, kpiStats, filteredItems, onShowToast]);

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-pkk-teal text-white shadow-xl p-6 sm:p-8 border border-pkk-dark">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-tosca-100 text-xs font-bold tracking-wide shadow-xs">
              <div className="w-6 h-6 rounded-full bg-white p-0.5 flex items-center justify-center shrink-0">
                <img src={PKK_LOGO_BASE64} alt="Logo PKK" className="w-full h-full object-contain" />
              </div>
              <span>TIM PENGGERAK PKK KELURAHAN MANGGA</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <Users className="w-7 h-7 text-amber-300 shrink-0" />
              <span>Rekapitulasi Dasa Wisma 24 Lingkungan</span>
            </h1>
            <p className="text-xs sm:text-sm text-tosca-100 max-w-2xl leading-relaxed">
              Pencatatan data kelompok Dasa Wisma per-lingkungan secara independen, memuat informasi ketua kelompok, binaan KK, ibu hamil, balita, dan jamban sehat.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyWa}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer border border-emerald-400/40"
              title="Salin rekapitulasi ke format pesan WhatsApp"
            >
              {copiedWa ? <Check className="w-4 h-4 text-white" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedWa ? 'Tersalin!' : 'Bagikan WA'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Kelompok</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Kelompok</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{kpiStats.totalKelompok}</p>
          <p className="text-[10px] text-teal-700 font-bold mt-1">Dasa Wisma Aktif</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">KK Binaan</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{kpiStats.totalKk.toLocaleString('id-ID')}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-1">Kepala Keluarga</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Jiwa</p>
          <p className="text-2xl font-black text-blue-700 mt-1">{kpiStats.totalJiwa.toLocaleString('id-ID')}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-1">Warga Terdata</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ibu Hamil</p>
          <p className="text-2xl font-black text-rose-700 mt-1">{kpiStats.totalBumil}</p>
          <p className="text-[10px] text-rose-700 font-bold mt-1">Prioritas Gizi</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Balita</p>
          <p className="text-2xl font-black text-amber-700 mt-1">{kpiStats.totalBalita}</p>
          <p className="text-[10px] text-amber-700 font-bold mt-1">Pantau Posyandu</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Jamban Sehat</p>
          <p className="text-2xl font-black text-teal-700 mt-1">{kpiStats.totalJamban}</p>
          <p className="text-[10px] text-teal-700 font-bold mt-1">Sanitasi Terpenuhi</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Lingkungan Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-bold text-slate-700 shrink-0">Pilih Lingkungan:</span>
          {isLingkunganRestricted ? (
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-950 font-bold text-xs rounded-xl border border-emerald-200">
              Lingkungan {selectedLingkungan}
            </span>
          ) : (
            <select
              value={selectedLingkungan}
              onChange={(e) => setSelectedLingkungan(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Semua 24 Lingkungan</option>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((num) => (
                <option key={num} value={String(num)}>
                  Lingkungan {num}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari kelompok, ketua, RT..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-300 text-xs font-medium rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Dasa Wisma Cards List */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-14 h-14 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-slate-800">
            Belum ada kelompok Dasa Wisma terdaftar
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {selectedLingkungan === 'all'
              ? 'Silakan tambahkan kelompok Dasa Wisma pertama untuk memulai pendataan.'
              : `Belum ada kelompok Dasa Wisma yang dicatat untuk Lingkungan ${selectedLingkungan}. Klik tombol di bawah untuk menambahkan.`}
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-pkk-teal hover:bg-pkk-dark text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Dasa Wisma Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-teal-50 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />

              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-black uppercase tracking-wide mb-1">
                      Lingkungan {item.lingkunganNomor}
                      {item.rtRw ? ` • ${item.rtRw}` : ''}
                    </span>
                    <h2 className="text-base font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                      {item.namaKelompok}
                    </h2>
                  </div>
                </div>

                {/* Ketua Info */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Ketua Kelompok:</span>
                    <span className="font-bold text-slate-900">{item.namaKetua}</span>
                  </div>
                  {item.teleponKetua && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" /> Kontak:
                      </span>
                      <a
                        href={`https://wa.me/${item.teleponKetua.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-emerald-600 hover:underline"
                      >
                        {item.teleponKetua}
                      </a>
                    </div>
                  )}
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                  <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-100">
                    <p className="text-[10px] text-emerald-800 font-bold">KK Binaan</p>
                    <p className="text-sm font-black text-emerald-950 mt-0.5">{item.jumlahKk || 0}</p>
                  </div>
                  <div className="bg-blue-50/60 p-2 rounded-xl border border-blue-100">
                    <p className="text-[10px] text-blue-800 font-bold">Jiwa</p>
                    <p className="text-sm font-black text-blue-950 mt-0.5">{item.jumlahJiwa || 0}</p>
                  </div>
                  <div className="bg-amber-50/60 p-2 rounded-xl border border-amber-100">
                    <p className="text-[10px] text-amber-800 font-bold">Balita</p>
                    <p className="text-sm font-black text-amber-950 mt-0.5">{item.jumlahBalita || 0}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs mb-3">
                  <div className="bg-rose-50/60 p-1.5 rounded-xl border border-rose-100 flex items-center justify-between px-3">
                    <span className="text-[10px] text-rose-800 font-bold">Ibu Hamil:</span>
                    <span className="text-xs font-black text-rose-950">{item.jumlahIbuHamil || 0}</span>
                  </div>
                  <div className="bg-teal-50/60 p-1.5 rounded-xl border border-teal-100 flex items-center justify-between px-3">
                    <span className="text-[10px] text-teal-800 font-bold">Jamban Sehat:</span>
                    <span className="text-xs font-black text-teal-950">{item.jumlahJambanSehat || 0}</span>
                  </div>
                </div>

                {item.kegiatanUtama && (
                  <p className="text-[11px] text-slate-600 line-clamp-2 mb-2 italic">
                    "{item.kegiatanUtama}"
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400">
                  {item.updatedAt ? `Update ${new Date(item.updatedAt).toLocaleDateString('id-ID')}` : 'Tersimpan'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 transition-colors cursor-pointer"
                    title="Edit Dasa Wisma"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id, item.namaKelompok)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 transition-colors cursor-pointer"
                    title="Hapus Kelompok"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form Tambah / Edit Dasa Wisma */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 my-8">
            <div className="bg-pkk-teal text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingItem ? 'Edit Kelompok Dasa Wisma' : 'Tambah Kelompok Dasa Wisma'}
                  </h3>
                  <p className="text-xs text-tosca-100">
                    Formulir resmi pencatatan Dasa Wisma TP-PKK
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Lingkungan & RT/RW */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lingkungan <span className="text-rose-500">*</span>
                  </label>
                  {isLingkunganRestricted ? (
                    <input
                      type="text"
                      disabled
                      value={`Lingkungan ${currentUser.nomorLingkungan || 1}`}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
                    />
                  ) : (
                    <select
                      value={formLingkungan}
                      onChange={(e) => setFormLingkungan(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500"
                    >
                      {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          Lingkungan {n}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    RT / RW / Gang
                  </label>
                  <input
                    type="text"
                    value={formRtRw}
                    onChange={(e) => setFormRtRw(e.target.value)}
                    placeholder="Contoh: RT 02 / RW 01"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Nama Kelompok */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Kelompok Dasa Wisma <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNamaKelompok}
                  onChange={(e) => setFormNamaKelompok(e.target.value)}
                  placeholder="Contoh: Dasa Wisma Mawar I"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Ketua & No Telepon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Ketua Kelompok <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formNamaKetua}
                    onChange={(e) => setFormNamaKetua(e.target.value)}
                    placeholder="Contoh: Ny. Sri Wahyuni"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="tel"
                    value={formTelepon}
                    onChange={(e) => setFormTelepon(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Indikator Numerik */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-teal-600" />
                  <span>Statistik Binaan Warga (Standar Dasa Wisma)</span>
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Jumlah KK
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formJumlahKk}
                      onChange={(e) => setFormJumlahKk(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Jumlah Jiwa
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formJumlahJiwa}
                      onChange={(e) => setFormJumlahJiwa(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Ibu Hamil
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formJumlahBumil}
                      onChange={(e) => setFormJumlahBumil(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Anak Balita
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formJumlahBalita}
                      onChange={(e) => setFormJumlahBalita(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Warga Lansia
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formJumlahLansia}
                      onChange={(e) => setFormJumlahLansia(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Jamban Sehat
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formJumlahJamban}
                      onChange={(e) => setFormJumlahJamban(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Kegiatan Utama & Catatan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kegiatan Utama Kelompok
                </label>
                <input
                  type="text"
                  value={formKegiatanUtama}
                  onChange={(e) => setFormKegiatanUtama(e.target.value)}
                  placeholder="Contoh: Gotong royong sabtu, senam lansia, Posyandu"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Tambahan
                </label>
                <textarea
                  rows={2}
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  placeholder="Keterangan kondisi lingkungan atau binaan khusus..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-pkk-teal hover:bg-pkk-dark text-white font-extrabold text-xs shadow-md transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingItem ? 'Perbarui Data' : 'Simpan Dasa Wisma'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
