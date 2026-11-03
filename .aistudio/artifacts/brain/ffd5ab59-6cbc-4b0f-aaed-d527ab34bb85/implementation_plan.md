# Rencana Peningkatan Modul Dasa Wisma PKK & Integrasi Asisten Digital AI

Berdasarkan perbandingan antara modul yang ada dengan spesifikasi **Asisten Digital Pendataan Dasa Wisma PKK**, berikut adalah rencana peningkatan aplikasi secara menyeluruh:

---

## 📊 Perbandingan Singkat (Kondisi Saat Ini vs Target Prompt)

| Fitur / Variabel | Modul Sebelum Peningkatan | Modul Target Peningkatan (Lengkap) |
| :--- | :--- | :--- |
| **Identitas & Wilayah** | Nama Kelompok, Lingkungan, Ketua, No HP | Nama Kelompok, Lingkungan, RT/RW, Kelurahan, Kecamatan, Kota, Nama Ketua & Kontak |
| **Kependudukan & Demografi** | Jumlah KK, Jumlah Jiwa | Jumlah KK, Jumlah Jiwa (Laki-laki & Perempuan), Anak Usia Sekolah, Buta Aksara |
| **Kelompok Khusus (PUS/WUS/Kesehatan)**| Balita, Ibu Hamil, Lansia | Balita, Lansia, **PUS, WUS, Ibu Hamil, Ibu Menyusui/Nifas, Angka Kelahiran/Kematian** |
| **Kesehatan & Sanitasi** | Jamban Sehat, SPAL, TOGA | **Sumber Air Bersih, Jamban (Sehat/Kurang Sehat), Tempat Sampah, SPAL, Kriteria Rumah (Sehat/Kurang Sehat)** |
| **PTP & Industri Rumah Tangga** | TOGA saja | **PTP (Peternakan, Perikanan, Warung Hidup, TOGA, Tanaman Keras), Industri Rumah Tangga (Pangan, Sandang, Jasa, Konveksi)** |
| **Input Mentah / AI Parsing** | Input Manual per Lapangan | **Asisten AI Digitizer: Paste teks mentah / catatan WA / OCR -> Auto-extract ke Dasa Wisma** |
| **Validasi Logika Data** | Manual | **Aturan Otomatis: (L+P)=Total, Jika Bumil maka WUS≥1, Badge Peringatan Logika** |
| **Format Ekspor** | Cetak PDF & Excel Standar | **Cetak Resmi, Excel, dan Format CSV/Tabel Copy-Paste langsung ke Google Sheets** |

---

## 🛠️ Langkah-Langkah Implementasi

### 1. Pembaruan Schema & Types (`src/types.ts`)
- Memperluas interface `KelompokDasaWisma` untuk mencakup seluruh field standar Dasa Wisma PKK (PUS, WUS, Ibu Menyusui, Buta Aksara, Kriteria Rumah, Sumber Air, Sampah, PTP, Industri Rumah Tangga).

### 2. Modul Asisten Digital AI Parser (`src/lib/dasaWismaAiParser.ts`)
- Membuat parser cerdas (berbasis AI / aturan heuristik canggih) untuk mengekstrak teks acak/catatan kader menjadi objek data terstruktur.
- Menerapkan fungsi validasi data otomatis:
  - Validasi Jumlah `(L + P === Total)`.
  - Validasi Logika `(Jika Ibu Hamil > 0, WUS minimal 1)`.
  - Standardisasi Teks (misal: "pdam" -> "PDAM", "ada wc" -> "Jamban Sehat: Ya").

### 3. Pembaruan UI Component (`src/components/PkkDasaWismaView.tsx`)
- **Tab Asisten AI Digitizer**: Tempat kader menempelkan teks mentah/catatan WhatsApp -> Ekstrak Otomatis -> Verifikasi -> Simpan ke Firestore.
- **Form Modal Input Lengkap**: Terbagi menjadi beberapa tab/accordion rapi agar kader tidak kebingungan.
- **Tabel Rekapitulasi & Modul Copy-Paste Google Sheets**: Tombol *Copy CSV / Format Sheets* agar siap di-paste langsung ke Google Sheets/Excel.
- **Badge Status Validasi**: Indikator visual jika ada data yang tidak sinkron/perlu konfirmasi.

---

## 🎯 Hasil Akhir
Modul Dasa Wisma PKK akan menjadi 100% lengkap, cerdas, efisien, dan ramah pengguna bagi kader di lapangan.
