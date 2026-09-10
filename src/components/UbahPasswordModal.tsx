import React, { useState } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  RotateCcw,
  Lock,
} from 'lucide-react';
import { UserAccount } from '../types';
import {
  ALL_ACCOUNTS,
  SUPER_ADMIN_ACCOUNT,
  verifyAccountPassword,
  saveCustomPassword,
  resetCustomPassword,
  hasCustomPassword,
  getEffectivePassword,
} from '../data/keplingList';

interface UbahPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAccount: UserAccount;
  onSuccess: (message: string) => void;
}

export const UbahPasswordModal: React.FC<UbahPasswordModalProps> = ({
  isOpen,
  onClose,
  activeAccount,
  onSuccess,
}) => {
  // If super admin, allow selecting which account to change
  const [selectedAccountId, setSelectedAccountId] = useState<string>(activeAccount.id);
  const targetAccount = ALL_ACCOUNTS.find((a) => a.id === selectedAccountId) || activeAccount;

  const isSuperAdmin = activeAccount.role === 'super_admin';
  const isEditingSelf = targetAccount.id === activeAccount.id;

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleResetForm = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage('');
  };

  const handleAccountChange = (id: string) => {
    setSelectedAccountId(id);
    handleResetForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // If not super admin changing another account, old password is required
    if (!isSuperAdmin || isEditingSelf) {
      if (!oldPassword.trim()) {
        setErrorMessage('Password saat ini wajib diisi.');
        return;
      }
      if (!verifyAccountPassword(targetAccount, oldPassword)) {
        setErrorMessage('Password saat ini salah. Pastikan Anda memasukkan kata sandi yang benar.');
        return;
      }
    }

    if (!newPassword.trim()) {
      setErrorMessage('Password baru tidak boleh kosong.');
      return;
    }

    if (newPassword.length < 4) {
      setErrorMessage('Password baru minimal harus 4 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi password baru tidak cocok. Silakan ketik ulang.');
      return;
    }

    setIsSubmitting(true);
    try {
      saveCustomPassword(targetAccount.id, newPassword);
      onSuccess(`Password untuk ${targetAccount.nama} (${targetAccount.lingkungan}) berhasil diperbarui!`);
      handleResetForm();
      onClose();
    } catch (err) {
      setErrorMessage('Gagal menyimpan password baru ke penyimpanan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm(`Yakin ingin mengembalikan kata sandi ${targetAccount.nama} ke sandi bawaan awal (${targetAccount.password})?`)) {
      resetCustomPassword(targetAccount.id);
      onSuccess(`Password ${targetAccount.nama} dikembalikan ke sandi bawaan (${targetAccount.password}).`);
      handleResetForm();
      onClose();
    }
  };

  const isCustomized = hasCustomPassword(targetAccount.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-emerald-800 text-white p-4 sm:p-5 flex items-center justify-between border-b border-emerald-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700/80 border border-emerald-500/40 flex items-center justify-center text-amber-300 shadow-inner">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">
                Ubah Kata Sandi (Password)
              </h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                Kelurahan Mangga • Keamanan Akun
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Target Account Badge / Switcher for Super Admin */}
          {isSuperAdmin ? (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Pilih Akun yang Ingin Diubah Sandinya:
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 font-medium text-slate-800 focus:outline-emerald-600"
              >
                <option value={SUPER_ADMIN_ACCOUNT.id}>
                  👑 SUPER ADMIN - Kelurahan Mangga
                </option>
                <optgroup label="24 Kepala Lingkungan (Kepling)">
                  {ALL_ACCOUNTS.filter((a) => a.role === 'kepling').map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.lingkungan} - {acc.nama}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                  Akun Anda:
                </span>
                <h4 className="text-xs font-bold text-slate-900">
                  {targetAccount.nama}
                </h4>
                <p className="text-[11px] text-slate-600">
                  {targetAccount.jabatan}
                </p>
              </div>
              <span className="px-2 py-1 bg-emerald-700 text-white font-bold text-[10px] rounded-lg">
                {targetAccount.lingkungan}
              </span>
            </div>
          )}

          {/* Status custom password */}
          {isCustomized && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Akun ini sudah menggunakan sandi kustom.</span>
              </span>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-[11px] font-bold text-amber-800 underline hover:text-amber-950 cursor-pointer inline-flex items-center gap-1"
                title="Kembalikan ke sandi bawaan sistem"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          )}

          {/* Error notification */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Old Password (only required if not super admin changing someone else) */}
            {(!isSuperAdmin || isEditingSelf) && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Kata Sandi Saat Ini</span>
                  <span className="text-[10px] text-slate-400 font-normal">Wajib</span>
                </label>
                <div className="relative">
                  <input
                    type={showOld ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Masukkan sandi saat ini..."
                    className="w-full pl-3 pr-10 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld(!showOld)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* New Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Kata Sandi Baru</span>
                <span className="text-[10px] text-slate-400 font-normal">Min. 4 karakter</span>
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ketik password baru yang diinginkan..."
                  className="w-full pl-3 pr-10 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Ulangi Kata Sandi Baru
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password baru..."
                  className="w-full pl-3 pr-10 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Password Baru'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer Info */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 text-center">
          Ingat password baru Anda dengan baik. Hubungi Admin Kelurahan jika lupa sandi.
        </div>
      </div>
    </div>
  );
};
