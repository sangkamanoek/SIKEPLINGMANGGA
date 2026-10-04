import React, { useState, useEffect, useMemo } from 'react';
import {
  Baby,
  Plus,
  Trash2,
  Download,
  Search,
  CheckCircle2,
  X,
  Camera,
  Calendar,
  MapPin,
  Users,
  Sparkles,
} from 'lucide-react';
import { UserAccount, PosyanduReport, FotoDokumentasi } from '../types';
import {
  subscribePosyanduReports,
  savePosyanduReport,
  deletePosyanduReport,
} from '../lib/pkkPosyanduService';
import { KETUA_PKK_LINGKUNGAN_ACCOUNTS } from '../data/keplingList';

interface PkkPosyanduViewProps {
  currentUser: UserAccount;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PkkPosyanduView: React.FC<PkkPosyanduViewProps> = ({ currentUser, onShowToast }) => {
  const [reports, setReports] = useState<PosyanduReport[]>([]);
  const [filterLingkungan, setFilterLingkungan] = useState<string>(
    currentUser.role === 'ketua_pkk_lingkungan' ? String(currentUser.nomorLingkungan) : 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const defaultLkNum = currentUser.nomorLingkungan || 1;
  const [formLingkunganNomor, setFormLingkunganNomor] = useState<number>(defaultLkNum);
  const [formTanggal, setFormTanggal] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formPosyanduNama, setFormPosyanduNama] = useState<string>(
    currentUser.lingkungan ? `Posyandu ${currentUser.lingkungan}` : 'Posyandu Melati'
  );
  const [formPosyanduLokasi, setFormPosyanduLokasi] = useState<string>('Balai Warga Lingkungan');
  const [formJumlahKader, setFormJumlahKader] = useState<string>('5 Kader');
  
  const [formBayi02, setFormBayi02] = useState<string>('0');
  const [formBalita25, setFormBalita25] = useState<string>('0');
  const [formAnak612, setFormAnak612] = useState<string>('0');
  const [formRemaja1318, setFormRemaja1318] = useState<string>('0');
  const [formDewasaBumil1959, setFormDewasaBumil1959] = useState<string>('0');
  const [formLansia60, setFormLansia60] = useState<string>('0');

  const [formJenisLayanan, setFormJenisLayanan] = useState<string[]>([
    'Penimbangan & Pengukuran (Pantau Stunting)',
    'Imunisasi Dasar & Lanjutan Lengkap',
    'Pemberian Vitamin A & Obat Cacing',
  ]);
  const [formKeterangan, setFormKeterangan] = useState<string>('Pelayanan posyandu berjalan lancar dan tertib.');
  const [fotoList, setFotoList] = useState<FotoDokumentasi[]>([]);

  useEffect(() => {
    const unsub = subscribePosyanduReports((items) => {
      setReports(items);
    });
    return () => unsub();
  }, []);

  const totalWargaKumulatif = useMemo(() => {
    return (
      (parseInt(formBayi02, 10) || 0) +
      (parseInt(formBalita25, 10) || 0) +
      (parseInt(formAnak612, 10) || 0) +
      (parseInt(formRemaja1318, 10) || 0) +
      (parseInt(formDewasaBumil1959, 10) || 0) +
      (parseInt(formLansia60, 10) || 0)
    );
  }, [formBayi02, formBalita25, formAnak612, formRemaja1318, formDewasaBumil1959, formLansia60]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (filterLingkungan !== 'ALL') {
        if (r.nomorLingkungan !== parseInt(filterLingkungan, 10)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNama = (r.posyanduNama || '').toLowerCase().includes(q);
        const matchPetugas = (r.namaPetugas || '').toLowerCase().includes(q);
        const matchLokasi = (r.posyanduLokasi || '').toLowerCase().includes(q);
        if (!matchNama && !matchPetugas && !matchLokasi) return false;
      }
      return true;
    });
  }, [reports, filterLingkungan, searchQuery]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          const newFoto: FotoDokumentasi = {
            id: 'foto_' + Date.now() + Math.random().toString(36).substring(2, 7),
            url: base64,
            name: file.name,
            timestamp: new Date().toISOString(),
            kategori: 'posyandu',
          };
          setFotoList((prev) => [...prev, newFoto]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPosyanduNama.trim()) {
      onShowToast?.('Nama Posyandu wajib diisi!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedAcc = KETUA_PKK_LINGKUNGAN_ACCOUNTS.find(
        (a) => a.nomorLingkungan === formLingkunganNomor
      ) || currentUser;

      const report: PosyanduReport = {
        id: 'posyandu_' + Date.now(),
        pkkLingkunganId: selectedAcc.id,
        namaPetugas: selectedAcc.nama,
        lingkungan: `Lingkungan ${formLingkunganNomor}`,
        nomorLingkungan: formLingkunganNomor,
        tanggal: formTanggal,
        posyanduNama: formPosyanduNama.trim(),
        posyanduLokasi: formPosyanduLokasi.trim(),
        posyanduJumlahPetugasKader: formJumlahKader,
        posyanduJumlahWargaTotal: totalWargaKumulatif,
        posyanduBayi02Tahun: parseInt(formBayi02, 10) || 0,
        posyanduBalita25Tahun: parseInt(formBalita25, 10) || 0,
        posyanduAnak612Tahun: parseInt(formAnak612, 10) || 0,
        posyanduRemaja1318Tahun: parseInt(formRemaja1318, 10) || 0,
        posyanduDewasaIbuHamil1959Tahun: parseInt(formDewasaBumil1959, 10) || 0,
        posyanduLansia60TahunKeatas: parseInt(formLansia60, 10) || 0,
        posyanduJenisLayanan: formJenisLayanan,
        posyanduKeterangan: formKeterangan.trim(),
        dokumentasiFoto: fotoList,
        createdAt: new Date().toISOString(),
      };

      await savePosyanduReport(report);
      onShowToast?.('Laporan Posyandu berhasil disimpan & ditampilkan di Dashboard PKK!', 'success');
      setIsModalOpen(false);
      setFotoList([]);
    } catch (err) {
      console.error(err);
      onShowToast?.('Gagal menyimpan laporan Posyandu', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus laporan Posyandu ini?')) return;
    try {
      await deletePosyanduReport(id);
      onShowToast?.('Laporan Posyandu berhasil dihapus.', 'success');
    } catch (err) {
      onShowToast?.('Gagal menghapus laporan.', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-800 via-rose-700 to-pink-800 text-white rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/25 backdrop-blur-md text-rose-100 text-xs font-black tracking-wide">
            <Baby className="w-4 h-4 text-amber-300" />
            <span>POKJA IV PKK — POSYANDU & KESEHATAN KELUARGA</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Laporan Pelayanan Posyandu 24 Lingkungan
          </h1>
          <p className="text-xs sm:text-sm text-rose-100 max-w-2xl leading-relaxed">
            Pencatatan kegiatan posyandu balita, ibu hamil, lansia, serta pencegahan stunting dikelola langsung oleh Ketua PKK Lingkungan (Pokja IV).
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setFotoList([]);
              setIsModalOpen(true);
            }}
            className="px-4 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Buat Laporan Posyandu</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama posyandu, petugas, atau lokasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
            />
          </div>

          <select
            value={filterLingkungan}
            onChange={(e) => setFilterLingkungan(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800 focus:ring-2 focus:ring-rose-500"
          >
            <option value="ALL">🌐 Semua Lingkungan (24 Lingkungan)</option>
            {KETUA_PKK_LINGKUNGAN_ACCOUNTS.map((acc) => (
              <option key={acc.id} value={acc.nomorLingkungan}>
                {acc.lingkungan} — {acc.nama}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 font-semibold">
          Menampilkan <b>{filteredReports.length}</b> laporan posyandu
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReports.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-2xs">
            <Baby className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-sm">Belum ada laporan Posyandu</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Ketua PKK Lingkungan belum mengirimkan laporan pelayanan posyandu untuk filter yang dipilih.
            </p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg bg-rose-900 text-white font-black text-[10px]">
                    {report.lingkungan}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-rose-600" />
                    {report.tanggal}
                  </span>
                </div>

                <div>
                  <h3 className="font-black text-slate-900 text-base">{report.posyanduNama}</h3>
                  <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>{report.posyanduLokasi || 'Lokasi tidak diisi'}</span>
                  </p>
                </div>

                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-black text-rose-950">
                    <span>Total Warga Dilayani:</span>
                    <span className="text-rose-700 text-sm">{report.posyanduJumlahWargaTotal} Jiwa</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] text-slate-600 font-semibold border-t border-rose-200/60">
                    <div>👶 0-2Th: <b>{report.posyanduBayi02Tahun}</b></div>
                    <div>🧒 2-5Th: <b>{report.posyanduBalita25Tahun}</b></div>
                    <div>👦 6-12Th: <b>{report.posyanduAnak612Tahun}</b></div>
                    <div>🧑 13-18Th: <b>{report.posyanduRemaja1318Tahun}</b></div>
                    <div>🤰 19-59Th: <b>{report.posyanduDewasaIbuHamil1959Tahun}</b></div>
                    <div>👵 60+Th: <b>{report.posyanduLansia60TahunKeatas}</b></div>
                  </div>
                </div>

                {Array.isArray(report.posyanduJenisLayanan) && report.posyanduJenisLayanan.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Layanan Diberikan:</span>
                    <div className="flex flex-wrap gap-1">
                      {report.posyanduJenisLayanan.map((l, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                          ✓ {l}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {report.posyanduKeterangan && (
                  <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    "{report.posyanduKeterangan}"
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold text-[11px]">
                  Petugas: {report.namaPetugas}
                </span>
                {(currentUser.role === 'super_admin' || currentUser.id === report.pkkLingkunganId) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(report.id)}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Hapus laporan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Input Laporan Posyandu */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-rose-200 overflow-hidden animate-in fade-in zoom-in duration-200 my-8">
            <div className="bg-gradient-to-r from-rose-800 to-pink-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg">Formulir Pelayanan Posyandu & Kesehatan</h3>
                <p className="text-xs text-rose-200">Diisi oleh Ketua PKK Lingkungan (Pokja IV)</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-rose-200 hover:text-white p-1 rounded-lg hover:bg-rose-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Lingkungan:</label>
                  <select
                    value={formLingkunganNomor}
                    onChange={(e) => setFormLingkunganNomor(parseInt(e.target.value, 10))}
                    disabled={currentUser.role === 'ketua_pkk_lingkungan'}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800"
                  >
                    {KETUA_PKK_LINGKUNGAN_ACCOUNTS.map((acc) => (
                      <option key={acc.id} value={acc.nomorLingkungan}>
                        {acc.lingkungan} — {acc.nama}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Pelayanan:</label>
                  <input
                    type="date"
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Posyandu:</label>
                  <input
                    type="text"
                    value={formPosyanduNama}
                    onChange={(e) => setFormPosyanduNama(e.target.value)}
                    placeholder="Posyandu Melati"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi / Tempat:</label>
                  <input
                    type="text"
                    value={formPosyanduLokasi}
                    onChange={(e) => setFormPosyanduLokasi(e.target.value)}
                    placeholder="Balai Warga Lk..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Petugas / Kader:</label>
                  <input
                    type="text"
                    value={formJumlahKader}
                    onChange={(e) => setFormJumlahKader(e.target.value)}
                    placeholder="5 Kader + Bidan"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white font-bold"
                  />
                </div>
              </div>

              {/* Rincian Usia */}
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-950">
                    📊 Rincian Warga Terlayani (Usia 0 Th s.d Lansia)
                  </span>
                  <span className="text-xs font-black bg-rose-600 text-white px-2.5 py-0.5 rounded-full">
                    Total: {totalWargaKumulatif} Jiwa
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">👶 Usia 0-2 Th (Baduta):</label>
                    <input
                      type="number"
                      min="0"
                      value={formBayi02}
                      onChange={(e) => setFormBayi02(e.target.value.replace(/^0+(?=\d)/, ''))}
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-bold bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">🧒 Usia 2-5 Th (Balita):</label>
                    <input
                      type="number"
                      min="0"
                      value={formBalita25}
                      onChange={(e) => setFormBalita25(e.target.value.replace(/^0+(?=\d)/, ''))}
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-bold bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">👦 Usia 6-12 Th (Sekolah):</label>
                    <input
                      type="number"
                      min="0"
                      value={formAnak612}
                      onChange={(e) => setFormAnak612(e.target.value.replace(/^0+(?=\d)/, ''))}
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-bold bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">🧑 Usia 13-18 Th (Remaja):</label>
                    <input
                      type="number"
                      min="0"
                      value={formRemaja1318}
                      onChange={(e) => setFormRemaja1318(e.target.value.replace(/^0+(?=\d)/, ''))}
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-bold bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">🤰 Usia 19-59 Th (Bumil/Dewasa):</label>
                    <input
                      type="number"
                      min="0"
                      value={formDewasaBumil1959}
                      onChange={(e) => setFormDewasaBumil1959(e.target.value.replace(/^0+(?=\d)/, ''))}
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-bold bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">👵 Usia 60+ Th (Lansia):</label>
                    <input
                      type="number"
                      min="0"
                      value={formLansia60}
                      onChange={(e) => setFormLansia60(e.target.value.replace(/^0+(?=\d)/, ''))}
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-bold bg-white text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Hasil Posyandu:</label>
                <textarea
                  rows={2}
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  placeholder="Catatan kesehatan balita, PMT, atau stunting..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                />
              </div>

              {/* Dokumentasi Foto */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">Foto Dokumentasi:</label>
                  <label className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs">
                    <Camera className="w-3.5 h-3.5" />
                    <span>+ Unggah Foto</span>
                    <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
                {fotoList.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {fotoList.map((foto) => (
                      <div key={foto.id} className="relative group rounded-xl overflow-hidden border aspect-square bg-slate-100">
                        <img src={foto.url} alt={foto.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFotoList((prev) => prev.filter((f) => f.id !== foto.id))}
                          className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-500 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Laporan Posyandu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
