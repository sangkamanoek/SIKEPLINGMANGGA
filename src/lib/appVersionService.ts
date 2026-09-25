export interface VersionRelease {
  version: string;
  releaseDate: string;
  title: string;
  badge?: string;
  isImportant?: boolean;
  highlights: string[];
  changes: {
    category: 'FITUR BARU' | 'PERBAIKAN' | 'PENINGKATAN';
    description: string;
  }[];
}

export const CURRENT_APP_VERSION = 'v2.4.2';
export const CURRENT_RELEASE_DATE = '26 September 2026';

export const APP_VERSION_HISTORY: VersionRelease[] = [
  {
    version: 'v2.4.2',
    releaseDate: '26 September 2026',
    title: 'Pembaruan Fitur Perlinsos, WebGIS & Info Update Aplikasi',
    badge: 'TERBARU',
    isImportant: true,
    highlights: [
      'Pilihan status "MENOLAK" pada Perlinsos Kunjungan Warga',
      'Perbaikan klasifikasi WebGIS (Puskesmas & Faskes terpisah dari Sekolah)',
      'Panel Indikator Sinkronisasi Real-Time di Dashboard',
      'Notifikasi & Banner Info Pembaruan Otomatis Aplikasi Kepling'
    ],
    changes: [
      {
        category: 'FITUR BARU',
        description: 'Menambahkan opsi "MENOLAK" pada isian Perlinsos di Form Kunjungan Warga (pilihan: Sudah, Belum, Menolak).'
      },
      {
        category: 'FITUR BARU',
        description: 'Panel Ringkasan Status Sinkronisasi Real-Time multi-layanan (Firebase Cloud DB, Google Sheets, IndexedDB) dengan animasi berkedip saat sync.'
      },
      {
        category: 'FITUR BARU',
        description: 'Sistem Informasi Pembaruan Aplikasi Kepling: Popup "Apa yang Baru", banner pembaruan terdeteksi, dan tombol muat ulang cepat.'
      },
      {
        category: 'PERBAIKAN',
        description: 'Memperbaiki algoritma kategorisasi fasilitas WebGIS agar Puskesmas, Pustu, Klinik, dan Posyandu tidak keliru digolongkan ke Sekolah.'
      },
      {
        category: 'PENINGKATAN',
        description: 'Penyempurnaan deteksi offline-first dan sinkronisasi otomatis latar belakang 0ms.'
      }
    ]
  },
  {
    version: 'v2.4.0',
    releaseDate: '25 September 2026',
    title: 'WebGIS 24 Lingkungan & Integrasi Data PBB Spasial',
    highlights: [
      'Visualisasi peta poligon 24 Lingkungan Kelurahan Mangga Prima',
      'Pemetaan WRS, Bansos, dan Kondisi Jalan',
      'Dashboard Terpadu SmartHub & Manajemen PBB'
    ],
    changes: [
      {
        category: 'FITUR BARU',
        description: 'Modul Peta Spasial WebGIS interaktif dengan penanda titik rumah warga, koordinat GPS, dan layer tematik.'
      },
      {
        category: 'PENINGKATAN',
        description: 'Integrasi data PBB dengan filter per-lingkungan dan realisasi penerimaan pajak.'
      }
    ]
  },
  {
    version: 'v2.3.0',
    releaseDate: '24 September 2026',
    title: 'Presensi Apel Pagi Geotagged & Offline Engine',
    highlights: [
      'Presensi Apel Pagi GPS & Kamera Selfie',
      'Penyimpanan Offline IndexedDB',
      'Rekapitulasi Kehadiran 24 Kepling Super Admin'
    ],
    changes: [
      {
        category: 'FITUR BARU',
        description: 'Fitur Presensi Apel Pagi Senin - Jumat (07.30 - 08.30 WIB) dengan validasi radius GPS dan foto selfie.'
      },
      {
        category: 'PENINGKATAN',
        description: 'Penyimpanan lokal tangguh berbasis IndexedDB yang mendukung kerja tanpa sinyal internet.'
      }
    ]
  }
];

const STORAGE_KEY_SEEN_VERSION = 'sikepling_last_seen_app_version';
const STORAGE_KEY_UPDATE_BANNER_DISMISSED = 'sikepling_update_banner_dismissed_v';

/**
 * Get the current app version
 */
export function getCurrentAppVersion(): string {
  return CURRENT_APP_VERSION;
}

/**
 * Get the latest version release information
 */
export function getLatestReleaseInfo(): VersionRelease {
  return APP_VERSION_HISTORY[0];
}

/**
 * Check if the user has not yet viewed the latest version changelog
 */
export function hasUnseenAppUpdate(): boolean {
  try {
    const lastSeen = localStorage.getItem(STORAGE_KEY_SEEN_VERSION);
    if (!lastSeen) return true; // First time or new update
    return lastSeen !== CURRENT_APP_VERSION;
  } catch {
    return false;
  }
}

/**
 * Check if the floating update banner is currently dismissed for the current version
 */
export function isUpdateBannerDismissed(): boolean {
  try {
    const dismissed = localStorage.getItem(`${STORAGE_KEY_UPDATE_BANNER_DISMISSED}${CURRENT_APP_VERSION}`);
    return dismissed === 'true';
  } catch {
    return false;
  }
}

/**
 * Dismiss the update notification banner for the current version
 */
export function dismissUpdateBanner(): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_UPDATE_BANNER_DISMISSED}${CURRENT_APP_VERSION}`, 'true');
  } catch {}
}

/**
 * Mark the current version as viewed by the user
 */
export function markAppVersionAsSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY_SEEN_VERSION, CURRENT_APP_VERSION);
    localStorage.setItem(`${STORAGE_KEY_UPDATE_BANNER_DISMISSED}${CURRENT_APP_VERSION}`, 'true');
  } catch {}
}

/**
 * Trigger quick refresh / cache bust to ensure user gets latest assets
 */
export async function reloadAppWithLatestVersion(): Promise<void> {
  markAppVersionAsSeen();
  
  // Unregister existing service workers if needed to force immediate update
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.update();
      }
    } catch {}
  }

  // Clear relevant session caches and reload
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      for (const key of keys) {
        if (key.includes('v') || key.includes('app')) {
          await caches.delete(key);
        }
      }
    } catch {}
  }

  window.location.reload();
}
