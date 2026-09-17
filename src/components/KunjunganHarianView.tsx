import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  Search,
  Printer,
  Trash2,
  CheckCircle2,
  XCircle,
  Camera,
  Share2,
  Plus,
} from 'lucide-react';
import { UserAccount } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { FormKunjunganWarga, KunjunganWargaData } from './FormKunjunganWarga';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  getDocs,
} from 'firebase/firestore';

interface KunjunganHarianViewProps {
  currentUser: UserAccount;
  onNavigateToForm?: () => void;
}

export const KunjunganHarianView: React.FC<KunjunganHarianViewProps> = ({
  currentUser,
}) => {
  const isSuperAdmin = currentUser.role === 'super_admin';
  const todayStr = new Date().toISOString().split('T')[0];

  const [records, setRecords] = useState<KunjunganWargaData[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedLingkungan, setSelectedLingkungan] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(true);
  const [copiedWA, setCopiedWA] = useState<boolean>(false);

  // Real-time listener dari Firestore collection 'kunjungan_warga'
  useEffect(() => {
    // 1. Load initial dari cache lokal
    try {
      const localRaw = localStorage.getItem('sikepling_kunjungan_harian_list_v1');
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (Array.isArray(parsed)) setRecords(parsed);
      }
    } catch {}

    // 2. Realtime listener Firestore
    if (!db) return;
    try {
      const q = query(collection(db, 'kunjungan_warga'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: KunjunganWargaData[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as KunjunganWargaData;
            if (data && data.id) list.push(data);
          });
          setRecords(list);
          localStorage.setItem('sikepling_kunjungan_harian_list_v1', JSON.stringify(list));
        },
        (err) => {
          console.warn('Firestore snapshot error:', err);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn('Error subscribing to kunjungan_warga:', e);
    }
  }, []);

  const handleDelete = async (id: string, namaWarga: string) => {
    if (!window.confirm(`Hapus catatan kunjungan ke ${namaWarga}?`)) return;
    try {
      if (db) {
        await deleteDoc(doc(db, 'kunjungan_warga', id));
      }
      setRecords((prev) => {
        const updated = prev.filter((r) => r.id !== id);
        localStorage.setItem('sikepling_kunjungan_harian_list_v1', JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      alert('Gagal menghapus: ' + e);
    }
  };

  // Filter records
  const filtered = records.filter((r) => {
    const isDate = !selectedDate || r.tanggal === selectedDate;
    const isLingkungan =
      selectedLingkungan === 'ALL' ||
      r.lingkunganNomor === Number(selectedLingkungan) ||
      r.keplingId === selectedLingkungan;
    const isRole = isSuperAdmin || r.keplingId === currentUser.id;
    const isSearch =
      !searchQuery.trim() ||
      r.namaWarga.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.alamat.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.lingkungan.toLowerCase().includes(searchQuery.toLowerCase());
    return isDate && isLingkungan && isRole && isSearch;
  });

  const handleCopyWA = () => {
    let text = `*REKAP KUNJUNGAN HARIAN DOOR-TO-DOOR*\n`;
    text += `*KELURAHAN MANGGA, KEC. MEDAN TUNTUNGAN*\n`;
    text += `Hari/Tanggal: ${selectedDate}\n`;
    text += `Total Kunjungan: ${filtered.length} Rumah\n\n`;
    text += `----------------------------------------\n`;

    filtered.forEach((item, index) => {
      text += `${index + 1}. *${item.namaWarga}*\n`;
      text += `   - Alamat: ${item.alamat} (${item.lingkungan})\n`;
      text += `   - Kepling: ${item.namaKepling}\n`;
      text += `   - Status Perlinsos: ${item.statusPerlinsos ? 'SUDAH' : 'BELUM'}\n`;
      text += `   - Keterangan: ${item.keterangan}\n\n`;
    });

    navigator.clipboard.writeText(text);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner Halaman */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-700">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Buku Kunjungan Harian Lapangan (Door-to-Door)
            </h2>
            <p className="text-xs text-slate-500">
              Pencatatan langsung sambang warga Kelurahan Mangga tersimpan ke Firestore koleksi: <code>kunjungan_warga</code>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddForm ? 'Tutup Form Input' : '+ Input Kunjungan Baru'}</span>
        </button>
      </div>

      {/* Komponen Form Kunjungan Warga */}
      {showAddForm && (
        <FormKunjunganWarga
          currentUser={currentUser}
          tanggalLaporan={selectedDate}
          onSuccess={() => {
            // otomatis termuat via firestore onSnapshot
          }}
        />
      )}

      {/* Filter & Action Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tanggal */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none"
            />
          </div>

          {/* Filter Lingkungan (Super Admin) */}
          {isSuperAdmin && (
            <select
              value={selectedLingkungan}
              onChange={(e) => setSelectedLingkungan(e.target.value)}
              className="bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">Semua 24 Lingkungan</option>
              {KEPLING_ACCOUNTS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.lingkungan} - {k.nama}
                </option>
              ))}
            </select>
          )}

          {/* Search */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari warga/alamat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent focus:outline-none w-32 sm:w-44 text-slate-800"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyWA}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copiedWA ? 'Tersalin!' : 'Salin WA'}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Tabel</span>
          </button>
        </div>
      </div>

      {/* Tabel Kunjungan Harian */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 font-extrabold text-slate-700">
                <th className="py-3 px-3 w-10 text-center">NO</th>
                <th className="py-3 px-3">NAMA WARGA</th>
                <th className="py-3 px-3">ALAMAT LENGKAP</th>
                <th className="py-3 px-3 text-center">LINGKUNGAN</th>
                <th className="py-3 px-3 text-center">STATUS PERLINSOS</th>
                <th className="py-3 px-3 text-center">KETERANGAN</th>
                <th className="py-3 px-3 text-center">DOKUMENTASI</th>
                <th className="py-3 px-3 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 font-medium">
                    Belum ada catatan kunjungan pada tanggal {selectedDate}. Gunakan formulir di atas untuk menambahkan.
                  </td>
                </tr>
              ) : (
                filtered.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 text-center font-bold text-slate-500">{index + 1}</td>
                    <td className="py-3 px-3 font-extrabold text-slate-900">{item.namaWarga}</td>
                    <td className="py-3 px-3 text-slate-700 font-medium">
                      {item.alamat}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-800">
                      {item.lingkungan}
                      <div className="text-[10px] text-slate-400 font-normal">{item.namaKepling}</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-md font-black text-[10px] inline-flex items-center gap-1 ${
                          item.statusPerlinsos
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.statusPerlinsos ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {item.statusPerlinsos ? 'SUDAH' : 'BELUM'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          item.keterangan === 'Sudah'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.keterangan === 'Belum'
                            ? 'bg-blue-100 text-blue-800'
                            : item.keterangan === 'Menolak'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.keterangan}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {item.fotoDokumentasi ? (
                        <a
                          href={item.fotoDokumentasi}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-2xs hover:scale-105 transition-transform"
                        >
                          <img
                            src={item.fotoDokumentasi}
                            alt="Dokumentasi"
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Tanpa Foto</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, item.namaWarga)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Kunjungan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
