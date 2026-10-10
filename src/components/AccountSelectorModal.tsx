import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  X,
  Check,
  Building2,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Copy,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  UserCheck,
  FileSpreadsheet,
  ExternalLink,
  Flower2,
} from 'lucide-react';
import { SheetMetadata, UserAccount, isPkkRole } from '../types';
import {
  SUPER_ADMIN_ACCOUNT,
  SEKRETARIS_ACCOUNT,
  KASI_ACCOUNTS,
  KASI_PEMERINTAHAN_ACCOUNT,
  KASI_PEMBANGUNAN_ACCOUNT,
  KASI_TRANTIBUM_ACCOUNT,
  KEPLING_ACCOUNTS,
  ALL_ACCOUNTS,
  KETUA_PKK_KELURAHAN_ACCOUNT,
  SEKRETARIS_PKK_ACCOUNT,
  KETUA_POKJA_ACCOUNTS,
  KETUA_PKK_LINGKUNGAN_ACCOUNTS,
  verifyAccountPassword,
  getEffectivePassword,
  hasCustomPassword,
} from '../data/keplingList';

interface AccountSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAccount: UserAccount;
  onSelectAccount: (account: UserAccount) => void;
  sheetMeta?: SheetMetadata | null;
}

export const AccountSelectorModal: React.FC<AccountSelectorModalProps> = ({
  isOpen,
  onClose,
  activeAccount,
  onSelectAccount,
  sheetMeta,
}) => {
  const [activeView, setActiveView] = useState<'select' | 'credentials'>('select');
  const [search, setSearch] = useState('');
  const [selectedTargetAccount, setSelectedTargetAccount] = useState<UserAccount | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Privacy Protection: non-super_admin accounts can ONLY view their own profile
  if (activeAccount.role !== 'super_admin') {
    const isPkk = isPkkRole(activeAccount.role);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
          <div className={`px-5 py-4 text-white flex items-center justify-between ${isPkk ? 'bg-tosca-800' : 'bg-tosca-800'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shadow-inner font-black text-lg">
                {activeAccount.nomorLingkungan ? activeAccount.nomorLingkungan : (isPkk ? 'PKK' : 'ASN')}
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                  <span>{isPkk ? 'Profil Akun TP-PKK' : 'Profil Akun Resmi'}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-normal ${isPkk ? 'bg-tosca-700/80 text-tosca-200 border-tosca-600' : 'bg-tosca-700/80 text-emerald-200 border-tosca-600'}`}>
                    Terproteksi
                  </span>
                </h2>
                <p className="text-xs text-white/80 font-medium">
                  {activeAccount.lingkungan} • Kelurahan Mangga
                </p>
              </div>
            </div>
            <button
              id="btn-close-account-modal"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">{isPkk ? 'Nama Pengurus PKK' : 'Nama Pejabat / Kepling'}</span>
                <span className="text-slate-900 font-bold">{activeAccount.nama}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">Jabatan</span>
                <span className={`font-bold ${isPkk ? 'text-tosca-800' : 'text-tosca-800'}`}>{activeAccount.jabatan}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">Wilayah Tugas</span>
                <span className="text-slate-800 font-semibold">{activeAccount.lingkungan}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">Username Akun</span>
                <span className="font-mono font-bold text-slate-800 bg-slate-200/70 px-2 py-0.5 rounded">
                  {activeAccount.id}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Status Akun</span>
                <span className={`inline-flex items-center gap-1 font-bold ${isPkk ? 'text-tosca-700' : 'text-tosca-700'}`}>
                  <Check className="w-3.5 h-3.5" />
                  <span>Aktif & Terverifikasi</span>
                </span>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${isPkk ? 'bg-tosca-50 border-tosca-200 text-tosca-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
              <Lock className={`w-4 h-4 shrink-0 mt-0.5 ${isPkk ? 'text-tosca-700' : 'text-tosca-700'}`} />
              <p className="text-[11px] leading-relaxed">
                <strong>Privasi & Keamanan:</strong> {isPkk
                  ? 'Akun Pengurus PKK memiliki akses tersendiri khusus ke modul Laporan Keuangan dan Kegiatan PKK, terpisah secara tegas dari fitur perangkat operasional Kelurahan.'
                  : 'Setiap Kepala Lingkungan & Kasi hanya dapat melihat akun masing-masing. Informasi akun dan username lain dijaga kerahasiaannya.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`w-full py-2.5 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer ${isPkk ? 'bg-tosca-800 hover:bg-tosca-700' : 'bg-tosca-800 hover:bg-tosca-700'}`}
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  }

  const searchLower = String(search || '').toLowerCase();
  const filteredKepling = KEPLING_ACCOUNTS.filter(
    (k) =>
      String(k.lingkungan || '').toLowerCase().includes(searchLower) ||
      String(k.nama || '').toLowerCase().includes(searchLower) ||
      String(k.jabatan || '').toLowerCase().includes(searchLower)
  );

  const handleStartLogin = (account: UserAccount) => {
    // If it's already the active account, we can just close or re-authenticate
    if (account.id === activeAccount.id) {
      onClose();
      return;
    }
    setSelectedTargetAccount(account);
    setPasswordInput('');
    setErrorMessage('');
    setShowPassword(false);
  };

  const handleVerifyAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetAccount) return;

    const isValid = verifyAccountPassword(selectedTargetAccount, passwordInput);
    if (!isValid) {
      setErrorMessage(
        `Password salah untuk ${selectedTargetAccount.nama}! Pastikan kata sandi sesuai dengan data lingkungan Anda.`
      );
      return;
    }

    // Success!
    setErrorMessage('');
    onSelectAccount(selectedTargetAccount);
    setSelectedTargetAccount(null);
    setPasswordInput('');
    onClose();
  };

  const handleCopyPassword = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-tosca-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-200 shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>Autentikasi & Akun Pengguna</span>
                <span className="text-[10px] bg-tosca-700/80 text-emerald-200 px-2 py-0.5 rounded-full border border-tosca-600 font-normal">
                  Dilindungi Sandi
                </span>
              </h2>
              <p className="text-xs text-emerald-100 font-medium">
                Kecamatan Medan Tuntungan
              </p>
            </div>
          </div>
          <button
            id="btn-close-account-modal"
            type="button"
            onClick={() => {
              setSelectedTargetAccount(null);
              onClose();
            }}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100/80 px-4">
          <button
            type="button"
            onClick={() => {
              setActiveView('select');
              setSelectedTargetAccount(null);
            }}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeView === 'select'
                ? 'border-tosca-600 text-emerald-900 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-tosca-600" />
            <span>Pilih & Masuk Akun</span>
          </button>

          {/* Buku Sandi Resmi hanya dapat diakses oleh Super Admin */}
          {activeAccount.role === 'super_admin' && (
            <button
              type="button"
              onClick={() => {
                setActiveView('credentials');
                setSelectedTargetAccount(null);
              }}
              className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeView === 'credentials'
                  ? 'border-tosca-600 text-emerald-900 bg-white shadow-2xs rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              <span>Buku Sandi Resmi (Super Admin)</span>
            </button>
          )}
        </div>

        {/* View 1: Select & Verify Password */}
        {activeView === 'select' && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {selectedTargetAccount ? (
              /* Password Verification Step */
              <div className="p-6 flex-1 flex flex-col justify-center max-w-lg mx-auto w-full space-y-5 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => setSelectedTargetAccount(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-tosca-700 cursor-pointer self-start"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke daftar akun</span>
                </button>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-tosca-600 text-white mx-auto flex items-center justify-center font-black text-xl shadow-md">
                    {selectedTargetAccount.role === 'super_admin' ? (
                      <ShieldCheck className="w-8 h-8 text-amber-300" />
                    ) : (
                      selectedTargetAccount.nomorLingkungan
                    )}
                  </div>
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 mb-1">
                      {selectedTargetAccount.lingkungan}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedTargetAccount.nama}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedTargetAccount.jabatan}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleVerifyAndSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-tosca-700" />
                        <span>Masukkan Kata Sandi / Password:</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Perlindungan agar tidak salah pengguna
                      </span>
                    </label>

                    <div className="relative">
                      <input
                        id="input-account-password"
                        type={showPassword ? 'text' : 'password'}
                        value={passwordInput}
                        onChange={(e) => {
                          setPasswordInput(e.target.value);
                          if (errorMessage) setErrorMessage('');
                        }}
                        placeholder="Masukkan kata sandi akun..."
                        autoFocus
                        required
                        className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                        title={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {activeAccount.role === 'super_admin' ? (
                      <div className="mt-2 text-[11px] text-slate-500 bg-amber-50/80 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
                        <KeyRound className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <strong>Petunjuk Super Admin:</strong> Format kata sandi akun ini adalah{' '}
                          <code className="bg-amber-100 text-amber-900 px-1 py-0.2 rounded font-mono font-bold">
                            {selectedTargetAccount.password}
                          </code>
                          .
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-tosca-700 shrink-0" />
                        <span>Akun ini dilindungi kata sandi resmi demi keamanan dan ketertiban laporan.</span>
                      </div>
                    )}

                    {errorMessage && (
                      <div className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTargetAccount(null)}
                      className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      id="btn-confirm-account-password"
                      type="submit"
                      className="flex-1 py-2.5 text-xs font-bold text-white bg-tosca-700 hover:bg-tosca-800 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Verifikasi & Masuk</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Account Grid & Search */
              <>
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="input-search-account"
                      type="text"
                      placeholder="Cari nomor Lingkungan atau nama Kepala Lingkungan..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex-1 p-4 space-y-4">
                  {/* Super Admin Option */}
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
                      <span>Akun Administrator Kelurahan</span>
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Password: adminmangga2026
                      </span>
                    </div>
                    <button
                      id="btn-select-super-admin"
                      type="button"
                      onClick={() => handleStartLogin(SUPER_ADMIN_ACCOUNT)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                        activeAccount.id === SUPER_ADMIN_ACCOUNT.id
                          ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300'
                          : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-xs">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900">
                              {SUPER_ADMIN_ACCOUNT.nama}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-200 text-amber-900 border border-amber-300">
                              Hak Akses Penuh
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 font-medium mt-0.5">
                            {SUPER_ADMIN_ACCOUNT.jabatan} • Monitoring 24 Lingkungan
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeAccount.id === SUPER_ADMIN_ACCOUNT.id ? (
                          <div className="flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 px-2 py-1 rounded-lg">
                            <Check className="w-3.5 h-3.5" />
                            <span>Sedang Aktif</span>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-amber-700 bg-white border border-amber-200 px-2.5 py-1 rounded-lg shadow-2xs group-hover:bg-amber-500 group-hover:text-white">
                            Masuk
                          </span>
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Sekretaris Kelurahan / Lurah Option */}
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
                      <span>Akun Pimpinan & Sekretariat Kelurahan</span>
                      <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                        Password: sekretaris2026
                      </span>
                    </div>
                    <button
                      id="btn-select-sekretaris"
                      type="button"
                      onClick={() => handleStartLogin(SEKRETARIS_ACCOUNT)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                        activeAccount.id === SEKRETARIS_ACCOUNT.id
                          ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-300'
                          : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900">
                              {SEKRETARIS_ACCOUNT.nama}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                              Sekretaris Lurah (Seklur)
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 font-medium mt-0.5">
                            {SEKRETARIS_ACCOUNT.jabatan} • Monitoring, PBB, Pembangunan, Surat & Tugas Khusus
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeAccount.id === SEKRETARIS_ACCOUNT.id ? (
                          <div className="flex items-center gap-1 text-xs font-bold text-indigo-800 bg-indigo-100 px-2 py-1 rounded-lg">
                            <Check className="w-3.5 h-3.5" />
                            <span>Sedang Aktif</span>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-indigo-700 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg shadow-2xs group-hover:bg-indigo-600 group-hover:text-white">
                            Masuk
                          </span>
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Kepala Seksi (Kasi) Options */}
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
                      <span>Akun Kepala Seksi (Kasi) Kelurahan Mangga</span>
                      <span className="text-[10px] text-tosca-700 font-bold bg-tosca-50 px-1.5 py-0.5 rounded border border-tosca-200">
                        Dashboard Khusus Sektoral
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {KASI_ACCOUNTS.map((kasi) => {
                        const isSelected = activeAccount.id === kasi.id;
                        const isPem = kasi.role === 'kasi_pemerintahan';
                        const isBang = kasi.role === 'kasi_pembangunan';
                        const isTrantib = kasi.role === 'kasi_trantibum';

                        return (
                          <button
                            key={kasi.id}
                            type="button"
                            onClick={() => handleStartLogin(kasi)}
                            className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-tosca-50 border-tosca-500 ring-2 ring-tosca-300'
                                : 'bg-white border-slate-200 hover:border-tosca-300 hover:bg-tosca-50/30'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span
                                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                    isPem
                                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                      : isBang
                                      ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                      : 'bg-orange-100 text-orange-900 border border-orange-300'
                                  }`}
                                >
                                  {isPem ? 'PBB' : isBang ? 'PERLINSOS' : 'TRANTIB'}
                                </span>
                                {isSelected && (
                                  <span className="text-[10px] font-bold text-tosca-800 bg-tosca-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                    <Check className="w-3 h-3" /> Aktif
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-bold text-slate-900 line-clamp-1">
                                {kasi.nama}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {kasi.jabatan}
                              </div>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                              <span className="font-mono text-slate-400">{kasi.id}</span>
                              <span className="font-bold text-tosca-700">Masuk &rarr;</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 24 Kepling Option */}
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
                      <span>Daftar 24 Kepala Lingkungan (I s/d XXIV)</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Pilih untuk memasukkan sandi akun
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredKepling.map((kepling) => {
                        const isSelected = activeAccount.id === kepling.id;
                        return (
                          <button
                            key={kepling.id}
                            id={`btn-select-account-${kepling.id}`}
                            type="button"
                            onClick={() => handleStartLogin(kepling)}
                            className={`text-left p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-300'
                                : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isSelected
                                    ? 'bg-tosca-700 text-white'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {kepling.nomorLingkungan}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-tosca-800 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-tosca-600 shrink-0" />
                                  <span className="truncate">{kepling.lingkungan}</span>
                                </div>
                                <div className="text-xs font-bold text-slate-900 truncate">
                                  {kepling.nama}
                                </div>
                                {activeAccount.role === 'super_admin' ? (
                                  <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                                    <span>Pass:</span>
                                    <code className="bg-slate-100 text-tosca-800 px-1 rounded font-mono font-bold">
                                      {kepling.password}
                                    </code>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                                    <Lock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                    <span>Terproteksi Sandi</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 ml-2">
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-tosca-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                                  <Check className="w-3.5 h-3.5" />
                                  Aktif
                                </span>
                              ) : (
                                <Lock className="w-3.5 h-3.5 text-slate-300 hover:text-tosca-600" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {filteredKepling.length === 0 && (
                      <div className="text-center py-8 text-xs text-slate-400">
                        Tidak ada Kepala Lingkungan yang cocok dengan pencarian "{search}".
                      </div>
                    )}
                  </div>

                  {/* Pengurus Tim Penggerak PKK (Ketua PKK, 4 Pokja, & 24 Lingkungan) */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-tosca-800">
                        <Flower2 className="w-3.5 h-3.5 text-tosca-600" />
                        <span>Akun Pengurus Tim Penggerak PKK</span>
                      </span>
                      <span className="text-[10px] text-tosca-700 font-bold bg-tosca-50 px-1.5 py-0.5 rounded border border-tosca-200">
                        Portal PKK Mandiri
                      </span>
                    </div>

                    {/* Ketua, Sekretaris PKK Kelurahan & 4 Pokja */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                      {[KETUA_PKK_KELURAHAN_ACCOUNT, SEKRETARIS_PKK_ACCOUNT, ...KETUA_POKJA_ACCOUNTS].map((pkkAcc) => {
                        const isSelected = activeAccount.id === pkkAcc.id;
                        return (
                          <button
                            key={pkkAcc.id}
                            type="button"
                            onClick={() => handleStartLogin(pkkAcc)}
                            className={`text-left p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-tosca-50 border-tosca-500 ring-2 ring-tosca-300'
                                : 'bg-white border-slate-200 hover:border-tosca-400 hover:bg-tosca-50/40'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isSelected ? 'bg-tosca-700 text-white' : 'bg-tosca-100 text-tosca-800'
                                }`}
                              >
                                <Flower2 className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 truncate">
                                  {pkkAcc.nama}
                                </div>
                                <div className="text-[11px] text-tosca-700 font-semibold truncate">
                                  {pkkAcc.jabatan}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                  <span>Username:</span>
                                  <code className="bg-slate-100 text-tosca-800 px-1 rounded font-mono font-bold">
                                    {pkkAcc.id}
                                  </code>
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 ml-2">
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-tosca-700 bg-tosca-100 px-2 py-0.5 rounded-md">
                                  <Check className="w-3.5 h-3.5" />
                                  Aktif
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-tosca-700 bg-tosca-50 border border-tosca-200 px-2 py-0.5 rounded">
                                  Masuk
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* 24 Ketua PKK Lingkungan */}
                    <div className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-1.5">
                      24 Ketua PKK Tingkat Lingkungan
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                      {KETUA_PKK_LINGKUNGAN_ACCOUNTS.filter(
                        (k) =>
                          !search ||
                          k.lingkungan.toLowerCase().includes(search.toLowerCase()) ||
                          k.nama.toLowerCase().includes(search.toLowerCase()) ||
                          k.id.toLowerCase().includes(search.toLowerCase())
                      ).map((pkkLing) => {
                        const isSelected = activeAccount.id === pkkLing.id;
                        return (
                          <button
                            key={pkkLing.id}
                            type="button"
                            onClick={() => handleStartLogin(pkkLing)}
                            className={`text-left p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-tosca-50 border-tosca-500 ring-2 ring-tosca-300'
                                : 'bg-white border-slate-200 hover:border-tosca-400 hover:bg-tosca-50/30'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isSelected ? 'bg-tosca-700 text-white' : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {pkkLing.nomorLingkungan}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 truncate">
                                  {pkkLing.nama}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {pkkLing.id} • Pass: {pkkLing.password}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 ml-2">
                              {isSelected ? (
                                <span className="text-[10px] font-bold text-tosca-700 bg-tosca-100 px-1.5 py-0.5 rounded">
                                  Aktif
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-tosca-700">
                                  Masuk &rarr;
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* View 2: Complete Official Credential Table (Super Admin only) */}
        {activeView === 'credentials' && activeAccount.role === 'super_admin' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-bold text-amber-900">
                  Daftar Kata Sandi Resmi 24 Kepala Lingkungan
                </h4>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Gunakan daftar ini untuk dibagikan kepada masing-masing Kepala Lingkungan. Setiap akun diproteksi sandi agar pelaporan tertib dan tidak tertukar.
                </p>
              </div>
            </div>

            {/* Google Sheets Username Sheet status */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-tosca-700 shrink-0" />
                <span>
                  Data Nama User & Password akun ini otomatis tersimpan di tab <strong>"Username"</strong> pada Google Spreadsheet database.
                </span>
              </div>
              {sheetMeta?.spreadsheetUrl && (
                <a
                  href={sheetMeta.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-tosca-700 bg-white border border-emerald-300 px-2.5 py-1 rounded-lg hover:bg-emerald-100 shrink-0 transition-colors"
                >
                  <span>Buka Sheet</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">No / Wilayah</th>
                    <th className="p-2.5">Username</th>
                    <th className="p-2.5">Nama Pejabat / Kepling</th>
                    <th className="p-2.5">Password Masuk</th>
                    <th className="p-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Super admin row */}
                  <tr className="bg-amber-50/60 font-medium">
                    <td className="p-2.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span className="font-bold text-slate-900">Super Admin</span>
                    </td>
                    <td className="p-2.5">
                      <code className="text-[11px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                        super_admin
                      </code>
                    </td>
                    <td className="p-2.5 text-slate-800 font-bold">
                      {SUPER_ADMIN_ACCOUNT.nama}
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5">
                        <code className="bg-white border border-amber-300 text-amber-900 px-2 py-0.5 rounded font-mono font-bold">
                          {getEffectivePassword(SUPER_ADMIN_ACCOUNT)}
                        </code>
                        {hasCustomPassword(SUPER_ADMIN_ACCOUNT.id) && (
                          <span className="text-[9px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-bold">
                            Kustom
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyPassword(getEffectivePassword(SUPER_ADMIN_ACCOUNT), SUPER_ADMIN_ACCOUNT.id)
                        }
                        className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === SUPER_ADMIN_ACCOUNT.id ? (
                          <>
                            <Check className="w-3 h-3 text-tosca-600" />
                            <span className="text-tosca-700">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>

                  {/* Sekretaris Kelurahan row */}
                  <tr className="bg-indigo-50/50 font-medium">
                    <td className="p-2.5 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-slate-900">Sekretaris Kelurahan (Seklur)</span>
                    </td>
                    <td className="p-2.5">
                      <code className="text-[11px] font-mono font-bold text-indigo-900 bg-indigo-100 border border-indigo-300 px-2 py-0.5 rounded">
                        sekretaris
                      </code>
                    </td>
                    <td className="p-2.5 text-slate-800 font-bold">
                      {SEKRETARIS_ACCOUNT.nama}
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5">
                        <code className="bg-white border border-indigo-300 text-indigo-900 px-2 py-0.5 rounded font-mono font-bold">
                          {getEffectivePassword(SEKRETARIS_ACCOUNT)}
                        </code>
                        {hasCustomPassword(SEKRETARIS_ACCOUNT.id) && (
                          <span className="text-[9px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-bold">
                            Kustom
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyPassword(getEffectivePassword(SEKRETARIS_ACCOUNT), SEKRETARIS_ACCOUNT.id)
                        }
                        className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === SEKRETARIS_ACCOUNT.id ? (
                          <>
                            <Check className="w-3 h-3 text-tosca-600" />
                            <span className="text-tosca-700">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>

                  {/* Kasi accounts rows */}
                  {KASI_ACCOUNTS.map((kasi) => {
                    const effPass = getEffectivePassword(kasi);
                    const isCustom = hasCustomPassword(kasi.id);
                    return (
                      <tr key={kasi.id} className="bg-tosca-50/30 hover:bg-tosca-50/60 transition-colors">
                        <td className="p-2.5 font-bold text-tosca-950">
                          {kasi.jabatan}
                        </td>
                        <td className="p-2.5">
                          <code className="text-[11px] font-mono font-bold text-tosca-900 bg-tosca-100/60 border border-tosca-300 px-2 py-0.5 rounded">
                            {kasi.id}
                          </code>
                        </td>
                        <td className="p-2.5 font-semibold text-slate-800">
                          {kasi.nama}
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <code className="bg-white border border-tosca-300 text-tosca-900 px-2 py-0.5 rounded font-mono font-bold">
                              {effPass}
                            </code>
                            {isCustom && (
                              <span className="text-[9px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-bold">
                                Kustom
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleCopyPassword(effPass, kasi.id)}
                            className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            {copiedId === kasi.id ? (
                              <>
                                <Check className="w-3 h-3 text-tosca-600" />
                                <span className="text-tosca-700">Tersalin</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Salin</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* 24 Kepling rows */}
                  {KEPLING_ACCOUNTS.map((k) => {
                    const effPass = getEffectivePassword(k);
                    const isCustom = hasCustomPassword(k.id);
                    return (
                      <tr key={k.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 font-bold text-emerald-900">
                          {k.lingkungan}
                        </td>
                        <td className="p-2.5">
                          <code className="text-[11px] font-mono font-bold text-tosca-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            {k.id}
                          </code>
                        </td>
                        <td className="p-2.5 font-semibold text-slate-800">
                          {k.nama}
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <code className="bg-slate-100 border border-slate-200 text-tosca-800 px-2 py-0.5 rounded font-mono font-bold">
                              {effPass}
                            </code>
                            {isCustom && (
                              <span className="text-[9px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-bold">
                                Kustom
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleCopyPassword(effPass, k.id)}
                            className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            {copiedId === k.id ? (
                              <>
                                <Check className="w-3 h-3 text-tosca-600" />
                                <span className="text-tosca-700">Tersalin</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-400" />
                                <span>Salin</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Akun aktif:{' '}
            <strong className="text-slate-800">{activeAccount.nama}</strong> (
            {activeAccount.lingkungan})
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedTargetAccount(null);
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
