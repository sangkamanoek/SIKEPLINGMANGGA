import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  Sparkles,
  MapPin,
  Calendar,
  X,
  Upload,
  Eye,
  Trash2,
  Edit,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Zap,
  Lightbulb,
  Building2,
  Layers,
  Camera,
  Image as ImageIcon,
  Link2,
  Loader2,
  Database,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { UserAccount, RealisasiPembangunan, JenisPembangunanType, StatusRealisasiType } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import {
  savePembangunanToServer,
  deletePembangunanFromServer,
  fetchPembangunanAll,
  subscribeToPembangunan,
  batchSyncPembangunan,
  PEMBANGUNAN_STORAGE_KEY,
} from '../lib/pembangunanService';

interface RealisasiPembangunanViewProps {
  currentUser: UserAccount;
}

const STORAGE_KEY = PEMBANGUNAN_STORAGE_KEY;

// Helper function to compress image files from phone camera / gallery
const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
};

// Preset realistic project process photos generated for Medan Kelurahan Mangga
export const CONTOH_FOTO_PROSES_LIST = [
  {
    nama: 'Pengaspalan Hotmix Jalan Lingkungan',
    kategori: 'Pekerjaan Jalan',
    deskripsi: 'Pekerja proyek meratakan aspal hotmix dan pemadatan slender/roller',
    url: '/src/assets/images/proses_aspal_jalan_1790846460460.jpg',
  },
  {
    nama: 'Pemasangan U-Ditch Drainase Beton',
    kategori: 'Pekerjaan Drainase',
    deskripsi: 'Pemasangan saluran drainase beton pra-cetak U-ditch di pinggir jalan',
    url: '/src/assets/images/proses_drainase_uditch_1790846472119.jpg',
  },
  {
    nama: 'Pemasangan Paving Blok Gang Warga',
    kategori: 'Pekerjaan Paving',
    deskripsi: 'Pemasangan paving block abu-abu K-300 di pemukiman warga',
    url: '/src/assets/images/proses_paving_block_1790846485222.jpg',
  },
  {
    nama: 'Pemasangan & Perbaikan Lampu LPJU',
    kategori: 'Penerangan Jalan',
    deskripsi: 'Teknisi memasang tiang dan lampu penerangan jalan umum LED',
    url: '/src/assets/images/proses_lampu_lpju_1790846499280.jpg',
  },
];

// Initial realistic seed data for Kelurahan Mangga (24 Lingkungan)
const INITIAL_REALISASI_DATA: RealisasiPembangunan[] = [
  {
    id: 'pemb_2_paving',
    lingkunganId: 'kepling_2',
    lingkunganNomor: 2,
    jenisPembangunan: 'PEMASANGAN_PAVING_BLOK',
    namaProyek: 'Pemasangan Paving Blok',
    lokasiDetail: 'Jl. Irigasi Lk II',
    sumberDana: 'Dinas SDABMBK Kota Medan',
    statusRealisasi: 'SELESAI_100%',
    volumeRealisasi: '50 Meter',
    biayaEstimasiRp: 25000000,
    tanggalMulai: '2026-08-20',
    tanggalSelesai: '2026-08-24',
    fotoSebelumUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?w=600&auto=format&fit=crop&q=80',
    fotoProsesUrl: '/src/assets/images/proses_paving_block_1790846485222.jpg',
    fotoProsesList: [
      '/src/assets/images/proses_paving_block_1790846485222.jpg',
    ],
    fotoSesudahUrl: 'https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?w=600&auto=format&fit=crop&q=80',
    keterangan: 'Pemasangan paving block rapi dan kokoh di jalan lingkungan warga.',
    createdAt: '2026-08-24T11:08:38.000Z',
    createdByName: 'Zulkarnaen Tarigan (Zulkarnaen Tarigan)',
  },
  {
    id: 'pemb_1',
    lingkunganId: 'kepling_1',
    lingkunganNomor: 1,
    jenisPembangunan: 'PERBAIKAN_JALAN',
    namaProyek: 'Pengaspalan Hotmix & Patching Jl. Bunga Raya Gg. Melati',
    lokasiDetail: 'Jl. Bunga Raya Gg. Melati Lingkungan I',
    sumberDana: 'Dinas SDABMBK Kota Medan',
    statusRealisasi: 'SELESAI_100%',
    volumeRealisasi: '280 Meter',
    biayaEstimasiRp: 145000000,
    tanggalMulai: '2026-08-10',
    tanggalSelesai: '2026-08-25',
    pelaksanaTeknis: 'Dinas SDABMBK & Pokmas Lingk. I',
    fotoSebelumUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80',
    fotoProsesUrl: '/src/assets/images/proses_aspal_jalan_1790846460460.jpg',
    fotoProsesList: [
      '/src/assets/images/proses_aspal_jalan_1790846460460.jpg',
    ],
    fotoSesudahUrl: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=600&auto=format&fit=crop&q=80',
    keterangan: 'Akses jalan utama Lingkungan I sudah mulus dan lancar dilalui kendaraan warga.',
    createdAt: '2026-08-26T10:00:00.000Z',
    createdByName: 'M. Syafi’i (Kepling I)',
  },
  {
    id: 'pemb_2',
    lingkunganId: 'kepling_3',
    lingkunganNomor: 3,
    jenisPembangunan: 'PERBAIKAN_DRAINASE',
    namaProyek: 'Normalisasi Parit & Pemasangan U-Ditch Beton',
    lokasiDetail: 'Jl. Bunga Mawar Gg. Sejahtera Lingkungan III',
    sumberDana: 'APBD Kota Medan',
    statusRealisasi: 'SELESAI_100%',
    volumeRealisasi: '150 Meter',
    biayaEstimasiRp: 98000000,
    tanggalMulai: '2026-07-01',
    tanggalSelesai: '2026-07-20',
    pelaksanaTeknis: 'Dinas SDABMBK',
    fotoSebelumUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?w=600&auto=format&fit=crop&q=80',
    fotoProsesUrl: '/src/assets/images/proses_drainase_uditch_1790846472119.jpg',
    fotoProsesList: [
      '/src/assets/images/proses_drainase_uditch_1790846472119.jpg',
    ],
    fotoSesudahUrl: 'https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?w=600&auto=format&fit=crop&q=80',
    keterangan: 'Saluran drainase bebas genangan air saat hujan deras tiba.',
    createdAt: '2026-07-21T09:00:00.000Z',
    createdByName: 'Rahmat Hidayat (Kepling III)',
  },
  {
    id: 'pemb_3',
    lingkunganId: 'kepling_5',
    lingkunganNomor: 5,
    jenisPembangunan: 'PENAMBAHAN_TIANG_LPJU',
    namaProyek: 'Pemasangan Tiang LPJU Baru & Ornamen Lampu LED 60W',
    lokasiDetail: 'Jl. Bunga Flamboyan Rawan Gelap Lingkungan V',
    sumberDana: 'Dinas Perkim Kota Medan',
    statusRealisasi: 'SELESAI_100%',
    volumeRealisasi: '6 Unit Tiang Baru',
    biayaEstimasiRp: 42000000,
    tanggalMulai: '2026-09-01',
    tanggalSelesai: '2026-09-08',
    fotoSebelumUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=600&auto=format&fit=crop&q=80',
    fotoProsesUrl: '/src/assets/images/proses_lampu_lpju_1790846499280.jpg',
    fotoProsesList: [
      '/src/assets/images/proses_lampu_lpju_1790846499280.jpg',
    ],
    fotoSesudahUrl: 'https://images.unsplash.com/photo-1517685352821-92cf88aee5a5?w=600&auto=format&fit=crop&q=80',
    keterangan: 'Jalanan lingkungan terang benderang pada malam hari, meningkatkan keamanan warga.',
    createdAt: '2026-09-09T08:30:00.000Z',
    createdByName: 'Bambang S. (Kepling V)',
  },
  {
    id: 'pemb_4',
    lingkunganId: 'kepling_8',
    lingkunganNomor: 8,
    jenisPembangunan: 'PERBAIKAN_LAMPU_LPJU',
    namaProyek: 'Perbaikan Lampu LPJU Mati & Penggantian Kabel Network',
    lokasiDetail: 'Simpang Gg. Kantil s.d. Mushola Lingkungan VIII',
    sumberDana: 'Dinas Perhubungan (Dishub)',
    statusRealisasi: 'SELESAI_100%',
    volumeRealisasi: '12 Titik Lampu',
    biayaEstimasiRp: 18500000,
    tanggalMulai: '2026-09-15',
    tanggalSelesai: '2026-09-17',
    fotoSebelumUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    fotoProsesUrl: '/src/assets/images/proses_lampu_lpju_1790846499280.jpg',
    fotoProsesList: [
      '/src/assets/images/proses_lampu_lpju_1790846499280.jpg',
    ],
    fotoSesudahUrl: 'https://images.unsplash.com/photo-1508873696983-2df515122519?w=600&auto=format&fit=crop&q=80',
    keterangan: '12 titik lampu LPJU yang padam telah menyala kembali 100%.',
    createdAt: '2026-09-18T11:00:00.000Z',
    createdByName: 'Suryadi (Kepling VIII)',
  },
  {
    id: 'pemb_5',
    lingkunganId: 'kepling_12',
    lingkunganNomor: 12,
    jenisPembangunan: 'PERBAIKAN_JALAN',
    namaProyek: 'Pengecoran Rabat Beton Gang Pemukiman Warga',
    lokasiDetail: 'Gg. Anggrek I Lingkungan XII',
    sumberDana: 'Swadaya Masyarakat & Pokir DPRD',
    statusRealisasi: 'PROSES_PENGERJAAN',
    volumeRealisasi: '120 Meter',
    biayaEstimasiRp: 65000000,
    tanggalMulai: '2026-09-20',
    pelaksanaTeknis: 'Gotong Royong Warga Lingkungan XII',
    fotoSebelumUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80',
    fotoProsesUrl: '/src/assets/images/proses_aspal_jalan_1790846460460.jpg',
    fotoProsesList: [
      '/src/assets/images/proses_aspal_jalan_1790846460460.jpg',
      '/src/assets/images/proses_paving_block_1790846485222.jpg',
    ],
    fotoSesudahUrl: '',
    keterangan: 'Pengerjaan rabat beton telah mencapai progres 65%.',
    createdAt: '2026-09-21T14:00:00.000Z',
    createdByName: 'Herman (Kepling XII)',
  },
  {
    id: 'pemb_6',
    lingkunganId: 'kepling_18',
    lingkunganNomor: 18,
    jenisPembangunan: 'PENAMBAHAN_TIANG_LPJU',
    namaProyek: 'Usulan Penambahan 4 Tiang LPJU Baru Jalur Utama Lingkungan',
    lokasiDetail: 'Jl. Bunga Sakura Belakang Pasar Lingkungan XVIII',
    sumberDana: 'Usulan Musrenbang / Dinas Perkim',
    statusRealisasi: 'USULAN',
    volumeRealisasi: '4 Unit Tiang Baru',
    biayaEstimasiRp: 28000000,
    pelaksanaTeknis: 'Dinas Perkim Kota Medan',
    fotoSebelumUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=600&auto=format&fit=crop&q=80',
    fotoProsesUrl: '',
    fotoProsesList: [],
    keterangan: 'Telah diajukan melalui Musrenbang Kelurahan Mangga untuk penetapan anggaran.',
    createdAt: '2026-09-22T09:15:00.000Z',
    createdByName: 'Junaidi (Kepling XVIII)',
  },
  {
    id: 'pemb_7',
    lingkunganId: 'kepling_10',
    lingkunganNomor: 10,
    jenisPembangunan: 'PEMASANGAN_PAVING_BLOK',
    namaProyek: 'Pemasangan Paving Blok Halaman Posyandu & Gang Pemukiman',
    lokasiDetail: 'Gg. Bunga Cempaka Lingkungan X',
    sumberDana: 'Dana Kelurahan Mangga',
    statusRealisasi: 'SELESAI_100%',
    volumeRealisasi: '180 Meter Persegi',
    biayaEstimasiRp: 52000000,
    tanggalMulai: '2026-09-12',
    tanggalSelesai: '2026-09-24',
    fotoSebelumUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?w=600&auto=format&fit=crop&q=80',
    fotoProsesUrl: '/src/assets/images/proses_paving_block_1790846485222.jpg',
    fotoProsesList: [
      '/src/assets/images/proses_paving_block_1790846485222.jpg',
    ],
    fotoSesudahUrl: 'https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?w=600&auto=format&fit=crop&q=80',
    keterangan: 'Pemasangan paving block K-300 rapi dan kokoh, mempermudah akses warga.',
    createdAt: '2026-09-25T11:00:00.000Z',
    createdByName: 'Syahril (Kepling X)',
  },
];

export const RealisasiPembangunanView: React.FC<RealisasiPembangunanViewProps> = ({ currentUser }) => {
  // Persistence state
  const [items, setItems] = useState<RealisasiPembangunan[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load realisasi pembangunan from storage', e);
    }
    return INITIAL_REALISASI_DATA;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save realisasi pembangunan to storage', e);
    }
  }, [items]);

  const [isCloudSynced, setIsCloudSynced] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync with Firestore & Server API on mount
  useEffect(() => {
    let isMounted = true;
    setIsSyncing(true);

    fetchPembangunanAll()
      .then((cloudItems) => {
        if (!isMounted) return;
        setIsSyncing(false);
        if (Array.isArray(cloudItems) && cloudItems.length > 0) {
          setItems((prev) => {
            const map = new Map<string, RealisasiPembangunan>();
            cloudItems.forEach((c) => map.set(c.id, c));
            prev.forEach((p) => {
              if (!map.has(p.id)) map.set(p.id, p);
            });
            return Array.from(map.values());
          });
          setIsCloudSynced(true);
        } else if (items.length > 0) {
          // If central database is empty, automatically seed existing local data into central DB
          batchSyncPembangunan(items).catch((err) => {
            console.warn('Initial central sync notice:', err);
          });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setIsSyncing(false);
        console.warn('Initial fetch pembangunan notice:', err);
      });

    // Realtime Firestore subscriber
    const unsubscribe = subscribeToPembangunan((fsItems) => {
      if (!isMounted) return;
      if (Array.isArray(fsItems) && fsItems.length > 0) {
        setItems((prev) => {
          const map = new Map<string, RealisasiPembangunan>();
          fsItems.forEach((c) => map.set(c.id, c));
          prev.forEach((p) => {
            if (!map.has(p.id)) map.set(p.id, p);
          });
          return Array.from(map.values());
        });
        setIsCloudSynced(true);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Manual Trigger to re-sync all current data to database
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const ok = await batchSyncPembangunan(items);
      const latest = await fetchPembangunanAll();
      if (Array.isArray(latest) && latest.length > 0) {
        setItems(latest);
      }
      setIsCloudSynced(true);
      showToast(ok ? 'Sinkronisasi Database Firestore & Server Berhasil!' : 'Sinkronisasi selesai.');
    } catch {
      showToast('Gagal melakukan sinkronisasi database.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJenis, setFilterJenis] = useState<string>('all');
  const [filterLingkungan, setFilterLingkungan] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RealisasiPembangunan | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ title: string; url: string; category: string } | null>(null);

  // Delete & Confirmation States (Replaces native window.confirm for iframe & mobile compatibility)
  const [itemToDelete, setItemToDelete] = useState<RealisasiPembangunan | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const promptDeleteItem = (item: RealisasiPembangunan) => {
    setItemToDelete(item);
  };

  const confirmDeleteItem = () => {
    if (!itemToDelete) return;
    const targetId = itemToDelete.id;
    const targetName = itemToDelete.namaProyek;
    setItems((prev) => prev.filter((i) => i.id !== targetId));
    deletePembangunanFromServer(targetId).catch((err) => {
      console.warn('Delete pembangunan from server notice:', err);
    });
    setItemToDelete(null);
    showToast(`Laporan "${targetName.slice(0, 30)}..." berhasil dihapus dari database.`);
  };

  const confirmClearAll = () => {
    setItems([]);
    setIsClearAllModalOpen(false);
    showToast('Seluruh contoh laporan pembangunan berhasil dibersihkan.');
  };

  const handleRestoreSamples = () => {
    setItems(INITIAL_REALISASI_DATA);
    showToast('Data contoh laporan pembangunan berhasil dimuat kembali.');
  };

  // Form States
  const [formLingkunganNo, setFormLingkunganNo] = useState<number>(
    currentUser.nomorLingkungan || 1
  );
  const [formJenis, setFormJenis] = useState<JenisPembangunanType>('PERBAIKAN_JALAN');
  const [formNamaProyek, setFormNamaProyek] = useState('');
  const [formLokasiDetail, setFormLokasiDetail] = useState('');
  const [formSumberDana, setFormSumberDana] = useState('Dinas SDABMBK Kota Medan');
  const [formStatus, setFormStatus] = useState<StatusRealisasiType>('SELESAI_100%');
  const [formVolume, setFormVolume] = useState('');
  const [formBiaya, setFormBiaya] = useState<number | ''>('');
  const [formTglMulai, setFormTglMulai] = useState('');
  const [formTglSelesai, setFormTglSelesai] = useState('');
  const [formFotoSebelum, setFormFotoSebelum] = useState('');
  const [formFotoProses, setFormFotoProses] = useState('');
  const [formFotoProsesList, setFormFotoProsesList] = useState<string[]>([]);
  const [formFotoSesudah, setFormFotoSesudah] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');

  // Photo Upload States & Refs for Mobile Camera / Gallery
  const [isProcessingBefore, setIsProcessingBefore] = useState(false);
  const [isProcessingProses, setIsProcessingProses] = useState(false);
  const [isProcessingAfter, setIsProcessingAfter] = useState(false);
  const [showUrlInputBefore, setShowUrlInputBefore] = useState(false);
  const [showUrlInputProses, setShowUrlInputProses] = useState(false);
  const [showUrlInputAfter, setShowUrlInputAfter] = useState(false);
  const [customProsesUrl, setCustomProsesUrl] = useState('');

  const fileBeforeCameraRef = useRef<HTMLInputElement>(null);
  const fileBeforeGalleryRef = useRef<HTMLInputElement>(null);
  const fileProsesCameraRef = useRef<HTMLInputElement>(null);
  const fileProsesGalleryRef = useRef<HTMLInputElement>(null);
  const fileAfterCameraRef = useRef<HTMLInputElement>(null);
  const fileAfterGalleryRef = useRef<HTMLInputElement>(null);

  const handleProcessImage = async (
    files: File | FileList | File[],
    type: 'sebelum' | 'proses' | 'sesudah'
  ) => {
    if (type === 'sebelum') setIsProcessingBefore(true);
    else if (type === 'proses') setIsProcessingProses(true);
    else setIsProcessingAfter(true);

    try {
      const fileArr = files instanceof FileList ? Array.from(files) : Array.isArray(files) ? files : [files];
      for (const file of fileArr) {
        const compressedDataUrl = await compressImageFile(file);
        if (type === 'sebelum') {
          setFormFotoSebelum(compressedDataUrl);
        } else if (type === 'proses') {
          setFormFotoProsesList((prev) => [...prev, compressedDataUrl]);
          setFormFotoProses(compressedDataUrl);
        } else {
          setFormFotoSesudah(compressedDataUrl);
        }
      }
    } catch (err) {
      console.error('Gagal memproses gambar:', err);
      alert('Gagal memproses file foto. Pastikan format file adalah gambar valid.');
    } finally {
      if (type === 'sebelum') setIsProcessingBefore(false);
      else if (type === 'proses') setIsProcessingProses(false);
      else setIsProcessingAfter(false);
    }
  };

  const removeProsesPhoto = (idx: number) => {
    setFormFotoProsesList((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      setFormFotoProses(updated[0] || '');
      return updated;
    });
  };

  const addProsesPhotoUrl = () => {
    if (!customProsesUrl.trim()) return;
    setFormFotoProsesList((prev) => [...prev, customProsesUrl.trim()]);
    setFormFotoProses(customProsesUrl.trim());
    setCustomProsesUrl('');
    setShowUrlInputProses(false);
  };

  // Lock lingkungan if user is Kepling
  const isKeplingRole = currentUser.role === 'kepling' || Boolean(currentUser.nomorLingkungan);

  // Filtered List
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Filter Lingkungan
      if (filterLingkungan !== 'all' && item.lingkunganNomor !== Number(filterLingkungan)) {
        return false;
      }
      // Kepling view restriction if desired or show all with highlight
      if (isKeplingRole && currentUser.nomorLingkungan && filterLingkungan === 'my_lingkungan') {
        if (item.lingkunganNomor !== currentUser.nomorLingkungan) return false;
      }

      // Filter Jenis
      if (filterJenis !== 'all' && item.jenisPembangunan !== filterJenis) {
        return false;
      }

      // Filter Status
      if (filterStatus !== 'all' && item.statusRealisasi !== filterStatus) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNama = item.namaProyek.toLowerCase().includes(q);
        const matchLokasi = item.lokasiDetail.toLowerCase().includes(q);
        const matchKepling = (item.createdByName || '').toLowerCase().includes(q);
        if (!matchNama && !matchLokasi && !matchKepling) return false;
      }

      return true;
    });
  }, [items, filterLingkungan, filterJenis, filterStatus, searchQuery, isKeplingRole, currentUser.nomorLingkungan]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const totalProyek = filteredItems.length;
    const countJalan = filteredItems.filter((i) => i.jenisPembangunan === 'PERBAIKAN_JALAN').length;
    const countDrainase = filteredItems.filter((i) => i.jenisPembangunan === 'PERBAIKAN_DRAINASE').length;
    const countPaving = filteredItems.filter((i) => i.jenisPembangunan === 'PEMASANGAN_PAVING_BLOK').length;
    const countLampu = filteredItems.filter((i) => i.jenisPembangunan === 'PERBAIKAN_LAMPU_LPJU').length;
    const countTiang = filteredItems.filter((i) => i.jenisPembangunan === 'PENAMBAHAN_TIANG_LPJU').length;
    const countSelesai = filteredItems.filter((i) => i.statusRealisasi === 'SELESAI_100%').length;
    const totalBiaya = filteredItems.reduce((sum, i) => sum + (i.biayaEstimasiRp || 0), 0);

    return {
      totalProyek,
      countJalan,
      countDrainase,
      countPaving,
      countLampu,
      countTiang,
      countSelesai,
      totalBiaya,
    };
  }, [filteredItems]);

  const openAddModal = () => {
    setEditingItem(null);
    setFormLingkunganNo(currentUser.nomorLingkungan || 1);
    setFormJenis('PERBAIKAN_JALAN');
    setFormNamaProyek('');
    setFormLokasiDetail('');
    setFormSumberDana('Dinas SDABMBK Kota Medan');
    setFormStatus('SELESAI_100%');
    setFormVolume('250 Meter');
    setFormBiaya('');
    setFormTglMulai(new Date().toISOString().split('T')[0]);
    setFormTglSelesai(new Date().toISOString().split('T')[0]);
    setFormFotoSebelum('');
    setFormFotoProses('');
    setFormFotoProsesList([]);
    setFormFotoSesudah('');
    setFormKeterangan('');
    setShowUrlInputBefore(false);
    setShowUrlInputProses(false);
    setShowUrlInputAfter(false);
    setCustomProsesUrl('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: RealisasiPembangunan) => {
    setEditingItem(item);
    setFormLingkunganNo(item.lingkunganNomor);
    setFormJenis(item.jenisPembangunan);
    setFormNamaProyek(item.namaProyek);
    setFormLokasiDetail(item.lokasiDetail);
    setFormSumberDana(item.sumberDana);
    setFormStatus(item.statusRealisasi);
    setFormVolume(item.volumeRealisasi);
    setFormBiaya(item.biayaEstimasiRp || '');
    setFormTglMulai(item.tanggalMulai || '');
    setFormTglSelesai(item.tanggalSelesai || '');
    setFormFotoSebelum(item.fotoSebelumUrl || '');
    setFormFotoProses(item.fotoProsesUrl || (item.fotoProsesList && item.fotoProsesList[0]) || '');
    setFormFotoProsesList(
      item.fotoProsesList && item.fotoProsesList.length > 0
        ? item.fotoProsesList
        : item.fotoProsesUrl
        ? [item.fotoProsesUrl]
        : []
    );
    setFormFotoSesudah(item.fotoSesudahUrl || '');
    setFormKeterangan(item.keterangan || '');
    setShowUrlInputBefore(Boolean(item.fotoSebelumUrl && !item.fotoSebelumUrl.startsWith('data:')));
    setShowUrlInputProses(false);
    setShowUrlInputAfter(Boolean(item.fotoSesudahUrl && !item.fotoSesudahUrl.startsWith('data:')));
    setCustomProsesUrl('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNamaProyek.trim()) {
      setFormError('Nama proyek pembangunan wajib diisi.');
      return;
    }
    setFormError(null);

    const keplingObj = KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === formLingkunganNo);
    const keplingName = keplingObj ? keplingObj.nama : `Kepling Lingkungan ${formLingkunganNo}`;

    if (editingItem) {
      // Update
      const updated: RealisasiPembangunan = {
        ...editingItem,
        lingkunganNomor: formLingkunganNo,
        lingkunganId: `kepling_${formLingkunganNo}`,
        jenisPembangunan: formJenis,
        namaProyek: formNamaProyek.trim(),
        lokasiDetail: formLokasiDetail.trim(),
        sumberDana: formSumberDana,
        statusRealisasi: formStatus,
        volumeRealisasi: formVolume.trim() || '1 Paket',
        biayaEstimasiRp: formBiaya ? Number(formBiaya) : undefined,
        tanggalMulai: formTglMulai || undefined,
        tanggalSelesai: formTglSelesai || undefined,
        fotoSebelumUrl: formFotoSebelum.trim() || undefined,
        fotoProsesUrl: formFotoProsesList[0] || formFotoProses.trim() || undefined,
        fotoProsesList: formFotoProsesList.length > 0 ? formFotoProsesList : (formFotoProses ? [formFotoProses] : undefined),
        fotoSesudahUrl: formFotoSesudah.trim() || undefined,
        keterangan: formKeterangan.trim(),
        updatedAt: new Date().toISOString(),
      };
      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? updated : i)));
      savePembangunanToServer(updated).catch((err) => {
        console.warn('Save updated pembangunan to server notice:', err);
      });
      showToast(`Pembaruan proyek "${updated.namaProyek}" berhasil disimpan ke database!`);
    } else {
      // Create new
      const newItem: RealisasiPembangunan = {
        id: `pemb_${Date.now()}`,
        lingkunganId: `kepling_${formLingkunganNo}`,
        lingkunganNomor: formLingkunganNo,
        jenisPembangunan: formJenis,
        namaProyek: formNamaProyek.trim(),
        lokasiDetail: formLokasiDetail.trim(),
        sumberDana: formSumberDana,
        statusRealisasi: formStatus,
        volumeRealisasi: formVolume.trim() || '1 Paket',
        biayaEstimasiRp: formBiaya ? Number(formBiaya) : undefined,
        tanggalMulai: formTglMulai || undefined,
        tanggalSelesai: formTglSelesai || undefined,
        fotoSebelumUrl: formFotoSebelum.trim() || undefined,
        fotoProsesUrl: formFotoProsesList[0] || formFotoProses.trim() || undefined,
        fotoProsesList: formFotoProsesList.length > 0 ? formFotoProsesList : (formFotoProses ? [formFotoProses] : undefined),
        fotoSesudahUrl: formFotoSesudah.trim() || undefined,
        keterangan: formKeterangan.trim(),
        createdAt: new Date().toISOString(),
        createdByName: `${currentUser.nama} (${keplingName})`,
      };
      setItems((prev) => [newItem, ...prev]);
      savePembangunanToServer(newItem).catch((err) => {
        console.warn('Save new pembangunan to server notice:', err);
      });
      showToast(`Laporan infrastruktur "${newItem.namaProyek}" berhasil disimpan ke database!`);
    }

    setIsModalOpen(false);
  };

  const handleExportExcel = () => {
    const excelRows = filteredItems.map((item, idx) => ({
      No: idx + 1,
      Lingkungan: `Lingkungan ${item.lingkunganNomor}`,
      'Jenis Pembangunan':
        item.jenisPembangunan === 'PERBAIKAN_JALAN'
          ? 'Perbaikan Jalan'
          : item.jenisPembangunan === 'PERBAIKAN_DRAINASE'
          ? 'Perbaikan Drainase'
          : item.jenisPembangunan === 'PERBAIKAN_LAMPU_LPJU'
          ? 'Perbaikan Lampu LPJU'
          : item.jenisPembangunan === 'PENAMBAHAN_TIANG_LPJU'
          ? 'Penambahan Tiang LPJU Baru'
          : 'Pemasangan Paving Blok',
      'Nama Proyek / Kegiatan': item.namaProyek,
      'Lokasi Detail': item.lokasiDetail,
      'Volume Realisasi': item.volumeRealisasi,
      'Pelaksana Kegiatan': item.sumberDana,
      'Status Realisasi': item.statusRealisasi,
      'Estimasi Biaya (Rp)': item.biayaEstimasiRp ? item.biayaEstimasiRp.toLocaleString('id-ID') : '-',
      'Tanggal Mulai': item.tanggalMulai || '-',
      'Tanggal Selesai': item.tanggalSelesai || '-',
      'Pelapor / Inputor': item.createdByName || '-',
      Keterangan: item.keterangan || '-',
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Realisasi Pembangunan');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Realisasi_Pembangunan_Mangga_${dateStr}.xlsx`);
  };

  const getJenisBadge = (jenis: JenisPembangunanType) => {
    switch (jenis) {
      case 'PERBAIKAN_JALAN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 border border-blue-300 font-extrabold text-[11px]">
            <Wrench className="w-3.5 h-3.5 text-blue-700" />
            <span>Perbaikan Jalan</span>
          </span>
        );
      case 'PERBAIKAN_DRAINASE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-100 text-cyan-900 border border-cyan-300 font-extrabold text-[11px]">
            <Zap className="w-3.5 h-3.5 text-cyan-700" />
            <span>Perbaikan Drainase</span>
          </span>
        );
      case 'PEMASANGAN_PAVING_BLOK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-100 text-orange-900 border border-orange-300 font-extrabold text-[11px]">
            <Layers className="w-3.5 h-3.5 text-orange-700" />
            <span>Paving Blok</span>
          </span>
        );
      case 'PERBAIKAN_LAMPU_LPJU':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[11px]">
            <Lightbulb className="w-3.5 h-3.5 text-amber-700" />
            <span>Perbaikan Lampu LPJU</span>
          </span>
        );
      case 'PENAMBAHAN_TIANG_LPJU':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-[11px]">
            <Building2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>Tiang LPJU Baru</span>
          </span>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: StatusRealisasiType) => {
    switch (status) {
      case 'SELESAI_100%':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 text-white font-black text-[10px] shadow-2xs">
            <CheckCircle2 className="w-3 h-3" />
            <span>Selesai 100%</span>
          </span>
        );
      case 'PROSES_PENGERJAAN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-white font-black text-[10px] shadow-2xs">
            <Clock className="w-3 h-3" />
            <span>Proses Pengerjaan</span>
          </span>
        );
      case 'USULAN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-600 text-white font-black text-[10px] shadow-2xs">
            <Sparkles className="w-3 h-3" />
            <span>Usulan Proyek</span>
          </span>
        );
      case 'PEMELIHARAAN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-600 text-white font-black text-[10px] shadow-2xs">
            <Wrench className="w-3 h-3" />
            <span>Pemeliharaan</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* HEADER BANNER */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white shadow-xl relative overflow-hidden border border-blue-800/40">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold">
                <Wrench className="w-4 h-4 text-blue-400" />
                <span>Seksi Pembangunan &amp; Fasilitas Publik • Kelurahan Mangga</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-semibold">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Database Terhubung (Firestore &amp; Server Buffer)</span>
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Realisasi Pembangunan Infrastruktur Wilayah
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-normal leading-relaxed">
              Monitoring realisasi perbaikan jalan, normalisasi drainase, perbaikan lampu LPJU, dan penambahan tiang LPJU baru secara akuntabel di 24 Lingkungan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer scale-102 hover:scale-105 active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>+ Input Realisasi Baru</span>
            </button>
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs backdrop-blur-md border border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              title="Sinkronkan seluruh data ke database Firestore dan server"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-300 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan DB'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs backdrop-blur-md border border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Ekspor Excel</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs backdrop-blur-md border border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Cetak Laporan</span>
            </button>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 font-bold text-xs backdrop-blur-md transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Hapus Semua Contoh Data Laporan"
              >
                <Trash2 className="w-4 h-4 text-rose-300" />
                <span>Bersihkan Contoh Data</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SUMMARY STATS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-blue-900 uppercase tracking-tight">Perbaikan Jalan</span>
            <div className="p-1.5 rounded-xl bg-blue-600 text-white">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-950">{stats.countJalan} Proyek</div>
          <p className="text-[10px] text-blue-700 font-semibold">Pengaspalan Hotmix &amp; Rabat</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-50 to-slate-50 border border-cyan-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-cyan-900 uppercase tracking-tight">Perbaikan Drainase</span>
            <div className="p-1.5 rounded-xl bg-cyan-600 text-white">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-cyan-950">{stats.countDrainase} Proyek</div>
          <p className="text-[10px] text-cyan-700 font-semibold">Normalisasi &amp; U-Ditch</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-orange-50 to-slate-50 border border-orange-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-orange-900 uppercase tracking-tight">Paving Blok</span>
            <div className="p-1.5 rounded-xl bg-orange-600 text-white">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-orange-950">{stats.countPaving} Proyek</div>
          <p className="text-[10px] text-orange-700 font-semibold">Paving Gang &amp; Fasum</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-slate-50 border border-amber-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-amber-900 uppercase tracking-tight">Lampu LPJU</span>
            <div className="p-1.5 rounded-xl bg-amber-500 text-white">
              <Lightbulb className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-950">{stats.countLampu} Proyek</div>
          <p className="text-[10px] text-amber-700 font-semibold">Lampu Jalan Diperbaiki</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-slate-50 border border-emerald-200 shadow-2xs space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-emerald-900 uppercase tracking-tight">Tiang LPJU Baru</span>
            <div className="p-1.5 rounded-xl bg-emerald-600 text-white">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-950">{stats.countTiang} Proyek</div>
          <p className="text-[10px] text-emerald-700 font-semibold">Pemasangan Titik Baru</p>
        </div>
      </div>

      {/* FILTER & CONTROL BAR */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama proyek, lokasi jalan, atau lingkungan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* View Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'card' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🖼️ Kartu Dokumentasi
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📋 Tabel Detail
            </button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Jenis Pembangunan Filter */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
              Bidang Pembangunan:
            </label>
            <select
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">🌐 Semua Bidang Pembangunan</option>
              <option value="PERBAIKAN_JALAN">🛣️ Perbaikan Jalan</option>
              <option value="PERBAIKAN_DRAINASE">🌊 Perbaikan Drainase</option>
              <option value="PEMASANGAN_PAVING_BLOK">🧱 Pemasangan Paving Blok</option>
              <option value="PERBAIKAN_LAMPU_LPJU">💡 Perbaikan Lampu LPJU</option>
              <option value="PENAMBAHAN_TIANG_LPJU">🔌 Penambahan Tiang LPJU Baru</option>
            </select>
          </div>

          {/* Lingkungan Filter */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
              Wilayah Lingkungan:
            </label>
            <select
              value={filterLingkungan}
              onChange={(e) => setFilterLingkungan(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">📍 Semua Lingkungan (I - XXIV)</option>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((no) => (
                <option key={no} value={String(no)}>
                  Lingkungan {no}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
              Status Realisasi:
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">🎯 Semua Status</option>
              <option value="SELESAI_100%">✅ Selesai 100%</option>
              <option value="PROSES_PENGERJAAN">⏳ Proses Pengerjaan</option>
              <option value="USULAN">💡 Usulan Proyek</option>
              <option value="PEMELIHARAAN">🛠️ Pemeliharaan</option>
            </select>
          </div>
        </div>
      </div>

      {/* CONTENT DISPLAY AREA */}
      {filteredItems.length === 0 ? (
        <div className="p-10 sm:p-14 text-center bg-white rounded-3xl border border-slate-200 space-y-3 shadow-2xs">
          <div className="p-4 rounded-full bg-blue-50 text-blue-600 inline-block">
            <Wrench className="w-8 h-8" />
          </div>
          <h3 className="font-extrabold text-slate-800 text-base">
            {items.length === 0 ? 'Belum Ada Data Realisasi Pembangunan' : 'Tidak Ada Data Sesuai Filter'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {items.length === 0
              ? 'Seluruh data contoh telah dibersihkan. Anda dapat langsung menginput data realisasi baru dari lapangan atau memuat kembali contoh data kapan saja.'
              : 'Tidak ditemukan data pembangunan yang sesuai dengan kriteria filter atau pencarian Anda. Silakan ubah filter atau tambah data baru.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Realisasi Baru</span>
            </button>
            {items.length === 0 && (
              <button
                type="button"
                onClick={handleRestoreSamples}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>🔄 Muat Kembali Data Contoh</span>
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'card' ? (
        /* GALLERY / CARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Header Card */}
                <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getJenisBadge(item.jenisPembangunan)}
                      <span className="text-[11px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        Lingkungan {item.lingkunganNomor}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-slate-900 text-sm leading-snug">
                      {item.namaProyek}
                    </h3>
                  </div>
                  <div>{getStatusBadge(item.statusRealisasi)}</div>
                </div>

                {/* Details Body */}
                <div className="p-4 space-y-3">
                  <div className="space-y-1.5 text-xs text-slate-700 font-medium">
                    <div className="flex items-start gap-1.5 text-slate-800">
                      <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <span>{item.lokasiDetail}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100">
                      <div>
                        <span className="text-slate-400 block font-bold">VOLUME REALISASI</span>
                        <span className="font-extrabold text-slate-900">{item.volumeRealisasi}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-bold">PELAKSANA KEGIATAN</span>
                        <span className="font-bold text-slate-800">{item.sumberDana}</span>
                      </div>
                    </div>

                    {item.keterangan && (
                      <p className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 italic">
                        "{item.keterangan}"
                      </p>
                    )}
                  </div>

                  {/* Photo Gallery: Dinamis & Responsif (Sebelum, Proses, Sesudah) */}
                  {(() => {
                    const photos: Array<{
                      key: 'sebelum' | 'proses' | 'sesudah';
                      label: string;
                      title: string;
                      url: string;
                      textColor: string;
                      borderColor: string;
                      count?: number;
                    }> = [];

                    if (item.fotoSebelumUrl) {
                      photos.push({
                        key: 'sebelum',
                        label: '📷 FOTO SEBELUM (0%)',
                        title: `Foto Sebelum (0%): ${item.namaProyek}`,
                        url: item.fotoSebelumUrl,
                        textColor: 'text-amber-700',
                        borderColor: 'border-amber-300/80',
                      });
                    }

                    if (item.fotoProsesUrl || (item.fotoProsesList && item.fotoProsesList.length > 0)) {
                      const pUrl = item.fotoProsesUrl || item.fotoProsesList![0];
                      photos.push({
                        key: 'proses',
                        label: '🔨 FOTO PROSES (PENGERJAAN)',
                        title: `Foto Proses: ${item.namaProyek}`,
                        url: pUrl,
                        textColor: 'text-blue-700',
                        borderColor: 'border-blue-300',
                        count: item.fotoProsesList?.length || 1,
                      });
                    }

                    if (item.fotoSesudahUrl) {
                      photos.push({
                        key: 'sesudah',
                        label: '✨ FOTO SESUDAH (100%)',
                        title: `Foto Sesudah (100%): ${item.namaProyek}`,
                        url: item.fotoSesudahUrl,
                        textColor: 'text-emerald-700',
                        borderColor: 'border-emerald-300',
                      });
                    }

                    if (photos.length === 0) {
                      return (
                        <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs font-semibold">
                          <span>Belum ada foto dokumentasi diunggah</span>
                        </div>
                      );
                    }

                    const gridColsClass =
                      photos.length === 3
                        ? 'grid-cols-3'
                        : photos.length === 2
                        ? 'grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-2';

                    const imgHeightClass =
                      photos.length === 3
                        ? 'h-24 sm:h-32'
                        : 'h-32 sm:h-40';

                    return (
                      <div className={`grid ${gridColsClass} gap-2 pt-1`}>
                        {photos.map((photo) => (
                          <div key={photo.key} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={`block text-[9px] sm:text-[10px] font-black uppercase tracking-tight truncate ${photo.textColor}`}>
                                {photo.label}
                              </span>
                              {photo.count && photo.count > 1 && (
                                <span className="text-[8px] font-extrabold px-1 py-0.2 bg-blue-100 text-blue-800 rounded">
                                  {photo.count} Foto
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewPhoto({
                                  title: photo.title,
                                  url: photo.url,
                                  category: photo.key,
                                })
                              }
                              className={`w-full ${imgHeightClass} rounded-xl overflow-hidden border ${photo.borderColor} relative group cursor-pointer bg-slate-900 block shadow-2xs`}
                            >
                              <img
                                src={photo.url}
                                alt={photo.label}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center text-white text-[10px] font-bold">
                                <Eye className="w-4 h-4" />
                              </div>
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span className="text-[10px]">Input: {item.createdByName || 'Kepling'}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer"
                    title="Edit Data"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => promptDeleteItem(item)}
                    className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 cursor-pointer"
                    title="Hapus Data"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                  <th className="p-3 text-center w-12">No</th>
                  <th className="p-3">Lingkungan</th>
                  <th className="p-3">Bidang Pembangunan</th>
                  <th className="p-3">Nama Proyek / Kegiatan</th>
                  <th className="p-3">Lokasi Detail</th>
                  <th className="p-3">Volume</th>
                  <th className="p-3">Pelaksana Kegiatan</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Dokumentasi Foto</th>
                  <th className="p-3 text-center w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-medium">
                {filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-extrabold text-blue-900 whitespace-nowrap">
                      Lingkungan {item.lingkunganNomor}
                    </td>
                    <td className="p-3 whitespace-nowrap">{getJenisBadge(item.jenisPembangunan)}</td>
                    <td className="p-3 font-bold text-slate-900">{item.namaProyek}</td>
                    <td className="p-3 text-slate-600">{item.lokasiDetail}</td>
                    <td className="p-3 font-extrabold text-slate-900 whitespace-nowrap">{item.volumeRealisasi}</td>
                    <td className="p-3 text-slate-700 whitespace-nowrap">{item.sumberDana}</td>
                    <td className="p-3 text-center whitespace-nowrap">{getStatusBadge(item.statusRealisasi)}</td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {item.fotoSebelumUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                title: `Sebelum (0%): ${item.namaProyek}`,
                                url: item.fotoSebelumUrl!,
                                category: 'sebelum',
                              })
                            }
                            className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200 cursor-pointer"
                            title="Lihat Foto Sebelum"
                          >
                            0%
                          </button>
                        )}
                        {(item.fotoProsesUrl || (item.fotoProsesList && item.fotoProsesList.length > 0)) && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                title: `Proses Pengerjaan: ${item.namaProyek}`,
                                url: item.fotoProsesUrl || item.fotoProsesList![0],
                                category: 'proses',
                              })
                            }
                            className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 text-[10px] font-bold border border-blue-200 cursor-pointer"
                            title="Lihat Foto Proses"
                          >
                            Proses{item.fotoProsesList && item.fotoProsesList.length > 1 ? ` (${item.fotoProsesList.length})` : ''}
                          </button>
                        )}
                        {item.fotoSesudahUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                title: `Sesudah (100%): ${item.namaProyek}`,
                                url: item.fotoSesudahUrl!,
                                category: 'sesudah',
                              })
                            }
                            className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200 cursor-pointer"
                            title="Lihat Foto Sesudah"
                          >
                            100%
                          </button>
                        )}
                        {!item.fotoSebelumUrl && !item.fotoProsesUrl && (!item.fotoProsesList || item.fotoProsesList.length === 0) && !item.fotoSesudahUrl && (
                          <span className="text-[10px] text-slate-400 italic">Nihil</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => promptDeleteItem(item)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                          title="Hapus Data"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL FORM INPUT / EDIT REALISASI PEMBANGUNAN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-blue-200 shadow-2xl custom-scrollbar">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-t-3xl flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-300">
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">
                    {editingItem ? 'Edit Realisasi Pembangunan' : 'Form Realisasi Pembangunan Baru'}
                  </h3>
                  <p className="text-xs text-blue-300 font-medium">
                    Seksi Pembangunan • Kelurahan Mangga
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-semibold text-slate-800">
              {formError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2.5 animate-shake">
                  <div className="p-1 rounded-full bg-rose-100 text-rose-600 shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </div>
                  <span>{formError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Wilayah Lingkungan */}
                <div>
                  <label className="block text-slate-700 font-black mb-1">
                    Wilayah Lingkungan *
                  </label>
                  <select
                    value={formLingkunganNo}
                    onChange={(e) => setFormLingkunganNo(Number(e.target.value))}
                    disabled={isKeplingRole && Boolean(currentUser.nomorLingkungan)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 disabled:opacity-75"
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((no) => (
                      <option key={no} value={no}>
                        Lingkungan {no}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Jenis Pembangunan */}
                <div>
                  <label className="block text-slate-700 font-black mb-1">
                    Bidang Pembangunan *
                  </label>
                  <select
                    value={formJenis}
                    onChange={(e) => setFormJenis(e.target.value as JenisPembangunanType)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PERBAIKAN_JALAN">🛣️ Perbaikan Jalan (Pengaspalan / Rabat)</option>
                    <option value="PERBAIKAN_DRAINASE">🌊 Perbaikan Drainase (Parit / U-Ditch)</option>
                    <option value="PEMASANGAN_PAVING_BLOK">🧱 Pemasangan Paving Blok</option>
                    <option value="PERBAIKAN_LAMPU_LPJU">💡 Perbaikan Lampu LPJU (Mati/Rusak)</option>
                    <option value="PENAMBAHAN_TIANG_LPJU">🔌 Penambahan Tiang LPJU Baru</option>
                  </select>
                </div>
              </div>

              {/* Nama Proyek */}
              <div>
                <label className="block text-slate-700 font-black mb-1">
                  Nama Proyek / Kegiatan Pembangunan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pengaspalan Hotmix & Patching Jl. Bunga Raya Gg. Melati"
                  value={formNamaProyek}
                  onChange={(e) => setFormNamaProyek(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Lokasi Detail */}
              <div>
                <label className="block text-slate-700 font-black mb-1">
                  Lokasi Detail Wilayah *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Jl. Bunga Raya Gg. Melati Lingkungan I dekat Mushola"
                  value={formLokasiDetail}
                  onChange={(e) => setFormLokasiDetail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Volume Realisasi */}
                <div>
                  <label className="block text-slate-700 font-black mb-1">
                    Volume Realisasi *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 250 Meter / 5 Tiang Baru / 10 Titik Lampu"
                    value={formVolume}
                    onChange={(e) => setFormVolume(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Pelaksana Kegiatan */}
                <div>
                  <label className="block text-slate-700 font-black mb-1">
                    Pelaksana Kegiatan *
                  </label>
                  <select
                    value={formSumberDana}
                    onChange={(e) => setFormSumberDana(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Dinas SDABMBK Kota Medan">Dinas SDABMBK Kota Medan</option>
                    <option value="Dinas Perkim Kota Medan">Dinas Perkim Kota Medan</option>
                    <option value="Dinas Perhubungan (Dishub)">Dinas Perhubungan (Dishub)</option>
                    <option value="APBD Kota Medan">APBD Kota Medan</option>
                    <option value="Pokir DPRD Kota Medan">Pokir DPRD Kota Medan</option>
                    <option value="Dana Kelurahan Mangga">Dana Kelurahan Mangga</option>
                    <option value="Swadaya Masyarakat">Swadaya Masyarakat</option>
                  </select>
                </div>

                {/* Status Realisasi */}
                <div>
                  <label className="block text-slate-700 font-black mb-1">
                    Status Realisasi *
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as StatusRealisasiType)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="SELESAI_100%">✅ Selesai 100%</option>
                    <option value="PROSES_PENGERJAAN">⏳ Proses Pengerjaan</option>
                    <option value="USULAN">💡 Usulan Proyek</option>
                    <option value="PEMELIHARAAN">🛠️ Pemeliharaan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Tanggal Mulai & Tanggal Selesai */}
                <div>
                  <label className="block text-slate-700 font-black mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={formTglMulai}
                    onChange={(e) => setFormTglMulai(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-black mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={formTglSelesai}
                    onChange={(e) => setFormTglSelesai(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Dokumentasi Foto Lapangan (Upload Langsung dari Kamera HP / Galeri) */}
              <div className="p-4 bg-gradient-to-br from-blue-50/80 via-slate-50 to-indigo-50/60 rounded-2xl border border-blue-200/80 space-y-4">
                <div>
                  <div className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                    <Camera className="w-4 h-4 text-blue-700" />
                    <span>Dokumentasi Foto Lapangan (Upload HP / Kamera)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Ambil foto langsung dengan kamera HP di lokasi proyek atau pilih dari galeri HP Anda.
                  </p>
                </div>

                {/* Hidden File Inputs for Mobile Camera & Gallery */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileBeforeCameraRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProcessImage(file, 'sebelum');
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <input
                  type="file"
                  accept="image/*"
                  ref={fileBeforeGalleryRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProcessImage(file, 'sebelum');
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                {/* Hidden File Inputs for Foto Proses (Camera & Multi-Gallery) */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileProsesCameraRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProcessImage(file, 'proses');
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={fileProsesGalleryRef}
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) handleProcessImage(files, 'proses');
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileAfterCameraRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProcessImage(file, 'sesudah');
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <input
                  type="file"
                  accept="image/*"
                  ref={fileAfterGalleryRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProcessImage(file, 'sesudah');
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Foto Sebelum (Before) */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5 shadow-3xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        Foto Sebelum (0%)
                      </label>
                      {formFotoSebelum && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          ✓ Foto Siap
                        </span>
                      )}
                    </div>

                    {formFotoSebelum ? (
                      <div className="space-y-2">
                        <div className="relative rounded-xl overflow-hidden border border-slate-200 group bg-slate-900 h-36">
                          <img
                            src={formFotoSebelum}
                            alt="Foto Sebelum"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewPhoto({
                                  title: 'Foto Sebelum (0%)',
                                  url: formFotoSebelum,
                                  category: 'sebelum',
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Lihat</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormFotoSebelum('')}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                title: 'Foto Sebelum (0%)',
                                url: formFotoSebelum,
                                category: 'sebelum',
                              })
                            }
                            className="text-[10px] text-blue-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Perbesar Foto</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormFotoSebelum('')}
                            className="text-[10px] text-rose-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Ganti / Hapus</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {isProcessingBefore ? (
                          <div className="h-28 rounded-xl bg-blue-50 border border-blue-200 border-dashed flex flex-col items-center justify-center gap-2 text-blue-700">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-[11px] font-bold">Memproses foto dari HP...</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => fileBeforeCameraRef.current?.click()}
                              className="h-24 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 flex flex-col items-center justify-center gap-1.5 p-2 transition-all cursor-pointer group active:scale-95 shadow-3xs"
                            >
                              <div className="p-2 rounded-full bg-blue-600 text-white group-hover:scale-110 transition-transform">
                                <Camera className="w-4 h-4" />
                              </div>
                              <span className="text-[11px] font-black leading-tight text-center">
                                Kamera HP
                              </span>
                              <span className="text-[9px] text-blue-700 font-medium">Jepret Langsung</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => fileBeforeGalleryRef.current?.click()}
                              className="h-24 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 flex flex-col items-center justify-center gap-1.5 p-2 transition-all cursor-pointer group active:scale-95 shadow-3xs"
                            >
                              <div className="p-2 rounded-full bg-slate-700 text-white group-hover:scale-110 transition-transform">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                              <span className="text-[11px] font-black leading-tight text-center">
                                Galeri HP
                              </span>
                              <span className="text-[9px] text-slate-500 font-medium">Pilih dari File</span>
                            </button>
                          </div>
                        )}

                        <div className="pt-1">
                          {showUrlInputBefore ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="url"
                                placeholder="Paste link URL gambar..."
                                value={formFotoSebelum}
                                onChange={(e) => setFormFotoSebelum(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[10px]"
                              />
                              <button
                                type="button"
                                onClick={() => setShowUrlInputBefore(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowUrlInputBefore(true)}
                              className="text-[10px] text-blue-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Link2 className="w-3 h-3" />
                              <span>Atau masukkan link URL foto</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Foto Proses Pengerjaan (Sedang Dikerjakan / On-Progress) */}
                  <div className="bg-white p-3.5 rounded-xl border border-blue-200 space-y-2.5 shadow-3xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                        Foto Proses (Sedang Dikerjakan)
                      </label>
                      {(formFotoProses || formFotoProsesList.length > 0) && (
                        <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          ✓ {formFotoProsesList.length || 1} Foto Siap
                        </span>
                      )}
                    </div>

                    {/* Optional Quick Preset Links */}
                    <div className="flex items-center justify-between text-[10px] text-blue-800 bg-blue-50/60 px-2.5 py-1.5 rounded-lg border border-blue-100">
                      <span className="font-bold">Contoh Foto Lapangan:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {CONTOH_FOTO_PROSES_LIST.map((cth, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (!formFotoProsesList.includes(cth.url)) {
                                setFormFotoProsesList((prev) => [...prev, cth.url]);
                              }
                              setFormFotoProses(cth.url);
                              showToast(`Foto proses "${cth.nama}" dipilih`);
                            }}
                            className="text-[9px] font-bold text-blue-700 hover:text-blue-900 bg-white px-1.5 py-0.5 rounded border border-blue-200 cursor-pointer shadow-3xs hover:bg-blue-50"
                          >
                            + {cth.nama.split(' ')[0]} {cth.nama.split(' ')[1]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {formFotoProses || formFotoProsesList.length > 0 ? (
                      <div className="space-y-2">
                        {/* Main Featured Photo */}
                        <div className="relative rounded-xl overflow-hidden border border-blue-300 group bg-slate-900 h-36">
                          <img
                            src={formFotoProses || formFotoProsesList[0]}
                            alt="Foto Proses"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewPhoto({
                                  title: 'Foto Proses (Sedang Dikerjakan)',
                                  url: formFotoProses || formFotoProsesList[0],
                                  category: 'proses',
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Lihat</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const currentUrl = formFotoProses || formFotoProsesList[0];
                                const updatedList = formFotoProsesList.filter((u) => u !== currentUrl);
                                setFormFotoProsesList(updatedList);
                                setFormFotoProses(updatedList[0] || '');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </div>

                        {/* Multi-Photo Thumbnails */}
                        {formFotoProsesList.length > 1 && (
                          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                            {formFotoProsesList.map((pUrl, pIdx) => (
                              <div
                                key={pIdx}
                                className={`relative w-12 h-12 rounded-lg overflow-hidden border shrink-0 cursor-pointer ${
                                  formFotoProses === pUrl ? 'border-blue-600 ring-2 ring-blue-400' : 'border-slate-200 opacity-80 hover:opacity-100'
                                }`}
                                onClick={() => setFormFotoProses(pUrl)}
                              >
                                <img src={pUrl} alt={`Foto ${pIdx + 1}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updated = formFotoProsesList.filter((_, i) => i !== pIdx);
                                    setFormFotoProsesList(updated);
                                    if (formFotoProses === pUrl) setFormFotoProses(updated[0] || '');
                                  }}
                                  className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-rose-600 text-white rounded-full text-[8px]"
                                  title="Hapus foto ini"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                title: 'Foto Proses (Sedang Dikerjakan)',
                                url: formFotoProses || formFotoProsesList[0],
                                category: 'proses',
                              })
                            }
                            className="text-[10px] text-blue-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Perbesar Foto</span>
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => fileProsesGalleryRef.current?.click()}
                              className="text-[10px] text-blue-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <span>+ Tambah Foto</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormFotoProses('');
                                setFormFotoProsesList([]);
                              }}
                              className="text-[10px] text-rose-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Reset</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {isProcessingProses ? (
                          <div className="h-28 rounded-xl bg-blue-50 border border-blue-200 border-dashed flex flex-col items-center justify-center gap-2 text-blue-700">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-[11px] font-bold">Memproses foto dari HP...</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => fileProsesCameraRef.current?.click()}
                              className="h-24 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 flex flex-col items-center justify-center gap-1.5 p-2 transition-all cursor-pointer group active:scale-95 shadow-3xs"
                            >
                              <div className="p-2 rounded-full bg-blue-600 text-white group-hover:scale-110 transition-transform">
                                <Camera className="w-4 h-4" />
                              </div>
                              <span className="text-[11px] font-black leading-tight text-center">
                                Kamera HP
                              </span>
                              <span className="text-[9px] text-blue-700 font-medium">Jepret Langsung</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => fileProsesGalleryRef.current?.click()}
                              className="h-24 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 flex flex-col items-center justify-center gap-1.5 p-2 transition-all cursor-pointer group active:scale-95 shadow-3xs"
                            >
                              <div className="p-2 rounded-full bg-slate-700 text-white group-hover:scale-110 transition-transform">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                              <span className="text-[11px] font-black leading-tight text-center">
                                Galeri HP
                              </span>
                              <span className="text-[9px] text-slate-500 font-medium">Bisa Banyak Foto</span>
                            </button>
                          </div>
                        )}

                        <div className="pt-1">
                          {showUrlInputProses ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="url"
                                placeholder="Paste link URL gambar proses..."
                                value={customProsesUrl}
                                onChange={(e) => setCustomProsesUrl(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[10px]"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (customProsesUrl.trim()) {
                                    setFormFotoProses(customProsesUrl.trim());
                                    setFormFotoProsesList((prev) => [...prev, customProsesUrl.trim()]);
                                    setCustomProsesUrl('');
                                    setShowUrlInputProses(false);
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg cursor-pointer shrink-0"
                              >
                                Pasang
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowUrlInputProses(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowUrlInputProses(true)}
                              className="text-[10px] text-blue-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Link2 className="w-3 h-3" />
                              <span>Atau masukkan link URL foto proses</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Foto Sesudah (After 100%) */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5 shadow-3xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        Foto Sesudah (After 100%)
                      </label>
                      {formFotoSesudah && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          ✓ Foto Siap
                        </span>
                      )}
                    </div>

                    {formFotoSesudah ? (
                      <div className="space-y-2">
                        <div className="relative rounded-xl overflow-hidden border border-emerald-200 group bg-slate-900 h-36">
                          <img
                            src={formFotoSesudah}
                            alt="Foto Sesudah"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewPhoto({
                                  title: 'Foto Sesudah (After 100%)',
                                  url: formFotoSesudah,
                                  category: 'sesudah',
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Lihat</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormFotoSesudah('')}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                title: 'Foto Sesudah (After 100%)',
                                url: formFotoSesudah,
                                category: 'sesudah',
                              })
                            }
                            className="text-[10px] text-emerald-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Perbesar Foto</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormFotoSesudah('')}
                            className="text-[10px] text-rose-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Ganti / Hapus</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {isProcessingAfter ? (
                          <div className="h-28 rounded-xl bg-emerald-50 border border-emerald-200 border-dashed flex flex-col items-center justify-center gap-2 text-emerald-700">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-[11px] font-bold">Memproses foto dari HP...</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => fileAfterCameraRef.current?.click()}
                              className="h-24 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 flex flex-col items-center justify-center gap-1.5 p-2 transition-all cursor-pointer group active:scale-95 shadow-3xs"
                            >
                              <div className="p-2 rounded-full bg-emerald-600 text-white group-hover:scale-110 transition-transform">
                                <Camera className="w-4 h-4" />
                              </div>
                              <span className="text-[11px] font-black leading-tight text-center">
                                Kamera HP
                              </span>
                              <span className="text-[9px] text-emerald-700 font-medium">Jepret Langsung</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => fileAfterGalleryRef.current?.click()}
                              className="h-24 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 flex flex-col items-center justify-center gap-1.5 p-2 transition-all cursor-pointer group active:scale-95 shadow-3xs"
                            >
                              <div className="p-2 rounded-full bg-slate-700 text-white group-hover:scale-110 transition-transform">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                              <span className="text-[11px] font-black leading-tight text-center">
                                Galeri HP
                              </span>
                              <span className="text-[9px] text-slate-500 font-medium">Pilih dari File</span>
                            </button>
                          </div>
                        )}

                        <div className="pt-1">
                          {showUrlInputAfter ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="url"
                                placeholder="Paste link URL gambar..."
                                value={formFotoSesudah}
                                onChange={(e) => setFormFotoSesudah(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[10px]"
                              />
                              <button
                                type="button"
                                onClick={() => setShowUrlInputAfter(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowUrlInputAfter(true)}
                              className="text-[10px] text-emerald-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Link2 className="w-3 h-3" />
                              <span>Atau masukkan link URL foto</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block text-slate-700 font-black mb-1">Keterangan / Catatan Progres</label>
                <textarea
                  rows={2}
                  placeholder="Catatan tambahan hasil pengerjaan di lapangan..."
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-900"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-extrabold shadow-md transition-all cursor-pointer"
                >
                  {editingItem ? 'Simpan Perubahan' : 'Tambahkan Realisasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW PHOTO MODAL */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 text-white rounded-3xl max-w-xl w-full p-5 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-100 truncate pr-4">
                {previewPhoto.title}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden max-h-96 bg-black flex items-center justify-center">
              <img src={previewPhoto.url} alt={previewPhoto.title} referrerPolicy="no-referrer" className="w-full h-full object-contain" />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 cursor-pointer"
              >
                Tutup Foto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRM DELETE MODAL (MOBILE & IFRAME COMPATIBLE) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-100 text-rose-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Hapus Laporan Ini?
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Konfirmasi penghapusan data realisasi pembangunan
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-600 bg-slate-200 px-2 py-0.5 rounded text-[10px]">
                  Lingkungan {itemToDelete.lingkunganNomor}
                </span>
                <span className="font-bold text-slate-500 text-[11px]">
                  {itemToDelete.sumberDana}
                </span>
              </div>
              <p className="font-black text-slate-900 leading-snug">
                {itemToDelete.namaProyek}
              </p>
              <p className="text-[11px] text-slate-600">
                📍 {itemToDelete.lokasiDetail}
              </p>
            </div>

            <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-100">
              ⚠️ Perhatian: Data yang dihapus tidak dapat dipulihkan.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteItem}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR ALL SAMPLES MODAL */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-100 text-amber-700">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Bersihkan Semua Contoh Data?
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Mulai dari lembar kerja kosong
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini akan mengosongkan seluruh {items.length} contoh data laporan agar Anda dapat mengisi data riil baru langsung dari awal. (Anda tetap dapat memuat kembali data contoh kapan saja melalui tombol di halaman kosong).
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmClearAll}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Bersihkan Semua</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2.5 animate-slide-up backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
