import { KeplingTargetCapaian, TargetsCapaianMap } from '../types';
import { KEPLING_ACCOUNTS } from './keplingList';

/**
 * Target PERLINSOS resmi berturut-turut tiap Kepala Lingkungan I s/d XXIV:
 * 1.  Lingkungan I:    429 KK
 * 2.  Lingkungan II:   330 KK
 * 3.  Lingkungan III:  342 KK
 * 4.  Lingkungan IV:   298 KK
 * 5.  Lingkungan V:    210 KK
 * 6.  Lingkungan VI:   400 KK
 * 7.  Lingkungan VII:  398 KK
 * 8.  Lingkungan VIII: 255 KK
 * 9.  Lingkungan IX:   367 KK
 * 10. Lingkungan X:    465 KK
 * 11. Lingkungan XI:   498 KK
 * 12. Lingkungan XII:  373 KK
 * 13. Lingkungan XIII: 440 KK
 * 14. Lingkungan XIV:  451 KK
 * 15. Lingkungan XV:   362 KK
 * 16. Lingkungan XVI:  295 KK
 * 17. Lingkungan XVII: 476 KK
 * 18. Lingkungan XVIII:340 KK
 * 19. Lingkungan XIX:  423 KK
 * 20. Lingkungan XX:   215 KK
 * 21. Lingkungan XXI:  253 KK
 * 22. Lingkungan XXII: 264 KK
 * 23. Lingkungan XXIII:426 KK
 * 24. Lingkungan XXIV: 229 KK
 * Total Target Kelurahan = 8,501 KK
 */
export const DEFAULT_PERLINSOS_TARGETS: number[] = [
  429, 330, 342, 298, 210, 400,
  398, 255, 367, 465, 498, 373,
  440, 451, 362, 295, 476, 340,
  423, 215, 253, 264, 426, 229
];

/**
 * Baseline Capaian Perlinsos awal/override berturut-turut Lk 1 s/d 24 (Dikosongkan agar 100% bersih):
 */
export const DEFAULT_PERLINSOS_BASELINES: number[] = new Array(24).fill(0);

/**
 * Baseline Capaian BPJS Ketenagakerjaan berturut-turut Lk 1 s/d 24 (Dikosongkan agar 100% bersih):
 */
export const DEFAULT_BPJS_BASELINES: number[] = new Array(24).fill(0);

/**
 * Generate default Targets & Capaian map for all 24 Kepling (per 26 September 2026)
 */
export function getDefaultTargetsCapaianMap(): TargetsCapaianMap {
  const map: TargetsCapaianMap = {};

  KEPLING_ACCOUNTS.forEach((k, index) => {
    const targetPerlinsos = DEFAULT_PERLINSOS_TARGETS[index] ?? 300;
    const baselinePerlinsos = DEFAULT_PERLINSOS_BASELINES[index] ?? 0;
    const baselineBpjs = DEFAULT_BPJS_BASELINES[index] ?? 0;
    map[k.id] = {
      keplingId: k.id,
      nomorLingkungan: k.nomorLingkungan || (index + 1),
      lingkungan: k.lingkungan,
      nama: k.nama,
      targetPerlinsos,
      targetPbb: 100, // target default WP
      targetIkd: 50,  // target default aktivasi IKD
      targetBpjs: 50, // target default BPJS TK (50 per Kepling)
      overridePerlinsos: baselinePerlinsos,
      overridePbb: null,
      overrideIkd: null,
      overrideBpjs: baselineBpjs,
      catatanPenyesuaian: 'Data Capaian BPJS TK & Perlinsos Resmi Kota Medan',
      updatedAt: '2026-09-26T00:00:00.000Z',
      updatedBy: 'Super Admin',
    };
  });

  return map;
}

/**
 * Hitung capaian efektif dengan memperhitungkan Data Akhir per 7 September 2026
 * dari Super Admin sebagai baseline, dan menambahkan laporan harian Kepling secara kumulatif.
 */
export function calculateEffectiveKinerja(
  reported: { pbb: number; perlinsos: number; ikd: number; bpjs: number },
  targetConfig?: KeplingTargetCapaian | null,
  keplingIndex?: number
) {
  const isPerlinsosOverridden =
    targetConfig?.overridePerlinsos !== null &&
    targetConfig?.overridePerlinsos !== undefined &&
    !isNaN(Number(targetConfig.overridePerlinsos));

  const isPbbOverridden =
    targetConfig?.overridePbb !== null &&
    targetConfig?.overridePbb !== undefined &&
    !isNaN(Number(targetConfig.overridePbb));

  const isIkdOverridden =
    targetConfig?.overrideIkd !== null &&
    targetConfig?.overrideIkd !== undefined &&
    !isNaN(Number(targetConfig.overrideIkd));

  const isBpjsOverridden =
    targetConfig?.overrideBpjs !== null &&
    targetConfig?.overrideBpjs !== undefined &&
    !isNaN(Number(targetConfig.overrideBpjs));

  // Determine baseline Perlinsos per 7 September 2026
  let baselinePerlinsos = 0;
  if (isPerlinsosOverridden) {
    baselinePerlinsos = Number(targetConfig!.overridePerlinsos);
  } else {
    const idx =
      keplingIndex ??
      (targetConfig?.nomorLingkungan ? targetConfig.nomorLingkungan - 1 : undefined);
    if (idx !== undefined && DEFAULT_PERLINSOS_BASELINES[idx] !== undefined) {
      baselinePerlinsos = DEFAULT_PERLINSOS_BASELINES[idx];
    }
  }

  const baselinePbb = isPbbOverridden ? Number(targetConfig!.overridePbb) : 0;
  const baselineIkd = isIkdOverridden ? Number(targetConfig!.overrideIkd) : 0;

  let baselineBpjs = 0;
  if (isBpjsOverridden) {
    baselineBpjs = Number(targetConfig!.overrideBpjs);
  } else {
    const idx =
      keplingIndex ??
      (targetConfig?.nomorLingkungan ? targetConfig.nomorLingkungan - 1 : undefined);
    if (idx !== undefined && DEFAULT_BPJS_BASELINES[idx] !== undefined) {
      baselineBpjs = DEFAULT_BPJS_BASELINES[idx];
    }
  }

  // Laporan baru Kepling (mulai tanggal 7 September dan seterusnya)
  const reportedPerlinsos = Number(reported?.perlinsos) || 0;
  const reportedPbb = Number(reported?.pbb) || 0;
  const reportedIkd = Number(reported?.ikd) || 0;
  const reportedBpjs = Number(reported?.bpjs) || 0;

  // Akumulasi Total Capaian = Basis Akhir 7 Sept + Akumulasi Laporan Kepling
  const effectivePerlinsos = baselinePerlinsos + reportedPerlinsos;
  const effectivePbb = baselinePbb + reportedPbb;
  const effectiveIkd = baselineIkd + reportedIkd;
  const effectiveBpjs = baselineBpjs + reportedBpjs;

  return {
    perlinsos: effectivePerlinsos,
    pbb: effectivePbb,
    ikd: effectiveIkd,
    bpjs: effectiveBpjs,
    baselinePerlinsos,
    baselinePbb,
    baselineIkd,
    baselineBpjs,
    reportedPerlinsos,
    reportedPbb,
    reportedIkd,
    reportedBpjs,
    isOverridden: isPerlinsosOverridden || isPbbOverridden || isIkdOverridden || isBpjsOverridden,
    isPerlinsosOverridden,
    isPbbOverridden,
    isIkdOverridden,
    isBpjsOverridden,
  };
}
