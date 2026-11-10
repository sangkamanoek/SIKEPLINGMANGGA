# Rencana Implementasi: Pemulihan Permanen 37 Anggota PKK Asli

Berdasarkan konfirmasi pengguna, seluruh 37 data anggota PKK asli yang telah diinput sebelumnya di Firestore akan dipulihkan secara penuh dan dijadikan data baku permanen (*permanent baseline*) di dalam sistem agar tidak dapat tertimpa lagi oleh data *placeholder*.

---

## 1. Analisis & Verifikasi Sumber Data
- Telah diekstraksi sebanyak **37 dokumen data anggota asli** dari Firestore collection `pkk_buku_1_anggota`.
- Seluruh data memuat identitas lengkap:
  - **Nama & Jabatan** (Ketua TP-PKK Kelurahan, Sekretaris, Bendahara Hj. Mariana, Ketua Pokja I s/d IV, serta Ketua PKK Lingkungan I, III, IV, VI, VIII, IX, X, XI, XII, XV, XVII, XIX, XXI, dan anggota pokja).
  - **Alamat, Tempat/Tanggal Lahir, Pendidikan, Status Pernikahan, dan Pasfoto Resmi**.
- File cadangan lengkap tersimpan di `/tmp/pkk_37_members_backup.json` (1.1 MB).

---

## 2. Langkah-Langkah Implementasi

### Langkah 1: Pembuatan Berkas Baseline Permanen (`src/data/pkkDefaultAnggota.ts`)
- Memetakan ke-37 data anggota asli ke dalam modul `src/data/pkkDefaultAnggota.ts`.
- Menyertakan data lengkap terstruktur sesuai antarmuka `PkkBuku1Anggota`.
- Menjadikan data ini sebagai sumber awal resmi saat aplikasi diinisialisasi pertama kali atau saat cache perangkat dikosongkan.

### Langkah 2: Pembaruan Layanan Buku Administrasi PKK (`src/lib/pkkBukuService.ts`)
- Mengganti array `DEFAULT_BUKU1_ITEMS` lama (yang sebelumnya men-generate nama acak 24 lingkungan) dengan 37 data anggota asli yang permanen.
- Memperbarui sinkronisasi `subscribeBuku1`:
  - Jika `localStorage` kosong atau berisi data usang, utamakan 37 data asli dari `pkkDefaultAnggota.ts`.
  - Jika Firestore memiliki data, merge cerdas memastikan tidak ada nama asli yang terhapus.
  - Memastikan pasfoto dan identitas asli selalu dirender dengan presisi di Buku I dan KTA PKK.

### Langkah 3: Sinkronisasi Nama Resmi Ketua PKK Lingkungan (`src/data/keplingList.ts`)
- Memperbarui `DEFAULT_PKK_LINGKUNGAN_NAMES` agar mencantumkan nama-nama Ketua PKK Lingkungan asli yang telah diinput:
  - Lingkungan I: Ny. Anggi Prisilya Br. Sembiring
  - Lingkungan III: Ny. Dewi Artati
  - Lingkungan IV: Ny. Leonila Br Ginting
  - Lingkungan VI: Ny. Ponianti
  - Lingkungan VIII: Ny. Sri Nuraisyah
  - Lingkungan X: Ny. Suriati Emma Maria Br Sipayung
  - Lingkungan XI: Ny. Rohinsa Br. Lumbangaol
  - Lingkungan XII: Ny. Rosita
  - Lingkungan XVII: Ny. Ziah Ananda Putri
  - Lingkungan XIX: Ny. Nurlinda
  - Lingkungan XXI: Ny. Fitrianni Tanjung
- Menjaga profil akun login `pkk_lingkungan_*` agar tersinkron otomatis dengan Buku I.

### Langkah 4: Endpoint Sinkronisasi Server (`server.ts` & Fallback)
- Menyimpan cadangan data 37 anggota PKK ke `data/pkk_buku_1_anggota.json` di sisi server agar persisten di seluruh restart container.
- Menambahkan route API `/api/pkk/buku1` untuk pembacaan dan penyimpanan server-side.

---

## 3. Rencana Pengujian & Verifikasi
1. **Verifikasi Kompilasi & Linting**: Jalankan `compile_applet` dan `lint_applet` untuk memastikan tidak ada kesalahan TypeScript.
2. **Verifikasi Tampilan Buku I Administrasi PKK**: Memastikan ke-37 data tampil lengkap di tabel buku anggota beserta pasfoto dan tombol cetak kartu.
3. **Verifikasi Cetak KTA Digital PKK**: Menguji fungsi cetak kartu anggota untuk beberapa pengurus dan ketua lingkungan.
4. **Verifikasi Uji Muat Ulang (*Reload Test*)**: Memastikan setelah browser di-refresh atau cache dibersihkan, data 37 anggota asli tetap muncul dan tidak berubah.
