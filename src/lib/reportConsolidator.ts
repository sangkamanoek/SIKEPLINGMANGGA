import { LaporanHarianItem, KinerjaHarian, FotoDokumentasi } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { isReportMatchingKepling, getReportIsoDate, extractNomorLingkungan } from './formatter';

function parseNumber(val: number | string | undefined): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const parsed = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

function combineTextNotes(existing?: string, incoming?: string): string {
  if (!existing || !existing.trim()) return incoming ? incoming.trim() : '';
  if (!incoming || !incoming.trim()) return existing.trim();
  const ex = existing.trim();
  const inc = incoming.trim();
  if (ex.toLowerCase() === inc.toLowerCase()) return ex;
  if (ex.toLowerCase().includes(inc.toLowerCase())) return ex;
  if (inc.toLowerCase().includes(ex.toLowerCase())) return inc;
  return `${ex}\n• ${inc}`;
}

/**
 * Normalizes report's Kepling identity to a standard key (e.g. 'kepling_5')
 */
export function normalizeKeplingKey(report: LaporanHarianItem): string {
  if (!report) return 'unknown';
  if (report.keplingId) {
    const id = report.keplingId.toLowerCase();
    if (id.startsWith('kepling_')) return id;
  }
  const match = KEPLING_ACCOUNTS.find((k) => isReportMatchingKepling(report, k));
  if (match) return match.id;

  const lkNum = extractNomorLingkungan(report.jabatan || (report as any).lingkungan);
  if (lkNum > 0) return `kepling_${lkNum}`;

  return (report.namaKepling || '').trim().toLowerCase();
}

/**
 * Gets the standard ISO YYYY-MM-DD date key of a report
 */
export function getReportDateKey(report: LaporanHarianItem): string {
  return getReportIsoDate(report);
}

/**
 * Checks whether two reports belong to the exact same Kepling on the exact same date
 */
export function isSameKeplingAndDate(a: LaporanHarianItem, b: LaporanHarianItem): boolean {
  if (!a || !b) return false;
  const dateA = getReportDateKey(a);
  const dateB = getReportDateKey(b);
  if (dateA !== dateB) return false;

  const keyA = normalizeKeplingKey(a);
  const keyB = normalizeKeplingKey(b);
  if (keyA && keyB && keyA === keyB) return true;

  return false;
}

/**
 * Consolidates multiple submissions from the same Kepling on the same date
 * into one single unified daily report item.
 */
export function consolidateDailyReport(
  existing: LaporanHarianItem,
  incoming: LaporanHarianItem
): LaporanHarianItem {
  // If the same object or identical ID
  if (existing.id === incoming.id) {
    return { ...existing, ...incoming };
  }

  const eKin: Partial<KinerjaHarian> = existing.kinerja || {};
  const iKin: Partial<KinerjaHarian> = incoming.kinerja || {};

  const mergedKinerja: KinerjaHarian = {
    opsirPbbWp: parseNumber(eKin.opsirPbbWp) + parseNumber(iKin.opsirPbbWp),
    opsirPbbKeterangan: combineTextNotes(eKin.opsirPbbKeterangan, iKin.opsirPbbKeterangan),

    perlinsosKk: parseNumber(eKin.perlinsosKk) + parseNumber(iKin.perlinsosKk),
    perlinsosKeterangan: combineTextNotes(eKin.perlinsosKeterangan, iKin.perlinsosKeterangan),
    perlinsosKategoriKegiatan: iKin.perlinsosKategoriKegiatan || eKin.perlinsosKategoriKegiatan || '',
    perlinsosMenolakKk: parseNumber(eKin.perlinsosMenolakKk) + parseNumber(iKin.perlinsosMenolakKk),
    perlinsosMenolakRincian: combineTextNotes(eKin.perlinsosMenolakRincian, iKin.perlinsosMenolakRincian),
    perlinsosTidakDiTempatKk: parseNumber(eKin.perlinsosTidakDiTempatKk) + parseNumber(iKin.perlinsosTidakDiTempatKk),
    perlinsosTidakDiTempatRincian: combineTextNotes(eKin.perlinsosTidakDiTempatRincian, iKin.perlinsosTidakDiTempatRincian),

    ikdOrang: parseNumber(eKin.ikdOrang) + parseNumber(iKin.ikdOrang),
    ikdKeterangan: combineTextNotes(eKin.ikdKeterangan, iKin.ikdKeterangan),

    bpjsKetenagakerjaanOrang: parseNumber(eKin.bpjsKetenagakerjaanOrang) + parseNumber(iKin.bpjsKetenagakerjaanOrang),
    bpjsKetenagakerjaanKeterangan: combineTextNotes(eKin.bpjsKetenagakerjaanKeterangan, iKin.bpjsKetenagakerjaanKeterangan),

    poskamlingAdaGiat: Boolean(eKin.poskamlingAdaGiat || iKin.poskamlingAdaGiat),
    poskamlingStatus: iKin.poskamlingStatus || eKin.poskamlingStatus || '',
    poskamlingLokasi: iKin.poskamlingLokasi || eKin.poskamlingLokasi || '',
    poskamlingPetugas: iKin.poskamlingPetugas || eKin.poskamlingPetugas || '',
    poskamlingJumlahPetugas: iKin.poskamlingJumlahPetugas || eKin.poskamlingJumlahPetugas || '',
    poskamlingJamOperasional: iKin.poskamlingJamOperasional || eKin.poskamlingJamOperasional || '',
    poskamlingKeterangan: combineTextNotes(eKin.poskamlingKeterangan, iKin.poskamlingKeterangan),

    // Tugas Tambahan POSYANDU & Layanan Kesehatan Warga
    posyanduAdaGiat: Boolean(iKin.posyanduAdaGiat || eKin.posyanduAdaGiat),
    posyanduNama: iKin.posyanduNama || eKin.posyanduNama || '',
    posyanduLokasi: iKin.posyanduLokasi || eKin.posyanduLokasi || '',
    posyanduJumlahPetugasKader: iKin.posyanduJumlahPetugasKader || eKin.posyanduJumlahPetugasKader || '',
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

  // Merge Documentation Photos deduplicated by ID, URL, or name
  const existingPhotos: FotoDokumentasi[] = existing.dokumentasiFoto || [];
  const incomingPhotos: FotoDokumentasi[] = incoming.dokumentasiFoto || [];

  const photoMap = new Map<string, FotoDokumentasi>();
  existingPhotos.forEach((p) => {
    const key = p.url || p.id || p.name || `photo_${Math.random()}`;
    photoMap.set(key, p);
  });
  incomingPhotos.forEach((p) => {
    const key = p.url || p.id || p.name || `photo_${Math.random()}`;
    if (!photoMap.has(key)) {
      photoMap.set(key, p);
    }
  });

  const mergedPhotos = Array.from(photoMap.values());

  // Keep the earlier createdAt to preserve original chronological order
  const eTime = existing.createdAt ? new Date(existing.createdAt).getTime() : Date.now();
  const iTime = incoming.createdAt ? new Date(incoming.createdAt).getTime() : Date.now();
  const earliestCreatedAt = eTime <= iTime ? existing.createdAt : incoming.createdAt;

  return {
    ...existing,
    kinerja: mergedKinerja,
    dokumentasiFoto: mergedPhotos,
    jumlahDokumentasi: mergedPhotos.length,
    createdAt: earliestCreatedAt || existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Consolidates an array of reports so that all multiple submissions for the same Kepling
 * on the same date are automatically merged into single unified reports.
 */
export function consolidateAllReports(reports: LaporanHarianItem[]): LaporanHarianItem[] {
  if (!Array.isArray(reports) || reports.length === 0) return [];

  const groups = new Map<string, LaporanHarianItem>();

  for (const rep of reports) {
    if (!rep || !rep.id) continue;
    const keplingKey = normalizeKeplingKey(rep);
    const dateKey = getReportDateKey(rep);
    const groupKey = `${keplingKey}_${dateKey}`;

    const existing = groups.get(groupKey);
    if (!existing) {
      groups.set(groupKey, rep);
    } else {
      // Consolidate with existing report
      const consolidated = consolidateDailyReport(existing, rep);
      groups.set(groupKey, consolidated);
    }
  }

  const result = Array.from(groups.values());
  result.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return result;
}

/**
 * Finds an existing report in the list for the exact same Kepling on the exact same date.
 */
export function findMatchingDailyReport(
  reports: LaporanHarianItem[],
  item: LaporanHarianItem
): LaporanHarianItem | undefined {
  if (!Array.isArray(reports) || !item) return undefined;
  return reports.find((r) => r.id !== item.id && isSameKeplingAndDate(r, item));
}
