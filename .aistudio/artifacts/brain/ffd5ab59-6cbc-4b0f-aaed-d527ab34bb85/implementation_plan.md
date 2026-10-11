# Rencana Implementasi: Sinkronisasi Real-Time Tugas Khusus via Firebase Firestore

## 1. Analisis Masalah
Saat ini, penambahan Tugas Khusus dari Lurah/Super Admin tidak muncul di HP atau perangkat lain karena:
1. **Penyimpanan Lokal Eksklusif**: `src/lib/tugasKhususService.ts` saat ini hanya membaca dan menulis ke `localStorage` browser lokal (`STORAGE_KEY = 'sikepling_tugas_khusus_list'`). Data tersebut terisolasi di satu perangkat tempat form diisi dan tidak dikirim ke jaringan.
2. **Ketiadaan Real-time Listener**: Komponen `TugasKhususBanner.tsx`, `DaftarTugasKhususView.tsx`, dan `MonitoringSuperAdmin.tsx` hanya mendengarkan custom DOM event di tab/jendela yang sama (`window.addEventListener('sikepling_tugas_khusus_updated')`), belum terhubung dengan listener real-time `onSnapshot` Firebase Firestore.
3. **Status Penyelesaian Terisolasi**: Penandaan tugas selesai (`completedBy`) dan foto bukti dokumentasi lapangan (`sikepling_tugas_khusus_submissions_v1`) juga hanya disimpan di penyimpanan lokal perangkat pengunggah.
4. **Aturan Firestore Belum Ada**: Belum ada rule di `firestore.rules` untuk koleksi `tugas_khusus` dan `tugas_khusus_submissions`.

---

## 2. Arsitektur & Langkah Solusi

### Tahap 1: Aturan Keamanan & Blueprint Firebase Firestore
- Tambahkan izin akses baca dan tulis untuk koleksi:
  - `/tugas_khusus/{docId}`: data daftar tugas khusus dari Lurah.
  - `/tugas_khusus_submissions/{docId}`: data penyerahan foto dokumentasi dan catatan pelaksanaan tugas dari Kepling.
- Update `firestore.rules` dan deploy menggunakan `deploy_firebase`.

### Tahap 2: Modernisasi `src/lib/tugasKhususService.ts`
- Implementasikan integrasi Firestore penuh dengan dukungan offline fallback (`localStorage`):
  - **`subscribeTugasKhusus(onUpdate)`**: Menggunakan `onSnapshot` pada koleksi `tugas_khusus` (diurutkan berdasarkan `createdAt` menurun). Setiap ada tugas baru atau perubahan status di satu perangkat, semua HP lain langsung menerima pembaruan secara instan dalam hitungan milidetik.
  - **`addTugasKhusus`**: Membuat ID unik, membersihkan data dengan `cleanFirestoreData`, lalu menyimpannya langsung ke dokumen Firestore `setDoc(doc(db, 'tugas_khusus', id), ...)`.
  - **`updateTugasKhususStatus`**: Mengubah status tugas (`aktif` / `selesai`) di Firestore.
  - **`deleteTugasKhusus`**: Menghapus dokumen dari Firestore.
  - **`markTugasKhususCompletedByAccount`**: Mengupdate array `completedBy` pada dokumen Firestore sehingga saat Kepling A menyelesaikan tugas, status langsung diperbarui di HP Lurah dan HP Kepling lainnya.
  - **`subscribeTugasKhususSubmissions(onUpdate)` & `saveTugasKhususSubmission`**: Sinkronisasi foto bukti pelaksanaan dan keterangan lapangan lintas perangkat.

### Tahap 3: Pembaruan Komponen UI
1. **`src/components/MonitoringSuperAdmin.tsx`**:
   - Ganti inisialisasi lokal dengan `subscribeTugasKhusus`.
   - Update `handleCreateTugas` untuk mendukung `async/await` saat membuat tugas khusus ke Firestore dengan status loading dan penanganan galat yang ramah pengguna.
   - Tambahkan monitoring real-time terhadap Kepling mana saja yang sudah/belum menyelesaikan tugas.
2. **`src/components/TugasKhususBanner.tsx`**:
   - Hubungkan ke `subscribeTugasKhusus` Firestore secara langsung.
   - Ketika Lurah menerbitkan tugas di komputernya, banner lonceng notifikasi dan getaran (vibrate) langsung menyala di HP Kepling yang ditargetkan tanpa perlu refresh.
3. **`src/components/DaftarTugasKhususView.tsx`**:
   - Hubungkan daftar tugas dan submissions foto ke listener Firestore real-time.
   - Terapkan kompresi foto otomatis (maksimum lebar/tinggi 800px, JPEG kualitas 0.70) sebelum unggah bukti dokumentasi agar ukuran data selalu di bawah 1 MB dan aman di Firestore.

### Tahap 4: Verifikasi & Uji Coba
- Jalankan `compile_applet` untuk memastikan tidak ada kesalahan kompilasi TypeScript atau missing imports.
- Uji alur sinkronisasi: Buat tugas khusus baru dari sisi Lurah, verifikasi tugas tersebut langsung diterima dan tersimpan di database Firestore, serta status penyelesaiannya sinkron secara real-time.

---

## 3. Hasil yang Diharapkan
- Setiap tugas khusus yang diterbitkan oleh Lurah langsung muncul otomatis di seluruh HP Kepling secara real-time.
- Status penyelesaian tugas dan foto dokumentasi tersimpan terpusat di cloud Firebase Firestore, tidak lagi hilang atau terisolasi di satu HP saja.
- Mendukung mode offline: Jika koneksi internet terputus sementara, aplikasi tetap membaca cache lokal dan otomatis menyinkronkan saat kembali online.
