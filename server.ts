import express from 'express';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Anti-Cache Headers: Ensure 100% online operation and zero client-side caching
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
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

const DEFAULT_TARGETS_LIST = [
  429, 330, 342, 298, 210, 400,
  398, 255, 367, 465, 498, 373,
  440, 451, 362, 295, 476, 340,
  423, 215, 253, 264, 426, 229
];

const DEFAULT_PERLINSOS_BASELINES = [
  256, 278, 328, 249, 194, 218,
  164, 154, 192, 218, 186, 164,
  253, 164, 116, 175, 222, 149,
  242, 132, 233, 215, 218, 123
];

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
      const { fotoRumah, ...rest } = k;
      return {
        ...rest,
        hasFoto: Boolean(fotoRumah),
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
    const { item, items } = req.body;

    // Batch save
    if (Array.isArray(items)) {
      for (const it of items) {
        if (!it || !it.id) continue;
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

// POST wipe all operational and entry data on server
app.post('/api/wipe-all-data', (_req, res) => {
  try {
    pbbCache = {};
    saveStoredPbb(pbbCache);
    reportsCache = [];
    saveStoredReports(reportsCache);
    attendanceCache = [];
    saveStoredAttendance(attendanceCache);
    deletedReportsCache = [];
    saveStoredDeletedReports(deletedReportsCache);
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
      // Update existing report
      reportsCache[existingIndex] = { ...reportsCache[existingIndex], ...item };
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

// POST seed initial reports for 24 Kepling
app.post('/api/reports/seed-initial', (req, res) => {
  try {
    const rawData = fs.readFileSync(REPORTS_FILE, 'utf-8');
    const items = JSON.parse(rawData);
    if (Array.isArray(items) && items.length > 0) {
      reportsCache = items;
      saveStoredReports(reportsCache);
      return res.json({ success: true, total: reportsCache.length, data: reportsCache });
    }
  } catch (err: any) {
    console.error('Error seeding initial reports:', err);
  }
  return res.json({ success: true, total: reportsCache.length, data: reportsCache });
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
        'User-Agent': 'SiKeplingMangga/2.0 (kelurahan.mangga@pemkomedan.go.id)',
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
  const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(path.join(distPath, 'index.html'));

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
    app.get('*', (_req, res) => {
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
