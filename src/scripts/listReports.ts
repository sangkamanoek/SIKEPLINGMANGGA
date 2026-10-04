import { fetchReportsFromFirestore } from '../lib/firestoreService';

async function listReports() {
  const reports = await fetchReportsFromFirestore();
  console.log(JSON.stringify(reports.map(r => ({ id: r.id, nama: r.namaKepling, tanggal: r.tanggal, createdAt: r.createdAt })), null, 2));
}

listReports().catch(console.error);
