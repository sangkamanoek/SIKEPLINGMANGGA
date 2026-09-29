import React, { useState, useEffect, useMemo } from 'react';
import {
  Camera,
  Trash2,
  FileSpreadsheet,
  Check,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Lock,
  RotateCcw,
  Users,
  MapPin,
  ExternalLink,
  X,
  HeartPulse,
  Baby,
  Clock,
  Activity,
  Stethoscope,
  Moon,
} from 'lucide-react';
import { getMaximumAccuracyPosition } from '../lib/geoService';
import { FormKunjunganWarga, KunjunganWargaData } from './FormKunjunganWarga';
import { LaporanHarianItem, FotoDokumentasi, KinerjaHarian, UserAccount, AbsenApelItem, CustomEvent, EventAttendance } from '../types';
import {
  subscribeCustomEventsFromFirestore,
  subscribeEventAttendanceFromFirestore,
} from '../lib/firestoreService';
import {
  getNamaHariIndonesia,
  formatTanggalIndonesia,
  getTodayLocalIso,
  NAMA_HARI,
  formatReportToText,
} from '../lib/formatter';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { safeSetLocalStorage } from '../lib/safeStorage';
import { loadAllAttendance, checkApelTimeStatus, calculateAbsentDays } from '../lib/attendanceApi';

interface FormLaporanProps {
  onSaveReport: (item: LaporanHarianItem) => Promise<void>;
  isSaving: boolean;
  hasGoogleAuth: boolean;
  onConnectGoogle: () => void;
  activeAccount?: UserAccount;
  preselectedKepling?: UserAccount | null;
  attendanceList?: AbsenApelItem[];
  onOpenAbsenApel?: () => void;
  onBackToRangkuman?: () => void;
}

const STORAGE_KEY_PROFILE = 'kepling_profile_data';

const LAINNYA_OPTIONS_PRESET = [
  'Gotong Royong',
  'Posko Trantibum Kelurahan',
  'Posko Bersemi',
  'Posko Patam',
  'Mediasi Warga',
  'Pemantauan Kebersihan Lingkungan',
  'Pemantauan Faktor 74',
  'Rapat Koordinasi Kecamatan',
  'Rapat Koordinasi Kelurahan',
  'Fasilitasi Posyandu',
  'Menghadiri Reses/Sosperda',
  'Kegiatan Lainnya',
];

export const FormLaporan: React.FC<FormLaporanProps> = ({
  onSaveReport,
  isSaving,
  hasGoogleAuth,
  onConnectGoogle,
  activeAccount,
  preselectedKepling,
  attendanceList = [],
  onOpenAbsenApel,
  onBackToRangkuman,
}) => {
  const today = new Date();

  // Basic info state
  const [hari, setHari] = useState<string>(getNamaHariIndonesia(today));
  const [tanggalText, setTanggalText] = useState<string>(formatTanggalIndonesia(today));
  const [rawDate, setRawDate] = useState<string>(getTodayLocalIso(today));

  // Attendance Apel state
  const [todayApel, setTodayApel] = useState<AbsenApelItem | null>(null);
  const [eventList, setEventList] = useState<CustomEvent[]>([]);
  const [eventAttendanceList, setEventAttendanceList] = useState<EventAttendance[]>([]);

  useEffect(() => {
    const unsubEvents = subscribeCustomEventsFromFirestore((data) => setEventList(data));
    const unsubAttendance = subscribeEventAttendanceFromFirestore((data) => setEventAttendanceList(data));
    
    return () => {
      unsubEvents();
      unsubAttendance();
    };
  }, []);

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
  // Pendataan Perlinsos: Menolak & Tidak di Tempat
  const [perlinsosKategoriKegiatan, setPerlinsosKategoriKegiatan] = useState<string>('Pendataan Perlinsos');
  const [perlinsosMenolakKk, setPerlinsosMenolakKk] = useState<string>('0');
  const [perlinsosMenolakRincian, setPerlinsosMenolakRincian] = useState<string>('');
  const [perlinsosTidakDiTempatKk, setPerlinsosTidakDiTempatKk] = useState<string>('0');
  const [perlinsosTidakDiTempatRincian, setPerlinsosTidakDiTempatRincian] = useState<string>('');
  const [showPerlinsosRincianKhusus, setShowPerlinsosRincianKhusus] = useState<boolean>(false);

  const [ikdOrang, setIkdOrang] = useState<string>('0');
  const [ikdKeterangan, setIkdKeterangan] = useState<string>('Aktivasi aplikasi IKD Dukcapil');

  const [bpjsKetenagakerjaanOrang, setBpjsKetenagakerjaanOrang] = useState<string>('0');
  const [bpjsKetenagakerjaanKeterangan, setBpjsKetenagakerjaanKeterangan] = useState<string>('Sosialisasi pekerja rentan');

  // Helper untuk mereset seluruh isian kinerja harian ke 0
  const handleResetKinerjaToZero = () => {
    setOpsirPbbWp('0');
    setPerlinsosKk('0');
    setPerlinsosMenolakKk('0');
    setPerlinsosMenolakRincian('');
    setPerlinsosTidakDiTempatKk('0');
    setPerlinsosTidakDiTempatRincian('');
    setIkdOrang('0');
    setBpjsKetenagakerjaanOrang('0');
    setSelectedLainnyaOptions([]);
    setKegiatanLainnyaCustomText('');
    setInfrastrukturAdaGiat(false);
    setInfrastrukturSubjek('');
    setInfrastrukturTitikKoordinat('');
  };

  // Tugas Tambahan POSKAMLING / SISKAMLING
  const [poskamlingAdaGiat, setPoskamlingAdaGiat] = useState<boolean>(true);
  const [poskamlingStatus, setPoskamlingStatus] = useState<string>('Aktif Ronda Malam');
  const [poskamlingLokasi, setPoskamlingLokasi] = useState<string>(
    initialAccount.lingkungan ? `Pos Ronda ${initialAccount.lingkungan}` : 'Pos Ronda Lingkungan'
  );
  const [poskamlingPetugas, setPoskamlingPetugas] = useState<string>('Kepling & Warga Ronda');
  const [poskamlingJumlahPetugas, setPoskamlingJumlahPetugas] = useState<string>('4');
  const [poskamlingJamOperasional, setPoskamlingJamOperasional] = useState<string>('21.00 - 04.00 WIB');
  const [poskamlingKeterangan, setPoskamlingKeterangan] = useState<string>(
    'Patroli siskamling lingkungan kondusif dan aman'
  );

  // Tugas Tambahan POSYANDU & LAYANAN KESEHATAN WARGA
  const [posyanduAdaGiat, setPosyanduAdaGiat] = useState<boolean>(false);
  const [posyanduNama, setPosyanduNama] = useState<string>(
    initialAccount.lingkungan ? `Posyandu ${initialAccount.lingkungan}` : 'Posyandu Melati'
  );
  const [posyanduLokasi, setPosyanduLokasi] = useState<string>(
    initialAccount.lingkungan ? `Balai Warga ${initialAccount.lingkungan}` : 'Balai Warga Lingkungan'
  );
  const [posyanduJumlahPetugasKader, setPosyanduJumlahPetugasKader] = useState<string>('5');
  const [posyanduBayi02Tahun, setPosyanduBayi02Tahun] = useState<string>('0');
  const [posyanduBalita25Tahun, setPosyanduBalita25Tahun] = useState<string>('0');
  const [posyanduAnak612Tahun, setPosyanduAnak612Tahun] = useState<string>('0');
  const [posyanduRemaja1318Tahun, setPosyanduRemaja1318Tahun] = useState<string>('0');
  const [posyanduDewasaIbuHamil1959Tahun, setPosyanduDewasaIbuHamil1959Tahun] = useState<string>('0');
  const [posyanduLansia60TahunKeatas, setPosyanduLansia60TahunKeatas] = useState<string>('0');
  const [posyanduJenisLayanan, setPosyanduJenisLayanan] = useState<string[]>([
    'Penimbangan & Pengukuran (Pantau Stunting)',
    'Imunisasi Dasar & Lanjutan Lengkap',
    'Pemberian Vitamin A & Obat Cacing',
  ]);
  const [posyanduKeterangan, setPosyanduKeterangan] = useState<string>(
    'Pelayanan posyandu berjalan tertib, sasaran balita dan lansia terlayani baik'
  );

  // Perhitungan Otomatis Kumulatif Total Warga Posyandu dari Usia 0 s.d Lansia
  const posyanduKumulatifTotal = useMemo(() => {
    const b02 = parseInt(posyanduBayi02Tahun, 10) || 0;
    const b25 = parseInt(posyanduBalita25Tahun, 10) || 0;
    const a612 = parseInt(posyanduAnak612Tahun, 10) || 0;
    const r1318 = parseInt(posyanduRemaja1318Tahun, 10) || 0;
    const d1959 = parseInt(posyanduDewasaIbuHamil1959Tahun, 10) || 0;
    const l60 = parseInt(posyanduLansia60TahunKeatas, 10) || 0;
    return b02 + b25 + a612 + r1318 + d1959 + l60;
  }, [
    posyanduBayi02Tahun,
    posyanduBalita25Tahun,
    posyanduAnak612Tahun,
    posyanduRemaja1318Tahun,
    posyanduDewasaIbuHamil1959Tahun,
    posyanduLansia60TahunKeatas,
  ]);

  const [kegiatanLainnya, setKegiatanLainnya] = useState<string>('');
  const [selectedLainnyaOptions, setSelectedLainnyaOptions] = useState<string[]>([]);
  const [kegiatanLainnyaCustomText, setKegiatanLainnyaCustomText] = useState<string>('');

  // Sinkronisasi pilihan cepat Kegiatan Lainnya ke string kegiatanLainnya untuk preview & database
  useEffect(() => {
    if (selectedLainnyaOptions.length === 0) {
      setKegiatanLainnya('');
      return;
    }
    const formatted = selectedLainnyaOptions
      .map((opt) => {
        if (opt === 'Kegiatan Lainnya') {
          return kegiatanLainnyaCustomText.trim()
            ? `Kegiatan Lainnya: ${kegiatanLainnyaCustomText.trim()}`
            : 'Kegiatan Lainnya';
        }
        return opt;
      })
      .join(', ');
    setKegiatanLainnya(formatted);
  }, [selectedLainnyaOptions, kegiatanLainnyaCustomText]);

  // Poin 6: Kegiatan Pemantauan Kondisi Infrastruktur Wilayah
  const getNomorLkText = (accLingkungan?: string, accJabatan?: string) => {
    if (accLingkungan) {
      return accLingkungan.replace(/lingkungan\s*/i, 'Lk ');
    }
    if (accJabatan) {
      const match = accJabatan.match(/Lingkungan\s+([A-Z0-9]+)/i);
      if (match) return `Lk ${match[1]}`;
    }
    return 'Lk ..';
  };

  const formatLokasiInfrastruktur = (jalanStr: string, lkStr: string) => {
    let cleanJalan = jalanStr.trim();
    // Hilangkan kata 'Jalan' atau 'Jl.' di awal agar tidak dobel seperti "( Jalan Jl. ... )"
    cleanJalan = cleanJalan.replace(/^jalan\s+/i, '').replace(/^jl\.?\s+/i, '');
    const displayJalan = cleanJalan || '...';
    return `( Jalan ${displayJalan} ${lkStr} Kelurahan Mangga Kecamatan Medan Tuntungan )`;
  };

  // Poin 6: Kegiatan Pemantauan Kondisi Infrastruktur Wilayah (Default false / Manual, tidak otomatis centang)
  const [infrastrukturAdaGiat, setInfrastrukturAdaGiat] = useState<boolean>(false);
  const [infrastrukturSubjek, setInfrastrukturSubjek] = useState<string>('Jalan Berlubang / Rusak');
  const [infrastrukturNamaJalan, setInfrastrukturNamaJalan] = useState<string>('');
  const [infrastrukturLokasi, setInfrastrukturLokasi] = useState<string>(() =>
    formatLokasiInfrastruktur('', getNomorLkText(initialAccount.lingkungan, initialAccount.jabatan))
  );
  const [infrastrukturTitikKoordinat, setInfrastrukturTitikKoordinat] = useState<string>('');
  const [infrastrukturTanggalPelaporan, setInfrastrukturTanggalPelaporan] = useState<string>(() =>
    formatTanggalIndonesia(today)
  );
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);

  // GPS Coordinates detection for Poin 6
  const handleGetGpsCoordinates = async () => {
    setIsDetectingGps(true);
    try {
      const pos = await getMaximumAccuracyPosition();
      const lat = pos.lat.toFixed(6);
      const lng = pos.lng.toFixed(6);
      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
      setInfrastrukturTitikKoordinat(mapsUrl);
    } catch (err: any) {
      console.warn('GPS detection notice, trying browser fallback:', err);
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const lat = p.coords.latitude.toFixed(6);
            const lng = p.coords.longitude.toFixed(6);
            setInfrastrukturTitikKoordinat(`https://maps.google.com/?q=${lat},${lng}`);
            setIsDetectingGps(false);
          },
          (e) => {
            alert('Gagal mengambil titik GPS: ' + (e.message || 'Izin lokasi perangkat dibutuhkan'));
            setIsDetectingGps(false);
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
        return;
      }
      alert('Perangkat tidak mendukung geolokasi atau izin lokasi belum aktif.');
    } finally {
      setIsDetectingGps(false);
    }
  };

  // Dokumentasi Foto state
  const [fotoList, setFotoList] = useState<FotoDokumentasi[]>([]);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [showPhotoValidationModal, setShowPhotoValidationModal] = useState<boolean>(false);
  const [showKunjunganInline, setShowKunjunganInline] = useState<boolean>(false);

  const handleKunjunganSuccess = (data: KunjunganWargaData) => {
    // Sinkronisasi data kunjungan warga ke formulir kinerja harian
    if (data.perlinsos === 'Sudah' || data.keterangan === 'Sudah') {
      setPerlinsosKk((prev) => {
        const cur = parseInt(prev, 10) || 0;
        return String(cur + 1);
      });
      setPerlinsosKeterangan((prev) =>
        prev && prev !== 'Pendataan Perlinsos'
          ? `${prev}, Kunjungan ${data.namaWarga}`
          : `Kunjungan warga: ${data.namaWarga}`
      );
    } else if (data.perlinsos === 'Menolak' || data.keterangan === 'Menolak') {
      setPerlinsosMenolakKk((prev) => {
        const cur = parseInt(prev, 10) || 0;
        return String(cur + 1);
      });
      setPerlinsosMenolakRincian((prev) =>
        prev ? `${prev}, ${data.namaWarga} (${data.alamat})` : `${data.namaWarga} (${data.alamat})`
      );
    } else if (data.keterangan === 'Tidak Ditempat') {
      setPerlinsosTidakDiTempatKk((prev) => {
        const cur = parseInt(prev, 10) || 0;
        return String(cur + 1);
      });
      setPerlinsosTidakDiTempatRincian((prev) =>
        prev ? `${prev}, ${data.namaWarga} (${data.alamat})` : `${data.namaWarga} (${data.alamat})`
      );
    }

    // Jika ada foto hasil kamera dari form kunjungan, otomatis masukkan ke list foto perlinsos
    if (data.fotoDokumentasi) {
      const newFoto: FotoDokumentasi = {
        id: `foto_kunjungan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: `[PERLINSOS] Kunjungan ${data.namaWarga}`,
        url: data.fotoDokumentasi,
        kategori: 'perlinsos',
        timestamp: new Date().toLocaleTimeString('id-ID'),
      };
      setFotoList((prev) => [newFoto, ...prev]);
    }
  };

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
      const lkTxt = getNomorLkText(acc.lingkungan, acc.jabatan);
      setInfrastrukturLokasi(formatLokasiInfrastruktur(infrastrukturNamaJalan, lkTxt));
    }
  }, [preselectedKepling, activeAccount]);

  // Save profile when changed
  const savePersistentProfile = () => {
    try {
      safeSetLocalStorage(
        STORAGE_KEY_PROFILE,
        JSON.stringify({ namaKepling, jabatan, kelurahan, kecamatan })
      );
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  };

  // Sync Absensi Apel Pagi for selected Kepling & date
  useEffect(() => {
    const checkApel = async () => {
      try {
        const list = attendanceList && attendanceList.length > 0 ? attendanceList : await loadAllAttendance();
        const targetDate = rawDate || getTodayLocalIso(new Date());
        const matched = list.find(
          (a) =>
            (a.accountId === selectedAccountId ||
              a.namaKepling.toLowerCase() === namaKepling.toLowerCase() ||
              a.lingkungan.toLowerCase() === jabatan.toLowerCase()) &&
            a.tanggal === targetDate
        );
        setTodayApel(matched || null);
      } catch (e) {
        console.warn('Failed to load today apel for form:', e);
      }
    };
    checkApel();
  }, [selectedAccountId, rawDate, namaKepling, jabatan, attendanceList]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRawDate(val);
    if (val) {
      const selected = new Date(val + 'T00:00:00');
      const tglStr = formatTanggalIndonesia(selected);
      setHari(getNamaHariIndonesia(selected));
      setTanggalText(tglStr);
      setInfrastrukturTanggalPelaporan(tglStr);
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
          // Dimensi 720px memberikan ketajaman tinggi untuk SPPT PBB & perlinsos, sekaligus ukuran file sangat efisien (~40KB per foto)
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
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            // Kualitas 0.42 menghasilkan foto jernih, tajam, dan ukuran super ringan tanpa resiko kuota Firestore / Vercel
            resolve(canvas.toDataURL('image/jpeg', 0.42));
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
    kategori: 'pbb' | 'perlinsos' | 'ikd' | 'bpjs' | 'poskamling' | 'posyandu' | 'lainnya' | 'infrastruktur' | 'umum' = 'umum'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray: File[] = Array.from(files);
    e.target.value = '';

    // Parallel compress all uploaded files for maximum speed
    const compressedResults = await Promise.all(
      fileArray.map(async (file, i) => {
        const compressedUrl = await compressFile(file);
        if (!compressedUrl) return null;

        let categoryPrefix = '';
        if (kategori === 'pbb') categoryPrefix = '[PBB] ';
        else if (kategori === 'perlinsos') categoryPrefix = '[PERLINSOS] ';
        else if (kategori === 'ikd') categoryPrefix = '[IKD] ';
        else if (kategori === 'bpjs') categoryPrefix = '[BPJS] ';
        else if (kategori === 'poskamling') categoryPrefix = '[POSKAMLING] ';
        else if (kategori === 'posyandu') categoryPrefix = '[POSYANDU] ';
        else if (kategori === 'lainnya') categoryPrefix = '[KEGIATAN LAINNYA] ';
        else if (kategori === 'infrastruktur') categoryPrefix = '[INFRASTRUKTUR] ';

        return {
          id: 'foto_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) + '_' + i,
          url: compressedUrl,
          name: categoryPrefix ? `${categoryPrefix}${file.name || 'Foto Dokumentasi'}` : file.name || `Foto ${i + 1}`,
          timestamp: new Date().toISOString(),
          kategori,
        };
      })
    );

    const validPhotos = compressedResults.filter((p): p is NonNullable<typeof p> => p !== null);
    if (validPhotos.length > 0) {
      setFotoList((prev) => [...prev, ...validPhotos]);
    }
  };

  const removePhoto = (id: string) => {
    setFotoList((prev) => prev.filter((p) => p.id !== id));
  };

  const changePhotoCategory = (id: string, newKategori: string) => {
    setFotoList((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const cleanName = f.name.replace(/^\[(PBB|PERLINSOS|IKD|BPJS|POSKAMLING|KEGIATAN LAINNYA|UMUM)\]\s*/i, '');
        let prefix = '';
        if (newKategori === 'pbb') prefix = '[PBB] ';
        else if (newKategori === 'perlinsos') prefix = '[PERLINSOS] ';
        else if (newKategori === 'ikd') prefix = '[IKD] ';
        else if (newKategori === 'bpjs') prefix = '[BPJS] ';
        else if (newKategori === 'poskamling') prefix = '[POSKAMLING] ';
        else if (newKategori === 'lainnya') prefix = '[KEGIATAN LAINNYA] ';

        return {
          ...f,
          kategori: newKategori as any,
          name: prefix ? `${prefix}${cleanName}` : cleanName,
        };
      })
    );
  };

  // Helper untuk mengubah foto umum menjadi PBB atau Perlinsos
  const tagUncategorizedPhotos = (targetKat: 'pbb' | 'perlinsos', count: number) => {
    let tagged = 0;
    setFotoList((prev) =>
      prev.map((f) => {
        const isUncat =
          f.kategori === 'umum' ||
          (!f.kategori && !f.name.includes('[PBB]') && !f.name.includes('[PERLINSOS]'));
        if (isUncat && tagged < count) {
          tagged++;
          const cleanName = f.name.replace(/^\[(UMUM)\]\s*/i, '');
          const prefix = targetKat === 'pbb' ? '[PBB] ' : '[PERLINSOS] ';
          return {
            ...f,
            kategori: targetKat,
            name: `${prefix}${cleanName}`,
          };
        }
        return f;
      })
    );
  };

  // Perhitungan Validasi Foto vs Angka Input WP dan KK
  const pbbWpNumber = Math.max(0, parseInt(opsirPbbWp, 10) || 0);
  const perlinsosKkNumber = Math.max(0, parseInt(perlinsosKk, 10) || 0);

  const pbbPhotos = fotoList.filter(
    (f) =>
      f.kategori === 'pbb' ||
      String(f.name || '').toUpperCase().includes('[PBB]') ||
      String(f.name || '').toLowerCase().includes('pbb')
  );
  const pbbPhotosCount = pbbPhotos.length;

  const perlinsosPhotos = fotoList.filter(
    (f) =>
      f.kategori === 'perlinsos' ||
      String(f.name || '').toUpperCase().includes('[PERLINSOS]') ||
      String(f.name || '').toLowerCase().includes('perlinsos')
  );
  const perlinsosPhotosCount = perlinsosPhotos.length;

  const uncategorizedPhotos = fotoList.filter(
    (f) =>
      f.kategori === 'umum' ||
      (!f.kategori && !String(f.name || '').includes('[PBB]') && !String(f.name || '').includes('[PERLINSOS]'))
  );

  const lainnyaPhotos = fotoList.filter(
    (f) =>
      f.kategori === 'lainnya' ||
      String(f.name || '').toUpperCase().includes('[KEGIATAN LAINNYA]') ||
      f.kategori === 'kebersihan'
  );
  const lainnyaPhotosCount = lainnyaPhotos.length;

  const pbbDeficit = pbbWpNumber > pbbPhotosCount ? pbbWpNumber - pbbPhotosCount : 0;
  const perlinsosDeficit = perlinsosKkNumber > perlinsosPhotosCount ? perlinsosKkNumber - perlinsosPhotosCount : 0;
  const lainnyaDeficit = selectedLainnyaOptions.length > lainnyaPhotosCount ? selectedLainnyaOptions.length - lainnyaPhotosCount : 0;
  const hasPhotoDeficit = pbbDeficit > 0 || perlinsosDeficit > 0 || lainnyaDeficit > 0;

  const constructReportItem = (): LaporanHarianItem => {
    const kinerja: KinerjaHarian = {
      opsirPbbWp: opsirPbbWp.trim() || '0',
      opsirPbbKeterangan: opsirPbbKeterangan.trim(),
      perlinsosKk: perlinsosKk.trim() || '0',
      perlinsosKeterangan: perlinsosKeterangan.trim(),
      perlinsosKategoriKegiatan: perlinsosKategoriKegiatan.trim(),
      perlinsosMenolakKk: perlinsosMenolakKk.trim() || '0',
      perlinsosMenolakRincian: perlinsosMenolakRincian.trim(),
      perlinsosTidakDiTempatKk: perlinsosTidakDiTempatKk.trim() || '0',
      perlinsosTidakDiTempatRincian: perlinsosTidakDiTempatRincian.trim(),
      ikdOrang: ikdOrang.trim() || '0',
      ikdKeterangan: ikdKeterangan.trim(),
      bpjsKetenagakerjaanOrang: bpjsKetenagakerjaanOrang.trim() || '0',
      bpjsKetenagakerjaanKeterangan: bpjsKetenagakerjaanKeterangan.trim(),
      // Tugas Tambahan POSKAMLING
      poskamlingAdaGiat,
      poskamlingStatus: poskamlingAdaGiat ? poskamlingStatus.trim() : 'Tidak Ada Giat',
      poskamlingLokasi: poskamlingAdaGiat ? poskamlingLokasi.trim() : '',
      poskamlingPetugas: poskamlingAdaGiat ? poskamlingPetugas.trim() : '',
      poskamlingJumlahPetugas: poskamlingAdaGiat ? poskamlingJumlahPetugas.trim() : '',
      poskamlingJamOperasional: poskamlingAdaGiat ? poskamlingJamOperasional.trim() : '',
      poskamlingKeterangan: poskamlingAdaGiat ? poskamlingKeterangan.trim() : '',

      // Tugas Tambahan POSYANDU & LAYANAN KESEHATAN WARGA
      posyanduAdaGiat,
      posyanduNama: posyanduAdaGiat ? posyanduNama.trim() : '',
      posyanduLokasi: posyanduAdaGiat ? posyanduLokasi.trim() : '',
      posyanduJumlahPetugasKader: posyanduAdaGiat ? posyanduJumlahPetugasKader.trim() : '',
      posyanduJumlahWargaTotal: posyanduAdaGiat ? String(posyanduKumulatifTotal) : '0',
      posyanduBayi02Tahun: posyanduAdaGiat ? posyanduBayi02Tahun.trim() || '0' : '0',
      posyanduBalita25Tahun: posyanduAdaGiat ? posyanduBalita25Tahun.trim() || '0' : '0',
      posyanduAnak612Tahun: posyanduAdaGiat ? posyanduAnak612Tahun.trim() || '0' : '0',
      posyanduRemaja1318Tahun: posyanduAdaGiat ? posyanduRemaja1318Tahun.trim() || '0' : '0',
      posyanduDewasaIbuHamil1959Tahun: posyanduAdaGiat ? posyanduDewasaIbuHamil1959Tahun.trim() || '0' : '0',
      posyanduLansia60TahunKeatas: posyanduAdaGiat ? posyanduLansia60TahunKeatas.trim() || '0' : '0',
      posyanduJenisLayanan: posyanduAdaGiat ? posyanduJenisLayanan : [],
      posyanduKeterangan: posyanduAdaGiat ? posyanduKeterangan.trim() : '',

      kegiatanLainnya: kegiatanLainnya.trim(),
      // Poin 6: Kegiatan Pemantauan Kondisi Infrastruktur Wilayah
      infrastrukturAdaGiat,
      infrastrukturSubjek: infrastrukturAdaGiat ? infrastrukturSubjek.trim() : '',
      infrastrukturLokasi: infrastrukturAdaGiat ? infrastrukturLokasi.trim() : '',
      infrastrukturTitikKoordinat: infrastrukturAdaGiat ? infrastrukturTitikKoordinat.trim() : '',
      infrastrukturTanggalPelaporan: infrastrukturAdaGiat ? (infrastrukturTanggalPelaporan.trim() || tanggalText) : '',
      infrastrukturPelapor: infrastrukturAdaGiat ? namaKepling.trim() : '',
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
      absenApel: todayApel
        ? {
            status: todayApel.status,
            jam: todayApel.jam,
            waktuLengkap: todayApel.waktuLengkap,
            fotoSelfieUrl: todayApel.fotoSelfieUrl,
            lokasiGps: todayApel.lokasiGps,
            catatan: todayApel.catatan,
          }
        : (() => {
            const timeStat = checkApelTimeStatus();
            if (timeStat.isLate || !timeStat.isWorkDay) {
              return {
                status: 'Tidak Mengikuti Apel' as const,
                jam: '-',
                lokasiGps: '-',
                catatan: 'Tidak Mengikuti Apel Pagi (Akses Ditutup Lewat 08.30 WIB)',
              };
            }
            return {
              status: 'Hadir' as const,
              jam: '07:35 WIB',
              lokasiGps: 'Halaman Kantor Kelurahan Mangga',
            };
          })(),
      jumlahDokumentasi: fotoList.length,
      dokumentasiFoto: fotoList,
      createdAt: rawDate ? `${rawDate}T12:00:00.000Z` : new Date().toISOString(),
    };
  };

  const doSaveReport = async () => {
    try {
      savePersistentProfile();
      const item = constructReportItem();
      await onSaveReport(item);
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
      setSelectedLainnyaOptions([]);
      setKegiatanLainnyaCustomText('');
      setInfrastrukturAdaGiat(false);
      setInfrastrukturNamaJalan('');
      setInfrastrukturTitikKoordinat('');
      setFotoList([]);
      setShowPhotoValidationModal(false);
    } catch (err) {
      console.error('Submit report error:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLainnyaOptions.includes('Kegiatan Lainnya') && !kegiatanLainnyaCustomText.trim()) {
      alert('⚠️ Jika memilih "Kegiatan Lainnya", Anda wajib mengisi keterangan rincian tentang Kegiatan Lainnya tersebut!');
      return;
    }
    if (hasPhotoDeficit) {
      setShowPhotoValidationModal(true);
      return;
    }
    await doSaveReport();
  };

  const handleCopyPreview = async () => {
    const report = constructReportItem();
    const text = formatReportToText(report);

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
      await onSaveReport(report);
    } catch (saveErr) {
      console.error('Auto-save on copy error:', saveErr);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {onBackToRangkuman && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-3xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToRangkuman}
              className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <span>← Kembali ke Rangkuman Kelurahan (24 Kepling)</span>
            </button>
            <div className="text-xs text-emerald-900 font-bold hidden md:block">
              Mode Asistensi Input Laporan Kepala Lingkungan
            </div>
          </div>
          <div className="text-xs font-semibold text-emerald-800 bg-white px-3 py-1.5 rounded-xl border border-emerald-200">
            Formulir Aktif:{' '}
            <strong>
              {preselectedKepling ? `${preselectedKepling.lingkungan} (${preselectedKepling.nama})` : activeAccount?.nama || 'Petugas'}
            </strong>
          </div>
        </div>
      )}

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

            {/* Presensi Apel Pagi Status Card */}
            {(() => {
              const date = new Date();
              const day = date.getDay();
              if (day === 0 || day === 6) return null;

              const timeStat = checkApelTimeStatus();
              const isPastWindow = timeStat.isLate || !timeStat.isWorkDay;
              const isAbsent = !todayApel && isPastWindow;

              return (
                <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                  isAbsent || todayApel?.status === 'Tidak Mengikuti Apel'
                    ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                    : todayApel
                    ? 'bg-teal-50/90 border-teal-200 text-teal-950'
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">📢</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">Presensi Apel Pagi:</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold uppercase ${
                          isAbsent || todayApel?.status === 'Tidak Mengikuti Apel'
                            ? 'bg-rose-100 text-rose-900 border border-rose-300'
                            : todayApel?.status === 'Hadir'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : todayApel?.status === 'Izin'
                            ? 'bg-blue-100 text-blue-900 border border-blue-300'
                            : todayApel?.status === 'Sakit'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : todayApel?.status === 'Dinas Luar'
                            ? 'bg-purple-100 text-purple-900 border border-purple-300'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        }`}>
                          {isAbsent || todayApel?.status === 'Tidak Mengikuti Apel'
                            ? '✕ TIDAK MENGIKUTI APEL'
                            : todayApel?.status
                            ? `✓ ${String(todayApel.status).toUpperCase()}`
                            : '✓ HADIR'}
                        </span>
                        <span className="text-[11px] text-slate-600 font-medium">
                          {isAbsent
                            ? '(Akses Ditutup Lewat 08.30 WIB)'
                            : todayApel?.jam
                            ? `(${todayApel.jam})`
                            : '(07.35 WIB)'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {isAbsent
                          ? 'Waktu pengisian presensi apel pagi resmi telah berakhir (07.30 - 08.30 WIB)'
                          : todayApel?.lokasiGps
                          ? `Lokasi: ${todayApel.lokasiGps}`
                          : 'Otomatis tercatat & masuk ke Laporan Cetak PDF Resmi'}
                      </p>
                      {(isAbsent || todayApel?.status === 'Tidak Mengikuti Apel') && (
                        <div className="mt-1">
                          {(() => {
                            const absentStat = calculateAbsentDays(
                              attendanceList,
                              selectedAccountId,
                              rawDate,
                              eventList,
                              eventAttendanceList
                            );
                            return (
                              <span className="inline-block px-2.5 py-0.5 rounded-md bg-rose-600 text-white font-black text-[10px] tracking-wide shadow-2xs">
                                {absentStat.consecutiveDays > 0
                                  ? `TIDAK MENGIKUTI APEL PAGI SELAMA ${absentStat.consecutiveDays} HARI`
                                  : 'TIDAK MENGIKUTI APEL PAGI'}
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  {onOpenAbsenApel && (
                    <button
                      type="button"
                      onClick={onOpenAbsenApel}
                      className={`px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-colors shadow-2xs self-start sm:self-auto cursor-pointer ${
                        isAbsent
                          ? 'bg-rose-700 hover:bg-rose-800'
                          : 'bg-teal-700 hover:bg-teal-800'
                      }`}
                    >
                      {isAbsent
                        ? 'Lihat Status Presensi'
                        : todayApel
                        ? 'Lihat / Ubah Presensi'
                        : 'Isi Absen Apel'}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Information Banner: Kumulatif Harian */}
            <div className="bg-blue-50/80 p-5 rounded-2xl border border-blue-200 flex items-start gap-4 text-blue-900 shadow-sm">
              <span className="text-3xl shrink-0">📊</span>
              <div>
                <span className="font-black block text-blue-950 text-base mb-1">
                  Laporan Pelaksanaan Kegiatan Harian (Full-Day)
                </span>
                <p className="text-sm leading-relaxed text-blue-900">
                  Sistem ini mencatat seluruh aktivitas Anda selama <strong>1 hari penuh</strong>. Anda dapat melakukan pengisian data secara bertahap di jam yang berbeda dalam hari yang sama. Sistem secara otomatis mengonsolidasikan seluruh angka kinerja, catatan, dan dokumentasi foto ke dalam <strong>1 Laporan Akhir yang utuh untuk hari ini</strong>.
                </p>
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
              <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  <span>Foto Opsir PBB:</span>
                  <span className="font-bold text-blue-700">
                    {fotoList.filter(f => f.kategori === 'pbb' || f.name.includes('[PBB]')).length} Foto
                  </span>
                </div>
                <div>
                  <input
                    id="file-input-pbb"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'pbb')}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-input-pbb"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    <Camera className="w-3 h-3" />
                    <span>+ Unggah Foto PBB</span>
                  </label>
                </div>
              </div>

              {/* Peringatan & Notifikasi Kesesuaian Foto PBB */}
              {pbbWpNumber > 0 && (
                <div
                  className={`mt-2.5 p-2.5 rounded-lg border text-xs transition-all ${
                    pbbDeficit > 0
                      ? 'bg-amber-50/95 border-amber-300 text-amber-950 shadow-2xs'
                      : 'bg-emerald-50/95 border-emerald-300 text-emerald-950 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {pbbDeficit > 0 ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="font-bold">
                          {pbbDeficit > 0
                            ? '⚠️ Peringatan: Foto PBB Belum Sesuai Jumlah WP'
                            : '✅ Jumlah Foto PBB Sudah Sesuai'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            pbbDeficit > 0
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-emerald-200 text-emerald-900'
                          }`}
                        >
                          {pbbPhotosCount} / {pbbWpNumber} Foto ({pbbDeficit > 0 ? `Kurang ${pbbDeficit} Foto` : 'Lengkap'})
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        {pbbDeficit > 0 ? (
                          <>
                            Anda menginput <strong>{pbbWpNumber} WP</strong>. Jumlah foto dokumentasi yang dilampirkan <strong>harus sesuai jumlah angka yang diinput ({pbbWpNumber} Foto)</strong>. Saat ini baru terunggah <strong>{pbbPhotosCount} foto</strong> (masih kurang <strong>{pbbDeficit} foto</strong>).
                          </>
                        ) : (
                          <>
                            Dokumentasi foto PBB telah sesuai dengan jumlah <strong>{pbbWpNumber} WP</strong> yang diinput (<strong>{pbbPhotosCount} foto</strong> terlampir).
                          </>
                        )}
                      </p>
                      {pbbDeficit > 0 && (
                        <div className="pt-1 flex items-center gap-2 flex-wrap">
                          <label
                            htmlFor="file-input-pbb"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[10px] font-bold cursor-pointer transition-colors active:scale-95"
                          >
                            <Camera className="w-3 h-3" />
                            <span>+ Ambil / Unggah {pbbDeficit} Foto PBB Lagi</span>
                          </label>
                          {uncategorizedPhotos.length > 0 && (
                            <button
                              type="button"
                              onClick={() => tagUncategorizedPhotos('pbb', pbbDeficit)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                              title="Gunakan foto umum yang sudah diunggah sebagai foto PBB"
                            >
                              <span>🔄 Tandai {Math.min(uncategorizedPhotos.length, pbbDeficit)} Foto Umum sbg PBB</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                    placeholder="Keterangan kegiatan Perlinsos"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
                  />
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <Camera className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Foto Perlinsos:</span>
                  <span className="font-bold text-emerald-700">
                    {fotoList.filter(f => f.kategori === 'perlinsos' || f.name.includes('[PERLINSOS]')).length} Foto
                  </span>
                </div>
                <div>
                  <input
                    id="file-input-perlinsos"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'perlinsos')}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-input-perlinsos"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    <Camera className="w-3 h-3" />
                    <span>+ Unggah Foto Perlinsos</span>
                  </label>
                </div>
              </div>

              {/* Peringatan & Notifikasi Kesesuaian Foto Perlinsos */}
              {perlinsosKkNumber > 0 && (
                <div
                  className={`mt-2 p-2.5 rounded-lg border text-xs transition-all ${
                    perlinsosDeficit > 0
                      ? 'bg-amber-50/95 border-amber-300 text-amber-950'
                      : 'bg-emerald-50/95 border-emerald-300 text-emerald-950'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {perlinsosDeficit > 0 ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="font-bold">
                          {perlinsosDeficit > 0
                            ? '⚠️ Peringatan: Foto Perlinsos Belum Sesuai Jumlah KK'
                            : '✅ Jumlah Foto Perlinsos Sudah Sesuai'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            perlinsosDeficit > 0
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-emerald-200 text-emerald-900'
                          }`}
                        >
                          {perlinsosPhotosCount} / {perlinsosKkNumber} Foto ({perlinsosDeficit > 0 ? `Kurang ${perlinsosDeficit} Foto` : 'Lengkap'})
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        {perlinsosDeficit > 0 ? (
                          <>
                            Anda menginput <strong>{perlinsosKkNumber} KK</strong>. Jumlah foto dokumentasi yang dilampirkan <strong>harus sesuai jumlah angka yang diinput ({perlinsosKkNumber} Foto)</strong>. Saat ini baru terunggah <strong>{perlinsosPhotosCount} foto</strong> (masih kurang <strong>{perlinsosDeficit} foto</strong>).
                          </>
                        ) : (
                          <>
                            Dokumentasi foto Perlinsos telah sesuai dengan jumlah <strong>{perlinsosKkNumber} KK</strong> yang diinput (<strong>{perlinsosPhotosCount} foto</strong> terlampir).
                          </>
                        )}
                      </p>
                      {perlinsosDeficit > 0 && (
                        <div className="pt-1 flex items-center gap-2 flex-wrap">
                          <label
                            htmlFor="file-input-perlinsos"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[10px] font-bold cursor-pointer transition-colors active:scale-95"
                          >
                            <Camera className="w-3 h-3" />
                            <span>+ Ambil / Unggah {perlinsosDeficit} Foto Perlinsos Lagi</span>
                          </label>
                          {uncategorizedPhotos.length > 0 && (
                            <button
                              type="button"
                              onClick={() => tagUncategorizedPhotos('perlinsos', perlinsosDeficit)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                              title="Gunakan foto umum yang sudah diunggah sebagai foto Perlinsos"
                            >
                              <span>🔄 Tandai {Math.min(uncategorizedPhotos.length, perlinsosDeficit)} Foto Umum sbg Perlinsos</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
              <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <Camera className="w-3.5 h-3.5 text-purple-600" />
                  <span>Foto IKD Dukcapil:</span>
                  <span className="font-bold text-purple-700">
                    {fotoList.filter(f => f.kategori === 'ikd' || f.name.includes('[IKD]')).length} Foto
                  </span>
                </div>
                <div>
                  <input
                    id="file-input-ikd"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'ikd')}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-input-ikd"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    <Camera className="w-3 h-3" />
                    <span>+ Unggah Foto IKD</span>
                  </label>
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
              <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <Camera className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Foto BPJS Pekerja Rentan:</span>
                  <span className="font-bold text-indigo-700">
                    {fotoList.filter(f => f.kategori === 'bpjs' || f.name.includes('[BPJS]')).length} Foto
                  </span>
                </div>
                <div>
                  <input
                    id="file-input-bpjs"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'bpjs')}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-input-bpjs"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    <Camera className="w-3 h-3" />
                    <span>+ Unggah Foto BPJS</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Pilar 5: KEGIATAN LAINNYA */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-black">
                    5
                  </span>
                  KEGIATAN LAINNYA
                </span>
                <span className="text-[11px] font-semibold text-slate-500">Pilihan Cepat & Keterangan</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Pilih satu atau beberapa kegiatan di bawah ini. Unggah minimal 1 foto untuk setiap kegiatan yang dipilih.
              </p>

              {/* Grid of Option Pills */}
              <div className="flex flex-wrap gap-2">
                {LAINNYA_OPTIONS_PRESET.map((opt) => {
                  const isSelected = selectedLainnyaOptions.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setSelectedLainnyaOptions((prev) =>
                          prev.includes(opt)
                            ? prev.filter((o) => o !== opt)
                            : [...prev, opt]
                        );
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer select-none active:scale-95 ${
                        isSelected
                          ? 'bg-teal-600 border-teal-600 text-white shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      )}
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Conditional Custom Text Area */}
              {selectedLainnyaOptions.includes('Kegiatan Lainnya') && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <label className="block text-[11px] font-bold text-teal-900 uppercase">
                    Rincian Keterangan Kegiatan Lainnya <span className="text-red-600">*Wajib Diisi</span>
                  </label>
                  <textarea
                    id="input-kegiatan-lainnya-custom"
                    rows={3}
                    value={kegiatanLainnyaCustomText}
                    onChange={(e) => setKegiatanLainnyaCustomText(e.target.value)}
                    placeholder="Tuliskan keterangan detail tentang kegiatan lainnya yang dimaksud di sini..."
                    className={`w-full p-2.5 text-xs border rounded-xl bg-white text-slate-800 placeholder:text-slate-400 focus:outline-teal-600 font-medium ${
                      !kegiatanLainnyaCustomText.trim()
                        ? 'border-rose-300 bg-rose-50/20'
                        : 'border-slate-300'
                    }`}
                  />
                  {!kegiatanLainnyaCustomText.trim() && (
                    <p className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Wajib menuliskan keterangan jika Anda mencentang pilihan "Kegiatan Lainnya"!
                    </p>
                  )}
                </div>
              )}

              {/* Upload Foto Kegiatan Lainnya */}
              <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <Camera className="w-3.5 h-3.5 text-teal-600" />
                  <span>Foto Kegiatan Lainnya:</span>
                  <span className="font-bold text-teal-700">
                    {lainnyaPhotosCount} Foto
                  </span>
                </div>
                <div>
                  <input
                    id="file-input-lainnya"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'lainnya')}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-input-lainnya"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>+ Unggah Foto Kegiatan Lainnya</span>
                  </label>
                </div>
              </div>

              {/* Real-time comparison indicator */}
              {selectedLainnyaOptions.length > 0 && (
                <div
                  className={`mt-2 p-2.5 rounded-lg border text-xs transition-all ${
                    lainnyaDeficit > 0
                      ? 'bg-amber-50/95 border-amber-300 text-amber-950'
                      : 'bg-teal-50/95 border-teal-300 text-teal-950'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {lainnyaDeficit > 0 ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="font-bold">
                          {lainnyaDeficit > 0
                            ? '⚠️ Peringatan: Jumlah Foto Belum Sesuai Kegiatan'
                            : '✅ Jumlah Foto Kegiatan Lainnya Sudah Sesuai'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            lainnyaDeficit > 0
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-teal-200 text-teal-900'
                          }`}
                        >
                          {lainnyaPhotosCount} / {selectedLainnyaOptions.length} Foto ({lainnyaDeficit > 0 ? `Kurang ${lainnyaDeficit} Foto` : 'Lengkap'})
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        {lainnyaDeficit > 0 ? (
                          <>
                            Anda memilih <strong>{selectedLainnyaOptions.length} kegiatan</strong>. Jumlah foto yang dilampirkan <strong>harus disesuaikan (minimal {selectedLainnyaOptions.length} Foto)</strong>. Saat ini baru terunggah <strong>{lainnyaPhotosCount} foto</strong> (masih kurang <strong>{lainnyaDeficit} foto</strong>).
                          </>
                        ) : (
                          <>
                            Dokumentasi foto kegiatan lainnya telah sesuai dengan jumlah <strong>{selectedLainnyaOptions.length} kegiatan</strong> yang dipilih (<strong>{lainnyaPhotosCount} foto</strong> terlampir).
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pilar 6: KEGIATAN PEMANTAUAN KONDISI INFRASTRUKTUR WILAYAH */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-black">
                    6
                  </span>
                  KEGIATAN PEMANTAUAN KONDISI INFRASTRUKTUR WILAYAH
                </span>
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={infrastrukturAdaGiat}
                    onChange={(e) => setInfrastrukturAdaGiat(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                  />
                  <span>Ada Giat Pemantauan</span>
                </label>
              </div>

              {infrastrukturAdaGiat ? (
                <div className="space-y-3 pt-1">
                  {/* 1. SUBJEK */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 uppercase">
                        1. Subjek :
                      </label>
                      <span className="text-[10px] text-slate-500">Pilih topik atau ketik langsung</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {[
                        'Jalan Berlubang / Rusak',
                        'Drainase / Parit Tersumbat',
                        'Lampu LPJU Rusak / Mati',
                        'Pohon Tumbang / Rawan Tumbang',
                        'Tumpukan Sampah Liar',
                        'Tutup Drainase / Manhole Hilang',
                      ].map((subjekPreset) => (
                        <button
                          key={subjekPreset}
                          type="button"
                          onClick={() => setInfrastrukturSubjek(subjekPreset)}
                          className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold transition-all cursor-pointer ${
                            infrastrukturSubjek === subjekPreset
                              ? 'bg-emerald-700 border-emerald-700 text-white shadow-2xs'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {subjekPreset}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={infrastrukturSubjek}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setInfrastrukturSubjek(e.target.value)}
                      placeholder="Contoh: Jalan Berlubang / Rusak, Drainase Tersumbat"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 font-semibold focus:outline-emerald-600"
                    />
                  </div>

                  {/* 2. LOKASI */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 uppercase">
                        2. Lokasi :
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Format: ( Jalan... Lk.. Kelurahan Mangga Kecamatan Medan Tuntungan )
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={infrastrukturNamaJalan}
                        onClick={() => {
                          if (
                            !infrastrukturNamaJalan ||
                            infrastrukturNamaJalan.toLowerCase().includes('jamin ginting') ||
                            infrastrukturNamaJalan.toLowerCase().includes('bunga rinte')
                          ) {
                            setInfrastrukturNamaJalan('');
                            const lkTxt = getNomorLkText(
                              preselectedKepling?.lingkungan || activeAccount?.lingkungan,
                              preselectedKepling?.jabatan || activeAccount?.jabatan
                            );
                            setInfrastrukturLokasi(formatLokasiInfrastruktur('', lkTxt));
                          }
                        }}
                        onFocus={(e) => {
                          if (
                            infrastrukturNamaJalan.toLowerCase().includes('jamin ginting') ||
                            infrastrukturNamaJalan.toLowerCase().includes('bunga rinte')
                          ) {
                            setInfrastrukturNamaJalan('');
                            const lkTxt = getNomorLkText(
                              preselectedKepling?.lingkungan || activeAccount?.lingkungan,
                              preselectedKepling?.jabatan || activeAccount?.jabatan
                            );
                            setInfrastrukturLokasi(formatLokasiInfrastruktur('', lkTxt));
                          } else {
                            e.target.select();
                          }
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInfrastrukturNamaJalan(val);
                          const lkTxt = getNomorLkText(
                            preselectedKepling?.lingkungan || activeAccount?.lingkungan,
                            preselectedKepling?.jabatan || activeAccount?.jabatan
                          );
                          setInfrastrukturLokasi(formatLokasiInfrastruktur(val, lkTxt));
                        }}
                        placeholder="Nama Jalan ( cth. Jl. Jamin Ginting )"
                        className="w-full pl-3 pr-9 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-emerald-600 font-medium shadow-sm"
                      />
                      {infrastrukturNamaJalan && (
                        <button
                          type="button"
                          onClick={() => {
                            setInfrastrukturNamaJalan('');
                            const lkTxt = getNomorLkText(
                              preselectedKepling?.lingkungan || activeAccount?.lingkungan,
                              preselectedKepling?.jabatan || activeAccount?.jabatan
                            );
                            setInfrastrukturLokasi(formatLokasiInfrastruktur('', lkTxt));
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 cursor-pointer"
                          title="Kosongkan nama jalan"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {infrastrukturNamaJalan.trim() && (
                      <p className="text-[11px] text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded border border-emerald-200 font-medium">
                        Hasil format : <span className="font-semibold">{infrastrukturLokasi}</span>
                      </p>
                    )}
                  </div>

                  {/* 3. TITIK KOORDINAT */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 uppercase">
                        3. Titik Koordinat :
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium">Link Google Maps</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={infrastrukturTitikKoordinat}
                          onChange={(e) => setInfrastrukturTitikKoordinat(e.target.value)}
                          placeholder="https://maps.google.com/?q=3.512345,98.612345"
                          className="w-full pl-3 pr-8 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-emerald-600 font-mono"
                        />
                        {infrastrukturTitikKoordinat && (
                          <a
                            href={infrastrukturTitikKoordinat}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-700 hover:text-emerald-900"
                            title="Buka titik koordinat di Google Maps"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleGetGpsCoordinates}
                        disabled={isDetectingGps}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        <MapPin className={`w-3.5 h-3.5 ${isDetectingGps ? 'animate-bounce' : ''}`} />
                        <span>{isDetectingGps ? 'Mencari...' : 'Ambil Titik GPS'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 4. TANGGAL PELAPORAN & 5. PELAPOR */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 uppercase block">
                        4. Tanggal Pelaporan :
                      </label>
                      <input
                        type="text"
                        value={infrastrukturTanggalPelaporan}
                        onChange={(e) => setInfrastrukturTanggalPelaporan(e.target.value)}
                        placeholder="Contoh: 18 September 2026"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 font-medium focus:outline-emerald-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700 uppercase block">
                          5. Pelapor :
                        </label>
                        <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-100/70 px-1.5 py-0.5 rounded">
                          Otomatis Nama Kepling
                        </span>
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={namaKepling || activeAccount?.nama || 'Kepling'}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-100 text-slate-700 font-bold cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Upload Foto Dokumentasi Infrastruktur */}
                  <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <Camera className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Foto Infrastruktur:</span>
                      <span className="font-bold text-emerald-700">
                        {fotoList.filter((f) => f.kategori === 'infrastruktur' || f.name.includes('[INFRASTRUKTUR]')).length} Foto
                      </span>
                    </div>
                    <div>
                      <input
                        id="file-input-infrastruktur"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'infrastruktur')}
                        className="hidden"
                      />
                      <label
                        htmlFor="file-input-infrastruktur"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
                      >
                        <Camera className="w-3 h-3" />
                        <span>+ Unggah Foto Infrastruktur</span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Pemantauan kondisi infrastruktur wilayah dinonaktifkan untuk laporan hari ini.
                </p>
              )}
            </div>
          </div>

          {/* Section: Tugas Tambahan POSKAMLING & POSYANDU */}
          <div className="bg-white border-2 border-amber-300/80 rounded-xl p-6 shadow-sm space-y-5 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-amber-100 gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-6 bg-amber-500 rounded-full"></span>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-600" />
                  <h2 className="text-base font-bold uppercase tracking-wider text-slate-800">
                    Tugas Tambahan: POSKAMLING & POSYANDU
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs font-bold text-amber-900 cursor-pointer select-none bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                  <input
                    type="checkbox"
                    checked={poskamlingAdaGiat}
                    onChange={(e) => setPoskamlingAdaGiat(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>🛡️ Ada Poskamling</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold text-rose-900 cursor-pointer select-none bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                  <input
                    type="checkbox"
                    checked={posyanduAdaGiat}
                    onChange={(e) => setPosyanduAdaGiat(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span>👶🩺 Ada Posyandu</span>
                </label>
              </div>
            </div>

            {/* A. SUB-SECTION: POSKAMLING / SISKAMLING */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-black">
                    A
                  </span>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    POSKAMLING / SISKAMLING
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${poskamlingAdaGiat ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-600'}`}>
                  {poskamlingAdaGiat ? 'AKTIF BERJALAN' : 'NON-AKTIF'}
                </span>
              </div>

              {poskamlingAdaGiat ? (
                <div className="space-y-3">
                  {/* Status preset buttons */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
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
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                            poskamlingStatus === preset
                              ? 'bg-amber-500 text-slate-950 shadow-2xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grid Status & Lokasi */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Status Poskamling
                      </label>
                      <input
                        id="input-poskamling-status"
                        type="text"
                        value={poskamlingStatus}
                        onChange={(e) => setPoskamlingStatus(e.target.value)}
                        placeholder="Contoh: Aktif Ronda Malam"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 font-semibold focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Lokasi Poskamling / Pos Ronda
                      </label>
                      <input
                        id="input-poskamling-lokasi"
                        type="text"
                        value={poskamlingLokasi}
                        onChange={(e) => setPoskamlingLokasi(e.target.value)}
                        placeholder="Contoh: Pos Ronda Lingkungan IV"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Jumlah Petugas & Jam Operasional (Sesuai Permintaan User) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 bg-white rounded-lg border border-amber-200/80">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-950 mb-1">
                        👥 Jumlah Petugas / Warga Ronda:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          id="input-poskamling-jumlah-petugas"
                          type="text"
                          value={poskamlingJumlahPetugas}
                          onChange={(e) => setPoskamlingJumlahPetugas(e.target.value)}
                          placeholder="Contoh: 4 Orang"
                          className="w-full px-2.5 py-1.5 text-xs border border-amber-300 rounded-lg bg-white text-slate-800 font-bold focus:ring-1 focus:ring-amber-500"
                        />
                        {['3', '4', '5', '6'].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setPoskamlingJumlahPetugas(`${n} Orang`)}
                            className="px-2 py-1 text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded border border-amber-300 cursor-pointer"
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-amber-950 mb-1">
                        ⏰ Jam Operasional Ronda:
                      </label>
                      <input
                        id="input-poskamling-jam-operasional"
                        type="text"
                        value={poskamlingJamOperasional}
                        onChange={(e) => setPoskamlingJamOperasional(e.target.value)}
                        placeholder="Contoh: 21.00 - 04.00 WIB"
                        className="w-full px-2.5 py-1.5 text-xs border border-amber-300 rounded-lg bg-white text-slate-800 font-semibold focus:ring-1 focus:ring-amber-500"
                      />
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {['21.00 - 04.00 WIB', '22.00 - 05.00 WIB', '20.00 - 04.00 WIB', '24 Jam'].map((jam) => (
                          <button
                            key={jam}
                            type="button"
                            onClick={() => setPoskamlingJamOperasional(jam)}
                            className="text-[9px] px-1.5 py-0.5 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 rounded border border-slate-200 cursor-pointer font-medium"
                          >
                            {jam}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Rincian Petugas & Catatan Kamtibmas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Nama / Susunan Petugas Jaga
                      </label>
                      <input
                        id="input-poskamling-petugas"
                        type="text"
                        value={poskamlingPetugas}
                        onChange={(e) => setPoskamlingPetugas(e.target.value)}
                        placeholder="Contoh: Kepling & 3 Warga Ronda"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Catatan Situasi Kamtibmas
                      </label>
                      <input
                        id="input-poskamling-keterangan"
                        type="text"
                        value={poskamlingKeterangan}
                        onChange={(e) => setPoskamlingKeterangan(e.target.value)}
                        placeholder="Contoh: Situasi malam kondusif dan aman"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Tombol Upload Khusus Foto Poskamling */}
                  <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-lg flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-amber-700" />
                      <div>
                        <span className="text-xs font-bold text-amber-950 block">
                          Foto Dokumentasi Poskamling:
                        </span>
                        <span className="text-[10px] text-amber-800">
                          {fotoList.filter((f) => f.kategori === 'poskamling' || f.name.includes('[POSKAMLING]')).length} Foto Terlampir
                        </span>
                      </div>
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
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>+ Upload Foto Poskamling</span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Kegiatan Poskamling tidak dicatat untuk hari ini (opsional).
                </p>
              )}
            </div>

            {/* B. SUB-SECTION: POSYANDU & LAYANAN KESEHATAN WARGA */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-black">
                    B
                  </span>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    POSYANDU & LAYANAN KESEHATAN KELUARGA
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {posyanduAdaGiat && (
                    <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full shadow-2xs animate-pulse">
                      🎯 Total Kumulatif: {posyanduKumulatifTotal} Jiwa
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${posyanduAdaGiat ? 'bg-rose-200 text-rose-900' : 'bg-slate-200 text-slate-600'}`}>
                    {posyanduAdaGiat ? 'AKTIF PELAYANAN' : 'NON-AKTIF'}
                  </span>
                </div>
              </div>

              {posyanduAdaGiat ? (
                <div className="space-y-4 pt-1">
                  {/* Nama, Lokasi, Petugas/Kader Posyandu */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-rose-950 mb-1">
                        Nama Posyandu:
                      </label>
                      <input
                        id="input-posyandu-nama"
                        type="text"
                        value={posyanduNama}
                        onChange={(e) => setPosyanduNama(e.target.value)}
                        placeholder="Contoh: Posyandu Melati Lk IV"
                        className="w-full px-2.5 py-1.5 text-xs border border-rose-200 rounded-lg bg-white text-slate-800 font-semibold focus:ring-1 focus:ring-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-rose-950 mb-1">
                        Lokasi Posyandu:
                      </label>
                      <input
                        id="input-posyandu-lokasi"
                        type="text"
                        value={posyanduLokasi}
                        onChange={(e) => setPosyanduLokasi(e.target.value)}
                        placeholder="Contoh: Balai Warga Jl. Bunga Rinte"
                        className="w-full px-2.5 py-1.5 text-xs border border-rose-200 rounded-lg bg-white text-slate-800 focus:ring-1 focus:ring-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-rose-950 mb-1">
                        Jumlah Petugas / Kader:
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          id="input-posyandu-kader"
                          type="text"
                          value={posyanduJumlahPetugasKader}
                          onChange={(e) => setPosyanduJumlahPetugasKader(e.target.value)}
                          placeholder="Contoh: 5 Kader"
                          className="w-full px-2.5 py-1.5 text-xs border border-rose-200 rounded-lg bg-white text-slate-800 font-bold focus:ring-1 focus:ring-rose-500"
                        />
                        {['4', '5', '6'].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setPosyanduJumlahPetugasKader(`${n} Kader`)}
                            className="px-2 py-1 text-[10px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-900 rounded border border-rose-300 cursor-pointer"
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* RINCIAN WARGA YANG DILAYANI KUMULATIF DARI USIA 0 TAHUN SAMPAI LANSIA */}
                  <div className="p-3.5 bg-white rounded-xl border-2 border-rose-300 space-y-3 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-rose-100">
                      <div>
                        <h4 className="text-xs font-black text-rose-950 flex items-center gap-1.5 uppercase">
                          <span>📊</span>
                          Rincian Kumulatif Warga Terlayani per Kelompok Usia (0 Tahun s.d Lansia)
                        </h4>
                        <p className="text-[10.5px] text-slate-500 font-medium">
                          Isi jumlah warga yang dilayani pada masing-masing kelompok usia, sistem akan mengakumulasikan total secara otomatis.
                        </p>
                      </div>
                      <div className="bg-rose-50 px-3 py-1 rounded-lg border border-rose-300 flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-semibold text-rose-900">Total Terlayani:</span>
                        <span className="text-sm font-black text-rose-700">{posyanduKumulatifTotal} Jiwa</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                      {/* 1. Usia 0 - 2 Tahun */}
                      <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-200 space-y-1">
                        <span className="text-[10px] font-bold text-rose-900 block leading-tight">
                          👶 Usia 0 - 2 Th<br />
                          <span className="text-[9px] font-normal text-slate-600">(Bayi/Baduta & Imunisasi)</span>
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={posyanduBayi02Tahun}
                          onChange={(e) => setPosyanduBayi02Tahun(e.target.value.replace(/^0+(?=\d)/, ''))}
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs border border-rose-300 rounded bg-white font-bold text-rose-900 text-center"
                        />
                      </div>

                      {/* 2. Usia 2 - 5 Tahun */}
                      <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-200 space-y-1">
                        <span className="text-[10px] font-bold text-rose-900 block leading-tight">
                          🧒 Usia 2 - 5 Th<br />
                          <span className="text-[9px] font-normal text-slate-600">(Balita & Pantau Stunting)</span>
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={posyanduBalita25Tahun}
                          onChange={(e) => setPosyanduBalita25Tahun(e.target.value.replace(/^0+(?=\d)/, ''))}
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs border border-rose-300 rounded bg-white font-bold text-rose-900 text-center"
                        />
                      </div>

                      {/* 3. Usia 6 - 12 Tahun */}
                      <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-200 space-y-1">
                        <span className="text-[10px] font-bold text-rose-900 block leading-tight">
                          👦 Usia 6 - 12 Th<br />
                          <span className="text-[9px] font-normal text-slate-600">(Anak Usia Sekolah)</span>
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={posyanduAnak612Tahun}
                          onChange={(e) => setPosyanduAnak612Tahun(e.target.value.replace(/^0+(?=\d)/, ''))}
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs border border-rose-300 rounded bg-white font-bold text-rose-900 text-center"
                        />
                      </div>

                      {/* 4. Usia 13 - 18 Tahun */}
                      <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-200 space-y-1">
                        <span className="text-[10px] font-bold text-rose-900 block leading-tight">
                          🧑 Usia 13 - 18 Th<br />
                          <span className="text-[9px] font-normal text-slate-600">(Remaja & Tablet Fe)</span>
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={posyanduRemaja1318Tahun}
                          onChange={(e) => setPosyanduRemaja1318Tahun(e.target.value.replace(/^0+(?=\d)/, ''))}
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs border border-rose-300 rounded bg-white font-bold text-rose-900 text-center"
                        />
                      </div>

                      {/* 5. Usia 19 - 59 Tahun */}
                      <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-200 space-y-1">
                        <span className="text-[10px] font-bold text-rose-900 block leading-tight">
                          🤰 Usia 19 - 59 Th<br />
                          <span className="text-[9px] font-normal text-slate-600">(Bumil, Busui, Dewasa)</span>
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={posyanduDewasaIbuHamil1959Tahun}
                          onChange={(e) => setPosyanduDewasaIbuHamil1959Tahun(e.target.value.replace(/^0+(?=\d)/, ''))}
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs border border-rose-300 rounded bg-white font-bold text-rose-900 text-center"
                        />
                      </div>

                      {/* 6. Usia 60+ Tahun */}
                      <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-200 space-y-1">
                        <span className="text-[10px] font-bold text-rose-900 block leading-tight">
                          👵 Usia 60+ Th<br />
                          <span className="text-[9px] font-normal text-slate-600">(Lansia & Cek PTM)</span>
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={posyanduLansia60TahunKeatas}
                          onChange={(e) => setPosyanduLansia60TahunKeatas(e.target.value.replace(/^0+(?=\d)/, ''))}
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs border border-rose-300 rounded bg-white font-bold text-rose-900 text-center"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pilihan Checklist Jenis Layanan Posyandu */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-rose-950 uppercase">
                      Pilihan Jenis Layanan yang Diberikan:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Penimbangan & Pengukuran (Pantau Stunting)',
                        'Imunisasi Dasar & Lanjutan Lengkap',
                        'Pemberian Vitamin A & Obat Cacing',
                        'Pemberian Makanan Tambahan (PMT) Balita & Bumil',
                        'Pemeriksaan Ibu Hamil (ANC) & Nifas',
                        'Pemeriksaan Lansia & Skrining PTM (Tensi/Gula)',
                        'Integrasi Layanan Primer (ILP) Siklus Hidup',
                        'Penyuluhan Gizi & Sanitasi Rumah Tangga',
                      ].map((layanan) => {
                        const isChecked = posyanduJenisLayanan.includes(layanan);
                        return (
                          <button
                            key={layanan}
                            type="button"
                            onClick={() => {
                              setPosyanduJenisLayanan((prev) =>
                                isChecked ? prev.filter((l) => l !== layanan) : [...prev, layanan]
                              );
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold border transition-all cursor-pointer flex items-center gap-1 select-none ${
                              isChecked
                                ? 'bg-rose-600 border-rose-600 text-white shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-rose-50'
                            }`}
                          >
                            {isChecked ? <Check className="w-3 h-3 text-white" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                            <span>{layanan}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Catatan / Keterangan Posyandu */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Catatan / Keterangan Hasil Pelayanan Posyandu:
                    </label>
                    <input
                      id="input-posyandu-keterangan"
                      type="text"
                      value={posyanduKeterangan}
                      onChange={(e) => setPosyanduKeterangan(e.target.value)}
                      placeholder="Contoh: Balita terlayani antusias, ditemukan 0 kasus gizi buruk, distribusi PMT lancar"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:ring-1 focus:ring-rose-500"
                    />
                  </div>

                  {/* Tombol Upload Khusus Foto Posyandu */}
                  <div className="p-3 bg-rose-100/70 border border-rose-300 rounded-lg flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-rose-700" />
                      <div>
                        <span className="text-xs font-bold text-rose-950 block">
                          Foto Dokumentasi Kegiatan Posyandu:
                        </span>
                        <span className="text-[10px] text-rose-800">
                          {fotoList.filter((f) => f.kategori === 'posyandu' || f.name.includes('[POSYANDU]')).length} Foto Terlampir
                        </span>
                      </div>
                    </div>
                    <div>
                      <input
                        id="file-input-posyandu"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'posyandu')}
                        className="hidden"
                      />
                      <label
                        htmlFor="file-input-posyandu"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>+ Upload Foto Posyandu</span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Kegiatan Posyandu tidak dicatat untuk laporan hari ini (opsional).
                </p>
              )}
            </div>
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

                    {/* Category Selector Badge */}
                    <div className="absolute top-1 left-1 z-10">
                      <select
                        value={
                          foto.kategori ||
                          (foto.name.includes('[PBB]')
                            ? 'pbb'
                            : foto.name.includes('[PERLINSOS]')
                            ? 'perlinsos'
                            : foto.name.includes('[POSKAMLING]')
                            ? 'poskamling'
                            : foto.name.includes('[POSYANDU]')
                            ? 'posyandu'
                            : foto.name.includes('[IKD]')
                            ? 'ikd'
                            : foto.name.includes('[BPJS]')
                            ? 'bpjs'
                            : 'umum')
                        }
                        onChange={(e) => changePhotoCategory(foto.id, e.target.value)}
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-xs border cursor-pointer focus:outline-none ${
                          foto.kategori === 'pbb' || foto.name.includes('[PBB]')
                            ? 'bg-blue-700 text-white border-blue-400'
                            : foto.kategori === 'perlinsos' || foto.name.includes('[PERLINSOS]')
                            ? 'bg-emerald-700 text-white border-emerald-400'
                            : foto.kategori === 'poskamling' || foto.name.includes('[POSKAMLING]')
                            ? 'bg-amber-500 text-slate-950 border-amber-300'
                            : foto.kategori === 'posyandu' || foto.name.includes('[POSYANDU]')
                            ? 'bg-rose-600 text-white border-rose-400'
                            : 'bg-black/75 text-white border-white/20'
                        }`}
                        title="Klik untuk mengubah kategori foto ini"
                      >
                        <option value="pbb" className="text-slate-900 bg-white">PBB</option>
                        <option value="perlinsos" className="text-slate-900 bg-white">Perlinsos</option>
                        <option value="poskamling" className="text-slate-900 bg-white">Poskamling</option>
                        <option value="posyandu" className="text-slate-900 bg-white">Posyandu</option>
                        <option value="ikd" className="text-slate-900 bg-white">IKD</option>
                        <option value="bpjs" className="text-slate-900 bg-white">BPJS</option>
                        <option value="lainnya" className="text-slate-900 bg-white">Keg. Lain</option>
                        <option value="umum" className="text-slate-900 bg-white">Umum</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => removePhoto(foto.id)}
                      className="absolute top-1 right-1 p-1 bg-red-600/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-700 shadow-sm z-10"
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
                {String(jabatan || 'KEPALA LINGKUNGAN').toUpperCase()}<br />
                {String(kelurahan || 'KELURAHAN MANGGA').toUpperCase()}<br />
                {String(kecamatan || 'KECAMATAN MEDAN TUNTUNGAN').toUpperCase()}
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
                {perlinsosMenolakKk && String(perlinsosMenolakKk) !== '0' && (
                  <p className="text-rose-300 text-[11px] pl-3">
                    ⚠️ Menolak: <span className="font-bold">{perlinsosMenolakKk} KK</span> {perlinsosMenolakRincian && `(${perlinsosMenolakRincian})`}
                  </p>
                )}
                {perlinsosTidakDiTempatKk && String(perlinsosTidakDiTempatKk) !== '0' && (
                  <p className="text-sky-300 text-[11px] pl-3">
                    🏠 Tidak Di Tempat: <span className="font-bold">{perlinsosTidakDiTempatKk} KK</span> {perlinsosTidakDiTempatRincian && `(${perlinsosTidakDiTempatRincian})`}
                  </p>
                )}
                <p>3. IKD       : <span className="text-emerald-300 font-bold">{ikdOrang || 0} ORANG</span> {ikdKeterangan && `(${ikdKeterangan})`}</p>
                <p>4. BPJS TK   : <span className="text-emerald-300 font-bold">{bpjsKetenagakerjaanOrang || 0} ORANG</span> {bpjsKetenagakerjaanKeterangan && `(${bpjsKetenagakerjaanKeterangan})`}</p>
                {kegiatanLainnya && (
                  <p className="text-slate-300 mt-1">5. LAINNYA  : {kegiatanLainnya}</p>
                )}
                {infrastrukturAdaGiat && (
                  <div className="text-emerald-300 mt-1 text-[11px] space-y-0.5">
                    <p className="font-bold">6. PEMANTAUAN INFRASTRUKTUR :</p>
                    <p className="pl-3">- Subjek: {infrastrukturSubjek || '-'}</p>
                    <p className="pl-3">- Lokasi: {infrastrukturLokasi || '-'}</p>
                    {infrastrukturTitikKoordinat && <p className="pl-3 truncate">- Koordinat: {infrastrukturTitikKoordinat}</p>}
                    <p className="pl-3">- Tanggal: {infrastrukturTanggalPelaporan || tanggalText}</p>
                    <p className="pl-3">- Pelapor: {namaKepling || 'Kepling'}</p>
                  </div>
                )}
                {poskamlingAdaGiat && (
                  <p className="text-amber-300 mt-1">
                    7. POSKAMLING: <span className="text-amber-200 font-bold">{poskamlingStatus}</span>
                    {poskamlingLokasi && ` (${poskamlingLokasi})`}
                    {poskamlingJumlahPetugas && ` [Petugas: ${poskamlingJumlahPetugas}]`}
                    {poskamlingJamOperasional && ` [Jam: ${poskamlingJamOperasional}]`}
                    {poskamlingKeterangan && ` - ${poskamlingKeterangan}`}
                  </p>
                )}
                {posyanduAdaGiat && (
                  <div className="text-rose-300 mt-1 space-y-0.5 text-[11px]">
                    <p className="font-bold">
                      8. POSYANDU: <span className="text-rose-200">{posyanduNama || 'Posyandu'}</span>
                      {posyanduLokasi && ` (${posyanduLokasi})`}
                      {posyanduJumlahPetugasKader && ` [Kader: ${posyanduJumlahPetugasKader}]`}
                    </p>
                    <p className="pl-3 text-rose-200 font-bold">
                      🎯 Total Warga Dilayani: {posyanduKumulatifTotal} Jiwa (0 Th s.d Lansia)
                    </p>
                    <p className="pl-3 text-slate-300 text-[10px]">
                      👶 0-2Th: {posyanduBayi02Tahun || 0} | 🧒 2-5Th: {posyanduBalita25Tahun || 0} | 👦 6-12Th: {posyanduAnak612Tahun || 0} | 🧑 13-18Th: {posyanduRemaja1318Tahun || 0} | 🤰 19-59Th: {posyanduDewasaIbuHamil1959Tahun || 0} | 👵 60+Th: {posyanduLansia60TahunKeatas || 0}
                    </p>
                    {posyanduJenisLayanan.length > 0 && (
                      <p className="pl-3 text-slate-300 text-[10px] truncate">
                        - Layanan: {posyanduJenisLayanan.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800 text-slate-400">
                <p>📷 (Dokumentasi Terlampir: {fotoList.length} Foto)</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="bg-[#991B1B] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs">
                    #MedanUntukSemua
                  </span>
                  <span className="bg-[#1E3A8A] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs">
                    #SemuaUntukMedan
                  </span>
                </div>
              </div>
            </div>

            {/* Google Sheets & Database Sync Settings */}
            <div className="p-4 bg-slate-50 space-y-3">
              {!hasGoogleAuth && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-950 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Penyimpanan Database Langsung:</span>
                    <span>Laporan otomatis disimpan aman ke Database Aplikasi. Anda juga dapat menghubungkan Google jika ingin sinkronisasi ke Google Sheets Kelurahan.</span>
                    <button
                      type="button"
                      onClick={onConnectGoogle}
                      className="mt-1 inline-block font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                    >
                      Hubungkan Google Sheets →
                    </button>
                  </div>
                </div>
              )}

              {/* Status Kesesuaian Foto Sebelum Simpan */}
              {hasPhotoDeficit ? (
                <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs text-amber-950 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-amber-900">
                        Peringatan: Jumlah Foto Belum Sesuai Angka Inputan!
                      </span>
                      <span className="text-[11px] text-amber-800">
                        Foto bukti harus sesuai dengan jumlah WP / KK / Kegiatan yang dipilih:
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {pbbDeficit > 0 && (
                      <div className="flex items-center justify-between bg-white/90 px-2.5 py-1.5 rounded-lg border border-amber-200 text-[11px]">
                        <div>
                          <span className="font-bold text-slate-800">Opsir PBB: </span>
                          <span className="text-slate-600">{pbbWpNumber} WP</span>
                        </div>
                        <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Baru {pbbPhotosCount} Foto (Kurang {pbbDeficit})
                        </span>
                      </div>
                    )}
                    {perlinsosDeficit > 0 && (
                      <div className="flex items-center justify-between bg-white/90 px-2.5 py-1.5 rounded-lg border border-amber-200 text-[11px]">
                        <div>
                          <span className="font-bold text-slate-800">Perlinsos: </span>
                          <span className="text-slate-600">{perlinsosKkNumber} KK</span>
                        </div>
                        <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Baru {perlinsosPhotosCount} Foto (Kurang {perlinsosDeficit})
                        </span>
                      </div>
                    )}
                    {lainnyaDeficit > 0 && (
                      <div className="flex items-center justify-between bg-white/90 px-2.5 py-1.5 rounded-lg border border-amber-200 text-[11px]">
                        <div>
                          <span className="font-bold text-slate-800">Kegiatan Lainnya: </span>
                          <span className="text-slate-600">{selectedLainnyaOptions.length} Kegiatan</span>
                        </div>
                        <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Baru {lainnyaPhotosCount} Foto (Kurang {lainnyaDeficit})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (pbbWpNumber > 0 || perlinsosKkNumber > 0 || selectedLainnyaOptions.length > 0) ? (
                <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-[11px] font-medium text-emerald-900">
                    Jumlah foto bukti dokumentasi telah <strong>sesuai</strong> dengan angka WP ({pbbPhotosCount}/{pbbWpNumber}), KK ({perlinsosPhotosCount}/{perlinsosKkNumber}), dan Kegiatan Lainnya ({lainnyaPhotosCount}/{selectedLainnyaOptions.length}).
                  </span>
                </div>
              ) : null}

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

      {/* Modal Peringatan Foto Harus Sesuai Jumlah Angka Inputan */}
      {showPhotoValidationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Peringatan: Jumlah Foto Belum Sesuai Angka Yang Diinput!
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Jika mengisi jumlah KK atau WP (misalnya 1, 2, atau lebih), jumlah foto bukti kegiatan <strong>harus sesuai dengan jumlah angka yang diinput</strong>.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Rincian Kekurangan Foto Bukti:
              </span>

              {pbbDeficit > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-amber-950">1. OPSIR PBB (Pajak Bumi & Bangunan)</div>
                      <div className="text-[11px] text-amber-800 mt-0.5">
                        Input: <strong>{pbbWpNumber} WP</strong> ➔ Foto terlampir: <strong>{pbbPhotosCount} Foto</strong>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-rose-600 text-white font-extrabold text-[10px] rounded-lg shadow-2xs">
                      Kurang {pbbDeficit} Foto
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <label
                      htmlFor="file-input-pbb"
                      onClick={() => setShowPhotoValidationModal(false)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>+ Upload {pbbDeficit} Foto PBB</span>
                    </label>
                    {uncategorizedPhotos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          tagUncategorizedPhotos('pbb', pbbDeficit);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        <span>🔄 Tandai Foto Umum sbg PBB</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {perlinsosDeficit > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-amber-950">2. PERLINSOS (Perlindungan Sosial / Bansos)</div>
                      <div className="text-[11px] text-amber-800 mt-0.5">
                        Input: <strong>{perlinsosKkNumber} KK</strong> ➔ Foto terlampir: <strong>{perlinsosPhotosCount} Foto</strong>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-rose-600 text-white font-extrabold text-[10px] rounded-lg shadow-2xs">
                      Kurang {perlinsosDeficit} Foto
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <label
                      htmlFor="file-input-perlinsos"
                      onClick={() => setShowPhotoValidationModal(false)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>+ Upload {perlinsosDeficit} Foto Perlinsos</span>
                    </label>
                    {uncategorizedPhotos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          tagUncategorizedPhotos('perlinsos', perlinsosDeficit);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        <span>🔄 Tandai Foto Umum sbg Perlinsos</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {lainnyaDeficit > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-amber-950">5. KEGIATAN LAINNYA</div>
                      <div className="text-[11px] text-amber-800 mt-0.5">
                        Terpilih: <strong>{selectedLainnyaOptions.length} Kegiatan</strong> ➔ Foto terlampir: <strong>{lainnyaPhotosCount} Foto</strong>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-rose-600 text-white font-extrabold text-[10px] rounded-lg shadow-2xs">
                      Kurang {lainnyaDeficit} Foto
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <label
                      htmlFor="file-input-lainnya"
                      onClick={() => setShowPhotoValidationModal(false)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>+ Upload {lainnyaDeficit} Foto Lainnya</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
 
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowPhotoValidationModal(false);
                  if (pbbDeficit > 0) {
                    document.getElementById('input-opsir-pbb-wp')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  } else if (perlinsosDeficit > 0) {
                    document.getElementById('input-perlinsos-kk')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  } else if (lainnyaDeficit > 0) {
                    document.getElementById('input-kegiatan-lainnya-custom')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all text-center"
              >
                Lengkapi Foto Sekarang
              </button>

              <button
                type="button"
                onClick={() => {
                  doSaveReport();
                }}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-all text-center border border-slate-200"
              >
                Tetap Simpan (Jika Foto Digabung)
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};
