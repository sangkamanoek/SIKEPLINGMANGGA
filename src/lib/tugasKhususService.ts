export interface TugasKhusus {
  id: string;
  judul: string;
  deskripsi: string;
  targetAccountId: string; // 'ALL' or specific account ID e.g. 'kepling_1'
  targetRole: string; // 'kepling' or 'all'
  pemberiTugas: string; // e.g. "Lurah Kelurahan Mangga"
  tanggalMulai: string;
  deadline: string;
  status: 'aktif' | 'selesai';
  createdAt: string;
  completedBy: string[]; // array of account IDs who completed it
}

const STORAGE_KEY = 'sikepling_tugas_khusus_list';

export function getTugasKhususList(): TugasKhusus[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaultTasks: TugasKhusus[] = [
        {
          id: 'tugas_default_1',
          judul: 'Pendataan Tambahan Warga Rentan & Lansia',
          deskripsi: 'Kepada seluruh Kepala Lingkungan agar mendata ulang warga lansia dan disabilitas di wilayah masing-masing untuk validasi data bansos.',
          targetAccountId: 'ALL',
          targetRole: 'kepling',
          pemberiTugas: 'Lurah Kelurahan Mangga',
          tanggalMulai: new Date().toISOString().split('T')[0],
          deadline: '2026-10-20',
          status: 'aktif',
          createdAt: new Date().toISOString(),
          completedBy: []
        }
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultTasks));
      return defaultTasks;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTugasKhususList(list: TugasKhusus[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('sikepling_tugas_khusus_updated'));
  } catch {}
}

export function addTugasKhusus(task: Omit<TugasKhusus, 'id' | 'createdAt' | 'completedBy'>): TugasKhusus {
  const list = getTugasKhususList();
  const newTask: TugasKhusus = {
    ...task,
    id: 'tugas_' + Date.now(),
    createdAt: new Date().toISOString(),
    completedBy: []
  };
  list.unshift(newTask);
  saveTugasKhususList(list);
  return newTask;
}

export function updateTugasKhususStatus(id: string, status: 'aktif' | 'selesai'): void {
  const list = getTugasKhususList();
  const updated = list.map(t => t.id === id ? { ...t, status } : t);
  saveTugasKhususList(updated);
}

export function deleteTugasKhusus(id: string): void {
  const list = getTugasKhususList();
  const filtered = list.filter(t => t.id !== id);
  saveTugasKhususList(filtered);
}

export function markTugasKhususCompletedByAccount(taskId: string, accountId: string): void {
  const list = getTugasKhususList();
  const updated = list.map(t => {
    if (t.id === taskId) {
      const completed = t.completedBy || [];
      if (!completed.includes(accountId)) {
        return { ...t, completedBy: [...completed, accountId] };
      }
    }
    return t;
  });
  saveTugasKhususList(updated);
}
