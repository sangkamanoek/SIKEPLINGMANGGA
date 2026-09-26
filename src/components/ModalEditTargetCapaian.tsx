import React, { useState, useEffect } from 'react';
import {
  Target,
  Edit3,
  Save,
  RotateCcw,
  X,
  AlertCircle,
  Users,
  CreditCard,
  Smartphone,
  Shield,
  CheckCircle2,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { KeplingTargetCapaian, TargetsCapaianMap, UserAccount } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import { DEFAULT_PERLINSOS_TARGETS, DEFAULT_BPJS_BASELINES } from '../data/targetsData';

interface ModalEditTargetCapaianProps {
  isOpen: boolean;
  onClose: () => void;
  // If specific kepling is selected, edit that kepling. If null, bulk manage mode
  selectedKeplingAccount?: UserAccount | null;
  targetsMap: TargetsCapaianMap;
  // Reported stats computed from actual reports
  reportedStatsMap: Record<
    string,
    { pbb: number; perlinsos: number; ikd: number; bpjs: number; reportCount: number }
  >;
  onSaveKepling: (data: Partial<KeplingTargetCapaian> & { keplingId: string }) => Promise<void>;
  onSaveAll: (allMap: TargetsCapaianMap) => Promise<void>;
  onResetDefaults: () => Promise<void>;
}

export const ModalEditTargetCapaian: React.FC<ModalEditTargetCapaianProps> = ({
  isOpen,
  onClose,
  selectedKeplingAccount,
  targetsMap,
  reportedStatsMap,
  onSaveKepling,
  onSaveAll,
  onResetDefaults,
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [bulkCategory, setBulkCategory] = useState<'bpjs' | 'perlinsos'>('bpjs');
  const [currentKeplingId, setCurrentKeplingId] = useState<string>('kepling_1');
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Single Kepling Form States
  const [targetPerlinsos, setTargetPerlinsos] = useState<number>(300);
  const [targetPbb, setTargetPbb] = useState<number>(100);
  const [targetIkd, setTargetIkd] = useState<number>(50);
  const [targetBpjs, setTargetBpjs] = useState<number>(50);

  const [useOverridePerlinsos, setUseOverridePerlinsos] = useState<boolean>(false);
  const [overridePerlinsos, setOverridePerlinsos] = useState<string>('');

  const [useOverridePbb, setUseOverridePbb] = useState<boolean>(false);
  const [overridePbb, setOverridePbb] = useState<string>('');

  const [useOverrideIkd, setUseOverrideIkd] = useState<boolean>(false);
  const [overrideIkd, setOverrideIkd] = useState<string>('');

  const [useOverrideBpjs, setUseOverrideBpjs] = useState<boolean>(false);
  const [overrideBpjs, setOverrideBpjs] = useState<string>('');

  const [catatanPenyesuaian, setCatatanPenyesuaian] = useState<string>('');

  // Bulk Edit Form State
  const [bulkTargets, setBulkTargets] = useState<TargetsCapaianMap>({});

  // Sync state when modal opens or selectedKeplingAccount changes
  useEffect(() => {
    if (selectedKeplingAccount) {
      setCurrentKeplingId(selectedKeplingAccount.id);
      setActiveTab('single');
    } else {
      setActiveTab('bulk');
    }
  }, [selectedKeplingAccount, isOpen]);

  // Sync single form whenever currentKeplingId changes or targetsMap changes
  useEffect(() => {
    const config = targetsMap[currentKeplingId];
    const reported = reportedStatsMap[currentKeplingId] || {
      pbb: 0,
      perlinsos: 0,
      ikd: 0,
      bpjs: 0,
      reportCount: 0,
    };

    if (config) {
      setTargetPerlinsos(config.targetPerlinsos ?? 300);
      setTargetPbb(config.targetPbb ?? 100);
      setTargetIkd(config.targetIkd ?? 50);
      setTargetBpjs(config.targetBpjs ?? 50);

      if (config.overridePerlinsos !== null && config.overridePerlinsos !== undefined) {
        setUseOverridePerlinsos(true);
        setOverridePerlinsos(String(config.overridePerlinsos));
      } else {
        setUseOverridePerlinsos(false);
        setOverridePerlinsos(String(reported.perlinsos));
      }

      if (config.overridePbb !== null && config.overridePbb !== undefined) {
        setUseOverridePbb(true);
        setOverridePbb(String(config.overridePbb));
      } else {
        setUseOverridePbb(false);
        setOverridePbb(String(reported.pbb));
      }

      if (config.overrideIkd !== null && config.overrideIkd !== undefined) {
        setUseOverrideIkd(true);
        setOverrideIkd(String(config.overrideIkd));
      } else {
        setUseOverrideIkd(false);
        setOverrideIkd(String(reported.ikd));
      }

      if (config.overrideBpjs !== null && config.overrideBpjs !== undefined) {
        setUseOverrideBpjs(true);
        setOverrideBpjs(String(config.overrideBpjs));
      } else {
        setUseOverrideBpjs(false);
        setOverrideBpjs(String(reported.bpjs));
      }

      setCatatanPenyesuaian(config.catatanPenyesuaian || '');
    }

    setBulkTargets(JSON.parse(JSON.stringify(targetsMap)));
  }, [currentKeplingId, targetsMap, reportedStatsMap, isOpen]);

  if (!isOpen) return null;

  const currentKepling =
    KEPLING_ACCOUNTS.find((k) => k.id === currentKeplingId) || KEPLING_ACCOUNTS[0];
  const reportedStats = reportedStatsMap[currentKeplingId] || {
    pbb: 0,
    perlinsos: 0,
    ikd: 0,
    bpjs: 0,
    reportCount: 0,
  };

  const handleSaveSingle = async () => {
    setIsSaving(true);
    setNotification(null);
    try {
      await onSaveKepling({
        keplingId: currentKeplingId,
        nomorLingkungan: currentKepling.nomorLingkungan || 0,
        lingkungan: currentKepling.lingkungan,
        nama: currentKepling.nama,
        targetPerlinsos: Number(targetPerlinsos) || 0,
        targetPbb: Number(targetPbb) || 0,
        targetIkd: Number(targetIkd) || 0,
        targetBpjs: Number(targetBpjs) || 0,
        overridePerlinsos: useOverridePerlinsos ? Number(overridePerlinsos) || 0 : null,
        overridePbb: useOverridePbb ? Number(overridePbb) || 0 : null,
        overrideIkd: useOverrideIkd ? Number(overrideIkd) || 0 : null,
        overrideBpjs: useOverrideBpjs ? Number(overrideBpjs) || 0 : null,
        catatanPenyesuaian: catatanPenyesuaian.trim(),
        updatedBy: 'Super Admin',
      });
      setNotification({
        type: 'success',
        message: `Target & Capaian ${currentKepling.lingkungan} (${currentKepling.nama}) berhasil diperbarui!`,
      });
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Gagal menyimpan perubahan.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBulk = async () => {
    setIsSaving(true);
    setNotification(null);
    try {
      await onSaveAll(bulkTargets);
      setNotification({
        type: 'success',
        message: 'Seluruh target & penyesuaian 24 Kepling berhasil disimpan ke sistem!',
      });
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Gagal menyimpan target.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToOfficialDefaults = async () => {
    if (
      !window.confirm(
        'Apakah Anda yakin ingin mengembalikan seluruh Target PERLINSOS ke 24 angka resmi (Lingk. 1: 429 s/d Lingk. 24: 229)?'
      )
    ) {
      return;
    }
    setIsSaving(true);
    try {
      await onResetDefaults();
      setNotification({
        type: 'success',
        message: 'Target resmi PERLINSOS 24 Kepling berhasil dikembalikan ke standar!',
      });
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Gagal mereset target.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-linear-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-5 sm:p-6 flex items-center justify-between relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-700/80 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                <span>Super Admin Control</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white mt-0.5">
                Kelola Target & Edit Capaian Kepling
              </h3>
              <p className="text-xs text-emerald-100/90">
                Atur target resmi PERLINSOS (KK) dan lakukan penyesuaian total capaian realisasi lapangan.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher: Edit Single Kepling vs Kelola 24 Sekaligus */}
        <div className="flex items-center gap-2 px-6 pt-4 pb-2 border-b border-slate-100 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'single'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Edit Per Kepling (Detail)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bulk')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'bulk'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Tabel Ringkas 24 Kepling (Cepat)
          </button>
        </div>

        {/* Notification banner */}
        {notification && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* ========================================================================= */}
          {/* 1. SINGLE KEPLING TAB                                                     */}
          {/* ========================================================================= */}
          {activeTab === 'single' && (
            <div className="space-y-6">
              {/* Selector Kepling */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Pilih Kepala Lingkungan Yang Akan Dikelola:
                </label>
                <select
                  value={currentKeplingId}
                  onChange={(e) => setCurrentKeplingId(e.target.value)}
                  className="w-full sm:w-80 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-emerald-600 focus:bg-white transition-all cursor-pointer"
                >
                  {KEPLING_ACCOUNTS.map((k, idx) => (
                    <option key={k.id} value={k.id}>
                      {k.lingkungan} • {k.nama} (Target: {DEFAULT_PERLINSOS_TARGETS[idx] ?? 300} KK)
                    </option>
                  ))}
                </select>
              </div>

              {/* Info Card Kepling Terpilih */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-800 text-white font-black text-lg flex items-center justify-center shrink-0">
                    {currentKepling.nomorLingkungan}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">
                      {currentKepling.nama}
                    </h4>
                    <p className="text-xs text-emerald-800 font-semibold">
                      {currentKepling.jabatan} • Kelurahan Mangga
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">
                    Laporan Harian Masuk
                  </span>
                  <span className="text-base font-black text-slate-900">
                    {reportedStats.reportCount} Laporan
                  </span>
                </div>
              </div>

              {/* Section 1: Target Kinerja */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <Target className="w-5 h-5 text-emerald-700" />
                  <h4 className="font-black text-sm text-slate-900">
                    1. Pengaturan Target Kinerja (Kewajiban)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Target Perlinsos (Utama) */}
                  <div className="bg-blue-50/50 p-3.5 rounded-xl border-2 border-blue-200">
                    <label className="block text-[11px] font-black text-blue-900 uppercase mb-1">
                      🎯 Target PERLINSOS (KK)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={targetPerlinsos}
                      onChange={(e) => setTargetPerlinsos(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-lg font-black text-blue-950 focus:outline-blue-600"
                    />
                    <span className="text-[10px] text-blue-700 mt-1 block">
                      Target resmi Pemko: {DEFAULT_PERLINSOS_TARGETS[(currentKepling.nomorLingkungan || 1) - 1] ?? 300} KK
                    </span>
                  </div>

                  {/* Target PBB */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Target Opsir PBB (WP)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={targetPbb}
                      onChange={(e) => setTargetPbb(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-base font-bold text-slate-900 focus:outline-emerald-600"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Wajib Pajak yang dihimbau
                    </span>
                  </div>

                  {/* Target IKD */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Target IKD (Orang)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={targetIkd}
                      onChange={(e) => setTargetIkd(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-base font-bold text-slate-900 focus:outline-purple-600"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Aktivasi KTP Digital
                    </span>
                  </div>

                  {/* Target BPJS TK */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Target BPJS TK (Orang)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={targetBpjs}
                      onChange={(e) => setTargetBpjs(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-base font-bold text-slate-900 focus:outline-amber-600"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Pekerja rentan
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Edit Total Capaian Realisasi Kepling */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-amber-600" />
                    <div>
                      <h4 className="font-black text-sm text-slate-900">
                        2. Edit Total Capaian Realisasi Kepling
                      </h4>
                      <p className="text-xs text-slate-500">
                        Super Admin dapat menyesuaikan langsung total capaian jika terdapat koreksi berkas fisik atau selisih data dari dinas.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Capaian Perlinsos */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-blue-900 uppercase">
                        Capaian PERLINSOS
                      </span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                        Lap: {reportedStats.perlinsos} KK
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="override-perlinsos"
                        checked={useOverridePerlinsos}
                        onChange={(e) => {
                          setUseOverridePerlinsos(e.target.checked);
                          if (e.target.checked && !overridePerlinsos) {
                            setOverridePerlinsos(String(reportedStats.perlinsos));
                          }
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="override-perlinsos" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                        Edit Manual
                      </label>
                    </div>

                    {useOverridePerlinsos ? (
                      <div>
                        <input
                          type="number"
                          min="0"
                          value={overridePerlinsos}
                          onChange={(e) => setOverridePerlinsos(e.target.value)}
                          placeholder="Masukkan total capaian..."
                          className="w-full px-3 py-2 bg-amber-50 border-2 border-amber-400 rounded-lg text-base font-black text-slate-900 focus:outline-amber-600"
                        />
                        <span className="text-[10px] text-amber-800 font-semibold block mt-1">
                          Total akan ditetapkan menjadi: {overridePerlinsos || 0} KK
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-slate-600 py-1.5 px-2 bg-white rounded border border-slate-200">
                        Otomatis dari Laporan ({reportedStats.perlinsos} KK)
                      </div>
                    )}
                  </div>

                  {/* Capaian PBB */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-emerald-900 uppercase">
                        Capaian PBB
                      </span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                        Lap: {reportedStats.pbb} WP
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="override-pbb"
                        checked={useOverridePbb}
                        onChange={(e) => {
                          setUseOverridePbb(e.target.checked);
                          if (e.target.checked && !overridePbb) {
                            setOverridePbb(String(reportedStats.pbb));
                          }
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="override-pbb" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                        Edit Manual
                      </label>
                    </div>

                    {useOverridePbb ? (
                      <div>
                        <input
                          type="number"
                          min="0"
                          value={overridePbb}
                          onChange={(e) => setOverridePbb(e.target.value)}
                          className="w-full px-3 py-2 bg-amber-50 border-2 border-amber-400 rounded-lg text-base font-black text-slate-900 focus:outline-amber-600"
                        />
                        <span className="text-[10px] text-amber-800 font-semibold block mt-1">
                          Ditetapkan: {overridePbb || 0} WP
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-slate-600 py-1.5 px-2 bg-white rounded border border-slate-200">
                        Otomatis dari Laporan ({reportedStats.pbb} WP)
                      </div>
                    )}
                  </div>

                  {/* Capaian IKD */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-purple-900 uppercase">
                        Capaian IKD
                      </span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                        Lap: {reportedStats.ikd} Org
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="override-ikd"
                        checked={useOverrideIkd}
                        onChange={(e) => {
                          setUseOverrideIkd(e.target.checked);
                          if (e.target.checked && !overrideIkd) {
                            setOverrideIkd(String(reportedStats.ikd));
                          }
                        }}
                        className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <label htmlFor="override-ikd" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                        Edit Manual
                      </label>
                    </div>

                    {useOverrideIkd ? (
                      <div>
                        <input
                          type="number"
                          min="0"
                          value={overrideIkd}
                          onChange={(e) => setOverrideIkd(e.target.value)}
                          className="w-full px-3 py-2 bg-amber-50 border-2 border-amber-400 rounded-lg text-base font-black text-slate-900 focus:outline-amber-600"
                        />
                        <span className="text-[10px] text-amber-800 font-semibold block mt-1">
                          Ditetapkan: {overrideIkd || 0} Orang
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-slate-600 py-1.5 px-2 bg-white rounded border border-slate-200">
                        Otomatis dari Laporan ({reportedStats.ikd} Org)
                      </div>
                    )}
                  </div>

                  {/* Capaian BPJS TK */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-amber-900 uppercase">
                        Capaian BPJS TK
                      </span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                        Lap: {reportedStats.bpjs} Org
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="override-bpjs"
                        checked={useOverrideBpjs}
                        onChange={(e) => {
                          setUseOverrideBpjs(e.target.checked);
                          if (e.target.checked && !overrideBpjs) {
                            setOverrideBpjs(String(reportedStats.bpjs));
                          }
                        }}
                        className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <label htmlFor="override-bpjs" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                        Edit Manual
                      </label>
                    </div>

                    {useOverrideBpjs ? (
                      <div>
                        <input
                          type="number"
                          min="0"
                          value={overrideBpjs}
                          onChange={(e) => setOverrideBpjs(e.target.value)}
                          className="w-full px-3 py-2 bg-amber-50 border-2 border-amber-400 rounded-lg text-base font-black text-slate-900 focus:outline-amber-600"
                        />
                        <span className="text-[10px] text-amber-800 font-semibold block mt-1">
                          Ditetapkan: {overrideBpjs || 0} Orang
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-slate-600 py-1.5 px-2 bg-white rounded border border-slate-200">
                        Otomatis dari Laporan ({reportedStats.bpjs} Org)
                      </div>
                    )}
                  </div>
                </div>

                {/* Catatan Penyesuaian */}
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catatan / Alasan Penyesuaian Admin (Opsional):
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Sinkronisasi berkas fisik Dinas Sosial per September 2026..."
                    value={catatanPenyesuaian}
                    onChange={(e) => setCatatanPenyesuaian(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-emerald-600 focus:bg-white text-slate-800"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveSingle}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Target & Capaian'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. BULK 24 KEPLING TAB                                                    */}
          {/* ========================================================================= */}
          {activeTab === 'bulk' && (
            <div className="space-y-4">
              {/* Category Selector Bar */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <button
                  type="button"
                  onClick={() => setBulkCategory('bpjs')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                    bulkCategory === 'bpjs'
                      ? 'bg-teal-800 text-white shadow-md ring-2 ring-teal-600'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Shield className="w-4 h-4 text-amber-300" />
                  <span>Daftar Target BPJS Ketenagakerjaan (50 Orang / Kepling)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBulkCategory('perlinsos')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                    bulkCategory === 'perlinsos'
                      ? 'bg-blue-800 text-white shadow-md ring-2 ring-blue-600'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-blue-300" />
                  <span>Daftar Target PERLINSOS (8.539 KK)</span>
                </button>
              </div>

              {/* Banner Info */}
              <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-2xl p-4 ${
                  bulkCategory === 'bpjs'
                    ? 'bg-teal-50/80 border-teal-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Target
                    className={`w-5 h-5 shrink-0 ${
                      bulkCategory === 'bpjs' ? 'text-teal-700' : 'text-amber-700'
                    }`}
                  />
                  <div>
                    <h5 className="font-black text-slate-900 text-sm">
                      {bulkCategory === 'bpjs'
                        ? 'Daftar Target BPJS TK 24 Kepala Lingkungan'
                        : 'Daftar Target PERLINSOS 24 Kepala Lingkungan'}
                    </h5>
                    <p
                      className={`text-xs ${
                        bulkCategory === 'bpjs' ? 'text-teal-900' : 'text-amber-900'
                      }`}
                    >
                      {bulkCategory === 'bpjs' ? (
                        <>
                          Target resmi setiap Kepling Tahun 2026 adalah{' '}
                          <strong className="text-slate-950">50 Orang</strong> (Total Kelurahan:{' '}
                          <strong className="text-slate-950">1.200 Orang</strong>). Total Capaian Saat Ini:{' '}
                          <strong className="text-slate-950">173 Orang</strong>.
                        </>
                      ) : (
                        <>
                          Total Target Kelurahan Mangga:{' '}
                          <strong className="text-slate-950">8.539 KK</strong>. Anda dapat mengedit
                          target atau override capaian langsung di tabel di bawah.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleResetToOfficialDefaults}
                    disabled={isSaving}
                    className={`px-3 py-1.5 rounded-xl bg-white border font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer ${
                      bulkCategory === 'bpjs'
                        ? 'border-teal-300 text-teal-900 hover:bg-teal-100'
                        : 'border-amber-300 text-amber-900 hover:bg-amber-100'
                    }`}
                    title="Kembalikan target ke standar resmi"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Target Resmi</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBulk}
                    disabled={isSaving}
                    className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Menyimpan...' : 'Simpan Semua'}</span>
                  </button>
                </div>
              </div>

              {/* Table of all 24 Kepling */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-black tracking-wider sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="p-3 text-center w-12">No</th>
                        <th className="p-3">Lingkungan & Nama</th>
                        <th className="p-3 text-center w-36">
                          {bulkCategory === 'bpjs'
                            ? 'Target BPJS TK (Orang)'
                            : 'Target PERLINSOS (KK)'}
                        </th>
                        <th className="p-3 text-center w-32">
                          {bulkCategory === 'bpjs' ? 'Laporan (Orang)' : 'Laporan (KK)'}
                        </th>
                        <th className="p-3 text-center w-40">
                          {bulkCategory === 'bpjs'
                            ? 'Override Capaian (Orang)'
                            : 'Override Capaian (KK)'}
                        </th>
                        <th className="p-3 text-center w-24">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {KEPLING_ACCOUNTS.map((k, index) => {
                        const rowConfig = bulkTargets[k.id] || {
                          keplingId: k.id,
                          targetPerlinsos: DEFAULT_PERLINSOS_TARGETS[index] ?? 300,
                          targetBpjs: 50,
                          overridePerlinsos: null,
                          overrideBpjs: DEFAULT_BPJS_BASELINES[index] ?? null,
                        };
                        const reported = reportedStatsMap[k.id] || {
                          pbb: 0,
                          perlinsos: 0,
                          ikd: 0,
                          bpjs: 0,
                          reportCount: 0,
                        };

                        const isBpjs = bulkCategory === 'bpjs';
                        const currentTarget = isBpjs
                          ? rowConfig.targetBpjs ?? 50
                          : rowConfig.targetPerlinsos ?? DEFAULT_PERLINSOS_TARGETS[index];
                        const reportedVal = isBpjs ? reported.bpjs : reported.perlinsos;
                        const currentOverride = isBpjs
                          ? rowConfig.overrideBpjs
                          : rowConfig.overridePerlinsos;
                        const isOverridden =
                          currentOverride !== null && currentOverride !== undefined;

                        return (
                          <tr key={k.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 text-center font-black text-slate-600">
                              {k.nomorLingkungan}
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{k.lingkungan}</div>
                              <div className="text-[11px] text-slate-500">{k.nama}</div>
                            </td>
                            <td className="p-3 text-center">
                              <input
                                type="number"
                                min="0"
                                value={currentTarget}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setBulkTargets((prev) => ({
                                    ...prev,
                                    [k.id]: {
                                      ...(prev[k.id] || {
                                        keplingId: k.id,
                                        nomorLingkungan: k.nomorLingkungan || index + 1,
                                        lingkungan: k.lingkungan,
                                        nama: k.nama,
                                      }),
                                      [isBpjs ? 'targetBpjs' : 'targetPerlinsos']: val,
                                    },
                                  }));
                                }}
                                className={`w-28 px-2.5 py-1.5 text-center font-black text-sm border rounded-lg focus:outline-emerald-600 ${
                                  isBpjs
                                    ? 'bg-teal-50/60 border-teal-300 text-teal-950'
                                    : 'bg-blue-50/60 border-blue-300 text-blue-950'
                                }`}
                              />
                            </td>
                            <td className="p-3 text-center font-bold text-slate-700">
                              <span className="px-2 py-1 bg-slate-100 rounded-lg">
                                {reportedVal} {isBpjs ? 'Orang' : 'KK'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder={String(reportedVal)}
                                  value={
                                    currentOverride !== null && currentOverride !== undefined
                                      ? currentOverride
                                      : ''
                                  }
                                  onChange={(e) => {
                                    const val =
                                      e.target.value === '' ? null : Number(e.target.value);
                                    setBulkTargets((prev) => ({
                                      ...prev,
                                      [k.id]: {
                                        ...(prev[k.id] || {
                                          keplingId: k.id,
                                          nomorLingkungan: k.nomorLingkungan || index + 1,
                                          lingkungan: k.lingkungan,
                                          nama: k.nama,
                                        }),
                                        [isBpjs ? 'overrideBpjs' : 'overridePerlinsos']: val,
                                      },
                                    }));
                                  }}
                                  className={`w-28 px-2 py-1.5 text-center font-black text-sm rounded-lg border focus:outline-amber-600 ${
                                    isOverridden
                                      ? 'bg-amber-50 border-amber-400 text-amber-950'
                                      : 'bg-slate-50 border-slate-200 text-slate-500'
                                  }`}
                                />
                                {isOverridden && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBulkTargets((prev) => ({
                                        ...prev,
                                        [k.id]: {
                                          ...(prev[k.id] || {}),
                                          [isBpjs ? 'overrideBpjs' : 'overridePerlinsos']: null,
                                        },
                                      }));
                                    }}
                                    className="text-slate-400 hover:text-red-600 p-1"
                                    title="Hapus override, gunakan hitungan laporan asli"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentKeplingId(k.id);
                                  setActiveTab('single');
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                              >
                                Rinci
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveBulk}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Semua 24 Kepling'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
