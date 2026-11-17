import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Camera,
  Plus,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  ImageIcon,
  Briefcase,
  UserCheck,
} from 'lucide-react';
import { UserAccount, KegiatanLurahItem } from '../types';
import {
  getLocalKegiatanLurahList,
  fetchKegiatanLurahFromFirestore,
  subscribeKegiatanLurahFromFirestore,
  saveKegiatanLurahItem,
  deleteKegiatanLurahItem,
} from '../lib/kegiatanLurahService';
import { fileToCompressedBase64 } from '../utils/imageCompressor';

interface KegiatanLurahViewProps {
  currentUser: UserAccount;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const KegiatanLurahView: React.FC<KegiatanLurahViewProps> = ({
  currentUser,
  onShowToast,
}) => {
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const [kegiatanList, setKegiatanList] = useState<KegiatanLurahItem[]>(() => getLocalKegiatanLurahList());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KegiatanLurahItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<KegiatanLurahItem | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Form State
  const [formNama, setFormNama] = useState('');
  const [formHariTanggal, setFormHariTanggal] = useState('');
  const [formWaktu, setFormWaktu] = useState('');
  const [formLokasi, setFormLokasi] = useState('');
  const [formCatatan, setFormCatatan] = useState('');
  const [formFotoUrl, setFormFotoUrl] = useState<string | undefined>(undefined);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchKegiatanLurahFromFirestore().then((items) => setKegiatanList(items)).catch(() => {});
    const unsub = subscribeKegiatanLurahFromFirestore((items) => {
      setKegiatanList(items);
    });

    const handleLocalSync = () => {
      setKegiatanList(getLocalKegiatanLurahList());
    };
    window.addEventListener('kegiatan-lurah-updated', handleLocalSync);

    return () => {
      unsub();
      window.removeEventListener('kegiatan-lurah-updated', handleLocalSync);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const items = await fetchKegiatanLurahFromFirestore();
      setKegiatanList(items);
      if (onShowToast) onShowToast('Data kegiatan lurah berhasil disinkronkan!', 'success');
    } catch {
      if (onShowToast) onShowToast('Gagal menyinkronkan data kegiatan lurah.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenAddModal = () => {
    if (!isSuperAdmin) {
      if (onShowToast) onShowToast('Akses Dibatasi: Fitur tambah Kegiatan Lurah hanya khusus untuk Super Admin.', 'error');
      return;
    }
    setEditingItem(null);
    setFormNama('');
    setFormHariTanggal('Senin, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }));
    setFormWaktu('09:00 - selesai WIB');
    setFormLokasi('Kantor Kelurahan Mangga / Wilayah Kelurahan');
    setFormCatatan('');
    setFormFotoUrl(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: KegiatanLurahItem) => {
    if (!isSuperAdmin) {
      if (onShowToast) onShowToast('Akses Dibatasi: Fitur ubah Kegiatan Lurah hanya khusus untuk Super Admin.', 'error');
      return;
    }
    setEditingItem(item);
    setFormNama(item.namaKegiatan);
    setFormHariTanggal(item.hariTanggal);
    setFormWaktu(item.waktu);
    setFormLokasi(item.lokasi);
    setFormCatatan(item.catatan || '');
    setFormFotoUrl(item.fotoKehadiranUrl);
    setIsModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    try {
      const compressed = await fileToCompressedBase64(file, 900, 900, 0.82);
      setFormFotoUrl(compressed);
      if (onShowToast) onShowToast('Foto kehadiran berhasil dikompresi & dimuat.', 'success');
    } catch (err) {
      console.error(err);
      if (onShowToast) onShowToast('Gagal memproses foto kehadiran.', 'error');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      if (onShowToast) onShowToast('Akses Dibatasi: Hanya Super Admin yang berwenang menyimpan Kegiatan Lurah.', 'error');
      return;
    }
    if (!formNama.trim() || !formHariTanggal.trim() || !formWaktu.trim() || !formLokasi.trim()) {
      if (onShowToast) onShowToast('Mohon lengkapi Nama Kegiatan, Hari/Tanggal, Waktu, dan Lokasi.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const newItem: KegiatanLurahItem = {
        id: editingItem ? editingItem.id : `keg_lurah_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        namaKegiatan: formNama.trim(),
        hariTanggal: formHariTanggal.trim(),
        waktu: formWaktu.trim(),
        lokasi: formLokasi.trim(),
        catatan: formCatatan.trim(),
        fotoKehadiranUrl: formFotoUrl,
        createdByName: editingItem ? editingItem.createdByName : currentUser.nama,
        createdAt: editingItem ? editingItem.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const success = await saveKegiatanLurahItem(newItem);
      if (success) {
        if (onShowToast) onShowToast(editingItem ? 'Kegiatan Lurah berhasil diperbarui.' : 'Kegiatan Lurah baru berhasil ditambahkan.', 'success');
        setIsModalOpen(false);
      } else {
        if (onShowToast) onShowToast('Gagal menyimpan Kegiatan Lurah.', 'error');
      }
    } catch (err) {
      console.error(err);
      if (onShowToast) onShowToast('Terjadi kesalahan saat menyimpan.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!isSuperAdmin) {
      if (onShowToast) onShowToast('Akses Dibatasi: Hanya Super Admin yang berwenang menghapus Kegiatan Lurah.', 'error');
      return;
    }
    if (!itemToDelete) return;
    try {
      await deleteKegiatanLurahItem(itemToDelete.id);
      if (onShowToast) onShowToast('Kegiatan Lurah berhasil dihapus.', 'success');
      setItemToDelete(null);
    } catch (err) {
      console.error(err);
      if (onShowToast) onShowToast('Gagal menghapus kegiatan.', 'error');
    }
  };

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return kegiatanList;
    return kegiatanList.filter(
      (item) =>
        item.namaKegiatan.toLowerCase().includes(q) ||
        item.lokasi.toLowerCase().includes(q) ||
        item.hariTanggal.toLowerCase().includes(q)
    );
  }, [kegiatanList, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-300/40 text-emerald-100 text-[10px] font-black uppercase tracking-wider">
            <Briefcase className="w-3.5 h-3.5 text-amber-300" />
            <span>Agenda Eksekutif Kelurahan Mangga</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black tracking-tight">
            Kegiatan Lurah
          </h3>
          <p className="text-xs text-emerald-100/90 max-w-2xl font-medium">
            Dokumentasi lengkap jadwal kegiatan, kehadiran, waktu, lokasi, dan bukti foto kegiatan Lurah Kelurahan Mangga.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black transition-all border border-white/20 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sinkronkan</span>
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-lg transition-all cursor-pointer border border-amber-300"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Kegiatan Lurah</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama kegiatan, lokasi, atau tanggal..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>

        <div className="text-xs font-bold text-slate-600 px-2">
          Total: <strong className="text-emerald-700">{filteredList.length}</strong> Kegiatan Lurah
        </div>
      </div>

      {/* Kegiatan List Grid / Cards */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-sm font-black text-slate-800">Belum ada data Kegiatan Lurah</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery ? 'Tidak ada kegiatan yang cocok dengan kata kunci pencarian.' : 'Tekan tombol "Tambah Kegiatan Lurah" di atas untuk mulai mencatat agenda dan kehadiran.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col overflow-hidden group"
            >
              {/* Card Photo Preview Header */}
              <div className="relative h-48 bg-slate-900 overflow-hidden flex items-center justify-center">
                {item.fotoKehadiranUrl ? (
                  <img
                    src={item.fotoKehadiranUrl}
                    alt={item.namaKegiatan}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                    onClick={() => setPreviewImageUrl(item.fotoKehadiranUrl!)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-1 p-4 text-center">
                    <ImageIcon className="w-10 h-10 stroke-1" />
                    <span className="text-[11px] font-medium">Belum ada foto kehadiran</span>
                  </div>
                )}
                <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-slate-950/70 backdrop-blur-xs text-white text-[10px] font-black uppercase tracking-wider border border-white/20">
                  KEGIATAN LURAH
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-slate-900 leading-snug">
                    {item.namaKegiatan}
                  </h4>

                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-bold text-slate-800">{item.hariTanggal}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span className="font-semibold">{item.waktu}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span className="font-medium text-slate-700">{item.lokasi}</span>
                    </div>
                  </div>

                  {item.catatan && (
                    <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100 italic">
                      "{item.catatan}"
                    </p>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400">
                    Oleh: {item.createdByName || 'Super Admin'}
                  </span>

                  {isSuperAdmin ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 transition-colors cursor-pointer"
                        title="Ubah Kegiatan"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 transition-colors cursor-pointer"
                        title="Hapus Kegiatan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200">
                      <span>Mode Lihat Saja</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-emerald-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-4 flex items-center justify-between shrink-0">
              <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-300" />
                <span>{editingItem ? 'Ubah Kegiatan Lurah' : 'Tambah Kegiatan Lurah Baru'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                  Nama Kegiatan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Contoh: Rapat Koordinasi Musrenbang Kelurahan..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                    Hari / Tanggal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formHariTanggal}
                    onChange={(e) => setFormHariTanggal(e.target.value)}
                    placeholder="Contoh: Senin, 17 November 2026"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                    Waktu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formWaktu}
                    onChange={(e) => setFormWaktu(e.target.value)}
                    placeholder="Contoh: 09:00 - 12:00 WIB"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                  Lokasi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formLokasi}
                  onChange={(e) => setFormLokasi(e.target.value)}
                  placeholder="Contoh: Aula Kantor Camat Medan Tuntungan..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                  Foto Kehadiran (Bukti Kehadiran)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/50 text-slate-700 text-xs font-bold cursor-pointer transition-all">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span>{isCompressing ? 'Memproses Foto...' : 'Unggah Foto Kehadiran'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={isCompressing}
                    />
                  </label>
                  {formFotoUrl && (
                    <div className="w-12 h-12 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-slate-100">
                      <img src={formFotoUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                  Catatan / Keterangan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  placeholder="Catatan tambahan hasil kegiatan atau kehadiran..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isCompressing}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan Kegiatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-slate-900">Hapus Kegiatan Lurah</h3>
            </div>
            <p className="text-xs text-slate-600">
              Apakah Anda yakin ingin menghapus kegiatan <strong className="text-slate-900">"{itemToDelete.namaKegiatan}"</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Image Preview Modal */}
      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs cursor-pointer animate-fade-in"
        >
          <div className="relative max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-black border border-white/20">
            <img src={previewImageUrl} alt="Bukti Kehadiran" className="w-full h-full object-contain max-h-[85vh]" />
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-rose-600 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
