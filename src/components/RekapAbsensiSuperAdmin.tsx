import React, { useState } from 'react';
import { KopSuratResmi } from './KopSuratResmi';
import { printOfficialDocument } from '../utils/printHelper';
import {
  Calendar,
  Search,
  Printer,
  Download,
  FileSpreadsheet,
  Share2,
  Clock,
  MapPin,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Send,
  X,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { AbsenApelItem, UserAccount } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import {
  checkApelTimeStatus,
  calculateAbsentDays,
  computeAttendanceSummary24,
  computeWeeklyAttendance24,
  computeMonthlyAttendance24,
  getTodayAbsenForKepling,
  KeplingWeeklyRow,
  KeplingMonthlyRow,
} from '../lib/attendanceApi';
import { exportAbsensiToExcel } from '../lib/excelExport';
import { downloadImage } from '../lib/imageDownloader';

interface RekapAbsensiSuperAdminProps {
  attendanceList: AbsenApelItem[];
  currentUser: UserAccount;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onOpenSelfiePreview?: (photo: { url: string; title: string }) => void;
}

export const RekapAbsensiSuperAdmin: React.FC<RekapAbsensiSuperAdminProps> = ({
  attendanceList,
  currentUser,
  selectedDate,
  onDateChange,
  onOpenSelfiePreview,
}) => {
  // Sub-tab selection: 'harian' | 'mingguan' | 'bulanan'
  const [activeSubTab, setActiveSubTab] = useState<'harian' | 'mingguan' | 'bulanan'>('harian');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Month & Year selection for Bulanan
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  // Week reference date for Mingguan
  const [weekRefDate, setWeekRefDate] = useState<string>(selectedDate || today.toISOString().split('T')[0]);

  // Loading states for export
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isSharingExcel, setIsSharingExcel] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Lightbox for previewing selfie photo with download button
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Computations
  const timeStat = checkApelTimeStatus();
  const summaryHarian = computeAttendanceSummary24(attendanceList, selectedDate);
  const weeklyData = computeWeeklyAttendance24(attendanceList, weekRefDate);
  const monthlyData = computeMonthlyAttendance24(attendanceList, selectedYear, selectedMonth);

  // Daily records list for 24 Kepling with smart fuzzy matching
  const dailyKeplingList = KEPLING_ACCOUNTS.map((acc) => {
    const record = getTodayAbsenForKepling(attendanceList, acc.id, selectedDate);
    const absentStat = calculateAbsentDays(attendanceList, acc.id, selectedDate);
    return { account: acc, record, absentStat };
  });

  // Filtered daily records
  const filteredDailyList = dailyKeplingList.filter(({ account, record }) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      account.nama.toLowerCase().includes(q) ||
      account.lingkungan.toLowerCase().includes(q) ||
      (record?.lokasiGps && record.lokasiGps.toLowerCase().includes(q));

    let matchStatus = true;
    if (statusFilter === 'hadir') matchStatus = record?.status === 'Hadir';
    else if (statusFilter === 'izin') matchStatus = record?.status === 'Izin';
    else if (statusFilter === 'sakit') matchStatus = record?.status === 'Sakit';
    else if (statusFilter === 'dinas_luar') matchStatus = record?.status === 'Dinas Luar';
    else if (statusFilter === 'tidak_apel') {
      matchStatus = !record || record.status === 'Tidak Mengikuti Apel';
    }

    return matchSearch && matchStatus;
  });

  // Handlers for Excel Export & Share
  const handleExport = async (shareMode: boolean = false) => {
    if (shareMode) setIsSharingExcel(true);
    else setIsExportingExcel(true);

    try {
      const res = await exportAbsensiToExcel(attendanceList, activeSubTab, {
        tanggal: selectedDate,
        mingguRefDate: weekRefDate,
        bulan: selectedMonth,
        tahun: selectedYear,
        shareMode,
      });

      if (shareMode && res.method === 'share' && res.success) {
        showToast('Berhasil membuka menu share ke WhatsApp / HP!');
      } else {
        showToast(`File Excel Rekapitulasi ${String(activeSubTab || '').toUpperCase()} berhasil diunduh.`);
      }
    } catch (e) {
      console.error(e);
      alert('Gagal mengekspor laporan: ' + e);
    } finally {
      setIsExportingExcel(false);
      setIsSharingExcel(false);
    }
  };

  const handleDownloadSinglePhoto = async (url: string, title: string) => {
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
    const ok = await downloadImage(url, `Selfie_${safeTitle}.jpg`);
    if (ok) {
      showToast(`Foto selfie ${title} berhasil diunduh.`);
    } else {
      showToast(`Gagal mengunduh foto ${title}.`);
    }
  };

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-60 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Bar: Sub-Tabs & Export Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Sub-Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
          <button
            type="button"
            onClick={() => setActiveSubTab('harian')}
            className={`px-3.5 py-2 rounded-lg font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'harian'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Rekapan Harian</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('mingguan')}
            className={`px-3.5 py-2 rounded-lg font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'mingguan'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Rekapan Mingguan</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('bulanan')}
            className={`px-3.5 py-2 rounded-lg font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'bulanan'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Rekapan Bulanan</span>
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport(true)}
            disabled={isSharingExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
            title="Bagikan laporan Excel ini langsung ke WhatsApp / HP"
          >
            <Send className="w-3.5 h-3.5 text-emerald-200" />
            <span>{isSharingExcel ? 'Menyiapkan...' : 'Share Excel'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport(false)}
            disabled={isExportingExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl font-bold text-xs shadow-2xs transition-all cursor-pointer"
            title="Unduh laporan Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>{isExportingExcel ? 'Mengunduh...' : 'Unduh Excel (.xlsx)'}</span>
          </button>

          <button
            type="button"
            onClick={() => printOfficialDocument('lembar-cetak-rekap-absensi', `REKAP_PRESENSI_APEL_PAGI_${selectedDate}`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
            title="Cetak format cetak resmi (Isolasi 100%)"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cetak</span>
          </button>
        </div>
      </div>

      {/* Kontainer Cetak Resmi Terisolasi */}
      <div id="lembar-cetak-rekap-absensi" className="space-y-4 uppercase">
        {/* Kop Surat Resmi Pemko Medan (Tampak Saat Cetak) */}
        <KopSuratResmi />
        <div className="mt-2 pt-1 border-t border-black text-center">
          <h4 className="font-black text-sm uppercase tracking-wider text-slate-900">
            REKAPITULASI PRESENSI APEL PAGI KEPALA LINGKUNGAN
          </h4>
          <p className="text-xs font-bold text-slate-700">
            {activeSubTab === 'harian' && `Tanggal: ${selectedDate}`}
            {activeSubTab === 'mingguan' && `Periode Minggu Acuan: ${weekRefDate}`}
            {activeSubTab === 'bulanan' && `Bulan ${monthNames[selectedMonth - 1]} ${selectedYear}`}
          </p>
        </div>
        </div>

      {/* ======================= TAB 1: REKAPAN HARIAN ======================= */}
      {activeSubTab === 'harian' && (
        <div className="space-y-4">
          {/* Summary Scorecards Harian */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
              <span className="text-[11px] text-emerald-700 font-bold block uppercase">
                HADIR
              </span>
              <span className="text-2xl font-black text-emerald-950">
                {summaryHarian.totalHadir}
              </span>
              <span className="text-[10px] text-emerald-800 font-semibold block">
                {summaryHarian.percentageHadir}% Presensi
              </span>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-center">
              <span className="text-[11px] text-blue-700 font-bold block uppercase">
                IZIN
              </span>
              <span className="text-2xl font-black text-blue-950">
                {summaryHarian.totalIzin}
              </span>
              <span className="text-[10px] text-blue-800 font-semibold block">Kepling</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
              <span className="text-[11px] text-amber-700 font-bold block uppercase">
                SAKIT
              </span>
              <span className="text-2xl font-black text-amber-950">
                {summaryHarian.totalSakit}
              </span>
              <span className="text-[10px] text-amber-800 font-semibold block">Kepling</span>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 text-center">
              <span className="text-[11px] text-purple-700 font-bold block uppercase">
                DINAS LUAR
              </span>
              <span className="text-2xl font-black text-purple-950">
                {summaryHarian.totalDinasLuar}
              </span>
              <span className="text-[10px] text-purple-800 font-semibold block">Kepling</span>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-center col-span-2 sm:col-span-1">
              <span className="text-[11px] text-rose-700 font-bold block uppercase">
                TIDAK MENGIKUTI APEL
              </span>
              <span className="text-2xl font-black text-rose-950">
                {summaryHarian.totalBelumAbsen}
              </span>
              <span className="text-[10px] text-rose-800 font-semibold block">Kepling</span>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                />
              </div>

              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama / lingkungan..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1 flex-wrap w-full sm:w-auto">
              {[
                { key: 'all', label: 'Semua' },
                { key: 'hadir', label: 'Hadir' },
                { key: 'izin', label: 'Izin' },
                { key: 'sakit', label: 'Sakit' },
                { key: 'dinas_luar', label: 'Dinas Luar' },
                { key: 'tidak_apel', label: 'Tidak Apel' },
              ].map((fl) => (
                <button
                  key={fl.key}
                  type="button"
                  onClick={() => setStatusFilter(fl.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    statusFilter === fl.key
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {fl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid 24 Kepling Status Cards (Harian) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredDailyList.map(({ account, record, absentStat }) => {
              const isAbsent = !record || record.status === 'Tidak Mengikuti Apel';

              return (
                <div
                  key={account.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 relative ${
                    record
                      ? record.status === 'Hadir'
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : record.status === 'Izin'
                        ? 'bg-blue-50/50 border-blue-200'
                        : record.status === 'Sakit'
                        ? 'bg-amber-50/50 border-amber-200'
                        : record.status === 'Dinas Luar'
                        ? 'bg-purple-50/50 border-purple-200'
                        : 'bg-rose-50/50 border-rose-200'
                      : 'bg-rose-50/40 border-rose-200'
                  }`}
                >
                  {/* Avatar Photo */}
                  {record?.fotoSelfieUrl ? (
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewPhoto({
                            url: record.fotoSelfieUrl!,
                            title: `Presensi ${account.lingkungan} - ${account.nama}`,
                            subtitle: `${record.status} • ${record.jam || '-'}`,
                          })
                        }
                        className="w-14 h-14 rounded-xl overflow-hidden border border-slate-300 shadow-xs cursor-pointer group"
                        title="Klik untuk melihat foto selfie"
                      >
                        <img
                          src={record.fotoSelfieUrl}
                          alt={account.nama}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadSinglePhoto(
                            record.fotoSelfieUrl!,
                            `${account.lingkungan}_${account.nama}_${selectedDate}`
                          )
                        }
                        className="absolute -bottom-1 -right-1 p-1 bg-white border border-slate-200 rounded-md shadow-2xs hover:bg-slate-50 text-slate-700 cursor-pointer"
                        title="Download foto selfie ini"
                      >
                        <Download className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 font-black text-sm shrink-0">
                      {account.nomorLingkungan}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-black text-emerald-800 uppercase tracking-tight">
                        {account.lingkungan}
                      </span>
                      {record ? (
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            record.status === 'Hadir'
                              ? 'bg-emerald-700 text-white'
                              : record.status === 'Izin'
                              ? 'bg-blue-700 text-white'
                              : record.status === 'Sakit'
                              ? 'bg-amber-600 text-white'
                              : record.status === 'Dinas Luar'
                              ? 'bg-purple-700 text-white'
                              : 'bg-rose-700 text-white'
                          }`}
                        >
                          {record.status}
                        </span>
                      ) : (
                        <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-md">
                          TIDAK MENGIKUTI APEL
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 truncate mt-0.5">
                      {account.nama}
                    </h4>

                    {record && record.status !== 'Tidak Mengikuti Apel' ? (
                      <div className="mt-1 space-y-0.5 text-[11px] text-slate-600 font-medium">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-700 shrink-0" />
                          <span>{record.jam || '-'}</span>
                        </div>
                        {record.lokasiGps && (
                          <div className="flex items-center gap-1 truncate text-slate-500">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{record.lokasiGps}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-black text-[10px] border border-rose-200">
                          {absentStat.consecutiveDays > 0
                            ? `TIDAK MENGIKUTI APEL PAGI SELAMA ${absentStat.consecutiveDays} HARI`
                            : 'TIDAK MENGIKUTI APEL PAGI'}
                        </span>
                        {absentStat.totalAbsentThisMonth > 0 && (
                          <span className="block text-[10px] text-slate-500 font-semibold">
                            Total bulan ini: {absentStat.totalAbsentThisMonth} hari tidak apel
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================= TAB 2: REKAPAN MINGGUAN ======================= */}
      {activeSubTab === 'mingguan' && (
        <div className="space-y-4">
          {/* Header Periode Minggu */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">
                Periode Rekapitulasi Mingguan
              </span>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                Senin s/d Jumat ({weeklyData.weekLabel})
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Pilih Tanggal Acuan:</span>
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <input
                  type="date"
                  value={weekRefDate}
                  onChange={(e) => setWeekRefDate(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Matrix Table Mingguan (24 Kepling) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-extrabold text-slate-700">
                    <th className="py-3 px-3 w-10 text-center">NO</th>
                    <th className="py-3 px-3">LINGKUNGAN</th>
                    <th className="py-3 px-3">NAMA KEPALA LINGKUNGAN</th>
                    {weeklyData.workDates.map((wd) => (
                      <th key={wd.dateStr} className="py-3 px-2 text-center whitespace-nowrap">
                        <div>{wd.dayName}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{wd.formatted}</div>
                      </th>
                    ))}
                    <th className="py-3 px-2 text-center text-emerald-800">HADIR</th>
                    <th className="py-3 px-2 text-center text-rose-800">TIDAK APEL</th>
                    <th className="py-3 px-2 text-center text-blue-800">IZIN/SKT</th>
                    <th className="py-3 px-2 text-center">% HADIR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {weeklyData.rows.map((row, idx) => (
                    <tr key={row.accountId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-900 sm:whitespace-nowrap print:whitespace-normal">
                        {row.lingkungan}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 sm:whitespace-nowrap print:whitespace-normal">
                        {row.nama}
                      </td>
                      {row.days.map((day) => (
                        <td key={day.dateStr} className="py-2.5 px-2 text-center">
                          {day.status === 'Hadir' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                              ✓ HADIR
                            </span>
                          ) : day.status === 'Tidak Mengikuti Apel' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-black text-[10px]">
                              ✕ TIDAK
                            </span>
                          ) : day.status === 'Izin' || day.status === 'Sakit' || day.status === 'Dinas Luar' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                              {day.status}
                            </span>
                          ) : day.status === 'Belum Absen' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium text-[10px]">
                              Belum
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      ))}
                      <td className="py-2.5 px-2 text-center font-black text-emerald-700">
                        {row.totalHadir}
                      </td>
                      <td className="py-2.5 px-2 text-center font-black text-rose-700">
                        {row.totalTidakApel}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-600">
                        {row.totalIzinSakit}
                      </td>
                      <td className="py-2.5 px-2 text-center font-black text-slate-900">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] ${
                            row.persentase >= 80
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.persentase >= 50
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {row.persentase}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 3: REKAPAN BULANAN ======================= */}
      {activeSubTab === 'bulanan' && (
        <div className="space-y-4">
          {/* Header Periode Bulan */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">
                Periode Rekapitulasi Bulanan
              </span>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                Bulan {monthlyData.monthName} ({monthlyData.totalWorkDays} Hari Kerja Terhitung)
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                {monthNames.map((mn, idx) => (
                  <option key={mn} value={idx + 1}>
                    {mn}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>
          </div>

          {/* Table Bulanan (24 Kepling) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-extrabold text-slate-700">
                    <th className="py-3 px-3 w-10 text-center">NO</th>
                    <th className="py-3 px-3">LINGKUNGAN</th>
                    <th className="py-3 px-3">NAMA KEPALA LINGKUNGAN</th>
                    <th className="py-3 px-2 text-center">HARI KERJA</th>
                    <th className="py-3 px-2 text-center text-emerald-800">HADIR</th>
                    <th className="py-3 px-2 text-center text-blue-800">IZIN</th>
                    <th className="py-3 px-2 text-center text-amber-800">SAKIT</th>
                    <th className="py-3 px-2 text-center text-purple-800">DINAS LUAR</th>
                    <th className="py-3 px-2 text-center text-rose-800">TIDAK APEL</th>
                    <th className="py-3 px-3 text-center text-rose-900">
                      TIDAK APEL (HARI BERTURUT-TURUT)
                    </th>
                    <th className="py-3 px-2 text-center">% HADIR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {monthlyData.rows.map((row, idx) => (
                    <tr key={row.accountId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-900 sm:whitespace-nowrap print:whitespace-normal">
                        {row.lingkungan}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 sm:whitespace-nowrap print:whitespace-normal">
                        {row.nama}
                      </td>
                      <td className="py-2.5 px-2 text-center font-medium text-slate-500">
                        {row.totalHariKerja}
                      </td>
                      <td className="py-2.5 px-2 text-center font-black text-emerald-700">
                        {row.totalHadir}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-blue-700">
                        {row.totalIzin}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-amber-700">
                        {row.totalSakit}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-purple-700">
                        {row.totalDinasLuar}
                      </td>
                      <td className="py-2.5 px-2 text-center font-black text-rose-700">
                        {row.totalTidakApel}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {row.consecutiveAbsentDays > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-extrabold text-[10px] border border-rose-200">
                            {row.consecutiveAbsentDays} Hari Berturut-turut
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">Tertib (0 Hari)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center font-black text-slate-900">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] ${
                            row.persentaseHadir >= 80
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.persentaseHadir >= 50
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {row.persentaseHadir}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Zoom / Lightbox Photo Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl overflow-hidden max-w-md w-full shadow-2xl border border-slate-200 space-y-0">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold">{previewPhoto.title}</h4>
                {previewPhoto.subtitle && (
                  <p className="text-[11px] text-slate-400">{previewPhoto.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-2 flex items-center justify-center">
              <img
                src={previewPhoto.url}
                alt="Preview Selfie"
                className="max-h-[60vh] w-auto object-contain rounded-xl"
              />
            </div>

            <div className="p-4 bg-white flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  handleDownloadSinglePhoto(previewPhoto.url, previewPhoto.title);
                  setPreviewPhoto(null);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Foto Selfie (.JPG)</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
