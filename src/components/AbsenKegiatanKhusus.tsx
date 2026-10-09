import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Camera,
  FileImage,
  CheckCircle,
  AlertCircle,
  PlusCircle,
  Trash2,
  Users,
  UserCheck,
  ChevronRight,
  ChevronDown,
  Info,
  X,
  RefreshCw,
  Send
} from 'lucide-react';
import { EventAttendance, UserAccount } from '../types';
import type { CustomEvent } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { getNetworkNow } from '../lib/networkTimeService';
import {
  subscribeCustomEventsFromFirestore,
  saveCustomEventToFirestore,
  deleteCustomEventFromFirestore,
  subscribeEventAttendanceFromFirestore,
  saveEventAttendanceToFirestore
} from '../lib/firestoreService';

interface AbsenKegiatanKhususProps {
  activeAccount: UserAccount;
  showToast?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const AbsenKegiatanKhusus: React.FC<AbsenKegiatanKhususProps> = ({
  activeAccount,
  showToast
}) => {
  const isAdmin = activeAccount.role !== 'kepling';

  // State arrays for real-time sync
  const [events, setEvents] = useState<CustomEvent[]>([]);
  const [attendanceList, setAttendanceList] = useState<EventAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  // Accordion state for Admin list of events (event id -> boolean)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // New Event Form State (Admin Only)
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRequired, setNewRequired] = useState(true);
  const [selectedKeplings, setSelectedKeplings] = useState<string[]>([]);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);

  // Check-In Form State (Kepling Only)
  const [activeCheckInEvent, setActiveCheckInEvent] = useState<CustomEvent | null>(null);
  const [status, setStatus] = useState<'Hadir' | 'Izin' | 'Sakit' | 'Dinas Luar'>('Hadir');
  const [catatan, setCatatan] = useState('');
  const [fotoSelfie, setFotoSelfie] = useState('');
  const [lokasiGps, setLokasiGps] = useState('');
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [isSubmittingAbsen, setIsSubmittingAbsen] = useState(false);

  // Camera integration
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  // Real-time Firestore Subscriptions
  useEffect(() => {
    setLoading(true);
    const unsubEvents = subscribeCustomEventsFromFirestore((data) => {
      setEvents(data);
      setLoading(false);
    });

    const unsubAttendance = subscribeEventAttendanceFromFirestore((data) => {
      setAttendanceList(data);
    });

    return () => {
      unsubEvents();
      unsubAttendance();
    };
  }, []);

  // Format Helper: Short Indonesian date
  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10);
        const day = parts[2];
        const months = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return `${day} ${months[monthNum - 1]} ${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Create Event (Admin Only)
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate || !newTime || !newLocation.trim()) {
      showToast?.('Mohon lengkapi semua isian formulir kegiatan!', 'warning');
      return;
    }

    setIsSubmittingEvent(true);
    const eventId = 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newEvent: CustomEvent = {
      id: eventId,
      title: newTitle.trim(),
      date: newDate,
      time: newTime,
      location: newLocation.trim(),
      description: newDescription.trim() || undefined,
      required: newRequired,
      targetKeplingIds: newRequired ? undefined : selectedKeplings,
      createdBy: activeAccount.nama,
      createdAt: new Date().toISOString()
    };

    const success = await saveCustomEventToFirestore(newEvent);
    setIsSubmittingEvent(false);

    if (success) {
      showToast?.(`Kegiatan "${newTitle}" berhasil ditambahkan!`, 'success');
      // Reset form
      setNewTitle('');
      setNewDate('');
      setNewTime('');
      setNewLocation('');
      setNewDescription('');
      setNewRequired(true);
      setSelectedKeplings([]);
    } else {
      showToast?.('Gagal menyimpan kegiatan ke database.', 'error');
    }
  };

  // Delete Event (Admin Only)
  const handleDeleteEvent = async (eventId: string, title: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus kegiatan "${title}"?\nSeluruh data absensi kepling pada kegiatan ini juga akan hilang.`)) {
      const success = await deleteCustomEventFromFirestore(eventId);
      if (success) {
        showToast?.('Kegiatan berhasil dihapus.', 'success');
        if (expandedEventId === eventId) setExpandedEventId(null);
      } else {
        showToast?.('Gagal menghapus kegiatan.', 'error');
      }
    }
  };

  // Location Geolocation Handler
  const handleFetchGps = async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLokasiGps('GPS tidak didukung perangkat ini');
      return;
    }

    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const accuracy = pos.coords.accuracy.toFixed(1);
        setLokasiGps(`${lat}, ${lng} (Akurasi: ±${accuracy}m)`);
        setIsGettingGps(false);
        showToast?.('Sinyal GPS berhasil terkunci!', 'success');
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLokasiGps('Akses lokasi ditolak / tidak tersedia');
        setIsGettingGps(false);
        showToast?.('Gagal mendapatkan lokasi GPS otomatis.', 'warning');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Camera Functions
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' } },
        audio: false
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera stream err:', err);
      showToast?.('Gagal mengaktifkan kamera. Gunakan upload file sebagai alternatif.', 'warning');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.45);
        setFotoSelfie(dataUrl);
        stopCamera();
        showToast?.('Foto selfie berhasil diambil!', 'success');
      }
    }
  };

  // File Upload Compression
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
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.45);
          setFotoSelfie(compressed);
          showToast?.('Foto bukti berhasil diunggah & dikompres!', 'success');
        }
      };
    };
    reader.readAsDataURL(file);
  };

  // Submit Absen (Kepling Only)
  const handleSubmitAbsen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCheckInEvent) return;

    if (status === 'Hadir' && !fotoSelfie) {
      showToast?.('Wajib menyertakan foto dokumentasi/selfie jika Hadir!', 'warning');
      return;
    }

    if (status !== 'Hadir' && !catatan.trim()) {
      showToast?.('Mohon isi alasan / catatan untuk status ketidakhadiran!', 'warning');
      return;
    }

    setIsSubmittingAbsen(true);
    const attendanceId = `att_${activeCheckInEvent.id}_${activeAccount.id}`;
    const timestamp = getNetworkNow().toISOString();

    const payload: EventAttendance = {
      id: attendanceId,
      eventId: activeCheckInEvent.id,
      accountId: activeAccount.id,
      namaKepling: activeAccount.nama,
      lingkungan: activeAccount.lingkungan,
      nomorLingkungan: activeAccount.nomorLingkungan,
      status,
      timestamp,
      fotoSelfieUrl: fotoSelfie || undefined,
      lokasiGps: lokasiGps || 'Kelurahan Mangga (Verified)',
      catatan: catatan.trim() || undefined
    };

    const success = await saveEventAttendanceToFirestore(payload);
    setIsSubmittingAbsen(false);

    if (success) {
      showToast?.('Presensi berhasil dikirim secara real-time!', 'success');
      setActiveCheckInEvent(null);
      // Clean form states
      setFotoSelfie('');
      setCatatan('');
      setLokasiGps('');
      setStatus('Hadir');
    } else {
      showToast?.('Gagal menyimpan presensi Anda.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-1">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-2xl p-5 border border-emerald-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 text-emerald-300 rounded-xl flex items-center justify-center font-bold">
            <UserCheck className="w-5.5 h-5.5" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">Presensi Kegiatan Khusus</h2>
            <p className="text-xs text-emerald-200/80 mt-0.5">
              Fasilitas pencatatan absensi langsung terintegrasi untuk pertemuan, rapat, dan penugasan kelurahan.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3 bg-white rounded-2xl border border-slate-100">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Memuat data real-time...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT SIDE: FORM INPUTS */}
          <div className="lg:col-span-1 space-y-6">
            {isAdmin ? (
              // ADMIN: Create Event Form
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <PlusCircle className="w-5 h-5 text-emerald-700" />
                  <h3 className="font-extrabold text-slate-800 text-sm">Buat Kegiatan Absen Baru</h3>
                </div>

                <form onSubmit={handleCreateEvent} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Nama Kegiatan / Agenda</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
                      placeholder="e.g. Rapat Koordinasi Bulanan"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Tanggal</label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Waktu / Jam</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. 10:00 WIB"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Lokasi Pertemuan</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
                      placeholder="e.g. Aula Kantor Kelurahan"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Deskripsi / Agenda Pembahasan</label>
                    <textarea
                      rows={2}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
                      placeholder="e.g. Koordinasi mengenai penertiban PKL..."
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                      <input
                        id="required-checkbox"
                        type="checkbox"
                        className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                        checked={newRequired}
                        onChange={(e) => setNewRequired(e.target.checked)}
                      />
                      <label htmlFor="required-checkbox" className="text-xs font-extrabold text-slate-800 cursor-pointer">
                        Wajib Diikuti 24 Kepling
                      </label>
                    </div>

                    {!newRequired && (
                      <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                        {KEPLING_ACCOUNTS.map((k) => (
                          <label key={k.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer p-1 hover:bg-slate-50 rounded">
                            <input
                              type="checkbox"
                              checked={selectedKeplings.includes(k.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedKeplings([...selectedKeplings, k.id]);
                                else setSelectedKeplings(selectedKeplings.filter(id => id !== k.id));
                              }}
                              className="w-3.5 h-3.5 text-emerald-600"
                            />
                            {k.lingkungan} - {k.nama}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingEvent}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold rounded-xl text-xs transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{isSubmittingEvent ? 'Menyimpan...' : 'Rilis Kegiatan Absen'}</span>
                  </button>
                </form>
              </div>
            ) : (
              // KEPLING: Active Check-In form state
              activeCheckInEvent ? (
                <div className="bg-white rounded-2xl p-5 border border-emerald-500 shadow-md space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <h3 className="font-black text-emerald-950 text-sm">Form Check-In</h3>
                    </div>
                    <button
                      onClick={() => {
                        setActiveCheckInEvent(null);
                        stopCamera();
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-xs">
                    <p className="font-extrabold text-emerald-950">{activeCheckInEvent.title}</p>
                    <div className="flex items-center gap-3 text-emerald-800 mt-1">
                      <span className="flex items-center gap-0.5"><Calendar className="w-3.5 h-3.5" />{formatShortDate(activeCheckInEvent.date)}</span>
                      <span className="flex items-center gap-0.5"><Clock className="w-3.5 h-3.5" />{activeCheckInEvent.time}</span>
                    </div>
                  </div>

                  <form onSubmit={handleSubmitAbsen} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Status Kehadiran</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['Hadir', 'Izin', 'Sakit', 'Dinas Luar'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setStatus(s);
                              if (s !== 'Hadir') stopCamera();
                            }}
                            className={`py-1.5 px-1 rounded-lg text-[10px] font-black text-center transition-all cursor-pointer ${
                              status === s
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {status === 'Hadir' ? (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 block">Foto Selfie / Dokumentasi</label>
                        
                        {fotoSelfie ? (
                          <div className="relative rounded-xl overflow-hidden border border-slate-200">
                            <img src={fotoSelfie} alt="Preview" className="w-full h-40 object-cover" />
                            <button
                              type="button"
                              onClick={() => setFotoSelfie('')}
                              className="absolute top-2 right-2 p-1 bg-slate-900/80 hover:bg-slate-950 text-white rounded-full transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {isCameraActive ? (
                              <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                                <video
                                  ref={videoRef}
                                  autoPlay
                                  playsInline
                                  muted
                                  className="w-full h-44 object-cover scale-x-[-1]"
                                />
                                <button
                                  type="button"
                                  onClick={capturePhoto}
                                  className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-emerald-600 text-white text-xs font-black rounded-lg shadow-md flex items-center gap-1.5"
                                >
                                  <Camera className="w-4 h-4" />
                                  <span>Ambil Foto</span>
                                </button>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={startCamera}
                                  className="py-4 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1.5 hover:bg-slate-50 cursor-pointer text-slate-600"
                                >
                                  <Camera className="w-5 h-5 text-emerald-600" />
                                  <span className="text-[10px] font-bold">Kamera Langsung</span>
                                </button>

                                <label className="py-4 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1.5 hover:bg-slate-50 cursor-pointer text-slate-600">
                                  <FileImage className="w-5 h-5 text-emerald-600" />
                                  <span className="text-[10px] font-bold">Upload File</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* GPS Location Section */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">Verifikasi Lokasi GPS</label>
                        <button
                          type="button"
                          onClick={handleFetchGps}
                          disabled={isGettingGps}
                          className="text-[10px] font-black text-emerald-700 hover:text-emerald-800"
                        >
                          {isGettingGps ? 'Mencari...' : 'Perbarui GPS'}
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 bg-slate-50 text-slate-600"
                          placeholder="Koordinat GPS Lokasi Anda"
                          value={lokasiGps}
                          onChange={(e) => setLokasiGps(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        {status === 'Hadir' ? 'Catatan (Opsional)' : 'Alasan Ketidakhadiran (Wajib)'}
                      </label>
                      <textarea
                        rows={2}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
                        placeholder={status === 'Hadir' ? 'Masukkan catatan bila perlu...' : 'e.g. Sedang melaksanakan dinas luar di pemko...'}
                        value={catatan}
                        onChange={(e) => setCatatan(e.target.value)}
                        required={status !== 'Hadir'}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingAbsen}
                      className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold rounded-xl text-xs transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isSubmittingAbsen ? 'Mengirim...' : 'Kirim Absen Sekarang'}</span>
                    </button>
                  </form>
                </div>
              ) : (
                <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-200/60 text-center space-y-1">
                  <Info className="w-5 h-5 text-emerald-700 mx-auto" />
                  <h4 className="text-xs font-black text-emerald-950">Cara Absen Kegiatan</h4>
                  <p className="text-[11px] text-emerald-800">
                    Pilih salah satu agenda kegiatan di sebelah kanan, lalu klik tombol <strong>"Lakukan Absen"</strong> untuk mulai berpartisipasi.
                  </p>
                </div>
              )
            )}
          </div>

          {/* RIGHT SIDE: EVENTS LIST & ATTENDANCE MATRICES */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-black text-slate-800 text-sm">Agenda Kegiatan Khusus</h3>
              <span className="text-xs text-slate-500 font-medium">Total: {events.length} Agenda</span>
            </div>

            {events.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xs text-center text-slate-500 text-xs">
                Belum ada agenda kegiatan khusus yang dibuat oleh Admin Kelurahan.
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => {
                  // Find all attendance for this event
                  const isTargeted = event.required || event.targetKeplingIds?.includes(activeAccount.id);
                  if (!isAdmin && !isTargeted) return null; // Only show targeted events to Kepling

                  const eventAttList = attendanceList.filter((a) => a.eventId === event.id);
                  const isCheckedIn = !isAdmin && eventAttList.some((a) => a.accountId === activeAccount.id);
                  const myAttendance = !isAdmin ? eventAttList.find((a) => a.accountId === activeAccount.id) : null;

                  return (
                    <div
                      key={event.id}
                      className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                        expandedEventId === event.id
                          ? 'border-emerald-600 shadow-md ring-1 ring-emerald-500/20'
                          : isCheckedIn
                          ? 'border-emerald-200 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      {/* Event Header Block */}
                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">{event.title}</h4>
                            {event.required && (
                              <span className="text-[9px] font-black uppercase bg-red-100 text-red-800 px-1.5 py-0.5 rounded">
                                Wajib
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 mt-1">
                            <span className="flex items-center gap-1 text-slate-700">
                              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                              {formatShortDate(event.date)}
                            </span>
                            <span className="flex items-center gap-1 text-slate-700">
                              <Clock className="w-3.5 h-3.5 text-emerald-600" />
                              {event.time}
                            </span>
                            <span className="flex items-center gap-1 text-slate-700">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                              {event.location}
                            </span>
                          </div>

                          {event.description && (
                            <p className="text-xs text-slate-500 italic mt-2 border-l-2 border-slate-200 pl-2">
                              "{event.description}"
                            </p>
                          )}
                        </div>

                        {/* Action buttons on Event */}
                        <div className="flex items-center gap-2 shrink-0 sm:self-center">
                          {isAdmin ? (
                            <>
                              <button
                                onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-black text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                              >
                                <Users className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Rekap ({eventAttList.length})</span>
                                {expandedEventId === event.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                onClick={() => handleDeleteEvent(event.id, event.title)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 cursor-pointer"
                                title="Hapus Kegiatan"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            isCheckedIn ? (
                              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-black">
                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                                <span>Sudah Absen ({myAttendance?.status})</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setActiveCheckInEvent(event);
                                  // Scroll to top of form on mobile
                                  window.scrollTo({ top: 300, behavior: 'smooth' });
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Lakukan Absen</span>
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {/* ADMIN ONLY: Real-Time Attendance Rekap Accordion */}
                      {isAdmin && expandedEventId === event.id && (
                        <div className="bg-slate-50/50 border-t border-slate-100 p-4 sm:p-5">
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/60">
                            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-emerald-700" />
                              <span>Status Absensi 24 Kepala Lingkungan</span>
                            </h5>
                            <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                              Hadir: {eventAttList.filter((a) => a.status === 'Hadir').length} | Tidak: {24 - eventAttList.filter((a) => a.status === 'Hadir').length}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {KEPLING_ACCOUNTS.map((kepling) => {
                              const att = eventAttList.find((a) => a.accountId === kepling.id);

                              return (
                                <div
                                  key={kepling.id}
                                  className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-3 shadow-2xs"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-extrabold text-slate-800 truncate">
                                      {kepling.lingkungan}
                                    </p>
                                    <p className="text-[10px] text-slate-500 truncate">{kepling.nama}</p>
                                    
                                    {att && att.catatan && (
                                      <p className="text-[10px] text-amber-700 italic mt-1 bg-amber-50 p-1 rounded border border-amber-100/60">
                                        "{att.catatan}"
                                      </p>
                                    )}

                                    {att && att.lokasiGps && (
                                      <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-0.5">
                                        <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                                        {att.lokasiGps}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {att ? (
                                      <div className="flex flex-col items-end gap-1">
                                        <span
                                          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                            att.status === 'Hadir'
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : att.status === 'Dinas Luar'
                                              ? 'bg-blue-100 text-blue-800'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}
                                        >
                                          {att.status}
                                        </span>
                                        <span className="text-[8px] text-slate-400">
                                          {new Date(att.timestamp).toLocaleTimeString('id-ID', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })} WIB
                                        </span>

                                        {att.fotoSelfieUrl && (
                                          <a
                                            href={att.fotoSelfieUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[9px] text-emerald-700 font-bold hover:underline"
                                          >
                                            Lihat Foto
                                          </a>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-400 text-[9px] font-black uppercase">
                                        Belum Absen
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
