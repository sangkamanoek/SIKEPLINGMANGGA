import React, { useState, useEffect, useMemo } from 'react';
import {
  Baby,
  Plus,
  Trash2,
  Edit3,
  Download,
  Search,
  CheckCircle2,
  X,
  Camera,
  Calendar,
  MapPin,
  Users,
  Sparkles,
  Printer,
  Eye,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { UserAccount, PosyanduReport, FotoDokumentasi } from '../types';
import {
  subscribePosyanduReports,
  savePosyanduReport,
  deletePosyanduReport,
} from '../lib/pkkPosyanduService';
import { KETUA_PKK_LINGKUNGAN_ACCOUNTS } from '../data/keplingList';
import { KopSuratPkk } from './KopSuratPkk';
import { RealtimeSyncStatusPanel } from './RealtimeSyncStatusPanel';
import { printOfficialDocument, downloadPdfDocument } from '../utils/printHelper';
import { compressMultipleFiles } from '../lib/imageCompressor';

const formatProperWriting = (text: string): string => {
  if (!text) return '';
  let formatted = text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (m) => m.toUpperCase());
  const keywords = [
    { pattern: /\bpkk\b/gi, replacement: 'PKK' },
    { pattern: /\btp-pkk\b/gi, replacement: 'TP-PKK' },
    { pattern: /\blurah\b/gi, replacement: 'Lurah' },
    { pattern: /\bkelurahan\b/gi, replacement: 'Kelurahan' },
    { pattern: /\bmangga\b/gi, replacement: 'Mangga' },
    { pattern: /\bkepling\b/gi, replacement: 'Kepling' },
    { pattern: /\bkepala lingkungan\b/gi, replacement: 'Kepala Lingkungan' },
    { pattern: /\btaman pkk\b/gi, replacement: 'Taman PKK' },
    { pattern: /\btoga\b/gi, replacement: 'TOGA' },
    { pattern: /\bpoltekkes\b/gi, replacement: 'Poltekkes' },
    { pattern: /\bkemenkes\b/gi, replacement: 'Kemenkes' },
    { pattern: /\bpkl\b/gi, replacement: 'PKL' },
    { pattern: /\bgizi\b/gi, replacement: 'Gizi' },
    { pattern: /\bdawis\b/gi, replacement: 'Dawis' },
    { pattern: /\bdasa wisma\b/gi, replacement: 'Dasa Wisma' },
    { pattern: /\bposyandu\b/gi, replacement: 'Posyandu' },
  ];
  keywords.forEach((kw) => {
    formatted = formatted.replace(kw.pattern, kw.replacement);
  });
  return formatted;
};

const normalizePetugasNama = (name?: string): string => {
  if (!name) return 'Pelapor PKK Lingkungan';
  if (name.includes('Ny. Sekretaris') || name === 'Ny. Sekretaris PKK Kelurahan Mangga' || name === 'sekretaris_pkk') {
    return 'Nur Aisyah Dewi, A.Md';
  }
  return name;
};

const getPetugasJabatan = (report: PosyanduReport): string => {
  const acc = KETUA_PKK_LINGKUNGAN_ACCOUNTS.find(
    (a) => a.nomorLingkungan === report.nomorLingkungan || a.id === report.pkkLingkunganId
  );
  if (acc) {
    return `Ketua TP-PKK ${acc.lingkungan}`;
  }
  if (report.namaPetugas?.includes('Aisyah') || report.namaPetugas?.includes('Sekretaris')) {
    return 'Sekretaris TP-PKK Kelurahan Mangga';
  }
  if (report.namaPetugas?.includes('Fransiska')) {
    return 'Ketua TP-PKK Kelurahan Mangga';
  }
  return `Ketua TP-PKK Lingkungan ${report.nomorLingkungan || ''}`;
};

const formatTanggalIndo = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const getNamaHariIndo = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const d = new Date(dateStr);
    return days[d.getDay()] || 'Senin';
  } catch {
    return 'Senin';
  }
};

interface PkkPosyanduViewProps {
  currentUser: UserAccount;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PkkPosyanduView: React.FC<PkkPosyanduViewProps> = ({ currentUser, onShowToast }) => {
  const [reports, setReports] = useState<PosyanduReport[]>([]);
  const [filterLingkungan, setFilterLingkungan] = useState<string>(
    currentUser.role === 'ketua_pkk_lingkungan' ? String(currentUser.nomorLingkungan) : 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Print & Preview Modal State
  const [selectedPrintReport, setSelectedPrintReport] = useState<PosyanduReport | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Form State
  const defaultLkNum = currentUser.nomorLingkungan || 1;
  const [formLingkunganNomor, setFormLingkunganNomor] = useState<number>(defaultLkNum);
  const [formTanggal, setFormTanggal] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formPosyanduNama, setFormPosyanduNama] = useState<string>('');
  const [formPosyanduLokasi, setFormPosyanduLokasi] = useState<string>('');
  const [formJumlahKader, setFormJumlahKader] = useState<string>('');
  
  const [formBayi02, setFormBayi02] = useState<string>('');
  const [formBalita25, setFormBalita25] = useState<string>('');
  const [formAnak612, setFormAnak612] = useState<string>('');
  const [formRemaja1318, setFormRemaja1318] = useState<string>('');
  const [formDewasaBumil1959, setFormDewasaBumil1959] = useState<string>('');
  const [formLansia60, setFormLansia60] = useState<string>('');

  const [formJenisLayanan, setFormJenisLayanan] = useState<string[]>([]);
  const [formKeterangan, setFormKeterangan] = useState<string>('');
  const [fotoList, setFotoList] = useState<FotoDokumentasi[]>([]);

  useEffect(() => {
    const unsub = subscribePosyanduReports((items) => {
      setReports(items);
    });
    return () => unsub();
  }, []);

  const totalWargaKumulatif = useMemo(() => {
    return (
      (parseInt(formBayi02, 10) || 0) +
      (parseInt(formBalita25, 10) || 0) +
      (parseInt(formAnak612, 10) || 0) +
      (parseInt(formRemaja1318, 10) || 0) +
      (parseInt(formDewasaBumil1959, 10) || 0) +
      (parseInt(formLansia60, 10) || 0)
    );
  }, [formBayi02, formBalita25, formAnak612, formRemaja1318, formDewasaBumil1959, formLansia60]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (filterLingkungan !== 'ALL') {
        if (r.nomorLingkungan !== parseInt(filterLingkungan, 10)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNama = (r.posyanduNama || '').toLowerCase().includes(q);
        const matchPetugas = (r.namaPetugas || '').toLowerCase().includes(q);
        const matchLokasi = (r.posyanduLokasi || '').toLowerCase().includes(q);
        if (!matchNama && !matchPetugas && !matchLokasi) return false;
      }
      return true;
    });
  }, [reports, filterLingkungan, searchQuery]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const compressedList = await compressMultipleFiles(files, 1280, 0.78, 'posyandu');
      if (compressedList.length > 0) {
        setFotoList((prev) => [...prev, ...compressedList]);
      }
    } catch (err) {
      console.warn('Gagal memproses foto posyandu:', err);
    }
    e.target.value = '';
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormLingkunganNomor(currentUser.nomorLingkungan || 1);
    setFormTanggal(new Date().toISOString().split('T')[0]);
    setFormPosyanduNama('');
    setFormPosyanduLokasi('');
    setFormJumlahKader('');
    setFormBayi02('');
    setFormBalita25('');
    setFormAnak612('');
    setFormRemaja1318('');
    setFormDewasaBumil1959('');
    setFormLansia60('');
    setFormJenisLayanan([]);
    setFormKeterangan('');
    setFotoList([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (report: PosyanduReport) => {
    setIsEditing(true);
    setEditingId(report.id);
    setFormLingkunganNomor(report.nomorLingkungan || 1);
    setFormTanggal(report.tanggal || new Date().toISOString().split('T')[0]);
    setFormPosyanduNama(report.posyanduNama || '');
    setFormPosyanduLokasi(report.posyanduLokasi || '');
    setFormJumlahKader(String(report.posyanduJumlahPetugasKader || ''));
    setFormBayi02(String(report.posyanduBayi02Tahun || ''));
    setFormBalita25(String(report.posyanduBalita25Tahun || ''));
    setFormAnak612(String(report.posyanduAnak612Tahun || ''));
    setFormRemaja1318(String(report.posyanduRemaja1318Tahun || ''));
    setFormDewasaBumil1959(String(report.posyanduDewasaIbuHamil1959Tahun || ''));
    setFormLansia60(String(report.posyanduLansia60TahunKeatas || ''));
    setFormJenisLayanan(report.posyanduJenisLayanan || []);
    setFormKeterangan(report.posyanduKeterangan || '');
    setFotoList(report.dokumentasiFoto || []);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPosyanduNama.trim()) {
      onShowToast?.('Nama Posyandu wajib diisi!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedAcc = KETUA_PKK_LINGKUNGAN_ACCOUNTS.find(
        (a) => a.nomorLingkungan === formLingkunganNomor
      ) || currentUser;

      const id = isEditing && editingId ? editingId : 'posyandu_' + Date.now();
      const existingReport = reports.find((r) => r.id === id);

      const report: PosyanduReport = {
        id,
        pkkLingkunganId: existingReport?.pkkLingkunganId || selectedAcc.id,
        namaPetugas: existingReport?.namaPetugas || selectedAcc.nama,
        lingkungan: `Lingkungan ${formLingkunganNomor}`,
        nomorLingkungan: formLingkunganNomor,
        tanggal: formTanggal,
        posyanduNama: formPosyanduNama.trim(),
        posyanduLokasi: formPosyanduLokasi.trim(),
        posyanduJumlahPetugasKader: formJumlahKader,
        posyanduJumlahWargaTotal: totalWargaKumulatif,
        posyanduBayi02Tahun: parseInt(formBayi02, 10) || 0,
        posyanduBalita25Tahun: parseInt(formBalita25, 10) || 0,
        posyanduAnak612Tahun: parseInt(formAnak612, 10) || 0,
        posyanduRemaja1318Tahun: parseInt(formRemaja1318, 10) || 0,
        posyanduDewasaIbuHamil1959Tahun: parseInt(formDewasaBumil1959, 10) || 0,
        posyanduLansia60TahunKeatas: parseInt(formLansia60, 10) || 0,
        posyanduJenisLayanan: formJenisLayanan,
        posyanduKeterangan: formKeterangan.trim(),
        dokumentasiFoto: fotoList,
        createdAt: existingReport?.createdAt || new Date().toISOString(),
      };

      await savePosyanduReport(report);
      onShowToast?.(
        isEditing ? 'Laporan Posyandu berhasil diperbarui!' : 'Laporan Posyandu berhasil disimpan & ditampilkan di Dashboard PKK!',
        'success'
      );
      setIsModalOpen(false);
      setFotoList([]);
    } catch (err) {
      console.error(err);
      onShowToast?.('Gagal menyimpan laporan Posyandu', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus laporan Posyandu ini?')) return;
    try {
      await deletePosyanduReport(id);
      onShowToast?.('Laporan Posyandu berhasil dihapus.', 'success');
    } catch (err) {
      onShowToast?.('Gagal menghapus laporan.', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-800 via-rose-700 to-pink-800 text-white rounded-3xl p-5 sm:p-7 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/25 backdrop-blur-md text-rose-100 text-xs font-black tracking-wide">
            <Baby className="w-4 h-4 text-amber-300" />
            <span>POKJA IV PKK — POSYANDU & KESEHATAN KELUARGA</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Laporan Pelayanan Posyandu 24 Lingkungan
          </h1>
          <p className="text-xs sm:text-sm text-rose-100 max-w-2xl leading-relaxed">
            Pencatatan kegiatan posyandu balita, ibu hamil, lansia, serta pencegahan stunting dikelola langsung oleh Ketua PKK Lingkungan (Pokja IV).
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Buat Laporan Posyandu</span>
          </button>
        </div>
      </div>

      <RealtimeSyncStatusPanel />

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama posyandu, petugas, atau lokasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
            />
          </div>

          <select
            value={filterLingkungan}
            onChange={(e) => setFilterLingkungan(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800 focus:ring-2 focus:ring-rose-500"
          >
            <option value="ALL">🌐 Semua Lingkungan (24 Lingkungan)</option>
            {KETUA_PKK_LINGKUNGAN_ACCOUNTS.map((acc) => (
              <option key={acc.id} value={acc.nomorLingkungan}>
                {acc.lingkungan} — {acc.nama}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 font-semibold">
          Menampilkan <b>{filteredReports.length}</b> laporan posyandu
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReports.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-2xs">
            <Baby className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-sm">Belum ada laporan Posyandu</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Ketua PKK Lingkungan belum mengirimkan laporan pelayanan posyandu untuk filter yang dipilih.
            </p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg bg-rose-900 text-white font-black text-[10px]">
                    {report.lingkungan}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-rose-600" />
                    {report.tanggal}
                  </span>
                </div>

                <div>
                  <h3 className="font-black text-slate-900 text-base">{report.posyanduNama}</h3>
                  <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>{report.posyanduLokasi || 'Lokasi tidak diisi'}</span>
                  </p>
                </div>

                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-black text-rose-950">
                    <span>Total Warga Dilayani:</span>
                    <span className="text-rose-700 text-sm">{report.posyanduJumlahWargaTotal} Jiwa</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] text-slate-600 font-semibold border-t border-rose-200/60">
                    <div>👶 0-2Th: <b>{report.posyanduBayi02Tahun}</b></div>
                    <div>🧒 2-5Th: <b>{report.posyanduBalita25Tahun}</b></div>
                    <div>👦 6-12Th: <b>{report.posyanduAnak612Tahun}</b></div>
                    <div>🧑 13-18Th: <b>{report.posyanduRemaja1318Tahun}</b></div>
                    <div>🤰 19-59Th: <b>{report.posyanduDewasaIbuHamil1959Tahun}</b></div>
                    <div>👵 60+Th: <b>{report.posyanduLansia60TahunKeatas}</b></div>
                  </div>
                </div>

                {Array.isArray(report.posyanduJenisLayanan) && report.posyanduJenisLayanan.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Layanan Diberikan:</span>
                    <div className="flex flex-wrap gap-1">
                      {report.posyanduJenisLayanan.map((l, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                          ✓ {l}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {report.posyanduKeterangan && (
                  <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    "{formatProperWriting(report.posyanduKeterangan)}"
                  </p>
                )}

                {/* GALERI FOTO DOKUMENTASI PADA KARTU LAPORAN POSYANDU */}
                {Array.isArray(report.dokumentasiFoto) && report.dokumentasiFoto.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5 text-rose-600" />
                        Dokumentasi Foto ({report.dokumentasiFoto.length}):
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {report.dokumentasiFoto.map((foto, fIdx) => (
                        <div
                          key={foto.id || fIdx}
                          onClick={() => setPreviewPhotoUrl(foto.url)}
                          className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative group cursor-pointer hover:border-rose-500 transition-all shadow-2xs"
                          title={foto.name || `Foto ${fIdx + 1}`}
                        >
                          <img
                            src={foto.url}
                            alt={foto.name || `Foto ${fIdx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold text-[11px]">
                  Petugas: {normalizePetugasNama(report.namaPetugas)}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedPrintReport(report)}
                    className="px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-[10px] cursor-pointer flex items-center gap-1 shadow-2xs transition-all active:scale-95"
                    title="Pratinjau & Cetak Surat Resmi Posyandu A4 (Lengkap Gambar & Isian Laporan)"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak PDF A4</span>
                  </button>
                  {(currentUser.role === 'super_admin' || currentUser.role === 'ketua_pkk_kelurahan' || currentUser.role === 'sekretaris_pkk' || currentUser.role === 'sekretaris' || currentUser.role === 'ketua_pokja' || currentUser.role === 'ketua_pkk_lingkungan' || currentUser.id === report.pkkLingkunganId) && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(report)}
                        className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                        title="Edit laporan posyandu"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(report.id)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Hapus laporan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL PRATINJAU & CETAK LAPORAN POSYANDU FORMAT A4 RESMI */}
      {selectedPrintReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
            {/* Modal Top Header Bar */}
            <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="font-black text-sm sm:text-base text-white">
                  Pratinjau Lembar Cetak A4 Kedinasan — Laporan Posyandu
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setIsExportingPDF(true);
                    const filename = `Laporan_Posyandu_${selectedPrintReport.posyanduNama.replace(/[^a-zA-Z0-9]/g, '_')}_Lk_${selectedPrintReport.nomorLingkungan}_${selectedPrintReport.tanggal}.pdf`;
                    await downloadPdfDocument('lembar-cetak-posyandu-a4', filename);
                    setIsExportingPDF(false);
                  }}
                  disabled={isExportingPDF}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExportingPDF ? 'Proses PDF...' : 'Unduh PDF A4'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const filename = `Laporan_Posyandu_${selectedPrintReport.posyanduNama.replace(/[^a-zA-Z0-9]/g, '_')}_Lk_${selectedPrintReport.nomorLingkungan}`;
                    printOfficialDocument('lembar-cetak-posyandu-a4', filename);
                  }}
                  className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPrintReport(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Preview Body containing Official A4 Layout */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-slate-200 flex flex-col items-center">
              <div
                id="lembar-cetak-posyandu-a4"
                className="bg-white text-slate-900 w-[190mm] min-w-[190mm] p-6 font-serif text-[8.5pt] leading-tight shadow-md rounded border border-slate-300"
              >
                {/* Kop Surat PKK Resmi */}
                <KopSuratPkk />

                {/* Judul Laporan */}
                <div className="text-center my-3">
                  <h1 className="text-[12pt] font-black uppercase tracking-[0.04em] underline font-serif">
                    LAPORAN PELAYANAN POSYANDU & KESEHATAN KELUARGA
                  </h1>
                  <div className="text-[8.5pt] font-serif mt-1 text-slate-900">
                    <span className="font-bold">Hari:</span> {getNamaHariIndo(selectedPrintReport.tanggal).toUpperCase()} &nbsp;&nbsp;|&nbsp;&nbsp; <span className="font-bold">Tanggal:</span> {formatTanggalIndo(selectedPrintReport.tanggal).toUpperCase()}
                  </div>
                </div>

                {/* Identitas Petugas & Posyandu (Kotak Identitas Resmi) */}
                <div
                  className="mb-3 text-[8.5pt] font-sans p-2.5 rounded-lg border border-slate-300 max-w-[96%] mx-auto shadow-xs"
                  style={{ backgroundColor: '#f8fafc' }}
                >
                  <table className="w-full text-left border-0">
                    <tbody>
                      <tr>
                        <td className="w-32 font-bold py-0.5 text-slate-800 border-0">Nama Petugas Pelapor</td>
                        <td className="w-4 font-bold border-0">:</td>
                        <td className="font-bold uppercase text-slate-900 border-0">{normalizePetugasNama(selectedPrintReport.namaPetugas)}</td>
                        <td className="w-24 font-bold py-0.5 text-slate-800 border-0">Kelurahan</td>
                        <td className="w-4 font-bold border-0">:</td>
                        <td className="text-slate-900 border-0">Kelurahan Mangga</td>
                      </tr>
                      <tr>
                        <td className="font-bold py-0.5 text-slate-800 border-0">Jabatan Pelapor</td>
                        <td className="font-bold border-0">:</td>
                        <td className="font-bold text-slate-900 border-0">{getPetugasJabatan(selectedPrintReport)}</td>
                        <td className="font-bold py-0.5 text-slate-800 border-0">Kecamatan</td>
                        <td className="font-bold border-0">:</td>
                        <td className="text-slate-900 border-0">Kecamatan Medan Tuntungan</td>
                      </tr>
                      <tr>
                        <td className="font-bold py-0.5 text-slate-800 border-0">Nama Posyandu</td>
                        <td className="font-bold border-0">:</td>
                        <td className="font-bold uppercase text-rose-900 border-0">{selectedPrintReport.posyanduNama}</td>
                        <td className="font-bold py-0.5 text-slate-800 border-0">Lokasi / Wilayah</td>
                        <td className="font-bold border-0">:</td>
                        <td className="font-bold text-slate-900 border-0">{selectedPrintReport.posyanduLokasi || '-'} ({selectedPrintReport.lingkungan})</td>
                      </tr>
                      <tr>
                        <td className="font-bold py-0.5 text-slate-800 border-0">Jumlah Kader/Petugas</td>
                        <td className="font-bold border-0">:</td>
                        <td className="font-bold text-slate-900 border-0" colSpan={4}>{selectedPrintReport.posyanduJumlahPetugasKader || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Tabel Isian Laporan & Kategori Usia Warga Terlayani */}
                <div className="mb-3">
                  <div className="text-[8.5pt] font-bold font-sans uppercase tracking-wider mb-1 text-slate-900">
                    A. REKAPITULASI ISIAN LAPORAN & KATEGORI USIA WARGA TERLAYANI:
                  </div>
                  <table className="w-full text-left text-[8pt] font-sans border-[1.5px] border-black border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-900 font-bold border-b border-black">
                        <th className="w-8 text-center py-1 border border-black">NO</th>
                        <th className="w-56 py-1 px-2 border border-black">KATEGORI PELAYANAN / KELOMPOK USIA</th>
                        <th className="w-28 text-center py-1 border border-black">REALISASI</th>
                        <th className="py-1 px-2 border border-black">KETERANGAN & SASARAN INTERVENSI</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="text-center font-bold border border-black py-1">1</td>
                        <td className="font-bold border border-black px-2 py-1">👶 Bayi Usia 0 - 2 Tahun (Baduta & Imunisasi)</td>
                        <td className="text-center font-bold border border-black py-1">{selectedPrintReport.posyanduBayi02Tahun || 0} Jiwa</td>
                        <td className="border border-black px-2 py-1 text-[7.5pt]">Penimbangan Baduta, PMT, & Imunisasi Dasar Lengkap</td>
                      </tr>
                      <tr>
                        <td className="text-center font-bold border border-black py-1">2</td>
                        <td className="font-bold border border-black px-2 py-1">🧒 Balita Usia 2 - 5 Tahun (Balita & Stunting)</td>
                        <td className="text-center font-bold border border-black py-1">{selectedPrintReport.posyanduBalita25Tahun || 0} Jiwa</td>
                        <td className="border border-black px-2 py-1 text-[7.5pt]">Pengukuran Tinggi/BB, Deteksi Dini Stunting, PMT Balita</td>
                      </tr>
                      <tr>
                        <td className="text-center font-bold border border-black py-1">3</td>
                        <td className="font-bold border border-black px-2 py-1">👦 Anak Usia 6 - 12 Tahun (Pra-Sekolah & Anak)</td>
                        <td className="text-center font-bold border border-black py-1">{selectedPrintReport.posyanduAnak612Tahun || 0} Jiwa</td>
                        <td className="border border-black px-2 py-1 text-[7.5pt]">Pemeriksaan Kesehatan Anak & Pemberian Vitamin</td>
                      </tr>
                      <tr>
                        <td className="text-center font-bold border border-black py-1">4</td>
                        <td className="font-bold border border-black px-2 py-1">🧑 Remaja Usia 13 - 18 Tahun (Posyandu Remaja)</td>
                        <td className="text-center font-bold border border-black py-1">{selectedPrintReport.posyanduRemaja1318Tahun || 0} Jiwa</td>
                        <td className="border border-black px-2 py-1 text-[7.5pt]">Penyuluhan Anemia, Tablet Tambah Darah & PHBS</td>
                      </tr>
                      <tr>
                        <td className="text-center font-bold border border-black py-1">5</td>
                        <td className="font-bold border border-black px-2 py-1">🤰 Dewasa & Ibu Hamil Usia 19 - 59 Tahun</td>
                        <td className="text-center font-bold border border-black py-1">{selectedPrintReport.posyanduDewasaIbuHamil1959Tahun || 0} Jiwa</td>
                        <td className="border border-black px-2 py-1 text-[7.5pt]">Pemeriksaan Bumil (ANC), PMT Bumil KEK & Skrining Kesehatan</td>
                      </tr>
                      <tr>
                        <td className="text-center font-bold border border-black py-1">6</td>
                        <td className="font-bold border border-black px-2 py-1">👵 Lansia Usia 60+ Tahun (Lanjut Usia & PTM)</td>
                        <td className="text-center font-bold border border-black py-1">{selectedPrintReport.posyanduLansia60TahunKeatas || 0} Jiwa</td>
                        <td className="border border-black px-2 py-1 text-[7.5pt]">Skrining PTM (Tensi / Gula Darah) & Edukasi Kesehatan Lansia</td>
                      </tr>
                      <tr className="bg-slate-100 font-black">
                        <td className="text-center border border-black py-1 font-black" colSpan={2}>TOTAL KUMULATIF WARGA TERLAYANI POSYANDU</td>
                        <td className="text-center border border-black py-1 text-rose-900 text-[9pt] font-black">{selectedPrintReport.posyanduJumlahWargaTotal || 0} JIWA</td>
                        <td className="border border-black px-2 py-1 text-[7.5pt] font-bold">Akumulasi Seluruh Sasaran Usia Layanan Posyandu</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Rincian Jenis Layanan & Catatan Hasil Posyandu */}
                  <div className="mt-2 space-y-1 text-[8pt] font-sans border border-black p-2 rounded bg-slate-50">
                    {Array.isArray(selectedPrintReport.posyanduJenisLayanan) && selectedPrintReport.posyanduJenisLayanan.length > 0 && (
                      <div>
                        <strong>Jenis Layanan Kesehatan Diberikan:</strong> {selectedPrintReport.posyanduJenisLayanan.join(', ')}
                      </div>
                    )}
                    {selectedPrintReport.posyanduKeterangan && (
                      <div className="mt-1">
                        <strong>Catatan & Uraian Hasil Pelaksanaan:</strong> "{formatProperWriting(selectedPrintReport.posyanduKeterangan)}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Dokumentasi Laporan Foto Lapangan Terlampir */}
                {selectedPrintReport.dokumentasiFoto && selectedPrintReport.dokumentasiFoto.length > 0 && (
                  <div className="mb-3 avoid-break">
                    <div className="text-[8.5pt] font-bold font-sans uppercase tracking-wider mb-1.5 text-slate-900">
                      B. DOKUMENTASI LAPORAN FOTO LAPANGAN TERLAMPIR ({selectedPrintReport.dokumentasiFoto.length} FOTO):
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {selectedPrintReport.dokumentasiFoto.map((foto, idx) => (
                        <div key={foto.id || idx} className="rounded-lg border border-slate-300 p-1.5 bg-white flex flex-col items-center">
                          <div className="w-full h-[125px] rounded overflow-hidden bg-slate-50 flex items-center justify-center border border-slate-200">
                            <img
                              src={foto.url}
                              alt={foto.name || `Dokumentasi ${idx + 1}`}
                              crossOrigin="anonymous"
                              className="w-full h-full object-contain object-center"
                            />
                          </div>
                          <div className="text-[7.5pt] font-bold text-slate-800 mt-1 truncate w-full text-center font-sans">
                            {foto.name || `Foto ${idx + 1}: Pelayanan ${selectedPrintReport.posyanduNama}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pengesahan Tanda Tangan (Nama & Jabatan Pelapor) */}
                <div className="mt-4 pt-2 text-[8.5pt] font-sans avoid-break">
                  <div className="flex justify-end pr-4">
                    <div className="text-center flex flex-col items-center min-w-[220px]">
                      <div>Medan, {formatTanggalIndo(selectedPrintReport.tanggal).toUpperCase()}</div>
                      <div className="mt-0.5">Yang Melaporkan,</div>
                      <div className="font-bold uppercase whitespace-nowrap text-slate-900 mt-0.5">
                        {getPetugasJabatan(selectedPrintReport).toUpperCase()}
                      </div>
                      <div className="h-12" />
                      <div className="font-bold underline uppercase whitespace-nowrap text-slate-900">
                        ( {normalizePetugasNama(selectedPrintReport.namaPetugas)} )
                      </div>
                      <div className="text-[7.5pt] text-slate-700 mt-0.5">Pelapor Kegiatan Posyandu</div>
                    </div>
                  </div>
                </div>

                {/* Footer Lembar A4 */}
                <div className="mt-4 pt-1.5 border-t border-slate-300 flex items-center justify-between text-[6.5pt] text-slate-500 italic font-sans">
                  <span>SI-MANGGA • Sistem Informasi & Administrasi Kelurahan Mangga</span>
                  <span>Dokumen Resmi Pelayanan Posyandu • Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX PREVIEW FOTO FULLSCREEN */}
      {previewPhotoUrl && (
        <div
          onClick={() => setPreviewPhotoUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute -top-12 right-0 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Foto Dokumentasi Fullscreen"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}

      {/* Modal Input Laporan Posyandu */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-rose-200 overflow-hidden animate-in fade-in zoom-in duration-200 my-8">
            <div className="bg-gradient-to-r from-rose-800 to-pink-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg">
                  {isEditing ? 'Edit Laporan Pelayanan Posyandu' : 'Formulir Pelayanan Posyandu & Kesehatan'}
                </h3>
                <p className="text-xs text-rose-200">Diisi oleh Ketua PKK Lingkungan / Sekretaris (Pokja IV)</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-rose-200 hover:text-white p-1 rounded-lg hover:bg-rose-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Lingkungan:</label>
                  <select
                    value={formLingkunganNomor}
                    onChange={(e) => setFormLingkunganNomor(parseInt(e.target.value, 10))}
                    disabled={currentUser.role === 'ketua_pkk_lingkungan'}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800"
                  >
                    {KETUA_PKK_LINGKUNGAN_ACCOUNTS.map((acc) => (
                      <option key={acc.id} value={acc.nomorLingkungan}>
                        {acc.lingkungan} — {acc.nama}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Pelayanan:</label>
                  <input
                    type="date"
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Posyandu:</label>
                  <input
                    type="text"
                    value={formPosyanduNama}
                    onChange={(e) => setFormPosyanduNama(e.target.value)}
                    placeholder="Posyandu Melati"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi / Tempat:</label>
                  <input
                    type="text"
                    value={formPosyanduLokasi}
                    onChange={(e) => setFormPosyanduLokasi(e.target.value)}
                    placeholder="Balai Warga Lk..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Petugas / Kader:</label>
                  <input
                    type="text"
                    value={formJumlahKader}
                    onChange={(e) => setFormJumlahKader(e.target.value)}
                    placeholder="5 Kader + Bidan"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white font-bold"
                  />
                </div>
              </div>

              {/* Rincian Usia */}
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-950">
                    📊 Rincian Warga Terlayani (Usia 0 Th s.d Lansia)
                  </span>
                  <span className="text-xs font-black bg-rose-600 text-white px-2.5 py-0.5 rounded-full">
                    Total: {totalWargaKumulatif} Jiwa
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">👶 Usia 0-2 Th (Baduta):</label>
                    <input
                      type="number"
                      min="0"
                      value={formBayi02}
                      onChange={(e) => setFormBayi02(e.target.value.replace(/^0+(?=\d)/, ''))}
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-bold bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">🧒 Usia 2-5 Th (Balita):</label>
                    <input
                      type="number"
                      min="0"
                      value={formBalita25}
                      onChange={(e) => setFormBalita25(e.target.value.replace(/^0+(?=\d)/, ''))}
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-bold bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">👦 Usia 6-12 Th (Sekolah):</label>
                    <input
                      type="number"
                      min="0"
                      value={formAnak612}
                      onChange={(e) => setFormAnak612(e.target.value.replace(/^0+(?=\d)/, ''))}
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-bold bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">🧑 Usia 13-18 Th (Remaja):</label>
                    <input
                      type="number"
                      min="0"
                      value={formRemaja1318}
                      onChange={(e) => setFormRemaja1318(e.target.value.replace(/^0+(?=\d)/, ''))}
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-bold bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">🤰 Usia 19-59 Th (Bumil/Dewasa):</label>
                    <input
                      type="number"
                      min="0"
                      value={formDewasaBumil1959}
                      onChange={(e) => setFormDewasaBumil1959(e.target.value.replace(/^0+(?=\d)/, ''))}
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-bold bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">👵 Usia 60+ Th (Lansia):</label>
                    <input
                      type="number"
                      min="0"
                      value={formLansia60}
                      onChange={(e) => setFormLansia60(e.target.value.replace(/^0+(?=\d)/, ''))}
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-bold bg-white text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Hasil Posyandu:</label>
                <textarea
                  rows={2}
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  placeholder="Catatan kesehatan balita, PMT, atau stunting..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                />
              </div>

              {/* Dokumentasi Foto */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">Foto Dokumentasi:</label>
                  <label className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs">
                    <Camera className="w-3.5 h-3.5" />
                    <span>+ Unggah Foto</span>
                    <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
                {fotoList.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {fotoList.map((foto) => (
                      <div key={foto.id} className="relative group rounded-xl overflow-hidden border aspect-square bg-slate-100">
                        <img src={foto.url} alt={foto.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFotoList((prev) => prev.filter((f) => f.id !== foto.id))}
                          className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-500 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : isEditing ? 'Perbarui Laporan' : 'Simpan Laporan Posyandu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
