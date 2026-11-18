import { UserRole, isPkkRole } from '../types';
import type { AppTabType } from '../components/MobileBottomNav';

const SUPER_ADMIN_TABS: AppTabType[] = [
  'hub',
  'form',
  'capaian',
  'monitoring',
  'capaian_admin',
  'riwayat',
  'kunjungan',
  'dashboard_kasi',
  'rekap_pbb',
  'realisasi_pembangunan',
  'keuangan_pkk',
  'kegiatan_pkk',
  'posyandu_pkk',
  'dasa_wisma',
  'surat_kedinasan',
  'buku_pkk',
  'agenda',
  'jadwal_posko',
  'kegiatan_lurah',
  'absensi_kepling',
];

const SEKRETARIS_TABS: AppTabType[] = [
  'hub',
  'monitoring',
  'realisasi_pembangunan',
  'agenda',
  'jadwal_posko',
  'absensi_kepling',
  'capaian_admin',
  'capaian',
  'rekap_pbb',
  'surat_kedinasan',
  'kunjungan',
  'riwayat',
];

const KASI_PEMERINTAHAN_TABS: AppTabType[] = [
  'hub',
  'dashboard_kasi',
  'absensi_kepling',
  'rekap_pbb',
  'riwayat',
];

const KASI_PEMBANGUNAN_TABS: AppTabType[] = [
  'hub',
  'dashboard_kasi',
  'realisasi_pembangunan',
  'kunjungan',
  'riwayat',
];

const KASI_TRANTIBUM_TABS: AppTabType[] = [
  'hub',
  'dashboard_kasi',
  'jadwal_posko',
  'riwayat',
];

const PETUGAS_BAPENDA_TABS: AppTabType[] = [
  'hub',
  'rekap_pbb',
];

const KEPLING_TABS: AppTabType[] = [
  'hub',
  'form',
  'realisasi_pembangunan',
  'agenda',
  'jadwal_posko',
  'capaian',
  'rekap_pbb',
  'kunjungan',
  'riwayat',
];

const PKK_TABS: AppTabType[] = [
  'hub',
  'kegiatan_pkk',
  'keuangan_pkk',
  'posyandu_pkk',
  'dasa_wisma',
  'buku_pkk',
];

export function getAllowedTabsForRole(role: UserRole | string | undefined): AppTabType[] {
  if (!role) return ['hub'];
  if (role === 'super_admin') return SUPER_ADMIN_TABS;
  if (role === 'sekretaris') return SEKRETARIS_TABS;
  if (role === 'kasi_pemerintahan') return KASI_PEMERINTAHAN_TABS;
  if (role === 'kasi_pembangunan') return KASI_PEMBANGUNAN_TABS;
  if (role === 'kasi_trantibum') return KASI_TRANTIBUM_TABS;
  if (role === 'petugas_bapenda') return PETUGAS_BAPENDA_TABS;
  if (role === 'kepling') return KEPLING_TABS;
  if (isPkkRole(role)) return PKK_TABS;
  return ['hub'];
}

export function canAccountAccessTab(
  role: UserRole | string | undefined,
  tab: AppTabType | string
): boolean {
  const allowed = getAllowedTabsForRole(role);
  return allowed.includes(tab as AppTabType);
}

export function getAccessDeniedMessage(
  role: UserRole | string | undefined,
  tab: AppTabType | string
): string {
  if (tab === 'kegiatan_lurah') {
    return 'Akses Dibatasi: Menu Kegiatan Lurah hanya dapat diakses oleh akun Super Admin.';
  }
  if (tab === 'absensi_kepling') {
    return 'Akses Dibatasi: Absensi Apel Pagi & Agenda Kepala Lingkungan hanya dapat diakses oleh Lurah (Superadmin), Seklur, dan Kasi Pemerintahan.';
  }
  if (role === 'kasi_trantibum') {
    return 'Akses Dibatasi: Akun Kasi Trantibum hanya dapat mengakses tupoksi Trantibum, Jadwal Posko, & Arsip Trantibum.';
  }
  if (role === 'kasi_pemerintahan') {
    return 'Akses Dibatasi: Akun Kasi Tata Pemerintahan hanya dapat mengakses tupoksi Pemerintahan, PBB-P2, IKD, & Arsip Pemerintahan.';
  }
  if (role === 'kasi_pembangunan') {
    return 'Akses Dibatasi: Akun Kasi Pembangunan & Kesos hanya dapat mengakses tupoksi Perlinsos, Realisasi Pembangunan, Kunjungan Warga, & Arsip Pembangunan.';
  }
  if (role === 'petugas_bapenda') {
    return 'Akses Dibatasi: Akun Petugas Bapenda hanya dapat mengakses Rekapitulasi Realisasi PBB-P2.';
  }
  if (role === 'kepling' && tab === 'monitoring') {
    return 'Akses Dibatasi: Halaman Monitoring Laporan 24 Lingkungan khusus untuk Superadmin & Seklur.';
  }
  if (isPkkRole(role || '')) {
    return 'Akses Dibatasi: Halaman ini khusus untuk Aparatur Kelurahan.';
  }
  return 'Akses Dibatasi: Menu ini tidak termasuk dalam tupoksi akun Anda.';
}
