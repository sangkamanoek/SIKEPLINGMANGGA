import React, { useState, useMemo, useCallback } from 'react';
import {
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Search,
  Printer,
  Copy,
  Check,
  Clock,
  MapPin,
  Camera,
  ShieldCheck,
  AlertTriangle,
  Plus,
  X,
  ChevronRight,
  ChevronLeft,
  Filter,
  Eye,
  Home,
  FileSpreadsheet,
  RefreshCw,
  Phone,
  Sparkles,
  TrendingUp,
  BarChart3,
  Award,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import { LaporanHarianItem, AbsenApelItem, UserAccount, StatusAbsenApel } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import {
  formatTanggalIndonesia,
  getNamaHariIndonesia,
  getTodayLocalIso,
  isReportMatchingDate,
  getReportIsoDate,
  isReportMatchingKepling,
  extractNomorLingkungan,
  isKunjunganMatchingKepling,
  NAMA_BULAN,
} from '../lib/formatter';
import {
  isAttendanceMatchingDate,
  isAttendanceMatchingKepling,
} from '../lib/attendanceApi';
import { printOfficialDocument } from '../utils/printHelper';
import { KopSuratResmi } from './KopSuratResmi';
import { FormKunjunganWarga, KunjunganWargaData } from './FormKunjunganWarga';
import {
  consolidateKunjunganWithReports,
  isKunjunganOnDate,
} from '../lib/kunjunganService';
import { consolidateDailyReport } from '../lib/reportConsolidator';

interface RangkumanLaporanKelurahanProps {
  reports: LaporanHarianItem[];
  attendanceList: AbsenApelItem[];
  kunjunganList: KunjunganWargaData[] | any[];
  currentUser: UserAccount;
  onOpenReportDetail?: (report: LaporanHarianItem) => void;
  onDraftForKepling?: (kepling: UserAccount) => void;
  onOpenAbsenApel?: () => void;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
}

export const RangkumanLaporanKelurahan: React.FC<RangkumanLaporanKelurahanProps> = ({
  reports,
  attendanceList,
  kunjunganList,
  currentUser,
  onOpenReportDetail,
  onDraftForKepling,
  onOpenAbsenApel,
  onRefreshData,
  isRefreshing = false,
}) => {
  // Tanggal yang dipilih (default: hari ini)
  const todayIso = useMemo(() => getTodayLocalIso(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'MELAPOR' | 'NIHIL'>('ALL');
  const [copiedWA, setCopiedWA] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal input kunjungan warga untuk kepling tertentu
  const [kunjunganModalKepling, setKunjunganModalKepling] = useState<UserAccount | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  // Format tanggal terperinci untuk header
  const dateObj = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    } catch {}
    return new Date();
  }, [selectedDate]);

  const hariNama = useMemo(() => getNamaHariIndonesia(dateObj), [dateObj]);
  const tanggalLengkapIndo = useMemo(() => formatTanggalIndonesia(dateObj), [dateObj]);

  // Quick Date Selectors
  const setQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(getTodayLocalIso(d));
  };

  // Mode Tampilan: 'HARIAN' (default) vs 'MINGGUAN' (statistik & tren mingguan)
  const [viewMode, setViewMode] = useState<'HARIAN' | 'MINGGUAN'>('HARIAN');
  const [weeklySearchQuery, setWeeklySearchQuery] = useState<string>('');
  const [weeklyKepatuhanFilter, setWeeklyKepatuhanFilter] = useState<'ALL' | 'DISIPLIN' | 'CUKUP' | 'EVALUASI'>('ALL');

  // Quick Week Navigator
  const setQuickWeek = (offsetWeeks: number) => {
    try {
      const parts = selectedDate.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      d.setDate(d.getDate() + offsetWeeks * 7);
      setSelectedDate(getTodayLocalIso(d));
    } catch {
      setSelectedDate(todayIso);
    }
  };

  // Kalkulasi rentang hari sepekan (Senin s/d Minggu) berdasarkan selectedDate
  const weekInfo = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      const ref = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const day = ref.getDay(); // 0 = Minggu
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(ref);
      monday.setDate(ref.getDate() + diffToMonday);

      const days: { dateStr: string; dayName: string; shortDay: string; formatted: string; isWorkDay: boolean }[] = [];
      const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      const shortDays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayNum = String(d.getDate()).padStart(2, '0');
        const iso = `${y}-${m}-${dayNum}`;
        days.push({
          dateStr: iso,
          dayName: dayNames[i],
          shortDay: shortDays[i],
          formatted: `${d.getDate()} ${NAMA_BULAN[d.getMonth()]?.slice(0, 3)}`,
          isWorkDay: i < 5,
        });
      }

      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const labelHariKerja = `${monday.getDate()} ${NAMA_BULAN[monday.getMonth()]?.slice(0, 3)} - ${friday.getDate()} ${NAMA_BULAN[friday.getMonth()]?.slice(0, 3)} ${friday.getFullYear()}`;
      const labelLengkap = `${monday.getDate()} ${NAMA_BULAN[monday.getMonth()]?.slice(0, 3)} - ${sunday.getDate()} ${NAMA_BULAN[sunday.getMonth()]?.slice(0, 3)} ${sunday.getFullYear()}`;

      return {
        monday,
        friday,
        sunday,
        days,
        workDays: days.slice(0, 5),
        labelHariKerja,
        labelLengkap,
      };
    } catch {
      return {
        monday: new Date(),
        friday: new Date(),
        sunday: new Date(),
        days: [],
        workDays: [],
        labelHariKerja: '',
        labelLengkap: '',
      };
    }
  }, [selectedDate]);

  // 🛡️ Gabungkan data kunjungan mandiri dengan laporan kinerja agar tidak ada data kunjungan yang tertinggal
  const effectiveKunjunganList = useMemo(() => {
    return consolidateKunjunganWithReports(kunjunganList, reports);
  }, [kunjunganList, reports]);

  // Statistik Kunjungan Terpadu (Perlinsos, PBB, IKD, BPJS)
  const kunjunganStats = useMemo(() => {
    const stats = { perlinsos: 0, pbb: 0, ikd: 0, bpjs: 0, total: effectiveKunjunganList.length };
    effectiveKunjunganList.forEach(k => {
      if (k.perlinsos === 'Sudah') stats.perlinsos++;
      if (k.pbb === 'Sudah') stats.pbb++;
      if (k.ikd === 'Sudah') stats.ikd++;
      if (k.bpjsTk === 'Aktif' || k.bpjsTk === 'Sudah Daftar (Agen Perisai)') stats.bpjs++;
    });
    return stats;
  }, [effectiveKunjunganList]);

  // RENDER: Widget Rekap Kunjungan
  const KunjunganSummaryWidget = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {[
        { label: 'Perlinsos', value: kunjunganStats.perlinsos, color: 'text-blue-600' },
        { label: 'PBB', value: kunjunganStats.pbb, color: 'text-emerald-600' },
        { label: 'IKD', value: kunjunganStats.ikd, color: 'text-purple-600' },
        { label: 'BPJS', value: kunjunganStats.bpjs, color: 'text-amber-600' },
      ].map((s) => (
        <div key={s.label} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">{s.label}</p>
          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );

  // Statistik Terpadu Mingguan (Apel, Laporan, Kunjungan, & Sektoral)
  const weeklyStats = useMemo(() => {
    if (!weekInfo.days || weekInfo.days.length === 0) {
      return null;
    }

    const allWeekDates = weekInfo.days.map((d) => d.dateStr);

    // 1. Data per hari dalam sepekan (Senin s/d Minggu)
    const dayBreakdown = weekInfo.days.map((day) => {
      // Absen pada hari ini
      const dayAttendances = attendanceList.filter((a) => isAttendanceMatchingDate(a, day.dateStr));
      // Laporan pada hari ini
      const dayReports = reports.filter((r) => isReportMatchingDate(r, day.dateStr));
      // Kunjungan pada hari ini
      const dayKunjungan = (effectiveKunjunganList || []).filter((k) => isKunjunganOnDate(k, day.dateStr));

      // Hitung apel hadir (termasuk fallback dari laporan harian)
      let hadirApelCount = 0;
      let izinApelCount = 0;
      let nihilApelCount = 0;

      KEPLING_ACCOUNTS.forEach((kepling) => {
        let att = dayAttendances.find((a) => isAttendanceMatchingKepling(a, kepling));
        const rep = dayReports.find((r) => isReportMatchingKepling(r, kepling));
        if (!att && rep?.absenApel?.status) {
          att = { status: rep.absenApel.status as any } as any;
        }

        const st = (att?.status || '').toLowerCase();
        if (st === 'hadir' || st.includes('hadir')) hadirApelCount++;
        else if (
          st === 'izin' ||
          st === 'sakit' ||
          st === 'dinas luar' ||
          st.includes('izin') ||
          st.includes('sakit') ||
          st.includes('dinas')
        )
          izinApelCount++;
        else nihilApelCount++;
      });

      return {
        ...day,
        totalHadirApel: hadirApelCount,
        totalIzinApel: izinApelCount,
        totalNihilApel: nihilApelCount,
        totalLaporan: dayReports.length,
        totalKunjungan: dayKunjungan.length,
        persenApel: Math.round((hadirApelCount / 24) * 100),
        persenLaporan: Math.round((dayReports.length / 24) * 100),
      };
    });

    // 2. Data terakumulasi per Kepling sepanjang pekan (24 Kepling)
    const keplingWeeklyList = KEPLING_ACCOUNTS.map((kepling) => {
      const nomor = kepling.nomorLingkungan || 0;

      // Cek kehadiran apel untuk 5 hari kerja (Senin s/d Jumat)
      const attendancePerDay = weekInfo.workDays.map((day) => {
        const dayAtts = attendanceList.filter((a) => isAttendanceMatchingDate(a, day.dateStr));
        let att = dayAtts.find((a) => isAttendanceMatchingKepling(a, kepling));

        // Cek laporan pada hari ini
        const dayRep = reports.find(
          (r) =>
            isReportMatchingDate(r, day.dateStr) &&
            isReportMatchingKepling(r, kepling)
        );

        if (!att && dayRep?.absenApel?.status) {
          att = {
            status: dayRep.absenApel.status as any,
            jam: dayRep.absenApel.jam,
            catatan: dayRep.absenApel.catatan,
          } as any;
        }

        const st = (att?.status || '').toLowerCase();
        const isHadir = st === 'hadir' || st.includes('hadir');
        const isIzin =
          st === 'izin' ||
          st === 'sakit' ||
          st === 'dinas luar' ||
          st.includes('izin') ||
          st.includes('sakit') ||
          st.includes('dinas');

        return {
          dateStr: day.dateStr,
          dayName: day.dayName,
          shortDay: day.shortDay,
          hasAttended: isHadir,
          isIzin,
          status: att?.status || 'Belum Hadir',
          jam: att?.jam,
          hasReport: Boolean(dayRep),
          report: dayRep,
        };
      });

      const totalHadirApel = attendancePerDay.filter((d) => d.hasAttended).length;
      const totalIzinApel = attendancePerDay.filter((d) => d.isIzin).length;
      const totalTidakApel = 5 - (totalHadirApel + totalIzinApel);
      const persenApel = Math.round((totalHadirApel / 5) * 100);

      // Kumpulan laporan kepling ini dalam sepekan
      const keplingWeekReports = reports.filter(
        (r) =>
          allWeekDates.some((d) => isReportMatchingDate(r, d)) &&
          isReportMatchingKepling(r, kepling)
      );
      const totalLaporan = keplingWeekReports.length;
      const persenLaporan = Math.min(100, Math.round((totalLaporan / 5) * 100));

      // Kunjungan warga kepling ini dalam sepekan
      const keplingWeekKunjungan = (effectiveKunjunganList || []).filter((k) => {
        if (!k) return false;
        const inDate = allWeekDates.some((d) => isKunjunganOnDate(k, d));
        if (!inDate) return false;
        return isKunjunganMatchingKepling(k, kepling);
      });

      // Akumulasi indikator sektoral sepekan
      let pbbWp = 0;
      let perlinsosKk = 0;
      let ikdOrang = 0;
      let bpjsOrang = 0;

      keplingWeekReports.forEach((r) => {
        const k: any = r.kinerja || {};
        pbbWp += parseInt(String(k.opsirPbbWp || 0), 10) || 0;
        perlinsosKk += parseInt(String(k.perlinsosKk || 0), 10) || 0;
        ikdOrang += parseInt(String(k.ikdOrang || 0), 10) || 0;
        bpjsOrang += parseInt(String(k.bpjsKetenagakerjaanOrang || 0), 10) || 0;
      });

      // Status Disiplin Mingguan
      let predikat: 'SANGAT_DISIPLIN' | 'BAIK' | 'PERLU_PEMBINAAN' = 'BAIK';
      if (persenApel >= 80 && persenLaporan >= 80) {
        predikat = 'SANGAT_DISIPLIN';
      } else if (persenApel < 60 || persenLaporan < 60) {
        predikat = 'PERLU_PEMBINAAN';
      }

      return {
        kepling,
        nomor,
        attendancePerDay,
        totalHadirApel,
        totalIzinApel,
        totalTidakApel,
        persenApel,
        totalLaporan,
        persenLaporan,
        totalKunjungan: keplingWeekKunjungan.length,
        pbbWp,
        perlinsosKk,
        ikdOrang,
        bpjsOrang,
        predikat,
      };
    });

    // 3. Ringkasan Kelurahan Sepekan
    const totalTargetApel = 24 * 5; // 120 target hadir apel sepekan
    const totalTargetLaporan = 24 * 5; // 120 target laporan sepekan
    const totalHadirApelKelurahan = keplingWeeklyList.reduce((acc, k) => acc + k.totalHadirApel, 0);
    const totalIzinApelKelurahan = keplingWeeklyList.reduce((acc, k) => acc + k.totalIzinApel, 0);
    const totalTidakApelKelurahan = totalTargetApel - (totalHadirApelKelurahan + totalIzinApelKelurahan);
    const persenKehadiranApel = Math.round((totalHadirApelKelurahan / totalTargetApel) * 100);

    const totalLaporanMasuk = keplingWeeklyList.reduce((acc, k) => acc + k.totalLaporan, 0);
    const persenLaporanMasuk = Math.round((totalLaporanMasuk / totalTargetLaporan) * 100);

    const totalKunjunganWarga = kunjunganList.length;
    const totalKeplingAktifKunjungan = keplingWeeklyList.filter((k) => k.totalKunjungan > 0).length;

    const totalPbbWp = keplingWeeklyList.reduce((acc, k) => acc + k.pbbWp, 0);
    const totalPerlinsosKk = keplingWeeklyList.reduce((acc, k) => acc + k.perlinsosKk, 0);
    const totalIkdOrang = keplingWeeklyList.reduce((acc, k) => acc + k.ikdOrang, 0);
    const totalBpjsOrang = keplingWeeklyList.reduce((acc, k) => acc + k.bpjsOrang, 0);

    // Top Performers
    const topKunjungan = [...keplingWeeklyList].sort((a, b) => b.totalKunjungan - a.totalKunjungan).slice(0, 3);
    const topPbb = [...keplingWeeklyList].sort((a, b) => b.pbbWp - a.pbbWp).slice(0, 3);
    const topPerlinsos = [...keplingWeeklyList].sort((a, b) => b.perlinsosKk - a.perlinsosKk).slice(0, 3);
    const topDisiplin = keplingWeeklyList.filter((k) => k.predikat === 'SANGAT_DISIPLIN');
    const perluPembinaan = keplingWeeklyList.filter((k) => k.predikat === 'PERLU_PEMBINAAN');

    return {
      weekInfo,
      dayBreakdown,
      keplingWeeklyList,
      totalTargetApel,
      totalHadirApelKelurahan,
      totalIzinApelKelurahan,
      totalTidakApelKelurahan,
      persenKehadiranApel,
      totalTargetLaporan,
      totalLaporanMasuk,
      persenLaporanMasuk,
      totalKunjunganWarga,
      totalKeplingAktifKunjungan,
      totalPbbWp,
      totalPerlinsosKk,
      totalIkdOrang,
      totalBpjsOrang,
      topKunjungan,
      topPbb,
      topPerlinsos,
      topDisiplin,
      perluPembinaan,
    };
  }, [weekInfo, attendanceList, reports, kunjunganList]);

  // Filter Kepling List Mingguan Berdasarkan Search & Filter Kepatuhan
  const filteredWeeklyKeplingList = useMemo(() => {
    if (!weeklyStats) return [];
    return weeklyStats.keplingWeeklyList.filter((item) => {
      if (weeklyKepatuhanFilter === 'DISIPLIN' && item.predikat !== 'SANGAT_DISIPLIN') return false;
      if (weeklyKepatuhanFilter === 'CUKUP' && item.predikat !== 'BAIK') return false;
      if (weeklyKepatuhanFilter === 'EVALUASI' && item.predikat !== 'PERLU_PEMBINAAN') return false;

      if (weeklySearchQuery.trim()) {
        const q = weeklySearchQuery.toLowerCase();
        const matchNama = item.kepling.nama.toLowerCase().includes(q);
        const matchLingkungan = item.kepling.lingkungan.toLowerCase().includes(q);
        const matchNomor = String(item.nomor).includes(q);
        return matchNama || matchLingkungan || matchNomor;
      }
      return true;
    });
  }, [weeklyStats, weeklyKepatuhanFilter, weeklySearchQuery]);

  // 1. Filter Absensi Apel Pagi pada selectedDate dengan matcher fleksibel
  const attendanceOnDate = useMemo(() => {
    return attendanceList.filter((item) => {
      if (!item) return false;
      return isAttendanceMatchingDate(item, selectedDate);
    });
  }, [attendanceList, selectedDate]);

  // 2. Filter Laporan Kinerja pada selectedDate
  const reportsOnDate = useMemo(() => {
    return reports.filter((r) => isReportMatchingDate(r, selectedDate));
  }, [reports, selectedDate]);

  // 3. Filter Kunjungan Warga pada selectedDate
  const kunjunganOnDate = useMemo(() => {
    return (effectiveKunjunganList || []).filter((k) => isKunjunganOnDate(k, selectedDate));
  }, [effectiveKunjunganList, selectedDate]);

  // Konsolidasi Data per Kepling (1 sampai 24)
  const consolidatedKeplingData = useMemo(() => {
    return KEPLING_ACCOUNTS.map((kepling) => {
      const nomor = kepling.nomorLingkungan || 0;

      // Cari dan otomatis gabungkan seluruh laporan kinerja Kepling pada tanggal ini
      const matchingReports = reportsOnDate.filter((r) => isReportMatchingKepling(r, kepling));
      const laporan = matchingReports.length > 0
        ? matchingReports.reduce((acc, curr) => consolidateDailyReport(acc, curr))
        : undefined;

      // Cari Presensi Apel di attendanceList dengan pencocokan fuzzy (ID, nomor, lingkungan, nama)
      let absen = attendanceOnDate.find((a) => isAttendanceMatchingKepling(a, kepling));

      // 🛡️ FALLBACK UTAMA: Jika belum ada entri mandiri di attendanceList, namun Kepling
      // sudah mengirimkan laporan harian (yang di dalamnya memuat presensi apel pagi),
      // otomatis gunakan data presensi apel dari laporan tersebut agar tidak pernah hilang / false NIHIL!
      if (!absen && laporan?.absenApel && laporan.absenApel.status) {
        absen = {
          id: `absen_report_${kepling.id}_${selectedDate}`,
          accountId: kepling.id,
          namaKepling: laporan.namaKepling || kepling.nama,
          lingkungan: kepling.lingkungan,
          nomorLingkungan: nomor,
          tanggal: selectedDate,
          jam: laporan.absenApel.jam || '07:35 WIB',
          waktuLengkap: laporan.absenApel.waktuLengkap || laporan.createdAt || new Date().toISOString(),
          status: (laporan.absenApel.status as StatusAbsenApel) || 'Hadir',
          fotoSelfieUrl: laporan.absenApel.fotoSelfieUrl || '',
          lokasiGps: laporan.absenApel.lokasiGps || 'Halaman Kantor Kelurahan Mangga (GPS)',
          catatan: laporan.absenApel.catatan || '',
          createdAt: laporan.createdAt || new Date().toISOString(),
          updatedAt: laporan.createdAt || new Date().toISOString(),
        };
      }

      // Cari Kunjungan Warga
      let kunjungan = kunjunganOnDate.filter((k) => isKunjunganMatchingKepling(k, kepling));

      // 🛡️ FALLBACK KUNJUNGAN: Jika belum ada entri kunjungan mandiri tetapi ada laporan kinerja dengan kunjungan/perlinsos
      if (kunjungan.length === 0 && laporan?.kinerja) {
        const kin = laporan.kinerja;
        const count = parseInt(String(kin.perlinsosKk || '0'), 10);
        const countMenolak = parseInt(String(kin.perlinsosMenolakKk || '0'), 10);
        if (count > 0 || countMenolak > 0 || (kin.perlinsosKeterangan && kin.perlinsosKeterangan !== 'Pendataan Perlinsos')) {
          kunjungan = [
            {
              id: `synced_kunj_${kepling.id}_${selectedDate}`,
              tanggal: selectedDate,
              namaWarga: kin.perlinsosKeterangan ? kin.perlinsosKeterangan.replace(/Kunjungan\s*(warga)?\s*[:,-]?\s*/i, '').split(',')[0].trim() || `Warga ${kepling.lingkungan}` : `Warga ${kepling.lingkungan}`,
              alamat: `Wilayah ${kepling.lingkungan}`,
              lingkungan: kepling.lingkungan,
              lingkunganNomor: nomor,
              namaKepling: kepling.nama,
              keplingId: kepling.id,
              perlinsos: count > 0 ? 'Sudah' : 'Menolak',
              ikd: parseInt(String(kin.ikdOrang || '0'), 10) > 0 ? 'Sudah' : 'Belum',
              pbb: parseInt(String(kin.opsirPbbWp || '0'), 10) > 0 ? 'Sudah' : 'Belum',
              keterangan: kin.perlinsosKeterangan || 'Kunjungan Sambang Warga',
              createdAt: laporan.createdAt || new Date().toISOString(),
            } as any,
          ];
        }
      }

      const statusLower = (absen?.status || '').toLowerCase().trim();
      const isApelHadir = Boolean(absen && (statusLower === 'hadir' || statusLower.includes('hadir')));
      const isApelIzinSakitDinas = Boolean(
        absen &&
        (statusLower === 'izin' ||
          statusLower === 'sakit' ||
          statusLower === 'dinas luar' ||
          statusLower.includes('izin') ||
          statusLower.includes('sakit') ||
          statusLower.includes('dinas'))
      );
      const isApelNihil = !absen || statusLower.includes('tidak');
      const isMelapor = Boolean(laporan);

      return {
        kepling,
        nomor,
        absen,
        isApelHadir,
        isApelIzinSakitDinas,
        isApelNihil,
        laporan,
        isMelapor,
        kunjungan: Array.isArray(kunjungan) ? kunjungan : [],
      };
    });
  }, [attendanceOnDate, reportsOnDate, kunjunganOnDate, selectedDate]);

  // Filter Kepling Berdasarkan Status & Search
  const filteredKeplingList = useMemo(() => {
    return consolidatedKeplingData.filter((item) => {
      // Filter status laporan
      if (filterStatus === 'MELAPOR' && !item.isMelapor) return false;
      if (filterStatus === 'NIHIL' && item.isMelapor) return false;

      // Filter search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNama = item.kepling.nama.toLowerCase().includes(q);
        const matchLingkungan = item.kepling.lingkungan.toLowerCase().includes(q);
        const matchNomor = String(item.nomor).includes(q);
        const matchWarga = (item.kunjungan || []).some(
          (k) =>
            (k.namaWarga && k.namaWarga.toLowerCase().includes(q)) ||
            (k.alamat && k.alamat.toLowerCase().includes(q))
        );
        return matchNama || matchLingkungan || matchNomor || matchWarga;
      }
      return true;
    });
  }, [consolidatedKeplingData, filterStatus, searchQuery]);

  // Daftar Kepling Hadir Apel, Izin/Sakit/DL, & Tidak Hadir Apel
  const keplingHadirApel = useMemo(
    () => consolidatedKeplingData.filter((item) => item.isApelHadir),
    [consolidatedKeplingData]
  );
  const keplingIzinSakitDinas = useMemo(
    () => consolidatedKeplingData.filter((item) => item.isApelIzinSakitDinas),
    [consolidatedKeplingData]
  );
  const keplingTidakApel = useMemo(
    () => consolidatedKeplingData.filter((item) => item.isApelNihil),
    [consolidatedKeplingData]
  );

  // Akumulasi Total Kelurahan
  const totalStats = useMemo(() => {
    let totalPbbWp = 0;
    let totalPerlinsosKk = 0;
    let totalPerlinsosMenolak = 0;
    let totalPerlinsosTidakDiTempat = 0;
    let totalIkdOrang = 0;
    let totalBpjsOrang = 0;
    let totalPoskamlingAktif = 0;
    let totalInfrastrukturTemuan = 0;
    let totalKunjunganWarga = 0;

    consolidatedKeplingData.forEach((item) => {
      if (item.laporan) {
        const k: any = item.laporan.kinerja || {};
        totalPbbWp += parseInt(String(k.opsirPbbWp || 0), 10) || 0;
        totalPerlinsosKk += parseInt(String(k.perlinsosKk || 0), 10) || 0;
        totalPerlinsosMenolak += parseInt(String(k.perlinsosMenolakKk || 0), 10) || 0;
        totalPerlinsosTidakDiTempat += parseInt(String(k.perlinsosTidakDiTempatKk || 0), 10) || 0;
        totalIkdOrang += parseInt(String(k.ikdOrang || 0), 10) || 0;
        totalBpjsOrang += parseInt(String(k.bpjsKetenagakerjaanOrang || 0), 10) || 0;
        if (k.poskamlingStatus && k.poskamlingStatus !== 'Tidak Ada Giat') {
          totalPoskamlingAktif += 1;
        }
        if (k.infrastrukturAdaGiat || k.infrastrukturSubjek) {
          totalInfrastrukturTemuan += 1;
        }
      }
      totalKunjunganWarga += (item.kunjungan || []).length;
    });

    const totalMelapor = consolidatedKeplingData.filter((k) => k.isMelapor).length;
    const totalNihil = consolidatedKeplingData.length - totalMelapor;
    const totalHadirApel = keplingHadirApel.length;
    const totalIzinSakitDinas = keplingIzinSakitDinas.length;
    const totalTidakApel = keplingTidakApel.length;

    return {
      totalMelapor,
      totalNihil,
      totalHadirApel,
      totalIzinSakitDinas,
      totalTidakApel,
      totalPbbWp,
      totalPerlinsosKk,
      totalPerlinsosMenolak,
      totalPerlinsosTidakDiTempat,
      totalIkdOrang,
      totalBpjsOrang,
      totalPoskamlingAktif,
      totalInfrastrukturTemuan,
      totalKunjunganWarga,
    };
  }, [consolidatedKeplingData, keplingHadirApel, keplingIzinSakitDinas, keplingTidakApel]);

  // Generator Salin Format WhatsApp Rangkuman Kelurahan
  const handleCopyWhatsApp = () => {
    const lines: string[] = [];

    lines.push('*🟩 LAPORAN HARIAN KELURAHAN MANGGA*');
    lines.push('*KECAMATAN MEDAN TUNTUNGAN - KOTA MEDAN*');
    lines.push(`📅 Hari      : ${hariNama}`);
    lines.push(`📆 Tanggal   : ${tanggalLengkapIndo}`);
    lines.push('────────────────────────────');
    lines.push('');

    // I. PRESENSI APEL PAGI
    lines.push(`*I. PRESENSI APEL PAGI (24 KEPALA LINGKUNGAN)*`);
    lines.push(`🟢 *Hadir Apel (${totalStats.totalHadirApel} Kepling):*`);
    if (keplingHadirApel.length > 0) {
      keplingHadirApel.forEach((it, idx) => {
        const jamStr = it.absen?.jam ? ` (${it.absen.jam})` : '';
        lines.push(`   ${idx + 1}. ${it.kepling.lingkungan} - ${it.kepling.nama}${jamStr}`);
      });
    } else {
      lines.push(`   - NIHIL (Tidak ada kehadiran apel tercatat)`);
    }

    if (totalStats.totalIzinSakitDinas > 0) {
      lines.push('');
      lines.push(`🟡 *Izin / Sakit / Dinas Luar (${totalStats.totalIzinSakitDinas} Kepling):*`);
      keplingIzinSakitDinas.forEach((it, idx) => {
        const statusLabel = it.absen?.status || 'Izin';
        const ketStr = it.absen?.catatan ? ` [${it.absen.catatan}]` : '';
        lines.push(`   ${idx + 1}. ${it.kepling.lingkungan} - ${it.kepling.nama} (${statusLabel})${ketStr}`);
      });
    }

    lines.push('');
    lines.push(`🔴 *Tidak Hadir Apel / NIHIL (${totalStats.totalTidakApel} Kepling):*`);
    if (keplingTidakApel.length > 0) {
      keplingTidakApel.forEach((it, idx) => {
        const ket = it.absen?.catatan ? ` [${it.absen.catatan}]` : ' [NIHIL / Belum Hadir]';
        lines.push(`   ${idx + 1}. ${it.kepling.lingkungan} - ${it.kepling.nama}${ket}`);
      });
    } else {
      lines.push(`   - NIHIL (Seluruh Kepling Telah Hadir/Tercatat)`);
    }

    lines.push('');
    lines.push('────────────────────────────');
    
    // TOTAL KUNJUNGAN PER LINGKUNGAN
    lines.push(`*TOTAL KUNJUNGAN WARGA PER LINGKUNGAN:*`);
    lines.push(``);
    consolidatedKeplingData.forEach((it) => {
      if (it.kunjungan.length > 0) {
        lines.push(`*${it.kepling.lingkungan}*`);
        lines.push(`Total Kunjungan : ${it.kunjungan.length} Warga`);
        lines.push(`Rincian :`);
        it.kunjungan.forEach((w) => {
          lines.push(`- ${w.namaWarga} (${w.alamat || '-'})`);
        });
        lines.push(``); // Add a space for readability
      }
    });
    lines.push('────────────────────────────');
    lines.push('');

    // II. RANGKUMAN LAPORAN KINERJA & KUNJUNGAN WARGA 24 LINGKUNGAN
    lines.push(`*II. RANGKUMAN LAPORAN KINERJA & KUNJUNGAN WARGA (24 LINGKUNGAN)*`);
    lines.push('');

    consolidatedKeplingData.forEach((it) => {
      lines.push(`*📍 ${String(it.kepling.lingkungan || '').toUpperCase()} - ${it.kepling.nama || ''}*`);

      // Status Apel
      if (it.isApelHadir) {
        lines.push(`   • Apel Pagi: Hadir${it.absen?.jam ? ` (${it.absen.jam})` : ''}`);
      } else if (it.isApelIzinSakitDinas) {
        lines.push(`   • Apel Pagi: ${it.absen?.status || 'Izin'}${it.absen?.catatan ? ` [${it.absen.catatan}]` : ''}`);
      } else {
        lines.push(`   • Apel Pagi: *NIHIL (Belum Hadir)*`);
      }

      // Kinerja Harian
      if (it.laporan) {
        const kin: any = it.laporan.kinerja || {};
        const pbbStr = kin.opsirPbbWp ? `${kin.opsirPbbWp} WP` : 'NIHIL';
        const pbbKet = kin.opsirPbbKeterangan ? ` (${kin.opsirPbbKeterangan})` : '';
        lines.push(`   • PBB: ${pbbStr}${pbbKet}`);

        const perlinsosStr = kin.perlinsosKk ? `${kin.perlinsosKk} KK` : 'NIHIL';
        const perlinsosKet = kin.perlinsosKeterangan ? ` (${kin.perlinsosKeterangan})` : '';
        let pTxt = `   • Perlinsos: ${perlinsosStr}${perlinsosKet}`;
        if (kin.perlinsosMenolakKk && String(kin.perlinsosMenolakKk) !== '0') {
          pTxt += ` [Menolak: ${kin.perlinsosMenolakKk} KK]`;
        }
        if (kin.perlinsosTidakDiTempatKk && String(kin.perlinsosTidakDiTempatKk) !== '0') {
          pTxt += ` [Tidak di Tempat: ${kin.perlinsosTidakDiTempatKk} KK]`;
        }
        lines.push(pTxt);

        const ikdStr = kin.ikdOrang ? `${kin.ikdOrang} Orang` : 'NIHIL';
        lines.push(`   • IKD Dukcapil: ${ikdStr}`);

        const bpjsStr = kin.bpjsKetenagakerjaanOrang ? `${kin.bpjsKetenagakerjaanOrang} Orang` : 'NIHIL';
        lines.push(`   • BPJS Naker: ${bpjsStr}`);

        if (kin.poskamlingStatus && kin.poskamlingStatus !== 'Tidak Ada Giat') {
          lines.push(`   • Poskamling: ${kin.poskamlingStatus}${kin.poskamlingLokasi ? ` di ${kin.poskamlingLokasi}` : ''}`);
        } else {
          lines.push(`   • Poskamling: NIHIL`);
        }

        if (kin.infrastrukturAdaGiat || kin.infrastrukturSubjek) {
          lines.push(`   • Infrastruktur: ${kin.infrastrukturSubjek}${kin.infrastrukturLokasi ? ` (${kin.infrastrukturLokasi})` : ''}`);
        }
      } else {
        lines.push(`   • Laporan Kinerja: *NIHIL (Belum Melapor)*`);
        lines.push(`   • PBB: NIHIL | Perlinsos: NIHIL | IKD: NIHIL | BPJS: NIHIL`);
      }

      // Kunjungan Warga
      if (it.kunjungan.length > 0) {
        const wargaNames = it.kunjungan
          .slice(0, 4)
          .map((w, idx) => `${idx + 1}. ${w.namaWarga} (${w.alamat || '-'})`)
          .join(', ');
        const extraCount = it.kunjungan.length > 4 ? ` dan ${it.kunjungan.length - 4} warga lainnya` : '';
        lines.push(`   • Kunjungan Warga: *${it.kunjungan.length} Warga* [${wargaNames}${extraCount}]`);
      } else {
        lines.push(`   • Kunjungan Warga: *NIHIL*`);
      }

      lines.push('');
    });

    lines.push('────────────────────────────');

    // III. TOTAL REKAPITULASI KELURAHAN
    lines.push(`*III. TOTAL REKAPITULASI KELURAHAN MANGGA*`);
    lines.push(`👥 Kepling Hadir Apel  : ${totalStats.totalHadirApel} / 24`);
    if (totalStats.totalIzinSakitDinas > 0) {
      lines.push(`🟡 Kepling Izin/Sakit/DL: ${totalStats.totalIzinSakitDinas} / 24`);
    }
    lines.push(`⚠️ Kepling Tidak Apel   : ${totalStats.totalTidakApel} / 24 (NIHIL)`);
    lines.push(`📑 Kepling Melapor      : ${totalStats.totalMelapor} / 24`);
    lines.push(`❌ Kepling NIHIL        : ${totalStats.totalNihil} / 24`);
    lines.push(`🏠 Total Kunjungan Warga: ${totalStats.totalKunjunganWarga} Warga`);
    lines.push(`🧾 Realisasi PBB        : ${totalStats.totalPbbWp} WP`);
    lines.push(`📋 Realisasi Perlinsos  : ${totalStats.totalPerlinsosKk} KK`);
    if (totalStats.totalPerlinsosMenolak > 0) {
      lines.push(`   - Warga Menolak     : ${totalStats.totalPerlinsosMenolak} KK`);
    }
    if (totalStats.totalPerlinsosTidakDiTempat > 0) {
      lines.push(`   - Tidak di Tempat   : ${totalStats.totalPerlinsosTidakDiTempat} KK`);
    }
    lines.push(`📱 Aktivasi IKD         : ${totalStats.totalIkdOrang} Orang`);
    lines.push(`🛡️ BPJS Ketenagakerjaan : ${totalStats.totalBpjsOrang} Orang`);
    lines.push(`🚨 Poskamling Aktif     : ${totalStats.totalPoskamlingAktif} Titik`);
    lines.push('');
    lines.push('#MedanUntukSemua');
    lines.push('#SemuaUntukMedan');

    const fullText = lines.join('\n');
    navigator.clipboard
      .writeText(fullText)
      .then(() => {
        setCopiedWA(true);
        showToast('Format WhatsApp Rangkuman Kelurahan berhasil disalin ke clipboard!');
        setTimeout(() => setCopiedWA(false), 3000);
      })
      .catch(() => {
        showToast('Gagal menyalin format WhatsApp');
      });
  };

  /**
   * REKAP KUNJUNGAN HARIAN DOOR-TO-DOOR (Spesifik permintaan user)
   */
  const [copiedKunjunganWA, setCopiedKunjunganWA] = useState(false);
  const handleCopyKunjunganRecapWA = () => {
    const lines: string[] = [];
    const dateLabel = selectedDate === todayIso ? `Hari Ini (${selectedDate})` : selectedDate;

    lines.push(`*REKAP KUNJUNGAN HARIAN DOOR-TO-DOOR*`);
    lines.push(`*KELURAHAN MANGGA, KEC. MEDAN TUNTUNGAN*`);
    lines.push(`Periode / Tanggal: ${dateLabel}`);
    lines.push(`Total Kunjungan: ${totalStats.totalKunjunganWarga} Rumah`);
    lines.push(``);
    lines.push(`----------------------------------------`);

    // Detail Per Lingkungan Hari Ini
    consolidatedKeplingData.forEach((it) => {
      if (it.kunjungan.length > 0) {
        lines.push(`*${it.kepling.lingkungan}*`);
        lines.push(`Total Kunjungan : ${it.kunjungan.length} Warga`);
        lines.push(`Rincian :`);
        it.kunjungan.forEach((w) => {
          lines.push(`- ${w.namaWarga.toUpperCase()} (${(w.alamat || '-').toUpperCase()})`);
        });
        lines.push(``);
      }
    });

    // Kalkulasi Kumulatif (Sampai Dengan Hari Ini)
    lines.push(`*TOTAL KUNJUNGAN PER LINGKUNGAN SAMPAI DENGAN HARI INI:*`);
    
    // Use unique environments from official KEPLING_ACCOUNTS data
    const envs = Array.from(new Set(KEPLING_ACCOUNTS.map(u => u.lingkungan))).sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
        return numA - numB;
    });

    const allVisits = kunjunganList || [];
    envs.forEach((env) => {
      const count = allVisits.filter(v => v.lingkungan === env).length;
      lines.push(`- ${env}: ${count} Warga`);
    });

    lines.push(``);
    lines.push(`*TOTAL SELURUH KUNJUNGAN: ${allVisits.length} Warga*`);
    lines.push(``);
    lines.push(`#MedanUntukSemua`);
    lines.push(`#SemuaUntukMedan`);

    const fullText = lines.join('\n');
    navigator.clipboard
      .writeText(fullText)
      .then(() => {
        setCopiedKunjunganWA(true);
        showToast('Rekap Kunjungan WA berhasil disalin!');
        setTimeout(() => setCopiedKunjunganWA(false), 3000);
      })
      .catch(() => {
        showToast('Gagal menyalin format kunjungan');
      });
  };

  // Salin Format WhatsApp Khusus Tren & Statistik Mingguan
  const handleCopyWeeklyWhatsApp = () => {
    if (!weeklyStats) return;
    const lines: string[] = [];
    lines.push(`*📊 LAPORAN TREN & STATISTIK KINERJA MINGGUAN KELURAHAN MANGGA*`);
    lines.push(`*Kecamatan Medan Tuntungan - Kota Medan*`);
    lines.push(`Periode: *${weeklyStats.weekInfo.labelLengkap}*`);
    lines.push('────────────────────────────');
    lines.push('');
    lines.push(`*I. RINGKASAN INDIKATOR UTAMA SEPEKAN:*`);
    lines.push(`• Total Kunjungan Warga : *${weeklyStats.totalKunjunganWarga} Warga* (${weeklyStats.totalKeplingAktifKunjungan}/24 Kepling aktif)`);
    lines.push(`• Total Laporan Masuk   : *${weeklyStats.totalLaporanMasuk} / ${weeklyStats.totalTargetLaporan} Laporan* (${weeklyStats.persenLaporanMasuk}%)`);
    lines.push(`• Kehadiran Apel Pagi   : *${weeklyStats.persenKehadiranApel}%* (Hadir: ${weeklyStats.totalHadirApelKelurahan}, Izin/DL: ${weeklyStats.totalIzinApelKelurahan}, Nihil: ${weeklyStats.totalTidakApelKelurahan})`);
    lines.push(`• Capaian Sektoral:`);
    lines.push(`  - Opsir PBB            : ${weeklyStats.totalPbbWp} WP`);
    lines.push(`  - Perlinsos            : ${weeklyStats.totalPerlinsosKk} KK`);
    lines.push(`  - IKD Dukcapil         : ${weeklyStats.totalIkdOrang} Orang`);
    lines.push(`  - BPJS Ketenagakerjaan : ${weeklyStats.totalBpjsOrang} Orang`);
    lines.push('');
    lines.push(`*II. TREN HARIAN (SENIN - MINGGU):*`);
    weeklyStats.dayBreakdown.forEach((d) => {
      lines.push(`• ${d.dayName}, ${d.formatted}: Apel ${d.totalHadirApel}/24 (${d.persenApel}%) | Laporan ${d.totalLaporan}/24 | Kunjungan ${d.totalKunjungan} Warga`);
    });
    lines.push('');
    lines.push(`*III. TOP 3 KEPLING TERAKTIF KUNJUNGAN:*`);
    weeklyStats.topKunjungan.forEach((k, idx) => {
      lines.push(`  ${idx + 1}. ${k.kepling.lingkungan} - ${k.kepling.nama}: *${k.totalKunjungan} Warga*`);
    });
    lines.push('');
    lines.push(`*IV. STATUS KEPATUHAN & DISIPLIN (24 KEPLING):*`);
    lines.push(`• Sangat Disiplin (≥80%): ${weeklyStats.topDisiplin.length} Kepling`);
    lines.push(`• Perlu Pembinaan (<60%): ${weeklyStats.perluPembinaan.length} Kepling`);
    if (weeklyStats.perluPembinaan.length > 0) {
      const listNama = weeklyStats.perluPembinaan.map((k) => `${k.kepling.lingkungan} (${k.kepling.nama})`).join(', ');
      lines.push(`  (Catatan untuk evaluasi: ${listNama})`);
    }
    lines.push('');
    lines.push(`Demikian ringkasan tren statistik mingguan kinerja Kelurahan Mangga untuk bahan evaluasi kepemimpinan.`);
    lines.push('#MedanUntukSemua');
    lines.push('#SemuaUntukMedan');

    const fullText = lines.join('\n');
    navigator.clipboard
      .writeText(fullText)
      .then(() => {
        setCopiedWA(true);
        showToast('Format WhatsApp Statistik Mingguan berhasil disalin ke clipboard!');
        setTimeout(() => setCopiedWA(false), 3000);
      })
      .catch(() => {
        showToast('Gagal menyalin format WhatsApp');
      });
  };

  // Cetak Dokumen Resmi PDF
  const handlePrintDocument = () => {
    if (viewMode === 'MINGGUAN') {
      printOfficialDocument(
        'rangkuman-mingguan-kelurahan-print-view',
        `Rangkuman_Mingguan_Kelurahan_Mangga_${weekInfo.workDays[0]?.dateStr || selectedDate}`
      );
    } else {
      printOfficialDocument(
        'rangkuman-kelurahan-print-view',
        `Rangkuman_Laporan_Kelurahan_Mangga_${selectedDate}`
      );
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-xs font-semibold">{toastMsg}</p>
        </div>
      )}

      {/* Header Utama Banner Rangkuman */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-200 text-xs font-bold uppercase tracking-wider mb-2 border border-emerald-400/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              Konsolidasi Terpadu Super Admin
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Rangkuman Laporan Kelurahan (24 Kepling)
            </h1>
            <p className="text-white/95 font-medium text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Rangkuman seluruh laporan kinerja harian 24 Kepala Lingkungan, presensi apel pagi, dan kegiatan kunjungan sambang warga. Bagi kepling yang tidak melapor ditampilkan berstatus <strong>NIHIL</strong> secara transparan.
            </p>
          </div>

          {/* Action Buttons Top */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="btn-salin-wa-rangkuman"
              type="button"
              onClick={viewMode === 'MINGGUAN' ? handleCopyWeeklyWhatsApp : handleCopyWhatsApp}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer ${
                copiedWA
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950 hover:text-black font-extrabold'
              }`}
              title={viewMode === 'MINGGUAN' ? 'Salin Rangkuman Mingguan WhatsApp' : 'Salin Rangkuman Lengkap Siap Kirim WhatsApp'}
            >
              {copiedWA ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>
                {copiedWA
                  ? 'Format WA Disalin!'
                  : viewMode === 'MINGGUAN'
                  ? 'Salin Format WA Mingguan'
                  : 'Salin Format WhatsApp'}
              </span>
            </button>

            {viewMode === 'HARIAN' && (
              <button
                id="btn-salin-wa-kunjungan"
                type="button"
                onClick={handleCopyKunjunganRecapWA}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer ${
                  copiedKunjunganWA
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-amber-950 hover:text-black font-extrabold'
                }`}
                title="Salin Rekap Kunjungan Warga (Harian + Kumulatif)"
              >
                {copiedKunjunganWA ? <Check className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                <span>
                  {copiedKunjunganWA ? 'Rekap Kunjungan Disalin!' : 'Salin Rekap Kunjungan'}
                </span>
              </button>
            )}

            <button
              id="btn-cetak-rangkuman"
              type="button"
              onClick={handlePrintDocument}
              className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm border border-white/20 cursor-pointer shadow-sm active:scale-95"
              title="Cetak Rangkuman Resmi / Simpan PDF"
            >
              <Printer className="w-4 h-4 text-emerald-300" />
              <span>Cetak / PDF</span>
            </button>

            {onRefreshData && (
              <button
                type="button"
                onClick={onRefreshData}
                disabled={isRefreshing}
                className="p-2.5 rounded-xl font-bold text-xs flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all border border-white/20 cursor-pointer disabled:opacity-50"
                title="Refresh Data Terbaru"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-300' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>

      {viewMode === 'HARIAN' && <KunjunganSummaryWidget />}

      {/* Mode Switcher Tabs: Rangkuman Harian vs Statistik Mingguan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            id="tab-mode-harian"
            onClick={() => setViewMode('HARIAN')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              viewMode === 'HARIAN'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Rangkuman Harian</span>
          </button>

          <button
            type="button"
            id="tab-mode-mingguan"
            onClick={() => setViewMode('MINGGUAN')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              viewMode === 'MINGGUAN'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Statistik Mingguan (Tren Kinerja)</span>
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900">
              Baru
            </span>
          </button>
        </div>

        <div className="text-[11px] font-semibold text-slate-500 px-3 hidden sm:flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {viewMode === 'MINGGUAN'
              ? 'Pemantauan tren mingguan: total kunjungan, laporan kinerja, dan persentase apel 24 Kepling'
              : 'Konsolidasi harian real-time 24 Kepling: apel pagi, laporan kinerja, dan kunjungan warga'}
          </span>
        </div>
      </div>

      {/* Date Bar & Preset Filters (Adapted for Harian / Mingguan) */}
      {viewMode === 'HARIAN' ? (
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                Tanggal Laporan:
              </span>
            </div>

            <input
              id="input-tanggal-rangkuman"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-slate-800"
            />

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setQuickDate(0)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedDate === todayIso
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(-1)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
              >
                Kemarin
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(-2)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
              >
                H-2
              </button>
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-600 flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
            <Clock className="w-3.5 h-3.5 text-emerald-700" />
            <span>
              Periode:{' '}
              <strong className="text-emerald-950 uppercase">
                {hariNama}, {tanggalLengkapIndo}
              </strong>
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setQuickWeek(-1)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Lihat Pekan Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Pekan Lalu</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate(todayIso)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                weekInfo.days.some((d) => d.dateStr === todayIso)
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              Pekan Ini
            </button>

            <button
              type="button"
              onClick={() => setQuickWeek(1)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Lihat Pekan Berikutnya"
            >
              <span>Pekan Depan</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 ml-1 text-xs text-slate-500">
              <span>Acuan:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 bg-slate-50 text-slate-700"
              />
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-600 flex items-center gap-2 bg-emerald-50 px-3.5 py-1.5 rounded-xl border border-emerald-100">
            <Calendar className="w-3.5 h-3.5 text-emerald-700" />
            <span>
              Rentang Pekan:{' '}
              <strong className="text-emerald-950 uppercase font-black">
                {weekInfo.labelLengkap}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Mode Harian Content Container */}
      {viewMode === 'HARIAN' && (
        <>
          {/* KPI Highlight Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Presensi Apel Pagi */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Presensi Apel Pagi
            </span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {totalStats.totalHadirApel}
            </span>
            <span className="text-xs font-bold text-slate-600">/ 24 Hadir</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-xs pt-2 border-t border-slate-100">
            <span className="text-emerald-700 font-bold">🟢 Hadir: {totalStats.totalHadirApel}</span>
            {totalStats.totalIzinSakitDinas > 0 && (
              <span className="text-amber-700 font-bold">🟡 Izin/DL: {totalStats.totalIzinSakitDinas}</span>
            )}
            <span className="text-rose-700 font-black">
              🔴 Tidak Apel: {totalStats.totalTidakApel} (NIHIL)
            </span>
          </div>
        </div>

        {/* Card 2: Laporan Kinerja Masuk */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Status Laporan Kinerja
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-800">
              {totalStats.totalMelapor}
            </span>
            <span className="text-xs font-bold text-slate-600">/ 24 Melapor</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="text-emerald-700 font-bold">🟢 Melapor: {totalStats.totalMelapor}</span>
            <span className="text-rose-700 font-black">
              🔴 NIHIL: {totalStats.totalNihil} Kepling
            </span>
          </div>
        </div>

        {/* Card 3: Kunjungan Warga Sambang */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Kunjungan Sambang Warga
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-blue-800">
              {totalStats.totalKunjunganWarga}
            </span>
            <span className="text-xs font-bold text-slate-600">Warga Terdata</span>
          </div>
          <div className="mt-2 text-xs pt-2 border-t border-slate-100 text-slate-600">
            <span>
              Dari{' '}
              <strong className="text-slate-800">
                {consolidatedKeplingData.filter((k) => (k.kunjungan || []).length > 0).length}
              </strong>{' '}
              lingkungan aktif
            </span>
          </div>
        </div>

        {/* Card 4: Total Capaian Sektoral */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Akumulasi Sektoral
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
            <div className="bg-slate-50 p-1.5 rounded-lg">
              <span className="text-slate-600 block text-[10px]">PBB:</span>
              <strong className="text-emerald-800 font-black">{totalStats.totalPbbWp} WP</strong>
            </div>
            <div className="bg-slate-50 p-1.5 rounded-lg">
              <span className="text-slate-600 block text-[10px]">Perlinsos:</span>
              <strong className="text-teal-800 font-black">{totalStats.totalPerlinsosKk} KK</strong>
            </div>
            <div className="bg-slate-50 p-1.5 rounded-lg">
              <span className="text-slate-600 block text-[10px]">IKD:</span>
              <strong className="text-blue-800 font-black">{totalStats.totalIkdOrang} Org</strong>
            </div>
            <div className="bg-slate-50 p-1.5 rounded-lg">
              <span className="text-slate-600 block text-[10px]">BPJS:</span>
              <strong className="text-purple-800 font-black">{totalStats.totalBpjsOrang} Org</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BAGIAN I: DAFTAR PRESENSI APEL PAGI (24 KEPALA LINGKUNGAN) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-800 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-emerald-700" />
              Bagian I: Presensi Apel Pagi (24 Kepala Lingkungan)
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              Daftar Kepling Hadir Apel &amp; Tidak Apel (NIHIL)
            </h2>
          </div>

          <div className="text-xs font-bold text-slate-600 flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black">
              ✓ Hadir: {keplingHadirApel.length}
            </span>
            {keplingIzinSakitDinas.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-black">
                🟡 Izin/Sakit/DL: {keplingIzinSakitDinas.length}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-black">
              ✕ Tidak Apel: {keplingTidakApel.length} (NIHIL)
            </span>
          </div>
        </div>

        <div className={`grid gap-4 ${keplingIzinSakitDinas.length > 0 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
          {/* Kolom Hadir Apel */}
          <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                  Daftar Kepling Hadir Apel ({keplingHadirApel.length})
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900">
                Presensi Masuk
              </span>
            </div>

            {keplingHadirApel.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {keplingHadirApel.map((item, idx) => (
                  <div
                    key={item.kepling.id}
                    className="bg-white p-2.5 rounded-xl border border-emerald-100 flex items-center justify-between gap-2 shadow-3xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {item.kepling.lingkungan}
                        </div>
                        <div className="text-[11px] text-slate-600 truncate">
                          {item.kepling.nama}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        {item.absen?.jam || 'Hadir'}
                      </span>
                      {item.absen?.lokasiGps && (
                        <div className="text-[9px] text-slate-500 flex items-center justify-end gap-0.5 mt-0.5">
                          <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                          GPS Terverifikasi
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs font-bold text-emerald-800 bg-white/60 rounded-xl border border-emerald-100">
                Belum ada data presensi hadir apel tercatat pada tanggal ini.
              </div>
            )}
          </div>

          {/* Kolom Izin / Sakit / Dinas Luar (Hanya jika ada) */}
          {keplingIzinSakitDinas.length > 0 && (
            <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-950">
                    Izin / Sakit / Dinas Luar ({keplingIzinSakitDinas.length})
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-200 text-amber-900">
                  Tercatat Disertai Alasan
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {keplingIzinSakitDinas.map((item, idx) => (
                  <div
                    key={item.kepling.id}
                    className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between gap-2 shadow-3xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {item.kepling.lingkungan}
                        </div>
                        <div className="text-[11px] text-slate-600 truncate">
                          {item.kepling.nama}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600" />
                        {item.absen?.status || 'Izin'}
                      </span>
                      {item.absen?.catatan && (
                        <div
                          className="text-[9px] text-slate-600 italic mt-0.5 max-w-[130px] truncate"
                          title={item.absen.catatan}
                        >
                          {item.absen.catatan}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kolom Tidak Hadir Apel (NIHIL) */}
          <div className="bg-rose-50/60 rounded-2xl p-4 border border-rose-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-rose-950">
                  Daftar Kepling Tidak Apel / Belum Hadir ({keplingTidakApel.length})
                </h3>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-200 text-rose-900">
                STATUS: NIHIL
              </span>
            </div>

            {keplingTidakApel.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {keplingTidakApel.map((item, idx) => (
                  <div
                    key={item.kepling.id}
                    className="bg-white p-2.5 rounded-xl border border-rose-100 flex items-center justify-between gap-2 shadow-3xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {item.kepling.lingkungan}
                        </div>
                        <div className="text-[11px] text-slate-600 truncate">
                          {item.kepling.nama}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-800 bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-200">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        {item.absen?.status && String(item.absen.status).toLowerCase() !== 'hadir'
                          ? String(item.absen.status).toUpperCase()
                          : 'NIHIL'}
                      </span>
                      {item.absen?.catatan && (
                        <div className="text-[9px] text-slate-500 italic mt-0.5 max-w-[120px] truncate">
                          {item.absen.catatan}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs font-bold text-emerald-800 bg-white/60 rounded-xl border border-emerald-100">
                🎉 Luar biasa! Seluruh 24 Kepala Lingkungan hadir apel pagi lengkap.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BAGIAN II: RANGKUMAN DETAIL 24 KEPALA LINGKUNGAN */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        {/* Filter & Toolbar Pencarian Kepling */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Filter Tampilan:
            </span>
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua (24)
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('MELAPOR')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'MELAPOR'
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Melapor ({totalStats.totalMelapor})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('NIHIL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'NIHIL'
                    ? 'bg-rose-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                NIHIL ({totalStats.totalNihil})
              </button>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari kepling, jalan, atau warga..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* List 24 Kepling Cards */}
        <div className="space-y-3.5">
          {filteredKeplingList.map((item) => {
            const kin = item.laporan?.kinerja || ({} as any);

            return (
              <div
                key={item.kepling.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md ${
                  item.isMelapor
                    ? 'border-slate-200 hover:border-emerald-300'
                    : 'border-rose-200 bg-rose-50/20'
                }`}
              >
                {/* Header Card Kepling */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 shadow-3xs ${
                        item.isMelapor
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {item.nomor}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900">
                          {item.kepling.lingkungan}
                        </h3>
                        <span className="text-slate-400">•</span>
                        <span className="text-xs font-bold text-slate-700">
                          {item.kepling.nama}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-600 mt-0.5">
                        <span className="font-semibold">{item.kepling.jabatan}</span>
                        {item.kepling.telepon && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {item.kepling.telepon}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badges & Quick Action */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Badge Apel */}
                    {item.isApelHadir ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200"
                        title={item.absen?.catatan || 'Hadir Tepat Waktu'}
                      >
                        <Clock className="w-3 h-3 text-emerald-600" />
                        Apel: Hadir ({item.absen?.jam || '07:35 WIB'})
                      </span>
                    ) : item.isApelIzinSakitDinas ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300"
                        title={item.absen?.catatan || ''}
                      >
                        <Clock className="w-3 h-3 text-amber-700" />
                        Apel: {item.absen?.status || 'Izin'}{item.absen?.catatan ? ` [${item.absen.catatan}]` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-200">
                        Apel: NIHIL
                      </span>
                    )}

                    {/* Badge Status Laporan */}
                    {item.isMelapor ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg bg-emerald-600 text-white shadow-3xs">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        SUDAH MELAPOR
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg bg-rose-600 text-white shadow-3xs">
                        <AlertCircle className="w-3.5 h-3.5" />
                        NIHIL
                      </span>
                    )}

                    {/* Tombol Asistensi / Input Manual Laporan */}
                    {onDraftForKepling && (
                      <button
                        type="button"
                        onClick={() => onDraftForKepling(item.kepling)}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs active:scale-95"
                        title="Buka Formulir Input Laporan atas nama Kepling ini"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{item.isMelapor ? 'Edit Laporan' : 'Input Laporan'}</span>
                      </button>
                    )}

                    {/* Tombol Input Kunjungan Warga */}
                    <button
                      type="button"
                      onClick={() => setKunjunganModalKepling(item.kepling)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition-all flex items-center gap-1 cursor-pointer shadow-3xs active:scale-95"
                      title="Input Sambang Warga atas nama Kepling ini"
                    >
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>+ Kunjungan</span>
                    </button>

                    {item.laporan && onOpenReportDetail && (
                      <button
                        type="button"
                        onClick={() => onOpenReportDetail(item.laporan!)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                        title="Lihat Detail Laporan Lengkap"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Body: Rincian Kinerja Harian */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Grid 4 Indikator Utama */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {/* Opsir PBB */}
                    <div
                      className={`p-3 rounded-xl border ${
                        item.isMelapor && kin.opsirPbbWp && String(kin.opsirPbbWp) !== '0'
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        1. Opsir PBB
                      </div>
                      <div className="mt-1 font-black text-sm text-slate-900">
                        {item.isMelapor ? (
                          kin.opsirPbbWp && String(kin.opsirPbbWp) !== '0' ? (
                            `${kin.opsirPbbWp} WP`
                          ) : (
                            '0 WP'
                          )
                        ) : (
                          <span className="text-rose-600 font-extrabold">NIHIL</span>
                        )}
                      </div>
                      {item.isMelapor && kin.opsirPbbKeterangan && (
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {kin.opsirPbbKeterangan}
                        </div>
                      )}
                    </div>

                    {/* Perlinsos */}
                    <div
                      className={`p-3 rounded-xl border ${
                        item.isMelapor && kin.perlinsosKk && String(kin.perlinsosKk) !== '0'
                          ? 'bg-teal-50/70 border-teal-200 text-teal-950'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        2. Perlinsos
                      </div>
                      <div className="mt-1 font-black text-sm text-slate-900">
                        {item.isMelapor ? (
                          kin.perlinsosKk && String(kin.perlinsosKk) !== '0' ? (
                            `${kin.perlinsosKk} KK`
                          ) : (
                            '0 KK'
                          )
                        ) : (
                          <span className="text-rose-600 font-extrabold">NIHIL</span>
                        )}
                      </div>
                      {item.isMelapor && (
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {kin.perlinsosKeterangan || 'Pendataan Perlinsos'}
                        </div>
                      )}
                    </div>

                    {/* IKD Dukcapil */}
                    <div
                      className={`p-3 rounded-xl border ${
                        item.isMelapor && kin.ikdOrang && String(kin.ikdOrang) !== '0'
                          ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        3. IKD Dukcapil
                      </div>
                      <div className="mt-1 font-black text-sm text-slate-900">
                        {item.isMelapor ? (
                          kin.ikdOrang && String(kin.ikdOrang) !== '0' ? (
                            `${kin.ikdOrang} Orang`
                          ) : (
                            '0 Orang'
                          )
                        ) : (
                          <span className="text-rose-600 font-extrabold">NIHIL</span>
                        )}
                      </div>
                      {item.isMelapor && kin.ikdKeterangan && (
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {kin.ikdKeterangan}
                        </div>
                      )}
                    </div>

                    {/* BPJS Ketenagakerjaan */}
                    <div
                      className={`p-3 rounded-xl border ${
                        item.isMelapor &&
                        kin.bpjsKetenagakerjaanOrang &&
                        String(kin.bpjsKetenagakerjaanOrang) !== '0'
                          ? 'bg-purple-50/70 border-purple-200 text-purple-950'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        4. BPJS Naker
                      </div>
                      <div className="mt-1 font-black text-sm text-slate-900">
                        {item.isMelapor ? (
                          kin.bpjsKetenagakerjaanOrang &&
                          String(kin.bpjsKetenagakerjaanOrang) !== '0' ? (
                            `${kin.bpjsKetenagakerjaanOrang} Orang`
                          ) : (
                            '0 Orang'
                          )
                        ) : (
                          <span className="text-rose-600 font-extrabold">NIHIL</span>
                        )}
                      </div>
                      {item.isMelapor && kin.bpjsKetenagakerjaanKeterangan && (
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {kin.bpjsKetenagakerjaanKeterangan}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Catatan Tambahan Perlinsos Menolak / Tidak di Tempat */}
                  {item.isMelapor &&
                    ((kin.perlinsosMenolakKk && String(kin.perlinsosMenolakKk) !== '0') ||
                      (kin.perlinsosTidakDiTempatKk &&
                        String(kin.perlinsosTidakDiTempatKk) !== '0')) && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex flex-wrap items-center gap-4">
                        {kin.perlinsosMenolakKk && String(kin.perlinsosMenolakKk) !== '0' && (
                          <div>
                            ⚠️ <strong>Menolak:</strong> {kin.perlinsosMenolakKk} KK
                            {kin.perlinsosMenolakRincian && (
                              <span className="italic text-slate-700 ml-1">
                                ({kin.perlinsosMenolakRincian})
                              </span>
                            )}
                          </div>
                        )}
                        {kin.perlinsosTidakDiTempatKk &&
                          String(kin.perlinsosTidakDiTempatKk) !== '0' && (
                            <div>
                              🏠 <strong>Tidak di Tempat:</strong> {kin.perlinsosTidakDiTempatKk} KK
                              {kin.perlinsosTidakDiTempatRincian && (
                                <span className="italic text-slate-700 ml-1">
                                  ({kin.perlinsosTidakDiTempatRincian})
                                </span>
                              )}
                            </div>
                          )}
                      </div>
                    )}

                  {/* Poskamling & Infrastruktur Bar */}
                  {item.isMelapor && (
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-800">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          Poskamling:{' '}
                          <strong>
                            {kin.poskamlingStatus && kin.poskamlingStatus !== 'Tidak Ada Giat'
                              ? kin.poskamlingStatus
                              : 'Nihil / Tidak Ada Giat'}
                          </strong>
                        </span>
                      </div>

                      {kin.infrastrukturSubjek && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-100 text-amber-900 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                          <span>Infrastruktur: {kin.infrastrukturSubjek}</span>
                        </div>
                      )}

                      {item.laporan?.jumlahDokumentasi && item.laporan.jumlahDokumentasi > 0 ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-semibold">
                          <Camera className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{item.laporan.jumlahDokumentasi} Foto Terlampir</span>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Kunjungan Warga Terpadu Section */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>Kunjungan Sambang Warga Harian:</span>
                      </div>
                      {(item.kunjungan || []).length > 0 ? (
                        <span className="text-[11px] font-black text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                          {(item.kunjungan || []).length} Warga Dikunjungi
                        </span>
                      ) : (
                        <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          STATUS: NIHIL
                        </span>
                      )}
                    </div>

                    {(item.kunjungan || []).length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {(item.kunjungan || []).map((w, wIdx) => (
                          <div
                            key={w.id || wIdx}
                            className="p-2.5 rounded-xl border border-blue-100 bg-blue-50/40 text-xs flex flex-col justify-between"
                          >
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-900 text-[9px] font-black flex items-center justify-center">
                                  {wIdx + 1}
                                </span>
                                <span className="truncate">{w.namaWarga}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5 pl-5">
                                {w.alamat || 'Alamat tidak diisi'}
                              </div>
                            </div>

                            <div className="mt-2 pl-5 flex items-center gap-2 text-[10px]">
                              <span
                                className={`px-1.5 py-0.2 rounded font-bold ${
                                  w.perlinsos === 'Sudah'
                                    ? 'bg-teal-100 text-teal-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                Perlinsos: {w.perlinsos || 'Belum'}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded font-bold ${
                                  w.pbb === 'Sudah'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                PBB: {w.pbb || 'Belum'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 italic flex items-center justify-between">
                        <span>NIHIL — Tidak ada data kunjungan warga tercatat pada tanggal ini.</span>
                        <button
                          type="button"
                          onClick={() => setKunjunganModalKepling(item.kepling)}
                          className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer not-italic ml-2 shrink-0"
                        >
                          + Catat Kunjungan
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* MODE STATISTIK & TREN MINGGUAN KINERJA (24 KEPALA LINGKUNGAN) */}
      {/* ========================================================================= */}
      {viewMode === 'MINGGUAN' && weeklyStats && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 4 Executive KPI Cards Mingguan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Total Kunjungan Warga Mingguan */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Total Kunjungan Warga (Sepekan)
                </span>
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-blue-900">
                  {weeklyStats.totalKunjunganWarga}
                </span>
                <span className="text-xs font-bold text-slate-600">Warga</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="text-slate-600 font-medium">
                  {weeklyStats.totalKeplingAktifKunjungan} / 24 Kepling Aktif
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-[10px]">
                  Rata-rata: {(weeklyStats.totalKunjunganWarga / 24).toFixed(1)}/lingk
                </span>
              </div>
            </div>

            {/* Card 2: Total Laporan Kinerja Masuk */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Total Laporan Masuk (Sepekan)
                </span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {weeklyStats.totalLaporanMasuk}
                </span>
                <span className="text-xs font-bold text-slate-600">
                  / {weeklyStats.totalTargetLaporan} Laporan
                </span>
                <span className="ml-auto text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  {weeklyStats.persenLaporanMasuk}%
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-600">
                <span>Target 120 (24 Kepling × 5 Hari)</span>
                <span className={weeklyStats.persenLaporanMasuk >= 80 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                  {weeklyStats.persenLaporanMasuk >= 80 ? 'Sangat Baik' : 'Perlu Didorong'}
                </span>
              </div>
            </div>

            {/* Card 3: Persentase Presensi Apel Mingguan */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Persentase Apel Pagi (Sepekan)
                </span>
                <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-teal-950">
                  {weeklyStats.persenKehadiranApel}%
                </span>
                <span className="text-xs font-bold text-slate-600">
                  ({weeklyStats.totalHadirApelKelurahan} / {weeklyStats.totalTargetApel})
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                <span className="text-emerald-700 font-bold">🟢 {weeklyStats.totalHadirApelKelurahan} Hadir</span>
                {weeklyStats.totalIzinApelKelurahan > 0 && (
                  <span className="text-amber-700 font-bold">🟡 {weeklyStats.totalIzinApelKelurahan} Izin</span>
                )}
                <span className="text-rose-700 font-bold">🔴 {weeklyStats.totalTidakApelKelurahan} Nihil</span>
              </div>
            </div>

            {/* Card 4: Akumulasi Capaian Sektoral */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Akumulasi Sektoral (Sepekan)
                </span>
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-1.5 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">PBB WP:</span>
                  <strong className="text-emerald-800 font-black">{weeklyStats.totalPbbWp} WP</strong>
                </div>
                <div className="bg-slate-50 p-1.5 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Perlinsos:</span>
                  <strong className="text-amber-800 font-black">{weeklyStats.totalPerlinsosKk} KK</strong>
                </div>
                <div className="bg-slate-50 p-1.5 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">IKD Dukcapil:</span>
                  <strong className="text-blue-800 font-black">{weeklyStats.totalIkdOrang} Org</strong>
                </div>
                <div className="bg-slate-50 p-1.5 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">BPJS Naker:</span>
                  <strong className="text-purple-800 font-black">{weeklyStats.totalBpjsOrang} Org</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Tren Visual Harian (Senin - Minggu) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-800 uppercase tracking-wider">
                  <BarChart3 className="w-4 h-4 text-emerald-700" />
                  Tren Harian Kinerja & Presensi
                </div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  Distribusi Capaian Harian (Senin s/d Minggu)
                </h2>
              </div>
              <div className="text-xs font-bold text-slate-500">
                Pekan Aktif: {weeklyStats.weekInfo.labelLengkap}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {weeklyStats.dayBreakdown.map((d) => (
                <div
                  key={d.dateStr}
                  className={`p-3 rounded-2xl border transition-all ${
                    d.dateStr === selectedDate
                      ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                      : d.isWorkDay
                      ? 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                      : 'bg-slate-50/40 border-dashed border-slate-200 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-slate-800">{d.dayName}</span>
                    <span className="text-[10px] font-bold text-slate-500">{d.formatted}</span>
                  </div>

                  <div className="space-y-2 mt-2">
                    {/* Apel Progress */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-teal-600" /> Apel
                        </span>
                        <span>{d.totalHadirApel}/24</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-teal-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.min(100, d.persenApel)}%` }}
                        />
                      </div>
                    </div>

                    {/* Laporan Progress */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-0.5">
                        <span className="flex items-center gap-1">
                          <FileText className="w-2.5 h-2.5 text-emerald-600" /> Lap
                        </span>
                        <span>{d.totalLaporan}/24</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.min(100, d.persenLaporan)}%` }}
                        />
                      </div>
                    </div>

                    {/* Kunjungan Count */}
                    <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Kunjungan:</span>
                      <strong className="text-blue-800 font-black">{d.totalKunjungan} Warga</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leaderboard & Evaluasi Disiplin */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top 3 Kunjungan */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <Award className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Top 3 Kunjungan Sambang Warga
                </h3>
              </div>
              <div className="space-y-2.5">
                {weeklyStats.topKunjungan.map((k, idx) => (
                  <div key={k.kepling.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 bg-amber-100 text-amber-900">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-800 truncate">{k.kepling.lingkungan}</p>
                        <p className="text-[11px] text-slate-500 truncate">{k.kepling.nama}</p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-blue-900 bg-blue-100 px-2 py-0.5 rounded-md shrink-0">
                      {k.totalKunjungan} Warga
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Realisasi Sektoral (PBB & Perlinsos) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Top Realisasi Sektoral Sepekan
                </h3>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Opsir PBB Terbanyak:</p>
                  <div className="space-y-1.5">
                    {weeklyStats.topPbb.slice(0, 2).map((k) => (
                      <div key={k.kepling.id} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 border border-emerald-100">
                        <span className="font-bold text-slate-800">{k.kepling.lingkungan}</span>
                        <strong className="text-emerald-800 font-black">{k.pbbWp} WP</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Perlinsos Terbanyak:</p>
                  <div className="space-y-1.5">
                    {weeklyStats.topPerlinsos.slice(0, 2).map((k) => (
                      <div key={k.kepling.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-50/50 border border-amber-100">
                        <span className="font-bold text-slate-800">{k.kepling.lingkungan}</span>
                        <strong className="text-amber-800 font-black">{k.perlinsosKk} KK</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Status Kepatuhan & Disiplin */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Kepatuhan &amp; Disiplin (24 Kepling)
                </h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-950">Sangat Disiplin (≥80%)</span>
                  </div>
                  <strong className="text-sm font-black text-emerald-800">{weeklyStats.topDisiplin.length} Kepling</strong>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-blue-950">Baik / Cukup (60-79%)</span>
                  </div>
                  <strong className="text-sm font-black text-blue-800">
                    {weeklyStats.keplingWeeklyList.filter((k) => k.predikat === 'BAIK').length} Kepling
                  </strong>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-bold text-rose-950">Perlu Pembinaan (&lt;60%)</span>
                  </div>
                  <strong className="text-sm font-black text-rose-800">{weeklyStats.perluPembinaan.length} Kepling</strong>
                </div>

                {weeklyStats.perluPembinaan.length > 0 && (
                  <div className="p-2 rounded-lg bg-rose-100/50 border border-rose-200 text-[11px] text-rose-900">
                    <span className="font-bold">Perhatian: </span>
                    {weeklyStats.perluPembinaan.map((k) => k.kepling.lingkungan).join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabel Terpadu Kinerja 24 Kepling Sepekan */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 border-b border-slate-200 gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-800 uppercase tracking-wider">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  Matriks Kinerja &amp; Kehadiran Mingguan (24 Kepala Lingkungan)
                </div>
                <h2 className="text-base sm:lg font-black text-slate-900">
                  Tabel Rangkuman Sepekan (Senin s/d Jumat)
                </h2>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari kepling / lingkungan..."
                    value={weeklySearchQuery}
                    onChange={(e) => setWeeklySearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 sm:w-56"
                  />
                  {weeklySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setWeeklySearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setWeeklyKepatuhanFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      weeklyKepatuhanFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua ({weeklyStats.keplingWeeklyList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeeklyKepatuhanFilter('DISIPLIN')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      weeklyKepatuhanFilter === 'DISIPLIN'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    Disiplin ({weeklyStats.topDisiplin.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeeklyKepatuhanFilter('EVALUASI')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      weeklyKepatuhanFilter === 'EVALUASI'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-rose-700'
                    }`}
                  >
                    Evaluasi ({weeklyStats.perluPembinaan.length})
                  </button>
                </div>
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3 w-10 text-center">No</th>
                    <th className="py-3 px-3">Kepala Lingkungan</th>
                    <th className="py-3 px-3 text-center">Matriks Apel (Sen-Jum)</th>
                    <th className="py-3 px-3 text-center">Apel</th>
                    <th className="py-3 px-3 text-center">Laporan</th>
                    <th className="py-3 px-3 text-center">Kunjungan</th>
                    <th className="py-3 px-3 text-center">PBB</th>
                    <th className="py-3 px-3 text-center">Perlinsos</th>
                    <th className="py-3 px-3 text-center">IKD/BPJS</th>
                    <th className="py-3 px-3 text-center">Predikat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWeeklyKeplingList.map((item) => (
                    <tr key={item.kepling.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-center font-bold text-slate-500">
                        {item.nomor}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-black text-slate-900">{item.kepling.lingkungan}</div>
                        <div className="text-[11px] text-slate-500">{item.kepling.nama}</div>
                      </td>
                      {/* 5 Hari Kerja Matrix */}
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1">
                          {item.attendancePerDay.map((d) => (
                            <span
                              key={d.dateStr}
                              title={`${d.dayName}: ${d.status}${d.jam ? ` (${d.jam})` : ''}`}
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                                d.hasAttended
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : d.isIzin
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {d.hasAttended ? '✓' : d.isIzin ? '🟡' : '✕'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-bold text-slate-800">{item.totalHadirApel}/5</span>
                        <div className="text-[10px] text-slate-500">({item.persenApel}%)</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-bold text-slate-800">{item.totalLaporan}/5</span>
                        <div className="text-[10px] text-slate-500">({item.persenLaporan}%)</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-bold">
                          {item.totalKunjungan} Warga
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {item.pbbWp > 0 ? `${item.pbbWp} WP` : '-'}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {item.perlinsosKk > 0 ? `${item.perlinsosKk} KK` : '-'}
                      </td>
                      <td className="py-3 px-3 text-center text-[11px] text-slate-600">
                        {item.ikdOrang}/{item.bpjsOrang}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            item.predikat === 'SANGAT_DISIPLIN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.predikat === 'BAIK'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.predikat === 'SANGAT_DISIPLIN'
                            ? 'Sangat Disiplin'
                            : item.predikat === 'BAIK'
                            ? 'Baik'
                            : 'Perlu Pembinaan'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={2} className="py-3 px-3 text-right uppercase text-[10px]">
                      TOTAL KELURAHAN:
                    </td>
                    <td className="py-3 px-3 text-center text-[11px] text-emerald-800">
                      {weeklyStats.totalHadirApelKelurahan} Hadir
                    </td>
                    <td className="py-3 px-3 text-center">
                      {weeklyStats.persenKehadiranApel}%
                    </td>
                    <td className="py-3 px-3 text-center">
                      {weeklyStats.totalLaporanMasuk} ({weeklyStats.persenLaporanMasuk}%)
                    </td>
                    <td className="py-3 px-3 text-center text-blue-900">
                      {weeklyStats.totalKunjunganWarga} Warga
                    </td>
                    <td className="py-3 px-3 text-center text-emerald-800">
                      {weeklyStats.totalPbbWp} WP
                    </td>
                    <td className="py-3 px-3 text-center text-amber-800">
                      {weeklyStats.totalPerlinsosKk} KK
                    </td>
                    <td className="py-3 px-3 text-center">
                      {weeklyStats.totalIkdOrang}/{weeklyStats.totalBpjsOrang}
                    </td>
                    <td className="py-3 px-3 text-center text-xs">
                      24 Kepling
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CEPAT INPUT KUNJUNGAN WARGA ATAS NAMA KEPLING */}
      {/* ========================================================================= */}
      {kunjunganModalKepling && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-black">Input Kunjungan Sambang Warga</h3>
                  <p className="text-[11px] text-blue-100">
                    Atas nama: {kunjunganModalKepling.lingkungan} ({kunjunganModalKepling.nama})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKunjunganModalKepling(null)}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto">
              <FormKunjunganWarga
                currentUser={kunjunganModalKepling}
                tanggalLaporan={selectedDate}
                compact={true}
                onSuccess={() => {
                  showToast(
                    `Kunjungan warga berhasil disimpan untuk ${kunjunganModalKepling.lingkungan}!`
                  );
                  setKunjunganModalKepling(null);
                  if (onRefreshData) onRefreshData();
                }}
                onCancel={() => setKunjunganModalKepling(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINT-ONLY OFFICIAL TEMPLATE CONTAINER */}
      {/* ========================================================================= */}
      <div id="rangkuman-kelurahan-print-view" className="hidden">
        <div className="p-8 max-w-5xl mx-auto bg-white text-black font-sans">
          {/* Kop Resmi Kelurahan Mangga */}
          <KopSuratResmi />

          <div className="text-center my-4">
            <h2 className="text-base font-black uppercase tracking-wider underline">
              RANGKUMAN LAPORAN KINERJA HARIAN DAN PRESENSI 24 KEPALA LINGKUNGAN
            </h2>
            <p className="text-xs mt-1">
              Hari: <strong>{hariNama}</strong> | Tanggal: <strong>{tanggalLengkapIndo}</strong>
            </p>
          </div>

          {/* Tabel Presensi Apel */}
          <div className="mb-6">
            <h3 className="text-xs font-black uppercase border-b-2 border-black pb-1 mb-2">
              I. REKAPITULASI PRESENSI APEL PAGI (24 KEPALA LINGKUNGAN)
            </h3>
            <div className={`grid gap-4 text-xs ${totalStats.totalIzinSakitDinas > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div>
                <p className="font-bold mb-1">A. Daftar Kepling Hadir Apel ({totalStats.totalHadirApel}):</p>
                <ol className="list-decimal pl-5 space-y-0.5">
                  {keplingHadirApel.map((it) => (
                    <li key={it.kepling.id}>
                      {it.kepling.lingkungan} - {it.kepling.nama} ({it.absen?.jam || 'Hadir'})
                    </li>
                  ))}
                  {keplingHadirApel.length === 0 && <li>NIHIL</li>}
                </ol>
              </div>
              {totalStats.totalIzinSakitDinas > 0 && (
                <div>
                  <p className="font-bold mb-1">B. Daftar Kepling Izin/Sakit/DL ({totalStats.totalIzinSakitDinas}):</p>
                  <ol className="list-decimal pl-5 space-y-0.5 text-black">
                    {keplingIzinSakitDinas.map((it) => (
                      <li key={it.kepling.id}>
                        {it.kepling.lingkungan} - {it.kepling.nama} ({it.absen?.status || 'Izin'}{it.absen?.catatan ? `: ${it.absen.catatan}` : ''})
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div>
                <p className="font-bold mb-1">{totalStats.totalIzinSakitDinas > 0 ? 'C.' : 'B.'} Daftar Kepling Tidak Hadir Apel ({totalStats.totalTidakApel}):</p>
                <ol className="list-decimal pl-5 space-y-0.5 text-black">
                  {keplingTidakApel.map((it) => (
                    <li key={it.kepling.id}>
                      {it.kepling.lingkungan} - {it.kepling.nama} (NIHIL / {it.absen?.catatan || 'Tanpa Keterangan'})
                    </li>
                  ))}
                  {keplingTidakApel.length === 0 && <li>Seluruh Kepling Telah Hadir/Tercatat</li>}
                </ol>
              </div>
            </div>
          </div>

          {/* Tabel Kinerja 24 Kepling */}
          <div className="mb-6">
            <h3 className="text-xs font-black uppercase border-b-2 border-black pb-1 mb-2">
              II. RANGKUMAN LAPORAN KINERJA HARIAN &amp; KUNJUNGAN WARGA
            </h3>
            <table className="w-full text-[9pt] border-collapse border border-black">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black p-1 text-center w-8">No</th>
                  <th className="border border-black p-1 text-left">Lingkungan / Kepling</th>
                  <th className="border border-black p-1 text-center">Apel</th>
                  <th className="border border-black p-1 text-center">Status</th>
                  <th className="border border-black p-1 text-center">PBB</th>
                  <th className="border border-black p-1 text-center">Perlinsos</th>
                  <th className="border border-black p-1 text-center">IKD</th>
                  <th className="border border-black p-1 text-center">BPJS</th>
                  <th className="border border-black p-1 text-left">Kunjungan Warga</th>
                </tr>
              </thead>
              <tbody>
                {consolidatedKeplingData.map((it) => {
                  const kin: any = it.laporan?.kinerja || {};
                  return (
                    <tr key={it.kepling.id} className="border border-black">
                      <td className="border border-black p-1 text-center">{it.nomor}</td>
                      <td className="border border-black p-1">
                        <strong>{it.kepling.lingkungan}</strong>
                        <br />
                        <span className="text-[8pt]">{it.kepling.nama}</span>
                      </td>
                      <td className="border border-black p-1 text-center font-bold">
                        {it.isApelHadir
                          ? it.absen?.jam || 'Hadir'
                          : it.isApelIzinSakitDinas
                          ? it.absen?.status || 'Izin'
                          : 'NIHIL'}
                      </td>
                      <td className="border border-black p-1 text-center font-bold">
                        {it.isMelapor ? 'MELAPOR' : 'NIHIL'}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {it.isMelapor ? `${kin.opsirPbbWp || 0} WP` : 'NIHIL'}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {it.isMelapor ? `${kin.perlinsosKk || 0} KK` : 'NIHIL'}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {it.isMelapor ? `${kin.ikdOrang || 0} Org` : 'NIHIL'}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {it.isMelapor ? `${kin.bpjsKetenagakerjaanOrang || 0} Org` : 'NIHIL'}
                      </td>
                      <td className="border border-black p-1 text-[8pt]">
                        {(it.kunjungan || []).length > 0
                          ? `${(it.kunjungan || []).length} Warga (${(it.kunjungan || []).map((w) => w.namaWarga).slice(0, 2).join(', ')})`
                          : 'NIHIL'}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-100 font-bold border-t-2 border-black">
                  <td colSpan={4} className="border border-black p-1 text-right">
                    TOTAL KELURAHAN MANGGA:
                  </td>
                  <td className="border border-black p-1 text-center">{totalStats.totalPbbWp} WP</td>
                  <td className="border border-black p-1 text-center">{totalStats.totalPerlinsosKk} KK</td>
                  <td className="border border-black p-1 text-center">{totalStats.totalIkdOrang} Org</td>
                  <td className="border border-black p-1 text-center">{totalStats.totalBpjsOrang} Org</td>
                  <td className="border border-black p-1 text-left">{totalStats.totalKunjunganWarga} Warga</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Tanda Tangan */}
          <div className="mt-8 pt-4 flex justify-end text-xs">
            <div className="text-center w-56">
              <p>Medan, {tanggalLengkapIndo}</p>
              <p className="font-bold uppercase mt-1">SUPER ADMINISTRATOR</p>
              <div className="h-16" />
              <p className="font-bold underline">TIM IT KELURAHAN MANGGA</p>
              <p>Kelurahan Mangga</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINT-ONLY OFFICIAL TEMPLATE CONTAINER FOR WEEKLY */}
      {/* ========================================================================= */}
      {weeklyStats && (
        <div id="rangkuman-mingguan-kelurahan-print-view" className="hidden">
          <div className="p-8 max-w-5xl mx-auto bg-white text-black font-sans">
            <KopSuratResmi />
            <div className="text-center my-4">
              <h2 className="text-base font-black uppercase tracking-wider underline">
                RANGKUMAN STATISTIK &amp; TREN KINERJA MINGGUAN KELURAHAN MANGGA
              </h2>
              <p className="text-xs mt-1">
                Periode: <strong>{weeklyStats.weekInfo.labelLengkap}</strong>
              </p>
            </div>

            {/* Rekapitulasi Utama */}
            <div className="grid grid-cols-4 gap-3 text-xs mb-6 p-3 border border-black bg-gray-50">
              <div>
                <span className="block font-bold">Total Kunjungan Warga:</span>
                <span className="text-sm font-black">{weeklyStats.totalKunjunganWarga} Warga</span>
                <span className="block text-[8pt] text-gray-600">({weeklyStats.totalKeplingAktifKunjungan} Kepling aktif)</span>
              </div>
              <div>
                <span className="block font-bold">Total Laporan Masuk:</span>
                <span className="text-sm font-black">
                  {weeklyStats.totalLaporanMasuk} / {weeklyStats.totalTargetLaporan} ({weeklyStats.persenLaporanMasuk}%)
                </span>
                <span className="block text-[8pt] text-gray-600">Target 120 (5 hari kerja)</span>
              </div>
              <div>
                <span className="block font-bold">Presensi Apel Sepekan:</span>
                <span className="text-sm font-black">{weeklyStats.persenKehadiranApel}%</span>
                <span className="block text-[8pt] text-gray-600">{weeklyStats.totalHadirApelKelurahan} Hadir / {weeklyStats.totalTargetApel}</span>
              </div>
              <div>
                <span className="block font-bold">Realisasi Sektoral:</span>
                <span className="text-[9pt] font-semibold">
                  PBB: {weeklyStats.totalPbbWp} WP | Perlinsos: {weeklyStats.totalPerlinsosKk} KK
                </span>
                <span className="block text-[8pt] text-gray-600">
                  IKD: {weeklyStats.totalIkdOrang} | BPJS: {weeklyStats.totalBpjsOrang}
                </span>
              </div>
            </div>

            {/* Tabel Detail */}
            <div className="mb-6">
              <h3 className="text-xs font-black uppercase border-b-2 border-black pb-1 mb-2">
                REKAPITULASI KINERJA 24 KEPALA LINGKUNGAN (SEPEKAN)
              </h3>
              <table className="w-full text-[8.5pt] border-collapse border border-black">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black p-1 text-center w-8">No</th>
                    <th className="border border-black p-1 text-left">Lingkungan / Kepling</th>
                    <th className="border border-black p-1 text-center">Apel (H/5)</th>
                    <th className="border border-black p-1 text-center">% Apel</th>
                    <th className="border border-black p-1 text-center">Laporan</th>
                    <th className="border border-black p-1 text-center">Kunjungan</th>
                    <th className="border border-black p-1 text-center">PBB</th>
                    <th className="border border-black p-1 text-center">Perlinsos</th>
                    <th className="border border-black p-1 text-center">Predikat</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyStats.keplingWeeklyList.map((it) => (
                    <tr key={it.kepling.id} className="border border-black">
                      <td className="border border-black p-1 text-center">{it.nomor}</td>
                      <td className="border border-black p-1">
                        <strong>{it.kepling.lingkungan}</strong> - {it.kepling.nama}
                      </td>
                      <td className="border border-black p-1 text-center">{it.totalHadirApel}/5</td>
                      <td className="border border-black p-1 text-center font-bold">{it.persenApel}%</td>
                      <td className="border border-black p-1 text-center">{it.totalLaporan}/5</td>
                      <td className="border border-black p-1 text-center">{it.totalKunjungan} Warga</td>
                      <td className="border border-black p-1 text-center">{it.pbbWp > 0 ? `${it.pbbWp} WP` : '-'}</td>
                      <td className="border border-black p-1 text-center">{it.perlinsosKk > 0 ? `${it.perlinsosKk} KK` : '-'}</td>
                      <td className="border border-black p-1 text-center font-bold">
                        {it.predikat === 'SANGAT_DISIPLIN' ? 'SANGAT DISIPLIN' : it.predikat === 'BAIK' ? 'BAIK' : 'PERLU PEMBINAAN'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold border-t-2 border-black">
                    <td colSpan={2} className="border border-black p-1 text-right">TOTAL KELURAHAN MANGGA:</td>
                    <td className="border border-black p-1 text-center">{weeklyStats.totalHadirApelKelurahan} Hadir</td>
                    <td className="border border-black p-1 text-center">{weeklyStats.persenKehadiranApel}%</td>
                    <td className="border border-black p-1 text-center">{weeklyStats.totalLaporanMasuk} Laporan</td>
                    <td className="border border-black p-1 text-center">{weeklyStats.totalKunjunganWarga} Warga</td>
                    <td className="border border-black p-1 text-center">{weeklyStats.totalPbbWp} WP</td>
                    <td className="border border-black p-1 text-center">{weeklyStats.totalPerlinsosKk} KK</td>
                    <td className="border border-black p-1 text-center">24 Kepling</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tanda Tangan */}
            <div className="mt-8 pt-4 flex justify-end text-xs">
              <div className="text-center w-56">
                <p>Medan, {tanggalLengkapIndo}</p>
                <p className="font-bold uppercase mt-1">SUPER ADMINISTRATOR</p>
                <div className="h-16" />
                <p className="font-bold underline">TIM IT KELURAHAN MANGGA</p>
                <p>Kelurahan Mangga</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
