import React, { useState, useEffect, useMemo } from 'react';
import { PKK_LOGO_BASE64 } from '../assets/logoPkkBase64';
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
  Check,
  Calendar,
  Users,
  FileText,
  Wallet,
  Archive,
  ClipboardList,
  Sparkles,
  Download,
  AlertCircle,
  PlusCircle,
  Info,
  RefreshCw,
  FileUp,
  Printer,
  CreditCard,
} from 'lucide-react';
import { PkkCardModal } from './PkkCardModal';
import { UserAccount, SuratKedinasanItem, JenisSuratKedinasan, isPkkRole } from '../types';
import { KopSuratPkk } from './KopSuratPkk';
import { RealtimeSyncStatusPanel } from './RealtimeSyncStatusPanel';
import { printOfficialDocument } from '../utils/printHelper';
import {
  PkkBuku1Anggota,
  PkkBuku4Notulen,
  PkkBuku5Inventaris,
  DEFAULT_BUKU1_ITEMS,
  subscribeBuku1,
  saveBuku1Item,
  deleteBuku1Item,
  subscribeBuku4,
  saveBuku4Item,
  deleteBuku4Item,
  subscribeBuku5,
  saveBuku5Item,
  deleteBuku5Item,
} from '../lib/pkkBukuService';
import { subscribeSurat, saveSuratItem, deleteSuratItem } from '../lib/suratService';
import { subscribePkkKeuangan, getLocalTransaksiPkk, saveTransaksiPkk, deleteTransaksiPkk, POS_ANGGARAN_LABELS } from '../lib/pkkKeuanganService';
import { subscribePkkKegiatan, getLocalPkkKegiatanList, savePkkKegiatan, deletePkkKegiatan, POKJA_LABELS } from '../lib/pkkKegiatanService';
import { safeGetLocalStorage } from '../lib/safeStorage';
import { formatTanggalIndonesia, getTodayLocalIso } from '../lib/formatter';
import { compressImageFile } from '../lib/imageCompressor';

interface PkkBukuAdministrasiViewProps {
  currentUser: UserAccount;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const formatSafeDate = (val?: string): string => {
  if (!val) return '-';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : formatTanggalIndonesia(d);
};

const normalizePokjaValue = (
  raw?: string
): 'SEKRETARIAT' | 'POKJA_I' | 'POKJA_II' | 'POKJA_III' | 'POKJA_IV' | 'PKK_LINGKUNGAN' => {
  const v = (raw || '').toUpperCase().trim();
  if (v === 'I' || v === 'POKJA_I') return 'POKJA_I';
  if (v === 'II' || v === 'POKJA_II') return 'POKJA_II';
  if (v === 'III' || v === 'POKJA_III') return 'POKJA_III';
  if (v === 'IV' || v === 'POKJA_IV') return 'POKJA_IV';
  if (v === 'PKK_LINGKUNGAN') return 'PKK_LINGKUNGAN';
  return 'SEKRETARIAT';
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const PkkBukuAdministrasiView: React.FC<PkkBukuAdministrasiViewProps> = ({
  currentUser,
  onShowToast,
}) => {
  const [activeBook, setActiveBuku] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [searchQuery, setSearchQuery] = useState('');

  // Core Lists from Services (Hydrated from local phone cache immediately for 0ms startup)
  const [buku1List, setBuku1List] = useState<PkkBuku1Anggota[]>(() => {
    const stored = safeGetLocalStorage<PkkBuku1Anggota[]>('sikepling_pkk_buku_1_v1', DEFAULT_BUKU1_ITEMS);
    return Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_BUKU1_ITEMS;
  });
  const [suratList, setSuratList] = useState<SuratKedinasanItem[]>(() => {
    const all = safeGetLocalStorage<SuratKedinasanItem[]>('sikepling_surat_kedinasan_v1', []);
    return all.filter(s => s.kategori === 'PKK' || isPkkRole(s.dibuatOlehRole || ''));
  });
  const [keuanganList, setKeuanganList] = useState<any[]>(() => getLocalTransaksiPkk());
  const [buku4List, setBuku4List] = useState<PkkBuku4Notulen[]>(() => safeGetLocalStorage('sikepling_pkk_buku_4_v1', []));
  const [buku5List, setBuku5List] = useState<PkkBuku5Inventaris[]>(() => safeGetLocalStorage('sikepling_pkk_buku_5_v1', []));
  const [kegiatanList, setKegiatanList] = useState<any[]>(() => getLocalPkkKegiatanList());

  // Modals / Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedCardMember, setSelectedCardMember] = useState<any | null>(null);

  // General Loading/Saving States
  const [isSaving, setIsSaving] = useState(false);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

  // Subscriptions
  useEffect(() => {
    const unsub1 = subscribeBuku1((items) => setBuku1List(items));
    const unsub2 = subscribeSurat((items) => {
      // Filter for PKK-related letters explicitly
      setSuratList(items.filter(s => {
        if (s.kategori === 'PKK') return true;
        if (s.kategori === 'KELURAHAN') return false;
        return isPkkRole(s.dibuatOlehRole || '') ||
               s.asalSurat?.toLowerCase().includes('pkk') ||
               s.nomorSurat?.toLowerCase().includes('pkk') ||
               s.tujuanSurat?.toLowerCase().includes('pkk');
      }));
    });
    const unsub3 = subscribePkkKeuangan((items) => setKeuanganList(items));
    const unsub4 = subscribeBuku4((items) => setBuku4List(items));
    const unsub5 = subscribeBuku5((items) => setBuku5List(items));
    const unsub6 = subscribePkkKegiatan((items) => setKegiatanList(items));

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
      unsub6();
    };
  }, []);

  // Form Fields - Unified / Dynamic depending on the active book
  // Book 1 (Anggota)
  const [b1Nama, setB1Nama] = useState('');
  const [b1Jabatan, setB1Jabatan] = useState('');
  const [b1Gender, setB1Gender] = useState<'L' | 'P'>('P');
  const [b1TempatLahir, setB1TempatLahir] = useState('');
  const [b1TglLahir, setB1TglLahir] = useState('');
  const [b1Status, setB1Status] = useState<'Kawin' | 'Belum Kawin' | 'Janda/Duda'>('Kawin');
  const [b1Alamat, setB1Alamat] = useState('');
  const [b1Pendidikan, setB1Pendidikan] = useState('');
  const [b1Pekerjaan, setB1Pekerjaan] = useState('');
  const [b1Keterangan, setB1Keterangan] = useState('');
  const [b1PasphotoUrl, setB1PasphotoUrl] = useState('');

  // Book 2 (Letters)
  const [b2Nomor, setB2Nomor] = useState('');
  const [b2Tanggal, setB2Tanggal] = useState(getTodayLocalIso());
  const [b2Jenis, setB2Jenis] = useState<JenisSuratKedinasan>('SURAT_MASUK');
  const [b2Perihal, setB2Perihal] = useState('');
  const [b2AsalTujuan, setB2AsalTujuan] = useState('');
  const [b2Keterangan, setB2Keterangan] = useState('');
  const [b2FileUrl, setB2FileUrl] = useState('');
  const [b2FileName, setB2FileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Book 3 (Finance)
  const [b3Tanggal, setB3Tanggal] = useState(getTodayLocalIso());
  const [b3Jenis, setB3Jenis] = useState<'PENERIMAAN' | 'PENGELUARAN'>('PENERIMAAN');
  const [b3Jumlah, setB3Jumlah] = useState<number>(0);
  const [b3Kategori, setB3Kategori] = useState('SEKRETARIAT');
  const [b3Keterangan, setB3Keterangan] = useState('');
  const [b3Bukti, setB3Bukti] = useState('');
  const [b3NomorBukti, setB3NomorBukti] = useState('');

  // Book 4 (Notulen)
  const [b4Tanggal, setB4Tanggal] = useState(getTodayLocalIso());
  const [b4Agenda, setB4Agenda] = useState('');
  const [b4Pimpinan, setB4Pimpinan] = useState('');
  const [b4Peserta, setB4Peserta] = useState<number>(0);
  const [b4Keputusan, setB4Keputusan] = useState('');
  const [b4Catatan, setB4Catatan] = useState('');
  const [b4Keterangan, setB4Keterangan] = useState('');

  // Book 5 (Inventaris)
  const [b5Nama, setB5Nama] = useState('');
  const [b5Asal, setB5Asal] = useState('');
  const [b5Tanggal, setB5Tanggal] = useState(getTodayLocalIso());
  const [b5Jumlah, setB5Jumlah] = useState<number>(1);
  const [b5Kondisi, setB5Kondisi] = useState<'Baik' | 'Cukup' | 'Rusak Ringan' | 'Rusak Berat'>('Baik');
  const [b5Keterangan, setB5Keterangan] = useState('');
  const [b5Foto, setB5Foto] = useState('');

  // Book 6 (Kegiatan)
  const [b6Nama, setB6Nama] = useState('');
  const [b6Tanggal, setB6Tanggal] = useState(getTodayLocalIso());
  const [b6Tempat, setB6Tempat] = useState('');
  const [b6Pokja, setB6Pokja] = useState<'SEKRETARIAT' | 'POKJA_I' | 'POKJA_II' | 'POKJA_III' | 'POKJA_IV' | 'PKK_LINGKUNGAN'>('SEKRETARIAT');
  const [b6Keterangan, setB6Keterangan] = useState('');
  const [isImprovingLanguage, setIsImprovingLanguage] = useState(false);

  const handleImproveLanguage = async () => {
    if (!b6Keterangan || b6Keterangan.trim().length < 5) return;
    setIsImprovingLanguage(true);
    try {
      const resp = await fetch('/api/gemini/improve-pkk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: b6Keterangan }),
      });
      const data = await resp.json();
      if (data.success && data.improvedText) {
        setB6Keterangan(data.improvedText);
        onShowToast?.('Bahasa uraian kegiatan berhasil diperbaiki secara otomatis!', 'success');
      } else {
        onShowToast?.('Gagal memperbaiki bahasa: ' + (data.message || 'Error tidak dikenal'), 'error');
      }
    } catch (err) {
      console.error(err);
      onShowToast?.('Gagal menghubungi layanan AI.', 'error');
    } finally {
      setIsImprovingLanguage(false);
    }
  };

  // Clear Form Fields
  const resetForm = () => {
    setEditingItem(null);
    setB1Nama(''); setB1Jabatan(''); setB1Gender('P'); setB1TempatLahir(''); setB1TglLahir(''); setB1Status('Kawin'); setB1Alamat(''); setB1Pendidikan(''); setB1Pekerjaan(''); setB1Keterangan(''); setB1PasphotoUrl('');
    setB2Nomor(''); setB2Tanggal(getTodayLocalIso()); setB2Jenis('SURAT_MASUK'); setB2Perihal(''); setB2AsalTujuan(''); setB2Keterangan(''); setB2FileUrl(''); setB2FileName('');
    setB3Tanggal(getTodayLocalIso()); setB3Jenis('PENERIMAAN'); setB3Jumlah(0); setB3Kategori('SEKRETARIAT'); setB3Keterangan(''); setB3Bukti(''); setB3NomorBukti('');
    setB4Tanggal(getTodayLocalIso()); setB4Agenda(''); setB4Pimpinan(''); setB4Peserta(0); setB4Keputusan(''); setB4Catatan(''); setB4Keterangan('');
    setB5Nama(''); setB5Asal(''); setB5Tanggal(getTodayLocalIso()); setB5Jumlah(1); setB5Kondisi('Baik'); setB5Keterangan('');
    setB6Nama(''); setB6Tanggal(getTodayLocalIso()); setB6Tempat(''); setB6Pokja('SEKRETARIAT'); setB6Keterangan('');
  };

  // Populate form for Editing
  const handleEditInit = (item: any) => {
    setEditingItem(item);
    setIsFormOpen(true);
    if (activeBook === 1) {
      setB1Nama(item.nama || '');
      setB1Jabatan(item.jabatan || '');
      setB1Gender(item.jenisKelamin || 'P');
      setB1TempatLahir(item.tempatLahir || '');
      setB1TglLahir(item.tanggalLahir || '');
      setB1Status((item.statusPerkawinan || item.statusPernikahan || 'Kawin') as any);
      setB1Alamat(item.alamat || '');
      setB1Pendidikan(item.pendidikan || '');
      setB1Pekerjaan(item.pekerjaan || '');
      setB1Keterangan(item.keterangan || '');
      setB1PasphotoUrl(item.pasphotoUrl || '');
    } else if (activeBook === 2) {
      setB2Nomor(item.nomorSurat || '');
      setB2Tanggal(item.tanggal || item.tanggalSurat || getTodayLocalIso());
      setB2Jenis(item.jenisSurat || 'SURAT_MASUK');
      setB2Perihal(item.perihal || '');
      setB2AsalTujuan(item.asalSurat || item.tujuanSurat || '');
      setB2Keterangan(item.keterangan || item.isiRingkas || '');
      setB2FileUrl(item.fileUrl || '');
      setB2FileName(item.fileName || '');
    } else if (activeBook === 3) {
      setB3Tanggal(item.tanggal || getTodayLocalIso());
      setB3Jenis(item.jenis || 'PENERIMAAN');
      setB3Jumlah(item.jumlah || 0);
      setB3Kategori(item.posAnggaran || item.kategori || 'SEKRETARIAT');
      setB3Keterangan(item.uraian || item.keterangan || '');
      setB3Bukti(item.buktiFotoUrl || '');
      setB3NomorBukti(item.nomorBukti || '');
    } else if (activeBook === 4) {
      setB4Tanggal(item.tanggalRapat || item.tanggal || getTodayLocalIso());
      setB4Agenda(item.agenda || item.acara || '');
      setB4Pimpinan(item.pimpinanRapat || '');
      setB4Peserta(item.jumlahPeserta || 0);
      setB4Keputusan(item.hasilKeputusan || item.keputusanRapat || '');
      setB4Catatan(item.catatanRapat || item.notulenRingkas || '');
      setB4Keterangan(item.keterangan || '');
    } else if (activeBook === 5) {
      setB5Nama(item.namaBarang || '');
      setB5Asal(item.asalBarang || '');
      setB5Tanggal(item.tanggalPerolehan || item.tahunPengadaan || getTodayLocalIso());
      setB5Jumlah(item.jumlah || 1);
      setB5Kondisi((item.kondisi || item.kondisiBarang || 'Baik') as any);
      setB5Keterangan(item.keterangan || '');
    } else if (activeBook === 6) {
      setB6Nama(item.namaKegiatan || item.judul || '');
      setB6Tanggal(item.tanggal || item.tanggalPelaksanaan || getTodayLocalIso());
      setB6Tempat(item.lokasi || item.tempat || '');
      setB6Pokja(normalizePokjaValue(item.pokja));
      setB6Keterangan(item.uraianHasil || item.keterangan || item.deskripsi || '');
    }
  };

  // Submit Save Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (activeBook === 1) {
        const item: PkkBuku1Anggota = {
          id: editingItem?.id || 'b1_' + Date.now(),
          nik: editingItem?.nik || '',
          nama: b1Nama,
          jabatan: b1Jabatan,
          jenisKelamin: b1Gender,
          tempatLahir: b1TempatLahir,
          tanggalLahir: b1TglLahir,
          statusPerkawinan: b1Status,
          statusPernikahan: b1Status,
          alamat: b1Alamat,
          pendidikan: b1Pendidikan,
          pekerjaan: b1Pekerjaan,
          keterangan: b1Keterangan,
          pasphotoUrl: b1PasphotoUrl || editingItem?.pasphotoUrl || '',
          createdAt: editingItem?.createdAt || new Date().toISOString(),
        };
        await saveBuku1Item(item);
        onShowToast?.(`Anggota PKK "${item.nama}" berhasil disimpan!`, 'success');
        setIsFormOpen(false);
        resetForm();
        // Langsung tampilkan modal pratinjau KTA di layar agar pengguna dapat melihat kartu secara nyaman
        setSelectedCardMember(item);
        return;
      } else if (activeBook === 2) {
        // Agenda Surat Masuk/Keluar
        const isMasuk = b2Jenis === 'SURAT_MASUK';
        const item: SuratKedinasanItem = {
          id: editingItem?.id || 'surat_' + Date.now(),
          nomorSurat: b2Nomor,
          tanggalSurat: b2Tanggal,
          jenisSurat: b2Jenis,
          perihal: b2Perihal,
          kategori: 'PKK',
          asalSurat: isMasuk ? b2AsalTujuan : 'Nur Aisyah Dewi, A.Md (Sekretaris Tim Penggerak PKK)',
          tujuanSurat: isMasuk ? 'PKK Kelurahan Mangga' : b2AsalTujuan,
          sifat: 'BIASA',
          status: 'DISETUJUI',
          isiRingkas: b2Keterangan,
          fileUrl: b2FileUrl,
          fileName: b2FileName,
          penandatangan: 'Ny. Fransiska Fery Arapenta Tarigan (Ketua Tim Penggerak PKK)',
          dibuatOlehNama: currentUser.nama,
          dibuatOlehRole: currentUser.role,
          createdAt: editingItem?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveSuratItem(item);
      } else if (activeBook === 3) {
        // Keuangan (Unified TransaksiKeuanganPkk schema + legacy UI aliases)
        const posVal = (b3Kategori in POS_ANGGARAN_LABELS ? b3Kategori : 'LAINNYA') as any;
        const item: any = {
          id: editingItem?.id || 'tx_' + Date.now(),
          tanggal: b3Tanggal,
          jenis: b3Jenis,
          jumlah: Number(b3Jumlah),
          posAnggaran: posVal,
          uraian: b3Keterangan || editingItem?.uraian || '',
          kategori: POS_ANGGARAN_LABELS[posVal] || b3Kategori,
          keterangan: b3Keterangan,
          nomorBukti: b3NomorBukti,
          buktiFotoUrl: b3Bukti || editingItem?.buktiFotoUrl || '',
          dibuatOlehNama: editingItem?.dibuatOlehNama || currentUser.nama,
          dibuatOlehRole: editingItem?.dibuatOlehRole || currentUser.role,
          petugasId: currentUser.id,
          petugasNama: currentUser.nama,
          createdAt: editingItem?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveTransaksiPkk(item);
      } else if (activeBook === 4) {
        // Notulen
        const item: PkkBuku4Notulen = {
          id: editingItem?.id || 'b4_' + Date.now(),
          tanggal: b4Tanggal,
          tanggalRapat: b4Tanggal,
          acara: b4Agenda,
          agenda: b4Agenda,
          pimpinanRapat: b4Pimpinan,
          jumlahPeserta: Number(b4Peserta),
          keputusanRapat: b4Keputusan,
          hasilKeputusan: b4Keputusan,
          notulenRingkas: b4Catatan,
          catatanRapat: b4Catatan,
          keterangan: b4Keterangan,
          createdAt: editingItem?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveBuku4Item(item);
      } else if (activeBook === 5) {
        // Inventaris
        const item: PkkBuku5Inventaris = {
          id: editingItem?.id || 'b5_' + Date.now(),
          namaBarang: b5Nama,
          asalBarang: b5Asal,
          tanggalPerolehan: b5Tanggal,
          jumlah: Number(b5Jumlah),
          kondisi: b5Kondisi,
          kondisiBarang: b5Kondisi,
          keterangan: b5Keterangan,
          createdAt: editingItem?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveBuku5Item(item);
      } else if (activeBook === 6) {
        // Kegiatan (Unified LaporanKegiatanPkk schema)
        const normalizedPokja = normalizePokjaValue(b6Pokja);
        const item: any = {
          id: editingItem?.id || 'act_' + Date.now(),
          namaKegiatan: b6Nama,
          tanggal: b6Tanggal,
          tanggalPelaksanaan: b6Tanggal,
          lokasi: b6Tempat,
          tempat: b6Tempat,
          pokja: normalizedPokja,
          kategoriProgram: editingItem?.kategoriProgram || 'Program Pokok PKK',
          uraianHasil: b6Keterangan,
          keterangan: b6Keterangan,
          pelaporNama: editingItem?.pelaporNama || currentUser.nama,
          pelaporRole: editingItem?.pelaporRole || currentUser.role,
          petugasId: currentUser.id,
          petugasNama: currentUser.nama,
          createdAt: editingItem?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await savePkkKegiatan(item);
      }

      onShowToast?.('Data Administrasi PKK berhasil disimpan!', 'success');
      setIsFormOpen(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      onShowToast?.(`Gagal menyimpan data: ${err.message || err}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Handler
  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus data administrasi ini secara permanen dari server?')) return;
    try {
      if (activeBook === 1) {
        await deleteBuku1Item(id);
      } else if (activeBook === 2) {
        await deleteSuratItem(id);
      } else if (activeBook === 3) {
        await deleteTransaksiPkk(id);
      } else if (activeBook === 4) {
        await deleteBuku4Item(id);
      } else if (activeBook === 5) {
        await deleteBuku5Item(id);
      } else if (activeBook === 6) {
        await deletePkkKegiatan(id);
      }
      onShowToast?.('Data berhasil dihapus dari cloud database!', 'success');
    } catch (err: any) {
      console.error(err);
      onShowToast?.(`Gagal menghapus data: ${err.message || err}`, 'error');
    }
  };

  // Format IDR for Book III
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  // Filtered and Searched List computations
  const currentFilteredList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (activeBook === 1) {
      return buku1List.filter(it => 
        !query || 
        (it.nama || '').toLowerCase().includes(query) || 
        (it.jabatan || '').toLowerCase().includes(query) || 
        (it.alamat || '').toLowerCase().includes(query)
      );
    } else if (activeBook === 2) {
      return suratList.filter(it => 
        !query || 
        (it.nomorSurat || '').toLowerCase().includes(query) || 
        (it.perihal || '').toLowerCase().includes(query) || 
        (it.asalSurat || '').toLowerCase().includes(query) || 
        (it.tujuanSurat || '').toLowerCase().includes(query)
      );
    } else if (activeBook === 3) {
      return keuanganList.filter(it => {
        if (!query) return true;
        const posLabel = POS_ANGGARAN_LABELS[it.posAnggaran] || it.posAnggaran || it.kategori || '';
        return (
          (it.uraian || it.keterangan || '').toLowerCase().includes(query) ||
          posLabel.toLowerCase().includes(query) ||
          (it.nomorBukti || '').toLowerCase().includes(query)
        );
      });
    } else if (activeBook === 4) {
      return buku4List.filter(it => 
        !query || 
        (it.agenda || it.acara || '').toLowerCase().includes(query) || 
        (it.pimpinanRapat || '').toLowerCase().includes(query) || 
        (it.hasilKeputusan || it.keputusanRapat || '').toLowerCase().includes(query)
      );
    } else if (activeBook === 5) {
      return buku5List.filter(it => 
        !query || 
        (it.namaBarang || '').toLowerCase().includes(query) || 
        (it.asalBarang || '').toLowerCase().includes(query) || 
        (it.kondisi || it.kondisiBarang || '').toLowerCase().includes(query)
      );
    } else if (activeBook === 6) {
      return kegiatanList.filter(it => {
        if (!query) return true;
        const pokjaLabel = POKJA_LABELS[normalizePokjaValue(it.pokja)] || it.pokja || '';
        return (
          (it.namaKegiatan || it.judul || '').toLowerCase().includes(query) ||
          (it.lokasi || it.tempat || '').toLowerCase().includes(query) ||
          (it.uraianHasil || it.keterangan || it.deskripsi || '').toLowerCase().includes(query) ||
          pokjaLabel.toLowerCase().includes(query)
        );
      });
    }
    return [];
  }, [activeBook, searchQuery, buku1List, suratList, keuanganList, buku4List, buku5List, kegiatanList]);

  // General Metadata for Books Overview Card
  const bookMeta = {
    1: { title: 'Buku I: Daftar Anggota & Kader PKK', desc: 'Mencatat daftar nama pengurus, anggota TP-PKK, dan kader PKK Kelurahan.', icon: Users },
    2: { title: 'Buku II: Agenda Surat Masuk / Keluar', desc: 'Mencatat surat-surat masuk dan keluar TP-PKK secara tertib.', icon: Archive },
    3: { title: 'Buku III: Buku Keuangan Kas', desc: 'Mencatat arus kas masuk (penerimaan) dan kas keluar (pengeluaran) organisasi.', icon: Wallet },
    4: { title: 'Buku IV: Buku Notulen Rapat', desc: 'Mencatat jalannya rapat, hasil musyawarah, dan keputusan penting PKK.', icon: FileText },
    5: { title: 'Buku V: Buku Inventaris Barang', desc: 'Mencatat aset, logistik, dan inventaris barang milik TP-PKK.', icon: ClipboardList },
    6: { title: 'Buku VI: Catatan Kegiatan', desc: 'Mencatat setiap pelaksanaan program kerja, penyuluhan, dan kegiatan PKK.', icon: BookOpen },
  };

  const ActiveIcon = bookMeta[activeBook].icon;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-tosca-800 via-tosca-700 to-tosca-800 text-white shadow-xl p-6 sm:p-8 border border-tosca-600/30">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-8 w-72 h-72 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-tosca-100 text-xs font-bold tracking-wide shadow-xs">
              <div className="w-6 h-6 rounded-full bg-white p-0.5 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                <img src={PKK_LOGO_BASE64} alt="Logo PKK Resmi" className="w-full h-full object-contain" />
              </div>
              <span>TIM PENGGERAK PKK KELURAHAN MANGGA</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Buku I s/d VI PKK Kelurahan</span>
            </h1>
            <p className="text-tosca-100/95 text-xs sm:text-sm font-medium max-w-2xl leading-relaxed">
              Selamat datang di Portal Administrasi Sekretaris PKK. Kelola 6 Buku Wajib PKK secara terpadu, tersinkronisasi awan, dan real-time.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { resetForm(); setIsFormOpen(true); }}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-tosca-800 font-extrabold hover:bg-tosca-50 transition-all shadow-lg hover:shadow-xl cursor-pointer self-start md:self-center shrink-0"
          >
            <Plus className="w-4 h-4 text-tosca-800 font-bold" />
            <span>Tambah Entri Buku {activeBook}</span>
          </button>
        </div>
      </div>

      <RealtimeSyncStatusPanel />

      {/* Floating Glass Capsule Tab Switcher */}
      <div className="bg-white/90 p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-2">
        {([1, 2, 3, 4, 5, 6] as const).map((bookNum) => {
          const Meta = bookMeta[bookNum];
          return (
            <button
              key={bookNum}
              type="button"
              onClick={() => { setActiveBuku(bookNum); setSearchQuery(''); }}
              className={`flex-1 min-w-[130px] sm:min-w-[150px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeBook === bookNum
                  ? 'bg-tosca-700 text-white shadow-md shadow-tosca-700/10 scale-[1.01]'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Meta.icon className={`w-4 h-4 ${activeBook === bookNum ? 'text-white' : 'text-tosca-600'}`} />
              <span>Buku {bookNum}</span>
            </button>
          );
        })}
      </div>

      {/* Header Info of Active Book */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-tosca-100 text-tosca-800 rounded-xl">
            <ActiveIcon className="w-6 h-6 text-tosca-700" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-black text-slate-800">{bookMeta[activeBook].title}</h2>
            <p className="text-slate-500 text-xs font-medium max-w-xl">{bookMeta[activeBook].desc}</p>
          </div>
        </div>

        {/* Search Bar & Print Action */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={`Cari di Buku ${activeBook}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-tosca-500/20 focus:border-tosca-500/80 transition-all"
            />
          </div>
          {activeBook === 1 && (
            <button
              type="button"
              onClick={() => setSelectedCardMember(buku1List[0] || { nama: 'NUR AINI, S.Pd.' })}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-extrabold rounded-xl text-xs cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
              title="Lihat & Cetak Kartu Tanda Anggota (KTA) PKK Seluruh Anggota"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-300" />
              <span>Kartu Anggota All</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => printOfficialDocument('lembar-cetak-buku-pkk', `BUKU_ADMINISTRASI_${activeBook}_PKK_${getTodayLocalIso()}`)}
            className="px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-xl text-xs cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
            title="Cetak Buku Administrasi PKK dengan Kop Surat Resmi"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Buku</span>
          </button>
        </div>
      </div>

      {/* Main Data Table Area (Printable with Official Kop Surat) */}
      <div id="lembar-cetak-buku-pkk" className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden p-4 sm:p-6 uppercase">
        {/* Printable Kop Surat - Only Visible when printing or formatted */}
        <div className="hidden print:block mb-4">
          <KopSuratPkk />
          <div className="text-center my-2">
            <h2 className="text-sm font-black uppercase text-slate-900 underline">
              {bookMeta[activeBook].title}
            </h2>
            <p className="text-[10px] text-slate-600 font-medium">{bookMeta[activeBook].desc}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {currentFilteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Info className="w-10 h-10 text-slate-300" />
              <p className="text-xs font-bold">Belum ada data administrasi tercatat di Buku {activeBook}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              {activeBook === 1 && (
                <>
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">No</th>
                      <th className="px-5 py-3">Nama Lengkap</th>
                      <th className="px-5 py-3">Jabatan</th>
                      <th className="px-5 py-3">L/P</th>
                      <th className="px-5 py-3">TTL</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Pendidikan</th>
                      <th className="px-5 py-3">Pekerjaan</th>
                      <th className="px-5 py-3">Alamat</th>
                      <th className="px-5 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                    {currentFilteredList.map((it: PkkBuku1Anggota, idx) => (
                      <tr key={it.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-bold text-slate-800">{idx + 1}</td>
                        <td className="px-5 py-3 font-black text-slate-800">{it.nama}</td>
                        <td className="px-5 py-3 text-tosca-800 font-extrabold">{it.jabatan}</td>
                        <td className="px-5 py-3 font-bold">{it.jenisKelamin}</td>
                        <td className="px-5 py-3">{it.tempatLahir || '-'}{it.tanggalLahir ? `, ${formatSafeDate(it.tanggalLahir)}` : ''}</td>
                        <td className="px-5 py-3">{it.statusPerkawinan || it.statusPernikahan || '-'}</td>
                        <td className="px-5 py-3 font-bold">{it.pendidikan}</td>
                        <td className="px-5 py-3">{it.pekerjaan}</td>
                        <td className="px-5 py-3 max-w-[150px] truncate">{it.alamat}</td>
                        <td className="px-5 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedCardMember(it)}
                              className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                              title="Lihat & Cetak Kartu Anggota PKK"
                            >
                              <CreditCard className="w-3.5 h-3.5 text-amber-300" />
                              <span>Kartu Anggota</span>
                            </button>
                            <button onClick={() => handleEditInit(it)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 cursor-pointer" title="Edit Data">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteItem(it.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer" title="Hapus Data">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {activeBook === 2 && (
                <>
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">No</th>
                      <th className="px-5 py-3">No. Surat</th>
                      <th className="px-5 py-3">Tgl Surat</th>
                      <th className="px-5 py-3">Jenis</th>
                      <th className="px-5 py-3">Asal / Penerima</th>
                      <th className="px-5 py-3">Perihal</th>
                      <th className="px-5 py-3">Keterangan</th>
                      <th className="px-5 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                    {currentFilteredList.map((it: SuratKedinasanItem, idx) => (
                      <tr key={it.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-bold text-slate-800">{idx + 1}</td>
                        <td className="px-5 py-3 font-black text-slate-800">{it.nomorSurat}</td>
                        <td className="px-5 py-3 font-bold text-slate-700">{formatSafeDate(it.tanggalSurat)}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            it.jenisSurat === 'SURAT_MASUK' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {it.jenisSurat === 'SURAT_MASUK' ? 'Masuk' : 'Keluar'}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-800">{it.jenisSurat === 'SURAT_MASUK' ? it.asalSurat : it.tujuanSurat}</td>
                        <td className="px-5 py-3 text-slate-800 font-bold max-w-[200px] truncate">{it.perihal}</td>
                        <td className="px-5 py-3 text-slate-500 italic max-w-[150px] truncate">{it.isiRingkas}</td>
                        <td className="px-5 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {it.fileUrl && (
                              <a
                                href={it.fileUrl}
                                download={it.fileName || 'scan_surat.pdf'}
                                className="p-1.5 text-emerald-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 cursor-pointer transition-colors"
                                title={`Unduh Lampiran: ${it.fileName}`}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button onClick={() => handleEditInit(it)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 cursor-pointer">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteItem(it.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {activeBook === 3 && (
                <>
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">No</th>
                      <th className="px-5 py-3">Tanggal</th>
                      <th className="px-5 py-3">No. Bukti</th>
                      <th className="px-5 py-3">Uraian / Keterangan</th>
                      <th className="px-5 py-3">Kategori</th>
                      <th className="px-5 py-3 text-right">Penerima (Debet)</th>
                      <th className="px-5 py-3 text-right">Pengeluaran (Kredit)</th>
                      <th className="px-5 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                    {currentFilteredList.map((it: any, idx) => (
                      <tr key={it.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-bold text-slate-800">{idx + 1}</td>
                        <td className="px-5 py-3 font-bold">{formatSafeDate(it.tanggal)}</td>
                        <td className="px-5 py-3 font-black text-slate-800">{it.nomorBukti || '-'}</td>
                        <td className="px-5 py-3 font-bold text-slate-800 max-w-[200px] truncate">{it.uraian || it.keterangan || '-'}</td>
                        <td className="px-5 py-3">{POS_ANGGARAN_LABELS[it.posAnggaran] || it.posAnggaran || it.kategori || '-'}</td>
                        <td className="px-5 py-3 text-right font-black text-emerald-600">
                          {it.jenis === 'PENERIMAAN' ? formatRupiah(it.jumlah) : '-'}
                        </td>
                        <td className="px-5 py-3 text-right font-black text-rose-600">
                          {it.jenis === 'PENGELUARAN' ? formatRupiah(it.jumlah) : '-'}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleEditInit(it)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 cursor-pointer">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteItem(it.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {activeBook === 4 && (
                <>
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">No</th>
                      <th className="px-5 py-3">Tanggal Rapat</th>
                      <th className="px-5 py-3">Agenda / Acara</th>
                      <th className="px-5 py-3">Pimpinan Rapat</th>
                      <th className="px-5 py-3">Peserta</th>
                      <th className="px-5 py-3">Hasil Keputusan</th>
                      <th className="px-5 py-3">Catatan Rapat</th>
                      <th className="px-5 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                    {currentFilteredList.map((it: PkkBuku4Notulen, idx) => (
                      <tr key={it.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-bold text-slate-800">{idx + 1}</td>
                        <td className="px-5 py-3 font-bold text-slate-700">{formatSafeDate(it.tanggalRapat || it.tanggal)}</td>
                        <td className="px-5 py-3 font-black text-slate-800 max-w-[150px] truncate">{it.agenda || it.acara || '-'}</td>
                        <td className="px-5 py-3 text-tosca-800 font-extrabold">{it.pimpinanRapat || '-'}</td>
                        <td className="px-5 py-3 font-bold text-slate-800">{it.jumlahPeserta || 0} jiwa</td>
                        <td className="px-5 py-3 font-semibold text-slate-800 max-w-[180px] truncate">{it.hasilKeputusan || it.keputusanRapat || '-'}</td>
                        <td className="px-5 py-3 text-slate-500 italic max-w-[150px] truncate">{it.catatanRapat || it.notulenRingkas || '-'}</td>
                        <td className="px-5 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleEditInit(it)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 cursor-pointer">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteItem(it.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {activeBook === 5 && (
                <>
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">No</th>
                      <th className="px-5 py-3">Nama Barang</th>
                      <th className="px-5 py-3">Asal Barang</th>
                      <th className="px-5 py-3">Tgl Perolehan</th>
                      <th className="px-5 py-3">Jumlah</th>
                      <th className="px-5 py-3">Kondisi</th>
                      <th className="px-5 py-3">Keterangan</th>
                      <th className="px-5 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                    {currentFilteredList.map((it: PkkBuku5Inventaris, idx) => (
                      <tr key={it.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-bold text-slate-800">{idx + 1}</td>
                        <td className="px-5 py-3 font-black text-slate-800">{it.namaBarang}</td>
                        <td className="px-5 py-3 font-semibold">{it.asalBarang}</td>
                        <td className="px-5 py-3">{formatSafeDate(it.tanggalPerolehan)}</td>
                        <td className="px-5 py-3 font-extrabold text-slate-800">{it.jumlah} unit</td>
                        <td className="px-5 py-3">
                          {(() => {
                            const kond = it.kondisi || it.kondisiBarang || 'Baik';
                            return (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                kond === 'Baik' ? 'bg-emerald-100 text-emerald-800' :
                                kond === 'Cukup' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {kond}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-5 py-3 text-slate-500 max-w-[150px] truncate">{it.keterangan}</td>
                        <td className="px-5 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleEditInit(it)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 cursor-pointer">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteItem(it.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {activeBook === 6 && (
                <>
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">No</th>
                      <th className="px-5 py-3">Nama Kegiatan</th>
                      <th className="px-5 py-3">Tgl Pelaksanaan</th>
                      <th className="px-5 py-3">Tempat / Lokasi</th>
                      <th className="px-5 py-3">Kelompok / Pokja</th>
                      <th className="px-5 py-3">Catatan / Deskripsi</th>
                      <th className="px-5 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                    {currentFilteredList.map((it: any, idx) => (
                      <tr key={it.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-bold text-slate-800">{idx + 1}</td>
                        <td className="px-5 py-3 font-black text-slate-800">{it.namaKegiatan || it.judul}</td>
                        <td className="px-5 py-3 font-bold text-slate-700">{formatSafeDate(it.tanggal || it.tanggalPelaksanaan)}</td>
                        <td className="px-5 py-3 font-semibold text-slate-800 truncate max-w-[150px]">{it.lokasi || it.tempat || '-'}</td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 rounded-sm bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold">
                            {POKJA_LABELS[normalizePokjaValue(it.pokja)] || it.pokja || 'Sekretariat TP PKK'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-500 italic max-w-[200px] truncate">{it.uraianHasil || it.keterangan || it.deskripsi || '-'}</td>
                        <td className="px-5 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleEditInit(it)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 cursor-pointer">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteItem(it.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          )}
        </div>
      </div>

      {/* Dynamic Form Modal (Universal for 6 Books) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 bg-tosca-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-tosca-200" />
                <h3 className="font-bold text-sm sm:text-base text-white">
                  {editingItem ? 'Edit' : 'Tambah'} Entri {bookMeta[activeBook].title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {activeBook === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Nama Lengkap</label>
                      <input type="text" value={b1Nama} onChange={(e) => setB1Nama(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Nama pengurus/kader" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Jabatan di TP-PKK</label>
                      <input type="text" value={b1Jabatan} onChange={(e) => setB1Jabatan(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. Sekretaris Pokja I" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Jenis Kelamin</label>
                      <select value={b1Gender} onChange={(e) => setB1Gender(e.target.value as 'L' | 'P')} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <option value="P">Perempuan (P)</option>
                        <option value="L">Laki-laki (L)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Status Pernikahan</label>
                      <select value={b1Status} onChange={(e) => setB1Status(e.target.value as any)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <option value="Kawin">Kawin</option>
                        <option value="Belum Kawin">Belum Kawin</option>
                        <option value="Janda/Duda">Janda/Duda</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Tempat Lahir</label>
                      <input type="text" value={b1TempatLahir} onChange={(e) => setB1TempatLahir(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Tempat lahir" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Tanggal Lahir</label>
                      <input type="date" value={b1TglLahir} onChange={(e) => setB1TglLahir(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Pendidikan Terakhir</label>
                      <input type="text" value={b1Pendidikan} onChange={(e) => setB1Pendidikan(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. S1 Sarjana" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Pekerjaan</label>
                      <input type="text" value={b1Pekerjaan} onChange={(e) => setB1Pekerjaan(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. PNS, Wiraswasta" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700">Alamat Rumah</label>
                    <textarea value={b1Alamat} onChange={(e) => setB1Alamat(e.target.value)} rows={2} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Alamat lengkap tempat tinggal" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700">Keterangan / Catatan Tambahan</label>
                    <input type="text" value={b1Keterangan} onChange={(e) => setB1Keterangan(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. Aktif sejak 2024" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-extrabold text-slate-700">Pasfoto</label>
                      {isCompressingPhoto && (
                        <span className="text-[10px] font-bold text-sky-600 flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Mengompres foto...
                        </span>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isCompressingPhoto || isSaving}
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          try {
                            setIsCompressingPhoto(true);
                            // Compress phone/camera photos down to crisp lightweight ~30KB JPEG
                            const compressed = await compressImageFile(file, 480, 0.75);
                            setB1PasphotoUrl(compressed);
                          } catch (err) {
                            console.error('Photo compression error:', err);
                            const fallback = await fileToBase64(file);
                            setB1PasphotoUrl(fallback);
                          } finally {
                            setIsCompressingPhoto(false);
                          }
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                    {b1PasphotoUrl && (
                      <div className="flex items-center gap-3 mt-2">
                        <img src={b1PasphotoUrl} className="w-16 h-20 object-cover rounded-lg border border-slate-300 shadow-xs" alt="Preview" />
                        <button
                          type="button"
                          onClick={() => setB1PasphotoUrl('')}
                          className="text-xs text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                        >
                          Hapus Foto
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeBook === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Nomor Surat</label>
                      <input type="text" value={b2Nomor} onChange={(e) => setB2Nomor(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. 05/PKK-MGG/X/2026" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Tanggal Agenda / Surat</label>
                      <input type="date" value={b2Tanggal} onChange={(e) => setB2Tanggal(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Jenis Agenda</label>
                      <select value={b2Jenis} onChange={(e) => setB2Jenis(e.target.value as JenisSuratKedinasan)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <option value="SURAT_MASUK">Surat Masuk</option>
                        <option value="SURAT_KELUAR">Surat Keluar</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">
                        {b2Jenis === 'SURAT_MASUK' ? 'Asal Instansi Pengirim' : 'Instansi Tujuan Surat'}
                      </label>
                      <input type="text" value={b2AsalTujuan} onChange={(e) => setB2AsalTujuan(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. TP-PKK Kecamatan" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700">Perihal Surat</label>
                    <input type="text" value={b2Perihal} onChange={(e) => setB2Perihal(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. Undangan rapat koordinasi bulanan" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700">Isi Ringkas / Keterangan</label>
                    <textarea value={b2Keterangan} onChange={(e) => setB2Keterangan(e.target.value)} rows={3} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Ringkasan singkat pesan dalam surat..." />
                  </div>
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700">Lampiran PDF (Scan Surat)</label>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 hover:border-tosca-300 transition-all group">
                        <FileUp className={`w-4 h-4 ${isUploading ? 'animate-bounce text-tosca-500' : 'text-slate-400 group-hover:text-tosca-600'}`} />
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-tosca-700">
                          {isUploading ? 'Sedang Memproses...' : (b2FileName || 'Klik untuk Unggah PDF')}
                        </span>
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 2 * 1024 * 1024) {
                                onShowToast?.('Ukuran file terlalu besar! Maksimal 2MB untuk PDF.', 'error');
                                return;
                              }
                              try {
                                setIsUploading(true);
                                const base64 = await fileToBase64(file);
                                setB2FileUrl(base64);
                                setB2FileName(file.name);
                              } catch (err) {
                                console.error('Upload error:', err);
                                onShowToast?.('Gagal memproses file PDF.', 'error');
                              } finally {
                                setIsUploading(false);
                              }
                            }
                          }}
                        />
                      </label>
                      {b2FileUrl && (
                        <button
                          type="button"
                          onClick={() => { setB2FileUrl(''); setB2FileName(''); }}
                          className="p-2.5 text-rose-600 bg-rose-50 border border-rose-100 rounded-xl hover:bg-rose-100 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium italic">Format .pdf, Maksimal 2MB</p>
                  </div>
                </div>
              )}

              {activeBook === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Tanggal Transaksi</label>
                      <input type="date" value={b3Tanggal} onChange={(e) => setB3Tanggal(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Nomor Bukti Kas</label>
                      <input type="text" value={b3NomorBukti} onChange={(e) => setB3NomorBukti(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. BKM-002, BKK-015" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Jenis Aliran Dana</label>
                      <select value={b3Jenis} onChange={(e) => setB3Jenis(e.target.value as 'PENERIMAAN' | 'PENGELUARAN')} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <option value="PENERIMAAN">Penerimaan (Debet Kas)</option>
                        <option value="PENGELUARAN">Pengeluaran (Kredit Kas)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Nominal Transaksi (Rupiah)</label>
                      <input type="number" value={b3Jumlah || ''} onChange={(e) => setB3Jumlah(Number(e.target.value))} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Nominal Rp" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700">Pos / Kategori Anggaran</label>
                    <select value={b3Kategori} onChange={(e) => setB3Kategori(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      {Object.entries(POS_ANGGARAN_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                      {!(b3Kategori in POS_ANGGARAN_LABELS) && b3Kategori && (
                        <option value={b3Kategori}>{b3Kategori}</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700">Uraian / Keterangan Transaksi</label>
                    <textarea value={b3Keterangan} onChange={(e) => setB3Keterangan(e.target.value)} rows={2} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. Iuran kas rutin anggota / pembelian konsumsi rapat" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700">Foto Bukti Kwitansi / Tanda Terima</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          try {
                            const compressed = await compressImageFile(file, 720, 0.70);
                            setB3Bukti(compressed);
                          } catch (err) {
                            const fallback = await fileToBase64(file);
                            setB3Bukti(fallback);
                          }
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                    {b3Bukti && <img src={b3Bukti} className="w-16 h-16 object-cover rounded mt-2 border border-slate-300" alt="Preview" />}
                  </div>
                </div>
              )}

              {activeBook === 4 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Tanggal Pertemuan/Rapat</label>
                      <input type="date" value={b4Tanggal} onChange={(e) => setB4Tanggal(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Pimpinan Pertemuan</label>
                      <input type="text" value={b4Pimpinan} onChange={(e) => setB4Pimpinan(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. Ny. Fransiska Fery Arapenta Tarigan (Ketua Tim Penggerak PKK)" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Jumlah Peserta Rapat (Jiwa)</label>
                      <input type="number" value={b4Peserta || ''} onChange={(e) => setB4Peserta(Number(e.target.value))} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Jumlah hadirin" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Agenda / Acara Pembahasan</label>
                      <input type="text" value={b4Agenda} onChange={(e) => setB4Agenda(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. Koordinasi posyandu balita" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700">Hasil Keputusan Rapat (Keputusan Wajib)</label>
                    <textarea value={b4Keputusan} onChange={(e) => setB4Keputusan(e.target.value)} rows={2} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Hasil keputusan utama rapat..." />
                  </div>
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700">Notulensi / Jalannya Pertemuan</label>
                    <textarea value={b4Catatan} onChange={(e) => setB4Catatan(e.target.value)} rows={3} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Ringkasan diskusi, usulan, dan jalannya rapat..." />
                  </div>
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700">Keterangan Tambahan</label>
                    <input type="text" value={b4Keterangan} onChange={(e) => setB4Keterangan(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. Bertempat di aula kelurahan" />
                  </div>
                </div>
              )}

              {activeBook === 5 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Nama Barang Inventaris</label>
                      <input type="text" value={b5Nama} onChange={(e) => setB5Nama(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. Meja Rapat, Timbangan Dacin" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Asal / Sumber Perolehan</label>
                      <input type="text" value={b5Asal} onChange={(e) => setB5Asal(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. Bantuan Pemko, Pembelian Kas" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Jumlah Barang (Unit)</label>
                      <input type="number" value={b5Jumlah || ''} onChange={(e) => setB5Jumlah(Number(e.target.value))} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Jumlah unit" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Tanggal Perolehan</label>
                      <input type="date" value={b5Tanggal} onChange={(e) => setB5Tanggal(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700">Kondisi Barang Saat Ini</label>
                    <select value={b5Kondisi} onChange={(e) => setB5Kondisi(e.target.value as any)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <option value="Baik">Baik (Dapat Berfungsi Normal)</option>
                      <option value="Cukup">Cukup (Masih Layak Pakai)</option>
                      <option value="Rusak Ringan">Rusak Ringan</option>
                      <option value="Rusak Berat">Rusak Berat (Butuh Penggantian)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700">Keterangan Inventaris</label>
                    <input type="text" value={b5Keterangan} onChange={(e) => setB5Keterangan(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. Disimpan di ruang Sekretariat PKK" />
                  </div>
                </div>
              )}

              {activeBook === 6 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Nama Pelaksanaan Kegiatan</label>
                      <input type="text" value={b6Nama} onChange={(e) => setB6Nama(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. Sosialisasi Pencegahan Stunting" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Tanggal Pelaksanaan</label>
                      <input type="date" value={b6Tanggal} onChange={(e) => setB6Tanggal(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Kelompok / Pokja Pelaksana</label>
                      <select value={b6Pokja} onChange={(e) => setB6Pokja(e.target.value as any)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        {Object.entries(POKJA_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-700">Tempat / Lokasi Kegiatan</label>
                      <input type="text" value={b6Tempat} onChange={(e) => setB6Tempat(e.target.value)} required className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="cth. Aula Posyandu Lingkungan V" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-extrabold text-slate-700">Catatan Kegiatan / Uraian Hasil Pelaksanaan</label>
                      <button
                        type="button"
                        onClick={handleImproveLanguage}
                        disabled={isImprovingLanguage || !b6Keterangan.trim()}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-tosca-50 text-tosca-700 border border-tosca-200 text-[9px] font-black hover:bg-tosca-100 transition-all disabled:opacity-50 cursor-pointer"
                        title="Klik untuk memperbaiki tata bahasa, ejaan, dan gaya penulisan menjadi lebih formal menggunakan AI"
                      >
                        {isImprovingLanguage ? (
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-2.5 h-2.5" />
                        )}
                        <span>Perbaiki Bahasa (AI)</span>
                      </button>
                    </div>
                    <textarea
                      value={b6Keterangan}
                      onChange={(e) => setB6Keterangan(e.target.value)}
                      rows={5}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium leading-relaxed"
                      placeholder="Ringkasan pelaksanaan program kerja, sasaran, materi penyuluhan, dan hasil nyata kegiatan..."
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-150 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSaving}
                  className="px-4.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-tosca-700 hover:bg-tosca-800 text-white font-extrabold text-xs cursor-pointer shadow-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{isSaving ? 'Sedang Menyimpan...' : 'Simpan Entri'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCardMember && (
        <PkkCardModal
          isOpen={Boolean(selectedCardMember)}
          onClose={() => setSelectedCardMember(null)}
          member={selectedCardMember}
          allMembers={buku1List}
        />
      )}
    </div>
  );
};
