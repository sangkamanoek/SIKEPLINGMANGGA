import {
  AbsensiAgendaKepling,
  AbsensiApelHarian,
  JadwalPoskoItem,
  LaporanHarianItem,
  StatusApelPagi,
  StatusKehadiranKepling,
  TargetsCapaianMap,
} from '../types';
import { KEPLING_ACCOUNTS, getEffectiveProfile } from '../data/keplingList';
import {
  DEFAULT_PERLINSOS_TARGETS,
  calculateEffectiveKinerja,
  getDefaultTargetsCapaianMap,
} from '../data/targetsData';
import {
  getApelStatusScore,
  calculatePenaltiTanpaKeterangan,
  getLocalAbsensiApelList,
} from './absensiApelService';
import { getLocalAbsensiAgendaList } from './absensiAgendaService';
import { isKeplingPoskoDutyScored } from './jadwalPoskoService';
import { getLocalKunjunganList, KunjunganWargaData } from './kunjunganService';
import { getCachedPbbOverview, DEFAULT_PBB_YEAR } from './pbbService';
import {
  getReportIsoDate,
  isKunjunganMatchingKepling,
  isReportMatchingKepling,
} from './formatter';
import { safeGetLocalStorage } from './safeStorage';

const NAMA_BULAN_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export type KategoriRekomendasiLoket =
  | 'PRIORITAS_UTAMA'
  | 'ROTASI_PEMERATAAN'
  | 'PENDAMPINGAN_PEMBINAAN';

export interface KeplingEvaluasiBulanLalu {
  keplingId: string;
  nomorLingkungan: number;
  lingkungan: string;
  namaKepling: string;
  telepon: string;
  // Kehadiran & Disiplin
  apelTotalHari: number;
  apelHadir: number;
  apelTerlambat: number;
  apelIzin: number;
  apelSakit: number;
  apelAlpa: number;
  apelPercentage: number;
  agendaTotal: number;
  agendaHadir: number;
  agendaTidakHadir: number;
  agendaPercentage: number;
  // Riwayat Posko & Piket Loket bulan sebelumnya
  loketAssignedCount: number;
  loketHadirCount: number;
  loketTidakHadirCount: number;
  poskoTotalHadirCount: number;
  poskoTidakHadirCount: number;
  // Laporan & Kinerja Pelayanan
  hariMelapor: number;
  konsistensiPercentage: number;
  pbbReportedWp: number;
  pbbPercentage: number;
  perlinsosKk: number;
  perlinsosPercentage: number;
  ikdOrang: number;
  ikdPercentage: number;
  bpjsOrang: number;
  bpjsPercentage: number;
  kunjunganCount: number;
  kunjunganPercentage: number;
  // Skor Evaluasi & Penalti
  penaltiTanpaKeterangan: number;
  skorIkktEvaluasi: number;
  skorKesiapanLoket: number;
  kategori: KategoriRekomendasiLoket;
  alasanRekomendasi: string[];
  catatanPembinaan: string | null;
}

export interface SaranLoketSlot {
  loketNomor: number;
  kodeLoket: string;
  namaLoket: string;
  fokusLayanan: string;
  petugasUtama: KeplingEvaluasiBulanLalu[];
  petugasPendamping: KeplingEvaluasiBulanLalu[];
  ringkasanAlasan: string;
}

export interface HasilRekomendasiLoketAwalBulan {
  evalYearMonth: string;
  evalBulanLabel: string;
  targetYearMonth: string;
  targetBulanLabel: string;
  tanggalAwalKerjaTarget: string;
  hasAnyEvaluationData: boolean;
  totalApelDaysRecorded: number;
  totalLoketSchedulesLastMonth: number;
  totalReportsLastMonth: number;
  evaluasiSemuaKepling: KeplingEvaluasiBulanLalu[];
  loketAssignments: SaranLoketSlot[];
  kandidatUtama: KeplingEvaluasiBulanLalu[];
  kandidatRotasi: KeplingEvaluasiBulanLalu[];
  perluPembinaan: KeplingEvaluasiBulanLalu[];
  suggestedCombinedKeplingIds: string[];
}

export function getPreviousYearMonth(targetYm?: string, referenceDate: Date = new Date()): string {
  if (targetYm && /^\d{4}-\d{2}$/.test(targetYm)) {
    const [yStr, mStr] = targetYm.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) - 1;
    if (m <= 0) {
      m = 12;
      y -= 1;
    }
    return `${y}-${String(m).padStart(2, '0')}`;
  }
  const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getNextYearMonth(evalYm: string): string {
  if (!/^\d{4}-\d{2}$/.test(evalYm)) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const [yStr, mStr] = evalYm.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function formatYearMonthLabel(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [yStr, mStr] = ym.split('-');
  const m = parseInt(mStr, 10);
  return `${NAMA_BULAN_ID[m - 1] || mStr} ${yStr}`;
}

export function getFirstWorkdayOfMonthIso(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    return new Date().toISOString().split('T')[0];
  }
  const [yStr, mStr] = ym.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  for (let day = 1; day <= 7; day++) {
    const d = new Date(y, m - 1, day);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      return `${yStr}-${mStr}-${String(day).padStart(2, '0')}`;
    }
  }
  return `${yStr}-${mStr}-01`;
}

export function getAvailableEvaluationMonths(referenceDate: Date = new Date()): {
  evalYm: string;
  evalLabel: string;
  targetYm: string;
  targetLabel: string;
}[] {
  const options: {
    evalYm: string;
    evalLabel: string;
    targetYm: string;
    targetLabel: string;
  }[] = [];

  for (let offset = 1; offset <= 6; offset++) {
    const evalDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - offset, 1);
    const evalYm = `${evalDate.getFullYear()}-${String(evalDate.getMonth() + 1).padStart(2, '0')}`;
    const targetYm = getNextYearMonth(evalYm);
    options.push({
      evalYm,
      evalLabel: formatYearMonthLabel(evalYm),
      targetYm,
      targetLabel: formatYearMonthLabel(targetYm),
    });
  }
  return options;
}

const getCalendarDaysInYm = (ym: string): number => {
  const [yStr, mStr] = ym.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
    return new Date(y, m, 0).getDate();
  }
  return 30;
};

export function computeRekomendasiLoketAwalBulan(params: {
  evalYearMonth: string;
  poskoList: JadwalPoskoItem[];
  reports?: LaporanHarianItem[];
  absensiApelList?: AbsensiApelHarian[];
  absensiAgendaList?: AbsensiAgendaKepling[];
  kunjunganList?: KunjunganWargaData[];
  targetsMap?: TargetsCapaianMap;
}): HasilRekomendasiLoketAwalBulan {
  const { evalYearMonth, poskoList } = params;
  const targetYearMonth = getNextYearMonth(evalYearMonth);
  const evalBulanLabel = formatYearMonthLabel(evalYearMonth);
  const targetBulanLabel = formatYearMonthLabel(targetYearMonth);
  const tanggalAwalKerjaTarget = getFirstWorkdayOfMonthIso(targetYearMonth);

  const rawReports =
    params.reports && params.reports.length > 0
      ? params.reports
      : safeGetLocalStorage<LaporanHarianItem[]>('kepling_local_laporan_history_v2', []);
  const rawApelList = params.absensiApelList ?? getLocalAbsensiApelList();
  const rawAgendaList = params.absensiAgendaList ?? getLocalAbsensiAgendaList();
  const rawKunjungan = params.kunjunganList ?? getLocalKunjunganList();
  const targetsMap =
    params.targetsMap ??
    safeGetLocalStorage<TargetsCapaianMap | null>('manggajuara_targets_capaian_v2', null) ??
    getDefaultTargetsCapaianMap();

  const evalYear = parseInt(evalYearMonth.split('-')[0], 10) || DEFAULT_PBB_YEAR;
  const pbbOverview = getCachedPbbOverview(evalYear);
  const daysInEvalMonth = getCalendarDaysInYm(evalYearMonth);

  const reportsInMonth = rawReports.filter((r) => {
    const iso = getReportIsoDate(r);
    return iso.startsWith(evalYearMonth);
  });
  const apelInMonth = rawApelList.filter((a) => a?.tanggal?.startsWith(evalYearMonth));
  const agendaInMonth = rawAgendaList.filter((a) => a?.tanggalKegiatan?.startsWith(evalYearMonth));
  const poskoInMonth = (poskoList || []).filter((p) => p?.tanggal?.startsWith(evalYearMonth));
  const loketInMonth = poskoInMonth.filter((p) => p.jenisPosko === 'piket_loket_pelayanan');
  const kunjunganInMonth = rawKunjungan.filter((k) => {
    const iso = getReportIsoDate(k) || String(k?.tanggal || '').slice(0, 10);
    return iso.startsWith(evalYearMonth);
  });

  const evaluasiSemuaKepling: KeplingEvaluasiBulanLalu[] = KEPLING_ACCOUNTS.map((acc, index) => {
    const effProfile = getEffectiveProfile(acc);
    const namaKepling = effProfile.nama || acc.nama;
    const telepon = effProfile.telepon || acc.telepon || '';
    const lkNum = acc.nomorLingkungan || index + 1;

    // 1. Apel Pagi bulan lalu
    let apelHadir = 0;
    let apelTerlambat = 0;
    let apelIzin = 0;
    let apelSakit = 0;
    let apelAlpa = 0;
    let apelScoreSum = 0;

    apelInMonth.forEach((rec) => {
      const entry =
        rec.entries?.[acc.id] ||
        Object.values(rec.entries || {}).find(
          (e) =>
            e.nomorLingkungan === lkNum ||
            e.namaKepling?.trim().toLowerCase() === namaKepling.trim().toLowerCase()
        );
      const st: StatusApelPagi = entry?.status || 'Hadir';
      if (st === 'Hadir') apelHadir += 1;
      else if (st === 'Terlambat') apelTerlambat += 1;
      else if (st === 'Izin') apelIzin += 1;
      else if (st === 'Sakit') apelSakit += 1;
      else if (st === 'Alpa') apelAlpa += 1;
      apelScoreSum += getApelStatusScore(st);
    });

    const apelTotalHari = apelInMonth.length;
    const apelPercentage =
      apelTotalHari > 0 ? Math.min(100, Math.round((apelScoreSum / apelTotalHari) * 100)) : 100;

    // 2. Agenda Kelurahan bulan lalu
    let agendaHadir = 0;
    let agendaTidakHadir = 0;
    agendaInMonth.forEach((rec) => {
      const entry =
        rec.entries?.[acc.id] ||
        Object.values(rec.entries || {}).find(
          (e) =>
            e.nomorLingkungan === lkNum ||
            e.namaKepling?.trim().toLowerCase() === namaKepling.trim().toLowerCase()
        );
      const st: StatusKehadiranKepling = entry?.status || 'Hadir';
      if (st === 'Hadir') agendaHadir += 1;
      else if (st === 'Tidak Hadir') agendaTidakHadir += 1;
    });
    const agendaTotal = agendaInMonth.length;
    const agendaPercentage =
      agendaTotal > 0 ? Math.min(100, Math.round((agendaHadir / agendaTotal) * 100)) : 100;

    // 3. Posko & Piket Loket bulan lalu
    let loketAssignedCount = 0;
    let loketHadirCount = 0;
    let loketTidakHadirCount = 0;
    let poskoTotalHadirCount = 0;
    let poskoTidakHadirCount = 0;

    poskoInMonth.forEach((p) => {
      const petugas = (p.petugasKepling || []).find(
        (pt) =>
          pt.keplingId === acc.id ||
          pt.nomorLingkungan === lkNum ||
          pt.namaKepling?.trim().toLowerCase() === namaKepling.trim().toLowerCase()
      );
      if (!petugas) return;
      const isLoket = p.jenisPosko === 'piket_loket_pelayanan';
      if (isLoket) loketAssignedCount += 1;

      if (petugas.statusKehadiran === 'Tidak Hadir') {
        poskoTidakHadirCount += 1;
        if (isLoket) loketTidakHadirCount += 1;
      } else if (isKeplingPoskoDutyScored(p, petugas)) {
        poskoTotalHadirCount += 1;
        if (isLoket) loketHadirCount += 1;
      }
    });

    // 4. Laporan Harian & Kinerja Pelayanan bulan lalu
    const kReports = reportsInMonth.filter((r) => isReportMatchingKepling(r, acc));
    let pbbReportedWp = 0;
    let perlinsosKk = 0;
    let ikdOrang = 0;
    let bpjsOrang = 0;

    kReports.forEach((r) => {
      pbbReportedWp += Number(r.kinerja?.opsirPbbWp) || 0;
      perlinsosKk += Number(r.kinerja?.perlinsosKk) || 0;
      ikdOrang += Number(r.kinerja?.ikdOrang) || 0;
      bpjsOrang += Number(r.kinerja?.bpjsKetenagakerjaanOrang) || 0;
    });

    const uniqueDays = new Set(
      kReports
        .filter((r) => {
          const isAutoAttendance =
            r.id?.startsWith('lap_ag_') ||
            r.id?.startsWith('lap_pk_') ||
            r.id?.startsWith('lap_ap_');
          if (!isAutoAttendance) return true;
          const text = r.kinerja?.kegiatanLainnya || '';
          const hasHadir =
            text.replace(/TIDAK HADIR:/g, '').includes('HADIR:') ||
            text.includes('Hadir:') ||
            text.includes('TERLAMBAT:') ||
            Boolean(r.kinerja?.poskamlingAdaGiat);
          const hasNumeric =
            Number(r.kinerja?.opsirPbbWp || 0) > 0 ||
            Number(r.kinerja?.perlinsosKk || 0) > 0 ||
            Number(r.kinerja?.ikdOrang || 0) > 0 ||
            Number(r.kinerja?.bpjsKetenagakerjaanOrang || 0) > 0 ||
            Number(r.jumlahDokumentasi || 0) > 0;
          return hasHadir || hasNumeric;
        })
        .map((r) => getReportIsoDate(r))
    );
    const hariMelapor = uniqueDays.size;
    const konsistensiPercentage = Math.min(
      100,
      Math.round((hariMelapor / Math.max(1, daysInEvalMonth)) * 100)
    );

    const targetConfig = targetsMap[acc.id];
    const lkPbbSummary = pbbOverview.lingkunganSummaries.find((s) => s.lingkungan === lkNum);
    const pbbForEffective = lkPbbSummary ? lkPbbSummary.wpLunas : pbbReportedWp;

    const effective = calculateEffectiveKinerja(
      { pbb: pbbForEffective, perlinsos: perlinsosKk, ikd: ikdOrang, bpjs: bpjsOrang },
      targetConfig,
      index,
      false
    );

    const rawAnnualPerlinsos =
      targetConfig?.targetPerlinsos ?? DEFAULT_PERLINSOS_TARGETS[lkNum - 1] ?? 300;
    const targetPerlinsos = Math.max(1, Math.round(rawAnnualPerlinsos / 12));
    const rawAnnualPbb =
      targetConfig?.targetPbb && targetConfig.targetPbb !== 100
        ? targetConfig.targetPbb
        : lkPbbSummary && lkPbbSummary.totalWp > 0
        ? lkPbbSummary.totalWp
        : targetConfig?.targetPbb || 100;
    const targetPbb = Math.max(1, Math.round(rawAnnualPbb / 12));
    const targetIkd = Math.max(1, Math.round((targetConfig?.targetIkd ?? 50) / 12));
    const targetBpjs = Math.max(
      1,
      Math.round((targetConfig?.targetBpjs && targetConfig.targetBpjs >= 50 ? targetConfig.targetBpjs : 50) / 12)
    );

    const pbbPercentage =
      targetPbb > 0
        ? Math.min(100, Math.round((effective.pbb / targetPbb) * 100))
        : lkPbbSummary?.persentaseWpLunas
        ? Math.min(100, Math.round(lkPbbSummary.persentaseWpLunas))
        : 0;
    const perlinsosPercentage = Math.min(100, Math.round((effective.perlinsos / targetPerlinsos) * 100));
    const ikdPercentage = Math.min(100, Math.round((effective.ikd / targetIkd) * 100));
    const bpjsPercentage = Math.min(100, Math.round((effective.bpjs / targetBpjs) * 100));

    const kunjunganCount = kunjunganInMonth.filter((kj) =>
      isKunjunganMatchingKepling(kj, acc)
    ).length;
    const kunjunganPercentage = Math.min(100, Math.round((kunjunganCount / targetPerlinsos) * 100));

    const poskamlingPercentage = Math.min(100, Math.round((poskoTotalHadirCount / 8) * 100));

    const baseScore =
      pbbPercentage * 0.2 +
      perlinsosPercentage * 0.1 +
      ikdPercentage * 0.1 +
      bpjsPercentage * 0.1 +
      kunjunganPercentage * 0.1 +
      poskamlingPercentage * 0.1 +
      apelPercentage * 0.1 +
      agendaPercentage * 0.05 +
      konsistensiPercentage * 0.15;

    const { totalPenalti } = calculatePenaltiTanpaKeterangan(
      apelAlpa,
      agendaTidakHadir + poskoTidakHadirCount
    );
    const skorIkktEvaluasi = Number(Math.max(0, Math.min(100, baseScore - totalPenalti)).toFixed(1));

    // Hitung Skor Kesiapan Loket Awal Bulan:
    // Mengutamakan kedisiplinan Apel Pagi (bebas Alpa), bebas Tidak Hadir posko/agenda,
    // konsistensi laporan, pelayanan publik (IKD/Perlinsos/BPJS), dan bonus rotasi adil jika bulan lalu belum bertugas loket.
    const rotationFairnessBonus = loketAssignedCount === 0 ? 6 : loketAssignedCount === 1 ? 2 : -loketAssignedCount * 2;
    const disciplineSafetyBonus = apelAlpa === 0 && poskoTidakHadirCount === 0 && agendaTidakHadir === 0 ? 5 : 0;
    const kesiapanRaw =
      skorIkktEvaluasi * 0.65 +
      apelPercentage * 0.2 +
      konsistensiPercentage * 0.15 +
      rotationFairnessBonus +
      disciplineSafetyBonus -
      totalPenalti * 1.5;
    const skorKesiapanLoket = Number(Math.max(0, Math.min(100, kesiapanRaw)).toFixed(1));

    const needsGuidance = apelAlpa > 0 || poskoTidakHadirCount > 0 || agendaTidakHadir > 0;
    let kategori: KategoriRekomendasiLoket = 'PRIORITAS_UTAMA';
    if (needsGuidance) {
      kategori = 'PENDAMPINGAN_PEMBINAAN';
    } else if (loketAssignedCount === 0 && skorIkktEvaluasi >= 45) {
      kategori = 'ROTASI_PEMERATAAN';
    } else if (skorKesiapanLoket >= 65 || (apelTotalHari > 0 && apelAlpa === 0 && apelTerlambat <= 1)) {
      kategori = 'PRIORITAS_UTAMA';
    } else {
      kategori = 'ROTASI_PEMERATAAN';
    }

    const alasanRekomendasi: string[] = [];
    if (apelTotalHari > 0) {
      if (apelAlpa === 0 && apelTerlambat === 0) {
        alasanRekomendasi.push(`Disiplin Apel Pagi 100% (${apelHadir}/${apelTotalHari} hari hadir tepat waktu)`);
      } else if (apelAlpa === 0) {
        alasanRekomendasi.push(`Apel Pagi tanpa Alpa (${apelHadir} Hadir, ${apelTerlambat} Terlambat)`);
      } else {
        alasanRekomendasi.push(`Catatan Apel: ${apelAlpa}x Alpa (-${(apelAlpa * 3).toFixed(1)} poin)`);
      }
    } else {
      alasanRekomendasi.push('Belum ada catatan pelanggaran Apel Pagi bulan lalu');
    }

    if (loketAssignedCount === 0) {
      alasanRekomendasi.push('Belum mendapat giliran Piket Loket bulan lalu (prioritas pemerataan rotasi)');
    } else {
      alasanRekomendasi.push(
        `Piket Loket bulan lalu: ${loketHadirCount}/${loketAssignedCount}x hadir${
          loketTidakHadirCount > 0 ? ` (${loketTidakHadirCount}x Tidak Hadir)` : ''
        }`
      );
    }

    if (hariMelapor > 0) {
      alasanRekomendasi.push(`Aktif melapor ${hariMelapor} hari (${konsistensiPercentage}%)`);
    }
    if (ikdOrang > 0 || perlinsosKk > 0 || bpjsOrang > 0) {
      alasanRekomendasi.push(
        `Layanan warga bulan lalu: ${perlinsosKk} KK Perlinsos, ${ikdOrang} IKD, ${bpjsOrang} BPJS TK`
      );
    }

    let catatanPembinaan: string | null = null;
    if (needsGuidance) {
      const parts: string[] = [];
      if (apelAlpa > 0) parts.push(`${apelAlpa}x Alpa Apel Pagi`);
      if (poskoTidakHadirCount > 0) parts.push(`${poskoTidakHadirCount}x Tidak Hadir Posko/Loket`);
      if (agendaTidakHadir > 0) parts.push(`${agendaTidakHadir}x Tidak Hadir Agenda`);
      catatanPembinaan = `Perlu pembinaan kedisiplinan (${parts.join(', ')}). Disarankan dipasangkan dengan petugas disiplin terbaik di Loket Kantor Lurah agar kehadiran pagi & pelayanan terpantau langsung.`;
    }

    return {
      keplingId: acc.id,
      nomorLingkungan: lkNum,
      lingkungan: acc.lingkungan,
      namaKepling,
      telepon,
      apelTotalHari,
      apelHadir,
      apelTerlambat,
      apelIzin,
      apelSakit,
      apelAlpa,
      apelPercentage,
      agendaTotal,
      agendaHadir,
      agendaTidakHadir,
      agendaPercentage,
      loketAssignedCount,
      loketHadirCount,
      loketTidakHadirCount,
      poskoTotalHadirCount,
      poskoTidakHadirCount,
      hariMelapor,
      konsistensiPercentage,
      pbbReportedWp,
      pbbPercentage,
      perlinsosKk,
      perlinsosPercentage,
      ikdOrang,
      ikdPercentage,
      bpjsOrang,
      bpjsPercentage,
      kunjunganCount,
      kunjunganPercentage,
      penaltiTanpaKeterangan: totalPenalti,
      skorIkktEvaluasi,
      skorKesiapanLoket,
      kategori,
      alasanRekomendasi,
      catatanPembinaan,
    };
  });

  // Urutkan semua evaluasi dari skor kesiapan loket tertinggi (tie-breaker: skorIkkt, 0 penalti, nomor lingkungan)
  const sortedAll = [...evaluasiSemuaKepling].sort((a, b) => {
    if (b.skorKesiapanLoket !== a.skorKesiapanLoket) {
      return b.skorKesiapanLoket - a.skorKesiapanLoket;
    }
    if (b.skorIkktEvaluasi !== a.skorIkktEvaluasi) {
      return b.skorIkktEvaluasi - a.skorIkktEvaluasi;
    }
    return a.nomorLingkungan - b.nomorLingkungan;
  });

  const cleanPool = sortedAll.filter((k) => k.kategori !== 'PENDAMPINGAN_PEMBINAAN');
  const perluPembinaan = sortedAll.filter((k) => k.kategori === 'PENDAMPINGAN_PEMBINAAN');
  const kandidatUtama = cleanPool.filter((k) => k.kategori === 'PRIORITAS_UTAMA');
  const kandidatRotasi = cleanPool.filter((k) => k.kategori === 'ROTASI_PEMERATAAN');

  // Pilih petugas terbaik untuk 3 Loket Pelayanan Kelurahan Mangga secara non-overlapping
  const usedIds = new Set<string>();
  const pickNextBest = (
    scorer: (k: KeplingEvaluasiBulanLalu) => number,
    pool: KeplingEvaluasiBulanLalu[]
  ): KeplingEvaluasiBulanLalu | null => {
    const candidates = pool.filter((k) => !usedIds.has(k.keplingId));
    const fallbackPool = candidates.length > 0 ? candidates : sortedAll.filter((k) => !usedIds.has(k.keplingId));
    if (fallbackPool.length === 0) return null;
    const best = [...fallbackPool].sort((a, b) => scorer(b) - scorer(a))[0];
    if (best) usedIds.add(best.keplingId);
    return best || null;
  };

  const baseClean = cleanPool.length >= 6 ? cleanPool : sortedAll;

  // Loket 1: Administrasi Kependudukan & Surat-Menyurat (Disiplin Apel + Konsistensi Laporan + Agenda)
  const loket1Score = (k: KeplingEvaluasiBulanLalu) =>
    k.apelPercentage * 0.4 + k.konsistensiPercentage * 0.35 + k.agendaPercentage * 0.15 + k.skorIkktEvaluasi * 0.1 - k.loketAssignedCount * 3;
  // Loket 2: Perlinsos, Aktivasi IKD & BPJS TK (Layanan IKD + Perlinsos + BPJS + Disiplin Apel)
  const loket2Score = (k: KeplingEvaluasiBulanLalu) =>
    k.ikdPercentage * 0.3 + k.perlinsosPercentage * 0.25 + k.bpjsPercentage * 0.2 + k.apelPercentage * 0.25 - k.loketAssignedCount * 3;
  // Loket 3: Informasi PBB-P2, Pengaduan & Kunjungan Warga (PBB + Kunjungan + Pemerataan Rotasi)
  const loket3Score = (k: KeplingEvaluasiBulanLalu) =>
    k.pbbPercentage * 0.35 + k.kunjunganPercentage * 0.25 + k.apelPercentage * 0.25 + (k.loketAssignedCount === 0 ? 15 : 0);

  const l1Utama = pickNextBest(loket1Score, baseClean);
  const l2Utama = pickNextBest(loket2Score, baseClean);
  const l3Utama = pickNextBest(loket3Score, baseClean);

  const l1Pendamping =
    pickNextBest((k) => (k.loketAssignedCount === 0 ? 12 : 0) + loket1Score(k), baseClean) ||
    perluPembinaan[0] ||
    null;
  const l2Pendamping =
    pickNextBest((k) => (k.loketAssignedCount === 0 ? 12 : 0) + loket2Score(k), baseClean) ||
    perluPembinaan[1] ||
    null;
  const l3Pendamping =
    pickNextBest((k) => (k.loketAssignedCount === 0 ? 12 : 0) + loket3Score(k), baseClean) ||
    perluPembinaan[2] ||
    null;

  const loketAssignments: SaranLoketSlot[] = [
    {
      loketNomor: 1,
      kodeLoket: 'LOKET-1',
      namaLoket: 'Loket 1 · Adminduk & Surat-Menyurat',
      fokusLayanan: 'Pelayanan KTP/KK, surat pengantar kelurahan, domisili, dan registrasi berkas warga',
      petugasUtama: l1Utama ? [l1Utama] : [],
      petugasPendamping: l1Pendamping ? [l1Pendamping] : [],
      ringkasanAlasan:
        'Dipilih dari Kepling dengan disiplin Apel Pagi tertinggi dan konsistensi pelaporan harian paling tertib pada bulan sebelumnya.',
    },
    {
      loketNomor: 2,
      kodeLoket: 'LOKET-2',
      namaLoket: 'Loket 2 · Perlinsos, IKD & BPJS TK',
      fokusLayanan: 'Verifikasi DTSEN/Perlinsos, aktivasi Identitas Kependudukan Digital (IKD), dan BPJS Ketenagakerjaan',
      petugasUtama: l2Utama ? [l2Utama] : [],
      petugasPendamping: l2Pendamping ? [l2Pendamping] : [],
      ringkasanAlasan:
        'Dipilih berdasarkan rekam jejak aktivasi IKD, pendataan Perlinsos, dan layanan BPJS TK terbaik pada bulan sebelumnya.',
    },
    {
      loketNomor: 3,
      kodeLoket: 'LOKET-3',
      namaLoket: 'Loket 3 · PBB-P2, Pengaduan & Informasi',
      fokusLayanan: 'Konsultasi/penagihan SPPT PBB-P2, layanan aduan warga, dan tindak lanjut kunjungan lingkungan',
      petugasUtama: l3Utama ? [l3Utama] : [],
      petugasPendamping: l3Pendamping ? [l3Pendamping] : [],
      ringkasanAlasan:
        'Dipilih berdasarkan capaian PBB-P2, keaktifan kunjungan warga, dan pemerataan rotasi piket loket dari bulan lalu.',
    },
  ];

  const suggestedCombinedKeplingIds = Array.from(
    new Set(
      loketAssignments
        .flatMap((slot) => [...slot.petugasUtama, ...slot.petugasPendamping])
        .map((k) => k.keplingId)
    )
  );

  const hasAnyEvaluationData =
    apelInMonth.length > 0 ||
    reportsInMonth.length > 0 ||
    agendaInMonth.length > 0 ||
    poskoInMonth.length > 0 ||
    kunjunganInMonth.length > 0;

  return {
    evalYearMonth,
    evalBulanLabel,
    targetYearMonth,
    targetBulanLabel,
    tanggalAwalKerjaTarget,
    hasAnyEvaluationData,
    totalApelDaysRecorded: apelInMonth.length,
    totalLoketSchedulesLastMonth: loketInMonth.length,
    totalReportsLastMonth: reportsInMonth.length,
    evaluasiSemuaKepling: sortedAll,
    loketAssignments,
    kandidatUtama,
    kandidatRotasi,
    perluPembinaan,
    suggestedCombinedKeplingIds,
  };
}
