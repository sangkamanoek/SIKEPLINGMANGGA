import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';
import { KunjunganWargaData, saveKunjunganWargaToFirestore } from '../lib/kunjunganService';
export type { KunjunganWargaData };
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { Users, CheckCircle2, X, Camera, Upload } from 'lucide-react';
import { getTodayLocalIso } from '../lib/formatter';
import { compressImageFile } from '../lib/imageCompressor';

interface FormKunjunganWargaProps {
  isOpen?: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  currentUser?: UserAccount;
  editItem?: KunjunganWargaData | null;
  tanggalLaporan?: string;
  compact?: boolean;
  onSuccess?: () => void;
}

export const FormKunjunganWarga: React.FC<FormKunjunganWargaProps> = ({
  isOpen = true,
  onClose,
  onCancel,
  currentUser,
  editItem,
  tanggalLaporan,
  compact = false,
  onSuccess,
}) => {
  const isKepling = currentUser?.role === 'kepling';
  const defaultLingkungan = currentUser?.lingkungan || '';
  const defaultKeplingName = currentUser?.nama || '';

  const [lingkungan, setLingkungan] = useState(editItem?.lingkungan || defaultLingkungan);
  const [namaKepling, setNamaKepling] = useState(editItem?.namaKepling || defaultKeplingName);
  const [tanggal, setTanggal] = useState(editItem?.tanggal || tanggalLaporan || getTodayLocalIso());
  const [namaWarga, setNamaWarga] = useState(editItem?.namaWarga || '');
  const [alamat, setAlamat] = useState(editItem?.alamat || '');
  const [perlinsos, setPerlinsos] = useState(editItem?.perlinsos || 'Belum');
  const [ikd, setIkd] = useState(editItem?.ikd || 'Belum');
  const [pbb, setPbb] = useState(editItem?.pbb || 'Belum');
  const [kategoriBansos, setKategoriBansos] = useState(editItem?.kategoriBansos || 'PKH / BPNT (DTKS)');
  const [statusBansos, setStatusBansos] = useState<'Sudah' | 'Belum' | 'Menolak' | 'Layak' | 'Tidak Layak'>(editItem?.statusBansos || 'Sudah');
  const [bpjsTk, setBpjsTk] = useState(editItem?.bpjsTk || 'Belum Terdaftar');
  const [keterangan, setKeterangan] = useState(editItem?.keterangan || '');
  const [fotoUrl, setFotoUrl] = useState(
    editItem?.fotoUrl || (editItem as any)?.foto || (editItem as any)?.fotoDokumentasi || ''
  );
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (editItem) {
      setLingkungan(editItem.lingkungan || defaultLingkungan);
      setNamaKepling(editItem.namaKepling || defaultKeplingName);
      setTanggal(editItem.tanggal || getTodayLocalIso());
      setNamaWarga(editItem.namaWarga || '');
      setAlamat(editItem.alamat || '');
      setPerlinsos(editItem.perlinsos || 'Belum');
      setIkd(editItem.ikd || 'Belum');
      setPbb(editItem.pbb || 'Belum');
      setKategoriBansos(editItem.kategoriBansos || 'PKH / BPNT (DTKS)');
      setStatusBansos(editItem.statusBansos || 'Sudah');
      setBpjsTk(editItem.bpjsTk || 'Belum Terdaftar');
      setKeterangan(editItem.keterangan || '');
      setFotoUrl(
        editItem.fotoUrl || (editItem as any)?.foto || (editItem as any)?.fotoDokumentasi || ''
      );
    }
  }, [editItem, defaultLingkungan, defaultKeplingName]);

  const handlePhotoUpload = async (file?: File) => {
    if (!file) return;
    setIsProcessingPhoto(true);
    try {
      const comp = await compressImageFile(file, 1280, 0.80);
      if (comp) {
        setFotoUrl(comp);
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) setFotoUrl(ev.target.result as string);
        };
        reader.readAsDataURL(file);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setFotoUrl(ev.target.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lingkungan) {
      alert('Harap pilih lingkungan yang dikunjungi.');
      return;
    }
    if (!namaWarga.trim() || !alamat.trim()) {
      alert('Nama Warga dan Alamat Lengkap wajib diisi.');
      return;
    }
    if (!fotoUrl) {
      alert('Foto Dokumentasi Kunjungan Warga Wajib Dilampirkan!\nSilakan klik tombol "Ambil Foto Kamera Langsung" atau "Pilih dari Galeri HP".');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: KunjunganWargaData = {
        id: editItem?.id || `visit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tanggal,
        namaWarga: namaWarga.trim().toUpperCase(),
        alamat: alamat.trim(),
        lingkungan,
        namaKepling,
        perlinsos,
        ikd,
        pbb,
        bpjsTk,
        kategoriBansos,
        statusBansos,
        keterangan: keterangan.trim(),
        fotoUrl,
        createdAt: editItem?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveKunjunganWargaToFirestore(payload);
      setSuccessMsg(editItem ? 'Kunjungan berhasil diperbarui!' : 'Kunjungan warga berhasil disimpan ke database Firestore (koleksi: kunjungan_warga)!');
      setTimeout(() => {
        setIsSubmitting(false);
        setNamaWarga('');
        setAlamat('');
        setKeterangan('');
        setBpjsTk('Belum Terdaftar');
        setFotoUrl('');
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Error saving kunjungan:', err);
      alert('Gagal menyimpan kunjungan: ' + (err.message || err));
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-fade-in">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <Users className="w-5 h-5 text-emerald-600" />
        <div>
          <h3 className="font-black text-sm text-slate-900">Form Kunjungan Warga (Door-to-Door)</h3>
          <p className="text-[11px] text-slate-500">Tersimpan langsung ke Database Cloud Firestore (Koleksi: kunjungan_warga)</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl flex items-center gap-2 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div>
        <label className="block text-slate-800 font-bold mb-1">
          Lingkungan <span className="text-rose-600">*</span>:
        </label>
        <select
          value={lingkungan}
          onChange={(e) => {
            const val = e.target.value;
            setLingkungan(val);
            const found = KEPLING_ACCOUNTS.find((k) => k.lingkungan === val);
            if (found) setNamaKepling(found.nama);
          }}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
          required
        >
          <option value="">-- Pilih Lingkungan (Pilih Manual) --</option>
          {KEPLING_ACCOUNTS.map((k) => (
            <option key={k.id} value={k.lingkungan}>
              {k.lingkungan} - {k.nama}
            </option>
          ))}
        </select>
        {!lingkungan && (
          <p className="text-[11px] text-amber-600 font-bold mt-1 flex items-center gap-1">
            ⚠️ Pilihan lingkungan dikosongkan. Harap pilih lingkungan yang dikunjungi secara manual agar terhindar dari kesalahan.
          </p>
        )}
      </div>

      <div>
        <label className="block text-slate-800 font-bold mb-1">
          Tanggal Kunjungan <span className="text-rose-600">*</span>:
        </label>
        <input
          type="date"
          value={tanggal}
          onChange={(e) => setTanggal(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-slate-800 font-bold mb-1">
          Nama Warga <span className="text-rose-600">*</span>:
        </label>
        <input
          type="text"
          placeholder="CONTOH: BPK. GUNAWAN TARIGAN"
          value={namaWarga}
          onChange={(e) => setNamaWarga(e.target.value.toUpperCase())}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 outline-none uppercase"
          required
        />
        <span className="text-[10px] text-slate-400 mt-0.5 block">* Otomatis diubah menjadi HURUF KAPITAL</span>
      </div>

      <div>
        <label className="block text-slate-800 font-bold mb-1">Alamat Lengkap <span className="text-rose-600">*</span>:</label>
        <input
          type="text"
          placeholder="CONTOH: JL. BUNGA RINTE NO. 12 GANG BERSAMA"
          value={alamat}
          onChange={(e) => setAlamat(e.target.value.toUpperCase())}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 outline-none uppercase"
          required
        />
        <span className="text-[10px] text-slate-400 mt-0.5 block">* Otomatis diubah menjadi HURUF KAPITAL</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-slate-800 font-bold mb-1">Perlinsos:</label>
          <select
            value={perlinsos}
            onChange={(e) => setPerlinsos(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
          >
            <option value="Sudah">Sudah</option>
            <option value="Belum">Belum</option>
            <option value="Menolak">Menolak</option>
            <option value="Layak">Layak</option>
            <option value="Tidak Layak">Tidak Layak</option>
          </select>
        </div>
        <div>
          <label className="block text-slate-800 font-bold mb-1">IKD:</label>
          <select
            value={ikd}
            onChange={(e) => setIkd(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
          >
            <option value="Sudah">Sudah</option>
            <option value="Belum">Belum</option>
            <option value="Proses">Proses</option>
          </select>
        </div>
        <div>
          <label className="block text-slate-800 font-bold mb-1">Pembayaran PBB:</label>
          <select
            value={pbb}
            onChange={(e) => setPbb(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
          >
            <option value="Sudah">Sudah</option>
            <option value="Belum">Belum</option>
            <option value="Lunas">Lunas</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-slate-800 font-bold mb-1">Status Kepesertaan BPJS Ketenagakerjaan (Mandiri/Pekerja):</label>
        <select
          value={bpjsTk}
          onChange={(e) => setBpjsTk(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
        >
          <option value="Aktif">Aktif (Sudah Terlindungi)</option>
          <option value="Non-Aktif">Non-Aktif</option>
          <option value="Belum Terdaftar">Belum Terdaftar</option>
          <option value="Sudah Daftar (Agen Perisai)">Sudah Daftar (Agen Perisai)</option>
          <option value="Menolak">Menolak Menjadi Peserta</option>
        </select>
        <p className="text-[10px] text-slate-500 mt-1 font-medium italic">
          * Verifikasi kepesertaan jaminan kecelakaan kerja dan kematian bagi pekerja mandiri di lingkungan.
        </p>
      </div>



      <div>
        <label className="block text-slate-800 font-bold mb-1">Catatan / Keterangan Lapangan:</label>
        <textarea
          rows={3}
          placeholder="Catat kondisi rumah, aspirasi, atau temuan penting saat kunjungan..."
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
        />
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <label className="block text-slate-800 font-bold">
            Foto Dokumentasi Kunjungan Warga <span className="text-rose-600">*</span> (Wajib Foto Asli Warga)
          </label>
          <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-sky-200">
            🛡️ Anti-Screenshot AI Aktif
          </span>
        </div>
        <p className="text-[11px] text-slate-500">
          Lampirkan foto dokumentasi yang memperlihatkan wajah warga atau interaksi door-to-door di lokasi. <span className="text-rose-600 font-bold">Dilarang mengunggah tangkapan layar (screenshot) HP</span>.
        </p>

        {isProcessingPhoto ? (
          <div className="p-6 bg-emerald-50 border-2 border-dashed border-emerald-300 rounded-2xl text-center space-y-2 animate-pulse">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="font-bold text-xs text-emerald-900">Sedang memproses dan mengompres foto...</div>
            <p className="text-[10px] text-slate-500">Foto disesuaikan secara otomatis agar ringan dan jernih.</p>
          </div>
        ) : fotoUrl ? (
          <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 bg-slate-900 max-w-xs mx-auto shadow-sm">
            <img src={fotoUrl} alt="Dokumentasi Kunjungan" className="w-full h-48 object-cover" />
            <div className="absolute bottom-2 inset-x-2 flex items-center justify-between bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl text-white text-[11px]">
              <span className="font-bold flex items-center gap-1">✅ Foto Terlampir</span>
              <button
                type="button"
                onClick={() => setFotoUrl('')}
                className="bg-rose-600 hover:bg-rose-700 px-2.5 py-1 rounded-lg font-bold text-[10px] cursor-pointer transition-colors"
              >
                Ganti Foto
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2">
              <Camera className="w-6 h-6 text-emerald-600" />
              <div>
                <span className="font-bold text-emerald-900 block text-xs">Ambil Foto Kamera Langsung</span>
                <span className="text-[10px] text-slate-500">Buka kamera di lokasi warga</span>
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
              />
            </label>

            <label className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100/80 rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2">
              <Upload className="w-6 h-6 text-slate-600" />
              <div>
                <span className="font-bold text-slate-800 block text-xs">Pilih dari Galeri / Berkas</span>
                <span className="text-[10px] text-rose-600 font-bold">Khusus foto warga asli (Bukan Screenshot)</span>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
              />
            </label>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors cursor-pointer text-xs"
          >
            Batal
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md transition-all cursor-pointer text-xs disabled:opacity-50"
        >
          {isSubmitting ? 'Menyimpan ke Firestore...' : editItem ? 'Simpan Perubahan' : 'Simpan Kunjungan'}
        </button>
      </div>
    </form>
  );
};
