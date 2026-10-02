import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { CetakLaporanPembangunanModal } from './CetakLaporanPembangunanModal';
import { downloadImage, downloadProjectPhotosAsZip, getHighResImageUrl } from '../lib/imageDownloader';
import { safeSetLocalStorage, safeGetLocalStorage } from '../lib/safeStorage';

interface RealisasiPembangunanViewProps {
  currentUser: UserAccount;
}

const STORAGE_KEY = PEMBANGUNAN_STORAGE_KEY;

// Helper function to compress image files from phone camera / gallery with crisp HD quality & storage-friendly size
const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200; // Optimal HD resolution (1200px max)
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
};

// Preset realistic project documentary photos for Medan Kelurahan Mangga
export const CONTOH_FOTO_SEBELUM_LIST = [
  {
    nama: 'Jalan Aspal Berlubang & Rusak Parah',
    kategori: 'Kondisi Awal (0%)',
    url: '/src/assets/images/awal_rusak_jalan_1790856694359.jpg',
  },
  {
    nama: 'Parit Drainase Tersumbat Sampah & Lumpur',
    kategori: 'Kondisi Awal (0%)',
    url: '/src/assets/images/awal_parit_tersumbat_1790856713835.jpg',
  },
  {
    nama: 'Gang Pemukiman Becek & Tanah Rusak',
    kategori: 'Kondisi Awal (0%)',
    url: '/src/assets/images/awal_gang_becek_tanah_1790856733273.jpg',
  },
];

export const CONTOH_FOTO_PROSES_LIST = [
  {
    nama: 'Pengaspalan Hotmix & Pemadatan Roller Slender',
    kategori: 'Pekerjaan Jalan (50%)',
    url: '/src/assets/images/proses_hotmix_roller_1790856748105.jpg',
  },
  {
    nama: 'Pekerja Meratakan Hotmix Aspal Lingkungan',
    kategori: 'Pekerjaan Jalan (50%)',
    url: '/src/assets/images/proses_aspal_jalan_1790846460460.jpg',
  },
  {
    nama: 'Galian Parit & Pemasangan U-Ditch Beton Precast',
    kategori: 'Pekerjaan Drainase (50%)',
    url: '/src/assets/images/proses_galian_uditch_1790856763018.jpg',
  },
  {
    nama: 'Pemasangan Saluran Drainase U-Ditch Lapangan',
    kategori: 'Pekerjaan Drainase (50%)',
    url: '/src/assets/images/proses_drainase_uditch_1790846472119.jpg',
  },
  {
    nama: 'Penyusunan Paving Blok Abu-abu K-300',
    kategori: 'Pekerjaan Paving (50%)',
    url: '/src/assets/images/proses_susun_paving_1790856780731.jpg',
  },
  {
    nama: 'Teknisi Instalasi Ornamen Tiang & Lampu LPJU Baru',
    kategori: 'Penerangan Jalan (50%)',
    url: '/src/assets/images/proses_instalasi_lpju_1790856798909.jpg',
  },
];

export const CONTOH_FOTO_SESUDAH_LIST = [
  {
    nama: 'Jalan Lingkungan Aspal Mulus & Rapi',
    kategori: 'Kondisi Selesai (100%)',
    url: '/src/assets/images/selesai_aspal_mulus_1790856816426.jpg',
  },
  {
    nama: 'Saluran Drainase U-Ditch Bersih & Lancar',
    kategori: 'Kondisi Selesai (100%)',
    url: '/src/assets/images/selesai_drainase_rapi_1790856831691.jpg',
  },
  {
    nama: 'Pemasangan Paving Blok Tuntas Rapi & Bersih',
    kategori: 'Kondisi Selesai (100%)',
    url: '/src/assets/images/selesai_paving_cantik_1790856850675.jpg',
  },
];

// Initial realistic seed data for Kelurahan Mangga (24 Lingkungan) with 3-4-3 Multi-Photo Documentation
const INITIAL_REALISASI_DATA: RealisasiPembangunan[] = [
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
    fotoSebelumUrl: '/src/assets/images/awal_rusak_jalan_1790856694359.jpg',
    fotoSebelumList: [
      '/src/assets/images/awal_rusak_jalan_1790856694359.jpg',
      '/src/assets/images/awal_gang_becek_tanah_1790856733273.jpg',
      'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=1600&auto=format&fit=crop&q=90',
    ],
    fotoProsesUrl: '/src/assets/images/proses_hotmix_roller_1790856748105.jpg',
    fotoProsesList: [
      '/src/assets/images/proses_hotmix_roller_1790856748105.jpg',
      '/src/assets/images/proses_aspal_jalan_1790846460460.jpg',
      '/src/assets/images/proses_galian_uditch_1790856763018.jpg',
      '/src/assets/images/proses_susun_paving_1790856780731.jpg',
    ],
    fotoSesudahUrl: '/src/assets/images/selesai_aspal_mulus_1790856816426.jpg',
    fotoSesudahList: [
      '/src/assets/images/selesai_aspal_mulus_1790856816426.jpg',
      'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=1600&auto=format&fit=crop&q=90',
      'https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?w=1600&auto=format&fit=crop&q=90',
    ],
    keterangan: 'Akses jalan utama Lingkungan I sudah mulus dan lancar dilalui kendaraan warga.',
    createdAt: '2026-08-26T10:00:00.000Z',
    createdByName: 'M. Syafi’i (Kepling I)',
  },
  {
    id: 'pemb_2_paving',
    lingkunganId: 'kepling_2',
    lingkunganNomor: 2,
    jenisPembangunan: 'PEMASANGAN_PAVING_BLOK',
    namaProyek: 'Pemasangan Paving Blok Jl. Irigasi Gang Warga',
    lokasiDetail: 'Jl. Irigasi Lk II Gang Damai',
    sumberDana: 'Dinas SDABMBK Kota Medan',
    statusRealisasi: 'SELESAI_100%',
    volumeRealisasi: '120 Meter',
    biayaEstimasiRp: 45000000,
    tanggalMulai: '2026-08-20',
    tanggalSelesai: '2026-08-24',
    pelaksanaTeknis: 'Pokmas Lingkungan II',
    fotoSebelumUrl: '/src/assets/images/awal_gang_becek_tanah_1790856733273.jpg',
    fotoSebelumList: [
      '/src/assets/images/awal_gang_becek_tanah_1790856733273.jpg',
      '/src/assets/images/awal_rusak_jalan_1790856694359.jpg',
      'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?w=1600&auto=format&fit=crop&q=90',
    ],
    fotoProsesUrl: '/src/assets/images/proses_susun_paving_1790856780731.jpg',
    fotoProsesList: [
      '/src/assets/images/proses_susun_paving_1790856780731.jpg',
      '/src/assets/images/proses_paving_block_1790846485222.jpg',
      '/src/assets/images/proses_hotmix_roller_1790856748105.jpg',
      '/src/assets/images/proses_galian_uditch_1790856763018.jpg',
    ],
    fotoSesudahUrl: '/src/assets/images/selesai_paving_cantik_1790856850675.jpg',
    fotoSesudahList: [
      '/src/assets/images/selesai_paving_cantik_1790856850675.jpg',
      'https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?w=1600&auto=format&fit=crop&q=90',
      'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=1600&auto=format&fit=crop&q=90',
    ],
    keterangan: 'Pemasangan paving block rapi dan kokoh di jalan lingkungan warga.',
    createdAt: '2026-08-24T11:08:38.000Z',
    createdByName: 'Zulkarnaen Tarigan (Kepling II)',
  },
  {
    id: 'pemb_2',
    lingkunganId: 'kepling_3',
    lingkunganNomor: 3,
    jenisPembangunan: 'PERBAIKAN_DRAINASE',
    namaProyek: 'Normalisasi Parit & Pemasangan U-Ditch Beton Precast',
    lokasiDetail: 'Jl. Bunga Mawar Gg. Sejahtera Lingkungan III',
    sumberDana: 'APBD Kota Medan',
    statusRealisasi: 'SELESAI_100%',
    volumeRealisasi: '150 Meter',
    biayaEstimasiRp: 98000000,
    tanggalMulai: '2026-07-01',
    tanggalSelesai: '2026-07-20',
    pelaksanaTeknis: 'Dinas SDABMBK',
    fotoSebelumUrl: '/src/assets/images/awal_parit_tersumbat_1790856713835.jpg',
    fotoSebelumList: [
      '/src/assets/images/awal_parit_tersumbat_1790856713835.jpg',
      '/src/assets/images/awal_rusak_jalan_1790856694359.jpg',
      'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?w=1600&auto=format&fit=crop&q=90',
    ],
    fotoProsesUrl: '/src/assets/images/proses_galian_uditch_1790856763018.jpg',
    fotoProsesList: [
      '/src/assets/images/proses_galian_uditch_1790856763018.jpg',
      '/src/assets/images/proses_drainase_uditch_1790846472119.jpg',
      '/src/assets/images/proses_hotmix_roller_1790856748105.jpg',
      '/src/assets/images/proses_susun_paving_1790856780731.jpg',
    ],
    fotoSesudahUrl: '/src/assets/images/selesai_drainase_rapi_1790856831691.jpg',
    fotoSesudahList: [
      '/src/assets/images/selesai_drainase_rapi_1790856831691.jpg',
      'https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?w=1600&auto=format&fit=crop&q=90',
      'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=1600&auto=format&fit=crop&q=90',
    ],
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
    pelaksanaTeknis: 'Dinas Perkim & Dishub',
    fotoSebelumUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=1600&auto=format&fit=crop&q=90',
    fotoSebelumList: [
      'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=1600&auto=format&fit=crop&q=90',
      '/src/assets/images/awal_gang_becek_tanah_1790856733273.jpg',
      '/src/assets/images/awal_rusak_jalan_1790856694359.jpg',
    ],
    fotoProsesUrl: '/src/assets/images/proses_instalasi_lpju_1790856798909.jpg',
    fotoProsesList: [
      '/src/assets/images/proses_instalasi_lpju_1790856798909.jpg',
      '/src/assets/images/proses_lampu_lpju_1790846499280.jpg',
      '/src/assets/images/proses_hotmix_roller_1790856748105.jpg',
      '/src/assets/images/proses_galian_uditch_1790856763018.jpg',
    ],
    fotoSesudahUrl: 'https://images.unsplash.com/photo-1517685352821-92cf88aee5a5?w=1600&auto=format&fit=crop&q=90',
    fotoSesudahList: [
      'https://images.unsplash.com/photo-1517685352821-92cf88aee5a5?w=1600&auto=format&fit=crop&q=90',
      'https://images.unsplash.com/photo-1508873696983-2df515122519?w=1600&auto=format&fit=crop&q=90',
      '/src/assets/images/selesai_aspal_mulus_1790856816426.jpg',
    ],
    keterangan: 'Jalanan lingkungan terang benderang pada malam hari, meningkatkan keamanan warga.',
    createdAt: '2026-09-09T08:30:00.000Z',
    createdByName: 'Bambang S. (Kepling V)',
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
    fotoSebelumUrl: '/src/assets/images/awal_gang_becek_tanah_1790856733273.jpg',
    fotoSebelumList: [
      '/src/assets/images/awal_gang_becek_tanah_1790856733273.jpg',
      '/src/assets/images/awal_rusak_jalan_1790856694359.jpg',
      'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=1600&auto=format&fit=crop&q=90',
    ],
    fotoProsesUrl: '/src/assets/images/proses_hotmix_roller_1790856748105.jpg',
    fotoProsesList: [
      '/src/assets/images/proses_hotmix_roller_1790856748105.jpg',
      '/src/assets/images/proses_aspal_jalan_1790846460460.jpg',
      '/src/assets/images/proses_susun_paving_1790856780731.jpg',
      '/src/assets/images/proses_galian_uditch_1790856763018.jpg',
    ],
    fotoSesudahUrl: '',
    fotoSesudahList: [],
    keterangan: 'Pengerjaan rabat beton telah mencapai progres 65%.',
    createdAt: '2026-09-21T14:00:00.000Z',
    createdByName: 'Herman (Kepling XII)',
  },
];

export const RealisasiPembangunanView: React.FC<RealisasiPembangunanViewProps> = ({ currentUser }) => {
  // Persistence state
  const [items, setItems] = useState<RealisasiPembangunan[]>(() => {
    return safeGetLocalStorage<RealisasiPembangunan[]>(STORAGE_KEY, INITIAL_REALISASI_DATA);
  });

  useEffect(() => {
    safeSetLocalStorage(STORAGE_KEY, JSON.stringify(items));
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
  const [isCetakModalOpen, setIsCetakModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RealisasiPembangunan | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{
    title: string;
    url: string;
    category: string;
    allPhotos?: string[];
    currentIndex?: number;
    projectItem?: RealisasiPembangunan;
  } | null>(null);

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
  
  // 3-Stage Multi-Photos: Sebelum (0%), Proses (50%), Sesudah (100%)
  const [formFotoSebelum, setFormFotoSebelum] = useState('');
  const [formFotoSebelumList, setFormFotoSebelumList] = useState<string[]>([]);
  const [formFotoProses, setFormFotoProses] = useState('');
  const [formFotoProsesList, setFormFotoProsesList] = useState<string[]>([]);
  const [formFotoSesudah, setFormFotoSesudah] = useState('');
  const [formFotoSesudahList, setFormFotoSesudahList] = useState<string[]>([]);
  const [formKeterangan, setFormKeterangan] = useState('');

  // Photo Upload States & Refs for Mobile Camera / Gallery
  const [isProcessingBefore, setIsProcessingBefore] = useState(false);
  const [isProcessingProses, setIsProcessingProses] = useState(false);
  const [isProcessingAfter, setIsProcessingAfter] = useState(false);
  const [showUrlInputBefore, setShowUrlInputBefore] = useState(false);
  const [showUrlInputProses, setShowUrlInputProses] = useState(false);
  const [showUrlInputAfter, setShowUrlInputAfter] = useState(false);
  const [customSebelumUrl, setCustomSebelumUrl] = useState('');
  const [customProsesUrl, setCustomProsesUrl] = useState('');
  const [customSesudahUrl, setCustomSesudahUrl] = useState('');

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
          setFormFotoSebelumList((prev) => [...prev, compressedDataUrl]);
          setFormFotoSebelum(compressedDataUrl);
        } else if (type === 'proses') {
          setFormFotoProsesList((prev) => [...prev, compressedDataUrl]);
          setFormFotoProses(compressedDataUrl);
        } else {
          setFormFotoSesudahList((prev) => [...prev, compressedDataUrl]);
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

  const removeSebelumPhoto = (idx: number) => {
    setFormFotoSebelumList((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      setFormFotoSebelum(updated[0] || '');
      return updated;
    });
  };

  const removeProsesPhoto = (idx: number) => {
    setFormFotoProsesList((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      setFormFotoProses(updated[0] || '');
      return updated;
    });
  };

  const removeSesudahPhoto = (idx: number) => {
    setFormFotoSesudahList((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      setFormFotoSesudah(updated[0] || '');
      return updated;
    });
  };

  const addSebelumPhotoUrl = () => {
    if (!customSebelumUrl.trim()) return;
    setFormFotoSebelumList((prev) => [...prev, customSebelumUrl.trim()]);
    setFormFotoSebelum(customSebelumUrl.trim());
    setCustomSebelumUrl('');
    setShowUrlInputBefore(false);
  };

  const addProsesPhotoUrl = () => {
    if (!customProsesUrl.trim()) return;
    setFormFotoProsesList((prev) => [...prev, customProsesUrl.trim()]);
    setFormFotoProses(customProsesUrl.trim());
    setCustomProsesUrl('');
    setShowUrlInputProses(false);
  };

  const addSesudahPhotoUrl = () => {
    if (!customSesudahUrl.trim()) return;
    setFormFotoSesudahList((prev) => [...prev, customSesudahUrl.trim()]);
    setFormFotoSesudah(customSesudahUrl.trim());
    setCustomSesudahUrl('');
    setShowUrlInputAfter(false);
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
    setFormFotoSebelumList([]);
    setFormFotoProses('');
    setFormFotoProsesList([]);
    setFormFotoSesudah('');
    setFormFotoSesudahList([]);
    setFormKeterangan('');
    setShowUrlInputBefore(false);
    setShowUrlInputProses(false);
    setShowUrlInputAfter(false);
    setCustomSebelumUrl('');
    setCustomProsesUrl('');
    setCustomSesudahUrl('');
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
    
    // Sebelum (0%)
    const sList = item.fotoSebelumList && item.fotoSebelumList.length > 0
      ? item.fotoSebelumList
      : item.fotoSebelumUrl
      ? [item.fotoSebelumUrl]
      : [];
    setFormFotoSebelum(item.fotoSebelumUrl || sList[0] || '');
    setFormFotoSebelumList(sList);

    // Proses (50%)
    const pList = item.fotoProsesList && item.fotoProsesList.length > 0
      ? item.fotoProsesList
      : item.fotoProsesUrl
      ? [item.fotoProsesUrl]
      : [];
    setFormFotoProses(item.fotoProsesUrl || pList[0] || '');
    setFormFotoProsesList(pList);

    // Sesudah (100%)
    const aList = item.fotoSesudahList && item.fotoSesudahList.length > 0
      ? item.fotoSesudahList
      : item.fotoSesudahUrl
      ? [item.fotoSesudahUrl]
      : [];
    setFormFotoSesudah(item.fotoSesudahUrl || aList[0] || '');
    setFormFotoSesudahList(aList);

    setFormKeterangan(item.keterangan || '');
    setShowUrlInputBefore(false);
    setShowUrlInputProses(false);
    setShowUrlInputAfter(false);
    setCustomSebelumUrl('');
    setCustomProsesUrl('');
    setCustomSesudahUrl('');
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

    const cleanSebelumList = formFotoSebelumList.length > 0 ? formFotoSebelumList : (formFotoSebelum ? [formFotoSebelum] : []);
    const cleanProsesList = formFotoProsesList.length > 0 ? formFotoProsesList : (formFotoProses ? [formFotoProses] : []);
    const cleanSesudahList = formFotoSesudahList.length > 0 ? formFotoSesudahList : (formFotoSesudah ? [formFotoSesudah] : []);

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
        fotoSebelumUrl: cleanSebelumList[0] || formFotoSebelum.trim() || undefined,
        fotoSebelumList: cleanSebelumList.length > 0 ? cleanSebelumList : undefined,
        fotoProsesUrl: cleanProsesList[0] || formFotoProses.trim() || undefined,
        fotoProsesList: cleanProsesList.length > 0 ? cleanProsesList : undefined,
        fotoSesudahUrl: cleanSesudahList[0] || formFotoSesudah.trim() || undefined,
        fotoSesudahList: cleanSesudahList.length > 0 ? cleanSesudahList : undefined,
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
        fotoSebelumUrl: cleanSebelumList[0] || formFotoSebelum.trim() || undefined,
        fotoSebelumList: cleanSebelumList.length > 0 ? cleanSebelumList : undefined,
        fotoProsesUrl: cleanProsesList[0] || formFotoProses.trim() || undefined,
        fotoProsesList: cleanProsesList.length > 0 ? cleanProsesList : undefined,
        fotoSesudahUrl: cleanSesudahList[0] || formFotoSesudah.trim() || undefined,
        fotoSesudahList: cleanSesudahList.length > 0 ? cleanSesudahList : undefined,
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
      <div className="p-6 sm:p-7 rounded-2xl bg-slate-900 text-white shadow-md relative overflow-hidden border border-slate-800 space-y-5">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Top Metadata & Title */}
        <div className="space-y-2 relative z-10">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5 text-blue-300">
              <Wrench className="w-3.5 h-3.5 text-blue-400" />
              <span>Seksi Pembangunan &amp; Fasilitas Publik</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>Kelurahan Mangga</span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <Database className="w-3.5 h-3.5" />
              <span>Database Terhubung</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
            Realisasi Pembangunan Infrastruktur Wilayah
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl font-normal leading-relaxed">
            Monitoring realisasi perbaikan jalan, normalisasi drainase, perbaikan lampu LPJU, dan penambahan tiang LPJU baru secara akuntabel di 24 Lingkungan.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Input Realisasi Baru</span>
            </button>
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              title="Sinkronkan seluruh data ke database Firestore dan server"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan DB'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ekspor Excel</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCetakModalOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Buka Lembar Cetak Resmi Standar Kedinasan Pemko Medan &amp; Dokumentasi Foto Lengkap"
            >
              <Printer className="w-3.5 h-3.5 text-white" />
              <span>Cetak Laporan Resmi</span>
            </button>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearAllModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Hapus Semua Contoh Data Laporan"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Bersihkan Contoh Data</span>
            </button>
          )}
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

                  {/* Photo Gallery 3-Stage: Sebelum (0%), Proses (50%), Sesudah (100%) */}
                  {(() => {
                    const sebelumPhotos = Array.from(new Set([
                      ...(item.fotoSebelumList || []),
                      ...(item.fotoSebelumUrl ? [item.fotoSebelumUrl] : [])
                    ])).filter(Boolean);

                    const prosesPhotos = Array.from(new Set([
                      ...(item.fotoProsesList || []),
                      ...(item.fotoProsesUrl ? [item.fotoProsesUrl] : [])
                    ])).filter(Boolean);

                    const sesudahPhotos = Array.from(new Set([
                      ...(item.fotoSesudahList || []),
                      ...(item.fotoSesudahUrl ? [item.fotoSesudahUrl] : [])
                    ])).filter(Boolean);

                    const allProjectPhotos = [...sebelumPhotos, ...prosesPhotos, ...sesudahPhotos];

                    return (
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-3 gap-2">
                          {/* 1. SEBELUM (0%) */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="block text-[8px] sm:text-[9px] font-black uppercase tracking-tight truncate text-amber-700">
                                📷 Sebelum (0%)
                              </span>
                              {sebelumPhotos.length > 0 && (
                                <span className="text-[8px] font-extrabold px-1 py-0.2 bg-amber-100 text-amber-900 rounded">
                                  {sebelumPhotos.length} Foto
                                </span>
                              )}
                            </div>
                            {sebelumPhotos.length > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    title: `Foto Sebelum (0%): ${item.namaProyek}`,
                                    url: sebelumPhotos[0],
                                    category: 'sebelum',
                                    allPhotos: sebelumPhotos,
                                    currentIndex: 0,
                                    projectItem: item,
                                  })
                                }
                                className="w-full h-24 sm:h-28 rounded-xl overflow-hidden border border-amber-300 relative group cursor-pointer bg-slate-900 block shadow-3xs"
                              >
                                <img
                                  src={sebelumPhotos[0]}
                                  alt="Foto Sebelum"
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center text-white text-[10px] font-bold">
                                  <Eye className="w-4 h-4" />
                                </div>
                              </button>
                            ) : (
                              <div className="w-full h-24 sm:h-28 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-[9px] text-slate-400 font-semibold p-1 text-center">
                                Belum ada foto
                              </div>
                            )}
                          </div>

                          {/* 2. PROSES (50%) */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="block text-[8px] sm:text-[9px] font-black uppercase tracking-tight truncate text-blue-700">
                                🔨 Proses (50%)
                              </span>
                              {prosesPhotos.length > 0 && (
                                <span className="text-[8px] font-extrabold px-1 py-0.2 bg-blue-100 text-blue-900 rounded">
                                  {prosesPhotos.length} Foto
                                </span>
                              )}
                            </div>
                            {prosesPhotos.length > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    title: `Foto Proses (50%): ${item.namaProyek}`,
                                    url: prosesPhotos[0],
                                    category: 'proses',
                                    allPhotos: prosesPhotos,
                                    currentIndex: 0,
                                    projectItem: item,
                                  })
                                }
                                className="w-full h-24 sm:h-28 rounded-xl overflow-hidden border border-blue-300 relative group cursor-pointer bg-slate-900 block shadow-3xs"
                              >
                                <img
                                  src={prosesPhotos[0]}
                                  alt="Foto Proses"
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center text-white text-[10px] font-bold">
                                  <Eye className="w-4 h-4" />
                                </div>
                              </button>
                            ) : (
                              <div className="w-full h-24 sm:h-28 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-[9px] text-slate-400 font-semibold p-1 text-center">
                                Belum ada foto
                              </div>
                            )}
                          </div>

                          {/* 3. SESUDAH (100%) */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="block text-[8px] sm:text-[9px] font-black uppercase tracking-tight truncate text-emerald-700">
                                ✨ Selesai (100%)
                              </span>
                              {sesudahPhotos.length > 0 && (
                                <span className="text-[8px] font-extrabold px-1 py-0.2 bg-emerald-100 text-emerald-900 rounded">
                                  {sesudahPhotos.length} Foto
                                </span>
                              )}
                            </div>
                            {sesudahPhotos.length > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    title: `Foto Selesai (100%): ${item.namaProyek}`,
                                    url: sesudahPhotos[0],
                                    category: 'sesudah',
                                    allPhotos: sesudahPhotos,
                                    currentIndex: 0,
                                    projectItem: item,
                                  })
                                }
                                className="w-full h-24 sm:h-28 rounded-xl overflow-hidden border border-emerald-300 relative group cursor-pointer bg-slate-900 block shadow-3xs"
                              >
                                <img
                                  src={sesudahPhotos[0]}
                                  alt="Foto Sesudah"
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center text-white text-[10px] font-bold">
                                  <Eye className="w-4 h-4" />
                                </div>
                              </button>
                            ) : (
                              <div className="w-full h-24 sm:h-28 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-[9px] text-slate-400 font-semibold p-1 text-center">
                                {item.statusRealisasi === 'PROSES_PENGERJAAN' ? 'Sedang Dikerjakan' : 'Belum ada foto'}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quick Download / Full Details Action */}
                        {allProjectPhotos.length > 0 && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                            <span className="text-slate-500 font-medium">
                              Total {allProjectPhotos.length} Foto Dokumentasi (HD)
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                allProjectPhotos.forEach((pUrl, pIdx) => {
                                  downloadImage(pUrl, `Lk_${item.lingkunganNomor}_${item.namaProyek}_Foto_${pIdx + 1}_HD.jpg`);
                                });
                                showToast(`Mengunduh ${allProjectPhotos.length} foto HD untuk proyek ${item.namaProyek}`);
                              }}
                              className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer"
                              title="Unduh seluruh foto proyek ini dalam format kualitas tinggi"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Unduh Semua Foto (HD)</span>
                            </button>
                          </div>
                        )}
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
                  multiple
                  ref={fileBeforeGalleryRef}
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) handleProcessImage(files, 'sebelum');
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
                  multiple
                  ref={fileAfterGalleryRef}
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) handleProcessImage(files, 'sesudah');
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* 1. Foto Sebelum (0%) - Minimal 3 Foto */}
                  <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-2.5 shadow-3xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        1. Kondisi Awal (0%)
                      </label>
                      {(formFotoSebelum || formFotoSebelumList.length > 0) && (
                        <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          ✓ {formFotoSebelumList.length || 1} Foto Siap
                        </span>
                      )}
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center justify-between text-[10px] text-amber-900 bg-amber-50/70 px-2 py-1.5 rounded-lg border border-amber-200">
                      <span className="font-bold">Contoh Cepat:</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {CONTOH_FOTO_SEBELUM_LIST.map((cth, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (!formFotoSebelumList.includes(cth.url)) {
                                setFormFotoSebelumList((prev) => [...prev, cth.url]);
                              }
                              setFormFotoSebelum(cth.url);
                              showToast(`Foto awal "${cth.nama}" ditambahkan.`);
                            }}
                            className="text-[9px] font-bold text-amber-800 hover:text-amber-950 bg-white px-1.5 py-0.5 rounded border border-amber-300 cursor-pointer shadow-3xs hover:bg-amber-100"
                          >
                            + {cth.nama.split(' ')[0]} {cth.nama.split(' ')[1]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {formFotoSebelum || formFotoSebelumList.length > 0 ? (
                      <div className="space-y-2">
                        <div className="relative rounded-xl overflow-hidden border border-amber-300 group bg-slate-900 h-36">
                          <img
                            src={formFotoSebelum || formFotoSebelumList[0]}
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
                                  url: formFotoSebelum || formFotoSebelumList[0],
                                  category: 'sebelum',
                                  allPhotos: formFotoSebelumList,
                                  currentIndex: 0,
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
                                const current = formFotoSebelum || formFotoSebelumList[0];
                                const updated = formFotoSebelumList.filter((u) => u !== current);
                                setFormFotoSebelumList(updated);
                                setFormFotoSebelum(updated[0] || '');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </div>

                        {/* Thumbnails */}
                        {formFotoSebelumList.length > 1 && (
                          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                            {formFotoSebelumList.map((pUrl, pIdx) => (
                              <div
                                key={pIdx}
                                className={`relative w-12 h-12 rounded-lg overflow-hidden border shrink-0 cursor-pointer ${
                                  formFotoSebelum === pUrl ? 'border-amber-600 ring-2 ring-amber-400' : 'border-slate-200 opacity-80 hover:opacity-100'
                                }`}
                                onClick={() => setFormFotoSebelum(pUrl)}
                              >
                                <img src={pUrl} alt={`Foto ${pIdx + 1}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeSebelumPhoto(pIdx);
                                  }}
                                  className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-rose-600 text-white rounded-full text-[8px]"
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
                            onClick={() => fileBeforeGalleryRef.current?.click()}
                            className="text-[10px] text-amber-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <span>+ Tambah Foto Awal</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFormFotoSebelum('');
                              setFormFotoSebelumList([]);
                            }}
                            className="text-[10px] text-rose-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {isProcessingBefore ? (
                          <div className="h-28 rounded-xl bg-amber-50 border border-amber-200 border-dashed flex flex-col items-center justify-center gap-2 text-amber-700">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-[11px] font-bold">Memproses foto dari HP...</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => fileBeforeCameraRef.current?.click()}
                              className="h-24 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 flex flex-col items-center justify-center gap-1.5 p-2 transition-all cursor-pointer group active:scale-95 shadow-3xs"
                            >
                              <div className="p-2 rounded-full bg-amber-600 text-white group-hover:scale-110 transition-transform">
                                <Camera className="w-4 h-4" />
                              </div>
                              <span className="text-[11px] font-black leading-tight text-center">
                                Kamera HP
                              </span>
                              <span className="text-[9px] text-amber-700 font-medium">Jepret Langsung</span>
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
                              <span className="text-[9px] text-slate-500 font-medium">Bisa Banyak Foto</span>
                            </button>
                          </div>
                        )}

                        <div className="pt-1">
                          {showUrlInputBefore ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="url"
                                placeholder="Paste link URL gambar awal..."
                                value={customSebelumUrl}
                                onChange={(e) => setCustomSebelumUrl(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[10px]"
                              />
                              <button
                                type="button"
                                onClick={addSebelumPhotoUrl}
                                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg cursor-pointer shrink-0"
                              >
                                Pasang
                              </button>
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
                              className="text-[10px] text-amber-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Link2 className="w-3 h-3" />
                              <span>Atau masukkan link URL foto</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Foto Proses Pengerjaan (50%) - Minimal 4 Foto */}
                  <div className="bg-white p-3.5 rounded-xl border border-blue-200 space-y-2.5 shadow-3xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                        2. Proses Pengerjaan (50%)
                      </label>
                      {(formFotoProses || formFotoProsesList.length > 0) && (
                        <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          ✓ {formFotoProsesList.length || 1} Foto Siap
                        </span>
                      )}
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center justify-between text-[10px] text-blue-800 bg-blue-50/60 px-2 py-1.5 rounded-lg border border-blue-100">
                      <span className="font-bold">Contoh Cepat:</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {CONTOH_FOTO_PROSES_LIST.slice(0, 3).map((cth, idx) => (
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
                                  allPhotos: formFotoProsesList,
                                  currentIndex: 0,
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
                                    removeProsesPhoto(pIdx);
                                  }}
                                  className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-rose-600 text-white rounded-full text-[8px]"
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
                            onClick={() => fileProsesGalleryRef.current?.click()}
                            className="text-[10px] text-blue-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <span>+ Tambah Foto Proses</span>
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
                                onClick={addProsesPhotoUrl}
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

                  {/* 3. Foto Sesudah (100%) - Minimal 3 Foto */}
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-2.5 shadow-3xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        3. Hasil Selesai (100%)
                      </label>
                      {(formFotoSesudah || formFotoSesudahList.length > 0) && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          ✓ {formFotoSesudahList.length || 1} Foto Siap
                        </span>
                      )}
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center justify-between text-[10px] text-emerald-900 bg-emerald-50/70 px-2 py-1.5 rounded-lg border border-emerald-200">
                      <span className="font-bold">Contoh Cepat:</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {CONTOH_FOTO_SESUDAH_LIST.map((cth, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (!formFotoSesudahList.includes(cth.url)) {
                                setFormFotoSesudahList((prev) => [...prev, cth.url]);
                              }
                              setFormFotoSesudah(cth.url);
                              showToast(`Foto selesai "${cth.nama}" ditambahkan.`);
                            }}
                            className="text-[9px] font-bold text-emerald-800 hover:text-emerald-950 bg-white px-1.5 py-0.5 rounded border border-emerald-300 cursor-pointer shadow-3xs hover:bg-emerald-100"
                          >
                            + {cth.nama.split(' ')[0]} {cth.nama.split(' ')[1]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {formFotoSesudah || formFotoSesudahList.length > 0 ? (
                      <div className="space-y-2">
                        <div className="relative rounded-xl overflow-hidden border border-emerald-300 group bg-slate-900 h-36">
                          <img
                            src={formFotoSesudah || formFotoSesudahList[0]}
                            alt="Foto Sesudah"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewPhoto({
                                  title: 'Foto Sesudah (100%)',
                                  url: formFotoSesudah || formFotoSesudahList[0],
                                  category: 'sesudah',
                                  allPhotos: formFotoSesudahList,
                                  currentIndex: 0,
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
                                const current = formFotoSesudah || formFotoSesudahList[0];
                                const updated = formFotoSesudahList.filter((u) => u !== current);
                                setFormFotoSesudahList(updated);
                                setFormFotoSesudah(updated[0] || '');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </div>

                        {/* Thumbnails */}
                        {formFotoSesudahList.length > 1 && (
                          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                            {formFotoSesudahList.map((pUrl, pIdx) => (
                              <div
                                key={pIdx}
                                className={`relative w-12 h-12 rounded-lg overflow-hidden border shrink-0 cursor-pointer ${
                                  formFotoSesudah === pUrl ? 'border-emerald-600 ring-2 ring-emerald-400' : 'border-slate-200 opacity-80 hover:opacity-100'
                                }`}
                                onClick={() => setFormFotoSesudah(pUrl)}
                              >
                                <img src={pUrl} alt={`Foto ${pIdx + 1}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeSesudahPhoto(pIdx);
                                  }}
                                  className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-rose-600 text-white rounded-full text-[8px]"
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
                            onClick={() => fileAfterGalleryRef.current?.click()}
                            className="text-[10px] text-emerald-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <span>+ Tambah Foto Selesai</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFormFotoSesudah('');
                              setFormFotoSesudahList([]);
                            }}
                            className="text-[10px] text-rose-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Reset</span>
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
                              <span className="text-[9px] text-slate-500 font-medium">Bisa Banyak Foto</span>
                            </button>
                          </div>
                        )}

                        <div className="pt-1">
                          {showUrlInputAfter ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="url"
                                placeholder="Paste link URL gambar..."
                                value={customSesudahUrl}
                                onChange={(e) => setCustomSesudahUrl(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[10px]"
                              />
                              <button
                                type="button"
                                onClick={addSesudahPhotoUrl}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg cursor-pointer shrink-0"
                              >
                                Pasang
                              </button>
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

      {/* PREVIEW PHOTO MODAL (HIGH RESOLUTION WITH DOWNLOAD & MULTI-PHOTO SWITCHER) */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-slate-900 text-white rounded-3xl max-w-3xl w-full p-4 sm:p-6 border border-slate-700 shadow-2xl space-y-4 max-h-[95vh] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-100 truncate pr-4">
                  {previewPhoto.title}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Resolusi Penuh • Dokumentasi Asli Lapangan
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main High Res Image View */}
            <div className="rounded-2xl overflow-hidden max-h-[58vh] bg-black flex items-center justify-center border border-slate-800">
              <img
                src={getHighResImageUrl(previewPhoto.url)}
                alt={previewPhoto.title}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                className="w-full h-full max-h-[58vh] object-contain"
              />
            </div>

            {/* Multi-photo switcher if available */}
            {previewPhoto.allPhotos && previewPhoto.allPhotos.length > 1 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                  Pilih Foto Lainnya di Tahap Ini ({previewPhoto.allPhotos.length} Foto):
                </span>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {previewPhoto.allPhotos.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPreviewPhoto((prev) => prev ? { ...prev, url, currentIndex: idx } : null)}
                      className={`relative w-14 h-14 rounded-xl overflow-hidden border shrink-0 cursor-pointer transition-all ${
                        previewPhoto.url === url ? 'ring-2 ring-blue-400 border-white scale-105' : 'border-slate-700 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={`Foto ${idx + 1}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-center font-bold">
                        #{idx + 1}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const success = await downloadImage(
                      previewPhoto.url,
                      `${previewPhoto.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_HD.jpg`
                    );
                    if (success) {
                      showToast('Foto resolusi tinggi berhasil diunduh!');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all"
                  title="Unduh foto resolusi tinggi ke galeri / penyimpanan perangkat"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Foto HD</span>
                </button>

                {previewPhoto.projectItem && (
                  <button
                    type="button"
                    onClick={() => {
                      const p = previewPhoto.projectItem!;
                      const allPhotos = Array.from(new Set([
                        ...(p.fotoSebelumList || []),
                        ...(p.fotoSebelumUrl ? [p.fotoSebelumUrl] : []),
                        ...(p.fotoProsesList || []),
                        ...(p.fotoProsesUrl ? [p.fotoProsesUrl] : []),
                        ...(p.fotoSesudahList || []),
                        ...(p.fotoSesudahUrl ? [p.fotoSesudahUrl] : []),
                      ])).filter(Boolean);

                      allPhotos.forEach((pUrl, pIdx) => {
                        downloadImage(pUrl, `Lk_${p.lingkunganNomor}_${p.namaProyek}_Foto_${pIdx + 1}_HD.jpg`);
                      });
                      showToast(`Mengunduh seluruh ${allPhotos.length} foto HD proyek ini.`);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                  >
                    <span>Unduh Semua Foto Proyek</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CETAK LAPORAN STANDAR RESMI PEMKO MEDAN */}
      <CetakLaporanPembangunanModal
        isOpen={isCetakModalOpen}
        onClose={() => setIsCetakModalOpen(false)}
        items={filteredItems}
        currentUser={currentUser}
      />

      {/* IN-APP CONFIRM DELETE MODAL (MOBILE & IFRAME COMPATIBLE) */}
      {itemToDelete && createPortal(
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
        </div>,
        document.body
      )}

      {/* CLEAR ALL SAMPLES MODAL */}
      {isClearAllModalOpen && createPortal(
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
        </div>,
        document.body
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
