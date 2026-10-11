import React, { useState, useEffect } from 'react';
import { ClipboardList, Bell, Calendar, CheckCircle2, Camera, Upload, Check, AlertCircle, X, Shield, FileText, RefreshCw } from 'lucide-react';
import { UserAccount } from '../types';
import {
  getTugasKhususList,
  TugasKhusus,
  subscribeTugasKhususFromFirestore,
  subscribeTugasKhususSubmissions,
  saveTugasKhususSubmission,
  getTugasSubmissionsLocal,
  compressTugasFoto,
  TugasFotoSubmissionItem,
} from '../lib/tugasKhususService';

interface DaftarTugasKhususViewProps {
  currentUser: UserAccount;
}

export const DaftarTugasKhususView: React.FC<DaftarTugasKhususViewProps> = ({ currentUser }) => {
  const [tasks, setTasks] = useState<TugasKhusus[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, TugasFotoSubmissionItem>>(() => {
    return getTugasSubmissionsLocal();
  });

  const [selectedTask, setSelectedTask] = useState<TugasKhusus | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string>('');
  const [keterangan, setKeterangan] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const filterAndSet = (all: TugasKhusus[]) => {
      const relevant = all.filter((t) => {
        const isForAll = t.targetAccountId === 'ALL' || t.targetRole === 'all';
        const isForThisRole = t.targetRole === currentUser.role;
        const isForThisAccount = t.targetAccountId === currentUser.id;
        return isForAll || isForThisRole || isForThisAccount;
      });
      setTasks(relevant);
    };

    // Initial load from cache
    filterAndSet(getTugasKhususList());

    // Real-time Firestore subscription
    const unsubTasks = subscribeTugasKhususFromFirestore((liveTasks) => {
      filterAndSet(liveTasks);
    });

    const unsubSubmissions = subscribeTugasKhususSubmissions((liveSubs) => {
      setSubmissions(liveSubs);
    });

    const handleLocalUpdate = () => {
      filterAndSet(getTugasKhususList());
      setSubmissions(getTugasSubmissionsLocal());
    };
    window.addEventListener('sikepling_tugas_khusus_updated', handleLocalUpdate);
    window.addEventListener('sikepling_tugas_khusus_submissions_updated', handleLocalUpdate);

    return () => {
      unsubTasks();
      unsubSubmissions();
      window.removeEventListener('sikepling_tugas_khusus_updated', handleLocalUpdate);
      window.removeEventListener('sikepling_tugas_khusus_submissions_updated', handleLocalUpdate);
    };
  }, [currentUser]);

  const handleOpenTask = (task: TugasKhusus) => {
    setSelectedTask(task);
    const existing = submissions[task.id];
    setFotoUrl(existing?.fotoUrl || '');
    setKeterangan(existing?.keterangan || '');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsCompressing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const res = event.target?.result as string;
      if (res) {
        try {
          // Auto compress to max 800px to ensure quick upload and stay well below 1MB
          const compressed = await compressTugasFoto(res, 800, 0.75);
          setFotoUrl(compressed);
          showToast('Foto dokumentasi berhasil dipilih & dioptimalkan.');
        } catch {
          setFotoUrl(res);
        } finally {
          setIsCompressing(false);
        }
      } else {
        setIsCompressing(false);
      }
    };
    reader.onerror = () => setIsCompressing(false);
    reader.readAsDataURL(file);
  };

  const handleSaveSubmission = async () => {
    if (!selectedTask) return;
    if (!fotoUrl) {
      alert('Mohon unggah foto dokumentasi terlebih dahulu.');
      return;
    }

    setIsSaving(true);
    try {
      await saveTugasKhususSubmission({
        taskId: selectedTask.id,
        accountId: currentUser.id,
        namaKepling: currentUser.nama,
        fotoUrl,
        keterangan,
      });

      showToast(`Dokumentasi tugas "${selectedTask.judul}" berhasil tersinkron ke Lurah via Firebase!`);
      setSelectedTask(null);
    } catch (err: any) {
      alert('Gagal menyimpan dokumentasi: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">✓</div>
          <p className="text-xs font-semibold">{toastMessage}</p>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-900 text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/30 text-amber-100 text-xs font-black uppercase tracking-wider border border-amber-300/30">
              <Bell className="w-3.5 h-3.5 text-amber-300" /> Arahan Resmi Lurah
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Daftar Tugas Khusus & Unggah Dokumentasi
            </h2>
            <p className="text-xs sm:text-sm text-amber-100 max-w-2xl leading-relaxed font-medium">
              Berikut adalah seluruh instruksi dan penugasan khusus dari Lurah Kelurahan Mangga untuk Anda laksanakan. Tekan salah satu tugas untuk melampirkan foto bukti pelaksanaan di lapangan.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-5 py-4 rounded-2xl border border-white/20 text-center shrink-0">
            <span className="text-[10px] uppercase font-bold text-amber-200 block">Total Tugas</span>
            <span className="text-3xl font-black">{tasks.length}</span>
          </div>
        </div>
      </div>

      {/* Grid of Tasks */}
      {tasks.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto text-2xl">
            📋
          </div>
          <h3 className="text-base font-bold text-slate-800">Belum Ada Tugas Khusus Aktif</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Saat ini belum ada instruksi atau tugas khusus baru yang diperintahkan oleh Lurah untuk wilayah Anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tasks.map((task) => {
            const hasSubmitted = Boolean(submissions[task.id]?.fotoUrl);
            const isCompletedByMe = (task.completedBy || []).includes(currentUser.id) || hasSubmitted;

            return (
              <div
                key={task.id}
                onClick={() => handleOpenTask(task)}
                className={`bg-white rounded-3xl p-6 border transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer relative overflow-hidden flex flex-col justify-between group ${
                  isCompletedByMe ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-200 hover:border-amber-400'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      task.status === 'aktif' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {task.status === 'aktif' ? '⚡ Tugas Aktif' : 'Selesai'}
                    </span>
                    {isCompletedByMe ? (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black inline-flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" /> Dokumentasi Terkirim
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold">
                        Belum Unggah Foto
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-amber-700 transition-colors">
                      {task.judul}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-3 font-medium">
                      {task.deskripsi}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Deadline: {task.deadline || 'Tanpa Batas'}
                  </span>
                  <span className="text-amber-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    {hasSubmitted ? 'Ubah Foto' : 'Unggah Foto'} &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Unggah Foto Dokumentasi Tugas */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                  Formulir Dokumentasi Lapangan
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {selectedTask.judul}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs text-amber-950 space-y-1">
                <span className="font-bold block">Instruksi Lurah:</span>
                <p className="leading-relaxed text-amber-900">{selectedTask.deskripsi}</p>
                {selectedTask.deadline && (
                  <p className="text-[11px] font-bold text-rose-700 pt-1">Batas Waktu: {selectedTask.deadline}</p>
                )}
              </div>

              {/* Upload Foto Area */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Bukti Foto Dokumentasi Lapangan <span className="text-rose-600">*</span>
                </label>

                {fotoUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video group">
                    <img src={fotoUrl} alt="Dokumentasi Tugas" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <label htmlFor="change-tugas-foto" className="px-3 py-1.5 bg-white text-slate-900 rounded-xl text-xs font-bold cursor-pointer shadow-md">
                        Ganti Foto
                      </label>
                      <button
                        type="button"
                        onClick={() => setFotoUrl('')}
                        className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-6 text-center transition-colors bg-slate-50">
                    <label htmlFor="change-tugas-foto" className="cursor-pointer flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-amber-800 hover:underline">
                          Klik untuk mengambil / mengunggah foto
                        </span>{' '}
                        <span className="text-slate-500">atau drag & drop</span>
                      </div>
                      <p className="text-[11px] text-slate-400">Mendukung format PNG, JPG dari kamera HP (Kompresi otomatis &lt; 800px)</p>
                    </label>
                  </div>
                )}
                {isCompressing && (
                  <p className="text-xs text-amber-700 font-bold flex items-center gap-1.5 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Mengompresi resolusi foto agar ringan dan cepat...
                  </p>
                )}
                <input
                  id="change-tugas-foto"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {/* Keterangan Pelaksanaan */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Catatan / Keterangan Pelaksanaan (Opsional)
                </label>
                <textarea
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Contoh: Kegiatan pendataan warga lansia di RT 03 telah selesai dilaksanakan dengan baik."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                disabled={isSaving}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveSubmission}
                disabled={isSaving || isCompressing}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all inline-flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan ke Firebase...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Simpan & Kirim Dokumentasi
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
