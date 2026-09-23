import { UserAccount, UserRole } from '../types';
import { safeSetLocalStorage } from '../lib/safeStorage';
import {
  fetchPasswordsFromFirestore,
  savePasswordToFirestore,
  resetPasswordInFirestore,
  fetchProfilesFromFirestore,
  saveProfileToFirestore,
} from '../lib/firestoreService';

export const SUPER_ADMIN_ACCOUNT: UserAccount = {
  id: 'super_admin',
  role: 'super_admin',
  lingkungan: 'Kantor Kelurahan',
  nama: 'SUPER ADMIN',
  jabatan: 'Super Administrator Kelurahan Mangga',
  kelurahan: 'Kelurahan Mangga',
  kecamatan: 'Kecamatan Medan Tuntungan',
  password: 'mangga2026',
};

export const KASI_PEMERINTAHAN_ACCOUNT: UserAccount = {
  id: 'kasi_pemerintahan',
  role: 'kasi_pemerintahan',
  lingkungan: 'Kantor Kelurahan',
  nama: 'KASI TATA PEMERINTAHAN',
  jabatan: 'Kepala Seksi Tata Pemerintahan (PBB)',
  kelurahan: 'Kelurahan Mangga',
  kecamatan: 'Kecamatan Medan Tuntungan',
  password: 'pem_mangga2026',
};

export const KASI_PEMBANGUNAN_ACCOUNT: UserAccount = {
  id: 'kasi_pembangunan',
  role: 'kasi_pembangunan',
  lingkungan: 'Kantor Kelurahan',
  nama: 'KASI PEMBANGUNAN',
  jabatan: 'Kepala Seksi Pembangunan (Perlinsos)',
  kelurahan: 'Kelurahan Mangga',
  kecamatan: 'Kecamatan Medan Tuntungan',
  password: 'bang_mangga2026',
};

export const KASI_TRANTIBUM_ACCOUNT: UserAccount = {
  id: 'kasi_trantibum',
  role: 'kasi_trantibum',
  lingkungan: 'Kantor Kelurahan',
  nama: 'KASI KETENTRAMAN & KETERTIBAN UMUM',
  jabatan: 'Kepala Seksi Ketentraman & Ketertiban Umum (Trantibum)',
  kelurahan: 'Kelurahan Mangga',
  kecamatan: 'Kecamatan Medan Tuntungan',
  password: 'trantib_mangga2026',
};

export const KASI_ACCOUNTS: UserAccount[] = [
  KASI_PEMERINTAHAN_ACCOUNT,
  KASI_PEMBANGUNAN_ACCOUNT,
  KASI_TRANTIBUM_ACCOUNT,
];

export const ADMIN_ACCOUNTS: UserAccount[] = [
  SUPER_ADMIN_ACCOUNT,
  ...KASI_ACCOUNTS,
];

export const KEPLING_ACCOUNTS: UserAccount[] = [
  {
    id: 'kepling_1',
    role: 'kepling',
    nomorLingkungan: 1,
    lingkungan: 'Lingkungan I',
    nama: 'Juan Prananta Purba',
    jabatan: 'Kepala Lingkungan I',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga01',
  },
  {
    id: 'kepling_2',
    role: 'kepling',
    nomorLingkungan: 2,
    lingkungan: 'Lingkungan II',
    nama: 'Zulkarnaen Tarigan',
    jabatan: 'Kepala Lingkungan II',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga02',
  },
  {
    id: 'kepling_3',
    role: 'kepling',
    nomorLingkungan: 3,
    lingkungan: 'Lingkungan III',
    nama: 'Benny Irwansyah Sembiring',
    jabatan: 'Kepala Lingkungan III',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga03',
  },
  {
    id: 'kepling_4',
    role: 'kepling',
    nomorLingkungan: 4,
    lingkungan: 'Lingkungan IV',
    nama: 'Andi Lopiga Sembiring',
    jabatan: 'Kepala Lingkungan IV',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga04',
  },
  {
    id: 'kepling_5',
    role: 'kepling',
    nomorLingkungan: 5,
    lingkungan: 'Lingkungan V',
    nama: 'Eduard Ergunanta Tarigan',
    jabatan: 'Kepala Lingkungan V',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga05',
  },
  {
    id: 'kepling_6',
    role: 'kepling',
    nomorLingkungan: 6,
    lingkungan: 'Lingkungan VI',
    nama: 'Nella Diva Filola Bangun',
    jabatan: 'Kepala Lingkungan VI',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga06',
  },
  {
    id: 'kepling_7',
    role: 'kepling',
    nomorLingkungan: 7,
    lingkungan: 'Lingkungan VII',
    nama: 'Salsalina Br Bangun',
    jabatan: 'Kepala Lingkungan VII',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga07',
  },
  {
    id: 'kepling_8',
    role: 'kepling',
    nomorLingkungan: 8,
    lingkungan: 'Lingkungan VIII',
    nama: 'Reni Septiana',
    jabatan: 'Kepala Lingkungan VIII',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga08',
  },
  {
    id: 'kepling_9',
    role: 'kepling',
    nomorLingkungan: 9,
    lingkungan: 'Lingkungan IX',
    nama: 'Teruna Irawan',
    jabatan: 'Kepala Lingkungan IX',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga09',
  },
  {
    id: 'kepling_10',
    role: 'kepling',
    nomorLingkungan: 10,
    lingkungan: 'Lingkungan X',
    nama: 'Dina Novri Maulita',
    jabatan: 'Kepala Lingkungan X',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga10',
  },
  {
    id: 'kepling_11',
    role: 'kepling',
    nomorLingkungan: 11,
    lingkungan: 'Lingkungan XI',
    nama: 'Zulaiha Lubis',
    jabatan: 'Kepala Lingkungan XI',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga11',
  },
  {
    id: 'kepling_12',
    role: 'kepling',
    nomorLingkungan: 12,
    lingkungan: 'Lingkungan XII',
    nama: 'Diki Alimsar',
    jabatan: 'Kepala Lingkungan XII',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga12',
  },
  {
    id: 'kepling_13',
    role: 'kepling',
    nomorLingkungan: 13,
    lingkungan: 'Lingkungan XIII',
    nama: 'Anton Perwira Bangun',
    jabatan: 'Kepala Lingkungan XIII',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga13',
  },
  {
    id: 'kepling_14',
    role: 'kepling',
    nomorLingkungan: 14,
    lingkungan: 'Lingkungan XIV',
    nama: 'Dessy Novianti Lubis',
    jabatan: 'Kepala Lingkungan XIV',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga14',
  },
  {
    id: 'kepling_15',
    role: 'kepling',
    nomorLingkungan: 15,
    lingkungan: 'Lingkungan XV',
    nama: 'M. Rizky Dwilianto Sembiring',
    jabatan: 'Kepala Lingkungan XV',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga15',
  },
  {
    id: 'kepling_16',
    role: 'kepling',
    nomorLingkungan: 16,
    lingkungan: 'Lingkungan XVI',
    nama: 'Leo Said Eden Ginting',
    jabatan: 'Kepala Lingkungan XVI',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga16',
  },
  {
    id: 'kepling_17',
    role: 'kepling',
    nomorLingkungan: 17,
    lingkungan: 'Lingkungan XVII',
    nama: 'Roy Rinaldi Tambunan',
    jabatan: 'Kepala Lingkungan XVII',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga17',
  },
  {
    id: 'kepling_18',
    role: 'kepling',
    nomorLingkungan: 18,
    lingkungan: 'Lingkungan XVIII',
    nama: 'Yuda Prabowo',
    jabatan: 'Kepala Lingkungan XVIII',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga18',
  },
  {
    id: 'kepling_19',
    role: 'kepling',
    nomorLingkungan: 19,
    lingkungan: 'Lingkungan XIX',
    nama: 'Frimonta Sebayang',
    jabatan: 'Kepala Lingkungan XIX',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga19',
  },
  {
    id: 'kepling_20',
    role: 'kepling',
    nomorLingkungan: 20,
    lingkungan: 'Lingkungan XX',
    nama: 'Maradu Tua',
    jabatan: 'Kepala Lingkungan XX',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga20',
  },
  {
    id: 'kepling_21',
    role: 'kepling',
    nomorLingkungan: 21,
    lingkungan: 'Lingkungan XXI',
    nama: 'Muhammad Shiddiq',
    jabatan: 'Kepala Lingkungan XXI',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga21',
  },
  {
    id: 'kepling_22',
    role: 'kepling',
    nomorLingkungan: 22,
    lingkungan: 'Lingkungan XXII',
    nama: 'Dicky Ardian Depari',
    jabatan: 'Kepala Lingkungan XXII',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga22',
  },
  {
    id: 'kepling_23',
    role: 'kepling',
    nomorLingkungan: 23,
    lingkungan: 'Lingkungan XXIII',
    nama: 'Hasanuddin Sitepu, ST',
    jabatan: 'Kepala Lingkungan XXIII',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga23',
  },
  {
    id: 'kepling_24',
    role: 'kepling',
    nomorLingkungan: 24,
    lingkungan: 'Lingkungan XXIV',
    nama: 'Daniel Dianta Tarigan',
    jabatan: 'Kepala Lingkungan XXIV',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'mangga24',
  },
];

export const ALL_ACCOUNTS: UserAccount[] = [
  SUPER_ADMIN_ACCOUNT,
  ...KASI_ACCOUNTS,
  ...KEPLING_ACCOUNTS,
];

export const STORAGE_KEY_CUSTOM_PASSWORDS = 'kepling_custom_passwords';

export const getCustomPasswords = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_PASSWORDS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Gagal membaca custom passwords:', e);
  }
  return {};
};

// Sync custom passwords with Firebase Firestore and backend server
export const syncPasswordsWithServer = async (): Promise<Record<string, string>> => {
  let merged = getCustomPasswords();

  // 1. Fetch from Firebase Firestore
  try {
    const firestorePass = await fetchPasswordsFromFirestore();
    if (firestorePass && Object.keys(firestorePass).length > 0) {
      merged = { ...merged, ...firestorePass };
      safeSetLocalStorage(STORAGE_KEY_CUSTOM_PASSWORDS, JSON.stringify(merged));
    }
  } catch (e) {
    console.warn('Notice reading passwords from Firestore:', e);
  }

  // 2. Fetch from backend server buffer
  try {
    const res = await fetch('/api/passwords');
    if (res.ok) {
      const data = await res.json();
      if (data?.passwords && typeof data.passwords === 'object') {
        merged = { ...merged, ...data.passwords };
        safeSetLocalStorage(STORAGE_KEY_CUSTOM_PASSWORDS, JSON.stringify(merged));
      }
    }
  } catch (e) {
    // Offline fallback
  }
  return merged;
};

export const getEffectivePassword = (account: UserAccount): string => {
  const custom = getCustomPasswords();
  if (custom[account.id]) {
    return custom[account.id];
  }
  return account.password;
};

export const saveCustomPassword = (accountId: string, newPass: string): void => {
  try {
    const current = getCustomPasswords();
    current[accountId] = newPass.trim();
    safeSetLocalStorage(STORAGE_KEY_CUSTOM_PASSWORDS, JSON.stringify(current));

    // 1. Persist directly to Firebase Firestore
    savePasswordToFirestore(accountId, newPass.trim()).catch((err) =>
      console.warn('Gagal sync password ke Firestore:', err)
    );

    // 2. Also persist to server backend asynchronously
    fetch('/api/passwords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, newPassword: newPass.trim() }),
    }).catch((err) => console.warn('Gagal sync password ke server:', err));
  } catch (e) {
    console.warn('Gagal menyimpan custom password:', e);
  }
};

export const resetCustomPassword = (accountId: string): void => {
  try {
    const current = getCustomPasswords();
    delete current[accountId];
    safeSetLocalStorage(STORAGE_KEY_CUSTOM_PASSWORDS, JSON.stringify(current));

    // 1. Reset in Firebase Firestore
    resetPasswordInFirestore(accountId).catch((err) =>
      console.warn('Gagal reset password di Firestore:', err)
    );

    // 2. Also persist to server backend asynchronously
    fetch('/api/passwords/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    }).catch((err) => console.warn('Gagal reset password di server:', err));
  } catch (e) {
    console.warn('Gagal mereset custom password:', e);
  }
};

export const hasCustomPassword = (accountId: string): boolean => {
  const current = getCustomPasswords();
  return Boolean(current[accountId]);
};

// ==========================================
// CUSTOM PROFILES (NAMA & TELEPON)
// ==========================================

export const STORAGE_KEY_CUSTOM_PROFILES = 'kepling_custom_profiles';

export interface CustomProfileData {
  nama?: string;
  telepon?: string;
  updatedAt?: string;
}

export const getCustomProfiles = (): Record<string, CustomProfileData> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_PROFILES);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Gagal membaca custom profiles:', e);
  }
  return {};
};

export const getEffectiveAccount = (account: UserAccount): UserAccount => {
  if (!account) return account;
  const profiles = getCustomProfiles();
  const custom = profiles[account.id];
  if (!custom) return account;
  return {
    ...account,
    nama: custom.nama && custom.nama.trim() ? custom.nama.trim() : account.nama,
    telepon: custom.telepon !== undefined ? custom.telepon : account.telepon,
  };
};

// ==========================================
// DYNAMIC ACCOUNTS MANAGEMENT (SUPERADMIN CRUD)
// ==========================================

export const STORAGE_KEY_DYNAMIC_ACCOUNTS = 'kepling_dynamic_accounts_v1';
export const STORAGE_KEY_DELETED_ACCOUNTS = 'kepling_deleted_static_accounts_v1';

let memoryDynamicAccounts: UserAccount[] = [];
let memoryDeletedAccountIds: Set<string> = new Set<string>();

export const getDynamicAccounts = (): UserAccount[] => {
  return memoryDynamicAccounts;
};

export const getDeletedAccountIds = (): Set<string> => {
  return memoryDeletedAccountIds;
};

export const saveDynamicAccounts = (accounts: UserAccount[]): void => {
  memoryDynamicAccounts = accounts;
};

export const saveDeletedAccountIds = (ids: Set<string>): void => {
  memoryDeletedAccountIds = ids;
};

export const syncAccountsWithServer = async (): Promise<{ dynamicAccounts: UserAccount[]; deletedAccountIds: string[] }> => {
  try {
    const res = await fetch(`/api/accounts?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.dynamicAccounts)) {
        memoryDynamicAccounts = json.dynamicAccounts;
      }
      if (Array.isArray(json?.deletedAccountIds)) {
        memoryDeletedAccountIds = new Set(json.deletedAccountIds);
      }
    }
  } catch (err) {
    console.warn('[Online Accounts] Error syncing accounts from server:', err);
  }
  return {
    dynamicAccounts: memoryDynamicAccounts,
    deletedAccountIds: Array.from(memoryDeletedAccountIds),
  };
};

export const addDynamicAccount = (account: UserAccount): void => {
  const current = [...memoryDynamicAccounts];
  const existingIndex = current.findIndex((a) => a.id.toLowerCase() === account.id.toLowerCase());
  if (existingIndex >= 0) {
    current[existingIndex] = account;
  } else {
    current.push(account);
  }
  memoryDynamicAccounts = current;

  // If re-adding previously deleted account, remove from deleted set
  if (memoryDeletedAccountIds.has(account.id)) {
    memoryDeletedAccountIds.delete(account.id);
  }

  // Push online to server
  fetch('/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account }),
  }).catch((err) => {
    console.warn('Error saving account to server:', err);
  });
};

export const deleteAccountById = (id: string): void => {
  const cleanId = id.toLowerCase();
  // 1. If it's dynamic, remove from memory
  memoryDynamicAccounts = memoryDynamicAccounts.filter((a) => a.id.toLowerCase() !== cleanId);

  // 2. Mark as deleted
  memoryDeletedAccountIds.add(id);

  // Push online to server
  fetch(`/api/accounts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).catch((err) => {
    console.warn('Error deleting account on server:', err);
  });
};

export const restoreAccountById = (id: string): void => {
  const cleanId = id.toLowerCase();
  memoryDeletedAccountIds.delete(id);
  for (const delId of Array.from(memoryDeletedAccountIds)) {
    if (delId.toLowerCase() === cleanId) {
      memoryDeletedAccountIds.delete(delId);
    }
  }

  // Push online to server
  fetch('/api/accounts/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  }).catch((err) => {
    console.warn('Error restoring account on server:', err);
  });
};

export const getEffectiveKeplingAccounts = (): UserAccount[] => {
  const dynamic = getDynamicAccounts().filter((a) => a.role === 'kepling');
  const deletedIds = getDeletedAccountIds();
  const combined = [...KEPLING_ACCOUNTS, ...dynamic];
  return combined
    .filter((a) => !deletedIds.has(a.id))
    .map((k) => getEffectiveAccount(k));
};

export const getAllEffectiveAccounts = (): UserAccount[] => {
  const dynamic = getDynamicAccounts();
  const deletedIds = getDeletedAccountIds();
  const combined = [...ALL_ACCOUNTS, ...dynamic];
  return combined
    .filter((a) => !deletedIds.has(a.id))
    .map((a) => getEffectiveAccount(a));
};

export const saveCustomProfile = async (
  accountId: string,
  data: Partial<CustomProfileData>
): Promise<UserAccount> => {
  const current = getCustomProfiles();
  const existing = current[accountId] || {};
  const updated: CustomProfileData = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString(),
  };
  current[accountId] = updated;
  try {
    safeSetLocalStorage(STORAGE_KEY_CUSTOM_PROFILES, JSON.stringify(current));
  } catch (e) {
    console.warn('Gagal menyimpan profile ke localStorage:', e);
  }

  // 1. Sync ke Firebase Firestore
  saveProfileToFirestore(accountId, updated).catch((err) =>
    console.warn('Gagal sync profile ke Firestore:', err)
  );

  // 2. Sync ke backend server
  fetch('/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, ...updated }),
  }).catch((err) => console.warn('Gagal sync profile ke server:', err));

  const baseAccount = ALL_ACCOUNTS.find((a) => a.id === accountId) || SUPER_ADMIN_ACCOUNT;
  return getEffectiveAccount(baseAccount);
};

export const syncProfilesWithServer = async (): Promise<Record<string, CustomProfileData>> => {
  let merged = getCustomProfiles();

  // 1. Fetch from Firebase Firestore
  try {
    const firestoreProfiles = await fetchProfilesFromFirestore();
    if (firestoreProfiles && Object.keys(firestoreProfiles).length > 0) {
      merged = { ...merged, ...firestoreProfiles };
      localStorage.setItem(STORAGE_KEY_CUSTOM_PROFILES, JSON.stringify(merged));
    }
  } catch (e) {
    console.warn('Notice reading profiles from Firestore:', e);
  }

  // 2. Fetch from backend server
  try {
    const res = await fetch('/api/profiles');
    if (res.ok) {
      const data = await res.json();
      if (data?.profiles && typeof data.profiles === 'object') {
        merged = { ...merged, ...data.profiles };
        localStorage.setItem(STORAGE_KEY_CUSTOM_PROFILES, JSON.stringify(merged));
      }
    }
  } catch (e) {
    // Offline fallback
  }
  return merged;
};

export interface FixedAccountOption {
  username: string;
  nama: string;
  lingkungan: string;
  role: UserRole;
  nomorLingkungan?: number;
  defaultPasswordHint: string;
}

export const getFixedAccountsList = (): FixedAccountOption[] => {
  return [
    {
      username: 'super_admin',
      nama: 'SUPER ADMIN',
      lingkungan: 'Kantor Kelurahan Mangga',
      role: 'super_admin',
      defaultPasswordHint: 'mangga2026',
    },
    {
      username: 'kasi_pemerintahan',
      nama: 'KASI TATA PEMERINTAHAN (PBB)',
      lingkungan: 'Kantor Kelurahan Mangga',
      role: 'kasi_pemerintahan',
      defaultPasswordHint: 'pem_mangga2026',
    },
    {
      username: 'kasi_pembangunan',
      nama: 'KASI PEMBANGUNAN (PERLINSOS)',
      lingkungan: 'Kantor Kelurahan Mangga',
      role: 'kasi_pembangunan',
      defaultPasswordHint: 'bang_mangga2026',
    },
    {
      username: 'kasi_trantibum',
      nama: 'KASI TRANTIBUM (KETERTIBAN)',
      lingkungan: 'Kantor Kelurahan Mangga',
      role: 'kasi_trantibum',
      defaultPasswordHint: 'trantib_mangga2026',
    },
    ...KEPLING_ACCOUNTS.map((k) => {
      const eff = getEffectiveAccount(k);
      return {
        username: eff.id,
        nama: eff.nama,
        lingkungan: eff.lingkungan,
        role: 'kepling' as const,
        nomorLingkungan: eff.nomorLingkungan,
        defaultPasswordHint: eff.password,
      };
    }),
  ];
};

export const FIXED_ACCOUNTS_LIST: FixedAccountOption[] = [
  {
    username: 'super_admin',
    nama: 'SUPER ADMIN',
    lingkungan: 'Kantor Kelurahan Mangga',
    role: 'super_admin',
    defaultPasswordHint: 'mangga2026',
  },
  {
    username: 'kasi_pemerintahan',
    nama: 'KASI TATA PEMERINTAHAN (PBB)',
    lingkungan: 'Kantor Kelurahan Mangga',
    role: 'kasi_pemerintahan',
    defaultPasswordHint: 'pem_mangga2026',
  },
  {
    username: 'kasi_pembangunan',
    nama: 'KASI PEMBANGUNAN (PERLINSOS)',
    lingkungan: 'Kantor Kelurahan Mangga',
    role: 'kasi_pembangunan',
    defaultPasswordHint: 'bang_mangga2026',
  },
  {
    username: 'kasi_trantibum',
    nama: 'KASI TRANTIBUM (KETERTIBAN)',
    lingkungan: 'Kantor Kelurahan Mangga',
    role: 'kasi_trantibum',
    defaultPasswordHint: 'trantib_mangga2026',
  },
  ...KEPLING_ACCOUNTS.map((k) => ({
    username: k.id,
    nama: k.nama,
    lingkungan: k.lingkungan,
    role: 'kepling' as const,
    nomorLingkungan: k.nomorLingkungan,
    defaultPasswordHint: k.password,
  })),
];

export const getAccountById = (id: string): UserAccount => {
  const dynamic = getDynamicAccounts();
  const deletedIds = getDeletedAccountIds();
  if (deletedIds.has(id)) {
    return SUPER_ADMIN_ACCOUNT;
  }
  const found = [...ALL_ACCOUNTS, ...dynamic].find((a) => a.id === id);
  return getEffectiveAccount(found || SUPER_ADMIN_ACCOUNT);
};

export const getDefaultAccount = (): UserAccount => {
  return SUPER_ADMIN_ACCOUNT;
};

const ROMAN_NUMERALS: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  xi: 11,
  xii: 12,
  xiii: 13,
  xiv: 14,
  xv: 15,
  xvi: 16,
  xvii: 17,
  xviii: 18,
  xix: 19,
  xx: 20,
  xxi: 21,
  xxii: 22,
  xxiii: 23,
  xxiv: 24,
};

export const normalizeUsername = (raw: string): string => {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.]+/g, '_');
};

export const findAccountByUsername = (input: string): UserAccount | undefined => {
  const rawClean = (input || '').trim().toLowerCase();
  if (!rawClean) return undefined;

  const norm = normalizeUsername(input);

  // 1. Check super admin aliases
  if (
    norm === 'super_admin' ||
    norm === 'superadmin' ||
    norm === 'admin' ||
    norm === 'admin_mangga' ||
    norm === 'adminmangga' ||
    norm === 'lurah' ||
    norm === 'seklur' ||
    norm === 'kelurahan' ||
    norm === 'kelurahan_mangga' ||
    norm === 'fery' ||
    norm === 'fery_arapenta' ||
    rawClean === 'fery.arapenta@gmail.com'
  ) {
    return SUPER_ADMIN_ACCOUNT;
  }

  // 1b. Check Kasi Pemerintahan (PBB)
  if (
    norm === 'kasi_pemerintahan' ||
    norm === 'kasipemerintahan' ||
    norm === 'pemerintahan' ||
    norm === 'kasi_pem' ||
    norm === 'kasipem' ||
    norm === 'pbb' ||
    norm === 'admin_pbb' ||
    norm === 'kasi_pbb' ||
    norm === 'kasipbb'
  ) {
    return KASI_PEMERINTAHAN_ACCOUNT;
  }

  // 1c. Check Kasi Pembangunan (Perlinsos)
  if (
    norm === 'kasi_pembangunan' ||
    norm === 'kasipembangunan' ||
    norm === 'pembangunan' ||
    norm === 'kasi_bang' ||
    norm === 'kasibang' ||
    norm === 'perlinsos' ||
    norm === 'admin_perlinsos' ||
    norm === 'kasi_perlinsos' ||
    norm === 'kasiperlinsos' ||
    norm === 'pmk' ||
    norm === 'kasi_pmk'
  ) {
    return KASI_PEMBANGUNAN_ACCOUNT;
  }

  // 1d. Check Kasi Trantibum (Ketertiban Umum / Poskamling)
  if (
    norm === 'kasi_trantibum' ||
    norm === 'kasitrantibum' ||
    norm === 'trantibum' ||
    norm === 'trantib' ||
    norm === 'kasi_trantib' ||
    norm === 'kasitrantib' ||
    norm === 'ketertiban' ||
    norm === 'kamtibmas' ||
    norm === 'poskamling'
  ) {
    return KASI_TRANTIBUM_ACCOUNT;
  }

  // 2. Exact ID match (e.g. kepling_1, kepling_2, ...)
  const exact = ALL_ACCOUNTS.find((a) => a.id.toLowerCase() === norm);
  if (exact) return exact;

  // 3. Match pure numbers: "1" to "24", "01" to "09"
  const pureNumMatch = norm.match(/^0*([1-9]|1[0-9]|2[0-4])$/);
  if (pureNumMatch) {
    const num = parseInt(pureNumMatch[1], 10);
    return KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === num);
  }

  // 4. Match pure Roman numerals: "i", "iv", "xxiv"
  if (ROMAN_NUMERALS[norm]) {
    const num = ROMAN_NUMERALS[norm];
    return KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === num);
  }

  // 5. Match "kepling_1", "kepling_01", "kepling1", "kepling-1"
  const keplingNumMatch = norm.match(/^kepling_?0*([1-9]|1[0-9]|2[0-4])$/);
  if (keplingNumMatch) {
    const num = parseInt(keplingNumMatch[1], 10);
    return KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === num);
  }

  // 6. Match "kepling_i", "kepling_iv", "kepling iv", etc.
  const keplingRomanMatch = norm.match(/^kepling_?([ivx]+)$/);
  if (keplingRomanMatch && ROMAN_NUMERALS[keplingRomanMatch[1]]) {
    const num = ROMAN_NUMERALS[keplingRomanMatch[1]];
    return KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === num);
  }

  // 7. Match "lingkungan_1", "lingkungan_01", "lingkungan 1"
  const lingNumMatch = norm.match(/^(?:lingkungan|lingk|ling)_?0*([1-9]|1[0-9]|2[0-4])$/);
  if (lingNumMatch) {
    const num = parseInt(lingNumMatch[1], 10);
    return KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === num);
  }

  // 8. Match "lingkungan_i", "lingkungan iv", etc.
  const lingRomanMatch = norm.match(/^(?:lingkungan|lingk|ling)_?([ivx]+)$/);
  if (lingRomanMatch && ROMAN_NUMERALS[lingRomanMatch[1]]) {
    const num = ROMAN_NUMERALS[lingRomanMatch[1]];
    return KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === num);
  }

  // 9. Match "mangga01", "mangga1", etc. typed as username
  const manggaNumMatch = norm.match(/^mangga_?0*([1-9]|1[0-9]|2[0-4])$/);
  if (manggaNumMatch) {
    const num = parseInt(manggaNumMatch[1], 10);
    return KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === num);
  }

  // 10. Match by Kepling's full or first name
  const matchedByName = KEPLING_ACCOUNTS.find((k) => {
    const nameNorm = normalizeUsername(k.nama);
    const firstName = nameNorm.split('_')[0];
    return (
      nameNorm === norm ||
      norm.includes(nameNorm) ||
      (firstName.length >= 3 && (norm === firstName || norm.startsWith(firstName)))
    );
  });
  if (matchedByName) return matchedByName;

  // 11. Match custom dynamic accounts
  const dynamic = getDynamicAccounts();
  const deletedIds = getDeletedAccountIds();
  const matchedDynamic = dynamic
    .filter((a) => !deletedIds.has(a.id))
    .find((a) => {
      const normId = normalizeUsername(a.id);
      const normNama = normalizeUsername(a.nama);
      const firstNama = normNama.split('_')[0];
      return (
        normId === norm ||
        normNama === norm ||
        (firstNama.length >= 3 && norm === firstNama)
      );
    });
  if (matchedDynamic) return matchedDynamic;

  return undefined;
};

export const verifyAccountPassword = (
  account: UserAccount,
  inputPass: string
): boolean => {
  const trimmed = (inputPass || '').trim();
  if (!trimmed) return false;

  const effectivePass = getEffectivePassword(account);

  // Exact match or lowercased match with effective password
  if (trimmed === effectivePass || trimmed.toLowerCase() === effectivePass.toLowerCase()) {
    return true;
  }

  // If password was changed by user, DO NOT allow default variants anymore
  if (effectivePass !== account.password) {
    return false;
  }

  // Flexible Kepling default password variations (mangga01 vs mangga1 vs kepling01 etc.)
  if (account.role === 'kepling' && account.nomorLingkungan) {
    const num = account.nomorLingkungan;
    const padded = num < 10 ? `0${num}` : `${num}`;
    const unpadded = `${num}`;

    const validVariants = [
      `mangga${padded}`,
      `mangga${unpadded}`,
      `mangga_${padded}`,
      `mangga_${unpadded}`,
      `kepling${padded}`,
      `kepling${unpadded}`,
      `kepling_${padded}`,
      `kepling_${unpadded}`,
      'mangga',
      '123456',
    ];

    if (validVariants.includes(trimmed.toLowerCase())) {
      return true;
    }
  }

  // Flexible Super Admin default passwords
  if (account.role === 'super_admin') {
    const adminVariants = [
      'mangga2026',
      'admin',
      'superadmin',
      'super_admin',
      'adminmangga',
      'adminmangga2026',
      'admin_mangga',
      'mangga',
      '123456',
    ];
    if (adminVariants.includes(trimmed.toLowerCase())) {
      return true;
    }
  }

  // Flexible Kasi Pemerintahan default passwords
  if (account.role === 'kasi_pemerintahan') {
    const pemVariants = [
      'pem_mangga2026',
      'pemerintahan2026',
      'pemerintahan',
      'pbb2026',
      'mangga2026',
      'mangga',
      '123456',
    ];
    if (pemVariants.includes(trimmed.toLowerCase())) {
      return true;
    }
  }

  // Flexible Kasi Pembangunan default passwords
  if (account.role === 'kasi_pembangunan') {
    const bangVariants = [
      'bang_mangga2026',
      'pembangunan2026',
      'pembangunan',
      'perlinsos2026',
      'mangga2026',
      'mangga',
      '123456',
    ];
    if (bangVariants.includes(trimmed.toLowerCase())) {
      return true;
    }
  }

  // Flexible Kasi Trantibum default passwords
  if (account.role === 'kasi_trantibum') {
    const trantibVariants = [
      'trantib_mangga2026',
      'trantib2026',
      'trantibum2026',
      'trantibum',
      'trantib',
      'ketertiban2026',
      'mangga2026',
      'mangga',
      '123456',
    ];
    if (trantibVariants.includes(trimmed.toLowerCase())) {
      return true;
    }
  }

  // Super Admin master password also grants universal access
  const superAdminEffective = getEffectivePassword(SUPER_ADMIN_ACCOUNT);
  if (
    trimmed === superAdminEffective ||
    trimmed.toLowerCase() === superAdminEffective.toLowerCase() ||
    trimmed.toLowerCase() === 'mangga2026' ||
    trimmed.toLowerCase() === 'adminmangga2026' ||
    trimmed.toLowerCase() === 'adminmangga'
  ) {
    return true;
  }

  return false;
};

