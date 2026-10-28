import React, { useState, useEffect } from 'react';
import { UserAccount, isPkkRole } from '../types';
import { saveCustomProfile } from '../data/keplingList';
import { X, Save, UserCircle, Phone, CheckCircle2, ShieldCheck, HeartHandshake } from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAccount: UserAccount;
  onProfileUpdated: (updatedAccount: UserAccount) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  activeAccount,
  onProfileUpdated,
}) => {
  const [nama, setNama] = useState(activeAccount?.nama || '');
  const [telepon, setTelepon] = useState(activeAccount?.telepon || '');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isPkk = activeAccount ? isPkkRole(activeAccount.role) : false;

  useEffect(() => {
    if (isOpen && activeAccount) {
      setNama(activeAccount.nama || '');
      setTelepon(activeAccount.telepon || '');
      setSuccessMsg('');
      setErrorMsg('');
    }
  }, [isOpen, activeAccount]);

  if (!isOpen || !activeAccount) return null;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanNama = (nama || '').trim();
    const cleanTelepon = (telepon || '').trim();

    if (!cleanNama) {
      setErrorMsg('Nama lengkap tidak boleh kosong.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // saveCustomProfile is synchronous for localStorage and dispatches background server/firestore sync
      const updatedAccount = saveCustomProfile(activeAccount.id, {
        nama: cleanNama,
        telepon: cleanTelepon,
      });

      if (!updatedAccount || !updatedAccount.id) {
        throw new Error('Gagal memproses data profil.');
      }

      setSuccessMsg('Profil berhasil diperbarui!');
      
      // Notify parent safely
      onProfileUpdated(updatedAccount);

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setErrorMsg(err?.message || 'Gagal menyimpan profil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-full border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header with Role Adaptive Theming */}
        <div
          className={`p-5 flex items-center justify-between shrink-0 text-white ${
            isPkk
              ? 'bg-gradient-to-r from-tosca-700 via-tosca-600 to-tosca-700'
              : 'bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
              {isPkk ? (
                <HeartHandshake className="w-5 h-5 text-amber-300" />
              ) : (
                <UserCircle className="w-5 h-5 text-emerald-200" />
              )}
            </div>
            <div>
              <h2 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                <span>{isPkk ? 'Ubah Profil TP-PKK' : 'Ubah Profil Akun Resmi'}</span>
              </h2>
              <p className="text-[11px] text-white/80 font-medium">
                Kelurahan Mangga • Medan Tuntungan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/15 rounded-xl text-white/80 hover:text-white transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-4 bg-slate-50">
          {/* Identity Info Card */}
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Jabatan Resmi:</span>
              <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                isPkk ? 'bg-tosca-100 text-tosca-900 border border-tosca-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
              }`}>
                {activeAccount.jabatan || activeAccount.role}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Wilayah / Tugas:</span>
              <span className="font-semibold text-slate-800 text-right">
                {activeAccount.lingkungan || 'Kelurahan Mangga'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
              <span className="text-slate-400 font-mono text-[10px]">ID Akun:</span>
              <span className="font-mono text-[10px] text-slate-500">
                {activeAccount.id}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold flex items-center gap-2">
              <X className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <UserCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Nama Lengkap Pejabat / Pengurus</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder={isPkk ? 'Contoh: Siti Aminah / Nama Pengurus' : 'Masukkan nama lengkap pejabat'}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-xs"
              />
              <p className="text-[11px] text-slate-500">
                Nama ini akan dicantumkan pada seluruh laporan resmi, tanda tangan dokumen, dan lembar cetak kegiatan.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>Nomor WhatsApp / Telepon (Opsional)</span>
              </label>
              <input
                type="text"
                value={telepon}
                onChange={(e) => setTelepon(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-xs"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 bg-slate-200/80 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving || !nama.trim()}
              className={`px-5 py-2.5 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer ${
                isPkk
                  ? 'bg-tosca-600 hover:bg-tosca-700 shadow-tosca-900/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
