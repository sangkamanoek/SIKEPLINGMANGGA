import React, { useState, useRef, useEffect } from 'react';
import { LaporanMonitoringInfrastruktur, UserAccount } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import {
  X,
  Save,
  Camera,
  Upload,
  Link2,
  Trash2,
  MapPin,
  Calendar,
  User,
  FileText,
  ExternalLink,
  Layers,
  Sparkles,
  AlertCircle,
  Zap,
  CheckCircle2,
} from 'lucide-react';

interface FormLaporanMonitoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (report: LaporanMonitoringInfrastruktur) => void;
  initialReport?: LaporanMonitoringInfrastruktur | null;
  currentUser: UserAccount;
}

// Helper to compress image
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
};

export const FormLaporanMonitoringModal: React.FC<FormLaporanMonitoringModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialReport,
  currentUser,
}) => {
  const [nomorLaporan, setNomorLaporan] = useState('');
  const [subjek, setSubjek] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [lingkunganNomor, setLingkunganNomor] = useState<number>(10);
  const [koordinatUrl, setKoordinatUrl] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [pelapor, setPelapor] = useState('');
  const [kategoriIsu, setKategoriIsu] = useState('LPJU / Penerangan');
  const [statusTindakLanjut, setStatusTindakLanjut] = useState<
    'MENUNGGU_TINDAK_LANJUT' | 'SEDANG_DITANGANI' | 'SELESAI_DIPERBAIKI'
  >('MENUNGGU_TINDAK_LANJUT');
  const [keterangan, setKeterangan] = useState('');

  // 3 Angle Photo States
  const [fotoAngle1Url, setFotoAngle1Url] = useState('');
  const [fotoAngle1Label, setFotoAngle1Label] = useState('Angle 1: Tampak Depan / Tiang Utama');
  const [fotoAngle2Url, setFotoAngle2Url] = useState('');
  const [fotoAngle2Label, setFotoAngle2Label] = useState('Angle 2: Tampak Samping / Ruas Jalan');
  const [fotoAngle3Url, setFotoAngle3Url] = useState('');
  const [fotoAngle3Label, setFotoAngle3Label] = useState('Angle 3: Tampak Luas / Situasi Malam/Siang');

  // Input URL toggles
  const [showUrlAngle1, setShowUrlAngle1] = useState(false);
  const [showUrlAngle2, setShowUrlAngle2] = useState(false);
  const [showUrlAngle3, setShowUrlAngle3] = useState(false);
  const [customUrl1, setCustomUrl1] = useState('');
  const [customUrl2, setCustomUrl2] = useState('');
  const [customUrl3, setCustomUrl3] = useState('');

  const [formError, setFormError] = useState<string | null>(null);

  const fileAngle1CameraRef = useRef<HTMLInputElement>(null);
  const fileAngle1GalleryRef = useRef<HTMLInputElement>(null);
  const fileAngle2CameraRef = useRef<HTMLInputElement>(null);
  const fileAngle2GalleryRef = useRef<HTMLInputElement>(null);
  const fileAngle3CameraRef = useRef<HTMLInputElement>(null);
  const fileAngle3GalleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialReport) {
      setNomorLaporan(initialReport.nomorLaporan || '');
      setSubjek(initialReport.subjek || '');
      setLokasi(initialReport.lokasi || '');
      setLingkunganNomor(initialReport.lingkunganNomor || 10);
      setKoordinatUrl(initialReport.koordinatUrl || '');
      setTanggal(initialReport.tanggal || '');
      setPelapor(initialReport.pelapor || '');
      setKategoriIsu(initialReport.kategoriIsu || 'LPJU / Penerangan');
      setStatusTindakLanjut(initialReport.statusTindakLanjut || 'MENUNGGU_TINDAK_LANJUT');
      setKeterangan(initialReport.keterangan || '');
      setFotoAngle1Url(initialReport.fotoAngle1Url || '');
      setFotoAngle1Label(initialReport.fotoAngle1Label || 'Angle 1: Tampak Depan / Tiang Utama');
      setFotoAngle2Url(initialReport.fotoAngle2Url || '');
      setFotoAngle2Label(initialReport.fotoAngle2Label || 'Angle 2: Tampak Samping / Ruas Jalan');
      setFotoAngle3Url(initialReport.fotoAngle3Url || '');
      setFotoAngle3Label(initialReport.fotoAngle3Label || 'Angle 3: Tampak Luas / Situasi Malam/Siang');
    } else {
      // Default New Form
      const initialLingkungan = currentUser.nomorLingkungan || 10;
      const autoKepling =
        (currentUser.role === 'kepling' && currentUser.nama)
          ? currentUser.nama
          : KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === initialLingkungan)?.nama || 'Fery Arapenta Tarigan';

      setNomorLaporan('158/MANGGA');
      setSubjek('LPJU Padam sebanyak 9 Titik');
      setLokasi('Jl. Tali Air Kelurahan Mangga Kecamatan Medan Tuntungan');
      setLingkunganNomor(initialLingkungan);
      setKoordinatUrl('https://maps.app.goo.gl/wVNAV1fu3ufn1ihy5?g_st=aw');
      setTanggal('2026-09-30');
      setPelapor(autoKepling);
      setKategoriIsu('LPJU / Penerangan');
      setStatusTindakLanjut('MENUNGGU_TINDAK_LANJUT');
      setKeterangan(
        'Laporan monitoring kondisi lampu penerangan jalan umum (LPJU) padam sebanyak 9 titik di sepanjang Jl. Tali Air Kelurahan Mangga.'
      );
      setFotoAngle1Url('/src/assets/images/proses_lampu_lpju_1790846499280.jpg');
      setFotoAngle1Label('Angle 1: Tampak Depan / Tiang LPJU Padam');
      setFotoAngle2Url('/src/assets/images/proses_instalasi_lpju_1790856798909.jpg');
      setFotoAngle2Label('Angle 2: Tampak Samping / Deretan Tiang Jl. Tali Air');
      setFotoAngle3Url('/src/assets/images/awal_gang_becek_tanah_1790856733273.jpg');
      setFotoAngle3Label('Angle 3: Tampak Luas / Situasi Malam/Siang');
    }
    setFormError(null);
  }, [initialReport, isOpen, currentUser]);

  // Handler when Lingkungan changes -> automatically sync Kepling name
  const handleLingkunganChange = (no: number) => {
    setLingkunganNomor(no);
    const foundKepling = KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === no);
    if (foundKepling && foundKepling.nama) {
      setPelapor(foundKepling.nama);
    }
  };

  if (!isOpen) return null;

  const handleUploadPhoto = async (
    files: FileList | null,
    angle: 1 | 2 | 3
  ) => {
    if (!files || files.length === 0) return;
    try {
      const compressed = await compressImage(files[0]);
      if (angle === 1) setFotoAngle1Url(compressed);
      else if (angle === 2) setFotoAngle2Url(compressed);
      else setFotoAngle3Url(compressed);
    } catch {
      alert('Gagal memproses file foto. Pastikan format file adalah gambar valid.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomorLaporan.trim()) {
      setFormError('Nomor laporan wajib diisi (Contoh: 158/MANGGA).');
      return;
    }
    if (!subjek.trim()) {
      setFormError('Subjek laporan wajib diisi.');
      return;
    }
    if (!lokasi.trim()) {
      setFormError('Lokasi wajib diisi.');
      return;
    }
    if (!pelapor.trim()) {
      setFormError('Nama pelapor wajib diisi.');
      return;
    }

    const reportData: LaporanMonitoringInfrastruktur = {
      id: initialReport?.id || `mon_${Date.now()}`,
      nomorLaporan: nomorLaporan.trim(),
      subjek: subjek.trim(),
      lokasi: lokasi.trim(),
      lingkunganNomor: Number(lingkunganNomor) || 1,
      koordinatUrl: koordinatUrl.trim() || undefined,
      tanggal: tanggal.trim() || new Date().toISOString().split('T')[0],
      pelapor: pelapor.trim(),
      kategoriIsu,
      statusTindakLanjut,
      keterangan: keterangan.trim() || undefined,
      fotoAngle1Url: fotoAngle1Url.trim() || undefined,
      fotoAngle1Label: fotoAngle1Label.trim() || 'Angle 1: Tampak Depan',
      fotoAngle2Url: fotoAngle2Url.trim() || undefined,
      fotoAngle2Label: fotoAngle2Label.trim() || 'Angle 2: Tampak Samping',
      fotoAngle3Url: fotoAngle3Url.trim() || undefined,
      fotoAngle3Label: fotoAngle3Label.trim() || 'Angle 3: Tampak Luas',
      createdAt: initialReport?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(reportData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-blue-600/80 rounded-xl border border-blue-400/40 shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black truncate">
                {initialReport ? 'Edit Laporan Monitoring' : 'Buat Laporan Monitoring Infrastruktur'}
              </h3>
              <p className="text-[11px] text-blue-200 font-medium truncate">
                Format Resmi 6 Parameter Lapangan &amp; 3 Slot Upload Foto (3 Angle)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              form="form-monitoring-infra"
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5 border border-emerald-400/40 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">Simpan Laporan</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Form Body */}
        <form
          id="form-monitoring-infra"
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-slate-800 text-xs">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Parameter 1: Nomor Laporan & Tanggal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-black">
                    1
                  </span>
                  <span>Nomor Laporan <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  value={nomorLaporan}
                  onChange={(e) => setNomorLaporan(e.target.value)}
                  placeholder="Contoh: 158/MANGGA"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono font-bold text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-black">
                    5
                  </span>
                  <span>Tanggal Pelaporan <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Parameter 2: Subjek Laporan */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-black">
                  2
                </span>
                <span>Subjek Laporan Monitoring <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                required
                value={subjek}
                onChange={(e) => setSubjek(e.target.value)}
                placeholder="Contoh: LPJU Padam sebanyak 9 Titik"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-xs sm:text-sm text-blue-950 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Parameter 3: Lokasi & Lingkungan */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-black">
                    3
                  </span>
                  <span>Lokasi Detail <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  value={lokasi}
                  onChange={(e) => setLokasi(e.target.value)}
                  placeholder="Contoh: Jl. Tali Air Kelurahan Mangga Kecamatan Medan Tuntungan"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nomor Lingkungan</label>
                <select
                  value={lingkunganNomor}
                  onChange={(e) => handleLingkunganChange(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Lingkungan {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Parameter 4: Koordinat / Link Google Maps */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-black">
                    4
                  </span>
                  <span>Titik Koordinat / Tautan Google Maps</span>
                </span>
                {koordinatUrl && (
                  <a
                    href={koordinatUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                  >
                    <span>Uji Tautan Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </label>
              <input
                type="url"
                value={koordinatUrl}
                onChange={(e) => setKoordinatUrl(e.target.value)}
                placeholder="Contoh: https://maps.app.goo.gl/wVNAV1fu3ufn1ihy5?g_st=aw"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-blue-50/30"
              />
            </div>

            {/* Parameter 6: Dari (Pelapor) & Kategori */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-black">
                      6
                    </span>
                    <span>Dari (Nama Pelapor / Kepling) <span className="text-rose-500">*</span></span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const found = KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === lingkunganNomor);
                      if (found?.nama) setPelapor(found.nama);
                    }}
                    className="text-[10px] text-blue-700 hover:text-blue-900 font-bold bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                    title="Gunakan nama Kepling yang bertugas di Lingkungan ini"
                  >
                    <User className="w-3 h-3" />
                    <span>Sync Kepling Lingk. {lingkunganNomor}</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={pelapor}
                  onChange={(e) => setPelapor(e.target.value)}
                  placeholder="Nama Kepala Lingkungan"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-black text-xs sm:text-sm text-blue-950 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50/50"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Kategori Isu / Masalah</label>
                <select
                  value={kategoriIsu}
                  onChange={(e) => setKategoriIsu(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="LPJU / Penerangan">💡 LPJU / Penerangan Jalan Umum</option>
                  <option value="Jalan Rusak / Berlubang">🛣️ Jalan Rusak / Berlubang</option>
                  <option value="Drainase / Parit Tersumbat">🌊 Drainase / Parit Tersumbat</option>
                  <option value="Paving / Trotoar">🧱 Paving Blok / Trotoar</option>
                  <option value="Lainnya">📦 Masalah Fasilitas Umum Lainnya</option>
                </select>
              </div>
            </div>

            {/* Status Penanganan (Sudah Ditangani / Belum) */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700 flex items-center justify-between">
                <span>Status Penanganan Lapangan</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  statusTindakLanjut === 'SELESAI_DIPERBAIKI'
                    ? 'bg-emerald-100 text-emerald-800'
                    : statusTindakLanjut === 'SEDANG_DITANGANI'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {statusTindakLanjut === 'SELESAI_DIPERBAIKI'
                    ? 'Sudah Ditangani'
                    : statusTindakLanjut === 'SEDANG_DITANGANI'
                    ? 'Sedang Ditangani'
                    : 'Belum Ditangani'}
                </span>
              </label>
              <select
                value={statusTindakLanjut}
                onChange={(e) => setStatusTindakLanjut(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-black text-xs focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="MENUNGGU_TINDAK_LANJUT">🔴 Belum Ditangani (Menunggu Tindak Lanjut)</option>
                <option value="SEDANG_DITANGANI">🟡 Sedang Ditangani (Proses Pengerjaan)</option>
                <option value="SELESAI_DIPERBAIKI">🟢 Sudah Ditangani (Selesai Tuntas)</option>
              </select>
            </div>

            {/* Catatan / Keterangan */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Uraian Situasi &amp; Catatan Monitoring</label>
              <textarea
                rows={3}
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Jelaskan kondisi detail kerusakan, dampak bagi warga, dan urgensi perbaikan..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
              />
            </div>

            {/* ========================================================================= */}
            {/* 3 SLOTS UPLOAD FOTO DARI SUDUT PANDANG (ANGLE) BERBEDA                     */}
            {/* ========================================================================= */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Upload Foto Dokumentasi (3 Sudut Pandang / Angle Berbeda)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Sertakan 3 foto dari sudut berbeda agar kondisi fisik fasilitas terlihat jelas dan akurat.
                  </p>
                </div>
              </div>

              {/* Angle 1 Upload Slot */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-blue-900 text-xs">
                    📸 1. Foto Angle 1 (Tampak Depan / Objek Utama)
                  </span>
                  {fotoAngle1Url && (
                    <button
                      type="button"
                      onClick={() => setFotoAngle1Url('')}
                      className="text-rose-600 hover:text-rose-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus Foto</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    ref={fileAngle1CameraRef}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleUploadPhoto(e.target.files, 1)}
                  />
                  <input
                    type="file"
                    ref={fileAngle1GalleryRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUploadPhoto(e.target.files, 1)}
                  />

                  <button
                    type="button"
                    onClick={() => fileAngle1CameraRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Kamera HP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileAngle1GalleryRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Pilih Galeri</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUrlAngle1(!showUrlAngle1)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Link URL</span>
                  </button>
                </div>

                {showUrlAngle1 && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="url"
                      value={customUrl1}
                      onChange={(e) => setCustomUrl1(e.target.value)}
                      placeholder="Tempel tautan URL foto..."
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customUrl1.trim()) {
                          setFotoAngle1Url(customUrl1.trim());
                          setCustomUrl1('');
                          setShowUrlAngle1(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs cursor-pointer"
                    >
                      Pasang
                    </button>
                  </div>
                )}

                {fotoAngle1Url && (
                  <div className="mt-2 relative w-32 h-24 rounded-xl overflow-hidden border border-slate-300 shadow-xs">
                    <img
                      src={fotoAngle1Url}
                      alt="Angle 1"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Angle 2 Upload Slot */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-blue-900 text-xs">
                    📸 2. Foto Angle 2 (Tampak Samping / Ruas Jalan)
                  </span>
                  {fotoAngle2Url && (
                    <button
                      type="button"
                      onClick={() => setFotoAngle2Url('')}
                      className="text-rose-600 hover:text-rose-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus Foto</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    ref={fileAngle2CameraRef}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleUploadPhoto(e.target.files, 2)}
                  />
                  <input
                    type="file"
                    ref={fileAngle2GalleryRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUploadPhoto(e.target.files, 2)}
                  />

                  <button
                    type="button"
                    onClick={() => fileAngle2CameraRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Kamera HP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileAngle2GalleryRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Pilih Galeri</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUrlAngle2(!showUrlAngle2)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Link URL</span>
                  </button>
                </div>

                {showUrlAngle2 && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="url"
                      value={customUrl2}
                      onChange={(e) => setCustomUrl2(e.target.value)}
                      placeholder="Tempel tautan URL foto..."
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customUrl2.trim()) {
                          setFotoAngle2Url(customUrl2.trim());
                          setCustomUrl2('');
                          setShowUrlAngle2(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs cursor-pointer"
                    >
                      Pasang
                    </button>
                  </div>
                )}

                {fotoAngle2Url && (
                  <div className="mt-2 relative w-32 h-24 rounded-xl overflow-hidden border border-slate-300 shadow-xs">
                    <img
                      src={fotoAngle2Url}
                      alt="Angle 2"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Angle 3 Upload Slot */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-blue-900 text-xs">
                    📸 3. Foto Angle 3 (Tampak Luas / Perspektif Wilayah)
                  </span>
                  {fotoAngle3Url && (
                    <button
                      type="button"
                      onClick={() => setFotoAngle3Url('')}
                      className="text-rose-600 hover:text-rose-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus Foto</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    ref={fileAngle3CameraRef}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleUploadPhoto(e.target.files, 3)}
                  />
                  <input
                    type="file"
                    ref={fileAngle3GalleryRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUploadPhoto(e.target.files, 3)}
                  />

                  <button
                    type="button"
                    onClick={() => fileAngle3CameraRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Kamera HP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileAngle3GalleryRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Pilih Galeri</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUrlAngle3(!showUrlAngle3)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Link URL</span>
                  </button>
                </div>

                {showUrlAngle3 && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="url"
                      value={customUrl3}
                      onChange={(e) => setCustomUrl3(e.target.value)}
                      placeholder="Tempel tautan URL foto..."
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customUrl3.trim()) {
                          setFotoAngle3Url(customUrl3.trim());
                          setCustomUrl3('');
                          setShowUrlAngle3(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs cursor-pointer"
                    >
                      Pasang
                    </button>
                  </div>
                )}

                {fotoAngle3Url && (
                  <div className="mt-2 relative w-32 h-24 rounded-xl overflow-hidden border border-slate-300 shadow-xs">
                    <img
                      src={fotoAngle3Url}
                      alt="Angle 3"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sticky Modal Action Footer */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3.5 flex items-center justify-between gap-3 shrink-0 shadow-lg z-20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
            >
              Batal
            </button>

            <button
              type="submit"
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-98 border border-blue-500/30"
            >
              <Save className="w-4 h-4 text-blue-200 animate-pulse" />
              <span>SIMPAN LAPORAN MONITORING</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
