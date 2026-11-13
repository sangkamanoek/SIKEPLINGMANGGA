import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Share2,
  Trash2,
  Edit3,
  CheckCircle2,
  Home,
  Check,
  RefreshCw,
  X,
  Phone,
  Info,
  FileSpreadsheet,
  FileText,
  Printer,
  Wand2,
  AlertCircle,
  Download,
  Eye,
  Droplets,
  Sprout,
  UserPlus,
} from 'lucide-react';
import {
  UserAccount,
  PkkDasaWismaItem,
  DasaWismaKkAnggota,
} from '../types';
import {
  subscribeDasaWisma,
  saveDasaWisma,
  deleteDasaWisma,
  getLocalDasaWismaList,
  fetchDasaWismaFromFirestore,
} from '../lib/pkkDasaWismaService';
import { PKK_LOGO_BASE64 } from '../assets/logoPkkBase64';
import { KopSuratPkk } from './KopSuratPkk';
import { VirtualList } from './VirtualList';
import { printOfficialDocument, downloadPdfDocument } from '../utils/printHelper';

interface PkkDasaWismaViewProps {
  currentUser: UserAccount;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const SUMBER_AIR_BERSIH_OPTIONS = [
  'PDAM / Air Perpipaan',
  'PDAM Tirtanadi',
  'Sumur Bor / Pompa',
  'Sumur Gali',
  'Mata Air',
  'Sungai / Hujan / Lainnya',
];

const SUMBER_AIR_MINUM_OPTIONS = [
  'Depot Isi Ulang',
  'PDAM / Air Masak',
  'Air Kemasan',
  'Sumur / Air Masak',
  'Lainnya',
];

const KRITERIA_RUMAH_OPTIONS = [
  'Layak Huni',
  'Kurang Layak',
  'Sehat',
  'Kurang Sehat',
];

const MAKANAN_POKOK_OPTIONS = ['Beras', 'Non Beras'];

const STIKER_P4K_OPTIONS = ['Menempel', 'Tidak Menempel'];

export const PkkDasaWismaView: React.FC<PkkDasaWismaViewProps> = ({
  currentUser,
  onShowToast,
}) => {
  const isSuperAdmin = currentUser.role === 'super_admin';
  const isPkkKelurahan =
    currentUser.role === 'ketua_pkk_kelurahan' ||
    currentUser.role === 'sekretaris_pkk' ||
    currentUser.role === 'ketua_pokja';
  const isLingkunganRestricted = !isSuperAdmin && !isPkkKelurahan;

  const defaultLingkungan = isLingkunganRestricted
    ? String(currentUser.nomorLingkungan || 1)
    : currentUser.nomorLingkungan
    ? String(currentUser.nomorLingkungan)
    : 'all';

  const [selectedLingkungan, setSelectedLingkungan] = useState<string>(defaultLingkungan);
  const [items, setItems] = useState<PkkDasaWismaItem[]>(() => getLocalDasaWismaList());
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshingCloud, setIsRefreshingCloud] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PkkDasaWismaItem | null>(null);
  const [detailItem, setDetailItem] = useState<PkkDasaWismaItem | null>(null);
  const [copiedWa, setCopiedWa] = useState(false);

  useEffect(() => {
    setSelectedLingkungan(defaultLingkungan);
  }, [defaultLingkungan, currentUser.id]);

  // ==========================================
  // FORM STATE — Diselaraskan 100% dgn Firestore
  // ==========================================
  const [formNamaKelompok, setFormNamaKelompok] = useState('');
  const [formLingkungan, setFormLingkungan] = useState<number>(
    currentUser.nomorLingkungan || 1
  );
  const [formNamaKetuaDawis, setFormNamaKetuaDawis] = useState('');
  const [formNamaKrt, setFormNamaKrt] = useState('');
  const [formTelepon, setFormTelepon] = useState('');
  const [formRtRw, setFormRtRw] = useState('00/00');

  // Daftar KK Anggota
  const [formDaftarKk, setFormDaftarKk] = useState<DasaWismaKkAnggota[]>([]);
  const [newKkNama, setNewKkNama] = useState('');
  const [newKkAlamat, setNewKkAlamat] = useState('');
  const [newKkLaki, setNewKkLaki] = useState('1');
  const [newKkPerempuan, setNewKkPerempuan] = useState('1');

  // Statistik Keluarga & Demografi
  const [formJumlahKk, setFormJumlahKk] = useState<string>('0');
  const [formJumlahJiwa, setFormJumlahJiwa] = useState<string>('0');
  const [formJumlahLakiLaki, setFormJumlahLakiLaki] = useState<string>('0');
  const [formJumlahPerempuan, setFormJumlahPerempuan] = useState<string>('0');

  const [formJumlahBumil, setFormJumlahBumil] = useState<string>('0');
  const [formJumlahBusui, setFormJumlahBusui] = useState<string>('0');
  const [formJumlahNifas, setFormJumlahNifas] = useState<string>('0');
  const [formJumlahBalita, setFormJumlahBalita] = useState<string>('0');
  const [formJumlahLansia, setFormJumlahLansia] = useState<string>('0');

  const [formJumlahPus, setFormJumlahPus] = useState<string>('0');
  const [formJumlahWus, setFormJumlahWus] = useState<string>('0');
  const [formJumlahAkseptorKb, setFormJumlahAkseptorKb] = useState<string>('0');
  const [formJumlahButaAksara, setFormJumlahButaAksara] = useState<string>('0');

  // Sanitasi, Rumah & Kebutuhan Pokok
  const [formPunyaJambanSehat, setFormPunyaJambanSehat] = useState<string>('0');
  const [formPunyaSpal, setFormPunyaSpal] = useState<string>('0');
  const [formPunyaToga, setFormPunyaToga] = useState<string>('0');
  const [formKriteriaRumah, setFormKriteriaRumah] = useState<string>('Layak Huni');
  const [formSumberAirBersih, setFormSumberAirBersih] = useState<string>('PDAM / Air Perpipaan');
  const [formSumberAirMinum, setFormSumberAirMinum] = useState<string>('Depot Isi Ulang');
  const [formMakananPokok, setFormMakananPokok] = useState<string>('Beras');
  const [formStikerP4k, setFormStikerP4k] = useState<string>('Tidak Menempel');

  // Program / Boolean Flags
  const [formKegiatanPosyandu, setFormKegiatanPosyandu] = useState<boolean>(true);
  const [formKegiatanUp2kKoperasi, setFormKegiatanUp2kKoperasi] = useState<boolean>(false);
  const [formIndustriPangan, setFormIndustriPangan] = useState<boolean>(false);
  const [formIndustriSandang, setFormIndustriSandang] = useState<boolean>(false);
  const [formPtpToga, setFormPtpToga] = useState<boolean>(true);
  const [formPtpWarungHidup, setFormPtpWarungHidup] = useState<boolean>(false);
  const [formPtpPeternakan, setFormPtpPeternakan] = useState<boolean>(false);
  const [formPtpPerikanan, setFormPtpPerikanan] = useState<boolean>(false);

  const [formKegiatanUtama, setFormKegiatanUtama] = useState('');
  const [formCatatan, setFormCatatan] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Raw Field Notes (OCR / Text) Transformation States
  const [isRawModalOpen, setIsRawModalOpen] = useState(false);
  const [rawInputText, setRawInputText] = useState('');
  const [rawValidationNotes, setRawValidationNotes] = useState<string[]>([]);
  const [rawParseResult, setRawParseResult] = useState<Partial<PkkDasaWismaItem> | null>(null);

  // Copy Feedback States
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [copiedTable, setCopiedTable] = useState(false);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsub = subscribeDasaWisma((liveItems) => {
      setItems(liveItems);
    });
    return () => unsub();
  }, []);

  const handleRefreshCloud = async () => {
    setIsRefreshingCloud(true);
    try {
      const fresh = await fetchDasaWismaFromFirestore();
      setItems(fresh);
      onShowToast?.(`Berhasil memuat ${fresh.length} data Dasa Wisma dari Firestore.`, 'success');
    } catch {
      onShowToast?.('Gagal memuat ulang data dari Firestore.', 'error');
    } finally {
      setIsRefreshingCloud(false);
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedLingkungan !== 'all') {
        const targetNum = Number(selectedLingkungan);
        if (item.lingkunganNomor !== targetNum) return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const ketua = (item.namaKetuaDawis || item.namaKetua || '').toLowerCase();
        const krt = (item.namaKrt || '').toLowerCase();
        const matchNama = (item.namaKelompok || '').toLowerCase().includes(q);
        const matchRt = (item.rtRw || '').toLowerCase().includes(q);
        const matchKk = Array.isArray(item.daftarKkAnggota)
          ? item.daftarKkAnggota.some(
              (kk) =>
                (kk.namaKepalaKeluarga || '').toLowerCase().includes(q) ||
                (kk.alamat || '').toLowerCase().includes(q)
            )
          : false;
        if (!matchNama && !ketua.includes(q) && !krt.includes(q) && !matchRt && !matchKk) {
          return false;
        }
      }
      return true;
    });
  }, [items, selectedLingkungan, searchTerm]);

  // Aggregate KPI metrics
  const kpiStats = useMemo(() => {
    let totalKk = 0;
    let totalJiwa = 0;
    let totalLakiLaki = 0;
    let totalPerempuan = 0;
    let totalBumil = 0;
    let totalBusui = 0;
    let totalNifas = 0;
    let totalBalita = 0;
    let totalLansia = 0;
    let totalPus = 0;
    let totalWus = 0;
    let totalAkseptorKb = 0;
    let totalButaAksara = 0;
    let totalJamban = 0;
    let totalSpal = 0;
    let totalToga = 0;

    filteredItems.forEach((it) => {
      totalKk += Number(it.jumlahKk) || 0;
      totalJiwa += Number(it.jumlahJiwa) || 0;
      totalLakiLaki += Number(it.jumlahLakiLaki ?? it.jumlahJiwaLaki) || 0;
      totalPerempuan += Number(it.jumlahPerempuan ?? it.jumlahJiwaPerempuan) || 0;
      totalBumil += Number(it.jumlahIbuHamil) || 0;
      totalBusui += Number(it.jumlahIbuMenyusui) || 0;
      totalNifas += Number(it.jumlahIbuNifas) || 0;
      totalBalita += Number(it.jumlahBalita) || 0;
      totalLansia += Number(it.jumlahLansia) || 0;
      totalPus += Number(it.jumlahPus) || 0;
      totalWus += Number(it.jumlahWus) || 0;
      totalAkseptorKb += Number(it.jumlahAkseptorKb) || 0;
      totalButaAksara += Number(it.jumlahButaAksara) || 0;
      totalJamban += Number(it.punyaJambanSehat ?? it.jumlahJambanSehat) || 0;
      totalSpal += Number(it.punyaSpal ?? it.jumlahSpal) || 0;
      totalToga += Number(it.punyaToga ?? it.jumlahPekaranganManfaat) || 0;
    });

    return {
      totalKelompok: filteredItems.length,
      totalKk,
      totalJiwa,
      totalLakiLaki,
      totalPerempuan,
      totalBumil,
      totalBusui,
      totalNifas,
      totalBalita,
      totalLansia,
      totalPus,
      totalWus,
      totalAkseptorKb,
      totalButaAksara,
      totalJamban,
      totalSpal,
      totalToga,
    };
  }, [filteredItems]);

  // Handlers for L / P change with auto Total Jiwa update
  const handleLakiChange = (val: string) => {
    setFormJumlahLakiLaki(val);
    const l = Number(val) || 0;
    const p = Number(formJumlahPerempuan) || 0;
    setFormJumlahJiwa(String(l + p));
  };

  const handlePerempuanChange = (val: string) => {
    setFormJumlahPerempuan(val);
    const l = Number(formJumlahLakiLaki) || 0;
    const p = Number(val) || 0;
    setFormJumlahJiwa(String(l + p));
  };

  // Add KK row to formDaftarKk
  const handleAddKkAnggota = () => {
    if (!newKkNama.trim()) {
      onShowToast?.('Nama Kepala Keluarga wajib diisi', 'error');
      return;
    }
    const l = Number(newKkLaki) || 0;
    const p = Number(newKkPerempuan) || 0;
    const newEntry: DasaWismaKkAnggota = {
      id: `kk_man_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      namaKepalaKeluarga: newKkNama.trim(),
      alamat: newKkAlamat.trim() || '-',
      jumlahLakiLaki: l,
      jumlahPerempuan: p,
      jumlahJiwa: l + p,
      sumberData: 'MANUAL',
    };
    const nextList = [...formDaftarKk, newEntry];
    setFormDaftarKk(nextList);
    setNewKkNama('');
    setNewKkAlamat('');
    setNewKkLaki('1');
    setNewKkPerempuan('1');

    // Automatically sync counts if user hasn't manually diverged or on fresh add
    if (!editingItem || Number(formJumlahKk) === formDaftarKk.length) {
      const totalL = nextList.reduce((acc, x) => acc + (Number(x.jumlahLakiLaki) || 0), 0);
      const totalP = nextList.reduce((acc, x) => acc + (Number(x.jumlahPerempuan) || 0), 0);
      setFormJumlahKk(String(nextList.length));
      setFormJumlahLakiLaki(String(totalL));
      setFormJumlahPerempuan(String(totalP));
      setFormJumlahJiwa(String(totalL + totalP));
    }
  };

  const handleRemoveKkAnggota = (id: string) => {
    const nextList = formDaftarKk.filter((k) => k.id !== id);
    setFormDaftarKk(nextList);
  };

  const handleSyncTotalsFromDaftarKk = () => {
    const totalL = formDaftarKk.reduce((acc, x) => acc + (Number(x.jumlahLakiLaki) || 0), 0);
    const totalP = formDaftarKk.reduce((acc, x) => acc + (Number(x.jumlahPerempuan) || 0), 0);
    setFormJumlahKk(String(formDaftarKk.length));
    setFormJumlahLakiLaki(String(totalL));
    setFormJumlahPerempuan(String(totalP));
    setFormJumlahJiwa(String(totalL + totalP));
    onShowToast?.(
      `Total disinkronkan: ${formDaftarKk.length} KK, ${totalL + totalP} Jiwa (${totalL} L / ${totalP} P)`,
      'info'
    );
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormNamaKelompok('');
    setFormLingkungan(
      selectedLingkungan !== 'all'
        ? Number(selectedLingkungan)
        : currentUser.nomorLingkungan || 1
    );
    setFormNamaKetuaDawis('');
    setFormNamaKrt('');
    setFormTelepon('');
    setFormRtRw('00/00');
    setFormDaftarKk([]);
    setNewKkNama('');
    setNewKkAlamat('');
    setNewKkLaki('1');
    setNewKkPerempuan('1');
    setFormJumlahKk('0');
    setFormJumlahJiwa('0');
    setFormJumlahLakiLaki('0');
    setFormJumlahPerempuan('0');
    setFormJumlahBumil('0');
    setFormJumlahBusui('0');
    setFormJumlahNifas('0');
    setFormJumlahBalita('0');
    setFormJumlahLansia('0');
    setFormJumlahPus('0');
    setFormJumlahWus('0');
    setFormJumlahAkseptorKb('0');
    setFormJumlahButaAksara('0');
    setFormPunyaJambanSehat('0');
    setFormPunyaSpal('0');
    setFormPunyaToga('0');
    setFormKriteriaRumah('Layak Huni');
    setFormSumberAirBersih('PDAM / Air Perpipaan');
    setFormSumberAirMinum('Depot Isi Ulang');
    setFormMakananPokok('Beras');
    setFormStikerP4k('Tidak Menempel');
    setFormKegiatanPosyandu(true);
    setFormKegiatanUp2kKoperasi(false);
    setFormIndustriPangan(false);
    setFormIndustriSandang(false);
    setFormPtpToga(true);
    setFormPtpWarungHidup(false);
    setFormPtpPeternakan(false);
    setFormPtpPerikanan(false);
    setFormKegiatanUtama('Pemanfaatan toga');
    setFormCatatan('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (it: PkkDasaWismaItem) => {
    setEditingItem(it);
    setFormNamaKelompok(it.namaKelompok || '');
    setFormLingkungan(it.lingkunganNomor || 1);
    setFormNamaKetuaDawis(it.namaKetuaDawis || it.namaKetua || '');
    setFormNamaKrt(it.namaKrt || '');
    setFormTelepon(it.teleponKetua || '');
    setFormRtRw(it.rtRw || '00/00');
    setFormDaftarKk(Array.isArray(it.daftarKkAnggota) ? it.daftarKkAnggota : []);
    setNewKkNama('');
    setNewKkAlamat('');
    setNewKkLaki('1');
    setNewKkPerempuan('1');
    setFormJumlahKk(String(it.jumlahKk ?? 0));
    setFormJumlahJiwa(String(it.jumlahJiwa ?? 0));
    setFormJumlahLakiLaki(String(it.jumlahLakiLaki ?? it.jumlahJiwaLaki ?? 0));
    setFormJumlahPerempuan(String(it.jumlahPerempuan ?? it.jumlahJiwaPerempuan ?? 0));
    setFormJumlahBumil(String(it.jumlahIbuHamil ?? 0));
    setFormJumlahBusui(String(it.jumlahIbuMenyusui ?? 0));
    setFormJumlahNifas(String(it.jumlahIbuNifas ?? 0));
    setFormJumlahBalita(String(it.jumlahBalita ?? 0));
    setFormJumlahLansia(String(it.jumlahLansia ?? 0));
    setFormJumlahPus(String(it.jumlahPus ?? 0));
    setFormJumlahWus(String(it.jumlahWus ?? 0));
    setFormJumlahAkseptorKb(String(it.jumlahAkseptorKb ?? 0));
    setFormJumlahButaAksara(String(it.jumlahButaAksara ?? 0));
    setFormPunyaJambanSehat(String(it.punyaJambanSehat ?? it.jumlahJambanSehat ?? 0));
    setFormPunyaSpal(String(it.punyaSpal ?? it.jumlahSpal ?? 0));
    setFormPunyaToga(String(it.punyaToga ?? it.jumlahPekaranganManfaat ?? 0));
    setFormKriteriaRumah(it.kriteriaRumah || 'Layak Huni');
    setFormSumberAirBersih(it.sumberAirBersih || 'PDAM / Air Perpipaan');
    setFormSumberAirMinum(it.sumberAirMinum || 'Depot Isi Ulang');
    setFormMakananPokok(it.makananPokok || 'Beras');
    setFormStikerP4k(it.stikerP4k || 'Tidak Menempel');
    setFormKegiatanPosyandu(Boolean(it.kegiatanPosyandu));
    setFormKegiatanUp2kKoperasi(Boolean(it.kegiatanUp2kKoperasi));
    setFormIndustriPangan(Boolean(it.industriPangan));
    setFormIndustriSandang(Boolean(it.industriSandang));
    setFormPtpToga(Boolean(it.ptpToga));
    setFormPtpWarungHidup(Boolean(it.ptpWarungHidup));
    setFormPtpPeternakan(Boolean(it.ptpPeternakan));
    setFormPtpPerikanan(Boolean(it.ptpPerikanan));
    setFormKegiatanUtama(it.kegiatanUtama || '');
    setFormCatatan(it.catatan || '');
    setIsModalOpen(true);
  };

  // Save Modal
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNamaKelompok.trim()) {
      onShowToast?.('Nama Kelompok Dasa Wisma wajib diisi', 'error');
      return;
    }
    if (!formNamaKetuaDawis.trim()) {
      onShowToast?.('Nama Ketua Dasa Wisma wajib diisi', 'error');
      return;
    }

    const l = Number(formJumlahLakiLaki) || 0;
    const p = Number(formJumlahPerempuan) || 0;
    const totalJ = Number(formJumlahJiwa) || l + p;
    const bumil = Number(formJumlahBumil) || 0;
    let wus = Number(formJumlahWus) || 0;
    if (bumil > 0 && wus < bumil) {
      wus = Math.max(wus, bumil, 1);
    }

    const lingkNum = Number(formLingkungan) || 1;
    const jamban = Number(formPunyaJambanSehat) || 0;
    const spal = Number(formPunyaSpal) || 0;
    const toga = Number(formPunyaToga) || 0;

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const payload: PkkDasaWismaItem = {
        id: editingItem
          ? editingItem.id
          : `dawis_${Date.now()}`,
        namaKelompok: formNamaKelompok.trim(),
        lingkunganNomor: lingkNum,
        lingkunganNama: `Lingkungan ${lingkNum}`,
        namaKetuaDawis: formNamaKetuaDawis.trim(),
        namaKetua: formNamaKetuaDawis.trim(),
        namaKrt: formNamaKrt.trim(),
        teleponKetua: formTelepon.trim(),
        rtRw: formRtRw.trim() || '00/00',
        createdByName: editingItem?.createdByName || currentUser.nama || currentUser.jabatan,
        daftarKkAnggota: formDaftarKk,
        jumlahKk: Number(formJumlahKk) || 0,
        jumlahJiwa: totalJ,
        jumlahLakiLaki: l,
        jumlahPerempuan: p,
        jumlahJiwaLaki: l,
        jumlahJiwaPerempuan: p,
        jumlahIbuHamil: bumil,
        jumlahIbuMenyusui: Number(formJumlahBusui) || 0,
        jumlahIbuNifas: Number(formJumlahNifas) || 0,
        jumlahBalita: Number(formJumlahBalita) || 0,
        jumlahLansia: Number(formJumlahLansia) || 0,
        jumlahPus: Number(formJumlahPus) || 0,
        jumlahWus: wus,
        jumlahAkseptorKb: Number(formJumlahAkseptorKb) || 0,
        jumlahButaAksara: Number(formJumlahButaAksara) || 0,
        punyaJambanSehat: jamban,
        punyaSpal: spal,
        punyaToga: toga,
        jumlahJambanSehat: jamban,
        jumlahSpal: spal,
        jumlahPekaranganManfaat: toga,
        kriteriaRumah: formKriteriaRumah,
        sumberAirBersih: formSumberAirBersih,
        sumberAirMinum: formSumberAirMinum,
        makananPokok: formMakananPokok,
        stikerP4k: formStikerP4k,
        kegiatanPosyandu: formKegiatanPosyandu,
        kegiatanUp2kKoperasi: formKegiatanUp2kKoperasi,
        industriPangan: formIndustriPangan,
        industriSandang: formIndustriSandang,
        ptpToga: formPtpToga,
        ptpWarungHidup: formPtpWarungHidup,
        ptpPeternakan: formPtpPeternakan,
        ptpPerikanan: formPtpPerikanan,
        kegiatanUtama: formKegiatanUtama.trim(),
        catatan: formCatatan.trim(),
        createdAt: editingItem?.createdAt || now,
        updatedAt: now,
      };

      await saveDasaWisma(payload);
      setIsModalOpen(false);
      onShowToast?.(
        editingItem
          ? 'Data Dasa Wisma berhasil diperbarui ke Firestore!'
          : 'Kelompok Dasa Wisma baru berhasil disimpan ke Firestore!',
        'success'
      );
    } catch (err) {
      console.error(err);
      onShowToast?.('Gagal menyimpan data Dasa Wisma', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Action
  const handleDelete = async (id: string, nama: string) => {
    if (window.confirm(`Yakin ingin menghapus kelompok "${nama}"?`)) {
      try {
        await deleteDasaWisma(id);
        onShowToast?.(`Kelompok "${nama}" berhasil dihapus`, 'info');
      } catch (err) {
        console.error(err);
        onShowToast?.('Gagal menghapus data', 'error');
      }
    }
  };

  // Copy WhatsApp Summary
  const handleCopyWa = useCallback(() => {
    const lingkLabel =
      selectedLingkungan === 'all'
        ? 'Se-Kelurahan Mangga (24 Lingkungan)'
        : `Lingkungan ${selectedLingkungan}`;

    let text = `*REKAPITULASI DASA WISMA TP-PKK KELURAHAN MANGGA*\n`;
    text += `Wilayah: ${lingkLabel}\n`;
    text += `Waktu Cetak: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}\n\n`;
    text += `*RINGKASAN INDIKATOR UTAMA:*\n`;
    text += `• Total Kelompok Dasa Wisma: ${kpiStats.totalKelompok} Kelompok\n`;
    text += `• Total KK Binaan: ${kpiStats.totalKk} KK\n`;
    text += `• Total Jiwa Binaan: ${kpiStats.totalJiwa} Jiwa (L: ${kpiStats.totalLakiLaki} / P: ${kpiStats.totalPerempuan})\n`;
    text += `• Ibu Hamil: ${kpiStats.totalBumil} | Menyusui: ${kpiStats.totalBusui} | Nifas: ${kpiStats.totalNifas}\n`;
    text += `• Balita: ${kpiStats.totalBalita} | Lansia: ${kpiStats.totalLansia} | Akseptor KB: ${kpiStats.totalAkseptorKb}\n`;
    text += `• Jamban Sehat: ${kpiStats.totalJamban} | SPAL: ${kpiStats.totalSpal} | TOGA: ${kpiStats.totalToga}\n\n`;

    text += `*DAFTAR KELOMPOK:*\n`;
    filteredItems.forEach((it, idx) => {
      const ketua = it.namaKetuaDawis || it.namaKetua || '-';
      const l = it.jumlahLakiLaki ?? it.jumlahJiwaLaki ?? 0;
      const p = it.jumlahPerempuan ?? it.jumlahJiwaPerempuan ?? 0;
      text += `${idx + 1}. *${it.namaKelompok}* (Lingk. ${it.lingkunganNomor})\n`;
      text += `   - Ketua Dawis: ${ketua}${it.namaKrt ? ` | KRT: ${it.namaKrt}` : ''}\n`;
      text += `   - KK: ${it.jumlahKk || 0} | Jiwa: ${it.jumlahJiwa || 0} (L:${l}/P:${p}) | Balita: ${it.jumlahBalita || 0} | Lansia: ${it.jumlahLansia || 0}\n`;
      if (it.kegiatanUtama) text += `   - Kegiatan: ${it.kegiatanUtama}\n`;
    });

    text += `\n#PKKKELURAHANMANGGA #DASAWISMA`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedWa(true);
      setTimeout(() => setCopiedWa(false), 3000);
      onShowToast?.('Rangkuman WhatsApp berhasil disalin ke clipboard!', 'success');
    });
  }, [selectedLingkungan, kpiStats, filteredItems, onShowToast]);

  // Copy Standard CSV format
  const handleCopyCsv = useCallback(() => {
    let csv =
      'No,Nama Kelompok,Ketua Dasa Wisma,Nama KRT,Lingkungan,RT/RW,Jml KK,Laki-Laki,Perempuan,Total Jiwa,PUS,WUS,Akseptor KB,Ibu Hamil,Ibu Menyusui,Ibu Nifas,Balita,Lansia,Air Bersih,Air Minum,Makanan Pokok,Jamban Sehat,SPAL,TOGA,Kriteria Rumah,Stiker P4K,Kegiatan Utama\n';
    filteredItems.forEach((it, idx) => {
      const ketua = (it.namaKetuaDawis || it.namaKetua || '-').replace(/"/g, '""');
      const krt = (it.namaKrt || '-').replace(/"/g, '""');
      const l = it.jumlahLakiLaki ?? it.jumlahJiwaLaki ?? 0;
      const p = it.jumlahPerempuan ?? it.jumlahJiwaPerempuan ?? 0;
      const total = it.jumlahJiwa ?? l + p;
      const jamban = it.punyaJambanSehat ?? it.jumlahJambanSehat ?? 0;
      const spal = it.punyaSpal ?? it.jumlahSpal ?? 0;
      const toga = it.punyaToga ?? it.jumlahPekaranganManfaat ?? 0;
      const ket = (it.kegiatanUtama || it.catatan || '-').replace(/"/g, '""');

      csv += `${idx + 1},"${it.namaKelompok}","${ketua}","${krt}",Lingk. ${it.lingkunganNomor},"${it.rtRw || '-'}",${it.jumlahKk || 0},${l},${p},${total},${it.jumlahPus || 0},${it.jumlahWus || 0},${it.jumlahAkseptorKb || 0},${it.jumlahIbuHamil || 0},${it.jumlahIbuMenyusui || 0},${it.jumlahIbuNifas || 0},${it.jumlahBalita || 0},${it.jumlahLansia || 0},"${it.sumberAirBersih || '-'}","${it.sumberAirMinum || '-'}","${it.makananPokok || '-'}",${jamban},${spal},${toga},"${it.kriteriaRumah || '-'}","${it.stikerP4k || '-'}","${ket}"\n`;
    });

    navigator.clipboard.writeText(csv).then(() => {
      setCopiedCsv(true);
      setTimeout(() => setCopiedCsv(false), 3000);
      onShowToast?.('Format CSV siap paste ke Excel/Google Sheets berhasil disalin!', 'success');
    });
  }, [filteredItems, onShowToast]);

  // Copy Standard Markdown Table
  const handleCopyTable = useCallback(() => {
    let md =
      '| No | Kelompok / Ketua Dawis | KRT | Lingk | KK | L/P/Total | PUS/WUS/KB | Bumil/Busui/Nifas | Balita | Lansia | Jamban/SPAL/TOGA | Kriteria / P4K |\n';
    md +=
      '|:--:|:------------------------|:----|:-----:|:--:|:---------:|:----------:|:-----------------:|:------:|:------:|:----------------:|:---------------|\n';
    filteredItems.forEach((it, idx) => {
      const ketua = it.namaKetuaDawis || it.namaKetua || '-';
      const l = it.jumlahLakiLaki ?? it.jumlahJiwaLaki ?? 0;
      const p = it.jumlahPerempuan ?? it.jumlahJiwaPerempuan ?? 0;
      const total = it.jumlahJiwa ?? l + p;
      const jamban = it.punyaJambanSehat ?? it.jumlahJambanSehat ?? 0;
      const spal = it.punyaSpal ?? it.jumlahSpal ?? 0;
      const toga = it.punyaToga ?? it.jumlahPekaranganManfaat ?? 0;

      md += `| ${idx + 1} | ${it.namaKelompok} (${ketua}) | ${it.namaKrt || '-'} | ${it.lingkunganNomor} | ${it.jumlahKk || 0} | ${l}/${p}/${total} | ${it.jumlahPus || 0}/${it.jumlahWus || 0}/${it.jumlahAkseptorKb || 0} | ${it.jumlahIbuHamil || 0}/${it.jumlahIbuMenyusui || 0}/${it.jumlahIbuNifas || 0} | ${it.jumlahBalita || 0} | ${it.jumlahLansia || 0} | ${jamban}/${spal}/${toga} | ${it.kriteriaRumah || '-'} (${it.stikerP4k || '-'}) |\n`;
    });

    navigator.clipboard.writeText(md).then(() => {
      setCopiedTable(true);
      setTimeout(() => setCopiedTable(false), 3000);
      onShowToast?.('Format Tabel Markdown berhasil disalin ke clipboard!', 'success');
    });
  }, [filteredItems, onShowToast]);

  // Parse Raw Field Notes
  const handleParseRawNotes = () => {
    if (!rawInputText.trim()) {
      onShowToast?.('Silakan masukkan catatan lapangan mentah terlebih dahulu', 'error');
      return;
    }

    const text = rawInputText;
    const notes: string[] = [];

    let lingk = currentUser.nomorLingkungan || 1;
    const lingkMatch = text.match(/(?:lingkungan|lingk\.?|lingk)\s*[:=]?\s*(\d{1,2})/i);
    if (lingkMatch) {
      lingk = parseInt(lingkMatch[1], 10);
      notes.push(`Wilayah terdeteksi: Lingkungan ${lingk}`);
    }

    let kelompok = '';
    const kelompokMatch = text.match(/(?:dasa\s*wisma|dawis|nama\s*kelompok|kelompok)\s*[:=]?\s*([^\n,]+)/i);
    if (kelompokMatch) {
      kelompok = kelompokMatch[1].trim();
    } else {
      kelompok = `Dasa Wisma Lingkungan ${lingk}`;
      notes.push(`[Perlu Konfirmasi] Nama kelompok: ${kelompok}`);
    }

    let ketua = '';
    const ketuaMatch = text.match(/(?:ketua|nama\s*ketua|kader)\s*[:=]?\s*([^\n,]+)/i);
    if (ketuaMatch) {
      ketua = ketuaMatch[1].trim();
    } else {
      ketua = '[Perlu Konfirmasi]';
      notes.push('[Perlu Konfirmasi] Nama ketua belum terdata.');
    }

    let telp = '';
    const telpMatch = text.match(/(?:wa|hp|telepon|telp|kontak)\s*[:=]?\s*([0-9\-\+\s]{8,15})/i);
    if (telpMatch) {
      telp = telpMatch[1].replace(/[^\d+]/g, '');
    }

    const kkMatch = text.match(/(?:kk|kepala\s*keluarga)\s*[:=]?\s*(\d+)/i);
    const kk = kkMatch ? parseInt(kkMatch[1], 10) : 10;

    const lakiMatch = text.match(/(?:laki|pria|l)\s*[:=]?\s*(\d+)/i);
    const peremMatch = text.match(/(?:perempuan|wanita|p)\s*[:=]?\s*(\d+)/i);
    const totalJiwaMatch = text.match(/(?:total\s*jiwa|jiwa|warga)\s*[:=]?\s*(\d+)/i);

    const l = lakiMatch ? parseInt(lakiMatch[1], 10) : 0;
    const p = peremMatch ? parseInt(peremMatch[1], 10) : 0;
    let totalJiwa = totalJiwaMatch ? parseInt(totalJiwaMatch[1], 10) : 0;

    if (l + p > 0) {
      if (totalJiwa > 0 && totalJiwa !== l + p) {
        notes.push(`[Validasi Jumlah]: Total (${totalJiwa}) dikoreksi menjadi L (${l}) + P (${p}) = ${l + p}`);
      }
      totalJiwa = l + p;
    }

    const bumilMatch = text.match(/(?:bumil|ibu\s*hamil|hamil)\s*[:=]?\s*(\d+)/i);
    const bumil = bumilMatch ? parseInt(bumilMatch[1], 10) : 0;

    const busuiMatch = text.match(/(?:busui|ibu\s*menyusui|menyusui)\s*[:=]?\s*(\d+)/i);
    const busui = busuiMatch ? parseInt(busuiMatch[1], 10) : 0;

    const balitaMatch = text.match(/(?:balita|bayi|anak)\s*[:=]?\s*(\d+)/i);
    const balita = balitaMatch ? parseInt(balitaMatch[1], 10) : 0;

    const lansiaMatch = text.match(/(?:lansia|manula|orang\s*tua)\s*[:=]?\s*(\d+)/i);
    const lansia = lansiaMatch ? parseInt(lansiaMatch[1], 10) : 0;

    const pusMatch = text.match(/(?:pus|pasangan\s*usia\s*subur)\s*[:=]?\s*(\d+)/i);
    const pus = pusMatch ? parseInt(pusMatch[1], 10) : 0;

    const wusMatch = text.match(/(?:wus|wanita\s*usia\s*subur)\s*[:=]?\s*(\d+)/i);
    let wus = wusMatch ? parseInt(wusMatch[1], 10) : 0;

    if (bumil > 0 && wus < bumil) {
      wus = Math.max(wus, bumil, 1);
      notes.push(`[Validasi Logika]: Ditemukan ${bumil} Ibu Hamil, maka WUS disesuaikan menjadi ${wus}.`);
    }

    let air = 'PDAM / Air Perpipaan';
    if (/sumur/i.test(text)) air = 'Sumur Bor / Pompa';
    else if (/mata\s*air/i.test(text)) air = 'Mata Air';
    else if (/sungai|hujan/i.test(text)) air = 'Sungai / Hujan / Lainnya';

    const jambanMatch = text.match(/(?:jamban|wc|toilet)\s*[:=]?\s*(\d+|ada|sehat|ya)/i);
    let jamban = kk;
    if (jambanMatch) {
      const val = jambanMatch[1].toLowerCase();
      if (/\d+/.test(val)) jamban = parseInt(val, 10);
      else if (val.includes('tidak')) jamban = 0;
    }

    const spalMatch = text.match(/(?:spal|limbah)\s*[:=]?\s*(\d+|ada|ya)/i);
    let spal = kk;
    if (spalMatch && /tidak/i.test(spalMatch[1])) spal = 0;

    let kriteriaRumah = 'Layak Huni';
    if (/kurang\s*(?:sehat|layak)|tidak\s*sehat/i.test(text)) {
      kriteriaRumah = 'Kurang Layak';
    }

    const result: Partial<PkkDasaWismaItem> = {
      namaKelompok: kelompok,
      lingkunganNomor: lingk,
      lingkunganNama: `Lingkungan ${lingk}`,
      namaKetuaDawis: ketua,
      namaKetua: ketua,
      teleponKetua: telp,
      jumlahKk: kk,
      jumlahJiwa: totalJiwa,
      jumlahLakiLaki: l,
      jumlahPerempuan: p,
      jumlahIbuHamil: bumil,
      jumlahIbuMenyusui: busui,
      jumlahBalita: balita,
      jumlahLansia: lansia,
      jumlahPus: pus,
      jumlahWus: wus,
      punyaJambanSehat: jamban,
      punyaSpal: spal,
      sumberAirBersih: air,
      kriteriaRumah,
      catatan: `Hasil verifikasi data kader PKK - ${new Date().toLocaleDateString('id-ID')}`,
    };

    setRawParseResult(result);
    setRawValidationNotes(notes);
    onShowToast?.('Data mentah berhasil diproses & diverifikasi!', 'info');
  };

  const handleApplyParsedToForm = () => {
    if (!rawParseResult) return;
    setEditingItem(null);
    setFormNamaKelompok(rawParseResult.namaKelompok || '');
    setFormLingkungan(rawParseResult.lingkunganNomor || 1);
    setFormNamaKetuaDawis(
      rawParseResult.namaKetuaDawis === '[Perlu Konfirmasi]' ? '' : rawParseResult.namaKetuaDawis || ''
    );
    setFormNamaKrt('');
    setFormTelepon(rawParseResult.teleponKetua || '');
    setFormRtRw('00/00');
    setFormDaftarKk([]);
    setFormJumlahKk(String(rawParseResult.jumlahKk ?? 0));
    setFormJumlahJiwa(String(rawParseResult.jumlahJiwa ?? 0));
    setFormJumlahLakiLaki(String(rawParseResult.jumlahLakiLaki ?? 0));
    setFormJumlahPerempuan(String(rawParseResult.jumlahPerempuan ?? 0));
    setFormJumlahBumil(String(rawParseResult.jumlahIbuHamil ?? 0));
    setFormJumlahBusui(String(rawParseResult.jumlahIbuMenyusui ?? 0));
    setFormJumlahNifas('0');
    setFormJumlahBalita(String(rawParseResult.jumlahBalita ?? 0));
    setFormJumlahLansia(String(rawParseResult.jumlahLansia ?? 0));
    setFormJumlahPus(String(rawParseResult.jumlahPus ?? 0));
    setFormJumlahWus(String(rawParseResult.jumlahWus ?? 0));
    setFormJumlahAkseptorKb('0');
    setFormJumlahButaAksara('0');
    setFormPunyaJambanSehat(String(rawParseResult.punyaJambanSehat ?? 0));
    setFormPunyaSpal(String(rawParseResult.punyaSpal ?? 0));
    setFormPunyaToga('0');
    setFormSumberAirBersih(rawParseResult.sumberAirBersih || 'PDAM / Air Perpipaan');
    setFormSumberAirMinum('Depot Isi Ulang');
    setFormMakananPokok('Beras');
    setFormStikerP4k('Tidak Menempel');
    setFormKriteriaRumah(rawParseResult.kriteriaRumah || 'Layak Huni');
    setFormCatatan(rawParseResult.catatan || '');

    setIsRawModalOpen(false);
    setIsModalOpen(true);
    onShowToast?.('Formulir berhasil diisi dari data hasil transformasi!', 'success');
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-pkk-teal text-white shadow-xl p-6 sm:p-8 border border-pkk-dark">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-tosca-100 text-xs font-bold tracking-wide shadow-xs">
              <div className="w-6 h-6 rounded-full bg-white p-0.5 flex items-center justify-center shrink-0">
                <img src={PKK_LOGO_BASE64} alt="Logo PKK" className="w-full h-full object-contain" />
              </div>
              <span>TIM PENGGERAK PKK KELURAHAN MANGGA</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <Users className="w-7 h-7 text-amber-300 shrink-0" />
              <span>Rekapitulasi Dasa Wisma 24 Lingkungan</span>
            </h1>
            <p className="text-xs sm:text-sm text-tosca-100 max-w-2xl leading-relaxed">
              Pendataan kelompok Dasa Wisma lengkap sesuai struktur Firestore: daftar KK anggota, ketua Dasa Wisma, KRT, demografi keluarga, sanitasi (Jamban/SPAL/TOGA), P4K, serta program PKK.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsRawModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer border border-indigo-400/40"
              title="Transformasi catatan mentah lapangan / OCR menjadi data terstruktur"
            >
              <Wand2 className="w-4 h-4 text-amber-300" />
              <span>Input Data Mentah</span>
            </button>

            <button
              type="button"
              onClick={handleCopyCsv}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer border border-teal-600"
              title="Salin data ke format CSV untuk Excel / Google Sheets"
            >
              {copiedCsv ? <Check className="w-4 h-4 text-emerald-300" /> : <FileSpreadsheet className="w-4 h-4" />}
              <span>{copiedCsv ? 'Tersalin!' : 'CSV Excel'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyTable}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer border border-teal-600"
              title="Salin data ke format Tabel Markdown"
            >
              {copiedTable ? <Check className="w-4 h-4 text-emerald-300" /> : <FileText className="w-4 h-4" />}
              <span>{copiedTable ? 'Tersalin!' : 'Tabel'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyWa}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer border border-emerald-400/40"
              title="Salin rekapitulasi ke format pesan WhatsApp"
            >
              {copiedWa ? <Check className="w-4 h-4 text-white" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedWa ? 'Tersalin!' : 'WA'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                downloadPdfDocument(
                  'lembar-cetak-rekap-dasawisma',
                  `REKAP_DASAWISMA_${selectedLingkungan === 'all' ? 'KELURAHAN_MANGGA' : `LINGK_${selectedLingkungan}`}.pdf`
                )
              }
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer border border-emerald-400/30"
              title="Unduh Rekap Dasa Wisma sebagai file PDF"
            >
              <Download className="w-4 h-4 text-emerald-200" />
              <span>Unduh PDF</span>
            </button>

            <button
              type="button"
              onClick={() =>
                printOfficialDocument(
                  'lembar-cetak-rekap-dasawisma',
                  `REKAP_DASAWISMA_${selectedLingkungan === 'all' ? 'KELURAHAN_MANGGA' : `LINGK_${selectedLingkungan}`}`
                )
              }
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-black text-white font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer border border-slate-700"
              title="Cetak laporan resmi dengan Kop Surat PKK (Margin Kiri 2 cm)"
            >
              <Printer className="w-4 h-4 text-cyan-300" />
              <span>Cetak PDF</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Kelompok</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{kpiStats.totalKelompok}</p>
          <p className="text-[10px] text-teal-700 font-bold mt-1">Dasa Wisma Aktif</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">KK Binaan</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{kpiStats.totalKk.toLocaleString('id-ID')}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-1">Kepala Keluarga</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Jiwa</p>
          <p className="text-2xl font-black text-blue-700 mt-1">{kpiStats.totalJiwa.toLocaleString('id-ID')}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-1">
            L: {kpiStats.totalLakiLaki} • P: {kpiStats.totalPerempuan}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Balita & Bumil</p>
          <p className="text-2xl font-black text-rose-700 mt-1">
            {kpiStats.totalBalita} <span className="text-sm font-bold text-slate-400">/ {kpiStats.totalBumil}</span>
          </p>
          <p className="text-[10px] text-rose-700 font-bold mt-1">
            Busui: {kpiStats.totalBusui} • Nifas: {kpiStats.totalNifas}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lansia & KB</p>
          <p className="text-2xl font-black text-amber-700 mt-1">
            {kpiStats.totalLansia} <span className="text-sm font-bold text-slate-400">/ {kpiStats.totalAkseptorKb}</span>
          </p>
          <p className="text-[10px] text-amber-700 font-bold mt-1">
            PUS: {kpiStats.totalPus} • WUS: {kpiStats.totalWus}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sanitasi & TOGA</p>
          <p className="text-2xl font-black text-teal-700 mt-1">{kpiStats.totalJamban}</p>
          <p className="text-[10px] text-teal-700 font-bold mt-1">
            SPAL: {kpiStats.totalSpal} • TOGA: {kpiStats.totalToga}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-bold text-slate-700 shrink-0">Pilih Lingkungan:</span>
          {isLingkunganRestricted ? (
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-950 font-bold text-xs rounded-xl border border-emerald-200">
              Lingkungan {selectedLingkungan}
            </span>
          ) : (
            <select
              value={selectedLingkungan}
              onChange={(e) => setSelectedLingkungan(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Semua 24 Lingkungan</option>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((num) => (
                <option key={num} value={String(num)}>
                  Lingkungan {num}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari kelompok, ketua, KRT, atau nama KK..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-300 text-xs font-medium rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleRefreshCloud}
            disabled={isRefreshingCloud}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-60"
            title="Tarik ulang data terbaru dari Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCloud ? 'animate-spin' : ''}`} />
            <span>{isRefreshingCloud ? 'Memuat...' : 'Sync Cloud'}</span>
          </button>
        </div>
      </div>

      {/* Dasa Wisma Cards List */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-14 h-14 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-slate-800">
            Belum ada kelompok Dasa Wisma terdaftar
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {selectedLingkungan === 'all'
              ? 'Silakan tambahkan kelompok Dasa Wisma pertama untuk memulai pendataan.'
              : `Belum ada kelompok Dasa Wisma yang dicatat untuk Lingkungan ${selectedLingkungan}. Klik tombol di bawah untuk menambahkan.`}
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-pkk-teal hover:bg-pkk-dark text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Dasa Wisma Sekarang</span>
          </button>
        </div>
      ) : (
        <VirtualList
          items={filteredItems}
          itemHeight={430}
          keyExtractor={(item) => item.id}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          renderItem={(item) => {
            const ketua = item.namaKetuaDawis || item.namaKetua || '-';
            const laki = item.jumlahLakiLaki ?? item.jumlahJiwaLaki ?? 0;
            const perempuan = item.jumlahPerempuan ?? item.jumlahJiwaPerempuan ?? 0;
            const jamban = item.punyaJambanSehat ?? item.jumlahJambanSehat ?? 0;
            const spal = item.punyaSpal ?? item.jumlahSpal ?? 0;
            const toga = item.punyaToga ?? item.jumlahPekaranganManfaat ?? 0;
            const kkMembersCount = Array.isArray(item.daftarKkAnggota) ? item.daftarKkAnggota.length : 0;

            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between relative overflow-hidden group h-full">
                <div className="absolute top-0 right-0 w-20 h-20 bg-teal-50 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />

                <div>
                  <div className="flex items-start justify-between gap-2 mb-3 relative z-10">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-black uppercase tracking-wide mb-1">
                        {item.lingkunganNama || `Lingkungan ${item.lingkunganNomor}`}
                        {item.rtRw ? ` • RT/RW ${item.rtRw}` : ''}
                      </span>
                      <h2 className="text-base font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                        {item.namaKelompok}
                      </h2>
                    </div>
                  </div>

                  {/* Ketua & KRT Info */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Ketua Dawis:</span>
                      <span className="font-bold text-slate-900">{ketua}</span>
                    </div>
                    {item.namaKrt && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Kepala Rumah Tangga:</span>
                        <span className="font-bold text-slate-800">{item.namaKrt}</span>
                      </div>
                    )}
                    {item.teleponKetua && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" /> Kontak:
                        </span>
                        <a
                          href={`https://wa.me/${item.teleponKetua.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-emerald-600 hover:underline"
                        >
                          {item.teleponKetua}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Main Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-2.5">
                    <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-100">
                      <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-tighter">KK</p>
                      <p className="text-sm font-black text-emerald-950 mt-0.5">{item.jumlahKk || 0}</p>
                    </div>
                    <div className="bg-blue-50/60 p-2 rounded-xl border border-blue-100">
                      <p className="text-[10px] text-blue-800 font-bold uppercase tracking-tighter">Jiwa (L/P)</p>
                      <p className="text-sm font-black text-blue-950 mt-0.5">
                        {item.jumlahJiwa || 0}{' '}
                        <span className="text-[10px] font-bold text-blue-700">({laki}/{perempuan})</span>
                      </p>
                    </div>
                    <div className="bg-amber-50/60 p-2 rounded-xl border border-amber-100">
                      <p className="text-[10px] text-amber-800 font-bold uppercase tracking-tighter">Balita / Lansia</p>
                      <p className="text-sm font-black text-amber-950 mt-0.5">
                        {item.jumlahBalita || 0} / {item.jumlahLansia || 0}
                      </p>
                    </div>
                  </div>

                  {/* Sub Stats Row */}
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] mb-2.5">
                    <div className="bg-rose-50/60 p-1.5 rounded-xl border border-rose-100">
                      <span className="text-rose-800 font-bold block">Bumil/Busui/Nifas</span>
                      <span className="font-black text-rose-950">
                        {item.jumlahIbuHamil || 0} / {item.jumlahIbuMenyusui || 0} / {item.jumlahIbuNifas || 0}
                      </span>
                    </div>
                    <div className="bg-indigo-50/60 p-1.5 rounded-xl border border-indigo-100">
                      <span className="text-indigo-800 font-bold block">PUS / WUS / KB</span>
                      <span className="font-black text-indigo-950">
                        {item.jumlahPus || 0} / {item.jumlahWus || 0} / {item.jumlahAkseptorKb || 0}
                      </span>
                    </div>
                    <div className="bg-teal-50/60 p-1.5 rounded-xl border border-teal-100">
                      <span className="text-teal-800 font-bold block">Jamban/SPAL/TOGA</span>
                      <span className="font-black text-teal-950">
                        {jamban} / {spal} / {toga}
                      </span>
                    </div>
                  </div>

                  {/* Sanitation & Living Summary */}
                  <div className="flex flex-wrap gap-1 mb-2.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      Rumah: {item.kriteriaRumah || 'Layak Huni'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 font-bold border border-sky-200">
                      Air: {item.sumberAirBersih || '-'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-800 font-bold border border-cyan-200">
                      P4K: {item.stikerP4k || 'Tidak Menempel'}
                    </span>
                  </div>

                  {/* Active Program Badges */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.kegiatanPosyandu && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black">
                        Posyandu
                      </span>
                    )}
                    {item.kegiatanUp2kKoperasi && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[9px] font-black">
                        UP2K/Koperasi
                      </span>
                    )}
                    {item.ptpToga && (
                      <span className="px-1.5 py-0.5 rounded bg-lime-100 text-lime-800 text-[9px] font-black">
                        PTP TOGA
                      </span>
                    )}
                    {item.ptpWarungHidup && (
                      <span className="px-1.5 py-0.5 rounded bg-lime-100 text-lime-800 text-[9px] font-black">
                        Warung Hidup
                      </span>
                    )}
                    {item.ptpPeternakan && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-black">
                        Peternakan
                      </span>
                    )}
                    {item.ptpPerikanan && (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 text-[9px] font-black">
                        Perikanan
                      </span>
                    )}
                    {item.industriPangan && (
                      <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 text-[9px] font-black">
                        Ind. Pangan
                      </span>
                    )}
                    {item.industriSandang && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px] font-black">
                        Ind. Sandang
                      </span>
                    )}
                  </div>

                  {item.kegiatanUtama && (
                    <p className="text-[11px] text-slate-600 line-clamp-1 mb-2 italic">
                      "{item.kegiatanUtama}"
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailItem(item)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-extrabold transition-colors cursor-pointer"
                    title="Lihat Daftar KK Anggota & Cetak PDF"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Daftar KK ({kkMembersCount})</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 transition-colors cursor-pointer"
                      title="Edit Dasa Wisma"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.namaKelompok)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 transition-colors cursor-pointer"
                      title="Hapus Kelompok"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }}
        />
      )}

      {/* Modal Detail & Daftar KK Anggota (Cetak PDF Per Kelompok) */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col my-4">
            <div className="bg-pkk-teal text-white p-5 flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase bg-white/20 px-2.5 py-0.5 rounded-full">
                  {detailItem.lingkunganNama || `Lingkungan ${detailItem.lingkunganNomor}`} • RT/RW {detailItem.rtRw || '00/00'}
                </span>
                <h3 className="text-lg font-black mt-1">{detailItem.namaKelompok}</h3>
                <p className="text-xs text-tosca-100">
                  Ketua Dawis: <strong>{detailItem.namaKetuaDawis || detailItem.namaKetua || '-'}</strong>
                  {detailItem.namaKrt ? ` • KRT: ${detailItem.namaKrt}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">KK / Jiwa (L/P)</span>
                  <strong className="text-sm text-slate-900">
                    {detailItem.jumlahKk || 0} KK / {detailItem.jumlahJiwa || 0} Jiwa
                  </strong>
                  <span className="block text-[10px] text-slate-600">
                    L: {detailItem.jumlahLakiLaki ?? detailItem.jumlahJiwaLaki ?? 0} • P: {detailItem.jumlahPerempuan ?? detailItem.jumlahJiwaPerempuan ?? 0}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Ibu & Balita & Lansia</span>
                  <strong className="text-xs text-slate-900 block mt-0.5">
                    Balita: {detailItem.jumlahBalita || 0} • Lansia: {detailItem.jumlahLansia || 0}
                  </strong>
                  <span className="block text-[10px] text-slate-600">
                    Bumil: {detailItem.jumlahIbuHamil || 0} • Busui: {detailItem.jumlahIbuMenyusui || 0} • Nifas: {detailItem.jumlahIbuNifas || 0}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">PUS / WUS / KB</span>
                  <strong className="text-xs text-slate-900 block mt-0.5">
                    PUS: {detailItem.jumlahPus || 0} • WUS: {detailItem.jumlahWus || 0}
                  </strong>
                  <span className="block text-[10px] text-slate-600">
                    Akseptor KB: {detailItem.jumlahAkseptorKb || 0} • Buta Aksara: {detailItem.jumlahButaAksara || 0}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Sanitasi & Rumah</span>
                  <strong className="text-xs text-slate-900 block mt-0.5">
                    {detailItem.kriteriaRumah || 'Layak Huni'} • P4K: {detailItem.stikerP4k || '-'}
                  </strong>
                  <span className="block text-[10px] text-slate-600">
                    Jamban: {detailItem.punyaJambanSehat ?? 0} • SPAL: {detailItem.punyaSpal ?? 0} • TOGA: {detailItem.punyaToga ?? 0}
                  </span>
                </div>
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-teal-50/50 p-3.5 rounded-2xl border border-teal-100">
                <div>
                  <span className="text-[10px] text-teal-800 font-bold uppercase block">Air Bersih & Air Minum</span>
                  <span className="font-bold text-slate-800">{detailItem.sumberAirBersih || '-'}</span>
                  <span className="block text-[11px] text-slate-600">Minum: {detailItem.sumberAirMinum || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-teal-800 font-bold uppercase block">Makanan Pokok & Kegiatan</span>
                  <span className="font-bold text-slate-800">{detailItem.makananPokok || 'Beras'}</span>
                  <span className="block text-[11px] text-slate-600">{detailItem.kegiatanUtama || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-teal-800 font-bold uppercase block">Program Aktif</span>
                  <span className="text-[11px] font-semibold text-slate-700">
                    {[
                      detailItem.kegiatanPosyandu && 'Posyandu',
                      detailItem.kegiatanUp2kKoperasi && 'UP2K/Koperasi',
                      detailItem.ptpToga && 'PTP TOGA',
                      detailItem.ptpWarungHidup && 'Warung Hidup',
                      detailItem.ptpPeternakan && 'Peternakan',
                      detailItem.ptpPerikanan && 'Perikanan',
                      detailItem.industriPangan && 'Industri Pangan',
                      detailItem.industriSandang && 'Industri Sandang',
                    ]
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </span>
                </div>
              </div>

              {/* Table of daftarKkAnggota */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Daftar Kepala Keluarga (KK) Anggota ({detailItem.daftarKkAnggota?.length || 0} KK)
                  </h4>
                </div>
                {detailItem.daftarKkAnggota && detailItem.daftarKkAnggota.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2 text-center w-10">No</th>
                          <th className="px-3 py-2">Nama Kepala Keluarga</th>
                          <th className="px-3 py-2">Alamat</th>
                          <th className="px-3 py-2 text-center">L</th>
                          <th className="px-3 py-2 text-center">P</th>
                          <th className="px-3 py-2 text-center">Total Jiwa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailItem.daftarKkAnggota.map((kk, idx) => (
                          <tr key={kk.id || idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-center font-bold text-slate-500">{idx + 1}</td>
                            <td className="px-3 py-2 font-bold text-slate-900">{kk.namaKepalaKeluarga}</td>
                            <td className="px-3 py-2 text-slate-600">{kk.alamat}</td>
                            <td className="px-3 py-2 text-center">{kk.jumlahLakiLaki ?? 0}</td>
                            <td className="px-3 py-2 text-center">{kk.jumlahPerempuan ?? 0}</td>
                            <td className="px-3 py-2 text-center font-black text-teal-800">{kk.jumlahJiwa ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                    Belum ada rincian daftar KK anggota yang diinput pada kelompok ini. Klik "Edit Data" untuk menambahkan daftar KK.
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const target = detailItem;
                  setDetailItem(null);
                  handleOpenEdit(target);
                }}
                className="px-3.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Data & Daftar KK</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadPdfDocument(
                      'lembar-cetak-detail-dasawisma',
                      `DASAWISMA_${detailItem.namaKelompok.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
                    )
                  }
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-black rounded-xl text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    printOfficialDocument(
                      'lembar-cetak-detail-dasawisma',
                      `DASAWISMA_${detailItem.namaKelompok.replace(/[^a-zA-Z0-9]/g, '_')}`
                    )
                  }
                  className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white font-black rounded-xl text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Cetak Lembar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>

            {/* Hidden Official Print Sheet for Single Dasa Wisma + All KK Members */}
            <div style={{ display: 'none' }}>
              <div
                id="lembar-cetak-detail-dasawisma"
                style={{
                  width: '100%',
                  fontFamily: "'Times New Roman', Times, serif",
                  color: '#000000',
                  backgroundColor: '#ffffff',
                }}
              >
                <KopSuratPkk />
                <div style={{ textAlign: 'center', margin: '10px 0 14px 0' }}>
                  <h2 style={{ fontSize: '13px', fontWeight: 'bold', textDecoration: 'underline', margin: 0 }}>
                    DATA KELOMPOK DASA WISMA &amp; ANGGOTA KELUARGA
                  </h2>
                  <p style={{ fontSize: '11px', fontWeight: 'bold', margin: '4px 0 0 0' }}>
                    {detailItem.namaKelompok} — {detailItem.lingkunganNama || `Lingkungan ${detailItem.lingkunganNomor}`}
                  </p>
                </div>

                <table className="no-print-border" style={{ width: '100%', marginBottom: '10px', fontSize: '10px', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '25%', padding: '2px 4px', border: 'none' }}><strong>Ketua Dasa Wisma</strong></td>
                      <td style={{ width: '25%', padding: '2px 4px', border: 'none' }}>: {detailItem.namaKetuaDawis || detailItem.namaKetua || '-'}</td>
                      <td style={{ width: '25%', padding: '2px 4px', border: 'none' }}><strong>Kepala Rumah Tangga</strong></td>
                      <td style={{ width: '25%', padding: '2px 4px', border: 'none' }}>: {detailItem.namaKrt || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '2px 4px', border: 'none' }}><strong>RT / RW</strong></td>
                      <td style={{ padding: '2px 4px', border: 'none' }}>: {detailItem.rtRw || '00/00'}</td>
                      <td style={{ padding: '2px 4px', border: 'none' }}><strong>Jumlah KK / Jiwa</strong></td>
                      <td style={{ padding: '2px 4px', border: 'none' }}>: {detailItem.jumlahKk || 0} KK / {detailItem.jumlahJiwa || 0} Jiwa (L:{detailItem.jumlahLakiLaki ?? 0}, P:{detailItem.jumlahPerempuan ?? 0})</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '2px 4px', border: 'none' }}><strong>PUS / WUS / Akseptor KB</strong></td>
                      <td style={{ padding: '2px 4px', border: 'none' }}>: {detailItem.jumlahPus || 0} / {detailItem.jumlahWus || 0} / {detailItem.jumlahAkseptorKb || 0}</td>
                      <td style={{ padding: '2px 4px', border: 'none' }}><strong>Bumil / Busui / Nifas</strong></td>
                      <td style={{ padding: '2px 4px', border: 'none' }}>: {detailItem.jumlahIbuHamil || 0} / {detailItem.jumlahIbuMenyusui || 0} / {detailItem.jumlahIbuNifas || 0}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '2px 4px', border: 'none' }}><strong>Balita / Lansia / Buta Aksara</strong></td>
                      <td style={{ padding: '2px 4px', border: 'none' }}>: {detailItem.jumlahBalita || 0} / {detailItem.jumlahLansia || 0} / {detailItem.jumlahButaAksara || 0}</td>
                      <td style={{ padding: '2px 4px', border: 'none' }}><strong>Jamban / SPAL / TOGA</strong></td>
                      <td style={{ padding: '2px 4px', border: 'none' }}>: {detailItem.punyaJambanSehat ?? 0} / {detailItem.punyaSpal ?? 0} / {detailItem.punyaToga ?? 0}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '2px 4px', border: 'none' }}><strong>Air Bersih / Air Minum</strong></td>
                      <td style={{ padding: '2px 4px', border: 'none' }}>: {detailItem.sumberAirBersih || '-'} / {detailItem.sumberAirMinum || '-'}</td>
                      <td style={{ padding: '2px 4px', border: 'none' }}><strong>Kriteria Rumah / P4K</strong></td>
                      <td style={{ padding: '2px 4px', border: 'none' }}>: {detailItem.kriteriaRumah || '-'} / {detailItem.stikerP4k || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '2px 4px', border: 'none' }}><strong>Makanan Pokok</strong></td>
                      <td style={{ padding: '2px 4px', border: 'none' }}>: {detailItem.makananPokok || 'Beras'}</td>
                      <td style={{ padding: '2px 4px', border: 'none' }}><strong>Kegiatan Utama</strong></td>
                      <td style={{ padding: '2px 4px', border: 'none' }}>: {detailItem.kegiatanUtama || '-'}</td>
                    </tr>
                  </tbody>
                </table>

                <h4 style={{ fontSize: '11px', fontWeight: 'bold', margin: '8px 0 4px 0' }}>
                  DAFTAR ANGGOTA KEPALA KELUARGA ({detailItem.daftarKkAnggota?.length || 0} KK)
                </h4>
                <table className="table-compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '28px', textAlign: 'center' }}>No</th>
                      <th>Nama Kepala Keluarga</th>
                      <th>Alamat</th>
                      <th style={{ width: '35px', textAlign: 'center' }}>L</th>
                      <th style={{ width: '35px', textAlign: 'center' }}>P</th>
                      <th style={{ width: '50px', textAlign: 'center' }}>Jiwa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailItem.daftarKkAnggota || []).map((kk, idx) => (
                      <tr key={kk.id || idx}>
                        <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                        <td>{kk.namaKepalaKeluarga}</td>
                        <td>{kk.alamat}</td>
                        <td style={{ textAlign: 'center' }}>{kk.jumlahLakiLaki ?? 0}</td>
                        <td style={{ textAlign: 'center' }}>{kk.jumlahPerempuan ?? 0}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{kk.jumlahJiwa ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                  <div>
                    <p style={{ margin: 0 }}>Dicetak melalui Sistem Informasi TP-PKK Kelurahan Mangga</p>
                    <p style={{ margin: '2px 0 0 0' }}>Diinput oleh: {detailItem.createdByName || '-'}</p>
                  </div>
                  <div style={{ textAlign: 'center', width: '180px' }}>
                    <p style={{ margin: 0 }}>Medan, {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
                    <p style={{ margin: '2px 0 36px 0', fontWeight: 'bold' }}>Ketua Dasa Wisma</p>
                    <p style={{ margin: 0, fontWeight: 'bold', textDecoration: 'underline' }}>
                      ({detailItem.namaKetuaDawis || detailItem.namaKetua || '..............................'})
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Tambah / Edit Dasa Wisma (Selaras 100% dengan Firestore) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 my-4 flex flex-col max-h-[92vh]">
            <div className="bg-pkk-teal text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingItem ? 'Edit Kelompok Dasa Wisma' : 'Tambah Kelompok Dasa Wisma'}
                  </h3>
                  <p className="text-xs text-tosca-100">
                    Formulir terintegrasi sesuai struktur dokumen Firestore TP-PKK
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {/* 1. Identitas Kelompok & Pengurus */}
              <div className="space-y-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5" />
                  <span>1. Identitas Kelompok &amp; Wilayah</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Lingkungan <span className="text-rose-500">*</span>
                    </label>
                    {isLingkunganRestricted ? (
                      <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                        Lingkungan {formLingkungan}
                      </div>
                    ) : (
                      <select
                        value={formLingkungan}
                        onChange={(e) => setFormLingkungan(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500"
                      >
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            Lingkungan {n}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      RT / RW
                    </label>
                    <input
                      type="text"
                      value={formRtRw}
                      onChange={(e) => setFormRtRw(e.target.value)}
                      placeholder="00/00"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nomor WhatsApp / HP
                    </label>
                    <input
                      type="tel"
                      value={formTelepon}
                      onChange={(e) => setFormTelepon(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Kelompok Dasa Wisma <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formNamaKelompok}
                      onChange={(e) => setFormNamaKelompok(e.target.value)}
                      placeholder="Contoh: Dasa Wisma Lily I"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Ketua Dawis <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formNamaKetuaDawis}
                      onChange={(e) => setFormNamaKetuaDawis(e.target.value)}
                      placeholder="Contoh: Rini Julaika"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Kepala Rumah Tangga (KRT)
                    </label>
                    <input
                      type="text"
                      value={formNamaKrt}
                      onChange={(e) => setFormNamaKrt(e.target.value)}
                      placeholder="Contoh: Pardomuan Gultom"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Daftar KK Anggota (daftarKkAnggota) */}
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-emerald-700" />
                    <span>2. Daftar KK Anggota Binaan ({formDaftarKk.length} KK)</span>
                  </p>
                  {formDaftarKk.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSyncTotalsFromDaftarKk}
                      className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                    >
                      Hitung Total KK &amp; Jiwa dari Daftar KK
                    </button>
                  )}
                </div>

                {/* Mini Add KK Row */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-white p-2.5 rounded-xl border border-emerald-200">
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Nama Kepala Keluarga</label>
                    <input
                      type="text"
                      value={newKkNama}
                      onChange={(e) => setNewKkNama(e.target.value)}
                      placeholder="Nama KK"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Alamat</label>
                    <input
                      type="text"
                      value={newKkAlamat}
                      onChange={(e) => setNewKkAlamat(e.target.value)}
                      placeholder="Jl. Jahe 10 No. ..."
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">L</label>
                    <input
                      type="number"
                      min="0"
                      value={newKkLaki}
                      onChange={(e) => setNewKkLaki(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-center"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">P</label>
                    <input
                      type="number"
                      min="0"
                      value={newKkPerempuan}
                      onChange={(e) => setNewKkPerempuan(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-center"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddKkAnggota}
                      className="w-full py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah KK</span>
                    </button>
                  </div>
                </div>

                {/* Existing Daftar KK List */}
                {formDaftarKk.length > 0 && (
                  <div className="max-h-44 overflow-y-auto border border-emerald-200 rounded-xl bg-white">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-emerald-100/70 text-emerald-950 font-bold sticky top-0">
                        <tr>
                          <th className="px-2.5 py-1.5 w-8 text-center">No</th>
                          <th className="px-2.5 py-1.5">Kepala Keluarga</th>
                          <th className="px-2.5 py-1.5">Alamat</th>
                          <th className="px-2 py-1.5 text-center">L / P / Jiwa</th>
                          <th className="px-2 py-1.5 w-10 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formDaftarKk.map((kk, i) => (
                          <tr key={kk.id || i} className="hover:bg-slate-50">
                            <td className="px-2.5 py-1.5 text-center text-slate-500 font-bold">{i + 1}</td>
                            <td className="px-2.5 py-1.5 font-bold text-slate-800">{kk.namaKepalaKeluarga}</td>
                            <td className="px-2.5 py-1.5 text-slate-600">{kk.alamat}</td>
                            <td className="px-2 py-1.5 text-center font-semibold">
                              {kk.jumlahLakiLaki} / {kk.jumlahPerempuan} /{' '}
                              <span className="font-black text-emerald-800">{kk.jumlahJiwa}</span>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveKkAnggota(kk.id)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                                title="Hapus KK ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 3. Statistik Keluarga, Jiwa & Kesehatan */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5 mb-3">
                    <Info className="w-3.5 h-3.5 text-teal-600" />
                    <span>3. Statistik Keluarga &amp; Demografi</span>
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Jumlah KK</label>
                      <input
                        type="number"
                        min="0"
                        value={formJumlahKk}
                        onChange={(e) => setFormJumlahKk(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Laki-Laki</label>
                      <input
                        type="number"
                        min="0"
                        value={formJumlahLakiLaki}
                        onChange={(e) => handleLakiChange(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Perempuan</label>
                      <input
                        type="number"
                        min="0"
                        value={formJumlahPerempuan}
                        onChange={(e) => handlePerempuanChange(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Total Jiwa</label>
                      <input
                        type="number"
                        min="0"
                        value={formJumlahJiwa}
                        onChange={(e) => setFormJumlahJiwa(e.target.value)}
                        className="w-full px-3 py-1.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-black text-emerald-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 mb-3">
                    Ibu, Balita, Lansia &amp; KB
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Ibu Hamil</label>
                      <input type="number" min="0" value={formJumlahBumil} onChange={(e) => setFormJumlahBumil(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Ibu Menyusui</label>
                      <input type="number" min="0" value={formJumlahBusui} onChange={(e) => setFormJumlahBusui(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Ibu Nifas</label>
                      <input type="number" min="0" value={formJumlahNifas} onChange={(e) => setFormJumlahNifas(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Balita</label>
                      <input type="number" min="0" value={formJumlahBalita} onChange={(e) => setFormJumlahBalita(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Lansia</label>
                      <input type="number" min="0" value={formJumlahLansia} onChange={(e) => setFormJumlahLansia(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">PUS</label>
                      <input type="number" min="0" value={formJumlahPus} onChange={(e) => setFormJumlahPus(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">WUS</label>
                      <input type="number" min="0" value={formJumlahWus} onChange={(e) => setFormJumlahWus(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Akseptor KB</label>
                      <input type="number" min="0" value={formJumlahAkseptorKb} onChange={(e) => setFormJumlahAkseptorKb(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Buta Aksara</label>
                      <input type="number" min="0" value={formJumlahButaAksara} onChange={(e) => setFormJumlahButaAksara(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs" />
                    </div>
                  </div>
                </div>

                {/* 4. Sanitasi, Rumah & Konsumsi Pokok */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-sky-600" />
                    <span>4. Sanitasi, Rumah &amp; Kebutuhan Pokok</span>
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Punya Jamban Sehat</label>
                      <input type="number" min="0" value={formPunyaJambanSehat} onChange={(e) => setFormPunyaJambanSehat(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Punya SPAL</label>
                      <input type="number" min="0" value={formPunyaSpal} onChange={(e) => setFormPunyaSpal(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Punya TOGA</label>
                      <input type="number" min="0" value={formPunyaToga} onChange={(e) => setFormPunyaToga(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Sumber Air Bersih</label>
                      <select
                        value={formSumberAirBersih}
                        onChange={(e) => setFormSumberAirBersih(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                      >
                        {!SUMBER_AIR_BERSIH_OPTIONS.includes(formSumberAirBersih) && (
                          <option value={formSumberAirBersih}>{formSumberAirBersih}</option>
                        )}
                        {SUMBER_AIR_BERSIH_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Sumber Air Minum</label>
                      <select
                        value={formSumberAirMinum}
                        onChange={(e) => setFormSumberAirMinum(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                      >
                        {!SUMBER_AIR_MINUM_OPTIONS.includes(formSumberAirMinum) && (
                          <option value={formSumberAirMinum}>{formSumberAirMinum}</option>
                        )}
                        {SUMBER_AIR_MINUM_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Makanan Pokok</label>
                      <select
                        value={formMakananPokok}
                        onChange={(e) => setFormMakananPokok(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                      >
                        {!MAKANAN_POKOK_OPTIONS.includes(formMakananPokok) && (
                          <option value={formMakananPokok}>{formMakananPokok}</option>
                        )}
                        {MAKANAN_POKOK_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Kriteria Rumah</label>
                      <select
                        value={formKriteriaRumah}
                        onChange={(e) => setFormKriteriaRumah(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                      >
                        {!KRITERIA_RUMAH_OPTIONS.includes(formKriteriaRumah) && (
                          <option value={formKriteriaRumah}>{formKriteriaRumah}</option>
                        )}
                        {KRITERIA_RUMAH_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Stiker P4K</label>
                      <select
                        value={formStikerP4k}
                        onChange={(e) => setFormStikerP4k(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                      >
                        {!STIKER_P4K_OPTIONS.includes(formStikerP4k) && (
                          <option value={formStikerP4k}>{formStikerP4k}</option>
                        )}
                        {STIKER_P4K_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 5. Kegiatan PKK, PTP & Industri */}
                <div className="pt-3 border-t border-slate-200 space-y-2.5">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                    <span>5. Pemanfaatan Pekarangan (PTP), Industri &amp; Kegiatan PKK</span>
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {[
                      { label: 'Kegiatan Posyandu', checked: formKegiatanPosyandu, set: setFormKegiatanPosyandu },
                      { label: 'UP2K / Koperasi', checked: formKegiatanUp2kKoperasi, set: setFormKegiatanUp2kKoperasi },
                      { label: 'PTP TOGA', checked: formPtpToga, set: setFormPtpToga },
                      { label: 'PTP Warung Hidup', checked: formPtpWarungHidup, set: setFormPtpWarungHidup },
                      { label: 'PTP Peternakan', checked: formPtpPeternakan, set: setFormPtpPeternakan },
                      { label: 'PTP Perikanan', checked: formPtpPerikanan, set: setFormPtpPerikanan },
                      { label: 'Industri Pangan', checked: formIndustriPangan, set: setFormIndustriPangan },
                      { label: 'Industri Sandang', checked: formIndustriSandang, set: setFormIndustriSandang },
                    ].map((opt) => (
                      <label
                        key={opt.label}
                        className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-colors ${
                          opt.checked
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={opt.checked}
                          onChange={(e) => opt.set(e.target.checked)}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-[11px]">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Kegiatan Utama & Catatan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kegiatan Utama Kelompok
                  </label>
                  <input
                    type="text"
                    value={formKegiatanUtama}
                    onChange={(e) => setFormKegiatanUtama(e.target.value)}
                    placeholder="Contoh: Pemanfaatan toga"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catatan Tambahan
                  </label>
                  <input
                    type="text"
                    value={formCatatan}
                    onChange={(e) => setFormCatatan(e.target.value)}
                    placeholder="Keterangan kondisi lingkungan atau binaan khusus..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-pkk-teal hover:bg-pkk-dark text-white font-extrabold text-xs shadow-md transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingItem ? 'Perbarui Data' : 'Simpan Dasa Wisma'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Transformasi Data Mentah Kader */}
      {isRawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-8">
            <div className="bg-gradient-to-r from-indigo-700 to-teal-700 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Wand2 className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    Transformasi &amp; Validasi Data Mentah Kader
                  </h3>
                  <p className="text-xs text-indigo-100">
                    Konversi catatan lapangan atau pesan WA menjadi data standar Dasa Wisma
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRawModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tempel Catatan Lapangan / Pesan WhatsApp Kader PKK:
                </label>
                <textarea
                  rows={5}
                  value={rawInputText}
                  onChange={(e) => setRawInputText(e.target.value)}
                  placeholder={`Contoh teks kader:\nKelompok: Lily I Lingkungan 14\nKetua: Rini Julaika\nKK: 24\nJiwa: 94 orang (Laki 41, Perempuan 53)\nBumil: 0, Balita: 3, Lansia: 17, WUS: 16, PUS: 4\nAir: PDAM, Jamban: 20, SPAL: 20\nKriteria Rumah: Layak Huni`}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleParseRawNotes}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Proses &amp; Validasi Logika</span>
                </button>

                {rawParseResult && (
                  <button
                    type="button"
                    onClick={handleApplyParsedToForm}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Terapkan ke Formulir</span>
                  </button>
                )}
              </div>

              {rawValidationNotes.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-1">
                  <p className="text-[11px] font-black text-amber-900 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Catatan Verifikasi Logika &amp; Format:</span>
                  </p>
                  <ul className="text-[11px] text-amber-800 space-y-0.5 list-disc list-inside font-medium">
                    {rawValidationNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}

              {rawParseResult && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                      Hasil Ekstraksi Standar
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Format Valid
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Kelompok:</span>
                      <strong className="text-slate-800">{rawParseResult.namaKelompok}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Wilayah:</span>
                      <strong className="text-slate-800">Lingkungan {rawParseResult.lingkunganNomor}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Ketua Dawis:</span>
                      <strong className="text-slate-800">{rawParseResult.namaKetuaDawis}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">KK:</span>
                      <strong className="text-slate-800">{rawParseResult.jumlahKk} KK</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Jiwa (L / P / Total):</span>
                      <strong className="text-slate-800">
                        {rawParseResult.jumlahLakiLaki} / {rawParseResult.jumlahPerempuan} / {rawParseResult.jumlahJiwa}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Balita / Lansia:</span>
                      <strong className="text-slate-800">{rawParseResult.jumlahBalita} / {rawParseResult.jumlahLansia}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">PUS / WUS:</span>
                      <strong className="text-slate-800">{rawParseResult.jumlahPus} / {rawParseResult.jumlahWus}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Jamban / SPAL:</span>
                      <strong className="text-slate-800">{rawParseResult.punyaJambanSehat} / {rawParseResult.punyaSpal}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Kriteria Rumah:</span>
                      <strong className="text-emerald-700">{rawParseResult.kriteriaRumah}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRawModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Printable Report Sheet (Captured by printOfficialDocument / downloadPdfDocument) */}
      <div style={{ display: 'none' }}>
        <div
          id="lembar-cetak-rekap-dasawisma"
          style={{
            width: '100%',
            fontFamily: "'Times New Roman', Times, serif",
            color: '#000000',
            backgroundColor: '#ffffff',
          }}
        >
          <KopSuratPkk />

          <div style={{ textAlign: 'center', margin: '10px 0 14px 0' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 'bold', textDecoration: 'underline', margin: 0 }}>
              REKAPITULASI DATA KELOMPOK DASA WISMA
            </h2>
            <p style={{ fontSize: '10px', fontWeight: 'bold', margin: '3px 0 0 0' }}>
              TP-PKK KELURAHAN MANGGA • KECAMATAN MEDAN TUNTUNGAN
            </p>
            <p style={{ fontSize: '9px', margin: '2px 0 0 0' }}>
              WILAYAH: {selectedLingkungan === 'all' ? 'SELURUH 24 LINGKUNGAN' : `LINGKUNGAN ${selectedLingkungan}`}
            </p>
          </div>

          <table className="table-compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ textAlign: 'center', width: '20px' }}>No</th>
                <th rowSpan={2}>Kelompok / Ketua Dawis / KRT</th>
                <th rowSpan={2} style={{ textAlign: 'center', width: '26px' }}>Lingk</th>
                <th rowSpan={2} style={{ textAlign: 'center', width: '24px' }}>KK</th>
                <th colSpan={3} style={{ textAlign: 'center' }}>Jiwa</th>
                <th rowSpan={2} style={{ textAlign: 'center', width: '40px' }}>PUS/WUS/KB</th>
                <th rowSpan={2} style={{ textAlign: 'center', width: '40px' }}>Hml/Bsu/Nfs</th>
                <th rowSpan={2} style={{ textAlign: 'center', width: '24px' }}>Balita</th>
                <th rowSpan={2} style={{ textAlign: 'center', width: '24px' }}>Lansia</th>
                <th rowSpan={2} style={{ textAlign: 'center', width: '44px' }}>Jmb/SPL/TGA</th>
                <th rowSpan={2} style={{ textAlign: 'center', width: '55px' }}>Air &amp; Pokok</th>
                <th rowSpan={2} style={{ textAlign: 'center', width: '48px' }}>Rumah &amp; P4K</th>
                <th rowSpan={2}>Kegiatan</th>
              </tr>
              <tr>
                <th style={{ textAlign: 'center', width: '18px' }}>L</th>
                <th style={{ textAlign: 'center', width: '18px' }}>P</th>
                <th style={{ textAlign: 'center', width: '20px' }}>Jml</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ textAlign: 'center', padding: '14px' }}>
                    Belum ada data Kelompok Dasa Wisma untuk wilayah ini.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const ketua = item.namaKetuaDawis || item.namaKetua || '-';
                  const l = item.jumlahLakiLaki ?? item.jumlahJiwaLaki ?? 0;
                  const p = item.jumlahPerempuan ?? item.jumlahJiwaPerempuan ?? 0;
                  const jamban = item.punyaJambanSehat ?? item.jumlahJambanSehat ?? 0;
                  const spal = item.punyaSpal ?? item.jumlahSpal ?? 0;
                  const toga = item.punyaToga ?? item.jumlahPekaranganManfaat ?? 0;
                  return (
                    <tr key={item.id}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                      <td>
                        <strong>{item.namaKelompok}</strong>
                        <br />
                        Ketua: {ketua}
                        {item.namaKrt ? ` | KRT: ${item.namaKrt}` : ''}
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.lingkunganNomor}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.jumlahKk || 0}</td>
                      <td style={{ textAlign: 'center' }}>{l}</td>
                      <td style={{ textAlign: 'center' }}>{p}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.jumlahJiwa || 0}</td>
                      <td style={{ textAlign: 'center' }}>
                        {item.jumlahPus || 0}/{item.jumlahWus || 0}/{item.jumlahAkseptorKb || 0}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {item.jumlahIbuHamil || 0}/{item.jumlahIbuMenyusui || 0}/{item.jumlahIbuNifas || 0}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.jumlahBalita || 0}</td>
                      <td style={{ textAlign: 'center' }}>{item.jumlahLansia || 0}</td>
                      <td style={{ textAlign: 'center' }}>
                        {jamban}/{spal}/{toga}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {item.sumberAirBersih || '-'} / {item.makananPokok || '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {item.kriteriaRumah || '-'}
                        <br />
                        ({item.stikerP4k || '-'})
                      </td>
                      <td>{item.kegiatanUtama || item.catatan || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredItems.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 'bold', backgroundColor: '#f1f5f9' }}>
                  <td colSpan={3} style={{ textAlign: 'right' }}>TOTAL:</td>
                  <td style={{ textAlign: 'center' }}>{kpiStats.totalKk}</td>
                  <td style={{ textAlign: 'center' }}>{kpiStats.totalLakiLaki}</td>
                  <td style={{ textAlign: 'center' }}>{kpiStats.totalPerempuan}</td>
                  <td style={{ textAlign: 'center' }}>{kpiStats.totalJiwa}</td>
                  <td style={{ textAlign: 'center' }}>
                    {kpiStats.totalPus}/{kpiStats.totalWus}/{kpiStats.totalAkseptorKb}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {kpiStats.totalBumil}/{kpiStats.totalBusui}/{kpiStats.totalNifas}
                  </td>
                  <td style={{ textAlign: 'center' }}>{kpiStats.totalBalita}</td>
                  <td style={{ textAlign: 'center' }}>{kpiStats.totalLansia}</td>
                  <td style={{ textAlign: 'center' }}>
                    {kpiStats.totalJamban}/{kpiStats.totalSpal}/{kpiStats.totalToga}
                  </td>
                  <td colSpan={3} style={{ textAlign: 'center' }}>
                    {kpiStats.totalKelompok} Kelompok Dasa Wisma
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '9px' }}>
            <div>
              <p style={{ margin: 0, fontStyle: 'italic' }}>
                Catatan: Margin Kiri 2 cm sesuai ketentuan arsip resmi TP-PKK Kelurahan Mangga.
              </p>
              <p style={{ margin: '2px 0 0 0', fontStyle: 'italic' }}>
                Sistem Informasi Pelaporan Kepling &amp; PKK Kelurahan Mangga (SIKEPLING)
              </p>
            </div>
            <div style={{ textAlign: 'center', width: '190px' }}>
              <p style={{ margin: 0 }}>Medan, {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
              <p style={{ margin: '2px 0 40px 0', fontWeight: 'bold' }}>Ketua TP-PKK Kelurahan Mangga</p>
              <p style={{ margin: 0, fontWeight: 'bold', textDecoration: 'underline' }}>( Ny. Ketua TP-PKK )</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
