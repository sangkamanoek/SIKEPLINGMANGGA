import { SpptPbbItem } from '../data/pbbSampleData';

export type DataKeluarga = any;
export type AnggotaKeluarga = any;

// --- Normalization Helpers ---

export const cleanNik = (nik: string | undefined | null): string => {
  if (!nik) return '';
  return String(nik).replace(/[^0-9]/g, '').trim();
};

export const cleanNop = (nop: string | undefined | null): string => {
  if (!nop) return '';
  return String(nop).replace(/[^0-9a-zA-Z]/g, '').trim().toUpperCase();
};

export const cleanNomorKk = (kk: string | undefined | null): string => {
  if (!kk) return '';
  return String(kk).replace(/[^0-9]/g, '').trim();
};

export const formatNopDisplay = (rawNop: string): string => {
  const digits = cleanNop(rawNop);
  if (!digits) return rawNop || '';
  if (digits.length !== 18) return rawNop;
  // 12.71.010.001.001-0001.0
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 7)}.${digits.slice(7, 10)}.${digits.slice(10, 13)}-${digits.slice(13, 17)}.${digits.slice(17, 18)}`;
};

// --- Interfaces for Matching & Duplication ---

export interface NikMatchRecord {
  kkId: string;
  nomorKk: string;
  nik: string;
  nama: string;
  role: 'Kepala Keluarga' | 'Anggota Keluarga';
  hubunganKeluarga?: string;
  lingkunganNomor: number;
  lingkunganNama: string;
  namaJalan: string;
  alamatLengkap?: string;
  telepon?: string;
  memberId?: string;
  statusDomisili?: string;
}

export interface NikDuplicateCheckResult {
  isDuplicate: boolean;
  isValidLength: boolean;
  cleanedNik: string;
  matches: NikMatchRecord[];
  primaryMatch?: NikMatchRecord;
  message: string;
  severity: 'error' | 'warning' | 'success' | 'idle';
}

export interface NopKkMatchRecord {
  kkId: string;
  nomorKk: string;
  namaKepalaKeluarga: string;
  nikKepalaKeluarga: string;
  lingkunganNomor: number;
  lingkunganNama: string;
  namaJalan: string;
  nop: string;
}

export interface NopDuplicateCheckResult {
  isDuplicateInPbb: boolean;
  isLinkedToOtherKk: boolean;
  cleanedNop: string;
  spptMatches: SpptPbbItem[];
  kkMatches: NopKkMatchRecord[];
  primarySppt?: SpptPbbItem;
  primaryKk?: NopKkMatchRecord;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'success' | 'idle';
}

export interface KkDuplicateCheckResult {
  isDuplicate: boolean;
  isValidLength: boolean;
  cleanedKk: string;
  matches: DataKeluarga[];
  message: string;
  severity: 'error' | 'warning' | 'success' | 'idle';
}

// --- Instant Real-time Validation Checkers ---

/**
 * Check if a NIK is duplicated across DataKeluarga (heads & members)
 */
export const checkNikDuplicate = (
  rawNik: string,
  dataKeluarga: DataKeluarga[],
  options?: {
    excludeKkId?: string;
    excludeMemberId?: string;
  }
): NikDuplicateCheckResult => {
  const cleaned = cleanNik(rawNik);

  if (!cleaned) {
    return {
      isDuplicate: false,
      isValidLength: false,
      cleanedNik: '',
      matches: [],
      message: '',
      severity: 'idle',
    };
  }

  const isValidLength = cleaned.length === 16;
  const matches: NikMatchRecord[] = [];

  for (const kk of dataKeluarga) {
    const isCurrentKk = options?.excludeKkId && kk.id === options.excludeKkId;

    // Check Kepala Keluarga
    const kkNikClean = cleanNik(kk.nikKepalaKeluarga || kk.nomorKk);
    if (kkNikClean && kkNikClean === cleaned) {
      if (!isCurrentKk || options?.excludeMemberId) {
        matches.push({
          kkId: kk.id,
          nomorKk: kk.nomorKk || '-',
          nik: kk.nikKepalaKeluarga || kkNikClean,
          nama: kk.namaKepalaKeluarga || 'KEPALA KELUARGA',
          role: 'Kepala Keluarga',
          hubunganKeluarga: 'Kepala Keluarga',
          lingkunganNomor: kk.lingkunganNomor || 1,
          lingkunganNama: kk.lingkunganNama || `Lingkungan ${kk.lingkunganNomor || 1}`,
          namaJalan: kk.namaJalan || kk.alamatLengkap || '-',
          alamatLengkap: kk.alamatLengkap,
          telepon: kk.telepon,
          statusDomisili: kk.statusDomisili,
        });
      }
    }

    // Check Anggota Keluarga
    if (kk.anggotaKeluarga && Array.isArray(kk.anggotaKeluarga)) {
      for (const ang of kk.anggotaKeluarga) {
        if (options?.excludeMemberId && ang.id === options.excludeMemberId) {
          continue;
        }
        if (isCurrentKk && !options?.excludeMemberId && ang.nik && cleanNik(ang.nik) === cleaned) {
          // Same KK member duplicate
          matches.push({
            kkId: kk.id,
            nomorKk: kk.nomorKk || '-',
            nik: ang.nik,
            nama: ang.nama,
            role: 'Anggota Keluarga',
            hubunganKeluarga: ang.hubunganKeluarga || 'Anggota',
            lingkunganNomor: kk.lingkunganNomor || 1,
            lingkunganNama: kk.lingkunganNama || `Lingkungan ${kk.lingkunganNomor || 1}`,
            namaJalan: kk.namaJalan || kk.alamatLengkap || '-',
            alamatLengkap: kk.alamatLengkap,
            memberId: ang.id,
          });
          continue;
        }

        const angNikClean = cleanNik(ang.nik);
        if (angNikClean && angNikClean === cleaned) {
          matches.push({
            kkId: kk.id,
            nomorKk: kk.nomorKk || '-',
            nik: ang.nik,
            nama: ang.nama,
            role: 'Anggota Keluarga',
            hubunganKeluarga: ang.hubunganKeluarga || 'Anggota',
            lingkunganNomor: kk.lingkunganNomor || 1,
            lingkunganNama: kk.lingkunganNama || `Lingkungan ${kk.lingkunganNomor || 1}`,
            namaJalan: kk.namaJalan || kk.alamatLengkap || '-',
            alamatLengkap: kk.alamatLengkap,
            memberId: ang.id,
          });
        }
      }
    }
  }

  const isDuplicate = matches.length > 0;
  let message = '';
  let severity: 'error' | 'warning' | 'success' | 'idle' = 'idle';

  if (isDuplicate) {
    severity = 'error';
    const first = matches[0];
    message = `⚠️ NIK ini sudah terdaftar atas nama ${first.nama} (${first.role}) di ${first.lingkunganNama} - ${first.namaJalan}.`;
    if (matches.length > 1) {
      message += ` (Ditemukan di ${matches.length} catatan!)`;
    }
  } else if (isValidLength) {
    severity = 'success';
    message = '✓ NIK 16 Digit Unik (Belum pernah terdaftar di database)';
  } else {
    severity = 'warning';
    message = `Format NIK ${cleaned.length}/16 digit`;
  }

  return {
    isDuplicate,
    isValidLength,
    cleanedNik: cleaned,
    matches,
    primaryMatch: matches[0],
    message,
    severity,
  };
};

/**
 * Check if a Nomor KK is duplicated
 */
export const checkNomorKkDuplicate = (
  rawKk: string,
  dataKeluarga: DataKeluarga[],
  options?: { excludeKkId?: string }
): KkDuplicateCheckResult => {
  const cleaned = cleanNomorKk(rawKk);

  if (!cleaned) {
    return {
      isDuplicate: false,
      isValidLength: false,
      cleanedKk: '',
      matches: [],
      message: '',
      severity: 'idle',
    };
  }

  const isValidLength = cleaned.length === 16;
  const matches = dataKeluarga.filter((k) => {
    if (options?.excludeKkId && k.id === options.excludeKkId) return false;
    const cleanKk = cleanNomorKk(k.nomorKk);
    return cleanKk && cleanKk === cleaned;
  });

  const isDuplicate = matches.length > 0;
  let message = '';
  let severity: 'error' | 'warning' | 'success' | 'idle' = 'idle';

  if (isDuplicate) {
    severity = 'error';
    const first = matches[0];
    message = `⚠️ No. KK ini sudah terdaftar atas Kepala Keluarga "${first.namaKepalaKeluarga}" (${first.lingkunganNama || `Lingkungan ${first.lingkunganNomor}`}).`;
  } else if (isValidLength) {
    severity = 'success';
    message = '✓ Nomor Kartu Keluarga (KK) Unik';
  } else {
    severity = 'warning';
    message = `Format No. KK ${cleaned.length}/16 digit`;
  }

  return {
    isDuplicate,
    isValidLength,
    cleanedKk: cleaned,
    matches,
    message,
    severity,
  };
};

/**
 * Check if a NOP is duplicated in SPPT Master or DataKeluarga
 */
export const checkNopDuplicate = (
  rawNop: string,
  spptList: SpptPbbItem[],
  dataKeluarga?: DataKeluarga[],
  options?: {
    excludeSpptId?: string;
    excludeKkId?: string;
  }
): NopDuplicateCheckResult => {
  const cleaned = cleanNop(rawNop);

  if (!cleaned) {
    return {
      isDuplicateInPbb: false,
      isLinkedToOtherKk: false,
      cleanedNop: '',
      spptMatches: [],
      kkMatches: [],
      message: '',
      severity: 'idle',
    };
  }

  // 1. Check in SPPT PBB Master
  const spptMatches = spptList.filter((s) => {
    if (options?.excludeSpptId && s.id === options.excludeSpptId) return false;
    return cleanNop(s.nop) === cleaned;
  });

  // 2. Check in Data Keluarga
  const kkMatches: NopKkMatchRecord[] = [];
  if (dataKeluarga && Array.isArray(dataKeluarga)) {
    for (const kk of dataKeluarga) {
      if (options?.excludeKkId && kk.id === options.excludeKkId) continue;
      if (kk.nopPbb && cleanNop(kk.nopPbb) === cleaned) {
        kkMatches.push({
          kkId: kk.id,
          nomorKk: kk.nomorKk || '-',
          namaKepalaKeluarga: kk.namaKepalaKeluarga,
          nikKepalaKeluarga: kk.nikKepalaKeluarga,
          lingkunganNomor: kk.lingkunganNomor || 1,
          lingkunganNama: kk.lingkunganNama || `Lingkungan ${kk.lingkunganNomor || 1}`,
          namaJalan: kk.namaJalan || kk.alamatLengkap || '-',
          nop: kk.nopPbb,
        });
      }
    }
  }

  const isDuplicateInPbb = spptMatches.length > 0;
  const isLinkedToOtherKk = kkMatches.length > 0;

  let message = '';
  let severity: 'error' | 'warning' | 'info' | 'success' | 'idle' = 'idle';

  if (isDuplicateInPbb && !options?.excludeSpptId) {
    // In context of creating/checking PBB SPPT
    const match = spptMatches[0];
    severity = 'error';
    message = `⚠️ NOP sudah ada di Master SPPT: WP "${match.namaWp}" (Lingkungan ${match.lingkungan} - ${match.alamatOp}). Status: ${match.status || 'Belum Bayar'}.`;
  } else if (isLinkedToOtherKk) {
    const match = kkMatches[0];
    severity = 'warning';
    message = `⚠️ NOP ini sudah ditautkan pada KK ${match.namaKepalaKeluarga} (${match.lingkunganNama} - ${match.namaJalan}).`;
  } else if (spptMatches.length > 0) {
    // Found in SPPT (valid link for KK)
    const match = spptMatches[0];
    severity = 'success';
    message = `✓ Ditemukan di Master SPPT: "${match.namaWp}" (Lingkungan ${match.lingkungan} - ${match.alamatOp}).`;
  } else {
    severity = 'info';
    message = 'ℹ️ NOP belum terdaftar di Master SPPT (Akan dicatat sebagai NOP Mandiri / Baru).';
  }

  return {
    isDuplicateInPbb,
    isLinkedToOtherKk,
    cleanedNop: cleaned,
    spptMatches,
    kkMatches,
    primarySppt: spptMatches[0],
    primaryKk: kkMatches[0],
    message,
    severity,
  };
};

// --- Comprehensive Duplicate Audit Report ---

export interface AuditDuplicateItem {
  id: string;
  type: 'nik_ganda' | 'nop_ganda' | 'kk_ganda' | 'nop_cross_kk' | 'nop_lingkungan_beda';
  key: string; // The duplicated NIK, NOP, or No KK
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium';
  occurrences: number;
  lingkunganList: number[];
  details: {
    label: string;
    source: string;
    lingkungan: string;
    nama: string;
    alamat: string;
    id: string;
  }[];
}

export interface FullAuditSummary {
  totalKkScanned: number;
  totalAnggotaScanned: number;
  totalSpptScanned: number;
  totalNikDuplicates: number;
  totalKkDuplicates: number;
  totalNopDuplicates: number;
  totalMismatchedLingkungan: number;
  duplicateItems: AuditDuplicateItem[];
  integrityScore: number; // 0 - 100%
  timestamp: string;
}

/**
 * Ultra-fast audit of all NIK, No. KK, and NOP duplicates across the whole app (<15ms)
 */
export const runFullDuplicateAudit = (
  dataKeluarga: DataKeluarga[],
  spptList: SpptPbbItem[]
): FullAuditSummary => {
  const startTime = performance.now();

  const nikMap = new Map<string, Array<{ kk: DataKeluarga; ang?: AnggotaKeluarga; role: string }>>();
  const noKkMap = new Map<string, Array<DataKeluarga>>();
  const nopKkMap = new Map<string, Array<DataKeluarga>>();
  const nopSpptMap = new Map<string, Array<SpptPbbItem>>();

  let totalAnggota = 0;

  // 1. Index Data Keluarga
  for (const kk of dataKeluarga) {
    // NIK Kepala Keluarga
    const nikKk = cleanNik(kk.nikKepalaKeluarga || kk.nomorKk);
    if (nikKk) {
      if (!nikMap.has(nikKk)) nikMap.set(nikKk, []);
      nikMap.get(nikKk)!.push({ kk, role: 'Kepala Keluarga' });
    }

    // Nomor KK
    const noKk = cleanNomorKk(kk.nomorKk);
    if (noKk) {
      if (!noKkMap.has(noKk)) noKkMap.set(noKk, []);
      noKkMap.get(noKk)!.push(kk);
    }

    // NOP PBB
    const nop = cleanNop(kk.nopPbb);
    if (nop) {
      if (!nopKkMap.has(nop)) nopKkMap.set(nop, []);
      nopKkMap.get(nop)!.push(kk);
    }

    // Anggota Keluarga
    if (kk.anggotaKeluarga && Array.isArray(kk.anggotaKeluarga)) {
      totalAnggota += kk.anggotaKeluarga.length;
      for (const ang of kk.anggotaKeluarga) {
        const nikAng = cleanNik(ang.nik);
        if (nikAng) {
          if (!nikMap.has(nikAng)) nikMap.set(nikAng, []);
          nikMap.get(nikAng)!.push({ kk, ang, role: `Anggota (${ang.hubunganKeluarga || 'Keluarga'})` });
        }
      }
    }
  }

  // 2. Index SPPT PBB
  for (const sppt of spptList) {
    const nop = cleanNop(sppt.nop);
    if (nop) {
      if (!nopSpptMap.has(nop)) nopSpptMap.set(nop, []);
      nopSpptMap.get(nop)!.push(sppt);
    }
  }

  const duplicateItems: AuditDuplicateItem[] = [];
  let totalNikDuplicates = 0;
  let totalKkDuplicates = 0;
  let totalNopDuplicates = 0;
  let totalMismatchedLingkungan = 0;

  // 3. Find NIK Duplicates
  nikMap.forEach((occurrences, nik) => {
    if (occurrences.length > 1) {
      totalNikDuplicates++;
      const lkSet = new Set(occurrences.map((o) => o.kk.lingkunganNomor || 1));
      duplicateItems.push({
        id: `dup_nik_${nik}`,
        type: 'nik_ganda',
        key: nik,
        title: `NIK Ganda: ${nik}`,
        description: `Ditemukan di ${occurrences.length} entri (${occurrences.map((o) => o.ang?.nama || o.kk.namaKepalaKeluarga).join(', ')})`,
        severity: occurrences.length > 2 || lkSet.size > 1 ? 'critical' : 'high',
        occurrences: occurrences.length,
        lingkunganList: Array.from(lkSet),
        details: occurrences.map((o) => ({
          label: o.role,
          source: `KK: ${o.kk.namaKepalaKeluarga} (${o.kk.nomorKk || '-'})`,
          lingkungan: o.kk.lingkunganNama || `Lingkungan ${o.kk.lingkunganNomor || 1}`,
          nama: o.ang?.nama || o.kk.namaKepalaKeluarga,
          alamat: o.kk.namaJalan || o.kk.alamatLengkap || '-',
          id: o.kk.id,
        })),
      });
    }
  });

  // 4. Find Nomor KK Duplicates
  noKkMap.forEach((kks, noKk) => {
    if (kks.length > 1) {
      totalKkDuplicates++;
      const lkSet = new Set(kks.map((k) => k.lingkunganNomor || 1));
      duplicateItems.push({
        id: `dup_kk_${noKk}`,
        type: 'kk_ganda',
        key: noKk,
        title: `No. KK Ganda: ${noKk}`,
        description: `Nomor Kartu Keluarga digunakan oleh ${kks.length} Kepala Keluarga berbeda`,
        severity: 'high',
        occurrences: kks.length,
        lingkunganList: Array.from(lkSet),
        details: kks.map((k) => ({
          label: 'Kepala Keluarga',
          source: `KK: ${k.nomorKk}`,
          lingkungan: k.lingkunganNama || `Lingkungan ${k.lingkunganNomor || 1}`,
          nama: k.namaKepalaKeluarga,
          alamat: k.namaJalan || k.alamatLengkap || '-',
          id: k.id,
        })),
      });
    }
  });

  // 5. Find NOP Duplicates in SPPT
  nopSpptMap.forEach((sppts, nop) => {
    if (sppts.length > 1) {
      totalNopDuplicates++;
      const lkSet = new Set(sppts.map((s) => s.lingkungan || 1));
      duplicateItems.push({
        id: `dup_nop_sppt_${nop}`,
        type: 'nop_ganda',
        key: nop,
        title: `NOP SPPT Ganda: ${formatNopDisplay(nop)}`,
        description: `NOP terdaftar lebih dari satu kali di Master SPPT PBB (${sppts.length} record)`,
        severity: 'high',
        occurrences: sppts.length,
        lingkunganList: Array.from(lkSet),
        details: sppts.map((s) => ({
          label: `SPPT PBB (${s.status || 'Belum Bayar'})`,
          source: `Buku: ${s.buku || '-'} | PBB: Rp ${(s.pbbTerutang || 0).toLocaleString('id-ID')}`,
          lingkungan: `Lingkungan ${s.lingkungan}`,
          nama: s.namaWp,
          alamat: s.alamatOp || '-',
          id: s.id,
        })),
      });
    }
  });

  // 6. Find NOP cross-linked to multiple KKs
  nopKkMap.forEach((kks, nop) => {
    if (kks.length > 1) {
      const lkSet = new Set(kks.map((k) => k.lingkunganNomor || 1));
      duplicateItems.push({
        id: `dup_nop_kk_${nop}`,
        type: 'nop_cross_kk',
        key: nop,
        title: `NOP Dipakai Beberapa KK: ${formatNopDisplay(nop)}`,
        description: `1 Objek Pajak (NOP) ditautkan ke ${kks.length} Kartu Keluarga yang berbeda`,
        severity: 'medium',
        occurrences: kks.length,
        lingkunganList: Array.from(lkSet),
        details: kks.map((k) => ({
          label: 'Data Keluarga',
          source: `KK: ${k.nomorKk || '-'}`,
          lingkungan: k.lingkunganNama || `Lingkungan ${k.lingkunganNomor || 1}`,
          nama: k.namaKepalaKeluarga,
          alamat: k.namaJalan || k.alamatLengkap || '-',
          id: k.id,
        })),
      });
    }
  });

  // 7. Find NOP Lingkungan Mismatches (KK Lingkungan != SPPT Lingkungan)
  dataKeluarga.forEach((kk) => {
    if (kk.nopPbb) {
      const clean = cleanNop(kk.nopPbb);
      const sppt = spptList.find((s) => cleanNop(s.nop) === clean);
      if (sppt && sppt.lingkungan && kk.lingkunganNomor && sppt.lingkungan !== kk.lingkunganNomor) {
        totalMismatchedLingkungan++;
        duplicateItems.push({
          id: `mismatch_lk_${kk.id}`,
          type: 'nop_lingkungan_beda',
          key: kk.nopPbb,
          title: `Selisih Wilayah NOP: ${formatNopDisplay(clean)}`,
          description: `Data KK tercatat di Lingkungan ${kk.lingkunganNomor}, namun SPPT PBB terdaftar di Lingkungan ${sppt.lingkungan}`,
          severity: 'medium',
          occurrences: 2,
          lingkunganList: [kk.lingkunganNomor, sppt.lingkungan],
          details: [
            {
              label: 'Data Keluarga (Domisili KK)',
              source: `KK: ${kk.nomorKk || '-'}`,
              lingkungan: kk.lingkunganNama || `Lingkungan ${kk.lingkunganNomor}`,
              nama: kk.namaKepalaKeluarga,
              alamat: kk.namaJalan || kk.alamatLengkap || '-',
              id: kk.id,
            },
            {
              label: 'Master SPPT PBB',
              source: `PBB: Rp ${(sppt.pbbTerutang || 0).toLocaleString('id-ID')}`,
              lingkungan: `Lingkungan ${sppt.lingkungan}`,
              nama: sppt.namaWp,
              alamat: sppt.alamatOp || '-',
              id: sppt.id,
            },
          ],
        });
      }
    }
  });

  // Calculate integrity score
  const totalScanned = dataKeluarga.length + totalAnggota + spptList.length;
  const totalIssues = totalNikDuplicates + totalKkDuplicates + totalNopDuplicates;
  const integrityScore =
    totalScanned > 0 ? Math.max(0, Math.round(((totalScanned - totalIssues * 2) / totalScanned) * 1000) / 10) : 100;

  return {
    totalKkScanned: dataKeluarga.length,
    totalAnggotaScanned: totalAnggota,
    totalSpptScanned: spptList.length,
    totalNikDuplicates,
    totalKkDuplicates,
    totalNopDuplicates,
    totalMismatchedLingkungan,
    duplicateItems: duplicateItems.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2 };
      return order[a.severity] - order[b.severity];
    }),
    integrityScore,
    timestamp: new Date().toISOString(),
  };
};

// --- Fast Universal Live Search for NIK & NOP ---

export interface LiveUniversalSearchResult {
  query: string;
  nikMatches: NikMatchRecord[];
  spptMatches: SpptPbbItem[];
  kkMatches: DataKeluarga[];
  duplicateCount: number;
}

export const searchUniversalNikNop = (
  rawQuery: string,
  dataKeluarga: DataKeluarga[],
  spptList: SpptPbbItem[]
): LiveUniversalSearchResult => {
  const query = rawQuery.trim().toLowerCase();
  const cleanDigits = rawQuery.replace(/[^0-9]/g, '');

  if (!query && !cleanDigits) {
    return {
      query: '',
      nikMatches: [],
      spptMatches: [],
      kkMatches: [],
      duplicateCount: 0,
    };
  }

  const nikMatches: NikMatchRecord[] = [];
  const kkMatches: DataKeluarga[] = [];
  const spptMatches: SpptPbbItem[] = [];

  // Search Data Keluarga
  for (const kk of dataKeluarga) {
    let matchedKk = false;
    const kkNik = cleanNik(kk.nikKepalaKeluarga || kk.nomorKk);
    const kkNo = cleanNomorKk(kk.nomorKk);
    const kkNop = cleanNop(kk.nopPbb);
    const kkNama = kk.namaKepalaKeluarga?.toLowerCase() || '';
    const kkJalan = kk.namaJalan?.toLowerCase() || '';

    if (
      (cleanDigits && (kkNik.includes(cleanDigits) || kkNo.includes(cleanDigits) || kkNop.includes(cleanDigits))) ||
      (query && (kkNama.includes(query) || kkJalan.includes(query)))
    ) {
      kkMatches.push(kk);
      matchedKk = true;
    }

    // Check Nik Kepala Keluarga specifically for NIK list
    if (cleanDigits && kkNik.includes(cleanDigits)) {
      nikMatches.push({
        kkId: kk.id,
        nomorKk: kk.nomorKk || '-',
        nik: kk.nikKepalaKeluarga || kkNik,
        nama: kk.namaKepalaKeluarga,
        role: 'Kepala Keluarga',
        hubunganKeluarga: 'Kepala Keluarga',
        lingkunganNomor: kk.lingkunganNomor || 1,
        lingkunganNama: kk.lingkunganNama || `Lingkungan ${kk.lingkunganNomor || 1}`,
        namaJalan: kk.namaJalan || kk.alamatLengkap || '-',
        alamatLengkap: kk.alamatLengkap,
        telepon: kk.telepon,
      });
    }

    // Check Anggota Keluarga
    if (kk.anggotaKeluarga && Array.isArray(kk.anggotaKeluarga)) {
      for (const ang of kk.anggotaKeluarga) {
        const angNik = cleanNik(ang.nik);
        const angNama = ang.nama?.toLowerCase() || '';
        if ((cleanDigits && angNik.includes(cleanDigits)) || (query && angNama.includes(query))) {
          nikMatches.push({
            kkId: kk.id,
            nomorKk: kk.nomorKk || '-',
            nik: ang.nik,
            nama: ang.nama,
            role: 'Anggota Keluarga',
            hubunganKeluarga: ang.hubunganKeluarga || 'Anggota',
            lingkunganNomor: kk.lingkunganNomor || 1,
            lingkunganNama: kk.lingkunganNama || `Lingkungan ${kk.lingkunganNomor || 1}`,
            namaJalan: kk.namaJalan || kk.alamatLengkap || '-',
            alamatLengkap: kk.alamatLengkap,
            memberId: ang.id,
          });
          if (!matchedKk) {
            kkMatches.push(kk);
            matchedKk = true;
          }
        }
      }
    }
  }

  // Search SPPT PBB
  for (const s of spptList) {
    const sNop = cleanNop(s.nop);
    const sNama = s.namaWp?.toLowerCase() || '';
    const sAlamat = s.alamatOp?.toLowerCase() || '';

    if ((cleanDigits && sNop.includes(cleanDigits)) || (query && (sNama.includes(query) || sAlamat.includes(query)))) {
      spptMatches.push(s);
    }
  }

  // Count duplicates in results
  const nikCounts = new Map<string, number>();
  nikMatches.forEach((m) => {
    const c = cleanNik(m.nik);
    nikCounts.set(c, (nikCounts.get(c) || 0) + 1);
  });
  let duplicateCount = 0;
  nikCounts.forEach((count) => {
    if (count > 1) duplicateCount++;
  });

  return {
    query: rawQuery,
    nikMatches,
    spptMatches,
    kkMatches,
    duplicateCount,
  };
};
