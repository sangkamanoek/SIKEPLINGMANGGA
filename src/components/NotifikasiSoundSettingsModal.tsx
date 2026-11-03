import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Smartphone,
  Bell,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  Radio,
  Play,
  ShieldCheck,
  Info,
} from 'lucide-react';
import {
  isSoundNotificationEnabled,
  setSoundNotificationEnabled,
  isVibrationEnabled,
  setVibrationEnabled,
  playAgendaKelurahanSound,
  playTugasKhususLurahSound,
  triggerDeviceVibration,
} from '../lib/soundVibrationService';
import { requestNotificationPermission } from '../lib/safeNotification';

interface NotifikasiSoundSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: any;
}

export const NotifikasiSoundSettingsModal: React.FC<NotifikasiSoundSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(isSoundNotificationEnabled);
  const [vibrateEnabled, setVibrateEnabled] = useState(isVibrationEnabled);
  const [notifPermission, setNotifPermission] = useState<string>('default');
  const [hasVibrationApi, setHasVibrationApi] = useState(false);
  const [testPlaying, setTestPlaying] = useState<'agenda' | 'tugas' | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('Notification' in window) {
        setNotifPermission(Notification.permission);
      }
      if ('navigator' in window && 'vibrate' in navigator) {
        setHasVibrationApi(true);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSoundNotificationEnabled(next);
  };

  const handleToggleVibrate = () => {
    const next = !vibrateEnabled;
    setVibrateEnabled(next);
    setVibrationEnabled(next);
  };

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setNotifPermission(res);
  };

  const handleTestAgenda = async () => {
    setTestPlaying('agenda');
    await playAgendaKelurahanSound();
    triggerDeviceVibration([250, 100, 250, 100, 450]);
    setTimeout(() => setTestPlaying(null), 1000);
  };

  const handleTestTugas = async () => {
    setTestPlaying('tugas');
    await playTugasKhususLurahSound();
    triggerDeviceVibration([350, 100, 350, 100, 350, 100, 700]);
    setTimeout(() => setTestPlaying(null), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Volume2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black leading-tight">
                Notifikasi Bunyi &amp; Getar HP
              </h3>
              <p className="text-xs text-teal-100 font-medium">
                Khusus Kepala Lingkungan &amp; Perangkat Kelurahan Mangga
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Target User Info */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-sm">
              {currentUser?.nomorLingkungan ? `L${currentUser.nomorLingkungan}` : 'KL'}
            </div>
            <div className="text-xs leading-tight">
              <p className="font-extrabold text-slate-900">{currentUser?.nama || 'Kepala Lingkungan'}</p>
              <p className="text-slate-700 font-medium">{currentUser?.jabatan || 'Kepala Lingkungan'}</p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Aktif
            </span>
          </div>

          {/* Test Sound & Vibration Action Cards */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Uji Coba Suara &amp; Getar di HP Anda</span>
            </h4>

            {/* Test 1: Agenda Kelurahan */}
            <div className="p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                    1. Agenda Kelurahan
                  </span>
                </div>
                <p className="text-xs text-slate-700">
                  Bunyi melodi 3-nada resmi + 2x getar HP ketika ada rapat/agenda baru.
                </p>
              </div>

              <button
                type="button"
                onClick={handleTestAgenda}
                disabled={testPlaying !== null}
                className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs inline-flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Play className={`w-3.5 h-3.5 ${testPlaying === 'agenda' ? 'animate-spin' : ''}`} />
                <span>{testPlaying === 'agenda' ? 'Membunyikan...' : 'Tes Bunyi & Getar'}</span>
              </button>
            </div>

            {/* Test 2: Tugas Khusus Lurah */}
            <div className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50/70 hover:bg-amber-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                  <span className="text-xs font-black text-amber-950 uppercase tracking-wide">
                    2. Tugas Khusus dari Lurah
                  </span>
                </div>
                <p className="text-xs text-slate-700">
                  Bunyi sirene komando resmi + 3x getar HP kuat untuk instruksi langsung.
                </p>
              </div>

              <button
                type="button"
                onClick={handleTestTugas}
                disabled={testPlaying !== null}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs inline-flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Play className={`w-3.5 h-3.5 ${testPlaying === 'tugas' ? 'animate-spin' : ''}`} />
                <span>{testPlaying === 'tugas' ? 'Membunyikan...' : 'Tes Bunyi & Getar'}</span>
              </button>
            </div>
          </div>

          {/* Toggle Switches */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Preferensi Pengingat
            </h4>

            {/* Sound Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  soundEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Bunyi Suara Notifikasi</p>
                  <p className="text-[11px] text-slate-700">Membunyikan speaker HP saat data baru tiba</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleSound}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  soundEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                    soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Vibration Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  vibrateEnabled ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Getar Handphone (Vibration)</p>
                  <p className="text-[11px] text-slate-700">
                    {hasVibrationApi ? 'Didukung oleh perangkat HP Anda' : 'Getar otomatis jika didukung browser HP'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleVibrate}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  vibrateEnabled ? 'bg-amber-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                    vibrateEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Browser Permission Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  notifPermission === 'granted' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Izin Pop-Up Notifikasi Browser / HP</p>
                  <p className="text-[11px] text-slate-700">
                    Status: <span className="font-bold">{notifPermission === 'granted' ? 'Diizinkan (Aktif)' : notifPermission === 'denied' ? 'Diblokir oleh Browser' : 'Belum Diizinkan'}</span>
                  </p>
                </div>
              </div>

              {notifPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-xs"
                >
                  Izinkan
                </button>
              )}
            </div>
          </div>

          {/* Practical Guide */}
          <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200 text-slate-700 text-xs space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-blue-900">
              <Info className="w-4 h-4 text-blue-700 shrink-0" />
              <span>Petunjuk untuk Kepala Lingkungan:</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px]">
              <li>Fitur bunyi menggunakan synthesizer bawaan yang bekerja 100% tanpa perlu mendownload file MP3 tambahan.</li>
              <li>Pastikan tombol volume media di HP Anda tidak dalam posisi bisu (silent/mute).</li>
              <li>Saat Anda membuka aplikasi SI-MANGGA di HP, cukup sentuh layar sekali agar audio siap berbunyi seketika ada info baru.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
          >
            Tutup Pengaturan
          </button>
        </div>
      </div>
    </div>
  );
};
