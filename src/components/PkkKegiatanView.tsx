import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  Trash2,
  Image as ImageIcon,
  X,
  Sparkles,
  Flower2,
  Check,
  AlertCircle,
  Eye,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { UserAccount, LaporanKegiatanPkk, PokjaPkkType } from '../types';
import {
  subscribePkkKegiatan,
  savePkkKegiatan,
  deletePkkKegiatan,
  exportPkkKegiatanToExcel,
  syncPkkKegiatanDirectly,
  POKJA_LABELS,
} from '../lib/pkkKegiatanService';
import { KopSuratPkk } from './KopSuratPkk';
import { RealtimeSyncStatusPanel } from './RealtimeSyncStatusPanel';
import { printOfficialDocument, downloadPdfDocument } from '../utils/printHelper';
import { compressMultipleFiles } from '../lib/imageCompressor';


interface PkkKegiatanViewProps {
  currentUser: UserAccount;
}

const getIndonesianDayName = (dateStr: string): string => {
  if (!dateStr) return 'Hari Kegiatan';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      return days[d.getDay()] || 'Hari Kegiatan';
    }
  } catch (e) {
    // ignore
  }
  return 'Hari Kegiatan';
};

const formatIndonesianDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      return `${day} ${months[month]} ${year}`;
    }
  } catch (e) {
    // ignore
  }
  return dateStr;
};

const formatProperWriting = (text: string): string => {
  if (!text) return '';
  // 1. Capitalize first letter of each sentence
  let formatted = text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (m) => m.toUpperCase());

  // 2. Specific PKK / Kelurahan keywords that should be capitalized correctly
  const keywords = [
    { pattern: /\bpkk\b/gi, replacement: 'PKK' },
    { pattern: /\btp-pkk\b/gi, replacement: 'TP-PKK' },
    { pattern: /\blurah\b/gi, replacement: 'Lurah' },
    { pattern: /\bkelurahan\b/gi, replacement: 'Kelurahan' },
    { pattern: /\bmangga\b/gi, replacement: 'Mangga' },
    { pattern: /\bkepling\b/gi, replacement: 'Kepling' },
    { pattern: /\bkepala lingkungan\b/gi, replacement: 'Kepala Lingkungan' },
    { pattern: /\btaman pkk\b/gi, replacement: 'Taman PKK' },
    { pattern: /\btoga\b/gi, replacement: 'TOGA' },
    { pattern: /\bpoltekkes\b/gi, replacement: 'Poltekkes' },
    { pattern: /\bkemenkes\b/gi, replacement: 'Kemenkes' },
    { pattern: /\bpkl\b/gi, replacement: 'PKL' },
    { pattern: /\bgizi\b/gi, replacement: 'Gizi' },
    { pattern: /\bdawis\b/gi, replacement: 'Dawis' },
    { pattern: /\bdasa wisma\b/gi, replacement: 'Dasa Wisma' },
    { pattern: /\bposyandu\b/gi, replacement: 'Posyandu' },
  ];

  keywords.forEach((kw) => {
    formatted = formatted.replace(kw.pattern, kw.replacement);
  });

  return formatted;
};

const normalizePelaporNama = (name: string): string => {
  if (!name) return name;
  // If it's the old secretary placeholder, fix it to the new one
  if (name.includes('Ny. Sekretaris') || name === 'Ny. Sekretaris PKK Kelurahan Mangga') {
    return 'Nur Aisyah Dewi, A.Md';
  }
  return name;
};

export const PkkKegiatanView: React.FC<PkkKegiatanViewProps> = ({ currentUser }) => {
  const [kegiatanList, setKegiatanList] = useState<LaporanKegiatanPkk[]>([]);
  const [filterPokja, setFilterPokja] = useState<string>('ALL');
  const [filterLingkungan, setFilterLingkungan] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [selectedDetail, setSelectedDetail] = useState<LaporanKegiatanPkk | null>(null);

  // Form State
  const [formTanggal, setFormTanggal] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [formPokja, setFormPokja] = useState<PokjaPkkType>(() => {
    if (currentUser.id === 'pokja_1') return 'POKJA_I';
    if (currentUser.id === 'pokja_2') return 'POKJA_II';
    if (currentUser.id === 'pokja_3') return 'POKJA_III';
    if (currentUser.id === 'pokja_4') return 'POKJA_IV';
    if (currentUser.role === 'ketua_pkk_lingkungan') return 'PKK_LINGKUNGAN';
    return 'SEKRETARIAT';
  });
  const [formNamaKegiatan, setFormNamaKegiatan] = useState<string>('');
  const [formKategori, setFormKategori] = useState<string>('Pola Asuh Anak & Remaja (PAAREDI)');
  const [formLokasi, setFormLokasi] = useState<string>(
    currentUser.lingkungan || 'Kantor Kelurahan Mangga'
  );
  const [formLingkunganNomor, setFormLingkunganNomor] = useState<number>(
    currentUser.nomorLingkungan || 0
  );
  const [formJumlahPeserta, setFormJumlahPeserta] = useState<string>('20');
  const [formUraian, setFormUraian] = useState<string>('');
  const [formTindakLanjut, setFormTindakLanjut] = useState<string>('');
  const [formFotos, setFormFotos] = useState<{ id: string; url: string; name: string; timestamp: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const unsub = subscribePkkKegiatan((items) => {
      setKegiatanList(items);
    });
    return () => unsub();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const synced = await syncPkkKegiatanDirectly();
      setKegiatanList(synced);
      showAlert(`Sinkronisasi berhasil! ${synced.length} kegiatan PKK termuat dari Cloud.`, 'success');
    } catch (err) {
      showAlert('Gagal menyinkronkan data kegiatan PKK.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 3500);
  };

  // Filtered Kegiatan
  const filteredList = useMemo(() => {
    return kegiatanList.filter((k) => {
      if (filterPokja !== 'ALL' && k.pokja !== filterPokja) return false;
      if (filterLingkungan !== 'ALL') {
        const lkNum = parseInt(filterLingkungan, 10);
        if (k.lingkunganNomor !== lkNum) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNama = (k.namaKegiatan || '').toLowerCase().includes(q);
        const matchUraian = (k.uraianHasil || '').toLowerCase().includes(q);
        const matchLokasi = (k.lokasi || '').toLowerCase().includes(q);
        const matchPelapor = (k.pelaporNama || '').toLowerCase().includes(q);
        if (!matchNama && !matchUraian && !matchLokasi && !matchPelapor) return false;
      }
      return true;
    });
  }, [kegiatanList, filterPokja, filterLingkungan, searchQuery]);

  // Handle Foto Upload with automatic high-speed compression for older devices
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const compressedList = await compressMultipleFiles(files, 720, 0.45);
      if (compressedList.length > 0) {
        setFormFotos((prev) => [...prev, ...compressedList]);
      }
    } catch (err) {
      console.warn('Gagal memproses foto:', err);
    }
    e.target.value = '';
  };

  const [isFormalizingUraian, setIsFormalizingUraian] = useState(false);
  const [isFormalizingTindakLanjut, setIsFormalizingTindakLanjut] = useState(false);

  const formalizeText = async (text: string, setter: (val: string) => void, setLoading: (val: boolean) => void) => {
    if (!text || text.trim().length < 5) return;
    setLoading(true);
    try {
      const res = await fetch('/api/gemini/formalize-pkk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success && data.formalizedText) {
        setter(data.formalizedText);
        showAlert('Teks berhasil diformalkan dengan AI!', 'success');
      } else {
        showAlert(data.message || 'Gagal memformalkan teks.', 'error');
      }
    } catch (err) {
      showAlert('Koneksi AI terganggu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNamaKegiatan.trim()) {
      showAlert('Nama kegiatan harus diisi!', 'error');
      return;
    }
    if (!formUraian.trim()) {
      showAlert('Uraian hasil kegiatan harus diisi!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const newKegiatan: LaporanKegiatanPkk = {
        id: 'pkk_act_' + Date.now(),
        tanggal: formTanggal,
        pokja: formPokja,
        namaKegiatan: formNamaKegiatan.trim(),
        kategoriProgram: formKategori,
        lokasi: formLokasi.trim(),
        lingkunganNomor: formLingkunganNomor,
        lingkunganNama:
          formLingkunganNomor > 0
            ? `Lingkungan ${formLingkunganNomor}`
            : 'TP PKK Kelurahan Mangga',
        jumlahPeserta: parseInt(formJumlahPeserta, 10) || 0,
        uraianHasil: formUraian.trim(),
        tindakLanjut: formTindakLanjut.trim(),
        fotoDokumentasi: formFotos,
        pelaporNama: currentUser.nama,
        pelaporRole: currentUser.role,
        createdAt: new Date().toISOString(),
      };

      await savePkkKegiatan(newKegiatan);
      showAlert('Laporan kegiatan PKK berhasil disimpan secara online!', 'success');

      // Reset form
      setFormNamaKegiatan('');
      setFormUraian('');
      setFormTindakLanjut('');
      setFormFotos([]);
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      showAlert('Gagal menyimpan kegiatan PKK', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, nama: string) => {
    if (!window.confirm(`Hapus laporan kegiatan "${nama}"?`)) return;
    try {
      await deletePkkKegiatan(id);
      showAlert('Laporan kegiatan berhasil dihapus.', 'success');
      if (selectedDetail?.id === id) setSelectedDetail(null);
    } catch (err) {
      showAlert('Gagal menghapus kegiatan.', 'error');
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
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tosca-50 border border-tosca-200 text-tosca-800 text-xs font-black tracking-wide mb-2">
            <Flower2 className="w-3.5 h-3.5 text-tosca-600" />
            <span>AGENDA & DOKUMENTASI KEGIATAN TP-PKK</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Laporan Kegiatan PKK Kelurahan Mangga
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Pencatatan resmi kegiatan 10 Program Pokok PKK dari Sekretariat, Pokja I, Pokja II, Pokja III, Pokja IV, serta pembinaan TP-PKK di 24 lingkungan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            title="Sinkronisasi data langsung dengan Cloud Firestore"
          >
            <RefreshCw className={`w-4 h-4 text-tosca-700 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Data'}</span>
          </button>

          <button
            type="button"
            onClick={() => exportPkkKegiatanToExcel(filteredList)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
            title="Download data kegiatan dalam format spreadsheet Excel"
          >
            <Download className="w-4 h-4 text-tosca-700" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={() =>
              downloadPdfDocument(
                'lembar-cetak-rekap-semua-pkk',
                `REKAPITULASI_KEGIATAN_PKK_KELURAHAN_MANGGA_${new Date().toISOString().split('T')[0]}.pdf`
              )
            }
            className="px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-extrabold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
            title="Unduh Berkas PDF Rekapitulasi Resmi Seluruh Kegiatan PKK"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>Unduh PDF (.pdf)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              printOfficialDocument(
                'lembar-cetak-rekap-semua-pkk',
                `REKAPITULASI_KEGIATAN_PKK_KELURAHAN_MANGGA_${new Date().toISOString().split('T')[0]}`
              )
            }
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:bg-emerald-50 text-emerald-950 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
            title="Cetak PDF Rekapitulasi Resmi Seluruh Kegiatan PKK Beserta Foto & Ringkasan"
          >
            <Printer className="w-4 h-4 text-emerald-700" />
            <span>Cetak / Pratinjau</span>
          </button>


          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-tosca-700 hover:bg-tosca-800 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-tosca-700/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ Catat Kegiatan Baru</span>
          </button>
        </div>
      </div>

      <RealtimeSyncStatusPanel />

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Filter Pokja */}
          <select
            value={filterPokja}
            onChange={(e) => setFilterPokja(e.target.value)}
            className="px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-tosca-600 cursor-pointer"
          >
            <option value="ALL">Semua Pokja / Unit</option>
            <option value="SEKRETARIAT">Sekretariat TP PKK</option>
            <option value="POKJA_I">Pokja I (Pancasila & Gotong Royong)</option>
            <option value="POKJA_II">Pokja II (Pendidikan & UP2K)</option>
            <option value="POKJA_III">Pokja III (Pangan & HATINYA PKK)</option>
            <option value="POKJA_IV">Pokja IV (Kesehatan & Posyandu)</option>
            <option value="PKK_LINGKUNGAN">TP PKK Lingkungan</option>
          </select>

          {/* Filter Lingkungan */}
          <select
            value={filterLingkungan}
            onChange={(e) => setFilterLingkungan(e.target.value)}
            className="px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-tosca-600 cursor-pointer"
          >
            <option value="ALL">Semua Lingkungan (1-24)</option>
            <option value="0">Tingkat Kelurahan</option>
            {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Lingkungan {n}
              </option>
            ))}
          </select>

          {/* Keyword Search */}
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kegiatan, topik, lokasi..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-tosca-600"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500">
          Menampilkan <strong className="text-slate-900">{filteredList.length}</strong> kegiatan
        </div>
      </div>

      {/* Activities Grid */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-tosca-50 text-tosca-700 flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              Belum ada kegiatan PKK yang sesuai filter
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Silakan sesuaikan filter pencarian, klik tombol sinkronisasi untuk memuat dari cloud, atau catat kegiatan baru.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-tosca-700 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan dari Cloud'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterPokja('ALL');
                setFilterLingkungan('ALL');
                setSearchQuery('');
              }}
              className="inline-flex items-center gap-1 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Filter</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredList.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 hover:border-tosca-400 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Photo Preview if any */}
                {item.fotoDokumentasi && item.fotoDokumentasi.length > 0 ? (
                  <div
                    onClick={() => setSelectedDetail(item)}
                    className="relative h-44 bg-slate-100 overflow-hidden cursor-pointer group"
                  >
                    <img
                      src={item.fotoDokumentasi[0].url}
                      alt={item.namaKegiatan}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-3">
                      <span className="text-[11px] font-bold text-white bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" />
                        <span>{item.fotoDokumentasi.length} Dokumentasi</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-2 bg-gradient-to-r from-tosca-600 to-tosca-500" />
                )}

                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-tosca-800 bg-tosca-50 px-2 py-0.5 rounded border border-tosca-200">
                      {POKJA_LABELS[item.pokja] || item.pokja}
                    </span>
                    <span className="text-slate-500 font-medium">
                      📅 {item.tanggal}
                    </span>
                  </div>

                  <div>
                    <h3
                      onClick={() => setSelectedDetail(item)}
                      className="text-sm font-bold text-slate-900 hover:text-tosca-800 cursor-pointer line-clamp-2 leading-snug"
                    >
                      {item.namaKegiatan}
                    </h3>
                    <p className="text-[11px] font-semibold text-tosca-700 mt-1">
                      {item.kategoriProgram}
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {formatProperWriting(item.uraianHasil)}
                  </p>

                  <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{item.lokasi}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.jumlahPeserta || 0} Peserta</span>
                      </span>
                      <span className="font-medium text-slate-400">
                        Oleh: {normalizePelaporNama(item.pelaporNama)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedDetail(item)}
                  className="text-xs font-bold text-tosca-700 hover:text-tosca-900 flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Lihat Detail</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(item.id, item.namaKegiatan)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Hapus Laporan Kegiatan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Detail Kegiatan */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="bg-tosca-800 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Flower2 className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    Rincian Kegiatan PKK
                  </h3>
                  <p className="text-[11px] text-tosca-200 font-medium">
                    {POKJA_LABELS[selectedDetail.pokja]} • {selectedDetail.tanggal}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="p-1 text-tosca-200 hover:text-white rounded-lg hover:bg-tosca-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal On-Screen Scrollable Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              {/* Kop Surat Header Preview */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                <KopSuratPkk />
              </div>

              {/* Title & Category Banner */}
              <div className="text-center pb-3 border-b border-slate-200">
                <span className="text-[11px] font-bold text-tosca-800 bg-tosca-50 px-3 py-1 rounded-full border border-tosca-200 uppercase tracking-wider">
                  LAPORAN KEGIATAN {POKJA_LABELS[selectedDetail.pokja]}
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-2.5">
                  {selectedDetail.namaKegiatan}
                </h2>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Program Pokok PKK: <span className="text-tosca-700">{selectedDetail.kategoriProgram}</span>
                </p>
              </div>

              {/* Parameter Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Hari & Tanggal</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{getIndonesianDayName(selectedDetail.tanggal)}, {formatIndonesianDate(selectedDetail.tanggal)}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Wilayah Sasaran</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{selectedDetail.lingkunganNama}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Jumlah Peserta</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{selectedDetail.jumlahPeserta || 0} Warga</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Pelapor Kegiatan</span>
                  <span className="font-bold text-slate-900 mt-0.5 block truncate" title={normalizePelaporNama(selectedDetail.pelaporNama)}>{normalizePelaporNama(selectedDetail.pelaporNama)}</span>
                </div>
              </div>

              {/* Lokasi Kegiatan */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  <span>Lokasi Kegiatan:</span>
                </h4>
                <p className="text-xs text-slate-800 font-medium bg-slate-50 p-3 rounded-xl border border-slate-200">
                  📍 {selectedDetail.lokasi}
                </p>
              </div>

              {/* Uraian Hasil Kegiatan */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-tosca-700" />
                  <span>Uraian Hasil Pelaksanaan:</span>
                </h4>
                <div className="p-4 rounded-2xl bg-tosca-50/40 border border-tosca-200/80 text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                  {selectedDetail.uraianHasil}
                </div>
              </div>

              {/* Rencana Tindak Lanjut */}
              {selectedDetail.tindakLanjut && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Rencana Tindak Lanjut & Evaluasi:</span>
                  </h4>
                  <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200 whitespace-pre-line leading-relaxed">
                    {selectedDetail.tindakLanjut}
                  </p>
                </div>
              )}

              {/* Photo Documentation Section */}
              <div className="space-y-2.5 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-tosca-700" />
                    <span>Dokumentasi Foto Lapangan ({selectedDetail.fotoDokumentasi?.length || 0}):</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Klik foto untuk melihat ukuran penuh</span>
                </div>

                {selectedDetail.fotoDokumentasi && selectedDetail.fotoDokumentasi.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedDetail.fotoDokumentasi.map((ft, idx) => (
                      <div
                        key={ft.id || idx}
                        className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs hover:shadow-md transition-all cursor-pointer"
                        onClick={() => window.open(ft.url, '_blank')}
                      >
                        <div className="h-36 w-full overflow-hidden">
                          <img
                            src={ft.url}
                            alt={`Dokumentasi ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div className="p-2 bg-white border-t border-slate-100 text-[10px] font-bold text-slate-700 truncate">
                          Foto {idx + 1}: {selectedDetail.namaKegiatan}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400 bg-slate-50">
                    Tidak ada lampiran foto dokumentasi fisik untuk kegiatan ini.
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Dilaporkan oleh: <strong>{normalizePelaporNama(selectedDetail.pelaporNama)}</strong> ({selectedDetail.pelaporRole})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadPdfDocument('lembar-cetak-pkk-kegiatan', `LAPORAN_PKK_${selectedDetail.namaKegiatan.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`)}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-black rounded-xl text-xs cursor-pointer flex items-center gap-1.5 shadow-sm transition-all"
                  title="Unduh Berkas PDF Surat Resmi"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => printOfficialDocument('lembar-cetak-pkk-kegiatan', `LAPORAN_PKK_${selectedDetail.namaKegiatan.replace(/[^a-zA-Z0-9]/g, '_')}`)}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs cursor-pointer flex items-center gap-1.5 shadow-sm transition-all"
                  title="Cetak Surat Resmi Kegiatan PKK Lengkap dengan Foto & Kop Resmi"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Surat</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDetail(null)}
                  className="px-4 py-2 bg-tosca-800 hover:bg-tosca-700 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>

            {/* DEDICATED OFFICIAL PRINT SHEET (Hidden on screen, captured by printOfficialDocument) */}
            <div style={{ display: 'none' }}>
              <div
                id="lembar-cetak-pkk-kegiatan"
                style={{
                  width: '100%',
                  maxWidth: '190mm',
                  margin: '0 auto',
                  fontFamily: "'Times New Roman', Times, serif",
                  color: '#000000',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box',
                  padding: '8px 2px',
                }}
              >
                {/* 1. KOP SURAT RESMI */}
                <KopSuratPkk />

                {/* 2. JUDUL DOKUMEN & NOMOR BERKAS */}
                <div style={{ textAlign: 'center', margin: '8px 0 14px 0' }}>
                  <h1
                    style={{
                      fontSize: '13pt',
                      fontWeight: 'bold',
                      textDecoration: 'underline',
                      textTransform: 'uppercase',
                      margin: 0,
                      fontFamily: "'Times New Roman', Times, serif",
                      letterSpacing: '0.02em',
                    }}
                  >
                    LAPORAN KEGIATAN TP PKK KELURAHAN MANGGA
                  </h1>
                  <div
                    style={{
                      fontSize: '10pt',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      marginTop: '4px',
                      letterSpacing: '0.03em',
                    }}
                  >
                    UNIT / POKJA: {POKJA_LABELS[selectedDetail.pokja]}
                  </div>
                  <div
                    style={{
                      fontSize: '8.5pt',
                      fontStyle: 'italic',
                      color: '#334155',
                      marginTop: '2px',
                    }}
                  >
                    Nomor Dokumen: 028/PKK-KM/LAP/{selectedDetail.tanggal ? selectedDetail.tanggal.split('-')[0] : '2026'}
                  </div>
                </div>

                {/* 3. TABEL IDENTITAS & PARAMETER KEGIATAN */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    border: '1.5px solid #000000',
                    fontSize: '9pt',
                    fontFamily: "'Times New Roman', Times, serif",
                    marginBottom: '14px',
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ width: '22%', fontWeight: 'bold', padding: '6px 8px', border: '1px solid #000000', backgroundColor: '#f1f5f9' }}>
                        Nama Kegiatan
                      </td>
                      <td style={{ width: '2%', fontWeight: 'bold', padding: '6px 2px', border: '1px solid #000000', textAlign: 'center' }}>:</td>
                      <td style={{ width: '76%', fontWeight: 'bold', padding: '6px 8px', border: '1px solid #000000', textTransform: 'uppercase' }} colSpan={3}>
                        {selectedDetail.namaKegiatan}
                      </td>
                    </tr>
                    <tr style={{ textTransform: 'uppercase' }}>
                      <td style={{ fontWeight: 'bold', padding: '6px 8px', border: '1px solid #000000', backgroundColor: '#f1f5f9' }}>
                        Pokja / Bidang
                      </td>
                      <td style={{ fontWeight: 'bold', padding: '6px 2px', border: '1px solid #000000', textAlign: 'center' }}>:</td>
                      <td style={{ width: '38%', padding: '6px 8px', border: '1px solid #000000' }}>
                        {POKJA_LABELS[selectedDetail.pokja]}
                      </td>
                      <td style={{ width: '18%', fontWeight: 'bold', padding: '6px 8px', border: '1px solid #000000', backgroundColor: '#f1f5f9' }}>
                        Hari / Tanggal
                      </td>
                      <td style={{ width: '20%', padding: '6px 8px', border: '1px solid #000000' }}>
                        {getIndonesianDayName(selectedDetail.tanggal)}, {formatIndonesianDate(selectedDetail.tanggal)}
                      </td>
                    </tr>
                    <tr style={{ textTransform: 'uppercase' }}>
                      <td style={{ fontWeight: 'bold', padding: '6px 8px', border: '1px solid #000000', backgroundColor: '#f1f5f9' }}>
                        Kategori Program
                      </td>
                      <td style={{ fontWeight: 'bold', padding: '6px 2px', border: '1px solid #000000', textAlign: 'center' }}>:</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #000000' }}>
                        {selectedDetail.kategoriProgram}
                      </td>
                      <td style={{ fontWeight: 'bold', padding: '6px 8px', border: '1px solid #000000', backgroundColor: '#f1f5f9' }}>
                        Jumlah Peserta
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #000000', fontWeight: 'bold' }}>
                        {selectedDetail.jumlahPeserta || 0} Orang / Warga
                      </td>
                    </tr>
                    <tr style={{ textTransform: 'uppercase' }}>
                      <td style={{ fontWeight: 'bold', padding: '6px 8px', border: '1px solid #000000', backgroundColor: '#f1f5f9' }}>
                        Tempat / Lokasi
                      </td>
                      <td style={{ fontWeight: 'bold', padding: '6px 2px', border: '1px solid #000000', textAlign: 'center' }}>:</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #000000' }}>
                        {selectedDetail.lokasi}
                      </td>
                      <td style={{ fontWeight: 'bold', padding: '6px 8px', border: '1px solid #000000', backgroundColor: '#f1f5f9' }}>
                        Sasaran Wilayah
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #000000' }}>
                        {selectedDetail.lingkunganNama}
                      </td>
                    </tr>
                    <tr style={{ textTransform: 'uppercase' }}>
                      <td style={{ fontWeight: 'bold', padding: '6px 8px', border: '1px solid #000000', backgroundColor: '#f1f5f9' }}>
                        Petugas Pelapor
                      </td>
                      <td style={{ fontWeight: 'bold', padding: '6px 2px', border: '1px solid #000000', textAlign: 'center' }}>:</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #000000' }} colSpan={3}>
                        <strong>{normalizePelaporNama(selectedDetail.pelaporNama)}</strong> ({selectedDetail.pelaporRole || 'Pengurus TP PKK Kelurahan Mangga'})
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* 4. URAIAN HASIL KEGIATAN */}
                <div style={{ marginBottom: '14px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <div
                    style={{
                      fontSize: '9.5pt',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      borderBottom: '1px solid #000000',
                      paddingBottom: '3px',
                      marginBottom: '6px',
                    }}
                  >
                    I. URAIAN HASIL PELAKSANAAN KEGIATAN
                  </div>
                  <div
                    style={{
                      fontSize: '9pt',
                      lineHeight: '1.6',
                      textAlign: 'justify',
                      border: '1px solid #cbd5e1',
                      padding: '8px 12px',
                      backgroundColor: '#f8fafc',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {formatProperWriting(selectedDetail.uraianHasil)}
                  </div>
                </div>

                {/* 5. RENCANA TINDAK LANJUT */}
                {selectedDetail.tindakLanjut && (
                  <div style={{ marginBottom: '14px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <div
                      style={{
                        fontSize: '9.5pt',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        borderBottom: '1px solid #000000',
                        paddingBottom: '3px',
                        marginBottom: '6px',
                      }}
                    >
                      II. RENCANA TINDAK LANJUT & EVALUASI PROGRAM
                    </div>
                    <div
                      style={{
                        fontSize: '9pt',
                        lineHeight: '1.6',
                        textAlign: 'justify',
                        border: '1px solid #cbd5e1',
                        padding: '8px 12px',
                        backgroundColor: '#ffffff',
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {selectedDetail.tindakLanjut}
                    </div>
                  </div>
                )}

                {/* 6. DOKUMENTASI FOTO LAPANGAN */}
                <div style={{ marginBottom: '16px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <div
                    style={{
                      fontSize: '9.5pt',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      borderBottom: '1px solid #000000',
                      paddingBottom: '3px',
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{selectedDetail.tindakLanjut ? 'III' : 'II'}. LAMPIRAN DOKUMENTASI KEGIATAN LAPANGAN</span>
                    <span style={{ fontSize: '8.5pt', fontWeight: 'normal', fontStyle: 'italic' }}>
                      Terlampir {selectedDetail.fotoDokumentasi?.length || 0} Dokumentasi Foto
                    </span>
                  </div>

                  {selectedDetail.fotoDokumentasi && selectedDetail.fotoDokumentasi.length > 0 ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: selectedDetail.fotoDokumentasi.length === 1 ? '1fr' : '1fr 1fr',
                        gap: '14px',
                      }}
                    >
                      {selectedDetail.fotoDokumentasi.map((ft, idx) => (
                        <div
                          key={ft.id || idx}
                          style={{
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '6px',
                            backgroundColor: '#f8fafc',
                            padding: '6px',
                            boxSizing: 'border-box',
                            pageBreakInside: 'avoid',
                            breakInside: 'avoid',
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: '220px',
                              minHeight: '220px',
                              backgroundColor: '#e2e8f0',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <img
                              src={ft.url}
                              alt={`Dokumentasi ${idx + 1}`}
                              crossOrigin="anonymous"
                              style={{
                                width: '100%',
                                height: '220px',
                                objectFit: 'cover',
                                display: 'block',
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                          <div
                            style={{
                              fontSize: '8pt',
                              fontWeight: 'bold',
                              color: '#1e293b',
                              textAlign: 'center',
                              marginTop: '6px',
                              padding: '4px 6px',
                              backgroundColor: '#ffffff',
                              borderTop: '1px solid #e2e8f0',
                              borderRadius: '2px',
                              boxSizing: 'border-box',
                            }}
                          >
                            Foto {idx + 1}: {selectedDetail.namaKegiatan} ({selectedDetail.lokasi})
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        border: '1px dashed #cbd5e1',
                        padding: '12px',
                        textAlign: 'center',
                        fontSize: '8.5pt',
                        color: '#64748b',
                        fontStyle: 'italic',
                        backgroundColor: '#f8fafc',
                      }}
                    >
                      - Tidak ada lampiran foto dokumentasi fisik untuk laporan kegiatan ini -
                    </div>
                  )}
                </div>

                {/* 7. KOLOM PENGESAHAN TANDA TANGAN RESMI */}
                <div style={{ marginTop: '22px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <table style={{ width: '100%', border: 'none', fontSize: '9pt', fontFamily: "'Times New Roman', Times, serif" }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top', border: 'none', padding: '0 10px' }}>
                          <div style={{ fontWeight: 'bold' }}>Ketua Tim Penggerak PKK Kelurahan Mangga</div>
                          <div style={{ height: '65px' }} />
                          <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                            NY. FRANSISKA FERY ARAPENTA TARIGAN
                          </div>
                          <div style={{ fontSize: '8pt', color: '#475569' }}>Ketua Tim Penggerak PKK Kelurahan Mangga</div>
                        </td>
                        <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top', border: 'none', padding: '0 10px' }}>
                          <div>Medan, {formatIndonesianDate(selectedDetail.tanggal)}</div>
                          <div style={{ fontWeight: 'bold' }}>Yang Melaporkan,</div>
                          <div style={{ fontSize: '8.5pt', color: '#334155' }}>{POKJA_LABELS[selectedDetail.pokja]}</div>
                          <div style={{ height: '55px' }} />
                          <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                            ( {normalizePelaporNama(selectedDetail.pelaporNama) || 'Pengurus TP PKK'} )
                          </div>
                          <div style={{ fontSize: '8pt', color: '#475569' }}>{selectedDetail.pelaporRole || 'Kader / Pelapor'}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 8. CATATAN KAKI DOKUMEN RESMI */}
                <div
                  style={{
                    marginTop: '16px',
                    paddingTop: '4px',
                    borderTop: '1px solid #cbd5e1',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '7pt',
                    color: '#64748b',
                    fontStyle: 'italic',
                    fontFamily: 'sans-serif',
                  }}
                >
                  <span>SI-MANGGA • Sistem Informasi Administrasi Kelurahan Mangga & TP PKK</span>
                  <span>Dokumen Resmi • Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Input Kegiatan Baru */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="bg-tosca-800 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Plus className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm sm:text-base">
                  Catat Laporan Kegiatan PKK
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1 text-tosca-200 hover:text-white rounded-lg hover:bg-tosca-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Tanggal Kegiatan</label>
                  <input
                    type="date"
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-tosca-600 font-medium"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Pokja / Unit Penyelenggara</label>
                  <select
                    value={formPokja}
                    onChange={(e) => setFormPokja(e.target.value as PokjaPkkType)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-tosca-600 font-bold"
                  >
                    <option value="SEKRETARIAT">Sekretariat TP-PKK</option>
                    <option value="POKJA_I">Pokja I (Pancasila & Gotong Royong)</option>
                    <option value="POKJA_II">Pokja II (Pendidikan & UP2K)</option>
                    <option value="POKJA_III">Pokja III (Pangan & HATINYA PKK)</option>
                    <option value="POKJA_IV">Pokja IV (Kesehatan & Posyandu)</option>
                    <option value="PKK_LINGKUNGAN">TP-PKK Lingkungan</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nama / Judul Kegiatan</label>
                <input
                  type="text"
                  value={formNamaKegiatan}
                  onChange={(e) => setFormNamaKegiatan(e.target.value)}
                  placeholder="Contoh: Rapat Pleno Rutin TP-PKK / Sosialisasi ILP Posyandu Melati"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-tosca-600 font-semibold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Kategori Program Pokok</label>
                <input
                  type="text"
                  value={formKategori}
                  onChange={(e) => setFormKategori(e.target.value)}
                  placeholder="Contoh: Pola Asuh Anak, Posyandu, AKU HATINYA PKK, UP2K, dll."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-tosca-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Lokasi Kegiatan</label>
                  <input
                    type="text"
                    value={formLokasi}
                    onChange={(e) => setFormLokasi(e.target.value)}
                    placeholder="Contoh: Balai Warga Jl. Bunga Rinte Lk IV"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-tosca-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Jumlah Peserta (Orang)</label>
                  <input
                    type="number"
                    value={formJumlahPeserta}
                    onChange={(e) => setFormJumlahPeserta(e.target.value)}
                    placeholder="20"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-tosca-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Uraian Hasil Kegiatan</label>
                  <button
                    type="button"
                    onClick={() => formalizeText(formUraian, setFormUraian, setIsFormalizingUraian)}
                    disabled={isFormalizingUraian || formUraian.trim().length < 5}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-tosca-50 text-tosca-700 hover:bg-tosca-100 border border-tosca-200 text-[10px] font-black transition-all cursor-pointer disabled:opacity-50"
                    title="Otomatis perbaiki bahasa menjadi formal & profesional dengan AI"
                  >
                    {isFormalizingUraian ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    <span>{isFormalizingUraian ? 'Memproses...' : 'Formalkan Bahasa (AI Magic)'}</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={formUraian}
                  onChange={(e) => setFormUraian(e.target.value)}
                  placeholder="Tuliskan ringkasan materi, keputusan rapat, jumlah warga yang dilayani, atau capaian kegiatan..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-tosca-600 leading-relaxed"
                  required
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Rencana Tindak Lanjut (Opsional)</label>
                  <button
                    type="button"
                    onClick={() => formalizeText(formTindakLanjut, setFormTindakLanjut, setIsFormalizingTindakLanjut)}
                    disabled={isFormalizingTindakLanjut || formTindakLanjut.trim().length < 5}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-tosca-50 text-tosca-700 hover:bg-tosca-100 border border-tosca-200 text-[10px] font-black transition-all cursor-pointer disabled:opacity-50"
                    title="Otomatis perbaiki bahasa menjadi formal & profesional dengan AI"
                  >
                    {isFormalizingTindakLanjut ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    <span>{isFormalizingTindakLanjut ? 'Memproses...' : 'Formalkan Bahasa (AI Magic)'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={formTindakLanjut}
                  onChange={(e) => setFormTindakLanjut(e.target.value)}
                  placeholder="Contoh: Monitoring berkala pekan depan / pendampingan kader"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-tosca-600"
                />
              </div>

              {/* Upload Foto Dokumentasi */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-tosca-700" />
                    <span>Upload Foto Dokumentasi ({formFotos.length})</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Dapat pilih beberapa foto</span>
                </label>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-tosca-50 file:text-tosca-800 hover:file:bg-tosca-100 cursor-pointer"
                />

                {formFotos.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {formFotos.map((ft, idx) => (
                      <div
                        key={ft.id || idx}
                        className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 group"
                      >
                        <img src={ft.url} alt="upload" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormFotos(formFotos.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-90 hover:opacity-100 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
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
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Laporan Kegiatan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEDICATED OFFICIAL REKAP PRINT SHEET (Captured by printOfficialDocument for CETAK PDF REKAP PKK) */}
      <div style={{ display: 'none' }}>
        <div
          id="lembar-cetak-rekap-semua-pkk"
          style={{
            width: '100%',
            maxWidth: '190mm',
            margin: '0 auto',
            fontFamily: "'Times New Roman', Times, serif",
            color: '#000000',
            backgroundColor: '#ffffff',
            boxSizing: 'border-box',
            padding: '8px 2px',
          }}
        >
          {/* 1. KOP SURAT RESMI */}
          <KopSuratPkk />

          {/* 2. JUDUL DOKUMEN REKAP */}
          <div style={{ textAlign: 'center', margin: '8px 0 14px 0' }}>
            <h1
              style={{
                fontSize: '13pt',
                fontWeight: 'bold',
                textDecoration: 'underline',
                textTransform: 'uppercase',
                margin: 0,
                fontFamily: "'Times New Roman', Times, serif",
                letterSpacing: '0.02em',
              }}
            >
              REKAPITULASI LAPORAN KEGIATAN TP PKK KELURAHAN MANGGA
            </h1>
            <div
              style={{
                fontSize: '10pt',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                marginTop: '4px',
                letterSpacing: '0.03em',
              }}
            >
              KECAMATAN MEDAN TUNTUNGAN • TAHUN 2026
            </div>
            <div
              style={{
                fontSize: '8.5pt',
                fontStyle: 'italic',
                color: '#334155',
                marginTop: '3px',
              }}
            >
              Filter Data: Unit/Pokja ({filterPokja === 'ALL' ? 'Semua Unit & Pokja' : POKJA_LABELS[filterPokja]}) • Wilayah ({filterLingkungan === 'ALL' ? 'Semua Wilayah (1-24)' : filterLingkungan === '0' ? 'Kelurahan' : 'Lingkungan ' + filterLingkungan})
            </div>
          </div>

          {/* 3. RINGKASAN DATA STATISTIK */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1.5px solid #000000',
              fontSize: '8.5pt',
              marginBottom: '14px',
            }}
          >
            <tbody>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', textAlign: 'center', width: '33%' }}>
                  <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 'bold' }}>TOTAL KEGIATAN</div>
                  <div style={{ fontSize: '13pt', fontWeight: 'bold', color: '#0f172a' }}>{filteredList.length} Kegiatan</div>
                </td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', textAlign: 'center', width: '33%' }}>
                  <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 'bold' }}>TOTAL WARGA / PESERTA</div>
                  <div style={{ fontSize: '13pt', fontWeight: 'bold', color: '#0f172a' }}>
                    {filteredList.reduce((acc, k) => acc + (k.jumlahPeserta || 0), 0)} Orang
                  </div>
                </td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', textAlign: 'center', width: '34%' }}>
                  <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 'bold' }}>TOTAL FOTO DOKUMENTASI</div>
                  <div style={{ fontSize: '13pt', fontWeight: 'bold', color: '#0f172a' }}>
                    {filteredList.reduce((acc, k) => acc + (k.fotoDokumentasi?.length || 0), 0)} Foto
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 4. TABEL DATA REKAPITULASI */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1.5px solid #000000',
              fontSize: '8pt',
              fontFamily: "'Times New Roman', Times, serif",
              marginBottom: '16px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ border: '1px solid #000000', padding: '5px 4px', textAlign: 'center', width: '4%' }}>No</th>
                <th style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'center', width: '11%' }}>Tanggal</th>
                <th style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'center', width: '13%' }}>Pokja / Unit</th>
                <th style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'left', width: '22%' }}>Kegiatan & Program</th>
                <th style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'left', width: '16%' }}>Lokasi & Sasaran</th>
                <th style={{ border: '1px solid #000000', padding: '5px 4px', textAlign: 'center', width: '7%' }}>Peserta</th>
                <th style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'left', width: '18%' }}>Uraian Hasil</th>
                <th style={{ border: '1px solid #000000', padding: '5px 4px', textAlign: 'center', width: '9%' }}>Pelapor / Foto</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ border: '1px solid #000000', padding: '12px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                    Tidak ada kegiatan PKK yang sesuai dengan kriteria filter saat ini.
                  </td>
                </tr>
              ) : (
                filteredList.map((keg, idx) => (
                  <tr key={keg.id} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <td style={{ border: '1px solid #000000', padding: '4px 2px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'center' }}>
                      <div>{formatIndonesianDate(keg.tanggal)}</div>
                      <div style={{ fontSize: '7pt', color: '#475569' }}>{getIndonesianDayName(keg.tanggal)}</div>
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '4px 6px' }}>{POKJA_LABELS[keg.pokja]}</td>
                    <td style={{ border: '1px solid #000000', padding: '4px 6px' }}>
                      <strong style={{ textTransform: 'uppercase' }}>{keg.namaKegiatan}</strong>
                      <div style={{ fontSize: '7pt', color: '#475569' }}>{keg.kategoriProgram}</div>
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '4px 6px' }}>
                      <div>{keg.lokasi}</div>
                      <div style={{ fontSize: '7pt', color: '#475569', fontWeight: 'bold' }}>{keg.lingkunganNama}</div>
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '4px 4px', textAlign: 'center', fontWeight: 'bold' }}>
                      {keg.jumlahPeserta || 0}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '4px 6px', fontSize: '7.5pt' }}>
                      {keg.uraianHasil ? (keg.uraianHasil.length > 90 ? formatProperWriting(keg.uraianHasil.substring(0, 90)) + '...' : formatProperWriting(keg.uraianHasil)) : '-'}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '4px 4px', textAlign: 'center', fontSize: '7.5pt' }}>
                      <div>{normalizePelaporNama(keg.pelaporNama)}</div>
                      <div style={{ fontSize: '7pt', color: '#047857', fontWeight: 'bold' }}>
                        📷 {keg.fotoDokumentasi?.length || 0} Foto
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* 5. LAMPIRAN DOKUMENTASI FOTO TERPILIH */}
          {filteredList.some((k) => k.fotoDokumentasi && k.fotoDokumentasi.length > 0) && (
            <div style={{ marginTop: '16px', pageBreakBefore: 'always', breakBefore: 'page' }}>
              <div
                style={{
                  fontSize: '10pt',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  borderBottom: '1.5px solid #000000',
                  paddingBottom: '4px',
                  marginBottom: '12px',
                }}
              >
                LAMPIRAN FOTO DOKUMENTASI KEGIATAN TP PKK TERPILIH
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {filteredList
                  .flatMap((k) =>
                    (k.fotoDokumentasi || []).map((f) => ({
                      ...f,
                      namaKegiatan: k.namaKegiatan,
                      tanggal: k.tanggal,
                      lokasi: k.lokasi,
                    }))
                  )
                  .slice(0, 6)
                  .map((ft, idx) => (
                    <div
                      key={ft.id || idx}
                      style={{
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '6px',
                        backgroundColor: '#f8fafc',
                        padding: '6px',
                        boxSizing: 'border-box',
                        pageBreakInside: 'avoid',
                        breakInside: 'avoid',
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '190px',
                          backgroundColor: '#e2e8f0',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <img
                          src={ft.url}
                          alt={`Dokumentasi ${idx + 1}`}
                          crossOrigin="anonymous"
                          style={{
                            width: '100%',
                            height: '190px',
                            objectFit: 'cover',
                            display: 'block',
                            borderRadius: '4px',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: '7.5pt',
                          fontWeight: 'bold',
                          color: '#1e293b',
                          marginTop: '4px',
                          textAlign: 'center',
                          padding: '3px 4px',
                          backgroundColor: '#ffffff',
                          borderTop: '1px solid #e2e8f0',
                          borderRadius: '2px',
                        }}
                      >
                        Foto {idx + 1}: {ft.namaKegiatan} • {formatIndonesianDate(ft.tanggal)} ({ft.lokasi})
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 6. KOLOM PENGESAHAN TANDA TANGAN REKAP */}
          <div style={{ marginTop: '24px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            <table style={{ width: '100%', border: 'none', fontSize: '9pt', fontFamily: "'Times New Roman', Times, serif" }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top', border: 'none', padding: '0 10px' }}>
                    <div>Mengetahui,</div>
                    <div style={{ fontWeight: 'bold' }}>Ketua Tim Penggerak PKK Kelurahan Mangga</div>
                    <div style={{ height: '65px' }} />
                    <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                      NY. FRANSISKA FERY ARAPENTA TARIGAN
                    </div>
                    <div style={{ fontSize: '8pt', color: '#475569' }}>Ketua Tim Penggerak PKK Kelurahan Mangga</div>
                  </td>
                  <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top', border: 'none', padding: '0 10px' }}>
                    <div>Medan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    <div style={{ fontWeight: 'bold' }}>Sekretaris Tim Penggerak PKK Kelurahan Mangga</div>
                    <div style={{ height: '65px' }} />
                    <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                      NUR AISYAH DEWI, A.MD
                    </div>
                    <div style={{ fontSize: '8pt', color: '#475569' }}>Sekretaris Tim Penggerak PKK Kelurahan Mangga</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 7. FOOTER RESMI DOKUMEN REKAP */}
          <div
            style={{
              marginTop: '16px',
              paddingTop: '4px',
              borderTop: '1px solid #cbd5e1',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '7pt',
              color: '#64748b',
              fontStyle: 'italic',
              fontFamily: 'sans-serif',
            }}
          >
            <span>SI-MANGGA • Sistem Informasi Administrasi Kelurahan Mangga & TP PKK</span>
            <span>Dokumen Rekapitulasi Resmi • Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
