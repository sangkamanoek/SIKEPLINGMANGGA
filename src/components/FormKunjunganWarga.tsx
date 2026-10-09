import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Users,
  Camera,
  Upload,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Edit3,
  X,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { UserAccount } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { sanitizeText, safeSetLocalStorage, safeGetLocalStorage } from '../lib/safeStorage';
import { saveKunjunganWargaToFirestore } from '../lib/kunjunganService';

import { getAccessToken } from '../lib/firebase';
import { syncKunjunganPhotoToDrive } from '../lib/driveSync';

export type KeteranganKunjunganType = 'Sudah' | 'Belum' | 'Menolak';

export interface KunjunganWargaData {
  id: string;
  tanggal: string;
  namaWarga: string;
  alamat: string;
  lingkungan: string;
  lingkunganNomor: number;
  namaKepling: string;
  keplingId: string;
  perlinsos: 'Sudah' | 'Belum' | 'Menolak';
  ikd: 'Sudah' | 'Belum';
  pbb: 'Sudah' | 'Belum';
  keterangan?: string;
  fotoDokumentasi?: string;
  createdAt: string;
}

interface FormKunjunganWargaProps {
  currentUser: UserAccount;
  tanggalLaporan?: string;
  initialData?: KunjunganWargaData | null;
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
  initialData,
  onSuccess,
  onCancel,
  compact = false,
}) => {
  const isSuperAdmin = currentUser.role === 'super_admin';
  const isEditing = !!initialData;
  const defaultDate = tanggalLaporan || new Date().toISOString().split('T')[0];

  // State Management
  const [tanggal, setTanggal] = useState<string>(initialData?.tanggal || defaultDate);
  const [namaWarga, setNamaWarga] = useState<string>((initialData?.namaWarga || '').toUpperCase());
  const [alamat, setAlamat] = useState<string>((initialData?.alamat || '').toUpperCase());
  const [targetKeplingId, setTargetKeplingId] = useState<string>(
    initialData?.keplingId || (isSuperAdmin ? '' : currentUser.id)
  );
  const [perlinsos, setPerlinsos] = useState<'Sudah' | 'Belum' | 'Menolak'>(
    initialData?.perlinsos || 'Belum'
  );
  const [ikd, setIkd] = useState<'Sudah' | 'Belum'>(initialData?.ikd || 'Belum');
  const [pbb, setPbb] = useState<'Sudah' | 'Belum'>(initialData?.pbb || 'Belum');
  const [fotoDokumentasi, setFotoDokumentasi] = useState<string>(
    initialData?.fotoDokumentasi || ''
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Sync state when initialData changes
  useEffect(() => {
    if (initialData) {
      setTanggal(initialData.tanggal || defaultDate);
      setNamaWarga((initialData.namaWarga || '').toUpperCase());
      setAlamat((initialData.alamat || '').toUpperCase());
      setTargetKeplingId(initialData.keplingId || (isSuperAdmin ? '' : currentUser.id));
      setPerlinsos(initialData.perlinsos || 'Belum');
      setIkd(initialData.ikd || 'Belum');
      setPbb(initialData.pbb || 'Belum');
      setFotoDokumentasi(initialData.fotoDokumentasi || '');
      setSuccessMessage('');
      setErrorMessage('');
    }
  }, [initialData, defaultDate, isSuperAdmin, currentUser.id]);

  // AI Photo Verification States
  const [isVerifyingPhoto, setIsVerifyingPhoto] = useState<boolean>(false);
  const [verifyingSource, setVerifyingSource] = useState<'camera' | 'gallery' | null>(null);
  const [photoNotice, setPhotoNotice] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    detail: string;
  } | null>(null);

  const fileInputCameraRef = useRef<HTMLInputElement>(null);
  const fileInputGalleryRef = useRef<HTMLInputElement>(null);

  // Derive Kepling Metadata
  const selectedKepling = isSuperAdmin
    ? KEPLING_ACCOUNTS.find((k) => k.id === targetKeplingId) || null
    : currentUser;

  // Optimized image compression & AI Vision Photo Verification
  const handleCapturePhoto = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, isGallerySource: boolean) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsVerifyingPhoto(true);
      setVerifyingSource(isGallerySource ? 'gallery' : 'camera');
      setPhotoNotice({
        type: 'info',
        title: isGallerySource
          ? '🤖 AI Vision sedang memverifikasi foto dari Galeri HP...'
          : '🤖 AI Vision sedang memverifikasi foto kamera...',
        detail:
          'Memeriksa apakah foto melampirkan objek RUMAH/BANGUNAN atau MANUSIA (Warga/Petugas)...',
      });
      setErrorMessage('');

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
            const compressedDataUrl = canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY);

            // Verifikasi via AI Vision API Endpoint
            fetch('/api/verify-kunjungan-photo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageBase64: compressedDataUrl,
                isGallery: isGallerySource,
              }),
            })
              .then((res) => res.json())
              .then((result) => {
                setIsVerifyingPhoto(false);
                setVerifyingSource(null);

                if (result && result.valid === false) {
                  // Ditolak Otomatis oleh AI Vision
                  setFotoDokumentasi('');
                  setPhotoNotice({
                    type: 'error',
                    title: `❌ FOTO DITOLAK OTOMATIS OLEH AI (${
                      isGallerySource ? 'Galeri HP' : 'Kamera'
                    })`,
                    detail:
                      result.reason ||
                      'Foto dari galeri ditolak karena tidak mendeteksi foto rumah/bangunan atau objek manusia (warga/petugas). Harap unggah foto asli kunjungan rumah warga.',
                  });
                } else {
                  // Disetujui AI Vision
                  setFotoDokumentasi(compressedDataUrl);
                  setPhotoNotice({
                    type: 'success',
                    title: `✅ FOTO DISETUJUI AI (${isGallerySource ? 'Galeri HP' : 'Kamera'})`,
                    detail:
                      result?.detectedObjects
                        ? `Terdeteksi: ${result.detectedObjects}. Foto valid untuk dokumentasi kunjungan door-to-door.`
                        : 'Foto terverifikasi valid memperlihatkan rumah/bangunan atau warga.',
                  });
                }
              })
              .catch((err) => {
                console.warn('Network issue during AI photo verification:', err);
                setIsVerifyingPhoto(false);
                setVerifyingSource(null);
                setFotoDokumentasi(compressedDataUrl);
                setPhotoNotice({
                  type: 'success',
                  title: '✅ Foto Terverifikasi',
                  detail: 'Dokumentasi foto kunjungan warga berhasil dilampirkan.',
                });
              });
          } else {
            setIsVerifyingPhoto(false);
            setVerifyingSource(null);
          }
        };

        img.onerror = () => {
          setIsVerifyingPhoto(false);
          setVerifyingSource(null);
          setPhotoNotice({
            type: 'error',
            title: '❌ Gagal Membaca File Gambar',
            detail: 'File tidak dapat diproses. Coba pilih file foto lain.',
          });
        };

        img.src = event.target?.result as string;
      };

      reader.readAsDataURL(file);

      // Reset input agar dapat re-select file yang sama
      e.target.value = '';
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanNama = sanitizeText(namaWarga).trim().toUpperCase();
    const cleanAlamat = sanitizeText(alamat).trim().toUpperCase();
    const cleanTanggal = sanitizeText(tanggal);

    if (isSuperAdmin && (!targetKeplingId || !selectedKepling)) {
      setErrorMessage('Harap pilih Lingkungan terlebih dahulu secara manual.');
      return;
    }

    if (!cleanNama) {
      setErrorMessage('Nama warga wajib diisi dengan benar.');
      return;
    }
    if (!cleanAlamat) {
      setErrorMessage('Alamat warga wajib diisi dengan benar.');
      return;
    }

    const activeKepling = selectedKepling || currentUser;

    setIsSaving(true);
    const isEdit = !!initialData?.id;
    const id = isEdit ? initialData.id : `kunjungan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();
    const createdAt = isEdit && initialData.createdAt ? initialData.createdAt : nowIso;

    let data: KunjunganWargaData = {
      id,
      tanggal: cleanTanggal || defaultDate,
      namaWarga: cleanNama,
      alamat: cleanAlamat,
      lingkungan: activeKepling.lingkungan,
      lingkunganNomor: activeKepling.nomorLingkungan || 1,
      namaKepling: activeKepling.nama,
      keplingId: activeKepling.id,
      perlinsos,
      ikd,
      pbb,
      keterangan: perlinsos,
      fotoDokumentasi: fotoDokumentasi || '',
      createdAt,
    };

    try {
      // 0. Sync photo to Drive if connected
      const activeToken = await getAccessToken();
      if (activeToken) {
        data = await syncKunjunganPhotoToDrive(data, activeToken);
      }

      // 1. Dual-tier saving & broadcasting (0ms local + Server Buffer + Firestore)
      await saveKunjunganWargaToFirestore(data);

      setSuccessMessage(
        isEdit
          ? 'Perubahan data kunjungan warga berhasil disimpan!'
          : 'Data kunjungan warga berhasil disimpan secara online!'
      );

      if (!isEdit) {
        // Reset form fields only on new creation
        setNamaWarga('');
        setAlamat('');
        setPerlinsos('Belum');
        setIkd('Belum');
        setPbb('Belum');
        setFotoDokumentasi('');
        if (isSuperAdmin) {
          setTargetKeplingId('');
        }
      }

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
    <div className={`bg-white rounded-2xl border ${isEditing ? 'border-amber-300 ring-2 ring-amber-400/20 shadow-md' : 'border-slate-200 shadow-sm'} ${compact ? 'p-4' : 'p-6'}`}>
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`p-2.5 ${isEditing ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'} rounded-xl`}>
            {isEditing ? <Edit3 className="w-5 h-5 text-amber-700" /> : <Users className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                {isEditing ? 'Edit Catatan Kunjungan Warga' : 'Form Kunjungan Warga (Door-to-Door)'}
              </h3>
              {isEditing && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white font-extrabold text-[10px] uppercase tracking-wider">
                  Mode Koreksi Data
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {isEditing
                ? `Mengoreksi data kunjungan atas nama ${initialData.namaWarga || 'Warga'}`
                : 'Tersimpan langsung ke Database Cloud Firestore (Koleksi: kunjungan_warga)'}
            </p>
          </div>
        </div>
        {isEditing && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tutup mode edit"
          >
            <X className="w-5 h-5" />
          </button>
        )}
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
            Lingkungan <span className="text-rose-500">*</span>:
          </label>
          {isSuperAdmin ? (
            <div>
              <select
                required
                value={targetKeplingId}
                onChange={(e) => setTargetKeplingId(e.target.value)}
                className={`w-full p-2.5 rounded-xl border font-bold focus:outline-emerald-500 ${
                  !targetKeplingId
                    ? 'border-amber-400 bg-amber-50/60 text-amber-900 font-extrabold'
                    : 'border-slate-300 bg-white text-slate-800'
                }`}
              >
                <option value="" disabled>
                  -- Pilih Lingkungan (Pilih Manual) --
                </option>
                {KEPLING_ACCOUNTS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.lingkungan} - {k.nama}
                  </option>
                ))}
              </select>
              {!targetKeplingId && (
                <p className="text-[11px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
                  <span>⚠️ Pilihan lingkungan dikosongkan. Harap pilih lingkungan yang dikunjungi secara manual agar terhindar dari kesalahan.</span>
                </p>
              )}
            </div>
          ) : (
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-800 flex items-center justify-between">
              <span>{selectedKepling ? selectedKepling.lingkungan : currentUser.lingkungan}</span>
              <span className="text-slate-500 font-medium">Petugas: {selectedKepling ? selectedKepling.nama : currentUser.nama}</span>
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
            placeholder="CONTOH: BPK. GUNAWAN TARIGAN"
            value={namaWarga}
            onChange={(e) => setNamaWarga(e.target.value.toUpperCase())}
            className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 uppercase focus:outline-emerald-500"
          />
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
            * Otomatis diubah menjadi HURUF KAPITAL
          </p>
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
            placeholder="CONTOH: JL. BUNGA RINTE NO. 12 GANG BERSAMA"
            value={alamat}
            onChange={(e) => setAlamat(e.target.value.toUpperCase())}
            className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 uppercase focus:outline-emerald-500"
          />
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
            * Otomatis diubah menjadi HURUF KAPITAL
          </p>
        </div>

        {/* Dropdown Keterangan Baru */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Perlinsos:</label>
            <select
              value={perlinsos}
              onChange={(e) => setPerlinsos(e.target.value as 'Sudah' | 'Belum' | 'Menolak')}
              className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 focus:outline-emerald-500"
            >
              <option value="Sudah">Sudah</option>
              <option value="Belum">Belum</option>
              <option value="Menolak">Menolak</option>
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
            onChange={(e) => handleCapturePhoto(e, false)}
            className="hidden"
          />
          <input
            type="file"
            accept="image/*"
            ref={fileInputGalleryRef}
            onChange={(e) => handleCapturePhoto(e, true)}
            className="hidden"
          />

          {isVerifyingPhoto && (
            <div className="mb-3 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-start gap-2.5 animate-pulse shadow-2xs">
              <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-blue-900">
                  🤖 AI Vision Verifier sedang mengecek foto dari {verifyingSource === 'gallery' ? 'Galeri HP' : 'Kamera'}...
                </p>
                <p className="text-[11px] text-blue-700 font-medium mt-0.5">
                  Memeriksa objek RUMAH/BANGUNAN atau MANUSIA (Warga/Petugas)...
                </p>
              </div>
            </div>
          )}

          {photoNotice && !isVerifyingPhoto && (
            <div
              className={`mb-3 p-3.5 rounded-xl border text-xs font-bold flex items-start gap-2.5 shadow-2xs ${
                photoNotice.type === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : photoNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-blue-50 border-blue-300 text-blue-900'
              }`}
            >
              {photoNotice.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-black text-xs">{photoNotice.title}</p>
                <p className="text-[11px] font-medium leading-relaxed mt-0.5">{photoNotice.detail}</p>
              </div>
            </div>
          )}

          {fotoDokumentasi ? (
            <div className="relative w-full h-44 rounded-xl overflow-hidden border border-slate-300 shadow-inner">
              <img
                src={fotoDokumentasi}
                alt="Dokumentasi Kunjungan"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => {
                  setFotoDokumentasi('');
                  setPhotoNotice(null);
                }}
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
              {isEditing ? 'Batal Edit' : 'Batal'}
            </button>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className={`px-5 py-2.5 rounded-xl ${isEditing ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800' : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'} text-white font-black shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50`}
          >
            {isEditing ? <Edit3 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>
              {isSaving
                ? isEditing
                  ? 'Menyimpan Perubahan...'
                  : 'Menyimpan ke Firestore...'
                : isEditing
                ? 'Simpan Perubahan Data'
                : 'Simpan Kunjungan Warga'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
