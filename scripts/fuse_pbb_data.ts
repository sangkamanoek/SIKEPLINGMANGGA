import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  setDoc,
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import config from '../firebase-applet-config.json';

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

interface RawSpptItem {
  id: string;
  no?: number;
  nop: string;
  namaWp: string;
  alamatObjek?: string;
  alamatOp?: string;
  lingkungan?: number;
  buku?: string | number;
  pbbTerutang?: number;
  ketetapan?: number;
  terbayar?: number;
  jumlahBayar?: number | null;
  status: string;
  keterangan?: string;
  tglBayar?: string | null;
  updatedAt?: string;
  isDiskon?: boolean;
  diskonPembayaran?: number;
  persenDiskon?: number;
  isBermasalah?: boolean;
  masalahNote?: string;
}

function stripNonDigits(str: string): string {
  return String(str || '').replace(/\D/g, '');
}

function formatNop(digits: string): string {
  if (digits.length < 18) return digits;
  // Format: 12.75.010.009.001-0001.0
  const d = digits.padEnd(18, '0');
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 7)}.${d.slice(7, 10)}.${d.slice(10, 13)}-${d.slice(13, 17)}.${d.slice(17, 18)}`;
}

async function runFusion() {
  console.log('[PBB Fusion] Memulai proses difusi data PBB Tahun 2026...');
  const spptColl = collection(db, 'pbb_sppt_2026');
  const snap = await getDocs(spptColl);
  console.log(`[PBB Fusion] Total dokumen mentah di Firestore: ${snap.size}`);

  const byNop = new Map<string, RawSpptItem[]>();
  snap.forEach((d) => {
    const data = d.data() as RawSpptItem;
    const cleanNop = stripNonDigits(data.nop);
    if (!cleanNop) return;
    if (!byNop.has(cleanNop)) {
      byNop.set(cleanNop, []);
    }
    byNop.get(cleanNop)!.push({ ...data, id: d.id });
  });

  console.log(`[PBB Fusion] Total NOP Unik (Wajib Pajak): ${byNop.size}`);

  const fusedItems: RawSpptItem[] = [];
  const idsToDelete: string[] = [];

  // Summary aggregation
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

  for (const [cleanNop, docs] of byNop.entries()) {
    // 1. Urutkan dokumen: prioritaskan status Sudah Bayar / LUNAS, lalu updatedAt terbaru
    docs.sort((a, b) => {
      const aLunas = (a.status === 'Sudah Bayar' || a.status === 'LUNAS') ? 1 : 0;
      const bLunas = (b.status === 'Sudah Bayar' || b.status === 'LUNAS') ? 1 : 0;
      if (aLunas !== bLunas) return bLunas - aLunas;
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });

    const isLunas = docs.some((d) => d.status === 'Sudah Bayar' || d.status === 'LUNAS');
    const primary = docs[0];

    // Temukan metadata terbaik dari seluruh entri duplikat
    const namaWp =
      docs.find((d) => d.namaWp && !d.namaWp.includes('NOP BARU') && !d.namaWp.includes('Warga'))?.namaWp ||
      primary.namaWp ||
      'WAJIB PAJAK';

    const alamatOp =
      docs.find((d) => d.alamatOp && d.alamatOp !== 'KELURAHAN MANGGA')?.alamatOp ||
      primary.alamatOp ||
      docs.find((d) => d.alamatObjek)?.alamatObjek ||
      'KELURAHAN MANGGA';

    const pbbTerutang =
      docs.find((d) => Number(d.pbbTerutang) > 0)?.pbbTerutang ||
      Number(primary.pbbTerutang) ||
      Number(primary.ketetapan) ||
      0;

    let lingkungan =
      docs.find((d) => Number(d.lingkungan) >= 1 && Number(d.lingkungan) <= 24)?.lingkungan ||
      Number(primary.lingkungan) ||
      0;

    // Deteksi lingkungan dari NOP jika belum ada
    if (lingkungan < 1 || lingkungan > 24) {
      const formatted = formatNop(cleanNop);
      const match = formatted.match(/\.009\.(\d{3})-/i);
      if (match) {
        const bNum = parseInt(match[1], 10);
        if (bNum >= 1 && bNum <= 24) lingkungan = bNum;
      }
      if (lingkungan < 1 || lingkungan > 24) lingkungan = 1;
    }

    const buku = docs.find((d) => d.buku)?.buku || primary.buku || 'I, II, III';

    const tglBayar =
      docs.find((d) => d.tglBayar)?.tglBayar ||
      (isLunas ? primary.tglBayar || primary.updatedAt || new Date().toISOString() : null);

    const jumlahBayar = isLunas
      ? docs.find((d) => Number(d.jumlahBayar) > 0)?.jumlahBayar || pbbTerutang
      : 0;

    const isBermasalah = docs.some((d) => d.isBermasalah === true);
    const masalahNote = docs.find((d) => d.masalahNote)?.masalahNote || '';

    // ID Deterministik standar
    const canonicalId = `pbb_2026_${cleanNop}`;

    const canonicalDoc: RawSpptItem = {
      id: canonicalId,
      no: primary.no || 0,
      nop: formatNop(cleanNop),
      namaWp: String(namaWp).trim().toUpperCase(),
      alamatOp: String(alamatOp).trim().toUpperCase(),
      pbbTerutang: Number(pbbTerutang) || 0,
      lingkungan: Number(lingkungan),
      buku: String(buku),
      status: isLunas ? 'Sudah Bayar' : 'Belum Bayar',
      jumlahBayar: isLunas ? Number(jumlahBayar) || Number(pbbTerutang) || 0 : 0,
      tglBayar: isLunas ? tglBayar : null,
      isBermasalah,
      masalahNote,
      updatedAt: primary.updatedAt || new Date().toISOString(),
    };

    fusedItems.push(canonicalDoc);

    // Kumpulkan seluruh id lama yang bukan canonicalId untuk dihapus
    for (const d of docs) {
      if (d.id !== canonicalId) {
        idsToDelete.push(d.id);
      }
    }

    // Statistik agregasi
    totalTargetNominal += canonicalDoc.pbbTerutang;
    if (isLunas) {
      totalLunas++;
      totalRealisasiNominal += canonicalDoc.jumlahBayar || canonicalDoc.pbbTerutang;
    } else {
      totalBelumLunas++;
    }

    const lk = Number(lingkungan);
    if (lk >= 1 && lk <= 24) {
      lingkunganBuckets[lk].count++;
      lingkunganBuckets[lk].targetNominal += canonicalDoc.pbbTerutang;
      if (isBermasalah) lingkunganBuckets[lk].bermasalahCount++;
      if (isLunas) {
        lingkunganBuckets[lk].lunasCount++;
        lingkunganBuckets[lk].realisasiNominal += canonicalDoc.jumlahBayar || canonicalDoc.pbbTerutang;
      }
    }
  }

  console.log(`[PBB Fusion] Data Kanonikal yang Dipertahankan: ${fusedItems.length} WP`);
  console.log(`[PBB Fusion] Data Duplikat yang Akan Dihapus: ${idsToDelete.length} dokumen`);
  console.log(`[PBB Fusion] Total WP Lunas: ${totalLunas}`);
  console.log(`[PBB Fusion] Total WP Belum Lunas: ${totalBelumLunas}`);
  console.log(`[PBB Fusion] Target Nominal: Rp ${totalTargetNominal.toLocaleString('id-ID')}`);
  console.log(`[PBB Fusion] Realisasi Nominal: Rp ${totalRealisasiNominal.toLocaleString('id-ID')}`);

  // 1. Simpan dokumen kanonikal ke Firestore dalam batch 400
  console.log('[PBB Fusion] Mengunggah dokumen kanonikal ke Firestore...');
  const BATCH_SIZE = 400;
  for (let i = 0; i < fusedItems.length; i += BATCH_SIZE) {
    const chunk = fusedItems.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const docRef = doc(db, 'pbb_sppt_2026', item.id);
      batch.set(docRef, item, { merge: true });
    }
    await batch.commit();
    console.log(`[PBB Fusion] Tersimpan ${Math.min(i + BATCH_SIZE, fusedItems.length)} / ${fusedItems.length} dokumen kanonikal...`);
  }

  // 2. Hapus dokumen duplikat usang dalam batch 400
  console.log(`[PBB Fusion] Menghapus ${idsToDelete.length} dokumen duplikat dari Firestore...`);
  for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
    const chunk = idsToDelete.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const id of chunk) {
      const docRef = doc(db, 'pbb_sppt_2026', id);
      batch.delete(docRef);
    }
    await batch.commit();
    console.log(`[PBB Fusion] Terhapus ${Math.min(i + BATCH_SIZE, idsToDelete.length)} / ${idsToDelete.length} dokumen duplikat...`);
  }

  // 3. Bangun Ringkasan Resmi Kelurahan (KelurahanPbbOverview)
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
    totalWp: fusedItems.length,
    totalWpLunas: totalLunas,
    totalWpBelumLunas: totalBelumLunas,
    totalTargetNominal,
    totalRealisasiNominal,
    totalSisaNominal: Math.max(0, totalTargetNominal - totalRealisasiNominal),
    persentaseRealisasiNominal: totalTargetNominal > 0 ? (totalRealisasiNominal / totalTargetNominal) * 100 : 0,
    persentaseWpLunas: fusedItems.length > 0 ? (totalLunas / fusedItems.length) * 100 : 0,
    totalBermasalah: fusedItems.filter((x) => x.isBermasalah).length,
    lingkunganSummaries,
    updatedAt: new Date().toISOString(),
  };

  // 4. Tulis ke Firestore pbb_summary/2026
  console.log('[PBB Fusion] Memperbarui Firestore pbb_summary/2026...');
  await setDoc(doc(db, 'pbb_summary', '2026'), finalSummary, { merge: true });

  // 5. Perbarui berkas data lokal
  const summaryJsonPath = path.join(__dirname, '../data/pbb_summary.json');
  let currentJson: any = {};
  try {
    if (fs.existsSync(summaryJsonPath)) {
      currentJson = JSON.parse(fs.readFileSync(summaryJsonPath, 'utf-8'));
    }
  } catch {}
  currentJson['2026'] = finalSummary;
  fs.writeFileSync(summaryJsonPath, JSON.stringify(currentJson, null, 2), 'utf-8');

  // 6. Perbarui src/data/pbbSummaryData.ts
  const summaryTsContent = `export const PRECOMPUTED_PBB_SUMMARY_2026 = ${JSON.stringify(finalSummary, null, 2)};\n`;
  const summaryTsPath = path.join(__dirname, '../src/data/pbbSummaryData.ts');
  fs.writeFileSync(summaryTsPath, summaryTsContent, 'utf-8');

  console.log('[PBB Fusion] SUKSES! Seluruh data PBB telah difusi secara akurat dan bersih.');
  process.exit(0);
}

runFusion().catch((err) => {
  console.error('[PBB Fusion ERROR]', err);
  process.exit(1);
});
