import { fetchReportsFromFirestore } from './firestoreService';
import { safeGetLocalStorage } from './safeStorage';
import { LOCAL_STORAGE_KEY_LAPORAN } from './reportsApi';
import { getReportIsoDate } from './formatter';
import { LaporanHarianItem } from '../types';

export const runDiagnosticReport = async (monthIso: string) => {
  console.log(`--- Starting Diagnostic Report for ${monthIso} ---`);

  // 1. Fetch Local
  const localReports = safeGetLocalStorage<LaporanHarianItem[]>(LOCAL_STORAGE_KEY_LAPORAN, []) || [];
  
  // 2. Fetch Firestore
  const firestoreReports = await fetchReportsFromFirestore();

  // 3. Filter by month
  const filterByMonth = (reports: LaporanHarianItem[]) => 
    reports.filter(r => getReportIsoDate(r).startsWith(monthIso));

  const localFiltered = filterByMonth(localReports);
  const firestoreFiltered = filterByMonth(firestoreReports);

  console.log(`Reports found - Local: ${localFiltered.length}, Firestore: ${firestoreFiltered.length}`);

  // 4. Aggregate
  const aggregate = (reports: LaporanHarianItem[]) => {
    const map = new Map<string, any>();
    reports.forEach(r => {
      const id = r.namaKepling || 'Unknown';
      const current = map.get(id) || { count: 0, pbb: 0, perlinsos: 0, ikd: 0, bpjs: 0 };
      current.count += 1;
      current.pbb += Number(r.kinerja?.opsirPbbWp) || 0;
      current.perlinsos += Number(r.kinerja?.perlinsosKk) || 0;
      current.ikd += Number(r.kinerja?.ikdOrang) || 0;
      current.bpjs += Number(r.kinerja?.bpjsKetenagakerjaanOrang) || 0;
      map.set(id, current);
    });
    return map;
  };

  const localAgg = aggregate(localFiltered);
  const firestoreAgg = aggregate(firestoreFiltered);

  // 5. Compare
  const allKeplingIds = new Set([...localAgg.keys(), ...firestoreAgg.keys()]);
  
  console.log('--- Aggregation Discrepancies ---');
  allKeplingIds.forEach(id => {
    const l = localAgg.get(id) || { count: 0, pbb: 0, perlinsos: 0, ikd: 0, bpjs: 0 };
    const f = firestoreAgg.get(id) || { count: 0, pbb: 0, perlinsos: 0, ikd: 0, bpjs: 0 };

    if (JSON.stringify(l) !== JSON.stringify(f)) {
      console.log(`Discrepancy for ${id}:`);
      console.log(`  Local: count=${l.count}, pbb=${l.pbb}, perlinsos=${l.perlinsos}, ikd=${l.ikd}, bpjs=${l.bpjs}`);
      console.log(`  Firestore: count=${f.count}, pbb=${f.pbb}, perlinsos=${f.perlinsos}, ikd=${f.ikd}, bpjs=${f.bpjs}`);
    }
  });

  console.log('--- Diagnostic Report Finished ---');
};
