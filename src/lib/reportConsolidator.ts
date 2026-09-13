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
    poskamlingKeterangan: combineTextNotes(eKin.poskamlingKeterangan, iKin.poskamlingKeterangan),

    kegiatanLainnya: combineTextNotes(eKin.kegiatanLainnya, iKin.kegiatanLainnya),
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
