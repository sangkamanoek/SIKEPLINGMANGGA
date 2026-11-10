import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Download,
  Trash2,
  Edit2,
  X,
  Check,
  Phone,
  Printer,
  Sparkles,
  Bot,
  Copy,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  ShieldAlert,
  Droplets,
  Heart,
  Baby,
  Activity,
  Home,
  CheckSquare,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Calculator,
} from 'lucide-react';
import { UserAccount, KelompokDasaWisma, KkAnggotaDasaWisma } from '../types';
import {
  subscribeDasaWisma,
  saveDasaWisma,
  deleteDasaWisma,
  exportDasaWismaToExcel,
} from '../lib/pkkDasaWismaService';
import { KopSuratPkk } from './KopSuratPkk';
import { RealtimeSyncStatusPanel } from './RealtimeSyncStatusPanel';
import { printOfficialDocument } from '../utils/printHelper';
import {
  parseRawTextToDasaWisma,
  validateDasaWismaData,
  generateDasaWismaSheetsCsv,
} from '../lib/dasaWismaAiParser';
import {
  ROMAN_NUMERALS,
  formatNamaEyd,
  formatKelompokEyd,
  formatAlamatEyd,
  formatTeksEyd,
  formatNomorTelepon,
  formatTanggalResmiIndonesia,
} from '../utils/eydHelper';

export { ROMAN_NUMERALS };

export const getLingkunganRoman = (nomor?: number | string | null): string => {
  if (!nomor) return 'Lingkungan I';
  const n = typeof nomor === 'string' ? parseInt(nomor.replace(/[^0-9]/g, ''), 10) : nomor;
  if (n >= 1 && n <= 24) {
    return `Lingkungan ${ROMAN_NUMERALS[n - 1]}`;
  }
  return typeof nomor === 'string' && nomor.trim() ? nomor : `Lingkungan ${nomor}`;
};

export const resolveItemLingkungan = (item?: Partial<KelompokDasaWisma> | null, activeUser?: UserAccount): string => {
  if (!item) return 'Lingkungan I';

  // 1. If lingkunganNomor is valid (1-24)
  if (typeof item.lingkunganNomor === 'number' && item.lingkunganNomor >= 1 && item.lingkunganNomor <= 24) {
    return `Lingkungan ${ROMAN_NUMERALS[item.lingkunganNomor - 1]}`;
  }

  // 2. If lingkunganNama exists and contains a Roman numeral or digit
  if (item.lingkunganNama && item.lingkunganNama.trim()) {
    const raw = item.lingkunganNama.trim();
    const matchDigit = raw.match(/\d+/);
    if (matchDigit) {
      const num = parseInt(matchDigit[0], 10);
      if (num >= 1 && num <= 24) return `Lingkungan ${ROMAN_NUMERALS[num - 1]}`;
    }
    for (let i = 23; i >= 0; i--) {
      const rom = ROMAN_NUMERALS[i];
      const regex = new RegExp(`\\b${rom}\\b`, 'i');
      if (regex.test(raw)) return `Lingkungan ${rom}`;
    }
    return raw;
  }

  // 3. Check createdByName (e.g. "Ketua PKK Lingkungan I")
  if (item.createdByName) {
    const raw = item.createdByName;
    const matchDigit = raw.match(/lingkungan\s*(\d+)/i);
    if (matchDigit) {
      const num = parseInt(matchDigit[1], 10);
      if (num >= 1 && num <= 24) return `Lingkungan ${ROMAN_NUMERALS[num - 1]}`;
    }
    for (let i = 23; i >= 0; i--) {
      const rom = ROMAN_NUMERALS[i];
      const regex = new RegExp(`lingkungan\\s*${rom}\\b`, 'i');
      if (regex.test(raw)) return `Lingkungan ${rom}`;
    }
  }

  // 4. Fallback to activeUser if activeUser is PKK Lingkungan
  if (activeUser?.nomorLingkungan && activeUser.nomorLingkungan >= 1 && activeUser.nomorLingkungan <= 24) {
    return `Lingkungan ${ROMAN_NUMERALS[activeUser.nomorLingkungan - 1]}`;
  }

  return 'Lingkungan I';
};

interface PkkDasaWismaViewProps {
  currentUser: UserAccount;
  onShowToast?: (msg: string, type?: 'error' | 'info' | 'success') => void;
}

export const PkkDasaWismaView: React.FC<PkkDasaWismaViewProps> = ({ currentUser, onShowToast }) => {
  const isPkkLingkungan =
    currentUser?.role === 'ketua_pkk_lingkungan' ||
    (typeof currentUser?.nomorLingkungan === 'number' && currentUser.nomorLingkungan >= 1);

  const [dawisList, setDawisList] = useState<KelompokDasaWisma[]>([]);
  const [filterLingkungan, setFilterLingkungan] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'daftar' | 'asisten_ai'>('daftar');

  // Asisten Digital AI State
  const [rawAiText, setRawAiText] = useState<string>('');
  const [extractedResult, setExtractedResult] = useState<Partial<KelompokDasaWisma> | null>(null);
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const [isParsingAi, setIsParsingAi] = useState<boolean>(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<KelompokDasaWisma | null>(null);
  const [printingItem, setPrintingItem] = useState<KelompokDasaWisma | null>(null);

  // Anggota Kepala Keluarga (KK) State
  const [formDaftarKk, setFormDaftarKk] = useState<KkAnggotaDasaWisma[]>([]);
  const [isManualKkOpen, setIsManualKkOpen] = useState<boolean>(false);
  const [manualKkNama, setManualKkNama] = useState<string>('');
  const [manualKkNomor, setManualKkNomor] = useState<string>('');
  const [manualKkAlamat, setManualKkAlamat] = useState<string>('');
  const [manualKkJiwa, setManualKkJiwa] = useState<string>('');
  const [manualKkLaki, setManualKkLaki] = useState<string>('0');
  const [manualKkPerempuan, setManualKkPerempuan] = useState<string>('0');
  const [expandedDawisKk, setExpandedDawisKk] = useState<Record<string, boolean>>({});

  // Form State - Full Dasa Wisma Variables
  const [formNama, setFormNama] = useState<string>('');
  const [formLingkunganNomor, setFormLingkunganNomor] = useState<number>(
    currentUser.nomorLingkungan || 1
  );
  const [formNamaKetua, setFormNamaKetua] = useState<string>('');
  const [formNamaKrt, setFormNamaKrt] = useState<string>('');
  const [formTelepon, setFormTelepon] = useState<string>('');
  const [formRtRw, setFormRtRw] = useState<string>('00/00');

  // Demografi
  const [formJumlahKk, setFormJumlahKk] = useState<string>('');
  const [formJumlahJiwa, setFormJumlahJiwa] = useState<string>('');
  const [formLakiLaki, setFormLakiLaki] = useState<string>('0');
  const [formPerempuan, setFormPerempuan] = useState<string>('0');

  // Kategori Khusus
  const [formJumlahBalita, setFormJumlahBalita] = useState<string>('0');
  const [formJumlahLansia, setFormJumlahLansia] = useState<string>('0');
  const [formJumlahPus, setFormJumlahPus] = useState<string>('0');
  const [formJumlahWus, setFormJumlahWus] = useState<string>('0');
  const [formJumlahAkseptorKb, setFormJumlahAkseptorKb] = useState<string>('0');
  const [formJumlahIbuHamil, setFormJumlahIbuHamil] = useState<string>('0');
  const [formJumlahIbuMenyusui, setFormJumlahIbuMenyusui] = useState<string>('0');
  const [formJumlahIbuNifas, setFormJumlahIbuNifas] = useState<string>('0');
  const [formButaAksara, setFormButaAksara] = useState<string>('0');

  // Sanitasi & Rumah
  const [formJambanSehat, setFormJambanSehat] = useState<string>('0');
  const [formSpal, setFormSpal] = useState<string>('0');
  const [formToga, setFormToga] = useState<string>('0');
  const [formSumberAirMinum, setFormSumberAirMinum] = useState<string>('Air Galon / Kemasan');
  const [formSumberAir, setFormSumberAir] = useState<string>('PDAM / Air Perpipaan');
  const [formMakananPokok, setFormMakananPokok] = useState<string>('Beras');
  const [formKriteriaRumah, setFormKriteriaRumah] = useState<string>('Layak Huni');
  const [formStikerP4k, setFormStikerP4k] = useState<string>('Menempel');

  // PTP & Industri Rumah Tangga
  const [formPtpPeternakan, setFormPtpPeternakan] = useState<boolean>(false);
  const [formPtpPerikanan, setFormPtpPerikanan] = useState<boolean>(false);
  const [formPtpWarungHidup, setFormPtpWarungHidup] = useState<boolean>(false);
  const [formPtpToga, setFormPtpToga] = useState<boolean>(true);
  const [formIndustriPangan, setFormIndustriPangan] = useState<boolean>(false);
  const [formIndustriSandang, setFormIndustriSandang] = useState<boolean>(false);
  const [formKegiatanPosyandu, setFormKegiatanPosyandu] = useState<boolean>(true);
  const [formKegiatanUp2k, setFormKegiatanUp2k] = useState<boolean>(false);

  const [formKegiatan, setFormKegiatan] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // AI Output strings
  const [aiNarrative, setAiNarrative] = useState<string>('');
  const [aiMarkdownTable, setAiMarkdownTable] = useState<string>('');

  useEffect(() => {
    const unsubDawis = subscribeDasaWisma((items) => {
      setDawisList(items);
    });
    return () => {
      unsubDawis();
    };
  }, []);

  const showAlert = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setAlertMsg({ text, type });
    if (onShowToast) onShowToast(text, type);
    setTimeout(() => setAlertMsg(null), 3500);
  };

  // Aggregated Stats
  const stats = useMemo(() => {
    let totalKk = 0;
    let totalJiwa = 0;
    let totalBalita = 0;
    let totalBumil = 0;
    let totalBusui = 0;
    let totalLansia = 0;
    let totalPus = 0;
    let totalWus = 0;
    let totalToga = 0;

    dawisList.forEach((d) => {
      totalKk += d.jumlahKk || 0;
      totalJiwa += d.jumlahJiwa || 0;
      totalBalita += d.jumlahBalita || 0;
      totalBumil += d.jumlahIbuHamil || 0;
      totalBusui += d.jumlahIbuMenyusui || 0;
      totalLansia += d.jumlahLansia || 0;
      totalPus += d.jumlahPus || 0;
      totalWus += d.jumlahWus || 0;
      totalToga += d.punyaToga || 0;
    });

    return {
      totalKelompok: dawisList.length,
      totalKk,
      totalJiwa,
      totalBalita,
      totalBumil,
      totalBusui,
      totalLansia,
      totalPus,
      totalWus,
      totalToga,
    };
  }, [dawisList]);

  // Filtered Dasa Wisma
  const filteredList = useMemo(() => {
    return dawisList.filter((d) => {
      if (filterLingkungan !== 'ALL') {
        const lk = parseInt(filterLingkungan, 10);
        if (d.lingkunganNomor !== lk) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNama = (d.namaKelompok || '').toLowerCase().includes(q);
        const matchKetua = (d.namaKetuaDawis || '').toLowerCase().includes(q);
        const matchLk = (d.lingkunganNama || '').toLowerCase().includes(q);
        if (!matchNama && !matchKetua && !matchLk) return false;
      }
      return true;
    });
  }, [dawisList, filterLingkungan, searchQuery]);

  const updateDaftarKk = (newList: KkAnggotaDasaWisma[]) => {
    setFormDaftarKk(newList);
    setFormJumlahKk(String(newList.length));
  };

  const handleAddManualKk = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualKkNama.trim()) {
      showAlert('Nama Kepala Keluarga wajib diisi!', 'error');
      return;
    }

    const newKk: KkAnggotaDasaWisma = {
      id: 'kk_man_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      namaKepalaKeluarga: formatNamaEyd(manualKkNama),
      nomorKk: manualKkNomor.trim() || undefined,
      alamat: manualKkAlamat.trim() ? formatAlamatEyd(manualKkAlamat) : undefined,
      jumlahJiwa: parseInt(manualKkJiwa, 10) || 0,
      jumlahLakiLaki: parseInt(manualKkLaki, 10) || 0,
      jumlahPerempuan: parseInt(manualKkPerempuan, 10) || 0,
      sumberData: 'MANUAL',
    };

    const updated = [...formDaftarKk, newKk];
    updateDaftarKk(updated);

    if (newKk.jumlahJiwa && newKk.jumlahJiwa > 0) {
      const curJiwa = parseInt(formJumlahJiwa, 10) || 0;
      setFormJumlahJiwa(String(curJiwa + newKk.jumlahJiwa));
      if (newKk.jumlahLakiLaki) {
        setFormLakiLaki(String((parseInt(formLakiLaki, 10) || 0) + newKk.jumlahLakiLaki));
      }
      if (newKk.jumlahPerempuan) {
        setFormPerempuan(String((parseInt(formPerempuan, 10) || 0) + newKk.jumlahPerempuan));
      }
    }

    setManualKkNama('');
    setManualKkNomor('');
    setManualKkAlamat('');
    setManualKkJiwa('');
    setManualKkLaki('0');
    setManualKkPerempuan('0');
    setIsManualKkOpen(false);
    showAlert(`Kepala Keluarga "${newKk.namaKepalaKeluarga}" ditambahkan! Jumlah KK menjadi ${updated.length}.`, 'success');
  };

  const handleRemoveKk = (id: string) => {
    const updated = formDaftarKk.filter((k) => k.id !== id);
    updateDaftarKk(updated);
  };

  const handleAutoCalculateDemografi = () => {
    if (formDaftarKk.length === 0) {
      showAlert('Daftar Kepala Keluarga masih kosong!', 'error');
      return;
    }

    let totalJiwa = 0;
    let totalL = 0;
    let totalP = 0;
    let totalBalita = 0;
    let totalLansia = 0;

    formDaftarKk.forEach((kk) => {
      totalJiwa += Number(kk.jumlahJiwa) || 0;
      totalL += Number(kk.jumlahLakiLaki) || 0;
      totalP += Number(kk.jumlahPerempuan) || 0;
      totalBalita += Number(kk.jumlahBalita) || 0;
      totalLansia += Number(kk.jumlahLansia) || 0;
    });

    setFormJumlahJiwa(String(totalJiwa));
    setFormLakiLaki(String(totalL));
    setFormPerempuan(String(totalP));
    setFormJumlahBalita(String(totalBalita));
    setFormJumlahLansia(String(totalLansia));

    showAlert(
      `✨ Demografi berhasil dihitung otomatis dari ${formDaftarKk.length} Kepala Keluarga!`,
      'success'
    );
  };

  const toggleExpandKk = (id: string) => {
    setExpandedDawisKk((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormNama('');
    const defaultLkNomor =
      typeof currentUser?.nomorLingkungan === 'number' && currentUser.nomorLingkungan >= 1
        ? currentUser.nomorLingkungan
        : 1;
    setFormLingkunganNomor(defaultLkNomor);
    setFormNamaKetua('');
    setFormNamaKrt('');
    setFormTelepon('');
    setFormRtRw('');
    setFormDaftarKk([]);
    setFormJumlahKk('');
    setFormJumlahJiwa('');
    setFormLakiLaki('0');
    setFormPerempuan('0');
    setFormJumlahBalita('0');
    setFormJumlahLansia('0');
    setFormJumlahPus('0');
    setFormJumlahWus('0');
    setFormJumlahAkseptorKb('0');
    setFormJumlahIbuHamil('0');
    setFormJumlahIbuMenyusui('0');
    setFormJumlahIbuNifas('0');
    setFormButaAksara('0');
    setFormJambanSehat('0');
    setFormSpal('0');
    setFormToga('0');
    setFormSumberAirMinum('Air Galon / Kemasan');
    setFormSumberAir('PDAM / Air Perpipaan');
    setFormMakananPokok('Beras');
    setFormKriteriaRumah('Layak Huni');
    setFormStikerP4k('Menempel');
    setFormPtpPeternakan(false);
    setFormPtpPerikanan(false);
    setFormPtpWarungHidup(false);
    setFormPtpToga(true);
    setFormIndustriPangan(false);
    setFormIndustriSandang(false);
    setFormKegiatanPosyandu(true);
    setFormKegiatanUp2k(false);
    setFormKegiatan('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: KelompokDasaWisma) => {
    setEditingItem(item);
    setFormNama(item.namaKelompok);
    setFormLingkunganNomor(item.lingkunganNomor);
    setFormNamaKetua(item.namaKetuaDawis);
    setFormNamaKrt(item.namaKrt || '');
    setFormTelepon(item.teleponKetua || '');
    setFormRtRw(item.rtRw || '01/02');
    setFormDaftarKk(item.daftarKkAnggota || []);
    setFormJumlahKk(String(item.jumlahKk || (item.daftarKkAnggota ? item.daftarKkAnggota.length : 0)));
    setFormJumlahJiwa(String(item.jumlahJiwa || 0));
    setFormLakiLaki(String(item.jumlahLakiLaki || 0));
    setFormPerempuan(String(item.jumlahPerempuan || 0));
    setFormJumlahBalita(String(item.jumlahBalita || 0));
    setFormJumlahLansia(String(item.jumlahLansia || 0));
    setFormJumlahPus(String(item.jumlahPus || 0));
    setFormJumlahWus(String(item.jumlahWus || 0));
    setFormJumlahAkseptorKb(String(item.jumlahAkseptorKb || 0));
    setFormJumlahIbuHamil(String(item.jumlahIbuHamil || 0));
    setFormJumlahIbuMenyusui(String(item.jumlahIbuMenyusui || 0));
    setFormJumlahIbuNifas(String(item.jumlahIbuNifas || 0));
    setFormButaAksara(String(item.jumlahButaAksara || 0));
    setFormJambanSehat(String(item.punyaJambanSehat || 0));
    setFormSpal(String(item.punyaSpal || 0));
    setFormToga(String(item.punyaToga || 0));
    setFormSumberAirMinum(item.sumberAirMinum || 'Air Galon / Kemasan');
    setFormSumberAir(item.sumberAirBersih || 'PDAM / Air Perpipaan');
    setFormMakananPokok(item.makananPokok || 'Beras');
    setFormKriteriaRumah(item.kriteriaRumah || 'Layak Huni');
    setFormStikerP4k(item.stikerP4k || 'Menempel');
    setFormPtpPeternakan(!!item.ptpPeternakan);
    setFormPtpPerikanan(!!item.ptpPerikanan);
    setFormPtpWarungHidup(!!item.ptpWarungHidup);
    setFormPtpToga(!!item.ptpToga || item.punyaToga > 0);
    setFormIndustriPangan(!!item.industriPangan);
    setFormIndustriSandang(!!item.industriSandang);
    setFormKegiatanPosyandu(item.kegiatanPosyandu !== false);
    setFormKegiatanUp2k(!!item.kegiatanUp2kKoperasi);
    setFormKegiatan(item.kegiatanUtama || '');
    setIsModalOpen(true);
  };

  const handleFormatAllEyd = () => {
    if (formNama) setFormNama(formatKelompokEyd(formNama));
    if (formNamaKetua) setFormNamaKetua(formatNamaEyd(formNamaKetua));
    if (formNamaKrt) setFormNamaKrt(formatNamaEyd(formNamaKrt));
    if (formTelepon) setFormTelepon(formatNomorTelepon(formTelepon));
    if (formDaftarKk.length > 0) {
      setFormDaftarKk((prev) =>
        prev.map((k) => ({
          ...k,
          namaKepalaKeluarga: formatNamaEyd(k.namaKepalaKeluarga),
          alamat: k.alamat ? formatAlamatEyd(k.alamat) : undefined,
        }))
      );
    }
    showAlert('✨ Seluruh isian telah dirapikan otomatis sesuai kaidah EYD Bahasa Indonesia!', 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim()) {
      showAlert('Nama kelompok Dasa Wisma wajib diisi!', 'error');
      return;
    }
    if (!formNamaKetua.trim()) {
      showAlert('Nama Ketua Dasa Wisma wajib diisi!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const resolvedLkNum = isPkkLingkungan && typeof currentUser.nomorLingkungan === 'number' && currentUser.nomorLingkungan >= 1
        ? currentUser.nomorLingkungan
        : (formLingkunganNomor || 1);
      const resolvedLkNama = `Lingkungan ${ROMAN_NUMERALS[resolvedLkNum - 1]}`;
      const computedJumlahKk = formDaftarKk.length > 0 ? formDaftarKk.length : (parseInt(formJumlahKk, 10) || 0);

      const formattedNamaKelompok = formatKelompokEyd(formNama);
      const formattedNamaKetua = formatNamaEyd(formNamaKetua);
      const formattedNamaKrt = formatNamaEyd(formNamaKrt);
      const formattedTelepon = formatNomorTelepon(formTelepon);
      const formattedCreatedBy = formatNamaEyd(currentUser.nama || `Ketua PKK ${resolvedLkNama}`);

      const cleanedDaftarKk = formDaftarKk.map((kk) => ({
        ...kk,
        namaKepalaKeluarga: formatNamaEyd(kk.namaKepalaKeluarga),
        alamat: kk.alamat ? formatAlamatEyd(kk.alamat) : undefined,
      }));

      const rawObj: Partial<KelompokDasaWisma> = {
        namaKelompok: formattedNamaKelompok,
        lingkunganNomor: resolvedLkNum,
        lingkunganNama: resolvedLkNama,
        namaKetuaDawis: formattedNamaKetua,
        namaKrt: formattedNamaKrt,
        teleponKetua: formattedTelepon,
        rtRw: '',
        daftarKkAnggota: cleanedDaftarKk,
        createdByName: formattedCreatedBy,
        jumlahKk: computedJumlahKk,
        jumlahJiwa: parseInt(formJumlahJiwa, 10) || 0,
        jumlahLakiLaki: parseInt(formLakiLaki, 10) || 0,
        jumlahPerempuan: parseInt(formPerempuan, 10) || 0,
        jumlahBalita: parseInt(formJumlahBalita, 10) || 0,
        jumlahLansia: parseInt(formJumlahLansia, 10) || 0,
        jumlahPus: parseInt(formJumlahPus, 10) || 0,
        jumlahWus: parseInt(formJumlahWus, 10) || 0,
        jumlahAkseptorKb: parseInt(formJumlahAkseptorKb, 10) || 0,
        jumlahIbuHamil: parseInt(formJumlahIbuHamil, 10) || 0,
        jumlahIbuMenyusui: parseInt(formJumlahIbuMenyusui, 10) || 0,
        jumlahIbuNifas: parseInt(formJumlahIbuNifas, 10) || 0,
        jumlahButaAksara: parseInt(formButaAksara, 10) || 0,
        punyaJambanSehat: parseInt(formJambanSehat, 10) || 0,
        punyaSpal: parseInt(formSpal, 10) || 0,
        punyaToga: parseInt(formToga, 10) || 0,
        sumberAirMinum: formSumberAirMinum,
        sumberAirBersih: formSumberAir,
        makananPokok: formMakananPokok,
        kriteriaRumah: formKriteriaRumah,
        stikerP4k: formStikerP4k,
        ptpPeternakan: formPtpPeternakan,
        ptpPerikanan: formPtpPerikanan,
        ptpWarungHidup: formPtpWarungHidup,
        ptpToga: formPtpToga,
        industriPangan: formIndustriPangan,
        industriSandang: formIndustriSandang,
        kegiatanPosyandu: formKegiatanPosyandu,
        kegiatanUp2kKoperasi: formKegiatanUp2k,
        kegiatanUtama: formKegiatan.trim(),
      };

      const { warnings, sanitizedData } = validateDasaWismaData(rawObj);

      const itemToSave: KelompokDasaWisma = {
        ...(sanitizedData as KelompokDasaWisma),
        id: editingItem ? editingItem.id : 'dawis_' + Date.now(),
        validationWarnings: warnings,
        createdByName: currentUser.nama || 'Kader PKK',
        updatedAt: new Date().toISOString(),
      };

      await saveDasaWisma(itemToSave);
      showAlert(
        editingItem
          ? 'Data Dasa Wisma berhasil diperbarui!'
          : 'Kelompok Dasa Wisma baru berhasil ditambahkan!',
        'success'
      );
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      showAlert('Gagal menyimpan data Dasa Wisma', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunAiParser = () => {
    if (!rawAiText.trim()) {
      showAlert('Masukkan catatan / teks mentah pendataan Dasa Wisma!', 'error');
      return;
    }

    setIsParsingAi(true);
    setTimeout(async () => {
      const { parsedData, validation } = parseRawTextToDasaWisma(
        rawAiText,
        currentUser.nomorLingkungan || 1
      );
      setExtractedResult(parsedData);
      setAiWarnings(validation.warnings);

      const module = await import('../lib/dasaWismaAiParser');
      setAiNarrative(module.generateDasaWismaNarrative(parsedData));
      setAiMarkdownTable(module.generateDasaWismaMarkdownTable([parsedData as KelompokDasaWisma]));

      setIsParsingAi(false);
      showAlert('Teks mentah berhasil diekstrak dan divalidasi oleh AI!', 'info');
    }, 800);
  };

  const handleSaveAiExtracted = async () => {
    if (!extractedResult || !extractedResult.namaKelompok) {
      showAlert('Data hasil ekstraksi AI tidak valid.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemToSave: KelompokDasaWisma = {
        id: 'dawis_ai_' + Date.now(),
        namaKelompok: extractedResult.namaKelompok || 'Dasa Wisma Baru',
        lingkunganNomor: extractedResult.lingkunganNomor || currentUser.nomorLingkungan || 1,
        lingkunganNama: `Lingkungan ${extractedResult.lingkunganNomor || currentUser.nomorLingkungan || 1}`,
        namaKetuaDawis: extractedResult.namaKetuaDawis || 'Kader Dasa Wisma',
        namaKrt: extractedResult.namaKrt || '',
        teleponKetua: extractedResult.teleponKetua || '',
        jumlahKk: extractedResult.jumlahKk || 0,
        jumlahJiwa: extractedResult.jumlahJiwa || 0,
        jumlahLakiLaki: extractedResult.jumlahLakiLaki || 0,
        jumlahPerempuan: extractedResult.jumlahPerempuan || 0,
        jumlahBalita: extractedResult.jumlahBalita || 0,
        jumlahLansia: extractedResult.jumlahLansia || 0,
        jumlahPus: extractedResult.jumlahPus || 0,
        jumlahWus: extractedResult.jumlahWus || 0,
        jumlahAkseptorKb: extractedResult.jumlahAkseptorKb || 0,
        jumlahIbuHamil: extractedResult.jumlahIbuHamil || 0,
        jumlahIbuMenyusui: extractedResult.jumlahIbuMenyusui || 0,
        jumlahIbuNifas: extractedResult.jumlahIbuNifas || 0,
        jumlahButaAksara: extractedResult.jumlahButaAksara || 0,
        punyaJambanSehat: extractedResult.punyaJambanSehat || 0,
        punyaSpal: extractedResult.punyaSpal || 0,
        punyaToga: extractedResult.punyaToga || 0,
        sumberAirMinum: extractedResult.sumberAirMinum || 'Air Galon / Kemasan',
        sumberAirBersih: extractedResult.sumberAirBersih || 'PDAM / Air Perpipaan',
        makananPokok: extractedResult.makananPokok || 'Beras',
        kriteriaRumah: extractedResult.kriteriaRumah || 'Layak Huni',
        stikerP4k: extractedResult.stikerP4k || 'Menempel',
        kegiatanUtama: extractedResult.kegiatanUtama || 'Pendataan Dasa Wisma Lapangan',
        validationWarnings: aiWarnings,
        createdByName: currentUser.nama || 'Kader PKK (AI Digitizer)',
        updatedAt: new Date().toISOString(),
      };

      await saveDasaWisma(itemToSave);
      showAlert('Hasil ekstraksi AI berhasil disimpan ke database Firestore!', 'success');
      setExtractedResult(null);
      setRawAiText('');
      setAiNarrative('');
      setAiMarkdownTable('');
      setActiveTab('daftar');
    } catch (err) {
      console.error(err);
      showAlert('Gagal menyimpan hasil ekstraksi AI.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyForSheets = () => {
    const csvContent = generateDasaWismaSheetsCsv(filteredList);
    navigator.clipboard.writeText(csvContent).then(
      () => {
        showAlert('Tabel data Dasa Wisma disalin! Siap dipaste ke Google Sheets atau Excel.', 'success');
      },
      () => {
        showAlert('Gagal menyalin ke clipboard.', 'error');
      }
    );
  };

  const handleDelete = async (id: string, nama: string) => {
    if (!window.confirm(`Hapus kelompok Dasa Wisma "${nama}"?`)) return;
    try {
      await deleteDasaWisma(id);
      showAlert('Kelompok Dasa Wisma berhasil dihapus.', 'success');
    } catch (err) {
      showAlert('Gagal menghapus data.', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Alert Notification */}
      {alertMsg && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in ${
            alertMsg.type === 'success'
              ? 'bg-tosca-50 text-tosca-900 border border-tosca-200'
              : alertMsg.type === 'info'
              ? 'bg-blue-50 text-blue-900 border border-blue-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{alertMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertMsg(null)}
            className="p-1 hover:bg-black/5 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner - Updated to PKK Teal with White Text */}
      <div className="relative overflow-hidden bg-pkk-teal text-white rounded-3xl border border-pkk-dark p-6 sm:p-8 shadow-xl">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-8 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-[10px] font-black tracking-[0.2em] text-tosca-200 uppercase px-2.5 py-1 rounded-lg bg-white/10 border border-white/10">
              <Users className="w-3.5 h-3.5" />
              <span>Kelompok Dasa Wisma 24 Lingkungan</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-[1.1] [text-wrap:balance]">
              Asisten Digital & Pendataan Dasa Wisma PKK
            </h1>
            
            <p className="text-sm text-tosca-100 leading-relaxed max-w-2xl font-medium">
              Modul lengkap pendataan variabel Dasa Wisma (PUS, WUS, Ibu Hamil, Balita, Sanitasi & Pekarangan TOGA) dilengkapi dengan sistem AI Digitizer untuk konversi otomatis catatan lapangan.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={handleCopyForSheets}
                className="group flex items-center gap-2 text-xs font-bold text-white hover:text-amber-300 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors border border-white/10">
                  <Copy className="w-4 h-4" />
                </div>
                <span>Copy for Sheets</span>
              </button>

              <button
                type="button"
                onClick={() => printOfficialDocument('lembar-cetak-dasa-wisma', `REKAP_DASA_WISMA_PKK_${new Date().toISOString().split('T')[0]}`)}
                className="group flex items-center gap-2 text-xs font-bold text-white hover:text-amber-300 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors border border-white/10">
                  <Printer className="w-4 h-4" />
                </div>
                <span>Cetak Rekap</span>
              </button>

              <button
                type="button"
                onClick={() => exportDasaWismaToExcel(filteredList)}
                className="group flex items-center gap-2 text-xs font-bold text-white hover:text-amber-300 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors border border-white/10">
                  <Download className="w-4 h-4" />
                </div>
                <span>Excel Export</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-6 py-4 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg active:scale-[0.98] shrink-0 border-b-4 border-amber-600"
          >
            <Plus className="w-5 h-5" />
            <span>Tambah Dasa Wisma</span>
          </button>
        </div>
      </div>


      <RealtimeSyncStatusPanel />

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('daftar')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'daftar'
              ? 'bg-pkk-teal text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Daftar & Rekapitulasi Dasa Wisma ({filteredList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('asisten_ai')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'asisten_ai'
              ? 'bg-amber-400 text-slate-900 shadow-md'
              : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>AI Digitizer (Konversi Catatan)</span>
        </button>
      </div>

      {activeTab === 'asisten_ai' && (
        <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl border border-purple-500/30">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] tracking-wider uppercase inline-flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-slate-900" />
                <span>AI Parser Catatan Lapangan</span>
              </span>
              <h2 className="text-lg sm:text-xl font-black">
                Konversi Teks Mentah / Chat WA Menjadi Data Dasa Wisma Terstruktur
              </h2>
              <p className="text-xs text-purple-200 mt-1 max-w-2xl leading-relaxed">
                Tempelkan catatan kasar kader, isi pesan WhatsApp, atau hasil ketikan OCR. AI akan mengekstrak otomatis variabel Dasa Wisma (Jiwa, PUS/WUS, Bumil, Balita, Sanitasi, TOGA) serta melakukan validasi logika matematika otomatis.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-purple-300 uppercase tracking-widest">
                Input Catatan Mentah
              </label>
              <textarea
                rows={8}
                value={rawAiText}
                onChange={(e) => setRawAiText(e.target.value)}
                placeholder="Contoh: Dasa Wisma Melati 03 Lingkungan 4. Ketua Ibu Ani (08123456789). Jumlah 15 KK, 60 jiwa (28 L, 32 P). Ada 3 balita, 2 lansia, 1 bumil, 4 busui..."
                className="w-full p-5 text-sm bg-slate-950/50 border border-purple-500/30 rounded-2xl text-purple-50 placeholder-purple-400/30 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all font-mono leading-relaxed"
              />

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-[11px] text-purple-300 font-medium">
                  <div className="flex -space-x-1">
                    <div className="w-5 h-5 rounded-full border border-purple-800 bg-purple-900 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <div className="w-5 h-5 rounded-full border border-purple-800 bg-purple-900 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  </div>
                  <span>Automated validation: L+P math & Bumil status.</span>
                </div>

                <button
                  type="button"
                  onClick={handleRunAiParser}
                  disabled={isParsingAi}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  <Bot className="w-4 h-4" />
                  <span>{isParsingAi ? 'Memproses...' : 'Ekstrak & Validasi AI'}</span>
                </button>
              </div>
            </div>

              {/* Bagian Sistem Kerja & Biaya disembunyikan sesuai permintaan pengguna */}

          </div>

          {/* Result Card from AI Extraction */}
          {extractedResult && (
            <div className="bg-white text-slate-900 rounded-2xl p-6 space-y-4 animate-in fade-in border border-amber-300 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-tosca-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Hasil Ekstraksi &amp; Validasi Data
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-tosca-100 text-tosca-800 text-[10px] font-black uppercase">
                  {extractedResult.namaKelompok}
                </span>
              </div>

              {aiWarnings.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Catatan Validasi Logika AI:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {aiWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" />
                    <span>A. Ringkasan Laporan AI</span>
                  </h4>
                  <div className="p-4 rounded-xl bg-purple-50 border border-purple-100 text-xs text-purple-900 leading-relaxed font-medium italic whitespace-pre-wrap">
                    {aiNarrative}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>B. Tabel Rekapitulasi (Siap Salin)</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(aiMarkdownTable);
                        showAlert('Tabel Markdown disalin!', 'success');
                      }}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                      title="Salin Tabel Markdown"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900 text-slate-300 text-[10px] font-mono leading-tight overflow-x-auto whitespace-pre border border-slate-700">
                    {aiMarkdownTable}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Nama KRT</span>
                  <span className="font-bold text-slate-900">{extractedResult.namaKrt || extractedResult.namaKetuaDawis || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Wilayah</span>
                  <span className="font-bold text-slate-900">{extractedResult.lingkunganNama || 'Lingkungan 1'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Jumlah KK &amp; Jiwa</span>
                  <span className="font-bold text-slate-900">{extractedResult.jumlahKk} KK / {extractedResult.jumlahJiwa} Jiwa</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Demografi L / P</span>
                  <span className="font-bold text-slate-900">{extractedResult.jumlahLakiLaki || 0} L / {extractedResult.jumlahPerempuan || 0} P</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">PUS &amp; WUS</span>
                  <span className="font-bold text-purple-900">{extractedResult.jumlahPus || 0} PUS / {extractedResult.jumlahWus || 0} WUS</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Balita / Bumil</span>
                  <span className="font-bold text-tosca-700">{extractedResult.jumlahBalita || 0} Balita / {extractedResult.jumlahIbuHamil || 0} Bumil</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-black tracking-widest">Air Minum</span>
                  <span className="font-bold text-slate-900">{extractedResult.sumberAirMinum || 'Air Galon'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-black tracking-widest">Air Bersih</span>
                  <span className="font-bold text-slate-900">{extractedResult.sumberAirBersih || 'PDAM'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-black tracking-widest">Stiker P4K</span>
                  <span className="font-bold text-amber-700">{extractedResult.stikerP4k || 'Tidak'}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setExtractedResult(null);
                    setAiNarrative('');
                    setAiMarkdownTable('');
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveAiExtracted}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-tosca-700 hover:bg-tosca-800 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Simpan...' : 'Simpan ke Firestore'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'daftar' && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">Kelompok</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block tabular-nums">{stats.totalKelompok}</span>
              <span className="text-[10px] text-slate-500 font-medium mt-1 block">Dasa Wisma</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">Penduduk</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block tabular-nums">{stats.totalJiwa}</span>
              <span className="text-[10px] text-slate-500 font-medium mt-1 block">{stats.totalKk} Kepala Keluarga</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">PUS / WUS</span>
              <span className="text-2xl font-black text-purple-700 mt-1 block tabular-nums">{stats.totalPus} / {stats.totalWus}</span>
              <span className="text-[10px] text-purple-600 font-medium mt-1 block">Pasangan Usia Subur</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">Balita</span>
              <span className="text-2xl font-black text-tosca-700 mt-1 block tabular-nums">{stats.totalBalita}</span>
              <span className="text-[10px] text-tosca-600 font-medium mt-1 block">{stats.totalBumil} Ibu Hamil</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">Busui / Nifas</span>
              <span className="text-2xl font-black text-amber-700 mt-1 block tabular-nums">{stats.totalBusui}</span>
              <span className="text-[10px] text-amber-600 font-medium mt-1 block">Ibu Menyusui</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-b-4 border-b-emerald-500">
              <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">Hatinya PKK</span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block tabular-nums">{stats.totalToga}</span>
              <span className="text-[10px] text-emerald-600 font-medium mt-1 block">Pekarangan TOGA</span>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-100 p-1.5 rounded-2xl">
            <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm shrink-0">
              <button
                type="button"
                onClick={() => setFilterLingkungan('ALL')}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                  filterLingkungan === 'ALL' ? 'bg-pkk-teal text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                Semua
              </button>
              <select
                value={filterLingkungan === 'ALL' ? '' : filterLingkungan}
                onChange={(e) => setFilterLingkungan(e.target.value || 'ALL')}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-wider bg-transparent text-slate-700 focus:outline-none border-l border-slate-100 cursor-pointer"
              >
                <option value="">Semua Lingkungan</option>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    Lingkungan {ROMAN_NUMERALS[n - 1]}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama kelompok, ketua, atau KRT..."
                className="w-full pl-11 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tosca-500/20 focus:border-tosca-500 transition-all shadow-sm font-medium"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>

            <div className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] hidden lg:block tabular-nums">
              {filteredList.length} <span className="opacity-60">Kelompok</span>
            </div>
          </div>

          {/* Dasa Wisma Cards List */}
          <div id="lembar-cetak-dasa-wisma">
            <div className="hidden print:block mb-4">
              <KopSuratPkk />
              <div className="text-center my-2">
                <h2 className="text-sm font-black uppercase text-slate-900 underline">
                  REKAPITULASI KELOMPOK BINAAN DASA WISMA TP-PKK KELURAHAN MANGGA
                </h2>
                <p className="text-[10px] text-slate-600 font-medium">Kecamatan Medan Tuntungan • Kota Medan</p>
              </div>
            </div>

            {filteredList.length === 0 ? (
              <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-10 sm:p-14 text-center max-w-xl mx-auto shadow-2xs">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-tosca-50 border border-tosca-200 flex items-center justify-center text-tosca-600 shadow-2xs">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1">
                  Data Dasa Wisma Masih Kosong
                </h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed max-w-md mx-auto">
                  Silakan tambahkan kelompok Dasa Wisma binaan PKK secara manual atau gunakan Asisten AI Digitizer untuk konversi cepat dari catatan WA/OCR.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('asisten_ai')}
                    className="px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <Bot className="w-4 h-4 text-amber-300" />
                    <span>Gunakan Asisten AI</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenAdd}
                    className="px-4 py-2.5 rounded-xl bg-tosca-700 hover:bg-tosca-800 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Input Manual</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredList.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full bg-pkk-light border border-pkk-teal/20 text-pkk-teal text-[11px] font-black">
                          {resolveItemLingkungan(item, currentUser)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.id}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-sm font-black text-slate-900 leading-tight">
                            {formatKelompokEyd(item.namaKelompok)}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                            <span className="font-bold text-pkk-teal">{resolveItemLingkungan(item, currentUser)}</span>
                            <span aria-hidden="true" className="opacity-30">/</span>
                            <span>Ketua: {formatNamaEyd(item.namaKetuaDawis)}</span>
                          </div>
                        </div>
                        {item.teleponKetua && (
                          <a
                            href={`tel:${item.teleponKetua}`}
                            className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-tosca-50 hover:text-tosca-600 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      {/* Warnings if logic error */}
                      {item.validationWarnings && item.validationWarnings.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-lg">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{item.validationWarnings[0]}</span>
                        </div>
                      )}

                      {/* Data Grid Summary */}
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Kependudukan</span>
                          <div className="text-[11px] font-bold text-slate-800 tabular-nums">
                            {item.jumlahKk} KK · {item.jumlahJiwa} Jiwa
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">PUS / WUS</span>
                          <div className="text-[11px] font-bold text-purple-700 tabular-nums">
                            {item.jumlahPus || 0} PUS / {item.jumlahWus || 0} WUS
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Posyandu</span>
                          <div className="text-[11px] font-bold text-pkk-teal tabular-nums">
                            {item.jumlahBalita || 0} Balita / {item.jumlahIbuHamil || 0} Bumil
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Sanitasi & Toga</span>
                          <div className="text-[11px] font-bold text-slate-800 tabular-nums">
                            {item.punyaJambanSehat || 0} WC / {item.punyaToga || 0} Toga
                          </div>
                        </div>
                      </div>

                      {item.kegiatanUtama && (
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          <p className="text-[10px] text-slate-500 leading-relaxed italic">
                            &ldquo;{item.kegiatanUtama}&rdquo;
                          </p>
                        </div>
                      )}

                      {/* Daftar Kepala Keluarga Anggota */}
                      {item.daftarKkAnggota && item.daftarKkAnggota.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => toggleExpandKk(item.id)}
                            className="w-full flex items-center justify-between text-[11px] font-bold text-slate-700 hover:text-pkk-teal transition-colors py-1 cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-pkk-teal" />
                              <span>{item.daftarKkAnggota.length} Kepala Keluarga Terdaftar</span>
                            </span>
                            {expandedDawisKk[item.id] ? (
                              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>

                          {expandedDawisKk[item.id] && (
                            <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {item.daftarKkAnggota.map((kk, idx) => (
                                <div
                                  key={kk.id || idx}
                                  className="text-[10px] p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-800 truncate">
                                      {idx + 1}. {kk.namaKepalaKeluarga}
                                    </div>
                                    <div className="text-[9px] text-slate-400 truncate">
                                      {kk.nomorKk ? `No. KK: ${kk.nomorKk}` : ''}
                                      {kk.nomorKk && kk.alamat ? ' · ' : ''}
                                      {kk.alamat || ''}
                                    </div>
                                  </div>
                                  {kk.jumlahJiwa ? (
                                    <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                                      {kk.jumlahJiwa} Jiwa
                                    </span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-400">
                        Input: {formatNamaEyd(item.createdByName) || 'Kader'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPrintingItem(item);
                            setTimeout(() => {
                              printOfficialDocument('lembar-cetak-dasa-wisma-single', `FORM_DASAWISMA_${(item.namaKelompok || 'kelompok').replace(/[^a-zA-Z0-9]/g, '_')}`);
                            }, 150);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Cetak Formulir Dasa Wisma"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-pkk-teal hover:bg-pkk-light transition-colors cursor-pointer"
                          title="Edit Dasa Wisma"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.namaKelompok)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Hapus Dasa Wisma"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Add / Edit Dasa Wisma */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pkk-light flex items-center justify-center text-pkk-teal">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    {editingItem ? 'Ubah Data Dasa Wisma' : 'Tambah Kelompok Baru'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Pendataan Variabel Lengkap PKK
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              {/* Section 1: Identitas & Wilayah */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-black text-[10px]">01</div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Identitas &amp; Wilayah</h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleFormatAllEyd}
                    className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold flex items-center gap-1.5 transition-colors border border-purple-200 cursor-pointer shadow-2xs"
                    title="Rapikan penulisan huruf kapital & ejaan baku otomatis sesuai kaidah Bahasa Indonesia (EYD V)"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Rapikan Ejaan (EYD)</span>
                  </button>
                </div>
                <div className="h-px bg-slate-100" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Nama Kelompok</label>
                      <span className="text-[10px] text-purple-600 font-semibold">Auto-EYD</span>
                    </div>
                    <input
                      type="text"
                      value={formNama}
                      onChange={(e) => setFormNama(e.target.value)}
                      onBlur={() => {
                        if (formNama.trim()) setFormNama(formatKelompokEyd(formNama));
                      }}
                      placeholder="Contoh: Dasa Wisma Mawar I"
                      className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tosca-500/20 focus:border-tosca-500 transition-all font-semibold"
                      required
                    />
                    <p className="text-[10px] text-slate-400">
                      Format baku: Awalan <em>Dasa Wisma</em> &amp; akhiran angka Romawi (I sd XXIV).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Wilayah Lingkungan</label>
                    {isPkkLingkungan ? (
                      <div className="w-full px-4 py-3 text-sm bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 font-bold flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Lingkungan {ROMAN_NUMERALS[(currentUser.nomorLingkungan || 1) - 1]}</span>
                        </div>
                        <span className="text-[10px] uppercase font-black bg-emerald-200 text-emerald-900 px-2.5 py-1 rounded-md">
                          Otomatis Akun PKK Anda
                        </span>
                      </div>
                    ) : (
                      <select
                        value={formLingkunganNomor}
                        onChange={(e) => setFormLingkunganNomor(parseInt(e.target.value, 10))}
                        className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tosca-500/20 focus:border-tosca-500 transition-all font-bold"
                      >
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            Lingkungan {ROMAN_NUMERALS[n - 1]}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Kepala Rumah Tangga (KRT)</label>
                    <input
                      type="text"
                      value={formNamaKrt}
                      onChange={(e) => setFormNamaKrt(e.target.value)}
                      onBlur={() => {
                        if (formNamaKrt.trim()) setFormNamaKrt(formatNamaEyd(formNamaKrt));
                      }}
                      placeholder="Nama Kepala Keluarga"
                      className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tosca-500/20 focus:border-tosca-500 transition-all font-semibold"
                    />
                    <p className="text-[10px] text-slate-400">
                      Format baku EYD: Huruf kapital pada setiap awal kata nama orang.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Ketua Dasa Wisma</label>
                    <input
                      type="text"
                      value={formNamaKetua}
                      onChange={(e) => setFormNamaKetua(e.target.value)}
                      onBlur={() => {
                        if (formNamaKetua.trim()) setFormNamaKetua(formatNamaEyd(formNamaKetua));
                      }}
                      placeholder="Nama Kader Ketua"
                      className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tosca-500/20 focus:border-tosca-500 transition-all font-semibold"
                      required
                    />
                    <p className="text-[10px] text-slate-400">
                      Format baku EYD: Huruf kapital pada setiap awal kata nama ketua.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Kontak Ketua</label>
                    <input
                      type="tel"
                      value={formTelepon}
                      onChange={(e) => setFormTelepon(e.target.value)}
                      onBlur={() => {
                        if (formTelepon.trim()) setFormTelepon(formatNomorTelepon(formTelepon));
                      }}
                      placeholder="Contoh: 0812-3456-7890"
                      className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tosca-500/20 focus:border-tosca-500 transition-all font-mono"
                    />
                    <p className="text-[10px] text-slate-400">
                      Otomatis dirapikan dengan tanda hubung standar (08xx-xxxx-xxxx).
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 2: Demografi & Anggota Kepala Keluarga */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-black text-[10px]">02</div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Kependudukan & Kelompok Khusus</h4>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                {/* Sub-Panel: Daftar Anggota Kepala Keluarga */}
                <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-pkk-teal" />
                        <h5 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                          Daftar Kepala Keluarga Anggota Kelompok
                        </h5>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            formDaftarKk.length >= 10 && formDaftarKk.length <= 20
                              ? 'bg-emerald-100 text-emerald-800'
                              : formDaftarKk.length > 0
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {formDaftarKk.length} KK Terdaftar
                          {formDaftarKk.length >= 10 && formDaftarKk.length <= 20 ? ' (Ideal 10-20 KK)' : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Setiap Dasa Wisma beranggotakan 10-20 KK. Angka Jumlah KK di bawah akan terhitung otomatis sesuai daftar ini.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsManualKkOpen(!isManualKkOpen)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pkk-teal text-white hover:bg-tosca-700 text-xs font-bold shadow-sm transition-all cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{isManualKkOpen ? 'Tutup Input' : '+ Tambah Kepala Keluarga'}</span>
                      </button>

                      {formDaftarKk.length > 0 && (
                        <button
                          type="button"
                          onClick={handleAutoCalculateDemografi}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 text-xs font-bold shadow-sm transition-all cursor-pointer"
                          title="Hitung otomatis data kependudukan & sanitasi dari KK yang dipilih"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Hitung Demografi</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Manual KK Input Drawer */}
                  {isManualKkOpen && (
                    <div className="bg-white rounded-xl p-4 border border-tosca-200 shadow-sm space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <UserPlus className="w-3.5 h-3.5 text-pkk-teal" />
                          Tambah Kepala Keluarga Secara Manual
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsManualKkOpen(false)}
                          className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Nama Kepala Keluarga *</label>
                          <input
                            type="text"
                            value={manualKkNama}
                            onChange={(e) => setManualKkNama(e.target.value)}
                            placeholder="Contoh: Budi Santoso"
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tosca-500/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Nomor Kartu Keluarga (Opsional)</label>
                          <input
                            type="text"
                            value={manualKkNomor}
                            onChange={(e) => setManualKkNomor(e.target.value)}
                            placeholder="16 Digit No. KK"
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tosca-500/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Alamat / Jalan / Gang</label>
                          <input
                            type="text"
                            value={manualKkAlamat}
                            onChange={(e) => setManualKkAlamat(e.target.value)}
                            placeholder="Contoh: Jl. Bunga Raya No. 12"
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tosca-500/20"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Total Jiwa</label>
                          <input
                            type="number"
                            value={manualKkJiwa}
                            onChange={(e) => setManualKkJiwa(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Laki-Laki</label>
                          <input
                            type="number"
                            value={manualKkLaki}
                            onChange={(e) => setManualKkLaki(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Perempuan</label>
                          <input
                            type="number"
                            value={manualKkPerempuan}
                            onChange={(e) => setManualKkPerempuan(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsManualKkOpen(false)}
                          className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddManualKk()}
                          className="px-4 py-1.5 text-xs font-bold rounded-lg bg-pkk-teal text-white hover:bg-tosca-700 cursor-pointer"
                        >
                          Masukkan ke Daftar KK
                        </button>
                      </div>
                    </div>
                  )}

                  {/* List of Registered KK */}
                  {formDaftarKk.length === 0 ? (
                    <div className="p-5 border-2 border-dashed border-slate-200 rounded-xl text-center space-y-1.5">
                      <p className="text-xs text-slate-600 font-bold">
                        Belum ada Kepala Keluarga yang dimasukkan ke kelompok ini.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Klik tombol <span className="font-bold text-pkk-teal">&ldquo;+ Tambah Kepala Keluarga&rdquo;</span> di atas untuk mendaftarkan anggota Dasa Wisma.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {formDaftarKk.map((kk, idx) => (
                        <div
                          key={kk.id || idx}
                          className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-xs hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-900 truncate">
                                  {kk.namaKepalaKeluarga}
                                </span>
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 bg-slate-100 text-slate-600 border border-slate-200">
                                  Manual
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                {kk.nomorKk ? `No. KK: ${kk.nomorKk}` : ''}
                                {kk.nomorKk && kk.alamat ? ' · ' : ''}
                                {kk.alamat || 'Alamat belum diisi'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {kk.jumlahJiwa ? (
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                {kk.jumlahJiwa} Jiwa
                              </span>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleRemoveKk(kk.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus dari kelompok"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Grid Demografi & Kategori Khusus */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Jml KK</label>
                      {formDaftarKk.length > 0 && (
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">
                          Otomatis ({formDaftarKk.length})
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      value={formJumlahKk}
                      onChange={(e) => setFormJumlahKk(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums font-bold text-slate-900 focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Jiwa</label>
                    <input type="number" value={formJumlahJiwa} onChange={(e) => setFormJumlahJiwa(e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Laki-Laki</label>
                    <input type="number" value={formLakiLaki} onChange={(e) => setFormLakiLaki(e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Perempuan</label>
                    <input type="number" value={formPerempuan} onChange={(e) => setFormPerempuan(e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums" />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-purple-400 uppercase tracking-wider">PUS</label>
                    <input type="number" value={formJumlahPus} onChange={(e) => setFormJumlahPus(e.target.value)} className="w-full px-3 py-2 text-sm bg-purple-50/50 border border-purple-100 rounded-lg tabular-nums text-purple-700 font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-purple-400 uppercase tracking-wider">WUS</label>
                    <input type="number" value={formJumlahWus} onChange={(e) => setFormJumlahWus(e.target.value)} className="w-full px-3 py-2 text-sm bg-purple-50/50 border border-purple-100 rounded-lg tabular-nums text-purple-700 font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-purple-400 uppercase tracking-wider">Akseptor KB</label>
                    <input type="number" value={formJumlahAkseptorKb} onChange={(e) => setFormJumlahAkseptorKb(e.target.value)} className="w-full px-3 py-2 text-sm bg-purple-50/50 border border-purple-100 rounded-lg tabular-nums text-purple-700 font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-tosca-400 uppercase tracking-wider">Ibu Hamil</label>
                    <input type="number" value={formJumlahIbuHamil} onChange={(e) => setFormJumlahIbuHamil(e.target.value)} className="w-full px-3 py-2 text-sm bg-tosca-50/50 border border-tosca-100 rounded-lg tabular-nums text-tosca-700 font-bold" />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-wider">Ibu Menyusui</label>
                    <input type="number" value={formJumlahIbuMenyusui} onChange={(e) => setFormJumlahIbuMenyusui(e.target.value)} className="w-full px-3 py-2 text-sm bg-amber-50/50 border border-amber-100 rounded-lg tabular-nums text-amber-700 font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-wider">Ibu Nifas</label>
                    <input type="number" value={formJumlahIbuNifas} onChange={(e) => setFormJumlahIbuNifas(e.target.value)} className="w-full px-3 py-2 text-sm bg-amber-50/50 border border-amber-100 rounded-lg tabular-nums text-amber-700 font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Balita</label>
                    <input type="number" value={formJumlahBalita} onChange={(e) => setFormJumlahBalita(e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lansia</label>
                    <input type="number" value={formJumlahLansia} onChange={(e) => setFormJumlahLansia(e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums" />
                  </div>
                </div>
              </section>

              {/* Section 3: Sanitasi */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-black text-[10px]">03</div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Sanitasi & Pekarangan</h4>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Jamban (KK)</label>
                    <input type="number" value={formJambanSehat} onChange={(e) => setFormJambanSehat(e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">SPAL (KK)</label>
                    <input type="number" value={formSpal} onChange={(e) => setFormSpal(e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Toga (KK)</label>
                    <input type="number" value={formToga} onChange={(e) => setFormToga(e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Sumber Air Minum</label>
                      <span className="text-[9px] text-pkk-teal font-bold uppercase">(Untuk Dikonsumsi)</span>
                    </div>
                    <select value={formSumberAirMinum} onChange={(e) => setFormSumberAirMinum(e.target.value)} className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pkk-teal/20 focus:border-pkk-teal outline-none transition-all">
                      <option value="Air Galon / Kemasan">Air Galon / Kemasan</option>
                      <option value="Depot Isi Ulang">Depot Isi Ulang</option>
                      <option value="PDAM / Air Perpipaan">PDAM / Air Perpipaan</option>
                      <option value="Sumur Bor / Terlindungi">Sumur Bor / Terlindungi</option>
                      <option value="Mata Air">Mata Air</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Sumber Air Bersih</label>
                      <span className="text-[9px] text-blue-600 font-bold uppercase">(Mandi/Cuci/Kakus)</span>
                    </div>
                    <select value={formSumberAir} onChange={(e) => setFormSumberAir(e.target.value)} className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pkk-teal/20 focus:border-pkk-teal outline-none transition-all">
                      <option value="PDAM / Air Perpipaan">PDAM / Air Perpipaan</option>
                      <option value="Sumur Bor / Terlindungi">Sumur Bor / Terlindungi</option>
                      <option value="Air Galon / Kemasan">Air Galon / Kemasan</option>
                      <option value="Mata Air / Sungai">Mata Air / Sungai</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Section 4: Kriteria Rumah */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-black text-[10px]">04</div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Kriteria & Aktivitas</h4>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Kelayakan Rumah</label>
                    <select value={formKriteriaRumah} onChange={(e) => setFormKriteriaRumah(e.target.value)} className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl">
                      <option value="Layak Huni">Layak Huni</option>
                      <option value="Tidak Layak Huni">Tidak Layak Huni</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Stiker P4K</label>
                    <select value={formStikerP4k} onChange={(e) => setFormStikerP4k(e.target.value)} className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl">
                      <option value="Menempel">Menempel</option>
                      <option value="Tidak Menempel">Tidak Menempel</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Makanan Pokok</label>
                    <select value={formMakananPokok} onChange={(e) => setFormMakananPokok(e.target.value)} className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl">
                      <option value="Beras">Beras</option>
                      <option value="Non-Beras">Non-Beras</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Catatan Kegiatan Pokok</label>
                  <textarea
                    rows={3}
                    value={formKegiatan}
                    onChange={(e) => setFormKegiatan(e.target.value)}
                    placeholder="Contoh: Arisan rutin, pemanfaatan toga, senam sehat..."
                    className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tosca-500/20 focus:border-tosca-500 transition-all font-medium italic"
                  />
                </div>
              </section>
            </form>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 rounded-xl text-slate-500 font-bold text-xs hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={(e: any) => handleSubmit(e)}
                disabled={isSubmitting}
                className="px-10 py-3 rounded-xl bg-pkk-teal hover:bg-pkk-dark text-white font-black text-xs shadow-lg shadow-pkk-teal/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* HIDDEN SINGLE DASA WISMA PRINT SHEET */}
      <div className="hidden">
        <div id="lembar-cetak-dasa-wisma-single" className="p-3 bg-white text-slate-900 font-sans text-[9px] leading-tight print:p-0">
          {printingItem && (
            <div>
              <KopSuratPkk className="mb-2" />

              <div className="text-center my-2 pb-1.5 border-b-2 border-black">
                <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                  LEMBAR PENDATAAN KELOMPOK DASA WISMA
                </h2>
                <p className="text-[11px] font-black text-slate-900 uppercase mt-0.5">
                  {formatKelompokEyd(printingItem.namaKelompok)}
                </p>
                <p className="text-[8.5px] text-slate-600 font-medium">
                  TP-PKK Kelurahan Mangga • Kecamatan Medan Tuntungan • Kota Medan
                </p>
              </div>

              {/* 01. Identitas Kelompok & Wilayah */}
              <h3 className="font-bold text-[8.5px] uppercase bg-slate-100 border border-black px-1.5 py-0.5 mb-0.5">
                01. IDENTITAS KELOMPOK &amp; WILAYAH BINAAN
              </h3>
              <div className="grid grid-cols-2 gap-3 border border-black p-2 mb-2 text-[8.5px] font-sans">
                <div className="space-y-0.5">
                  <p><strong>Nama Kelompok:</strong> {formatKelompokEyd(printingItem.namaKelompok)}</p>
                  <p><strong>Wilayah Lingkungan:</strong> {resolveItemLingkungan(printingItem, currentUser)}</p>
                  <p><strong>Kepala Rumah Tangga (KRT) Utama:</strong> {formatNamaEyd(printingItem.namaKrt) || '-'}</p>
                </div>
                <div className="space-y-0.5">
                  <p><strong>Ketua Dasa Wisma:</strong> {formatNamaEyd(printingItem.namaKetuaDawis) || '-'}</p>
                  <p><strong>Kontak Ketua:</strong> {formatNomorTelepon(printingItem.teleponKetua) || '-'}</p>
                  <p><strong>Kader Pendata / Pelapor:</strong> {formatNamaEyd(printingItem.createdByName) || '-'}</p>
                </div>
              </div>

              {/* 02. Kependudukan & Kelompok Khusus */}
              <h3 className="font-bold text-[8.5px] uppercase bg-slate-100 border border-black px-1.5 py-0.5 mb-0.5">
                02. KEPENDUDUKAN &amp; KELOMPOK KHUSUS
              </h3>
              <table className="w-full border-collapse border border-black text-[8px] mb-2 text-center font-sans table-compact">
                <thead>
                  <tr className="bg-slate-100 font-bold">
                    <th className="border border-black p-0.5">Jml KK</th>
                    <th className="border border-black p-0.5">Total Jiwa</th>
                    <th className="border border-black p-0.5">L</th>
                    <th className="border border-black p-0.5">P</th>
                    <th className="border border-black p-0.5">PUS</th>
                    <th className="border border-black p-0.5">WUS</th>
                    <th className="border border-black p-0.5">KB</th>
                    <th className="border border-black p-0.5">Bumil</th>
                    <th className="border border-black p-0.5">Busui</th>
                    <th className="border border-black p-0.5">Nifas</th>
                    <th className="border border-black p-0.5">Balita</th>
                    <th className="border border-black p-0.5">Lansia</th>
                    <th className="border border-black p-0.5">Buta Aksara</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black p-0.5 font-bold">{printingItem.jumlahKk || 0}</td>
                    <td className="border border-black p-0.5 font-bold">{printingItem.jumlahJiwa || 0}</td>
                    <td className="border border-black p-0.5">{printingItem.jumlahLakiLaki || 0}</td>
                    <td className="border border-black p-0.5">{printingItem.jumlahPerempuan || 0}</td>
                    <td className="border border-black p-0.5">{printingItem.jumlahPus || 0}</td>
                    <td className="border border-black p-0.5">{printingItem.jumlahWus || 0}</td>
                    <td className="border border-black p-0.5">{printingItem.jumlahAkseptorKb || 0}</td>
                    <td className="border border-black p-0.5">{printingItem.jumlahIbuHamil || 0}</td>
                    <td className="border border-black p-0.5">{printingItem.jumlahIbuMenyusui || 0}</td>
                    <td className="border border-black p-0.5">{printingItem.jumlahIbuNifas || 0}</td>
                    <td className="border border-black p-0.5">{printingItem.jumlahBalita || 0}</td>
                    <td className="border border-black p-0.5">{printingItem.jumlahLansia || 0}</td>
                    <td className="border border-black p-0.5">{printingItem.jumlahButaAksara || 0}</td>
                  </tr>
                </tbody>
              </table>

              {/* 03. Sanitasi & Fasilitas Rumah */}
              <h3 className="font-bold text-[8.5px] uppercase bg-slate-100 border border-black px-1.5 py-0.5 mb-0.5">
                03. SANITASI, SUMBER AIR &amp; FASILITAS RUMAH
              </h3>
              <div className="grid grid-cols-2 gap-3 border border-black p-2 mb-2 text-[8.5px] font-sans">
                <div className="space-y-0.5">
                  <p><strong>Jamban Sehat (WC):</strong> {printingItem.punyaJambanSehat || 0} KK</p>
                  <p><strong>Saluran Air Limbah (SPAL):</strong> {printingItem.punyaSpal || 0} KK</p>
                  <p><strong>Pemanfaatan TOGA:</strong> {printingItem.punyaToga || 0} KK</p>
                  <p><strong>Makanan Pokok:</strong> {formatTeksEyd(printingItem.makananPokok) || 'Beras'}</p>
                </div>
                <div className="space-y-0.5">
                  <p><strong>Sumber Air Minum:</strong> {formatTeksEyd(printingItem.sumberAirMinum) || 'Air Galon / Isi Ulang'}</p>
                  <p><strong>Sumber Air Bersih:</strong> {formatTeksEyd(printingItem.sumberAirBersih) || 'PDAM / Perpipaan'}</p>
                  <p><strong>Kriteria Rumah:</strong> {formatTeksEyd(printingItem.kriteriaRumah) || 'Layak Huni'}</p>
                  <p><strong>Stiker P4K:</strong> {formatTeksEyd(printingItem.stikerP4k) || 'Menempel'}</p>
                </div>
              </div>

              {/* 04. Pemanfaatan Pekarangan & Industri Rumah Tangga */}
              <h3 className="font-bold text-[8.5px] uppercase bg-slate-100 border border-black px-1.5 py-0.5 mb-0.5">
                04. PEMANFAATAN PEKARANGAN (PTP), INDUSTRI RUMAH TANGGA &amp; KEGIATAN WARGA
              </h3>
              <div className="border border-black p-2 mb-2 text-[8.5px] font-sans space-y-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <p><strong>PTP Peternakan:</strong> {printingItem.ptpPeternakan ? 'Ya (Aktif)' : 'Tidak'}</p>
                    <p><strong>PTP Perikanan:</strong> {printingItem.ptpPerikanan ? 'Ya (Aktif)' : 'Tidak'}</p>
                    <p><strong>PTP Warung Hidup:</strong> {printingItem.ptpWarungHidup ? 'Ya (Aktif)' : 'Tidak'}</p>
                    <p><strong>PTP Tanaman Obat (TOGA):</strong> {printingItem.ptpToga || (printingItem.punyaToga || 0) > 0 ? 'Ya (Aktif)' : 'Tidak'}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p><strong>Industri Rumah Tangga Pangan:</strong> {printingItem.industriPangan ? 'Ada (Aktif)' : 'Tidak Ada'}</p>
                    <p><strong>Industri Rumah Tangga Sandang:</strong> {printingItem.industriSandang ? 'Ada (Aktif)' : 'Tidak Ada'}</p>
                    <p><strong>Kegiatan Posyandu Balita / Lansia:</strong> {printingItem.kegiatanPosyandu !== false ? 'Aktif' : 'Tidak Aktif'}</p>
                    <p><strong>Kegiatan UP2K / Koperasi:</strong> {printingItem.kegiatanUp2kKoperasi ? 'Aktif' : 'Tidak Aktif'}</p>
                  </div>
                </div>
                {printingItem.kegiatanUtama && (
                  <div className="pt-1 border-t border-dashed border-slate-300">
                    <p><strong>Catatan Program / Kegiatan Pokok:</strong> &ldquo;{printingItem.kegiatanUtama}&rdquo;</p>
                  </div>
                )}
              </div>

              {/* 05. Daftar Anggota Keluarga / Kepala Rumah Tangga (KRT) */}
              <h3 className="font-bold text-[8.5px] uppercase bg-slate-100 border border-black px-1.5 py-0.5 mb-0.5">
                05. DAFTAR ANGGOTA KELUARGA / KEPALA RUMAH TANGGA (KRT)
              </h3>
              {Array.isArray(printingItem.daftarKkAnggota) && printingItem.daftarKkAnggota.length > 0 ? (
                <table className="w-full border-collapse border border-black text-[8px] font-sans mb-2 table-compact">
                  <thead>
                    <tr className="bg-slate-100 font-bold">
                      <th className="border border-black p-0.5 text-center" style={{ width: '26px' }}>No</th>
                      <th className="border border-black p-0.5 text-left" style={{ width: '28%' }}>Nama Kepala Keluarga (KRT)</th>
                      <th className="border border-black p-0.5 text-center" style={{ width: '16%' }}>Nomor KK</th>
                      <th className="border border-black p-0.5 text-center" style={{ width: '16%' }}>NIK</th>
                      <th className="border border-black p-0.5 text-left" style={{ width: '32%' }}>Alamat Domisili</th>
                      <th className="border border-black p-0.5 text-center" style={{ width: '8%' }}>Jiwa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printingItem.daftarKkAnggota.map((m, idx) => (
                      <tr key={m.id || idx}>
                        <td className="border border-black p-0.5 text-center">{idx + 1}</td>
                        <td className="border border-black p-0.5 font-bold text-left">{formatNamaEyd(m.namaKepalaKeluarga)}</td>
                        <td className="border border-black p-0.5 font-mono text-center text-[7.5px]">{m.nomorKk || '-'}</td>
                        <td className="border border-black p-0.5 font-mono text-center text-[7.5px]">{m.nik || '-'}</td>
                        <td className="border border-black p-0.5 text-left text-[8px]">{formatAlamatEyd(m.alamat)}</td>
                        <td className="border border-black p-0.5 text-center font-bold">{m.jumlahJiwa || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="border border-black p-2 mb-2 text-[8.5px] font-sans">
                  <p><strong>Kepala Rumah Tangga (KRT) Terdata:</strong> {formatNamaEyd(printingItem.namaKrt) || '-'}</p>
                  <p><strong>Total Akumulasi Jiwa:</strong> {printingItem.jumlahJiwa || 0} Jiwa ({printingItem.jumlahLakiLaki || 0} Laki-laki / {printingItem.jumlahPerempuan || 0} Perempuan)</p>
                </div>
              )}

              {/* Tanda Tangan Resmi Pengesahan */}
              <div className="mt-4 text-[8.5px] font-sans avoid-break">
                <div className="text-right mb-2">
                  <p className="font-semibold">{formatTanggalResmiIndonesia()}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="font-bold">Mengetahui,</p>
                    <p className="text-[8px] text-slate-700">Ketua TP-PKK Kelurahan Mangga</p>
                    <div className="h-10"></div>
                    <p className="font-bold underline">( .................................................. )</p>
                  </div>
                  <div>
                    <p className="font-bold">Kader Pendata / Pelapor,</p>
                    <p className="text-[8px] text-slate-700">{resolveItemLingkungan(printingItem, currentUser)}</p>
                    <div className="h-10"></div>
                    <p className="font-bold underline">({formatNamaEyd(printingItem.createdByName) || '..................................................'})</p>
                  </div>
                  <div>
                    <p className="font-bold">Ketua Kelompok Dasa Wisma,</p>
                    <p className="text-[8px] text-slate-700">{formatKelompokEyd(printingItem.namaKelompok)}</p>
                    <div className="h-10"></div>
                    <p className="font-bold underline">({formatNamaEyd(printingItem.namaKetuaDawis) || '..................................................'})</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
