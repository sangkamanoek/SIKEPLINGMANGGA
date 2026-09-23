import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  CheckCircle2,
  Share2,
  X,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Info,
  ArrowRight,
  TabletSmartphone,
  Copy,
  Check,
  QrCode,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_SHARED_APP_URL = 'https://ais-pre-ylr7rcnshlcw5yeq7pcvq6-920053872736.asia-southeast1.run.app';

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [installSuccess, setInstallSuccess] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isCopiedWa, setIsCopiedWa] = useState(false);
  const [shareUrl, setShareUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.location.origin.includes('ais-pre') || window.location.origin.includes('run.app')) {
        return window.location.origin;
      }
    }
    return DEFAULT_SHARED_APP_URL;
  });

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const res = await install();
      if (res) {
        setInstallSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } else {
      alert("📥 Fitur Pemasangan 1-Klik Sedang Memanggil Google Chrome WebAPK Installer...\n\nJika jendela konfirmasi instalasi Google Chrome belum muncul di layar Anda, silakan ikuti petunjuk cepat berikut:\n1. Ketuk tombol menu titik tiga (⋮) di pojok kanan atas browser Google Chrome Anda.\n2. Pilih menu \"Instal Aplikasi\" atau \"Tambahkan ke Layar Utama\".\n\nAplikasi SiKeplingMangga akan langsung terpasang di HP Anda sebagai aplikasi mandiri dengan logo Pemko Medan yang resmi!");
    }
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`;
  const pwaBuilderUrl = `https://www.pwabuilder.com?url=${encodeURIComponent(shareUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCopyWaText = () => {
    const waText = `🟩 *APLIKASI SISTEM KINERJA KEPALA LINGKUNGAN KELURAHAN MANGGA - LAPORAN HARIAN KEPALA LINGKUNGAN*
Kelurahan Mangga - Kecamatan Medan Tuntungan

Kepada Yth. Bapak/Ibu Kepala Lingkungan I s/d XXIV:
Silakan buka dan pasang aplikasi resmi *SISTEM KINERJA KEPALA LINGKUNGAN KELURAHAN MANGGA* melalui tautan resmi berikut di browser HP Android/iPhone Anda:
👉 ${shareUrl}

*Petunjuk Pemasangan di HP (APK SISTEM KINERJA KEPALA LINGKUNGAN KELURAHAN MANGGA):*
1. Buka link di atas di browser Google Chrome pada HP Anda.
2. Masukkan Username resmi Anda (misal: kepling_1) dan kata sandi resmi.
3. Ketuk menu titik tiga (⋮) di pojok kanan atas browser, lalu pilih *"Tambahkan ke Layar Utama"* / *"Instal Aplikasi"*.
4. Ikon aplikasi SISTEM KINERJA KEPALA LINGKUNGAN KELURAHAN MANGGA (Logo Pemko Medan) akan otomatis terpasang di layar utama HP layaknya aplikasi APK.
5. Gunakan fitur *Dashboard Capaian* untuk memantau akumulasi PBB, Perlinsos, IKD, dan BPJS TK Anda.

#SIKEPLINGMANGGA #MedanUntukSemua #SemuaUntukMedan`;

    navigator.clipboard.writeText(waText);
    setIsCopiedWa(true);
    setTimeout(() => setIsCopiedWa(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-xs">
              <img
                src="/logo_pemko_medan.png"
                alt="Logo Pemko Medan"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Pasang APK SISTEM KINERJA KEPALA LINGKUNGAN KELURAHAN MANGGA</span>
                <span className="text-[10px] bg-emerald-700 text-emerald-100 px-2 py-0.5 rounded-full font-medium">
                  Resmi Android & iOS
                </span>
              </h3>
              <p className="text-xs text-emerald-100">
                Aplikasi Kinerja Harian Kepling & Super Admin Kelurahan Mangga
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Main Install Action Banner */}
          {isInstalled ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-emerald-900">
                  Aplikasi Sudah Terpasang di HP Ini!
                </h4>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Anda sedang menjalankan aplikasi dalam mode mandiri (Standalone App). Ikon aplikasi sudah ada di layar utama HP Anda.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-white border border-emerald-200 p-1 flex items-center justify-center shrink-0 shadow-sm">
                  <img
                    src="/logo_pemko_medan.png"
                    alt="Logo Pemko Medan"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Pasang ke Layar Utama HP</span>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Aplikasi akan terpasang di HP dengan logo Pemko Medan, layar penuh (tanpa bar URL browser), cepat, dan bisa diakses langsung kapan saja.
                  </p>
                </div>
              </div>

              <button
                id="btn-trigger-pwa-install"
                type="button"
                onClick={handleInstallClick}
                className="mt-3.5 w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{installSuccess ? 'Aplikasi Sedang Dipasang...' : 'Pasang Aplikasi Sekarang (1-Klik)'}</span>
              </button>
            </div>
          )}

          {/* Android Step-by-Step Instructions */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2 mb-2">
              <TabletSmartphone className="w-4 h-4 text-emerald-600" />
              <span>Cara Pasang di HP Android (Chrome):</span>
            </h4>
            <ol className="space-y-2 text-xs text-slate-600 list-decimal pl-4 leading-relaxed">
              <li>
                Buka tautan aplikasi ini di browser <strong>Google Chrome</strong> di HP Anda.
              </li>
              <li>
                Ketuk tombol <strong>menu titik tiga (⋮)</strong> di pojok kanan atas browser.
              </li>
              <li>
                Pilih menu <strong>"Tambahkan ke Layar Utama" (Add to Home screen)</strong> atau <strong>"Instal Aplikasi"</strong>.
              </li>
              <li>
                Ketuk <strong>Instal</strong>. Aplikasi akan muncul di menu aplikasi & layar utama seperti APK biasa!
              </li>
            </ol>
          </div>

          {/* iOS Safari Instructions */}
          {isIOS && (
            <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/60">
              <h4 className="text-xs font-bold text-amber-900 flex items-center gap-2 mb-2">
                <Share2 className="w-4 h-4 text-amber-700" />
                <span>Cara Pasang di iPhone / iPad (Safari):</span>
              </h4>
              <ol className="space-y-1.5 text-xs text-amber-800 list-decimal pl-4 leading-relaxed">
                <li>Buka di browser <strong>Safari</strong>.</li>
                <li>Ketuk ikon <strong>Bagikan (Share)</strong> di bagian bawah layar (kotak dengan panah ke atas).</li>
                <li>Gulir ke bawah lalu pilih <strong>"Tambahkan ke Layar Utama" (Add to Home Screen)</strong>.</li>
                <li>Ketuk <strong>Tambah</strong> di pojok kanan atas.</li>
              </ol>
            </div>
          )}

          {/* Standalone APK Generation via PWABuilder */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Link & Unduh Berkas .APK untuk Android
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Aplikasi ini sudah berstandar PWA resmi dengan skor penuh. Anda dapat langsung membuka link aplikasi di Google Chrome HP atau membuat berkas paket <strong>.apk</strong> (Trusted Web Activity) secara instan melalui <strong>PWABuilder</strong>:
                </p>
              </div>
            </div>

            {/* URL Display, Edit & Copy Button */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="text"
                  value={shareUrl}
                  onChange={(e) => setShareUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 bg-transparent text-[11px] font-mono text-slate-800 focus:outline-none px-1"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Link</span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyWaText}
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                {isCopiedWa ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>Format WhatsApp 24 Kepling Berhasil Disalin!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-emerald-200" />
                    <span>Salin Format Undangan WhatsApp untuk 24 Kepling</span>
                  </>
                )}
              </button>
            </div>

            {/* QR Code Scan Section */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="w-28 h-28 bg-white p-2 rounded-lg border border-slate-200 shrink-0 shadow-xs flex items-center justify-center">
                <img
                  src={qrCodeUrl}
                  alt="QR Code Aplikasi Android"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-1.5">
                  <QrCode className="w-4 h-4 text-emerald-700" />
                  <span>Scan QR Code dari HP Android</span>
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Buka kamera HP atau Google Lens Anda lalu arahkan ke QR Code di samping untuk langsung membuka aplikasi di Android.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <a
                href={pwaBuilderUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer text-center"
              >
                <Download className="w-4 h-4" />
                <span>Buat File .APK di PWABuilder</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>

              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all border border-slate-200 cursor-pointer text-center"
              >
                <Smartphone className="w-4 h-4 text-emerald-700" />
                <span>Buka di Tab Baru</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
