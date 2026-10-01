import { LaporanHarianItem, KinerjaHarian, FotoDokumentasi } from '../types';

function parseNumber(val: number | string | undefined): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const parsed = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

function combineTextNotes(existing?: string, incoming?: string): string {
  if (!existing || !existing.trim()) return incoming || '';
  if (!incoming || !incoming.trim()) return existing;
  if (existing.trim() === incoming.trim()) return existing;
  if (existing.includes(incoming.trim())) return existing;
  return `${existing.trim()}\n• ${incoming.trim()}`;
}

/**
 * Consolidates multiple submissions from the same Kepling on the same date
 * into one single daily report item.
 */
export function consolidateDailyReport(
  existing: LaporanHarianItem,
  incoming: LaporanHarianItem
): LaporanHarianItem {
  const eKin: Partial<KinerjaHarian> = existing.kinerja || {};
  const iKin: Partial<KinerjaHarian> = incoming.kinerja || {};

  const mergedKinerja: KinerjaHarian = {
    opsirPbbWp: parseNumber(eKin.opsirPbbWp) + parseNumber(iKin.opsirPbbWp),
    opsirPbbKeterangan: combineTextNotes(eKin.opsirPbbKeterangan, iKin.opsirPbbKeterangan),

    perlinsosKk: parseNumber(eKin.perlinsosKk) + parseNumber(iKin.perlinsosKk),
    perlinsosKeterangan: combineTextNotes(eKin.perlinsosKeterangan, iKin.perlinsosKeterangan),
    perlinsosKategoriKegiatan: iKin.perlinsosKategoriKegiatan || eKin.perlinsosKategoriKegiatan,
    perlinsosMenolakKk: parseNumber(eKin.perlinsosMenolakKk) + parseNumber(iKin.perlinsosMenolakKk),
    perlinsosMenolakRincian: combineTextNotes(eKin.perlinsosMenolakRincian, iKin.perlinsosMenolakRincian),
    perlinsosTidakDiTempatKk: parseNumber(eKin.perlinsosTidakDiTempatKk) + parseNumber(iKin.perlinsosTidakDiTempatKk),
    perlinsosTidakDiTempatRincian: combineTextNotes(eKin.perlinsosTidakDiTempatRincian, iKin.perlinsosTidakDiTempatRincian),

    ikdOrang: parseNumber(eKin.ikdOrang) + parseNumber(iKin.ikdOrang),
    ikdKeterangan: combineTextNotes(eKin.ikdKeterangan, iKin.ikdKeterangan),

    bpjsKetenagakerjaanOrang: parseNumber(eKin.bpjsKetenagakerjaanOrang) + parseNumber(iKin.bpjsKetenagakerjaanOrang),
    bpjsKetenagakerjaanKeterangan: combineTextNotes(eKin.bpjsKetenagakerjaanKeterangan, iKin.bpjsKetenagakerjaanKeterangan),

    poskamlingAdaGiat: Boolean(eKin.poskamlingAdaGiat || iKin.poskamlingAdaGiat),
    poskamlingStatus: iKin.poskamlingStatus || eKin.poskamlingStatus,
    poskamlingLokasi: iKin.poskamlingLokasi || eKin.poskamlingLokasi,
    poskamlingPetugas: iKin.poskamlingPetugas || eKin.poskamlingPetugas,
    poskamlingJumlahPetugas: iKin.poskamlingJumlahPetugas || eKin.poskamlingJumlahPetugas,
    poskamlingJamOperasional: iKin.poskamlingJamOperasional || eKin.poskamlingJamOperasional,
    poskamlingKeterangan: combineTextNotes(eKin.poskamlingKeterangan, iKin.poskamlingKeterangan),

    // Tugas Tambahan POSYANDU & Layanan Kesehatan Warga
    posyanduAdaGiat: Boolean(iKin.posyanduAdaGiat || eKin.posyanduAdaGiat),
    posyanduNama: iKin.posyanduNama || eKin.posyanduNama,
    posyanduLokasi: iKin.posyanduLokasi || eKin.posyanduLokasi,
    posyanduJumlahPetugasKader: iKin.posyanduJumlahPetugasKader || eKin.posyanduJumlahPetugasKader,
    posyanduJumlahWargaTotal: (parseNumber(iKin.posyanduJumlahWargaTotal) > 0 ? iKin.posyanduJumlahWargaTotal : eKin.posyanduJumlahWargaTotal) || '0',
    posyanduBayi02Tahun: (parseNumber(iKin.posyanduBayi02Tahun) > 0 ? iKin.posyanduBayi02Tahun : eKin.posyanduBayi02Tahun) || '0',
    posyanduBalita25Tahun: (parseNumber(iKin.posyanduBalita25Tahun) > 0 ? iKin.posyanduBalita25Tahun : eKin.posyanduBalita25Tahun) || '0',
    posyanduAnak612Tahun: (parseNumber(iKin.posyanduAnak612Tahun) > 0 ? iKin.posyanduAnak612Tahun : eKin.posyanduAnak612Tahun) || '0',
    posyanduRemaja1318Tahun: (parseNumber(iKin.posyanduRemaja1318Tahun) > 0 ? iKin.posyanduRemaja1318Tahun : eKin.posyanduRemaja1318Tahun) || '0',
    posyanduDewasaIbuHamil1959Tahun: (parseNumber(iKin.posyanduDewasaIbuHamil1959Tahun) > 0 ? iKin.posyanduDewasaIbuHamil1959Tahun : eKin.posyanduDewasaIbuHamil1959Tahun) || '0',
    posyanduLansia60TahunKeatas: (parseNumber(iKin.posyanduLansia60TahunKeatas) > 0 ? iKin.posyanduLansia60TahunKeatas : eKin.posyanduLansia60TahunKeatas) || '0',
    posyanduJenisLayanan: Array.from(new Set([...(eKin.posyanduJenisLayanan || []), ...(iKin.posyanduJenisLayanan || [])])),
    posyanduKeterangan: combineTextNotes(eKin.posyanduKeterangan, iKin.posyanduKeterangan),

    kegiatanLainnya: combineTextNotes(eKin.kegiatanLainnya, iKin.kegiatanLainnya),

    // Poin 6: Kegiatan Pemantauan Kondisi Infrastruktur Wilayah
    infrastrukturAdaGiat: Boolean(iKin.infrastrukturAdaGiat || eKin.infrastrukturAdaGiat),
    infrastrukturSubjek: iKin.infrastrukturSubjek && eKin.infrastrukturSubjek && iKin.infrastrukturSubjek !== eKin.infrastrukturSubjek
      ? `${eKin.infrastrukturSubjek}; ${iKin.infrastrukturSubjek}`
      : (iKin.infrastrukturSubjek || eKin.infrastrukturSubjek || ''),
    infrastrukturLokasi: iKin.infrastrukturLokasi && eKin.infrastrukturLokasi && iKin.infrastrukturLokasi !== eKin.infrastrukturLokasi
      ? `${eKin.infrastrukturLokasi} & ${iKin.infrastrukturLokasi}`
      : (iKin.infrastrukturLokasi || eKin.infrastrukturLokasi || ''),
    infrastrukturTitikKoordinat: iKin.infrastrukturTitikKoordinat || eKin.infrastrukturTitikKoordinat || '',
    infrastrukturTanggalPelaporan: iKin.infrastrukturTanggalPelaporan || eKin.infrastrukturTanggalPelaporan || incoming.tanggal || existing.tanggal || '',
    infrastrukturPelapor: iKin.infrastrukturPelapor || eKin.infrastrukturPelapor || incoming.namaKepling || existing.namaKepling || '',
  };

  // Merge Documentation Photos deduplicated by ID or URL
  const existingPhotos: FotoDokumentasi[] = existing.dokumentasiFoto || [];
  const incomingPhotos: FotoDokumentasi[] = incoming.dokumentasiFoto || [];

  const photoMap = new Map<string, FotoDokumentasi>();
  existingPhotos.forEach((p) => photoMap.set(p.id || p.url, p));
  incomingPhotos.forEach((p) => photoMap.set(p.id || p.url, p));

  const mergedPhotos = Array.from(photoMap.values());

  return {
    ...existing,
    kinerja: mergedKinerja,
    dokumentasiFoto: mergedPhotos,
    jumlahDokumentasi: mergedPhotos.length,
    updatedAt: new Date().toISOString(),
  };
}
