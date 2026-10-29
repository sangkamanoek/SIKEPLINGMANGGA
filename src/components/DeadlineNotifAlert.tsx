import React, { useState, useEffect } from 'react';
import {
  Bell,
  ClipboardList,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Award,
  Calendar,
  User,
} from 'lucide-react';
import { UserAccount, LaporanHarianItem, isPkkRole } from '../types';
import {
  TugasKhusus,
  getTugasKhususList,
  subscribeTugasKhususFromFirestore,
  subscribeTugasKhususSubmissions,
  getTugasSubmissionsLocal,
} from '../lib/tugasKhususService';

interface DeadlineNotifAlertProps {
  activeAccount: UserAccount;
  reports?: LaporanHarianItem[];
  onNavigate: (tab: any) => void;
  compactMode?: boolean;
}

export const DeadlineNotifAlert: React.FC<DeadlineNotifAlertProps> = ({
  activeAccount,
  onNavigate,
  compactMode = false,
}) => {
  const [tasks, setTasks] = useState<TugasKhusus[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, any>>(() => getTugasSubmissionsLocal());

  useEffect(() => {
    const filterUserTasks = (allTasks: TugasKhusus[]) => {
      const isPkk = isPkkRole(activeAccount.role);
      const isKepling = activeAccount.role === 'kepling';

      const filtered = allTasks.filter((t) => {
        if (t.status !== 'aktif') return false;
        if (t.targetAccountId === 'ALL') return true;
        if (t.targetAccountId === activeAccount.id) return true;

        if (isPkk) {
          return t.targetRole === 'pkk' || t.targetAccountId === 'ALL_PKK';
        }
        if (isKepling) {
          return t.targetRole === 'kepling' || t.targetRole === 'all';
        }
        return true;
      });

      setTasks(filtered);
    };

    filterUserTasks(getTugasKhususList());

    const unsubTasks = subscribeTugasKhususFromFirestore((liveTasks) => {
      if (Array.isArray(liveTasks) && liveTasks.length > 0) {
        filterUserTasks(liveTasks);
      }
    });

    const unsubSubs = subscribeTugasKhususSubmissions((liveSubs) => {
      if (liveSubs && Object.keys(liveSubs).length > 0) {
        setSubmissions(liveSubs);
      }
    });

    return () => {
      if (typeof unsubTasks === 'function') unsubTasks();
      if (typeof unsubSubs === 'function') unsubSubs();
    };
  }, [activeAccount]);

  const displayTask = tasks.length > 0 ? tasks[0] : {
    id: 'tugas_default_1',
    judul: 'Pendataan Tambahan Warga Rentan & Lansia',
    deskripsi: 'Kepada seluruh Kepala Lingkungan agar mendata ulang warga lansia dan disabilitas di wilayah masing-masing untuk validasi data bansos.',
    targetAccountId: 'ALL',
    targetRole: 'kepling',
    pemberiTugas: 'Lurah Kelurahan Mangga',
    tanggalMulai: new Date().toISOString().split('T')[0],
    deadline: '2026-10-31',
    status: 'aktif' as const,
    createdAt: new Date().toISOString(),
    completedBy: [],
  };

  const hasSubmitted = Boolean(submissions[displayTask.id]);

  return (
    <div className="w-full my-3 animate-fade-in">
      <div className="bg-amber-400 text-slate-950 rounded-2xl p-4 sm:p-5 border-2 border-amber-500 shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Background Decorative Element */}
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-36 h-36 bg-amber-300/50 rounded-full blur-xl pointer-events-none" />

        {/* Content Section */}
        <div className="space-y-1.5 relative z-10 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-950 text-amber-300 text-[10px] font-black uppercase tracking-wider shadow-2xs">
              <Bell className="w-3 h-3 text-amber-400 animate-bounce" />
              <span>INSTRUKSI &amp; TUGAS KHUSUS LURAH</span>
            </span>
            <span className="text-[11px] font-bold text-slate-900/80 flex items-center gap-1">
              <User className="w-3 h-3 text-slate-800" />
              <span>{displayTask.pemberiTugas || 'Lurah Kelurahan Mangga'}</span>
            </span>
          </div>

          <h3 className="text-sm sm:text-base font-black text-slate-950 leading-snug">
            {displayTask.judul}
          </h3>

          <p className="text-xs text-slate-900 font-medium leading-relaxed line-clamp-2">
            {displayTask.deskripsi}
          </p>

          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-900/90 pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-800" />
              <span>Tenggat: {displayTask.deadline || 's/d Akhir Bulan'}</span>
            </span>
            <span aria-hidden="true">•</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
              hasSubmitted ? 'bg-emerald-800 text-white' : 'bg-slate-900 text-white'
            }`}>
              {hasSubmitted ? '✓ Dokumentasi Foto Terkirim' : '⚡ Belum Diunggah'}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="shrink-0 relative z-10">
          <button
            type="button"
            onClick={() => onNavigate('daftar_tugas_khusus')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-amber-300 hover:text-amber-200 font-extrabold text-xs inline-flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <ClipboardList className="w-4 h-4 text-amber-400" />
            <span>Buka &amp; Kirim Bukti Tugas</span>
            <ArrowRight className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
