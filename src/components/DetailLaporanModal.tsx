import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Calendar,
  ExternalLink,
  Printer,
  CheckCircle,
  Copy,
  Check,
  Edit3,
  Save,
  Trash2,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { LaporanHarianItem, SheetMetadata } from '../types';

interface DetailLaporanModalProps {
  item: LaporanHarianItem | null;
  isOpen: boolean;
  onClose: () => void;
  sheetMeta: SheetMetadata | null;
  hasGoogleAuth: boolean;
  isAdmin?: boolean;
  onUpdateReport?: (updatedItem: LaporanHarianItem) => Promise<void>;
  onDeleteReport?: (id: string) => Promise<void>;
  onSyncToCalendar?: (item: LaporanHarianItem) => Promise<void>;
  isSyncingCalendar?: boolean;
}

export const DetailLaporanModal: React.FC<DetailLaporanModalProps> = ({
  item,
  isOpen,
  onClose,
  sheetMeta,
  hasGoogleAuth,
  isAdmin = true,
  onUpdateReport,
  onDeleteReport,
  onSyncToCalendar,
  isSyncingCalendar,
}) => {
  const [calendarSyncSuccess, setCalendarSyncSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Editable Form States
  const [editHari, setEditHari] = useState('');
  const [editTanggal, setEditTanggal] = useState('');
  const [editNamaKepling, setEditNamaKepling] = useState('');
  const [editJabatan, setEditJabatan] = useState('');
  const [editOpsirPbbWp, setEditOpsirPbbWp] = useState('');
  const [editOpsirPbbKet, setEditOpsirPbbKet] = useState('');
  const [editPerlinsosKk, setEditPerlinsosKk] = useState('');
  const [editPerlinsosKet, setEditPerlinsosKet] = useState('');
  const [editIkdOrang, setEditIkdOrang] = useState('');
  const [editIkdKet, setEditIkdKet] = useState('');
  const [editBpjsOrang, setEditBpjsOrang] = useState('');
  const [editBpjsKet, setEditBpjsKet] = useState('');
  const [editPoskamlingStatus, setEditPoskamlingStatus] = useState('');
  const [editPoskamlingLokasi, setEditPoskamlingLokasi] = useState('');
  const [editPoskamlingPetugas, setEditPoskamlingPetugas] = useState('');
  const [editPoskamlingKet, setEditPoskamlingKet] = useState('');
  const [editKegiatanLainnya, setEditKegiatanLainnya] = useState('');

  // Populate form fields whenever active item changes
  useEffect(() => {
    if (item) {
      setEditHari(item.hari || '');
      setEditTanggal(item.tanggal || '');
      setEditNamaKepling(item.namaKepling || '');
      setEditJabatan(item.jabatan || '');
      setEditOpsirPbbWp(item.kinerja?.opsirPbbWp || '0');
      setEditOpsirPbbKet(item.kinerja?.opsirPbbKeterangan || '');
      setEditPerlinsosKk(item.kinerja?.perlinsosKk || '0');
      setEditPerlinsosKet(item.kinerja?.perlinsosKeterangan || '');
      setEditIkdOrang(item.kinerja?.ikdOrang || '0');
      setEditIkdKet(item.kinerja?.ikdKeterangan || '');
      setEditBpjsOrang(item.kinerja?.bpjsKetenagakerjaanOrang || '0');
      setEditBpjsKet(item.kinerja?.bpjsKetenagakerjaanKeterangan || '');
      setEditPoskamlingStatus(item.kinerja?.poskamlingStatus || '');
      setEditPoskamlingLokasi(item.kinerja?.poskamlingLokasi || '');
      setEditPoskamlingPetugas(item.kinerja?.poskamlingPetugas || '');
      setEditPoskamlingKet(item.kinerja?.poskamlingKeterangan || '');
      setEditKegiatanLainnya(item.kinerja?.kegiatanLainnya || '');
      setIsEditing(false);
      setSaveSuccessMsg('');
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const activeItem = isEditing
      ? {
          jabatan: editJabatan,
          kelurahan: item.kelurahan,
          kecamatan: item.kecamatan,
          hari: editHari,
          tanggal: editTanggal,
          namaKepling: editNamaKepling,
          kinerja: {
            opsirPbbWp: editOpsirPbbWp,
            opsirPbbKeterangan: editOpsirPbbKet,
            perlinsosKk: editPerlinsosKk,
            perlinsosKeterangan: editPerlinsosKet,
            ikdOrang: editIkdOrang,
            ikdKeterangan: editIkdKet,
            bpjsKetenagakerjaanOrang: editBpjsOrang,
            bpjsKetenagakerjaanKeterangan: editBpjsKet,
            poskamlingStatus: editPoskamlingStatus,
            poskamlingLokasi: editPoskamlingLokasi,
            poskamlingPetugas: editPoskamlingPetugas,
            poskamlingKeterangan: editPoskamlingKet,
            kegiatanLainnya: editKegiatanLainnya,
          },
          jumlahDokumentasi: item.jumlahDokumentasi,
        }
      : item;

    const text = [
      `*🟩 LAPORAN KEGIATAN HARIAN*`,
      `*${activeItem.jabatan.toUpperCase()}*`,
      `*${activeItem.kelurahan.toUpperCase()}*`,
      `*${activeItem.kecamatan.toUpperCase()}*`,
      `----------------------------------------`,
      `Hari     : ${activeItem.hari}`,
      `Tanggal  : ${activeItem.tanggal}`,
      `Nama     : ${activeItem.namaKepling}`,
      `Jabatan  : ${activeItem.jabatan}`,
      `----------------------------------------`,
      `KINERJA HARIAN:`,
      `1. OPSIR PBB : ${activeItem.kinerja.opsirPbbWp || '0'} WP ${activeItem.kinerja.opsirPbbKeterangan ? `(${activeItem.kinerja.opsirPbbKeterangan})` : ''}`,
      `2. PERLINSOS : ${activeItem.kinerja.perlinsosKk || '0'} KK ${activeItem.kinerja.perlinsosKeterangan ? `(${activeItem.kinerja.perlinsosKeterangan})` : ''}`,
      `3. IDENTITAS KEPENDUDUKAN DIGITAL : ${activeItem.kinerja.ikdOrang || '0'} ORANG ${activeItem.kinerja.ikdKeterangan ? `(${activeItem.kinerja.ikdKeterangan})` : ''}`,
      `4. BPJS KETENAGAKERJAAN : ${activeItem.kinerja.bpjsKetenagakerjaanOrang || '0'} ORANG ${activeItem.kinerja.bpjsKetenagakerjaanKeterangan ? `(${activeItem.kinerja.bpjsKetenagakerjaanKeterangan})` : ''}`,
      activeItem.kinerja.poskamlingStatus && activeItem.kinerja.poskamlingStatus !== 'Tidak Ada Giat'
        ? `5. POSKAMLING / SISKAMLING : ${activeItem.kinerja.poskamlingStatus}${activeItem.kinerja.poskamlingLokasi ? ` (${activeItem.kinerja.poskamlingLokasi})` : ''}${activeItem.kinerja.poskamlingPetugas ? ` - Petugas: ${activeItem.kinerja.poskamlingPetugas}` : ''}${activeItem.kinerja.poskamlingKeterangan ? ` [${activeItem.kinerja.poskamlingKeterangan}]` : ''}`
        : '',
      activeItem.kinerja.kegiatanLainnya ? `6. KEGIATAN LAINNYA : ${activeItem.kinerja.kegiatanLainnya}` : '',
      `----------------------------------------`,
      `Dokumentasi : ${activeItem.jumlahDokumentasi} Foto Terlampir`,
      `#MedanUntukSemua #SemuaUntukMedan`,
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = async () => {
    if (!onUpdateReport) return;
    setIsSavingEdit(true);
    try {
      const updatedReport: LaporanHarianItem = {
        ...item,
        hari: editHari,
        tanggal: editTanggal,
        namaKepling: editNamaKepling,
        jabatan: editJabatan,
        kinerja: {
          opsirPbbWp: editOpsirPbbWp,
          opsirPbbKeterangan: editOpsirPbbKet,
          perlinsosKk: editPerlinsosKk,
          perlinsosKeterangan: editPerlinsosKet,
          ikdOrang: editIkdOrang,
          ikdKeterangan: editIkdKet,
          bpjsKetenagakerjaanOrang: editBpjsOrang,
          bpjsKetenagakerjaanKeterangan: editBpjsKet,
          poskamlingAdaGiat: Boolean(editPoskamlingStatus && editPoskamlingStatus !== 'Tidak Ada Giat'),
          poskamlingStatus: editPoskamlingStatus,
          poskamlingLokasi: editPoskamlingLokasi,
          poskamlingPetugas: editPoskamlingPetugas,
          poskamlingKeterangan: editPoskamlingKet,
          kegiatanLainnya: editKegiatanLainnya,
        },
      };

      await onUpdateReport(updatedReport);
      setSaveSuccessMsg('Perubahan laporan berhasil disimpan ke database!');
      setIsEditing(false);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Save edit error:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteReport) return;
    const confirmDelete = window.confirm(
      `Hapus laporan untuk ${item.namaKepling} (${item.jabatan}) tanggal ${item.tanggal}? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await onDeleteReport(item.id);
      onClose();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSyncCalendarClick = async () => {
    if (onSyncToCalendar) {
      try {
        await onSyncToCalendar(item);
        setCalendarSyncSuccess(true);
        setTimeout(() => setCalendarSyncSuccess(false), 4000);
      } catch (e) {
        console.error('Failed to sync report to Google Calendar:', e);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header Modal */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-xl">{isEditing ? '✏️' : '📋'}</span>
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>{isEditing ? 'Koreksi / Edit Laporan Kepling' : 'Rincian Laporan Kinerja Harian'}</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-700 text-white font-semibold">
                  {item.hari}
                </span>
                {isEditing && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold uppercase">
                    Mode Edit Admin
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {item.tanggal} • {item.namaKepling} ({item.jabatan})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && !isEditing && onUpdateReport && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                title="Edit data laporan ini jika ada kesalahan dari Kepling"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Koreksi / Edit</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl flex items-center gap-2 text-xs font-semibold">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {calendarSyncSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl flex items-center gap-2 text-xs font-semibold animate-fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Laporan berhasil disinkronkan ke jadwal Google Calendar Anda!</span>
            </div>
          )}

          {/* Identity Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Hari Pelaporan
                  </label>
                  <input
                    type="text"
                    value={editHari}
                    onChange={(e) => setEditHari(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Tanggal Pelaporan
                  </label>
                  <input
                    type="text"
                    value={editTanggal}
                    onChange={(e) => setEditTanggal(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Nama Petugas Kepling
                  </label>
                  <input
                    type="text"
                    value={editNamaKepling}
                    onChange={(e) => setEditNamaKepling(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Jabatan Kepling
                  </label>
                  <input
                    type="text"
                    value={editJabatan}
                    onChange={(e) => setEditJabatan(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-emerald-500"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Hari / Tanggal</span>
                  <span className="font-bold text-slate-800">{item.hari}, {item.tanggal}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Petugas Kepling</span>
                  <span className="font-bold text-slate-800">{item.namaKepling}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Jabatan</span>
                  <span className="font-medium text-slate-700">{item.jabatan}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Wilayah</span>
                  <span className="font-medium text-slate-700">{item.kelurahan}</span>
                </div>
              </div>
            )}
          </div>

          {/* Capaian Kinerja Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Capaian Kinerja Harian
              </h3>
              {isEditing && (
                <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Silakan edit angka atau keterangan jika ada kekeliruan
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. Opsir PBB */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">1. OPSIR PBB</span>
                {isEditing ? (
                  <div className="space-y-2 mt-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={editOpsirPbbWp}
                        onChange={(e) => setEditOpsirPbbWp(e.target.value)}
                        className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-sm text-slate-900"
                      />
                      <span className="text-xs font-semibold text-slate-600">WP</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Keterangan pembayaran..."
                      value={editOpsirPbbKet}
                      onChange={(e) => setEditOpsirPbbKet(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-700"
                    />
                  </div>
                ) : (
                  <>
                    <div className="text-lg font-black text-slate-800 my-1">
                      {item.kinerja.opsirPbbWp || '0'} <span className="text-xs font-semibold text-slate-500">WP</span>
                    </div>
                    {item.kinerja.opsirPbbKeterangan && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-1.5 rounded">
                        {item.kinerja.opsirPbbKeterangan}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* 2. Perlinsos */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">2. PERLINSOS</span>
                {isEditing ? (
                  <div className="space-y-2 mt-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={editPerlinsosKk}
                        onChange={(e) => setEditPerlinsosKk(e.target.value)}
                        className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-sm text-slate-900"
                      />
                      <span className="text-xs font-semibold text-slate-600">KK</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Keterangan perlinsos..."
                      value={editPerlinsosKet}
                      onChange={(e) => setEditPerlinsosKet(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-700"
                    />
                  </div>
                ) : (
                  <>
                    <div className="text-lg font-black text-slate-800 my-1">
                      {item.kinerja.perlinsosKk || '0'} <span className="text-xs font-semibold text-slate-500">KK</span>
                    </div>
                    {item.kinerja.perlinsosKeterangan && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-1.5 rounded">
                        {item.kinerja.perlinsosKeterangan}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* 3. IKD */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">3. IDENTITAS KEPENDUDUKAN DIGITAL</span>
                {isEditing ? (
                  <div className="space-y-2 mt-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={editIkdOrang}
                        onChange={(e) => setEditIkdOrang(e.target.value)}
                        className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-sm text-slate-900"
                      />
                      <span className="text-xs font-semibold text-slate-600">ORANG</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Keterangan aktivasi IKD..."
                      value={editIkdKet}
                      onChange={(e) => setEditIkdKet(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-700"
                    />
                  </div>
                ) : (
                  <>
                    <div className="text-lg font-black text-slate-800 my-1">
                      {item.kinerja.ikdOrang || '0'} <span className="text-xs font-semibold text-slate-500">ORANG</span>
                    </div>
                    {item.kinerja.ikdKeterangan && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-1.5 rounded">
                        {item.kinerja.ikdKeterangan}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* 4. BPJS Ketenagakerjaan */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">4. BPJS KETENAGAKERJAAN</span>
                {isEditing ? (
                  <div className="space-y-2 mt-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={editBpjsOrang}
                        onChange={(e) => setEditBpjsOrang(e.target.value)}
                        className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-sm text-slate-900"
                      />
                      <span className="text-xs font-semibold text-slate-600">ORANG</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Keterangan BPJS TK..."
                      value={editBpjsKet}
                      onChange={(e) => setEditBpjsKet(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-700"
                    />
                  </div>
                ) : (
                  <>
                    <div className="text-lg font-black text-slate-800 my-1">
                      {item.kinerja.bpjsKetenagakerjaanOrang || '0'} <span className="text-xs font-semibold text-slate-500">ORANG</span>
                    </div>
                    {item.kinerja.bpjsKetenagakerjaanKeterangan && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-1.5 rounded">
                        {item.kinerja.bpjsKetenagakerjaanKeterangan}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 5. POSKAMLING / SISKAMLING */}
            <div className="mt-3 p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 flex items-center gap-1.5 uppercase text-[11px]">
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                  5. TUGAS TAMBAHAN: POSKAMLING / SISKAMLING
                </span>
                {item.kinerja?.poskamlingStatus && (
                  <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">
                    {item.kinerja.poskamlingStatus}
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                        Status Poskamling
                      </label>
                      <input
                        type="text"
                        value={editPoskamlingStatus}
                        onChange={(e) => setEditPoskamlingStatus(e.target.value)}
                        placeholder="Misal: Aktif Ronda Malam"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                        Lokasi Pos Ronda
                      </label>
                      <input
                        type="text"
                        value={editPoskamlingLokasi}
                        onChange={(e) => setEditPoskamlingLokasi(e.target.value)}
                        placeholder="Misal: Pos Ronda Jl. Bunga Rinte"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                        Petugas / Warga Jaga
                      </label>
                      <input
                        type="text"
                        value={editPoskamlingPetugas}
                        onChange={(e) => setEditPoskamlingPetugas(e.target.value)}
                        placeholder="Misal: Kepling & 3 Warga"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                        Catatan Situasi Kamtibmas
                      </label>
                      <input
                        type="text"
                        value={editPoskamlingKet}
                        onChange={(e) => setEditPoskamlingKet(e.target.value)}
                        placeholder="Misal: Lingkungan aman dan kondusif"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-slate-700">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {item.kinerja?.poskamlingLokasi && (
                      <p>
                        📍 <strong>Lokasi:</strong> {item.kinerja.poskamlingLokasi}
                      </p>
                    )}
                    {item.kinerja?.poskamlingPetugas && (
                      <p>
                        👮 <strong>Petugas/Warga:</strong> {item.kinerja.poskamlingPetugas}
                      </p>
                    )}
                  </div>
                  <p className="text-slate-600">
                    📝 <strong>Situasi:</strong>{' '}
                    {item.kinerja?.poskamlingKeterangan || 'Situasi lingkungan aman dan kondusif.'}
                  </p>
                </div>
              )}
            </div>

            {/* 6. Kegiatan Lapangan Lainnya */}
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <span className="font-bold text-slate-700 block mb-1">6. Kegiatan Lapangan Lainnya / Catatan:</span>
              {isEditing ? (
                <textarea
                  rows={3}
                  value={editKegiatanLainnya}
                  onChange={(e) => setEditKegiatanLainnya(e.target.value)}
                  placeholder="Pemantauan kebersihan lingkungan, penanganan drainase, dll..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-emerald-500"
                />
              ) : (
                <p className="text-slate-600">{item.kinerja.kegiatanLainnya || 'Tidak ada kegiatan tambahan.'}</p>
              )}
            </div>
          </div>

          {/* Attached photos */}
          {item.dokumentasiFoto && item.dokumentasiFoto.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-700 block">
                📷 Dokumentasi Lapangan Terlampir ({item.dokumentasiFoto.length} foto)
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {item.dokumentasiFoto.map((foto) => (
                  <div
                    key={foto.id}
                    className="aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs group relative"
                  >
                    <img
                      src={foto.url}
                      alt={foto.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    {(foto.kategori === 'poskamling' || foto.name.includes('[POSKAMLING]')) && (
                      <span className="absolute top-1 left-1 bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded shadow-xs flex items-center gap-1">
                        <Shield className="w-2.5 h-2.5" />
                        POSKAMLING
                      </span>
                    )}
                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate text-center">
                      {foto.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {isEditing ? (
            <div className="flex items-center justify-between w-full">
              {onDeleteReport && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  title="Hapus laporan ini dari database"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>{isDeleting ? 'Menghapus...' : 'Hapus Laporan'}</span>
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {sheetMeta?.spreadsheetUrl && (
                  <a
                    href={sheetMeta.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-emerald-800 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Google Sheets</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Cetak Laporan Fisik"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak</span>
                </button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="flex-1 sm:flex-none px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
                </button>

                {hasGoogleAuth && onSyncToCalendar && (
                  <button
                    type="button"
                    onClick={handleSyncCalendarClick}
                    disabled={isSyncingCalendar}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>{isSyncingCalendar ? 'Menyinkronkan...' : 'Sinkron ke Google Calendar'}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
