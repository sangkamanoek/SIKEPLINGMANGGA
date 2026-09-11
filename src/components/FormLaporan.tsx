import React, { useState, useEffect } from 'react';
import {
  Camera,
  Trash2,
  FileSpreadsheet,
  Calendar,
  Check,
  Copy,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building2,
  ShieldCheck,
  Shield,
  User,
  Lock,
  KeyRound,
  RotateCcw,
} from 'lucide-react';
import { LaporanHarianItem, FotoDokumentasi, KinerjaHarian, UserAccount } from '../types';
import {
  getNamaHariIndonesia,
  formatTanggalIndonesia,
  getTodayLocalIso,
  NAMA_HARI,
} from '../lib/formatter';
import { SUPER_ADMIN_ACCOUNT, KEPLING_ACCOUNTS, ALL_ACCOUNTS } from '../data/keplingList';

interface FormLaporanProps {
  onSaveReport: (item: LaporanHarianItem, syncToCalendar: boolean) => Promise<void>;
  isSaving: boolean;
  hasGoogleAuth: boolean;
  onConnectGoogle: () => void;
  activeAccount?: UserAccount;
  preselectedKepling?: UserAccount | null;
}

const STORAGE_KEY_PROFILE = 'kepling_profile_data';

export const FormLaporan: React.FC<FormLaporanProps> = ({
  onSaveReport,
  isSaving,
  hasGoogleAuth,
  onConnectGoogle,
  activeAccount,
  preselectedKepling,
}) => {
  const today = new Date();

  // Basic info state
  const [hari, setHari] = useState<string>(getNamaHariIndonesia(today));
  const [tanggalText, setTanggalText] = useState<string>(formatTanggalIndonesia(today));
  const [rawDate, setRawDate] = useState<string>(getTodayLocalIso(today));

  // Selected account in form dropdown
  const initialAccount = preselectedKepling || activeAccount || KEPLING_ACCOUNTS[0];
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccount.id);

  const [namaKepling, setNamaKepling] = useState<string>(initialAccount.nama);
  const [jabatan, setJabatan] = useState<string>(initialAccount.jabatan);
  const [kelurahan, setKelurahan] = useState<string>(initialAccount.kelurahan);
  const [kecamatan, setKecamatan] = useState<string>(initialAccount.kecamatan);

  // Kinerja Harian state (semua default 0 sesuai instruksi)
  const [opsirPbbWp, setOpsirPbbWp] = useState<string>('0');
  const [opsirPbbKeterangan, setOpsirPbbKeterangan] = useState<string>('Pembayaran PBB');

  const [perlinsosKk, setPerlinsosKk] = useState<string>('0');
  const [perlinsosKeterangan, setPerlinsosKeterangan] = useState<string>('Pendataan Perlinsos');

  const [ikdOrang, setIkdOrang] = useState<string>('0');
  const [ikdKeterangan, setIkdKeterangan] = useState<string>('Aktivasi aplikasi IKD Dukcapil');

  const [bpjsKetenagakerjaanOrang, setBpjsKetenagakerjaanOrang] = useState<string>('0');
  const [bpjsKetenagakerjaanKeterangan, setBpjsKetenagakerjaanKeterangan] = useState<string>('Sosialisasi pekerja rentan');

  // Helper untuk mereset seluruh isian kinerja harian ke 0
  const handleResetKinerjaToZero = () => {
    setOpsirPbbWp('0');
    setPerlinsosKk('0');
    setIkdOrang('0');
    setBpjsKetenagakerjaanOrang('0');
  };

  // Tugas Tambahan POSKAMLING / SISKAMLING
  const [poskamlingAdaGiat, setPoskamlingAdaGiat] = useState<boolean>(true);
  const [poskamlingStatus, setPoskamlingStatus] = useState<string>('Aktif Ronda Malam');
  const [poskamlingLokasi, setPoskamlingLokasi] = useState<string>(
    initialAccount.lingkungan ? `Pos Ronda ${initialAccount.lingkungan}` : 'Pos Ronda Lingkungan'
  );
  const [poskamlingPetugas, setPoskamlingPetugas] = useState<string>('Kepling & Warga Ronda');
  const [poskamlingKeterangan, setPoskamlingKeterangan] = useState<string>(
    'Patroli siskamling lingkungan kondusif dan aman'
  );

  const [kegiatanLainnya, setKegiatanLainnya] = useState<string>('Pemantauan kebersihan lingkungan dan drainase warga');

  // Dokumentasi Foto state
  const [fotoList, setFotoList] = useState<FotoDokumentasi[]>([]);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [syncToCalendar, setSyncToCalendar] = useState(true);

  // Load saved profile info from localStorage
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
      if (savedProfile && !preselectedKepling) {
        const parsed = JSON.parse(savedProfile);
        if (parsed.namaKepling) setNamaKepling(parsed.namaKepling);
        if (parsed.jabatan) setJabatan(parsed.jabatan);
        if (parsed.kelurahan) setKelurahan(parsed.kelurahan);
        if (parsed.kecamatan) setKecamatan(parsed.kecamatan);
      }
    } catch (e) {
      console.warn('Could not read from localStorage:', e);
    }
  }, [preselectedKepling]);

  // Sync account when preselectedKepling or activeAccount changes
  useEffect(() => {
    const acc = preselectedKepling || activeAccount;
    if (acc) {
      setSelectedAccountId(acc.id);
      setNamaKepling(acc.nama);
      setJabatan(acc.jabatan);
      setKelurahan(acc.kelurahan);
      setKecamatan(acc.kecamatan);
      if (acc.lingkungan) {
        setPoskamlingLokasi(`Pos Ronda ${acc.lingkungan}`);
      }
    }
  }, [preselectedKepling, activeAccount]);

  // Save profile when changed
  const savePersistentProfile = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY_PROFILE,
        JSON.stringify({ namaKepling, jabatan, kelurahan, kecamatan })
      );
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRawDate(val);
    if (val) {
      const selected = new Date(val + 'T00:00:00');
      setHari(getNamaHariIndonesia(selected));
      setTanggalText(formatTanggalIndonesia(selected));
    }
  };

  const handleHariChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setHari(e.target.value);
  };

  const compressFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxDim = 900;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.65));
          } else {
            resolve((event.target?.result as string) || '');
          }
        };
        img.onerror = () => {
          resolve((event.target?.result as string) || '');
        };
        img.src = (event.target?.result as string) || '';
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kategori: 'poskamling' | 'umum' = 'umum'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray: File[] = Array.from(files);
    e.target.value = '';

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const compressedUrl = await compressFile(file);
      if (compressedUrl) {
        setFotoList((prev) => [
          ...prev,
          {
            id: 'foto_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) + '_' + i,
            url: compressedUrl,
            name:
              kategori === 'poskamling'
                ? `[POSKAMLING] ${file.name || 'Foto Ronda'}`
                : file.name || `Foto ${prev.length + 1}`,
            timestamp: new Date().toISOString(),
            kategori,
          },
        ]);
      }
    }
  };

  const removePhoto = (id: string) => {
    setFotoList((prev) => prev.filter((p) => p.id !== id));
  };

  const constructReportItem = (): LaporanHarianItem => {
    const kinerja: KinerjaHarian = {
      opsirPbbWp: opsirPbbWp.trim() || '0',
      opsirPbbKeterangan: opsirPbbKeterangan.trim(),
      perlinsosKk: perlinsosKk.trim() || '0',
      perlinsosKeterangan: perlinsosKeterangan.trim(),
      ikdOrang: ikdOrang.trim() || '0',
      ikdKeterangan: ikdKeterangan.trim(),
      bpjsKetenagakerjaanOrang: bpjsKetenagakerjaanOrang.trim() || '0',
      bpjsKetenagakerjaanKeterangan: bpjsKetenagakerjaanKeterangan.trim(),
      // Tugas Tambahan POSKAMLING
      poskamlingAdaGiat,
      poskamlingStatus: poskamlingAdaGiat ? poskamlingStatus.trim() : 'Tidak Ada Giat',
      poskamlingLokasi: poskamlingAdaGiat ? poskamlingLokasi.trim() : '',
      poskamlingPetugas: poskamlingAdaGiat ? poskamlingPetugas.trim() : '',
      poskamlingKeterangan: poskamlingAdaGiat ? poskamlingKeterangan.trim() : '',
      kegiatanLainnya: kegiatanLainnya.trim(),
    };

    return {
      id: 'lap_' + Date.now(),
      keplingId: selectedAccountId,
      hari,
      tanggal: tanggalText,
      namaKepling: namaKepling.trim(),
      jabatan: jabatan.trim(),
      kelurahan: kelurahan.trim(),
      kecamatan: kecamatan.trim(),
      kinerja,
      jumlahDokumentasi: fotoList.length,
      dokumentasiFoto: fotoList,
      createdAt: rawDate ? `${rawDate}T12:00:00.000Z` : new Date().toISOString(),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      savePersistentProfile();
      const item = constructReportItem();
      await onSaveReport(item, syncToCalendar && hasGoogleAuth);
      // Reset daily performance fields to 0 as instructed
      setOpsirPbbWp('0');
      setOpsirPbbKeterangan('');
      setPerlinsosKk('0');
      setPerlinsosKeterangan('');
      setIkdOrang('0');
      setIkdKeterangan('');
      setBpjsKetenagakerjaanOrang('0');
      setBpjsKetenagakerjaanKeterangan('');
      setPoskamlingKeterangan('');
      setKegiatanLainnya('');
      setFotoList([]);
    } catch (err) {
      console.error('Submit report error:', err);
    }
  };

  const handleCopyPreview = async () => {
    const report = constructReportItem();
    const text = [
      `*🟩 LAPORAN KEGIATAN HARIAN*`,
      `*${(report.jabatan || 'KEPALA LINGKUNGAN').toUpperCase()}*`,
      `*${(report.kelurahan || 'KELURAHAN MANGGA').toUpperCase()}*`,
      `*${(report.kecamatan || 'KECAMATAN MEDAN TUNTUNGAN').toUpperCase()}*`,
      ``,
      `📅 Hari      : ${report.hari}`,
      `📆 Tanggal   : ${report.tanggal}`,
      `👤 Nama      : ${report.namaKepling}`,
      `🏷️ Jabatan   : ${report.jabatan}`,
      ``,
      `📋 KINERJA HARIAN:`,
      `1. OPSIR PBB : ${report.kinerja.opsirPbbWp || '0'} WP ${report.kinerja.opsirPbbKeterangan ? `(${report.kinerja.opsirPbbKeterangan})` : ''}`,
      `2. PERLINSOS : ${report.kinerja.perlinsosKk || '0'} KK ${report.kinerja.perlinsosKeterangan ? `(${report.kinerja.perlinsosKeterangan})` : ''}`,
      `3. IDENTITAS KEPENDUDUKAN DIGITAL : ${report.kinerja.ikdOrang || '0'} ORANG ${report.kinerja.ikdKeterangan ? `(${report.kinerja.ikdKeterangan})` : ''}`,
      `4. BPJS KETENAGAKERJAAN : ${report.kinerja.bpjsKetenagakerjaanOrang || '0'} ORANG ${report.kinerja.bpjsKetenagakerjaanKeterangan ? `(${report.kinerja.bpjsKetenagakerjaanKeterangan})` : ''}`,
      report.kinerja.poskamlingStatus && report.kinerja.poskamlingStatus !== 'Tidak Ada Giat'
        ? `5. POSKAMLING / SISKAMLING : ${report.kinerja.poskamlingStatus}${report.kinerja.poskamlingLokasi ? ` (${report.kinerja.poskamlingLokasi})` : ''}${report.kinerja.poskamlingPetugas ? `\n   - Petugas/Warga : ${report.kinerja.poskamlingPetugas}` : ''}${report.kinerja.poskamlingKeterangan ? `\n   - Situasi/Catatan: ${report.kinerja.poskamlingKeterangan}` : ''}`
        : '',
      report.kinerja.kegiatanLainnya ? `6. KEGIATAN LAINNYA : ${report.kinerja.kegiatanLainnya}` : '',
      ``,
      `📷 (Dokumentasi Terlampir: ${report.jumlahDokumentasi} Foto)`,
      ``,
      `#MedanUntukSemua`,
      `#SemuaUntukMedan`,
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(text);
    } catch (clipErr) {
      console.warn('Clipboard write warning:', clipErr);
    }
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 3000);

    // Otomatis simpan juga ke database agar tidak terlewatkan saat dikirim ke WA
    try {
      savePersistentProfile();
      await onSaveReport(report, syncToCalendar && hasGoogleAuth);
    } catch (saveErr) {
      console.error('Auto-save on copy error:', saveErr);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Identitas & Waktu Pelaporan */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-6 bg-emerald-500 rounded-full"></span>
                <h2 className="text-base font-bold uppercase tracking-wider text-slate-800">
                  1. Identitas Petugas & Tanggal
                </h2>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                24 Lingkungan & Super Admin
              </span>
            </div>

            {/* Identitas Petugas Terkunci Sesuai Akun Login APK */}
            <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                    {activeAccount?.role === 'super_admin' ? (
                      <Shield className="w-6 h-6 text-amber-300" />
                    ) : (
                      activeAccount?.nomorLingkungan || 'KL'
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                        {activeAccount?.nama}
                      </span>
                      <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300">
                        {activeAccount?.lingkungan || 'Kelurahan'}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-850 font-semibold mt-0.5">
                      {activeAccount?.jabatan}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {activeAccount?.kelurahan || 'Kelurahan Mangga'} • {activeAccount?.kecamatan || 'Kecamatan Medan Tuntungan'}
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-emerald-300 text-emerald-800 text-xs font-bold shadow-2xs self-start sm:self-center">
                  <Lock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Identitas Terkunci Sesuai Akun Login APK</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hari
                </label>
                <select
                  id="select-hari"
                  value={hari}
                  onChange={handleHariChange}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500 text-slate-800 font-semibold"
                >
                  {NAMA_HARI.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Tanggal
                </label>
                <input
                  id="input-tanggal-picker"
                  type="date"
                  value={rawDate}
                  onChange={handleDateChange}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500 text-slate-800 font-semibold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Format Tanggal Laporan Resmi
                </label>
                <input
                  id="input-tanggal-text"
                  type="text"
                  value={tanggalText}
                  onChange={(e) => setTanggalText(e.target.value)}
                  placeholder="Contoh: 07 SEPTEMBER 2026"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500 text-slate-800 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Nama Petugas (Kepling)</span>
                  <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Terkunci Akun
                  </span>
                </label>
                <input
                  id="input-nama-kepling"
                  type="text"
                  value={namaKepling}
                  readOnly
                  className="w-full px-3 py-2 text-xs border border-emerald-200 rounded-lg bg-emerald-50/50 text-slate-800 font-bold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Jabatan Lingkungan</span>
                  <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Terkunci Akun
                  </span>
                </label>
                <input
                  id="input-jabatan"
                  type="text"
                  value={jabatan}
                  readOnly
                  className="w-full px-3 py-2 text-xs border border-emerald-200 rounded-lg bg-emerald-50/50 text-slate-800 font-bold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kelurahan
                </label>
                <input
                  id="input-kelurahan"
                  type="text"
                  value={kelurahan}
                  readOnly
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kecamatan
                </label>
                <input
                  id="input-kecamatan"
                  type="text"
                  value={kecamatan}
                  readOnly
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Capaian Kinerja Harian */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-6 bg-emerald-500 rounded-full"></span>
                <h2 className="text-base font-bold uppercase tracking-wider text-slate-800">
                  2. Kinerja Harian
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetKinerjaToZero}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-emerald-200 transition-colors cursor-pointer"
                  title="Kembalikan semua angka input kinerja ke 0"
                >
                  <RotateCcw className="w-3 h-3 text-slate-500" />
                  <span>Setel Semua ke 0</span>
                </button>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Instruksi Walikota Medan
                </span>
              </div>
            </div>

            {/* 1: OPSIR PBB */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-black">
                    1
                  </span>
                  OPSIR PBB (Pajak Bumi & Bangunan)
                </span>
                <span className="text-[11px] font-semibold text-slate-500">Satuan: WP</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <input
                    id="input-opsir-pbb-wp"
                    type="number"
                    min="0"
                    value={opsirPbbWp}
                    onChange={(e) => setOpsirPbbWp(e.target.value.replace(/^0+(?=\d)/, ''))}
                    placeholder="Jml WP"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-bold text-slate-800"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    id="input-opsir-pbb-ket"
                    type="text"
                    value={opsirPbbKeterangan}
                    onChange={(e) => setOpsirPbbKeterangan(e.target.value)}
                    placeholder="Contoh: Pembayaran PBB"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-medium">Pilihan:</span>
                    {['Pembayaran PBB', 'Penyampaian SPPT', 'Penagihan PBB'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setOpsirPbbKeterangan(opt)}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                          opsirPbbKeterangan === opt
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-800 font-bold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Pilar 2: PERLINSOS */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-black">
                    2
                  </span>
                  PERLINSOS (Perlindungan Sosial / Bansos)
                </span>
                <span className="text-[11px] font-semibold text-slate-500">Satuan: KK</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <input
                    id="input-perlinsos-kk"
                    type="number"
                    min="0"
                    value={perlinsosKk}
                    onChange={(e) => setPerlinsosKk(e.target.value.replace(/^0+(?=\d)/, ''))}
                    placeholder="Jml KK"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-bold text-slate-800"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    id="input-perlinsos-ket"
                    type="text"
                    value={perlinsosKeterangan}
                    onChange={(e) => setPerlinsosKeterangan(e.target.value)}
                    placeholder="Contoh: Pendataan Perlinsos"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-medium">Pilihan:</span>
                    {['Pendataan Perlinsos', 'Pengecekan data penerima bansos', 'Verifikasi Bansos'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setPerlinsosKeterangan(opt)}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                          perlinsosKeterangan === opt
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-800 font-bold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Pilar 3: IDENTITAS KEPENDUDUKAN DIGITAL */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-black">
                    3
                  </span>
                  IDENTITAS KEPENDUDUKAN DIGITAL (IKD)
                </span>
                <span className="text-[11px] font-semibold text-slate-500">Satuan: Orang</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <input
                    id="input-ikd-orang"
                    type="number"
                    min="0"
                    value={ikdOrang}
                    onChange={(e) => setIkdOrang(e.target.value.replace(/^0+(?=\d)/, ''))}
                    placeholder="Jml Orang"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-bold text-slate-800"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    id="input-ikd-ket"
                    type="text"
                    value={ikdKeterangan}
                    onChange={(e) => setIkdKeterangan(e.target.value)}
                    placeholder="Keterangan aktivasi IKD"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Pilar 4: BPJS KETENAGAKERJAAN */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-black">
                    4
                  </span>
                  BPJS KETENAGAKERJAAN
                </span>
                <span className="text-[11px] font-semibold text-slate-500">Satuan: Orang</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <input
                    id="input-bpjs-orang"
                    type="number"
                    min="0"
                    value={bpjsKetenagakerjaanOrang}
                    onChange={(e) => setBpjsKetenagakerjaanOrang(e.target.value.replace(/^0+(?=\d)/, ''))}
                    placeholder="Jml Orang"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-bold text-slate-800"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    id="input-bpjs-ket"
                    type="text"
                    value={bpjsKetenagakerjaanKeterangan}
                    onChange={(e) => setBpjsKetenagakerjaanKeterangan(e.target.value)}
                    placeholder="Keterangan sosialisasi / pendaftaran"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Kegiatan Lainnya */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                5. Kegiatan Tambahan Lapangan (Opsional)
              </label>
              <textarea
                id="input-kegiatan-lainnya"
                rows={2}
                value={kegiatanLainnya}
                onChange={(e) => setKegiatanLainnya(e.target.value)}
                placeholder="( Cth. Pemantauan Kebersihan Lingkungan dan Drainase Warga, Gotong Royong Posko Trantibum, Posko BERSEMI, Posko PATAM dll )"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500 text-slate-800"
              />
            </div>
          </div>

          {/* Section: Tugas Tambahan POSKAMLING & Upload Foto Poskamling */}
          <div className="bg-white border-2 border-amber-300/80 rounded-xl p-6 shadow-sm space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-amber-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-6 bg-amber-500 rounded-full"></span>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-600" />
                  <h2 className="text-base font-bold uppercase tracking-wider text-slate-800">
                    Tugas Tambahan: POSKAMLING / SISKAMLING
                  </h2>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={poskamlingAdaGiat}
                  onChange={(e) => setPoskamlingAdaGiat(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span>Ada Kegiatan Poskamling</span>
              </label>
            </div>

            {poskamlingAdaGiat ? (
              <div className="space-y-4">
                {/* Preset status buttons */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Pilih Status / Jenis Kegiatan Poskamling:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Aktif Ronda Malam',
                      'Patroli Bersama Warga',
                      'Pemeriksaan Pos Kamling',
                      'Sosialisasi Kamtibmas Warga',
                      'Situasi Aman Terkendali',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPoskamlingStatus(preset)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          poskamlingStatus === preset
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form fields: Status, Lokasi, Petugas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Poskamling
                    </label>
                    <input
                      id="input-poskamling-status"
                      type="text"
                      value={poskamlingStatus}
                      onChange={(e) => setPoskamlingStatus(e.target.value)}
                      placeholder="Contoh: Aktif Ronda Malam"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 font-semibold focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Lokasi Poskamling / Pos Ronda
                    </label>
                    <input
                      id="input-poskamling-lokasi"
                      type="text"
                      value={poskamlingLokasi}
                      onChange={(e) => setPoskamlingLokasi(e.target.value)}
                      placeholder="Contoh: Pos Ronda Lingkungan IV"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Petugas Jaga / Warga Ronda
                    </label>
                    <input
                      id="input-poskamling-petugas"
                      type="text"
                      value={poskamlingPetugas}
                      onChange={(e) => setPoskamlingPetugas(e.target.value)}
                      placeholder="Contoh: Kepling & 3 Warga Ronda"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Catatan Situasi Kamtibmas
                    </label>
                    <input
                      id="input-poskamling-keterangan"
                      type="text"
                      value={poskamlingKeterangan}
                      onChange={(e) => setPoskamlingKeterangan(e.target.value)}
                      placeholder="Contoh: Situasi malam kondusif dan aman"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Tombol Upload Khusus Foto Poskamling */}
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-amber-600" />
                        Unggah / Ambil Foto Khusus Poskamling
                      </span>
                      <p className="text-[11px] text-amber-700">
                        Foto pos ronda, kepling bersama warga ronda, atau absensi jaga malam.
                      </p>
                    </div>

                    <div>
                      <input
                        id="file-input-poskamling"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'poskamling')}
                        className="hidden"
                      />
                      <label
                        htmlFor="file-input-poskamling"
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Ambil / Upload Foto Poskamling</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                Kegiatan Poskamling tidak dicatat untuk hari ini (opsional).
              </div>
            )}
          </div>

          {/* Section 3: Dokumentasi Foto Lapangan */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-6 bg-emerald-500 rounded-full"></span>
                <h2 className="text-base font-bold uppercase tracking-wider text-slate-800">
                  3. Dokumentasi Kegiatan Lapangan
                </h2>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {fotoList.length} Foto Terpilih
              </span>
            </div>

            {/* Upload Area */}
            <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-6 text-center transition-colors bg-slate-50/50">
              <input
                id="file-input-dokumentasi"
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <label
                htmlFor="file-input-dokumentasi"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <span className="font-bold text-emerald-800 hover:underline">
                    Klik untuk mengambil / mengunggah foto
                  </span>{' '}
                  <span className="text-slate-500">atau drag & drop foto ke sini</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Mendukung file PNG, JPG, JPEG dari kamera HP atau galeri
                </p>
              </label>
            </div>

            {/* Photo thumbnails */}
            {fotoList.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-2">
                {fotoList.map((foto) => (
                  <div
                    key={foto.id}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square shadow-2xs"
                  >
                    <img
                      src={foto.url}
                      alt={foto.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    {(foto.kategori === 'poskamling' || foto.name.includes('[POSKAMLING]')) && (
                      <span className="absolute top-1 left-1 bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded shadow-xs flex items-center gap-1">
                        <Shield className="w-2.5 h-2.5" />
                        POSKAMLING
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(foto.id)}
                      className="absolute top-1 right-1 p-1 bg-red-600/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-700 shadow-sm"
                      title="Hapus foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate text-center">
                      {foto.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sticky Live Report Summary & Database Sync (5 cols) */}
        <div className="lg:col-span-5 sticky top-6 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Header Pratinjau */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Format Laporan Resmi
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Standar Pelaporan Kepling Kota Medan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyPreview}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white px-2.5 py-1.5 rounded bg-emerald-800 hover:bg-emerald-700 transition-colors cursor-pointer border border-emerald-600/50"
                title="Salin teks laporan sekaligus simpan ke database"
              >
                {copiedPreview ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPreview ? 'Tersalin & Tersimpan!' : 'Salin & Simpan'}</span>
              </button>
            </div>

            {/* Monospaced Report Preview */}
            <div className="p-4 bg-slate-950 text-emerald-400 font-mono text-[11.5px] leading-relaxed max-h-96 overflow-y-auto space-y-2 border-b border-slate-800 select-text">
              <p className="text-white font-bold">
                🟩 LAPORAN KEGIATAN HARIAN<br />
                {jabatan.toUpperCase() || 'KEPALA LINGKUNGAN'}<br />
                {kelurahan.toUpperCase() || 'KELURAHAN MANGGA'}<br />
                {kecamatan.toUpperCase() || 'KECAMATAN MEDAN TUNTUNGAN'}
              </p>

              <div className="text-slate-300 space-y-0.5 pt-1 border-t border-slate-800">
                <p>📅 Hari    : {hari}</p>
                <p>📆 Tanggal : {tanggalText}</p>
                <p>👤 Nama    : {namaKepling}</p>
                <p>🏷️ Jabatan : {jabatan}</p>
              </div>

              <div className="pt-2 border-t border-slate-800 text-slate-200">
                <p className="font-bold text-amber-300 mb-1">📋 KINERJA HARIAN:</p>
                <p>1. OPSIR PBB : <span className="text-emerald-300 font-bold">{opsirPbbWp || 0} WP</span> {opsirPbbKeterangan && `(${opsirPbbKeterangan})`}</p>
                <p>2. PERLINSOS : <span className="text-emerald-300 font-bold">{perlinsosKk || 0} KK</span> {perlinsosKeterangan && `(${perlinsosKeterangan})`}</p>
                <p>3. IKD       : <span className="text-emerald-300 font-bold">{ikdOrang || 0} ORANG</span> {ikdKeterangan && `(${ikdKeterangan})`}</p>
                <p>4. BPJS TK   : <span className="text-emerald-300 font-bold">{bpjsKetenagakerjaanOrang || 0} ORANG</span> {bpjsKetenagakerjaanKeterangan && `(${bpjsKetenagakerjaanKeterangan})`}</p>
                {poskamlingAdaGiat && poskamlingStatus && (
                  <p className="text-amber-300">
                    5. POSKAMLING: <span className="text-amber-200 font-bold">{poskamlingStatus}</span>
                    {poskamlingLokasi && ` (${poskamlingLokasi})`}
                    {poskamlingPetugas && ` [Petugas: ${poskamlingPetugas}]`}
                    {poskamlingKeterangan && ` - ${poskamlingKeterangan}`}
                  </p>
                )}
                {kegiatanLainnya && (
                  <p className="text-slate-400 mt-1">{poskamlingAdaGiat ? '6' : '5'}. LAINNYA  : {kegiatanLainnya}</p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800 text-slate-400">
                <p>📷 (Dokumentasi Terlampir: {fotoList.length} Foto)</p>
                <p className="text-emerald-500 font-semibold mt-1">#MedanUntukSemua<br />#SemuaUntukMedan</p>
              </div>
            </div>

            {/* Google Calendar & Database Sync Settings */}
            <div className="p-4 bg-slate-50 space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncToCalendar}
                  onChange={(e) => setSyncToCalendar(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  Otomatis munculkan di Google Calendar pengguna
                </span>
              </label>

              {!hasGoogleAuth && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-950 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Penyimpanan Database Langsung:</span>
                    <span>Laporan otomatis disimpan aman ke Database Aplikasi. Anda juga dapat menghubungkan Google jika ingin sinkronisasi ke Google Sheets & Calendar.</span>
                    <button
                      type="button"
                      onClick={onConnectGoogle}
                      className="mt-1 inline-block font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                    >
                      Hubungkan Google Sheets & Calendar →
                    </button>
                  </div>
                </div>
              )}

              {/* Primary Action Button */}
              <button
                id="btn-simpan-laporan-database"
                type="submit"
                disabled={isSaving}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Menyimpan ke Database...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Simpan Laporan ke Database</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-500">
                Laporan tersimpan di database resmi kelurahan, terintegrasi monitoring Super Admin & kalender.
              </p>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
