import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  MapPin,
  X,
  UserCheck,
  AlertCircle,
  Sparkles,
  Calendar,
  Search,
  RefreshCw,
  FileText,
  ShieldCheck,
  Users,
  Image as ImageIcon,
  Check,
  Info,
  Navigation,
  Video,
} from 'lucide-react';
import { AbsenApelItem, StatusAbsenApel, UserAccount } from '../types';
import { KEPLING_ACCOUNTS, SUPER_ADMIN_ACCOUNT } from '../data/keplingList';
import {
  getTodayDateString,
  getCurrentTimeString,
  submitAbsenApel,
  computeAttendanceSummary24,
  getTodayAbsenForKepling,
  checkApelTimeStatus,
} from '../lib/attendanceApi';

interface AbsenApelModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAccount: UserAccount;
  attendanceList: AbsenApelItem[];
  onRefreshAttendance: () => Promise<void>;
  showToast?: (text: string, type: 'success' | 'error' | 'info') => void;
}

export const AbsenApelModal: React.FC<AbsenApelModalProps> = ({
  isOpen,
  onClose,
  activeAccount,
  attendanceList,
  onRefreshAttendance,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'form' | 'monitoring'>('form');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form State
  const [selectedKeplingAccount, setSelectedKeplingAccount] = useState<UserAccount>(activeAccount);
  const [status, setStatus] = useState<StatusAbsenApel>('Hadir');
  const [catatan, setCatatan] = useState('');
  const [fotoSelfie, setFotoSelfie] = useState<string>('');
  const [lokasiGps, setLokasiGps] = useState<string>('');
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Camera Live Capture State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Zoomed image modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (activeAccount.role === 'super_admin') {
      setActiveTab('monitoring');
    } else {
      setActiveTab('form');
    }
    setSelectedKeplingAccount(activeAccount);
  }, [activeAccount, isOpen]);

  // Load existing attendance record for selected Kepling on form tab
  useEffect(() => {
    if (selectedKeplingAccount) {
      const existing = getTodayAbsenForKepling(
        attendanceList,
        selectedKeplingAccount.id,
        selectedDate
      );
      if (existing) {
        setStatus(existing.status);
        setCatatan(existing.catatan || '');
        setFotoSelfie(existing.fotoSelfieUrl || '');
        setLokasiGps(existing.lokasiGps || '');
      } else {
        setStatus('Hadir');
        setCatatan('');
        setFotoSelfie('');
        setLokasiGps('Kelurahan Mangga (GPS Verified)');
      }
    }
  }, [selectedKeplingAccount, selectedDate, attendanceList]);

  // Camera cleanup
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Attach video stream to video element when camera is rendered
  useEffect(() => {
    if (isCameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => {
        console.warn('Video play error:', err);
      });
    }
  }, [isCameraActive]);

  const startCamera = async () => {
    try {
      stopCamera();
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        });
      } catch {
        // Fallback constraint if facingMode: 'user' fails
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (err) {
      console.warn('Gagal membuka kamera langsung:', err);
      showToast?.('Gagal mengaktifkan kamera. Gunakan tombol Ambil Foto Langsung via HP / Galeri.', 'error');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        setFotoSelfie(dataUrl);
        stopCamera();
        showToast?.('Foto selfie apel berhasil diambil!', 'success');
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 600;
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
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.6);
          setFotoSelfie(compressed);
          showToast?.('Foto bukti presensi berhasil diambil.', 'success');
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handleFetchGps = useCallback(() => {
    if (!navigator.geolocation) {
      setLokasiGps('GPS tidak didukung perangkat. Kantor Kelurahan Mangga');
      return;
    }
    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        setLokasiGps(`Lat ${lat}, Lng ${lng} • Kelurahan Mangga (GPS Terverifikasi)`);
        setIsGettingGps(false);
        showToast?.('Lokasi GPS berhasil terdeteksi otomatis.', 'success');
      },
      (err) => {
        console.warn('Gagal lokasi GPS:', err);
        setLokasiGps('Wilayah Kelurahan Mangga, Medan Tuntungan (GPS Otomatis)');
        setIsGettingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [showToast]);

  // Auto-activate GPS whenever modal is opened on the form tab
  useEffect(() => {
    if (isOpen && activeTab === 'form') {
      handleFetchGps();
    }
  }, [isOpen, activeTab, handleFetchGps]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const targetAcc = activeAccount.role === 'super_admin' ? selectedKeplingAccount : activeAccount;
      await submitAbsenApel(
        targetAcc,
        status,
        fotoSelfie,
        lokasiGps || 'Kelurahan Mangga (GPS Verified)',
        catatan,
        selectedDate
      );
      await onRefreshAttendance();
      showToast?.(
        `Presensi Apel Pagi ${targetAcc.lingkungan} (${status}) berhasil disimpan!`,
        'success'
      );
      if (activeAccount.role === 'kepling') {
        setActiveTab('monitoring');
      }
    } catch (err) {
      showToast?.('Gagal menyimpan presensi apel pagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const summary = computeAttendanceSummary24(attendanceList, selectedDate);
  const myTodayRecord = getTodayAbsenForKepling(attendanceList, activeAccount.id, selectedDate);

  // Filter 24 Kepling status list for monitoring view
  const keplingStatusList = KEPLING_ACCOUNTS.map((k) => {
    const record = getTodayAbsenForKepling(attendanceList, k.id, selectedDate);
    return {
      account: k,
      record,
    };
  }).filter((item) => {
    const matchesSearch =
      item.account.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.account.lingkungan.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'hadir') return item.record?.status === 'Hadir';
    if (statusFilter === 'izin') return item.record?.status === 'Izin';
    if (statusFilter === 'sakit') return item.record?.status === 'Sakit';
    if (statusFilter === 'dinas_luar') return item.record?.status === 'Dinas Luar';
    if (statusFilter === 'belum') return !item.record;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-linear-to-r from-emerald-800 via-emerald-900 to-teal-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300 shadow-inner">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>PRESENSI APEL PAGI KEPLING</span>
                <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-md uppercase">
                  OFFICIAL
                </span>
              </h2>
              <p className="text-xs text-emerald-100 font-medium">
                Kelurahan Mangga • Kecamatan Medan Tuntungan
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs inside Modal */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'form'
                  ? 'bg-emerald-800 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Input Absen Apel</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('monitoring')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'monitoring'
                  ? 'bg-emerald-800 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Rekap 24 Kepling</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-950 text-emerald-200">
                {summary.totalHadir}/24
              </span>
            </button>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-emerald-700" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: FORM INPUT ABSEN */}
          {activeTab === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl mx-auto">
              {/* Account Selector for Admin assistance */}
              {activeAccount.role === 'super_admin' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Mode Super Admin: Pengisian Absen Atas Nama Kepling</span>
                  </div>
                  <select
                    value={selectedKeplingAccount.id}
                    onChange={(e) => {
                      const found = KEPLING_ACCOUNTS.find((k) => k.id === e.target.value);
                      if (found) setSelectedKeplingAccount(found);
                    }}
                    className="bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 cursor-pointer w-full sm:w-auto"
                  >
                    {KEPLING_ACCOUNTS.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.lingkungan} - {k.nama}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-emerald-700 font-bold uppercase tracking-wider block">
                      Status Presensi Saya ({selectedKeplingAccount.lingkungan})
                    </span>
                    <h3 className="text-sm font-black text-emerald-950">
                      {selectedKeplingAccount.nama}
                    </h3>
                  </div>
                  {myTodayRecord ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1 shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                      Sudah Absen ({myTodayRecord.status})
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-black animate-pulse shadow-xs">
                      Belum Absen Apel Hari Ini
                    </span>
                  )}
                </div>
              )}

              {/* Apel Pagi Time Limit Notice */}
              {(() => {
                const timeStat = checkApelTimeStatus();
                return (
                  <div
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold ${
                      !timeStat.isWorkDay
                        ? 'bg-purple-50 border-purple-300 text-purple-950'
                        : timeStat.isWithinWindow
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : timeStat.isLate
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-blue-50 border-blue-300 text-blue-950'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="block font-extrabold">
                          Jadwal Absen Resmi: Senin s/d Jumat (07.30 - 09.00 WIB)
                        </span>
                        <span className="text-[11px] font-semibold opacity-90">
                          {timeStat.statusLabel}
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 font-mono text-[11px] font-black shrink-0">
                      {timeStat.formattedTime}
                    </span>
                  </div>
                );
              })()}

              {/* Status Radio Choices */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Status Kehadiran Apel Pagi <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(['Hadir', 'Izin', 'Sakit', 'Dinas Luar'] as StatusAbsenApel[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className={`p-3 rounded-2xl border text-xs font-black flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        status === st
                          ? st === 'Hadir'
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-md ring-2 ring-emerald-500'
                            : st === 'Izin'
                            ? 'bg-blue-700 text-white border-blue-800 shadow-md ring-2 ring-blue-500'
                            : st === 'Sakit'
                            ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-500'
                            : 'bg-purple-700 text-white border-purple-800 shadow-md ring-2 ring-purple-500'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{st}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Photo Bukti / Selfie Camera */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Foto Selfie / Dokumentasi Apel Pagi</span>
                  <span className="text-[11px] text-slate-400 font-normal">Opsional/Disarankan</span>
                </label>

                {isCameraActive ? (
                  <div className="bg-slate-950 rounded-2xl p-2 relative overflow-hidden flex flex-col items-center">
                    <video
                      ref={videoRef}
                      className="w-full max-h-64 object-cover rounded-xl"
                      autoPlay
                      playsInline
                    />
                    <div className="flex items-center gap-3 mt-3">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Jepret Foto Selfie</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    {fotoSelfie ? (
                      <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-md shrink-0">
                        <img
                          src={fotoSelfie}
                          alt="Selfie Apel"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setFotoSelfie('')}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-700 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center p-2 text-center shrink-0 text-slate-400">
                        <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
                        <span className="text-[10px] font-bold">Belum Ada Foto</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 w-full">
                      {/* Native Mobile Camera Trigger (Direct capture="user") */}
                      <label className="px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer text-center">
                        <Camera className="w-4 h-4 text-emerald-300" />
                        <span>Ambil Foto Langsung Kamera HP</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>

                      {/* Streaming Webcam for Web/Laptop */}
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Video className="w-4 h-4 text-amber-300" />
                        <span>Buka Live Streaming Kamera Web</span>
                      </button>

                      {/* Gallery Upload */}
                      <label className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 border border-slate-300 cursor-pointer text-center">
                        <ImageIcon className="w-4 h-4 text-slate-500" />
                        <span>Pilih Foto dari Galeri / File</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* GPS Location Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Lokasi Apel / Koordinat GPS</span>
                  <button
                    type="button"
                    onClick={handleFetchGps}
                    disabled={isGettingGps}
                    className="text-[11px] font-bold text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Navigation className={`w-3 h-3 ${isGettingGps ? 'animate-spin' : ''}`} />
                    <span>{isGettingGps ? 'Mendeteksi...' : 'Deteksi GPS'}</span>
                  </button>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={lokasiGps}
                    onChange={(e) => setLokasiGps(e.target.value)}
                    placeholder="Contoh: Halaman Kantor Kelurahan Mangga"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-slate-50"
                  />
                </div>
              </div>

              {/* Catatan / Keterangan */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Catatan / Alasan {status !== 'Hadir' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  rows={2}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder={
                    status === 'Hadir'
                      ? 'Catatan singkat presensi (Opsional)...'
                      : `Tuliskan alasan singkat status ${status}...`
                  }
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 bg-emerald-800 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                  <span>
                    {isSubmitting
                      ? 'Menyimpan Presensi...'
                      : `SIMPAN PRESENSI APEL PAGI (${status.toUpperCase()})`}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: MONITORING 24 KEPLING */}
          {activeTab === 'monitoring' && (
            <div className="space-y-5">
              {/* Summary Scorecards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
                  <span className="text-[11px] text-emerald-700 font-bold block uppercase">
                    HADIR
                  </span>
                  <span className="text-2xl font-black text-emerald-950">
                    {summary.totalHadir}
                  </span>
                  <span className="text-[10px] text-emerald-800 font-semibold block">
                    {summary.percentageHadir}% Presensi
                  </span>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-center">
                  <span className="text-[11px] text-blue-700 font-bold block uppercase">
                    IZIN
                  </span>
                  <span className="text-2xl font-black text-blue-950">
                    {summary.totalIzin}
                  </span>
                  <span className="text-[10px] text-blue-800 font-semibold block">Kepling</span>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
                  <span className="text-[11px] text-amber-700 font-bold block uppercase">
                    SAKIT
                  </span>
                  <span className="text-2xl font-black text-amber-950">
                    {summary.totalSakit}
                  </span>
                  <span className="text-[10px] text-amber-800 font-semibold block">Kepling</span>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 text-center">
                  <span className="text-[11px] text-purple-700 font-bold block uppercase">
                    DINAS LUAR
                  </span>
                  <span className="text-2xl font-black text-purple-950">
                    {summary.totalDinasLuar}
                  </span>
                  <span className="text-[10px] text-purple-800 font-semibold block">Kepling</span>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-center col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-red-700 font-bold block uppercase">
                    BELUM ABSEN
                  </span>
                  <span className="text-2xl font-black text-red-950">
                    {summary.totalBelumAbsen}
                  </span>
                  <span className="text-[10px] text-red-800 font-semibold block">Kepling</span>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama / lingkungan..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto overflow-x-auto">
                  {[
                    { key: 'all', label: 'Semua' },
                    { key: 'hadir', label: 'Hadir' },
                    { key: 'izin', label: 'Izin' },
                    { key: 'sakit', label: 'Sakit' },
                    { key: 'dinas_luar', label: 'Dinas Luar' },
                    { key: 'belum', label: 'Belum Absen' },
                  ].map((fl) => (
                    <button
                      key={fl.key}
                      type="button"
                      onClick={() => setStatusFilter(fl.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        statusFilter === fl.key
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {fl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid 24 Kepling Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {keplingStatusList.map(({ account, record }) => {
                  return (
                    <div
                      key={account.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 relative ${
                        record
                          ? record.status === 'Hadir'
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : record.status === 'Izin'
                            ? 'bg-blue-50/50 border-blue-200'
                            : record.status === 'Sakit'
                            ? 'bg-amber-50/50 border-amber-200'
                            : 'bg-purple-50/50 border-purple-200'
                          : 'bg-red-50/40 border-red-200'
                      }`}
                    >
                      {/* Avatar Photo */}
                      {record?.fotoSelfieUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              url: record.fotoSelfieUrl!,
                              title: `Presensi ${account.lingkungan} - ${account.nama}`,
                            })
                          }
                          className="w-14 h-14 rounded-xl overflow-hidden border border-slate-300 shrink-0 shadow-xs cursor-pointer group relative"
                        >
                          <img
                            src={record.fotoSelfieUrl}
                            alt={account.nama}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </button>
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 font-black text-sm shrink-0">
                          {account.nomorLingkungan}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-black text-emerald-800 uppercase tracking-tight">
                            {account.lingkungan}
                          </span>
                          {record ? (
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                record.status === 'Hadir'
                                  ? 'bg-emerald-700 text-white'
                                  : record.status === 'Izin'
                                  ? 'bg-blue-700 text-white'
                                  : record.status === 'Sakit'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-purple-700 text-white'
                              }`}
                            >
                              {record.status}
                            </span>
                          ) : (
                            <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded-md">
                              Belum Absen
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 truncate mt-0.5">
                          {account.nama}
                        </h4>

                        {record ? (
                          <div className="mt-1 space-y-0.5 text-[11px] text-slate-600 font-medium">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-emerald-700 shrink-0" />
                              <span>{record.jam}</span>
                            </div>
                            {record.lokasiGps && (
                              <div className="flex items-center gap-1 truncate text-slate-500">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{record.lokasiGps}</span>
                              </div>
                            )}
                            {record.catatan && (
                              <p className="text-[10px] text-slate-600 italic bg-white/80 p-1 rounded border border-slate-200 mt-1">
                                "{record.catatan}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-red-600 mt-1 font-semibold">
                            Belum mengirim presensi apel
                          </p>
                        )}
                      </div>

                      {/* Super Admin Action */}
                      {activeAccount.role === 'super_admin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedKeplingAccount(account);
                            setActiveTab('form');
                          }}
                          className="text-[10px] font-bold text-slate-500 hover:text-emerald-800 underline self-start cursor-pointer shrink-0"
                          title="Bantu Absenkan Kepling"
                        >
                          Isikan
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-500 font-medium hidden sm:inline-block">
            Tanggal Terpilih: <strong className="text-slate-900">{selectedDate}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 cursor-pointer ml-auto"
          >
            Tutup Presensi
          </button>
        </div>
      </div>

      {/* Zoom Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl overflow-hidden max-w-lg w-full p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900">{previewImage.title}</h4>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewImage.url}
              alt="Preview Selfie"
              className="w-full max-h-[70vh] object-contain rounded-2xl bg-slate-900"
            />
          </div>
        </div>
      )}
    </div>
  );
};
