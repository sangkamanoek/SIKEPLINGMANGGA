import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import config from '../firebase-applet-config.json';

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  console.log('[Summary Sync] Mengambil 9.537 dokumen kanonikal yang sudah difusi...');
  const snap = await getDocs(collection(db, 'pbb_sppt_2026'));
  console.log(`[Summary Sync] Total dokumen: ${snap.size}`);

  const lingkunganBuckets = Array.from({ length: 25 }, () => ({
    count: 0,
    lunasCount: 0,
    targetNominal: 0,
    realisasiNominal: 0,
    bermasalahCount: 0,
  }));

  let totalTargetNominal = 0;
  let totalRealisasiNominal = 0;
  let totalLunas = 0;
  let totalBelumLunas = 0;
  let totalBermasalah = 0;

  snap.forEach((d) => {
    const s = d.data();
    const lk = Number(s.lingkungan) >= 1 && Number(s.lingkungan) <= 24 ? Number(s.lingkungan) : 1;
    const isLunas = s.status === 'Sudah Bayar' || s.status === 'LUNAS';
    const terutang = Number(s.pbbTerutang) || Number(s.ketetapan) || 0;
    const paid = isLunas ? Number(s.jumlahBayar) || terutang : 0;
    const isBermasalah = Boolean(s.isBermasalah);

    totalTargetNominal += terutang;
    if (isLunas) {
      totalLunas++;
      totalRealisasiNominal += paid;
    } else {
      totalBelumLunas++;
    }
    if (isBermasalah) totalBermasalah++;

    lingkunganBuckets[lk].count++;
    lingkunganBuckets[lk].targetNominal += terutang;
    if (isBermasalah) lingkunganBuckets[lk].bermasalahCount++;
    if (isLunas) {
      lingkunganBuckets[lk].lunasCount++;
      lingkunganBuckets[lk].realisasiNominal += paid;
    }
  });

  const lingkunganSummaries = [];
  for (let lk = 1; lk <= 24; lk++) {
    const b = lingkunganBuckets[lk];
    const sisa = Math.max(0, b.targetNominal - b.realisasiNominal);
    const pctNominal = b.targetNominal > 0 ? (b.realisasiNominal / b.targetNominal) * 100 : 0;
    const pctWp = b.count > 0 ? (b.lunasCount / b.count) * 100 : 0;

    lingkunganSummaries.push({
      lingkungan: lk,
      totalWp: b.count,
      wpLunas: b.lunasCount,
      targetNominal: b.targetNominal,
      realisasiNominal: b.realisasiNominal,
      sisaNominal: sisa,
      persentaseRealisasi: pctNominal,
      persentaseWpLunas: pctWp,
      totalBermasalah: b.bermasalahCount,
    });
  }

  const finalSummary = {
    year: 2026,
    totalWp: snap.size,
    totalWpLunas: totalLunas,
    totalWpBelumLunas: totalBelumLunas,
    totalTargetNominal,
    totalRealisasiNominal,
    totalSisaNominal: Math.max(0, totalTargetNominal - totalRealisasiNominal),
    persentaseRealisasiNominal: totalTargetNominal > 0 ? (totalRealisasiNominal / totalTargetNominal) * 100 : 0,
    persentaseWpLunas: snap.size > 0 ? (totalLunas / snap.size) * 100 : 0,
    totalBermasalah,
    lingkunganSummaries,
    updatedAt: new Date().toISOString(),
  };

  console.log('[Summary Sync] Hasil Ringkasan Resmi:', {
    totalWp: finalSummary.totalWp,
    totalWpLunas: finalSummary.totalWpLunas,
    totalTargetNominal: `Rp ${finalSummary.totalTargetNominal.toLocaleString('id-ID')}`,
    totalRealisasiNominal: `Rp ${finalSummary.totalRealisasiNominal.toLocaleString('id-ID')}`,
    persentaseWpLunas: `${finalSummary.persentaseWpLunas.toFixed(2)}%`,
  });

  // Tulis ke Firestore
  await setDoc(doc(db, 'pbb_summary', '2026'), finalSummary, { merge: true });
  console.log('[Summary Sync] Firestore doc pbb_summary/2026 berhasil diperbarui!');

  // Tulis ke data/pbb_summary.json
  const summaryJsonPath = path.join(process.cwd(), 'data/pbb_summary.json');
  let currentJson: any = {};
  try {
    if (fs.existsSync(summaryJsonPath)) {
      currentJson = JSON.parse(fs.readFileSync(summaryJsonPath, 'utf-8'));
    }
  } catch {}
  currentJson['2026'] = finalSummary;
  fs.writeFileSync(summaryJsonPath, JSON.stringify(currentJson, null, 2), 'utf-8');
  console.log('[Summary Sync] data/pbb_summary.json berhasil diperbarui!');

  // Tulis ke src/data/pbbSummaryData.ts
  const summaryTsContent = `export const PRECOMPUTED_PBB_SUMMARY_2026 = ${JSON.stringify(finalSummary, null, 2)};\n`;
  const summaryTsPath = path.join(process.cwd(), 'src/data/pbbSummaryData.ts');
  fs.writeFileSync(summaryTsPath, summaryTsContent, 'utf-8');
  console.log('[Summary Sync] src/data/pbbSummaryData.ts berhasil diperbarui!');

  process.exit(0);
}

run().catch((e) => {
  console.error('[Summary Sync ERROR]', e);
  process.exit(1);
});
