# Panduan Verifikasi Aplikasi & Rekapitulasi Perubahan Sistem

## A. Ringkasan Perubahan Terbaru (Changelog)
1. **Peningkatan Cetak Laporan Posyandu PKK**:
   - Memastikan cetak laporan Posyandu mencakup rincian lengkap (jumlah kader, rincian usia dari baduta hingga lansia, jenis layanan, catatan) dan foto dokumentasi.
2. **Pemisahan Pendataan Perlinsos**:
   - Pendataan Perlinsos dipisahkan sepenuhnya dari daftar kunjungan harian warga sehingga tidak tercampur otomatis.
3. **Isolasi Wilayah Kepling (Strict Isolation)**:
   - Membatasi akses agar Kepala Lingkungan (Kepling) hanya dapat melihat data dan rekapitulasi di lingkungannya sendiri, sementara Super Admin & Kasi memantau seluruh 24 lingkungan.
4. **Penghapusan Fitur Absensi QR**:
   - Menghapus seluruh komponen, scanner, dan tombol terkait Absensi QR dari sistem.
5. **Kategori Alasan Kendala NOP PBB**:
   - Menambahkan 6 kategori alasan kendala PBB yang belum bayar (*Objek Pajak Tidak Ditemukan*, *WP Tidak Dikenal/Pindah*, *NOP Ganda*, *Keberatan NJOP*, *Sengketa*, dan *Ekonomi Lemah*).
6. **Perbaikan Posisi Modal & Dialog**:
   - Memperbaiki posisi seluruh modal/dialog di seluruh aplikasi agar otomatis berada di tengah layar secara vertikal dan horizontal (`items-center justify-center`).
7. **Kartu Tanda Anggota (KTA) PKK Digital**:
   - Fitur unggah foto pengurus/kader di Buku I administrasi PKK dan pembuatan KTA digital otomatis dengan opsi unduh PDF / PNG.
8. **Visualisasi Grafik Recharts di Dashboard Capaian**:
   - Menambahkan grafik batang Recharts perbandingan Target vs Capaian untuk Perlinsos, PBB, Kunjungan Harian, Absensi, dan Tugas Khusus.

---

## B. Langkah-Langkah Memastikan Aplikasi Berjalan dengan Baik
1. **Uji Coba Login Berbagai Peran**:
   - Masuk sebagai Super Admin, Kasi Pemerintahan/PKK, dan Kepling untuk memastikan batasan isolasi wilayah berfungsi semestinya.
2. **Uji Coba Laporan Posyandu & Buku PKK**:
   - Buka modul PKK, tambahkan entri pada Buku I, unggah pasfoto, dan uji cetak laporan Posyandu serta unduh KTA digital.
3. **Uji Coba Rekap PBB & Kendala NOP**:
   - Buka menu PBB Lingkungan, pilih NOP yang belum lunas, dan tandai dengan salah satu dari 6 kategori kendala yang tersedia.
4. **Uji Coba Sinkronisasi Google Spreadsheet**:
   - Hubungkan akun Google, lalu jalankan sinkronisasi untuk memastikan seluruh data modul terkirim dengan baik.
