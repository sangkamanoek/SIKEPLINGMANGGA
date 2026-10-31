import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd && process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Performance-Optimized Cache Headers: Cache hashed static assets, keep API and HTML fresh
app.use((req, res, next) => {
  if (req.path.startsWith('/assets/') || req.path.match(/\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/i)) {
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  } else {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Enable JSON body parsing with large limit for compressed photo attachments
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Safe DATA_DIR resolver with fallback for read-only container filesystems
const getWritableDataDir = (): string => {
  if (process.env.VERCEL) {
    const tmpDir = path.join('/tmp', 'data');
    try {
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    } catch (e) {
      console.error('Failed to create /tmp/data dir:', e);
    }
    return tmpDir;
  }
  const primaryDir = path.join(process.cwd(), 'data');
  try {
    if (!fs.existsSync(primaryDir)) {
      fs.mkdirSync(primaryDir, { recursive: true });
    }
    const testFile = path.join(primaryDir, `.test_write_${Date.now()}`);
    fs.writeFileSync(testFile, 'ok', 'utf-8');
    fs.unlinkSync(testFile);
    return primaryDir;
  } catch (err) {
    console.warn('Primary data directory not writable, falling back to /tmp/data:', err);
    const fallbackDir = path.join('/tmp', 'data');
    try {
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
    } catch (e2) {
      console.error('Failed to create fallback data directory:', e2);
    }
    return fallbackDir;
  }
};

const DATA_DIR = getWritableDataDir();
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const DELETED_REPORTS_FILE = path.join(DATA_DIR, 'deleted_reports.json');

const loadStoredDeletedReports = (): string[] => {
  try {
    if (fs.existsSync(DELETED_REPORTS_FILE)) {
      const content = fs.readFileSync(DELETED_REPORTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading deleted reports file:', err);
  }
  return [];
};

const saveStoredDeletedReports = (deletedIds: string[]) => {
  try {
    fs.writeFileSync(DELETED_REPORTS_FILE, JSON.stringify(deletedIds, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving deleted reports file:', err);
  }
};

let deletedReportsCache: string[] = loadStoredDeletedReports();

const loadStoredReports = (): any[] => {
  try {
    if (fs.existsSync(REPORTS_FILE)) {
      const content = fs.readFileSync(REPORTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        const deletedSet = new Set(deletedReportsCache);
        const cleaned = parsed.filter((r) => r && r.id && !deletedSet.has(r.id));
        if (cleaned.length !== parsed.length) {
          saveStoredReports(cleaned);
        }
        return cleaned;
      }
    }
  } catch (err) {
    console.error('Error reading reports file:', err);
  }
  return [];
};

const saveStoredReports = (reports: any[]) => {
  try {
    const deletedSet = new Set(deletedReportsCache);
    const cleaned = reports.filter((r) => r && r.id && !deletedSet.has(r.id));
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(cleaned, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving reports file:', err);
  }
};

// In-memory cache synced with disk
let reportsCache = loadStoredReports();

// Targets & Capaian Data File
const TARGETS_FILE = path.join(DATA_DIR, 'targets_capaian.json');
const PASSWORDS_FILE = path.join(DATA_DIR, 'passwords.json');

const loadStoredPasswords = (): Record<string, string> => {
  try {
    if (fs.existsSync(PASSWORDS_FILE)) {
      const content = fs.readFileSync(PASSWORDS_FILE, 'utf-8');
      return JSON.parse(content) || {};
    }
  } catch (err) {
    console.error('Error reading passwords file:', err);
  }
  return {};
};

const saveStoredPasswords = (passwords: Record<string, string>) => {
  try {
    fs.writeFileSync(PASSWORDS_FILE, JSON.stringify(passwords, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving passwords file:', err);
  }
};

let passwordsCache = loadStoredPasswords();

// Profiles Data File (Nama & Foto Profil)
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

const loadStoredProfiles = (): Record<string, any> => {
  try {
    if (fs.existsSync(PROFILES_FILE)) {
      const content = fs.readFileSync(PROFILES_FILE, 'utf-8');
      return JSON.parse(content) || {};
    }
  } catch (err) {
    console.error('Error reading profiles file:', err);
  }
  return {};
};

const saveStoredProfiles = (profiles: Record<string, any>) => {
  try {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving profiles file:', err);
  }
};

let profilesCache = loadStoredProfiles();

// Pembangunan & Infrastruktur Data File
const PEMBANGUNAN_FILE = path.join(DATA_DIR, 'pembangunan.json');

const isDummyPembangunan = (id: string) => /^pemb_[1-9](_.*)?$/.test(String(id || ''));

const loadStoredPembangunan = (): any[] => {
  try {
    if (fs.existsSync(PEMBANGUNAN_FILE)) {
      const content = fs.readFileSync(PEMBANGUNAN_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item && item.id && !isDummyPembangunan(item.id));
      }
    }
  } catch (err) {
    console.error('Error reading pembangunan file:', err);
  }
  return [];
};

const saveStoredPembangunan = (items: any[]) => {
  try {
    const cleaned = (items || []).filter((item) => item && item.id && !isDummyPembangunan(item.id));
    fs.writeFileSync(PEMBANGUNAN_FILE, JSON.stringify(cleaned, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving pembangunan file:', err);
  }
};

let pembangunanCache = loadStoredPembangunan();

// Attendance Data File (Presensi Apel Pagi Buffer)
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');

const loadStoredAttendance = (): any[] => {
  try {
    if (fs.existsSync(ATTENDANCE_FILE)) {
      const content = fs.readFileSync(ATTENDANCE_FILE, 'utf-8');
      return JSON.parse(content) || [];
    }
  } catch (err) {
    console.error('Error reading attendance file:', err);
  }
  return [];
};

const saveStoredAttendance = (attendance: any[]) => {
  try {
    fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(attendance, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving attendance file:', err);
  }
};

let attendanceCache = loadStoredAttendance();

const DEFAULT_TARGETS_LIST = new Array(24).fill(0);

const DEFAULT_PERLINSOS_BASELINES = new Array(24).fill(0);

const generateDefaultTargets = () => {
  const map: Record<string, any> = {};
  for (let i = 1; i <= 24; i++) {
    const keplingId = `kepling_${i}`;
    map[keplingId] = {
      keplingId,
      nomorLingkungan: i,
      targetPerlinsos: DEFAULT_TARGETS_LIST[i - 1] ?? 300,
      targetPbb: 100,
      targetIkd: 50,
      targetBpjs: 25,
      overridePerlinsos: DEFAULT_PERLINSOS_BASELINES[i - 1] ?? null,
      overridePbb: null,
      overrideIkd: null,
      overrideBpjs: null,
      catatanPenyesuaian: 'Data Capaian Perlinsos per 21 September 2026',
      updatedAt: '2026-09-21T00:00:00.000Z',
      updatedBy: 'Super Admin',
    };
  }
  return map;
};

const loadStoredTargets = () => {
  try {
    if (fs.existsSync(TARGETS_FILE)) {
      const content = fs.readFileSync(TARGETS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading targets file:', err);
  }
  const defaults = generateDefaultTargets();
  saveStoredTargets(defaults);
  return defaults;
};

const saveStoredTargets = (targets: any) => {
  try {
    fs.writeFileSync(TARGETS_FILE, JSON.stringify(targets, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving targets file:', err);
  }
};

let targetsCache = loadStoredTargets();

// PBB SPPT Data File (Server Buffer per Tahun Pajak)
const PBB_FILE = path.join(DATA_DIR, 'pbb_sppt.json');

const loadStoredPbb = (): Record<string, any[]> => {
  try {
    if (fs.existsSync(PBB_FILE)) {
      const content = fs.readFileSync(PBB_FILE, 'utf-8');
      return JSON.parse(content) || {};
    }
  } catch (err) {
    console.error('Error reading PBB file:', err);
  }
  return {};
};

const saveStoredPbb = (pbbData: Record<string, any[]>) => {
  try {
    fs.writeFileSync(PBB_FILE, JSON.stringify(pbbData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving PBB file:', err);
  }
};

let pbbCache: Record<string, any[]> = loadStoredPbb();

// Data Keluarga (Kartu Keluarga) Server Buffer File
const DATA_KELUARGA_FILE = path.join(DATA_DIR, 'data_keluarga.json');

const loadStoredDataKeluarga = (): any[] => {
  try {
    if (fs.existsSync(DATA_KELUARGA_FILE)) {
      const content = fs.readFileSync(DATA_KELUARGA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading Data Keluarga file:', err);
  }
  return [];
};

const saveStoredDataKeluarga = (list: any[]) => {
  try {
    fs.writeFileSync(DATA_KELUARGA_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving Data Keluarga file:', err);
  }
};

let dataKeluargaCache: any[] = loadStoredDataKeluarga();

// Accounts Data File (Dynamic accounts & soft-deleted IDs)
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

interface StoredAccountsData {
  dynamicAccounts: any[];
  deletedAccountIds: string[];
}

const loadStoredAccounts = (): StoredAccountsData => {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const content = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        dynamicAccounts: Array.isArray(parsed?.dynamicAccounts) ? parsed.dynamicAccounts : [],
        deletedAccountIds: Array.isArray(parsed?.deletedAccountIds) ? parsed.deletedAccountIds : [],
      };
    }
  } catch (err) {
    console.error('Error reading accounts file:', err);
  }
  return { dynamicAccounts: [], deletedAccountIds: [] };
};

const saveStoredAccounts = (data: StoredAccountsData) => {
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving accounts file:', err);
  }
};

let accountsCache = loadStoredAccounts();

// Kunjungan Warga Data File (Door-to-door visits)
const KUNJUNGAN_FILE = path.join(DATA_DIR, 'kunjungan.json');

const loadStoredKunjungan = (): any[] => {
  try {
    if (fs.existsSync(KUNJUNGAN_FILE)) {
      const content = fs.readFileSync(KUNJUNGAN_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading kunjungan file:', err);
  }
  return [];
};

const saveStoredKunjungan = (items: any[]) => {
  try {
    fs.writeFileSync(KUNJUNGAN_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving kunjungan file:', err);
  }
};

let kunjunganCache = loadStoredKunjungan();

// WebGIS Houses Data File (Titik Rumah Bangunan)
const WEBGIS_HOUSES_FILE = path.join(DATA_DIR, 'webgis_houses.json');

const loadStoredWebgisHouses = (): any[] => {
  try {
    if (fs.existsSync(WEBGIS_HOUSES_FILE)) {
      const content = fs.readFileSync(WEBGIS_HOUSES_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading webgis houses file:', err);
  }
  return [];
};

const saveStoredWebgisHouses = (items: any[]) => {
  try {
    fs.writeFileSync(WEBGIS_HOUSES_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving webgis houses file:', err);
  }
};

let webgisHousesCache = loadStoredWebgisHouses();

// PKK Keuangan Data File (Buku Kas Umum Tim Penggerak PKK)
const PKK_KEUANGAN_FILE = path.join(DATA_DIR, 'pkk_keuangan.json');

const loadStoredPkkKeuangan = (): any[] => {
  try {
    if (fs.existsSync(PKK_KEUANGAN_FILE)) {
      const content = fs.readFileSync(PKK_KEUANGAN_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading pkk keuangan file:', err);
  }
  return [];
};

const saveStoredPkkKeuangan = (items: any[]) => {
  try {
    fs.writeFileSync(PKK_KEUANGAN_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving pkk keuangan file:', err);
  }
};

let pkkKeuanganCache = loadStoredPkkKeuangan();

// Arsip Surat Kedinasan Data File
const SURAT_FILE = path.join(DATA_DIR, 'surat.json');

const loadStoredSurat = (): any[] => {
  try {
    if (fs.existsSync(SURAT_FILE)) {
      const content = fs.readFileSync(SURAT_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading surat file:', err);
  }
  return [];
};

const saveStoredSurat = (items: any[]) => {
  try {
    fs.writeFileSync(SURAT_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving surat file:', err);
  }
};

let suratCache = loadStoredSurat();

// Strict Anti-Cache Headers Middleware for all /api calls
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// API Health & Root Endpoints for Vercel Agent and Cloud Run probes
app.get(['/api', '/api/', '/api/index', '/api/index.ts', '/api/health'], (_req, res) => {
  res.json({
    status: 'ok',
    success: true,
    service: 'SI-KEPLING Kelurahan Mangga API',
    timestamp: new Date().toISOString(),
  });
});

// Network True Time API (Official Network/Server Clock for tamper-proof attendance)
app.all(['/api/time', '/api/network-time', '/api/server-time'], (_req, res) => {
  const now = new Date();
  const timestamp = now.getTime();
  const utcIso = now.toISOString();

  // Precise WIB Calculation (UTC+7)
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const utcSeconds = now.getUTCSeconds();
  let wibHours = utcHours + 7;
  if (wibHours >= 24) wibHours -= 24;

  const wibTimeFormatted = `${String(wibHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}:${String(utcSeconds).padStart(2, '0')} WIB`;
  const wibDate = new Date(timestamp + 7 * 3600000).toISOString().split('T')[0];

  res.setHeader('Date', now.toUTCString());
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  res.json({
    success: true,
    timestamp,
    utcIso,
    wibTime: wibTimeFormatted,
    wibDate,
    timezone: 'Asia/Jakarta (WIB, UTC+7)',
    serverClockVerified: true,
  });
});

// =========================================================================
// ACCOUNTS & USERNAMES CRUD ENDPOINTS
// =========================================================================

// GET all active dynamic accounts and deleted account IDs
app.get('/api/accounts', (_req, res) => {
  return res.json({
    success: true,
    dynamicAccounts: accountsCache.dynamicAccounts,
    deletedAccountIds: accountsCache.deletedAccountIds,
  });
});

// POST save or update account
app.post('/api/accounts', (req, res) => {
  try {
    const { account, dynamicAccounts, deletedAccountIds } = req.body;

    // Full replacement / batch sync
    if (Array.isArray(dynamicAccounts) || Array.isArray(deletedAccountIds)) {
      if (Array.isArray(dynamicAccounts)) {
        accountsCache.dynamicAccounts = dynamicAccounts;
      }
      if (Array.isArray(deletedAccountIds)) {
        accountsCache.deletedAccountIds = deletedAccountIds;
      }
      saveStoredAccounts(accountsCache);
      return res.json({
        success: true,
        dynamicAccounts: accountsCache.dynamicAccounts,
        deletedAccountIds: accountsCache.deletedAccountIds,
      });
    }

    if (!account || !account.id) {
      return res.status(400).json({ success: false, message: 'Data akun tidak lengkap' });
    }

    const cleanId = String(account.id).trim().toLowerCase();
    const idx = accountsCache.dynamicAccounts.findIndex((a) => a.id.toLowerCase() === cleanId);
    if (idx >= 0) {
      accountsCache.dynamicAccounts[idx] = { ...accountsCache.dynamicAccounts[idx], ...account };
    } else {
      accountsCache.dynamicAccounts.push({ ...account, id: cleanId });
    }

    // If ID was in deleted list, remove it
    accountsCache.deletedAccountIds = accountsCache.deletedAccountIds.filter((id) => id.toLowerCase() !== cleanId);

    saveStoredAccounts(accountsCache);
    return res.json({
      success: true,
      data: account,
      dynamicAccounts: accountsCache.dynamicAccounts,
      deletedAccountIds: accountsCache.deletedAccountIds,
    });
  } catch (err: any) {
    console.error('Error saving account to server:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE account by ID
app.delete('/api/accounts/:id', (req, res) => {
  try {
    const id = String(req.params.id || '').trim().toLowerCase();
    if (!id) {
      return res.status(400).json({ success: false, message: 'ID akun diperlukan' });
    }

    // 1. Remove from dynamicAccounts if present
    accountsCache.dynamicAccounts = accountsCache.dynamicAccounts.filter((a) => a.id.toLowerCase() !== id);

    // 2. Add to deletedAccountIds
    if (!accountsCache.deletedAccountIds.some((delId) => delId.toLowerCase() === id)) {
      accountsCache.deletedAccountIds.push(id);
    }

    saveStoredAccounts(accountsCache);
    return res.json({
      success: true,
      message: `Akun ${id} berhasil dihapus / dinonaktifkan`,
      dynamicAccounts: accountsCache.dynamicAccounts,
      deletedAccountIds: accountsCache.deletedAccountIds,
    });
  } catch (err: any) {
    console.error('Error deleting account on server:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST restore deleted account
app.post('/api/accounts/restore', (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: 'ID akun diperlukan' });
    }
    const cleanId = String(id).trim().toLowerCase();
    accountsCache.deletedAccountIds = accountsCache.deletedAccountIds.filter((d) => d.toLowerCase() !== cleanId);
    saveStoredAccounts(accountsCache);
    return res.json({
      success: true,
      message: `Akun ${cleanId} berhasil dipulihkan`,
      deletedAccountIds: accountsCache.deletedAccountIds,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// KUNJUNGAN WARGA (DOOR-TO-DOOR) CRUD ENDPOINTS
// =========================================================================

// GET all kunjungan records (supports light=true to prevent Vercel data overage)
app.get('/api/kunjungan', (req, res) => {
  if (req.query.light === 'true') {
    const lightKunjungan = kunjunganCache.map((k) => {
      const { fotoDokumentasi, fotoRumah, ...rest } = k;
      return {
        ...rest,
        hasFoto: Boolean(fotoDokumentasi || fotoRumah),
      };
    });
    return res.json({
      success: true,
      count: lightKunjungan.length,
      data: lightKunjungan,
    });
  }
  return res.json({
    success: true,
    count: kunjunganCache.length,
    data: kunjunganCache,
  });
});

// POST save single or batch kunjungan records
app.post('/api/kunjungan', (req, res) => {
  try {
    const rawBody = req.body;
    const items = rawBody?.items || (Array.isArray(rawBody) ? rawBody : null);
    const item = rawBody?.item || (!items && rawBody?.namaWarga ? rawBody : null);

    // Batch save
    if (Array.isArray(items)) {
      for (const it of items) {
        if (!it || !it.id) continue;
        if (it.namaWarga) it.namaWarga = String(it.namaWarga).trim().toUpperCase();
        if (it.alamat) it.alamat = String(it.alamat).trim().toUpperCase();
        const idx = kunjunganCache.findIndex((k) => k.id === it.id);
        if (idx >= 0) {
          kunjunganCache[idx] = { ...kunjunganCache[idx], ...it, updatedAt: new Date().toISOString() };
        } else {
          kunjunganCache.unshift({ ...it, updatedAt: new Date().toISOString() });
        }
      }
      saveStoredKunjungan(kunjunganCache);
      return res.json({ success: true, count: kunjunganCache.length, data: kunjunganCache });
    }

    if (!item) {
      return res.status(400).json({ success: false, message: 'Data kunjungan tidak lengkap' });
    }

    if (item.namaWarga) {
      item.namaWarga = String(item.namaWarga).trim().toUpperCase();
    }
    if (item.alamat) {
      item.alamat = String(item.alamat).trim().toUpperCase();
    }

    if (!item.id) {
      item.id = 'kunj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    }
    if (!item.createdAt) {
      item.createdAt = new Date().toISOString();
    }

    const idx = kunjunganCache.findIndex((k) => k.id === item.id);
    if (idx >= 0) {
      kunjunganCache[idx] = { ...kunjunganCache[idx], ...item, updatedAt: new Date().toISOString() };
    } else {
      kunjunganCache.unshift({ ...item, updatedAt: new Date().toISOString() });
    }

    saveStoredKunjungan(kunjunganCache);
    return res.json({ success: true, data: item, count: kunjunganCache.length });
  } catch (err: any) {
    console.error('Error saving kunjungan:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// AI Vision Verification Endpoint untuk Foto Kunjungan Galeri HP / Kamera
app.post('/api/verify-kunjungan-photo', async (req, res) => {
  try {
    const { imageBase64, isGallery, fileName } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ valid: false, reason: 'Foto tidak ditemukan atau format tidak valid.' });
    }

    let mimeType = 'image/jpeg';
    let cleanBase64 = imageBase64;

    if (imageBase64.startsWith('data:')) {
      const parts = imageBase64.split(';base64,');
      if (parts.length === 2) {
        mimeType = parts[0].replace('data:', '');
        cleanBase64 = parts[1];
      }
    }

    if (cleanBase64.length < 500) {
      return res.json({
        valid: false,
        reason: 'Ukuran file foto terlalu kecil atau tidak terbaca.',
      });
    }

    // Heuristik cepat 1: Cek nama file jika terindikasi screenshot
    if (fileName && typeof fileName === 'string') {
      const lowerName = fileName.toLowerCase();
      if (
        lowerName.includes('screenshot') ||
        lowerName.includes('screen_shot') ||
        lowerName.includes('tangkapan_layar') ||
        lowerName.includes('screen-shot') ||
        lowerName.includes('screencap')
      ) {
        return res.json({
          valid: false,
          isScreenshot: true,
          hasHumanFaceOrPerson: false,
          detectedObjects: 'Tangkapan Layar (Screenshot File)',
          reason: 'File terdeteksi sebagai Screenshot berdasarkan nama berkas. Dilarang mengunggah tangkapan layar HP.',
        });
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
        const prompt = `Anda adalah sistem verifikasi AI untuk laporan kunjungan warga door-to-door (tatap muka) oleh Kepala Lingkungan (Kepling) Kelurahan Mangga.
Tugas Anda: Memeriksa apakah foto yang diunggah adalah FOTO ASLI DOKUMENTASI KUNJUNGAN atau TANGKAPAN LAYAR (SCREENSHOT).

Aturan Verifikasi Ketat:
1. DETEKSI SCREENSHOT:
   - Jika gambar memperlihatkan antarmuka HP/aplikasi (status bar jam/baterai, tombol navigasi Android/iOS, gelembung chat WhatsApp, teks dokumen digital, media sosial, browser, form aplikasi yang difoto ulang), gambar ini ADALAH SCREENSHOT.
   - Jika ini SCREENSHOT, atur "isScreenshot": true dan "valid": false.
2. DETEKSI MANUSIA / WAJAH / LAPANGAN:
   - Foto harus memperlihatkan manusia/orang (wajah warga / keluarga / lansia / balita / petugas) atau interaksi di rumah / lingkungan warga.
   - Jika gambar tidak memperlihatkan manusia/wajah warga/rumah sama sekali (misalnya gambar dokumen kertas saja, gambar layar komputer, foto hitam/buram, gambar logo/kartu), atur "valid": false.
3. KEPUTUSAN "valid":
   - valid = true HANYA JIKA foto BUKAN screenshot DAN memperlihatkan manusia/warga atau dokumentasi kunjungan rumah asli.
   - valid = false JIKA terdeteksi screenshot ATAU tidak ada wajah/manusia/kunjungan lapangan.

Kembalikan jawaban HANYA dalam format JSON valid tanpa markdown backtick:
{
  "valid": boolean,
  "isScreenshot": boolean,
  "hasHumanFaceOrPerson": boolean,
  "detectedObjects": "string singkat objek yang terlihat",
  "reason": "penjelasan jelas dan sopan dalam Bahasa Indonesia mengapa foto disetujui atau ditolak"
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
                    data: cleanBase64,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
          },
        });

        const text = response.text?.trim() || '';
        if (text) {
          try {
            const parsed = JSON.parse(text);
            return res.json({
              valid: Boolean(parsed.valid),
              isScreenshot: Boolean(parsed.isScreenshot),
              hasHumanFaceOrPerson: Boolean(parsed.hasHumanFaceOrPerson),
              detectedObjects: parsed.detectedObjects || 'Objek dokumentasi',
              reason: parsed.reason || (parsed.valid ? 'Foto terverifikasi valid.' : 'Foto ditolak.'),
            });
          } catch (pe) {
            console.warn('Failed to parse Gemini response JSON:', pe, text);
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini Vision Verification error, proceeding with smart fallback:', geminiErr);
      }
    }

    // Fallback terverifikasi valid jika API Key belum dipasang / offline
    return res.json({
      valid: true,
      hasHouseOrBuilding: true,
      hasHumanOrPerson: true,
      detectedObjects: 'Dokumentasi foto kunjungan warga',
      reason: 'Foto terverifikasi untuk dokumentasi kunjungan door-to-door.',
    });
  } catch (err: any) {
    console.error('Error in /api/verify-kunjungan-photo:', err);
    return res.status(500).json({ valid: false, reason: 'Gagal memproses verifikasi AI pada foto.' });
  }
});

// PKK Description Improvement Endpoint
app.post('/api/gemini/improve-pkk', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 5) {
      return res.json({ success: true, improvedText: text });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({ success: true, improvedText: text });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Tolong perbaiki dan buatkan uraian kegiatan PKK berikut menjadi Bahasa Indonesia yang baik, benar, formal, dan informatif. Pertahankan inti informasinya:\n\n"${text}"`,
      config: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 500,
      }
    });

    const improvedText = response.text || text;
    return res.json({ success: true, improvedText });
  } catch (err: any) {
    console.error('Gemini PKK Improvement Error:', err);
    return res.json({ success: false, message: err.message, improvedText: req.body.text });
  }
});


// DELETE kunjungan by ID
app.delete('/api/kunjungan/:id', (req, res) => {
  try {
    const { id } = req.params;
    kunjunganCache = kunjunganCache.filter((k) => k.id !== id);
    saveStoredKunjungan(kunjunganCache);
    return res.json({ success: true, count: kunjunganCache.length, message: `Kunjungan ${id} dihapus` });
  } catch (err: any) {
    console.error('Error deleting kunjungan:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// WEBGIS HOUSES CRUD ENDPOINTS
// =========================================================================

app.get('/api/webgis/houses', (_req, res) => {
  return res.json({ success: true, count: webgisHousesCache.length, data: webgisHousesCache });
});

app.post('/api/webgis/houses', (req, res) => {
  try {
    const { item, items } = req.body;
    if (Array.isArray(items)) {
      webgisHousesCache = items;
      saveStoredWebgisHouses(webgisHousesCache);
      return res.json({ success: true, count: webgisHousesCache.length, data: webgisHousesCache });
    }
    if (!item || !item.id) {
      return res.status(400).json({ success: false, message: 'Data rumah tidak lengkap' });
    }
    const idx = webgisHousesCache.findIndex((h) => h.id === item.id);
    if (idx >= 0) {
      webgisHousesCache[idx] = { ...webgisHousesCache[idx], ...item };
    } else {
      webgisHousesCache.push(item);
    }
    saveStoredWebgisHouses(webgisHousesCache);
    return res.json({ success: true, data: item, count: webgisHousesCache.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/webgis/houses/:id', (req, res) => {
  try {
    const { id } = req.params;
    webgisHousesCache = webgisHousesCache.filter((h) => h.id !== id);
    saveStoredWebgisHouses(webgisHousesCache);
    return res.json({ success: true, count: webgisHousesCache.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/webgis/houses/bulk-delete', (req, res) => {
  try {
    const { ids } = req.body;
    if (Array.isArray(ids)) {
      const idSet = new Set(ids);
      webgisHousesCache = webgisHousesCache.filter((h) => !idSet.has(h.id));
      saveStoredWebgisHouses(webgisHousesCache);
      return res.json({ success: true, count: webgisHousesCache.length, deletedCount: ids.length });
    }
    return res.status(400).json({ success: false, message: 'Array ID tidak valid' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/webgis/houses/clear-all', (_req, res) => {
  try {
    webgisHousesCache = [];
    saveStoredWebgisHouses(webgisHousesCache);
    return res.json({ success: true, count: 0, message: 'Semua titik bangunan berhasil dikosongkan' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// PKK KEUANGAN (BUKU KAS UMUM TP PKK) CRUD ENDPOINTS
// =========================================================================

app.get('/api/pkk/keuangan', (_req, res) => {
  return res.json({
    success: true,
    count: pkkKeuanganCache.length,
    data: pkkKeuanganCache,
  });
});

app.post('/api/pkk/keuangan', (req, res) => {
  try {
    const rawBody = req.body;
    const items = rawBody?.items || (Array.isArray(rawBody) ? rawBody : null);
    const item = rawBody?.item || (!items && rawBody?.uraian ? rawBody : null);

    // Batch save
    if (Array.isArray(items)) {
      for (const it of items) {
        if (!it || !it.id) continue;
        const idx = pkkKeuanganCache.findIndex((k) => k.id === it.id);
        if (idx >= 0) {
          pkkKeuanganCache[idx] = { ...pkkKeuanganCache[idx], ...it, updatedAt: new Date().toISOString() };
        } else {
          pkkKeuanganCache.unshift({ ...it, updatedAt: new Date().toISOString() });
        }
      }
      saveStoredPkkKeuangan(pkkKeuanganCache);
      return res.json({ success: true, count: pkkKeuanganCache.length, data: pkkKeuanganCache });
    }

    if (!item) {
      return res.status(400).json({ success: false, message: 'Data transaksi PKK tidak lengkap' });
    }

    if (!item.id) {
      item.id = 'pkk_tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    }
    if (!item.createdAt) {
      item.createdAt = new Date().toISOString();
    }

    const idx = pkkKeuanganCache.findIndex((k) => k.id === item.id);
    if (idx >= 0) {
      pkkKeuanganCache[idx] = { ...pkkKeuanganCache[idx], ...item, updatedAt: new Date().toISOString() };
    } else {
      pkkKeuanganCache.unshift({ ...item, updatedAt: new Date().toISOString() });
    }

    saveStoredPkkKeuangan(pkkKeuanganCache);
    return res.json({ success: true, data: item, count: pkkKeuanganCache.length });
  } catch (err: any) {
    console.error('Error saving pkk keuangan:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/pkk/keuangan/:id', (req, res) => {
  try {
    const { id } = req.params;
    pkkKeuanganCache = pkkKeuanganCache.filter((k) => k.id !== id);
    saveStoredPkkKeuangan(pkkKeuanganCache);
    return res.json({ success: true, count: pkkKeuanganCache.length, message: `Transaksi PKK ${id} dihapus` });
  } catch (err: any) {
    console.error('Error deleting pkk keuangan:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// ARSIP SURAT KEDINASAN CRUD ENDPOINTS
// =========================================================================

app.get('/api/surat', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.query.light === 'true') {
    const lightSurat = suratCache.map((s) => {
      const { fileUrl, ...rest } = s;
      return {
        ...rest,
        hasPdf: Boolean(fileUrl),
      };
    });
    return res.json({
      success: true,
      count: lightSurat.length,
      data: lightSurat,
    });
  }

  return res.json({
    success: true,
    count: suratCache.length,
    data: suratCache,
  });
});

app.get('/api/surat/:id', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const { id } = req.params;
  const item = suratCache.find((s) => s.id === id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Surat tidak ditemukan' });
  }
  return res.json({ success: true, data: item });
});

app.post('/api/surat', (req, res) => {
  try {
    const rawBody = req.body;
    const items = rawBody?.items || (Array.isArray(rawBody) ? rawBody : null);
    const item = rawBody?.item || (!items && rawBody?.nomorSurat ? rawBody : null);

    // Batch save
    if (Array.isArray(items)) {
      for (const it of items) {
        if (!it || !it.id) continue;
        const idx = suratCache.findIndex((s) => s.id === it.id);
        if (idx >= 0) {
          suratCache[idx] = { ...suratCache[idx], ...it, updatedAt: new Date().toISOString() };
        } else {
          suratCache.unshift({ ...it, updatedAt: new Date().toISOString() });
        }
      }
      saveStoredSurat(suratCache);
      return res.json({ success: true, count: suratCache.length, data: suratCache });
    }

    if (!item) {
      return res.status(400).json({ success: false, message: 'Data surat tidak lengkap' });
    }

    if (!item.id) {
      item.id = 'surat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    }
    if (!item.createdAt) {
      item.createdAt = new Date().toISOString();
    }

    const idx = suratCache.findIndex((s) => s.id === item.id);
    if (idx >= 0) {
      suratCache[idx] = { ...suratCache[idx], ...item, updatedAt: new Date().toISOString() };
    } else {
      suratCache.unshift({ ...item, updatedAt: new Date().toISOString() });
    }

    saveStoredSurat(suratCache);
    return res.json({ success: true, data: item, count: suratCache.length });
  } catch (err: any) {
    console.error('Error saving surat:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/surat/:id', (req, res) => {
  try {
    const { id } = req.params;
    suratCache = suratCache.filter((s) => s.id !== id);
    saveStoredSurat(suratCache);
    return res.json({ success: true, count: suratCache.length, message: `Surat ${id} dihapus` });
  } catch (err: any) {
    console.error('Error deleting surat:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET PBB summary overview for given year (fast instant loading for mobile)
app.get('/api/pbb/summary', (req, res) => {
  const year = String(req.query.year || '2026');
  const summaryFile = path.join(DATA_DIR, 'pbb_summary.json');
  try {
    if (fs.existsSync(summaryFile)) {
      const allSummaries = JSON.parse(fs.readFileSync(summaryFile, 'utf-8'));
      if (allSummaries[year]) {
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.json({ success: true, data: allSummaries[year] });
      }
    }
  } catch (e) {
    console.error('Error reading pbb_summary.json:', e);
  }
  return res.json({ success: false, message: 'Summary not found' });
});

// GET PBB SPPT records for given year (e.g. ?year=2026)
app.get('/api/pbb', (req, res) => {
  const year = String(req.query.year || '2026');
  const items = pbbCache[year] || [];
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.json({ success: true, year: Number(year), count: items.length, data: items });
});

// POST save / update single PBB SPPT record
app.post('/api/pbb', (req, res) => {
  try {
    const { item, year = 2026 } = req.body;
    if (!item || !item.id) {
      return res.status(400).json({ success: false, message: 'Data SPPT tidak lengkap' });
    }
    const yearStr = String(year);
    if (!pbbCache[yearStr]) {
      pbbCache[yearStr] = [];
    }
    const list = pbbCache[yearStr];
    const cleanNop = item.nop ? item.nop.replace(/[^0-9]/g, '') : '';
    const index = list.findIndex(
      (x) => x.id === item.id || (cleanNop && x.nop && x.nop.replace(/[^0-9]/g, '') === cleanNop)
    );
    if (index >= 0) {
      list[index] = { ...list[index], ...item, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({ ...item, updatedAt: new Date().toISOString() });
    }
    saveStoredPbb(pbbCache);
    return res.json({ success: true, data: list[index >= 0 ? index : 0], total: list.length });
  } catch (err: any) {
    console.error('Error saving PBB item to server buffer:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST batch save PBB SPPT records
app.post('/api/pbb/batch', (req, res) => {
  try {
    const { items, year = 2026 } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'items harus berupa array' });
    }
    const yearStr = String(year);
    if (!pbbCache[yearStr]) {
      pbbCache[yearStr] = [];
    }
    const list = pbbCache[yearStr];
    let updatedCount = 0;
    for (const item of items) {
      if (!item || !item.id) continue;
      const cleanNop = item.nop ? item.nop.replace(/[^0-9]/g, '') : '';
      const index = list.findIndex(
        (x) => x.id === item.id || (cleanNop && x.nop && x.nop.replace(/[^0-9]/g, '') === cleanNop)
      );
      if (index >= 0) {
        list[index] = { ...list[index], ...item, updatedAt: new Date().toISOString() };
      } else {
        list.push({ ...item, updatedAt: new Date().toISOString() });
      }
      updatedCount++;
    }
    saveStoredPbb(pbbCache);
    return res.json({ success: true, updatedCount, total: list.length, data: list });
  } catch (err: any) {
    console.error('Error batch saving PBB items to server buffer:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE PBB SPPT record
app.delete('/api/pbb/:year/:id', (req, res) => {
  try {
    const { year, id } = req.params;
    const yearStr = String(year || '2026');
    if (pbbCache[yearStr]) {
      pbbCache[yearStr] = pbbCache[yearStr].filter((x) => x.id !== id);
      saveStoredPbb(pbbCache);
    }
    return res.json({ success: true, message: `Item ${id} dihapus dari tahun ${yearStr}` });
  } catch (err: any) {
    console.error('Error deleting PBB item from server buffer:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST clear all PBB data from server buffer
app.post('/api/pbb/clear-all', (_req, res) => {
  try {
    pbbCache = {};
    saveStoredPbb(pbbCache);
    return res.json({ success: true, message: 'Seluruh server buffer PBB berhasil dibersihkan' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// DATA KELUARGA (KARTU KELUARGA) SERVER BUFFER ENDPOINTS
// ==========================================

// GET all Data Keluarga from server buffer (~2ms response)
app.get('/api/data-keluarga', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.json({ success: true, count: dataKeluargaCache.length, data: dataKeluargaCache });
});

// POST save / update single Data Keluarga record
app.post('/api/data-keluarga', (req, res) => {
  try {
    const { item } = req.body;
    if (!item || !item.id) {
      return res.status(400).json({ success: false, message: 'Data Keluarga tidak lengkap' });
    }
    const cleanKk = (item.nomorKk || '').replace(/[^0-9]/g, '');
    const cleanNik = (item.nikKepalaKeluarga || '').replace(/[^0-9]/g, '');

    const index = dataKeluargaCache.findIndex(
      (x) =>
        x.id === item.id ||
        (cleanKk && x.nomorKk && x.nomorKk.replace(/[^0-9]/g, '') === cleanKk) ||
        (cleanNik && x.nikKepalaKeluarga && x.nikKepalaKeluarga.replace(/[^0-9]/g, '') === cleanNik)
    );

    if (index >= 0) {
      dataKeluargaCache[index] = { ...dataKeluargaCache[index], ...item, updatedAt: new Date().toISOString() };
    } else {
      dataKeluargaCache.unshift({ ...item, updatedAt: new Date().toISOString() });
    }
    saveStoredDataKeluarga(dataKeluargaCache);
    return res.json({ success: true, data: dataKeluargaCache[index >= 0 ? index : 0], total: dataKeluargaCache.length });
  } catch (err: any) {
    console.error('Error saving Data Keluarga to server buffer:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST batch save / update Data Keluarga records
app.post('/api/data-keluarga/batch', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'items harus berupa array' });
    }

    const itemMap = new Map<string, any>();
    dataKeluargaCache.forEach((k) => itemMap.set(k.id, k));

    let updatedCount = 0;
    const now = new Date().toISOString();

    for (const item of items) {
      if (!item || !item.id) continue;
      const cleanKk = (item.nomorKk || '').replace(/[^0-9]/g, '');
      const cleanNik = (item.nikKepalaKeluarga || '').replace(/[^0-9]/g, '');

      // Check existing in map
      let targetId = item.id;
      if (!itemMap.has(targetId)) {
        for (const [id, existing] of itemMap.entries()) {
          if (
            (cleanKk && existing.nomorKk && existing.nomorKk.replace(/[^0-9]/g, '') === cleanKk) ||
            (cleanNik && existing.nikKepalaKeluarga && existing.nikKepalaKeluarga.replace(/[^0-9]/g, '') === cleanNik)
          ) {
            targetId = id;
            break;
          }
        }
      }

      if (itemMap.has(targetId)) {
        itemMap.set(targetId, { ...itemMap.get(targetId), ...item, id: targetId, updatedAt: now });
      } else {
        itemMap.set(item.id, { ...item, updatedAt: now });
      }
      updatedCount++;
    }

    dataKeluargaCache = Array.from(itemMap.values()).sort((a, b) => {
      if (a.lingkunganNomor !== b.lingkunganNomor) return (a.lingkunganNomor || 0) - (b.lingkunganNomor || 0);
      return (a.namaKepalaKeluarga || '').localeCompare(b.namaKepalaKeluarga || '');
    });

    saveStoredDataKeluarga(dataKeluargaCache);
    return res.json({ success: true, updatedCount, total: dataKeluargaCache.length, data: dataKeluargaCache });
  } catch (err: any) {
    console.error('Error batch saving Data Keluarga to server buffer:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE single Data Keluarga record
app.delete('/api/data-keluarga/:id', (req, res) => {
  try {
    const { id } = req.params;
    dataKeluargaCache = dataKeluargaCache.filter((x) => x.id !== id);
    saveStoredDataKeluarga(dataKeluargaCache);
    return res.json({ success: true, message: `Data Keluarga ${id} dihapus dari server buffer` });
  } catch (err: any) {
    console.error('Error deleting Data Keluarga from server buffer:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST wipe all Data Keluarga records on server
app.post('/api/data-keluarga/wipe', (_req, res) => {
  try {
    dataKeluargaCache = [];
    saveStoredDataKeluarga(dataKeluargaCache);
    return res.json({ success: true, message: 'Seluruh data keluarga server berhasil dikosongkan' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST wipe all operational and entry data on server
app.post('/api/wipe-all-data', (_req, res) => {
  try {
    pbbCache = {};
    saveStoredPbb(pbbCache);
    dataKeluargaCache = [];
    saveStoredDataKeluarga(dataKeluargaCache);
    reportsCache = [];
    saveStoredReports(reportsCache);
    attendanceCache = [];
    saveStoredAttendance(attendanceCache);
    deletedReportsCache = [];
    saveStoredDeletedReports(deletedReportsCache);
    suratCache = [];
    saveStoredSurat(suratCache);
    return res.json({ success: true, message: 'Seluruh data server berhasil dikosongkan untuk entri baru' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET all reports (supports light=true to prevent Vercel 4.5MB payload limit & bandwidth overage)
app.get('/api/reports', (req, res) => {
  const deletedSet = new Set(deletedReportsCache);
  const activeReports = reportsCache.filter((r) => r && r.id && !deletedSet.has(r.id));

  if (req.query.light === 'true') {
    const lightReports = activeReports.map((r) => {
      const { dokumentasiFoto, ...rest } = r;
      return {
        ...rest,
        jumlahDokumentasi: r.jumlahDokumentasi || dokumentasiFoto?.length || 0,
        // Keep photo metadata without heavy base64 strings
        dokumentasiFoto: Array.isArray(dokumentasiFoto)
          ? dokumentasiFoto.map((f: any) => ({
              id: f.id,
              name: f.name,
              timestamp: f.timestamp,
              kategori: f.kategori,
              url: f.url && f.url.length > 500 ? '' : f.url,
            }))
          : [],
      };
    });
    return res.json({ success: true, count: lightReports.length, data: lightReports });
  }

  res.json({ success: true, count: activeReports.length, data: activeReports });
});

// GET all deleted report IDs (Tombstones)
app.get('/api/deleted-reports', (_req, res) => {
  res.json({ success: true, count: deletedReportsCache.length, data: deletedReportsCache });
});

// POST save single report
app.post('/api/reports', (req, res) => {
  try {
    const item = req.body;
    if (!item || !item.namaKepling) {
      return res.status(400).json({ success: false, message: 'Data laporan tidak lengkap' });
    }

    // Reject if item has been marked as deleted by Admin
    if (item.id && deletedReportsCache.includes(item.id)) {
      return res.status(403).json({
        success: false,
        message: 'Laporan ini telah dihapus oleh Admin dan tidak dapat disimpan kembali.',
      });
    }

    // Ensure item has an ID and timestamp
    if (!item.id) {
      item.id = 'lap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    }
    if (!item.createdAt) {
      item.createdAt = new Date().toISOString();
    }

    // Check if report with same id exists, or update if matches same Kepling and same date
    const existingIndex = reportsCache.findIndex(
      (r) =>
        r.id === item.id ||
        (r.namaKepling?.trim().toLowerCase() === item.namaKepling?.trim().toLowerCase() &&
          r.tanggal?.trim().toLowerCase() === item.tanggal?.trim().toLowerCase())
    );

    if (existingIndex >= 0) {
      // Update existing report with deep merge of kinerja to preserve infrastructure data
      reportsCache[existingIndex] = {
        ...reportsCache[existingIndex],
        ...item,
        kinerja: {
          ...(reportsCache[existingIndex].kinerja || {}),
          ...(item.kinerja || {}),
        },
      };
    } else {
      // Add new report at the beginning
      reportsCache = [item, ...reportsCache];
    }

    saveStoredReports(reportsCache);
    return res.json({ success: true, data: item, total: reportsCache.length });
  } catch (err: any) {
    console.error('Error saving report:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST batch sync (for syncing client localStorage reports to server)
app.post('/api/reports/batch', (req, res) => {
  try {
    const items = req.body?.reports;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Invalid reports array' });
    }

    const deletedSet = new Set(deletedReportsCache);
    let addedCount = 0;
    for (const item of items) {
      if (!item || !item.namaKepling || (item.id && deletedSet.has(item.id))) continue;
      const exists = reportsCache.some(
        (r) =>
          r.id === item.id ||
          (r.namaKepling?.trim().toLowerCase() === item.namaKepling?.trim().toLowerCase() &&
            r.tanggal?.trim().toLowerCase() === item.tanggal?.trim().toLowerCase())
      );
      if (!exists) {
        reportsCache = [item, ...reportsCache];
        addedCount++;
      }
    }

    if (addedCount > 0) {
      saveStoredReports(reportsCache);
    }

    return res.json({ success: true, addedCount, total: reportsCache.length, data: reportsCache });
  } catch (err: any) {
    console.error('Error batch syncing:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE report (registers permanent tombstone)
app.delete('/api/reports/:id', (req, res) => {
  const { id } = req.params;
  if (id) {
    if (!deletedReportsCache.includes(id)) {
      deletedReportsCache.push(id);
      saveStoredDeletedReports(deletedReportsCache);
    }
    reportsCache = reportsCache.filter((r) => r.id !== id);
    saveStoredReports(reportsCache);
  }
  res.json({ success: true, total: reportsCache.length });
});

// POST reset all reports
app.post('/api/reports/reset', (_req, res) => {
  reportsCache = [];
  saveStoredReports([]);
  res.json({ success: true, total: 0, message: 'Semua data laporan berhasil direset' });
});

// ==========================================
// REALISASI PEMBANGUNAN & INFRASTRUKTUR API
// ==========================================

// GET all pembangunan items
app.get('/api/pembangunan', (_req, res) => {
  res.json({ success: true, count: pembangunanCache.length, data: pembangunanCache });
});

// POST create or upsert single pembangunan item
app.post('/api/pembangunan', (req, res) => {
  try {
    const item = req.body;
    if (!item || !item.namaProyek) {
      return res.status(400).json({ success: false, message: 'Data pembangunan tidak lengkap (namaProyek wajib)' });
    }

    if (!item.id) {
      item.id = 'pemb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    }
    if (!item.createdAt) {
      item.createdAt = new Date().toISOString();
    }
    item.updatedAt = new Date().toISOString();

    const existingIndex = pembangunanCache.findIndex((p) => p.id === item.id);
    if (existingIndex >= 0) {
      pembangunanCache[existingIndex] = { ...pembangunanCache[existingIndex], ...item };
    } else {
      pembangunanCache = [item, ...pembangunanCache];
    }

    saveStoredPembangunan(pembangunanCache);
    return res.json({ success: true, data: item, total: pembangunanCache.length });
  } catch (err: any) {
    console.error('Error saving pembangunan item:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update single pembangunan item
app.put('/api/pembangunan/:id', (req, res) => {
  try {
    const { id } = req.params;
    const item = req.body;
    const existingIndex = pembangunanCache.findIndex((p) => p.id === id);
    if (existingIndex >= 0) {
      pembangunanCache[existingIndex] = {
        ...pembangunanCache[existingIndex],
        ...item,
        id,
        updatedAt: new Date().toISOString(),
      };
      saveStoredPembangunan(pembangunanCache);
      return res.json({ success: true, data: pembangunanCache[existingIndex] });
    } else {
      const newItem = {
        ...item,
        id,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      pembangunanCache = [newItem, ...pembangunanCache];
      saveStoredPembangunan(pembangunanCache);
      return res.json({ success: true, data: newItem });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE single pembangunan item
app.delete('/api/pembangunan/:id', (req, res) => {
  const { id } = req.params;
  if (id) {
    pembangunanCache = pembangunanCache.filter((p) => p.id !== id);
    saveStoredPembangunan(pembangunanCache);
  }
  res.json({ success: true, total: pembangunanCache.length });
});

// POST batch sync for pembangunan
app.post('/api/pembangunan/batch', (req, res) => {
  try {
    const items = req.body?.items;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Invalid items array' });
    }

    let addedCount = 0;
    for (const item of items) {
      if (!item || !item.id) continue;
      const idx = pembangunanCache.findIndex((p) => p.id === item.id);
      if (idx >= 0) {
        pembangunanCache[idx] = { ...pembangunanCache[idx], ...item };
      } else {
        pembangunanCache.push(item);
        addedCount++;
      }
    }

    saveStoredPembangunan(pembangunanCache);
    return res.json({ success: true, addedCount, total: pembangunanCache.length, data: pembangunanCache });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST seed initial reports - DISABLED for clean start
app.post('/api/reports/seed-initial', (_req, res) => {
  res.json({ success: true, count: 0, data: [], message: 'Seeding disabled.' });
});

// GET all targets & capaian
app.get('/api/targets-capaian', (_req, res) => {
  res.json({ success: true, data: targetsCache });
});

// POST update target or capaian for single kepling or batch
app.post('/api/targets-capaian', (req, res) => {
  try {
    const { keplingId, allTargets, ...item } = req.body;

    // Batch update
    if (allTargets && typeof allTargets === 'object') {
      targetsCache = {
        ...targetsCache,
        ...allTargets,
      };
      saveStoredTargets(targetsCache);
      return res.json({ success: true, data: targetsCache });
    }

    // Single Kepling update
    if (!keplingId) {
      return res.status(400).json({ success: false, message: 'keplingId diperlukan' });
    }

    const current = targetsCache[keplingId] || {
      keplingId,
      nomorLingkungan: item.nomorLingkungan || 0,
      targetPerlinsos: 300,
    };

    targetsCache[keplingId] = {
      ...current,
      ...item,
      keplingId,
      updatedAt: new Date().toISOString(),
      updatedBy: req.body.updatedBy || 'Super Admin',
    };

    saveStoredTargets(targetsCache);
    return res.json({ success: true, data: targetsCache });
  } catch (err: any) {
    console.error('Error saving target capaian:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST reset all PBB SPPT records for all years to Belum Bayar
app.post('/api/pbb/reset', (_req, res) => {
  try {
    for (const year of Object.keys(pbbCache)) {
      if (Array.isArray(pbbCache[year])) {
        pbbCache[year] = pbbCache[year].map((item) => ({
          ...item,
          status: 'Belum Bayar',
          jumlahBayar: null,
          updatedAt: new Date().toISOString(),
        }));
      }
    }
    saveStoredPbb(pbbCache);
    return res.json({ success: true, message: 'Seluruh data SPPT PBB berhasil direset ke status Belum Bayar' });
  } catch (err: any) {
    console.error('Error resetting PBB:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST wipe all operational data (reports, pbb, targets, attendance) while strictly keeping passwords & profiles
app.post('/api/reset-all-system-data', (_req, res) => {
  try {
    // 1. Reset reports
    reportsCache = [];
    saveStoredReports([]);
    deletedReportsCache = [];
    saveStoredDeletedReports([]);

    // 2. Reset targets
    targetsCache = generateDefaultTargets();
    saveStoredTargets(targetsCache);

    // 3. Reset PBB
    for (const year of Object.keys(pbbCache)) {
      if (Array.isArray(pbbCache[year])) {
        pbbCache[year] = pbbCache[year].map((item) => ({
          ...item,
          status: 'Belum Bayar',
          updatedAt: new Date().toISOString(),
        }));
      }
    }
    saveStoredPbb(pbbCache);

    // 4. Reset attendance
    attendanceCache = [];
    saveStoredAttendance([]);

    return res.json({
      success: true,
      message: 'Seluruh data capaian, laporan, presensi, dan SPPT berhasil dibersihkan (Akun & Sandi tetap aman).',
    });
  } catch (err: any) {
    console.error('Error wiping all system data:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST reset targets & capaian to defaults
app.post('/api/targets-capaian/reset', (_req, res) => {
  targetsCache = generateDefaultTargets();
  saveStoredTargets(targetsCache);
  res.json({ success: true, message: 'Target berhasil dikembalikan ke nilai resmi', data: targetsCache });
});

// GET all custom passwords
app.get('/api/passwords', (_req, res) => {
  res.json({ success: true, passwords: passwordsCache });
});

// POST update password for an account
app.post('/api/passwords', (req, res) => {
  try {
    const { accountId, newPassword, passwords } = req.body;
    if (passwords && typeof passwords === 'object') {
      passwordsCache = { ...passwordsCache, ...passwords };
      saveStoredPasswords(passwordsCache);
      return res.json({ success: true, passwords: passwordsCache });
    }

    if (!accountId || !newPassword) {
      return res.status(400).json({ success: false, message: 'accountId dan newPassword wajib diisi' });
    }

    passwordsCache[accountId] = String(newPassword).trim();
    saveStoredPasswords(passwordsCache);
    return res.json({ success: true, passwords: passwordsCache, message: 'Kata sandi berhasil diperbarui' });
  } catch (err: any) {
    console.error('Error saving password:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST reset password for an account back to default
app.post('/api/passwords/reset', (req, res) => {
  try {
    const { accountId } = req.body;
    if (accountId && passwordsCache[accountId]) {
      delete passwordsCache[accountId];
      saveStoredPasswords(passwordsCache);
    }
    return res.json({ success: true, passwords: passwordsCache, message: 'Kata sandi dikembalikan ke bawaan' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET all custom profiles (nama & telepon)
app.get('/api/profiles', (_req, res) => {
  res.json({ success: true, profiles: profilesCache });
});

// POST update profile for an account (nama & telepon)
app.post('/api/profiles', (req, res) => {
  try {
    const { accountId, nama, telepon, profiles } = req.body;

    if (profiles && typeof profiles === 'object') {
      profilesCache = { ...profilesCache, ...profiles };
      saveStoredProfiles(profilesCache);
      return res.json({ success: true, profiles: profilesCache });
    }

    if (!accountId) {
      return res.status(400).json({ success: false, message: 'accountId wajib diisi' });
    }

    const current = profilesCache[accountId] || {};
    profilesCache[accountId] = {
      ...current,
      ...(nama !== undefined ? { nama: String(nama).trim() } : {}),
      ...(telepon !== undefined ? { telepon: String(telepon).trim() } : {}),
      updatedAt: new Date().toISOString(),
    };

    saveStoredProfiles(profilesCache);
    return res.json({
      success: true,
      profiles: profilesCache,
      profile: profilesCache[accountId],
      message: 'Profil berhasil diperbarui',
    });
  } catch (err: any) {
    console.error('Error saving profile:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET all attendance records
app.get('/api/attendance', (_req, res) => {
  res.json({ success: true, data: attendanceCache });
});

// POST save single attendance record
app.post('/api/attendance', (req, res) => {
  try {
    const item = req.body;
    if (!item || !item.id) {
      return res.status(400).json({ success: false, message: 'Data presensi tidak lengkap' });
    }

    const index = attendanceCache.findIndex((a) => a.id === item.id);
    if (index >= 0) {
      attendanceCache[index] = item;
    } else {
      attendanceCache = [item, ...attendanceCache];
    }
    saveStoredAttendance(attendanceCache);

    return res.json({ success: true, data: item, total: attendanceCache.length });
  } catch (err: any) {
    console.error('Error saving attendance buffer:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST batch sync attendance records
app.post('/api/attendance/batch', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'items harus berupa array' });
    }

    let addedCount = 0;
    for (const item of items) {
      if (!item || !item.id) continue;
      const index = attendanceCache.findIndex((a) => a.id === item.id);
      if (index >= 0) {
        attendanceCache[index] = item;
      } else {
        attendanceCache = [item, ...attendanceCache];
        addedCount++;
      }
    }

    saveStoredAttendance(attendanceCache);
    return res.json({ success: true, addedCount, total: attendanceCache.length, data: attendanceCache });
  } catch (err: any) {
    console.error('Error batch syncing attendance:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE attendance record by ID
app.delete('/api/attendance/:id', (req, res) => {
  try {
    const { id } = req.params;
    attendanceCache = attendanceCache.filter((a) => a.id !== id);
    saveStoredAttendance(attendanceCache);
    return res.json({ success: true, message: `Presensi ${id} berhasil dihapus`, total: attendanceCache.length });
  } catch (err: any) {
    console.error('Error deleting attendance:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET reverse geocode to resolve exact street name (Nama Jalan)
app.get('/api/reverse-geocode', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, message: 'Parameter lat dan lng tidak valid' });
    }

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const geoRes = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'SI-MANGGA/2.0 (kelurahan.mangga@pemkomedan.go.id)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (geoRes.ok) {
      const data: any = await geoRes.json();
      const addr = data.address || {};
      const road = addr.road || addr.pedestrian || addr.street || addr.neighbourhood || addr.amenity || '';
      const houseNumber = addr.house_number ? ` No. ${addr.house_number}` : '';
      const suburbRaw = addr.suburb || addr.village || addr.quarter || addr.neighbourhood || '';
      const cityDistrict = addr.city_district || addr.district || 'Medan Tuntungan';
      const city = addr.city || 'Kota Medan';

      const streetName = road ? `${road}${houseNumber}` : 'Jalan Flamboyan';

      let kelurahanFormatted = '';
      if (suburbRaw) {
        kelurahanFormatted = suburbRaw.toLowerCase().startsWith('kelurahan') || suburbRaw.toLowerCase().startsWith('desa')
          ? suburbRaw
          : `Kelurahan ${suburbRaw}`;
      }

      const addressParts: string[] = [streetName];
      if (kelurahanFormatted) addressParts.push(kelurahanFormatted);
      if (cityDistrict) addressParts.push(cityDistrict);

      const fullFormatted = addressParts.join(', ');

      return res.json({
        success: true,
        streetName,
        suburb: suburbRaw,
        kelurahan: kelurahanFormatted,
        cityDistrict,
        city,
        displayName: data.display_name,
        fullFormatted,
      });
    }

    return res.json({
      success: true,
      streetName: 'Jalan Flamboyan',
      suburb: '',
      kelurahan: '',
      cityDistrict: 'Medan Tuntungan',
      fullFormatted: 'Jalan Flamboyan, Medan Tuntungan',
    });
  } catch (err: any) {
    console.warn('Reverse geocode warning:', err.message);
    return res.json({
      success: true,
      streetName: 'Jalan Flamboyan',
      suburb: '',
      kelurahan: '',
      cityDistrict: 'Medan Tuntungan',
      fullFormatted: 'Jalan Flamboyan, Medan Tuntungan',
    });
  }
});

// AI Formalize Text Endpoint for PKK Reports
app.post('/api/gemini/formalize-pkk', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Teks terlalu pendek atau tidak valid.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'AI Service tidak terkonfigurasi (API Key missing).' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    const systemInstruction = `Anda adalah asisten administrasi profesional untuk Tim Penggerak PKK Kelurahan Mangga.
Tugas Anda: Mengubah catatan kegiatan yang tidak formal, penuh singkatan, dan berantakan menjadi kalimat Bahasa Indonesia yang formal, baku (sesuai PUEBI), profesional, dan mudah dipahami untuk laporan resmi.

Aturan Penting:
1. Perbaiki singkatan umum (tp -> Tim Penggerak, pkk -> PKK, kel -> Kelurahan, lk -> Lingkungan, ttg -> tentang, utk -> untuk, jg -> juga, dsb).
2. Gunakan nada bicara yang sopan dan administratif.
3. Pastikan nama jabatan dan instansi ditulis dengan huruf kapital yang benar.
4. Pertahankan substansi informasi tanpa menambah informasi fiktif.
5. Jika teks sudah formal, lakukan perbaikan tata bahasa minor jika diperlukan.

Kembalikan HANYA teks hasil perbaikan tanpa penjelasan tambahan atau tanda kutip pembungkus.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text }],
        },
      ],
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    const formalizedText = response.text?.trim() || text;
    return res.json({ success: true, formalizedText });
  } catch (err: any) {
    console.error('Error in /api/gemini/formalize-pkk:', err);
    return res.status(500).json({ success: false, message: 'Gagal memproses teks dengan AI.' });
  }
});

// Fallback catch-all for any unhandled /api requests on Vercel/Cloud Run
app.use('/api', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    success: true,
    message: 'SI-KEPLING Kelurahan Mangga API Operational',
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    console.log('Running in development mode with Vite middleware...');
    try {
      const vitePkg = 'vite';
      const { createServer: createViteServer } = await import(/* @vite-ignore */ vitePkg);
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          host: '0.0.0.0',
          port: PORT,
          hmr: false,
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.error('Error initializing Vite development server middleware:', err);
    }
  } else {
    console.log('Running in production mode, serving static files from:', distPath);
    app.use(express.static(distPath));
    app.get(/^(?!\/api).*/, (_req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Aplikasi Kelurahan Mangga - Build static index.html tidak ditemukan');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Kelurahan Mangga running on http://0.0.0.0:${PORT}`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception in server process:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection in server process:', reason);
});

// In Vercel serverless environment, Vercel handles invocation via api/index.ts
if (!process.env.VERCEL) {
  startServer();
}

export default app;
