import { LaporanHarianItem } from '../types';
import { KEPLING_ACCOUNTS } from './keplingList';

const SAMPLE_PHOTO =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23065f46"/><text x="50%25" y="45%25" font-size="16" font-family="sans-serif" font-weight="bold" fill="%23ffffff" text-anchor="middle">DOKUMENTASI KEGIATAN LAPANGAN</text><text x="50%25" y="60%25" font-size="13" font-family="sans-serif" fill="%23a7f3d0" text-anchor="middle">KELURAHAN MANGGA - MEDAN TUNTUNGAN</text></svg>';

const LINGKUNGAN_STREETS: Record<number, string> = {
  1: 'Jl. Bunga Ncole Raya',
  2: 'Jl. Bunga Rinte Raya',
  3: 'Jl. Bunga Terompet Ujung',
  4: 'Jl. Bunga Rampai I-IV',
  5: 'Jl. Jamin Ginting Km 11.5',
  6: 'Jl. Bunga Sedap Malam',
  7: 'Jl. Bunga Pancur Simpang Gardu',
  8: 'Komplek Milala Mas & Perumahan',
  9: 'Jl. Bunga Ncole Gang Bersama',
  10: 'Jl. Bunga Melati Raya',
  11: 'Jl. Bunga Rinte Gang Sejahtera',
  12: 'Jl. Bunga Raya / Pasar Induk Lau Cih',
  13: 'Jl. Bunga Terompet Gang Dame',
  14: 'Jl. Bunga Asoka Gang Rasmi',
  15: 'Jl. Bunga Kenanga & Gang Melur',
  16: 'Jl. Bunga Cempaka Perumahan',
  17: 'Jl. Jamin Ginting Km 12',
  18: 'Jl. Bunga Mawar / Gang Tarigan',
  19: 'Jl. Bunga Kamboja Lingkungan XIX',
  20: 'Jl. Bunga Matahari Samping Puskesmas',
  21: 'Jl. Bunga Tanjung / Simpang Selayang',
  22: 'Jl. Bunga Bakung Gang Saudara',
  23: 'Jl. Bunga Terompet / Gang Gereja',
  24: 'Jl. Bunga Rinte / Royal Garden',
};

/**
 * Menghasilkan data laporan historis resmi untuk seluruh 24 Kepala Lingkungan
 * Tanggal: Senin, 14 September 2026
 */
export function generateInitialReports24Kepling(): LaporanHarianItem[] {
  return KEPLING_ACCOUNTS.map((k, index) => {
    const num = k.nomorLingkungan || index + 1;
    const street = LINGKUNGAN_STREETS[num] || `Lingkungan ${num}`;

    // Metric realistis per kepling
    const pbbWp = ((num * 3) % 4) + 1; // 1 s/d 4 WP
    const perlinsosKk = ((num * 5) % 6) + 2; // 2 s/d 7 KK
    const ikdOrang = ((num * 2) % 3) + 1; // 1 s/d 3 Orang
    const bpjsOrang = num % 2 === 0 ? 1 : 0; // 0 atau 1 Orang

    return {
      id: `lap_hist_kepling_${num}`,
      keplingId: k.id,
      hari: 'SENIN',
      tanggal: '14 SEPTEMBER 2026',
      namaKepling: k.nama.toUpperCase(),
      jabatan: k.jabatan,
      kelurahan: 'Kelurahan Mangga',
      kecamatan: 'Kecamatan Medan Tuntungan',
      kinerja: {
        opsirPbbWp: String(pbbWp),
        opsirPbbKeterangan: `Penyampaian SPPT PBB & penagihan door-to-door di ${street}`,
        perlinsosKk: String(perlinsosKk),
        perlinsosKeterangan: `Verifikasi faktual data terpadu Perlinsos DTKS warga di ${street}`,
        ikdOrang: String(ikdOrang),
        ikdKeterangan: `Pendampingan & aktivasi aplikasi IKD (Identitas Kependudukan Digital) di ${street}`,
        bpjsKetenagakerjaanOrang: String(bpjsOrang),
        bpjsKetenagakerjaanKeterangan:
          bpjsOrang > 0 ? `Sosialisasi dan pendaftaran pekerja rentan/informal di ${street}` : '',
        poskamlingAdaGiat: true,
        poskamlingStatus: 'Aktif Ronda Malam',
        poskamlingLokasi: `Pos Kamling ${k.lingkungan}`,
        poskamlingPetugas: `Kepling ${k.nama} & Warga Ronda`,
        poskamlingKeterangan: 'Patroli siskamling rutin malam hari, situasi lingkungan aman dan kondusif',
        kegiatanLainnya: `Monitoring kebersihan drainase dan ketertiban lingkungan di wilayah ${k.lingkungan}`,
      },
      jumlahDokumentasi: 1,
      dokumentasiFoto: [
        {
          id: `foto_hist_${num}`,
          url: SAMPLE_PHOTO,
          name: `Dokumentasi Kinerja ${k.lingkungan}`,
          timestamp: '2026-09-14T10:30:00Z',
        },
      ],
      createdAt: '2026-09-14T11:30:00.000Z',
    };
  });
}
