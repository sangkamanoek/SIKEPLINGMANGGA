import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Search,
  Calendar,
  User,
  Filter,
  Layers,
  CheckCircle,
  X,
  Eye,
  CalendarPlus,
  Shield,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { LaporanHarianItem, SheetMetadata } from '../types';
import { KEPLING_ACCOUNTS, SUPER_ADMIN_ACCOUNT } from '../data/keplingList';
import { isReportMatchingKepling } from '../lib/formatter';

interface RiwayatLaporanProps {
  items: LaporanHarianItem[];
  isLoading: boolean;
  onRefresh: () => void;
  sheetMeta: SheetMetadata | null;
  onSelectReport: (item: LaporanHarianItem) => void;
  onSyncToCalendar?: (item: LaporanHarianItem) => Promise<void>;
  hasGoogleAuth: boolean;
  initialPetugasFilter?: string;
  isAdmin?: boolean;
  onDeleteReport?: (id: string) => Promise<void>;
}

type FilterKegiatanType = 'ALL' | 'PBB' | 'PERLINSOS' | 'IKD' | 'BPJS' | 'POSKAMLING' | 'LAINNYA';

export const RiwayatLaporan: React.FC<RiwayatLaporanProps> = ({
  items,
  isLoading,
  onRefresh,
  sheetMeta,
  onSelectReport,
  onSyncToCalendar,
  hasGoogleAuth,
  initialPetugasFilter,
  isAdmin = false,
  onDeleteReport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPetugas, setSelectedPetugas] = useState(initialPetugasFilter || 'ALL');
  const [selectedKegiatan, setSelectedKegiatan] = useState<FilterKegiatanType>('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const handleExecuteDelete = async (id: string) => {
    if (!onDeleteReport) return;
    setIsDeletingId(id);
    try {
      await onDeleteReport(id);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Failed to delete report:', err);
    } finally {
      setIsDeletingId(null);
    }
  };

  // Sync if initialPetugasFilter changes
  React.useEffect(() => {
    if (initialPetugasFilter) {
      setSelectedPetugas(initialPetugasFilter);
    }
  }, [initialPetugasFilter]);

  // Extract unique officer names for the filter dropdown
  const listPetugas = useMemo(() => {
    const set = new Set<string>();
    // Pre-populate with all 24 Kepling
    KEPLING_ACCOUNTS.forEach((k) => set.add(k.nama));
    set.add(SUPER_ADMIN_ACCOUNT.nama);
    // Include any existing in items
    items.forEach((item) => {
      if (item.namaKepling?.trim()) {
        set.add(item.namaKepling.trim());
      }
    });
    return Array.from(set);
  }, [items]);

  // Comprehensive multi-criteria filtering
  const filtered = useMemo(() => {
    return items.filter((item) => {
      const term = searchTerm.toLowerCase();
      // 1. Keyword search (tanggal, hari, nama, jabatan, keterangan, catatan)
      const matchesKeyword =
        !searchTerm ||
        item.tanggal.toLowerCase().includes(term) ||
        item.hari.toLowerCase().includes(term) ||
        item.namaKepling.toLowerCase().includes(term) ||
        item.jabatan.toLowerCase().includes(term) ||
        (item.kinerja.opsirPbbKeterangan || '').toLowerCase().includes(term) ||
        (item.kinerja.perlinsosKeterangan || '').toLowerCase().includes(term) ||
        (item.kinerja.ikdKeterangan || '').toLowerCase().includes(term) ||
        (item.kinerja.bpjsKetenagakerjaanKeterangan || '').toLowerCase().includes(term) ||
        (item.kinerja.kegiatanLainnya || '').toLowerCase().includes(term);

      if (!matchesKeyword) return false;

      // 2. Filter by Petugas (Ketat, mencegah kesalahan laporan antar-kepling)
      if (selectedPetugas !== 'ALL') {
        const targetKepling = KEPLING_ACCOUNTS.find(
          (k) => k.nama.trim().toLowerCase() === selectedPetugas.trim().toLowerCase()
        );
        if (targetKepling) {
          if (!isReportMatchingKepling(item, targetKepling)) {
            return false;
          }
        } else if (
          item.namaKepling?.trim().toLowerCase() !== selectedPetugas.trim().toLowerCase()
        ) {
          return false;
        }
      }

      // 3. Filter by Specific Date
      if (selectedDate) {
        const itemCreatedDate = item.createdAt ? item.createdAt.split('T')[0] : '';
        const dateInput = selectedDate; // YYYY-MM-DD
        const formattedDatePart = item.tanggal.toLowerCase();
        
        const matchesDate =
          itemCreatedDate === dateInput ||
          formattedDatePart.includes(dateInput);

        if (!matchesDate) return false;
      }

      // 4. Filter by Jenis Kegiatan (4 Pilar)
      if (selectedKegiatan === 'PBB') {
        const val = parseFloat(String(item.kinerja.opsirPbbWp || 0));
        return !isNaN(val) && val > 0;
      }
      if (selectedKegiatan === 'PERLINSOS') {
        const val = parseFloat(String(item.kinerja.perlinsosKk || 0));
        return !isNaN(val) && val > 0;
      }
      if (selectedKegiatan === 'IKD') {
        const val = parseFloat(String(item.kinerja.ikdOrang || 0));
        return !isNaN(val) && val > 0;
      }
      if (selectedKegiatan === 'BPJS') {
        const val = parseFloat(String(item.kinerja.bpjsKetenagakerjaanOrang || 0));
        return !isNaN(val) && val > 0;
      }
      if (selectedKegiatan === 'POSKAMLING') {
        return Boolean(
          (item.kinerja?.poskamlingStatus && item.kinerja.poskamlingStatus !== 'Tidak Ada Giat') ||
          item.kinerja?.poskamlingAdaGiat
        );
      }
      if (selectedKegiatan === 'LAINNYA') {
        return Boolean(item.kinerja.kegiatanLainnya?.trim());
      }

      return true;
    });
  }, [items, searchTerm, selectedPetugas, selectedDate, selectedKegiatan]);

  // Aggregate stats across the filtered view
  const stats = useMemo(() => {
    let totalPbbWp = 0;
    let totalPerlinsosKk = 0;
    let totalIkdOrang = 0;
    let totalBpjsOrang = 0;
    let totalPoskamling = 0;

    filtered.forEach((i) => {
      totalPbbWp += parseFloat(String(i.kinerja.opsirPbbWp || 0)) || 0;
      totalPerlinsosKk += parseFloat(String(i.kinerja.perlinsosKk || 0)) || 0;
      totalIkdOrang += parseFloat(String(i.kinerja.ikdOrang || 0)) || 0;
      totalBpjsOrang += parseFloat(String(i.kinerja.bpjsKetenagakerjaanOrang || 0)) || 0;
      if (i.kinerja?.poskamlingStatus && i.kinerja.poskamlingStatus !== 'Tidak Ada Giat') {
        totalPoskamling += 1;
      }
    });

    return { totalPbbWp, totalPerlinsosKk, totalIkdOrang, totalBpjsOrang, totalPoskamling };
  }, [filtered]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedPetugas('ALL');
    setSelectedKegiatan('ALL');
    setSelectedDate('');
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedPetugas !== 'ALL' ||
    selectedKegiatan !== 'ALL' ||
    selectedDate !== '';

  const handleSyncItemToCalendar = async (item: LaporanHarianItem) => {
    if (!onSyncToCalendar) return;
    try {
      setSyncingId(item.id);
      await onSyncToCalendar(item);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-6 bg-emerald-500 rounded-full shrink-0"></span>
          <div>
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-800">
              Database Riwayat Laporan Kinerja
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Data tersimpan otomatis di Google Sheets dan dapat dicari secara spesifik.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sheetMeta?.spreadsheetUrl && (
            <a
              id="link-buka-spreadsheet-riwayat"
              href={sheetMeta.spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Buka Google Sheets</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <button
            id="btn-refresh-riwayat"
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            title="Muat ulang dari Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan Data</span>
          </button>
        </div>
      </div>

      {/* Multi-Criteria Search & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Pencarian & Filter Laporan
            </h3>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        {/* Input Bar & Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className={`relative ${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              id="input-cari-riwayat"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari kata kunci: nama, hari, atau catatan kegiatan..."
              className="w-full pl-10 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
            />
          </div>

          {/* Filter by Petugas Kepling - HANYA UNTUK ADMIN */}
          {isAdmin && (
            <div>
              <select
                id="filter-petugas"
                value={selectedPetugas}
                onChange={(e) => setSelectedPetugas(e.target.value)}
                className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
              >
                <option value="ALL">Semua Petugas Kepling</option>
                {listPetugas.map((nama) => (
                  <option key={nama} value={nama}>
                    👤 {nama}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filter by Date */}
          <div>
            <input
              id="filter-tanggal"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
              title="Pilih tanggal spesifik"
            />
          </div>
        </div>

        {/* Jenis Kegiatan Quick Pills */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-400 text-[11px] font-bold uppercase mr-1">
            Jenis Kegiatan:
          </span>

          <button
            type="button"
            onClick={() => setSelectedKegiatan('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedKegiatan === 'ALL'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Kegiatan
          </button>

          <button
            type="button"
            onClick={() => setSelectedKegiatan('PBB')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedKegiatan === 'PBB'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            1. OPSIR PBB
          </button>

          <button
            type="button"
            onClick={() => setSelectedKegiatan('PERLINSOS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedKegiatan === 'PERLINSOS'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            2. PERLINSOS
          </button>

          <button
            type="button"
            onClick={() => setSelectedKegiatan('IKD')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedKegiatan === 'IKD'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            3. IDENTITAS DIGITAL (IKD)
          </button>

          <button
            type="button"
            onClick={() => setSelectedKegiatan('BPJS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedKegiatan === 'BPJS'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            4. BPJS KETENAGAKERJAAN
          </button>

          <button
            type="button"
            onClick={() => setSelectedKegiatan('POSKAMLING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedKegiatan === 'POSKAMLING'
                ? 'bg-amber-500 text-slate-950 shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-600" />
            <span>5. POSKAMLING</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedKegiatan('LAINNYA')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedKegiatan === 'LAINNYA'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            6. Kegiatan Lainnya
          </button>
        </div>

        {/* Results Summary Bar */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="font-semibold text-slate-700 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>
              Menampilkan <strong>{filtered.length}</strong> dari <strong>{items.length}</strong> total laporan tersimpan.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-600">
            <span className="bg-white px-2 py-1 rounded border border-slate-200">
              PBB: <strong className="text-emerald-700">{stats.totalPbbWp} WP</strong>
            </span>
            <span className="bg-white px-2 py-1 rounded border border-slate-200">
              Perlinsos: <strong className="text-emerald-700">{stats.totalPerlinsosKk} KK</strong>
            </span>
            <span className="bg-white px-2 py-1 rounded border border-slate-200">
              IKD: <strong className="text-emerald-700">{stats.totalIkdOrang} ORG</strong>
            </span>
            <span className="bg-white px-2 py-1 rounded border border-slate-200">
              BPJS TK: <strong className="text-emerald-700">{stats.totalBpjsOrang} ORG</strong>
            </span>
            <span className="bg-white px-2 py-1 rounded border border-amber-300 text-amber-900 flex items-center gap-1">
              <Shield className="w-3 h-3 text-amber-600" />
              Poskamling: <strong className="text-amber-700">{stats.totalPoskamling} Giat</strong>
            </span>
          </div>
        </div>
      </div>

      {/* List of Filtered Reports */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-xs transition-all space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded bg-emerald-700 text-white shadow-2xs">
                      {item.hari}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {item.tanggal}
                    </span>
                    {item.jumlahDokumentasi > 0 && (
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        📷 {item.jumlahDokumentasi} Foto
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    <strong className="text-slate-800 font-bold">{item.namaKepling}</strong> • {item.jabatan} • {item.kelurahan}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectReport(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                    <span>Lihat Rincian</span>
                  </button>

                  {isAdmin && onDeleteReport && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(confirmDeleteId === item.id ? null : item.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      title="Hapus laporan ini dari sistem (Akses Admin)"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Hapus</span>
                    </button>
                  )}

                  {hasGoogleAuth && onSyncToCalendar && (
                    <button
                      type="button"
                      onClick={() => handleSyncItemToCalendar(item)}
                      disabled={syncingId === item.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                      title="Sinkronkan laporan ini ke Google Calendar"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      <span>{syncingId === item.id ? 'Menyinkronkan...' : 'Ke Kalender'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* In-app Confirmation Banner for Admin Delete */}
              {confirmDeleteId === item.id && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-rose-900 font-medium">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Hapus laporan <strong>{item.namaKepling}</strong> ({item.jabatan}) tanggal <strong>{item.tanggal}</strong> permanen dari database?
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={isDeletingId === item.id}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExecuteDelete(item.id)}
                      disabled={isDeletingId === item.id}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isDeletingId === item.id ? 'Menghapus...' : 'Ya, Hapus'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 4 Pillars Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">1. OPSIR PBB</span>
                  <span className="font-bold text-slate-800">
                    {item.kinerja.opsirPbbWp ? `${item.kinerja.opsirPbbWp} WP` : '-'}
                  </span>
                  {item.kinerja.opsirPbbKeterangan && (
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {item.kinerja.opsirPbbKeterangan}
                    </p>
                  )}
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">2. PERLINSOS</span>
                  <span className="font-bold text-slate-800">
                    {item.kinerja.perlinsosKk ? `${item.kinerja.perlinsosKk} KK` : '-'}
                  </span>
                  {item.kinerja.perlinsosKeterangan && (
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {item.kinerja.perlinsosKeterangan}
                    </p>
                  )}
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">3. IKD</span>
                  <span className="font-bold text-slate-800">
                    {item.kinerja.ikdOrang ? `${item.kinerja.ikdOrang} ORG` : '-'}
                  </span>
                  {item.kinerja.ikdKeterangan && (
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {item.kinerja.ikdKeterangan}
                    </p>
                  )}
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">4. BPJS TK</span>
                  <span className="font-bold text-slate-800">
                    {item.kinerja.bpjsKetenagakerjaanOrang ? `${item.kinerja.bpjsKetenagakerjaanOrang} ORG` : '-'}
                  </span>
                  {item.kinerja.bpjsKetenagakerjaanKeterangan && (
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {item.kinerja.bpjsKetenagakerjaanKeterangan}
                    </p>
                  )}
                </div>
              </div>

              {/* Poskamling Information Bar */}
              {item.kinerja?.poskamlingStatus && item.kinerja.poskamlingStatus !== 'Tidak Ada Giat' && (
                <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-950 flex flex-wrap items-center gap-2">
                  <span className="font-bold flex items-center gap-1 text-amber-900">
                    <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    Poskamling:
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-400 font-black text-[10px] text-slate-950">
                    {item.kinerja.poskamlingStatus}
                  </span>
                  {item.kinerja.poskamlingLokasi && (
                    <span className="text-slate-700">📍 {item.kinerja.poskamlingLokasi}</span>
                  )}
                  {item.kinerja.poskamlingPetugas && (
                    <span className="text-slate-600 hidden sm:inline">👮 {item.kinerja.poskamlingPetugas}</span>
                  )}
                  {item.kinerja.poskamlingKeterangan && (
                    <span className="text-slate-600 italic text-[11px] w-full sm:w-auto truncate">
                      "{item.kinerja.poskamlingKeterangan}"
                    </span>
                  )}
                </div>
              )}

              {item.kinerja.kegiatanLainnya && (
                <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="font-semibold text-slate-700">Kegiatan Lainnya:</span> {item.kinerja.kegiatanLainnya}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 text-slate-600">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Memuat data dari Google Sheets...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-bold text-slate-700 text-sm">Tidak ada laporan yang sesuai dengan kriteria filter.</p>
              <p className="text-slate-400 max-w-md mx-auto">
                Coba ubah kata kunci pencarian, sesuaikan tanggal, atau klik Reset Filter untuk menampilkan seluruh laporan.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset Semua Filter</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
