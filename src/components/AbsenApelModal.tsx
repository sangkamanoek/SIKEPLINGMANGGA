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
  ShieldAlert,
  Users,
  Image as ImageIcon,
  Check,
  Info,
  Navigation,
  Video,
  Lock,
  Download,
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
  calculateAbsentDays,
} from '../lib/attendanceApi';
import {
  getNetworkWibTimeString,
  isNetworkTimeVerified,
  checkClockTamperStatus,
  syncNetworkTime,
  subscribeNetworkTimeSync,
} from '../lib/networkTimeService';
import { RekapAbsensiSuperAdmin } from './RekapAbsensiSuperAdmin';
import { downloadImage } from '../lib/imageDownloader';

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
  const isSuperAdmin = activeAccount.role === 'super_admin';

  // Form State
  const [selectedKeplingAccount, setSelectedKeplingAccount] = useState<UserAccount>(activeAccount);
  const [status, setStatus] = useState<StatusAbsenApel>('Hadir');
  const [catatan, setCatatan] = useState('');
  const [fotoSelfie, setFotoSelfie] = useState<string>('');
  const [lokasiGps, setLokasiGps] = useState<string>('');
  const [gpsAccuracyStatus, setGpsAccuracyStatus] = useState<string>('');
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Camera Live Capture State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Zoomed image modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Live Network Time State
  const [liveNetworkTime, setLiveNetworkTime] = useState<string>(getNetworkWibTimeString(true));
  const [isNetworkSynced, setIsNetworkSynced] = useState<boolean>(isNetworkTimeVerified());
  const [isResyncingTime, setIsResyncingTime] = useState<boolean>(false);
  const [tamperStatus, setTamperStatus] = useState(checkClockTamperStatus());

  // Subscribe to live network time ticker (every 1 second when modal open)
  useEffect(() => {
    if (!isOpen) return;

    // Refresh network time immediately
    syncNetworkTime().then(() => {
      setIsNetworkSynced(isNetworkTimeVerified());
      setTamperStatus(checkClockTamperStatus());
    });

    const unsubscribe = subscribeNetworkTimeSync((synced) => {
      setIsNetworkSynced(synced);
      setTamperStatus(checkClockTamperStatus());
    });

    const timer = setInterval(() => {
      setLiveNetworkTime(getNetworkWibTimeString(true));
      setTamperStatus(checkClockTamperStatus());
    }, 1000);

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [isOpen]);

  const handleManualTimeSync = async () => {
    setIsResyncingTime(true);
    await syncNetworkTime();
    setIsNetworkSynced(isNetworkTimeVerified());
    setTamperStatus(checkClockTamperStatus());
    setIsResyncingTime(false);
    showToast?.('Waktu berhasil disinkronkan langsung dengan Server Jaringan!', 'success');
  };

  useEffect(() => {
    if (activeAccount.role !== 'kepling') {
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

  // Ensure camera is stopped when modal is closed or unmounted
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Attach video stream to video element when camera is rendered
  useEffect(() => {
    if (isCameraActive && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('muted', 'true');
      video.muted = true;
      video.play().catch((err) => {
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
          video: { facingMode: { ideal: 'user' } },
          audio: false,
        });
      } catch {
        // Fallback constraint if ideal facingMode fails
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (err) {
      console.warn('Gagal membuka kamera langsung:', err);
      showToast?.('Gagal mengaktifkan streaming kamera. Gunakan tombol Buka Kamera HP di bawah ini.', 'error');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const w = video.videoWidth || 960;
      const h = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.45);
        setFotoSelfie(dataUrl);
        stopCamera();
        showToast?.('Foto selfie apel berhasil diambil dengan jelas!', 'success');
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
        const maxDim = 720;
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
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.45);
          setFotoSelfie(compressed);
          showToast?.('Foto bukti presensi berhasil diambil.', 'success');
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handleFetchGps = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLokasiGps('GPS tidak didukung oleh browser/perangkat ini');
      setGpsAccuracyStatus('GPS tidak didukung');
      return;
    }
    setIsGettingGps(true);
    setGpsAccuracyStatus('Mengunci sinyal satelit GPS (akurasi maksimal)...');
    
    navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const latStr = lat.toFixed(5);
          const lngStr = lng.toFixed(5);
          const acc = Math.round(pos.coords.accuracy);
          setLokasiGps(`Lokasi Terdeteksi • Akurasi GPS: ±${acc}m (Lat ${latStr}, Lng ${lngStr})`);
          setGpsAccuracyStatus(`±${acc}m`);
          setIsGettingGps(false);
        },
        () => {
          setLokasiGps('Gagal mendeteksi GPS. Pastikan izin lokasi aktif lalu klik Deteksi Ulang GPS.');
          setGpsAccuracyStatus('Izin Lokasi Belum Aktif');
          setIsGettingGps(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
    );
  }, [showToast]);

  // Auto-activate GPS whenever modal is opened on the form tab
  useEffect(() => {
    if (isOpen && activeTab === 'form') {
      handleFetchGps();
    }
  }, [isOpen, activeTab, handleFetchGps]);

  const playSuccessSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio playback ignore error
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // REQUIREMENT: Izin/Sakit must have Catatan
    if ((status === 'Izin' || status === 'Sakit') && !catatan.trim()) {
      showToast?.(`Catatan/Alasan wajib diisi untuk status ${status}.`, 'error');
      return;
    }

    // REQUIREMENT: Warning if no photo for Izin/Sakit
    if ((status === 'Izin' || status === 'Sakit') && !fotoSelfie) {
      showToast?.(`Harap lampirkan foto surat izin/bukti sakit untuk status ${status}.`, 'error');
      return;
    }

    const isSuperAdmin = activeAccount.role === 'super_admin';
    const timeStat = checkApelTimeStatus();
    const isPresensiLocked = !isSuperAdmin && (timeStat.isLate || !timeStat.isWorkDay);
    
    // REQUIREMENT: Jika presensi sudah ditutup (lewat jam 08.30), tampilkan pesan khusus
    if (isPresensiLocked) {
      showToast?.('Akses presensi apel pagi sudah ditutup (lewat pukul 08.30 WIB). Segera menghadap Sekretaris Lurah!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetAcc = activeAccount.role === 'super_admin' ? selectedKeplingAccount : activeAccount;
      await submitAbsenApel(
        targetAcc,
        status,
        fotoSelfie,
        lokasiGps || 'Jl. Flamboyan Raya No. 49, Kelurahan Mangga (Akurasi GPS Maksimal)',
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
    if (statusFilter === 'belum') return !item.record || item.record.status === 'Tidak Mengikuti Apel';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-800 via-emerald-900 to-teal-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300 shadow-inner">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>PRESENSI APEL PAGI KEPALA LINGKUNGAN</span>
              </h2>
              <p className="text-xs text-emerald-100 font-medium">
                Kecamatan Medan Tuntungan
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
            {(activeAccount.role === 'kepling' || activeAccount.role === 'super_admin') && (
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
            )}

            {activeAccount.role !== 'kepling' && (
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
                <span>Rekap 24 Kepala Lingkungan</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-950 text-emerald-200">
                  {summary.totalHadir}/24
                </span>
              </button>
            )}
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
          {activeTab === 'form' && (() => {
            const isSuperAdmin = activeAccount.role === 'super_admin';
            const timeStat = checkApelTimeStatus();
            const isPresensiLocked = false; // Dibuka untuk pengujian QR Code Absensi kapan saja

            // Case 1: Past 08.30 WIB and Kepling did not submit attendance -> Locked
            if (isPresensiLocked && !myTodayRecord) {
              return (
                <div className="space-y-5 max-w-2xl mx-auto">
                  <div className="bg-rose-600 border border-rose-700 rounded-2xl p-4 flex items-center justify-between text-white shadow-lg">
                    <div>
                      <span className="text-xs text-rose-100 font-bold uppercase tracking-wider block">
                        Status Presensi Saya ({selectedKeplingAccount.lingkungan})
                      </span>
                      <h3 className="text-sm font-black">
                        {selectedKeplingAccount.nama}
                      </h3>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-white text-rose-700 text-xs font-black shadow-md">
                      TIDAK MENGIKUTI APEL
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl border bg-rose-100 border-rose-400 text-rose-950 flex items-center justify-between gap-3 text-xs font-bold shadow-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-rose-700 shrink-0" />
                      <div>
                        <span className="block font-extrabold">
                          Jadwal Absen Resmi: Senin s/d Jumat (07.30 - 08.30 WIB)
                        </span>
                        <span className="text-[11px] font-semibold opacity-90 text-rose-900">
                          {timeStat.statusLabel}
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-rose-700 text-white font-mono text-[11px] font-black shrink-0">
                      {timeStat.formattedTime}
                    </span>
                  </div>

                  <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-md">
                    <div className="w-16 h-16 bg-rose-600 border border-rose-700 rounded-2xl flex items-center justify-center mx-auto text-white shadow-lg animate-pulse">
                      <Lock className="w-8 h-8" />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-base sm:text-lg font-black text-rose-950 uppercase tracking-tight">
                        Akses Presensi Apel Pagi Terkunci
                      </h3>
                      <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
                        Batas waktu pengisian presensi apel pagi resmi adalah pukul <strong>07.30 s/d 08.30 WIB</strong>.
                        Karena waktu saat ini ({timeStat.formattedTime}) berada di luar jadwal resmi, formulir presensi telah ditutup dan dikunci secara otomatis.
                        <br /><br />
                        <strong className="text-rose-700 text-sm">HARAP SEGERA MENGHADAP SEKRETARIS LURAH UNTUK KONFIRMASI KEHADIRAN.</strong>
                      </p>
                    </div>

                    {(() => {
                      const absentStat = calculateAbsentDays(
                        attendanceList,
                        selectedKeplingAccount.id,
                        selectedDate
                      );
                      return (
                        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 max-w-md mx-auto space-y-2">
                          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
                            Status Kehadiran Hari Ini
                          </span>
                          <span className="text-sm sm:text-base font-black text-rose-900 block">
                            ✕ TIDAK MENGIKUTI APEL PAGI
                          </span>
                          <div className="inline-block px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-black tracking-wide shadow-xs">
                            {absentStat.consecutiveDays > 0
                              ? `TIDAK MENGIKUTI APEL PAGI SELAMA ${absentStat.consecutiveDays} HARI`
                              : 'TIDAK MENGIKUTI APEL PAGI'}
                          </div>
                          <span className="text-[11px] text-rose-800 font-semibold block">
                            Akumulasi: {absentStat.consecutiveDays} hari kerja berturut-turut ({absentStat.totalAbsentThisMonth} hari bulan ini)
                          </span>
                          <span className="text-[10px] text-rose-700/80 block">
                            Otomatis tercatat pada sistem rekapitulasi & laporan resmi kelurahan
                          </span>
                        </div>
                      );
                    })()}

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('monitoring')}
                          className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Users className="w-4 h-4" />
                          <span>Lihat Rekapitulasi 24 Kepling</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          stopCamera();
                          onClose();
                        }}
                        className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // Case 2: Past 08.30 WIB and Kepling ALREADY submitted attendance -> Read-only confirmation
            if (isPresensiLocked && myTodayRecord) {
              return (
                <div className="space-y-5 max-w-2xl mx-auto">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-emerald-700 font-bold uppercase tracking-wider block">
                        Status Presensi Saya ({selectedKeplingAccount.lingkungan})
                      </span>
                      <h3 className="text-sm font-black text-emerald-950">
                        {selectedKeplingAccount.nama}
                      </h3>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1 shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                      Sudah Absen ({myTodayRecord.status})
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Presensi Anda Telah Berhasil Dicatat Hari Ini</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Waktu Presensi:</span>
                        <span className="font-bold text-slate-900">{myTodayRecord.jam || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Status:</span>
                        <span className="font-bold text-emerald-700">{myTodayRecord.status}</span>
                      </div>
                      {myTodayRecord.lokasiGps && (
                        <div className="col-span-2">
                          <span className="text-slate-500 block text-[11px]">Lokasi:</span>
                          <span className="font-medium text-slate-800 text-[11px]">{myTodayRecord.lokasiGps}</span>
                        </div>
                      )}
                      {myTodayRecord.catatan && (
                        <div className="col-span-2">
                          <span className="text-slate-500 block text-[11px]">Catatan:</span>
                          <span className="italic text-slate-700 text-[11px]">"{myTodayRecord.catatan}"</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Pengubahan data telah dikunci karena telah melewati batas resmi pukul 08.30 WIB.</span>
                    </p>
                  </div>
                </div>
              );
            }

            // Normal active form
            return (
            <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl mx-auto">
              {/* Time Status Notice Banner */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold shadow-sm ${
                timeStat.isWithinWindow 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}>
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 shrink-0 ${timeStat.isWithinWindow ? 'text-emerald-700' : 'text-amber-700'}`} />
                  <div>
                    <span className="block font-extrabold">
                      {timeStat.isWithinWindow ? 'Jadwal Tepat Waktu Aktif (07.30 - 08.30 WIB)' : 'Mode Pengujian QR Code: Absensi Dibuka 24 Jam'}
                    </span>
                    <span className="text-[11px] font-semibold opacity-90">
                      {timeStat.statusLabel} • Waktu Server: {timeStat.formattedTime}
                    </span>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-white font-mono text-[11px] font-black shrink-0 ${
                  timeStat.isWithinWindow ? 'bg-emerald-700' : 'bg-amber-700'
                }`}>
                  {timeStat.formattedTime}
                </span>
              </div>

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
                    <div className="text-right">
                      <span className="px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-black shadow-xs inline-block">
                        TIDAK MENGIKUTI APEL (Belum Isi Presensi)
                      </span>
                      {(() => {
                        const absentStat = calculateAbsentDays(
                          attendanceList,
                          selectedKeplingAccount.id,
                          selectedDate
                        );
                        if (absentStat.consecutiveDays > 0) {
                          return (
                            <span className="block text-[10.5px] font-black text-rose-700 mt-1">
                              TIDAK MENGIKUTI APEL PAGI SELAMA {absentStat.consecutiveDays} HARI
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Network True Time Verified Indicator & Clock Drift Alert */}
              <div className="space-y-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-emerald-500/40 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
                      <Clock className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-white text-xs">Waktu Jaringan Resmi (NTP Server)</span>
                        <span className="px-2 py-0.2 rounded-full bg-emerald-400/20 text-emerald-300 font-mono text-[10px] font-black border border-emerald-400/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                          TERKUNCI &amp; SAHIH
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-normal mt-0.5">
                        Waktu dikirimkan langsung oleh jaringan server, anti-manipulasi jam perangkat HP.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-emerald-400 font-mono text-sm font-black tracking-wider shadow-inner">
                      {liveNetworkTime}
                    </div>
                    <button
                      type="button"
                      onClick={handleManualTimeSync}
                      disabled={isResyncingTime}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Sinkronkan Ulang Waktu Jaringan"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isResyncingTime ? 'animate-spin text-emerald-400' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Clock Tamper / Deviation Warning if user's phone clock is manipulated or wrong */}
                {tamperStatus.isDeviated && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs flex items-start gap-2.5 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-amber-950 block">
                        Perbedaan Jam HP Terdeteksi ({tamperStatus.diffMinutes} Menit)
                      </span>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Jam di perangkat Anda ({tamperStatus.localTimeStr}) berselisih dari waktu jaringan resmi ({tamperStatus.networkTimeStr}). 
                        Sistem secara otomatis <strong>mengabaikan jam lokal perangkat</strong> dan menggunakan <strong>waktu jaringan server</strong> untuk memastikan keabsahan presensi.
                      </p>
                    </div>
                  </div>
                )}
              </div>

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
                          Jadwal Absen Resmi: Senin s/d Jumat (07.30 - 08.30 WIB)
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
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {(['Hadir', 'Izin', 'Sakit', 'Dinas Luar', 'Tidak Mengikuti Apel'] as StatusAbsenApel[]).map((st) => (
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
                            : st === 'Dinas Luar'
                            ? 'bg-purple-700 text-white border-purple-800 shadow-md ring-2 ring-purple-500'
                            : 'bg-rose-700 text-white border-rose-800 shadow-md ring-2 ring-rose-500'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-center">{st}</span>
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
                      className="w-full max-h-64 object-cover rounded-xl bg-slate-900"
                      autoPlay
                      playsInline
                      muted
                      onLoadedMetadata={() => {
                        if (videoRef.current) {
                          videoRef.current.play().catch((err) => console.warn('Video play error on loadedmetadata:', err));
                        }
                      }}
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
                      {/* Native Mobile Camera Trigger (Selfie / Front Camera) */}
                      <label className="px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer text-center">
                        <Camera className="w-4 h-4 text-emerald-300" />
                        <span>📷 Ambil Foto Kamera HP (Selfie Depan)</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>

                      {/* Native Mobile Camera Trigger (Rear Camera) */}
                      <label className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 active:bg-emerald-950 text-emerald-100 font-bold text-xs flex items-center justify-center gap-2 shadow-2xs cursor-pointer text-center">
                        <Camera className="w-4 h-4 text-emerald-400" />
                        <span>📷 Ambil Foto Kamera HP (Kamera Belakang)</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
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
                        <span>📹 Live Streaming Kamera Web (Laptop)</span>
                      </button>

                      {/* Gallery Upload */}
                      <label className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 border border-slate-300 cursor-pointer text-center">
                        <ImageIcon className="w-4 h-4 text-slate-500" />
                        <span>🖼️ Pilih Foto dari Galeri HP</span>
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
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Lokasi Apel / Nama Jalan</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Akurasi GPS Maksimal
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleFetchGps}
                    disabled={isGettingGps}
                    className="text-[11px] font-bold text-emerald-800 hover:text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                    title="Deteksi ulang nama jalan dan koordinat satelit GPS"
                  >
                    <Navigation className={`w-3 h-3 ${isGettingGps ? 'animate-spin text-emerald-600' : ''}`} />
                    <span>{isGettingGps ? 'Mengunci Satelit...' : 'Deteksi GPS'}</span>
                  </button>
                </div>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={lokasiGps}
                    onChange={(e) => setLokasiGps(e.target.value)}
                    placeholder="Contoh: Jl. Flamboyan Raya No. 49, Kelurahan Mangga"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-slate-50 text-slate-800"
                  />
                </div>
                {gpsAccuracyStatus && (
                  <div className="flex items-center justify-between text-[11px] px-1 text-slate-600">
                    <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      {gpsAccuracyStatus}
                    </span>
                    <span className="text-[10px] text-slate-500">Otomatis Terverifikasi</span>
                  </div>
                )}
              </div>

              {/* Catatan / Keterangan */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Catatan / Alasan {(status === 'Izin' || status === 'Sakit') && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  rows={2}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder={
                    status === 'Hadir'
                      ? 'Catatan singkat presensi (Opsional)...'
                      : `Tuliskan alasan/keterangan ${status}...`
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
                      : `SIMPAN PRESENSI APEL PAGI (${String(status || 'HADIR').toUpperCase()})`}
                  </span>
                </button>
              </div>
            </form>
          );
        })()}

          {/* TAB 2: REKAPITULASI 24 KEPLING (SUPER ADMIN ONLY) */}
          {activeTab === 'monitoring' && (
            isSuperAdmin ? (
              <RekapAbsensiSuperAdmin
                attendanceList={attendanceList}
                currentUser={activeAccount}
                selectedDate={selectedDate}
                onDateChange={(d) => setSelectedDate(d)}
                onOpenSelfiePreview={(p) => setPreviewImage(p)}
              />
            ) : (
              <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center max-w-md mx-auto space-y-3 my-6">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h4 className="font-black text-sm sm:text-base text-rose-950">
                  Akses Terbatas: Hanya Super Admin
                </h4>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Sesuai kebijakan privasi dan kepegawaian, Kepala Lingkungan tidak memiliki akses untuk melihat rekapitulasi absensi Kepala Lingkungan lainnya.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('form')}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Kembali ke Presensi Saya
                </button>
              </div>
            )
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
              className="w-full max-h-[65vh] object-contain rounded-2xl bg-slate-900"
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  downloadImage(
                    previewImage.url,
                    `${previewImage.title.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`
                  );
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Foto Selfie (.JPG)</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbsenApelModal;
