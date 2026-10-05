import React, { useState } from 'react';
import {
  Landmark,
  HeartHandshake,
  ShieldAlert,
  Edit3,
  Save,
  RotateCcw,
  Copy,
  Check,
  X,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  UserCheck,
  Smartphone,
  Users,
  Building,
  Target,
  FileText,
  AlertCircle,
  CheckCircle2,
  Phone,
  KeyRound,
  Lock,
  Sparkles,
} from 'lucide-react';
import { KepalaSeksiProfile, KepalaSeksiRole } from '../types';
import {
  getAllKasiProfiles,
  saveKasiProfile,
  resetKasiProfileToDefault,
} from '../data/kasiTupoksiData';
import { printOfficialDocument } from '../utils/printHelper';

interface KasiProfileManagerProps {
  onClose?: () => void;
  onRefresh?: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  embedded?: boolean;
}

export const KasiProfileManagerModal: React.FC<KasiProfileManagerProps> = ({
  onClose,
  onRefresh,
  showToast,
  embedded = false,
}) => {
  const [profiles, setProfiles] = useState<KepalaSeksiProfile[]>(() => getAllKasiProfiles());
  const [activeRole, setActiveRole] = useState<KepalaSeksiRole>('kasi_pemerintahan');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string>('');
  const [saveError, setSaveError] = useState<string>('');

  // Form State for editing
  const activeProfile = profiles.find((p) => p.role === activeRole) || profiles[0];
  const [editNamaPejabat, setEditNamaPejabat] = useState<string>(activeProfile.namaPejabat);
  const [editNip, setEditNip] = useState<string>(activeProfile.nip || '');
  const [editTelepon, setEditTelepon] = useState<string>(activeProfile.telepon || '');
  const [editUsernameUtama, setEditUsernameUtama] = useState<string>(activeProfile.usernameUtama);
  const [editPasswordDefault, setEditPasswordDefault] = useState<string>(activeProfile.passwordDefault);
  const [editTupoksiRingkas, setEditTupoksiRingkas] = useState<string>(activeProfile.tupoksiRingkas);

  const handleSelectRole = (role: KepalaSeksiRole) => {
    setActiveRole(role);
    setIsEditing(false);
    setSaveSuccess('');
    setSaveError('');
    const p = profiles.find((item) => item.role === role);
    if (p) {
      setEditNamaPejabat(p.namaPejabat);
      setEditNip(p.nip || '');
      setEditTelepon(p.telepon || '');
      setEditUsernameUtama(p.usernameUtama);
      setEditPasswordDefault(p.passwordDefault);
      setEditTupoksiRingkas(p.tupoksiRingkas);
    }
  };

  const handleStartEdit = () => {
    setEditNamaPejabat(activeProfile.namaPejabat);
    setEditNip(activeProfile.nip || '');
    setEditTelepon(activeProfile.telepon || '');
    setEditUsernameUtama(activeProfile.usernameUtama);
    setEditPasswordDefault(activeProfile.passwordDefault);
    setEditTupoksiRingkas(activeProfile.tupoksiRingkas);
    setIsEditing(true);
    setSaveSuccess('');
    setSaveError('');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveSuccess('');
    setSaveError('');
  };

  const handleSaveEdit = async () => {
    if (!editNamaPejabat.trim()) {
      setSaveError('Nama Pejabat tidak boleh kosong!');
      return;
    }
    if (!editUsernameUtama.trim()) {
      setSaveError('Username login utama tidak boleh kosong!');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const cleanUsername = editUsernameUtama.trim().toLowerCase().replace(/[\s\-_.]+/g, '_');
      const updates: Partial<KepalaSeksiProfile> = {
        namaPejabat: editNamaPejabat.trim(),
        nip: editNip.trim() || undefined,
        telepon: editTelepon.trim() || undefined,
        usernameUtama: cleanUsername,
        passwordDefault: editPasswordDefault.trim() || activeProfile.passwordDefault,
        tupoksiRingkas: editTupoksiRingkas.trim() || activeProfile.tupoksiRingkas,
      };

      const ok = await saveKasiProfile(activeRole, updates);
      if (ok) {
        const updated = getAllKasiProfiles();
        setProfiles(updated);
        setIsEditing(false);
        setSaveSuccess(`Pengaturan untuk ${activeProfile.namaSeksi} berhasil disimpan!`);
        if (showToast) {
          showToast(`Pengaturan profil & tupoksi ${activeProfile.singkatan} berhasil diperbarui!`, 'success');
        }
        if (onRefresh) onRefresh();
      } else {
        setSaveError('Gagal menyimpan profil ke database.');
      }
    } catch (e: any) {
      setSaveError(e?.message || 'Terjadi kesalahan saat menyimpan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefault = async () => {
    if (window.confirm(`Kembalikan pengaturan ${activeProfile.namaSeksi} ke standar bawaan kelurahan?`)) {
      setIsSaving(true);
      await resetKasiProfileToDefault(activeRole);
      const updated = getAllKasiProfiles();
      setProfiles(updated);
      setIsEditing(false);
      setIsSaving(false);
      setSaveSuccess(`Pengaturan ${activeProfile.namaSeksi} telah di-reset ke bawaan.`);
      if (showToast) {
        showToast(`Profil ${activeProfile.namaSeksi} telah di-reset ke standar resmi.`, 'info');
      }
      if (onRefresh) onRefresh();
    }
  };

  const handleCopyCredentials = (profile: KepalaSeksiProfile) => {
    const text = `KREDENSIAL LOGIN KELURAHAN MANGGA:\nJabatan: ${profile.namaSeksi}\nPejabat: ${profile.namaPejabat}\nUsername: ${profile.usernameUtama}\nPassword Default: ${profile.passwordDefault}\nBidang: ${profile.singkatan}`;
    navigator.clipboard.writeText(text);
    setCopiedId(profile.id);
    setTimeout(() => setCopiedId(null), 2500);
    if (showToast) {
      showToast(`Kredensial login ${profile.singkatan} disalin ke clipboard!`, 'success');
    }
  };

  const handlePrintTupoksi = () => {
    printOfficialDocument(
      'lembar-cetak-tupoksi-kasi',
      `TUPOKSI_${activeProfile.role.toUpperCase()}_KELURAHAN_MANGGA`
    );
  };

  const getRoleTheme = (role: KepalaSeksiRole) => {
    switch (role) {
      case 'kasi_pemerintahan':
        return {
          tabActive: 'bg-teal-700 text-white border-teal-800 shadow-md',
          tabInactive: 'bg-teal-50 text-teal-900 hover:bg-teal-100 border-teal-200',
          badge: 'bg-teal-100 text-teal-900 border-teal-300',
          border: 'border-teal-200',
          bgHeader: 'from-teal-800 via-emerald-900 to-teal-950',
          textAccent: 'text-teal-700',
          icon: <Landmark className="w-5 h-5" />,
        };
      case 'kasi_pembangunan':
        return {
          tabActive: 'bg-blue-700 text-white border-blue-800 shadow-md',
          tabInactive: 'bg-blue-50 text-blue-900 hover:bg-blue-100 border-blue-200',
          badge: 'bg-blue-100 text-blue-900 border-blue-300',
          border: 'border-blue-200',
          bgHeader: 'from-blue-800 via-indigo-900 to-blue-950',
          textAccent: 'text-blue-700',
          icon: <HeartHandshake className="w-5 h-5" />,
        };
      case 'kasi_trantibum':
      default:
        return {
          tabActive: 'bg-amber-700 text-white border-amber-800 shadow-md',
          tabInactive: 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-200',
          badge: 'bg-amber-100 text-amber-900 border-amber-300',
          border: 'border-amber-200',
          bgHeader: 'from-amber-800 via-orange-900 to-amber-950',
          textAccent: 'text-amber-700',
          icon: <ShieldAlert className="w-5 h-5" />,
        };
    }
  };

  const currentTheme = getRoleTheme(activeRole);

  const content = (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200">
              Struktur Pemerintahan Kelurahan Mangga
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
              3 Kepala Seksi (Kasi) Definitif
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Pengaturan Username & Bidang Tugas Kepala Seksi
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Atur kredensial login (username/kata sandi), profil pejabat penanggung jawab, serta rincian tugas pokok & fungsi (Tupoksi) per seksi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrintTupoksi}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            title="Cetak format cetak resmi Tupoksi Seksi ini"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>Cetak Tupoksi Seksi</span>
          </button>
          {onClose && !embedded && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs Pilihan Kepala Seksi */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {profiles.map((p) => {
          const theme = getRoleTheme(p.role);
          const isSelected = p.role === activeRole;
          return (
            <button
              key={p.role}
              type="button"
              onClick={() => handleSelectRole(p.role)}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                isSelected ? theme.tabActive : theme.tabInactive
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-700 shadow-xs'
                    }`}
                  >
                    {theme.icon}
                  </div>
                  <div>
                    <h4 className="text-xs font-black tracking-tight leading-snug">{p.namaSeksi}</h4>
                    <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                      {p.singkatan}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-current/15 flex items-center justify-between text-[11px]">
                <span className="font-mono font-bold flex items-center gap-1">
                  <UserCheck className="w-3 h-3 opacity-70" />
                  <span>{p.usernameUtama}</span>
                </span>
                <span className="text-[10px] opacity-80">{p.bidangTugas.length} Sub-Bidang</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Feedback Messages */}
      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}
      {saveError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Main Detail & Edit Container (also printable) */}
      <div id="lembar-cetak-tupoksi-kasi" className="space-y-6">
        {/* Banner Profil Kepala Seksi Terpilih */}
        <div
          className={`bg-gradient-to-r ${currentTheme.bgHeader} rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden`}
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-white text-xs font-bold">
                {currentTheme.icon}
                <span>{activeProfile.namaSeksi} • Kelurahan Mangga, Medan Tuntungan</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight">{activeProfile.namaPejabat}</h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/90">
                {activeProfile.nip && <span>NIP: {activeProfile.nip}</span>}
                {activeProfile.telepon && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{activeProfile.telepon}</span>
                  </span>
                )}
                <span className="font-mono bg-white/20 px-2 py-0.5 rounded text-[11px] font-bold">
                  Username: {activeProfile.usernameUtama}
                </span>
                <span className="font-mono bg-white/20 px-2 py-0.5 rounded text-[11px]">
                  Pass: {activeProfile.passwordDefault}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {!isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-black text-xs hover:bg-slate-50 shadow-md transition-all cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4 text-indigo-600" />
                    <span>Ubah Profil & Kredensial</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyCredentials(activeProfile)}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/25 transition-all cursor-pointer"
                    title="Salin username dan password untuk dikirim ke Kepala Seksi"
                  >
                    {copiedId === activeProfile.id ? (
                      <Check className="w-4 h-4 text-emerald-300" />
                    ) : (
                      <Copy className="w-4 h-4 text-white" />
                    )}
                    <span>{copiedId === activeProfile.id ? 'Tersalin!' : 'Salin Kredensial'}</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveEdit}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition-all cursor-pointer"
                  >
                    <span>Batal</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Edit Form Modal/Drawer if in Editing Mode */}
        {isEditing && (
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-indigo-200">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-slate-900 text-sm">
                  Form Pengaturan Profil & Kredensial {activeProfile.namaSeksi}
                </h4>
              </div>
              <button
                type="button"
                onClick={handleResetDefault}
                className="text-[11px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset ke Bawaan</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {/* Nama Pejabat */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Pejabat Kepala Seksi</label>
                <input
                  type="text"
                  value={editNamaPejabat}
                  onChange={(e) => setEditNamaPejabat(e.target.value)}
                  placeholder="Contoh: Drs. H. Syarifuddin Siregar, M.Si"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* NIP */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">NIP Pejabat ASN (Opsional)</label>
                <input
                  type="text"
                  value={editNip}
                  onChange={(e) => setEditNip(e.target.value)}
                  placeholder="Contoh: 19780512 200801 1 005"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Nomor WhatsApp */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor WhatsApp / HP</label>
                <input
                  type="text"
                  value={editTelepon}
                  onChange={(e) => setEditTelepon(e.target.value)}
                  placeholder="Contoh: 0812-3456-7890"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Username Login Utama */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Username Login Utama <span className="text-indigo-600 font-mono">(Huruf Kecil)</span>
                </label>
                <input
                  type="text"
                  value={editUsernameUtama}
                  onChange={(e) => setEditUsernameUtama(e.target.value.toLowerCase().trim())}
                  placeholder="Contoh: kasi_pemerintahan"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Alias yang juga aktif: {activeProfile.usernameAliases.slice(0, 4).join(', ')}, dll.
                </p>
              </div>

              {/* Password Default */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Kata Sandi Bawaan / Login</label>
                <input
                  type="text"
                  value={editPasswordDefault}
                  onChange={(e) => setEditPasswordDefault(e.target.value)}
                  placeholder="Contoh: pem_mangga2026"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Tupoksi Ringkas */}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">Ringkasan Tupoksi Resmi</label>
                <textarea
                  rows={3}
                  value={editTupoksiRingkas}
                  onChange={(e) => setEditTupoksiRingkas(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Informasi Kredensial & Alias Login Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-600" />
            <h4 className="font-bold text-slate-800 text-sm">Informasi Kredensial & Jalur Masuk Akun Resmi</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-black block mb-0.5">Username Utama</span>
              <span className="font-mono font-bold text-slate-900 text-sm bg-emerald-50 text-emerald-950 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                {activeProfile.usernameUtama}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-black block mb-0.5">Kata Sandi Bawaan</span>
              <span className="font-mono font-bold text-slate-800 text-sm bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block">
                {activeProfile.passwordDefault}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 sm:col-span-2">
              <span className="text-[10px] text-slate-500 uppercase font-black block mb-0.5">
                Alias Alternatif yang Otomatis Dikenali Sistem
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {activeProfile.usernameAliases.map((al) => (
                  <span
                    key={al}
                    className="font-mono text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded font-medium"
                  >
                    {al}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Ringkasan Tugas Pokok & Fungsi (Tupoksi) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <h4 className="font-bold text-slate-800 text-sm">Tugas Pokok dan Fungsi (Tupoksi) Seksi</h4>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-100">
            {activeProfile.tupoksiRingkas}
          </p>
        </div>

        {/* Rincian Bidang Tugas & Tanggung Jawab */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-slate-600" />
              <span>Rincian Ruang Lingkup & Bidang Tugas ({activeProfile.bidangTugas.length} Bidang Kerja)</span>
            </h4>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeProfile.bidangTugas.map((tugas, idx) => (
              <div
                key={idx}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all space-y-2.5"
              >
                <h5 className="text-xs font-black text-slate-900 text-balance flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <span>{tugas.judul}</span>
                </h5>
                <p className="text-[11px] text-slate-600 leading-relaxed pl-7">{tugas.deskripsi}</p>
                {tugas.poinPenting && tugas.poinPenting.length > 0 && (
                  <div className="pl-7 pt-1 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Ruang Lingkup Pekerjaan:
                    </span>
                    <ul className="space-y-1 text-[11px] text-slate-700">
                      {tugas.poinPenting.map((pt, pIdx) => (
                        <li key={pIdx} className="flex items-start gap-1.5">
                          <span className="text-emerald-600 font-bold shrink-0">•</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Indikator Kinerja Kunci (KPI) & Fitur Aplikasi Terkait */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Indikator KPI */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-rose-600" />
              <h4 className="font-bold text-slate-800 text-sm">Sasaran & Indikator Kinerja Kunci (KPI)</h4>
            </div>
            <div className="space-y-2">
              {activeProfile.indikatorKinerja.map((kpi, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <span className="font-medium text-slate-800">{kpi.label}</span>
                  <div className="text-right">
                    <span className="font-black text-indigo-700">{kpi.target}</span>
                    <span className="text-[10px] text-slate-500 block">{kpi.satuan}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fitur Aplikasi Kerja Terkait */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <h4 className="font-bold text-slate-800 text-sm">Menu & Fitur Kerja Aplikasi yang Dikelola</h4>
            </div>
            <div className="space-y-2">
              {activeProfile.fiturAplikasi.map((ft, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs space-y-0.5">
                  <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{ft.namaFitur}</span>
                  </div>
                  <p className="text-[11px] text-emerald-800/90 pl-5">{ft.kegunaan}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8">
        {content}
      </div>
    </div>
  );
};
