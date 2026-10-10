import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, Calendar, UserCheck, AlertTriangle, X, ChevronRight, FileText } from 'lucide-react';
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
          {tasks.length > 1 && (
            <div className="flex items-center gap-1 bg-amber-500/80 px-2 py-1 rounded text-slate-950">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev - 1 + tasks.length) % tasks.length)}
                className="w-5 h-5 bg-slate-950 text-amber-300 rounded font-bold flex items-center justify-center text-xs hover:bg-slate-900 cursor-pointer"
                title="Tugas Sebelumnya"
              >
                ‹
              </button>
              <span className="text-[11px] font-bold px-1">
                {currentIndex + 1} / {tasks.length}
              </span>
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev + 1) % tasks.length)}
                className="w-5 h-5 bg-slate-950 text-amber-300 rounded font-bold flex items-center justify-center text-xs hover:bg-slate-900 cursor-pointer"
                title="Tugas Selanjutnya"
              >
                ›
              </button>
            </div>
          )}
          <button
            onClick={() => handleMarkDone(currentTask.id)}
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
    </div>
  );
};
