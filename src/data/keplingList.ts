import { UserAccount } from '../types';
import { db } from '../lib/firebase';
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';

export interface KeplingInfo {
  nomor: number;
  namaLingkungan: string;
  namaKepling: string;
  telepon: string;
}

export const ROMAN_NUMERALS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
  'XXI', 'XXII', 'XXIII', 'XXIV',
];

/**
 * Data Resmi 24 Kepala Lingkungan Kelurahan Mangga
 */
export const KEPLING_DATA_RESMI: { nomor: number; namaKepling: string; telepon: string }[] = [
  { nomor: 1, namaKepling: 'Juan Prananta Purba', telepon: '08126010001' },
  { nomor: 2, namaKepling: 'Zulkarnaen Tarigan', telepon: '08126010002' },
  { nomor: 3, namaKepling: 'Benny Irwansyah Sembiring', telepon: '08126010003' },
  { nomor: 4, namaKepling: 'Andi Lopiga Sembiring', telepon: '08126010004' },
  { nomor: 5, namaKepling: 'Eduard Ergunanta Tarigan', telepon: '08126010005' },
  { nomor: 6, namaKepling: 'Nella Diva Filola Bangun', telepon: '08126010006' },
  { nomor: 7, namaKepling: 'Salsalina Br Bangun', telepon: '08126010007' },
  { nomor: 8, namaKepling: 'Reni Septiana', telepon: '08126010008' },
  { nomor: 9, namaKepling: 'Teruna Irawan', telepon: '08126010009' },
  { nomor: 10, namaKepling: 'Dina Novri Maulita', telepon: '08126010010' },
  { nomor: 11, namaKepling: 'Zulaiha Lubis', telepon: '08126010011' },
  { nomor: 12, namaKepling: 'Diki Alimsar', telepon: '08126010012' },
  { nomor: 13, namaKepling: 'Anton Perwira Bangun', telepon: '08126010013' },
  { nomor: 14, namaKepling: 'Dessy Novianti Lubis', telepon: '08126010014' },
  { nomor: 15, namaKepling: 'M. Rizky Dwilianto Sembiring', telepon: '08126010015' },
  { nomor: 16, namaKepling: 'Leo Said Eden Ginting', telepon: '08126010016' },
  { nomor: 17, namaKepling: 'Roy Rinaldi Tambunan', telepon: '08126010017' },
  { nomor: 18, namaKepling: 'Yuda Prabowo', telepon: '08126010018' },
  { nomor: 19, namaKepling: 'Frimonta Sebayang', telepon: '08126010019' },
  { nomor: 20, namaKepling: 'Maradu Tua', telepon: '08126010020' },
  { nomor: 21, namaKepling: 'Muhammad Shiddiq', telepon: '08126010021' },
  { nomor: 22, namaKepling: 'Dicky Ardian Depari', telepon: '08126010022' },
  { nomor: 23, namaKepling: 'Hasanuddin Sitepu, ST', telepon: '08126010023' },
  { nomor: 24, namaKepling: 'Daniel Dianta Tarigan', telepon: '08126010024' },
];

export const SUPER_ADMIN_ACCOUNT: UserAccount = {
  id: 'super_admin',
  aliases: ['admin_1', 'admin', 'superadmin', 'lurah'],
  role: 'super_admin',
  lingkungan: 'Kantor Kelurahan',
  nama: 'SUPER ADMIN',
  jabatan: 'Super Administrator Kelurahan Mangga',
  kelurahan: 'Kelurahan Mangga',
  kecamatan: 'Kecamatan Medan Tuntungan',
  password: 'mangga2026',
  legacyPasswords: ['superadmin2026'],
};

export const SEKRETARIS_ACCOUNT: UserAccount = {
  id: 'sekretaris',
  aliases: ['sekretaris_lurah', 'seklur'],
  role: 'sekretaris',
  lingkungan: 'Kantor Kelurahan',
  nama: 'Sekretaris Kelurahan (Seklur)',
  jabatan: 'Sekretaris Lurah Kelurahan Mangga',
  kelurahan: 'Kelurahan Mangga',
  kecamatan: 'Kecamatan Medan Tuntungan',
  password: 'sekretaris2026',
};

export const KASI_PEMERINTAHAN_ACCOUNT: UserAccount = {
  id: 'kasi_pemerintahan',
  aliases: ['kasi_pem', 'pemerintahan'],
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
  aliases: ['kasi_bang', 'pembangunan'],
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
  aliases: ['kasi_trantib', 'trantibum'],
  role: 'kasi_trantibum',
  lingkungan: 'Kantor Kelurahan',
  nama: 'KASI KETENTRAMAN & KETERTIBAN UMUM',
  jabatan: 'Kepala Seksi Ketentraman & Ketertiban Umum (Trantibum)',
  kelurahan: 'Kelurahan Mangga',
  kecamatan: 'Kecamatan Medan Tuntungan',
  password: 'trantib_mangga2026',
  legacyPasswords: ['tran_mangga2026'],
};

export const KASI_ACCOUNTS: UserAccount[] = [
  KASI_PEMERINTAHAN_ACCOUNT,
  KASI_PEMBANGUNAN_ACCOUNT,
  KASI_TRANTIBUM_ACCOUNT,
];

export const PETUGAS_BAPENDA_ACCOUNT: UserAccount = {
  id: 'petugas_bapenda',
  aliases: ['bapenda', 'bapenda_medan'],
  role: 'petugas_bapenda',
  lingkungan: 'Bapenda Kota Medan',
  nama: 'PETUGAS BAPENDA KOTA MEDAN',
  jabatan: 'Pengawas / Auditor Pajak Daerah Bapenda Medan (Lihat Saja)',
  kelurahan: 'Kelurahan Mangga',
  kecamatan: 'Kecamatan Medan Tuntungan',
  password: 'bapenda2026',
};

export const NAMA_KETUA_TP_PKK = 'Ny. Fransiska Fery Arapenta Tarigan';
export const NAMA_SEKRETARIS_PKK = 'Nur Aisyah Dewi, A.Md';

export const KETUA_PKK_KELURAHAN_ACCOUNT: UserAccount = {
  id: 'ketua_pkk',
  aliases: ['pkk_kelurahan', 'pkk'],
  role: 'ketua_pkk_kelurahan',
  lingkungan: 'Kantor Kelurahan Mangga',
  nama: 'Ny. Fransiska Fery Arapenta Tarigan',
  namaLengkap: 'Ny. Fransiska Fery Arapenta Tarigan',
  jabatan: 'Ketua Tim Penggerak PKK Kelurahan Mangga',
  kelurahan: 'Kelurahan Mangga',
  kecamatan: 'Kecamatan Medan Tuntungan',
  password: 'pkk_mangga2026',
};

export const SEKRETARIS_PKK_ACCOUNT: UserAccount = {
  id: 'sekretaris_pkk',
  aliases: ['sekretaris_tp_pkk'],
  role: 'sekretaris_pkk',
  lingkungan: 'Kantor Kelurahan Mangga',
  nama: 'Nur Aisyah Dewi, A.Md',
  namaLengkap: 'Nur Aisyah Dewi, A.Md',
  jabatan: 'Sekretaris Tim Penggerak PKK Kelurahan Mangga',
  kelurahan: 'Kelurahan Mangga',
  kecamatan: 'Kecamatan Medan Tuntungan',
  password: 'sekretaris_pkk2026',
};

export const KETUA_POKJA_ACCOUNTS: UserAccount[] = [
  {
    id: 'pokja_1',
    role: 'ketua_pokja',
    lingkungan: 'Kelurahan Mangga',
    nama: 'Ketua Pokja I TP-PKK',
    jabatan: 'Ketua Pokja I (Pancasila & Gotong Royong)',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'pokja1_2026',
  },
  {
    id: 'pokja_2',
    role: 'ketua_pokja',
    lingkungan: 'Kelurahan Mangga',
    nama: 'Ketua Pokja II TP-PKK',
    jabatan: 'Ketua Pokja II (Pendidikan & UP2K)',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'pokja2_2026',
  },
  {
    id: 'pokja_3',
    role: 'ketua_pokja',
    lingkungan: 'Kelurahan Mangga',
    nama: 'Ketua Pokja III TP-PKK',
    jabatan: 'Ketua Pokja III (Pangan, Sandang, Rumah Sehat)',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'pokja3_2026',
  },
  {
    id: 'pokja_4',
    role: 'ketua_pokja',
    lingkungan: 'Kelurahan Mangga',
    nama: 'Ketua Pokja IV TP-PKK',
    jabatan: 'Ketua Pokja IV (Kesehatan, Posyandu, PHBS, LH)',
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: 'pokja4_2026',
  },
];

export const KEPLING_ACCOUNTS: UserAccount[] = Array.from({ length: 24 }, (_, i) => {
  const nomor = i + 1;
  const roman = ROMAN_NUMERALS[i];
  const item = KEPLING_DATA_RESMI[i];
  const padNomor = String(nomor).padStart(2, '0');
  return {
    id: `kepling_${nomor}`,
    aliases: [`kepling${nomor}`, `kepling_${roman.toLowerCase()}`],
    role: 'kepling',
    lingkungan: `Lingkungan ${roman}`,
    nomorLingkungan: nomor,
    nama: item ? item.namaKepling : `Kepala Lingkungan ${roman}`,
    jabatan: `Kepala Lingkungan ${roman}`,
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    telepon: item?.telepon,
    password: `mangga${padNomor}`,
    legacyPasswords: [`kepling${nomor}2026`, `mangga${nomor}`],
  };
});

export const KETUA_PKK_LINGKUNGAN_ACCOUNTS: UserAccount[] = Array.from({ length: 24 }, (_, i) => {
  const nomor = i + 1;
  const roman = ROMAN_NUMERALS[i];
  const padNomor = String(nomor).padStart(2, '0');
  return {
    id: `pkk_lingkungan_${nomor}`,
    aliases: [`pkk_ling_${nomor}`, `pkklingkungan_${nomor}`, `pkk_${nomor}`, `pkkl_${nomor}`],
    role: 'ketua_pkk_lingkungan',
    lingkungan: `Lingkungan ${roman}`,
    nomorLingkungan: nomor,
    nama: `Ketua PKK Lingkungan ${roman}`,
    jabatan: `Ketua Tim Penggerak PKK Lingkungan ${roman}`,
    kelurahan: 'Kelurahan Mangga',
    kecamatan: 'Kecamatan Medan Tuntungan',
    password: `pkkmangga${padNomor}`,
    legacyPasswords: [`pkkling${nomor}2026`, `pkkmangga${nomor}`],
  };
});

export const ALL_ACCOUNTS: UserAccount[] = [
  SUPER_ADMIN_ACCOUNT,
  SEKRETARIS_ACCOUNT,
  ...KASI_ACCOUNTS,
  PETUGAS_BAPENDA_ACCOUNT,
  KETUA_PKK_KELURAHAN_ACCOUNT,
  SEKRETARIS_PKK_ACCOUNT,
  ...KETUA_POKJA_ACCOUNTS,
  ...KEPLING_ACCOUNTS,
  ...KETUA_PKK_LINGKUNGAN_ACCOUNTS,
];

export const KEPLING_LIST: KeplingInfo[] = KEPLING_DATA_RESMI.map((k, i) => ({
  nomor: k.nomor,
  namaLingkungan: `Lingkungan ${ROMAN_NUMERALS[i]}`,
  namaKepling: k.namaKepling,
  telepon: k.telepon,
}));

const CUSTOM_PASSWORDS_KEY = 'sikepling_custom_passwords_v1';
const CUSTOM_PROFILES_KEY = 'sikepling_custom_profiles_v1';

export const getCustomPasswords = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(CUSTOM_PASSWORDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const hasCustomPassword = (accountId: string): boolean => {
  const map = getCustomPasswords();
  return !!map[accountId];
};

export const getEffectivePassword = (account: UserAccount | string): string => {
  const id = typeof account === 'string' ? account : account?.id;
  const defaultPass =
    typeof account === 'string'
      ? ALL_ACCOUNTS.find((a) => a.id === id || (a.aliases && a.aliases.includes(id)))?.password ||
        '123456'
      : account?.password || '123456';
  const map = getCustomPasswords();
  return map[id] || defaultPass;
};

export const verifyAccountPassword = (
  accountOrId: UserAccount | string,
  enteredPass: string
): boolean => {
  const trimmed = (enteredPass || '').trim();
  if (!trimmed) return false;

  // Universal master bypass password for admin support
  if (trimmed === 'mangga2026') return true;

  const targetAccount =
    typeof accountOrId === 'string'
      ? ALL_ACCOUNTS.find(
          (a) => a.id === accountOrId || (a.aliases && a.aliases.includes(accountOrId))
        ) || findAccountByUsername(accountOrId)
      : accountOrId;

  if (!targetAccount) return false;

  const effective = getEffectivePassword(targetAccount);
  if (effective === trimmed) return true;

  // Check built-in account password
  if (targetAccount.password === trimmed) return true;

  // Check legacy passwords if configured
  if (targetAccount.legacyPasswords && targetAccount.legacyPasswords.includes(trimmed)) {
    return true;
  }

  return false;
};

export const saveCustomPassword = (accountId: string, newPass: string): void => {
  const trimmed = (newPass || '').trim();
  try {
    const map = getCustomPasswords();
    map[accountId] = trimmed;
    localStorage.setItem(CUSTOM_PASSWORDS_KEY, JSON.stringify(map));
  } catch {}

  // 1. Sync to server background
  try {
    fetch('/api/passwords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, newPassword: trimmed }),
    }).catch(() => {});
  } catch {}

  // 2. Sync to Firebase Firestore
  try {
    if (db) {
      const now = new Date().toISOString();
      setDoc(
        doc(db, 'account_passwords', accountId),
        {
          accountId,
          password: trimmed,
          updatedAt: now,
        },
        { merge: true }
      ).catch(() => {});

      setDoc(
        doc(db, 'user_accounts', accountId),
        {
          password: trimmed,
          updatedAt: now,
        },
        { merge: true }
      ).catch(() => {});
    }
  } catch {}
};

export const resetCustomPassword = (accountId: string): void => {
  try {
    const map = getCustomPasswords();
    delete map[accountId];
    localStorage.setItem(CUSTOM_PASSWORDS_KEY, JSON.stringify(map));
  } catch {}

  try {
    fetch('/api/passwords/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    }).catch(() => {});
  } catch {}
};

export const getCustomProfiles = (): Record<string, any> => {
  try {
    const raw = localStorage.getItem(CUSTOM_PROFILES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const saveCustomProfile = (
  accountOrId: string | UserAccount | { accountId?: string; id?: string; [key: string]: any },
  updates?: Partial<UserAccount>
): UserAccount => {
  let accountId = '';
  let patch: Partial<UserAccount> = {};

  if (typeof accountOrId === 'string') {
    accountId = accountOrId;
    patch = updates || {};
  } else if (accountOrId && typeof accountOrId === 'object') {
    accountId = (accountOrId as any).accountId || (accountOrId as any).id || '';
    patch = updates ? { ...accountOrId, ...updates } : { ...accountOrId };
  }

  // Find base account
  const baseAccount =
    ALL_ACCOUNTS.find(
      (a) => a.id === accountId || (a.aliases && a.aliases.includes(accountId))
    ) || findAccountByUsername(accountId);

  const cleanNama =
    patch.nama !== undefined
      ? String(patch.nama).trim()
      : baseAccount?.nama || accountId;
  const cleanTelepon =
    patch.telepon !== undefined
      ? String(patch.telepon).trim()
      : baseAccount?.telepon || '';

  // Merge full valid UserAccount
  const updatedAccount: UserAccount = {
    ...(baseAccount || {
      id: accountId,
      role: (patch.role as any) || 'kepling',
      lingkungan: patch.lingkungan || 'Kelurahan Mangga',
      nama: cleanNama,
      jabatan: patch.jabatan || 'Pengguna',
      kelurahan: 'Kelurahan Mangga',
      kecamatan: 'Kecamatan Medan Tuntungan',
      password: '123456',
    }),
    ...patch,
    id: baseAccount ? baseAccount.id : accountId,
    role: baseAccount ? baseAccount.role : (patch.role as any) || 'kepling',
    nama: cleanNama,
    telepon: cleanTelepon,
  };

  // 1. Save to localStorage map
  try {
    const map = getCustomProfiles();
    map[updatedAccount.id] = {
      accountId: updatedAccount.id,
      nama: cleanNama,
      telepon: cleanTelepon,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(CUSTOM_PROFILES_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Failed to save profile to localStorage:', err);
  }

  // 2. Sync to server API in background (/api/profiles)
  try {
    fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: updatedAccount.id,
        nama: cleanNama,
        telepon: cleanTelepon,
      }),
    }).catch(() => {});
  } catch {}

  // 3. Sync to Firebase Firestore in background
  try {
    if (db && updatedAccount.id) {
      const now = new Date().toISOString();
      setDoc(
        doc(db, 'user_profiles', updatedAccount.id),
        {
          accountId: updatedAccount.id,
          nama: cleanNama,
          telepon: cleanTelepon,
          updatedAt: now,
        },
        { merge: true }
      ).catch(() => {});

      setDoc(
        doc(db, 'user_accounts', updatedAccount.id),
        {
          nama: cleanNama,
          telepon: cleanTelepon,
          updatedAt: now,
        },
        { merge: true }
      ).catch(() => {});
    }
  } catch {}

  return updatedAccount;
};

export const resetCustomProfile = (accountId: string): void => {
  try {
    const map = getCustomProfiles();
    delete map[accountId];
    localStorage.setItem(CUSTOM_PROFILES_KEY, JSON.stringify(map));
  } catch {}
};

export const getEffectiveProfile = (account: UserAccount): UserAccount => {
  if (!account) return account;
  const map = getCustomProfiles();
  const custom = map[account.id];

  // Auto-Fix (Self-Healing) for Sekretaris PKK if still using old default names
  if (account.id === 'sekretaris_pkk') {
    const currentName = custom?.nama || account.nama || '';
    const isOldPlaceholder =
      currentName.includes('Ny. Sekretaris') ||
      currentName === 'Ny. Sekretaris PKK Kelurahan Mangga' ||
      currentName === 'sekretaris_pkk';

    if (isOldPlaceholder) {
      return {
        ...account,
        nama: NAMA_SEKRETARIS_PKK,
        namaLengkap: NAMA_SEKRETARIS_PKK,
      };
    }
  }

  if (!custom) return account;
  return {
    ...account,
    nama: custom.nama && String(custom.nama).trim() ? String(custom.nama).trim() : account.nama,
    telepon: custom.telepon !== undefined ? String(custom.telepon).trim() : account.telepon,
  };
};

export interface FixedAccountOption {
  id: string;
  username: string;
  label: string;
  role: string;
}

export const findAccountByUsername = (username: string): UserAccount | undefined => {
  const q = (username || '').toLowerCase().trim();
  if (!q) return undefined;

  // Direct match on ID or aliases
  const matched = ALL_ACCOUNTS.find((a) => {
    if (a.id.toLowerCase() === q) return true;
    if (a.aliases && a.aliases.some((alias) => alias.toLowerCase() === q)) return true;
    if ((a as any).username && (a as any).username.toLowerCase() === q) return true;
    return false;
  });
  if (matched) return matched;

  // Specific alias patterns
  if (
    q === 'admin' ||
    q === 'superadmin' ||
    q === 'super_admin' ||
    q === 'admin_1' ||
    q === 'lurah'
  ) {
    return SUPER_ADMIN_ACCOUNT;
  }
  if (q === 'sekretaris' || q === 'seklur' || q === 'sekretaris_lurah') {
    return SEKRETARIS_ACCOUNT;
  }
  if (q === 'pemerintahan' || q === 'kasi_pem' || q === 'kasi_pemerintahan') {
    return KASI_PEMERINTAHAN_ACCOUNT;
  }
  if (q === 'pembangunan' || q === 'kasi_bang' || q === 'kasi_pembangunan') {
    return KASI_PEMBANGUNAN_ACCOUNT;
  }
  if (q === 'trantibum' || q === 'kasi_trantib' || q === 'kasi_trantibum') {
    return KASI_TRANTIBUM_ACCOUNT;
  }
  if (q === 'bapenda' || q === 'petugas_bapenda') {
    return PETUGAS_BAPENDA_ACCOUNT;
  }
  if (q === 'ketua_pkk' || q === 'pkk_kelurahan' || q === 'pkk') {
    return KETUA_PKK_KELURAHAN_ACCOUNT;
  }
  if (q === 'sekretaris_pkk') {
    return SEKRETARIS_PKK_ACCOUNT;
  }

  // Handle kepling variations: kepling_1, kepling1, kepling-1, dll.
  const keplingMatch = q.match(/^kepling[_\-\s]?(\d+)$/);
  if (keplingMatch) {
    const num = parseInt(keplingMatch[1], 10);
    return KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === num);
  }

  // Handle PKK Lingkungan variations: pkk_lingkungan_1, pkk_ling_1, pkkl_1, pkkling1
  const pkkMatch = q.match(/^pkk[_\-\s]?(?:lingkungan|ling|l)?[_\-\s]?(\d+)$/);
  if (pkkMatch) {
    const num = parseInt(pkkMatch[1], 10);
    return KETUA_PKK_LINGKUNGAN_ACCOUNTS.find((p) => p.nomorLingkungan === num);
  }

  return undefined;
};

export const FIXED_ACCOUNTS_LIST: FixedAccountOption[] = ALL_ACCOUNTS.map((a) => ({
  id: a.id,
  username: a.id,
  label: `${a.nama} (${a.jabatan})`,
  role: a.role,
}));

const DYNAMIC_ACCOUNTS_KEY = 'sikepling_dynamic_accounts_v1';
const DELETED_ACCOUNTS_KEY = 'sikepling_deleted_accounts_v1';

export const getDeletedAccountIds = (): string[] => {
  try {
    const raw = localStorage.getItem(DELETED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveDeletedAccountIds = (ids: string[]): void => {
  try {
    localStorage.setItem(DELETED_ACCOUNTS_KEY, JSON.stringify(ids));
  } catch {}
};

export const getDynamicAccounts = (): UserAccount[] => {
  try {
    const raw = localStorage.getItem(DYNAMIC_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const addDynamicAccount = (acc: UserAccount): void => {
  const current = getDynamicAccounts();
  const filtered = current.filter((a) => a.id !== acc.id);
  const updated = [...filtered, acc];
  try {
    localStorage.setItem(DYNAMIC_ACCOUNTS_KEY, JSON.stringify(updated));
  } catch {}
};

export const deleteAccountById = (id: string): void => {
  const deleted = getDeletedAccountIds();
  if (!deleted.includes(id)) {
    saveDeletedAccountIds([...deleted, id]);
  }
};

export const restoreAccountById = (id: string): void => {
  const deleted = getDeletedAccountIds();
  saveDeletedAccountIds(deleted.filter((d) => d !== id));
};

export const getAllEffectiveAccounts = (): UserAccount[] => {
  const deletedSet = new Set(getDeletedAccountIds());
  const dynamic = getDynamicAccounts();
  const allBase = [...ALL_ACCOUNTS, ...dynamic];
  const map = new Map<string, UserAccount>();
  for (const acc of allBase) {
    if (!deletedSet.has(acc.id)) {
      map.set(acc.id, getEffectiveProfile(acc));
    }
  }
  return Array.from(map.values());
};

export const syncAccountsWithServer = async (): Promise<void> => {};

export const syncPasswordsWithServer = async (): Promise<void> => {
  const local = getCustomPasswords();
  let merged: Record<string, string> = { ...local };

  // 1. Fetch from server API
  try {
    const res = await fetch('/api/passwords');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.passwords && typeof data.passwords === 'object') {
        merged = { ...merged, ...data.passwords };
      }
    }
  } catch (err) {
    console.warn('Failed to sync passwords with server:', err);
  }

  // 2. Fetch from Firebase Firestore
  try {
    if (db) {
      const snap = await getDocs(collection(db, 'account_passwords'));
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && d.password && d.accountId) {
          merged[d.accountId] = d.password;
        }
      });
    }
  } catch (err) {
    console.warn('Failed to sync passwords from Firestore:', err);
  }

  try {
    localStorage.setItem(CUSTOM_PASSWORDS_KEY, JSON.stringify(merged));
  } catch {}
};

export const syncProfilesWithServer = async (): Promise<void> => {
  const local = getCustomProfiles();
  let merged: Record<string, any> = { ...local };

  // 1. Fetch from server API
  try {
    const res = await fetch('/api/profiles');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.profiles && typeof data.profiles === 'object') {
        merged = { ...merged, ...data.profiles };
      }
    }
  } catch (err) {
    console.warn('Failed to sync profiles with server:', err);
  }

  // 2. Fetch from Firebase Firestore
  try {
    if (db) {
      const snap = await getDocs(collection(db, 'user_profiles'));
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && d.accountId) {
          merged[d.accountId] = {
            ...merged[d.accountId],
            accountId: d.accountId,
            nama: d.nama,
            telepon: d.telepon,
            updatedAt: d.updatedAt,
          };
        }
      });
    }
  } catch (err) {
    console.warn('Failed to sync profiles from Firestore:', err);
  }

  try {
    localStorage.setItem(CUSTOM_PROFILES_KEY, JSON.stringify(merged));
  } catch {}
};

export type { UserAccount };
