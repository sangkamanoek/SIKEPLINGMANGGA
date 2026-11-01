# Rencana Investigasi & Perbaikan Badge Notifikasi

## Masalah
Badge notifikasi laporan baru (`unreadCounts`) hilang setelah update ke v2.5.1. Masalah terjadi untuk semua pengguna.

## Investigasi
1.  **Analisis Hook `useFeatureNotifications.ts`**: Memastikan logika perhitungan `unreadCounts` masih berjalan dan mengembalikan data yang benar.
2.  **Audit Komponen UI**: Memeriksa `src/components/SmartHubDashboard.tsx` dan `src/components/MobileBottomNav.tsx` untuk memastikan data `unreadCounts` diterima dan dirender dengan benar.
3.  **Pengecekan Dependensi**: Memastikan tidak ada *state* atau *import* yang terganggu selama perubahan pada update terakhir.

## Perbaikan
- Memperbaiki logika rendering badge jika ditemukan *null* atau *undefined* pada data notifikasi.
- Memastikan *real-time listener* pada fitur-fitur terkait tetap aktif dan mengirim data ke `useFeatureNotifications`.
