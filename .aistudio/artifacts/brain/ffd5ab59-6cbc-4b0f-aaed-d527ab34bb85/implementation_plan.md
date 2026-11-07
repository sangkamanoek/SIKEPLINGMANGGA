# Perbaikan & Optimasi Fitur Surat Kedinasan (Firestore & Role Partitioning)

Investigasi mendalam dan perbaikan komprehensif pada modul **Surat Kedinasan** (baik untuk akun Kelurahan/Superadmin maupun PKK), mengatasi masalah data yang tidak tertampil akibat penyaringan string yang rapuh, penandaan kategori yang kurang eksplisit, dan query Firestore `orderBy` yang mengesampingkan dokumen tanpa field tertentu.

## User Review & Critical Decisions

> [!IMPORTANT] Pilihan Desain & Hasil Klarifikasi Pengguna
> - **Penandaan Kategori Eksplisit (`kategori: 'KELURAHAN' | 'PKK'`)**: Setiap dokumen surat yang disimpan ke Firestore, Server API, dan IndexedDB akan menyertakan atribut `kategori` secara eksplisit, serta mencatat `dibuatOlehRole` dan `dibuatOlehNama`.
> - **Tampilan Berdasarkan Peran Akun Aktif**: Tampilan modul Surat Kedinasan disesuaikan dengan peran aktif pengguna (`currentUser.role`), memastikan akun PKK melihat arsip Surat PKK dan akun Kelurahan/Superadmin melihat arsip Surat Kelurahan secara konsisten tanpa kehilangan data.

---

## 1. Overview & Core Concept

- **Problem Statement**: Pengguna melaporkan data Surat Kedinasan yang sudah di-input tidak muncul di layar. Investigasi menunjukkan bahwa penyebab utamanya adalah:
  1. *Fragile Filter*: Penyaringan data sebelumnya mengandalkan pencarian kata kunci string `"pkk"` pada nomor/asal surat, sehingga surat PKK atau Kelurahan dengan nomor resmi (contoh: `005/SK/X/2026`) yang tidak memuat string `"pkk"` menjadi tersembunyi.
  2. *Missing Metadata Fields*: Input dari Buku 2 PKK (`PkkBukuAdministrasiView.tsx`) tidak mengisi field `dibuatOlehRole` dan `kategori`.
  3. *Firestore Query Boundary*: Query Firestore `orderBy('tanggalSurat')` mengeksklusi dokumen jika field `tanggalSurat` kosong atau formatted secara berbeda.
- **Solusi**: 
  1. Menambahkan penandaan kategori `kategori: 'KELURAHAN' | 'PKK'` dan `dibuatOlehRole` pada setiap operasi pembuatan & pembaruan surat (`saveSuratItem`).
  2. Memperbaiki query real-time Firestore di `suratService.ts` tanpa batasan `orderBy` yang kaku, serta melakukan pengurutan (*sorting*) aman di sisi JavaScript.
  3. Memperbarui logika penyaringan di `SuratKedinasanView.tsx` dan `PkkBukuAdministrasiView.tsx` agar menggunakan atribut `kategori` dan `dibuatOlehRole` secara konsisten.

---

## 2. User Experience & Visual Design

- **Tampilan Tabel & Form Surat Kedinasan Kelurahan**:
  - Menampilkan daftar Surat Masuk, Surat Keluar, Surat Keputusan, dan Undangan Resmi khusus Kelurahan secara rapi.
  - Penanda badge kategori warna emerald untuk Kelurahan dan indigo untuk PKK.
- **Tampilan Buku 2 Agenda Surat PKK**:
  - Menampilkan seluruh agenda Surat Masuk dan Surat Keluar PKK tanpa ada dokumen yang tersembunyi.
  - Pengunggahan berkas lampiran PDF/gambar (hingga 50MB via Server API dan IndexedDB, serta penyimpanan metadata di Firestore).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Penggunaan Tag Kategori Eksplisit (`kategori`)**:
  - *Pendekatan*: Menambahkan field `kategori` (`'KELURAHAN'` atau `'PKK'`) pada interface `SuratKedinasanItem` dan selalu mengisi field ini saat pengisian form.
  - *Alasan*: Menghilangkan ketergantungan pada pencarian substring string `"pkk"` yang sering gagal jika nomor atau asal surat menggunakan format standar kedinasan.
- **Decision 2: Optimasi Real-Time Sync Firestore**:
  - *Pendekatan*: Mengambil seluruh dokumen koleksi `surat_kedinasan` dari Firestore tanpa `orderBy` yang kaku di query Firestore SDK, kemudian menggabungkan (*smart merge*) dengan IndexedDB & Server API dan melakukan sorting aman berdasarkan `tanggalSurat` atau `createdAt`.
  - *Alasan*: Mencegah dokumen baru atau dokumen lama tanpa field `tanggalSurat` hilang dari snapshot Firestore.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA PERSISTENCE LAYER                          │
│                                                                        │
│   ┌───────────────────┐     ┌───────────────────┐     ┌─────────────┐  │
│   │ Cloud Firestore   │ ◄──►│ Server REST API   │ ◄──►│ IndexedDB & │  │
│   │ (surat_kedinasan) │     │ (/api/surat)      │     │ LocalStorage│  │
│   └─────────┬─────────┘     └─────────┬─────────┘     └──────┬──────┘  │
└─────────────┼─────────────────────────┼──────────────────────┼─────────┘
              │                         │                      │
              ▼                         ▼                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       SURAT SERVICE (smartMerge)                       │
│  - Memeriksa kategori ('KELURAHAN' | 'PKK')                            │
│  - Menjaga lampiran berkas PDF/Gambar (fileUrl, fileName)              │
│  - Mempublikasikan update ke UI via subscribeSurat & BroadcastChannel  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND UI VIEWS                             │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │ SuratKedinasanView.tsx       │    │ PkkBukuAdministrasiView.tsx  │  │
│  │ (Modul Kedinasan Kelurahan)  │    │ (Buku 2 Agenda Surat PKK)    │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

- **Perubahan Berkas Kunci**:
  1. `src/types.ts`: Memperbarui `SuratKedinasanItem` dengan `kategori?: 'KELURAHAN' | 'PKK'`.
  2. `src/lib/suratService.ts`: Memperbarui `subscribeSurat`, `smartMergeSurat`, dan `saveSuratItem` agar menangani tag `kategori` dan Firestore query tanpa kegagalan `orderBy`.
  3. `src/components/SuratKedinasanView.tsx`: Menggunakan `kategori` untuk pemisahan data dan menyertakan metadata peran saat pembuatan surat.
  4. `src/components/PkkBukuAdministrasiView.tsx`: Menyertakan `kategori: 'PKK'`, `dibuatOlehRole`, dan `dibuatOlehNama` saat membuat Surat Masuk/Keluar Buku 2 PKK.
