import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Smartphone,
  Info,
  User,
  Lock,
  CheckCircle2,
  X,
  RotateCcw,
  Sparkles,
  Presentation,
} from 'lucide-react';
import { UserAccount } from '../types';
import {
  findAccountByUsername,
  verifyAccountPassword,
  saveCustomPassword,
  getEffectivePassword,
  FIXED_ACCOUNTS_LIST,
  FixedAccountOption,
  syncPasswordsWithServer,
  ALL_ACCOUNTS,
} from '../data/keplingList';

interface LoginPageProps {
  onLoginSuccess: (account: UserAccount, remember: boolean) => void;
  onOpenInstallModal?: () => void;
  onOpenPPTModal?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onOpenInstallModal,
  onOpenPPTModal,
}) => {
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modals
  const [isForgotHelpOpen, setIsForgotHelpOpen] = useState<boolean>(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);

  // Change Password Form State
  const [changeUserSelect, setChangeUserSelect] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showChangeCur, setShowChangeCur] = useState<boolean>(false);
  const [showChangeNew, setShowChangeNew] = useState<boolean>(false);
  const [showChangeConf, setShowChangeConf] = useState<boolean>(false);
  const [changeError, setChangeError] = useState<string>('');
  const [isSubmittingChange, setIsSubmittingChange] = useState<boolean>(false);

  // Sync stored custom passwords on mount
  useEffect(() => {
    syncPasswordsWithServer();
  }, []);

  // Identified account for feedback
  const detectedAccount = usernameInput.trim() ? findAccountByUsername(usernameInput.trim()) : undefined;

  const handleSelectFixedUser = (uname: string) => {
    setUsernameInput(uname);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedUser = usernameInput.trim();
    if (!trimmedUser) {
      setErrorMessage('Silakan pilih atau masukkan Username resmi akun Anda.');
      return;
    }

    if (!passwordInput.trim()) {
      setErrorMessage('Silakan masukkan kata sandi (password) akun Anda.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const targetAccount = findAccountByUsername(trimmedUser);

      if (!targetAccount) {
        setErrorMessage(
          `Username "${trimmedUser}" tidak terdaftar. Gunakan format username: kepling_1 s/d kepling_24, super_admin, atau kasi_pemerintahan, kasi_pembangunan, kasi_trantibum.`
        );
        setIsLoading(false);
        return;
      }

      const isValid = verifyAccountPassword(targetAccount, passwordInput);

      if (isValid) {
        onLoginSuccess(targetAccount, rememberMe);
      } else {
        setErrorMessage(
          `Kata sandi salah untuk akun ${targetAccount.lingkungan}! Bila belum pernah diubah, gunakan kata sandi bawaan, atau klik "Ubah Sandi" di bawah untuk mengatur ulang kata sandi Anda.`
        );
        setIsLoading(false);
      }
    }, 200);
  };

  const handleOpenChangePassword = () => {
    // Pre-populate with currently selected user if valid
    if (detectedAccount) {
      setChangeUserSelect(detectedAccount.id);
    } else {
      setChangeUserSelect('kepling_1');
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setChangeError('');
    setIsChangePasswordOpen(true);
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('');

    const target = ALL_ACCOUNTS.find((a) => a.id === changeUserSelect) || findAccountByUsername(changeUserSelect);
    if (!target) {
      setChangeError('Pilih akun yang valid.');
      return;
    }

    if (!currentPassword.trim()) {
      setChangeError('Kata sandi saat ini wajib diisi.');
      return;
    }

    if (!verifyAccountPassword(target, currentPassword)) {
      setChangeError(
        `Kata sandi saat ini salah untuk akun ${target.lingkungan}. Masukkan kata sandi yang berlaku (atau sandi bawaan awal jika belum diubah).`
      );
      return;
    }

    if (!newPassword.trim()) {
      setChangeError('Kata sandi baru tidak boleh kosong.');
      return;
    }

    if (newPassword.length < 4) {
      setChangeError('Kata sandi baru minimal harus 4 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangeError('Konfirmasi kata sandi baru tidak cocok. Periksa kembali.');
      return;
    }

    setIsSubmittingChange(true);
    try {
      saveCustomPassword(target.id, newPassword);
      // Auto fill form with new password
      setUsernameInput(target.id);
      setPasswordInput(newPassword);
      setSuccessMessage(
        `Kata sandi untuk ${target.nama} (${target.lingkungan}) berhasil diubah! Silakan klik "Masuk ke Aplikasi".`
      );
      setIsChangePasswordOpen(false);
    } catch (err) {
      setChangeError('Gagal menyimpan kata sandi baru.');
    } finally {
      setIsSubmittingChange(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-emerald-900 via-emerald-800 to-slate-900 text-slate-900 flex flex-col justify-between font-sans">
      {/* Top Banner Tagline */}
      <div className="max-w-4xl mx-auto w-full px-4 pt-4 sm:pt-6 flex items-center justify-between">
        <div className="inline-flex items-center rounded-md overflow-hidden shadow-xs text-[11px] font-black tracking-wider uppercase">
          <span className="bg-[#991B1B] text-white px-2 py-0.5">MEDAN</span>
          <span className="bg-[#1E3A8A] text-white px-2 py-0.5 tracking-normal font-bold">
            UNTUK SEMUA
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onOpenPPTModal && (
            <button
              id="btn-open-ppt-login"
              type="button"
              onClick={onOpenPPTModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer border border-teal-500/40"
              title="Download & Lihat Panduan PPT Kepling"
            >
              <Presentation className="w-4 h-4 text-emerald-300" />
              <span>File PPT Panduan</span>
            </button>
          )}

          {onOpenInstallModal && (
            <button
              type="button"
              onClick={onOpenInstallModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>Pasang APK</span>
            </button>
          )}
        </div>
      </div>

      {/* Center Login Box */}
      <div className="w-full max-w-md mx-auto px-4 py-6 sm:py-10">
        <div className="bg-white rounded-3xl shadow-2xl border border-emerald-700/30 overflow-hidden">
          {/* Logo & Header */}
          <div className="p-6 sm:p-7 text-center bg-linear-to-b from-emerald-50 to-white border-b border-slate-100">
            <div className="w-20 h-20 mx-auto mb-3 bg-white rounded-2xl shadow-md p-2 flex items-center justify-center border border-emerald-100">
              <img
                src="/logo_pemko_medan.svg"
                alt="Logo Pemko Medan"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-emerald-950 tracking-tight leading-tight uppercase">
              SI-KEPLING MANGGA
            </h1>
            <p className="text-[11px] font-extrabold text-emerald-700 mt-2 uppercase tracking-wider">
              Laporan Kegiatan Harian Kepala Lingkungan
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Kelurahan Mangga • Kecamatan Medan Tuntungan
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="p-6 sm:p-7 space-y-4">
            {errorMessage && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Username Selector & Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Username Akun</span>
                </span>
              </label>

              {/* Dropdown Pilihan Username */}
              <select
                id="select-login-fixed-username"
                value={detectedAccount ? detectedAccount.id : ''}
                onChange={(e) => handleSelectFixedUser(e.target.value)}
                className="w-full px-3 py-2.5 text-xs sm:text-sm border border-emerald-300 rounded-xl bg-emerald-50/50 font-semibold text-emerald-950 focus:bg-white focus:outline-emerald-600 cursor-pointer transition-colors"
              >
                <option value="">-- Pilih Username Akun Resmi --</option>
                <optgroup label="Pimpinan & Administrator Kelurahan">
                  <option value="super_admin">🔑 super_admin</option>
                </optgroup>
                <optgroup label="Kepala Seksi (Kasi) Kelurahan Mangga">
                  <option value="kasi_pemerintahan">🏛️ kasi_pemerintahan</option>
                  <option value="kasi_pembangunan">🏗️ kasi_pembangunan</option>
                  <option value="kasi_trantibum">🛡️ kasi_trantibum</option>
                </optgroup>
                <optgroup label="24 Kepala Lingkungan (kepling_1 s/d kepling_24)">
                  {FIXED_ACCOUNTS_LIST.filter((a) => a.role === 'kepling').map((acc) => (
                    <option key={acc.username} value={acc.username}>
                      📍 {acc.username}
                    </option>
                  ))}
                </optgroup>
              </select>

              {/* Manual Input Field */}
              <div className="relative pt-1">
                <input
                  id="input-login-username"
                  type="text"
                  autoComplete="username"
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    if (errorMessage) setErrorMessage('');
                    if (successMessage) setSuccessMessage('');
                  }}
                  placeholder="Atau ketik username (contoh: kepling_1, kasi_pemerintahan, super_admin)"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 font-mono text-slate-900 focus:bg-white focus:outline-emerald-600 focus:ring-2 focus:ring-emerald-600/30 transition-colors"
                  required
                />
              </div>

              {/* Account Match Indicator */}
              {detectedAccount ? (
                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between text-[11px] text-emerald-900">
                  <span className="font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{detectedAccount.lingkungan}: <strong>{detectedAccount.nama}</strong></span>
                  </span>
                  <span className="font-mono text-[10px] text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                    {detectedAccount.id}
                  </span>
                </div>
              ) : (
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Format resmi: <strong className="text-slate-700">kepling_1</strong> s/d <strong className="text-slate-700">kepling_24</strong>, <strong className="text-slate-700">kasi_pemerintahan</strong>, <strong className="text-slate-700">kasi_pembangunan</strong>, <strong className="text-slate-700">kasi_trantibum</strong>, atau <strong className="text-slate-700">super_admin</strong>.
                </p>
              )}
            </div>

            {/* Password Input Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Kata Sandi (Password)</span>
                </span>
                <button
                  type="button"
                  onClick={handleOpenChangePassword}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>Ubah Sandi?</span>
                </button>
              </label>

              <div className="relative">
                <input
                  id="input-login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (errorMessage) setErrorMessage('');
                    if (successMessage) setSuccessMessage('');
                  }}
                  placeholder="Masukkan kata sandi..."
                  className="w-full pl-3.5 pr-11 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-emerald-600 focus:ring-2 focus:ring-emerald-600/30 font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Button Ubah Sandi Prominent */}
            <button
              type="button"
              onClick={handleOpenChangePassword}
              className="w-full py-2 px-3 rounded-xl border border-amber-300 bg-amber-50/80 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-700" />
              <span>Ganti / Ubah Kata Sandi Akun</span>
            </button>

            {/* Remember Me & Help */}
            <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-[11px] font-medium text-slate-700">
                  Ingat sesi di perangkat ini
                </span>
              </label>

              <button
                type="button"
                onClick={() => setIsForgotHelpOpen(true)}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Bantuan akun
              </button>
            </div>

            {/* Submit Button */}
            <button
              id="btn-submit-login"
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl text-white font-bold text-xs sm:text-sm shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 bg-emerald-800 hover:bg-emerald-700 shadow-emerald-900/20 group"
            >
              <LogIn className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              <span>{isLoading ? 'Memverifikasi...' : 'Masuk ke Aplikasi'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="text-center py-4 px-4 text-xs text-emerald-200/80">
        Pemerintah Kota Medan • Kecamatan Medan Tuntungan • Kelurahan Mangga &copy; 2026
      </footer>

      {/* Modal Ubah Kata Sandi Ketika Login */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            <div className="bg-emerald-800 text-white p-4 flex items-center justify-between border-b border-emerald-700">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-amber-300">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Ubah Kata Sandi Akun</h3>
                  <p className="text-[10px] text-emerald-200">Ganti password akun resmi sebelum atau saat masuk</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-emerald-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="p-5 space-y-3.5 overflow-y-auto">
              {changeError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{changeError}</span>
                </div>
              )}

              {/* Pilih Akun Resmi */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Pilih Akun Resmi yang Ingin Diubah</label>
                <select
                  value={changeUserSelect}
                  onChange={(e) => setChangeUserSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 font-semibold text-slate-900 focus:bg-white focus:outline-emerald-600 cursor-pointer"
                >
                  <option value="super_admin">🔑 super_admin</option>
                  <optgroup label="Kepala Seksi (Kasi)">
                    <option value="kasi_pemerintahan">🏛️ kasi_pemerintahan</option>
                    <option value="kasi_pembangunan">🏗️ kasi_pembangunan</option>
                    <option value="kasi_trantibum">🛡️ kasi_trantibum</option>
                  </optgroup>
                  <optgroup label="24 Kepala Lingkungan">
                    {FIXED_ACCOUNTS_LIST.filter((a) => a.role === 'kepling').map((acc) => (
                      <option key={acc.username} value={acc.username}>
                        📍 {acc.username}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Password Saat Ini */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Kata Sandi Saat Ini / Bawaan</label>
                <div className="relative">
                  <input
                    type={showChangeCur ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan sandi saat ini (atau sandi bawaan)"
                    className="w-full pl-3 pr-10 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-emerald-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowChangeCur(!showChangeCur)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 p-1"
                  >
                    {showChangeCur ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Password Baru */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Kata Sandi Baru</label>
                <div className="relative">
                  <input
                    type={showChangeNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 4 karakter"
                    className="w-full pl-3 pr-10 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-emerald-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowChangeNew(!showChangeNew)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 p-1"
                  >
                    {showChangeNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Konfirmasi Password Baru */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Konfirmasi Kata Sandi Baru</label>
                <div className="relative">
                  <input
                    type={showChangeConf ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang sandi baru"
                    className="w-full pl-3 pr-10 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-emerald-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowChangeConf(!showChangeConf)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 p-1"
                  >
                    {showChangeConf ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingChange}
                  className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSubmittingChange ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Bantuan Akun */}
      {isForgotHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-emerald-800 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm">Bantuan Kata Sandi & Username</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotHelpOpen(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-emerald-700 text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs text-slate-700">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                  Username Akun Resmi
                </p>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Aplikasi menggunakan format username resmi untuk mempermudah identifikasi dan akses akun.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-slate-800 text-xs">
                  Format Username Resmi:
                </p>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 space-y-1">
                  <p>• Kepala Lingkungan : <span className="font-bold text-emerald-800">kepling_1</span> s/d <span className="font-bold text-emerald-800">kepling_24</span></p>
                  <p>• Super Admin : <span className="font-bold text-amber-800">super_admin</span></p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-slate-800 text-xs">
                  Cara Mengubah Kata Sandi:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600 text-[11px] leading-relaxed">
                  <li>Klik tombol kuning <strong>"Ganti / Ubah Kata Sandi Akun"</strong> di halaman login ini.</li>
                  <li>Atau setelah berhasil masuk, klik tombol <strong>"Ubah Sandi"</strong> di pojok kanan atas aplikasi.</li>
                  <li>Masukkan kata sandi lama dan tentukan kata sandi baru Anda.</li>
                </ol>
              </div>

              <button
                type="button"
                onClick={() => setIsForgotHelpOpen(false)}
                className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
