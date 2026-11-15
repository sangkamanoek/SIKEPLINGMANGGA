import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
  MapPin,
  Printer,
  RefreshCw,
  Save,
  Search,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  AbsensiAgendaKepling,
  AbsensiKeplingEntry,
  AgendaKelurahanItem,
  StatusKehadiranKepling,
  UserAccount,
} from '../types';
import {
  fetchAgendaFromFirestore,
  getLocalAgendaList,
  subscribeAgendaFromFirestore,
} from '../lib/agendaService';
import {
  buildMergedEntriesForAgenda,
  computeAttendanceSummaryForAgenda,
  exportAbsensiAgendaToExcel,
  fetchAbsensiAgendaFromFirestore,
  formatHariTanggalIndonesia,
  formatTanggalSingkatIndonesia,
  getEffectiveKeplingList,
  getLocalAbsensiAgendaList,
  getMonthRangeFromYm,
  getWeekRangeFromIso,
  saveAbsensiAgendaRecord,
  subscribeAbsensiAgendaFromFirestore,
  toIsoDate,
} from '../lib/absensiAgendaService';
import { KopSuratResmi } from './KopSuratResmi';
import { downloadPdfDocument, printOfficialDocument } from '../utils/printHelper';

interface AbsensiAgendaKeplingViewProps {
  currentUser: UserAccount;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onGoToAgendaTab?: () => void;
}

type PeriodMode = 'harian' | 'mingguan' | 'bulanan';

const STATUS_OPTIONS: StatusKehadiranKepling[] = [
  'Hadir',
  'Tidak Hadir',
  'Sakit',
  'Izin',
];

const SIGNER_SETTINGS_KEY = 'sikepling_absensi_signer_v2';

const DEFAULT_SIGNER_JABATAN = 'Lurah Mangga';
const DEFAULT_SIGNER_NAMA = 'Feriyanto Arapenta Tarigan, A.Md';
const DEFAULT_SIGNER_NIP = '198502152010011012';

interface SignerConfig {
  jabatan: string;
  nama: string;
  nip: string;
  nomorSurat: string;
}

const loadSignerConfig = (_currentUser: UserAccount): SignerConfig => {
  try {
    const raw = localStorage.getItem(SIGNER_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        jabatan: parsed.jabatan || DEFAULT_SIGNER_JABATAN,
        nama: parsed.nama ?? DEFAULT_SIGNER_NAMA,
        nip: parsed.nip ?? DEFAULT_SIGNER_NIP,
        nomorSurat: parsed.nomorSurat || '',
      };
    }
  } catch {
    // ignore
  }
  return {
    jabatan: DEFAULT_SIGNER_JABATAN,
    nama: DEFAULT_SIGNER_NAMA,
    nip: DEFAULT_SIGNER_NIP,
    nomorSurat: '',
  };
};

export const AbsensiAgendaKeplingView: React.FC<AbsensiAgendaKeplingViewProps> = ({
  currentUser,
  onShowToast,
  onGoToAgendaTab,
}) => {
  const isAuthorized =
    currentUser?.role === 'super_admin' || currentUser?.role === 'sekretaris';

  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const currentYm = useMemo(() => todayIso.slice(0, 7), [todayIso]);

  const [periodMode, setPeriodMode] = useState<PeriodMode>('harian');
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [showAllDatesInHarian, setShowAllDatesInHarian] = useState<boolean>(true);
  const [selectedWeekAnchor, setSelectedWeekAnchor] = useState<string>(todayIso);
  const [selectedMonthYm, setSelectedMonthYm] = useState<string>(currentYm);

  const [agendaList, setAgendaList] = useState<AgendaKelurahanItem[]>(() =>
    getLocalAgendaList()
  );
  const [absensiList, setAbsensiList] = useState<AbsensiAgendaKepling[]>(() =>
    getLocalAbsensiAgendaList()
  );

  const [selectedAgendaId, setSelectedAgendaId] = useState<string>('');
  const [draftEntries, setDraftEntries] = useState<Record<string, AbsensiKeplingEntry>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [searchKepling, setSearchKepling] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Preview & Cetak PDF Modal State
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState<boolean>(false);
  const [includePerAgendaDetailInRecap, setIncludePerAgendaDetailInRecap] =
    useState<boolean>(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [signerConfig, setSignerConfig] = useState<SignerConfig>(() =>
    loadSignerConfig(currentUser)
  );

  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onShowToast) onShowToast(msg, type);
  };

  // Persist signer preferences locally
  useEffect(() => {
    try {
      localStorage.setItem(SIGNER_SETTINGS_KEY, JSON.stringify(signerConfig));
    } catch {
      // ignore
    }
  }, [signerConfig]);

  // Real-time subscriptions for Agenda Kelurahan & Absensi Agenda Kepling
  useEffect(() => {
    if (!isAuthorized) return;

    fetchAgendaFromFirestore().then(setAgendaList).catch(() => {});
    fetchAbsensiAgendaFromFirestore().then(setAbsensiList).catch(() => {});

    const unsubAgenda = subscribeAgendaFromFirestore(setAgendaList);
    const unsubAbsensi = subscribeAbsensiAgendaFromFirestore(setAbsensiList);

    const handleAgendaUpdated = () => setAgendaList(getLocalAgendaList());
    const handleAbsensiUpdated = () => setAbsensiList(getLocalAbsensiAgendaList());

    window.addEventListener('agenda-data-updated', handleAgendaUpdated);
    window.addEventListener('absensi-agenda-updated', handleAbsensiUpdated);

    return () => {
      unsubAgenda();
      unsubAbsensi();
      window.removeEventListener('agenda-data-updated', handleAgendaUpdated);
      window.removeEventListener('absensi-agenda-updated', handleAbsensiUpdated);
    };
  }, [isAuthorized]);

  // Map absensi records by agendaId
  const recordsByAgendaId = useMemo(() => {
    const map: Record<string, AbsensiAgendaKepling> = {};
    absensiList.forEach((rec) => {
      if (rec && rec.agendaId) {
        map[rec.agendaId] = rec;
      }
    });
    return map;
  }, [absensiList]);

  // Sorted agendas descending by date
  const sortedAgendas = useMemo(() => {
    return [...agendaList].sort((a, b) =>
      (b.tanggalKegiatan || '').localeCompare(a.tanggalKegiatan || '')
    );
  }, [agendaList]);

  // Available agendas in Harian mode
  const harianAgendas = useMemo(() => {
    if (showAllDatesInHarian) return sortedAgendas;
    return sortedAgendas.filter((a) => a.tanggalKegiatan === selectedDate);
  }, [sortedAgendas, showAllDatesInHarian, selectedDate]);

  // Auto-select first matching agenda when filter changes
  useEffect(() => {
    if (harianAgendas.length === 0) {
      setSelectedAgendaId('');
      return;
    }
    const stillExists = harianAgendas.some((a) => a.id === selectedAgendaId);
    if (!stillExists) {
      setSelectedAgendaId(harianAgendas[0].id);
    }
  }, [harianAgendas, selectedAgendaId]);

  const activeAgenda = useMemo(() => {
    return harianAgendas.find((a) => a.id === selectedAgendaId) || null;
  }, [harianAgendas, selectedAgendaId]);

  const savedRecordForActiveAgenda = useMemo(() => {
    if (!activeAgenda) return null;
    return recordsByAgendaId[activeAgenda.id] || null;
  }, [activeAgenda, recordsByAgendaId]);

  // Sync draftEntries whenever selected agenda or its saved record changes
  useEffect(() => {
    if (!activeAgenda) {
      setDraftEntries({});
      setHasUnsavedChanges(false);
      return;
    }
    const existing = recordsByAgendaId[activeAgenda.id] || null;
    setDraftEntries(buildMergedEntriesForAgenda(existing, 'Hadir'));
    setHasUnsavedChanges(false);
  }, [activeAgenda?.id, savedRecordForActiveAgenda?.updatedAt]);

  const keplingMasterList = useMemo(() => getEffectiveKeplingList(), []);

  const filteredKeplingRows = useMemo(() => {
    const q = searchKepling.trim().toLowerCase();
    return keplingMasterList.filter((k) => {
      if (!q) return true;
      return (
        k.namaKepling.toLowerCase().includes(q) ||
        k.jabatan.toLowerCase().includes(q) ||
        String(k.nomorLingkungan).includes(q)
      );
    });
  }, [keplingMasterList, searchKepling]);

  // Live stats for active daily agenda
  const activeDailyStats = useMemo(() => {
    let hadir = 0;
    let tidakHadir = 0;
    let sakit = 0;
    let izin = 0;
    keplingMasterList.forEach((k) => {
      const status = draftEntries[k.keplingId]?.status || 'Hadir';
      if (status === 'Hadir') hadir += 1;
      else if (status === 'Tidak Hadir') tidakHadir += 1;
      else if (status === 'Sakit') sakit += 1;
      else if (status === 'Izin') izin += 1;
    });
    const total = keplingMasterList.length || 24;
    const pct = total > 0 ? (hadir / total) * 100 : 0;
    return { hadir, tidakHadir, sakit, izin, total, pct };
  }, [keplingMasterList, draftEntries]);

  // Weekly Range & Agendas
  const weekRange = useMemo(
    () => getWeekRangeFromIso(selectedWeekAnchor),
    [selectedWeekAnchor]
  );

  const weeklyAgendas = useMemo(() => {
    return sortedAgendas
      .filter(
        (a) =>
          a.tanggalKegiatan >= weekRange.startIso &&
          a.tanggalKegiatan <= weekRange.endIso
      )
      .sort((a, b) => a.tanggalKegiatan.localeCompare(b.tanggalKegiatan));
  }, [sortedAgendas, weekRange]);

  // Monthly Range & Agendas
  const monthRange = useMemo(
    () => getMonthRangeFromYm(selectedMonthYm),
    [selectedMonthYm]
  );

  const monthlyAgendas = useMemo(() => {
    return sortedAgendas
      .filter(
        (a) =>
          a.tanggalKegiatan >= monthRange.startIso &&
          a.tanggalKegiatan <= monthRange.endIso
      )
      .sort((a, b) => a.tanggalKegiatan.localeCompare(b.tanggalKegiatan));
  }, [sortedAgendas, monthRange]);

  // Aggregate 24-Kepling Recap for Weekly / Monthly
  const buildPeriodRecap = (periodAgendas: AgendaKelurahanItem[]) => {
    const agendaSummaries = periodAgendas.map((ag) =>
      computeAttendanceSummaryForAgenda(ag, recordsByAgendaId[ag.id] || null)
    );
    const recordedAgendas = periodAgendas.filter((ag) => Boolean(recordsByAgendaId[ag.id]));

    const keplingRecap = keplingMasterList.map((k, idx) => {
      let hadir = 0;
      let tidakHadir = 0;
      let sakit = 0;
      let izin = 0;

      recordedAgendas.forEach((ag) => {
        const rec = recordsByAgendaId[ag.id];
        const st = rec?.entries?.[k.keplingId]?.status || 'Hadir';
        if (st === 'Hadir') hadir += 1;
        else if (st === 'Tidak Hadir') tidakHadir += 1;
        else if (st === 'Sakit') sakit += 1;
        else if (st === 'Izin') izin += 1;
      });

      const totalRecorded = recordedAgendas.length;
      const pct = totalRecorded > 0 ? (hadir / totalRecorded) * 100 : 0;

      let keteranganRingkas = 'Belum ada data absensi';
      if (totalRecorded > 0) {
        const parts = [`Hadir: ${hadir}`];
        if (tidakHadir > 0) parts.push(`Tidak Hadir: ${tidakHadir}`);
        if (sakit > 0) parts.push(`Sakit: ${sakit}`);
        if (izin > 0) parts.push(`Izin: ${izin}`);
        keteranganRingkas = `${parts.join(', ')} (${pct.toFixed(0)}%)`;
      }

      return {
        no: idx + 1,
        ...k,
        hadir,
        tidakHadir,
        sakit,
        izin,
        totalRecorded,
        pct,
        keteranganRingkas,
      };
    });

    const totals = keplingRecap.reduce(
      (acc, r) => ({
        hadir: acc.hadir + r.hadir,
        tidakHadir: acc.tidakHadir + r.tidakHadir,
        sakit: acc.sakit + r.sakit,
        izin: acc.izin + r.izin,
      }),
      { hadir: 0, tidakHadir: 0, sakit: 0, izin: 0 }
    );

    return {
      agendaSummaries,
      recordedAgendasCount: recordedAgendas.length,
      totalAgendasCount: periodAgendas.length,
      keplingRecap,
      totals,
    };
  };

  const weeklyRecap = useMemo(
    () => buildPeriodRecap(weeklyAgendas),
    [weeklyAgendas, recordsByAgendaId, keplingMasterList]
  );

  const monthlyRecap = useMemo(
    () => buildPeriodRecap(monthlyAgendas),
    [monthlyAgendas, recordsByAgendaId, keplingMasterList]
  );

  const handleStatusChange = (keplingId: string, status: StatusKehadiranKepling) => {
    setDraftEntries((prev) => {
      const existing = prev[keplingId];
      if (!existing) return prev;
      return {
        ...prev,
        [keplingId]: {
          ...existing,
          status,
        },
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleCatatanChange = (keplingId: string, catatan: string) => {
    setDraftEntries((prev) => {
      const existing = prev[keplingId];
      if (!existing) return prev;
      return {
        ...prev,
        [keplingId]: {
          ...existing,
          catatan,
        },
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleMarkAllStatus = (status: StatusKehadiranKepling) => {
    setDraftEntries((prev) => {
      const next: Record<string, AbsensiKeplingEntry> = {};
      Object.entries(prev).forEach(([id, entry]) => {
        next[id] = { ...entry, status };
      });
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const handleSaveAbsensi = async () => {
    if (!activeAgenda) {
      notify('Pilih Agenda Kelurahan terlebih dahulu sebelum menyimpan absensi.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const record: AbsensiAgendaKepling = {
        id: `abs_${activeAgenda.id}`,
        agendaId: activeAgenda.id,
        namaKegiatan: activeAgenda.namaKegiatan,
        tanggalKegiatan: activeAgenda.tanggalKegiatan,
        jamKegiatan: activeAgenda.jamKegiatan || '',
        lokasi: activeAgenda.lokasi || '',
        entries: draftEntries,
        diinputOlehNama: currentUser.nama,
        diinputOlehRole: currentUser.role,
        createdAt: savedRecordForActiveAgenda?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      await saveAbsensiAgendaRecord(record);
      setAbsensiList(getLocalAbsensiAgendaList());
      setHasUnsavedChanges(false);
      notify(
        `Daftar Hadir Kepala Lingkungan untuk "${activeAgenda.namaKegiatan}" berhasil disimpan!`,
        'success'
      );
    } catch {
      notify('Gagal menyimpan daftar hadir ke Cloud Firestore.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const [ag, abs] = await Promise.all([
        fetchAgendaFromFirestore(),
        fetchAbsensiAgendaFromFirestore(),
      ]);
      setAgendaList(ag);
      setAbsensiList(abs);
      notify('Data Agenda & Absensi Kepala Lingkungan berhasil disinkronkan!', 'success');
    } catch {
      notify('Gagal menyinkronkan data dari Firestore.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenAgendaForEdit = (agenda: AgendaKelurahanItem) => {
    setPeriodMode('harian');
    setShowAllDatesInHarian(true);
    setSelectedDate(agenda.tanggalKegiatan);
    setSelectedAgendaId(agenda.id);
  };

  const getPdfDocumentMeta = () => {
    if (periodMode === 'harian') {
      const tgl = activeAgenda?.tanggalKegiatan || selectedDate;
      return {
        title: `Daftar_Hadir_Kepling_Harian_${tgl}`,
        hariTanggal: formatHariTanggalIndonesia(tgl),
        subtitle: '',
      };
    }
    if (periodMode === 'mingguan') {
      return {
        title: `Daftar_Hadir_Kepling_Mingguan_${weekRange.startIso}_sd_${weekRange.endIso}`,
        hariTanggal: weekRange.label,
        subtitle: 'REKAPITULASI MINGGUAN DAFTAR HADIR KEPALA LINGKUNGAN',
      };
    }
    return {
      title: `Daftar_Hadir_Kepling_Bulanan_${selectedMonthYm}`,
      hariTanggal: monthRange.label,
      subtitle: 'REKAPITULASI BULANAN DAFTAR HADIR KEPALA LINGKUNGAN',
    };
  };

  const handlePrintPdf = () => {
    const meta = getPdfDocumentMeta();
    printOfficialDocument('lembar-cetak-absensi-kepling', meta.title);
  };

  const handleDownloadPdf = async () => {
    const meta = getPdfDocumentMeta();
    setIsDownloadingPdf(true);
    try {
      await downloadPdfDocument('lembar-cetak-absensi-kepling', `${meta.title}.pdf`);
      notify('File PDF Daftar Hadir Kepala Lingkungan berhasil diunduh!', 'success');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleExportExcel = () => {
    if (periodMode === 'harian') {
      if (!activeAgenda) {
        notify('Tidak ada agenda terpilih untuk diekspor.', 'info');
        return;
      }
      const tempRecordMap: Record<string, AbsensiAgendaKepling> = {
        ...recordsByAgendaId,
        [activeAgenda.id]: {
          id: `abs_${activeAgenda.id}`,
          agendaId: activeAgenda.id,
          namaKegiatan: activeAgenda.namaKegiatan,
          tanggalKegiatan: activeAgenda.tanggalKegiatan,
          entries: draftEntries,
          createdAt: new Date().toISOString(),
        },
      };
      exportAbsensiAgendaToExcel(
        'Harian',
        formatHariTanggalIndonesia(activeAgenda.tanggalKegiatan),
        [activeAgenda],
        tempRecordMap,
        `Daftar_Hadir_Kepling_${activeAgenda.tanggalKegiatan}.xlsx`
      );
      notify('File Excel Daftar Hadir Harian berhasil diunduh!', 'success');
      return;
    }

    const list = periodMode === 'mingguan' ? weeklyAgendas : monthlyAgendas;
    const label = periodMode === 'mingguan' ? weekRange.label : monthRange.label;
    if (list.length === 0) {
      notify('Tidak ada agenda pada periode ini untuk diekspor.', 'info');
      return;
    }
    exportAbsensiAgendaToExcel(
      periodMode === 'mingguan' ? 'Mingguan' : 'Bulanan',
      label,
      list,
      recordsByAgendaId,
      `Rekap_Absensi_Kepling_${periodMode === 'mingguan' ? weekRange.startIso : selectedMonthYm}.xlsx`
    );
    notify(`File Excel Rekap ${periodMode === 'mingguan' ? 'Mingguan' : 'Bulanan'} berhasil diunduh!`, 'success');
  };

  // Strict RBAC guard
  if (!isAuthorized) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3 shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-base font-black text-slate-900">
          Akses Terbatas — Khusus Superadmin &amp; Sekretaris Lurah
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Modul Absensi Kepala Lingkungan berdasarkan Agenda Kelurahan hanya dapat diakses oleh akun Superadmin dan Sekretaris Kelurahan (Seklur).
        </p>
      </div>
    );
  }

  const activeRecap = periodMode === 'mingguan' ? weeklyRecap : monthlyRecap;
  const activePeriodAgendas = periodMode === 'mingguan' ? weeklyAgendas : monthlyAgendas;
  const pdfMeta = getPdfDocumentMeta();

  return (
    <div className="space-y-5 max-w-7xl mx-auto px-1 sm:px-2">
      {/* Executive Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-emerald-300 font-bold">
              <span>Sekretariat Kelurahan Mangga</span>
              <span aria-hidden="true">·</span>
              <span>Akses Superadmin &amp; Seklur</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
              <UserCheck className="w-6 h-6 text-emerald-400 shrink-0" />
              <span>Absensi Kepala Lingkungan Berdasarkan Agenda Kelurahan</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
              Catat kehadiran 24 Kepala Lingkungan pada setiap agenda resmi kelurahan (Hadir, Tidak Hadir, Sakit, Izin) serta cetak laporan PDF resmi ber-KOP Surat per hari, minggu, dan bulan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsPdfPreviewOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-colors shadow-md cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>
                Cetak PDF ({periodMode === 'harian' ? 'Harian' : periodMode === 'mingguan' ? 'Mingguan' : 'Bulanan'})
              </span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>Ekspor Excel</span>
            </button>

            <button
              type="button"
              onClick={handleSyncAll}
              disabled={isSyncing}
              title="Sinkronkan Data Agenda & Absensi dengan Firestore"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Period Mode Switcher + Filter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Segmented Period Tabs */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start">
            <button
              type="button"
              onClick={() => setPeriodMode('harian')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                periodMode === 'harian'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Harian (Per Agenda)
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('mingguan')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                periodMode === 'mingguan'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rekap Mingguan
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('bulanan')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                periodMode === 'bulanan'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rekap Bulanan
            </button>
          </div>

          {/* Dynamic Date Controls */}
          {periodMode === 'harian' && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAllDatesInHarian(true)}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                    showAllDatesInHarian ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Semua Tanggal ({sortedAgendas.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowAllDatesInHarian(false)}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                    !showAllDatesInHarian ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Filter Tanggal
                </button>
              </div>
              {!showAllDatesInHarian && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>
          )}

          {periodMode === 'mingguan' && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedWeekAnchor(todayIso)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 cursor-pointer"
              >
                Minggu Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 7);
                  setSelectedWeekAnchor(toIsoDate(d));
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 cursor-pointer"
              >
                Minggu Lalu
              </button>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-500">Pilih Tanggal di Minggu:</span>
                <input
                  type="date"
                  value={selectedWeekAnchor}
                  onChange={(e) => setSelectedWeekAnchor(e.target.value || todayIso)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {periodMode === 'bulanan' && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedMonthYm(currentYm)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 cursor-pointer"
              >
                Bulan Ini
              </button>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-500">Pilih Bulan:</span>
                <input
                  type="month"
                  value={selectedMonthYm}
                  onChange={(e) => setSelectedMonthYm(e.target.value || currentYm)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Agenda Selector in Harian Mode */}
        {periodMode === 'harian' && (
          <div className="pt-3 border-t border-slate-100 space-y-3">
            {harianAgendas.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2.5">
                <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-black text-slate-800">
                  {showAllDatesInHarian
                    ? 'Belum ada data Agenda Kelurahan yang tersimpan.'
                    : `Tidak ada Agenda Kelurahan pada ${formatHariTanggalIndonesia(selectedDate)}.`}
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {showAllDatesInHarian
                    ? 'Tambahkan jadwal kegiatan pada menu Agenda Kelurahan terlebih dahulu agar daftar hadir dapat diisi.'
                    : 'Pilih tanggal lain atau tampilkan Semua Tanggal untuk memilih agenda yang tersedia.'}
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  {!showAllDatesInHarian && sortedAgendas.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllDatesInHarian(true)}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                    >
                      Lihat Semua Agenda ({sortedAgendas.length})
                    </button>
                  )}
                  {onGoToAgendaTab && (
                    <button
                      type="button"
                      onClick={onGoToAgendaTab}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Kelola Agenda Kelurahan
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                <div className="lg:col-span-7 space-y-1">
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wide block">
                    Pilih Agenda Kelurahan ({harianAgendas.length} Kegiatan Tersedia):
                  </label>
                  <select
                    value={selectedAgendaId}
                    onChange={(e) => setSelectedAgendaId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {harianAgendas.map((ag) => {
                      const sudahAbsen = Boolean(recordsByAgendaId[ag.id]);
                      return (
                        <option key={ag.id} value={ag.id}>
                          {ag.tanggalKegiatan} — {ag.namaKegiatan}{' '}
                          {sudahAbsen ? '✓ (Sudah Diabsen)' : '(Belum Diabsen)'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {activeAgenda && (
                  <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-slate-900 truncate">
                        {activeAgenda.namaKegiatan}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                          savedRecordForActiveAgenda
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {savedRecordForActiveAgenda ? 'Tersimpan' : 'Belum Disimpan'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        {formatHariTanggalIndonesia(activeAgenda.tanggalKegiatan)}
                      </span>
                      {activeAgenda.jamKegiatan && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {activeAgenda.jamKegiatan}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        {activeAgenda.lokasi}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Info Periode Mingguan / Bulanan */}
        {periodMode !== 'harian' && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-slate-700 font-bold">
              Periode Aktif:{' '}
              <span className="text-slate-900 font-black">
                {periodMode === 'mingguan' ? weekRange.label : monthRange.label}
              </span>
            </div>
            <div className="text-slate-600 font-semibold tabular-nums">
              {activeRecap.recordedAgendasCount} dari {activeRecap.totalAgendasCount} Agenda sudah diisi absensinya
            </div>
          </div>
        )}
      </div>

      {/* KONTEN UTAMA MODE HARIAN */}
      {periodMode === 'harian' && activeAgenda && (
        <>
          {/* Ringkasan Kehadiran Harian */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <p className="text-[11px] font-bold text-slate-500">Total Kepling</p>
              <p className="text-lg font-black text-slate-900 tabular-nums mt-0.5">
                {activeDailyStats.total} Org
              </p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200">
              <p className="text-[11px] font-bold text-emerald-700">Hadir</p>
              <p className="text-lg font-black text-emerald-900 tabular-nums mt-0.5">
                {activeDailyStats.hadir}{' '}
                <span className="text-xs font-semibold text-emerald-600">
                  ({activeDailyStats.pct.toFixed(0)}%)
                </span>
              </p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-rose-200">
              <p className="text-[11px] font-bold text-rose-700">Tidak Hadir</p>
              <p className="text-lg font-black text-rose-900 tabular-nums mt-0.5">
                {activeDailyStats.tidakHadir} Org
              </p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-amber-200">
              <p className="text-[11px] font-bold text-amber-800">Sakit</p>
              <p className="text-lg font-black text-amber-950 tabular-nums mt-0.5">
                {activeDailyStats.sakit} Org
              </p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-blue-200 col-span-2 sm:col-span-1">
              <p className="text-[11px] font-bold text-blue-700">Izin</p>
              <p className="text-lg font-black text-blue-950 tabular-nums mt-0.5">
                {activeDailyStats.izin} Org
              </p>
            </div>
          </div>

          {/* Toolbar Input Absensi */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchKepling}
                  onChange={(e) => setSearchKepling(e.target.value)}
                  placeholder="Cari nama Kepala Lingkungan atau nomor lingkungan..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMarkAllStatus('Hadir')}
                  className="px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  Tandai Semua Hadir
                </button>
                <button
                  type="button"
                  onClick={handleSaveAbsensi}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-black shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSaving
                      ? 'Menyimpan...'
                      : hasUnsavedChanges
                      ? 'Simpan Daftar Hadir *'
                      : 'Simpan Daftar Hadir'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPdfPreviewOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" />
                  <span>Pratinjau &amp; Cetak PDF</span>
                </button>
              </div>
            </div>

            {/* Tabel Input 24 Kepala Lingkungan */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 text-center w-12">No.</th>
                    <th className="py-3 px-3">Nama Kepala Lingkungan</th>
                    <th className="py-3 px-3">Jabatan</th>
                    <th className="py-3 px-3 text-center">Keterangan Kehadiran</th>
                    <th className="py-3 px-3">Catatan (Opsional)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredKeplingRows.map((k) => {
                    const entry = draftEntries[k.keplingId] || {
                      keplingId: k.keplingId,
                      nomorLingkungan: k.nomorLingkungan,
                      namaKepling: k.namaKepling,
                      jabatan: k.jabatan,
                      status: 'Hadir' as StatusKehadiranKepling,
                      catatan: '',
                    };
                    return (
                      <tr key={k.keplingId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-500 tabular-nums">
                          {k.nomorLingkungan}
                        </td>
                        <td className="py-2.5 px-3 font-black text-slate-900 whitespace-nowrap">
                          {k.namaKepling}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                          {k.jabatan}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {STATUS_OPTIONS.map((st) => {
                              const active = entry.status === st;
                              const activeClass =
                                st === 'Hadir'
                                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                  : st === 'Tidak Hadir'
                                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                  : st === 'Sakit'
                                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                                  : 'bg-blue-600 text-white border-blue-700 shadow-xs';
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleStatusChange(k.keplingId, st)}
                                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                                    active
                                      ? activeClass
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-2 px-3 min-w-[170px]">
                          <input
                            type="text"
                            value={entry.catatan || ''}
                            onChange={(e) => handleCatatanChange(k.keplingId, e.target.value)}
                            placeholder="Alasan / keterangan singkat..."
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* KONTEN UTAMA MODE MINGGUAN & BULANAN */}
      {periodMode !== 'harian' && (
        <div className="space-y-5">
          {/* Statistik Periode */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <p className="text-[11px] font-bold text-slate-500">Agenda Periode Ini</p>
              <p className="text-lg font-black text-slate-900 tabular-nums mt-0.5">
                {activeRecap.totalAgendasCount} Agenda
              </p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200">
              <p className="text-[11px] font-bold text-emerald-700">Akumulasi Hadir</p>
              <p className="text-lg font-black text-emerald-900 tabular-nums mt-0.5">
                {activeRecap.totals.hadir}
              </p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-rose-200">
              <p className="text-[11px] font-bold text-rose-700">Tidak Hadir</p>
              <p className="text-lg font-black text-rose-900 tabular-nums mt-0.5">
                {activeRecap.totals.tidakHadir}
              </p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-amber-200">
              <p className="text-[11px] font-bold text-amber-800">Sakit</p>
              <p className="text-lg font-black text-amber-950 tabular-nums mt-0.5">
                {activeRecap.totals.sakit}
              </p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-blue-200 col-span-2 sm:col-span-1">
              <p className="text-[11px] font-bold text-blue-700">Izin</p>
              <p className="text-lg font-black text-blue-950 tabular-nums mt-0.5">
                {activeRecap.totals.izin}
              </p>
            </div>
          </div>

          {/* Daftar Agenda dalam Periode */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>
                  Agenda Kelurahan dalam Periode ({activePeriodAgendas.length} Kegiatan)
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsPdfPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak PDF Rekap {periodMode === 'mingguan' ? 'Mingguan' : 'Bulanan'}</span>
              </button>
            </div>

            {activeRecap.agendaSummaries.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                Belum ada Agenda Kelurahan yang terjadwal pada periode {periodMode === 'mingguan' ? weekRange.label : monthRange.label}.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">No</th>
                      <th className="py-2.5 px-3">Hari / Tanggal</th>
                      <th className="py-2.5 px-3">Nama Kegiatan</th>
                      <th className="py-2.5 px-3">Lokasi</th>
                      <th className="py-2.5 px-3 text-center">Hadir</th>
                      <th className="py-2.5 px-3 text-center">Tidak Hadir</th>
                      <th className="py-2.5 px-3 text-center">Sakit</th>
                      <th className="py-2.5 px-3 text-center">Izin</th>
                      <th className="py-2.5 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activeRecap.agendaSummaries.map((s, idx) => (
                      <tr key={s.agenda.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-500 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                          {formatHariTanggalIndonesia(s.agenda.tanggalKegiatan)}
                        </td>
                        <td className="py-2.5 px-3 font-black text-slate-900">
                          {s.agenda.namaKegiatan}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{s.agenda.lokasi}</td>
                        {s.hasSavedRecord ? (
                          <>
                            <td className="py-2.5 px-3 text-center font-black text-emerald-700 tabular-nums">
                              {s.hadir}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-rose-700 tabular-nums">
                              {s.tidakHadir}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-amber-700 tabular-nums">
                              {s.sakit}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-blue-700 tabular-nums">
                              {s.izin}
                            </td>
                          </>
                        ) : (
                          <td colSpan={4} className="py-2.5 px-3 text-center text-amber-700 font-bold">
                            Belum Diabsen
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenAgendaForEdit(s.agenda)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold cursor-pointer whitespace-nowrap"
                          >
                            {s.hasSavedRecord ? 'Edit Absensi' : 'Isi Absensi'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tabel Rekapitulasi 24 Kepala Lingkungan */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Rekapitulasi Kehadiran 24 Kepala Lingkungan</span>
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">No.</th>
                    <th className="py-2.5 px-3">Nama</th>
                    <th className="py-2.5 px-3">Jabatan</th>
                    <th className="py-2.5 px-3 text-center">Hadir</th>
                    <th className="py-2.5 px-3 text-center">Tidak Hadir</th>
                    <th className="py-2.5 px-3 text-center">Sakit</th>
                    <th className="py-2.5 px-3 text-center">Izin</th>
                    <th className="py-2.5 px-3 text-center">% Hadir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeRecap.keplingRecap.map((row) => (
                    <tr key={row.keplingId} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 tabular-nums">
                        {row.no}
                      </td>
                      <td className="py-2 px-3 font-black text-slate-900">{row.namaKepling}</td>
                      <td className="py-2 px-3 font-medium text-slate-700">{row.jabatan}</td>
                      <td className="py-2 px-3 text-center font-black text-emerald-700 tabular-nums">
                        {row.hadir}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-rose-700 tabular-nums">
                        {row.tidakHadir}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-amber-700 tabular-nums">
                        {row.sakit}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-blue-700 tabular-nums">
                        {row.izin}
                      </td>
                      <td className="py-2 px-3 text-center font-black text-slate-900 tabular-nums">
                        {row.totalRecorded > 0 ? `${row.pct.toFixed(0)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRATINJAU & CETAK PDF RESMI LENGKAP DENGAN KOP SURAT */}
      {isPdfPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-xs print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
            {/* Modal Toolbar */}
            <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-black">
                    Pratinjau Dokumen Resmi PDF — Daftar Hadir Kepala Lingkungan
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Periode: {pdfMeta.hariTanggal}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-black cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{isDownloadingPdf ? 'Membuat PDF...' : 'Unduh PDF (.pdf)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Print PDF (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPdfPreviewOpen(false)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Pengaturan Penandatangan & Opsi Cetak */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs shrink-0">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Jabatan Penandatangan
                </label>
                <select
                  value={signerConfig.jabatan}
                  onChange={(e) =>
                    setSignerConfig((prev) => ({ ...prev, jabatan: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800"
                >
                  <option value="Lurah Mangga">Lurah Mangga</option>
                  <option value="Lurah Kelurahan Mangga">Lurah Kelurahan Mangga</option>
                  <option value="Sekretaris Lurah Kelurahan Mangga">
                    Sekretaris Lurah Kelurahan Mangga
                  </option>
                  <option value="An. Lurah Kelurahan Mangga / Sekretaris Lurah">
                    An. Lurah / Sekretaris Lurah Mangga
                  </option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Nama Pejabat Penandatangan
                </label>
                <input
                  type="text"
                  value={signerConfig.nama}
                  onChange={(e) =>
                    setSignerConfig((prev) => ({ ...prev, nama: e.target.value }))
                  }
                  placeholder="cth. Feriyanto Arapenta Tarigan, A.Md"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  NIP (Opsional)
                </label>
                <input
                  type="text"
                  value={signerConfig.nip}
                  onChange={(e) =>
                    setSignerConfig((prev) => ({ ...prev, nip: e.target.value }))
                  }
                  placeholder="cth. 198502152010011012"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Nomor Dokumen (Opsional)
                </label>
                <input
                  type="text"
                  value={signerConfig.nomorSurat}
                  onChange={(e) =>
                    setSignerConfig((prev) => ({ ...prev, nomorSurat: e.target.value }))
                  }
                  placeholder="cth. 800 / 125 / MANGGA / XI / 2026"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                />
              </div>

              {periodMode !== 'harian' && (
                <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 pt-1">
                  <input
                    id="chk-detail-per-agenda"
                    type="checkbox"
                    checked={includePerAgendaDetailInRecap}
                    onChange={(e) => setIncludePerAgendaDetailInRecap(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 cursor-pointer"
                  />
                  <label
                    htmlFor="chk-detail-per-agenda"
                    className="text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    Sertakan lampiran rincian daftar hadir untuk setiap agenda dalam periode ini
                  </label>
                </div>
              )}
            </div>

            {/* Area Kertas A4 untuk Cetak & PDF */}
            <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-200 flex justify-center">
              <div
                id="lembar-cetak-absensi-kepling"
                className="bg-white w-full max-w-[820px] p-6 sm:p-10 shadow-xl border border-slate-300 text-black"
                style={{
                  fontFamily: "'Times New Roman', Times, serif",
                  color: '#000000',
                  backgroundColor: '#ffffff',
                }}
              >
                {/* 1. KOP SURAT RESMI KELURAHAN MANGGA */}
                <KopSuratResmi />

                {/* 2. JUDUL DOKUMEN */}
                <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '14px' }}>
                  <div
                    style={{
                      fontSize: '13.5pt',
                      fontWeight: 'bold',
                      textDecoration: 'underline',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    DAFTAR HADIR KEPALA LINGKUNGAN
                  </div>
                  {pdfMeta.subtitle && (
                    <div
                      style={{
                        fontSize: '10.5pt',
                        fontWeight: 'bold',
                        marginTop: '3px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {pdfMeta.subtitle}
                    </div>
                  )}
                  {signerConfig.nomorSurat.trim() && (
                    <div style={{ fontSize: '9.5pt', marginTop: '2px' }}>
                      Nomor : {signerConfig.nomorSurat.trim()}
                    </div>
                  )}
                </div>

                {/* 3. IDENTITAS HARI / TANGGAL & AGENDA */}
                <table
                  className="no-print-border"
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginBottom: '12px',
                    fontSize: '10pt',
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ width: '165px', fontWeight: 'bold', padding: '2px 4px', verticalAlign: 'top', border: 'none' }}>
                        HARI / TANGGAL
                      </td>
                      <td style={{ width: '14px', padding: '2px 4px', verticalAlign: 'top', border: 'none' }}>
                        :
                      </td>
                      <td style={{ padding: '2px 4px', fontWeight: 'bold', verticalAlign: 'top', border: 'none' }}>
                        {pdfMeta.hariTanggal}
                      </td>
                    </tr>

                    {periodMode === 'harian' && activeAgenda ? (
                      <>
                        <tr>
                          <td style={{ fontWeight: 'bold', padding: '2px 4px', verticalAlign: 'top', border: 'none' }}>
                            AGENDA / KEGIATAN
                          </td>
                          <td style={{ padding: '2px 4px', verticalAlign: 'top', border: 'none' }}>:</td>
                          <td style={{ padding: '2px 4px', fontWeight: 'bold', verticalAlign: 'top', border: 'none' }}>
                            {activeAgenda.namaKegiatan}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 'bold', padding: '2px 4px', verticalAlign: 'top', border: 'none' }}>
                            WAKTU / TEMPAT
                          </td>
                          <td style={{ padding: '2px 4px', verticalAlign: 'top', border: 'none' }}>:</td>
                          <td style={{ padding: '2px 4px', verticalAlign: 'top', border: 'none' }}>
                            {activeAgenda.jamKegiatan ? `${activeAgenda.jamKegiatan} · ` : ''}
                            {activeAgenda.lokasi || 'Kantor Kelurahan Mangga'}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td style={{ fontWeight: 'bold', padding: '2px 4px', verticalAlign: 'top', border: 'none' }}>
                          AGENDA KELURAHAN
                        </td>
                        <td style={{ padding: '2px 4px', verticalAlign: 'top', border: 'none' }}>:</td>
                        <td style={{ padding: '2px 4px', verticalAlign: 'top', border: 'none' }}>
                          {activePeriodAgendas.length === 0
                            ? 'Belum ada agenda terjadwal pada periode ini'
                            : `${activePeriodAgendas.length} Kegiatan (${activeRecap.recordedAgendasCount} Agenda Tercatat Absensi)`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* 4A. TABEL DAFTAR HADIR HARIAN */}
                {periodMode === 'harian' && (
                  <>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '9.5pt',
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={{ border: '1px solid #000', padding: '6px 5px', textAlign: 'center', width: '38px', backgroundColor: '#f1f5f9' }}>
                            No.
                          </th>
                          <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left', backgroundColor: '#f1f5f9' }}>
                            Nama
                          </th>
                          <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left', width: '190px', backgroundColor: '#f1f5f9' }}>
                            Jabatan
                          </th>
                          <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'center', width: '185px', backgroundColor: '#f1f5f9' }}>
                            Keterangan
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {keplingMasterList.map((k, idx) => {
                          const entry = draftEntries[k.keplingId];
                          const status = entry?.status || 'Hadir';
                          const catatan = (entry?.catatan || '').trim();
                          return (
                            <tr key={k.keplingId}>
                              <td style={{ border: '1px solid #000', padding: '4.5px 5px', textAlign: 'center' }}>
                                {idx + 1}.
                              </td>
                              <td style={{ border: '1px solid #000', padding: '4.5px 8px', fontWeight: 'bold' }}>
                                {k.namaKepling}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '4.5px 8px' }}>
                                {k.jabatan}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '4.5px 8px', textAlign: 'center', fontWeight: 'bold' }}>
                                {status}
                                {catatan ? (
                                  <span style={{ fontWeight: 'normal', fontSize: '8.5pt' }}>
                                    {' '}
                                    ({catatan})
                                  </span>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Ringkasan Harian */}
                    <div
                      className="avoid-break"
                      style={{
                        marginTop: '10px',
                        padding: '7px 10px',
                        border: '1px solid #000',
                        fontSize: '9pt',
                        backgroundColor: '#f8fafc',
                      }}
                    >
                      <strong>Rekapitulasi Kehadiran:</strong> Hadir: <strong>{activeDailyStats.hadir}</strong> Orang &nbsp;|&nbsp; Tidak Hadir:{' '}
                      <strong>{activeDailyStats.tidakHadir}</strong> Orang &nbsp;|&nbsp; Sakit: <strong>{activeDailyStats.sakit}</strong> Orang &nbsp;|&nbsp; Izin:{' '}
                      <strong>{activeDailyStats.izin}</strong> Orang &nbsp;|&nbsp; Total: <strong>{activeDailyStats.total}</strong> Kepala Lingkungan ({activeDailyStats.pct.toFixed(1)}%)
                    </div>
                  </>
                )}

                {/* 4B. TABEL REKAPITULASI MINGGUAN / BULANAN */}
                {periodMode !== 'harian' && (
                  <>
                    <div style={{ fontSize: '10pt', fontWeight: 'bold', marginBottom: '5px' }}>
                      A. Rekapitulasi Kehadiran Kepala Lingkungan ({pdfMeta.hariTanggal})
                    </div>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '9pt',
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', width: '34px', backgroundColor: '#f1f5f9' }}>
                            No.
                          </th>
                          <th style={{ border: '1px solid #000', padding: '5px 7px', textAlign: 'left', backgroundColor: '#f1f5f9' }}>
                            Nama
                          </th>
                          <th style={{ border: '1px solid #000', padding: '5px 7px', textAlign: 'left', width: '165px', backgroundColor: '#f1f5f9' }}>
                            Jabatan
                          </th>
                          <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', width: '48px', backgroundColor: '#f1f5f9' }}>
                            Hadir
                          </th>
                          <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', width: '58px', backgroundColor: '#f1f5f9' }}>
                            Tidak Hadir
                          </th>
                          <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', width: '46px', backgroundColor: '#f1f5f9' }}>
                            Sakit
                          </th>
                          <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center', width: '46px', backgroundColor: '#f1f5f9' }}>
                            Izin
                          </th>
                          <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'center', width: '115px', backgroundColor: '#f1f5f9' }}>
                            Keterangan
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeRecap.keplingRecap.map((row) => (
                          <tr key={row.keplingId}>
                            <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>
                              {row.no}.
                            </td>
                            <td style={{ border: '1px solid #000', padding: '4px 7px', fontWeight: 'bold' }}>
                              {row.namaKepling}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '4px 7px' }}>
                              {row.jabatan}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                              {row.hadir}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>
                              {row.tidakHadir}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>
                              {row.sakit}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>
                              {row.izin}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', fontSize: '8.5pt' }}>
                              {row.totalRecorded > 0 ? `${row.pct.toFixed(0)}% Hadir` : 'Belum Diabsen'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Lampiran Rincian Daftar Hadir Per Agenda */}
                    {includePerAgendaDetailInRecap && activePeriodAgendas.length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '10pt', fontWeight: 'bold', marginBottom: '6px' }}>
                          B. Rincian Daftar Hadir Per Agenda Kelurahan
                        </div>
                        {activePeriodAgendas.map((ag, agIdx) => {
                          const rec = recordsByAgendaId[ag.id] || null;
                          const entries = buildMergedEntriesForAgenda(rec, 'Hadir');
                          return (
                            <div
                              key={ag.id}
                              className="avoid-break"
                              style={{ marginBottom: '14px' }}
                            >
                              <div
                                style={{
                                  fontSize: '9.5pt',
                                  fontWeight: 'bold',
                                  marginBottom: '4px',
                                  padding: '4px 6px',
                                  backgroundColor: '#f8fafc',
                                  border: '1px solid #000',
                                }}
                              >
                                {agIdx + 1}. HARI / TANGGAL: {formatHariTanggalIndonesia(ag.tanggalKegiatan)} — {ag.namaKegiatan} ({ag.lokasi || 'Kelurahan Mangga'})
                                {!rec && ' [Belum Diabsen]'}
                              </div>
                              {rec && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ border: '1px solid #000', padding: '3.5px 4px', textAlign: 'center', width: '32px', backgroundColor: '#f1f5f9' }}>
                                        No.
                                      </th>
                                      <th style={{ border: '1px solid #000', padding: '3.5px 6px', textAlign: 'left', backgroundColor: '#f1f5f9' }}>
                                        Nama
                                      </th>
                                      <th style={{ border: '1px solid #000', padding: '3.5px 6px', textAlign: 'left', width: '165px', backgroundColor: '#f1f5f9' }}>
                                        Jabatan
                                      </th>
                                      <th style={{ border: '1px solid #000', padding: '3.5px 6px', textAlign: 'center', width: '155px', backgroundColor: '#f1f5f9' }}>
                                        Keterangan
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {keplingMasterList.map((k, kIdx) => {
                                      const entry = entries[k.keplingId];
                                      const cat = (entry?.catatan || '').trim();
                                      return (
                                        <tr key={k.keplingId}>
                                          <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>
                                            {kIdx + 1}.
                                          </td>
                                          <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 'bold' }}>
                                            {k.namaKepling}
                                          </td>
                                          <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                                            {k.jabatan}
                                          </td>
                                          <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'center', fontWeight: 'bold' }}>
                                            {entry?.status || 'Hadir'}
                                            {cat ? ` (${cat})` : ''}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* 5. BLOK TANDA TANGAN RESMI */}
                <div
                  className="avoid-break"
                  style={{
                    marginTop: '24px',
                    display: 'flex',
                    justifyContent: 'flex-end',
                  }}
                >
                  <div style={{ width: '270px', textAlign: 'center', fontSize: '10pt' }}>
                    <div>
                      Medan, {formatTanggalSingkatIndonesia(todayIso)}
                    </div>
                    <div style={{ fontWeight: 'bold', marginTop: '2px' }}>
                      {signerConfig.jabatan || DEFAULT_SIGNER_JABATAN}
                    </div>
                    <div style={{ height: '62px' }} />
                    <div
                      style={{
                        fontWeight: 'bold',
                        textDecoration: 'underline',
                      }}
                    >
                      {signerConfig.nama.trim() || DEFAULT_SIGNER_NAMA}
                    </div>
                    {signerConfig.nip.trim() && (
                      <div style={{ fontSize: '9pt', marginTop: '2px' }}>
                        NIP. {signerConfig.nip.trim()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
