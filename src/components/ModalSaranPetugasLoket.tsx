import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  X,
  Building2,
  Award,
  AlertCircle,
  Calendar,
  Users,
  RefreshCw,
  Sun,
  UserCheck,
  TrendingUp,
  Clock,
} from 'lucide-react';
import {
  HasilRekomendasiLoketAwalBulan,
  KeplingEvaluasiBulanLalu,
  SaranLoketSlot,
  SHIFT_LOKET_PAGI_WAKTU,
  SHIFT_LOKET_SIANG_WAKTU,
  formatYearMonthLabel,
  getAvailableEvaluationMonths,
} from '../lib/loketRekomendasiService';
import { formatHariTanggalIndonesia } from '../lib/absensiAgendaService';

interface ModalSaranPetugasLoketProps {
  isOpen: boolean;
  onClose: () => void;
  evalYearMonth: string;
  onChangeEvalYearMonth: (ym: string) => void;
  rekomendasi: HasilRekomendasiLoketAwalBulan;
  isLoadingData?: boolean;
  onRefreshData?: () => void;
  onApplyToJadwalLoket: (payload: {
    keplingIds: string[];
    namaPosko: string;
    tanggal: string;
    waktuMulai?: string;
    arahanTugas: string;
  }) => void;
}

export const ModalSaranPetugasLoket: React.FC<ModalSaranPetugasLoketProps> = ({
  isOpen,
  onClose,
  evalYearMonth,
  onChangeEvalYearMonth,
  rekomendasi,
  isLoadingData = false,
  onRefreshData,
  onApplyToJadwalLoket,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'PER_LOKET' | 'EVALUASI_24'>('PER_LOKET');
  const [kategoriFilter, setKategoriFilter] = useState<
    'ALL' | 'PRIORITAS_UTAMA' | 'ROTASI_PEMERATAAN' | 'PENDAMPINGAN_PEMBINAAN'
  >('ALL');
  const [customSelectedIds, setCustomSelectedIds] = useState<string[]>([]);
  const [targetTanggal, setTargetTanggal] = useState<string>(() => rekomendasi.tanggalAwalKerjaTarget);

  React.useEffect(() => {
    setTargetTanggal(rekomendasi.tanggalAwalKerjaTarget);
  }, [rekomendasi.tanggalAwalKerjaTarget]);

  const monthOptions = useMemo(() => getAvailableEvaluationMonths(), []);

  const filteredEvaluasi = useMemo(() => {
    if (kategoriFilter === 'ALL') return rekomendasi.evaluasiSemuaKepling;
    return rekomendasi.evaluasiSemuaKepling.filter((k) => k.kategori === kategoriFilter);
  }, [rekomendasi.evaluasiSemuaKepling, kategoriFilter]);

  if (!isOpen) return null;

  const toggleCustomId = (id: string) => {
    setCustomSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleApplySlotShift = (slot: SaranLoketSlot, shift: 'PAGI' | 'SIANG') => {
    const isPagi = shift === 'PAGI';
    const officer = isPagi
      ? slot.petugasUtama[0] || slot.petugasPendamping[0]
      : slot.petugasPendamping[0] || slot.petugasUtama[0];
    if (!officer) return;

    const waktuMulai = isPagi ? SHIFT_LOKET_PAGI_WAKTU : SHIFT_LOKET_SIANG_WAKTU;
    const sesiLabel = isPagi ? 'Sesi 1 (Pagi 08.15 - 12.30 WIB)' : 'Sesi 2 (Siang 12.30 - 16.30 WIB)';

    const arahanTugas = [
      `Penugasan Piket Loket Awal Bulan ${rekomendasi.targetBulanLabel} berdasarkan Evaluasi ${rekomendasi.evalBulanLabel}.`,
      `${slot.namaLoket} — ${sesiLabel} (1 Orang Petugas): ${officer.namaKepling} (Lingk. ${officer.nomorLingkungan}).`,
      `Fokus Layanan: ${slot.fokusLayanan}.`,
      'Wajib hadir sesuai jadwal sesi piket dan unggah foto kamera langsung di Loket Pelayanan Kantor Lurah.',
    ].join('\n');

    onApplyToJadwalLoket({
      keplingIds: [officer.keplingId],
      namaPosko: `Piket ${slot.kodeLoket} (${isPagi ? 'Sesi 1: 08.15-12.30' : 'Sesi 2: 12.30-16.30'}) — Awal Bulan ${rekomendasi.targetBulanLabel}`,
      tanggal: targetTanggal || rekomendasi.tanggalAwalKerjaTarget,
      waktuMulai,
      arahanTugas,
    });
  };

  const handleApplySingleShiftGeneral = (shift: 'PAGI' | 'SIANG') => {
    const isPagi = shift === 'PAGI';
    const slot0 = rekomendasi.loketAssignments[0];
    const officer = isPagi
      ? slot0?.petugasUtama[0] || rekomendasi.evaluasiSemuaKepling[0]
      : slot0?.petugasPendamping[0] || rekomendasi.evaluasiSemuaKepling[1] || rekomendasi.evaluasiSemuaKepling[0];
    if (!officer) return;

    const waktuMulai = isPagi ? SHIFT_LOKET_PAGI_WAKTU : SHIFT_LOKET_SIANG_WAKTU;
    const sesiLabel = isPagi ? 'Sesi 1 Pagi (08.15 - 12.30 WIB)' : 'Sesi 2 Siang (12.30 - 16.30 WIB)';

    onApplyToJadwalLoket({
      keplingIds: [officer.keplingId],
      namaPosko: `Piket Loket Pelayanan ${isPagi ? 'Sesi Pagi (08.15 - 12.30)' : 'Sesi Siang (12.30 - 16.30)'}`,
      tanggal: targetTanggal || rekomendasi.tanggalAwalKerjaTarget,
      waktuMulai,
      arahanTugas: `Piket Loket Pelayanan ${sesiLabel} — 1 Orang Petugas: ${officer.namaKepling} (Lingk. ${officer.nomorLingkungan}) berdasarkan evaluasi ${rekomendasi.evalBulanLabel}.\nWajib hadir tepat waktu dan melayani warga dengan ramah, cepat, serta unggah foto kehadiran kamera langsung.`,
    });
  };

  const handleApplyAllShift3Loket = (shift: 'PAGI' | 'SIANG') => {
    const isPagi = shift === 'PAGI';
    const waktuMulai = isPagi ? SHIFT_LOKET_PAGI_WAKTU : SHIFT_LOKET_SIANG_WAKTU;
    const sesiLabel = isPagi ? 'Sesi 1 (08.15 - 12.30 WIB)' : 'Sesi 2 (12.30 - 16.30 WIB)';

    const officers = rekomendasi.loketAssignments
      .map((slot) => ({
        slot,
        officer: isPagi ? slot.petugasUtama[0] : slot.petugasPendamping[0],
      }))
      .filter((x) => Boolean(x.officer));

    const ids = Array.from(new Set(officers.map((x) => x.officer!.keplingId)));
    const pembagianLines = officers.map(
      ({ slot, officer }) => `• ${slot.namaLoket} (1 Org): ${officer!.namaKepling} (Lk.${officer!.nomorLingkungan})`
    );

    const arahanTugas = [
      `Pembagian Petugas Piket Loket ${sesiLabel} Awal Bulan ${rekomendasi.targetBulanLabel} (1 Orang per Loket — Evaluasi ${rekomendasi.evalBulanLabel}):`,
      ...pembagianLines,
      'Masing-masing loket diisi 1 petugas Kepling dan wajib unggah foto kehadiran kamera langsung saat bertugas.',
    ].join('\n');

    onApplyToJadwalLoket({
      keplingIds: ids,
      namaPosko: `Piket Loket Pelayanan ${sesiLabel} — Awal Bulan ${rekomendasi.targetBulanLabel}`,
      tanggal: targetTanggal || rekomendasi.tanggalAwalKerjaTarget,
      waktuMulai,
      arahanTugas,
    });
  };

  const handleApplyCustomSelection = () => {
    if (customSelectedIds.length === 0) return;
    const picked = rekomendasi.evaluasiSemuaKepling.filter((k) =>
      customSelectedIds.includes(k.keplingId)
    );
    const listText = picked
      .map((k) => `${k.namaKepling} (Lk.${k.nomorLingkungan}, Skor ${k.skorIkktEvaluasi})`)
      .join(', ');

    onApplyToJadwalLoket({
      keplingIds: customSelectedIds,
      namaPosko: `Piket Loket Pelayanan Awal Bulan ${rekomendasi.targetBulanLabel}`,
      tanggal: targetTanggal || rekomendasi.tanggalAwalKerjaTarget,
      waktuMulai: SHIFT_LOKET_PAGI_WAKTU,
      arahanTugas: `Penugasan Piket Loket Awal Bulan ${rekomendasi.targetBulanLabel} berdasarkan evaluasi ${rekomendasi.evalBulanLabel}.\nPetugas terpilih (${picked.length} orang): ${listText}.`,
    });
  };

  const renderBadgeKategori = (k: KeplingEvaluasiBulanLalu) => {
    if (k.kategori === 'PRIORITAS_UTAMA') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black">
          <Award className="w-3 h-3" />
          Prioritas Utama
        </span>
      );
    }
    if (k.kategori === 'ROTASI_PEMERATAAN') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-black">
          <Users className="w-3 h-3" />
          Pemerataan Rotasi
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-black">
        <AlertCircle className="w-3 h-3" />
        Perlu Pembinaan
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black tracking-tight truncate">
                Saran Petugas Setiap Loket Awal Bulan
              </h3>
              <p className="text-[11px] text-indigo-200 truncate">
                Evaluasi Bulan {rekomendasi.evalBulanLabel} → Rekomendasi Penugasan Awal Bulan{' '}
                {rekomendasi.targetBulanLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRefreshData && (
              <button
                type="button"
                onClick={onRefreshData}
                disabled={isLoadingData}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isLoadingData ? 'Memuat...' : 'Segarkan Data'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50/60">
          {/* Controls & Summary Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                  Bulan Evaluasi (Bulan Sebelumnya)
                </label>
                <select
                  value={evalYearMonth}
                  onChange={(e) => onChangeEvalYearMonth(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.evalYm} value={opt.evalYm}>
                      Evaluasi {opt.evalLabel} (Untuk Awal {opt.targetLabel})
                    </option>
                  ))}
                  {!monthOptions.some((o) => o.evalYm === evalYearMonth) && (
                    <option value={evalYearMonth}>
                      Evaluasi {formatYearMonthLabel(evalYearMonth)}
                    </option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                  Tanggal Jadwal Piket Awal Bulan
                </label>
                <input
                  type="date"
                  value={targetTanggal}
                  onChange={(e) => setTargetTanggal(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {formatHariTanggalIndonesia(targetTanggal || rekomendasi.tanggalAwalKerjaTarget)}
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 shrink-0">
              <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                <div className="text-sm font-black text-emerald-800">
                  {rekomendasi.kandidatUtama.length}
                </div>
                <div className="text-[10px] font-bold text-emerald-700">Prioritas Utama</div>
              </div>
              <div className="px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-center">
                <div className="text-sm font-black text-indigo-800">
                  {rekomendasi.kandidatRotasi.length}
                </div>
                <div className="text-[10px] font-bold text-indigo-700">Siap Rotasi</div>
              </div>
              <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-center">
                <div className="text-sm font-black text-rose-800">
                  {rekomendasi.perluPembinaan.length}
                </div>
                <div className="text-[10px] font-bold text-rose-700">Pembinaan</div>
              </div>
            </div>
          </div>

          {!rekomendasi.hasAnyEvaluationData && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-black">Catatan Data Bulan {rekomendasi.evalBulanLabel}:</span>{' '}
                Belum ditemukan riwayat Apel Pagi, Laporan Harian, atau Jadwal Piket pada bulan{' '}
                <strong>{rekomendasi.evalBulanLabel}</strong>. Saran di bawah menggunakan urutan daftar resmi &amp; rotasi lingkungan. Anda juga dapat memilih bulan evaluasi lain di atas.
              </div>
            </div>
          )}

          {/* Sub-Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex p-1 rounded-xl bg-slate-200/80 border border-slate-300">
              <button
                type="button"
                onClick={() => setActiveSubTab('PER_LOKET')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  activeSubTab === 'PER_LOKET'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Saran Formasi Per Loket (3 Loket)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('EVALUASI_24')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  activeSubTab === 'EVALUASI_24'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Evaluasi Lengkap 24 Kepling ({rekomendasi.evalBulanLabel})</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-600 font-semibold">
              Data Bulan Lalu: <strong>{rekomendasi.totalApelDaysRecorded}</strong> hari apel •{' '}
              <strong>{rekomendasi.totalReportsLastMonth}</strong> laporan •{' '}
              <strong>{rekomendasi.totalLoketSchedulesLastMonth}</strong> jadwal loket
            </div>
          </div>

          {activeSubTab === 'PER_LOKET' ? (
            <div className="space-y-4">
              {/* Banner Standar Jam Piket & Penerapan 1 Orang / Sesi */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-0.5 text-xs">
                    <div className="font-black text-indigo-950 flex flex-wrap items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>
                        Jam Piket Loket: Sesi 1 (08.15 – 12.30 WIB) &amp; Sesi 2 (12.30 – 16.30 WIB) • Per Piket 1 Orang
                      </span>
                    </div>
                    <p className="text-[11px] text-indigo-800">
                      Setiap sesi piket dijadwalkan <strong>1 orang petugas</strong> (atau 1 orang per loket). Penentuan diprioritaskan bagi Kepling bebas Alpa Apel Pagi (-3.0 poin), bebas Tidak Hadir Posko/Agenda (-1.5 poin), konsisten melapor, serta pemerataan rotasi bulan lalu.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleApplySingleShiftGeneral('PAGI')}
                      className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-xs cursor-pointer transition-colors"
                    >
                      1 Org Sesi Pagi (08.15–12.30)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplySingleShiftGeneral('SIANG')}
                      className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-xs cursor-pointer transition-colors"
                    >
                      1 Org Sesi Siang (12.30–16.30)
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-indigo-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold text-indigo-900">
                    Atau jadwalkan gabungan 3 Loket sekaligus (masing-masing loket 1 orang per sesi):
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApplyAllShift3Loket('PAGI')}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-300 font-black text-[11px] cursor-pointer"
                    >
                      3 Loket Pagi (08.15–12.30)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyAllShift3Loket('SIANG')}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-300 font-black text-[11px] cursor-pointer"
                    >
                      3 Loket Siang (12.30–16.30)
                    </button>
                  </div>
                </div>
              </div>

              {/* 3 Loket Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {rekomendasi.loketAssignments.map((slot) => (
                  <div
                    key={slot.kodeLoket}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-block px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase">
                              {slot.kodeLoket}
                            </span>
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                              1 Org / Sesi Piket
                            </span>
                          </div>
                          <h4 className="text-sm font-black text-slate-900 mt-1">
                            {slot.namaLoket}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {slot.fokusLayanan}
                          </p>
                        </div>
                      </div>

                      {/* Sesi 1: 08.15 - 12.30 WIB (1 Orang) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                            Sesi 1 (08.15 – 12.30 WIB)
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black">
                            1 Orang
                          </span>
                        </div>
                        {slot.petugasUtama.map((k) => (
                          <div
                            key={k.keplingId}
                            className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-black text-slate-900 truncate">
                                  Lingk. {k.nomorLingkungan} — {k.namaKepling}
                                </div>
                                <div className="text-[10px] text-slate-600">
                                  IKKT: <strong>{k.skorIkktEvaluasi}</strong> • Apel:{' '}
                                  <strong>{k.apelPercentage}%</strong>
                                  {k.apelAlpa > 0 && (
                                    <span className="text-rose-700 font-black">
                                      {' '}
                                      ({k.apelAlpa} Alpa)
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black shrink-0">
                                Skor {k.skorKesiapanLoket}
                              </span>
                            </div>
                            <ul className="space-y-0.5 text-[10px] text-slate-700">
                              {k.alasanRekomendasi.slice(0, 2).map((alasan, idx) => (
                                <li key={idx} className="flex items-start gap-1">
                                  <span className="text-emerald-600 font-bold">•</span>
                                  <span>{alasan}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>

                      {/* Sesi 2: 12.30 - 16.30 WIB (1 Orang) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                            Sesi 2 (12.30 – 16.30 WIB)
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[9px] font-black">
                            1 Orang
                          </span>
                        </div>
                        {slot.petugasPendamping.map((k) => (
                          <div
                            key={k.keplingId}
                            className={`p-2.5 rounded-xl border space-y-1 ${
                              k.catatanPembinaan
                                ? 'bg-amber-50/80 border-amber-200'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-black text-slate-900 truncate">
                                  Lingk. {k.nomorLingkungan} — {k.namaKepling}
                                </div>
                                <div className="text-[10px] text-slate-600">
                                  Piket Loket lalu: <strong>{k.loketAssignedCount}x</strong> •{' '}
                                  Lapor: <strong>{k.hariMelapor} hr</strong>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-black shrink-0">
                                {k.skorKesiapanLoket}
                              </span>
                            </div>
                            {k.catatanPembinaan ? (
                              <p className="text-[10px] text-amber-900 font-semibold leading-snug">
                                {k.catatanPembinaan}
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-600 leading-snug">
                                {k.alasanRekomendasi[1] || k.alasanRekomendasi[0]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="px-3.5 py-3 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplySlotShift(slot, 'PAGI')}
                        className="py-2 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
                      >
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>Pagi 08.15–12.30</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplySlotShift(slot, 'SIANG')}
                        className="py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
                      >
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>Siang 12.30–16.30</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Catatan Pembinaan jika ada Kepling dengan Alpa / Tidak Hadir */}
              {rekomendasi.perluPembinaan.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-rose-900">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Catatan Pembinaan Kedisiplinan ({rekomendasi.perluPembinaan.length} Kepling — Bulan {rekomendasi.evalBulanLabel})
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-800">
                    Kepling berikut memiliki catatan <strong>Alpa Apel Pagi</strong> (-3.0 poin/alpa) atau <strong>Tidak Hadir Posko/Agenda</strong> (-1.5 poin) pada bulan lalu. Disarankan tidak menjadi petugas utama sendirian di awal bulan, melainkan didampingi oleh petugas prioritas utama atau diberi penjadwalan khusus agar kedisiplinannya meningkat.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {rekomendasi.perluPembinaan.slice(0, 6).map((k) => (
                      <div
                        key={k.keplingId}
                        className="p-2 rounded-lg bg-white border border-rose-200 text-[11px]"
                      >
                        <div className="font-black text-slate-900">
                          Lingk. {k.nomorLingkungan} — {k.namaKepling}
                        </div>
                        <div className="text-[10px] text-rose-700 font-bold mt-0.5">
                          Penalti: -{k.penaltiTanpaKeterangan} poin • Apel Alpa: {k.apelAlpa}x • Posko/Agenda TH: {k.poskoTidakHadirCount + k.agendaTidakHadir}x
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: EVALUASI LENGKAP 24 KEPLING */
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      ['ALL', `Semua (${rekomendasi.evaluasiSemuaKepling.length})`],
                      ['PRIORITAS_UTAMA', `Prioritas Utama (${rekomendasi.kandidatUtama.length})`],
                      ['ROTASI_PEMERATAAN', `Pemerataan Rotasi (${rekomendasi.kandidatRotasi.length})`],
                      ['PENDAMPINGAN_PEMBINAAN', `Perlu Pembinaan (${rekomendasi.perluPembinaan.length})`],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setKategoriFilter(key)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border cursor-pointer transition-colors ${
                        kategoriFilter === key
                          ? 'bg-indigo-600 text-white border-indigo-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {customSelectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyCustomSelection}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Jadwalkan {customSelectedIds.length} Kepling Terpilih</span>
                  </button>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                        <th className="p-2.5 text-center w-10">Pilih</th>
                        <th className="p-2.5 w-10 text-center">No</th>
                        <th className="p-2.5">Kepala Lingkungan</th>
                        <th className="p-2.5">Kategori Saran</th>
                        <th className="p-2.5 text-center">Skor Kesiapan</th>
                        <th className="p-2.5 text-center">Apel Pagi</th>
                        <th className="p-2.5 text-center">Loket Lalu</th>
                        <th className="p-2.5 text-center">Lapor</th>
                        <th className="p-2.5">Alasan &amp; Catatan Evaluasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredEvaluasi.map((k, idx) => {
                        const checked = customSelectedIds.includes(k.keplingId);
                        return (
                          <tr
                            key={k.keplingId}
                            onClick={() => toggleCustomId(k.keplingId)}
                            className={`cursor-pointer transition-colors ${
                              checked ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCustomId(k.keplingId)}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="p-2.5 text-center font-bold text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="p-2.5">
                              <div className="font-black text-slate-900">{k.namaKepling}</div>
                              <div className="text-[10px] text-slate-500">
                                Lingkungan {k.nomorLingkungan} • IKKT {k.skorIkktEvaluasi}
                              </div>
                            </td>
                            <td className="p-2.5">{renderBadgeKategori(k)}</td>
                            <td className="p-2.5 text-center">
                              <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-black text-[11px]">
                                {k.skorKesiapanLoket}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="inline-flex items-center gap-1 font-bold text-slate-800">
                                <Sun className="w-3 h-3 text-amber-500" />
                                <span>{k.apelPercentage}%</span>
                              </div>
                              {k.apelAlpa > 0 && (
                                <div className="text-[10px] font-black text-rose-600">
                                  {k.apelAlpa} Alpa (-{(k.apelAlpa * 3).toFixed(1)})
                                </div>
                              )}
                            </td>
                            <td className="p-2.5 text-center font-bold text-slate-700">
                              {k.loketHadirCount}/{k.loketAssignedCount}x
                            </td>
                            <td className="p-2.5 text-center font-bold text-slate-700">
                              {k.hariMelapor} hr
                            </td>
                            <td className="p-2.5 text-[11px] text-slate-600 max-w-xs">
                              {k.catatanPembinaan ? (
                                <span className="text-rose-700 font-semibold">
                                  {k.catatanPembinaan}
                                </span>
                              ) : (
                                <span>{k.alasanRekomendasi[0]}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <p className="text-[11px] text-slate-500">
            Pilih saran per loket atau pilih manual dari tabel evaluasi untuk langsung membuat Jadwal Piket Loket Pelayanan.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
