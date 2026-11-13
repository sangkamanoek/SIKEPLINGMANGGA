import React, { useState, useEffect, useMemo, useRef } from 'react';
import { printOfficialDocument } from '../utils/printHelper';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  Building,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  Check,
  Printer,
  Sparkles,
  Tag,
  FileCheck,
  Send,
  Inbox,
  ShieldCheck,
  UploadCloud,
  Paperclip,
  ExternalLink,
  Eye,
  AlertCircle,
  File,
} from 'lucide-react';
import { UserAccount, SuratKedinasanItem, JenisSuratKedinasan, isPkkRole } from '../types';
import {
  subscribeSurat,
  saveSuratItem,
  deleteSuratItem,
  getSuratWithAttachment,
} from '../lib/suratService';
import { getTodayLocalIso, formatTanggalIndonesia } from '../lib/formatter';
import { KopSuratResmi } from './KopSuratResmi';
import { KopSuratPkk } from './KopSuratPkk';

interface SuratKedinasanViewProps {
  currentUser: UserAccount;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const JENIS_SURAT_LABELS: Record<JenisSuratKedinasan, { label: string; bg: string; text: string }> = {
  SURAT_MASUK: { label: 'Surat Masuk', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800' },
  SURAT_KELUAR: { label: 'Surat Keluar', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800' },
  NOTA_DINAS: { label: 'Nota Dinas', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
  SURAT_EDARAN: { label: 'Surat Edaran', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800' },
  SURAT_KETERANGAN: { label: 'Surat Keterangan', bg: 'bg-teal-50 border-teal-200', text: 'text-teal-800' },
  SK_LURAH: { label: 'SK Lurah', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-800' },
  UNDANGAN: { label: 'Undangan Resmi', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-800' },
};

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const header = dataUrl.slice(0, commaIdx);
    const base64 = dataUrl.slice(commaIdx + 1);
    const mimeMatch = header.match(/data:([^;]+);/i);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

export const SuratKedinasanView: React.FC<SuratKedinasanViewProps> = ({ currentUser, onShowToast }) => {
  const [suratList, setSuratList] = useState<SuratKedinasanItem[]>([]);
  const [filterJenis, setFilterJenis] = useState<string>('ALL');
  const [filterSifat, setFilterSifat] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingSurat, setEditingSurat] = useState<SuratKedinasanItem | null>(null);
  const [previewSurat, setPreviewSurat] = useState<SuratKedinasanItem | null>(null);
  const [viewingPdfSurat, setViewingPdfSurat] = useState<SuratKedinasanItem | null>(null);

  // Form State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const todayStr = useMemo(() => getTodayLocalIso(), []);
  const [formNomor, setFormNomor] = useState<string>('');
  const [formTanggal, setFormTanggal] = useState<string>(todayStr);
  const [formJenis, setFormJenis] = useState<JenisSuratKedinasan>('SURAT_KELUAR');
  const [formPerihal, setFormPerihal] = useState<string>('');
  const [formAsalTujuan, setFormAsalTujuan] = useState<string>('');
  const [formSifat, setFormSifat] = useState<'BIASA' | 'PENTING' | 'RAHASIA' | 'SEGERA'>('BIASA');
  const [formStatus, setFormStatus] = useState<'DRAFT' | 'TERCATAT' | 'DISETUJUI' | 'DIARSIPKAN'>('DISETUJUI');
  const [formIsi, setFormIsi] = useState<string>('');
  const [formPenandatangan, setFormPenandatangan] = useState<string>('Lurah Kelurahan Mangga');

  // File PDF Attachment State
  const [formFileUrl, setFormFileUrl] = useState<string>('');
  const [formFileName, setFormFileName] = useState<string>('');
  const [formFileSize, setFormFileSize] = useState<number | undefined>(undefined);
  const [formFileType, setFormFileType] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const fileUrl = viewingPdfSurat?.fileUrl;
    if (!fileUrl) {
      setPdfBlobUrl(null);
      return;
    }
    if (!fileUrl.startsWith('data:')) {
      setPdfBlobUrl(fileUrl);
      return;
    }
    const blob = dataUrlToBlob(fileUrl);
    if (!blob) {
      setPdfBlobUrl(fileUrl);
      return;
    }
    const objUrl = URL.createObjectURL(blob);
    setPdfBlobUrl(objUrl);
    return () => {
      try {
        URL.revokeObjectURL(objUrl);
      } catch {}
    };
  }, [viewingPdfSurat?.fileUrl]);

  useEffect(() => {
    const unsubscribe = subscribeSurat(
      (items) => setSuratList(items),
      (err) => console.warn('Surat subscribe error:', err)
    );
    return () => unsubscribe();
  }, []);

  const filteredList = useMemo(() => {
    return suratList.filter((item) => {
      // 1. Separation Logic: PKK vs Kelurahan
      const isPkk = isPkkRole(currentUser.role);
      const itemIsPkk = item.kategori === 'PKK' || (
        !item.kategori && (
          isPkkRole(item.dibuatOlehRole || '') ||
          (item.asalSurat || '').toLowerCase().includes('pkk') ||
          (item.nomorSurat || '').toLowerCase().includes('pkk') ||
          (item.tujuanSurat || '').toLowerCase().includes('pkk')
        )
      );

      if (isPkk && !itemIsPkk) return false;
      if (!isPkk && itemIsPkk) return false;

      // 2. Regular Filters
      if (filterJenis !== 'ALL' && item.jenisSurat !== filterJenis) return false;
      if (filterSifat !== 'ALL' && item.sifat !== filterSifat) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = item.nomorSurat.toLowerCase().includes(q);
        const matchPerihal = item.perihal.toLowerCase().includes(q);
        const matchIsi = item.isiRingkas.toLowerCase().includes(q);
        const matchPihak = (item.asalSurat || item.tujuanSurat || '').toLowerCase().includes(q);
        const matchFile = (item.fileName || '').toLowerCase().includes(q);
        if (!matchNo && !matchPerihal && !matchIsi && !matchPihak && !matchFile) return false;
      }
      return true;
    });
  }, [suratList, filterJenis, filterSifat, searchQuery, currentUser.role]);

  const stats = useMemo(() => {
    const total = filteredList.length;
    const masuk = filteredList.filter((x) => x.jenisSurat === 'SURAT_MASUK').length;
    const keluar = filteredList.filter((x) => x.jenisSurat === 'SURAT_KELUAR' || x.jenisSurat === 'NOTA_DINAS' || x.jenisSurat === 'SURAT_EDARAN').length;
    const sk = filteredList.filter((x) => x.jenisSurat === 'SK_LURAH' || x.jenisSurat === 'UNDANGAN').length;
    const withPdf = filteredList.filter((x) => !!x.fileUrl).length;
    return { total, masuk, keluar, sk, withPdf };
  }, [filteredList]);

  const handleOpenAdd = () => {
    setEditingSurat(null);
    setFormNomor(`005 / ${Math.floor(100 + Math.random() * 900)} / X / 2026`);
    setFormTanggal(todayStr);
    setFormJenis('SURAT_KELUAR');
    setFormPerihal('');
    setFormAsalTujuan('');
    setFormSifat('BIASA');
    setFormStatus('DISETUJUI');
    setFormIsi('');
    setFormPenandatangan('Lurah Kelurahan Mangga');
    setFormFileUrl('');
    setFormFileName('');
    setFormFileSize(undefined);
    setFormFileType('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: SuratKedinasanItem) => {
    setEditingSurat(item);
    setFormNomor(item.nomorSurat);
    setFormTanggal(item.tanggalSurat);
    setFormJenis(item.jenisSurat);
    setFormPerihal(item.perihal);
    setFormAsalTujuan(item.asalSurat || item.tujuanSurat || '');
    setFormSifat(item.sifat);
    setFormStatus(item.status);
    setFormIsi(item.isiRingkas);
    setFormPenandatangan(item.penandatangan || 'Lurah Kelurahan Mangga');
    setFormFileUrl(item.fileUrl || '');
    setFormFileName(item.fileName || '');
    setFormFileSize(item.fileSize);
    setFormFileType(item.fileType || '');
    setIsFormOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 15MB to stay memory-safe across mobile/desktop browsers)
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      onShowToast('Ukuran file maksimal adalah 15 MB!', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessingFile(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setFormFileUrl(result);
        setFormFileName(file.name);
        setFormFileSize(file.size);
        setFormFileType(file.type || 'application/pdf');
        onShowToast(`File "${file.name}" (${formatFileSize(file.size)}) berhasil dimuat dan siap disimpan!`, 'success');
      }
      setIsProcessingFile(false);
    };
    reader.onerror = () => {
      onShowToast('Gagal membaca file berkas.', 'error');
      setIsProcessingFile(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveFile = () => {
    setFormFileUrl('');
    setFormFileName('');
    setFormFileSize(undefined);
    setFormFileType('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onShowToast('Lampiran file PDF dihapus dari form.', 'info');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNomor.trim() || !formPerihal.trim()) {
      onShowToast('Nomor surat dan perihal harus diisi!', 'error');
      return;
    }

    const newItem: SuratKedinasanItem = {
      id: editingSurat ? editingSurat.id : 'surat_' + Date.now(),
      nomorSurat: formNomor.trim(),
      tanggalSurat: formTanggal,
      jenisSurat: formJenis,
      perihal: formPerihal.trim(),
      kategori: isPkkRole(currentUser.role) ? 'PKK' : 'KELURAHAN',
      asalSurat: formJenis === 'SURAT_MASUK' ? formAsalTujuan.trim() : undefined,
      tujuanSurat: formJenis !== 'SURAT_MASUK' ? formAsalTujuan.trim() : undefined,
      sifat: formSifat,
      status: formStatus,
      isiRingkas: formIsi.trim(),
      fileUrl: formFileUrl.trim() || undefined,
      fileName: formFileName.trim() || undefined,
      fileSize: formFileSize,
      fileType: formFileType.trim() || undefined,
      penandatangan: formPenandatangan.trim(),
      dibuatOlehNama: currentUser.nama,
      dibuatOlehRole: currentUser.role,
      createdAt: editingSurat ? editingSurat.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveSuratItem(newItem);
      onShowToast(
        editingSurat
          ? 'Surat berhasil diperbarui!'
          : `Arsip surat baru beserta berkas ${newItem.fileName ? `(${newItem.fileName})` : ''} berhasil disimpan ke sistem!`,
        'success'
      );
      setIsFormOpen(false);
    } catch (err) {
      onShowToast('Gagal menyimpan arsip surat.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Yakin ingin menghapus arsip surat kedinasan ini?')) {
      try {
        await deleteSuratItem(id);
        onShowToast('Arsip surat berhasil dihapus dari sistem.', 'info');
      } catch {
        onShowToast('Gagal menghapus arsip surat.', 'error');
      }
    }
  };

  const handleOpenPdfViewer = async (item: SuratKedinasanItem) => {
    let targetItem = item;
    if (!targetItem.fileUrl) {
      onShowToast('Memuat berkas PDF dari penyimpanan sistem...', 'info');
      const full = await getSuratWithAttachment(item.id);
      if (full && full.fileUrl) {
        targetItem = full;
      } else {
        onShowToast('Berkas lampiran PDF belum dapat dimuat.', 'error');
        return;
      }
    }
    setViewingPdfSurat(targetItem);
  };

  const handleDownloadPdf = async (item: SuratKedinasanItem) => {
    let fileUrl = item.fileUrl;
    if (!fileUrl) {
      onShowToast('Mengambil berkas PDF dari penyimpanan sistem...', 'info');
      const full = await getSuratWithAttachment(item.id);
      fileUrl = full?.fileUrl;
    }

    if (!fileUrl) {
      onShowToast('Tidak ada lampiran file PDF pada surat ini.', 'error');
      return;
    }

    let tempBlobUrl: string | null = null;
    try {
      let downloadHref = fileUrl;
      if (fileUrl.startsWith('data:')) {
        const blob = dataUrlToBlob(fileUrl);
        if (blob) {
          tempBlobUrl = URL.createObjectURL(blob);
          downloadHref = tempBlobUrl;
        }
      }
      const link = document.createElement('a');
      link.href = downloadHref;
      link.download = item.fileName || `Arsip_Surat_${item.nomorSurat.replace(/[\/\s]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onShowToast(`Mengunduh berkas ${item.fileName || 'PDF'}...`, 'success');
    } catch {
      onShowToast('Gagal memulai unduhan otomatis berkas.', 'error');
    } finally {
      if (tempBlobUrl) {
        const toRevoke = tempBlobUrl;
        setTimeout(() => {
          try {
            URL.revokeObjectURL(toRevoke);
          } catch {}
        }, 10000);
      }
    }
  };

  const handlePrintSurat = (item: SuratKedinasanItem) => {
    const docTitle = `Surat_${item.nomorSurat || 'Kedinasan'}_${item.perihal || 'Dokumen'}`;
    printOfficialDocument('lembar-cetak-surat-kedinasan', docTitle);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header Banner for Surat Kedinasan */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/30 border border-blue-400/40 text-blue-200 text-xs font-bold">
            <FileText className="w-3.5 h-3.5" />
            <span>Pilar 3 • Layanan Surat Kedinasan & Pengarsipan</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Pusat Pengarsipan & Surat Kedinasan
          </h1>
          <p className="text-blue-100/90 text-xs sm:text-sm leading-relaxed">
            Kelola surat masuk, surat keluar, nota dinas, surat edaran, SK lurah, dan undangan resmi Kelurahan Mangga secara terintegrasi dan transparan lengkap dengan lampiran berkas digital (PDF).
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-5 py-3 rounded-2xl bg-white hover:bg-blue-50 text-blue-950 font-black text-xs sm:text-sm shadow-lg transition-all cursor-pointer flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 text-blue-700" />
            <span>Catat / Buat Surat Baru</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Total Arsip</div>
            <div className="text-xl font-black text-slate-900 mt-0.5">{stats.total}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Surat Masuk</div>
            <div className="text-xl font-black text-indigo-900 mt-0.5">{stats.masuk}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Surat Keluar / Nota</div>
            <div className="text-xl font-black text-emerald-900 mt-0.5">{stats.keluar}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-black">
            <Paperclip className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Lampiran Berkas PDF</div>
            <div className="text-xl font-black text-rose-900 mt-0.5">{stats.withPdf}</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nomor surat, perihal, file PDF, tujuan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-blue-600 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl overflow-x-auto">
              <button
                type="button"
                onClick={() => setFilterJenis('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterJenis === 'ALL' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Jenis
              </button>
              <button
                type="button"
                onClick={() => setFilterJenis('SURAT_MASUK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterJenis === 'SURAT_MASUK' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => setFilterJenis('SURAT_KELUAR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterJenis === 'SURAT_KELUAR' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Keluar
              </button>
              <button
                type="button"
                onClick={() => setFilterJenis('UNDANGAN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterJenis === 'UNDANGAN' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Undangan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Surat List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-700" />
            <span>Arsip Surat & Persuratan Kedinasan ({filteredList.length})</span>
          </div>
        </div>

        <div className="divide-y divide-slate-100 overflow-x-auto">
          {filteredList.map((item) => {
            const badge = JENIS_SURAT_LABELS[item.jenisSurat] || { label: item.jenisSurat, bg: 'bg-slate-50', text: 'text-slate-800' };
            return (
              <div key={item.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-2xl flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      item.sifat === 'PENTING' ? 'bg-amber-100 text-amber-900' :
                      item.sifat === 'RAHASIA' ? 'bg-rose-100 text-rose-900' :
                      item.sifat === 'SEGERA' ? 'bg-orange-100 text-orange-900' : 'bg-slate-100 text-slate-700'
                    }`}>
                      Sifat: {item.sifat}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500">
                      {item.nomorSurat}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {item.perihal}
                  </h3>

                  <div className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatTanggalIndonesia(new Date(item.tanggalSurat))}
                    </span>
                    <span>•</span>
                    <span className="text-blue-900 font-semibold">
                      {item.jenisSurat === 'SURAT_MASUK' ? `Asal: ${item.asalSurat || '-'}` : `Tujuan: ${item.tujuanSurat || '-'}`}
                    </span>
                    <span>•</span>
                    <span className="text-slate-500">Pencatat: {item.dibuatOlehNama}</span>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
                    {item.isiRingkas}
                  </p>

                  {/* Attached PDF Badge & Preview Pill */}
                  {(item.fileUrl || item.fileName) && (
                    <div className="pt-1 flex items-center gap-2 flex-wrap">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold">
                        <FileText className="w-3.5 h-3.5 text-rose-600" />
                        <span className="truncate max-w-xs">{item.fileName || 'Berkas Lampiran PDF'}</span>
                        {item.fileSize && (
                          <span className="text-rose-500 font-normal">({formatFileSize(item.fileSize)})</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenPdfViewer(item)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="Lihat Berkas PDF"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>Buka PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(item)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="Unduh Berkas PDF"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-600" />
                        <span>Unduh</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewSurat(item)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    title="Pratinjau & Cetak"
                  >
                    <Printer className="w-4 h-4 text-slate-600" />
                    <span>Cetak</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    title="Edit Surat"
                  >
                    <Edit2 className="w-4 h-4 text-blue-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredList.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-xs">
              Belum ada arsip surat kedinasan yang cocok dengan kriteria pencarian.
            </div>
          )}
        </div>
      </div>

      {/* Modal Form Tambah/Edit Surat */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-blue-900 text-white flex items-center justify-between">
              <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-300" />
                <span>{editingSurat ? 'Edit Arsip Surat Kedinasan' : 'Catat / Buat Surat Kedinasan Baru'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor Surat *</label>
                  <input
                    type="text"
                    required
                    value={formNomor}
                    onChange={(e) => setFormNomor(e.target.value)}
                    placeholder="Contoh: 005 / 120 / X / 2026"
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 font-mono font-bold text-slate-800 focus:bg-white focus:outline-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Surat *</label>
                  <input
                    type="date"
                    required
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 focus:bg-white focus:outline-blue-600 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Surat</label>
                  <select
                    value={formJenis}
                    onChange={(e) => setFormJenis(e.target.value as JenisSuratKedinasan)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 font-semibold text-slate-800 focus:bg-white focus:outline-blue-600 cursor-pointer"
                  >
                    <option value="SURAT_MASUK">Surat Masuk</option>
                    <option value="SURAT_KELUAR">Surat Keluar</option>
                    <option value="NOTA_DINAS">Nota Dinas</option>
                    <option value="SURAT_EDARAN">Surat Edaran</option>
                    <option value="SURAT_KETERANGAN">Surat Keterangan</option>
                    <option value="SK_LURAH">SK Lurah</option>
                    <option value="UNDANGAN">Undangan Resmi</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sifat Surat</label>
                  <select
                    value={formSifat}
                    onChange={(e) => setFormSifat(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 font-semibold text-slate-800 focus:bg-white focus:outline-blue-600 cursor-pointer"
                  >
                    <option value="BIASA">Biasa</option>
                    <option value="PENTING">Penting</option>
                    <option value="SEGERA">Segera</option>
                    <option value="RAHASIA">Rahasia</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Arsip</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 font-semibold text-slate-800 focus:bg-white focus:outline-blue-600 cursor-pointer"
                  >
                    <option value="DISETUJUI">Disetujui / Berlaku</option>
                    <option value="TERCATAT">Tercatat Agenda</option>
                    <option value="DIARSIPKAN">Diarsipkan Permanen</option>
                    <option value="DRAFT">Draft Konsep</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {formJenis === 'SURAT_MASUK' ? 'Asal Surat / Pengirim *' : 'Tujuan Surat / Kepada *'}
                </label>
                <input
                  type="text"
                  required
                  value={formAsalTujuan}
                  onChange={(e) => setFormAsalTujuan(e.target.value)}
                  placeholder={formJenis === 'SURAT_MASUK' ? 'Contoh: Dinas Kependudukan Kota Medan' : 'Contoh: Seluruh Kepala Lingkungan I-XXIV'}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 focus:bg-white focus:outline-blue-600 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Perihal / Judul Surat *</label>
                <input
                  type="text"
                  required
                  value={formPerihal}
                  onChange={(e) => setFormPerihal(e.target.value)}
                  placeholder="Contoh: Undangan Rapat Koordinasi PBB-P2"
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 focus:bg-white focus:outline-blue-600 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Isi Ringkas / Uraian Surat</label>
                <textarea
                  rows={4}
                  value={formIsi}
                  onChange={(e) => setFormIsi(e.target.value)}
                  placeholder="Tuliskan ringkasan isi surat atau instruksi disposisi..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 focus:bg-white focus:outline-blue-600 font-medium"
                ></textarea>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Pejabat Penandatangan</label>
                <input
                  type="text"
                  value={formPenandatangan}
                  onChange={(e) => setFormPenandatangan(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 focus:bg-white focus:outline-blue-600 font-semibold"
                />
              </div>

              {/* Upload Berkas PDF / Scan Surat */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-700" />
                    <span>Lampiran Berkas PDF / Scan Surat Kedinasan (Opsional)</span>
                  </label>
                  {formFileUrl && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Berkas Terlampir</span>
                    </span>
                  )}
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="surat-file-input"
                />

                {!formFileUrl ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/50 p-5 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center mb-2 transition-colors">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <p className="font-bold text-slate-800 text-xs">
                      {isProcessingFile ? 'Sedang memproses berkas...' : 'Klik untuk Unggah Berkas PDF / Scan'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Mendukung format PDF, PNG, JPG (Maksimal 15 MB)
                    </p>
                  </div>
                ) : (
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate text-xs">{formFileName || 'Dokumen_Surat.pdf'}</p>
                        <p className="text-[11px] text-slate-500">
                          {formatFileSize(formFileSize)} • Siap Disimpan ke Arsip
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setViewingPdfSurat({
                            id: editingSurat?.id || 'draft_preview',
                            nomorSurat: formNomor || 'DRAFT',
                            tanggalSurat: formTanggal,
                            jenisSurat: formJenis,
                            perihal: formPerihal || formFileName || 'Pratinjau Berkas Lampiran',
                            sifat: formSifat,
                            status: formStatus,
                            isiRingkas: formIsi,
                            fileUrl: formFileUrl,
                            fileName: formFileName || 'Dokumen.pdf',
                            fileSize: formFileSize,
                            fileType: formFileType,
                            dibuatOlehNama: currentUser.nama,
                            dibuatOlehRole: currentUser.role,
                            createdAt: new Date().toISOString(),
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] cursor-pointer flex items-center gap-1"
                        title="Pratinjau File"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
                        title="Hapus Berkas"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Arsip Surat</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal In-App PDF Viewer */}
      {viewingPdfSurat && viewingPdfSurat.fileUrl && (
        <div className="modal-preview p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-rose-400 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-black text-sm uppercase tracking-wide truncate">
                    {viewingPdfSurat.fileName || 'Lampiran Berkas PDF'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono truncate">
                    No: {viewingPdfSurat.nomorSurat} • {viewingPdfSurat.perihal}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(viewingPdfSurat)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh PDF</span>
                </button>
                {pdfBlobUrl && (
                  <a
                    href={pdfBlobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Tab Baru</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setViewingPdfSurat(null)}
                  className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 bg-slate-100 flex flex-col items-center justify-center overflow-hidden">
              <iframe
                src={pdfBlobUrl || viewingPdfSurat.fileUrl}
                className="w-full h-[70vh] rounded-2xl border border-slate-300 bg-white shadow-inner"
                title={viewingPdfSurat.fileName || 'Lampiran PDF Surat'}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview / Cetak Surat Resmi */}
      {previewSurat && (
        <div className="modal-preview p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-400" />
                <span>Pratinjau Resmi Surat Kedinasan</span>
              </h3>
              <div className="flex items-center gap-2">
                {(previewSurat.fileUrl || previewSurat.fileName) && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = previewSurat;
                      setPreviewSurat(null);
                      handleOpenPdfViewer(target);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Buka Lampiran PDF</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handlePrintSurat(previewSurat)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSurat(null)}
                  className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
              <div id="lembar-cetak-surat-kedinasan" className="bg-white w-full max-w-2xl p-8 shadow-lg rounded-xl border border-slate-200 text-slate-900 font-serif space-y-6">
                {/* Kop Surat Berdasarkan Role Pembuat */}
                {isPkkRole(previewSurat.dibuatOlehRole || '') ? (
                  <KopSuratPkk />
                ) : (
                  <KopSuratResmi />
                )}

                <div className="text-center space-y-1">
                  <h4 className="font-bold underline uppercase text-sm tracking-wide">{previewSurat.perihal}</h4>
                  <p className="text-xs font-mono">Nomor: {previewSurat.nomorSurat}</p>
                </div>

                <div className="grid grid-cols-2 text-xs font-sans gap-y-1 pt-2">
                  <div><strong>Sifat:</strong> {previewSurat.sifat}</div>
                  <div><strong>Tanggal:</strong> {formatTanggalIndonesia(new Date(previewSurat.tanggalSurat))}</div>
                  <div>
                    <strong>Lampiran:</strong>{' '}
                    {previewSurat.fileName ? `1 Berkas PDF (${previewSurat.fileName})` : '1 (Satu) Berkas'}
                  </div>
                  <div><strong>Kepada:</strong> {previewSurat.tujuanSurat || previewSurat.asalSurat || 'Pihak Terkait'}</div>
                </div>

                <hr className="border-slate-300 my-2" />

                <div className="text-sm space-y-4 leading-relaxed text-justify">
                  <p>Dengan hormat,</p>
                  <p>{previewSurat.isiRingkas}</p>
                  <p>Demikian disampaikan atas perhatian dan kerjasamanya diucapkan terima kasih.</p>
                </div>

                <div className="pt-8 flex justify-end text-xs font-sans">
                  <div className="text-center w-64 space-y-12">
                    <p>
                      Medan, {formatTanggalIndonesia(new Date(previewSurat.tanggalSurat))}
                      <br />
                      <strong>{isPkkRole(previewSurat.dibuatOlehRole || '') ? 'Tim Penggerak PKK' : 'Pemerintah Kelurahan Mangga'}</strong>
                    </p>
                    <div>
                      <p className="underline font-bold uppercase">{previewSurat.penandatangan || 'Kelurahan Mangga'}</p>
                      {isPkkRole(previewSurat.dibuatOlehRole || '') && (
                        <p className="text-[10px] text-slate-500 font-normal">Tim Penggerak PKK Kelurahan Mangga</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

