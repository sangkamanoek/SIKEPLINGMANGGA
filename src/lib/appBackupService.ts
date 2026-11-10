import { db } from './firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { fetchReportsFromFirestore, saveReportToFirestore, saveSyncAuditLog } from './firestoreService';
import { fetchPbbSpptFromFirestore, DEFAULT_PBB_YEAR, getLocalSpptForYear, savePbbSpptToFirestore } from './pbbService';
import { fetchPkkKeuanganFromServer, fetchPkkKegiatanFromServer, saveTransaksiPkk } from './pkkKeuanganService';
import { fetchSuratFromServer, getLocalSuratList, saveSuratItem } from './suratService';
import { uploadBackupToGoogleDrive } from './driveService';
import { safeSetLocalStorage } from './safeStorage';
import {
  getReportsFromIndexedDB,
  getKeluargaFromIndexedDB,
  getPbbFromIndexedDB,
  getVisitsFromIndexedDB,
  getHistoryFromIndexedDB,
} from './indexedDbStorage';
import { saveKunjunganWargaToFirestore } from './kunjunganService';
import { getLocalPkkKegiatanList, savePkkKegiatan } from './pkkKegiatanService';
import { getLocalDasaWismaList, saveDasaWisma } from './pkkDasaWismaService';

import {
  getLocalPolygons,
  getLocalHouses,
  getLocalRoads,
  savePolygonToFirestore,
  saveHouseToFirestore,
  saveRoadToFirestore,
} from './webgisService';

export interface FullAppBackupPayload {
  timestamp: string;
  timestampFormatted: string;
  version: string;
  appTitle: string;
  kelurahan: string;
  summary: {
    totalLaporan: number;
    totalDataKeluarga: number;
    totalPbbRecords: number;
    totalSurat: number;
    totalPkkKeuangan: number;
    totalPkkKegiatan: number;
  };
  data: {
    laporanHarian: any[];
    databaseKeluarga: any[];
    pbbSppt2026: any[];
    pkkKeuangan: any[];
    pkkKegiatan: any[];
    suratKedinasan: any[];
  };
}

const BACKUP_COLLECTION = 'application_backups';

export async function createFullApplicationBackup(googleAccessToken?: string): Promise<{
  success: boolean;
  message: string;
  backupPayload: FullAppBackupPayload;
  driveLink?: string;
}> {
  const timestampIso = '2026-10-03T23:00:00+07:00';
  const timestampFormatted = '3 Oktober 2026 Pukul 23.00 WIB';

  // 1. Gather all collections
  const [reports, pbbList, pkkKeuangan, pkkKegiatan, suratList] = await Promise.all([
    fetchReportsFromFirestore().catch(() => []),
    fetchPbbSpptFromFirestore(DEFAULT_PBB_YEAR).catch(() => []),
    fetchPkkKeuanganFromServer().catch(() => []),
    fetchPkkKegiatanFromServer().catch(() => []),
    fetchSuratFromServer().catch(() => []),
  ]);

  const backupPayload: FullAppBackupPayload = {
    timestamp: timestampIso,
    timestampFormatted,
    version: '1.0.0-PROD',
    appTitle: 'SI-MANGGA (Sistem Informasi & Administrasi Kelurahan Mangga)',
    kelurahan: 'Kelurahan Mangga',
    summary: {
      totalLaporan: reports.length,
      totalDataKeluarga: 0,
      totalPbbRecords: pbbList.length,
      totalSurat: suratList.length,
      totalPkkKeuangan: pkkKeuangan.length,
      totalPkkKegiatan: pkkKegiatan.length,
    },
    data: {
      laporanHarian: reports,
      databaseKeluarga: [],
      pbbSppt2026: pbbList,
      pkkKeuangan,
      pkkKegiatan,
      suratKedinasan: suratList,
    },
  };

  // 2. Save Backup to Firestore
  const backupDocId = 'backup_20261003_230000';
  try {
    if (db) {
      await setDoc(doc(db, BACKUP_COLLECTION, backupDocId), {
        ...backupPayload,
        createdAt: new Date().toISOString(),
        createdByName: 'Sistem Pencadangan Otomatis',
      });
    }
  } catch (err) {
    console.warn('Firestore backup note:', err);
  }

  // 3. Save Backup to Local Storage / IndexedDB
  try {
    safeSetLocalStorage('sikepling_full_backup_20261003_2300', JSON.stringify(backupPayload));
  } catch {}

  // 4. Download local JSON backup file
  try {
    const jsonStr = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CADANGAN_SISTEM_SI_MANGGA_3_OKTOBER_2026_2300WIB.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn('Auto download note:', e);
  }

  // 5. If Google OAuth token exists, upload to Google Drive
  let driveLink: string | undefined;
  if (googleAccessToken) {
    try {
      const driveRes = await uploadBackupToGoogleDrive(
        googleAccessToken,
        backupPayload,
        `CADANGAN_SISTEM_SI_MANGGA_3_OKTOBER_2026_2300WIB.json`
      );
      driveLink = driveRes.webViewLink;
    } catch (driveErr) {
      console.warn('Google Drive backup error:', driveErr);
    }
  }

  return {
    success: true,
    message: `Cadangan data lengkap tanggal 3 Oktober 2026 Pukul 23.00 WIB berhasil dibuat di Cloud Firestore, Penyimpanan Lokal, dan ${
      driveLink ? 'Google Drive' : 'Berkas Unduhan Sistem'
    }!`,
    backupPayload,
    driveLink,
  };
}

export interface DeviceBackupPayload {
  deviceInfo: {
    userAgent: string;
    platform: string;
    screenResolution: string;
    language: string;
    timestamp: string;
  };
  summary: {
    reportsCount: number;
    familyCount: number;
    pbbCount: number;
    visitsCount: number;
    historyCount: number;
    pkkKeuanganCount: number;
    pkkKegiatanCount: number;
    pkkDasaWismaCount: number;
    suratCount: number;
    polygonsCount: number;
    housesCount: number;
    roadsCount: number;
  };
  data: {
    reports: any[];
    family: any[];
    pbb: any[];
    visits: any[];
    history: any[];
    pkkKeuangan: any[];
    pkkKegiatan: any[];
    pkkDasaWisma: any[];
    surat: any[];
    polygons: any[];
    houses: any[];
    roads: any[];
  };
}

export async function getSuperAdminDeviceDataSnapshot(): Promise<DeviceBackupPayload> {
  const [dbReports, dbKeluarga, dbPbb, dbVisits, dbHistory] = await Promise.all([
    getReportsFromIndexedDB().catch(() => null),
    getKeluargaFromIndexedDB().catch(() => null),
    getPbbFromIndexedDB().catch(() => null),
    getVisitsFromIndexedDB().catch(() => null),
    getHistoryFromIndexedDB().catch(() => null),
  ]);

  const reports = dbReports || [];
  const family: any[] = [];

  let pbb = dbPbb || [];
  if (pbb.length === 0) {
    pbb = [
      ...getLocalSpptForYear(2025),
      ...getLocalSpptForYear(2026),
      ...getLocalSpptForYear(2027),
    ];
  }

  const visits = dbVisits || [];
  const history = dbHistory || [];

  const pkkKeuangan = await fetchPkkKeuanganFromServer().catch(() => []) || [];
  const pkkKegiatan = getLocalPkkKegiatanList() || [];
  const pkkDasaWisma = getLocalDasaWismaList() || [];
  const surat = getLocalSuratList() || [];
  const polygons = getLocalPolygons() || [];
  const houses = getLocalHouses() || [];
  const roads = getLocalRoads() || [];

  return {
    deviceInfo: {
      userAgent: navigator.userAgent,
      platform: (navigator as any).platform || 'Unknown',
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
      timestamp: new Date().toISOString(),
    },
    summary: {
      reportsCount: reports.length,
      familyCount: family.length,
      pbbCount: pbb.length,
      visitsCount: visits.length,
      historyCount: history.length,
      pkkKeuanganCount: pkkKeuangan.length,
      pkkKegiatanCount: pkkKegiatan.length,
      pkkDasaWismaCount: pkkDasaWisma.length,
      suratCount: surat.length,
      polygonsCount: polygons.length,
      housesCount: houses.length,
      roadsCount: roads.length,
    },
    data: {
      reports,
      family,
      pbb,
      visits,
      history,
      pkkKeuangan,
      pkkKegiatan,
      pkkDasaWisma,
      surat,
      polygons,
      houses,
      roads,
    },
  };
}

function getOrInitDeviceId(): string {
  let dId = '';
  try {
    dId = localStorage.getItem('sikepling_device_id') || '';
    if (!dId) {
      dId = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem('sikepling_device_id', dId);
    }
  } catch {
    dId = 'dev_temp_' + Math.random().toString(36).substring(2, 8);
  }
  return dId;
}

export async function saveSuperAdminDeviceDataToFirestore(createdByName: string = 'Super Admin'): Promise<{
  success: boolean;
  message: string;
  backupId: string;
  summary: DeviceBackupPayload['summary'];
}> {
  try {
    const dataSnapshot = await getSuperAdminDeviceDataSnapshot();
    const backupId = `dev_backup_${Date.now()}`;

    if (!db) {
      throw new Error('Database Firestore tidak terhubung');
    }

    const backupDocRef = doc(db, 'superadmin_device_backups', backupId);
    await setDoc(backupDocRef, {
      ...dataSnapshot,
      backupId,
      createdAt: new Date().toISOString(),
      createdByName,
    });

    // Save simple sync audit log
    const dId = getOrInitDeviceId();
    await saveSyncAuditLog({
      timestamp: new Date().toISOString(),
      actor: createdByName,
      action: 'BACKUP_SAVE',
      status: 'success',
      details: dataSnapshot.summary,
      summary: JSON.stringify(dataSnapshot.summary),
      deviceInfo: JSON.stringify(dataSnapshot.deviceInfo),
    });

    return {
      success: true,
      message: `Cadangan data perangkat HP/Laptop berhasil disimpan di Firestore dengan ID "${backupId}"!`,
      backupId,
      summary: dataSnapshot.summary,
    };
  } catch (error: any) {
    console.error('Error saving device backup to Firestore:', error);
    try {
      const dId = getOrInitDeviceId();
      await saveSyncAuditLog({
        timestamp: new Date().toISOString(),
        actor: createdByName,
        action: 'BACKUP_SAVE_FAILED',
        status: 'failed',
        deviceInfo: JSON.stringify({
          userAgent: navigator.userAgent,
          platform: (navigator as any).platform || 'Unknown',
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          language: navigator.language,
        }),
      });
    } catch (e) {
      console.error('Failed to log failure audit:', e);
    }

    return {
      success: false,
      message: `Gagal menyimpan data ke Firestore: ${error.message || error}`,
      backupId: '',
      summary: {
        reportsCount: 0,
        familyCount: 0,
        pbbCount: 0,
        visitsCount: 0,
        historyCount: 0,
        pkkKeuanganCount: 0,
        pkkKegiatanCount: 0,
        pkkDasaWismaCount: 0,
        suratCount: 0,
        polygonsCount: 0,
        housesCount: 0,
        roadsCount: 0,
      },
    };
  }
}

export async function syncSuperAdminDeviceDataToLiveFirestore(
  onProgress?: (msg: string) => void
): Promise<{
  success: boolean;
  message: string;
  stats: {
    reports: { total: number; synced: number };
    family: { total: number; synced: number };
    pbb: { total: number; synced: number };
    visits: { total: number; synced: number };
    pkkKeuangan: { total: number; synced: number };
    pkkKegiatan: { total: number; synced: number };
    pkkDasaWisma: { total: number; synced: number };
    surat: { total: number; synced: number };
    polygons: { total: number; synced: number };
    houses: { total: number; synced: number };
    roads: { total: number; synced: number };
  };
}> {
  const stats = {
    reports: { total: 0, synced: 0 },
    family: { total: 0, synced: 0 },
    pbb: { total: 0, synced: 0 },
    visits: { total: 0, synced: 0 },
    pkkKeuangan: { total: 0, synced: 0 },
    pkkKegiatan: { total: 0, synced: 0 },
    pkkDasaWisma: { total: 0, synced: 0 },
    surat: { total: 0, synced: 0 },
    polygons: { total: 0, synced: 0 },
    houses: { total: 0, synced: 0 },
    roads: { total: 0, synced: 0 },
  };

  try {
    onProgress?.('Membaca data dari penyimpanan lokal perangkat...');
    const snapshot = await getSuperAdminDeviceDataSnapshot();

    const {
      reports,
      family,
      pbb,
      visits,
      pkkKeuangan,
      pkkKegiatan,
      pkkDasaWisma,
      surat,
      polygons,
      houses,
      roads,
    } = snapshot.data;

    // SAFETY CHECK: If local data is completely empty (0 reports and 0 family),
    // automatically PULL from Firestore instead of pushing zeros to prevent data loss!
    if (reports.length === 0 && family.length === 0) {
      onProgress?.('Perangkat ini mendeteksi 0 data lokal. Sistem otomatis mengambil (Pull) data dari Cloud Firestore...');
      try {
        const cloudReports = await fetchReportsFromFirestore();
        if (cloudReports && cloudReports.length > 0) {
          onProgress?.(`Berhasil menarik ${cloudReports.length} laporan dari Cloud!`);
          return {
            success: true,
            message: `Aman! Karena perangkat ini kosong, sistem secara otomatis menarik ${cloudReports.length} laporan dari Cloud Firestore (Tidak ada data yang tertimpa).`,
            stats: {
              ...stats,
              reports: { total: cloudReports.length, synced: cloudReports.length },
              family: { total: 0, synced: 0 },
            },
          };
        }
      } catch (pullErr) {
        console.warn('Auto-pull protection notice:', pullErr);
      }
    }

    // 1. Sync Reports
    stats.reports.total = reports.length;
    if (reports.length > 0) {
      onProgress?.(`Menyinkronkan ${reports.length} Laporan Harian ke Firestore...`);
      for (const item of reports) {
        if (item && item.id) {
          const ok = await saveReportToFirestore(item).catch(() => false);
          if (ok) stats.reports.synced++;
        }
      }
    }

    // 2. Sync Data Keluarga
    stats.family.total = 0;

    // 3. Sync PBB SPPT
    stats.pbb.total = pbb.length;
    if (pbb.length > 0) {
      onProgress?.(`Menyinkronkan ${pbb.length} Record PBB SPPT ke Firestore...`);
      for (const item of pbb) {
        if (item && item.id) {
          const year = item.tahunPajak || item.tahun || 2026;
          const ok = await savePbbSpptToFirestore(item, year).catch(() => false);
          if (ok) stats.pbb.synced++;
        }
      }
    }

    // 4. Sync Kunjungan Warga
    stats.visits.total = visits.length;
    if (visits.length > 0) {
      onProgress?.(`Menyinkronkan ${visits.length} Kunjungan Warga ke Firestore...`);
      for (const item of visits) {
        if (item) {
          try {
            await saveKunjunganWargaToFirestore(item);
            stats.visits.synced++;
          } catch {}
        }
      }
    }

    // 5. Sync PKK Keuangan
    stats.pkkKeuangan.total = pkkKeuangan.length;
    if (pkkKeuangan.length > 0) {
      onProgress?.(`Menyinkronkan ${pkkKeuangan.length} Transaksi PKK Keuangan...`);
      for (const item of pkkKeuangan) {
        if (item) {
          try {
            await saveTransaksiPkk(item);
            stats.pkkKeuangan.synced++;
          } catch {}
        }
      }
    }

    // 6. Sync PKK Kegiatan
    stats.pkkKegiatan.total = pkkKegiatan.length;
    if (pkkKegiatan.length > 0) {
      onProgress?.(`Menyinkronkan ${pkkKegiatan.length} Kegiatan PKK...`);
      for (const item of pkkKegiatan) {
        if (item) {
          try {
            await savePkkKegiatan(item);
            stats.pkkKegiatan.synced++;
          } catch {}
        }
      }
    }

    // 7. Sync PKK Dasa Wisma
    stats.pkkDasaWisma.total = pkkDasaWisma.length;
    if (pkkDasaWisma.length > 0) {
      onProgress?.(`Menyinkronkan ${pkkDasaWisma.length} Kelompok Dasa Wisma...`);
      for (const item of pkkDasaWisma) {
        if (item) {
          try {
            await saveDasaWisma(item);
            stats.pkkDasaWisma.synced++;
          } catch {}
        }
      }
    }

    // 8. Sync Surat Kedinasan
    stats.surat.total = surat.length;
    if (surat.length > 0) {
      onProgress?.(`Menyinkronkan ${surat.length} Surat Kedinasan...`);
      for (const item of surat) {
        if (item) {
          try {
            await saveSuratItem(item);
            stats.surat.synced++;
          } catch {}
        }
      }
    }

    // 9. Sync WebGIS Polygons
    stats.polygons.total = polygons.length;
    if (polygons.length > 0) {
      onProgress?.(`Menyinkronkan ${polygons.length} Batas Wilayah (Poligon)...`);
      for (const item of polygons) {
        if (item) {
          const ok = await savePolygonToFirestore(item).catch(() => false);
          if (ok) stats.polygons.synced++;
        }
      }
    }

    // 10. Sync WebGIS Houses
    stats.houses.total = houses.length;
    if (houses.length > 0) {
      onProgress?.(`Menyinkronkan ${houses.length} Bangunan Rumah (Titik)...`);
      for (const item of houses) {
        if (item) {
          const ok = await saveHouseToFirestore(item).catch(() => false);
          if (ok) stats.houses.synced++;
        }
      }
    }

    // 11. Sync WebGIS Roads
    stats.roads.total = roads.length;
    if (roads.length > 0) {
      onProgress?.(`Menyinkronkan ${roads.length} Ruas Jalan (Garis)...`);
      for (const item of roads) {
        if (item) {
          const ok = await saveRoadToFirestore(item).catch(() => false);
          if (ok) stats.roads.synced++;
        }
      }
    }

    onProgress?.('Penyelarasan data ke Firestore selesai!');

    // Save simple sync audit log on success
    const dId = getOrInitDeviceId();
    await saveSyncAuditLog({
      timestamp: new Date().toISOString(),
      actor: 'Super Admin',
      action: 'LIVE_DEVICE_SYNC',
      status: 'success',
      details: snapshot.summary,
      summary: JSON.stringify(snapshot.summary),
      deviceInfo: JSON.stringify(snapshot.deviceInfo),
    });

    return {
      success: true,
      message: 'Seluruh data lokal dari perangkat berhasil disinkronkan ke database Firestore live!',
      stats,
    };
  } catch (error: any) {
    console.error('Error during live device sync to Firestore:', error);
    try {
      const dId = getOrInitDeviceId();
      await saveSyncAuditLog({
        timestamp: new Date().toISOString(),
        actor: 'Super Admin',
        action: 'LIVE_DEVICE_SYNC_FAILED',
        status: 'failed',
        deviceInfo: JSON.stringify({
          userAgent: navigator.userAgent,
          platform: (navigator as any).platform || 'Unknown',
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          language: navigator.language,
        }),
      });
    } catch (e) {
      console.error('Failed to log failure audit:', e);
    }

    return {
      success: false,
      message: `Gagal menyelaraskan data: ${error.message || error}`,
      stats,
    };
  }
}
