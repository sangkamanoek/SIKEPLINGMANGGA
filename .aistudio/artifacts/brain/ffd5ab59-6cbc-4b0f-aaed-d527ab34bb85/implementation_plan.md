# Rencana Perbaikan Sinkronisasi Data & Foto

Berdasarkan laporan Anda bahwa sinkronisasi manual tidak membantu, data kadang kosong, dan foto menampilkan ikon gambar rusak, saya telah menyusun rencana perbaikan berikut:

## 1. Analisis Masalah
*   **Data Kadang Kosong/Kadang Ada**: Ini mengindikasikan masalah pada *listener* real-time (`onSnapshot`) atau *race condition* saat memuat data dari *cache* lokal ke *state* aplikasi.
*   **Ikon Gambar Rusak**: Ini biasanya berarti URL foto (format Base64 atau URL Firestore) tidak tersimpan dengan benar, terpotong karena batas ukuran dokumen Firestore, atau gagal di-*load* oleh komponen gambar.

## 2. Rencana Aksi
1.  **Audit Firestore Data**: Saya akan memeriksa apakah data di Firestore benar-benar tersimpan, atau apakah ada masalah dengan struktur data yang menyebabkan pembacaan gagal.
2.  **Perbaikan Listener Data**: Memperbaiki logika `subscribe` agar lebih tahan banting terhadap koneksi yang tidak stabil dan memastikan `local storage` tidak mengganggu data terbaru dari server.
3.  **Perbaikan Penanganan Foto**: 
    *   Memastikan foto tidak terpotong saat disimpan ke Firestore.
    *   Menambahkan validasi pada komponen gambar untuk menangani *loading* yang gagal secara lebih baik.

## 3. Langkah Selanjutnya
*   Saya akan menjalankan pengecekan koneksi dan integritas data di Firestore.
*   Saya akan memperbaiki logika sinkronisasi agar lebih stabil.

Mohon konfirmasi jika rencana ini dapat segera saya eksekusi.
