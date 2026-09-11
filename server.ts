import express from 'express';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = 3000;

// Enable JSON body parsing with large limit for compressed photo attachments
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Reports Data File
const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to identify reports submitted before 7 September 2026 (Disabled to allow all reports)
const isBeforeSept7 = (_r: any): boolean => {
  return false;
};

const loadStoredReports = (): any[] => {
  try {
    if (fs.existsSync(REPORTS_FILE)) {
      const content = fs.readFileSync(REPORTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        // Filter out all reports before 7 September 2026 per official instruction
        const cleaned = parsed.filter((r) => !isBeforeSept7(r));
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
    const cleaned = reports.filter((r) => !isBeforeSept7(r));
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

const DEFAULT_TARGETS_LIST = [
  429, 330, 342, 298, 210, 400,
  398, 255, 367, 465, 498, 373,
  440, 451, 362, 295, 476, 340,
  423, 215, 253, 264, 426, 229
];

const DEFAULT_PERLINSOS_BASELINES = [
  250, 263, 304, 239, 186, 212,
  161, 141, 186, 200, 174, 157,
  245, 154,  94, 179, 208, 143,
  234, 128, 210, 202, 207, 113
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
      overridePerlinsos: DEFAULT_PERLINSOS_BASELINES[i - 1] ?? 0,
      overridePbb: null,
      overrideIkd: null,
      overrideBpjs: null,
      catatanPenyesuaian: 'Data Capaian Perlinsos awal per 7 September 2026',
      updatedAt: new Date().toISOString(),
      updatedBy: 'Sistem',
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

// API Endpoints
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET all reports
app.get('/api/reports', (_req, res) => {
  res.json({ success: true, count: reportsCache.length, data: reportsCache });
});

// POST save single report
app.post('/api/reports', (req, res) => {
  try {
    const item = req.body;
    if (!item || !item.namaKepling) {
      return res.status(400).json({ success: false, message: 'Data laporan tidak lengkap' });
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

    let addedCount = 0;
    for (const item of items) {
      if (!item || !item.namaKepling) continue;
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

// DELETE report
app.delete('/api/reports/:id', (req, res) => {
  const { id } = req.params;
  reportsCache = reportsCache.filter((r) => r.id !== id);
  saveStoredReports(reportsCache);
  res.json({ success: true, total: reportsCache.length });
});

// POST reset all reports
app.post('/api/reports/reset', (_req, res) => {
  reportsCache = [];
  saveStoredReports([]);
  res.json({ success: true, total: 0, message: 'Semua data laporan berhasil direset' });
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

async function startServer() {
  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Kelurahan Mangga running on http://0.0.0.0:${PORT}`);
  });
}

// In Vercel serverless environment, Vercel handles invocation via api/index.ts
if (!process.env.VERCEL) {
  startServer();
}

export default app;
