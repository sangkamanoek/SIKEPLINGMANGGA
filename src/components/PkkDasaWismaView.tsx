import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Download,
  MapPin,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  Check,
  Building,
  Baby,
  Heart,
  Home,
  Sparkles,
  Phone,
} from 'lucide-react';
import { UserAccount, KelompokDasaWisma } from '../types';
import {
  subscribeDasaWisma,
  saveDasaWisma,
  deleteDasaWisma,
  exportDasaWismaToExcel,
} from '../lib/pkkDasaWismaService';

interface PkkDasaWismaViewProps {
  currentUser: UserAccount;
}

export const PkkDasaWismaView: React.FC<PkkDasaWismaViewProps> = ({ currentUser }) => {
  const [dawisList, setDawisList] = useState<KelompokDasaWisma[]>([]);
  const [filterLingkungan, setFilterLingkungan] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<KelompokDasaWisma | null>(null);

  // Form State
  const [formNama, setFormNama] = useState<string>('');
  const [formLingkunganNomor, setFormLingkunganNomor] = useState<number>(
    currentUser.nomorLingkungan || 1
  );
  const [formNamaKetua, setFormNamaKetua] = useState<string>('');
  const [formTelepon, setFormTelepon] = useState<string>('');
  const [formJumlahKk, setFormJumlahKk] = useState<string>('15');
  const [formJumlahJiwa, setFormJumlahJiwa] = useState<string>('55');
  const [formJumlahBalita, setFormJumlahBalita] = useState<string>('4');
  const [formJumlahIbuHamil, setFormJumlahIbuHamil] = useState<string>('1');
  const [formJumlahLansia, setFormJumlahLansia] = useState<string>('5');
  const [formJambanSehat, setFormJambanSehat] = useState<string>('15');
  const [formSpal, setFormSpal] = useState<string>('14');
  const [formToga, setFormToga] = useState<string>('10');
  const [formKegiatan, setFormKegiatan] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const unsub = subscribeDasaWisma((items) => {
      setDawisList(items);
    });
    return () => unsub();
  }, []);

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 3500);
  };

  // Aggregated Stats
  const stats = useMemo(() => {
    let totalKk = 0;
    let totalJiwa = 0;
    let totalBalita = 0;
    let totalBumil = 0;
    let totalLansia = 0;
    let totalJamban = 0;
    let totalToga = 0;

    dawisList.forEach((d) => {
      totalKk += d.jumlahKk || 0;
      totalJiwa += d.jumlahJiwa || 0;
      totalBalita += d.jumlahBalita || 0;
      totalBumil += d.jumlahIbuHamil || 0;
      totalLansia += d.jumlahLansia || 0;
      totalJamban += d.punyaJambanSehat || 0;
      totalToga += d.punyaToga || 0;
    });

    return {
      totalKelompok: dawisList.length,
      totalKk,
      totalJiwa,
      totalBalita,
      totalBumil,
      totalLansia,
      totalJamban,
      totalToga,
    };
  }, [dawisList]);

  // Filtered Dasa Wisma
  const filteredList = useMemo(() => {
    return dawisList.filter((d) => {
      if (filterLingkungan !== 'ALL') {
        const lk = parseInt(filterLingkungan, 10);
        if (d.lingkunganNomor !== lk) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNama = (d.namaKelompok || '').toLowerCase().includes(q);
        const matchKetua = (d.namaKetuaDawis || '').toLowerCase().includes(q);
        const matchLk = (d.lingkunganNama || '').toLowerCase().includes(q);
        if (!matchNama && !matchKetua && !matchLk) return false;
      }
      return true;
    });
  }, [dawisList, filterLingkungan, searchQuery]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormNama('');
    setFormLingkunganNomor(currentUser.nomorLingkungan || 1);
    setFormNamaKetua('');
    setFormTelepon('');
    setFormJumlahKk('15');
    setFormJumlahJiwa('55');
    setFormJumlahBalita('4');
    setFormJumlahIbuHamil('1');
    setFormJumlahLansia('5');
    setFormJambanSehat('15');
    setFormSpal('14');
    setFormToga('10');
    setFormKegiatan('Pertemuan bulanan, arisan Dasa Wisma, pemeriksaan jentik & pemanfaatan toga.');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: KelompokDasaWisma) => {
    setEditingItem(item);
    setFormNama(item.namaKelompok);
    setFormLingkunganNomor(item.lingkunganNomor);
    setFormNamaKetua(item.namaKetuaDawis);
    setFormTelepon(item.teleponKetua || '');
    setFormJumlahKk(String(item.jumlahKk || 0));
    setFormJumlahJiwa(String(item.jumlahJiwa || 0));
    setFormJumlahBalita(String(item.jumlahBalita || 0));
    setFormJumlahIbuHamil(String(item.jumlahIbuHamil || 0));
    setFormJumlahLansia(String(item.jumlahLansia || 0));
    setFormJambanSehat(String(item.punyaJambanSehat || 0));
    setFormSpal(String(item.punyaSpal || 0));
    setFormToga(String(item.punyaToga || 0));
    setFormKegiatan(item.kegiatanUtama || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim()) {
      showAlert('Nama kelompok Dasa Wisma wajib diisi!', 'error');
      return;
    }
    if (!formNamaKetua.trim()) {
      showAlert('Nama Ketua Dasa Wisma wajib diisi!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const item: KelompokDasaWisma = {
        id: editingItem ? editingItem.id : 'dawis_' + Date.now(),
        namaKelompok: formNama.trim(),
        lingkunganNomor: formLingkunganNomor,
        lingkunganNama: `Lingkungan ${formLingkunganNomor}`,
        namaKetuaDawis: formNamaKetua.trim(),
        teleponKetua: formTelepon.trim(),
        jumlahKk: parseInt(formJumlahKk, 10) || 0,
        jumlahJiwa: parseInt(formJumlahJiwa, 10) || 0,
        jumlahBalita: parseInt(formJumlahBalita, 10) || 0,
        jumlahIbuHamil: parseInt(formJumlahIbuHamil, 10) || 0,
        jumlahLansia: parseInt(formJumlahLansia, 10) || 0,
        punyaJambanSehat: parseInt(formJambanSehat, 10) || 0,
        punyaSpal: parseInt(formSpal, 10) || 0,
        punyaToga: parseInt(formToga, 10) || 0,
        kegiatanUtama: formKegiatan.trim(),
        updatedAt: new Date().toISOString(),
      };

      await saveDasaWisma(item);
      showAlert(
        editingItem
          ? 'Data Dasa Wisma berhasil diperbarui!'
          : 'Kelompok Dasa Wisma baru berhasil ditambahkan!',
        'success'
      );
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      showAlert('Gagal menyimpan data Dasa Wisma', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, nama: string) => {
    if (!window.confirm(`Hapus kelompok Dasa Wisma "${nama}"?`)) return;
    try {
      await deleteDasaWisma(id);
      showAlert('Kelompok Dasa Wisma berhasil dihapus.', 'success');
    } catch (err) {
      showAlert('Gagal menghapus data.', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Alert Notification */}
      {alertMsg && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in ${
            alertMsg.type === 'success'
              ? 'bg-tosca-50 text-tosca-900 border border-tosca-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{alertMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertMsg(null)}
            className="p-1 hover:bg-black/5 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-tosca-800 text-xs font-black tracking-wide mb-2">
            <Users className="w-3.5 h-3.5 text-tosca-600" />
            <span>KELOMPOK DASA WISMA 24 LINGKUNGAN</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Data Binaan Dasa Wisma TP-PKK Kelurahan Mangga
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Sistem pendataan kelompok 10–20 kepala keluarga (Dasa Wisma) binaan PKK. Mencakup data ibu hamil, balita stunting, lansia, sanitasi jamban, serta pemanfaatan pekarangan toga.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => exportDasaWismaToExcel(filteredList)}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-4 h-4 text-tosca-700" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-tosca-700 hover:bg-tosca-800 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-tosca-700/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Dasa Wisma</span>
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Dasa Wisma</span>
          <span className="text-xl font-black text-tosca-900 mt-0.5 block">{stats.totalKelompok}</span>
          <span className="text-[10px] text-slate-500">Kelompok di 24 Lk</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Kepala Keluarga</span>
          <span className="text-xl font-black text-slate-900 mt-0.5 block">{stats.totalKk}</span>
          <span className="text-[10px] text-slate-500">{stats.totalJiwa} Jiwa Warga</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Balita Binaan</span>
          <span className="text-xl font-black text-tosca-700 mt-0.5 block">{stats.totalBalita}</span>
          <span className="text-[10px] text-tosca-600">Terpantau Posyandu</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Ibu Hamil</span>
          <span className="text-xl font-black text-amber-700 mt-0.5 block">{stats.totalBumil}</span>
          <span className="text-[10px] text-amber-600">Pendampingan KEK</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Lanjut Usia</span>
          <span className="text-xl font-black text-purple-700 mt-0.5 block">{stats.totalLansia}</span>
          <span className="text-[10px] text-purple-600">Skrining Posyandu</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Pekarangan Toga</span>
          <span className="text-xl font-black text-tosca-700 mt-0.5 block">{stats.totalToga}</span>
          <span className="text-[10px] text-tosca-600">HATINYA PKK</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <select
            value={filterLingkungan}
            onChange={(e) => setFilterLingkungan(e.target.value)}
            className="px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-tosca-600 cursor-pointer"
          >
            <option value="ALL">Semua Lingkungan (1 s/d 24)</option>
            {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Lingkungan {n}
              </option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kelompok, ketua Dasa Wisma, lingkungan..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-tosca-600"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500">
          Total: <strong className="text-slate-900">{filteredList.length}</strong> kelompok
        </div>
      </div>

      {/* Dasa Wisma Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredList.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-tosca-800 text-[11px] font-black">
                  {item.lingkunganNama}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {item.id}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  {item.namaKelompok}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">
                    Ketua: {item.namaKetuaDawis}
                  </span>
                  {item.teleponKetua && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      <span>{item.teleponKetua}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Data Grid per Kelompok */}
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">KK Binaan</span>
                  <span className="font-bold text-slate-800">{item.jumlahKk} KK</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Balita</span>
                  <span className="font-bold text-tosca-700">{item.jumlahBalita} Anak</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Ibu Hamil</span>
                  <span className="font-bold text-amber-700">{item.jumlahIbuHamil} Bumil</span>
                </div>
              </div>

              {/* Sanitasi & HATINYA PKK */}
              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1">
                <span>Jamban Sehat: <strong>{item.punyaJambanSehat} KK</strong></span>
                <span>Pekarangan Toga: <strong>{item.punyaToga} KK</strong></span>
              </div>

              {item.kegiatanUtama && (
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {item.kegiatanUtama}
                </p>
              )}
            </div>

            {/* Card Footer Actions */}
            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleOpenEdit(item)}
                className="text-xs font-bold text-tosca-700 hover:text-tosca-900 flex items-center gap-1 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Ubah Data</span>
              </button>

              <button
                type="button"
                onClick={() => handleDelete(item.id, item.namaKelompok)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Hapus Dasa Wisma"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add / Edit Dasa Wisma */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="bg-tosca-800 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm sm:text-base">
                  {editingItem ? 'Ubah Data Dasa Wisma' : 'Tambah Kelompok Dasa Wisma Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-blue-200 hover:text-white rounded-lg hover:bg-tosca-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Nama Kelompok Dasa Wisma</label>
                  <input
                    type="text"
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    placeholder="Contoh: Dasa Wisma Mawar I"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-tosca-600 font-semibold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Wilayah Lingkungan</label>
                  <select
                    value={formLingkunganNomor}
                    onChange={(e) => setFormLingkunganNomor(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-tosca-600 font-bold"
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        Lingkungan {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Nama Ketua Dasa Wisma</label>
                  <input
                    type="text"
                    value={formNamaKetua}
                    onChange={(e) => setFormNamaKetua(e.target.value)}
                    placeholder="Nama lengkap kader"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-tosca-600 font-medium"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Nomor Telepon / WhatsApp</label>
                  <input
                    type="tel"
                    value={formTelepon}
                    onChange={(e) => setFormTelepon(e.target.value)}
                    placeholder="0812xxxxxxxx"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-tosca-600"
                  />
                </div>
              </div>

              {/* Anggota & Sasaran Kesehatan */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-800">
                  Data Warga Binaan Kelompok:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Jumlah KK</label>
                    <input
                      type="number"
                      value={formJumlahKk}
                      onChange={(e) => setFormJumlahKk(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Jumlah Jiwa</label>
                    <input
                      type="number"
                      value={formJumlahJiwa}
                      onChange={(e) => setFormJumlahJiwa(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Balita</label>
                    <input
                      type="number"
                      value={formJumlahBalita}
                      onChange={(e) => setFormJumlahBalita(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Ibu Hamil</label>
                    <input
                      type="number"
                      value={formJumlahIbuHamil}
                      onChange={(e) => setFormJumlahIbuHamil(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Lansia</label>
                    <input
                      type="number"
                      value={formJumlahLansia}
                      onChange={(e) => setFormJumlahLansia(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Jamban Sehat</label>
                    <input
                      type="number"
                      value={formJambanSehat}
                      onChange={(e) => setFormJambanSehat(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Pekarangan Toga</label>
                    <input
                      type="number"
                      value={formToga}
                      onChange={(e) => setFormToga(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Catatan Kegiatan Pokok Dasa Wisma</label>
                <input
                  type="text"
                  value={formKegiatan}
                  onChange={(e) => setFormKegiatan(e.target.value)}
                  placeholder="Contoh: Arisan rutin setiap tanggal 10, senam sehat lansia & pemanfaatan toga"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-tosca-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-tosca-700 hover:bg-tosca-800 text-white font-bold text-xs shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Data Dasa Wisma'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
