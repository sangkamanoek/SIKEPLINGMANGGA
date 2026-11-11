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
import { KopSuratPkk } from './KopSuratPkk';
import { VirtualList } from './VirtualList';

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
  const [formJumlahJiwaLaki, setFormJumlahJiwaLaki] = useState<string>('17');
  const [formJumlahJiwaPerempuan, setFormJumlahJiwaPerempuan] = useState<string>('18');
  const [formJumlahRumah, setFormJumlahRumah] = useState<string>('10');
  
  const [formJumlahBumil, setFormJumlahBumil] = useState<string>('0');
  const [formJumlahBusui, setFormJumlahBusui] = useState<string>('0');
  const [formJumlahBalita, setFormJumlahBalita] = useState<string>('2');
  const [formJumlahLansia, setFormJumlahLansia] = useState<string>('3');
  
  const [formJumlahPus, setFormJumlahPus] = useState<string>('0');
  const [formJumlahWus, setFormJumlahWus] = useState<string>('0');
  const [formJumlahButaAksara, setFormJumlahButaAksara] = useState<string>('0');
  const [formJumlahBerkebutuhanKhusus, setFormJumlahBerkebutuhanKhusus] = useState<string>('0');
  
  const [formJumlahJamban, setFormJumlahJamban] = useState<string>('10');
  const [formJumlahSpal, setFormJumlahSpal] = useState<string>('10');
  const [formJumlahSampah, setFormJumlahTempatSampah] = useState<string>('10');
  const [formJumlahPekarangan, setFormJumlahPekarangan] = useState<string>('0');
  const [formJumlahIndustri, setFormJumlahIndustri] = useState<string>('0');

  // Auto-calculate Total Jiwa
  useEffect(() => {
    const l = Number(formJumlahJiwaLaki) || 0;
    const p = Number(formJumlahJiwaPerempuan) || 0;
    setFormJumlahJiwa(String(l + p));
  }, [formJumlahJiwaLaki, formJumlahJiwaPerempuan]);

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
    let totalJiwaLaki = 0;
    let totalJiwaPerempuan = 0;
    let totalBumil = 0;
    let totalBusui = 0;
    let totalBalita = 0;
    let totalLansia = 0;
    let totalPus = 0;
    let totalWus = 0;
    let totalButaAksara = 0;
    let totalBerkebutuhanKhusus = 0;
    let totalJamban = 0;
    let totalSpal = 0;
    let totalSampah = 0;
    let totalPekarangan = 0;
    let totalIndustri = 0;

    filteredItems.forEach((it) => {
      totalKk += Number(it.jumlahKk) || 0;
      totalJiwa += Number(it.jumlahJiwa) || 0;
      totalJiwaLaki += Number(it.jumlahJiwaLaki) || 0;
      totalJiwaPerempuan += Number(it.jumlahJiwaPerempuan) || 0;
      totalBumil += Number(it.jumlahIbuHamil) || 0;
      totalBusui += Number(it.jumlahIbuMenyusui) || 0;
      totalBalita += Number(it.jumlahBalita) || 0;
      totalLansia += Number(it.jumlahLansia) || 0;
      totalPus += Number(it.jumlahPus) || 0;
      totalWus += Number(it.jumlahWus) || 0;
      totalButaAksara += Number(it.jumlahButaAksara) || 0;
      totalBerkebutuhanKhusus += Number(it.jumlahBerkebutuhanKhusus) || 0;
      totalJamban += Number(it.jumlahJambanSehat) || 0;
      totalSpal += Number(it.jumlahSpal) || 0;
      totalSampah += Number(it.jumlahTempatSampah) || 0;
      totalPekarangan += Number(it.jumlahPekaranganManfaat) || 0;
      totalIndustri += Number(it.jumlahIndustriRumah) || 0;
    });

    return {
      totalKelompok: filteredItems.length,
      totalKk,
      totalJiwa,
      totalJiwaLaki,
      totalJiwaPerempuan,
      totalBumil,
      totalBusui,
      totalBalita,
      totalLansia,
      totalPus,
      totalWus,
      totalButaAksara,
      totalBerkebutuhanKhusus,
      totalJamban,
      totalSpal,
      totalSampah,
      totalPekarangan,
      totalIndustri,
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
    setFormJumlahJiwaLaki('17');
    setFormJumlahJiwaPerempuan('18');
    setFormJumlahRumah('10');
    setFormJumlahBumil('0');
    setFormJumlahBusui('0');
    setFormJumlahBalita('2');
    setFormJumlahLansia('3');
    setFormJumlahPus('5');
    setFormJumlahWus('8');
    setFormJumlahButaAksara('0');
    setFormJumlahBerkebutuhanKhusus('0');
    setFormJumlahJamban('10');
    setFormJumlahSpal('10');
    setFormJumlahTempatSampah('10');
    setFormJumlahPekarangan('5');
    setFormJumlahIndustri('0');
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
    setFormJumlahKk(String(it.jumlahKk ?? 0));
    setFormJumlahJiwa(String(it.jumlahJiwa ?? 0));
    setFormJumlahJiwaLaki(String(it.jumlahJiwaLaki ?? 0));
    setFormJumlahJiwaPerempuan(String(it.jumlahJiwaPerempuan ?? 0));
    setFormJumlahRumah(String(it.jumlahRumah ?? 0));
    setFormJumlahBumil(String(it.jumlahIbuHamil ?? 0));
    setFormJumlahBusui(String(it.jumlahIbuMenyusui ?? 0));
    setFormJumlahBalita(String(it.jumlahBalita ?? 0));
    setFormJumlahLansia(String(it.jumlahLansia ?? 0));
    setFormJumlahPus(String(it.jumlahPus ?? 0));
    setFormJumlahWus(String(it.jumlahWus ?? 0));
    setFormJumlahButaAksara(String(it.jumlahButaAksara ?? 0));
    setFormJumlahBerkebutuhanKhusus(String(it.jumlahBerkebutuhanKhusus ?? 0));
    setFormJumlahJamban(String(it.jumlahJambanSehat ?? 0));
    setFormJumlahSpal(String(it.jumlahSpal ?? 0));
    setFormJumlahTempatSampah(String(it.jumlahTempatSampah ?? 0));
    setFormJumlahPekarangan(String(it.jumlahPekaranganManfaat ?? 0));
    setFormJumlahIndustri(String(it.jumlahIndustriRumah ?? 0));
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
        jumlahRumah: Number(formJumlahRumah) || 0,
        jumlahKk: Number(formJumlahKk) || 0,
        jumlahJiwa: Number(formJumlahJiwa) || 0,
        jumlahJiwaLaki: Number(formJumlahJiwaLaki) || 0,
        jumlahJiwaPerempuan: Number(formJumlahJiwaPerempuan) || 0,
        jumlahIbuHamil: Number(formJumlahBumil) || 0,
        jumlahIbuMenyusui: Number(formJumlahBusui) || 0,
        jumlahBalita: Number(formJumlahBalita) || 0,
        jumlahLansia: Number(formJumlahLansia) || 0,
        jumlahPus: Number(formJumlahPus) || 0,
        jumlahWus: Number(formJumlahWus) || 0,
        jumlahButaAksara: Number(formJumlahButaAksara) || 0,
        jumlahBerkebutuhanKhusus: Number(formJumlahBerkebutuhanKhusus) || 0,
        jumlahJambanSehat: Number(formJumlahJamban) || 0,
        jumlahSpal: Number(formJumlahSpal) || 0,
        jumlahTempatSampah: Number(formJumlahSampah) || 0,
        jumlahPekaranganManfaat: Number(formJumlahPekarangan) || 0,
        jumlahIndustriRumah: Number(formJumlahIndustri) || 0,
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
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer border border-slate-600"
              title="Cetak laporan lengkap dengan Kop Surat"
            >
              <Building className="w-4 h-4" />
              <span>Cetak</span>
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

      {/* Dasa Wisma Cards List (Optimized with Virtual Windowing for Anti-OOM) */}
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
        <VirtualList
          items={filteredItems}
          itemHeight={320}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          renderItem={(item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between relative overflow-hidden group h-full mb-4"
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
                    <span className="text-slate-500 font-medium">Ketua:</span>
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

                {/* Main Stats Grid */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                  <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-100">
                    <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-tighter">KK</p>
                    <p className="text-sm font-black text-emerald-950 mt-0.5">{item.jumlahKk || 0}</p>
                  </div>
                  <div className="bg-blue-50/60 p-2 rounded-xl border border-blue-100">
                    <p className="text-[10px] text-blue-800 font-bold uppercase tracking-tighter">Jiwa</p>
                    <p className="text-sm font-black text-blue-950 mt-0.5">{item.jumlahJiwa || 0}</p>
                  </div>
                  <div className="bg-amber-50/60 p-2 rounded-xl border border-amber-100">
                    <p className="text-[10px] text-amber-800 font-bold uppercase tracking-tighter">Balita</p>
                    <p className="text-sm font-black text-amber-950 mt-0.5">{item.jumlahBalita || 0}</p>
                  </div>
                </div>

                {/* Sub Stats Row */}
                <div className="grid grid-cols-2 gap-2 text-center text-xs mb-3">
                  <div className="bg-rose-50/60 p-1.5 rounded-xl border border-rose-100 flex items-center justify-between px-3">
                    <span className="text-[10px] text-rose-800 font-bold uppercase">Bumil:</span>
                    <span className="text-xs font-black text-rose-950">{item.jumlahIbuHamil || 0}</span>
                  </div>
                  <div className="bg-indigo-50/60 p-1.5 rounded-xl border border-indigo-100 flex items-center justify-between px-3">
                    <span className="text-[10px] text-indigo-800 font-bold uppercase">Busui:</span>
                    <span className="text-xs font-black text-indigo-950">{item.jumlahIbuMenyusui || 0}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between px-2 text-[10px] text-slate-500 mb-2">
                  <span className="flex items-center gap-1"><Home className="w-2.5 h-2.5" /> Rumah: <strong>{item.jumlahRumah || 0}</strong></span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> Jamban: <strong>{item.jumlahJambanSehat || 0}</strong></span>
                </div>

                {item.kegiatanUtama && (
                  <p className="text-[11px] text-slate-600 line-clamp-1 mb-2 italic">
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
          )}
        />
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

              {/* Indikator Numerik Terpadu (Sesuai Standar PKK) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5 mb-3">
                    <Info className="w-3.5 h-3.5 text-teal-600" />
                    <span>Statistik Dasar Keluarga & Jiwa</span>
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Jumlah Rumah</label>
                      <input type="number" min="0" value={formJumlahRumah} onChange={(e) => setFormJumlahRumah(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Jumlah KK</label>
                      <input type="number" min="0" value={formJumlahKk} onChange={(e) => setFormJumlahKk(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Total Jiwa (L+P)</label>
                      <input type="number" readOnly value={formJumlahJiwa} className="w-full px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-black text-emerald-800" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Laki-laki</label>
                      <input type="number" min="0" value={formJumlahJiwaLaki} onChange={(e) => setFormJumlahJiwaLaki(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Perempuan</label>
                      <input type="number" min="0" value={formJumlahJiwaPerempuan} onChange={(e) => setFormJumlahJiwaPerempuan(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 mb-3">Prioritas Kesehatan & Lansia</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Ibu Hamil</label>
                      <input type="number" min="0" value={formJumlahBumil} onChange={(e) => setFormJumlahBumil(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Ibu Menyusui</label>
                      <input type="number" min="0" value={formJumlahBusui} onChange={(e) => setFormJumlahBusui(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Balita</label>
                      <input type="number" min="0" value={formJumlahBalita} onChange={(e) => setFormJumlahBalita(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Lansia</label>
                      <input type="number" min="0" value={formJumlahLansia} onChange={(e) => setFormJumlahLansia(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 mb-3">Keluarga Berencana & Literasi</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">PUS (Pasangan)</label>
                      <input type="number" min="0" value={formJumlahPus} onChange={(e) => setFormJumlahPus(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">WUS (Wanita)</label>
                      <input type="number" min="0" value={formJumlahWus} onChange={(e) => setFormJumlahWus(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Buta Aksara</label>
                      <input type="number" min="0" value={formJumlahButaAksara} onChange={(e) => setFormJumlahButaAksara(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Disabilitas</label>
                      <input type="number" min="0" value={formJumlahBerkebutuhanKhusus} onChange={(e) => setFormJumlahBerkebutuhanKhusus(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 mb-3">Kesehatan Lingkungan (Sanitasi)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Jamban Sehat</label>
                      <input type="number" min="0" value={formJumlahJamban} onChange={(e) => setFormJumlahJamban(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">SPAL Terpadu</label>
                      <input type="number" min="0" value={formJumlahSpal} onChange={(e) => setFormJumlahSpal(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Tempat Sampah</label>
                      <input type="number" min="0" value={formJumlahSampah} onChange={(e) => setFormJumlahTempatSampah(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Pekarangan Aktif</label>
                      <input type="number" min="0" value={formJumlahPekarangan} onChange={(e) => setFormJumlahPekarangan(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Industri Rumah</label>
                      <input type="number" min="0" value={formJumlahIndustri} onChange={(e) => setFormJumlahIndustri(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
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
      {/* Hidden Printable Section */}
      <div className="hidden print:block print:w-full print:p-0">
        <style>{`
          @media print {
            @page { margin: 15mm 15mm 15mm 20mm; }
            body * { visibility: hidden; }
            #printable-report, #printable-report * { visibility: visible; }
            #printable-report { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}</style>
        <div id="printable-report" className="p-8">
          <KopSuratPkk />
          <div className="mt-8 mb-6 text-center space-y-1">
            <h2 className="text-2xl font-black text-black underline">REKAPITULASI DATA KELOMPOK DASA WISMA</h2>
            <p className="text-sm font-bold text-black uppercase">
              WILAYAH: {selectedLingkungan === 'all' ? 'SELURUH 24 LINGKUNGAN' : `LINGKUNGAN ${selectedLingkungan}`}
            </p>
            <p className="text-xs text-slate-700 italic">
              Dicetak pada: {new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })} pukul {new Date().toLocaleTimeString('id-ID')} WIB
            </p>
          </div>

          <table className="w-full text-[7px] border-collapse border border-black text-black leading-tight">
            <thead>
              <tr className="bg-slate-100">
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[20px]">No</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-left">Nama Kelompok</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-left">Ketua</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[40px]">RT/RW</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[20px]">Rmh</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[20px]">KK</th>
                <th colSpan={3} className="border border-black p-0.5 font-black uppercase text-center">Jumlah Jiwa</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[18px]">Bml</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[18px]">Bsi</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[18px]">Blt</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[18px]">Lns</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[18px]">PUS</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[18px]">WUS</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[18px]">BA</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[18px]">Dis</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[18px]">Jbn</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[18px]">SPL</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[18px]">Smp</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[18px]">Pkr</th>
                <th rowSpan={2} className="border border-black p-0.5 font-black uppercase text-center w-[18px]">Ind</th>
              </tr>
              <tr className="bg-slate-100">
                <th className="border border-black p-0.5 font-black uppercase text-center w-[20px]">L</th>
                <th className="border border-black p-0.5 font-black uppercase text-center w-[20px]">P</th>
                <th className="border border-black p-0.5 font-black uppercase text-center w-[20px]">T</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={22} className="border border-black p-8 text-center italic text-slate-400">
                    Belum ada data Kelompok Dasa Wisma untuk wilayah ini.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="border border-black p-0.5 text-center">{idx + 1}</td>
                    <td className="border border-black p-0.5 font-bold uppercase">{item.namaKelompok}</td>
                    <td className="border border-black p-0.5">{item.namaKetua}</td>
                    <td className="border border-black p-0.5 text-center">{item.rtRw || '-'}</td>
                    <td className="border border-black p-0.5 text-center">{item.jumlahRumah}</td>
                    <td className="border border-black p-0.5 text-center font-bold">{item.jumlahKk}</td>
                    <td className="border border-black p-0.5 text-center">{item.jumlahJiwaLaki}</td>
                    <td className="border border-black p-0.5 text-center">{item.jumlahJiwaPerempuan}</td>
                    <td className="border border-black p-0.5 text-center font-bold">{item.jumlahJiwa}</td>
                    <td className="border border-black p-0.5 text-center">{item.jumlahIbuHamil}</td>
                    <td className="border border-black p-0.5 text-center">{item.jumlahIbuMenyusui}</td>
                    <td className="border border-black p-0.5 text-center">{item.jumlahBalita}</td>
                    <td className="border border-black p-0.5 text-center">{item.jumlahLansia}</td>
                    <td className="border border-black p-0.5 text-center">{item.jumlahPus}</td>
                    <td className="border border-black p-0.5 text-center">{item.jumlahWus}</td>
                    <td className="border border-black p-0.5 text-center">{item.jumlahButaAksara}</td>
                    <td className="border border-black p-0.5 text-center">{item.jumlahBerkebutuhanKhusus}</td>
                    <td className="border border-black p-0.5 text-center font-bold">{item.jumlahJambanSehat}</td>
                    <td className="border border-black p-0.5 text-center">{item.jumlahSpal}</td>
                    <td className="border border-black p-0.5 text-center">{item.jumlahTempatSampah}</td>
                    <td className="border border-black p-0.5 text-center font-bold text-emerald-900">{item.jumlahPekaranganManfaat}</td>
                    <td className="border border-black p-0.5 text-center">{item.jumlahIndustriRumah}</td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredItems.length > 0 && (
              <tfoot className="bg-slate-50 font-black">
                <tr>
                  <td colSpan={4} className="border border-black p-0.5 text-right">TOTAL:</td>
                  <td className="border border-black p-0.5 text-center">{filteredItems.reduce((acc, it) => acc + (it.jumlahRumah || 0), 0)}</td>
                  <td className="border border-black p-0.5 text-center underline">{kpiStats.totalKk}</td>
                  <td className="border border-black p-0.5 text-center">{kpiStats.totalJiwaLaki}</td>
                  <td className="border border-black p-0.5 text-center">{kpiStats.totalJiwaPerempuan}</td>
                  <td className="border border-black p-0.5 text-center underline">{kpiStats.totalJiwa}</td>
                  <td className="border border-black p-0.5 text-center underline">{kpiStats.totalBumil}</td>
                  <td className="border border-black p-0.5 text-center">{kpiStats.totalBusui}</td>
                  <td className="border border-black p-0.5 text-center underline">{kpiStats.totalBalita}</td>
                  <td className="border border-black p-0.5 text-center underline">{kpiStats.totalLansia}</td>
                  <td className="border border-black p-0.5 text-center">{kpiStats.totalPus}</td>
                  <td className="border border-black p-0.5 text-center">{kpiStats.totalWus}</td>
                  <td className="border border-black p-0.5 text-center">{kpiStats.totalButaAksara}</td>
                  <td className="border border-black p-0.5 text-center">{kpiStats.totalBerkebutuhanKhusus}</td>
                  <td className="border border-black p-0.5 text-center underline">{kpiStats.totalJamban}</td>
                  <td className="border border-black p-0.5 text-center">{kpiStats.totalSpal}</td>
                  <td className="border border-black p-0.5 text-center">{kpiStats.totalSampah}</td>
                  <td className="border border-black p-0.5 text-center underline">{kpiStats.totalPekarangan}</td>
                  <td className="border border-black p-0.5 text-center">{kpiStats.totalIndustri}</td>
                </tr>
              </tfoot>
            )}
          </table>

          <div className="mt-8 text-[10px] text-slate-500 italic text-right print:block">
            Sistem Informasi Pelaporan Kepling & PKK Kelurahan Mangga (SIKEPLING)
          </div>
        </div>
      </div>
    </div>
  );
};
