import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';
import { saveCustomProfile } from '../data/keplingList';
import { X, Save, UserCircle, Phone } from 'lucide-react';

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
  const [nama, setNama] = useState(activeAccount.nama);
  const [telepon, setTelepon] = useState(activeAccount.telepon || '');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNama(activeAccount.nama);
      setTelepon(activeAccount.telepon || '');
      setSuccessMsg('');
      setErrorMsg('');
    }
  }, [isOpen, activeAccount]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const updatedAccount = await saveCustomProfile(activeAccount.id, {
        nama,
        telepon,
      });
      setSuccessMsg('Profil berhasil diperbarui!');
      onProfileUpdated(updatedAccount);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setErrorMsg('Gagal menyimpan profil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-full animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-emerald-700 p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-white">
            <UserCircle className="w-5 h-5 text-emerald-200" />
            <h2 className="font-bold">Edit Profil Pengguna</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-emerald-600 rounded-lg text-emerald-100 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto bg-slate-50">
          <div className="mb-4">
            <p className="text-xs text-slate-500 italic">
              Perbarui nama lengkap dan nomor telepon untuk akun{' '}
              <strong className="text-emerald-700">{activeAccount.lingkungan || 'SUPER ADMIN'}</strong>.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-bold">
              {successMsg}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <UserCircle className="w-3.5 h-3.5" /> Nama Lengkap
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Masukkan nama lengkap"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Nomor Telepon (Opsional)
              </label>
              <input
                type="text"
                value={telepon}
                onChange={(e) => setTelepon(e.target.value)}
                placeholder="Contoh: 08123456789"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !nama.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Profil'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
