import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, Calendar, UserCheck, AlertTriangle, X, ChevronRight, FileText, Camera } from 'lucide-react';
import { UserAccount } from '../types';
import { getTugasKhususList, TugasKhusus, markTugasKhususCompletedByAccount } from '../lib/tugasKhususService';
import { showSafeNotification } from '../lib/safeNotification';

interface TugasKhususBannerProps {
  activeAccount: UserAccount;
}

export const TugasKhususBanner: React.FC<TugasKhususBannerProps> = ({ activeAccount }) => {
  const [tasks, setTasks] = useState<TugasKhusus[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedTaskIds, setDismissedTaskIds] = useState<string[]>([]);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [confirmTaskToFinish, setConfirmTaskToFinish] = useState<TugasKhusus | null>(null);

  useEffect(() => {
    const loadTasks = () => {
      const all = getTugasKhususList();
      // Filter tasks active and targeted to this account or 'ALL'
      const relevant = all.filter(t => {
        if (t.status !== 'aktif') return false;
        // Check if target matches
        const isForAll = t.targetAccountId === 'ALL' || t.targetRole === 'all';
        const isForThisRole = t.targetRole === activeAccount.role;
        const isForThisAccount = t.targetAccountId === activeAccount.id;
        const targetMatched = isForAll || isForThisRole || isForThisAccount;

        // Check if already completed by this account
        const alreadyCompleted = (t.completedBy || []).includes(activeAccount.id);

        return targetMatched && !alreadyCompleted;
      });
      setTasks(relevant);
    };

    loadTasks();
    window.addEventListener('sikepling_tugas_khusus_updated', loadTasks);
    return () => window.removeEventListener('sikepling_tugas_khusus_updated', loadTasks);
  }, [activeAccount]);

  useEffect(() => {
    if (tasks.length > 0) {
      if (typeof window !== 'undefined') {
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate([250, 150, 250, 150, 500]);
          } catch (e) {}
        }

        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            showSafeNotification('📢 Tugas Khusus Baru dari Lurah', {
              body: tasks[0].judul + '\n' + tasks[0].deskripsi,
            });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                showSafeNotification('📢 Tugas Khusus Baru dari Lurah', {
                  body: tasks[0].judul + '\n' + tasks[0].deskripsi,
                });
              }
            }).catch(() => {});
          }
        }
      }
    }
  }, [tasks]);

  if (tasks.length === 0) return null;

  const currentTask = tasks[currentIndex] || tasks[0];
  if (!currentTask || dismissedTaskIds.includes(currentTask.id)) return null;

  const handleMarkDone = (taskId: string) => {
    markTugasKhususCompletedByAccount(taskId, activeAccount.id);
    setDismissedTaskIds(prev => [...prev, taskId]);
  };

  // Touch swipe handling for mobile

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Swipe left -> next task
        setCurrentIndex((prev) => (prev + 1) % tasks.length);
      } else {
        // Swipe right -> prev task
        setCurrentIndex((prev) => (prev - 1 + tasks.length) % tasks.length);
      }
    }
    setTouchStartX(null);
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="bg-amber-400 text-slate-950 px-4 py-3 shadow-md border-b-2 border-amber-500 relative z-50 animate-fade-in select-none"
    >
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-slate-950 text-amber-400 rounded-lg shadow-sm shrink-0 animate-bounce">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-slate-950 text-amber-300 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                Tugas Khusus Lurah
              </span>
              <span className="text-xs font-extrabold text-slate-900">
                Pemberi: {currentTask.pemberiTugas || 'Lurah Kelurahan Mangga'}
              </span>
              {currentTask.deadline && (
                <span className="text-[11px] font-bold text-rose-900 bg-rose-200/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Deadline: {currentTask.deadline}
                </span>
              )}
            </div>
            <h4 className="font-black text-sm text-slate-950 mt-0.5">
              {currentTask.judul}
            </h4>
            <p className="text-xs text-slate-900 font-medium mt-0.5 leading-relaxed">
              {currentTask.deskripsi}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center shrink-0 flex-wrap">
          {tasks.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500/80 px-2 py-1 rounded-xl text-slate-950 shadow-xs">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev - 1 + tasks.length) % tasks.length)}
                className="w-6 h-6 bg-slate-950 text-amber-300 rounded-lg font-black flex items-center justify-center text-xs hover:bg-slate-900 cursor-pointer shadow-2xs"
                title="Tugas Sebelumnya"
              >
                ‹
              </button>
              <span className="text-xs font-black px-1.5 font-mono">
                {currentIndex + 1} / {tasks.length}
              </span>
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev + 1) % tasks.length)}
                className="w-6 h-6 bg-slate-950 text-amber-300 rounded-lg font-black flex items-center justify-center text-xs hover:bg-slate-900 cursor-pointer shadow-2xs"
                title="Tugas Berikutnya"
              >
                ›
              </button>
            </div>
          )}
          <button
            onClick={() => setConfirmTaskToFinish(currentTask)}
            className="bg-slate-950 hover:bg-slate-900 text-amber-300 font-black px-4 py-2 rounded-lg text-xs shadow-md hover:scale-105 active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Selesai / Mengerti
          </button>
          <button
            onClick={() => setDismissedTaskIds(prev => [...prev, currentTask.id])}
            className="p-1.5 hover:bg-amber-500 rounded-lg text-slate-900 transition-colors cursor-pointer"
            title="Tutup Sementara"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dialog Konfirmasi Tugas Khusus Selesai & Pengecekan Foto Dokumentasi */}
      {confirmTaskToFinish && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Konfirmasi Penyelesaian Tugas
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Apakah Anda yakin tugas <strong className="text-slate-900">"{confirmTaskToFinish.judul}"</strong> telah dilaksanakan di lapangan?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 text-xs text-amber-950 flex items-start gap-2.5">
              <Camera className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Pastikan foto bukti dokumentasi telah diunggah melalui tab <strong>"Daftar Tugas Khusus & Dokumentasi"</strong> sebelum menandai selesai agar laporan dapat diverifikasi oleh Lurah.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmTaskToFinish(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Batal / Periksa Kembali
              </button>
              <button
                type="button"
                onClick={() => {
                  handleMarkDone(confirmTaskToFinish.id);
                  setConfirmTaskToFinish(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Ya, Tandai Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
