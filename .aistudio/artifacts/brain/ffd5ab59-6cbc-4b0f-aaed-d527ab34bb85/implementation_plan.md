# Rencana Implementasi: Percepatan & Pemulihan Visual Data Kunjungan Warga

Berdasarkan preferensi pengguna, periode default tetap mempertahankan **"Hari Ini"**, namun dilengkapi dengan **badge statistik akumulatif 235 kunjungan** dan tombol cepat untuk melihat seluruh riwayat, serta penerapan **arsitektur cache bertingkat (IndexedDB + Server API + Firestore)** agar data langsung tampil instan (0-detik) tanpa layar kosong.

---

## 1. Analisis Permasalahan Saat Ini
1. **235 Data Kunjungan Warga Tersimpan Lengkap di Firestore**: Data tidak hilang, namun tercatat pada rentang September–Oktober 2026.
2. **Filter Hari Ini (9 Nov 2026) Menghasilkan 0**: Saat halaman dibuka, filter aktif menyaring tanggal hari ini sehingga tabel tampak kosong.
3. **Ketergantungan Tunggal pada Koneksi Jaringan Firestore**: `kunjunganService.ts` belum mengintegrasikan IndexedDB atau cache server lokal `/api/kunjungan` pada pembacaan awal, sehingga terjadi *delay* beberapa detik sebelum data muncul.

---

## 2. Rencana Eksekusi

### Langkah 1: Ekstraksi & Persistensi Server Lokal (`data/kunjungan.json`)
- Mengekstraksi seluruh 235 data kunjungan dari Firestore ke berkas `data/kunjungan.json`.
- Memastikan `server.ts` memuat `kunjunganCache` langsung dari `data/kunjungan.json` saat startup.
- Endpoint `GET /api/kunjungan` akan merespons data 235 kunjungan secara instan (<50ms).

### Langkah 2: Akselerasi Pemuatan Klien (`src/lib/kunjunganService.ts`)
- Menerapkan arsitektur pemuatan data multi-tier:
  1. **Tier 1 (0ms - Instan)**: Baca dari `IndexedDB` (`getVisitsFromIndexedDB`) dan `localStorage` seketika saat komponen dimuat.
  2. **Tier 2 (50ms - Server Fast-Path)**: Panggil `fetch('/api/kunjungan')` secara asinkron untuk memperbarui data jika memori lokal kosong.
  3. **Tier 3 (Realtime Background)**: Pertahankan listener Firestore `onSnapshot` di latar belakang untuk sinkronisasi pembaruan dari perangkat Kepling lain.
- Mengirimkan perubahan otomatis ke IndexedDB dan server saat Kepling menambah atau mengedit kunjungan baru.

### Langkah 3: Penambahan Badge Akumulatif & Tombol Pintas (`src/components/KunjunganHarianView.tsx`)
- Mempertahankan filter default aktif pada **"Hari Ini"**.
- Menambahkan **Banner Indikator Akumulatif** di bagian atas tabel kunjungan:
  - Menampilkan badge: **"Total Terdata: 235 Kunjungan Warga"**.
  - Menyertakan tombol pintas satu-klik: **"Lihat Seluruh 235 Riwayat Kunjungan (Semua Periode)"** yang langsung mengalihkan filter ke "SEMUA" jika pengguna ingin meninjau kunjungan bulan-bulan sebelumnya.
  - Memberikan indikator jelas: "Kunjungan Hari Ini: 0 (Belum ada input hari ini) | Total Keseluruhan: 235 Kunjungan".

---

## 3. Rencana Pengujian & Verifikasi
1. **Verifikasi Database & Server**: Pastikan `curl -s http://localhost:3000/api/kunjungan` mengembalikan status sukses dengan 235 data.
2. **Uji Kecepatan Muat (Speed Test)**: Buka modul Kunjungan Harian dan pastikan data terisi seketika tanpa menunggu koneksi cloud.
3. **Uji Filter & Badge**: Pastikan filter Hari Ini tetap aktif secara default dan badge akumulatif 235 kunjungan tampil jelas dengan tombol pintas ke Semua Periode.
4. **Verifikasi Kode**: Jalankan `compile_applet` dan `lint_applet` untuk menjamin 0 error.
