import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  Plus,
  FileSpreadsheet,
  Search,
  Filter,
  Edit,
  Trash2,
  RefreshCw,
  X,
  FileText,
  UserCheck,
  Building,
  Check,
  ChevronDown,
  Sparkles,
  Info,
} from 'lucide-react';
import { UserAccount, AgendaKelurahanItem, StatusAgendaType } from '../types';
import {
  getLocalAgendaList,
  fetchAgendaFromFirestore,
  subscribeAgendaFromFirestore,
  saveAgendaItem,
  updateAgendaStatus,
  deleteAgendaItem,
  exportAgendaToExcel,
} from '../lib/agendaService';
import { fileToCompressedBase64 } from '../utils/imageCompressor';
import { Camera, Image as ImageIcon } from 'lucide-react';

interface AgendaKelurahanViewProps {
  currentUser: UserAccount;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AgendaKelurahanView: React.FC<AgendaKelurahanViewProps> = ({
  currentUser,
  onShowToast,
}) => {
  const [agendaList, setAgendaList] = useState<AgendaKelurahanItem[]>(() => getLocalAgendaList());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StatusAgendaType>('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  const [isSyncing, setIsSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AgendaKelurahanItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<AgendaKelurahanItem | null>(null);

  // Form State
  const [formNama, setFormNama] = useState('');
  const [formTanggal, setFormTanggal] = useState('');
  const [formJam, setFormJam] = useState('');
  const [formLokasi, setFormLokasi] = useState('');
  const [formPeserta, setFormPeserta] = useState('');
  const [formStatus, setFormStatus] = useState<StatusAgendaType>('BELUM');
  const [formCatatan, setFormCatatan] = useState('');
  const [formPenanggungJawab, setFormPenanggungJawab] = useState('');
  const [formFotoUrl, setFormFotoUrl] = useState<string | undefined>(undefined);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewFotoUrl, setPreviewFotoUrl] = useState<string | null>(null);

  // Subscribe to real-time changes
  useEffect(() => {
    fetchAgendaFromFirestore().then((items) => setAgendaList(items)).catch(() => {});

    const unsub = subscribeAgendaFromFirestore((items) => {
      setAgendaList(items);
    });

    const handleLocalSync = () => {
      setAgendaList(getLocalAgendaList());
    };
    window.addEventListener('agenda-data-updated', handleLocalSync);

    return () => {
      unsub();
      window.removeEventListener('agenda-data-updated', handleLocalSync);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const items = await fetchAgendaFromFirestore();
      setAgendaList(items);
      if (onShowToast) onShowToast('Data agenda berhasil disinkronkan dengan Cloud Firestore!', 'success');
    } catch {
      if (onShowToast) onShowToast('Gagal menyinkronkan data agenda.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenAddModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setEditingItem(null);
    setFormNama('');
    setFormTanggal(today);
    setFormJam('09:00 WIB');
    setFormLokasi('Aula Utama Kantor Kelurahan Mangga');
    setFormPeserta('Seluruh Kepling, Lurah, Kasi, & Staff Kelurahan');
    setFormStatus('BELUM');
    setFormCatatan('');
    setFormPenanggungJawab(currentUser.nama);
    setFormFotoUrl(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: AgendaKelurahanItem) => {
    setEditingItem(item);
    setFormNama(item.namaKegiatan);
    setFormTanggal(item.tanggalKegiatan);
    setFormJam(item.jamKegiatan || '');
    setFormLokasi(item.lokasi);
    setFormPeserta(item.peserta);
    setFormStatus(item.statusSelesai);
    setFormCatatan(item.catatan || '');
    setFormPenanggungJawab(item.penanggungJawab || item.createdByName || currentUser.nama);
    setFormFotoUrl(item.fotoDokumenUrl);
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim() || !formTanggal || !formLokasi.trim() || !formPeserta.trim()) {
      if (onShowToast) onShowToast('Mohon lengkapi Nama Kegiatan, Tanggal, Lokasi, dan Peserta.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const newItem: AgendaKelurahanItem = {
        id: editingItem ? editingItem.id : `ag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        namaKegiatan: formNama.trim(),
        tanggalKegiatan: formTanggal,
        jamKegiatan: formJam.trim() || undefined,
        lokasi: formLokasi.trim(),
        peserta: formPeserta.trim(),
        statusSelesai: formStatus,
        catatan: formCatatan.trim() || undefined,
        fotoDokumenUrl: formFotoUrl,
        penanggungJawab: formPenanggungJawab.trim() || currentUser.nama,
        createdByName: editingItem ? editingItem.createdByName : currentUser.nama,
        createdByRole: editingItem ? editingItem.createdByRole : currentUser.role,
        createdAt: editingItem ? editingItem.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveAgendaItem(newItem);
      setAgendaList(getLocalAgendaList());
      setIsModalOpen(false);

      if (onShowToast) {
        onShowToast(
          editingItem ? 'Agenda berhasil diperbarui!' : 'Agenda kegiatan baru berhasil ditambahkan!',
          'success'
        );
      }
    } catch {
      if (onShowToast) onShowToast('Gagal menyimpan agenda kegiatan.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const compressed = await fileToCompressedBase64(file, 1024, 1024, 0.7);
      setFormFotoUrl(compressed);
    } catch (err) {
      if (onShowToast) onShowToast('Gagal memproses foto. Silakan coba lagi.', 'error');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleQuickStatusToggle = async (item: AgendaKelurahanItem, newStatus: StatusAgendaType) => {
    try {
      await updateAgendaStatus(item.id, newStatus);
      setAgendaList(getLocalAgendaList());
      if (onShowToast) {
        const label =
          newStatus === 'SELESAI'
            ? 'Selesai 100%'
            : newStatus === 'PROSES'
            ? 'Sedang Berlangsung'
            : newStatus === 'BATAL'
            ? 'Dibatalkan'
            : 'Belum Selesai';
        onShowToast(`Status agenda "${item.namaKegiatan}" diubah menjadi ${label}!`, 'success');
      }
    } catch {
      if (onShowToast) onShowToast('Gagal memperbarui status agenda.', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      await deleteAgendaItem(itemToDelete.id);
      setAgendaList(getLocalAgendaList());
      setItemToDelete(null);
      if (onShowToast) onShowToast('Agenda kegiatan berhasil dihapus.', 'info');
    } catch {
      if (onShowToast) onShowToast('Gagal menghapus agenda.', 'error');
    }
  };

  const handleExportExcel = () => {
    if (filteredAgenda.length === 0) {
      if (onShowToast) onShowToast('Tidak ada data agenda untuk diekspor.', 'error');
      return;
    }
    const filename = `Agenda_Kelurahan_Mangga_${new Date().toISOString().split('T')[0]}.xlsx`;
    exportAgendaToExcel(filteredAgenda, filename);
    if (onShowToast) onShowToast(`Excel agenda berhasil diunduh (${filteredAgenda.length} kegiatan)!`, 'success');
  };

  // Filter & Search Logic
  const filteredAgenda = useMemo(() => {
    return agendaList.filter((item) => {
      // Search query
      const matchesQuery =
        !searchQuery.trim() ||
        item.namaKegiatan.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.lokasi.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.peserta.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.catatan && item.catatan.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.penanggungJawab && item.penanggungJawab.toLowerCase().includes(searchQuery.toLowerCase()));

      // Status filter
      const matchesStatus = statusFilter === 'ALL' || item.statusSelesai === statusFilter;

      // Date range filter
      let matchesDate = true;
      if (startDateFilter && item.tanggalKegiatan < startDateFilter) matchesDate = false;
      if (endDateFilter && item.tanggalKegiatan > endDateFilter) matchesDate = false;

      return matchesQuery && matchesStatus && matchesDate;
    });
  }, [agendaList, searchQuery, statusFilter, startDateFilter, endDateFilter]);

  // Statistics Summary
  const stats = useMemo(() => {
    const total = agendaList.length;
    const belum = agendaList.filter((a) => a.statusSelesai === 'BELUM').length;
    const proses = agendaList.filter((a) => a.statusSelesai === 'PROSES').length;
    const selesai = agendaList.filter((a) => a.statusSelesai === 'SELESAI').length;
    const batal = agendaList.filter((a) => a.statusSelesai === 'BATAL').length;
    return { total, belum, proses, selesai, batal };
  }, [agendaList]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-2 animate-fade-in">
      {/* Executive Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-emerald-800/60 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-950/80 border border-emerald-700/80 px-2.5 py-0.5 rounded-md">
                Agenda Resmi Kelurahan
              </span>
              <span className="text-slate-400 text-xs">·</span>
              <span className="text-emerald-200 text-xs font-bold">SI-MANGGA</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
              <Calendar className="w-6 h-6 text-emerald-400 shrink-0" />
              <span>Agenda & Jadwal Kegiatan Kelurahan Mangga</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-3xl leading-relaxed">
              Pusat penjadwalan resmi rapat koordinasi, gotong royong, posyandu, dan agenda kedinasan. 
              Dilengkapi penanggung jawab, sasaran peserta, status pelaksanaan, serta ekspor format Excel (.xlsx).
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition-all shadow-md cursor-pointer border border-emerald-400/40 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Tambah Agenda Baru</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              title="Unduh daftar agenda kegiatan ke format Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Unduh Excel</span>
            </button>

            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center justify-center p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
              title="Sinkronkan dengan Firestore"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Agenda</p>
            <p className="text-lg font-black text-slate-900">{stats.total} <span className="text-xs font-bold text-slate-400">Kegiatan</span></p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Mendatang / Belum</p>
            <p className="text-lg font-black text-amber-900">{stats.belum} <span className="text-xs font-bold text-amber-600">Rencana</span></p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200/60">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Sedang Berlangsung</p>
            <p className="text-lg font-black text-blue-900">{stats.proses} <span className="text-xs font-bold text-blue-600">Giat</span></p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/60">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Selesai 100%</p>
            <p className="text-lg font-black text-emerald-900">{stats.selesai} <span className="text-xs font-bold text-emerald-600">Terlaksana</span></p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar Container */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama kegiatan, lokasi, peserta, atau catatan..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Semua ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('BELUM')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                statusFilter === 'BELUM'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
            >
              Belum ({stats.belum})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PROSES')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                statusFilter === 'PROSES'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
              }`}
            >
              Proses ({stats.proses})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('SELESAI')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                statusFilter === 'SELESAI'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Selesai ({stats.selesai})
            </button>
            {stats.batal > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('BATAL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                  statusFilter === 'BATAL'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                    : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                }`}
              >
                Batal ({stats.batal})
              </button>
            )}
          </div>
        </div>

        {/* Date Filter Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Rentang Tanggal:
          </span>
          <input
            type="date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
          />
          <span className="text-slate-400 font-bold">s/d</span>
          <input
            type="date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
          />
          {(startDateFilter || endDateFilter) && (
            <button
              type="button"
              onClick={() => {
                setStartDateFilter('');
                setEndDateFilter('');
              }}
              className="text-rose-600 font-bold hover:underline"
            >
              Reset Tanggal
            </button>
          )}

          <div className="ml-auto text-[11px] font-bold text-slate-500">
            Menampilkan <span className="text-emerald-700 font-black">{filteredAgenda.length}</span> dari {agendaList.length} agenda
          </div>
        </div>
      </div>

      {/* Main Agenda List Grid */}
      {filteredAgenda.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Tidak ada agenda kegiatan ditemukan</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Gunakan tombol "Tambah Agenda Baru" untuk menambahkan jadwal kegiatan kelurahan, atau sesuaikan filter pencarian Anda.
          </p>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Agenda Baru</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAgenda.map((item) => {
            const isFinished = item.statusSelesai === 'SELESAI';
            const isProcess = item.statusSelesai === 'PROSES';
            const isCanceled = item.statusSelesai === 'BATAL';

            const statusBadgeClass = isFinished
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
              : isProcess
              ? 'bg-blue-100 text-blue-800 border-blue-300'
              : isCanceled
              ? 'bg-rose-100 text-rose-800 border-rose-300'
              : 'bg-amber-100 text-amber-800 border-amber-300';

            const statusLabel = isFinished
              ? 'Selesai 100%'
              : isProcess
              ? 'Sedang Berlangsung'
              : isCanceled
              ? 'Dibatalkan'
              : 'Belum Selesai (Mendatang)';

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all shadow-2xs hover:shadow-md ${
                  isFinished
                    ? 'border-emerald-200/90'
                    : isProcess
                    ? 'border-blue-200/90'
                    : isCanceled
                    ? 'border-rose-200/90'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left Column: Agenda Info */}
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${statusBadgeClass}`}>
                        {statusLabel}
                      </span>
                      {item.jamKegiatan && (
                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {item.jamKegiatan}
                        </span>
                      )}
                      {item.penanggungJawab && (
                        <span className="text-[11px] font-bold text-slate-600 bg-emerald-50/80 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                          PJ: {item.penanggungJawab}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                      {item.namaKegiatan}
                    </h3>

                    {/* Metadata Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                      <div className="flex items-start gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                        <Calendar className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Tanggal Kegiatan</span>
                          <span className="font-bold text-slate-900">{item.tanggalKegiatan}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                        <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Lokasi</span>
                          <span className="font-bold text-slate-900">{item.lokasi}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 sm:col-span-2">
                        <Users className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Peserta / Sasaran</span>
                          <span className="font-bold text-slate-900">{item.peserta}</span>
                        </div>
                      </div>
                    </div>

                    {/* Catatan / Notes */}
                    {item.catatan && (
                      <div className="bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl text-xs text-amber-950 flex items-start gap-2">
                        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800 block">
                            Catatan / Uraian Hasil:
                          </span>
                          <p className="font-medium whitespace-pre-wrap mt-0.5">{item.catatan}</p>
                        </div>
                      </div>
                    )}

                    {/* Foto Dokumen Attachment Display */}
                    {item.fotoDokumenUrl && (
                      <div className="mt-2 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Lampiran Foto Dokumen:</span>
                        <div className="relative group/photo w-full sm:w-64 aspect-video rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                          <img
                            src={item.fotoDokumenUrl}
                            alt="Foto Dokumen Agenda"
                            className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform duration-500"
                            onClick={() => setPreviewFotoUrl(item.fotoDokumenUrl || null)}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <span className="text-white text-[10px] font-bold flex items-center gap-1">
                              <Search className="w-3 h-3" /> Klik untuk Perbesar
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Quick Status & Actions */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-start gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    {/* Quick Status Buttons */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                      {!isFinished ? (
                        <button
                          type="button"
                          onClick={() => handleQuickStatusToggle(item, 'SELESAI')}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                          title="Tandai Selesai"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Tandai Selesai</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuickStatusToggle(item, 'BELUM')}
                          className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                          title="Ubah ke Belum Selesai"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Buka Kembali</span>
                        </button>
                      )}
                    </div>

                    {/* Edit & Delete Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="Edit Agenda"
                      >
                        <Edit className="w-3.5 h-3.5 text-slate-600" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border border-rose-200/60"
                        title="Hapus Agenda"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span className="hidden sm:inline">Hapus</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form: Add / Edit Agenda */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-300" />
                <h3 className="text-base font-bold">
                  {editingItem ? 'Edit Agenda Kegiatan' : 'Tambah Agenda Kegiatan Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Nama Kegiatan */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Nama Kegiatan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Contoh: Rapat Koordinasi Evaluasi PBB-P2 24 Lingkungan"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Tanggal & Jam */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Tanggal Kegiatan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Jam Kegiatan / Waktu
                  </label>
                  <input
                    type="text"
                    value={formJam}
                    onChange={(e) => setFormJam(e.target.value)}
                    placeholder="Contoh: 09:00 WIB"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Lokasi Kegiatan */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Lokasi Kegiatan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formLokasi}
                  onChange={(e) => setFormLokasi(e.target.value)}
                  placeholder="Contoh: Aula Utama Kantor Kelurahan Mangga / Posyandu Lk. XVIII"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Peserta */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Peserta / Target Audience <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formPeserta}
                  onChange={(e) => setFormPeserta(e.target.value)}
                  placeholder="Contoh: Seluruh Kepling Lk. 1 - 24, Lurah, Kasi, & TP-PKK"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Status Selesai & Penanggung Jawab */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Status Selesai / Pelaksanaan
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as StatusAgendaType)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white cursor-pointer"
                  >
                    <option value="BELUM">Belum Selesai (Mendatang)</option>
                    <option value="PROSES">Sedang Berlangsung</option>
                    <option value="SELESAI">Selesai 100%</option>
                    <option value="BATAL">Dibatalkan</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Penanggung Jawab / Instansi
                  </label>
                  <input
                    type="text"
                    value={formPenanggungJawab}
                    onChange={(e) => setFormPenanggungJawab(e.target.value)}
                    placeholder="Contoh: Kasi Tata Pemerintahan"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Catatan / Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Catatan / Keterangan Hasil (Opsional)
                </label>
                <textarea
                  rows={3}
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  placeholder="Tambahkan rincian hasil rapat, poin penting, atau instruksi tindak lanjut..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white resize-none"
                />
              </div>

              {/* Upload Foto Dokumen */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Lampiran Foto Dokumen (Opsional)
                </label>
                
                {formFotoUrl ? (
                  <div className="relative w-full aspect-video rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 overflow-hidden group">
                    <img src={formFotoUrl} alt="Preview Dokumen" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                      <button
                        type="button"
                        onClick={() => setFormFotoUrl(undefined)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-md cursor-pointer"
                      >
                        Hapus Foto
                      </button>
                      <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-md cursor-pointer">
                        Ganti Foto
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full aspect-video rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 transition-all cursor-pointer group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {isCompressing ? (
                        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-emerald-500 mb-2" />
                      )}
                      <p className="text-xs font-bold text-slate-500 group-hover:text-emerald-700">
                        {isCompressing ? 'Memproses Foto...' : 'Klik untuk Unggah Foto Dokumen'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">PNG, JPG up to 10MB</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isCompressing} />
                  </label>
                )}
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingItem ? 'Simpan Perubahan' : 'Tambah Agenda'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Hapus Agenda Kegiatan?</h3>
              <p className="text-xs text-slate-600">
                Apakah Anda yakin ingin menghapus agenda <span className="font-bold text-slate-900">"{itemToDelete.namaKegiatan}"</span>? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all shadow-md cursor-pointer"
              >
                Hapus Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Pratinjau Foto Dokumen */}
      {previewFotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewFotoUrl(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewFotoUrl(null)}
              className="self-end mb-2 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
              title="Tutup Pratinjau"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewFotoUrl}
              alt="Pratinjau Dokumen Agenda"
              className="max-h-[82vh] w-auto rounded-2xl shadow-2xl border border-white/20 object-contain bg-slate-900"
            />
          </div>
        </div>
      )}
    </div>
  );
};
