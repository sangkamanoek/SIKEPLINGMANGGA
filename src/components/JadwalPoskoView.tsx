import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ShieldAlert,
  CloudRain,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  RefreshCw,
  X,
  FileText,
  Printer,
  Download,
  Camera,
  Check,
  ChevronDown,
  Sparkles,
  Info,
  UserCheck,
  Lock,
  Phone,
  Shield,
  Waves,
  Eye,
} from 'lucide-react';
import {
  UserAccount,
  JadwalPoskoItem,
  JenisPosko,
  StatusPosko,
  KeplingPetugasPosko,
} from '../types';
import { KEPLING_DATA_RESMI } from '../data/keplingList';
import {
  getLocalJadwalPoskoList,
  fetchJadwalPoskoFromFirestore,
  subscribeJadwalPoskoFromFirestore,
  saveJadwalPoskoItem,
  deleteJadwalPoskoItem,
  updateKeplingPoskoKehadiran,
  selesaikanPosko,
} from '../lib/jadwalPoskoService';
import { fileToCompressedBase64 } from '../utils/imageCompressor';
import { KopSuratResmi } from './KopSuratResmi';
import { printOfficialDocument, downloadPdfDocument } from '../utils/printHelper';
import { formatHariTanggalIndonesia, formatTanggalSingkatIndonesia } from '../lib/absensiAgendaService';

interface JadwalPoskoViewProps {
  currentUser: UserAccount;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const formatDeviceClock = (d: Date = new Date()): string => {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} WIB`;
};

const formatDeviceClockWithSeconds = (d: Date = new Date()): string => {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} WIB`;
};

const formatDeviceDateShort = (d: Date = new Date()): string => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mo}/${yyyy}`;
};

export const JadwalPoskoView: React.FC<JadwalPoskoViewProps> = ({
  currentUser,
  onShowToast,
}) => {
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isKasiTrantib =
    currentUser?.role === 'kasi_trantibum' ||
    currentUser?.id === 'kasi_trantibum' ||
    currentUser?.jabatan?.toLowerCase().includes('trantib');
  const canManagePosko = isSuperAdmin || isKasiTrantib;
  const isKepling = currentUser?.role === 'kepling';

  const [poskoList, setPoskoList] = useState<JadwalPoskoItem[]>(() => getLocalJadwalPoskoList());
  const [filterJenis, setFilterJenis] = useState<'ALL' | JenisPosko>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | StatusPosko>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Modal Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<JadwalPoskoItem | null>(null);
  const [formJenis, setFormJenis] = useState<JenisPosko>('posko_trantibum');
  const [formNama, setFormNama] = useState('');
  const [formTanggal, setFormTanggal] = useState('');
  const [formWaktu, setFormWaktu] = useState('Pukul 21.00 WIB s/d Selesai');
  const [formLokasi, setFormLokasi] = useState('');
  const [formArahan, setFormArahan] = useState('');
  const [formPenanggungJawab, setFormPenanggungJawab] = useState('');
  const [formStatus, setFormStatus] = useState<StatusPosko>('TERJADWAL');
  const [selectedKeplingIds, setSelectedKeplingIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Modal Upload Kehadiran Kepling (Jam Otomatis HP + Kamera Langsung Anti-Manipulasi)
  const [isUploadKehadiranOpen, setIsUploadKehadiranOpen] = useState(false);
  const [poskoForUpload, setPoskoForUpload] = useState<JadwalPoskoItem | null>(null);
  const [uploadStatusKehadiran, setUploadStatusKehadiran] = useState<'Hadir' | 'Izin' | 'Sakit'>('Hadir');
  const [fotoCapturedAt, setFotoCapturedAt] = useState<string | null>(null);
  const [deviceNow, setDeviceNow] = useState<Date>(() => new Date());
  const [uploadFotoBase64, setUploadFotoBase64] = useState<string | undefined>(undefined);
  const [uploadCatatanSituasi, setUploadCatatanSituasi] = useState('');
  const [isCompressingFoto, setIsCompressingFoto] = useState(false);
  const [isSubmittingKehadiran, setIsSubmittingKehadiran] = useState(false);

  // Live Camera Refs & States
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Modal Cetak & Unduh PDF
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [poskoForPdf, setPoskoForPdf] = useState<JadwalPoskoItem | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Modal Selesaikan Posko
  const [isSelesaikanModalOpen, setIsSelesaikanModalOpen] = useState(false);
  const [poskoToComplete, setPoskoToComplete] = useState<JadwalPoskoItem | null>(null);
  const [catatanSelesaikan, setCatatanSelesaikan] = useState('');

  // Modal Preview Image Zoom
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);

  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onShowToast) onShowToast(msg, type);
  };

  // Subscribe to real-time updates
  useEffect(() => {
    fetchJadwalPoskoFromFirestore().then(setPoskoList).catch(() => {});
    const unsub = subscribeJadwalPoskoFromFirestore(setPoskoList);

    const handleLocalUpdate = () => {
      setPoskoList(getLocalJadwalPoskoList());
    };
    window.addEventListener('jadwal-posko-updated', handleLocalUpdate);

    return () => {
      if (typeof unsub === 'function') unsub();
      window.removeEventListener('jadwal-posko-updated', handleLocalUpdate);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const items = await fetchJadwalPoskoFromFirestore();
      setPoskoList(items);
      notify('Data Jadwal Posko berhasil disinkronkan dengan Firestore!', 'success');
    } catch {
      notify('Gagal menyinkronkan data posko.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Deteksi penugasan aktif untuk Kepling yang sedang login
  const myAssignedPoskoToday = useMemo(() => {
    if (!isKepling) return null;
    const today = new Date().toISOString().split('T')[0];
    const noLing = currentUser.nomorLingkungan;
    const uid = currentUser.id;

    return (
      poskoList.find((p) => {
        if (p.status === 'SELESAI') return false;
        const isAssigned = p.petugasKepling?.some(
          (k) =>
            (k.keplingId === uid || k.nomorLingkungan === noLing) &&
            k.statusKehadiran === 'Belum Hadir'
        );
        return isAssigned && p.tanggal === today;
      }) || null
    );
  }, [poskoList, isKepling, currentUser]);

  // Open Add Modal
  const handleOpenAddModal = (presetJenis: JenisPosko = 'posko_trantibum') => {
    if (!canManagePosko) {
      notify('Akses Dibatasi: Jadwal Posko hanya dibuat oleh Akun Kasi Trantib dan Akun Lurah.', 'error');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    setEditingItem(null);
    setFormJenis(presetJenis);
    setFormNama(
      presetJenis === 'posko_trantibum'
        ? 'Posko Trantibum (Ketenteraman & Ketertiban Umum)'
        : presetJenis === 'posko_banjir'
        ? 'Posko Kewaspadaan Banjir'
        : 'Posko Bersih Sampah Malam Hari'
    );
    setFormTanggal(today);
    setFormWaktu(presetJenis === 'posko_bersih_sampah' ? 'Pukul 20.00 WIB s/d Selesai' : 'Pukul 21.00 WIB s/d Selesai');
    setFormLokasi(
      presetJenis === 'posko_trantibum'
        ? 'Kantor Lurah'
        : presetJenis === 'posko_banjir'
        ? 'Taman Segitiga Lk. 9'
        : 'Jalan Jamin Ginting'
    );
    setFormArahan(
      presetJenis === 'posko_trantibum'
        ? 'Lakukan apel malam pukul 21.00 WIB di Kantor Lurah, patroli wilayah siskamling, tertibkan potensi kerumunan remaja/balap liar, dan koordinasi dengan Babinsa/Bhabinkamtibmas.'
        : presetJenis === 'posko_banjir'
        ? 'Siaga di Taman Segitiga Lk. 9, pantau debit air saluran primer dan sekunder, cek potensi sumbatan sampah pada gorong-gorong drainase, laporkan ketinggian debit air berkala.'
        : 'Lakukan pemantauan kebersihan lingkungan dan penertiban sampah liar di sepanjang Jalan Jamin Ginting mulai pukul 20.00 WIB s/d selesai.'
    );
    setFormPenanggungJawab(
      isKasiTrantib
        ? 'KASI KETENTRAMAN & KETERTIBAN UMUM'
        : 'Feriyanto Arapenta Tarigan, A.Md (Lurah Mangga)'
    );
    setFormStatus('TERJADWAL');
    setSelectedKeplingIds([]);

    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: JadwalPoskoItem) => {
    if (!canManagePosko) {
      notify('Akses Dibatasi: Jadwal Posko hanya dapat diubah oleh Akun Kasi Trantib dan Akun Lurah.', 'error');
      return;
    }
    setEditingItem(item);
    setFormJenis(item.jenisPosko);
    setFormNama(item.namaPosko);
    setFormTanggal(item.tanggal);
    setFormWaktu(item.waktuMulai || 'Pukul 21.00 WIB s/d Selesai');
    setFormLokasi(item.lokasiPosko);
    setFormArahan(item.arahanTugas || '');
    setFormPenanggungJawab(item.penanggungJawab);
    setFormStatus(item.status);
    setSelectedKeplingIds(item.petugasKepling?.map((k) => k.keplingId) || []);
    setIsModalOpen(true);
  };

  const handleToggleKeplingId = (id: string) => {
    setSelectedKeplingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Submit Form Jadwal
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManagePosko) {
      notify('Akses Dibatasi: Hanya Kasi Trantib dan Lurah yang berwenang menyimpan jadwal posko.', 'error');
      return;
    }

    if (!formNama.trim() || !formTanggal || !formLokasi.trim()) {
      notify('Mohon lengkapi Nama Posko, Tanggal, dan Lokasi Posko.', 'error');
      return;
    }

    if (selectedKeplingIds.length === 0) {
      notify('Pilih minimal 1 Kepala Lingkungan yang ditugaskan bertugas.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      // Petugas Kepling list
      const petugasKepling: KeplingPetugasPosko[] = selectedKeplingIds.map((id) => {
        const no = parseInt(id.replace('kepling_', ''), 10);
        const dataMaster = KEPLING_DATA_RESMI.find((k) => k.nomor === no);

        // Pertahankan status yang sudah ada jika mengedit
        const existingPetugas = editingItem?.petugasKepling?.find((k) => k.keplingId === id);

        return {
          keplingId: id,
          nomorLingkungan: no,
          namaKepling: dataMaster?.namaKepling || `Kepling Lingkungan ${no}`,
          telepon: dataMaster?.telepon || '',
          statusKehadiran: existingPetugas?.statusKehadiran || 'Belum Hadir',
          jamHadir: existingPetugas?.jamHadir,
          fotoKehadiranUrl: existingPetugas?.fotoKehadiranUrl,
          waktuUploadFoto: existingPetugas?.waktuUploadFoto,
          catatanSituasi: existingPetugas?.catatanSituasi,
        };
      });

      const now = new Date().toISOString();
      const poskoItem: JadwalPoskoItem = {
        id: editingItem?.id || `posko_${formJenis}_${formTanggal}_${Date.now()}`,
        jenisPosko: formJenis,
        namaPosko: formNama.trim(),
        tanggal: formTanggal,
        waktuMulai: formWaktu.trim() || 'Pukul 21.00 WIB s/d Selesai',
        lokasiPosko: formLokasi.trim(),
        arahanTugas: formArahan.trim(),
        penanggungJawab: formPenanggungJawab.trim() || currentUser.nama,
        status: formStatus,
        petugasKepling,
        createdById: editingItem?.createdById || currentUser.id,
        createdByName: editingItem?.createdByName || currentUser.nama,
        createdByRole: editingItem?.createdByRole || currentUser.role,
        createdAt: editingItem?.createdAt || now,
        updatedAt: now,
      };

      await saveJadwalPoskoItem(poskoItem);
      setPoskoList(getLocalJadwalPoskoList());
      setIsModalOpen(false);
      notify(
        `Jadwal ${poskoItem.namaPosko} untuk ${petugasKepling.length} Kepling berhasil disimpan!`,
        'success'
      );
    } catch {
      notify('Gagal menyimpan jadwal posko.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Posko Item
  const handleDeletePosko = async (posko: JadwalPoskoItem) => {
    if (!canManagePosko) {
      notify('Akses Dibatasi: Hapus jadwal posko hanya khusus untuk Kasi Trantib dan Lurah.', 'error');
      return;
    }
    if (!window.confirm(`Yakin ingin menghapus jadwal "${posko.namaPosko}" pada ${posko.tanggal}?`)) {
      return;
    }
    try {
      await deleteJadwalPoskoItem(posko.id);
      setPoskoList(getLocalJadwalPoskoList());
      notify('Jadwal posko berhasil dihapus.', 'info');
    } catch {
      notify('Gagal menghapus jadwal posko.', 'error');
    }
  };

  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {
        // ignore
      }
    }
    setIsCameraActive(false);
    setIsStartingCamera(false);
  }, []);

  // Sinkronisasi jam HP real-time setiap detik saat modal kehadiran terbuka
  useEffect(() => {
    if (!isUploadKehadiranOpen) {
      stopCameraStream();
      return;
    }
    setDeviceNow(new Date());
    const timer = setInterval(() => {
      setDeviceNow(new Date());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [isUploadKehadiranOpen, stopCameraStream]);

  // Pastikan stream kamera berhenti saat komponen unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Pasang MediaStream ke elemen video saat siap
  useEffect(() => {
    if (isCameraActive && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);

  const startLiveCamera = useCallback(
    async (facing: 'environment' | 'user' = cameraFacingMode) => {
      stopCameraStream();
      setCameraError(null);

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError(
          'Browser/perangkat ini memblokir kamera langsung dalam aplikasi. Gunakan tombol Kamera Perangkat di bawah.'
        );
        return;
      }

      setIsStartingCamera(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        mediaStreamRef.current = stream;
        setCameraFacingMode(facing);
        setIsCameraActive(true);
      } catch (err: any) {
        const msg =
          err?.name === 'NotAllowedError'
            ? 'Izin kamera ditolak oleh browser/HP. Izinkan akses kamera atau gunakan tombol Kamera Perangkat di bawah.'
            : 'Kamera langsung tidak tersedia pada perangkat/jendela ini. Gunakan tombol Kamera Perangkat di bawah.';
        setCameraError(msg);
      } finally {
        setIsStartingCamera(false);
      }
    },
    [cameraFacingMode, stopCameraStream]
  );

  const stampCameraWatermark = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    captureDate: Date
  ) => {
    const barHeight = Math.max(44, Math.round(height * 0.11));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fillRect(0, height - barHeight, width, barHeight);

    const fontMain = Math.max(12, Math.round(barHeight * 0.34));
    const fontSub = Math.max(10, Math.round(barHeight * 0.27));
    const padX = Math.max(12, Math.round(width * 0.025));

    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold ${fontMain}px sans-serif`;
    ctx.fillText(
      `KAMERA LANGSUNG • ${formatDeviceDateShort(captureDate)} • ${formatDeviceClockWithSeconds(captureDate)}`,
      padX,
      height - barHeight + Math.round(barHeight * 0.44)
    );

    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 ${fontSub}px sans-serif`;
    const lkLabel = currentUser.nomorLingkungan ? `Lk. ${currentUser.nomorLingkungan}` : 'Kepling';
    const lokasiLabel = poskoForUpload?.lokasiPosko || 'Posko';
    ctx.fillText(
      `${lkLabel} - ${currentUser.nama} • ${lokasiLabel}`,
      padX,
      height - barHeight + Math.round(barHeight * 0.82)
    );
  };

  const handleCaptureFromLiveCamera = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      notify('Kamera belum siap, tunggu sebentar lalu coba lagi.', 'error');
      return;
    }

    const captureDate = new Date();
    const maxDim = 640;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > height && width > maxDim) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else if (height >= width && height > maxDim) {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      notify('Gagal menangkap gambar dari kamera.', 'error');
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);
    stampCameraWatermark(ctx, width, height, captureDate);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.68);
    const capturedTime = formatDeviceClock(captureDate);

    setUploadFotoBase64(dataUrl);
    setFotoCapturedAt(capturedTime);
    stopCameraStream();
    notify(`Foto kamera langsung berhasil diambil pada ${capturedTime}!`, 'success');
  };

  // Open Kepling Presence Upload Modal
  const handleOpenUploadKehadiran = (posko: JadwalPoskoItem) => {
    const noLing = currentUser.nomorLingkungan;
    const uid = currentUser.id;
    const myData = posko.petugasKepling?.find(
      (k) => k.keplingId === uid || k.nomorLingkungan === noLing
    );

    const now = new Date();

    setPoskoForUpload(posko);
    setUploadStatusKehadiran(
      myData?.statusKehadiran === 'Izin'
        ? 'Izin'
        : myData?.statusKehadiran === 'Sakit'
        ? 'Sakit'
        : 'Hadir'
    );
    setDeviceNow(now);
    setFotoCapturedAt(null);
    setUploadFotoBase64(myData?.fotoKehadiranUrl);
    setUploadCatatanSituasi(myData?.catatanSituasi || '');
    setCameraError(null);
    setIsUploadKehadiranOpen(true);

    // Jika belum ada foto, langsung buka kamera perangkat
    if (!myData?.fotoKehadiranUrl) {
      setTimeout(() => {
        startLiveCamera('environment');
      }, 180);
    }
  };

  // Fallback Camera-Only File Input (Strict Anti-Gallery Check)
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    // Anti-manipulasi: tolak foto lama dari galeri/arsip (> 2 menit yang lalu)
    const nowMs = Date.now();
    if (file.lastModified && nowMs - file.lastModified > 120_000) {
      notify(
        'Foto ditolak! File terdeteksi berasal dari galeri/foto lama. Foto Kehadiran wajib diambil langsung dari Kamera saat ini.',
        'error'
      );
      return;
    }

    setIsCompressingFoto(true);
    try {
      const compressed = await fileToCompressedBase64(file, 640, 640, 0.68);
      const captureDate = new Date();
      // Tempel stempel waktu HP pada gambar hasil kamera
      const stamped = await new Promise<string>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(compressed);
          ctx.drawImage(img, 0, 0);
          stampCameraWatermark(ctx, img.width, img.height, captureDate);
          resolve(canvas.toDataURL('image/jpeg', 0.68));
        };
        img.onerror = () => resolve(compressed);
        img.src = compressed;
      });

      const capturedTime = formatDeviceClock(captureDate);
      setUploadFotoBase64(stamped);
      setFotoCapturedAt(capturedTime);
      stopCameraStream();
      notify(`Foto kamera berhasil diambil pada ${capturedTime}!`, 'success');
    } catch {
      notify('Gagal memproses foto dari kamera.', 'error');
    } finally {
      setIsCompressingFoto(false);
    }
  };

  // Submit Kepling Presence
  const handleSubmitKehadiran = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poskoForUpload) return;

    if (uploadStatusKehadiran === 'Hadir' && !uploadFotoBase64) {
      notify('Kepling yang bertugas wajib mengambil Foto Kehadiran langsung dari Kamera.', 'error');
      return;
    }

    setIsSubmittingKehadiran(true);
    try {
      const keplingId = currentUser.id.startsWith('kepling_')
        ? currentUser.id
        : `kepling_${currentUser.nomorLingkungan}`;

      // Jam Kehadiran selalu otomatis mengikuti jam HP Kepling (tidak dapat dimanipulasi manual)
      const finalJamHadir =
        uploadStatusKehadiran === 'Hadir' && fotoCapturedAt
          ? fotoCapturedAt
          : formatDeviceClock(new Date());

      await updateKeplingPoskoKehadiran(poskoForUpload.id, keplingId, {
        statusKehadiran: uploadStatusKehadiran,
        jamHadir: finalJamHadir,
        fotoKehadiranUrl: uploadFotoBase64,
        catatanSituasi: uploadCatatanSituasi.trim(),
      });

      stopCameraStream();
      setPoskoList(getLocalJadwalPoskoList());
      setIsUploadKehadiranOpen(false);
      notify(
        uploadStatusKehadiran === 'Hadir'
          ? `Kehadiran posko (${finalJamHadir}) terkirim & otomatis tercatat ke Laporan Harian Kepling!`
          : `Status ${uploadStatusKehadiran} posko berhasil dikirim (${finalJamHadir}).`,
        'success'
      );
    } catch {
      notify('Gagal memperbarui kehadiran posko.', 'error');
    } finally {
      setIsSubmittingKehadiran(false);
    }
  };

  // Selesaikan Posko Handler
  const handleConfirmSelesaikanPosko = async () => {
    if (!poskoToComplete || !canManagePosko) return;
    try {
      await selesaikanPosko(poskoToComplete.id, {
        nama: currentUser.nama,
        role: currentUser.role,
        catatan: catatanSelesaikan.trim(),
      });
      setPoskoList(getLocalJadwalPoskoList());
      setIsSelesaikanModalOpen(false);
      setPoskoToComplete(null);
      notify(`Posko "${poskoToComplete.namaPosko}" dinyatakan SELESAI. Dokumen PDF siap dicetak!`, 'success');
    } catch {
      notify('Gagal menyelesaikan posko.', 'error');
    }
  };

  // Cetak & Unduh PDF
  const handleOpenPdfModal = (posko: JadwalPoskoItem) => {
    setPoskoForPdf(posko);
    setIsPdfModalOpen(true);
  };

  const handlePrintPdf = () => {
    if (!poskoForPdf) return;
    const title = `Daftar_Hadir_${poskoForPdf.jenisPosko}_${poskoForPdf.tanggal}`;
    printOfficialDocument('lembar-cetak-daftar-hadir-posko', title);
  };

  const handleDownloadPdf = async () => {
    if (!poskoForPdf) return;
    const title = `Daftar_Hadir_${poskoForPdf.jenisPosko}_${poskoForPdf.tanggal}.pdf`;
    setIsDownloadingPdf(true);
    try {
      await downloadPdfDocument('lembar-cetak-daftar-hadir-posko', title);
      notify('File PDF Daftar Hadir Posko berhasil diunduh!', 'success');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Untuk akun Kepling: hanya tampilkan jadwal posko yang menugaskan akun bersangkutan saja
  const isKeplingAssignedToPosko = useCallback(
    (posko: JadwalPoskoItem): boolean => {
      if (!isKepling) return true;
      const uid = currentUser.id;
      const noLing = currentUser.nomorLingkungan;
      return Boolean(
        posko.petugasKepling?.some(
          (k) =>
            (uid && k.keplingId === uid) ||
            (noLing && Number(k.nomorLingkungan) === Number(noLing))
        )
      );
    },
    [isKepling, currentUser.id, currentUser.nomorLingkungan]
  );

  const visiblePoskoList = useMemo(() => {
    if (!isKepling) return poskoList;
    return poskoList.filter(isKeplingAssignedToPosko);
  }, [poskoList, isKepling, isKeplingAssignedToPosko]);

  // Filtered Posko List
  const filteredList = useMemo(() => {
    return visiblePoskoList.filter((item) => {
      // Filter Jenis
      if (filterJenis !== 'ALL' && item.jenisPosko !== filterJenis) return false;

      // Filter Status
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;

      // Filter Date
      if (filterDate && item.tanggal !== filterDate) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.namaPosko.toLowerCase().includes(q);
        const matchLokasi = item.lokasiPosko.toLowerCase().includes(q);
        const matchPetugas = item.petugasKepling?.some(
          (k) =>
            k.namaKepling.toLowerCase().includes(q) ||
            String(k.nomorLingkungan).includes(q)
        );
        if (!matchTitle && !matchLokasi && !matchPetugas) return false;
      }

      return true;
    });
  }, [visiblePoskoList, filterJenis, filterStatus, filterDate, searchQuery]);

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in max-w-7xl mx-auto min-w-0">
      {/* Executive Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-7 border border-slate-800 shadow-xl relative overflow-hidden">
        {/* Glow ambient background elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5">
          <div className="space-y-2.5 max-w-3xl min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                Posko Trantibum · 21.00
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                <Waves className="w-3.5 h-3.5 shrink-0" />
                Posko Banjir · 21.00
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                Posko Sampah · 20.00
              </span>
            </div>

            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white leading-snug">
              Jadwal Posko Kelurahan Mangga
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Jadwal penugasan piket malam Kepala Lingkungan untuk{' '}
              <strong>Posko Trantibum (Kantor Lurah, 21.00 WIB)</strong>,{' '}
              <strong>Posko Kewaspadaan Banjir (Taman Segitiga Lk. 9, 21.00 WIB)</strong>, dan{' '}
              <strong>Posko Bersih Sampah Malam Hari (Jalan Jamin Ginting, 20.00 WIB)</strong>.
              Dibuat resmi oleh <strong>Kasi Trantib</strong> &amp; <strong>Lurah</strong>, dilengkapi foto kamera langsung dan cetak PDF Daftar Hadir.
            </p>
          </div>

          <div className="w-full lg:w-auto shrink-0">
            {canManagePosko ? (
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => handleOpenAddModal('posko_trantibum')}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Posko Trantibum</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAddModal('posko_banjir')}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs transition-all shadow-md cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Posko Banjir</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAddModal('posko_bersih_sampah')}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-md cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Posko Sampah</span>
                </button>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  title="Sinkronkan dengan Firestore"
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                  <span className="sm:hidden lg:inline">{isSyncing ? 'Sinkron...' : 'Sinkronkan'}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-semibold flex-1 sm:flex-initial">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Pembuat Jadwal: Kasi Trantib &amp; Lurah</span>
                </div>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  title="Sinkronkan dengan Firestore"
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                  <span className="sm:hidden">Sinkron</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NOTIFIKASI KHUSUS KEPLING YANG DITUNJUK HARI INI */}
      {isKepling && myAssignedPoskoToday && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white rounded-2xl p-4 sm:p-5 shadow-lg border-2 border-amber-300 animate-pulse-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white text-amber-800 flex items-center justify-center shrink-0 shadow-md">
              <ShieldAlert className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 bg-black/20 text-white text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 rounded-full mb-1">
                <Sparkles className="w-3 h-3 text-amber-200 shrink-0" />
                <span>PEMBERITAHUAN TUGAS PIKET MALAM INI</span>
              </div>
              <h3 className="text-sm sm:text-lg font-black tracking-tight leading-snug">
                Halo {currentUser.nama}! Anda Ditugaskan pada {myAssignedPoskoToday.namaPosko}
              </h3>
              <p className="text-xs text-amber-100 mt-0.5 max-w-2xl">
                Jadwal: <strong>{myAssignedPoskoToday.waktuMulai}</strong> • Lokasi:{' '}
                <strong>{myAssignedPoskoToday.lokasiPosko}</strong>. Wajib hadir dan mengunggah Foto Kehadiran di lokasi posko.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleOpenUploadKehadiran(myAssignedPoskoToday)}
            className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-amber-50 font-black text-xs shrink-0 shadow-md cursor-pointer transition-all active:scale-95 inline-flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Unggah Foto Kehadiran Sekarang</span>
          </button>
        </div>
      )}

      {/* FILTER CONTROLS & SEARCH */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Filter Jenis Posko (Grid 2x2 rapi di HP, inline sejajar di desktop) */}
          <div className="grid grid-cols-2 sm:inline-flex sm:flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl border border-slate-200 w-full xl:w-auto">
            <button
              type="button"
              onClick={() => setFilterJenis('ALL')}
              className={`inline-flex items-center justify-center px-2.5 sm:px-3 py-2 rounded-lg text-xs font-black transition-all cursor-pointer text-center ${
                filterJenis === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span>{isKepling ? `Jadwal Saya (${visiblePoskoList.length})` : `Semua (${visiblePoskoList.length})`}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterJenis('posko_trantibum')}
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                filterJenis === 'posko_trantibum'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Posko Trantibum</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterJenis('posko_banjir')}
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                filterJenis === 'posko_banjir'
                  ? 'bg-cyan-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Waves className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Posko Banjir</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterJenis('posko_bersih_sampah')}
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                filterJenis === 'posko_bersih_sampah'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Posko Sampah</span>
            </button>
          </div>

          {/* Search & Status Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 xl:flex items-stretch sm:items-center gap-2 w-full xl:w-auto">
            <div className="relative sm:col-span-3 xl:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari lokasi / nama kepling..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="TERJADWAL">Terjadwal</option>
              <option value="BERLANGSUNG">Sedang Berlangsung</option>
              <option value="SELESAI">Selesai</option>
            </select>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full sm:w-auto px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              {filterDate && (
                <button
                  type="button"
                  onClick={() => setFilterDate('')}
                  className="text-xs text-rose-600 font-bold hover:underline shrink-0 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* LIST KARTU POSKO */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-black text-slate-800">
            {isKepling && visiblePoskoList.length === 0
              ? 'Belum ada jadwal posko untuk akun Anda.'
              : 'Tidak ada jadwal posko yang sesuai filter.'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {canManagePosko
              ? 'Gunakan tombol di atas untuk membuat jadwal Posko Trantibum atau Posko Kewaspadaan Banjir baru.'
              : isKepling
              ? `Halaman ini hanya menampilkan jadwal posko yang ditugaskan khusus untuk akun Anda (${currentUser.nama}${
                  currentUser.nomorLingkungan ? ` • Lingkungan ${currentUser.nomorLingkungan}` : ''
                }).`
              : 'Belum ada jadwal posko yang dibuat oleh Kasi Trantib atau Lurah.'}
          </p>
          {canManagePosko && (
            <button
              type="button"
              onClick={() => handleOpenAddModal('posko_trantibum')}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Jadwal Posko</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredList.map((posko) => {
            const isTrantib = posko.jenisPosko === 'posko_trantibum';
            const isSampah = posko.jenisPosko === 'posko_bersih_sampah';
            const totalPetugas = posko.petugasKepling?.length || 0;
            const totalHadir =
              posko.petugasKepling?.filter((k) => k.statusKehadiran === 'Hadir').length || 0;

            const isCurrentUserAssigned = isKepling && posko.petugasKepling?.some(
              (k) =>
                k.keplingId === currentUser.id ||
                k.nomorLingkungan === currentUser.nomorLingkungan
            );

            const myKehadiran = isCurrentUserAssigned
              ? posko.petugasKepling.find(
                  (k) =>
                    k.keplingId === currentUser.id ||
                    k.nomorLingkungan === currentUser.nomorLingkungan
                )
              : null;

            return (
              <div
                key={posko.id}
                className={`bg-white rounded-2xl border transition-all shadow-xs hover:shadow-md overflow-hidden ${
                  isTrantib
                    ? 'border-amber-200/80 hover:border-amber-300'
                    : isSampah
                    ? 'border-emerald-200/80 hover:border-emerald-300'
                    : 'border-cyan-200/80 hover:border-cyan-300'
                }`}
              >
                {/* Header Kartu Posko */}
                <div
                  className={`p-4 sm:p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    isTrantib
                      ? 'bg-amber-50/70 border-amber-100'
                      : isSampah
                      ? 'bg-emerald-50/70 border-emerald-100'
                      : 'bg-cyan-50/70 border-cyan-100'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                        isTrantib
                          ? 'bg-amber-600 text-white'
                          : isSampah
                          ? 'bg-emerald-700 text-white'
                          : 'bg-cyan-700 text-white'
                      }`}
                    >
                      {isTrantib ? (
                        <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
                      ) : isSampah ? (
                        <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                      ) : (
                        <Waves className="w-5 h-5 sm:w-6 sm:h-6" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isTrantib
                              ? 'bg-amber-200 text-amber-900'
                              : isSampah
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-cyan-200 text-cyan-900'
                          }`}
                        >
                          {isTrantib
                            ? 'Posko Trantibum'
                            : isSampah
                            ? 'Posko Bersih Sampah'
                            : 'Posko Kewaspadaan Banjir'}
                        </span>

                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            posko.status === 'SELESAI'
                              ? 'bg-emerald-100 text-emerald-800'
                              : posko.status === 'BERLANGSUNG'
                              ? 'bg-blue-100 text-blue-800 animate-pulse'
                              : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {posko.status === 'SELESAI'
                            ? '✓ Selesai & Terverifikasi'
                            : posko.status === 'BERLANGSUNG'
                            ? '● Sedang Berlangsung'
                            : '⏱ Terjadwal'}
                        </span>

                        {isCurrentUserAssigned && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                            👉 Anda Ditugaskan
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-lg font-black text-slate-900 leading-snug">
                        {posko.namaPosko}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{formatHariTanggalIndonesia(posko.tanggal)}</span>
                          <span className="text-slate-400">·</span>
                          <span className="font-black text-slate-800">{posko.waktuMulai}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>{posko.lokasiPosko}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Top Right */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:justify-end shrink-0 pt-2 md:pt-0 border-t border-slate-200/50 md:border-t-0">
                    {/* Tombol Cetak PDF Daftar Hadir */}
                    <button
                      type="button"
                      onClick={() => handleOpenPdfModal(posko)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-black shadow-xs cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 shrink-0" />
                      <span>Cetak PDF Daftar Hadir</span>
                    </button>

                    {/* Jika currentUser adalah Kepling yang bertugas */}
                    {isCurrentUserAssigned && (
                      <button
                        type="button"
                        onClick={() => handleOpenUploadKehadiran(posko)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-xs cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {myKehadiran?.statusKehadiran === 'Hadir'
                            ? 'Ubah Foto/Kehadiran'
                            : 'Unggah Kehadiran'}
                        </span>
                      </button>
                    )}

                    {/* Manager Actions (Kasi Trantib & Lurah) */}
                    {canManagePosko && (
                      <>
                        {posko.status !== 'SELESAI' && (
                          <button
                            type="button"
                            onClick={() => {
                              setPoskoToComplete(posko);
                              setCatatanSelesaikan('Posko telah selesai dan daftar hadir diverifikasi lengkap.');
                              setIsSelesaikanModalOpen(true);
                            }}
                            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Tandai Selesai</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(posko)}
                          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                          title="Ubah Jadwal"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePosko(posko)}
                          className="p-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 cursor-pointer"
                          title="Hapus Jadwal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Body: Arahan & Ringkasan */}
                <div className="p-4 sm:p-5 space-y-4">
                  {posko.arahanTugas && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 leading-relaxed">
                      <strong className="text-slate-900 block mb-1">📋 Petunjuk / Arahan Tugas Piket:</strong>
                      {posko.arahanTugas}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="text-slate-600">
                      Penanggung Jawab:{' '}
                      <strong className="text-slate-900">{posko.penanggungJawab}</strong>
                    </div>
                    <div className="text-slate-600 font-semibold">
                      Kehadiran Petugas:{' '}
                      <span className="text-emerald-700 font-black">
                        {totalHadir} dari {totalPetugas} Kepling Hadir
                      </span>
                    </div>
                  </div>

                  {/* Grid Kepala Lingkungan yang Ditugaskan */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span>Daftar Kepala Lingkungan yang Bertugas ({totalPetugas} Kepling):</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {posko.petugasKepling?.map((petugas) => {
                        const isMe =
                          isKepling &&
                          (petugas.keplingId === currentUser.id ||
                            petugas.nomorLingkungan === currentUser.nomorLingkungan);
                        const isHadir = petugas.statusKehadiran === 'Hadir';

                        return (
                          <div
                            key={petugas.keplingId}
                            className={`p-3 rounded-xl border transition-all text-xs space-y-2 ${
                              isMe
                                ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/20'
                                : isHadir
                                ? 'bg-emerald-50/40 border-emerald-200'
                                : 'bg-slate-50/70 border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-black uppercase text-slate-500 block">
                                  Lingkungan {petugas.nomorLingkungan} {isMe && '• (Anda)'}
                                </span>
                                <span className="font-black text-slate-900 block text-xs">
                                  {petugas.namaKepling}
                                </span>
                              </div>

                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                                  isHadir
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : petugas.statusKehadiran === 'Izin'
                                    ? 'bg-blue-100 text-blue-800'
                                    : petugas.statusKehadiran === 'Sakit'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {petugas.statusKehadiran}
                              </span>
                            </div>

                            {/* Foto Kehadiran Preview */}
                            {petugas.fotoKehadiranUrl ? (
                              <div className="flex items-center gap-2 pt-1">
                                <div
                                  onClick={() =>
                                    setZoomedImage({
                                      url: petugas.fotoKehadiranUrl!,
                                      title: `Foto Kehadiran: ${petugas.namaKepling} (Lingkungan ${petugas.nomorLingkungan})`,
                                    })
                                  }
                                  className="w-14 h-14 rounded-lg bg-slate-200 overflow-hidden relative cursor-pointer group shrink-0 border border-slate-300"
                                >
                                  <img
                                    src={petugas.fotoKehadiranUrl}
                                    alt="Foto Kehadiran"
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Eye className="w-4 h-4 text-white" />
                                  </div>
                                </div>

                                <div className="min-w-0 flex-1 text-[11px] text-slate-600">
                                  <div className="font-bold text-emerald-700 flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    <span>Hadir: {petugas.jamHadir || '21.00 WIB'}</span>
                                  </div>
                                  {petugas.catatanSituasi && (
                                    <p className="line-clamp-2 text-slate-600 italic mt-0.5">
                                      "{petugas.catatanSituasi}"
                                    </p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400 italic pt-1">
                                Belum ada unggahan foto kehadiran.
                              </div>
                            )}

                            {isMe && (
                              <button
                                type="button"
                                onClick={() => handleOpenUploadKehadiran(posko)}
                                className="w-full mt-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Camera className="w-3 h-3" />
                                <span>{isHadir ? 'Perbarui Foto Kehadiran' : 'Unggah Kehadiran Sekarang'}</span>
                              </button>
                            )}

                            {isSuperAdmin && (
                              <div className="pt-2 mt-1 border-t border-slate-200/80 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-indigo-900 uppercase">Verifikasi Admin:</span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const currentWibTime = new Intl.DateTimeFormat('id-ID', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        timeZone: 'Asia/Jakarta',
                                      }).format(new Date()) + ' WIB (Verifikasi Admin)';
                                      await updateKeplingPoskoKehadiran(posko.id, petugas.keplingId, {
                                        statusKehadiran: 'Hadir',
                                        jamHadir: petugas.jamHadir && !petugas.jamHadir.includes('Verifikasi') ? petugas.jamHadir : currentWibTime,
                                        catatanSituasi: petugas.catatanSituasi || 'Kehadiran diverifikasi langsung oleh Super Admin.',
                                      });
                                      setPoskoList(getLocalJadwalPoskoList());
                                      notify(`Kehadiran Lingkungan ${petugas.nomorLingkungan} (${petugas.namaKepling}) berhasil diverifikasi Hadir!`, 'success');
                                    } catch {
                                      notify('Gagal memverifikasi kehadiran kepling.', 'error');
                                    }
                                  }}
                                  className={`px-2 py-1 rounded-md text-[10px] font-black cursor-pointer shadow-2xs ${
                                    isHadir
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                      : 'bg-indigo-700 text-white hover:bg-indigo-600'
                                  }`}
                                >
                                  {isHadir ? '✓ Hadir (Terverifikasi)' : '⚡ Verifikasi Hadir'}
                                </button>
                                {!isHadir && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await updateKeplingPoskoKehadiran(posko.id, petugas.keplingId, {
                                          statusKehadiran: 'Belum Hadir',
                                          jamHadir: '-',
                                        });
                                        setPoskoList(getLocalJadwalPoskoList());
                                        notify(`Status Lingkungan ${petugas.nomorLingkungan} direset ke Belum Hadir.`, 'info');
                                      } catch {
                                        notify('Gagal mereset status kehadiran.', 'error');
                                      }
                                    }}
                                    className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL BUAT / EDIT JADWAL POSKO (KHUSUS KASI TRANTIB & LURAH) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black">
                  {editingItem ? 'Ubah Jadwal Posko' : 'Buat Jadwal Posko Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitForm} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Jenis Posko Switcher */}
              <div>
                <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">
                  Pilih Jenis Posko
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormJenis('posko_trantibum');
                      setFormNama('Posko Trantibum (Ketenteraman & Ketertiban Umum)');
                      setFormWaktu('Pukul 21.00 WIB s/d Selesai');
                      setFormLokasi('Kantor Lurah');
                    }}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      formJenis === 'posko_trantibum'
                        ? 'bg-amber-50 border-amber-400 text-amber-950 font-black shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <div className="text-xs font-black">Posko Trantibum</div>
                      <div className="text-[10px] text-slate-500 font-normal">Kantor Lurah (21.00 WIB)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormJenis('posko_banjir');
                      setFormNama('Posko Kewaspadaan Banjir');
                      setFormWaktu('Pukul 21.00 WIB s/d Selesai');
                      setFormLokasi('Taman Segitiga Lk. 9');
                    }}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      formJenis === 'posko_banjir'
                        ? 'bg-cyan-50 border-cyan-400 text-cyan-950 font-black shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Waves className="w-5 h-5 text-cyan-700 shrink-0" />
                    <div>
                      <div className="text-xs font-black">Posko Banjir</div>
                      <div className="text-[10px] text-slate-500 font-normal">Taman Segitiga Lk. 9</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormJenis('posko_bersih_sampah');
                      setFormNama('Posko Bersih Sampah Malam Hari');
                      setFormWaktu('Pukul 20.00 WIB s/d Selesai');
                      setFormLokasi('Jalan Jamin Ginting');
                    }}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      formJenis === 'posko_bersih_sampah'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-black shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Trash2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-xs font-black">Posko Bersih Sampah</div>
                      <div className="text-[10px] text-slate-500 font-normal">Jl. Jamin Ginting (20.00)</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Nama Posko */}
              <div>
                <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">
                  Judul / Nama Posko *
                </label>
                <input
                  type="text"
                  required
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Tanggal & Waktu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">
                    Tanggal Posko *
                  </label>
                  <input
                    type="date"
                    required
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">
                    Waktu Pelaksanaan *
                  </label>
                  <input
                    type="text"
                    required
                    value={formWaktu}
                    onChange={(e) => setFormWaktu(e.target.value)}
                    placeholder="cth. Pukul 21.00 WIB s/d Selesai"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Lokasi Posko */}
              <div>
                <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">
                  Lokasi Posko *
                </label>
                <input
                  type="text"
                  required
                  value={formLokasi}
                  onChange={(e) => setFormLokasi(e.target.value)}
                  placeholder="cth. Kantor Kelurahan Mangga & Patroli Mobile Wilayah"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Arahan Tugas */}
              <div>
                <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">
                  Petunjuk &amp; Arahan Tugas Piket
                </label>
                <textarea
                  rows={2}
                  value={formArahan}
                  onChange={(e) => setFormArahan(e.target.value)}
                  placeholder="Petunjuk teknis pelaksanaan posko malam hari..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Penanggung Jawab */}
              <div>
                <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">
                  Penanggung Jawab / Koordinator
                </label>
                <input
                  type="text"
                  value={formPenanggungJawab}
                  onChange={(e) => setFormPenanggungJawab(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Pemilihan Kepling Bertugas (Pilih Manual) */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[11px] font-black text-slate-800 uppercase tracking-wide">
                    Tentukan Kepala Lingkungan yang Bertugas ({selectedKeplingIds.length} Terpilih):
                  </label>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedKeplingIds(
                          KEPLING_DATA_RESMI.map((k) => `kepling_${k.nomor}`)
                        )
                      }
                      className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-[10px] font-black text-emerald-800"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedKeplingIds([])}
                      className="px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-[10px] font-black text-rose-700"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50/50">
                  {KEPLING_DATA_RESMI.map((k) => {
                    const id = `kepling_${k.nomor}`;
                    const checked = selectedKeplingIds.includes(id);

                    return (
                      <label
                        key={id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-amber-100/70 border-amber-300 text-slate-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleKeplingId(id)}
                          className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="w-6 h-6 rounded-md bg-slate-200 text-slate-800 font-black text-[10px] flex items-center justify-center shrink-0">
                          {k.nomor}
                        </span>
                        <span className="truncate">{k.namaKepling}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status Posko */}
              <div>
                <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">
                  Status Jadwal Posko
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as StatusPosko)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="TERJADWAL">Terjadwal (Menunggu Pelaksanaan Posko)</option>
                  <option value="BERLANGSUNG">Sedang Berlangsung (Piket Berjalan)</option>
                  <option value="SELESAI">Selesai (Sudah Terverifikasi)</option>
                </select>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-md disabled:opacity-50"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan Jadwal Posko'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL UNGGAH FOTO KEHADIRAN (KHUSUS KEPLING BERTUGAS) */}
      {isUploadKehadiranOpen && poskoForUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-amber-600 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-100" />
                <div>
                  <h3 className="text-base font-black">Unggah Kehadiran &amp; Foto Posko</h3>
                  <p className="text-[11px] text-amber-100">{poskoForUpload.namaPosko}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setIsUploadKehadiranOpen(false);
                }}
                className="p-1 rounded-lg hover:bg-amber-700 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitKehadiran} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="font-bold text-slate-900">
                  Kepala Lingkungan: {currentUser.nama} (Lingkungan {currentUser.nomorLingkungan})
                </div>
                <div className="text-[11px] text-slate-600">
                  Jadwal: {poskoForUpload.waktuMulai} • Lokasi: {poskoForUpload.lokasiPosko}
                </div>
              </div>

              {/* Status Kehadiran */}
              <div>
                <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">
                  Status Kehadiran *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Hadir', 'Izin', 'Sakit'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setUploadStatusKehadiran(st);
                        if (st !== 'Hadir') {
                          stopCameraStream();
                        } else if (!uploadFotoBase64 && !isCameraActive) {
                          startLiveCamera(cameraFacingMode);
                        }
                      }}
                      className={`py-2 rounded-xl border text-xs font-black cursor-pointer transition-all ${
                        uploadStatusKehadiran === st
                          ? st === 'Hadir'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : st === 'Izin'
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                            : 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Jam Kehadiran Otomatis (Sesuai Waktu HP Kepling - Terkunci) */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-[11px] font-black text-slate-700 uppercase">
                    Jam Kehadiran (Otomatis Waktu HP) *
                  </label>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black">
                    <Lock className="w-3 h-3" />
                    Terkunci Sistem
                  </span>
                </div>
                <div className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50/70 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="text-sm font-black text-emerald-950 tracking-wide">
                      {fotoCapturedAt || formatDeviceClockWithSeconds(deviceNow)}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700">
                    {fotoCapturedAt ? 'Terkunci saat foto diambil' : 'Sinkron Waktu HP'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Waktu kehadiran dicatat otomatis sesuai jam pada HP Anda dan tidak dapat diubah manual.
                </p>
              </div>

              {/* Foto Kehadiran (Hanya Diambil Langsung dari Kamera) */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-[11px] font-black text-slate-700 uppercase">
                    Foto Kehadiran (Khusus Kamera Langsung){' '}
                    {uploadStatusKehadiran === 'Hadir' && <span className="text-rose-600">*</span>}
                  </label>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    Tanpa Galeri
                  </span>
                </div>

                {uploadFotoBase64 ? (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden border border-slate-300 aspect-video bg-slate-900 max-h-56">
                      <img
                        src={uploadFotoBase64}
                        alt="Preview Foto Kehadiran"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setUploadFotoBase64(undefined);
                          setFotoCapturedAt(null);
                          startLiveCamera(cameraFacingMode);
                        }}
                        className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/75 hover:bg-black text-white text-xs font-bold shadow-md cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Ambil Ulang Kamera</span>
                      </button>
                    </div>
                  </div>
                ) : isCameraActive ? (
                  <div className="rounded-xl overflow-hidden border-2 border-amber-500 bg-slate-950 space-y-2 p-2">
                    <div className="relative rounded-lg overflow-hidden aspect-video bg-black">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-amber-300 text-[10px] font-black flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        <span>KAMERA LIVE • {formatDeviceClockWithSeconds(deviceNow)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          startLiveCamera(cameraFacingMode === 'environment' ? 'user' : 'environment')
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{cameraFacingMode === 'environment' ? 'Kamera Depan' : 'Kamera Belakang'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCaptureFromLiveCamera}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Ambil Foto Sekarang</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-amber-300 rounded-xl p-5 text-center bg-amber-50/40 space-y-2.5">
                    <Camera className="w-8 h-8 text-amber-600 mx-auto" />
                    <div>
                      <p className="text-xs font-black text-slate-800">
                        {isStartingCamera
                          ? 'Menghubungkan ke Kamera HP...'
                          : isCompressingFoto
                          ? 'Memproses Foto Kamera...'
                          : 'Ambil Foto Langsung dari Kamera'}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Demi keaslian laporan, foto wajib diambil langsung melalui kamera dan tidak diperkenankan mengambil dari galeri.
                      </p>
                    </div>

                    {cameraError && (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800 font-medium text-left">
                        {cameraError}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isStartingCamera || isCompressingFoto}
                        onClick={() => startLiveCamera(cameraFacingMode)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        <Camera className="w-4 h-4" />
                        <span>{isStartingCamera ? 'Membuka Kamera...' : 'Buka Kamera Langsung'}</span>
                      </button>

                      {cameraError && (
                        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs cursor-pointer shadow-sm">
                          <Camera className="w-4 h-4" />
                          <span>{isCompressingFoto ? 'Memproses...' : 'Buka Kamera Perangkat'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePhotoSelect}
                            disabled={isCompressingFoto}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Catatan / Laporan Situasi Lapangan */}
              <div>
                <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">
                  Laporan Situasi / Kondisi Lapangan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={uploadCatatanSituasi}
                  onChange={(e) => setUploadCatatanSituasi(e.target.value)}
                  placeholder="cth. Debit air parit terpantau normal, tidak ada genangan, wilayah aman kondusif."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    setIsUploadKehadiranOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingKehadiran || isCompressingFoto}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs shadow-md disabled:opacity-50"
                >
                  {isSubmittingKehadiran ? 'Mengirim...' : 'Kirim Kehadiran Posko'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TANDAI SELESAI POSKO */}
      {isSelesaikanModalOpen && poskoToComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Konfirmasi Penyelesaian Posko</h3>
                <p className="text-xs text-slate-500">{poskoToComplete.namaPosko}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Posko akan dinyatakan <strong>SELESAI</strong> dan diverifikasi oleh{' '}
              <strong>{currentUser.nama}</strong>. Daftar hadir posko dan dokumentasi foto akan disahkan untuk pencetakan dokumen PDF.
            </p>

            <div>
              <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">
                Catatan Penyelesaian / Resume Posko
              </label>
              <textarea
                rows={2}
                value={catatanSelesaikan}
                onChange={(e) => setCatatanSelesaikan(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSelesaikanModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSelesaikanPosko}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-sm"
              >
                Selesaikan &amp; Sahkan Posko
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRATINJAU & CETAK PDF DAFTAR HADIR POSKO RESMI */}
      {isPdfModalOpen && poskoForPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden">
            {/* Modal Toolbar */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-black">
                    Dokumen PDF Resmi: Daftar Hadir &amp; Laporan Piket Posko
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    {poskoForPdf.namaPosko} • {formatHariTanggalIndonesia(poskoForPdf.tanggal)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-black cursor-pointer shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>{isDownloadingPdf ? 'Membuat PDF...' : 'Unduh PDF (.pdf)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black cursor-pointer shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Print (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Area Lembar Cetak Dokumen Resmi Ber-KOP */}
            <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-200 flex justify-center">
              <div
                id="lembar-cetak-daftar-hadir-posko"
                className="bg-white w-full max-w-[800px] p-6 sm:p-8 shadow-xl border border-slate-300 text-black"
                style={{
                  fontFamily: "'Times New Roman', Times, serif",
                  color: '#000000',
                  backgroundColor: '#ffffff',
                }}
              >
                {/* 1. KOP SURAT RESMI */}
                <KopSuratResmi />

                {/* 2. JUDUL DOKUMEN */}
                <div style={{ textAlign: 'center', marginTop: '8px', marginBottom: '12px' }}>
                  <div
                    style={{
                      fontSize: '12.5pt',
                      fontWeight: 'bold',
                      textDecoration: 'underline',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    DAFTAR HADIR &amp; LAPORAN PIKET POSKO KELURAHAN
                  </div>
                  <div
                    style={{
                      fontSize: '10.5pt',
                      fontWeight: 'bold',
                      marginTop: '2px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {poskoForPdf.namaPosko}
                  </div>
                </div>

                {/* 3. IDENTITAS KEGIATAN POSKO */}
                <table
                  className="no-print-border"
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginBottom: '10px',
                    fontSize: '9.5pt',
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ width: '150px', fontWeight: 'bold', padding: '1.5px 4px', border: 'none' }}>
                        HARI / TANGGAL
                      </td>
                      <td style={{ width: '12px', padding: '1.5px 4px', border: 'none' }}>:</td>
                      <td style={{ padding: '1.5px 4px', fontWeight: 'bold', border: 'none' }}>
                        {formatHariTanggalIndonesia(poskoForPdf.tanggal)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', padding: '1.5px 4px', border: 'none' }}>
                        WAKTU PELAKSANAAN
                      </td>
                      <td style={{ padding: '1.5px 4px', border: 'none' }}>:</td>
                      <td style={{ padding: '1.5px 4px', fontWeight: 'bold', border: 'none' }}>
                        {poskoForPdf.waktuMulai}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', padding: '1.5px 4px', border: 'none' }}>
                        LOKASI POSKO
                      </td>
                      <td style={{ padding: '1.5px 4px', border: 'none' }}>:</td>
                      <td style={{ padding: '1.5px 4px', border: 'none' }}>
                        {poskoForPdf.lokasiPosko}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', padding: '1.5px 4px', border: 'none' }}>
                        PENANGGUNG JAWAB
                      </td>
                      <td style={{ padding: '1.5px 4px', border: 'none' }}>:</td>
                      <td style={{ padding: '1.5px 4px', border: 'none' }}>
                        {poskoForPdf.penanggungJawab}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* 4. TABEL DAFTAR HADIR PETUGAS POSKO */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '9pt',
                    marginBottom: '10px',
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'center', width: '32px', backgroundColor: '#f1f5f9' }}>
                        No.
                      </th>
                      <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '80px', backgroundColor: '#f1f5f9' }}>
                        Lingkungan
                      </th>
                      <th style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'left', backgroundColor: '#f1f5f9' }}>
                        Nama Kepala Lingkungan
                      </th>
                      <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '85px', backgroundColor: '#f1f5f9' }}>
                        Jam Hadir
                      </th>
                      <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '90px', backgroundColor: '#f1f5f9' }}>
                        Keterangan
                      </th>
                      <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left', width: '160px', backgroundColor: '#f1f5f9' }}>
                        Laporan Situasi
                      </th>
                      <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '70px', backgroundColor: '#f1f5f9' }}>
                        Paraf
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {poskoForPdf.petugasKepling?.map((k, idx) => (
                      <tr key={k.keplingId}>
                        <td style={{ border: '1px solid #000', padding: '3.5px 4px', textAlign: 'center' }}>
                          {idx + 1}.
                        </td>
                        <td style={{ border: '1px solid #000', padding: '3.5px 6px', textAlign: 'center', fontWeight: 'bold' }}>
                          Lingk. {k.nomorLingkungan}
                        </td>
                        <td style={{ border: '1px solid #000', padding: '3.5px 8px', fontWeight: 'bold' }}>
                          {k.namaKepling}
                        </td>
                        <td style={{ border: '1px solid #000', padding: '3.5px 6px', textAlign: 'center' }}>
                          {k.jamHadir || '-'}
                        </td>
                        <td style={{ border: '1px solid #000', padding: '3.5px 6px', textAlign: 'center', fontWeight: 'bold' }}>
                          {k.statusKehadiran}
                        </td>
                        <td style={{ border: '1px solid #000', padding: '3.5px 6px', fontSize: '8.5pt' }}>
                          {k.catatanSituasi || '-'}
                        </td>
                        <td style={{ border: '1px solid #000', padding: '3.5px 6px', textAlign: 'center', fontSize: '8pt', color: '#555' }}>
                          {k.statusKehadiran === 'Hadir' ? '✓ Hadir' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* 5. LAMPIRAN DOKUMENTASI FOTO KEHADIRAN */}
                {poskoForPdf.petugasKepling?.some((k) => k.fotoKehadiranUrl) && (
                  <div className="avoid-break" style={{ marginTop: '10px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '9.5pt', fontWeight: 'bold', marginBottom: '6px' }}>
                      LAMPIRAN DOKUMENTASI FOTO KEHADIRAN POSKO:
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '8px',
                      }}
                    >
                      {poskoForPdf.petugasKepling
                        ?.filter((k) => k.fotoKehadiranUrl)
                        .map((k) => (
                          <div
                            key={k.keplingId}
                            style={{
                              border: '1px solid #999',
                              padding: '4px',
                              textAlign: 'center',
                              backgroundColor: '#fafafa',
                            }}
                          >
                            <img
                              src={k.fotoKehadiranUrl}
                              alt={`Foto ${k.namaKepling}`}
                              style={{
                                width: '100%',
                                height: '110px',
                                objectFit: 'cover',
                                display: 'block',
                                marginBottom: '3px',
                              }}
                            />
                            <div style={{ fontSize: '7.5pt', fontWeight: 'bold' }}>
                              Lingk. {k.nomorLingkungan} - {k.namaKepling}
                            </div>
                            <div style={{ fontSize: '7pt', color: '#555' }}>
                              {k.jamHadir || '21.00 WIB'}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 6. BLOK TANDA TANGAN */}
                <div
                  className="avoid-break"
                  style={{
                    marginTop: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '9.5pt',
                  }}
                >
                  <div style={{ width: '240px', textAlign: 'center' }}>
                    <div>Mengetahui,</div>
                    <div style={{ fontWeight: 'bold' }}>Lurah Kelurahan Mangga</div>
                    <div style={{ height: '50px' }} />
                    <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                      Feriyanto Arapenta Tarigan, A.Md
                    </div>
                    <div style={{ fontSize: '8.5pt' }}>NIP. 198502152010011012</div>
                  </div>

                  <div style={{ width: '240px', textAlign: 'center' }}>
                    <div>Medan, {formatTanggalSingkatIndonesia(poskoForPdf.tanggal)}</div>
                    <div style={{ fontWeight: 'bold' }}>Kasi Trantibum Kelurahan Mangga</div>
                    <div style={{ height: '50px' }} />
                    <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                      KASI TRANTIBUM
                    </div>
                    <div style={{ fontSize: '8.5pt' }}>Koordinator Pelaksana Posko</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ZOOM IMAGE PREVIEW */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-black rounded-2xl overflow-hidden shadow-2xl">
            <img
              src={zoomedImage.url}
              alt="Zoomed"
              className="max-w-full max-h-[80vh] object-contain mx-auto"
            />
            <div className="p-3 bg-slate-900 text-white text-xs font-bold text-center">
              {zoomedImage.title} (Klik di mana saja untuk menutup)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
