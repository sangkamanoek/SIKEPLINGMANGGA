import React, { useState, useRef, useCallback } from 'react';
import {
  Users,
  Camera,
  Upload,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { UserAccount } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { sanitizeText, safeSetLocalStorage, safeGetLocalStorage } from '../lib/safeStorage';

export type KeteranganKunjunganType = 'Sudah' | 'Belum';

export interface KunjunganWargaData {
  id: string;
  tanggal: string;
  namaWarga: string;
  alamat: string;
  lingkungan: string;
  lingkunganNomor: number;
  namaKepling: string;
  keplingId: string;
  perlinsos: 'Sudah' | 'Belum';
  ikd: 'Sudah' | 'Belum';
  pbb: 'Sudah' | 'Belum';
  keterangan?: string;
  fotoDokumentasi?: string;
  createdAt: string;
}

interface FormKunjunganWargaProps {
  currentUser: UserAccount;
  tanggalLaporan?: string;
  onSuccess?: (savedData: KunjunganWargaData) => void;
  onCancel?: () => void;
  compact?: boolean;
}

const STORAGE_CACHE_KEY = 'sikepling_kunjungan_harian_list_v1';
const MAX_IMAGE_DIMENSION = 720;
const IMAGE_JPEG_QUALITY = 0.45;

export const FormKunjunganWarga: React.FC<FormKunjunganWargaProps> = ({
  currentUser,
  tanggalLaporan,
  onSuccess,
  onCancel,
  compact = false,
}) => {
  const isSuperAdmin = currentUser.role === 'super_admin';
  const defaultDate = tanggalLaporan || new Date().toISOString().split('T')[0];

  // State Management
  const [tanggal, setTanggal] = useState<string>(defaultDate);
  const [namaWarga, setNamaWarga] = useState<string>('');
  const [alamat, setAlamat] = useState<string>('');
  const [targetKeplingId, setTargetKeplingId] = useState<string>(
    isSuperAdmin ? 'kepling_1' : currentUser.id
  );
  const [perlinsos, setPerlinsos] = useState<'Sudah' | 'Belum'>('Belum');
  const [ikd, setIkd] = useState<'Sudah' | 'Belum'>('Belum');
  const [pbb, setPbb] = useState<'Sudah' | 'Belum'>('Belum');
  const [fotoDokumentasi, setFotoDokumentasi] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const fileInputCameraRef = useRef<HTMLInputElement>(null);
  const fileInputGalleryRef = useRef<HTMLInputElement>(null);

  // Derive Kepling Metadata
  const selectedKepling = isSuperAdmin
    ? KEPLING_ACCOUNTS.find((k) => k.id === targetKeplingId) || currentUser
    : currentUser;

  // Optimized image compression
  const handleCapturePhoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setFotoDokumentasi(canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Reset input so re-selecting same file fires onChange
    e.target.value = '';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanNama = sanitizeText(namaWarga);
    const cleanAlamat = sanitizeText(alamat);
    const cleanTanggal = sanitizeText(tanggal);

    if (!cleanNama) {
      setErrorMessage('Nama warga wajib diisi dengan benar.');
      return;
    }
    if (!cleanAlamat) {
      setErrorMessage('Alamat warga wajib diisi dengan benar.');
      return;
    }

    setIsSaving(true);
    const id = `kunjungan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const data: KunjunganWargaData = {
      id,
      tanggal: cleanTanggal || defaultDate,
      namaWarga: cleanNama,
      alamat: cleanAlamat,
      lingkungan: selectedKepling.lingkungan,
      lingkunganNomor: selectedKepling.nomorLingkungan || 1,
      namaKepling: selectedKepling.nama,
      keplingId: selectedKepling.id,
      perlinsos,
      ikd,
      pbb,
      fotoDokumentasi: fotoDokumentasi || '',
      createdAt: nowIso,
    };

    const firestorePayload: Record<string, any> = {
      id,
      tanggal: cleanTanggal || defaultDate,
      namaWarga: cleanNama,
      alamat: cleanAlamat,
      lingkungan: selectedKepling.lingkungan,
      lingkunganNomor: selectedKepling.nomorLingkungan || 1,
      namaKepling: selectedKepling.nama,
      keplingId: selectedKepling.id,
      perlinsos,
      ikd,
      pbb,
      createdAt: nowIso,
    };

    if (fotoDokumentasi) {
      firestorePayload.fotoDokumentasi = fotoDokumentasi;
    }

    try {
      // 1. Cloud Firestore Persistence
      if (db) {
        const docRef = doc(db, 'kunjungan_warga', id);
        await setDoc(docRef, firestorePayload);
      }

      // 2. Server API Buffer Persistence
      fetch('/api/kunjungan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: firestorePayload }),
      }).catch((err) => {
        console.warn('Notice saving kunjungan to /api/kunjungan:', err);
      });

      setSuccessMessage('Data kunjungan warga berhasil disimpan secara online!');

      // Reset form fields
      setNamaWarga('');
      setAlamat('');
      setPerlinsos('Belum');
      setIkd('Belum');
      setPbb('Belum');
      setFotoDokumentasi('');

      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err: any) {
      console.error('Error saving to Firestore:', err);
      setErrorMessage(`Gagal menyimpan ke Firestore: ${err?.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${compact ? 'p-4' : 'p-6'}`}>
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-sm sm:text-base">
              Form Kunjungan Warga (Door-to-Door)
            </h3>
            <p className="text-xs text-slate-500">
              Tersimpan langsung ke Database Cloud Firestore (Koleksi: <code>kunjungan_warga</code>)
            </p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Lingkungan (Pilihan untuk Super Admin / Tetap untuk Kepling) */}
        <div>
          <label className="font-extrabold text-slate-700 block mb-1">
            Lingkungan:
          </label>
          {isSuperAdmin ? (
            <select
              value={targetKeplingId}
              onChange={(e) => setTargetKeplingId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 focus:outline-emerald-500"
            >
              {KEPLING_ACCOUNTS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.lingkungan} - {k.nama}
                </option>
              ))}
            </select>
          ) : (
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-800 flex items-center justify-between">
              <span>{selectedKepling.lingkungan}</span>
              <span className="text-slate-500 font-medium">Petugas: {selectedKepling.nama}</span>
            </div>
          )}
        </div>

        {/* Tanggal Kunjungan */}
        <div>
          <label className="font-extrabold text-slate-700 block mb-1">
            Tanggal Kunjungan <span className="text-rose-500">*</span>:
          </label>
          <input
            type="date"
            required
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 focus:outline-emerald-500"
          />
        </div>

        {/* Nama Warga */}
        <div>
          <label className="font-extrabold text-slate-700 block mb-1">
            Nama Warga (Kepala Keluarga / Warga) <span className="text-rose-500">*</span>:
          </label>
          <input
            type="text"
            required
            maxLength={120}
            placeholder="Contoh: Bpk. Gunawan Tarigan"
            value={namaWarga}
            onChange={(e) => setNamaWarga(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800 focus:outline-emerald-500"
          />
        </div>

        {/* Alamat */}
        <div>
          <label className="font-extrabold text-slate-700 block mb-1">
            Alamat Lengkap <span className="text-rose-500">*</span>:
          </label>
          <input
            type="text"
            required
            maxLength={250}
            placeholder="Contoh: Jl. Bunga Rinte No. 12 Gang Bersama"
            value={alamat}
            onChange={(e) => setAlamat(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800 focus:outline-emerald-500"
          />
        </div>

        {/* Dropdown Keterangan Baru */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Perlinsos:</label>
            <select
              value={perlinsos}
              onChange={(e) => setPerlinsos(e.target.value as 'Sudah' | 'Belum')}
              className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 focus:outline-emerald-500"
            >
              <option value="Sudah">Sudah</option>
              <option value="Belum">Belum</option>
            </select>
          </div>
          <div>
            <label className="font-extrabold text-slate-700 block mb-1">IKD:</label>
            <select
              value={ikd}
              onChange={(e) => setIkd(e.target.value as 'Sudah' | 'Belum')}
              className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 focus:outline-emerald-500"
            >
              <option value="Sudah">Sudah</option>
              <option value="Belum">Belum</option>
            </select>
          </div>
          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Pembayaran PBB:</label>
            <select
              value={pbb}
              onChange={(e) => setPbb(e.target.value as 'Sudah' | 'Belum')}
              className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 focus:outline-emerald-500"
            >
              <option value="Sudah">Sudah</option>
              <option value="Belum">Belum</option>
            </select>
          </div>
        </div>

        {/* Unggah Dokumentasi */}
        <div>
          <label className="font-extrabold text-slate-700 block mb-1">
            Unggah Dokumentasi (Kamera / Foto):
          </label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputCameraRef}
            onChange={handleCapturePhoto}
            className="hidden"
          />
          <input
            type="file"
            accept="image/*"
            ref={fileInputGalleryRef}
            onChange={handleCapturePhoto}
            className="hidden"
          />

          {fotoDokumentasi ? (
            <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-300 shadow-inner">
              <img
                src={fotoDokumentasi}
                alt="Dokumentasi Kunjungan"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => setFotoDokumentasi('')}
                className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 shadow-md cursor-pointer"
                title="Hapus foto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => fileInputCameraRef.current?.click()}
                className="py-4 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20"
              >
                <Camera className="w-6 h-6 text-emerald-600 animate-pulse" />
                <span className="font-bold text-xs text-slate-800">
                  📸 Ambil Foto Kamera
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Buka kamera HP secara langsung
                </span>
              </button>

              <button
                type="button"
                onClick={() => fileInputGalleryRef.current?.click()}
                className="py-4 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-blue-700 transition-colors cursor-pointer bg-slate-50/50 hover:bg-blue-50/20"
              >
                <Upload className="w-6 h-6 text-blue-600" />
                <span className="font-bold text-xs text-slate-800">
                  📁 Pilih dari Galeri HP
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Pilih gambar yang sudah ada di galeri
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Batal
            </button>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan ke Firestore...' : 'Simpan Kunjungan Warga'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
